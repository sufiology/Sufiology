/* ==========================================================================
   Sufiology page visuals: everything on the home page except the planet
   animation (js/sky.js) and accounts/booking/blog (js/app.js).

   Sections in this file:
    1. Small helpers
    2. Opening curtain
    3. Scrolling marquees
    4. "What is stuck in your life?" buttons
    5. The Moon right now
    6. Which graha rules your birthday?
    7. Twelve signs wheel
    8. Red comet trail in the hero
    9. Scroll effects: progress bar, magnetic buttons, card tilt
   10. Top bar: hide on scroll, mobile menu, highlight current section
   ========================================================================== */
(function () {
  "use strict";

  const data = window.SUF_DATA;
  const prefersReducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const byId = (id) => document.getElementById(id);


  /* ---------- 2. Opening curtain ---------- */
  const curtain = byId("curtain");
  if (prefersReducedMotion) {
    curtain.style.display = "none";
  } else {
    setTimeout(() => {
      curtain.classList.add("go");
      setTimeout(() => { curtain.style.display = "none"; }, 1000);
    }, 1500);
  }


  /* ---------- 3. Scrolling marquees (they speed up while you scroll) ---------- */
  const signsHtml = data.rashis
    .map((r) => `<span><b class="hi">${r.hi}</b><i>${r.en}</i></span>`)
    .join("");
  byId("marqueeSigns").innerHTML = signsHtml + signsHtml;

  const wordsHtml = data.marqueeWords
    .map((w) => `<span>${w} <b class="hi">ॐ</b></span>`)
    .join("");
  byId("marqueeWords").innerHTML = wordsHtml.repeat(4);

  const marquees = [
    { element: byId("marqueeSigns"), direction: 1 },
    { element: byId("marqueeWords"), direction: -1 }
  ];
  let marqueeOffset = 0;
  let lastScrollY = scrollY;
  let marqueesRunning = false;
  const marqueesOnScreen = new Set();  // which of the two marquees are visible right now

  function moveMarquees() {
    const scrollSpeed = Math.abs(scrollY - lastScrollY);
    lastScrollY = scrollY;
    marqueeOffset += 0.7 + scrollSpeed * 0.6;

    marquees.forEach((m) => {
      const half = m.element.scrollWidth / 2;
      const shift = marqueeOffset % half;
      m.element.style.transform = `translateX(${m.direction > 0 ? -shift : shift - half}px)`;
    });
    if (marqueesRunning) requestAnimationFrame(moveMarquees);
  }

  /* Run only while a marquee is on screen and the tab is showing, so it costs nothing the rest of the time. */
  function updateMarquees() {
    const shouldRun = !prefersReducedMotion && marqueesOnScreen.size > 0 && !document.hidden;
    if (shouldRun && !marqueesRunning) { marqueesRunning = true; lastScrollY = scrollY; requestAnimationFrame(moveMarquees); }
    else if (!shouldRun) marqueesRunning = false;
  }
  moveMarquees();                      // draw the first frame (the only one when "reduce motion" is on)
  if ("IntersectionObserver" in window && !prefersReducedMotion) {
    const marqueeWatcher = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) marqueesOnScreen.add(e.target); else marqueesOnScreen.delete(e.target); });
      updateMarquees();
    });
    marquees.forEach((m) => marqueeWatcher.observe(m.element.parentElement));
    document.addEventListener("visibilitychange", updateMarquees);
  } else if (!prefersReducedMotion) {
    marqueesOnScreen.add(marquees[0].element); updateMarquees();          // very old browser: keep the old always-running behaviour
  }


  /* ---------- 4. "What is stuck in your life?" buttons ---------- */
  const chipBox = byId("chips");
  data.concerns.forEach(([label, answer, heading]) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = label;
    chip.setAttribute("aria-pressed", "false");
    chip.addEventListener("click", () => {
      chipBox.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", "false"));
      chip.setAttribute("aria-pressed", "true");
      byId("answerTitle").textContent = heading;
      byId("answerText").innerHTML = `${answer} <a href="#services">See the sessions</a>`;
    });
    chipBox.appendChild(chip);
  });


  /* ---------- 5. The Moon right now ----------
     Real positions of the Moon and Sun from js/panchang.js: the phase, the Moon's sidereal sign,
     the birth star it is in, and the tithi with the time it ends. Redrawn every minute. */
  (function drawMoon() {
    const MOON_RADIUS = 92;
    const REFRESH_MINUTES = 1;

    // The lit part of the disc: a half circle plus an ellipse edge
    function drawPhase(moon) {
      const cosine = Math.cos(2 * Math.PI * moon.elongation / 360);   // 1 = new moon, -1 = full moon
      const outerSweep = moon.isWaxing ? 1 : 0;
      const innerSweep = moon.isWaxing ? (cosine > 0 ? 0 : 1) : (cosine > 0 ? 1 : 0);
      const innerRadius = (MOON_RADIUS * Math.abs(cosine)).toFixed(2);
      byId("moonLight").setAttribute("d",
        `M100 8A${MOON_RADIUS} ${MOON_RADIUS} 0 0 ${outerSweep} 100 192A${innerRadius} ${MOON_RADIUS} 0 0 ${innerSweep} 100 8Z`);
    }

    // One box of the facts list: a small label, the Hindi name, the English name, and a line of detail
    function makeFact(label, hindi, english, detail) {
      const box = document.createElement("div");
      const term = document.createElement("dt");
      term.textContent = label;
      const value = document.createElement("dd");
      const hindiName = document.createElement("span");
      hindiName.className = "hi fact-hi";
      hindiName.textContent = hindi;
      const englishName = document.createElement("b");
      englishName.textContent = english;
      const note = document.createElement("small");
      note.textContent = detail;
      value.append(hindiName, englishName, note);
      box.append(term, value);
      return box;
    }

    function tithiName(tithiNumber) {
      if (tithiNumber === 15) return "Purnima";
      if (tithiNumber === 30) return "Amavasya";
      return data.tithis[(tithiNumber - 1) % 15];
    }

    function showMoon() {
      const now = new Date();
      const moon = window.SufPanchang.moonNow(now);
      const rashi = data.rashis[moon.rashiIndex];
      const nakshatra = data.nakshatras[moon.nakshatraIndex];
      const tithiEnd = window.SufPanchang.tithiEndsAt(now);
      const tithiEndText = tithiEnd
        ? ` Ends ${tithiEnd.toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}.`
        : "";

      drawPhase(moon);
      byId("moonPercent").textContent =
        `${Math.round(moon.litFraction * 100)}% lit, ${moon.isWaxing ? "waxing" : "waning"}.`;

      byId("moonFacts").replaceChildren(
        makeFact("Moon sign", rashi.hi, rashi.en,
          `${rashi.sign}, ${Math.floor(moon.degreesInRashi)}° in.`),
        makeFact("Birth star", nakshatra.hi, nakshatra.en,
          `Pada ${moon.pada}, ruled by ${data.nakshatraLords[moon.nakshatraIndex % 9]}.`),
        makeFact("Tithi", moon.isShukla ? "शुक्ल पक्ष" : "कृष्ण पक्ष", tithiName(moon.tithiNumber),
          `${moon.isShukla ? "Shukla" : "Krishna"} paksha, tithi ${moon.tithiInPaksha}.${tithiEndText}`)
      );

      byId("moonNote").textContent =
        "Worked out from the real positions of the Moon and Sun, with the Lahiri ayanamsa (sidereal zodiac). " +
        "Times are on your device’s clock. A printed panchang can differ by a minute or two at the edges.";
    }

    showMoon();
    setInterval(showMoon, REFRESH_MINUTES * 60000);
  })();


  /* ---------- 6. Which graha rules your birthday? ---------- */
  byId("birthday").addEventListener("input", (event) => {
    const parts = event.target.value.split("-");
    if (parts.length < 3) return;
    const date = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    if (isNaN(date)) return;

    const lord = data.weekdays[date.getDay()];
    byId("weekdayOut").innerHTML =
      `<i class="hi">${lord.hi}</i>${lord.name} (${lord.english})` +
      `<small>You were born on a ${lord.day}. ${lord.about} This is only the weekday lord; a real reading looks at the whole chart.</small>`;
  });


  /* ---------- 7. Twelve signs wheel (turns as you scroll, tap a sign to read it) ---------- */
  const SVG_NS = "http://www.w3.org/2000/svg";
  const WHEEL_RADIUS = 195;
  const signGroups = [];

  function placeSigns() {
    const spin = scrollY * 0.1;
    signGroups.forEach((group, index) => {
      const angle = (index * 30 - 90 + spin) * Math.PI / 180;
      const x = (WHEEL_RADIUS * Math.cos(angle)).toFixed(1);
      const y = (WHEEL_RADIUS * Math.sin(angle)).toFixed(1);
      group.setAttribute("transform", `translate(${x} ${y})`);
    });
  }

  function selectSign(index) {
    signGroups.forEach((g, i) => g.setAttribute("aria-pressed", i === index));
    const r = data.rashis[index];
    byId("wheelRead").innerHTML =
      `<i class="hi">${r.hi}</i><b>${r.en}</b><span>${r.sign}, ruled by ${r.ruler}. Element: ${r.element}.</span>`;
  }

  data.rashis.forEach((rashi, index) => {
    const group = document.createElementNS(SVG_NS, "g");
    group.setAttribute("class", "sign");
    group.setAttribute("tabindex", "0");
    group.setAttribute("role", "button");
    group.setAttribute("aria-label", `${rashi.en}, ${rashi.sign}`);
    group.setAttribute("aria-pressed", "false");

    const circle = document.createElementNS(SVG_NS, "circle");
    circle.setAttribute("r", 34);

    const label = document.createElementNS(SVG_NS, "text");
    label.setAttribute("class", "hi");
    label.setAttribute("y", 9);
    label.setAttribute("text-anchor", "middle");
    label.textContent = rashi.hi;

    group.append(circle, label);
    group.addEventListener("click", () => selectSign(index));
    group.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectSign(index); }
    });
    byId("wheelSigns").appendChild(group);
    signGroups.push(group);
  });
  placeSigns();
  selectSign(0);
  addEventListener("scroll", placeSigns, { passive: true });


  /* ---------- 8. Red comet trail in the hero (a thin ribbon that fades fast, no words) ---------- */
  const hero = document.querySelector(".hero");
  const trailCanvas = byId("trail");
  const trailPen = trailCanvas.getContext("2d");
  const TRAIL_LIFETIME_MS = 380;
  const TRAIL_MAX_POINTS = 40;
  let trailPoints = [];
  let trailWidth = 0, trailHeight = 0;
  let trailRunning = false;

  function sizeTrailCanvas() {
    const ratio = devicePixelRatio || 1;
    trailWidth = trailCanvas.clientWidth;
    trailHeight = trailCanvas.clientHeight;
    trailCanvas.width = trailWidth * ratio;
    trailCanvas.height = trailHeight * ratio;
    trailPen.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  sizeTrailCanvas();
  addEventListener("resize", sizeTrailCanvas);

  function drawTrail() {
    const now = Date.now();
    trailPen.clearRect(0, 0, trailWidth, trailHeight);
    trailPoints = trailPoints.filter((p) => now - p.time < TRAIL_LIFETIME_MS);

    trailPen.lineCap = "round";
    trailPen.lineJoin = "round";
    for (let i = 2; i < trailPoints.length; i++) {
      const a = trailPoints[i - 2], b = trailPoints[i - 1], c = trailPoints[i];
      const freshness = 1 - (now - c.time) / TRAIL_LIFETIME_MS;     // 1 = new, 0 = gone
      trailPen.strokeStyle = `rgba(229,9,20,${(freshness * 0.9).toFixed(2)})`;
      trailPen.lineWidth = 0.8 + freshness * 4.2;
      trailPen.beginPath();
      trailPen.moveTo((a.x + b.x) / 2, (a.y + b.y) / 2);
      trailPen.quadraticCurveTo(b.x, b.y, (b.x + c.x) / 2, (b.y + c.y) / 2);
      trailPen.stroke();
    }

    if (trailPoints.length) requestAnimationFrame(drawTrail);
    else trailRunning = false;                  // nothing left to draw: stop until the mouse moves again
  }

  if (!prefersReducedMotion) {
    hero.addEventListener("pointermove", (event) => {
      const box = hero.getBoundingClientRect();
      const moves = event.getCoalescedEvents ? event.getCoalescedEvents() : [];
      (moves.length ? moves : [event]).forEach((m) => {
        trailPoints.push({ x: m.clientX - box.left, y: m.clientY - box.top, time: Date.now() });
      });
      if (trailPoints.length > TRAIL_MAX_POINTS) trailPoints.splice(0, trailPoints.length - TRAIL_MAX_POINTS);
      if (!trailRunning) { trailRunning = true; requestAnimationFrame(drawTrail); }
    });
  }


  /* ---------- 9. Scroll effects ---------- */

  // Red progress bar at the very top
  const progressBar = byId("progress");
  addEventListener("scroll", () => {
    const scrollable = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    progressBar.style.transform = `scaleX(${scrollY / scrollable})`;
  }, { passive: true });

  // Hero headline: line up the first letters. Fonts leave a different amount of empty space before each
  // letter (V has almost none, a has some), so the lines look ragged. This measures the real ink edge of
  // each line's first letter and shifts the line left by that space (CSS: margin-left: var(--ink-shift)).
  function alignHeadlineEdges() {
    const measuringPen = document.createElement("canvas").getContext("2d");
    document.querySelectorAll(".hero-1, .hero-2, h1 em").forEach((line) => {
      const look = getComputedStyle(line);
      measuringPen.font = `${look.fontStyle} ${look.fontWeight} 100px ${look.fontFamily}`;
      const firstLetter = line.textContent.trim().charAt(0);
      const spaceBeforeInk = -measuringPen.measureText(firstLetter).actualBoundingBoxLeft;   // in px at 100px
      line.style.setProperty("--ink-shift", `${(-spaceBeforeInk / 100).toFixed(4)}em`);
    });
  }
  // Hero headline: make "Vedic" end where "astrology" ends. Both words' real ink widths are measured and
  // "Vedic" is scaled (CSS: font-size * --vedic-scale) so its right edge lands on "astrology"'s right edge,
  // while the shared left edge stays straight.
  function alignHeadlineRightEdges() {
    const vedic = document.querySelector(".hero-1"), astrology = document.querySelector(".hero-2");
    if (!vedic || !astrology) return;
    vedic.style.setProperty("--vedic-scale", "1");
    const measuringPen = document.createElement("canvas").getContext("2d");
    function inkWidth(line) {                       // ink width of the whole word, in px at the line's real size
      const look = getComputedStyle(line);
      measuringPen.font = `${look.fontStyle} ${look.fontWeight} 100px ${look.fontFamily}`;
      if ("letterSpacing" in measuringPen) measuringPen.letterSpacing = `${parseFloat(look.letterSpacing) / parseFloat(look.fontSize) * 100 || 0}px`;
      const box = measuringPen.measureText(line.textContent.trim());
      return (box.actualBoundingBoxLeft + box.actualBoundingBoxRight) / 100 * parseFloat(look.fontSize);
    }
    const scale = inkWidth(astrology) / inkWidth(vedic);
    if (isFinite(scale) && scale > 0.3 && scale < 3) vedic.style.setProperty("--vedic-scale", scale.toFixed(4));
  }
  function alignHeadline() { alignHeadlineRightEdges(); alignHeadlineEdges(); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(alignHeadline);
  addEventListener("resize", alignHeadline);
  alignHeadline();

  // Magnetic buttons: the nearest button leans toward the mouse
  if (!prefersReducedMotion) {
    const clamp = (value) => Math.max(-8, Math.min(8, value));
    addEventListener("pointermove", (event) => {
      const items = document.querySelectorAll(".btn, .badge");
      let nearest = null, nearestDistance = 40;
      items.forEach((item) => {
        const r = item.getBoundingClientRect();
        const dx = Math.max(r.left - event.clientX, 0, event.clientX - r.right);
        const dy = Math.max(r.top - event.clientY, 0, event.clientY - r.bottom);
        const distance = Math.hypot(dx, dy);
        if (distance < nearestDistance) { nearestDistance = distance; nearest = item; }
      });
      items.forEach((item) => {
        if (item === nearest) {
          const r = item.getBoundingClientRect();
          const pullX = clamp((event.clientX - (r.left + r.width / 2)) * 0.12);
          const pullY = clamp((event.clientY - (r.top + r.height / 2)) * 0.12);
          item.style.transform = `translate(${pullX}px,${pullY}px)`;
        } else if (item.style.transform) {
          item.style.transform = "";
        }
      });
    });
  }

  // 3D tilt on the session cards (mouse only). Raise the number for a stronger tilt.
  const CARD_TILT_DEGREES = 3;
  if (matchMedia("(pointer:fine)").matches && !prefersReducedMotion) {
    document.querySelectorAll(".card").forEach((card) => {
      card.addEventListener("pointermove", (event) => {
        const box = card.getBoundingClientRect();
        const x = (event.clientX - box.left) / box.width - 0.5;
        const y = (event.clientY - box.top) / box.height - 0.5;
        card.style.transform = `perspective(900px) rotateY(${x * CARD_TILT_DEGREES}deg) rotateX(${-y * CARD_TILT_DEGREES}deg) scale(1.01)`;
      });
      card.addEventListener("pointerleave", () => { card.style.transform = ""; });
    });
  }


  /* ---------- 10. Top bar ---------- */
  const bar = document.querySelector(".bar");
  const menuButton = byId("menuButton");
  const menu = byId("menu");

  // Slide the bar away when scrolling down, bring it back when scrolling up
  let previousScrollY = 0;
  addEventListener("scroll", () => {
    const goingDown = scrollY > previousScrollY && scrollY > 300;
    bar.style.transform = goingDown && !bar.classList.contains("open") ? "translateY(-160%)" : "";
    previousScrollY = scrollY;
  }, { passive: true });

  // Mobile dropdown menu
  function setMenuOpen(open) {
    bar.classList.toggle("open", open);
    menuButton.setAttribute("aria-expanded", open);
    menuButton.textContent = open ? "Close" : "Menu";
  }
  menuButton.addEventListener("click", () => setMenuOpen(!bar.classList.contains("open")));
  menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setMenuOpen(false)));
  addEventListener("keydown", (event) => {
    if (event.key === "Escape" && bar.classList.contains("open")) { setMenuOpen(false); menuButton.focus(); }
  });
  document.addEventListener("click", (event) => {
    if (bar.classList.contains("open") && !bar.contains(event.target)) setMenuOpen(false);
  });

  // Highlight the menu link of the section you are looking at.
  // (js/app.js does the same for Blog, Write and Dashboard, which are separate views.)
  const menuLinks = [...menu.querySelectorAll("a")];
  const linkTargets = menuLinks.map((link) => {
    const href = link.getAttribute("href");
    if (href === "#top") return hero;
    return href.length > 1 && href.startsWith("#") ? document.querySelector(href) : null;
  });

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      const inView = /\bview-(blog|admin|dashboard|mine)\b/.test(document.body.className);
      if (inView) return;
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        menuLinks.forEach((link, i) => {
          if (linkTargets[i] === entry.target) link.setAttribute("aria-current", "true");
          else link.removeAttribute("aria-current");
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    linkTargets.forEach((target) => { if (target) observer.observe(target); });
  }
  /* ---------- Pause CSS animations (spinning badges, blog ribbon) while they are off screen ---------- */
  if ("IntersectionObserver" in window) {
    const animationWatcher = new IntersectionObserver((entries) => {
      entries.forEach((e) => e.target.classList.toggle("anim-off", !e.isIntersecting));
    });
    document.querySelectorAll(".badge, .youtube-badge, .blog-ribbon").forEach((el) => animationWatcher.observe(el));
  }
})();
