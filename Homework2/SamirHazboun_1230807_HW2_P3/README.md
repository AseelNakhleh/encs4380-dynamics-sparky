# P3 · Digital PID

**Samir Hazboun (1230807)**  
**ENCS4380 Interfacing Techniques · Homework 2**

## Run the module

Open [index.html](index.html) in a browser. Keep `index.html`, `style.css`, and `script.js` together. There are no external libraries or server requirements.

## Demo

1. Answer **Predict, then check**. The check loads the 1.25 s preset and compares it with a 0.02 s reference at the same gains. With the demo plant, 0.02 s sampling settles in about 2.16 s. The 1.25 s response has about 19.3% overshoot and keeps oscillating over the plotted window.
2. Select **Windup demo**, then turn anti-windup off and back on. The positive error keeps accumulating during upper saturation with anti-windup off. With the preset, overshoot drops from about 23.1% to 3.0% when anti-windup is enabled.
3. Change a gain or the sampling period and use **Copy Arduino code** to copy the loop with the new settings.

## How it works

- At sample `k`, the controller computes `e[k] = target - y[k]`. The three terms are `Kp*e[k]`, `Ki*Ts*sum(e[j])`, and `Kd*(e[k]-e[k-1])/Ts`. The previous error and integral term start at zero.
- The clamped command is held at 0–100% PWM until the next sample. Between samples, the first-order plant `G(s) = K/(tau*s + 1)` is integrated with forward Euler. The integration step is at most `tau/50`, independent of the controller’s sampling period.
- Conditional integration rejects updates that push the trial command farther into saturation. It allows updates in the opposite direction. The browser and generated Arduino code use the same rule.
- Rise time uses the first 10% and 90% crossings of the target. Settling is based on the simulated tail staying within ±2% of the target for at least 0.5 s or two controller sample periods, whichever is longer. The final error is measured at the plot endpoint.

## Use your group’s motor

The initial values `K = 1` and `tau = 1 s` are the handout’s example. Enter your measured values under **First-order plant settings and model**. For a PWM step of size `Δu`, estimate `K = Δy/Δu` using the steady speed change. Estimate `tau` from the time to reach 63.2% of that change. Use PWM as a fraction between 0 and 1 and express speed relative to a documented reference speed. Use the same speed scale for the setpoint and Arduino feedback. The example sketch reads a 10-bit analog input on A0. Replace `readOutput()` with the group’s encoder speed calculation and choose the PWM pin for your board and motor driver.

## Add P3 to the group site

Place the `ENCS4380_HW2_P3` folder in the existing HW1 repository. Add this link to the group’s Control section, adjusting the relative path if that section is on a separate page.

```html
<a href="ENCS4380_HW2_P3/index.html">P3 · Digital PID</a>
```

Add `P3 · Digital PID — Samir Hazboun (1230807)` to the group README and assign the P3 GitHub issue to Samir’s account. The group’s final submission uses the `v2.0` tag and the GitHub Pages link.

## AI assistance

ChatGPT helped implement the digital PID simulator and Arduino code generator, verify the sampling and anti-windup behavior, and draft this README.
