"use strict";

/*
 * ENCS4380 - Homework 2 / P4 Tuning Challenge
 *
 * Reuses the random-plant parameter ranges of Homework 1 Module 4:
 *   First order:  G(s) = K / (tau*s + 1), K in [0.65, 2], tau in [0.4, 2.4]
 *   Second order: G(s) = wn^2 / (s^2 + 2*zeta*wn*s + wn^2),
 *                 zeta in [0.2, 0.8], wn in [1.2, 5].
 *
 * Unlike Homework 1's closed-form curves, Homework 2 requires a time-step
 * solver. This file uses explicit Euler integration at dt = 0.004 seconds.
 * No server, libraries, frameworks, or persistent storage are required.
 */

const $ = (id) => document.getElementById(id);
const DT = 0.004;                   // Numerical integration step [seconds]
const END_TIME = 12;                // Simulation time [seconds]
const COMMAND_MIN = -4;
const COMMAND_MAX = 4;
const DERIVATIVE_FILTER_TAU = 0.045; // Filter derivative to avoid unrealistic kick/noise
const TARGET = 1;
const OVERSHOOT_LIMIT_PCT = 10;
const STEADY_ERROR_LIMIT_PCT = 1;
const SETTLING_BAND_PCT = 2;
const SCORE_WEIGHTS = { overshoot: 30, settling: 40, error: 30 };
const MAX_ABS_STATE = 1e6;         // Stop a divergent numerical run safely

const session = {
  roundNumber: 0, round: null, roundAttempts: 0, roundBest: 0,
  roundAttempted: false, roundSolved: false,
  plantsAttempted: 0, plantsSolved: 0, tests: 0, lastTest: null
};

const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));
const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const fixed = (value, digits = 2) => Number.isFinite(value) ? value.toFixed(digits) : "Not settled";

function makeHiddenPlant() {
  // Plant family and parameter limits match Homework 1, Module 4.
  const kind = Math.random() < 0.5 ? "first" : "second";
  if (kind === "first") {
    return {
      kind, K: rand(0.65, 2), tau: rand(0.4, 2.4),
      settlingLimit: Math.round(rand(2.7, 4.5) * 10) / 10
    };
  }
  return {
    kind, K: 1, zeta: rand(0.2, 0.8), wn: rand(1.2, 5),
    settlingLimit: Math.round(rand(2.4, 4.2) * 10) / 10
  };
}

/**
 * Simulate a unity-feedback closed loop at a unit-step setpoint.
 * Controller: u = Kp*(r-y) + Ki*integral - Kd*filtered(dy/dt)
 *
 * Using derivative of measured output instead of derivative of step error
 * avoids an impulse at the reference step. A first-order derivative filter
 * is included as a separate state. Conditional integration implements
 * simple anti-windup when the PID command hits +/-4.
 *
 * Euler equations:
 *   First order: dy/dt = (K*u - y)/tau
 *   Second order: dy/dt = v
 *                 dv/dt = wn^2*(u-y) - 2*zeta*wn*v
 */
function simulateClosedLoop(plant, gains) {
  let y = 0, v = 0, integral = 0, filteredDy = 0;
  let peak = 0, lastOutside = -1, finalError = 100, finalWindowWorst = 0;
  let unstable = false;
  const steps = Math.round(END_TIME / DT);
  const trace = { t: [], y: [], u: [] };

  for (let i = 0; i <= steps; i++) {
    const t = i * DT;
    const error = TARGET - y;
    const commandUnclipped = gains.kp * error + gains.ki * integral - gains.kd * filteredDy;
    const u = clamp(commandUnclipped, COMMAND_MIN, COMMAND_MAX);

    if (i % 6 === 0 || i === steps) {
      trace.t.push(t); trace.y.push(y); trace.u.push(u);
    }
    if (!Number.isFinite(y) || !Number.isFinite(u) || Math.abs(y) > MAX_ABS_STATE) {
      unstable = true;
      break;
    }

    peak = Math.max(peak, y);
    const absoluteError = Math.abs(error);
    const percentageError = (absoluteError / Math.abs(TARGET)) * 100;
    if (percentageError > SETTLING_BAND_PCT + 1e-10) lastOutside = i;
    if (t >= END_TIME - 2) finalWindowWorst = Math.max(finalWindowWorst, percentageError);
    finalError = percentageError;
    if (i === steps) break;

    let dy, dv = 0;
    if (plant.kind === "first") {
      dy = (plant.K * u - y) / plant.tau;
    } else {
      dy = v;
      dv = plant.wn * plant.wn * (u - y) - 2 * plant.zeta * plant.wn * v;
    }

    // Conditional integration. Do not wind up in the direction of saturation.
    const upperBlocked = commandUnclipped >= COMMAND_MAX && error > 0;
    const lowerBlocked = commandUnclipped <= COMMAND_MIN && error < 0;
    if (!upperBlocked && !lowerBlocked) integral += error * DT;

    // Update all states with Euler's method.
    const nextY = y + DT * dy;
    const nextV = v + DT * dv;
    const nextFilteredDy = filteredDy + DT * (dy - filteredDy) / DERIVATIVE_FILTER_TAU;
    y = nextY;
    v = nextV;
    filteredDy = nextFilteredDy;
  }

  const overshoot = unstable ? Infinity : Math.max(0, (peak - TARGET) * 100 / Math.abs(TARGET));
  const settling = unstable || lastOutside === steps ? Infinity : Math.max(0, (lastOutside + 1) * DT);
  const steadyError = unstable ? Infinity : finalError;
  const worstTailError = unstable ? Infinity : finalWindowWorst;
  const pass = {
    overshoot: overshoot <= OVERSHOOT_LIMIT_PCT,
    settling: settling <= plant.settlingLimit,
    error: worstTailError <= STEADY_ERROR_LIMIT_PCT
  };
  const score = (pass.overshoot ? SCORE_WEIGHTS.overshoot : 0)
              + (pass.settling ? SCORE_WEIGHTS.settling : 0)
              + (pass.error ? SCORE_WEIGHTS.error : 0);

  return { trace, gains, unstable, overshoot, settling, steadyError, worstTailError, pass,
    score, allPass: pass.overshoot && pass.settling && pass.error };
}

