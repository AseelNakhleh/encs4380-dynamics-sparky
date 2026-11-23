"use strict";

const element = id => document.getElementById(id);

function number(value, digits = 3) {
  return Number(value.toFixed(digits)).toString();
}

function chart(canvas, bounds, xLabel, yLabel, yTicks) {
  const { xMin, xMax, yMin, yMax } = bounds;
  const { width, height } = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.font = "11px system-ui";
  const left = 57, right = width - 20, top = 12, bottom = height - 43;
  const x = value => left + (value - xMin) * (right - left) / (xMax - xMin);
  const y = value => bottom - (value - yMin) * (bottom - top) / (yMax - yMin);
  function line(x1, y1, x2, y2, color) {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  for (let i = 0; i <= 4; i++) {
    const xv = xMin + (xMax - xMin) * i / 4;
    const yv = yTicks ? yTicks[i] : yMin + (yMax - yMin) * i / 4;
    line(x(xv), top, x(xv), bottom, "#dde8e4");
    line(left, y(yv), right, y(yv), "#dde8e4");
    ctx.fillStyle = "#435e64";
    ctx.textAlign = "center";
    ctx.fillText(number(xv), x(xv), bottom + 15);
    ctx.textAlign = "right";
    ctx.fillText(number(yv), left - 6, y(yv) + 4);
  }
  ctx.fillStyle = "#192e35";
  ctx.textAlign = "center";
  ctx.fillText(xLabel, (left + right) / 2, height - 8);
  ctx.save();
  ctx.translate(11, (top + bottom) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();
  return { ctx, x, y };
}

const sliderIds = ["sample", "kp", "ki", "kd", "target", "gain", "tau"];
const referencePeriod = 0.02;
const defaults = { sample: 0.02, kp: 2, ki: 2, kd: 0.1, target: 0.6, gain: 1, tau: 1 };

function simulate(settings, duration) {
  const { sample, kp, ki, kd, target, gain, tau, antiWindup } = settings;
  const response = [{ t: 0, y: 0 }];
  const commands = [];
  let y = 0;
  let integral = 0;
  let previousError = 0;
  let peakIntegral = 0;
  let rejectedUpdates = 0;

  for (let k = 0; k < Math.ceil(duration / sample - 1e-10); k++) {
    const t = k * sample;
    const error = target - y;
    const proportionalDerivative = kp * error + kd * (error - previousError) / sample;
    const change = ki * sample * error;
    const trial = proportionalDerivative + integral + change;
    const pushesPastLimit = (trial > 1 && change > 0) || (trial < 0 && change < 0);
    if (antiWindup && pushesPastLimit) rejectedUpdates++;
    else integral += change;

    const u = Math.min(1, Math.max(0, proportionalDerivative + integral));
    commands.push({ t, u });
    peakIntegral = Math.max(peakIntegral, Math.abs(integral));
    previousError = error;

    // Integrate the plant with smaller steps while holding this command.
    const end = Math.min(duration, (k + 1) * sample);
    const interval = end - t;
    const points = Math.max(1, Math.ceil(interval / (duration / 1600)));
    const substeps = Math.max(1, Math.ceil(interval / points / (tau / 50)));
    const dt = interval / (points * substeps);
    for (let point = 1; point <= points; point++) {
      for (let step = 0; step < substeps; step++) {
        y += dt * (gain * u - y) / tau;
      }
      response.push({ t: point === points ? end : t + point * substeps * dt, y });
    }
  }
  return { response, commands, peakIntegral, rejectedUpdates };
}

function responseMetrics(response, target, sample) {
  function crossing(level) {
    const index = response.findIndex(point => point.y >= level);
    if (index < 1) return null;
    const before = response[index - 1];
    const after = response[index];
    return before.t + (after.t - before.t) * (level - before.y) / (after.y - before.y);
  }

  const t10 = crossing(0.1 * target);
  const t90 = crossing(0.9 * target);
  const peak = Math.max(...response.map(point => point.y));
  const last = response[response.length - 1];
  const band = 0.02 * target;
  let outside = response.length - 1;
  while (outside >= 0 && Math.abs(response[outside].y - target) <= band) outside--;
  let settling = null;

  if (outside >= 0 && outside < response.length - 1) {
    const before = response[outside];
    const after = response[outside + 1];
    const edge = before.y > target ? target + band : target - band;
    const entry = before.t + (after.t - before.t) * (edge - before.y) / (after.y - before.y);
    if (last.t - entry >= Math.max(0.5, 2 * sample)) settling = entry;
  }
  return {
    rise: t90 === null || t10 === null ? null : t90 - t10,
    overshoot: Math.max(0, 100 * (peak - target) / target),
    settling,
    error: Math.abs(target - last.y)
  };
}

function drawSeries(plot, samples, valueOf, color, dash = [], held = false, duration = 0) {
  const { ctx, x, y } = plot;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash(dash);
  ctx.beginPath();
  let previous = valueOf(samples[0]);
  ctx.moveTo(x(samples[0].t), y(previous));
  for (const sample of samples.slice(1)) {
    const value = valueOf(sample);
    if (held) ctx.lineTo(x(sample.t), y(previous));
    ctx.lineTo(x(sample.t), y(value));
    previous = value;
  }
  if (held) ctx.lineTo(x(duration), y(previous));
  ctx.stroke();
  ctx.restore();
}

function drawPlots(result, reference, target, duration) {
  const y = point => point.y;
  const peak = Math.max(target, ...result.response.map(y), ...reference.response.map(y));
  const output = chart(element("response"), {
    xMin: 0, xMax: duration, yMin: 0, yMax: peak * 1.1
  }, "Time (s)", "Output");
  drawSeries(output, [{ t: 0, y: target }, { t: duration, y: target }], y, "#875629", [2, 4]);
  drawSeries(output, result.response, y, "#125e52");
  if (reference !== result) drawSeries(output, reference.response, y, "#305ca0", [5, 5]);

  const command = chart(element("command"), {
    xMin: 0, xMax: duration, yMin: -10, yMax: 110
  }, "Time (s)", "PWM (%)", [0, 25, 50, 75, 100]);
  for (const limit of [0, 100]) {
    drawSeries(command, [{ t: 0, y: limit }, { t: duration, y: limit }], y, "#875629", [3, 4]);
  }
  drawSeries(command, result.commands, point => 100 * point.u, "#125e52", [], true, duration);
}

function arduinoCode(settings) {
  const { sample, kp, ki, kd, target, antiWindup } = settings;
  const floatLiteral = value => value.toFixed(2) + "f";
  return `const uint8_t PWM_PIN = 9;
const uint8_t FEEDBACK_PIN = A0;
const unsigned long SAMPLE_US = ${Math.round(sample * 1000000)}UL;
const float TS = SAMPLE_US / 1000000.0f;
const float KP = ${floatLiteral(kp)};
const float KI = ${floatLiteral(ki)};
const float KD = ${floatLiteral(kd)};
const float SETPOINT = ${floatLiteral(target)};
const bool ANTI_WINDUP = ${antiWindup};

float integral = 0.0f;
float previousError = 0.0f;
unsigned long lastSample;

float readOutput() {
  // Example 10-bit analog input. Use scaled encoder speed for a motor.
  return analogRead(FEEDBACK_PIN) / 1023.0f;
}

void setup() {
  pinMode(PWM_PIN, OUTPUT);
  analogWrite(PWM_PIN, 0);
  lastSample = micros() - SAMPLE_US;
}

void loop() {
  const unsigned long now = micros();
  if (now - lastSample < SAMPLE_US) return;
  lastSample = now;

  const float error = SETPOINT - readOutput();
  const float pd = KP * error + KD * (error - previousError) / TS;
  const float change = KI * TS * error;
  const float trial = pd + integral + change;
  const bool pushesPastLimit = (trial > 1.0f && change > 0.0f)
                           || (trial < 0.0f && change < 0.0f);

  if (!ANTI_WINDUP || !pushesPastLimit) integral += change;

  const float u = constrain(pd + integral, 0.0f, 1.0f);
  analogWrite(PWM_PIN, (int)(255.0f * u + 0.5f));
  previousError = error;
}`;
}

function timeLabel(time, missing) {
  return time === null ? missing : number(time, 2) + " s";
}

function update() {
  const settings = {};
  for (const id of sliderIds) {
    const value = Number(element(id).value);
    settings[id] = value;
    element(id + "-value").textContent = value.toFixed(2);
  }
  settings.antiWindup = element("anti-windup").checked;

  const { sample, target, tau, gain } = settings;
  const duration = Math.max(12, 16 * tau, 16 * sample);
  const result = simulate(settings, duration);
  const reference = sample === referencePeriod
    ? result : simulate({ ...settings, sample: referencePeriod }, duration);
  const metrics = responseMetrics(result.response, target, sample);
  const referenceMetrics = responseMetrics(reference.response, target, referencePeriod);
  element("rise").textContent = timeLabel(metrics.rise, "Not reached");
  element("overshoot").textContent = number(metrics.overshoot, 1) + "%";
  element("settling").textContent = timeLabel(metrics.settling, "Not observed");
  element("error").textContent = number(metrics.error, 4);
  element("comparison").textContent =
    `Over ${number(duration, 2)} s, the 0.02 s reference has ` +
    `${number(referenceMetrics.overshoot, 1)}% overshoot and ` +
    (referenceMetrics.settling === null
      ? "no observed settling."
      : `a settling time of ${timeLabel(referenceMetrics.settling)}.`);
  element("limit-note").textContent = target > gain
    ? `At 100% PWM, this plant can reach at most ${number(gain)}. The target is above that limit.` : "";
  element("integral-note").textContent = `Peak magnitude of the integral term ${number(100 * result.peakIntegral, 1)} percentage points of PWM. Anti-windup skipped ${result.rejectedUpdates} integral updates.`;
  element("arduino-code").textContent = arduinoCode(settings);
  element("copy-status").textContent = "";
  element("feedback").textContent = "";
  drawPlots(result, reference, target, duration);
}

function applyPreset(overrides) {
  for (const [id, value] of Object.entries({ ...defaults, ...overrides })) element(id).value = value;
  element("anti-windup").checked = true;
  update();
}

for (const id of sliderIds) element(id).addEventListener("input", update);
element("anti-windup").addEventListener("change", update);
element("fast").addEventListener("click", () => applyPreset({}));
element("slow").addEventListener("click", () => applyPreset({ sample: 1.25 }));
element("windup").addEventListener("click", () => applyPreset({ sample: 0.05, target: 0.8, ki: 8, kd: 0 }));
element("check").addEventListener("click", () => {
  const guess = element("guess").value;
  if (!guess) {
    element("feedback").textContent = "Choose a prediction first.";
    return;
  }
  applyPreset({ sample: 1.25 });
  const verdict = guess === "oscillates" ? "Correct." : "The slow response oscillates more.";
  element("feedback").textContent = verdict + " The controller holds each command for 1.25 s, so it corrects the error later.";
});

element("copy").addEventListener("click", async () => {
  const code = element("arduino-code");
  const status = element("copy-status");
  try {
    await navigator.clipboard.writeText(code.textContent);
    status.textContent = "Copied to clipboard.";
  } catch {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(code);
    selection.removeAllRanges();
    selection.addRange(range);
    status.textContent = "Code selected. Press Ctrl+C or ⌘C to copy.";
  }
});

window.addEventListener("resize", update);
update();
