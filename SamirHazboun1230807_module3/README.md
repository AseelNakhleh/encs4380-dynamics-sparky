# Module 3 — Second-order response

**Samir Hazboun (1230807)**  
**ENCS4380 Interfacing Techniques · Homework 1**

## Run the module

## Explore the simulator

1. Choose a prediction about critical damping, then select **Check on the plot**.
2. Try the underdamped, critically damped, and overdamped presets. Move the mass `m`, damping `b`, and spring stiffness `k` sliders to see how the response changes.
3. Read the 90% rise time, peak time, percent overshoot, and ±5% settling time from the normalized step-response plot.
4. Compare the transfer-function poles with the eigenvalues of the state matrix. The phase plane shows how displacement and velocity evolve together.

## Model

The mass–spring–damper starts at rest and is driven by a 1 N step force. Its transfer function is `G(s) = 1/(ms² + bs + k)`. The natural frequency is `ωₙ = √(k/m)`, the damping ratio is `ζ = b/(2√(mk))`, and the static gain is `K = 1/k`. The page plots the closed-form response for each damping case and updates the state-space matrices as the sliders move.

## Homework validation

| Check | Expected | Computed | Result |
| --- | --- | --- | --- |
| 4 · Overshoot at ζ = 0.5 | 16.3% | 16.3% | Pass |
| 5 · Overshoot at ζ = 1 | 0% | 0% | Pass |
| 6 · Eigenvalues and poles for m = 1, b = 2, k = 4 | −1 ± j1.732 | −1 ± j1.732 | Pass |

## Link from the group site

Place this folder in the repository root and link to `SamirHazboun1230807_module3/index.html` from the group homepage.

## AI assistance

AI was used to help with the concepts behind Module 3, check and test its behavior, and draft this README.
