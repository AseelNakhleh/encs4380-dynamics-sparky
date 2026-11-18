"use strict";

const dt = 0.002;
const duration = 16;
const setpoint = 1;
const plantTimeConstant = 1;
const crossingTolerance = 0.0001;
const fastTau = 0.08;
const slowTau = 2;
const defaults = { tau: fastTau, kp: 2, ki: 2, kd: 0.15 };

function simulate({ tau, kp, ki, kd }) {
  let output = 0;
  let measured = 0;
  let integral = 0;
  let peak = 0;
  let minimum = 0;
  let maximum = setpoint;
  let side = -1;
  let crossings = 0;
  const samples = [];
  const steps = Math.round(duration / dt);

  function rates(y, ym, accumulatedError) {
    const measuredRate = (y - ym) / tau;
    const error = setpoint - ym;
    // For t > 0 the setpoint is constant, so the error derivative is -dym/dt.
    const control = kp * error + ki * accumulatedError - kd * measuredRate;
    return [(control - y) / plantTimeConstant, measuredRate, error];
  }

  for (let step = 0; step <= steps; step++) {
    if (step % 5 === 0) samples.push({ time: step * dt, output, measured });
    peak = Math.max(peak, output);
    minimum = Math.min(minimum, output, measured);
    maximum = Math.max(maximum, output, measured);
    const distance = output - setpoint;
    if (Math.abs(distance) > crossingTolerance && Math.sign(distance) !== side) {
      crossings++;
      side = Math.sign(distance);
    }

    if (step === steps) break;
    // RK4 samples the coupled derivatives at the start, two midpoints, and the end.
    const [y1, m1, i1] = rates(output, measured, integral);
    const [y2, m2, i2] = rates(output + dt / 2 * y1, measured + dt / 2 * m1, integral + dt / 2 * i1);
    const [y3, m3, i3] = rates(output + dt / 2 * y2, measured + dt / 2 * m2, integral + dt / 2 * i2);
    const [y4, m4, i4] = rates(output + dt * y3, measured + dt * m3, integral + dt * i3);
    output += dt / 6 * (y1 + 2 * y2 + 2 * y3 + y4);
    measured += dt / 6 * (m1 + 2 * m2 + 2 * m3 + m4);
    integral += dt / 6 * (i1 + 2 * i2 + 2 * i3 + i4);
  }

  return { samples, minimum, maximum, overshoot: Math.max(0, (peak - setpoint) / setpoint * 100), crossings };
}

function loopStability({ tau, kp, ki, kd }) {
  // For Ki > 0, the Routh–Hurwitz boundary is a2*a1 = a3*a0.
  const criticalKi = (plantTimeConstant + tau + kd) * (1 + kp) / (plantTimeConstant * tau);
  if (Math.abs(ki - criticalKi) < 1e-10) return "Marginally stable · sustained oscillation";
  if (ki > criticalKi) return "Unstable · growing oscillation";
  return "Stable · transients decay";
}

function axisScale(...runs) {
  const low = Math.min(0, ...runs.map(run => run.minimum));
  const high = Math.max(1.05, ...runs.map(run => run.maximum));
  const idealStep = (high - low) / 5;
  const base = 10 ** Math.floor(Math.log10(idealStep));
  const spacing = [1, 2, 2.5, 5, 10].find(multiplier => multiplier * base >= idealStep) * base;
  return {
    spacing,
    first: Math.floor(low / spacing),
    last: Math.ceil(high / spacing)
  };
}

