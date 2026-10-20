/* =====================================================================
   animation.js — deterministic 30 s cocktail build.
   render(t) draws the frame for time t (seconds). No randomness, no
   state carried between frames, so playback and frame capture match.
   Content and timing come from recipe.js (window.RECIPE).
   ===================================================================== */
(function () {
  "use strict";

  const R = window.RECIPE;
  const W = R.width, H = R.height, DUR = R.duration;

  /* ------------------------------------------------------------ math */
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, t) => { const x = clamp((t - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
  const easeOutCubic = x => 1 - Math.pow(1 - x, 3);
  const easeInOutCubic = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const easeOutBack = x => { const c = 1.70158; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  const easeInCubic = x => x * x * x;
  // progress of a window [a, a+d] at time t, in [0,1]
  const win = (t, a, d) => clamp((t - a) / d, 0, 1);

  function hex(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function rgba(c, a) { return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`; }
  function mixRGB(list) { // [[rgb, weight], ...] gamma-aware blend
    let r = 0, g = 0, b = 0, w = 0;
    for (const [c, k] of list) { if (k <= 0) continue; r += Math.pow(c[0] / 255, 2.2) * k; g += Math.pow(c[1] / 255, 2.2) * k; b += Math.pow(c[2] / 255, 2.2) * k; w += k; }
    if (w === 0) return [0, 0, 0];
    return [Math.pow(r / w, 1 / 2.2) * 255, Math.pow(g / w, 1 / 2.2) * 255, Math.pow(b / w, 1 / 2.2) * 255];
  }
  function darken(c, k) { return [c[0] * k, c[1] * k, c[2] * k]; }

  // seeded PRNG so ice arrangement is fixed but looks organic
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* ------------------------------------------------------------ recipe derived */
  const COL = {}; for (const k in R.colors) COL[k] = hex(R.colors[k]);
  const steps = R.steps;
  const byId = {}; steps.forEach(s => byId[s.id] = s);
  const buildSteps = steps.filter(s => s.kind !== "hero");
  const pours = steps.filter(s => s.kind === "pour" || s.kind === "dash");
  const TOTAL_OZ = pours.reduce((a, s) => a + (s.oz || s.tint || 0), 0);

  // Volume fraction of a liquid step that has entered the mixing glass at t
  function pourFrac(s, t) {
    const p = win(t, s.at, s.dur);
    if (s.kind === "pour") return smooth(0.30, 0.78, p);
    // dashes: each dash adds an equal share when its drop lands
    let f = 0;
    for (let i = 0; i < s.dashes; i++) { const land = dashLandP(i, s); f += p >= land ? 1 / s.dashes : 0; }
    return f;
  }
  function dashFlickP(i, s) { return 0.30 + i * 0.24; }       // moment the bottle flicks
  function dashLandP(i, s) { return dashFlickP(i, s) + 0.16; } // moment the drop lands

  function mixState(t) {
    let vol = 0; const parts = [];
    for (const s of pours) { const f = pourFrac(s, t); const v = (s.oz || s.tint || 0) * f; vol += v; parts.push([COL[s.color], v]); }
    const color = vol > 0 ? mixRGB(parts) : [0, 0, 0];
    return { vol, color, frac: vol / TOTAL_OZ };
  }

  /* ------------------------------------------------------------ layout */
  // positions of the two vessels through the piece
  function layout(t) {
    const A = { x: 660, y: 800, s: 1.0 };          // intro / prep
    const B = { x: 910, y: 800, s: 0.60 };         // beside the mixing glass
    const C = { x: 540, y: 860, s: 1.05 };         // garnish
    const D = { x: 540, y: 880, s: 1.15 };         // hero
    const mixHome = { x: 640, y: 820, s: 1.0 };

    const toB = easeInOutCubic(win(t, byId.mixice.at, 0.6));
    const toC = easeInOutCubic(win(t, byId.garnish.at, 1.5));
    const toD = easeInOutCubic(win(t, byId.hero.at, 2.2));

    let rocks = { ...A };
    rocks = { x: lerp(rocks.x, B.x, toB), y: lerp(rocks.y, B.y, toB), s: lerp(rocks.s, B.s, toB) };
    rocks = { x: lerp(rocks.x, C.x, toC), y: lerp(rocks.y, C.y, toC), s: lerp(rocks.s, C.s, toC) };
    rocks = { x: lerp(rocks.x, D.x, toD), y: lerp(rocks.y, D.y, toD), s: lerp(rocks.s, D.s, toD) };

    const mixIn = easeOutCubic(win(t, byId.mixice.at + 0.3, 0.9));
    const mixOut = easeInCubic(win(t, byId.garnish.at, 1.0));
    // lift and shift the mixing glass while it pours so the spout sits over the rocks glass
    const sp = win(t, byId.strain.at, byId.strain.dur);
    const strainShift = easeInOutCubic(smooth(0, 0.28, sp)) * (1 - easeInOutCubic(smooth(0.86, 1, sp)));
    const mix = {
      x: mixHome.x - 340 * (1 - mixIn) - 260 * mixOut - 70 * strainShift, y: mixHome.y + 320 * (1 - mixIn) + 300 * mixOut - 60 * strainShift, s: mixHome.s,
      alpha: mixIn * (1 - mixOut)
    };
    return { rocks, mix };
  }

  /* ------------------------------------------------------------ canvas setup */
  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");
  let dpr = 1;
  function resize(forcedDpr) {
    dpr = forcedDpr || Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr; canvas.height = H * dpr;
  }

  /* ------------------------------------------------------------ geometry */
  // Rocks glass local coords: origin at base centre, y up is negative
  const RG = { h: 310, topHalf: 150, botHalf: 125, inTopHalf: 136, inBotHalf: 112, inBot: -42, ry: 13 };
  // Mixing glass
  const MG = { h: 400, topHalf: 112, botHalf: 98, inTopHalf: 100, inBotHalf: 86, inBot: -24, ry: 10 };

  function glassOuterPath(c, G) {
    c.beginPath();
    c.moveTo(-G.topHalf, -G.h);
    c.lineTo(-G.botHalf, -10);
    c.quadraticCurveTo(-G.botHalf, 0, -G.botHalf + 10, 0);
    c.lineTo(G.botHalf - 10, 0);
    c.quadraticCurveTo(G.botHalf, 0, G.botHalf, -10);
    c.lineTo(G.topHalf, -G.h);
    c.closePath();
  }
  function glassInnerPath(c, G) {
    c.beginPath();
    c.moveTo(-G.inTopHalf, -G.h);
    c.lineTo(-G.inBotHalf, G.inBot - 8);
    c.quadraticCurveTo(-G.inBotHalf, G.inBot, -G.inBotHalf + 8, G.inBot);
    c.lineTo(G.inBotHalf - 8, G.inBot);
    c.quadraticCurveTo(G.inBotHalf, G.inBot, G.inBotHalf, G.inBot - 8);
    c.lineTo(G.inTopHalf, -G.h);
    c.closePath();
  }
  // half-width of the interior at height y (negative up)
  function innerHalfAt(G, y) { const u = (y - G.inBot) / (-G.h - G.inBot); return lerp(G.inBotHalf, G.inTopHalf, clamp(u, 0, 1)); }

  function drawGlassBack(c, G) {
    glassOuterPath(c, G);
    const g = c.createLinearGradient(-G.topHalf, 0, G.topHalf, 0);
    g.addColorStop(0, "rgba(255,255,255,0.10)");
    g.addColorStop(0.5, "rgba(255,255,255,0.03)");
    g.addColorStop(1, "rgba(255,255,255,0.09)");
    c.fillStyle = g; c.fill();
    // thick base
    c.beginPath();
    c.moveTo(-G.botHalf, 0); c.lineTo(G.botHalf, 0); c.lineTo(G.inBotHalf + 2, G.inBot); c.lineTo(-G.inBotHalf - 2, G.inBot); c.closePath();
    const gb = c.createLinearGradient(0, G.inBot, 0, 0);
    gb.addColorStop(0, "rgba(255,255,255,0.10)"); gb.addColorStop(1, "rgba(255,255,255,0.28)");
    c.fillStyle = gb; c.fill();
  }
  function drawGlassFront(c, G, frost) {
    // specular strips
    c.save(); glassOuterPath(c, G); c.clip();
    const s1 = c.createLinearGradient(-G.topHalf, 0, -G.topHalf + 60, 0);
    s1.addColorStop(0, "rgba(255,255,255,0.0)"); s1.addColorStop(0.5, "rgba(255,255,255,0.22)"); s1.addColorStop(1, "rgba(255,255,255,0.0)");
    c.fillStyle = s1; c.fillRect(-G.topHalf + 8, -G.h, 60, G.h);
    const s2 = c.createLinearGradient(G.topHalf - 40, 0, G.topHalf, 0);
    s2.addColorStop(0, "rgba(255,255,255,0.0)"); s2.addColorStop(0.6, "rgba(255,255,255,0.16)"); s2.addColorStop(1, "rgba(255,255,255,0.0)");
    c.fillStyle = s2; c.fillRect(G.topHalf - 40, -G.h, 40, G.h);
    if (frost > 0) {
      const f = c.createLinearGradient(0, -G.h * 0.75, 0, G.inBot);
      f.addColorStop(0, "rgba(255,255,255,0)"); f.addColorStop(1, `rgba(235,245,255,${0.28 * frost})`);
      c.fillStyle = f; c.fillRect(-G.topHalf, -G.h, G.topHalf * 2, G.h);
    }
    c.restore();
    // edges
    glassOuterPath(c, G);
    c.lineWidth = 2.2; c.strokeStyle = "rgba(255,255,255,0.38)"; c.stroke();
    // rim ellipse
    c.beginPath(); c.ellipse(0, -G.h, G.topHalf, G.ry, 0, 0, Math.PI * 2);
    c.lineWidth = 2.2; c.strokeStyle = "rgba(255,255,255,0.55)"; c.stroke();
  }

  // Fill liquid in a glass up to local y level (negative up), colour rgb
  function drawLiquid(c, G, levelY, color, alpha, surfaceShift) {
    if (levelY >= G.inBot - 1) return;
    const half = innerHalfAt(G, levelY);
    c.save(); glassInnerPath(c, G); c.clip();
    const grad = c.createLinearGradient(0, levelY, 0, G.inBot);
    grad.addColorStop(0, rgba(color, alpha));
    grad.addColorStop(1, rgba(darken(color, 0.62), alpha));
    c.fillStyle = grad;
    c.fillRect(-G.inTopHalf - 2, levelY, G.inTopHalf * 2 + 4, G.inBot - levelY + 2);
    c.restore();
    // surface ellipse
    c.save(); glassInnerPath(c, G); c.clip();
    c.beginPath(); c.ellipse(surfaceShift || 0, levelY, half, G.ry * 0.9, 0, 0, Math.PI * 2);
    c.fillStyle = rgba([Math.min(255, color[0] + 40), Math.min(255, color[1] + 40), Math.min(255, color[2] + 40)], alpha * 0.95); c.fill();
    c.strokeStyle = "rgba(255,255,255,0.35)"; c.lineWidth = 1.5; c.stroke();
    c.restore();
  }

  /* ------------------------------------------------------------ props */
  function drawIceCube(c, x, y, size, rot, alpha) {
    c.save(); c.translate(x, y); c.rotate(rot); c.globalAlpha *= alpha;
    const r = size * 0.14, h = size / 2;
    c.beginPath(); c.roundRect(-h, -h, size, size, r);
    const g = c.createLinearGradient(-h, -h, h, h);
    g.addColorStop(0, "rgba(230,245,255,0.78)"); g.addColorStop(0.5, "rgba(200,228,245,0.45)"); g.addColorStop(1, "rgba(170,205,230,0.70)");
    c.fillStyle = g; c.fill();
    c.strokeStyle = "rgba(255,255,255,0.75)"; c.lineWidth = 2; c.stroke();
    // facets
    c.beginPath(); c.moveTo(-h * 0.7, -h * 0.75); c.lineTo(h * 0.2, -h * 0.75); c.lineTo(-h * 0.55, h * 0.1); c.closePath();
    c.fillStyle = "rgba(255,255,255,0.35)"; c.fill();
    c.beginPath(); c.moveTo(h * 0.75, -h * 0.2); c.lineTo(h * 0.75, h * 0.7); c.lineTo(h * 0.15, h * 0.75); c.closePath();
    c.fillStyle = "rgba(255,255,255,0.18)"; c.fill();
    c.beginPath(); c.moveTo(-h * 0.6, h * 0.5); c.lineTo(h * 0.1, -h * 0.3);
    c.strokeStyle = "rgba(255,255,255,0.5)"; c.lineWidth = 1.2; c.stroke();
    c.restore();
  }

  // Banana leaf lining the inside of the rocks glass (local coords)
  function drawBananaLeaf(c, G, unfold, alpha, sheen) {
    // leaf is tall; stands inside glass, tip rising above the rim at the back-left
    c.save(); c.globalAlpha *= alpha;
    // clip: interior OR region above the rim
    glassInnerPath(c, G);
    c.rect(-G.topHalf - 40, -G.h - 300, G.topHalf * 2 + 80, 300 - G.ry);
    c.clip();
    c.translate(-28, 0); c.rotate(-0.10);
    c.scale(lerp(0.55, 1, unfold), 1);
    const L = 460, Wd = 150;
    c.beginPath();
    c.moveTo(0, -G.h - 120);                         // tip
    c.bezierCurveTo(Wd * 0.9, -G.h - 60, Wd * 1.05, -G.h + 160, Wd * 0.55, G.inBot + 12);
    c.quadraticCurveTo(0, G.inBot + 24, -Wd * 0.55, G.inBot + 12);
    c.bezierCurveTo(-Wd * 1.05, -G.h + 160, -Wd * 0.9, -G.h - 60, 0, -G.h - 120);
    c.closePath();
    const g = c.createLinearGradient(-Wd, 0, Wd, 0);
    g.addColorStop(0, "#2a5e26"); g.addColorStop(0.45, "#4f9a44"); g.addColorStop(0.55, "#5fae52"); g.addColorStop(1, "#2f6a2a");
    c.fillStyle = g; c.fill();
    c.save(); c.clip();
    // midrib
    c.beginPath(); c.moveTo(0, -G.h - 118); c.lineTo(0, G.inBot + 20);
    c.strokeStyle = "rgba(220,240,160,0.75)"; c.lineWidth = 5; c.stroke();
    // veins
    c.lineWidth = 1.4; c.strokeStyle = "rgba(20,60,20,0.35)";
    for (let i = 0; i < 22; i++) {
      const y = -G.h - 100 + i * (L / 22);
      c.beginPath(); c.moveTo(0, y); c.lineTo(Wd, y + 46); c.moveTo(0, y); c.lineTo(-Wd, y + 46); c.stroke();
    }
    if (sheen > 0) {
      const sx = lerp(-Wd * 1.5, Wd * 1.5, sheen);
      const sg = c.createLinearGradient(sx - 60, 0, sx + 60, 0);
      sg.addColorStop(0, "rgba(255,255,230,0)"); sg.addColorStop(0.5, "rgba(255,255,230,0.45)"); sg.addColorStop(1, "rgba(255,255,230,0)");
      c.fillStyle = sg; c.fillRect(-Wd * 2, -G.h - 140, Wd * 4, L + 60);
    }
    c.restore();
    c.strokeStyle = "rgba(15,45,15,0.5)"; c.lineWidth = 1.5; c.stroke();
    c.restore();
  }

  // Bottle for a pour. Local: mouth at origin, body extends +y (downwards before rotation)
  function drawBottle(c, color, label, isDasher) {
    const bw = isDasher ? 44 : 78, bh = isDasher ? 120 : 190, nw = isDasher ? 14 : 26, nh = isDasher ? 70 : 62;
    c.save();
    // neck
    c.beginPath(); c.roundRect(-nw / 2, 0, nw, nh + 6, 4);
    c.fillStyle = rgba(darken(color, 0.55), 0.95); c.fill();
    c.strokeStyle = "rgba(255,255,255,0.35)"; c.lineWidth = 1.5; c.stroke();
    // cap ring
    c.beginPath(); c.roundRect(-nw / 2 - 3, 0, nw + 6, 10, 3); c.fillStyle = "rgba(230,220,200,0.9)"; c.fill();
    // shoulders + body
    c.beginPath();
    c.moveTo(-nw / 2, nh);
    c.quadraticCurveTo(-bw / 2, nh + 10, -bw / 2, nh + 40);
    c.lineTo(-bw / 2, nh + bh - 10);
    c.quadraticCurveTo(-bw / 2, nh + bh, -bw / 2 + 10, nh + bh);
    c.lineTo(bw / 2 - 10, nh + bh);
    c.quadraticCurveTo(bw / 2, nh + bh, bw / 2, nh + bh - 10);
    c.lineTo(bw / 2, nh + 40);
    c.quadraticCurveTo(bw / 2, nh + 10, nw / 2, nh);
    c.closePath();
    const g = c.createLinearGradient(-bw / 2, 0, bw / 2, 0);
    g.addColorStop(0, rgba(darken(color, 0.7), 0.95)); g.addColorStop(0.35, rgba(color, 0.95)); g.addColorStop(1, rgba(darken(color, 0.5), 0.95));
    c.fillStyle = g; c.fill();
    c.strokeStyle = "rgba(255,255,255,0.4)"; c.lineWidth = 1.5; c.stroke();
    // highlight
    c.beginPath(); c.roundRect(-bw / 2 + 8, nh + 40, 8, bh - 60, 4); c.fillStyle = "rgba(255,255,255,0.35)"; c.fill();
    // label
    if (label) {
      const lw = bw - 14, lh = isDasher ? 46 : 70, ly = nh + (isDasher ? 46 : 70);
      c.beginPath(); c.roundRect(-lw / 2, ly, lw, lh, 3); c.fillStyle = "rgba(246,238,220,0.96)"; c.fill();
      c.fillStyle = "#2a1a10"; c.textAlign = "center"; c.textBaseline = "middle";
      c.font = `600 ${isDasher ? 9 : 12}px Inter, sans-serif`;
      const words = label.toUpperCase().split(" ");
      words.forEach((w, i) => c.fillText(w, 0, ly + lh / 2 + (i - (words.length - 1) / 2) * (isDasher ? 11 : 14)));
    }
    c.restore();
  }

  // Liquid stream from (x0,y0) to (x1,y1), colour, width
  function drawStream(c, x0, y0, x1, y1, color, w, alpha) {
    c.save(); c.globalAlpha *= alpha;
    c.beginPath(); c.moveTo(x0, y0);
    c.bezierCurveTo(x0 + (x1 - x0) * 0.1, y0 + (y1 - y0) * 0.45, x1, y1 - (y1 - y0) * 0.3, x1, y1);
    c.lineCap = "round";
    c.strokeStyle = rgba(color, 0.92); c.lineWidth = w; c.stroke();
    c.strokeStyle = "rgba(255,255,255,0.45)"; c.lineWidth = Math.max(1.2, w * 0.28); c.stroke();
    c.restore();
  }
  function drawRipples(c, x, y, rx, ry, phase, alpha) {
    c.save(); c.globalAlpha *= alpha;
    for (let i = 0; i < 3; i++) {
      const p = (phase + i / 3) % 1;
      c.beginPath(); c.ellipse(x, y, rx * (0.15 + p * 0.85), ry * (0.15 + p * 0.85), 0, 0, Math.PI * 2);
      c.strokeStyle = `rgba(255,255,255,${0.5 * (1 - p)})`; c.lineWidth = 1.5; c.stroke();
    }
    c.restore();
  }

  function drawBarSpoon(c, theta, submergedY) {
    // handle pivots over the rim; bowl orbits at the bottom
    const topX = 38 * Math.cos(theta), topY = -MG.h - 150;
    const botX = -58 * Math.cos(theta), botY = -70 + 10 * Math.sin(theta);
    c.save();
    c.beginPath(); c.moveTo(topX, topY); c.lineTo(botX, botY);
    c.strokeStyle = "rgba(225,225,235,0.95)"; c.lineWidth = 4; c.lineCap = "round"; c.stroke();
    // twisted handle ticks
    const n = 26; c.strokeStyle = "rgba(90,90,110,0.6)"; c.lineWidth = 1.2;
    for (let i = 3; i < n - 6; i++) {
      const u = i / n, x = lerp(topX, botX, u), y = lerp(topY, botY, u);
      const dx = (botY - topY), dy = -(botX - topX), L = Math.hypot(dx, dy);
      const k = 2.2 * Math.sin(i * 1.3);
      c.beginPath(); c.moveTo(x - dx / L * k, y - dy / L * k); c.lineTo(x + dx / L * k, y + dy / L * k); c.stroke();
    }
    // bowl
    c.beginPath(); c.ellipse(botX, botY + 6, 10, 7, 0, 0, Math.PI * 2);
    c.fillStyle = "rgba(225,225,235,0.95)"; c.fill();
    c.restore();
  }

  function drawStrainer(c) { // hawthorne strainer sitting on the mixing glass rim (glass local)
    c.save();
    c.translate(0, -MG.h - 2);
    // coil
    c.beginPath(); c.ellipse(0, 0, MG.topHalf - 4, MG.ry + 2, 0, 0, Math.PI * 2);
    c.strokeStyle = "rgba(230,230,240,0.9)"; c.lineWidth = 7; c.stroke();
    c.strokeStyle = "rgba(120,120,140,0.9)"; c.lineWidth = 1.2; c.setLineDash([3, 3]); c.stroke(); c.setLineDash([]);
    // plate
    c.beginPath(); c.ellipse(0, -2, MG.topHalf - 16, MG.ry, 0, 0, Math.PI * 2);
    const g = c.createLinearGradient(-MG.topHalf, 0, MG.topHalf, 0);
    g.addColorStop(0, "#9ea4b5"); g.addColorStop(0.5, "#e8ebf2"); g.addColorStop(1, "#8c93a4");
    c.fillStyle = g; c.fill();
    c.fillStyle = "rgba(60,60,80,0.6)";
    for (let i = -3; i <= 3; i++) for (let j = -1; j <= 1; j++) { c.beginPath(); c.arc(i * 18, -2 + j * 5, 2, 0, Math.PI * 2); c.fill(); }
    // handle
    c.beginPath(); c.roundRect(-MG.topHalf - 90, -8, 90, 12, 5); c.fillStyle = "#cfd3dd"; c.fill();
    c.strokeStyle = "rgba(60,60,80,0.5)"; c.lineWidth = 1; c.stroke();
    c.restore();
  }

  /* ------------------------------------------------------------ text */
  function text(c, str, x, y, font, color, align, baseline, tracking) {
    c.save(); c.font = font; c.fillStyle = color; c.textAlign = align || "left"; c.textBaseline = baseline || "alphabetic";
    if (tracking) { c.letterSpacing = tracking; }
    c.fillText(str, x, y); c.restore();
  }
  function wrap(c, str, maxW, font) {
    c.save(); c.font = font; const words = str.split(" "); const lines = []; let line = "";
    for (const w of words) { const test = line ? line + " " + w : w; if (c.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test; }
    if (line) lines.push(line); c.restore(); return lines;
  }

  const INK = "#f3e9d8", ACCENT = "#e9b872", MUTED = "rgba(243,233,216,0.62)";

  function drawTitleCard(c, t) {
    const a = smooth(0.15, 0.9, t) * (1 - smooth(2.4, 3.0, t));
    if (a <= 0) return;
    c.save(); c.globalAlpha = a;
    const rise = (1 - easeOutCubic(smooth(0.15, 1.0, t))) * 26;
    const x = 72, y0 = 330 + rise;
    text(c, "COCKTAIL RECIPE · 30 SECONDS", x, y0 - 86, "600 18px Inter, sans-serif", ACCENT, "left", "alphabetic", "0.18em");
    const lines = R.title.split("\n");
    lines.forEach((l, i) => text(c, l, x, y0 + i * 92, "900 86px 'Playfair Display', serif", INK));
    text(c, R.suffix, x + 4, y0 + lines.length * 92 - 14, "italic 400 40px 'Playfair Display', serif", ACCENT);
    text(c, R.translation, x, y0 + lines.length * 92 + 46, "400 24px Inter, sans-serif", MUTED);
    const cl = wrap(c, R.credit, 420, "500 18px Inter, sans-serif");
    cl.forEach((l, i) => text(c, l, x, y0 + lines.length * 92 + 94 + i * 26, "500 18px Inter, sans-serif", MUTED));
    c.restore();
  }

  function drawStepLabel(c, t) {
    for (let i = 0; i < buildSteps.length; i++) {
      const s = buildSteps[i];
      const p = (t - s.at) / s.dur; if (p < 0 || p > 1) continue;
      const a = smooth(0, 0.14, p) * (1 - smooth(0.86, 1, p));
      if (a <= 0) continue;
      c.save(); c.globalAlpha = a;
      const slide = (1 - easeOutCubic(smooth(0, 0.2, p))) * 18;
      const x = 72, y = 400 + slide;
      text(c, `STEP ${String(i + 1).padStart(2, "0")} OF ${String(buildSteps.length).padStart(2, "0")}`, x, y - 70, "600 17px Inter, sans-serif", ACCENT, "left", "alphabetic", "0.18em");
      const lines = wrap(c, s.label, 440, "700 54px 'Playfair Display', serif");
      lines.forEach((l, k) => text(c, l, x, y + k * 60, "700 54px 'Playfair Display', serif", INK));
      let ny = y + lines.length * 60 + 8;
      if (s.amount) { text(c, s.amount, x + 2, ny, "500 44px Inter, sans-serif", ACCENT); ny += 54; }
      if (s.detail) { const dl = wrap(c, s.detail, 430, "400 23px Inter, sans-serif"); dl.forEach((l, k) => text(c, l, x, ny + k * 31, "400 23px Inter, sans-serif", MUTED)); }
      // thin progress tick for the step
      c.fillStyle = "rgba(243,233,216,0.14)"; c.fillRect(x, y - 44, 120, 2);
      c.fillStyle = ACCENT; c.fillRect(x, y - 44, 120 * clamp(p, 0, 1), 2);
      c.restore();
    }
  }

  function drawHeroText(c, t) {
    const h = byId.hero; const p = (t - h.at) / h.dur; if (p < 0) return;
    const a1 = smooth(0.05, 0.4, p), a2 = smooth(0.2, 0.55, p), a3 = smooth(0.35, 0.7, p);
    const rise = (1 - easeOutCubic(smooth(0.05, 0.5, p))) * 20;
    c.save();
    c.globalAlpha = a1;
    const lines = R.title.split("\n");
    lines.forEach((l, i) => text(c, l.toUpperCase(), W / 2, 180 + rise + i * 88, "900 78px 'Playfair Display', serif", INK, "center"));
    c.globalAlpha = a2;
    text(c, R.suffix, W / 2, 180 + rise + lines.length * 88 - 18, "italic 400 40px 'Playfair Display', serif", ACCENT, "center");
    c.globalAlpha = a3;
    text(c, R.translation.toUpperCase(), W / 2, 180 + rise + lines.length * 88 + 30, "600 17px Inter, sans-serif", MUTED, "center", "alphabetic", "0.22em");
    text(c, R.credit, W / 2, H - 56, "500 18px Inter, sans-serif", MUTED, "center");
    c.restore();
  }

  /* ------------------------------------------------------------ background */
  function drawBackground(c, t, focus) {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#1b110c"); g.addColorStop(1, "#0a0605");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // warm spotlight behind the vessel in focus
    const sp = c.createRadialGradient(focus.x, focus.y - 200, 20, focus.x, focus.y - 200, 560);
    sp.addColorStop(0, "rgba(255,180,100,0.20)"); sp.addColorStop(0.5, "rgba(255,150,80,0.06)"); sp.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = sp; c.fillRect(0, 0, W, H);
    // table shadow
    c.save(); c.globalAlpha = 0.55;
    const sh = c.createRadialGradient(focus.x, focus.y + 6, 10, focus.x, focus.y + 6, 220 * focus.s);
    sh.addColorStop(0, "rgba(0,0,0,0.75)"); sh.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = sh; c.beginPath(); c.ellipse(focus.x, focus.y + 6, 230 * focus.s, 26 * focus.s, 0, 0, Math.PI * 2); c.fill();
    c.restore();
    // vignette
    const v = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.78);
    v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.55)");
    c.fillStyle = v; c.fillRect(0, 0, W, H);
  }

  /* ------------------------------------------------------------ vessels */
  const iceRand = mulberry32(7);
  const MIX_ICE = []; // fixed arrangement of small cubes in the mixing glass
  {
    const rows = [[-54, -56, 0], [-50, 0, 56], [-46, -54, 2, 58], [-42, -28, 30], [-34, -2]];
    let y = MG.inBot - 30;
    rows.forEach((row, r) => { for (let i = 1; i < row.length; i++) { MIX_ICE.push({ x: row[i] + (iceRand() - 0.5) * 10, y: y - (r > 0 ? 0 : 0), rot: (iceRand() - 0.5) * 0.9, size: 54 + iceRand() * 10, order: MIX_ICE.length }); } y -= 58; });
  }

  function drawRocksGlass(c, t, L, ms) {
    const s = L.rocks;
    c.save(); c.translate(s.x, s.y); c.scale(s.s, s.s);
    const G = RG;

    // leaf state
    const leaf = byId.leaf; const lp = win(t, leaf.at, leaf.dur);
    const leafIn = easeOutCubic(smooth(0.05, 0.75, lp));
    const gar = byId.garnish; const gp = win(t, gar.at, gar.dur);
    const sheen = gp > 0 && gp < 1 ? smooth(0.15, 0.9, gp) : 0;

    // big ice
    const ice = byId.bigice; const ip = win(t, ice.at, ice.dur);
    const drop = easeOutCubic(smooth(0.08, 0.55, ip));
    const settle = Math.sin(smooth(0.55, 0.9, ip) * Math.PI) * 6; // tiny rebound
    const cubeSize = 150; const cubeY = lerp(-G.h - 320, G.inBot - cubeSize / 2 - 2, drop) - settle;

    // liquid in rocks glass (arrives from strain)
    const st = byId.strain; const sp = win(t, st.at, st.dur);
    const strainFrac = smooth(0.30, 0.82, sp);
    const vol = TOTAL_OZ * strainFrac;
    const level = 0.60 * Math.pow(vol / TOTAL_OZ, 0.85);
    const levelY = G.inBot - level * (G.h + G.inBot) * 0.98;
    const liquidColor = ms.color; // final blend

    drawGlassBack(c, G);
    if (lp > 0) {
      c.save(); c.translate(0, (1 - leafIn) * -380); drawBananaLeaf(c, G, leafIn, 0.92, sheen); c.restore();
    }
    if (vol > 0.001) drawLiquid(c, G, levelY, liquidColor, 0.88, 0);
    if (ip > 0) {
      c.save(); glassInnerPath(c, G); c.rect(-G.topHalf, -G.h - 400, G.topHalf * 2, 400 - G.ry); c.clip();
      drawIceCube(c, 2, cubeY, cubeSize, 0.06, 1);
      c.restore();
      // liquid tint over the submerged part of the cube
      if (vol > 0.001) {
        c.save();
        c.translate(2, cubeY); c.rotate(0.06);
        c.beginPath(); c.roundRect(-cubeSize / 2, -cubeSize / 2, cubeSize, cubeSize, cubeSize * 0.14);
        c.rotate(-0.06); c.translate(-2, -cubeY); // back to glass-local, path is retained
        c.clip();
        drawLiquid(c, G, levelY, liquidColor, 0.5, 0);
        c.restore();
      }
    }
    // ripples when the strain pours in
    if (sp > 0.3 && sp < 0.86 && vol > 0.02) drawRipples(c, 0, levelY, innerHalfAt(G, levelY) * 0.8, G.ry * 0.8, (t * 1.6) % 1, 0.8);
    drawGlassFront(c, G, 0);
    c.restore();
  }

  function drawMixingGlass(c, t, L, ms) {
    const m = L.mix; if (m.alpha <= 0.001) return;
    const G = MG;
    // strain tilt
    const st = byId.strain; const sp = win(t, st.at, st.dur);
    const tiltIn = easeInOutCubic(smooth(0.0, 0.28, sp)), tiltOut = easeInOutCubic(smooth(0.86, 1, sp));
    const tilt = -0.60 * tiltIn * (1 - tiltOut); // radians, negative = rotate toward the right (rocks glass)
    const pourFrac = smooth(0.30, 0.82, sp);

    // stir
    const si = byId.stir; const stp = win(t, si.at, si.dur);
    const theta = stp * Math.PI * 2 * 2.6;
    const stirAmt = stp > 0 && stp < 1 ? Math.sin(Math.min(1, stp * 1.15) * Math.PI) : 0;
    const frost = smooth(0.25, 1, stp) * (sp < 1 ? 1 : 0);

    // ice fill
    const mi = byId.mixice; const mip = win(t, mi.at, mi.dur);

    c.save(); c.globalAlpha *= m.alpha;
    c.translate(m.x, m.y);
    // rotate about the lower-right corner so the spout heads toward the rocks glass
    c.translate(G.botHalf, 0); c.rotate(-tilt); c.translate(-G.botHalf, 0);
    c.scale(m.s, m.s);
    const base = c.getTransform();

    drawGlassBack(c, G);

    // liquid (world-horizontal surface while tilted)
    const remain = ms.vol * (1 - pourFrac);
    const remainFrac = remain / TOTAL_OZ;
    const levelFrac = 0.62 * Math.pow(clamp(ms.vol / TOTAL_OZ, 0, 1), 0.9);
    const levelYLocal = G.inBot - levelFrac * (G.h + G.inBot) * 0.98;
    if (ms.vol > 0.001 && remainFrac > 0.015) {
      if (Math.abs(tilt) < 0.001) {
        drawLiquid(c, G, levelYLocal, ms.color, 0.9, stirAmt * 6 * Math.sin(theta));
      } else {
        // world-space horizontal fill clipped to the glass interior
        c.save(); glassInnerPath(c, G); c.clip();
        // transformPoint returns device pixels; convert to CSS pixels for the identity-dpr fill below
        const spoutWorld = base.transformPoint(new DOMPoint(G.inTopHalf - 6, -G.h));
        const levelWorld0 = base.transformPoint(new DOMPoint(0, levelYLocal)).y / dpr;
        const surfaceY = lerp(levelWorld0, spoutWorld.y / dpr + 4, tiltIn);
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        const grd = c.createLinearGradient(0, surfaceY, 0, surfaceY + 260);
        grd.addColorStop(0, rgba(ms.color, 0.9)); grd.addColorStop(1, rgba(darken(ms.color, 0.62), 0.9));
        c.fillStyle = grd; c.fillRect(0, surfaceY, W, H - surfaceY);
        c.fillStyle = "rgba(255,255,255,0.22)"; c.fillRect(0, surfaceY, W, 3);
        c.restore();
      }
    }

    // small ice
    c.save(); glassInnerPath(c, G); c.rect(-G.topHalf, -G.h - 500, G.topHalf * 2, 500 - G.ry); c.clip();
    MIX_ICE.forEach((cube, i) => {
      const dp = easeOutCubic(smooth(0.05 + i * 0.07, 0.45 + i * 0.07, mip));
      if (dp <= 0) return;
      const y = lerp(-G.h - 420 - i * 30, cube.y, dp);
      const swirl = stirAmt * 0.22;
      const ang = Math.atan2(cube.y + 150, cube.x) + swirl * Math.sin(theta + i);
      const r = Math.hypot(cube.x, cube.y + 150);
      const x = stirAmt > 0 ? r * Math.cos(ang) : cube.x;
      const yy = stirAmt > 0 ? r * Math.sin(ang) - 150 : y;
      drawIceCube(c, x, yy, cube.size, cube.rot + stirAmt * 0.6 * Math.sin(theta * 0.5 + i), 0.95);
    });
    c.restore();

    // bar spoon
    if (stp > 0 && stp < 1) {
      const sa = smooth(0, 0.12, stp) * (1 - smooth(0.9, 1, stp));
      c.save(); c.globalAlpha *= sa; c.translate(0, (1 - easeOutCubic(smooth(0, 0.14, stp))) * -160); drawBarSpoon(c, theta); c.restore();
    }

    drawGlassFront(c, G, frost);
    // spout lip
    c.beginPath(); c.moveTo(G.topHalf - 14, -G.h - 2); c.lineTo(G.topHalf + 12, -G.h - 10); c.lineTo(G.topHalf + 2, -G.h + 2);
    c.strokeStyle = "rgba(255,255,255,0.55)"; c.lineWidth = 2; c.stroke();

    // strainer during strain
    if (sp > 0 && sp < 1) {
      const sa = smooth(0, 0.1, sp) * (1 - smooth(0.92, 1, sp));
      c.save(); c.globalAlpha *= sa; c.translate(0, (1 - easeOutCubic(smooth(0, 0.14, sp))) * -140); drawStrainer(c); c.restore();
    }
    c.restore();

    // strain stream in world space
    if (pourFrac > 0 && pourFrac < 1 && sp > 0.28 && sp < 0.84) {
      const sa = smooth(0.28, 0.33, sp) * (1 - smooth(0.80, 0.84, sp));
      const spout = base.transformPoint(new DOMPoint(G.topHalf + 10, -G.h - 8));
      const rk = L.rocks;
      const rLevel = 0.60 * Math.pow(pourFrac, 0.85);
      const targetY = rk.y + (RG.inBot - rLevel * (RG.h + RG.inBot) * 0.98) * rk.s;
      drawStream(c, spout.x / dpr, spout.y / dpr, rk.x + 6 * rk.s, targetY, ms.color, 9, sa);
    }
  }

  /* ------------------------------------------------------------ pour / dash props in world space */
  function drawPourProps(c, t, L, ms) {
    const m = L.mix; if (m.alpha <= 0) return;
    const G = MG;
    const levelFrac = 0.62 * Math.pow(clamp(ms.vol / TOTAL_OZ, 0, 1), 0.9);
    const surfaceY = m.y + (G.inBot - levelFrac * (G.h + G.inBot) * 0.98) * m.s;
    const rimY = m.y - G.h * m.s;

    for (const s of steps) {
      const p = (t - s.at) / s.dur; if (p < 0 || p > 1) continue;
      const color = COL[s.color];
      if (s.kind === "pour") {
        const enter = easeOutBack(smooth(0.0, 0.2, p)), exit = easeInCubic(smooth(0.86, 1, p));
        const tiltP = smooth(0.18, 0.32, p) * (1 - smooth(0.78, 0.9, p));
        const pouring = smooth(0.30, 0.34, p) * (1 - smooth(0.76, 0.80, p));
        const mouthX = m.x - 150 + 60 * tiltP, mouthY = rimY - 190 + 70 * tiltP;
        const offX = -420 * (1 - enter) - 360 * exit, offY = -200 * (1 - enter) - 120 * exit;
        // stream drawn under the bottle
        if (pouring > 0) {
          const wobble = Math.sin(t * 9) * 2;
          drawStream(c, mouthX + offX + 10, mouthY + offY + 6, m.x + 12 + wobble, surfaceY, color, 8, pouring);
          drawRipples(c, m.x + 10, surfaceY, G.inTopHalf * 0.75 * m.s, G.ry * 0.9, (t * 1.7) % 1, pouring * 0.9);
        }
        c.save(); c.translate(mouthX + offX, mouthY + offY);
        c.rotate(lerp(Math.PI * 0.55, Math.PI * 0.80, tiltP)); // body up-left, mouth toward the glass
        drawBottle(c, color, s.label, false);
        c.restore();
      }
      if (s.kind === "dash") {
        const enter = easeOutBack(smooth(0.0, 0.2, p)), exit = easeInCubic(smooth(0.84, 1, p));
        const bx = m.x - 40, by = rimY - 150;
        const offX = -300 * (1 - enter) - 260 * exit, offY = -220 * (1 - enter) - 140 * exit;
        let flick = 0;
        for (let i = 0; i < s.dashes; i++) {
          const f = dashFlickP(i, s);
          const k = (p - f) / 0.14; if (k >= 0 && k <= 1) flick = Math.max(flick, Math.sin(k * Math.PI));
        }
        c.save(); c.translate(bx + offX, by + offY + flick * 46);
        c.rotate(Math.PI * 0.92 + flick * 0.25);
        drawBottle(c, color, s.label.split(" ")[0], true);
        c.restore();
        // drops
        for (let i = 0; i < s.dashes; i++) {
          const f = dashFlickP(i, s), land = dashLandP(i, s);
          if (p < f + 0.03 || p > land + 0.25) continue;
          const u = clamp((p - (f + 0.03)) / (land - (f + 0.03)), 0, 1);
          const x0 = bx + 4, y0 = by + 30;
          const dropY = lerp(y0, surfaceY, u * u);
          if (u < 1) {
            c.save(); c.translate(x0 + 12 * u, dropY);
            c.beginPath(); c.moveTo(0, -11); c.quadraticCurveTo(6, -2, 0, 7); c.quadraticCurveTo(-6, -2, 0, -11);
            c.fillStyle = rgba(color, 0.95); c.fill(); c.restore();
          } else {
            const rp = clamp((p - land) / 0.25, 0, 1);
            drawRipples(c, x0 + 12, surfaceY, 46, G.ry * 0.9, rp, 1 - rp);
          }
        }
      }
    }
  }

  /* ------------------------------------------------------------ frame */
  function render(t) {
    t = clamp(t, 0, DUR);
    const L = layout(t);
    const ms = mixState(t);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const focus = t < byId.mixice.at + 0.5 || t >= byId.garnish.at ? L.rocks : { x: L.mix.x, y: L.mix.y, s: 1.0 };
    drawBackground(ctx, t, focus);
    // vessels: rocks glass behind the mixing glass while the mixing glass is in front
    drawRocksGlass(ctx, t, L, ms);
    drawMixingGlass(ctx, t, L, ms);
    drawPourProps(ctx, t, L, ms);
    drawTitleCard(ctx, t);
    drawStepLabel(ctx, t);
    drawHeroText(ctx, t);
    // step counter
    if (t >= byId.leaf.at && t < byId.hero.at) {
      const i = buildSteps.findIndex(s => t >= s.at && t < s.at + s.dur);
      if (i >= 0) text(ctx, `${String(i + 1).padStart(2, "0")} / ${String(buildSteps.length).padStart(2, "0")}`, W - 72, 92, "500 18px Inter, sans-serif", MUTED, "right", "alphabetic", "0.1em");
    }
    text(ctx, R.glass.toUpperCase() + "  ·  " + R.garnish.toUpperCase(), 72, 92, "600 15px Inter, sans-serif", "rgba(243,233,216,0.42)", "left", "alphabetic", "0.2em");
  }

  /* ------------------------------------------------------------ player */
  const params = new URLSearchParams(location.search);
  const CAPTURE = params.get("capture") === "1";
  let playing = false, t0 = 0, tStart = 0, current = 0, raf = 0;

  const ui = {
    play: document.getElementById("play"), restart: document.getElementById("restart"),
    scrub: document.getElementById("scrub"), time: document.getElementById("time"), bar: document.getElementById("controls")
  };

  function show(t) { current = clamp(t, 0, DUR); render(current); if (ui.scrub) { ui.scrub.value = current; ui.time.textContent = current.toFixed(2) + " s"; } }
  function frame(now) {
    const t = tStart + (now - t0) / 1000;
    if (t >= DUR) { show(DUR); playing = false; ui.play.textContent = "Play"; ui.play.setAttribute("aria-pressed", "false"); return; }
    show(t); raf = requestAnimationFrame(frame);
  }
  function play() { if (current >= DUR) current = 0; playing = true; tStart = current; t0 = performance.now(); ui.play.textContent = "Pause"; ui.play.setAttribute("aria-pressed", "true"); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
  function pause() { playing = false; cancelAnimationFrame(raf); ui.play.textContent = "Play"; ui.play.setAttribute("aria-pressed", "false"); }
  function restart() { pause(); show(0); play(); }

  if (!CAPTURE && ui.play) {
    ui.play.addEventListener("click", () => playing ? pause() : play());
    ui.restart.addEventListener("click", restart);
    ui.scrub.addEventListener("input", () => { pause(); show(parseFloat(ui.scrub.value)); });
    window.addEventListener("keydown", e => { if (e.code === "Space") { e.preventDefault(); playing ? pause() : play(); } if (e.key === "r" || e.key === "R") restart(); });
  }

  // Public API for capture tooling
  window.renderAt = function (t) { show(t); return current; };
  window.__ready = false;

  async function boot() {
    resize(CAPTURE ? 1 : undefined);
    try { await document.fonts.load("900 80px 'Playfair Display'"); await document.fonts.load("italic 400 40px 'Playfair Display'"); await document.fonts.load("700 54px 'Playfair Display'"); await document.fonts.load("600 18px Inter"); await document.fonts.load("500 40px Inter"); await document.fonts.load("400 24px Inter"); await document.fonts.ready; } catch (e) { /* fall back to system fonts */ }
    if (CAPTURE) { document.body.classList.add("capture"); const t = parseFloat(params.get("t") || "0"); show(isFinite(t) ? t : 0); }
    else { show(0); if (params.get("autoplay") !== "0") play(); }
    window.__ready = true;
  }
  window.addEventListener("resize", () => { if (!CAPTURE) { resize(); show(current); } });
  boot();
})();
