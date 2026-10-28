'use strict';
var cv = document.getElementById('c'), g = cv.getContext('2d');
var QS = [{n:'Low',s:.5,d:70,f:30},{n:'Med',s:.75,d:110,f:45},{n:'High',s:1,d:170,f:60}];
var WXN = ['Clear','Fog','Rain'];
var SKY = [['#3f86d6','#bfe3ff'],['#9aa5ad','#cfd5d9'],['#4b5663','#8a94a3']];
var MT = ['#6f93b8','#aab3ba','#68737f'];
var GRS = [['#2e8b34','#287d2d'],['#4e7f50','#487a4a'],['#2a5e30','#25552b']];
var FC = ['191,227,255','207,213,217','138,148,163'];
var FA = [.18,.85,.45];
var qi = 1, wx = 0, W = 0, H = 0;
try { var t0 = localStorage.getItem('kq'); if (t0 !== null) qi = Math.min(2, Math.max(0, +t0 || 0)); } catch (e) {}
function rs() { var s = QS[qi].s; W = cv.width = Math.max(320, Math.round(innerWidth * s)); H = cv.height = Math.max(200, Math.round(innerHeight * s)); }
addEventListener('resize', rs); rs();

var N = 1200, SL = 200, RW = 2000, CH = 1000, D = 0.84, TAU = Math.PI * 2;
var segs = [];
for (var i = 0; i < N; i++) {
  segs.push({ y: Math.sin(i * TAU * 5 / N) * 650 + Math.sin(i * TAU * 13 / N) * 160,
              c: Math.sin(i * TAU * 7 / N) * 3 + Math.sin(i * TAU * 3 / N) * 1.5 });
}
var pos = 0, v = 0, px = 0, steer = 0, dist = 0, mL = 0, mR = 0, bgx = 0, rpmS = 800, gear = 0, gasOn = false;
var keys = {};
function clamp(a, lo, hi) { return Math.min(hi, Math.max(lo, a)); }

// ---------- input ----------
document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
Array.prototype.forEach.call(document.querySelectorAll('[data-k]'), function (el) {
  var k = el.getAttribute('data-k');
  el.addEventListener('pointerdown', function (e) { e.preventDefault(); keys[k] = true; audio(); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (n) {
    el.addEventListener(n, function (e) { e.preventDefault(); keys[k] = false; });
  });
});
addEventListener('keydown', function (e) { keys[e.key] = true; audio(); if (e.key === ' ' || e.key.indexOf('Arrow') === 0) e.preventDefault(); });
addEventListener('keyup', function (e) { keys[e.key] = false; });
Array.prototype.forEach.call(document.querySelectorAll('[data-m]'), function (el) {
  el.addEventListener('click', function () {
    var m = el.getAttribute('data-m'), d = m.charAt(1) === '-' ? -.15 : .15;
    if (m.charAt(0) === 'L') mL = clamp(mL + d, -1, 1); else mR = clamp(mR + d, -1, 1);
  });
});
var qb = document.getElementById('Q'), wb = document.getElementById('W');
function labels() { qb.textContent = QS[qi].n; wb.textContent = WXN[wx]; }
qb.addEventListener('click', function () {
  qi = (qi + 1) % 3; try { localStorage.setItem('kq', String(qi)); } catch (e) {} rs(); labels();
});
wb.addEventListener('click', function () { wx = (wx + 1) % 3; labels(); });
labels();

// ---------- engine sound ----------
var ac = null, osc, osc2, flt, gn;
function audio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    osc = ac.createOscillator(); osc.type = 'sawtooth';
    osc2 = ac.createOscillator(); osc2.type = 'square';
    flt = ac.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 400;
    gn = ac.createGain(); gn.gain.value = .1;
    osc.connect(flt); osc2.connect(flt); flt.connect(gn); gn.connect(ac.destination);
    osc.start(); osc2.start();
  } catch (e) { ac = null; }
}

// ---------- update ----------
function update(dt) {
  var gas = keys.gas || keys.ArrowUp || keys.w || keys.W;
  var br = keys.brake || keys.ArrowDown || keys.s || keys.S || keys[' '];
  var lf = keys.left || keys.ArrowLeft || keys.a || keys.A;
  var rt = keys.right || keys.ArrowRight || keys.d || keys.D;
  gasOn = !!gas;
  steer += (((rt ? 1 : 0) - (lf ? 1 : 0)) - steer) * Math.min(1, dt * 6);
  if (gas) v += dt * 22 * (1 - v / 100);
  if (br) v -= dt * 55;
  if (!gas) v -= dt * (2 + v * .02);
  var s = segs[Math.floor(pos / SL) % N], sp = v / 100;
  var grip = wx === 2 ? .8 : 1;
  px += steer * dt * 2.4 * sp * grip - dt * 2.4 * sp * sp * s.c * .45;
  px = clamp(px, -2.4, 2.4);
  if (Math.abs(px) > 1.1 && v > 25) v -= dt * (20 + v * .5);
  v = clamp(v, 0, 100);
  pos += v * 40 * dt;
  if (pos >= N * SL) pos -= N * SL;
  dist += v / 3600 * dt;
  bgx += s.c * v * dt * .6;
  gear = v < 1 ? 0 : Math.min(6, 1 + Math.floor(v / 17));
  var frac = gear === 0 ? 0 : Math.min(1, (v - (gear - 1) * 17) / 17);
  var rpm = 700 + frac * 1300 + (gas ? 150 : 0);
  rpmS += (rpm - rpmS) * Math.min(1, dt * 8);
  if (ac) {
    var tt = ac.currentTime;
    osc.frequency.setTargetAtTime(rpmS / 60 * 3, tt, .05);
    osc2.frequency.setTargetAtTime(rpmS / 60 * 1.5, tt, .05);
    flt.frequency.setTargetAtTime(220 + rpmS * .25, tt, .05);
    gn.gain.setTargetAtTime(.07 + (gas ? .07 : 0) + v * .0004, tt, .1);
  }
}

