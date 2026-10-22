/* ==========================================================================
   Top bar menu (used by index.html and faq.html).
     - the three lines at the top left open and close the menu
     - the menu closes by itself 2 seconds after the pointer leaves it (mouse and pen; on a touch screen it closes
       when you tap a link, tap outside, or tap the cross)
     - Escape closes it; the bar slides away when you scroll down and comes back when you scroll up
   Colours and layout are in css/site.css ("3. Top bar and menu").
   ========================================================================== */
(function () {
  "use strict";

  const CLOSE_AFTER_MS = 2000;                // how long the pointer may stay away before the menu hides

  const bar = document.querySelector(".bar");
  const area = document.querySelector(".bar-start");     // the three lines, the logo and the menu panel
  const button = document.getElementById("menuButton");
  const menu = document.getElementById("menu");
  if (!bar || !area || !button || !menu) return;

  let timer = null;
  const isOpen = () => bar.classList.contains("open");
  const cancelTimer = () => { clearTimeout(timer); timer = null; };

  function setOpen(open) {
    cancelTimer();
    bar.classList.toggle("open", open);
    document.documentElement.classList.toggle("menu-open", open);   // css stops the page scrolling behind the menu on phones
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    if (open) bar.style.transform = "";
  }
  window.setMenuOpen = setOpen;               // other scripts may close the menu

  button.addEventListener("click", () => setOpen(!isOpen()));
  menu.addEventListener("click", (event) => { if (event.target.closest("a")) setOpen(false); });

  // Hover: leaving starts the 2 second timer, coming back cancels it
  area.addEventListener("pointerenter", (event) => { if (event.pointerType !== "touch") cancelTimer(); });
  area.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "touch" || !isOpen()) return;
    cancelTimer();
    timer = setTimeout(() => setOpen(false), CLOSE_AFTER_MS);
  });
  // Keyboard: while focus is inside the menu it stays open
  area.addEventListener("focusin", cancelTimer);

  addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen()) { setOpen(false); button.focus(); }
  });
  document.addEventListener("click", (event) => {
    if (isOpen() && !area.contains(event.target)) setOpen(false);
  });

  // Slide the bar away when scrolling down, bring it back when scrolling up
  let previousY = 0;
  addEventListener("scroll", () => {
    const goingDown = scrollY > previousY && scrollY > 300;
    bar.style.transform = goingDown && !isOpen() ? "translateY(-160%)" : "";
    previousY = scrollY;
    bar.classList.toggle("scrolled", scrollY > 8);      // phones: the bar gets a solid strip behind it so the page does not show through (css "3. Top bar")
  }, { passive: true });

  /* FAQ page only (v37): this page does not sign anyone in. It shows the same account items as the home page, using a small
     hint the home page saves in this browser (suf_nav). It is only for what the menu shows: the site and the database still
     check who you are on every page. The Sign in / Sign out link opens the home page, which does the actual sign-in or sign-out. */
  if (document.getElementById("authLink") && !document.getElementById("bookingForm")) {
    let hint = {};
    try { hint = JSON.parse(localStorage.getItem("suf_nav")) || {}; } catch (error) { hint = {}; }
    const show = (id, visible) => { const item = document.getElementById(id); if (item) item.hidden = !visible; };
    show("navMine", !!hint.signedIn);
    show("navWrite", !!hint.admin);
    show("navDashboard", !!hint.admin);
    document.getElementById("authText").textContent = hint.signedIn ? "Sign out" : "Sign in";
    document.getElementById("authLink").setAttribute("href", hint.signedIn ? "index.html#signout" : "index.html#signin");
    const digits = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];
    let count = 0;
    document.querySelectorAll("#menu li").forEach((item) => {
      if (item.hidden) return;
      count += 1;
      const number = item.querySelector("i");
      if (number) number.textContent = String(count).split("").map((digit) => digits[+digit]).join("");
    });
  }
})();
