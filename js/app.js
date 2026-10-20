/* ==========================================================================
   Sufiology app: accounts, booking requests, blog, admin and dashboard.
   Data comes from js/backend.js (preview or live), content from js/data.js.

   Sections in this file:
    1. Helpers
    2. Sign-in box
    3. Signed-in state (menu, which parts of the page to refresh)
    4. Booking: session choice and request form
    5. Blog (public)
    6. Admin: write posts
    7. Dashboard: booking requests (the admin sets each request's status)
    7b. My requests: the client's own requests and their status
    8. Which view is showing (home, blog, admin, dashboard, my requests)
    9. Start
   ========================================================================== */
(function () {
  "use strict";

  const backend = window.SufBackend;
  const sessions = window.SUF_DATA.sessions;
  const countries = window.SUF_DATA.countries;
  const originalTitle = document.title;

  let currentUser = null;            // null when signed out, otherwise { email, admin }
  let chosenTier = "dwapara";
  let sentMessage = "";              // shown after a request has been sent
  let signInMode = "in";             // "in" or "up" (create account)


  /* ---------- 1. Helpers ---------- */
  const byId = (id) => document.getElementById(id);

  /* Makes an element. Text is always set with textContent, so nothing typed by a visitor can run as code. */
  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  function makeButton(label, onClick, extraClass) {
    const button = make("button", "btn" + (extraClass ? " " + extraClass : ""), label);
    button.type = "button";
    button.onclick = onClick;
    return button;
  }
  // Shows a button as pressed for a moment (used when Enter presses it, where the mouse cannot show it)
  function flashPressed(button) {
    button.classList.add("pressed");
    setTimeout(() => button.classList.remove("pressed"), 180);
  }
  function makeLink(href, label) {
    const link = make("a", "btn", label);
    link.href = href;
    return link;
  }
  const rupees = (n) => "₹" + n.toLocaleString("en-IN");
  function formatDate(date) {
    try { return new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
    catch (e) { return ""; }
  }
  const hindiNumber = (n) => String(n).replace(/\d/g, (digit) => "०१२३४५६७८९"[digit]);
  const digitsOnly = (text) => String(text).replace(/\D/g, "");
  const tierName = (key) => (sessions[key] || {}).name || key;
  const statuses = window.SUF_DATA.bookingStatuses;
  const statusInfo = (key) => statuses.find((s) => s.key === key) || statuses[0];   // an old request with no status counts as "not seen"
  function formatDateTime(date) {
    try { return new Date(date).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }); }
    catch (e) { return ""; }
  }


  /* ---------- Cloudflare Turnstile: the "are you human" check (live mode only) ---------- */
  // Most visitors pass without seeing anything; a box appears only when the check is unsure (appearance: interaction-only).
  // The token it makes is sent to Supabase with the sign-in or sign-up. Supabase checks it with the secret key.
  const captchaKey = (window.SUF && window.SUF.turnstileSitekey) || "";
  const captchaOn = !!(captchaKey && window.SUF && window.SUF.supabaseUrl);
  let captchaId = null;
  function loadCaptchaScript() {
    return new Promise((resolve, reject) => {
      if (window.turnstile) return resolve();
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error("Could not load the human check. Please try again."));
      document.head.appendChild(script);
    });
  }
  function showCaptcha() {
    if (!captchaOn) return;
    loadCaptchaScript().then(() => {
      if (captchaId === null) {
        captchaId = window.turnstile.render("#authCaptcha", {
          sitekey: captchaKey,
          theme: "light",                       // the sign-in window is white in both colour modes
          appearance: "interaction-only",
          "error-callback": () => { byId("authError").textContent = "The human check could not run. Refresh the page and try again."; }
        });
      } else {
        window.turnstile.reset(captchaId);
      }
    }).catch((error) => { byId("authError").textContent = error.message; });
  }

  /* ---------- Plain-language sign-in messages ---------- */
  // Turns the library's technical errors into short sentences a client can act on.
  function friendlyAuthError(error, mode) {
    const text = String((error && (error.message || error.error_description)) || "").toLowerCase();
    const code = String((error && (error.code || error.error_code)) || "").toLowerCase();
    const has = (...words) => words.some((word) => text.includes(word) || code.includes(word));

    if (has("already registered", "already exists", "already has an account", "user_already_exists", "email_exists")) return "There is already an account with this email. Tap “Have an account? Sign in” below.";
    if (has("invalid login", "invalid_credentials", "wrong email")) return mode === "in" ? "That email and password do not match. Check them and try again, or create an account if you are new here." : "That did not work. Please try again.";
    if (has("not confirmed", "email_not_confirmed")) return "Please confirm your email first. Open the email we sent you, tap the link, then sign in here.";
    if (has("leaked", "pwned", "weak_password", "weak password", "easy to guess")) return "That password is too easy to guess. Try a longer one, with letters and numbers.";
    if (has("at least", "too short", "password should")) return "Your password needs at least 8 characters.";
    if (has("rate limit", "rate_limit", "too many", "429", "security purposes")) return "Too many tries in a short time. Please wait a few minutes and try again.";
    if (has("captcha")) return "The human check did not go through. Wait a moment and try again. If it keeps failing, refresh the page.";
    if (has("failed to fetch", "networkerror", "network request", "load failed")) return "Cannot reach the server. Check your internet connection and try again.";
    if (has("signup is disabled", "signups not allowed", "provider is not enabled", "unsupported provider")) return "This sign-in option is not available yet. Please use your email and password.";
    if (has("invalid email", "email_address_invalid", "unable to validate email")) return "That email address does not look right. It should look like name@example.com.";
    if (error && error.friendly) return error.message;
    return "Something went wrong on our side. Please try again in a moment, or message Nishaad on WhatsApp.";
  }

  /* ---------- 2. Sign-in box ---------- */
  function setSignInMode(mode) {
    signInMode = mode;
    byId("authTitle").textContent = mode === "in" ? "Sign in" : "Create your account";
    byId("authSubmit").textContent = mode === "in" ? "Sign in" : "Create account";
    byId("authSwitch").textContent = mode === "in" ? "New here? Create an account" : "Have an account? Sign in";
    byId("authPassword").autocomplete = mode === "in" ? "current-password" : "new-password";
    byId("authError").textContent = "";
    byId("authError").hidden = true;
    byId("authPasswordHint").hidden = mode === "in";
    byId("authForm").hidden = false;
    byId("authDone").hidden = true;
    const google = byId("authGoogleBlock");
    if (google) google.querySelector("span.g-label").textContent = mode === "in" ? "Continue with Google" : "Sign up with Google";
  }

  // One place to show a problem. It sits at the top of the box so it is seen on a phone without scrolling.
  function showAuthProblem(message) {
    const box = byId("authError");
    box.textContent = message;
    box.hidden = !message;
    if (message) box.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  // After "Create account": replace the form with a clear "check your email" screen
  function showCheckYourEmail(email) {
    byId("authForm").hidden = true;
    byId("authDoneEmail").textContent = email;
    byId("authDone").hidden = false;
    byId("authDone").scrollIntoView({ block: "nearest" });
    byId("authDoneBack").focus();
  }

  function buildSignInBox() {
    const box = document.createElement("dialog");
    box.id = "authBox";
    const googleOn = !!(window.SUF && window.SUF.googleSignIn && window.SUF.supabaseUrl);
    box.innerHTML =
      '<form id="authForm" novalidate>' +
        '<h2 id="authTitle"></h2>' +
        '<p id="authError" role="alert" hidden></p>' +
        (googleOn
          ? '<div id="authGoogleBlock"><button type="button" class="btn-google" id="authGoogle">' +
            '<svg viewBox="0 0 48 48" width="22" height="22" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>' +
            '<span class="g-label">Continue with Google</span></button>' +
            '<p class="auth-or"><span>or use your email</span></p></div>'
          : "") +
        '<label class="fld">Email<input id="authEmail" type="email" required autocomplete="email" inputmode="email" autocapitalize="none" spellcheck="false" placeholder="name@example.com"></label>' +
        '<label class="fld">Password<div class="pw">' +
          '<input id="authPassword" type="password" required minlength="8">' +
          '<button type="button" id="authShow" aria-pressed="false">Show</button></div></label>' +
        '<p class="fine" id="authPasswordHint" hidden>At least 8 characters.</p>' +
        '<div id="authCaptcha"></div>' +
        '<button class="btn" id="authSubmit" type="submit"></button>' +
        '<div class="auth-links"><button type="button" class="link-button" id="authSwitch"></button>' +
        '<button type="button" class="link-button" id="authClose">Close</button></div>' +
      "</form>" +
      '<div id="authDone" hidden>' +
        '<svg viewBox="0 0 24 24" width="56" height="56" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M3 7.5l9 6 9-6"/></svg>' +
        '<h2>Check your email</h2>' +
        '<p>Your account is created. We sent a confirmation link to <b id="authDoneEmail"></b>.</p>' +
        '<ol><li>Open that email.</li><li>Tap the link inside.</li><li>Come back here and sign in.</li></ol>' +
        '<p class="fine">Cannot find it? Look in spam or junk. It can take a minute or two.</p>' +
        '<button type="button" class="btn" id="authDoneBack">Go to sign in</button>' +
      "</div>";
    document.body.appendChild(box);

    byId("authClose").onclick = () => box.close();

    // Pressing Enter in the email or password box sends the form, the same as pressing the Sign in button
    [byId("authEmail"), byId("authPassword")].forEach((field) => {
      field.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" || event.isComposing) return;
        event.preventDefault();
        byId("authForm").requestSubmit();
      });
    });

    // Clicking anywhere outside the white box (on the dark backdrop) closes it too
    box.addEventListener("click", (event) => {
      const edge = box.getBoundingClientRect();
      const clickedOutside = event.clientX < edge.left || event.clientX > edge.right ||
                             event.clientY < edge.top || event.clientY > edge.bottom;
      if (clickedOutside) box.close();
    });
    byId("authSwitch").onclick = () => setSignInMode(signInMode === "in" ? "up" : "in");

    // Show / Hide password
    byId("authShow").onclick = function () {
      const field = byId("authPassword");
      const revealing = field.type === "password";
      field.type = revealing ? "text" : "password";
      this.textContent = revealing ? "Hide" : "Show";
      this.setAttribute("aria-pressed", revealing);
    };

    byId("authDoneBack").onclick = () => { setSignInMode("in"); byId("authEmail").focus(); };

    const googleButton = byId("authGoogle");
    if (googleButton) googleButton.onclick = () => {
      showAuthProblem("");
      googleButton.disabled = true;
      backend.signInWithGoogle().catch((error) => {
        googleButton.disabled = false;
        showAuthProblem(friendlyAuthError(error, signInMode));
      });
    };

    byId("authForm").onsubmit = (event) => {
      event.preventDefault();
      showAuthProblem("");
      const email = byId("authEmail").value.trim().toLowerCase();
      const password = byId("authPassword").value;

      // Check the boxes ourselves, in plain words, before asking the server
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { showAuthProblem("Enter your email address, like name@example.com."); byId("authEmail").focus(); return; }
      if (!password) { showAuthProblem("Enter your password."); byId("authPassword").focus(); return; }
      if (signInMode === "up" && password.length < 8) { showAuthProblem("Choose a password with at least 8 characters."); byId("authPassword").focus(); return; }

      const action = signInMode === "in" ? backend.signIn : backend.signUp;
      let token = "";
      if (captchaOn) {
        token = captchaId === null ? "" : window.turnstile.getResponse(captchaId);
        if (!token) { showAuthProblem("One moment: the human check is still running. Wait a second, then press the button again."); return; }
      }
      const submit = byId("authSubmit");
      const idleLabel = submit.textContent;
      flashPressed(submit);
      submit.disabled = true;
      submit.textContent = signInMode === "in" ? "Signing in…" : "Creating account…";
      action(email, password, token)
        .then((outcome) => {
          byId("authPassword").value = "";
          if (outcome && outcome.confirmEmail) { showCheckYourEmail(email); return; }   // created, but must confirm by email first
          box.close();
          return refreshAll();
        })
        .catch((error) => { showAuthProblem(friendlyAuthError(error, signInMode)); })
        .then(() => { submit.disabled = false; submit.textContent = idleLabel; if (captchaOn && captchaId !== null) window.turnstile.reset(captchaId); });
    };
    return box;
  }

  function openSignInBox(mode) {
    const box = byId("authBox") || buildSignInBox();
    setSignInMode(mode || "in");
    box.showModal();
    showCaptcha();
  }


  /* ---------- 3. Signed-in state ---------- */
  function refreshAll() {
    return backend.getUser().catch(() => null).then((user) => {
      currentUser = user;
      byId("authText").textContent = user ? "Sign out" : "Sign in";
      byId("navMine").hidden = !user || user.admin;      // clients only: the admin has the Dashboard (and the top bar is already full)
      byId("navWrite").hidden = !(user && user.admin);
      byId("navDashboard").hidden = !(user && user.admin);
      renderBooking();
      renderBlog();
      renderAdmin();
      renderDashboard();
      renderMine();
      numberMenu();
    });
  }

  /* The little Hindi number in front of each menu item counts only the items that are showing, so there are no gaps. */
  function numberMenu() {
    let count = 0;
    document.querySelectorAll("#menu li").forEach((item) => {
      if (item.hidden) return;
      count += 1;
      const number = item.querySelector("i");
      if (number) number.textContent = hindiNumber(count);
    });
  }

  byId("authLink").addEventListener("click", (event) => {
    event.preventDefault();
    if (currentUser) backend.signOut().then(refreshAll);
    else openSignInBox("in");
  });


  /* ---------- 4. Booking: session choice and request form ---------- */
  const bookingForm = byId("bookingForm");
  const countrySelect = byId("fCountry");
  const phoneInput = byId("fPhone");
  const timeZone = (window.Intl && Intl.DateTimeFormat().resolvedOptions().timeZone) || "";

  /* The three session boxes. Built once, then just re-ticked. */
  function renderTierChoices() {
    const wrap = byId("tiers");
    if (!wrap.children.length) {
      Object.keys(sessions).forEach((key) => {
        const label = make("label", "tier");
        const radio = make("input");
        radio.type = "radio"; radio.name = "tier"; radio.value = key;
        radio.onchange = () => { chosenTier = key; sentMessage = ""; renderBooking(); };
        label.append(radio, make("b", null, sessions[key].name),
                     make("span", null, rupees(sessions[key].price)), make("span", null, sessions[key].length));
        wrap.appendChild(label);
      });
    }
    wrap.querySelectorAll("input").forEach((radio) => { radio.checked = radio.value === chosenTier; });
  }

  /* Shows either the sign-in prompt or the request form, depending on whether you are signed in. */
  function renderBooking() {
    renderTierChoices();
    const actions = byId("bookingActions");
    const message = byId("bookingMessage");
    actions.textContent = "";

    message.classList.remove("sent");

    if (!currentUser) {
      bookingForm.hidden = true;
      message.textContent = "You don’t need an account to browse the site or read the notes. An account is only needed to send a booking request.";
      actions.append(makeButton("Create an account to book", () => openSignInBox("up")),
                     makeButton("Sign in", () => openSignInBox("in")));
      return;
    }

    // Right after sending: hide the form and show only the confirmation
    if (sentMessage) {
      bookingForm.hidden = true;
      message.textContent = sentMessage;
      message.classList.add("sent");
      actions.append(makeLink("#my-requests", "See your request status"),
                     makeButton("Send another request", () => { sentMessage = ""; renderBooking(); }));
      return;
    }

    bookingForm.hidden = false;
    if (!byId("fEmail").value) byId("fEmail").value = currentUser.email;
    message.textContent = `Booking the ${tierName(chosenTier)} session. Fill in the form below.`;
  }

  /* ----- Phone number: the digit count depends on the country ----- */
  function currentCountry() {
    return countries.find((c) => c.code === countrySelect.value) || countries[0];
  }
  function validatePhone() {
    const c = currentCountry();
    const digits = phoneInput.value;
    let problem = "";
    if (digits.length < c.min || digits.length > c.max) {
      problem = "Enter " + (c.min === c.max ? "exactly " + c.max : c.min + " to " + c.max) + " digits, without the country code.";
    } else if (c.code === "+91" && !/^[6-9]/.test(digits)) {
      problem = "Indian mobile numbers start with 6, 7, 8 or 9.";
    }
    phoneInput.setCustomValidity(problem);
  }
  function applyCountry() {
    const c = currentCountry();
    phoneInput.maxLength = c.max;
    phoneInput.placeholder = c.min === c.max ? c.max + " digits" : c.min + " to " + c.max + " digits";
    phoneInput.value = digitsOnly(phoneInput.value).slice(0, c.max);
    validatePhone();
  }

  function setUpBookingForm() {
    // Country dropdown
    countries.forEach((c) => {
      const option = make("option", null, `${c.code} ${c.name}`);
      option.value = c.code;
      countrySelect.appendChild(option);
    });
    countrySelect.value = "+91";
    countrySelect.onchange = applyCountry;
    phoneInput.oninput = () => { phoneInput.value = digitsOnly(phoneInput.value).slice(0, phoneInput.maxLength); validatePhone(); };
    applyCountry();

    // Earliest date you can pick is today
    const today = new Date();
    byId("fDate").min = today.getFullYear() + "-" + ("0" + (today.getMonth() + 1)).slice(-2) + "-" + ("0" + today.getDate()).slice(-2);
    byId("timezoneNote").textContent = "Times are in your own time zone" + (timeZone ? " (" + timeZone + ")" : "") + ".";

    // The concern must say something (spaces alone do not count)
    const concern = byId("fConcern");
    const checkConcern = () => concern.setCustomValidity(concern.value.trim() ? "" : "Please describe your concern.");
    concern.addEventListener("input", checkConcern);
    checkConcern();

    bookingForm.onsubmit = (event) => {
      event.preventDefault();
      validatePhone();
      checkConcern();
      if (!bookingForm.reportValidity()) return;

      const value = (id) => byId(id).value.trim();
      const submit = bookingForm.querySelector("button[type=submit]");
      submit.disabled = true;

      backend.sendBooking({
        tier: chosenTier,
        name: value("fName"),
        date: value("fDate"),
        time: value("fTime"),
        whatsapp: countrySelect.value + phoneInput.value,
        contact_email: value("fEmail"),
        birth_date: value("fBirthDate"),
        birth_time: value("fBirthTime"),
        birth_place: value("fBirthPlace"),
        concern: value("fConcern"),
        timezone: timeZone,
        // The three tick boxes. The server checks them and records the time (supabase/migrations/006_record_consent.sql).
        consent: byId("fConsent").checked,
        consent_data: byId("fConsentData").checked,
        consent_age: byId("fConsentAge").checked
      }).then(() => {
        sentMessage = "Request sent. You will get a reply by email or WhatsApp once your slot is confirmed, with payment details and your video call link." +
                      (backend.isPreview ? " (Preview mode: no email was actually sent.)" : "");
        bookingForm.reset();
        countrySelect.value = "+91";
        applyCountry();
        checkConcern();
        byId("fEmail").value = currentUser.email;
        renderBooking();
        byId("bookingMessage").scrollIntoView({ behavior: "smooth", block: "center" });
      }).catch((error) => {
        byId("bookingMessage").textContent = error.message || "Could not send your request.";
      }).then(() => { submit.disabled = false; });
    };
  }
  if (bookingForm) setUpBookingForm();

  // The "Book Dwapara / Treta / Satya" buttons on the cards choose that session
  document.querySelectorAll("[data-tier]").forEach((button) => {
    button.addEventListener("click", () => { chosenTier = button.getAttribute("data-tier"); sentMessage = ""; renderBooking(); });
  });


  /* ---------- 5. Blog (public) ---------- */
  /* One post in the list: a coloured card with the date, title, a short preview and a big Hindi number */
  function buildPostCard(post, number) {
    const card = make("a", "post-card");
    card.href = "#blog/" + encodeURIComponent(post.id);
    const preview = post.body.replace(/\s+/g, " ").slice(0, 150) + (post.body.length > 150 ? "…" : "");
    card.append(make("span", "pill", formatDate(post.created_at)), make("h3", null, post.title),
                make("p", null, preview), make("span", "read", "Read the post →"),
                make("span", "post-card-number hi", hindiNumber(number)));
    card.lastChild.setAttribute("aria-hidden", "true");
    return card;
  }

  /* Shown while there are no posts. No made-up posts: it points to the channel instead. */
  function buildEmptyBlogNotice() {
    const box = make("div", "blog-empty");
    const om = make("span", "om hi", "ॐ");
    om.setAttribute("aria-hidden", "true");
    const youtube = makeLink("https://www.youtube.com/@nishaadsharma", "Watch on YouTube");
    youtube.target = "_blank"; youtube.rel = "noopener";
    box.append(om, make("h3", null, "The first post is on its way."),
               make("p", null, "Until then, Nishaad Sharma explains Vedic astrology in plain language on YouTube."),
               youtube, makeLink("#top", "Back to home"));
    return box;
  }

  function renderBlog() {
    const list = byId("blogList");
    if (!document.body.classList.contains("view-blog")) return;

    const match = location.hash.match(/^#blog\/(.+)$/);
    let postId = null;
    if (match) {
      try { postId = decodeURIComponent(match[1]); }
      catch (e) { postId = ""; }                              // a broken link (such as #blog/%) just shows "not found"
    }
    byId("blogHero").hidden = postId !== null;                       // the big header band is for the list only
    byId("blogView").classList.toggle("post-open", postId !== null);

    backend.getPosts(false).then((posts) => {
      list.textContent = "";

      if (postId !== null) {                                // one post
        const post = posts.find((p) => p.id === postId);
        if (!post) {
          list.append(make("p", null, "That post wasn’t found."), makeLink("#blog", "All posts"));
          return;
        }
        document.title = post.title + " — Sufiology";
        list.append(makeLink("#blog", "← All posts"), make("h1", "post-title", post.title), make("p", "post-date", formatDate(post.created_at)));
        post.body.split(/\n{2,}/).forEach((paragraph) => list.appendChild(make("p", "post-text", paragraph)));
        list.appendChild(makeLink("#blog", "All posts"));
        return;
      }

      if (!posts.length) { list.appendChild(buildEmptyBlogNotice()); return; }
      const grid = make("div", "blog-grid");                   // list of posts
      posts.forEach((post, position) => grid.appendChild(buildPostCard(post, position + 1)));
      list.appendChild(grid);
    }).catch(() => { list.textContent = "Could not load posts."; });
  }


  /* ---------- 6. Admin: write posts ---------- */
  function adminOnlyNotice(root) {
    root.append(make("p", null, "This page is for admin accounts only."),
                makeButton(currentUser ? "Sign in as admin" : "Sign in", () => openSignInBox("in")));
  }

  /* The admin pages need the 6-digit code from an authenticator app as well as the password.
     First time: show a QR code to scan. After that: just ask for the code. */
  function twoStepPanel(root) {
    const box = make("div", "panel twostep");
    const message = make("p", null);
    message.setAttribute("role", "status");
    const input = make("input");
    input.type = "text"; input.inputMode = "numeric"; input.autocomplete = "one-time-code";
    input.maxLength = 6; input.placeholder = "6-digit code"; input.setAttribute("aria-label", "6-digit code");
    let factorId = null;

    // One place for the message under the box, so a problem shows in red and normal progress does not
    const say = (text, problem) => { message.textContent = text; message.classList.toggle("bad", !!problem); };

    const confirm = makeButton("Confirm", () => {
      flashPressed(confirm);                                   // visible even when Enter pressed it
      const code = input.value.replace(/\s/g, "");
      if (!/^\d{6}$/.test(code)) { say("Enter the 6 digits from your authenticator app.", true); input.focus(); return; }
      confirm.disabled = true;
      confirm.classList.add("busy");
      confirm.textContent = "Checking…";
      say("Checking your code…", false);
      backend.twoStepVerify(code, factorId)
        .then(refreshAll)
        .catch(() => {
          confirm.disabled = false; confirm.classList.remove("busy"); confirm.textContent = "Confirm";
          say("That code didn’t work. Check the code and try again.", true);
          input.select();
        });
    });
    // Pressing Enter in the code box does the same as pressing Confirm
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.isComposing) return;
      event.preventDefault();
      if (!confirm.disabled) confirm.click();
    });
    const codeRow = make("div", "form-actions");
    codeRow.append(input, confirm);

    if (currentUser.hasTwoStep) {
      box.append(make("h3", null, "Enter your admin code"),
                 make("p", null, "Open your authenticator app and type the 6-digit code for Sufiology."), codeRow, message);
    } else {
      const start = makeButton("Set up two-step sign-in", () => {
        start.disabled = true;
        backend.twoStepStart().then((setup) => {
          factorId = setup.factorId;
          const qr = make("img", "twostep-qr");
          qr.src = setup.qr; qr.alt = "QR code to scan with your authenticator app"; qr.width = 200; qr.height = 200;
          const secret = make("code", null, setup.secret);
          start.remove();
          box.append(make("p", null, "1. Scan this code with an authenticator app (Google Authenticator, Microsoft Authenticator, Authy or 1Password)."), qr,
                     make("p", null, "Or type this key into the app by hand. Keep a copy somewhere safe, it is the only way to set the app up again on a new phone:"), secret,
                     make("p", null, "2. Type the 6-digit code the app shows."), codeRow, message);
        }).catch(() => { message.textContent = "Could not start the setup. Please try again."; start.disabled = false; });
      });
      box.append(make("h3", null, "Set up two-step sign-in"),
                 make("p", null, "Admin pages need a code from an authenticator app as well as your password. This takes about a minute."), start, message);
    }
    root.appendChild(box);
  }

  function renderAdmin() {
    const root = byId("adminBody");
    if (!document.body.classList.contains("view-admin")) return;
    root.textContent = "";
    if (!currentUser || !currentUser.admin) { adminOnlyNotice(root); return; }
    if (currentUser.needsTwoStep) { twoStepPanel(root); return; }

    let editingId = null;
    const form = document.createElement("form");
    form.className = "panel";
    form.innerHTML =
      '<h3 id="postFormTitle">New post</h3>' +
      '<label class="fld">Title<input id="postTitle" required></label>' +
      '<label class="fld">Post (a blank line starts a new paragraph)<textarea id="postBody" rows="12" required></textarea></label>' +
      '<label class="fld check"><input id="postPublished" type="checkbox" checked>Published</label>' +
      '<div class="form-actions"><button class="btn" type="submit">Save post</button>' +
      '<button class="link-button" type="button" id="postClear">Clear</button></div>' +
      '<p id="postStatus" role="status"></p>';
    const postCount = make("span");
    const postList = make("div");
    const postsHeading = make("h2", null, "Your posts");
    const postsTitle = make("div", "section-title");
    postsTitle.append(postsHeading, postCount);
    root.append(form, postsTitle, postList);

    function clearForm() {
      editingId = null;
      form.reset();
      byId("postFormTitle").textContent = "New post";
      byId("postStatus").textContent = "";
    }
    byId("postClear").onclick = clearForm;

    form.onsubmit = (event) => {
      event.preventDefault();
      backend.savePost({
        id: editingId,
        title: byId("postTitle").value.trim(),
        body: byId("postBody").value,
        published: byId("postPublished").checked
      }).then(() => { clearForm(); byId("postStatus").textContent = "Saved."; showPosts(); })
        .catch((error) => { byId("postStatus").textContent = error.message || "Could not save."; });
    };

    function showPosts() {
      backend.getPosts(true).then((posts) => {
        postList.textContent = "";
        postCount.textContent = String(posts.length);
        if (!posts.length) postList.appendChild(make("p", null, "No posts yet."));
        posts.forEach((post) => {
          const row = make("div", "post-row");
          const title = make("span", "post-row-title", post.title);
          if (!post.published) title.appendChild(make("span", "pill draft", "Draft"));
          row.appendChild(title);
          const buttons = make("span", "post-row-buttons");
          buttons.append(
            makeButton("Edit", () => {
              editingId = post.id;
              byId("postFormTitle").textContent = "Edit post";
              byId("postTitle").value = post.title;
              byId("postBody").value = post.body;
              byId("postPublished").checked = !!post.published;
              form.scrollIntoView({ behavior: "smooth" });
            }, "small"),
            makeButton("Delete", () => { if (confirm("Delete this post?")) backend.deletePost(post.id).then(showPosts); }, "small danger")
          );
          row.appendChild(buttons);
          postList.appendChild(row);
        });
      });
    }
    showPosts();
  }


  /* ---------- 7. Dashboard: booking requests ---------- */

  /* One label and value line inside a request, e.g. "Email   name@example.com" */
  function addDetail(list, label, ...valueNodes) {
    const value = make("dd");
    value.append(...valueNodes);
    list.append(make("dt", null, label), value);
  }
  function makeExternalLink(href, label) {
    const link = make("a", null, label);
    link.href = href;
    link.target = "_blank"; link.rel = "noopener";
    return link;
  }

  /* The status picker on each request: four buttons, the current one is filled.
     Clicking one saves it straight away. "onChange" lets the dashboard refresh its count. */
  function statusControl(b, onChange) {
    const wrap = make("div", "status-set");
    const label = make("span", "status-label", "Status");
    const group = make("div", "status-options");
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-label", "Status of this request");
    const problem = make("p", "status-problem");
    problem.setAttribute("role", "alert");
    problem.hidden = true;
    const buttons = {};

    function show(current) {
      statuses.forEach((s) => {
        buttons[s.key].classList.toggle("on", s.key === current);
        buttons[s.key].setAttribute("aria-checked", s.key === current);
      });
    }
    statuses.forEach((s) => {
      const button = make("button", "status-opt status-" + s.key, s.label);
      button.type = "button";
      button.setAttribute("role", "radio");
      button.onclick = () => {
        const before = statusInfo(b.status).key;
        if (before === s.key) return;
        problem.hidden = true;
        show(s.key);                                              // show the change at once
        Object.values(buttons).forEach((x) => { x.disabled = true; });
        backend.updateBookingStatus(b.id, s.key)
          .then((saved) => { b.status = s.key; b.status_updated_at = saved.status_updated_at; if (onChange) onChange(); })
          .catch(() => {
            show(before);                                         // put it back
            problem.textContent = "Could not save the status. Check your connection, and that supabase/migrations/007_booking_status.sql has been run.";
            problem.hidden = false;
          })
          .then(() => { Object.values(buttons).forEach((x) => { x.disabled = false; }); });
      };
      buttons[s.key] = button;
      group.appendChild(button);
    });
    show(statusInfo(b.status).key);
    wrap.append(label, group, problem);
    return wrap;
  }

  function bookingCard(b, onChange) {
    const when = `${b.date} at ${b.time}` + (b.timezone ? ` (${b.timezone})` : "");
    const SAFE_EMAIL = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;   // never put unchecked text inside a mailto: link
    const replyEmail = SAFE_EMAIL.test(b.contact_email || "") ? b.contact_email : b.email;
    const whatsappNumber = digitsOnly(b.whatsapp);

    const card = make("article", "panel");

    const head = make("div", "request-head");
    head.append(make("h3", null, b.name), make("span", "pill", tierName(b.tier)));
    card.append(head, make("p", "request-when", when));

    const details = make("dl", "request-details");
    const emailLink = make("a", null, replyEmail);
    emailLink.href = "mailto:" + replyEmail;
    addDetail(details, "Email", emailLink);
    addDetail(details, "WhatsApp", makeExternalLink("https://wa.me/" + whatsappNumber, b.whatsapp));
    addDetail(details, "Born", document.createTextNode(`${b.birth_date}, ${b.birth_time}, ${b.birth_place}`));
    addDetail(details, "Concern", document.createTextNode(b.concern || b.note || ""));
    const agreed = b.consent_at
      ? new Date(b.consent_at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) + (b.consent_version ? " (terms of " + b.consent_version + ")" : "")
      : "Not recorded (sent before consent was recorded)";
    addDetail(details, "Agreed to terms", document.createTextNode(agreed));
    addDetail(details, "Sent", document.createTextNode(formatDateTime(b.created_at)));
    card.append(statusControl(b, onChange), details);

    // Reply buttons come with a ready-made message
    const message =
      `Hello ${b.name},\n\nThank you for booking a ${tierName(b.tier)} session. Your session is on ${when}.\n\n` +
      "Here is your video call link: \n\nRegards";
    const emailReply = make("a", "btn small", "Reply by email");
    emailReply.href = "mailto:" + replyEmail + "?subject=" + encodeURIComponent("Your Sufiology session") + "&body=" + encodeURIComponent(message);
    const whatsappReply = make("a", "btn small", "Reply on WhatsApp");
    whatsappReply.href = "https://wa.me/" + whatsappNumber + "?text=" + encodeURIComponent(message);
    whatsappReply.target = "_blank"; whatsappReply.rel = "noopener";
    const buttons = make("div", "request-actions");
    buttons.append(emailReply, whatsappReply);
    card.appendChild(buttons);
    return card;
  }

  function renderDashboard() {
    const root = byId("dashboardBody");
    if (!document.body.classList.contains("view-dashboard")) return;
    root.textContent = "";
    if (!currentUser || !currentUser.admin) { adminOnlyNotice(root); return; }
    if (currentUser.needsTwoStep) { twoStepPanel(root); return; }

    /* Two lists: requests still being handled, and completed bookings (status "Done").
       Setting a request to Done moves it to "Completed bookings" at once; setting it back moves it back. */
    const count = make("span");
    const title = make("div", "section-title");
    title.append(make("h2", null, "Booking requests"), count);
    const movedNote = make("p", "moved-note");
    movedNote.setAttribute("role", "status");
    movedNote.hidden = true;
    const openList = make("div");

    const completed = make("details", "completed-section");
    const completedCount = make("span");
    const completedTitle = make("summary", "section-title");
    completedTitle.append(make("h2", null, "Completed bookings"), completedCount);
    const completedList = make("div");
    completed.append(completedTitle, completedList);

    root.append(title, movedNote, openList, completed);

    let loaded = [];
    let doneIds = new Set();            // which requests were in "Completed" the last time the lists were drawn
    let noteTimer = null;
    const isDone = (b) => statusInfo(b.status).key === "done";
    const whenDone = (b) => new Date(b.status_updated_at || b.created_at).getTime() || 0;

    function say(text) {
      movedNote.textContent = text;
      movedNote.hidden = false;
      clearTimeout(noteTimer);
      noteTimer = setTimeout(() => { movedNote.hidden = true; }, 8000);
    }

    function drawLists() {
      const open = loaded.filter((b) => !isDone(b));
      const finished = loaded.filter(isDone).sort((x, y) => whenDone(y) - whenDone(x));   // most recently completed first
      const notSeen = open.filter((b) => statusInfo(b.status).key === "not_seen").length;
      count.textContent = open.length + " open" + (notSeen ? " · " + notSeen + " not seen" : "");
      completedCount.textContent = String(finished.length);
      doneIds = new Set(finished.map((b) => b.id));

      openList.textContent = "";
      if (!loaded.length) openList.appendChild(make("p", null, "No requests yet."));
      else if (!open.length) openList.appendChild(make("p", null, "No open requests. Everything is completed."));
      open.forEach((b) => openList.appendChild(bookingCard(b, () => statusSaved(b))));

      completedList.textContent = "";
      if (!finished.length) completedList.appendChild(make("p", null, "No completed bookings yet. A request moves here when you set its status to Done."));
      finished.forEach((b) => completedList.appendChild(bookingCard(b, () => statusSaved(b))));
    }

    // Called after a status was saved: redraw, and tell the admin where a request went
    function statusSaved(b) {
      const wasDone = doneIds.has(b.id);
      drawLists();
      if (isDone(b) && !wasDone) say("Moved " + b.name + " to Completed bookings. Open that section below to see it, or to change the status back.");
      else if (!isDone(b) && wasDone) say("Moved " + b.name + " back to Booking requests.");
    }

    backend.getBookings().then((bookings) => {
      loaded = bookings;
      drawLists();
    }).catch(() => { openList.textContent = "Could not load requests."; });
  }


  /* ---------- 7b. My requests: what the client sees ---------- */
  function myRequestCard(b) {
    const info = statusInfo(b.status);
    const stepIndex = statuses.indexOf(info);
    const card = make("article", "panel mine");

    const head = make("div", "request-head");
    head.append(make("h3", null, tierName(b.tier) + " session"), make("span", "status-pill status-" + info.key, info.label));
    card.append(head);

    // Four steps. The ones reached so far are filled in.
    const steps = make("ol", "status-steps");
    statuses.forEach((s, i) => {
      const item = make("li", i <= stepIndex ? "reached" : "", s.label);
      if (i === stepIndex) item.setAttribute("aria-current", "step");
      steps.appendChild(item);
    });
    card.append(steps, make("p", "status-note", info.note));

    const details = make("dl", "request-details");
    addDetail(details, "Sent", document.createTextNode(formatDateTime(b.created_at)));
    addDetail(details, "Wanted", document.createTextNode(`${b.date} at ${b.time}` + (b.timezone ? ` (${b.timezone})` : "")));
    addDetail(details, "Status", document.createTextNode(info.label + (b.status_updated_at ? ", updated " + formatDateTime(b.status_updated_at) : "")));
    card.appendChild(details);
    return card;
  }

  function renderMine() {
    const root = byId("mineBody");
    if (!document.body.classList.contains("view-mine")) return;
    root.textContent = "";
    if (!currentUser) {
      root.append(make("p", null, "Sign in to see your booking requests."), makeButton("Sign in", () => openSignInBox("in")));
      return;
    }
    const list = make("div");
    root.appendChild(list);
    backend.getMyBookings().then((bookings) => {
      if (!bookings.length) {
        list.append(make("p", null, "You have not sent a request yet."), makeLink("#booking", "Book a consultation"));
        return;
      }
      bookings.forEach((b) => list.appendChild(myRequestCard(b)));
    }).catch(() => { list.textContent = "Could not load your requests. Please try again in a moment."; });
  }

  /* ---------- 8. Which view is showing ----------
     Blog, Write, Dashboard, Privacy and Terms are views inside index.html (not separate pages),
     so you stay signed in everywhere. The address ending decides which one shows. */
  const VIEW_CLASSES = { "view-blog": /^#blog/, "view-admin": /^#admin$/, "view-dashboard": /^#dashboard$/, "view-mine": /^#my-requests$/, "view-privacy": /^#privacy$/, "view-terms": /^#terms$/ };
  const VIEW_LINKS = ["#blog", "#admin", "#dashboard", "#my-requests"];

  function applyView() {
    const hash = location.hash;
    let inView = false;
    Object.keys(VIEW_CLASSES).forEach((cls) => {
      const active = VIEW_CLASSES[cls].test(hash);
      document.body.classList.toggle(cls, active);
      if (active) inView = true;
    });
    if (!/^#blog\//.test(hash)) document.title = originalTitle;

    // Menu highlight for the three views (the home page sections are handled in visuals.js)
    const currentLink = hash.replace(/^(#blog)\/.*/, "$1");
    document.querySelectorAll("#menu a.nl").forEach((link) => {
      const href = link.getAttribute("href");
      if (inView && href === currentLink) link.setAttribute("aria-current", "true");
      else if (inView || VIEW_LINKS.indexOf(href) > -1) link.removeAttribute("aria-current");
    });
  }

  function isViewOpen() { return /\bview-(blog|admin|dashboard|mine|privacy|terms)\b/.test(document.body.className); }

  /* Where the visitor was on the home page when they opened the Terms or the Privacy notice (for example from the
     booking form), so that coming back puts them at the same spot with everything they typed still in the form. */
  let legalReturnY = null;

  addEventListener("hashchange", () => {
    const wasInView = isViewOpen();
    const wasLegal = /\bview-(privacy|terms)\b/.test(document.body.className);
    const scrollBefore = scrollY;
    applyView();
    if (!wasInView && /^#(privacy|terms)$/.test(location.hash)) legalReturnY = scrollBefore;
    if (/^#(blog|admin|dashboard|my-requests|privacy|terms)/.test(location.hash)) scrollTo(0, 0);
    renderBlog(); renderAdmin(); renderDashboard(); renderMine();

    // Leaving the Terms or the Privacy notice by "Back to the home page" or the browser's Back button: return to the same spot
    if (wasLegal && legalReturnY !== null && (location.hash === "" || location.hash === "#top")) {
      scrollTo(0, legalReturnY);
      legalReturnY = null;
      return;
    }

    // Leaving a view: go to the section that was asked for
    if (wasInView && !/^#(blog|admin|dashboard|my-requests|privacy|terms)/.test(location.hash)) {
      let target = null;
      try { target = location.hash.length > 1 && location.hash !== "#top" ? document.querySelector(location.hash) : null; } catch (e) { /* not a valid selector */ }
      if (target) target.scrollIntoView(); else scrollTo(0, 0);
    }
  });
  applyView();


  /* ---------- 9. Start ---------- */
  if (backend.isPreview) {
    document.body.appendChild(make("div", "preview-banner",
      "Preview mode: accounts, posts and booking requests are simulated in this browser. Demo admin: admin@demo.com (any password, create it first)."));
  }

  backend.start().then(refreshAll).catch(() => {
    byId("bookingMessage").textContent = "Could not connect. Please try again later.";
  });
})();
