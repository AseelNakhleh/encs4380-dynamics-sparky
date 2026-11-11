"use strict";

/* ENCS4380 — Module 4: Guess the Sensor
 * Standalone JavaScript with no imports or external libraries.
 * All theoretical curves are closed-form (no numerical ODE solver needed).
 * The model is revealed only after a scored submission.
 */

const SVG_NS = "http://www.w3.org/2000/svg";
const PLOT = { width: 820, height: 410, left: 64, right: 25, top: 20, bottom: 49 };
const SAMPLE_COUNT = 401;
const state = { round: null, roundNumber: 0, completed: 0, totalScore: 0, prediction: null, revealed: false, guesses: null, hintOpen: false };
const $ = (id) => document.getElementById(id);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const randomBetween = (lo, hi) => lo + Math.random() * (hi - lo);
const format = (value, digits = 3) => Number(value).toFixed(digits).replace(/\.?0+$/, "") || "0";

function gaussianNoise() {
  // Box-Muller: zero-mean, unit-standard-deviation Gaussian noise.
  const u = Math.max(Math.random(), Number.EPSILON);
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function firstOrderStep(t, k, tau) {
  return k * (1 - Math.exp(-t / tau));
}

function firstOrderSine(t, k, tau, omega) {
  // Steady-state sinusoidal response to x(t) = sin(omega*t).
  const wtau = omega * tau;
  const amplitude = k / Math.sqrt(1 + wtau * wtau);
  const phase = Math.atan(wtau);
  return amplitude * Math.sin(omega * t - phase);
}

function secondOrderStep(t, zeta, wn) {
  // Unit-DC-gain underdamped step response, where 0 < zeta < 1.
  const root = Math.sqrt(1 - zeta * zeta);
  const wd = wn * root;
  return 1 - Math.exp(-zeta * wn * t) * (
    Math.cos(wd * t) + (zeta / root) * Math.sin(wd * t)
  );
}

function modelValue(round, t, p1, p2) {
  if (round.kind === "first" && round.input === "step") return firstOrderStep(t, p1, p2);
  if (round.kind === "first") return firstOrderSine(t, p1, p2, round.omega);
  return secondOrderStep(t, p1, p2);
}

function makeRound() {
  const kind = Math.random() < 0.5 ? "first" : "second";
  let input, parameters, omega = null, duration, noiseSigma;
  if (kind === "first") {
    input = Math.random() < 0.32 ? "sine" : "step";
    parameters = [randomBetween(0.65, 2.0), randomBetween(0.4, 2.4)]; // [K, tau]
    if (input === "sine") {
      omega = randomBetween(1.3, 3.5); // stated angular frequency, rad/s
      duration = 8 * Math.PI / omega;  // four full periods
    } else {
      duration = 6 * parameters[1];   // steady state nearly reached
    }
    noiseSigma = 0.012 * parameters[0];
  } else {
    input = "step";
    parameters = [randomBetween(0.2, 0.8), randomBetween(1.2, 5)]; // [zeta, wn]
    duration = Math.max(9 / parameters[1], 5.5 / (parameters[0] * parameters[1]));
    noiseSigma = 0.014;
  }
  const round = { kind, input, parameters, omega, duration, noiseSigma };
  round.times = Array.from({ length: SAMPLE_COUNT }, (_, i) => (i * duration) / (SAMPLE_COUNT - 1));
  round.trueValues = round.times.map((t) => modelValue(round, t, ...parameters));
  round.measured = round.trueValues.map((v) => v + gaussianNoise() * noiseSigma);
  return round;
}

function svgNode(tag, attrs = {}, textContent = "") {
  const el = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([name, value]) => el.setAttribute(name, String(value)));
  if (textContent !== "") el.textContent = textContent;
  return el;
}