function readGains() {
  return {
    kp: clamp(Number($("kp-num").value) || 0, 0, 10),
    ki: clamp(Number($("ki-num").value) || 0, 0, 8),
    kd: clamp(Number($("kd-num").value) || 0, 0, 6)
  };
}

function setGains(gains) {
  for (const name of ["kp", "ki", "kd"]) {
    const max = Number($(`${name}-slider`).max);
    const value = clamp(Number(gains[name]) || 0, 0, max);
    $(`${name}-num`).value = String(value);
    $(`${name}-slider`).value = String(value);
  }
  invalidatePreviousTest();
}

function invalidatePreviousTest() {
  if (session.lastTest) {
    $("plot-state").textContent = "PREVIOUS TEST";
    $("summary-status").textContent = "Gains changed. The graph and score show the previous attempt; run another test to update them.";
    $("prediction").value = "";
    $("prediction-feedback").textContent = "Predict what the updated gains will do before testing again.";
    $("prediction-feedback").className = "prediction-feedback";
  }
}

function newChallenge() {
  session.roundNumber++;
  session.round = makeHiddenPlant();
  session.roundAttempts = 0;
  session.roundBest = 0;
  session.roundAttempted = false;
  session.roundSolved = false;
  session.lastTest = null;
  $("challenge-number").textContent = String(session.roundNumber).padStart(2, "0");
  $("plant-type").textContent = session.round.kind === "first" ? "First-order plant" : "Second-order plant";
  $("settling-limit").textContent = fixed(session.round.settlingLimit, 1);
  $("round-best").textContent = "0";
  $("attempt-number").textContent = "0 ATTEMPTS";
  $("plot-state").textContent = "AWAITING TEST";
  $("reveal-plant").disabled = true;
  $("reveal-plant").textContent = "Reveal hidden parameters";
  $("reveal-box").hidden = true;
  $("reveal-box").replaceChildren();
  $("response-plot").replaceChildren();
  $("control-plot").replaceChildren();
  $("response-empty").hidden = false;
  $("control-empty").hidden = false;
  $("prediction").value = "";
  $("prediction-feedback").className = "prediction-feedback";
  $("prediction-feedback").textContent = "What do you expect to happen before running the simulation?";
  for (const [key, label] of [["overshoot", "overshoot"], ["settling", "settling"], ["error", "error"]]) {
    $(`${key}-measured`).textContent = "Not measured";
    $(`${key}-status`).className = "status status-idle";
    $(`${key}-status`).textContent = "—";
  }
  $("attempt-score").textContent = "0";
  $("score-fill").style.width = "0%";
  $("score-message").textContent = "Each passed requirement earns points: overshoot 30, settling 40, steady-state error 30.";
  $("summary-status").textContent = "Tune the controller and run a test to begin.";
  setGains({ kp: 2, ki: 0, kd: 0 });
  updateStats();
}

function updateStats() {
  $("session-tested").textContent = session.plantsAttempted;
  $("session-solved").textContent = session.plantsSolved;
  $("session-tests").textContent = session.tests;
}

