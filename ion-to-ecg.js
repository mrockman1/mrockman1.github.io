/*
 * From Ion Channels to the ECG: schematic, educational visualization.
 * Action-potential and ECG shapes are hand-built illustrations, not outputs of a
 * validated ventricular myocyte model or a tissue-level ECG simulation.
 * Self-contained: remove this file and the module markup to take it out.
 */
(function () {
  var slider = document.getElementById('ep-slider');
  if (!slider) return;

  var out = document.getElementById('ep-value');
  var resetBtn = document.getElementById('ep-reset');
  var apSvg = document.getElementById('ep-ap');
  var ecgSvg = document.getElementById('ep-ecg');
  var textEl = document.getElementById('ep-text');

  // Plot box (SVG viewBox units: 320 x 200)
  var L = 12, R = 312, T = 12, B = 180;

  var sig = function (x) { return 1 / (1 + Math.exp(-x)); };

  // Relative IKr conductance (percent) -> time scale. 100% is the reference.
  // Lower IKr stretches repolarization; higher IKr shortens it. Qualitative only.
  var factor = function (g) { return Math.exp(-0.5 * (g / 100 - 1)); };

  // Schematic ventricular action potential (ms, mV). Starts before the upstroke
  // so the resting baseline is visible.
  var V_REST = -88;
  var AP_T0 = -40, AP_T1 = 300;
  var plateau = function (t) {
    if (t < 3) return 30;
    if (t < 12) return 30 - (t - 3) * 2.2;
    return 10 - 0.01 * (t - 12);
  };
  var apVoltage = function (t, g) {
    var f = factor(g);
    var tr = 120 * f;
    var gate = sig((t - 1) / 0.8) * (1 - sig((t - tr) / (12 * f)));
    return V_REST + (plateau(t) - V_REST) * gate;
  };

  // Schematic surface ECG (ms, arbitrary amplitude). QRS width is held constant.
  var gauss = function (x, c, s) { return Math.exp(-Math.pow((x - c) / s, 2)); };
  var tPeak = function (g) { return 170 + 140 * factor(g); };
  var tWidth = function (g) { return 22 * Math.sqrt(factor(g)); };
  var ecgVoltage = function (t, g) {
    return 0.12 * gauss(t, 50, 10)
      - 0.1 * gauss(t, 160, 3)
      + 1.0 * gauss(t, 170, 3.5)
      - 0.25 * gauss(t, 180, 3.5)
      + 0.3 * gauss(t, tPeak(g), tWidth(g));
  };

  var apX = function (t) { return L + ((t - AP_T0) / (AP_T1 - AP_T0)) * (R - L); };
  var apY = function (v) { return B - ((v + 100) / 150) * (B - T); };
  var ecgX = function (t) { return L + (t / 600) * (R - L); };
  var ecgY = function (a) { return 120 - a * 85; };

  var toPath = function (fn, t0, t1, step, xs, ys) {
    var d = '';
    for (var t = t0; t <= t1; t += step) {
      d += (d ? 'L' : 'M') + xs(t).toFixed(1) + ' ' + ys(fn(t)).toFixed(1);
    }
    return d;
  };

  var drawAP = function (g) {
    var ref = toPath(function (t) { return apVoltage(t, 100); }, AP_T0, AP_T1, 1, apX, apY);
    var sel = toPath(function (t) { return apVoltage(t, g); }, AP_T0, AP_T1, 1, apX, apY);
    apSvg.innerHTML =
      '<path class="ep-ref-line" d="' + ref + '"/>' +
      '<path class="ep-sel-line" d="' + sel + '"/>';
  };

  var drawECG = function (g) {
    var ref = toPath(function (t) { return ecgVoltage(t, 100); }, 0, 600, 2, ecgX, ecgY);
    var sel = toPath(function (t) { return ecgVoltage(t, g); }, 0, 600, 2, ecgX, ecgY);
    var label = function (text, t, amp, dy) {
      return '<text class="ep-wave-label" x="' + ecgX(t).toFixed(1) + '" y="' + (ecgY(amp) + dy).toFixed(1) + '" text-anchor="middle">' + text + '</text>';
    };
    ecgSvg.innerHTML =
      '<path class="ep-ref-line" d="' + ref + '"/>' +
      '<path class="ep-sel-line" d="' + sel + '"/>' +
      label('P', 50, 0.12, -7) +
      label('Q', 160, -0.1, 13) +
      label('R', 170, 1.0, -7) +
      label('S', 180, -0.25, 13) +
      label('T', tPeak(g), 0.3, -7);
  };

  var clinicalText = function (g) {
    if (g === 100) return 'Normal reference IKr supports ventricular repolarization.';
    if (g > 100) return 'Enhanced IKr may accelerate ventricular repolarization and shorten action-potential duration.';
    if (g >= 60) return 'Reduced IKr may prolong ventricular repolarization and the QT interval.';
    return 'Decreased hERG (IKr) function leads to longer repolarization and increases susceptibility to arrhythmia.';
  };

  var update = function () {
    var g = Number(slider.value);
    out.textContent = g + '%';
    drawAP(g);
    drawECG(g);
    textEl.textContent = clinicalText(g);
  };

  slider.addEventListener('input', update);
  resetBtn.addEventListener('click', function () {
    slider.value = 100;
    update();
    slider.focus();
  });

  update();
})();