function drawPlot() {
  const svg = $("response-plot");
  svg.replaceChildren();
  const round = state.round;
  const compact = window.innerWidth <= 620;
  const { left, right, top, bottom, width, height } = compact
    ? { width: 520, height: 360, left: 60, right: 18, top: 20, bottom: 50 }
    : PLOT;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const tickSize = compact ? 15 : 12;
  const axisSize = compact ? 16 : 13;
  const w = width - left - right, h = height - top - bottom;
  let all = round.measured.slice();
  if (round.input === "sine") all.push(-1, 1); // show unit input too
  if (state.revealed) {
    all.push(...round.trueValues);
    all.push(...round.times.map((t) => modelValue(round, t, ...state.guesses)));
  }
  let minV = Math.min(0, ...all), maxV = Math.max(0, ...all);
  const span = Math.max(0.01, maxV - minV);
  const pad = 0.085 * span;
  minV -= pad; maxV += pad;

  const x = (t) => left + (t / round.duration) * w;
  const y = (v) => top + ((maxV - v) / (maxV - minV)) * h;
  const linePath = (values) => values.map((value, i) => `${i ? "L" : "M"}${x(round.times[i]).toFixed(2)},${y(value).toFixed(2)}`).join(" ");
  const defs = svgNode("defs");
  const clip = svgNode("clipPath", { id: "data-clip" });
  clip.append(svgNode("rect", { x: left, y: top, width: w, height: h }));
  defs.append(clip);
  svg.append(defs);

  const plotBg = svgNode("rect", { x: left, y: top, width: w, height: h, fill: "#101b2c" });
  svg.append(plotBg);
  const grid = svgNode("g", { "aria-hidden": "true" });
  for (let i = 0; i <= 5; i++) {
    const xp = left + (w * i / 5), v = minV + (maxV - minV) * (5 - i) / 5;
    const yp = top + (h * i / 5);
    grid.append(svgNode("line", { x1: xp, y1: top, x2: xp, y2: top + h, stroke: "#27374d", "stroke-width": 1 }));
    grid.append(svgNode("line", { x1: left, y1: yp, x2: left + w, y2: yp, stroke: "#27374d", "stroke-width": 1 }));
    grid.append(svgNode("text", { x: xp, y: top + h + 22, "text-anchor": "middle", fill: "#a4b3c6", "font-size": tickSize }, format(round.duration * i / 5, 2)));
    grid.append(svgNode("text", { x: left - 12, y: yp + 4, "text-anchor": "end", fill: "#a4b3c6", "font-size": tickSize }, format(v, 2)));
  }
  svg.append(grid);
  svg.append(svgNode("text", { x: left + w / 2, y: height - 7, "text-anchor": "middle", "font-size": axisSize, fill: "#b4c5d8", "font-weight": 650 }, "TIME (s)"));
  svg.append(svgNode("text", { x: 17, y: top + h / 2, "text-anchor": "middle", "font-size": axisSize, fill: "#b4c5d8", "font-weight": 650, transform: `rotate(-90,17,${top + h / 2})` }, "OUTPUT y(t)"));

  const plotLines = svgNode("g", { "clip-path": "url(#data-clip)", "aria-hidden": "true" });
  if (round.input === "sine") {
    plotLines.append(svgNode("path", { d: linePath(round.times.map((t) => Math.sin(round.omega * t))), stroke: "#7d8a9e", "stroke-width": 1.8, "stroke-dasharray": "8 7", opacity: 0.72, fill: "none" }));
  }
  plotLines.append(svgNode("path", { d: linePath(round.measured), stroke: "#65ccdf", "stroke-width": 1.9, opacity: state.revealed ? 0.68 : 0.95, fill: "none" }));
  if (state.revealed) {
    const guessed = round.times.map((t) => modelValue(round, t, ...state.guesses));
    plotLines.append(svgNode("path", { d: linePath(guessed), stroke: "#ffb77c", "stroke-width": 3, "stroke-dasharray": "10 7", fill: "none" }));
    plotLines.append(svgNode("path", { d: linePath(round.trueValues), stroke: "#65e2b5", "stroke-width": 3, fill: "none" }));
  }
  svg.append(plotLines);

  // Interactive hover/cursor for both mouse and touch. This does not alter data.
  const cursor = svgNode("g", { visibility: "hidden", "pointer-events": "none" });
  const cursorLine = svgNode("line", { y1: top, y2: top + h, stroke: "#d8eef4", "stroke-width": 1, "stroke-dasharray": "3 5", opacity: 0.65 });
  const cursorDot = svgNode("circle", { r: 5, fill: "#65ccdf", stroke: "#dffcff", "stroke-width": 2 });
  const tipRect = svgNode("rect", { width: 148, height: 47, rx: 7, fill: "#263b53", stroke: "#64819a" });
  const tipTop = svgNode("text", { fill: "#cbd9ea", "font-size": 11, "font-weight": 650 });
  const tipBottom = svgNode("text", { fill: "#a5e5ef", "font-size": 12, "font-weight": 750 });
  cursor.append(cursorLine, cursorDot, tipRect, tipTop, tipBottom);
  svg.append(cursor);
  const area = svgNode("rect", { x: left, y: top, width: w, height: h, fill: "transparent", style: "cursor:crosshair" });
  area.addEventListener("pointermove", (evt) => {
    const rect = svg.getBoundingClientRect();
    const svgX = (evt.clientX - rect.left) * (width / rect.width);
    const index = clamp(Math.round((svgX - left) / w * (SAMPLE_COUNT - 1)), 0, SAMPLE_COUNT - 1);
    const px = x(round.times[index]), py = y(round.measured[index]);
    const tipX = clamp(px + 12, left + 5, left + w - 154);
    const tipY = clamp(py - 57, top + 5, top + h - 53);
    cursor.setAttribute("visibility", "visible");
    cursorLine.setAttribute("x1", px);
    cursorLine.setAttribute("x2", px);
    cursorDot.setAttribute("cx", px);
    cursorDot.setAttribute("cy", py);
    tipRect.setAttribute("x", tipX); tipRect.setAttribute("y", tipY);
    tipTop.setAttribute("x", tipX + 10); tipTop.setAttribute("y", tipY + 18);
    tipBottom.setAttribute("x", tipX + 10); tipBottom.setAttribute("y", tipY + 35);
    tipTop.textContent = `Time: ${format(round.times[index], 3)} s`;
    tipBottom.textContent = `Output: ${format(round.measured[index], 3)}`;
  });
  area.addEventListener("pointerleave", () => cursor.setAttribute("visibility", "hidden"));
  area.addEventListener("pointercancel", () => cursor.setAttribute("visibility", "hidden"));
  svg.append(area);
  $("true-legend").hidden = !state.revealed;
  $("guess-legend").hidden = !state.revealed;
  $("input-legend").hidden = round.input !== "sine";
}

