/* ==========================================================================
   Live hero background for picture 2 (Ganesha on the lotus, on the left, looking right at the text).
   Very quiet movement, painted on top of img/hero-2.webp:
     - the aura around Ganesha breathes: a soft warm glow that swells and fades, and one faint ring
       that drifts slowly outwards
     - a few of the small lotus flowers and buds sway a tiny bit on their stems

   Same method as js/live.js: all positions are in PICTURE pixels (the print is 1536 x 1024). The page shows the
   print as a "cover" background, left aligned, so this file works out where the picture sits and draws in
   picture pixels. A "warped patch" copies a small piece of the picture row by row and shifts each row a little
   (most at the top of the stem, nothing at the bottom) with soft edges so the copy blends in.

   Wide screens only (phones use another picture). Nothing runs for people who asked for reduced motion.
   Paused while the hero is off screen or the tab is hidden. To tune the feel, change the settings just below.
   ========================================================================== */
(function () {
  "use strict";

  const canvas = document.getElementById("live");
  const hero = document.querySelector("section.hero");
  if (!canvas || !hero) return;
  if (document.documentElement.getAttribute("data-scene") !== "2") return;   // picture 2 only

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wideScreen = matchMedia("(min-width: 1001px)");
  if (reducedMotion) { canvas.hidden = true; return; }
  canvas.hidden = false;

  /* ----- Settings you may want to tweak ----- */
  const PICTURE_WIDTH = 1536, PICTURE_HEIGHT = 1024;   // size of img/hero-2.webp
  const LOTUS_SWAY = 1.3;            // picture pixels a flower sways at the top (keep small)
  const LOTUS_SPEED = 1.0;           // how fast they sway (1 = slow and gentle)
  const AURA_GLOW = 0.075;           // brightest the aura glow gets (0 = none)
  const AURA_SPEED = 0.55;           // how fast the glow breathes
  const RING_OPACITY = 0.085;        // how visible the drifting ring is (0 = none)
  const RING_SECONDS = 9;            // time for the ring to drift out and fade

  /* ----- Where things are, in picture pixels ----- */
  const AURA = { x: 425, y: 531, radius: 283 };          // the round halo behind Ganesha

  const pen = canvas.getContext("2d");
  const picture = new Image();
  let pictureReady = false;
  picture.onload = () => { pictureReady = true; resize(); };
  picture.src = "img/hero-2.webp";

  let running = false, lastTime = 0, clock = 0;

  function makePatch(box, wave) {
    const pad = 5;
    const piece = document.createElement("canvas");
    piece.width = box.w + pad * 2; piece.height = box.h + pad * 2;
    return { box, wave, pad, piece, pieceCtx: piece.getContext("2d") };
  }

  /* a lotus on its stem: free at the top, fixed at the bottom; each one has its own rhythm */
  function lotusWave(seed, strength) {
    return (p, t) => LOTUS_SWAY * strength * Math.pow(1 - p, 1.4) *
      (Math.sin(t * 1.25 * LOTUS_SPEED + seed + p * 1.5) * 0.7 + Math.sin(t * 0.8 * LOTUS_SPEED + seed * 2.3) * 0.3);
  }

  const patches = [
    makePatch({ x: 124, y: 703, w: 38, h: 70 },  lotusWave(0.0, 1.0)),   // bud, left of Ganesha
    makePatch({ x: 88,  y: 810, w: 62, h: 66 },  lotusWave(1.7, 1.0)),   // open flower, left
    makePatch({ x: 140, y: 850, w: 25, h: 44 },  lotusWave(3.1, 0.8)),   // small bud, left
    makePatch({ x: 690, y: 703, w: 40, h: 72 },  lotusWave(4.4, 1.0)),   // bud, right of Ganesha
    makePatch({ x: 698, y: 810, w: 64, h: 70 },  lotusWave(5.9, 1.0)),   // open flower, right
    makePatch({ x: 686, y: 850, w: 26, h: 44 },  lotusWave(2.4, 0.8))    // small bud, right
  ];

  function drawPatch(patch, time) {
    const { box, wave, pad, piece, pieceCtx } = patch;
    pieceCtx.globalCompositeOperation = "source-over";
    pieceCtx.clearRect(0, 0, piece.width, piece.height);
    for (let row = 0; row < piece.height; row++) {
      const progress = Math.min(1, Math.max(0, (row - pad) / box.h));
      const shift = wave(progress, time);
      pieceCtx.drawImage(picture, box.x - pad - shift, box.y - pad + row, piece.width, 1, 0, row, piece.width, 1);
    }
    // soft edges so the copy melts into the picture underneath
    pieceCtx.globalCompositeOperation = "destination-in";
    pieceCtx.save();
    pieceCtx.translate(piece.width / 2, piece.height / 2);
    pieceCtx.scale(piece.width / 2, piece.height / 2);
    const fade = pieceCtx.createRadialGradient(0, 0, 0, 0, 0, 1);
    fade.addColorStop(0, "rgba(0,0,0,1)");
    fade.addColorStop(0.72, "rgba(0,0,0,1)");
    fade.addColorStop(1, "rgba(0,0,0,0)");
    pieceCtx.fillStyle = fade;
    pieceCtx.fillRect(-1, -1, 2, 2);
    pieceCtx.restore();
    pen.drawImage(piece, box.x - pad, box.y - pad);
  }

  /* ----- The aura: a breathing glow near the edge of the halo, and one faint ring drifting outwards ----- */
  function drawAura(time) {
    const { x, y, radius } = AURA;
    const breathe = 0.5 + 0.5 * Math.sin(time * AURA_SPEED);                 // 0 to 1, slow
    const strength = AURA_GLOW * (0.35 + 0.65 * breathe);
    const glow = pen.createRadialGradient(x, y, radius * 0.62, x, y, radius * 1.16);
    glow.addColorStop(0, "rgba(255, 150, 70, 0)");
    glow.addColorStop(0.55, `rgba(255, 150, 70, ${strength})`);
    glow.addColorStop(1, "rgba(255, 130, 50, 0)");
    pen.fillStyle = glow;
    pen.beginPath(); pen.arc(x, y, radius * 1.16, 0, 7); pen.fill();

    const phase = (time % RING_SECONDS) / RING_SECONDS;                        // 0 to 1, then starts again
    const ringRadius = radius * (0.84 + 0.2 * phase);
    const alpha = RING_OPACITY * Math.sin(Math.PI * phase);
    pen.strokeStyle = `rgba(255, 190, 110, ${alpha})`;
    pen.lineWidth = 2.2;
    pen.beginPath(); pen.arc(x, y, ringRadius, 0, 7); pen.stroke();
  }

  /* ----- Placing the drawing on top of the print ----- */
  function resize() {
    if (!pictureReady) return;
    const box = hero.getBoundingClientRect();
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(box.width * ratio);
    canvas.height = Math.round(box.height * ratio);
    // The print is a "cover" background, LEFT aligned and centred up and down (see picture 2 in css/site.css)
    const scale = Math.max(box.width / PICTURE_WIDTH, box.height / PICTURE_HEIGHT);
    const top = (box.height - PICTURE_HEIGHT * scale) / 2;
    pen.setTransform(scale * ratio, 0, 0, scale * ratio, 0, top * ratio);
    pen.imageSmoothingQuality = "high";
    if (!running) start();
  }

  function drawFrame(seconds) {
    clock += seconds;
    pen.save();
    pen.setTransform(1, 0, 0, 1, 0, 0); pen.clearRect(0, 0, canvas.width, canvas.height);
    pen.restore();
    patches.forEach((patch) => drawPatch(patch, clock));
    pen.globalCompositeOperation = "lighter";              // glow adds light instead of covering
    drawAura(clock);
    pen.globalCompositeOperation = "source-over";
  }

  function loop(now) {
    if (!running) return;
    const seconds = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0.016;
    lastTime = now;
    drawFrame(seconds);
    requestAnimationFrame(loop);
  }

  let onScreen = true;
  function start() {
    if (running || !pictureReady || !wideScreen.matches || !onScreen || document.hidden) return;
    running = true; lastTime = 0;
    requestAnimationFrame(loop);
  }
  function stop() { running = false; }

  addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  wideScreen.addEventListener("change", () => (wideScreen.matches ? start() : stop()));
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      onScreen = entries[0].isIntersecting;
      onScreen ? start() : stop();
    }).observe(hero);
  }
})();