// ---------- render ----------
function poly(a, b, c, d, e, f, h, i, col) {
  g.fillStyle = col; g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.lineTo(e, f); g.lineTo(h, i); g.closePath(); g.fill();
}
function mirror(x, y, w, h, ang) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  var gr = g.createLinearGradient(0, y, 0, y + h * .5);
  gr.addColorStop(0, SKY[wx][0]); gr.addColorStop(1, SKY[wx][1]);
  g.fillStyle = gr; g.fillRect(x, y, w, h * .5);
  g.fillStyle = GRS[wx][0]; g.fillRect(x, y + h * .5, w, h * .5);
  var vx = x + w / 2 + ang * w * .6 - steer * w * .15, vy = y + h * .5, bc = x + w / 2 + ang * w * .2;
  g.fillStyle = '#55555a'; g.beginPath();
  g.moveTo(vx - w * .015, vy); g.lineTo(vx + w * .015, vy); g.lineTo(bc + w * .7, y + h); g.lineTo(bc - w * .7, y + h);
  g.closePath(); g.fill();
  var ph = (pos / 400) % 1;
  g.fillStyle = '#eee';
  for (var k = 0; k < 5; k++) {
    var u = ((k - ph) / 5 + 1) % 1, t = u * u;
    var cx = vx + (bc - vx) * t, yy = vy + (y + h - vy) * t, hw = 1 + w * .012 * t, hh = 1 + h * .06 * t;
    g.fillRect(cx - hw, yy, hw * 2, hh);
  }
  g.restore();
  g.strokeStyle = '#1b1b1b'; g.lineWidth = Math.max(2, W * .005); g.strokeRect(x, y, w, h);
}
function truck(t) {
  var cx = W / 2 + steer * W * .012, tw = W * .2, th = H * .2, by = H * .94 + Math.sin(t * .03) * v * .004 * H * .01;
  g.save(); g.translate(cx, by); g.rotate(steer * .025);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(-tw * .55, -4, tw * 1.1, 10);
  g.fillStyle = '#111';
  g.fillRect(-tw * .5, -th * .3, tw * .12, th * .3); g.fillRect(-tw * .38, -th * .3, tw * .1, th * .3);
  g.fillRect(tw * .38, -th * .3, tw * .1, th * .3); g.fillRect(tw * .26, -th * .3, tw * .12, th * .3);
  g.fillStyle = '#e8e8ea'; g.fillRect(-tw / 2, -th, tw, th * .72);
  g.fillStyle = '#c62828'; g.fillRect(-tw / 2, -th * .62, tw, th * .08);
  g.fillStyle = '#222'; g.fillRect(-tw / 2, -th * .28, tw, th * .1);
  g.fillStyle = '#ff3b30'; g.fillRect(-tw * .48, -th * .5, tw * .07, th * .1); g.fillRect(tw * .41, -th * .5, tw * .07, th * .1);
  if (br2()) { g.fillStyle = '#ff7b72'; g.fillRect(-tw * .48, -th * .5, tw * .07, th * .1); g.fillRect(tw * .41, -th * .5, tw * .07, th * .1); }
  g.fillStyle = '#c62828'; g.font = 'bold ' + Math.round(tw * .18) + 'px sans-serif'; g.textAlign = 'center';
  g.fillText('KASH', 0, -th * .75);
  g.restore();
}
function br2() { return !!(keys.brake || keys.ArrowDown || keys.s || keys.S || keys[' ']); }

