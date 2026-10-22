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
  let bookingOpen = false;           // the request form shows only after the client clicks "Book a consultation" (v14)
  let savedDetails = null;           // the client's optional My account details (null when nothing is saved)
  let accountDirty = false;          // true while the My account form has unsaved typing, so it is not overwritten
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
      if (!user) savedDetails = null;
      byId("authText").textContent = user ? "Sign out" : "Sign in";
      byId("navMine").hidden = !user;      // "My account" (My details and My requests): every signed-in account, the admin too (v25; the menu is a dropdown now, so there is room)
      byId("navWrite").hidden = !(user && user.admin);
      byId("navDashboard").hidden = !(user && user.admin);
      try { localStorage.setItem("suf_nav", JSON.stringify({ signedIn: !!user, admin: !!(user && user.admin) })); } catch (error) { /* storage blocked: the FAQ menu then shows only Sign in */ }   // menu hint for faq.html (js/nav.js)
      return loadSavedDetails().then(() => {
        renderBooking();
        renderBlog();
        renderAdmin();
        renderDashboard();
        renderMine();
        renderAccount();
        numberMenu();
      });
    });
  }

  /* Reads the client's saved My account details (a client only; nothing for the admin or a signed-out visitor). */
  function loadSavedDetails() {
    if (!currentUser) { savedDetails = null; return Promise.resolve(); }
    return backend.getAccountDetails().then((details) => { savedDetails = details; })
      .catch(() => { savedDetails = null; });   // the booking form simply stays empty if this cannot be read
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
    if (currentUser) { bookingOpen = false; savedDetails = null; accountDirty = false; clearPersonalForms(); backend.signOut().then(refreshAll); }
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

  /* Shows the sign-in prompt, the "Book a consultation" button, the request form, or the confirmation.
     The form itself opens only after the client clicks a "Book a consultation" button (v14). */
  let formWasShowing = false;        // used to fill the form from My account once each time it opens

  function renderBooking() {
    renderTierChoices();
    const actions = byId("bookingActions");
    const message = byId("bookingMessage");
    actions.textContent = "";

    message.classList.remove("sent");

    if (!currentUser) {
      bookingForm.hidden = true;
      formWasShowing = false;
      message.textContent = "You don’t need an account to browse the site or read the notes. An account is only needed to send a booking request.";
      actions.append(makeButton("Create an account to book", () => { bookingOpen = true; openSignInBox("up"); }),
                     makeButton("Sign in", () => { bookingOpen = true; openSignInBox("in"); }));
      return;
    }

    // Right after sending: hide the form and show only the confirmation
    if (sentMessage) {
      bookingForm.hidden = true;
      formWasShowing = false;
      message.textContent = sentMessage;
      message.classList.add("sent");
      actions.append(makeLink("#my-requests", "See your request status"),
                     makeButton("Send another request", () => { sentMessage = ""; bookingOpen = true; renderBooking(); }));
      return;
    }

    // Signed in, but the client has not asked to book yet: a choice of session and one button
    if (!bookingOpen) {
      bookingForm.hidden = true;
      formWasShowing = false;
      message.textContent = "Choose a session above, then press the button to open the request form.";
      actions.append(makeButton("Book a consultation", () => { bookingOpen = true; renderBooking(); showBookingForm(); }));
      return;
    }

    bookingForm.hidden = false;
    if (!byId("fEmail").value) byId("fEmail").value = currentUser.email;
    if (!formWasShowing) prefillBookingForm();      // only on the moment it opens, so nothing the client typed is ever replaced
    formWasShowing = true;
    showAccountNote();
    message.textContent = `Booking the ${tierName(chosenTier)} session. Fill in the form below.`;
  }

  /* Brings the request form into view after it opens. */
  function showBookingForm() {
    setTimeout(() => bookingForm.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
  }

  /* Puts one saved value into a form box, but only if the box is still empty.
     An "input" event is sent so the dd/mm/yyyy and hh:mm boxes (js/datetime.js) show the value too. */
  function fillIfEmpty(id, value) {
    const input = byId(id);
    if (!value || input.value) return;
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  /* Fills the request form from the client's My account details. Anything can still be changed in the form
     (for example when booking for someone else). The saved details themselves are never changed from here. */
  function prefillBookingForm() {
    if (!savedDetails) return;
    fillIfEmpty("fName", savedDetails.name);
    fillIfEmpty("fBirthDate", savedDetails.birth_date);
    fillIfEmpty("fBirthTime", savedDetails.birth_time);
    fillIfEmpty("fBirthPlace", savedDetails.birth_place);
    if (savedDetails.phone_number && !phoneInput.value) {
      countrySelect.value = savedDetails.phone_country || "+91";
      bookingPhone.apply();
      phoneInput.value = savedDetails.phone_number;
      phoneInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  /* The small line at the top of the form: says whether it was filled from My account, and links there. */
  function showAccountNote() {
    const note = byId("accountNote");
    const link = make("a", null, hasSavedDetails() ? "Edit my saved details" : "Open My account, then My details");
    link.href = "#account";
    note.textContent = "";
    note.append(hasSavedDetails()
      ? "Filled in from your account. Booking for someone else? Just change anything below. "
      : "Tip: go to My account, open the My details tab and save your name, WhatsApp number and birth details once. This form will then fill itself in. ", link);
  }

  /* True when at least one My account detail is saved */
  function hasSavedDetails() {
    return !!savedDetails && ["name", "phone_number", "birth_date", "birth_time", "birth_place"].some((key) => savedDetails[key]);
  }

  /* ----- Phone number: the digit count depends on the country -----
     Used by the booking form and by My account. In My account the number is optional (empty is fine). */
  function setUpPhoneField(select, input, optional) {
    countries.forEach((c) => {
      const option = make("option", null, `${c.code} ${c.name}`);
      option.value = c.code;
      select.appendChild(option);
    });
    select.value = "+91";

    function country() { return countries.find((c) => c.code === select.value) || countries[0]; }

    function validate() {
      const c = country();
      const digits = input.value;
      let problem = "";
      if (optional && !digits) {
        problem = "";
      } else if (digits.length < c.min || digits.length > c.max) {
        problem = "Enter " + (c.min === c.max ? "exactly " + c.max : c.min + " to " + c.max) + " digits, without the country code.";
      } else if (c.code === "+91" && !/^[6-9]/.test(digits)) {
        problem = "Indian mobile numbers start with 6, 7, 8 or 9.";
      }
      input.setCustomValidity(problem);
    }

    function apply() {
      const c = country();
      input.maxLength = c.max;
      input.placeholder = c.min === c.max ? c.max + " digits" : c.min + " to " + c.max + " digits";
      input.value = digitsOnly(input.value).slice(0, c.max);
      validate();
    }

    select.onchange = apply;
    input.oninput = () => { input.value = digitsOnly(input.value).slice(0, input.maxLength); validate(); };
    apply();
    return { apply, validate };
  }

  const bookingPhone = setUpPhoneField(countrySelect, phoneInput, false);

  function setUpBookingForm() {
    // Earliest date you can pick is today
    const today = new Date();
    // Nobody can be born tomorrow: the three birth date boxes stop at today (the weekday finder at the top of the page too)
    const todayIso = today.getFullYear() + "-" + ("0" + (today.getMonth() + 1)).slice(-2) + "-" + ("0" + today.getDate()).slice(-2);
    ["fBirthDate", "aBirthDate", "birthday"].forEach((id) => { const box = byId(id); if (box) box.max = todayIso; });
    byId("fDate").min = today.getFullYear() + "-" + ("0" + (today.getMonth() + 1)).slice(-2) + "-" + ("0" + today.getDate()).slice(-2);
    // The date of birth cannot be after the booking date: its latest day is the preferred date once that is chosen (today until then)
    const fBirthDate = byId("fBirthDate"), fDate = byId("fDate");
    const limitBirthDate = () => { fBirthDate.max = fDate.value || todayIso; };
    fDate.addEventListener("input", limitBirthDate);
    fDate.addEventListener("change", limitBirthDate);
    bookingForm.addEventListener("reset", () => setTimeout(limitBirthDate));
    limitBirthDate();
    byId("timezoneNote").textContent = "Times are in your own time zone" + (timeZone ? " (" + timeZone + ")" : "") + ".";

    // The concern must say something (spaces alone do not count)
    const concern = byId("fConcern");
    const checkConcern = () => concern.setCustomValidity(concern.value.trim() ? "" : "Please describe your concern.");
    concern.addEventListener("input", checkConcern);
    checkConcern();

    bookingForm.onsubmit = (event) => {
      event.preventDefault();
      bookingPhone.validate();
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
        bookingPhone.apply();
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

  /* Every "Book a consultation" link on the site (top bar, hero, the three session cards, "My requests" when empty)
     opens the request form. The session cards also choose their session. */
  document.addEventListener("click", (event) => {
    const link = event.target.closest && event.target.closest('a[href="#booking"]');
    if (!link) return;
    const tier = link.getAttribute("data-tier");
    if (tier) chosenTier = tier;
    sentMessage = "";
    bookingOpen = true;
    renderBooking();
    if (currentUser) showBookingForm();
  });

  /* Empties the booking form and the My account form (used at sign-out, so the next person on this device sees none of it). */
  function clearPersonalForms() {
    bookingForm.reset();
    countrySelect.value = "+91";
    bookingPhone.apply();
    fillAccountForm(null);
  }


  /* ---------- 4b. My account: optional saved details ----------
     Name, WhatsApp number and birth details. Nothing here is required. The booking form is filled from them when it
     opens (prefillBookingForm above) and can still be changed there. Stored in the client_details table
     (supabase/migrations/008_client_details.sql), which only the signed-in owner of each row can read. */
  const accountForm = byId("accountForm");
  const accountPhone = setUpPhoneField(byId("aCountry"), byId("aPhone"), true);

  /* Sets one My account box. The "input" event keeps the dd/mm/yyyy and hh:mm boxes (js/datetime.js) in step. */
  function setAccountBox(id, value) {
    const input = byId(id);
    input.value = value || "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  /* Fills the My account form with saved details, or empties it when there are none. */
  function fillAccountForm(details) {
    const saved = details || {};
    setAccountBox("aName", saved.name);
    setAccountBox("aBirthDate", saved.birth_date);
    setAccountBox("aBirthTime", saved.birth_time);
    setAccountBox("aBirthPlace", saved.birth_place);
    byId("aCountry").value = saved.phone_country || "+91";
    accountPhone.apply();
    setAccountBox("aPhone", saved.phone_number);
    accountPhone.validate();
    byId("aConsent").checked = false;
  }

  function sayAboutAccount(text) { byId("accountMessage").textContent = text; }

  /* Typing in the form (a real key press or a picker choice, not the code above) protects it from being refilled. */
  accountForm.addEventListener("input", (event) => { if (event.isTrusted) accountDirty = true; });

  function renderAccount() {
    if (!document.body.classList.contains("view-account")) return;
    const notice = byId("accountSignedOut");
    notice.textContent = "";
    const isClient = !!currentUser;
    notice.hidden = isClient;
    accountForm.hidden = !isClient;
    if (!currentUser) {
      notice.append("Sign in to save your details. ", makeButton("Sign in", () => openSignInBox("in")));
      return;
    }
    byId("accountEmail").textContent = currentUser.email;
    if (!accountDirty) fillAccountForm(savedDetails);
  }

  accountForm.onsubmit = (event) => {
    event.preventDefault();
    accountPhone.validate();
    if (!accountForm.reportValidity()) return;

    const value = (id) => byId(id).value.trim();
    const details = {
      name: value("aName") || null,
      phone_country: value("aPhone") ? byId("aCountry").value : null,
      phone_number: value("aPhone") || null,
      birth_date: value("aBirthDate") || null,
      birth_time: value("aBirthTime") || null,
      birth_place: value("aBirthPlace") || null
    };
    const today = new Date();
    const todayIso = today.getFullYear() + "-" + ("0" + (today.getMonth() + 1)).slice(-2) + "-" + ("0" + today.getDate()).slice(-2);
    if (Object.keys(details).every((key) => details[key] === null)) { sayAboutAccount("There is nothing to save yet. Fill in at least one box, or use Remove saved details."); return; }
    if (details.birth_date && details.birth_date > todayIso) { sayAboutAccount("The date of birth cannot be in the future."); return; }

    const saveButton = accountForm.querySelector("button[type=submit]");
    saveButton.disabled = true;
    backend.saveAccountDetails(details).then(() => {
      savedDetails = details;
      accountDirty = false;
      fillAccountForm(savedDetails);
      if (!bookingForm.hidden) { prefillBookingForm(); showAccountNote(); }   // an open form gets its empty boxes filled (typed text is never replaced)
      sayAboutAccount("Details saved. The booking form will fill itself in from them.");
      saveButton.textContent = "Saved";                                   // shows for 2 seconds, then the normal label returns
      setTimeout(() => { saveButton.textContent = "Save my details"; }, 2000);
    }).catch(() => {
      sayAboutAccount("Could not save your details. Please try again in a moment.");
    }).then(() => { saveButton.disabled = false; saveButton.blur(); });
  };

  byId("accountRemove").onclick = () => {
    backend.deleteAccountDetails().then(() => {
      savedDetails = null;
      accountDirty = false;
      fillAccountForm(null);
      if (!bookingForm.hidden) showAccountNote();
      sayAboutAccount("Your saved details were removed.");
    }).catch(() => sayAboutAccount("Could not remove your details. Please try again in a moment."));
  };


  /* ---------- 5. Blog (public) ---------- */
  /* One post in the list: a coloured card with the date, title, a short preview and a big Hindi number */
  /* ----- Pictures in notes -----
     A picture inside a note is one paragraph written as   [[image: ADDRESS | caption]]   (the caption is optional).
     The Write page inserts it for you. Only pictures stored by this site are shown, never an address typed in by hand. */
  const IMAGE_LINE = /^\[\[image:\s*([^|\]]+?)\s*(?:\|\s*([^\]]*?)\s*)?\]\]$/;
  function safeImageUrl(url) {
    const base = (window.SUF && window.SUF.supabaseUrl) || "";
    if (/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(url)) return backend.isPreview;     // preview mode only
    return !!base && url.indexOf(base + "/storage/v1/object/public/post-images/") === 0 && !/[\s"'<>]/.test(url);
  }
  function textOnly(body) { return body.replace(/\[\[image:[^\]]*\]\]/g, " ").replace(/\s+/g, " ").trim(); }

  /* After a picture loads, pad it so the ruled lines under it line up with the lines above it again. */
  function snapToLines(figure) {
    const line = parseFloat(getComputedStyle(figure).lineHeight) || 32;      // one ruled line, in pixels
    figure.style.paddingBottom = "";
    const height = figure.getBoundingClientRect().height;
    figure.style.paddingBottom = (Math.ceil(height / line) * line - height) + "px";
  }

  function buildNoteFigure(url, caption) {
    const figure = make("figure", "note-photo");
    const image = make("img");
    image.src = url; image.alt = caption || "Picture in this note";   // not lazy: the page maker needs the real picture height
    figure.appendChild(image);
    if (caption) figure.appendChild(make("figcaption", null, caption));
    image.addEventListener("load", () => snapToLines(figure));
    return figure;
  }

  /* The cover picture on a card: a 16:9 box. A wide picture fills it; a tall one is shown whole, never stretched or cropped. */
  function buildCover(post) {
    if (!post.cover_url || !safeImageUrl(post.cover_url)) return null;
    const box = make("span", "post-cover");
    const image = make("img");
    image.src = post.cover_url; image.alt = ""; image.loading = "lazy";
    box.appendChild(image);
    return box;
  }

  /* ----- Notebook pages (v33) -----
     A note is cut into pages of a fixed number of ruled lines (--page-lines in css/site.css). When a page is full the text
     carries on, on the next page; a picture that does not fit moves to the next page whole. The reader (and the live
     preview on the Write page) gets Previous page / Next page buttons. Used by the reader and by the Write page preview. */
  const IMAGE_WAIT_MS = 4000;          // do not wait longer than this for a picture before making the pages
  let notebookHolders = [];            // notes on screen; made again when the window width changes

  function waitForPictures(figures) {
    const waits = figures.map((figure) => new Promise((resolve) => {
      const image = figure.querySelector("img");
      if (image.complete) { resolve(); return; }
      image.addEventListener("load", resolve); image.addEventListener("error", resolve);
      setTimeout(resolve, IMAGE_WAIT_MS);
    }));
    return Promise.all(waits);
  }

  /* Fills `holder` with a notebook page and its pager.
     note = { title, dateText, body }; state = { page: number or "last" } remembers which page is open. */
  function renderNotebook(holder, note, state) {
    const token = (holder.renderToken = (holder.renderToken || 0) + 1);
    const notebook = make("article", "notebook measuring");
    const pageBody = make("div", "notebook-body");
    notebook.appendChild(pageBody);
    holder.appendChild(notebook);                      // hidden while it is measured; the old page stays visible meanwhile
    holder.noteArguments = { note, state };
    if (notebookHolders.indexOf(holder) < 0) notebookHolders.push(holder);

    // What goes in the note, in order: the title, the date, then each paragraph and picture
    const blocks = [];
    note.body.split(/\n{2,}/).forEach((paragraph) => {
      const picture = paragraph.trim().match(IMAGE_LINE);
      if (picture && safeImageUrl(picture[1])) blocks.push({ figure: buildNoteFigure(picture[1], picture[2] || "") });
      else if (!picture && paragraph.trim()) blocks.push({ text: paragraph.trim() });
    });
    const figures = blocks.filter((block) => block.figure).map((block) => block.figure);
    figures.forEach((figure) => pageBody.appendChild(figure));   // in the page so the pictures start loading

    waitForPictures(figures).then(() => {
      if (token !== holder.renderToken) { notebook.remove(); return; }   // a newer version was started
      pageBody.textContent = "";
      const pages = cutIntoPages(pageBody, note, blocks);
      holder.textContent = "";
      holder.append(notebook, make("div", "note-pager"));
      notebook.classList.remove("measuring");
      holder.lastWidth = notebook.clientWidth;
      showNotebookPage(holder, notebook, pageBody, pages, state);
    });
  }

  /* Puts the blocks into pages that fit the body height. Returns a list of pages, each a list of elements. */
  function cutIntoPages(pageBody, note, blocks) {
    const capacity = pageBody.clientHeight;
    const pages = [];
    let current = [];
    const bottomOf = (element) => element.getBoundingClientRect().bottom - pageBody.getBoundingClientRect().top;
    const fits = (element) => bottomOf(element) <= capacity + 0.5;
    const startNewPage = () => { pages.push(current); current = []; pageBody.textContent = ""; };
    const place = (element) => { pageBody.appendChild(element); current.push(element); };

    place(make("h1", "post-title", note.title || "Your title"));
    place(make("p", "post-date", note.dateText));

    function placeFigure(figure) {
      place(figure);
      snapToLines(figure);
      if (!fits(figure) && current.length > 1) { current.pop(); figure.remove(); startNewPage(); place(figure); snapToLines(figure); }
    }

    function placeText(text) {
      let words = text.split(/\s+/);
      while (words.length) {
        const paragraph = make("p", "post-text", words.join(" "));
        place(paragraph);
        if (fits(paragraph)) return;
        // Too long for what is left of this page: find how many words fit, the rest goes on the next page
        let low = 0, high = words.length - 1;
        while (low < high) {
          const middle = Math.ceil((low + high) / 2);
          paragraph.textContent = words.slice(0, middle).join(" ");
          if (fits(paragraph)) low = middle; else high = middle - 1;
        }
        if (low === 0 && current.length > 1) { current.pop(); paragraph.remove(); startNewPage(); continue; }
        low = Math.max(low, 1);                         // a page always takes at least one word
        paragraph.textContent = words.slice(0, low).join(" ");
        words = words.slice(low);
        startNewPage();
      }
    }

    blocks.forEach((block) => { if (block.figure) placeFigure(block.figure); else placeText(block.text); });
    pages.push(current);
    return pages;
  }

  /* Shows one page and fills the pager (Previous page, Page 2 of 5, Next page). */
  function showNotebookPage(holder, notebook, pageBody, pages, state) {
    const index = Math.max(0, Math.min(state.page === "last" ? pages.length - 1 : state.page, pages.length - 1));
    state.page = index;
    pageBody.textContent = "";
    pages[index].forEach((element) => pageBody.appendChild(element));

    const pager = holder.querySelector(".note-pager");
    pager.textContent = "";
    if (pages.length < 2) return;
    const go = (page) => { state.page = page; showNotebookPage(holder, notebook, pageBody, pages, state); };
    const previous = makeButton("← Previous page", () => go(index - 1), "small");
    const next = makeButton("Next page →", () => go(index + 1), "small");
    previous.disabled = index === 0;
    next.disabled = index === pages.length - 1;
    pager.append(previous, make("span", "note-page-label", "Page " + (index + 1) + " of " + pages.length), next);
  }

  // The page width decides where lines break, so make the pages again when the window width changes.
  let resizeTimer = null;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      notebookHolders = notebookHolders.filter((holder) => holder.isConnected);
      notebookHolders.forEach((holder) => {
        const open = holder.querySelector(".notebook");
        if (open && open.clientWidth !== holder.lastWidth) renderNotebook(holder, holder.noteArguments.note, holder.noteArguments.state);
      });
    }, 250);
  });

  function buildPostCard(post, number) {
    const card = make("a", "post-card");
    card.href = "#blog/" + encodeURIComponent(post.id);
    const plain = textOnly(post.body);
    const preview = plain.slice(0, 150) + (plain.length > 150 ? "…" : "");
    const cover = buildCover(post);
    if (cover) card.appendChild(cover);
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

  let notesOrder = "latest";         // "latest" or "oldest", for the Notes page

  /* A small "Latest first / Oldest first" picker, used on the Notes page and on the Dashboard. */
  function sortPicker(current, onChange, label) {
    const wrap = make("label", "sort-picker", label + " ");
    const select = make("select");
    [["latest", "Latest first"], ["oldest", "Oldest first"]].forEach(([value, text]) => {
      const option = make("option", null, text);
      option.value = value;
      option.selected = value === current;
      select.appendChild(option);
    });
    select.onchange = () => onChange(select.value);
    wrap.appendChild(select);
    return wrap;
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
        // The note is shown as a page of a notebook: ruled lines, a red margin line, holes on the left.
        const noteHolder = make("div", "note-holder");
        list.append(makeLink("#blog", "← All posts"), noteHolder, makeLink("#blog", "All posts"));
        renderNotebook(noteHolder, { title: post.title, dateText: formatDate(post.created_at), body: post.body }, { page: 0 });
        return;
      }

      if (!posts.length) { list.appendChild(buildEmptyBlogNotice()); return; }
      const sorted = posts.slice().sort((a, b) => (new Date(a.created_at) - new Date(b.created_at)) * (notesOrder === "oldest" ? 1 : -1));
      list.appendChild(sortPicker(notesOrder, (value) => { notesOrder = value; renderBlog(); }, "Sort notes"));
      const grid = make("div", "blog-grid");                   // list of posts
      sorted.forEach((post, position) => grid.appendChild(buildPostCard(post, position + 1)));
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
      '<div class="fld">Cover picture (optional, shown on the Notes page card)' +
        '<div class="cover-edit"><span class="post-cover" id="coverBox" hidden><img id="coverImg" alt=""></span>' +
        '<input id="coverFile" type="file" accept="image/jpeg,image/png,image/webp">' +
        '<button class="link-button" type="button" id="coverRemove" hidden>Remove cover</button></div></div>' +
      '<label class="fld">Post (a blank line starts a new paragraph)<textarea id="postBody" rows="12" required></textarea></label>' +
      '<div class="fld">Add a picture inside the note' +
        '<div class="inline-photo-edit"><input id="photoFile" type="file" accept="image/jpeg,image/png,image/webp">' +
        '<span class="photo-thumb" id="photoThumb" hidden><img id="photoThumbImg" alt=""></span>' +
        '<input id="photoCaption" placeholder="Caption (optional)" maxlength="120">' +
        '<button class="btn small" type="button" id="photoInsert" disabled>Insert picture</button>' +
        '<button class="link-button" type="button" id="photoDiscard" hidden>Discard picture</button></div>' +
        '<small>1. Click in the post where the picture should go. 2. Choose the picture. 3. Write a caption if you want one. 4. Press Insert picture. It is placed there as [[photo 1]]; leave that line as it is, the preview shows the picture.</small></div>' +
      '<label class="fld check"><input id="postPublished" type="checkbox" checked>Published</label>' +
      '<div class="form-actions"><button class="btn" type="submit">Save post</button>' +
      '<button class="link-button" type="button" id="postClear">Clear</button></div>' +
      '<p id="postStatus" role="status"></p>';
    const postCount = make("span");
    const postList = make("div");
    const postsHeading = make("h2", null, "Your posts");
    const postsTitle = make("div", "section-title");
    postsTitle.append(postsHeading, postCount);
    // Live preview: the note as readers will see it, beside the form (below it on a phone)
    const previewBox = make("aside", "write-preview");
    previewBox.setAttribute("aria-label", "Preview of the note");
    const previewPage = make("div", "note-holder");
    const previewState = { page: 0 };
    previewBox.append(make("p", "write-preview-label", "Preview: how the note looks when read"), previewPage);
    const layout = make("div", "write-layout");
    layout.append(form, previewBox);
    root.append(layout, postsTitle, postList);

    /* Pictures inside the post are shown as [[photo 1]], [[photo 2 | caption]] while writing, instead of the long address.
       Saving turns them into the real [[image: ADDRESS | caption]] lines; editing an old post turns them back. */
    let photos = [];
    function toTokens(body) {
      return body.replace(/\[\[image:\s*([^|\]]+?)\s*(?:\|\s*([^\]]*?)\s*)?\]\]/g, (all, url, caption) => {
        let at = photos.indexOf(url);
        if (at < 0) { photos.push(url); at = photos.length - 1; }
        return "[[photo " + (at + 1) + (caption ? " | " + caption : "") + "]]";
      });
    }
    function toStored(text) {
      return text.replace(/\[\[photo\s+(\d+)\s*(?:\|\s*([^\]]*?)\s*)?\]\]/gi, (all, number, caption) => {
        const url = photos[+number - 1];
        return url ? "[[image: " + url + (caption ? " | " + caption : "") + "]]" : all;
      });
    }
    let previewQueued = false;
    function updatePreview() {
      if (previewQueued) return;
      previewQueued = true;
      requestAnimationFrame(() => {
        previewQueued = false;
        renderNotebook(previewPage, {
          title: byId("postTitle").value.trim(),
          dateText: formatDate(new Date().toISOString()),
          body: toStored(byId("postBody").value)
        }, previewState);
      });
    }
    byId("postTitle").addEventListener("input", updatePreview);
    byId("postBody").addEventListener("input", () => {
      const box = byId("postBody");
      if (box.selectionStart >= box.value.length) previewState.page = "last";   // writing at the end: the preview follows to the newest page
      updatePreview();
    });
    updatePreview();

    let coverUrl = "";
    function showCover() {
      byId("coverBox").hidden = !coverUrl;
      byId("coverRemove").hidden = !coverUrl;
      if (coverUrl) byId("coverImg").src = coverUrl;
    }
    byId("coverRemove").onclick = () => { coverUrl = ""; byId("coverFile").value = ""; showCover(); };

    // Upload a chosen picture, then do something with its address. Problems show in the line under the form.
    function withUpload(input, done, doneMessage) {
      const file = input.files && input.files[0];
      if (!file) return;
      byId("postStatus").textContent = "Uploading the picture…";
      backend.uploadImage(file).then((url) => { done(url); byId("postStatus").textContent = doneMessage; })
        .catch((error) => { byId("postStatus").textContent = error.message || "Could not add the picture."; })
        .then(() => { input.value = ""; });
    }
    byId("coverFile").onchange = () => withUpload(byId("coverFile"), (url) => { coverUrl = url; showCover(); }, "Picture added. Press Save post to keep it.");

    /* A picture inside the note takes three steps: choose it (it uploads at once), write a caption if you want,
       press Insert picture. The place in the post is where the cursor last was. */
    let pendingPhotoUrl = "";
    let cursorAt = null;
    const postBox = byId("postBody");
    ["keyup", "click", "blur", "input"].forEach((name) => postBox.addEventListener(name, () => { cursorAt = postBox.selectionStart; }));

    function showPendingPhoto() {
      byId("photoThumb").hidden = !pendingPhotoUrl;
      byId("photoDiscard").hidden = !pendingPhotoUrl;
      byId("photoInsert").disabled = !pendingPhotoUrl;
      if (pendingPhotoUrl) byId("photoThumbImg").src = pendingPhotoUrl;
    }
    function dropPendingPhoto() { pendingPhotoUrl = ""; byId("photoCaption").value = ""; showPendingPhoto(); }
    byId("photoFile").onchange = () => withUpload(byId("photoFile"), (url) => { pendingPhotoUrl = url; showPendingPhoto(); },
      "Picture uploaded. Write a caption if you like, then press Insert picture.");
    byId("photoDiscard").onclick = () => { dropPendingPhoto(); byId("postStatus").textContent = ""; };
    byId("photoInsert").onclick = () => {
      if (!pendingPhotoUrl) return;
      const caption = byId("photoCaption").value.replace(/[|\]\n]/g, " ").trim();
      photos.push(pendingPhotoUrl);
      const line = "[[photo " + photos.length + (caption ? " | " + caption : "") + "]]";
      const at = cursorAt === null ? postBox.value.length : Math.min(cursorAt, postBox.value.length);
      const before = postBox.value.slice(0, at).replace(/\s+$/, "");
      const after = postBox.value.slice(at).replace(/^\s+/, "");
      postBox.value = (before ? before + "\n\n" : "") + line + (after ? "\n\n" + after : "");
      cursorAt = (before ? before.length + 2 : 0) + line.length;
      dropPendingPhoto();
      byId("postStatus").textContent = "Picture inserted. Press Save post to keep it.";
      updatePreview();
    };

    function clearForm() {
      editingId = null;
      coverUrl = "";
      photos = [];
      cursorAt = null;
      previewState.page = 0;
      dropPendingPhoto();
      showCover();
      form.reset();
      updatePreview();
      byId("postFormTitle").textContent = "New post";
      byId("postStatus").textContent = "";
    }
    byId("postClear").onclick = clearForm;

    form.onsubmit = (event) => {
      event.preventDefault();
      const missing = (byId("postBody").value.match(/\[\[photo\s+(\d+)/gi) || []).find((m) => !photos[+m.replace(/\D/g, "") - 1]);
      if (missing) { byId("postStatus").textContent = "A picture line points to a picture that is not in this post. Remove that line or add the picture again."; return; }
      backend.savePost({
        id: editingId,
        title: byId("postTitle").value.trim(),
        body: toStored(byId("postBody").value),
        cover_url: coverUrl || null,
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
              photos = [];
              cursorAt = null;
              previewState.page = 0;
              dropPendingPhoto();
              byId("postBody").value = toTokens(post.body);
              updatePreview();
              coverUrl = post.cover_url || "";
              showCover();
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

    let requestOrder = "latest";         // newest or oldest sent first, for the open requests and the completed ones
    const sortBar = make("div", "sort-bar");
    sortBar.appendChild(sortPicker(requestOrder, (value) => { requestOrder = value; drawLists(); }, "Sort requests"));
    root.append(title, sortBar, movedNote, openList, completed);

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
      const sent = (b) => new Date(b.created_at).getTime() || 0;
      const direction = requestOrder === "oldest" ? 1 : -1;
      const open = loaded.filter((b) => !isDone(b)).sort((x, y) => (sent(x) - sent(y)) * direction);
      const finished = loaded.filter(isDone).sort((x, y) => (whenDone(x) - whenDone(y)) * direction);   // by when each was completed
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
     Blog, Write, Dashboard, My requests, My account, Privacy and Terms are views inside index.html (not separate pages),
     so you stay signed in everywhere. The address ending decides which one shows. */
  const VIEW_CLASSES = { "view-blog": /^#blog/, "view-admin": /^#admin$/, "view-dashboard": /^#dashboard$/, "view-mine": /^#my-requests$/, "view-account": /^#account$/, "view-privacy": /^#privacy$/, "view-terms": /^#terms$/ };
  const VIEW_LINKS = ["#blog", "#admin", "#dashboard", "#my-requests", "#account"];

  function applyView() {
    const hash = location.hash;
    let inView = false;
    Object.keys(VIEW_CLASSES).forEach((cls) => {
      const active = VIEW_CLASSES[cls].test(hash);
      document.body.classList.toggle(cls, active);
      if (active) inView = true;
    });
    if (!/^#blog\//.test(hash)) document.title = originalTitle;

    // Menu highlight for the views (the home page sections are handled in visuals.js).
    // The "My account" menu item covers both of its tabs, My details (#account) and My requests (#my-requests).
    const currentLink = hash.replace(/^(#blog)\/.*/, "$1").replace(/^#my-requests$/, "#account");
    document.querySelectorAll(".subtabs a").forEach((tab) => {
      if (tab.getAttribute("href") === hash) tab.setAttribute("aria-current", "page"); else tab.removeAttribute("aria-current");
    });
    document.querySelectorAll("#menu a.nl").forEach((link) => {
      const href = link.getAttribute("href");
      if (inView && href === currentLink) link.setAttribute("aria-current", "true");
      else if (inView || VIEW_LINKS.indexOf(href) > -1) link.removeAttribute("aria-current");
    });
  }

  function isViewOpen() { return /\bview-(blog|admin|dashboard|mine|account|privacy|terms)\b/.test(document.body.className); }

  /* Where the visitor was on the home page when they opened the Terms or the Privacy notice (for example from the
     booking form), so that coming back puts them at the same spot with everything they typed still in the form. */
  let legalReturnY = null;

  addEventListener("hashchange", () => {
    const wasInView = isViewOpen();
    const wasLegal = /\bview-(privacy|terms)\b/.test(document.body.className);
    const scrollBefore = scrollY;
    applyView();
    if (!wasInView && /^#(privacy|terms)$/.test(location.hash)) legalReturnY = scrollBefore;
    if (/^#(blog|admin|dashboard|my-requests|account|privacy|terms)/.test(location.hash)) scrollTo(0, 0);
    renderBlog(); renderAdmin(); renderDashboard(); renderMine(); renderAccount();

    // Leaving the Terms or the Privacy notice by "Back to the home page" or the browser's Back button: return to the same spot
    if (wasLegal && legalReturnY !== null && (location.hash === "" || location.hash === "#top")) {
      scrollTo(0, legalReturnY);
      legalReturnY = null;
      return;
    }

    // Leaving a view: go to the section that was asked for
    if (wasInView && !/^#(blog|admin|dashboard|my-requests|account|privacy|terms)/.test(location.hash)) {
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

  // Links from the FAQ page menu: index.html#signin opens the sign-in box, index.html#signout signs out. The hash is then cleared.
  function handleSignLinks() {
    if (location.hash !== "#signin" && location.hash !== "#signout") return;
    const wantsOut = location.hash === "#signout";
    history.replaceState(null, "", location.pathname + location.search);
    if (wantsOut) { if (currentUser) { bookingOpen = false; savedDetails = null; accountDirty = false; clearPersonalForms(); backend.signOut().then(refreshAll); } }
    else if (currentUser) location.hash = "#account";
    else openSignInBox("in");
  }
  addEventListener("hashchange", handleSignLinks);

  backend.start().then(refreshAll).then(handleSignLinks).catch(() => {
    byId("bookingMessage").textContent = "Could not connect. Please try again later.";
  });
})();