function updateStatus(name, passed, message) {
  $(`${name}-measured`).textContent = message;
  $(`${name}-status`).textContent = passed ? "PASS" : "FAIL";
  $(`${name}-status`).className = `status status-${passed ? "pass" : "fail"}`;
}

function checkPrediction(choice, test) {
  const correct = (choice === "pass" && test.allPass)
    || (choice === "overshoot" && !test.pass.overshoot)
    || (choice === "slow" && !test.pass.settling)
    || (choice === "error" && !test.pass.error);
  $("prediction-feedback").className = `prediction-feedback ${correct ? "correct" : "incorrect"}`;
  $("prediction-feedback").textContent = correct
    ? "✓ Correct prediction! Compare the measured values to the limits below."
    : "Your prediction did not match that criterion. Check the response curve and try different gains.";
}

function runTest() {
  const prediction = $("prediction").value;
  if (!prediction) {
    $("prediction-feedback").className = "prediction-feedback incorrect";
    $("prediction-feedback").textContent = "Please choose a prediction first. This is the required Predict, then check step.";
    $("prediction").focus();
    return;
  }
  const gains = readGains();
  const result = simulateClosedLoop(session.round, gains);
  session.roundAttempts++;
  session.tests++;
  if (!session.roundAttempted) { session.plantsAttempted++; session.roundAttempted = true; }
  if (result.allPass && !session.roundSolved) { session.plantsSolved++; session.roundSolved = true; }
  session.roundBest = Math.max(session.roundBest, result.score);
  session.lastTest = result;
  $("round-best").textContent = session.roundBest;
  $("attempt-number").textContent = `${session.roundAttempts} ${session.roundAttempts === 1 ? "ATTEMPT" : "ATTEMPTS"}`;
  $("plot-state").textContent = result.unstable ? "UNSTABLE" : "SIMULATED";
  $("reveal-plant").disabled = false;
  updateStatus("overshoot", result.pass.overshoot, `Measured: ${fixed(result.overshoot, 2)}% · limit 10%`);
  updateStatus("settling", result.pass.settling, `Measured: ${fixed(result.settling, 2)} s · limit ${fixed(session.round.settlingLimit, 1)} s`);
  updateStatus("error", result.pass.error, `End: ${fixed(result.steadyError, 2)}% · worst in last 2 s: ${fixed(result.worstTailError, 2)}%`);
  $("attempt-score").textContent = result.score;
  $("score-fill").style.width = `${result.score}%`;
  $("score-message").textContent = `Points: ${result.pass.overshoot ? 30 : 0}/30 overshoot + ${result.pass.settling ? 40 : 0}/40 settling + ${result.pass.error ? 30 : 0}/30 error.`;
  $("summary-status").textContent = result.allPass
    ? "✓ All requirements satisfied! You have successfully tuned this hidden plant."
    : result.unstable
      ? "The response diverged. Reduce the gains and try again."
      : "Some requirements failed. Adjust the gains and test again.";
  checkPrediction(prediction, result);
  renderGraph("response-plot", result.trace, "output");
  renderGraph("control-plot", result.trace, "control");
  $("response-empty").hidden = true;
  $("control-empty").hidden = true;
  updateStats();
}

function revealPlant() {
  if (!session.lastTest || !session.round) return;
  const p = session.round;
  let text;
  if (p.kind === "first") {
    text = `<strong>First-order plant</strong><div>G(s) = ${fixed(p.K, 3)} / (${fixed(p.tau, 3)}s + 1)</div><div>K = ${fixed(p.K, 3)}; τ = ${fixed(p.tau, 3)} s</div>`;
  } else {
    text = `<strong>Second-order plant</strong><div>G(s) = ωₙ² / (s² + 2ζωₙs + ωₙ²)</div><div>ζ = ${fixed(p.zeta, 3)}; ωₙ = ${fixed(p.wn, 3)} rad/s; K = 1</div>`;
  }
  $("reveal-box").innerHTML = text;
  $("reveal-box").hidden = false;
  $("reveal-plant").textContent = "Parameters revealed";
  $("reveal-plant").disabled = true;
}

