/* ==========================================================================
   Sufiology data layer. The rest of the site only talks to `window.SufBackend`,
   so it does not care whether it is running in preview mode or live.

   PREVIEW MODE (js/config.js is empty): accounts, posts and booking requests are kept in
   this browser's localStorage. Passwords are stored in plain text there, so preview mode
   must NEVER be used on the live site.

   LIVE MODE (js/config.js filled in): Supabase handles accounts, posts and bookings.
   Booking requests go through the "request-slot" server function, which checks the input,
   enforces the weekly limit and emails Nishaad Sharma.

   Every method returns a Promise.
   ========================================================================== */
(function () {
  "use strict";

  const config = window.SUF || {};
  const rules = window.SUF_DATA;
  const isPreview = !(config.supabaseUrl && config.supabaseAnonKey);

  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  /* ----- A random id for this browser, sent with booking requests so the server can
         count requests per device. Stored in localStorage. ----- */
  function getDeviceId() {
    try {
      let id = localStorage.getItem("suf_device");
      if (!id) {
        id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
        localStorage.setItem("suf_device", id);
      }
      return id;
    } catch (e) {
      return "";                                    // storage blocked: the server still limits by account and network
    }
  }

  function formatDate(date) {
    return new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  }

  function weeklyLimitMessage(nextAllowedAt) {
    return `You can send up to ${rules.maxRequestsPerWeek} requests per week from one device. ` +
           `You can send another on ${formatDate(nextAllowedAt)}.`;
  }


  /* =======================================================================
     PREVIEW MODE: everything lives in this browser
     ======================================================================= */
  const preview = {
    load() {
      try {
        const saved = JSON.parse(localStorage.getItem("suf_demo"));
        if (saved && saved.users) { saved.bookings = saved.bookings || []; return saved; }
      } catch (e) { /* fall through to a fresh store */ }
      return { users: [], signedIn: null, posts: [], bookings: [] };
    },
    save(store) {
      try { localStorage.setItem("suf_demo", JSON.stringify(store)); } catch (e) { /* storage full or blocked */ }
    },

    /* ----- accounts ----- */
    getUser() {
      const store = preview.load();
      const user = store.users.find((u) => u.email === store.signedIn);
      return Promise.resolve(user ? { email: user.email, admin: user.role === "admin", needsTwoStep: false, hasTwoStep: false } : null);
    },
    signUp(email, password) {
      const store = preview.load();
      if (store.users.some((u) => u.email === email)) return Promise.reject(new Error("That email already has an account."));
      store.users.push({ email, password, role: email === "admin@demo.com" ? "admin" : "user" });
      store.signedIn = email;
      preview.save(store);
      return Promise.resolve({ confirmEmail: false });
    },
    signIn(email, password) {
      const store = preview.load();
      const user = store.users.find((u) => u.email === email && u.password === password);
      if (!user) return Promise.reject(new Error("Wrong email or password."));
      store.signedIn = email;
      preview.save(store);
      return Promise.resolve();
    },
    signOut() {
      const store = preview.load();
      store.signedIn = null;
      preview.save(store);
      return Promise.resolve();
    },

    /* ----- blog posts ----- */
    getPosts(includeDrafts) {
      const store = preview.load();
      return Promise.resolve(
        store.posts
          .filter((p) => includeDrafts || p.published)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
      );
    },
    savePost(post) {
      const store = preview.load();
      if (post.id) {
        store.posts = store.posts.map((p) => (p.id === post.id ? Object.assign(p, post) : p));
      } else {
        post.id = String(Date.now());
        post.created_at = new Date().toISOString();
        store.posts.push(post);
      }
      preview.save(store);
      return Promise.resolve();
    },
    deletePost(id) {
      const store = preview.load();
      store.posts = store.posts.filter((p) => p.id !== id);
      preview.save(store);
      return Promise.resolve();
    },

    /* ----- booking requests ----- */
    sendBooking(form) {
      const store = preview.load();
      const since = Date.now() - WEEK_MS;
      const recent = store.bookings.filter((b) => new Date(b.created_at).getTime() > since);
      if (recent.length >= rules.maxRequestsPerWeek) {
        const oldest = Math.min(...recent.map((b) => new Date(b.created_at).getTime()));
        return Promise.reject(new Error(weeklyLimitMessage(oldest + WEEK_MS)));
      }
      if (!(form.consent && form.consent_data && form.consent_age)) return Promise.reject(new Error("Please tick all three boxes at the end of the form."));
      store.bookings.push(Object.assign(
        { id: String(Date.now()), email: store.signedIn, created_at: new Date().toISOString(), consent_at: new Date().toISOString(), consent_version: "preview" }, form));
      preview.save(store);
      return Promise.resolve();
    },
    getBookings() {
      return Promise.resolve(preview.load().bookings.slice().reverse());
    },
    // The signed-in client's own requests, newest first
    getMyBookings() {
      const store = preview.load();
      return Promise.resolve(store.bookings.filter((b) => b.email === store.signedIn).reverse());
    },
    /* ----- saved account details (the optional My account page) ----- */
    getAccountDetails() {
      const store = preview.load();
      return Promise.resolve((store.details && store.details[store.signedIn]) || null);
    },
    saveAccountDetails(details) {
      const store = preview.load();
      store.details = store.details || {};
      store.details[store.signedIn] = Object.assign({}, details);
      preview.save(store);
      return Promise.resolve();
    },
    deleteAccountDetails() {
      const store = preview.load();
      if (store.details) delete store.details[store.signedIn];
      preview.save(store);
      return Promise.resolve();
    },
    // Admin only: set not_seen, seen, scheduled or done
    updateBookingStatus(id, status) {
      const store = preview.load();
      const booking = store.bookings.find((b) => b.id === id);
      if (!booking) return Promise.reject(new Error("Request not found."));
      booking.status = status;
      booking.status_updated_at = new Date().toISOString();
      preview.save(store);
      return Promise.resolve({ status, status_updated_at: booking.status_updated_at });
    }
  };


  /* =======================================================================
     LIVE MODE: Supabase
     ======================================================================= */
  let supabase = null;

  /* Turns a Supabase function response into data, or throws an error with a readable message. */
  function unwrapFunctionResult(result) {
    if (!result.error && result.data && !result.data.error) return Promise.resolve(result.data);
    const context = result.error && result.error.context;
    const readBody = context && context.json ? context.json().catch(() => ({})) : Promise.resolve(result.data || {});
    return readBody.then((body) => {
      throw new Error(body.error || (result.error && result.error.message) || "Something went wrong.");
    });
  }

  // The id of whoever is signed in, or null
  function currentUserId() {
    return supabase.auth.getSession().then((result) => {
      const session = result.data && result.data.session;
      return session ? session.user.id : null;
    });
  }

  const live = {
    /* ----- accounts ----- */
    getUser() {
      return supabase.auth.getUser().then((result) => {
        const user = result.data && result.data.user;
        if (!user) return null;
        return supabase.from("profiles").select("role").eq("id", user.id).maybeSingle().then((profile) => {
          const admin = !!(profile.data && profile.data.role === "admin");
          const info = { id: user.id, email: user.email, admin, needsTwoStep: false, hasTwoStep: false };
          if (!admin) return info;
          // An admin must also have entered the code from their authenticator app (assurance level aal2).
          return supabase.auth.mfa.getAuthenticatorAssuranceLevel().then((level) => {
            const state = level.data || {};
            info.needsTwoStep = state.currentLevel !== "aal2";
            info.hasTwoStep = state.nextLevel === "aal2";
            return info;
          }).catch(() => { info.needsTwoStep = true; return info; });
        });
      });
    },
    /* ----- admin two-step sign-in (authenticator app) ----- */
    // Starts setup. Resolves with { factorId, qr, secret } to show to the admin.
    twoStepStart() {
      return supabase.auth.mfa.listFactors().then((list) => {
        // Remove any half-finished setup first, so the admin can always start again.
        const stale = ((list.data && list.data.all) || []).filter((f) => f.factor_type === "totp" && f.status === "unverified");
        return Promise.all(stale.map((f) => supabase.auth.mfa.unenroll({ factorId: f.id })));
      }).then(() => supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Sufiology admin " + Date.now() }))
        .then((result) => {
          if (result.error) throw result.error;
          return { factorId: result.data.id, qr: result.data.totp.qr_code, secret: result.data.totp.secret };
        });
    },
    // Checks the 6-digit code. Pass factorId from twoStepStart, or leave it out to use the admin's saved factor.
    twoStepVerify(code, factorId) {
      const getFactor = factorId
        ? Promise.resolve(factorId)
        : supabase.auth.mfa.listFactors().then((list) => {
            const factor = ((list.data && list.data.totp) || [])[0];     // verified authenticator-app factors only
            if (!factor) throw new Error("No authenticator is set up yet.");
            return factor.id;
          });
      return getFactor.then((id) => supabase.auth.mfa.challengeAndVerify({ factorId: id, code }))
        .then((result) => { if (result.error) throw result.error; });
    },
    // Resolves with { confirmEmail: true } when Supabase has sent a confirmation email (the person is not signed in yet).
    signUp(email, password, captchaToken) {
      // emailRedirectTo sends the confirmation link back to THIS page, including the /Sufiology/ folder on GitHub Pages.
      const returnAddress = location.origin + location.pathname;
      return supabase.auth.signUp({ email, password, options: { captchaToken, emailRedirectTo: returnAddress } }).then((result) => {
        if (result.error) throw result.error;
        const user = result.data.user;
        // Supabase answers "success" for an email that already has an account, but with no identities
        if (user && Array.isArray(user.identities) && user.identities.length === 0) {
          const error = new Error("already registered"); error.code = "user_already_exists"; throw error;
        }
        return { confirmEmail: !result.data.session };
      });
    },
    // "Continue with Google". Needs the Google provider switched on in Supabase (see SETUP.md, "Sign in with Google").
    signInWithGoogle() {
      return supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + location.pathname } })
        .then((result) => { if (result.error) throw result.error; });
    },
    signIn(email, password, captchaToken) {
      return supabase.auth.signInWithPassword({ email, password, options: { captchaToken } }).then((result) => { if (result.error) throw result.error; });
    },
    signOut() { return supabase.auth.signOut(); },

    /* ----- blog posts ----- */
    getPosts(includeDrafts) {
      let query = supabase.from("posts").select("*").order("created_at", { ascending: false });
      if (!includeDrafts) query = query.eq("published", true);
      return query.then((result) => { if (result.error) throw result.error; return result.data; });
    },
    savePost(post) {
      const values = { title: post.title, body: post.body, published: post.published };
      const query = post.id
        ? supabase.from("posts").update(values).eq("id", post.id)
        : supabase.from("posts").insert(values);
      return query.then((result) => { if (result.error) throw result.error; });
    },
    deletePost(id) {
      return supabase.from("posts").delete().eq("id", id).then((result) => { if (result.error) throw result.error; });
    },

    /* ----- booking requests ----- */
    sendBooking(form) {
      return supabase.functions
        .invoke(config.bookingFunction || "request-slot", { body: Object.assign({ device_id: getDeviceId() }, form) })
        .then(unwrapFunctionResult);
    },
    getBookings() {
      return supabase.from("bookings").select("*").order("created_at", { ascending: false })
        .then((result) => { if (result.error) throw result.error; return result.data; });
    },
    // The signed-in client's own requests. Only the columns the client needs (no device or network ids).
    getMyBookings() {
      return supabase.auth.getSession().then((result) => {
        const session = result.data && result.data.session;
        if (!session) return [];
        return supabase.from("bookings")
          .select("id, tier, date, time, timezone, created_at, status, status_updated_at")
          .eq("user_id", session.user.id).order("created_at", { ascending: false })
          .then((rows) => { if (rows.error) throw rows.error; return rows.data; });
      });
    },
    /* ----- saved account details (the optional My account page). Needs supabase/migrations/008_client_details.sql.
       The database lets each client read and change only their own row. ----- */
    // Resolves with { name, phone_country, phone_number, birth_date, birth_time, birth_place } or null if nothing is saved.
    getAccountDetails() {
      return currentUserId().then((userId) => {
        if (!userId) return null;
        return supabase.from("client_details")
          .select("name, phone_country, phone_number, birth_date, birth_time, birth_place")
          .eq("user_id", userId).maybeSingle()
          .then((result) => {
            if (result.error) throw result.error;
            if (!result.data) return null;
            const details = result.data;
            if (details.birth_time) details.birth_time = details.birth_time.slice(0, 5);   // "18:30:00" -> "18:30"
            return details;
          });
      });
    },
    saveAccountDetails(details) {
      return currentUserId().then((userId) => {
        if (!userId) throw new Error("Please sign in again.");
        return supabase.from("client_details").upsert(Object.assign({ user_id: userId }, details), { onConflict: "user_id" });
      }).then((result) => { if (result.error) throw result.error; });
    },
    deleteAccountDetails() {
      return currentUserId().then((userId) => {
        if (!userId) throw new Error("Please sign in again.");
        return supabase.from("client_details").delete().eq("user_id", userId);
      }).then((result) => { if (result.error) throw result.error; });
    },
    // Admin only (the database allows nobody else). Needs supabase/migrations/007_booking_status.sql.
    updateBookingStatus(id, status) {
      return supabase.from("bookings").update({ status }).eq("id", id).select("status, status_updated_at")
        .then((result) => {
          if (result.error) throw result.error;
          if (!result.data || !result.data.length) throw new Error("The status was not saved.");   // no row changed: not allowed
          return result.data[0];
        });
    }
  };

  /* Loads the Supabase library (live mode only).
     It is loaded only from our own folder (js/vendor/, see the README there), so a third party can never change
     the code that handles passwords. If the newest copy is missing, the older bundled copy is used. */
  const LIBRARY_FILES = ["js/vendor/supabase.min.js", "js/vendor/supabase-2.45.0.min.js"];   // newest copy first (see js/vendor/README.txt)

  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function start() {
    if (isPreview) return Promise.resolve();
    return loadScript(LIBRARY_FILES[0])
      .catch(() => loadScript(LIBRARY_FILES[1]))
      .then(() => { supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey); });
  }

  window.SufBackend = Object.assign({ isPreview, start }, isPreview ? preview : live);
})();
