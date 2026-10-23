/* ==========================================================================
   The nine grahas: the orbit animation in the "Nine grahas, always moving" section.

   - The planets circle slowly.
   - Tap a planet to read what it governs.
   - Press and hold on the canvas: after a short delay (0.8 s) the planets ease into a line.
   - Move the mouse across it and the whole system tilts a little.

   The planet list (names, colours, speeds) lives in js/data.js.
   ========================================================================== */
(function () {
  "use strict";

  const grahas = window.SUF_DATA.grahas;
  const sunInfo = window.SUF_DATA.sun;
  const prefersReducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const canvas = document.getElementById("sky");
  const pen = canvas.getContext("2d");
  const infoBox = document.getElementById("planetInfo");

  /* ----- Settings you may want to tweak ----- */
  const HOLD_DELAY_MS = 800;        // how long to hold before the planets line up
  const LINE_UP_EASE = 0.03;        // how quickly they glide into line (bigger = faster)
  const SPEED = 0.005;              // overall orbit speed (smaller = slower)
  const FLATTEN = 0.4;              // orbits are ellipses: height is 40 percent of width
  const BASE_TILT = -0.35;          // resting tilt of the whole system, in radians
  const MOUSE_TILT = 0.25;          // extra tilt as the mouse moves across (0 = none)
  const PULL_STRENGTH = 0.05;       // how hard held planets are pulled into line (bigger = faster)
  const REALIGN_STRENGTH = 0.02;    // how gently Ketu drifts back opposite Rahu after letting go
  const REALIGN_MAX_STEP = 0.001;   // the most Ketu may turn per frame while drifting back (radians). About Saturn's pace, so it never rushes past the others
  const GHOST_OPACITY = 0.45;       // a planet passing behind the Sun is drawn this see-through

  /* Colours that change with light / dark mode are read from the page (see theme.js and the
     :root variables in css/site.css). The rest never change. */
  const RED = (getComputedStyle(document.documentElement).getPropertyValue("--sky-accent") || "").trim() || "#c7121c", CREAM = "#fbefd6";   // --sky-accent: see css/site.css
  const LABEL_FONT = '800 12px "SF Pro Display", -apple-system, "Inter", sans-serif';
  const colors = { line: "#000000", background: "#ffffff" };   // replaced by readThemeColors()

  function readThemeColors() {
    const style = getComputedStyle(document.documentElement);
    colors.line = style.getPropertyValue("--fg").trim() || colors.line;
    colors.background = style.getPropertyValue("--surface-1").trim() || colors.background;
    if (prefersReducedMotion) drawFrame();
  }

  /* ----- State ----- */
  let width = 0, height = 0, scale = 0;
  let clock = 0;                    // grows steadily; drives the orbits
  let tilt = BASE_TILT, tiltTarget = BASE_TILT;
  let lineUp = 0;                   // 0 = free orbits, 1 = lined up
  let holding = false, holdStartedAt = 0;
  let selected = -1;                // index of the tapped planet, SUN_INDEX for the Sun, -1 for none
  const SUN_INDEX = -2;
  let sunPosition = null;           // where the Sun was drawn last frame, for tapping
  let planetPositions = [];         // where each planet was drawn last frame, for tapping
  let running = false, lastFrameTime = 0;

  /* Each planet starts at a different angle. Ketu always sits exactly opposite Rahu. */
  const startAngles = [];
  grahas.forEach((g, i) => {
    startAngles[i] = g.oppositeOf
      ? startAngles[grahas.findIndex((x) => x.name === g.oppositeOf)] + Math.PI
      : i * 1.3;
  });
  const angles = startAngles.slice();   // the angle each planet is drawn at right now

  /* ----- Sizing ----- */
  function resize() {
    const ratio = devicePixelRatio || 1;
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    pen.setTransform(ratio, 0, 0, ratio, 0, 0);
    scale = Math.min(width * 0.56, height * 0.95);      // size of the biggest orbit
    if (prefersReducedMotion) drawFrame();
  }

  /* ----- Drawing ----- */
  const sunRadius = () => scale * 0.09;
  const sunHaloRadius = () => scale * 0.12;

  function drawSun(cx, cy) {
    pen.fillStyle = RED;
    pen.beginPath(); pen.arc(cx, cy, sunRadius(), 0, 7); pen.fill();
    pen.strokeStyle = colors.line; pen.lineWidth = 3; pen.stroke();

    pen.beginPath(); pen.arc(cx, cy, sunHaloRadius(), 0, 7); pen.lineWidth = 1.5; pen.stroke();

    if (selected === SUN_INDEX) {                         // red halo on the tapped Sun
      pen.strokeStyle = RED; pen.lineWidth = 4;
      pen.beginPath(); pen.arc(cx, cy, sunHaloRadius() + 7, 0, 7); pen.stroke();
    }
    sunPosition = { x: cx, y: cy, hitRadius: sunHaloRadius() };

    // Name above the Sun, drawn like the planet names
    if ("letterSpacing" in pen) pen.letterSpacing = "-0.3px";
    pen.font = LABEL_FONT;
    pen.textAlign = "center"; pen.textBaseline = "alphabetic";
    pen.lineJoin = "round"; pen.lineWidth = 4; pen.strokeStyle = colors.background;
    const labelY = cy - sunHaloRadius() - (selected === SUN_INDEX ? 16 : 8);
    pen.strokeText(sunInfo.name, cx, labelY);
    pen.fillStyle = colors.line;
    pen.fillText(sunInfo.name, cx, labelY);

    // The ॐ on the Sun, centred by measuring the glyph
    if ("letterSpacing" in pen) pen.letterSpacing = "0px";
    pen.fillStyle = CREAM;
    pen.font = `700 ${Math.round(scale * 0.11)}px Sahitya, "Noto Serif Devanagari", serif`;
    pen.textAlign = "center";
    pen.textBaseline = "alphabetic";
    const m = pen.measureText("ॐ");
    const glyphWidth = m.actualBoundingBoxRight - m.actualBoundingBoxLeft;
    const glyphHeight = m.actualBoundingBoxAscent - m.actualBoundingBoxDescent;
    pen.fillText("ॐ", cx - glyphWidth / 2 - scale * 0.004, cy + glyphHeight / 2 - scale * 0.009);
  }

  function drawOrbits(cx, cy) {
    pen.save();
    pen.translate(cx, cy);
    pen.rotate(tilt);
    pen.lineWidth = 1.5;
    pen.globalAlpha = 0.4;
    pen.strokeStyle = colors.line;
    grahas.forEach((g) => {
      pen.beginPath();
      pen.ellipse(0, 0, g.orbit * scale, g.orbit * scale * FLATTEN, 0, 0, 7);
      pen.stroke();
    });
    pen.restore();
  }

  /* Angle of one planet. Each planet keeps its own angle and the angle only ever changes a little
     per frame, so nothing can jump:
       - every frame the planet moves on at its own speed;
       - while the mouse is held (lineUp above 0) it is also pulled gently toward the shared angle;
       - when the mouse is released the pull simply fades out and the planet carries on from where it is.
     Ketu is also eased back to sit exactly opposite Rahu once the pull is gone, at a capped slow pace
     (REALIGN_MAX_STEP): before v26 it swung half a turn round the outer orbit, far faster than any planet. */
  function planetAngle(index) { return angles[index]; }

  function shortestTurn(from, to) {
    return ((((to - from + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
  }

  function moveAngles(frames) {
    const sharedAngle = clock * 0.3;
    const rahuIndex = grahas.findIndex((g) => g.name === "Rahu");
    grahas.forEach((g, i) => {
      angles[i] += SPEED * frames * g.speed * 0.5;                         // its own orbit
      angles[i] += shortestTurn(angles[i], sharedAngle) * PULL_STRENGTH * lineUp * frames;
      if (g.oppositeOf) {                                                  // Ketu drifts back opposite Rahu
        const wantedTurn = shortestTurn(angles[i], angles[rahuIndex] + Math.PI) * REALIGN_STRENGTH;
        const gentleTurn = Math.max(-REALIGN_MAX_STEP, Math.min(REALIGN_MAX_STEP, wantedTurn));   // slow, steady drift, never a rush
        angles[i] += gentleTurn * (1 - lineUp) * frames;
      }
    });
  }

  /* Works out where every planet is on screen this frame, and which layer it belongs to:
       "behind" = on the far half of its orbit, not touching the Sun: drawn before the Sun, solid
       "ghost"  = on the far half AND overlapping the Sun: drawn after the Sun, see-through,
                  so it never hides the Sun
       "front"  = on the near half: drawn after the Sun, solid */
  function placePlanets(cx, cy) {
    const cos = Math.cos(tilt), sin = Math.sin(tilt);
    return grahas.map((g, index) => {
      const angle = planetAngle(index);
      const flatX = Math.cos(angle) * g.orbit * scale;
      const flatY = Math.sin(angle) * g.orbit * scale * FLATTEN;
      const x = cx + flatX * cos - flatY * sin;          // rotate by the tilt
      const y = cy + flatX * sin + flatY * cos;
      const radius = g.size * Math.max(0.7, Math.min(1.2, scale / 380));

      const isFarSide = flatY < 0;
      const touchesSun = Math.hypot(x - cx, y - cy) < sunHaloRadius() + radius;
      let layer = "front";
      if (isFarSide) layer = touchesSun ? "ghost" : "behind";

      return { index, planet: g, x, y, radius, layer };
    });
  }

  function drawPlanet(placed) {
    const { index, planet, x, y, radius, layer } = placed;
    pen.save();
    pen.globalAlpha = layer === "ghost" ? GHOST_OPACITY : 1;

    pen.fillStyle = planet.color;
    pen.beginPath(); pen.arc(x, y, radius, 0, 7); pen.fill();
    pen.strokeStyle = colors.line; pen.lineWidth = 2; pen.stroke();

    if (planet.ring) {                                    // Jupiter has a thin ring, Saturn a wide double ring
      const wide = planet.ring === "wide";
      const ringAlpha = layer === "ghost" ? GHOST_OPACITY : 1;
      pen.strokeStyle = colors.line;
      pen.globalAlpha = ringAlpha * (wide ? 0.95 : 0.5);
      pen.lineWidth = wide ? 2.5 : 2;
      pen.beginPath(); pen.ellipse(x, y, radius * (wide ? 2.1 : 1.7), radius * (wide ? 0.62 : 0.5), -0.3, 0, 7); pen.stroke();
      if (wide) {
        pen.lineWidth = 1.5;
        pen.beginPath(); pen.ellipse(x, y, radius * 1.65, radius * 0.48, -0.3, 0, 7); pen.stroke();
      }
      pen.globalAlpha = ringAlpha;
    }
    if (index === selected) {                             // red halo on the tapped planet
      pen.strokeStyle = RED; pen.lineWidth = 4;
      pen.beginPath(); pen.arc(x, y, radius + 7, 0, 7); pen.stroke();
    }

    // Name above the planet (with an outline in the section colour so it stays readable over orbit lines)
    if ("letterSpacing" in pen) pen.letterSpacing = "-0.3px";
    pen.font = LABEL_FONT;
    pen.textAlign = "center";
    pen.lineJoin = "round"; pen.lineWidth = 4; pen.strokeStyle = colors.background;
    pen.strokeText(planet.name, x, y - radius - 8);
    pen.fillStyle = colors.line;
    pen.fillText(planet.name, x, y - radius - 8);
    pen.restore();

    planetPositions[index] = { x, y, hitRadius: Math.max(radius, 18) };
  }

  function drawFrame() {
    pen.clearRect(0, 0, width, height);
    const cx = width / 2, cy = height / 2;
    const placed = placePlanets(cx, cy);
    const drawLayer = (layer) => placed.filter((p) => p.layer === layer).forEach(drawPlanet);

    planetPositions = [];
    drawOrbits(cx, cy);
    drawLayer("behind");
    drawSun(cx, cy);
    drawLayer("ghost");
    drawLayer("front");
  }

  /* ----- Animation loop (only runs while the section is on screen) ----- */
  function loop(now) {
    if (!running) return;
    const elapsed = lastFrameTime ? Math.min(now - lastFrameTime, 50) : 16.7;
    lastFrameTime = now;
    const frames = elapsed / 16.7;                         // 1 on a 60 Hz screen, 0.5 on 120 Hz

    clock += SPEED * frames;
    const wantLineUp = holding && Date.now() - holdStartedAt > HOLD_DELAY_MS ? 1 : 0;
    lineUp += (wantLineUp - lineUp) * LINE_UP_EASE * frames;
    moveAngles(frames);
    tilt += (tiltTarget - tilt) * 0.05 * frames;

    drawFrame();
    requestAnimationFrame(loop);
  }

  function start() {
    if (running || prefersReducedMotion) return;
    running = true; lastFrameTime = 0;
    requestAnimationFrame(loop);
  }
  function stop() { running = false; }

  /* ----- Interaction ----- */
  function showInfo(index) {
    const g = index === SUN_INDEX ? sunInfo : grahas[index];
    infoBox.innerHTML = `<b>${g.name} · ${g.english}</b>${g.about}`;
  }

  canvas.addEventListener("click", (event) => {
    const box = canvas.getBoundingClientRect();
    const mx = event.clientX - box.left, my = event.clientY - box.top;
    selected = -1;
    planetPositions.forEach((p, i) => {
      if (p && Math.hypot(mx - p.x, my - p.y) < p.hitRadius + 8) selected = i;
    });
    if (selected === -1 && sunPosition && Math.hypot(mx - sunPosition.x, my - sunPosition.y) < sunPosition.hitRadius) selected = SUN_INDEX;
    if (selected !== -1) showInfo(selected);
    if (prefersReducedMotion) drawFrame();
  });

  canvas.addEventListener("pointerdown", () => { holding = true; holdStartedAt = Date.now(); });
  addEventListener("pointerup", () => { holding = false; });
  addEventListener("pointercancel", () => { holding = false; });

  canvas.addEventListener("pointermove", (event) => {
    const box = canvas.getBoundingClientRect();
    tiltTarget = BASE_TILT + ((event.clientX - box.left) / width - 0.5) * MOUSE_TILT;
  });

  addEventListener("resize", resize);
  addEventListener("sufiology:themechange", readThemeColors);
  readThemeColors();
  resize();

  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      entries[0].isIntersecting ? start() : stop();
    }).observe(canvas);
  } else {
    start();
  }
  if (prefersReducedMotion && document.fonts && document.fonts.ready) document.fonts.ready.then(drawFrame);
})();