function predictionQuestion(round) {
  if (round.kind === "second") return "Will the peak overshoot exceed 15% of the final value?";
  if (round.input === "sine") return "Will the output phase lag exceed 45°?";
  return "Is the time constant greater than 1.4 seconds?";
}

function predictionTruth(round) {
  if (round.kind === "second") {
    const [zeta] = round.parameters;
    return Math.exp((-Math.PI * zeta) / Math.sqrt(1 - zeta * zeta)) > 0.15;
  }
  if (round.input === "sine") return Math.atan(round.omega * round.parameters[1]) > Math.PI / 4;
  return round.parameters[1] > 1.4;
}

function predictionExplanation(round) {
  if (round.kind === "second") {
    const zeta = round.parameters[0];
    const peakPercent = 100 * Math.exp((-Math.PI * zeta) / Math.sqrt(1 - zeta*zeta));
    return `Actual overshoot: ${format(peakPercent, 1)}%.`;
  }
  if (round.input === "sine") return `Actual phase lag: ${format(Math.atan(round.omega * round.parameters[1]) * 180 / Math.PI, 1)}°.`;
  return `Actual τ: ${format(round.parameters[1], 3)} s.`;
}

function hintText(round) {
  if (round.kind === "second") return "First estimate the peak overshoot fraction Mₚ = (peak − final)/final. Then ζ = −ln(Mₚ) / √(π² + ln²(Mₚ)). From the first peak time tₚ, estimate ωₙ = π / (tₚ √(1 − ζ²)).";
  if (round.input === "sine") return "The grey dashed curve is the input sin(ωt); ω is given. Estimate the output peak amplitude B and time lag Δt. Phase φ = ωΔt, τ = tan(φ)/ω, and K = B√(1 + (ωτ)²). This is a steady-state sine response.";
  return "For a unit step, the final steady-state output is K. The time where y(t) first reaches 0.632K equals τ. Another method: ln[(K − y)/K] versus t is a straight line with slope −1/τ.";
}