function drawPlot(canvas, run, scale) {
  const { width, height } = canvas.getBoundingClientRect();
  if (width === 0 || height === 0) return;

  const pixelRatio = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  const ctx = canvas.getContext("2d");
  ctx.scale(pixelRatio, pixelRatio);
  ctx.font = "12px system-ui, sans-serif";
  const formatTick = value => Math.abs(value) >= 10000 ? value.toExponential(1) : String(Number(value.toPrecision(4)));
  const min = scale.first * scale.spacing;
  const max = scale.last * scale.spacing;
  const left = Math.max(47, 27 + Math.max(ctx.measureText(formatTick(min)).width, ctx.measureText(formatTick(max)).width));
  const right = width - 13;
  const top = 13;
  const bottom = height - 42;
  const x = t => left + t / duration * (right - left);
  const y = value => bottom - (value - min) / (max - min) * (bottom - top);

  ctx.strokeStyle = "#d5e2e8";
  ctx.fillStyle = "#496371";
  ctx.textBaseline = "middle";
  ctx.textAlign = "right";
  ctx.beginPath();
  for (let tick = scale.first; tick <= scale.last; tick++) {
    const value = tick * scale.spacing;
    ctx.moveTo(left, y(value));
    ctx.lineTo(right, y(value));
    ctx.fillText(formatTick(value), left - 7, y(value));
  }

  ctx.textAlign = "center";
  const timeSpacing = width >= 450 ? 2 : 4;
  for (let t = 0; t <= duration; t += timeSpacing) {
    ctx.moveTo(x(t), top);
    ctx.lineTo(x(t), bottom);
    ctx.fillText(String(t), x(t), bottom + 13);
  }
  ctx.stroke();
  ctx.fillText("Time (s)", (left + right) / 2, height - 9);
  ctx.save();
  ctx.translate(9, (top + bottom) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("Response", 0, 0);
  ctx.restore();

  ctx.beginPath();
  ctx.rect(left, top, right - left, bottom - top);
  ctx.clip();
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  for (const [color, dash, getValue] of [
    ["#5c6d7c", [2, 4], () => setpoint],
    ["#075fb0", [], sample => sample.output],
    ["#ac480a", [7, 4], sample => sample.measured]
  ]) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.setLineDash(dash);
    for (const sample of run.samples) ctx.lineTo(x(sample.time), y(getValue(sample)));
    ctx.stroke();
  }
}

function summary(run) {
  const crossingLabel = run.crossings === 1 ? "setpoint crossing" : "setpoint crossings";
  const overshoot = new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(run.overshoot);
  return `${overshoot}% overshoot · ${run.crossings} ${crossingLabel}`;
}

const sliders = Object.keys(defaults).map(id => document.getElementById(id));
const livePlot = document.getElementById("live-plot");
const liveSummary = document.getElementById("live-summary");
const liveStability = document.getElementById("live-stability");
const prediction = document.getElementById("prediction");
const comparison = document.getElementById("comparison");
const fastPlot = document.getElementById("fast-plot");
const slowPlot = document.getElementById("slow-plot");
let liveRun;
let liveScale;
let comparisonRuns;
let comparisonScale;

function drawLive() {
  drawPlot(livePlot, liveRun, liveScale);
}

function drawComparison() {
  if (comparison.hidden) return;
  drawPlot(fastPlot, comparisonRuns.fast, comparisonScale);
  drawPlot(slowPlot, comparisonRuns.slow, comparisonScale);
}

function updateLive() {
  const settings = {};
  for (const slider of sliders) {
    const value = slider.valueAsNumber;
    settings[slider.id] = value;
    document.getElementById(`${slider.id}-value`).value = value.toFixed(2) + (slider.id === "tau" ? " s" : "");
  }
  liveRun = simulate(settings);
  liveScale = axisScale(liveRun);
  liveSummary.textContent = summary(liveRun);
  liveStability.textContent = loopStability(settings);
  drawLive();
}

for (const slider of sliders) slider.addEventListener("input", updateLive);
document.getElementById("reset").addEventListener("click", () => {
  for (const slider of sliders) slider.value = defaults[slider.id];
  updateLive();
});

prediction.addEventListener("submit", event => {
  event.preventDefault();
  const answer = new FormData(prediction).get("prediction");
  if (!answer) return;
  comparisonRuns ??= {
    fast: simulate(defaults),
    slow: simulate({ ...defaults, tau: slowTau })
  };
  comparisonScale = axisScale(comparisonRuns.fast, comparisonRuns.slow);
  document.getElementById("fast-summary").textContent = summary(comparisonRuns.fast);
  document.getElementById("slow-summary").textContent = summary(comparisonRuns.slow);
  comparison.hidden = false;
  prediction.querySelector("button").setAttribute("aria-expanded", "true");
  document.getElementById("feedback").textContent = answer === "more"
    ? "Correct. The slow sensor produces more overshoot and more oscillation."
    : "The comparison shows more overshoot and more oscillation with the slow sensor.";
  drawComparison();
});

updateLive();
const resizeObserver = new ResizeObserver(() => {
  drawLive();
  drawComparison();
});
resizeObserver.observe(livePlot);
resizeObserver.observe(fastPlot);
resizeObserver.observe(slowPlot);