function renderGraph(id, trace, mode) {
  const svg = $(id);
  const outputMode = mode === "output";
  const W = 900, H = outputMode ? 306 : 220;
  const pad = { top: 22, right: 20, bottom: 42, left: 50 };
  const pw = W - pad.left - pad.right, ph = H - pad.top - pad.bottom;
  const data = outputMode ? trace.y : trace.u;
  let min, max;
  if (outputMode) {
    let dMin = Math.min(0, ...data.filter(Number.isFinite));
    let dMax = Math.max(1, ...data.filter(Number.isFinite));
    min = Math.max(-2.5, Math.min(-0.15, dMin - 0.12));
    max = Math.min(4.0, Math.max(1.28, dMax + 0.14));
  } else { min = -4.6; max = 4.6; }
  const x = (t) => pad.left + pw * (t / END_TIME);
  const y = (v) => pad.top + ph * (max - clamp(v, min, max)) / (max - min);
  const pathFrom = (values) => values.map((v,i) =>
    `${i ? "L" : "M"}${x(trace.t[i]).toFixed(2)},${y(v).toFixed(2)}`).join(" ");
  let html = `<rect x="${pad.left}" y="${pad.top}" width="${pw}" height="${ph}" rx="3" fill="#0d1b2c"/>`;
  if (outputMode) {
    const topBand = y(1.02), bottomBand = y(0.98);
    html += `<rect x="${pad.left}" y="${topBand.toFixed(2)}" width="${pw}" height="${Math.max(1,bottomBand-topBand).toFixed(2)}" fill="#60dcbe" opacity="0.15"/>`;
  }
  for (let i = 0; i <= 4; i++) {
    const val = min + i * (max - min) / 4;
    const lineY = y(val);
    html += `<line x1="${pad.left}" y1="${lineY.toFixed(2)}" x2="${W-pad.right}" y2="${lineY.toFixed(2)}" stroke="#294156" stroke-width="1"/>`;
    html += `<text x="${pad.left-9}" y="${(lineY+4).toFixed(2)}" fill="#91a8bd" font-size="12" text-anchor="end">${val.toFixed(1)}</text>`;
  }
  for (let i = 0; i <= 6; i++) {
    const t = END_TIME * i / 6, posX = x(t);
    html += `<line x1="${posX}" y1="${pad.top}" x2="${posX}" y2="${H-pad.bottom}" stroke="#23384c"/>`;
    html += `<text x="${posX}" y="${H-14}" text-anchor="middle" font-size="12" fill="#91a8bd">${t.toFixed(0)}</text>`;
  }
  if (outputMode) {
    html += `<path d="M${x(0)},${y(TARGET)} L${x(END_TIME)},${y(TARGET)}" stroke="#b8a3ff" stroke-width="2" stroke-dasharray="9 6" fill="none"/>`;
    html += `<path d="${pathFrom(data)}" stroke="#66e6c8" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" fill="none"/>`;
  } else {
    for (const level of [COMMAND_MIN, COMMAND_MAX]) {
      html += `<line x1="${x(0)}" y1="${y(level)}" x2="${x(END_TIME)}" y2="${y(level)}" stroke="#f68f9b" stroke-width="1.8" stroke-dasharray="7 6"/>`;
    }
    html += `<path d="${pathFrom(data)}" stroke="#74b4ff" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round" fill="none"/>`;
  }
  html += `<text x="${pad.left}" y="13" fill="#9cb4c9" font-size="12">${outputMode ? "Output y" : "Control u"}</text>`;
  html += `<text x="${W/2}" y="${H-2}" fill="#9cb4c9" font-size="12" text-anchor="middle">Time (seconds)</text>`;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.innerHTML = html;
}

function bindControls() {
  for (const input of document.querySelectorAll("[data-gain]")) {
    const isSlider = input.type === "range";
    input.addEventListener(isSlider ? "input" : "change", () => {
      const name = input.dataset.gain;
      const max = Number($(`${name}-slider`).max);
      const value = clamp(Number(input.value) || 0, 0, max);
      $(`${name}-slider`).value = String(value);
      $(`${name}-num`).value = String(value);
      invalidatePreviousTest();
    });
  }
  for (const preset of document.querySelectorAll("[data-preset]")) {
    preset.addEventListener("click", () => {
      const choice = preset.dataset.preset;
      const gains = choice === "p" ? {kp:2,ki:0,kd:0}
        : choice === "pi" ? {kp:2,ki:1,kd:0} : {kp:3,ki:1.5,kd:0.8};
      setGains(gains);
    });
  }
  $("run-test").addEventListener("click", runTest);
  $("new-plant").addEventListener("click", newChallenge);
  $("reveal-plant").addEventListener("click", revealPlant);
  $("hint-btn").addEventListener("click", () => {
    const el = $("hint-text");
    el.hidden = !el.hidden;
    $("hint-btn").textContent = el.hidden ? "⊕ Show tuning hint" : "⊖ Hide tuning hint";
  });
}

bindControls();
newChallenge();

// Expose a minimal debug-only hook for straightforward numerical tests.
// Nothing here sends data anywhere or requires a backend.
if (typeof window !== "undefined") window.P4_TEST = { simulateClosedLoop };
