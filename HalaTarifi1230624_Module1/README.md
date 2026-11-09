# Module 1: First-Order Time Response

## Overview
This module is part of the ENCS4380 Dynamic Characteristics Interactive Toolkit. It demonstrates how a first-order sensor responds to step and ramp inputs.

Users can change the sensor gain (K) and time constant (τ) using interactive sliders and observe how these parameters affect the sensor response.

## Mathematical Model

The first-order sensor is represented by:

τ(dy/dt) + y = Kx(t)

The transfer function is:

G(s) = K / (τs + 1)

**Step Response:**

y(t) = K(1 − e^(-t/τ))

**Ramp Response:**

y(t) = K[t − τ(1 − e^(-t/τ))]

The model assumes zero initial conditions and unit step or unit-slope ramp inputs.

## Features

- Interactive sliders for sensor gain and time constant.
- Step and ramp input selection.
- Interactive response graphs using Plotly.js.
- Markers at 63.2% and 95% of the final step response.
- Ramp lag and steady-state error calculations.
- Logarithmic step-response error analysis.
- Predict, Then Check interactive question.
- Validation checks displaying expected values, calculated values, and PASS/FAIL results.
- Responsive webpage design.

## Technologies Used

- HTML
- CSS
- JavaScript
- Plotly.js
- Visual Studio Code

## Validation Results

For K = 1 and τ = 2 seconds:

| Test | Expected | Calculated | Result |
|---|---|---|---|
| Step response at t = τ | 63.2% | 63.212% | PASS |
| Step response at t = 3τ | 95.0% | 95.021% | PASS |

## AI Usage

ChatGPT was used to assist with HTML, CSS, and JavaScript development, implementing interactive graphs, debugging, and validating the mathematical equations.

## Running the Module

1. Open the `module1` folder.
2. Open `index.html` in a web browser.
3. Use the sliders and input selector to explore the sensor response.

An internet connection is needed to load Plotly.js from the CDN.