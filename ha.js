/*
 * Horrigan–Aldrich (dual-allosteric) steady-state model of BK-channel gating.
 * Equation as published (Rockman et al., JGP 2020; dissertation Eq. 3.1):
 *   Po = 1 / [1 + (1 + J + K + J*K*E)^4 / (L * (1 + K*C + J*D + J*K*C*D*E)^4)]
 *   J = J0 * exp(zJ * e0 * V / (kB * T)),  K = [Ca]/KD,
 *   L = L0 * exp(s * zL * e0 * V / (kB * T)),  s = +1 (working convention) or -1 (printed).
 * V in volts, T = 295.15 K (22 C recording temperature; fitting temperature unconfirmed).
 * Self-contained: remove this file and the #ha-module markup to take it out.
 */
(function (global) {
  var kB = 1.380649e-23, e0 = 1.602176634e-19, T = 295.15;
  var thermal = kB * T / e0; // volts

  var PRESETS = {
    A: { J0: 0.08, KD: 41, L0: 2.8e-6, zJ: 0.30, zL: 0.57, C: 2.5, D: 29, E: 20 },
    B: { J0: 0.06, KD: 17, L0: 1.0e-5, zJ: 0.41, zL: 0.58, C: 17, D: 16, E: 1.1 }
  };
  var CA = [0, 1, 10, 100];
  var V_MIN = -200, V_MAX = 250, V_STEP = 2;

  // Steady-state open probability, computed in log space for numerical stability.
  function logsumexp(xs) {
    var m = -Infinity;
    for (var i = 0; i < xs.length; i++) if (xs[i] > m) m = xs[i];
    if (m === -Infinity) return -Infinity;
    var s = 0;
    for (var j = 0; j < xs.length; j++) s += Math.exp(xs[j] - m);
    return m + Math.log(s);
  }

  function po(Vmv, Ca, p, s) {
    var V = Vmv / 1000;
    var lJ = Math.log(p.J0) + p.zJ * V / thermal;
    var lL = Math.log(p.L0) + s * p.zL * V / thermal;
    var lK = Ca === 0 ? -Infinity : Math.log(Ca / p.KD);
    var lE = Math.log(p.E), lC = Math.log(p.C), lD = Math.log(p.D);
    // log(1 + J + K + J K E)
    var a = logsumexp([0, lJ, lK, lJ + lK + lE]);
    // log(1 + K C + J D + J K C D E)
    var b = logsumexp([0, lK + lC, lJ + lD, lJ + lK + lC + lD + lE]);
    // Po = Zo / (Zc + Zo) with Zc = a'^4 and Zo = L b'^4
    var x = lL + 4 * b - 4 * a; // log(Zo/Zc)
    return x >= 0 ? 1 / (1 + Math.exp(-x)) : Math.exp(x) / (1 + Math.exp(x));
  }

  // Half-activation voltage, only where the curve really crosses 0.5 in the plotted range.
  function v12(Ca, p, s) {
    var f = function (v) { return po(v, Ca, p, s) - 0.5; };
    var lo = V_MIN, hi = V_MAX;
    var flo = f(lo), fhi = f(hi);
    if (!isFinite(flo) || !isFinite(fhi) || flo * fhi > 0) return null;
    for (var i = 0; i < 80; i++) {
      var m = (lo + hi) / 2, fm = f(m);
      if (flo * fm <= 0) { hi = m; fhi = fm; } else { lo = m; flo = fm; }
    }
    return (lo + hi) / 2;
  }

  function curve(Ca, p, s) {
    var pts = [];
    for (var v = V_MIN; v <= V_MAX; v += V_STEP) pts.push([v, po(v, Ca, p, s)]);
    return pts;
  }

  global.BKHA = {
    PRESETS: PRESETS, CA: CA, V_MIN: V_MIN, V_MAX: V_MAX,
    po: po, v12: v12, curve: curve, thermal: thermal, T: T
  };

  // ---------- UI ----------
  var root = document.getElementById('ha-module');
  if (!root) return;

  var NS = 'http://www.w3.org/2000/svg';
  var fitSel = document.getElementById('ha-fit');
  var resetBtn = document.getElementById('ha-reset');
  var plot = document.getElementById('ha-plot');
  var sliders = {
    J0: { id: 'ha-J0', log: true, min: -3, max: 1, fmt: function (x) { return x.toExponential(2); } },
    zJ: { id: 'ha-zJ', log: false, min: 0, max: 1.5, step: 0.01, fmt: function (x) { return x.toFixed(2); } },
    L0: { id: 'ha-L0', log: true, min: -8, max: -2, fmt: function (x) { return x.toExponential(2); } },
    zL: { id: 'ha-zL', log: false, min: 0, max: 1.5, step: 0.01, fmt: function (x) { return x.toFixed(2); } },
    KD: { id: 'ha-KD', log: true, min: 0, max: 3, fmt: function (x) { return x.toFixed(1) + ' µM'; } },
    C: { id: 'ha-C', log: true, min: -1, max: 2, fmt: function (x) { return x.toFixed(2); } },
    D: { id: 'ha-D', log: true, min: -1, max: 2.5, fmt: function (x) { return x.toFixed(2); } },
    E: { id: 'ha-E', log: true, min: -1, max: 2, fmt: function (x) { return x.toFixed(2); } }
  };

  // Working state holds exact values. Sliders only display them, so Reset is exact.
  var state = {};
  Object.keys(PRESETS.A).forEach(function (k) { state[k] = PRESETS.A[k]; });

  function sliderValue(key, value) {
    return sliders[key].log ? Math.log10(value) : value;
  }
  function valueFromSlider(key, raw) {
    return sliders[key].log ? Math.pow(10, raw) : raw;
  }

  function setSlidersFrom(p) {
    Object.keys(sliders).forEach(function (k) {
      var el = document.getElementById(sliders[k].id);
      el.min = sliders[k].min;
      el.max = sliders[k].max;
      el.value = sliderValue(k, p[k]);
      document.getElementById(sliders[k].id + '-out').textContent = sliders[k].fmt(p[k]);
    });
  }

  function svgEl(tag, attrs) {
    var e = document.createElementNS(NS, tag);
    Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }

  var COLORS = ['#dc2626', '#d97706', '#059669', '#2563eb'];
  var W = 320, H = 230, L = 44, R = 312, TOP = 10, BOT = 200;
  var xs = function (v) { return L + (v - V_MIN) / (V_MAX - V_MIN) * (R - L); };
  var ys = function (p) { return BOT - p * (BOT - TOP); };

  function drawPlot(published, modified, sign) {
    while (plot.firstChild) plot.removeChild(plot.firstChild);
    // light reference lines only
    [0, 0.5, 1].forEach(function (g) {
      plot.appendChild(svgEl('line', { x1: L, x2: R, y1: ys(g), y2: ys(g), class: "ha-gridline" }));
      var t = svgEl('text', { x: L - 4, y: ys(g) + 3, class: 'ha-tick', 'text-anchor': 'end' });
      t.textContent = g.toFixed(1);
      plot.appendChild(t);
    });
    [-200, -100, 0, 100, 200].forEach(function (v) {
      var t = svgEl('text', { x: xs(v), y: BOT + 13, class: 'ha-tick', 'text-anchor': 'middle' });
      t.textContent = v;
      plot.appendChild(t);
    });
    var lab = svgEl('text', { x: (L + R) / 2, y: H - 2, class: 'ha-tick', 'text-anchor': 'middle' });
    lab.textContent = 'Voltage (mV)';
    plot.appendChild(lab);
    var ylab = svgEl('text', { x: 12, y: (TOP + BOT) / 2, class: 'ha-tick', 'text-anchor': 'middle', transform: 'rotate(-90 12 ' + (TOP + BOT) / 2 + ')' });
    ylab.textContent = 'Conductance';
    plot.appendChild(ylab);

    CA.forEach(function (ca, k) {
      var pubPts = curve(ca, published, sign);
      var modPts = curve(ca, modified, sign);
      var toD = function (pts) {
        return pts.map(function (q, i) { return (i ? 'L' : 'M') + xs(q[0]).toFixed(1) + ' ' + ys(q[1]).toFixed(1); }).join('');
      };
      plot.appendChild(svgEl('path', { d: toD(pubPts), class: 'ha-published', stroke: COLORS[k], fill: 'none' }));
      plot.appendChild(svgEl('path', { d: toD(modPts), class: 'ha-modified', stroke: COLORS[k], fill: 'none' }));
    });
  }


  function update() {
    var sign = 1; // working convention: positive L(V) exponent
    var pub = PRESETS[fitSel.value];
    var mod = state;
    Object.keys(sliders).forEach(function (k) {
      document.getElementById(sliders[k].id + '-out').textContent = sliders[k].fmt(mod[k]);
    });
    drawPlot(pub, mod, sign);
  }

  function resetToPublished() {
    state = {};
    Object.keys(PRESETS[fitSel.value]).forEach(function (k) { state[k] = PRESETS[fitSel.value][k]; });
    setSlidersFrom(state);
    update();
  }

  Object.keys(sliders).forEach(function (k) {
    document.getElementById(sliders[k].id).addEventListener('input', function (e) {
      state[k] = valueFromSlider(k, Number(e.target.value));
      update();
    });
  });
  fitSel.addEventListener('change', resetToPublished);
  resetBtn.addEventListener('click', resetToPublished);

  // ---------- Gating scheme: click or keyboard to show a part's parameters ----------
  // Wording follows the abbreviation table of the dissertation (Dual-Allosteric Model).
  var SCHEME_MAP = { J: ['J0', 'zJ'], K: ['KD'], L: ['L0', 'zL'], C: ['C'], D: ['D'], E: ['E'] };
  var SCHEME_TEXT = {
    J: 'R: Resting state of the voltage-sensor. A: Active state of the voltage-sensor. J: R - A equilibrium constant of the voltage-sensor. zJ: Gating valence of R - A equilibrium constant.',
    K: 'X: Unliganded state of the Ca2+-sensor. XCa2+: Ca2+-bound state of the Ca2+-sensor. KD: Ca2+ dissociation constant of the Ca2+-sensor.',
    L: 'C: Closed state of the pore. O: Open state of the pore. L: C - O equilibrium constant of the pore. zL: Gating valence of C - O equilibrium constant.',
    C: 'C: Allosteric coupling constant, between channel opening and Ca2+-sensor activation.',
    D: 'D: Allosteric coupling constant, between channel opening and voltage-sensor activation.',
    E: 'E: Allosteric coupling constant, between Ca2+-sensor activation and voltage-sensor activation.'
  };
  var parts = document.querySelectorAll('#ha-scheme .ha-part');
  var explain = document.getElementById('ha-explain');
  var allBtn = document.getElementById('ha-all');

  function focusPart(p) {
    parts.forEach(function (g) { g.classList.toggle('active', g.getAttribute('data-p') === p); });
    document.querySelectorAll('.ha-param').forEach(function (row) {
      row.classList.toggle('on', SCHEME_MAP[p].indexOf(row.getAttribute('data-k')) !== -1);
    });
    if (explain) explain.textContent = SCHEME_TEXT[p];
  }

  parts.forEach(function (g) {
    var p = g.getAttribute('data-p');
    g.addEventListener('click', function () { focusPart(p); });
  });

  document.querySelectorAll('#ha-scheme .ha-state').forEach(function (st) {
    st.addEventListener('click', function (e) {
      e.stopPropagation();
      focusPart(st.closest('.ha-part').getAttribute('data-p'));
      if (explain) explain.textContent = st.getAttribute('data-note');
    });
  });

  allBtn.addEventListener('click', function () {
    var on = !root.classList.contains('ha-all');
    root.classList.toggle('ha-all', on);
    allBtn.setAttribute('aria-pressed', String(on));
    allBtn.textContent = on ? 'Hide extra parameters' : 'Show all parameters';
  });

  resetToPublished();
})(window);