function renderRound() {
  const round = state.round;
  const first = round.kind === "first";
  $("round-number").textContent = String(state.roundNumber).padStart(2, "0");
  $("sensor-model").textContent = first ? "First-order sensor" : "Second-order sensor";
  $("sensor-input").textContent = round.input === "sine" ? `Sine · ω = ${format(round.omega, 2)} rad/s` : "Unit step · x(t) = 1";
  $("hidden-tag").innerHTML = '<span class="lock-icon" aria-hidden="true">▣</span> Locked';
  $("hidden-tag").style.color = "";
  $("round-status").textContent = "NOT SUBMITTED";
  $("round-status").classList.remove("scored");
  $("estimate-instruction").textContent = first ? "Estimate the gain and time constant from the curve. Both are hidden until you submit." : "Estimate the damping ratio and natural frequency from the response. The steady-state gain is fixed at 1.";
  $("parameter-one-name").innerHTML = first ? 'Static gain <b>K</b>' : 'Damping ratio <b>ζ</b>';
  $("parameter-one-unit").textContent = "unitless";
  $("parameter-two-name").innerHTML = first ? 'Time constant <b>τ</b>' : 'Natural frequency <b>ωₙ</b>';
  $("parameter-two-unit").textContent = first ? "seconds" : "rad/s";
  $("parameter-one-suffix").textContent = first ? "K" : "ζ";
  $("parameter-two-suffix").textContent = first ? "s" : "rad/s";
  $("parameter-one").value = "";
  $("parameter-two").value = "";
  $("parameter-one").disabled = false;
  $("parameter-two").disabled = false;
  $("parameter-one").max = first ? "100" : "0.99999";
  $("parameter-one").placeholder = first ? "e.g. 1.25" : "e.g. 0.5";
  $("parameter-two").placeholder = first ? "e.g. 0.9" : "e.g. 2.5";
  $("prediction-question").textContent = predictionQuestion(round);
  $("prediction-outcome").textContent = "";
  $("prediction-outcome").className = "prediction-outcome";
  [$("prediction-yes"), $("prediction-no")].forEach((button) => { button.disabled = false; button.classList.remove("selected"); button.setAttribute("aria-pressed", "false"); });
  $("hint-text").textContent = hintText(round);
  $("hint-button").setAttribute("aria-expanded", "false");
  $("hint-chevron").textContent = "+";
  $("hint-panel").hidden = true;
  $("form-error").textContent = "";
  $("submit-button").disabled = false;
  $("submit-button").innerHTML = 'Reveal &amp; score my guess <span aria-hidden="true">↗</span>';
  $("result-panel").hidden = true;
  $("chart-frequency").textContent = round.input === "sine" ? "STEADY-STATE SINE" : "STEP RESPONSE";
  $("chart-description").textContent = round.input === "sine" ? "Grey dashed: known unit sine input. Cyan: noisy steady-state sensor output. Hover or touch the curve for values." : "Noisy output after a unit step. The measurement stays fixed for this round; hover or touch the curve for values.";
  $("total-score").textContent = state.totalScore;
  $("maximum-score").textContent = state.completed * 100;
  $("rounds-completed").textContent = state.completed;
  drawPlot();
}

