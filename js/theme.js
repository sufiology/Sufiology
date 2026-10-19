/* ==========================================================================
   Light / dark mode.

   - The page starts in light mode (the original saffron look).
   - The sun / moon slider in the top bar switches it. The choice is remembered in this browser.
   - The look of each mode lives in css/site.css (the :root variables). This file only sets
     data-theme="light" or "dark" on <html>, and tells other scripts (the planet canvas) to redraw.

   This file is loaded in the <head> so the saved choice is applied before the page paints.
   ========================================================================== */
(function () {
  "use strict";

  // Do not let other websites show this site inside a frame (clickjacking). GitHub Pages cannot send the header that normally does this.
  try { if (window.top !== window.self) window.top.location = window.self.location; } catch (error) { document.documentElement.style.display = "none"; }


  const STORAGE_KEY = "sufiology-theme";
  const THEME_COLOR = { light: "#ffffff", dark: "#000000" };     // browser toolbar colour on phones
  const root = document.documentElement;

  function savedTheme() {
    try { return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light"; }
    catch (error) { return "light"; }                               // storage can be blocked
  }
  function rememberTheme(theme) {
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (error) { /* not saved, still works */ }
  }

  function applyTheme(theme) {
    root.dataset.theme = theme;
    const toolbarColor = document.querySelector('meta[name="theme-color"]');
    if (toolbarColor) toolbarColor.content = THEME_COLOR[theme];

    const toggle = document.getElementById("themeToggle");
    if (toggle) toggle.setAttribute("aria-checked", String(theme === "dark"));
    dispatchEvent(new Event("sufiology:themechange"));
  }

  applyTheme(savedTheme());                                         // before first paint

  document.addEventListener("DOMContentLoaded", () => {
    const toggle = document.getElementById("themeToggle");
    applyTheme(root.dataset.theme);                                 // now the toggle exists
    toggle.addEventListener("click", () => {
      const next = root.dataset.theme === "dark" ? "light" : "dark";
      root.classList.add("theme-fading");                           // short colour fade, see site.css
      setTimeout(() => root.classList.remove("theme-fading"), 450);
      rememberTheme(next);
      applyTheme(next);
    });
  });
})();
