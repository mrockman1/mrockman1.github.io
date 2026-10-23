/*
 * Illustrative conductance-voltage (Boltzmann) curve for the BK section.
 * Midpoint and slope are adjustable placeholders, not fitted to measured data.
 * Self-contained: remove this file and the .gv markup to take it out.
 */
(function () {
  var v12 = document.getElementById('gv-v12');
  if (!v12) return;

  var k = document.getElementById('gv-k');
  var v12Out = document.getElementById('gv-v12-out');
  var kOut = document.getElementById('gv-k-out');
  var plot = document.getElementById('gv-plot');
  var reset = document.getElementById('gv-reset');

  var L = 16, R = 312, T = 12, B = 176;
  var V0 = -100, V1 = 60;
  var START = { v12: -20, k: 7 };

  var xs = function (v) { return L + ((v - V0) / (V1 - V0)) * (R - L); };
  var ys = function (g) { return B - g * (B - T); };

  var curve = function (mid, slope) {
    var d = '';
    for (var v = V0; v <= V1; v += 1) {
      var g = 1 / (1 + Math.exp((mid - v) / slope));
      d += (d ? 'L' : 'M') + xs(v).toFixed(1) + ' ' + ys(g).toFixed(1);
    }
    return d;
  };

  var draw = function () {
    var mid = Number(v12.value);
    var slope = Number(k.value);
    v12Out.textContent = mid + ' mV';
    kOut.textContent = slope + ' mV';
    plot.innerHTML =
      '<path class="ep-ref-line" d="' + curve(START.v12, START.k) + '"/>' +
      '<path class="ep-sel-line" d="' + curve(mid, slope) + '"/>';
  };

  v12.addEventListener('input', draw);
  k.addEventListener('input', draw);
  reset.addEventListener('click', function () {
    v12.value = START.v12;
    k.value = START.k;
    draw();
    v12.focus();
  });

  draw();
})();