function newRound() {
  state.round = makeRound();
  state.roundNumber++;
  state.revealed = false;
  state.prediction = null;
  state.guesses = null;
  state.hintOpen = false;
  renderRound();
}

function setPrediction(yesOrNo) {
  if (state.revealed) return;
  state.prediction = yesOrNo;
  $("form-error").textContent = "";
  const yesButton = $("prediction-yes"), noButton = $("prediction-no");
  yesButton.classList.toggle("selected", yesOrNo === true);
  noButton.classList.toggle("selected", yesOrNo === false);
  yesButton.setAttribute("aria-pressed", String(yesOrNo === true));
  noButton.setAttribute("aria-pressed", String(yesOrNo === false));
}

function pointsForError(relativeError) {
  // 50 points per parameter. Full 50 for <= 10%; linear partial
  // credit from >10% to <50% error; zero at >=50% error.
  if (relativeError <= 0.10 + 1e-12) return 50;
  if (relativeError >= 0.50) return 0;
  return 50 * (0.50 - relativeError) / 0.40;
}

function scoreEstimate(guesses, truth) {
  const errors = guesses.map((guess, i) => Math.abs(guess - truth[i]) / truth[i]);
  return { errors, score: Math.round(errors.reduce((sum, error) => sum + pointsForError(error), 0)), perfect: errors.every((error) => error <= 0.10 + 1e-12) };
}

function makeMetric(label, truth, guess, error, unit = "") {
  const container = document.createElement("div");
  container.className = "metric-card";
  const labelDiv = document.createElement("div");
  labelDiv.className = "metric-label";
  labelDiv.textContent = label;
  const valueDiv = document.createElement("div");
  valueDiv.className = "metric-values";
  const actualSpan = document.createElement("strong");
  actualSpan.textContent = `${format(truth, 4)}${unit ? ` ${unit}` : ""}`;
  const guessedSpan = document.createElement("span");
  guessedSpan.textContent = `Your guess: ${format(guess, 4)}${unit ? ` ${unit}` : ""}`;
  valueDiv.append(actualSpan, guessedSpan);
  const errorDiv = document.createElement("div");
  errorDiv.className = `metric-error${error > 0.1 ? " warning" : ""}`;
  errorDiv.textContent = `${format(error * 100, 1)}% relative error · ${error <= 0.1 ? "within target ✓" : "outside 10% target"}`;
  container.append(labelDiv, valueDiv, errorDiv);
  return container;
}

function makeExplanation(round) {
  if (round.kind === "second") {
    const [zeta, wn] = round.parameters;
    const overshoot = Math.exp(-Math.PI*zeta / Math.sqrt(1-zeta*zeta)) * 100;
    const peakTime = Math.PI / (wn * Math.sqrt(1-zeta*zeta));
    return `With ζ = ${format(zeta, 3)}, this underdamped system overshoots by ${format(overshoot, 1)}%. The first peak occurs at ${format(peakTime, 3)} s. Use those two curve landmarks to calculate ζ and ωₙ. The green curve is the exact noiseless response; the orange dashed curve is your model.`;
  }
  if (round.input === "sine") {
    const [k,tau] = round.parameters;
    const omega = round.omega;
    const amp = k / Math.sqrt(1 + (omega*tau)**2);
    const lag = Math.atan(omega*tau) * 180 / Math.PI;
    return `At ω = ${format(omega, 2)} rad/s, the steady-state output amplitude is ${format(amp, 3)} and its phase lag is ${format(lag, 1)}°. Estimate τ from phase and K from the corrected output amplitude. The green curve is the true output, while the orange dashed curve uses your guesses.`;
  }
  const [k,tau] = round.parameters;
  return `The steady-state value is K = ${format(k, 3)} for a unit step. At t = τ = ${format(tau, 3)} s, the output reaches approximately ${format(0.63212056*k, 3)} (63.2% of K). Compare your orange dashed response against the true green response.`;
}

