Module 2 — First-Order Frequency Response
Course: ENCS4380 — Interfacing Techniques
Homework: Homework 1 — Dynamic Characteristics Interactive Toolkit
Module developer: Aseel Nakhleh (1230736)
Overview
This interactive webpage demonstrates how a first-order sensor responds to sinusoidal inputs. Users can change the sensor time constant (τ) and input angular frequency (ω) and immediately see the resulting amplitude attenuation and phase lag.
Features
- Live sliders for time constant τ (s) and input angular frequency ω (rad/s).
- Input and output sine waves displayed on the same graph.
- Calculated amplitude ratio, phase lag, cutoff frequency, and dynamic error.
- Bode magnitude and phase plots on logarithmic frequency axes, with the cutoff frequency marked.
- A dynamic-error calculator accepting frequency in Hz.
- A Predict, Then Check activity in which users save a prediction, change the frequency slider, and compare their prediction with the actual result.
- Fixed validation checks showing expected values, calculated values, and PASS/FAIL.
- Responsive layout tested in a simulated iPhone 16 viewport.
Equations
For a first-order sensor with unity DC gain:
- Amplitude ratio: M = 1 / sqrt(1 + (ωτ)^2)
- Phase lag: φ = -atan(ωτ) (convert radians to degrees for display)
- Cutoff angular frequency: ωc = 1 / τ
- Dynamic error fraction: δ = M - 1 (multiply by 100 to show percent)
- Input sine wave: x(t) = sin(ωt)
- Output sine wave: y(t) = M sin(ωt + φ)
- Bode magnitude: 20 log10(M) dB
Note: The main frequency slider uses rad/s, but the dynamic-error calculator accepts Hz and converts with ω = 2πf.
Validation
The module includes these checks from the homework:
Check	Expected value
Amplitude ratio for τ = 0.2 s and ω = 2 rad/s	≈ 0.93
Phase lag for τ = 0.2 s and ω = 2 rad/s	≈ 21.8° lag
Maximum τ for at most 5% dynamic error up to 100 Hz	≈ 0.52 ms
Phase lag at 50 Hz when τ is at that maximum	≈ 9.3° lag


The validation values are fixed test cases and do not change when the interactive sliders move.
Files
- module2.html — page layout and interactive controls
- style.css — page styling and responsive layout
- script.js — sensor calculations, graphs, prediction activity, and validation tests
- README.md — documentation for this module
How to Run
1. Keep module2.html, style.css, and script.js in the same folder.
2. Open module2.html in a web browser such as Microsoft Edge or Chrome.
3. Connect to the internet so the Plotly.js library can load from the CDN.
4. Adjust the τ and ω sliders to explore the response.
5. Try the prediction activity and check the validation table.
No separate server or installation is required for local use.
GitHub Pages and Group Submission
This module should be integrated into the group's public repository and GitHub Pages website. The group's main README must also include the live Pages link, all group members, module responsibilities, and screenshots. The final group submission requires a v1.0 GitHub release and the GitHub Pages link.

Group GitHub Pages link: https://github.com/AseelNakhleh/encs4380-dynamics-sparky
AI Assistance Disclosure
ChatGPT was used to assist with JavaScript coding, debugging, and improving the interactive graphs. It also helped verify the calculations and resolve technical issues during development.
