/* ==========================================================================
   Live hero background: small, quiet movements painted on top of the Ganesha print.

   What moves:
     - the painted flame on the tall brass lamp and on the small diya sways and flickers
     - the painted incense smoke sways, and a few soft wisps rise from the incense
     - a warm glow breathes around every flame

   How it works: all positions below are in PICTURE pixels (the print is 1536 x 1024). The page shows the
   print as a "cover" background, so this file works out where the picture sits on screen and draws in
   picture pixels. "Warped patches" copy a small piece of the picture row by row, shift each row a little
   (more at the loose end, none where it is attached), and fade the edges so the copy blends in.

   Wide screens only. On phones the hero uses a different picture, so nothing runs there.
   Nothing runs for people who asked for reduced motion. Paused while the hero is off screen.
   To tune the feel, change the named settings just below.
   ========================================================================== */
(function () {
  "use strict";

  const canvas = document.getElementById("live");
  const hero = document.querySelector("section.hero");
  if (!canvas || !hero) return;
  if ((document.documentElement.getAttribute("data-scene") || "1") !== "1") { canvas.hidden = true; return; }   // the flames are painted for picture 1 only

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wideScreen = matchMedia("(min-width: 1001px)");
  if (reducedMotion) { canvas.hidden = true; return; }

  /* ----- Settings you may want to tweak ----- */
  const PICTURE_WIDTH = 1536, PICTURE_HEIGHT = 1024;   // size of img/hero-bg.webp
  const FLAME_SWAY = 1.8;            // picture pixels the painted flames sway
  const SMOKE_SWAY = 3.5;            // picture pixels the painted smoke sways at the top
  const GLOW_STRENGTH = 0.2;         // brightness of the glow around flames (0 = none)
  const WISP_EVERY_SECONDS = 0.5;    // a new smoke wisp this often (bigger = fewer)
  const WISP_OPACITY = 0.11;         // how visible the rising wisps are

  /* ----- Where things are, in picture pixels ----- */
  const INCENSE_TIP = { x: 884, y: 846 };
  const LIT_FLAMES = [                                   // flames painted in the print (glow only)
    { x: 903, y: 612, radius: 46 },                      // tall lamp, left of the lion
    { x: 1256, y: 912, radius: 34 }                      // small diya on the floor
  ];

  const pen = canvas.getContext("2d");
  const picture = new Image();
  let pictureReady = false;
  picture.onload = () => { pictureReady = true; resize(); };
  picture.src = "img/hero-bg.webp";

  let running = false, lastTime = 0, clock = 0, nextWisp = 0;
  let wisps = [];

  /* ----- Pieces of the picture that wave ----- */
  function makePatch(box, wave) {
    const pad = 5;
    const piece = document.createElement("canvas");
    piece.width = box.w + pad * 2; piece.height = box.h + pad * 2;
    return { box, wave, pad, piece, pieceCtx: piece.getContext("2d") };
  }

  /* wave(progress, time) gives how far to shift a row, where progress runs 0 (top of box) to 1 (bottom) */
  const patches = [
    makePatch({ x: 890, y: 574, w: 28, h: 62 },            // flame on the tall lamp, free at the top
      (p, t) => FLAME_SWAY * Math.pow(1 - p, 1.2) * (Math.sin(t * 6 + p * 5) * 0.6 + Math.sin(t * 9.7) * 0.4)),
    makePatch({ x: 1243, y: 892, w: 28, h: 34 },           // flame on the small diya
      (p, t) => FLAME_SWAY * Math.pow(1 - p, 1.2) * (Math.sin(t * 7 + p * 4) * 0.6 + Math.sin(t * 11.3) * 0.4)),
    makePatch({ x: 866, y: 758, w: 72, h: 96 },            // the painted incense smoke
      (p, t) => SMOKE_SWAY * (1 - p) * Math.sin(t * 0.9 - p * 6))
  ];

  function drawPatch(patch, time) {
    const { box, wave, pad, piece, pieceCtx } = patch;
    pieceCtx.globalCompositeOperation = "source-over";
    pieceCtx.clearRect(0, 0, piece.width, piece.height);
    for (let row = 0; row < piece.height; row++) {         // copy the picture one row at a time, each shifted a bit
      const progress = Math.min(1, Math.max(0, (row - pad) / box.h));
      const shift = wave(progress, time);
      pieceCtx.drawImage(picture, box.x - pad - shift, box.y - pad + row, piece.width, 1, 0, row, piece.width, 1);
    }
    // Fade the edges so the copy melts into the picture underneath
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

  /* ----- Flames and glow ----- */
  function flicker(time, seed) {
    return 0.5 + 0.25 * Math.sin(time * 7 + seed) + 0.15 * Math.sin(time * 13.1 + seed * 2) + 0.1 * Math.sin(time * 3.3 + seed * 3);
  }

  function drawGlow(x, y, radius, time, seed) {
    const strength = GLOW_STRENGTH * (0.6 + flicker(time, seed) * 0.8);
    const glow = pen.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, `rgba(255, 170, 60, ${strength})`);
    glow.addColorStop(1, "rgba(255, 120, 30, 0)");
    pen.fillStyle = glow;
    pen.beginPath(); pen.arc(x, y, radius, 0, 7); pen.fill();
  }

  /* ----- Rising smoke wisps from the incense ----- */
  function addWisp() {
    wisps.push({ x: INCENSE_TIP.x + (Math.random() - 0.5) * 4, y: INCENSE_TIP.y, age: 0, life: 4.5 + Math.random() * 2, seed: Math.random() * 6 });
  }

  function moveAndDrawWisps(seconds) {
    wisps.forEach((w) => {
      w.age += seconds;
      w.y -= 13 * seconds;
      w.x += (Math.sin(w.age * 1.2 + w.seed) * 7 + 4) * seconds;
    });
    wisps = wisps.filter((w) => w.age < w.life);
    wisps.forEach((w) => {
      const size = 6 + w.age * 5;
      const alpha = WISP_OPACITY * Math.sin(Math.PI * (w.age / w.life));
      const puff = pen.createRadialGradient(w.x, w.y, 0, w.x, w.y, size);
      puff.addColorStop(0, `rgba(238, 230, 224, ${alpha})`);
      puff.addColorStop(1, "rgba(238, 230, 224, 0)");
      pen.fillStyle = puff;
      pen.beginPath(); pen.arc(w.x, w.y, size, 0, 7); pen.fill();
    });
  }

  /* ----- Placing the drawing on top of the print ----- */
  function resize() {
    if (!pictureReady) return;
    const box = hero.getBoundingClientRect();
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(box.width * ratio);
    canvas.height = Math.round(box.height * ratio);
    // The print is a "cover" background, right aligned and centred up and down (see section.hero in css/site.css)
    const scale = Math.max(box.width / PICTURE_WIDTH, box.height / PICTURE_HEIGHT);
    const left = box.width - PICTURE_WIDTH * scale;
    const top = (box.height - PICTURE_HEIGHT * scale) / 2;
    pen.setTransform(scale * ratio, 0, 0, scale * ratio, left * ratio, top * ratio);
    pen.imageSmoothingQuality = "high";
    if (!running) start();
  }

  function drawFrame(seconds) {
    clock += seconds;
    pen.save();
    pen.setTransform(1, 0, 0, 1, 0, 0); pen.clearRect(0, 0, canvas.width, canvas.height);
    pen.restore();
    patches.forEach((patch) => drawPatch(patch, clock));
    moveAndDrawWisps(seconds);
    pen.globalCompositeOperation = "lighter";              // glow adds light instead of covering
    LIT_FLAMES.forEach((f, i) => drawGlow(f.x, f.y, f.radius, clock, i * 2.1));
    pen.globalCompositeOperation = "source-over";
  }

  function loop(now) {
    if (!running) return;
    const seconds = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0.016;
    lastTime = now;
    nextWisp -= seconds;
    if (nextWisp <= 0) { addWisp(); nextWisp = WISP_EVERY_SECONDS; }
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