function submitGuess(event) {
  event.preventDefault();
  if (state.revealed) return;
  const p1 = $("parameter-one").value.trim();
  const p2 = $("parameter-two").value.trim();
  const guess1 = Number(p1), guess2 = Number(p2);
  const first = state.round.kind === "first";
  if (!p1 || !p2 || !Number.isFinite(guess1) || !Number.isFinite(guess2) || guess1 <= 0 || guess2 <= 0 || (first === false && guess1 >= 1)) {
    $("form-error").textContent = first ? "Enter two valid positive parameter estimates." : "Enter valid values: 0 < ζ < 1 and ωₙ > 0.";
    return;
  }
  if (guess1 > 100 || guess2 > 100) {
    $("form-error").textContent = "Please enter estimates no greater than 100.";
    return;
  }
  if (state.prediction === null) {
    $("form-error").textContent = "Choose Yes or No in 'Predict, then check' before submitting.";
    return;
  }
  $("form-error").textContent = "";
  state.guesses = [guess1, guess2];
  state.revealed = true;
  const result = scoreEstimate(state.guesses, state.round.parameters);
  state.totalScore += result.score;
  state.completed++;
  $("total-score").textContent = state.totalScore;
  $("maximum-score").textContent = state.completed * 100;
  $("rounds-completed").textContent = state.completed;
  $("hidden-tag").textContent = "Values revealed ✓";
  $("hidden-tag").style.color = "#65e2b5";
  $("round-status").textContent = "SCORED";
  $("round-status").classList.add("scored");
  $("parameter-one").disabled = true;
  $("parameter-two").disabled = true;
  $("prediction-yes").disabled = true;
  $("prediction-no").disabled = true;
  $("submit-button").disabled = true;
  $("submit-button").textContent = "Guess submitted ✓";
  const correct = predictionTruth(state.round);
  const matched = state.prediction === correct;
  $("prediction-outcome").textContent = `${matched ? "✓ Prediction correct." : "Prediction not quite right."} ${predictionExplanation(state.round)}`;
  $("prediction-outcome").classList.toggle("incorrect", !matched);
  $("result-panel").hidden = false;
  $("round-score").textContent = result.score;
  $("result-subtitle").textContent = result.perfect ? "Excellent! Both parameters are within 10%." : "Study the overlay to see where your estimated model differs.";
  $("result-grid").replaceChildren(
    makeMetric(first ? "Static gain (K)" : "Damping ratio (ζ)", state.round.parameters[0], guess1, result.errors[0]),
    makeMetric(first ? "Time constant (τ)" : "Natural frequency (ωₙ)", state.round.parameters[1], guess2, result.errors[1], first ? "s" : "rad/s")
  );
  $("result-explanation").textContent = makeExplanation(state.round);
  $("chart-description").textContent = "Compare cyan measured data, green true response, and orange dashed response calculated from your guess. Choose New sensor to play again.";
  drawPlot();
}

function initialize() {
  $("guess-form").addEventListener("submit", submitGuess);
  $("new-button").addEventListener("click", newRound);
  $("prediction-yes").addEventListener("click", () => setPrediction(true));
  $("prediction-no").addEventListener("click", () => setPrediction(false));
  window.addEventListener("resize", drawPlot);
  $("hint-button").addEventListener("click", () => {
    state.hintOpen = !state.hintOpen;
    $("hint-panel").hidden = !state.hintOpen;
    $("hint-chevron").textContent = state.hintOpen ? "−" : "+";
    $("hint-button").setAttribute("aria-expanded", String(state.hintOpen));
  });
  newRound();
}

// Public to the test harness; harmless in the browser.
window.SensorChallenge = { firstOrderStep, firstOrderSine, secondOrderStep, scoreEstimate, newRound };
window.addEventListener("DOMContentLoaded", initialize);