function render(t) {
  var hz = H / 2, i, n;
  var gr = g.createLinearGradient(0, 0, 0, hz); gr.addColorStop(0, SKY[wx][0]); gr.addColorStop(1, SKY[wx][1]);
  g.fillStyle = gr; g.fillRect(0, 0, W, hz + 1);
  g.fillStyle = MT[wx]; g.beginPath(); g.moveTo(0, hz);
  for (var x0 = 0; x0 <= W + 1; x0 += W / 40) {
    var u = x0 / W * 6 + bgx * .004;
    g.lineTo(x0, hz - H * (.06 + .03 * Math.sin(u) + .02 * Math.sin(u * 2.3 + 1)));
  }
  g.lineTo(W, hz); g.closePath(); g.fill();
  g.fillStyle = GRS[wx][0]; g.fillRect(0, hz, W, H - hz);

  var bi = Math.floor(pos / SL), bp = (pos % SL) / SL, b = segs[bi % N], b1 = segs[(bi + 1) % N];
  var cy = b.y + (b1.y - b.y) * bp + CH, cxw = px * RW;
  var x = 0, dx = -b.c * bp, maxy = H, DD = QS[qi].d;
  for (n = 0; n < DD; n++) {
    var idx = bi + n, s = segs[idx % N], s2 = segs[(idx + 1) % N];
    var z1 = idx * SL - pos, z2 = z1 + SL;
    var sc1 = D / Math.max(z1, 1), sc2 = D / z2;
    var X1 = W / 2 + sc1 * (x - cxw) * W / 2, Y1 = Math.round(H / 2 - sc1 * (s.y - cy) * H / 2), W1 = sc1 * RW * W / 2;
    var X2 = W / 2 + sc2 * (x + dx - cxw) * W / 2, Y2 = Math.round(H / 2 - sc2 * (s2.y - cy) * H / 2), W2 = sc2 * RW * W / 2;
    x += dx; dx += s.c;
    if (z1 <= 1 || Y2 >= Y1 || Y2 >= maxy) continue;
    var alt = ((idx / 3) | 0) % 2;
    g.fillStyle = GRS[wx][alt]; g.fillRect(0, Y2, W, Y1 - Y2 + 1);
    var r1 = W1 / 6, r2 = W2 / 6, rc = alt ? '#c62828' : '#eeeeee';
    poly(X1 - W1 - r1, Y1, X1 - W1, Y1, X2 - W2, Y2, X2 - W2 - r2, Y2, rc);
    poly(X1 + W1, Y1, X1 + W1 + r1, Y1, X2 + W2 + r2, Y2, X2 + W2, Y2, rc);
    poly(X1 - W1, Y1, X1 + W1, Y1, X2 + W2, Y2, X2 - W2, Y2, alt ? '#59595e' : '#55555a');
    if (alt) { var l1 = W1 / 28, l2 = W2 / 28; poly(X1 - l1, Y1, X1 + l1, Y1, X2 + l2, Y2, X2 - l2, Y2, '#f2f2f2'); }
    maxy = Y1;
  }
  var fc = FC[wx], fg = g.createLinearGradient(0, H * .3, 0, H * .8);
  fg.addColorStop(0, 'rgba(' + fc + ',0)'); fg.addColorStop(.4, 'rgba(' + fc + ',' + FA[wx] + ')'); fg.addColorStop(1, 'rgba(' + fc + ',0)');
  g.fillStyle = fg; g.fillRect(0, H * .3, W, H * .5);
  if (wx === 2) {
    g.strokeStyle = 'rgba(200,210,230,.5)'; g.lineWidth = 1; g.beginPath();
    var drops = QS[qi].d > 100 ? 90 : 45;
    for (i = 0; i < drops; i++) { var rx = Math.random() * W, ry = Math.random() * H; g.moveTo(rx, ry); g.lineTo(rx - 4, ry + 14); }
    g.stroke();
  }
  truck(t);
  // steering wheel
  var wr = H * .09; g.save(); g.translate(W * .115, H * .6); g.rotate(steer * 1.2);
  g.strokeStyle = '#1d1d1d'; g.lineWidth = wr * .25; g.beginPath(); g.arc(0, 0, wr, 0, TAU); g.stroke();
  g.lineWidth = wr * .15; g.beginPath(); g.moveTo(-wr, 0); g.lineTo(wr, 0); g.moveTo(0, 0); g.lineTo(0, wr); g.stroke(); g.restore();
  mirror(W * .02, H * .02, W * .2, H * .16, mL);
  mirror(W * .78, H * .02, W * .2, H * .16, mR);
  g.textAlign = 'center'; g.shadowColor = '#000'; g.shadowBlur = 4; g.fillStyle = '#fff';
  g.font = 'bold ' + Math.round(H * .075) + 'px sans-serif'; g.fillText(String(Math.round(v)), W / 2, H * .1);
  g.font = Math.round(H * .033) + 'px sans-serif';
  g.fillText('km/h   ' + (gear ? 'Gear ' + gear : 'N') + '   ' + Math.round(rpmS) + ' rpm   ' + dist.toFixed(1) + ' km', W / 2, H * .145);
  if (v < 1 && !ac) g.fillText('Hold Gas to drive', W / 2, H * .45);
  g.shadowBlur = 0;
}

var last = 0;
function frame(t) {
  requestAnimationFrame(frame);
  if (t - last < 1000 / QS[qi].f - 2) return;
  var dt = Math.min(.05, (t - last) / 1000 || .016); last = t;
  update(dt); render(t);
}
requestAnimationFrame(frame);
