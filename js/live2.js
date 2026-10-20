/* ==========================================================================
   Live hero background for picture 2 (Ganesha on the lotus, on the left, looking right at the text).
   Quiet movement, painted on top of img/hero-2.webp:
     - the aura around Ganesha breathes: a soft warm glow swells and fades, and two faint rings drift slowly
       outwards. Ganesha is cut out with img/hero-2-aura-mask.webp, so the light never touches him.
     - three of the small lotus flowers around him sway a little, as if a light wind blows
       (img/hero-2-plate.webp is the same picture without those flowers, so no static copy shows underneath)

   Same method as js/live.js: all positions are in PICTURE pixels (the print is 1536 x 1024). The page shows the
   print as a "cover" background, left aligned, so this file works out where the picture sits and draws in
   picture pixels. A "warped patch" copies a small piece of the picture row by row and shifts each row a little
   (most at the flower, nothing at the bottom of the stem) with soft edges so the copy blends in.

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
  const WIND_SWAY = 3.4;             // picture pixels the top of a flower moves (bigger = stronger breeze)
  const WIND_SPEED = 1.0;            // how fast the breeze changes (1 = gentle)
  const AURA_GLOW_LOW = 0.10;        // glow brightness at its dimmest
  const AURA_GLOW_HIGH = 0.26;       // glow brightness at its brightest (0 = none)
  const AURA_SPEED = 0.7;            // how fast the glow breathes
  const RING_OPACITY = 0.30;         // how visible the drifting rings are (0 = none)
  const RING_SECONDS = 8;            // time for a ring to drift out and fade

  /* ----- Where things are, in picture pixels ----- */
  const AURA = { x: 425, y: 531, radius: 283 };          // the round halo behind Ganesha
  const AURA_BOX = { x: 90, y: 196, w: 670, h: 670 };    // the part of the picture the mask file covers

  const pen = canvas.getContext("2d");
  const picture = new Image(), plate = new Image(), mask = new Image();
  let loaded = 0;
  function oneLoaded() { loaded++; if (loaded === 3) resize(); }
  [[picture, "img/hero-2.webp"], [plate, "img/hero-2-plate.webp"], [mask, "img/hero-2-aura-mask.webp"]].forEach(([image, src]) => {
    image.onload = oneLoaded; image.src = src;
  });

  const aura = document.createElement("canvas");          // the aura is drawn here first, then Ganesha is cut out
  aura.width = AURA_BOX.w; aura.height = AURA_BOX.h;
  const auraPen = aura.getContext("2d");

  let running = false, lastTime = 0, clock = 0;

  /* ----- A light breeze: a slow main sway plus smaller wobbles, and the odd gust ----- */
  function breeze(t) {
    const gust = 0.7 + 0.3 * Math.sin(t * 0.33);
    return gust * (0.6 * Math.sin(t * 0.95) + 0.28 * Math.sin(t * 1.9 + 1.3) + 0.12 * Math.sin(t * 3.4 + 0.4));
  }

  function makePatch(box, lag, strength) {
    const pad = 6, coverPad = 14;
    const piece = document.createElement("canvas");
    piece.width = box.w + pad * 2; piece.height = box.h + pad * 2;
    const cover = document.createElement("canvas");
    cover.width = box.w + coverPad * 2; cover.height = box.h + coverPad * 2;
    return { box, lag, strength, pad, coverPad, piece, pieceCtx: piece.getContext("2d"), cover, coverCtx: cover.getContext("2d"), covered: false };
  }

  /* three flowers close to Ganesha: the right bud, and the open flower on each side */
  const patches = [
    makePatch({ x: 690, y: 703, w: 40, h: 72 }, 0.0, 0.9),     // bud, right of Ganesha
    makePatch({ x: 88,  y: 810, w: 62, h: 66 }, 1.1, 1.0),     // open flower, left
    makePatch({ x: 698, y: 810, w: 64, h: 70 }, 2.3, 1.0)      // open flower, right
  ];

  function feather(ctx, w, h, inner) {
    ctx.globalCompositeOperation = "destination-in";
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(w / 2, h / 2);
    const fade = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    fade.addColorStop(0, "rgba(0,0,0,1)");
    fade.addColorStop(inner, "rgba(0,0,0,1)");
    fade.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = fade;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
    ctx.globalCompositeOperation = "source-over";
  }

  function drawPatch(patch, time) {
    const { box, lag, strength, pad, coverPad, piece, pieceCtx, cover, coverCtx } = patch;
    // 1. the still picture without the flower, so the flower is not drawn twice
    if (!patch.covered) {
      coverCtx.clearRect(0, 0, cover.width, cover.height);
      coverCtx.drawImage(plate, box.x - coverPad, box.y - coverPad, cover.width, cover.height, 0, 0, cover.width, cover.height);
      feather(coverCtx, cover.width, cover.height, 0.9);
      patch.covered = true;
    }
    pen.drawImage(cover, box.x - coverPad, box.y - coverPad);
    // 2. the flower copied row by row, each row shifted a little by the breeze
    pieceCtx.clearRect(0, 0, piece.width, piece.height);
    const wind = breeze(time * WIND_SPEED - lag);
    for (let row = 0; row < piece.height; row++) {
      const progress = Math.min(1, Math.max(0, (row - pad) / box.h));
      const shift = WIND_SWAY * strength * wind * Math.pow(1 - progress, 1.5);
      pieceCtx.drawImage(picture, box.x - pad - shift, box.y - pad + row, piece.width, 1, 0, row, piece.width, 1);
    }
    feather(pieceCtx, piece.width, piece.height, 0.72);
    pen.drawImage(piece, box.x - pad, box.y - pad);
  }

  /* ----- The aura: a breathing glow around the halo and rings drifting outwards, never over Ganesha ----- */
  function drawAura(time) {
    const { x, y, radius } = AURA;
    const cx = x - AURA_BOX.x, cy = y - AURA_BOX.y;
    auraPen.globalCompositeOperation = "source-over";
    auraPen.clearRect(0, 0, aura.width, aura.height);

    const breathe = 0.5 + 0.5 * Math.sin(time * AURA_SPEED);                 // 0 to 1, slow
    const strength = AURA_GLOW_LOW + (AURA_GLOW_HIGH - AURA_GLOW_LOW) * breathe;
    const swell = 1 + 0.03 * Math.sin(time * AURA_SPEED);                  // the glow also swells a touch
    const glow = auraPen.createRadialGradient(cx, cy, radius * 0.5 * swell, cx, cy, radius * 1.17 * swell);
    glow.addColorStop(0, "rgba(255, 150, 70, 0)");
    glow.addColorStop(0.5, `rgba(255, 160, 80, ${strength})`);
    glow.addColorStop(1, "rgba(255, 130, 50, 0)");
    auraPen.fillStyle = glow;
    auraPen.beginPath(); auraPen.arc(cx, cy, radius * 1.17 * swell, 0, 7); auraPen.fill();

    for (let i = 0; i < 2; i++) {                                           // two rings, half a cycle apart
      const phase = ((time / RING_SECONDS) + i * 0.5) % 1;                    // 0 to 1, then starts again
      const ringRadius = radius * (0.80 + 0.30 * phase);
      const alpha = RING_OPACITY * Math.sin(Math.PI * phase);
      auraPen.strokeStyle = `rgba(255, 200, 120, ${alpha})`;
      auraPen.lineWidth = 3;
      auraPen.beginPath(); auraPen.arc(cx, cy, ringRadius, 0, 7); auraPen.stroke();
    }

    auraPen.globalCompositeOperation = "destination-out";                   // cut Ganesha out, so nothing is drawn on him
    auraPen.drawImage(mask, 0, 0);
    auraPen.globalCompositeOperation = "source-over";

    pen.globalCompositeOperation = "lighter";                               // the glow adds light instead of covering
    pen.drawImage(aura, AURA_BOX.x, AURA_BOX.y);
    pen.globalCompositeOperation = "source-over";
  }

  /* ----- Placing the drawing on top of the print ----- */
  function resize() {
    if (loaded < 3) return;
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
    drawAura(clock);
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
    if (running || loaded < 3 || !wideScreen.matches || !onScreen || document.hidden) return;
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
