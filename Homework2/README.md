# Sparky — PID Control Toolkit

**ENCS4380 Interfacing Techniques · Homework 2**  
Birzeit University · Dr. Wasel Ghanem

The PID Control Toolkit is an extension of our Homework 1 project. It allows users to explore feedback control systems and understand how proportional, integral, and derivative gains affect system performance. The toolkit includes four interactive modules covering PID control, sensor delays, digital PID implementation, and controller tuning.

## Team and Modules

| Module | Developer | Responsibilities |
|---|---|---|
| P1 · PID Playground | Aseel Nakhleh (1230736) | Adjust PID gains, plant parameters, and setpoint. Analyze the system response, control signal, rise time, overshoot, settling time, and steady-state error. |
| P2 · Slow Sensor in the Loop | Hala Tarifi (1230624) | Study how sensor time constant affects feedback control. Compare actual and measured outputs and observe overshoot and oscillations. |
| P3 · Digital PID | Samir Hazboun (1230807) | Explore digital PID control, sampling time, and anti-windup. Generate Arduino code using the selected controller parameters. |
| P4 · Tuning Challenge | Mohammad Abuadiyah (1220270) | Tune PID parameters for randomly generated systems, meet performance requirements, and evaluate results using PASS/FAIL checks and scores. |

### Module Files

The planned folder structure is:

| Module | Browser Entry Point |
|---|---|
| P1 | `https://aseelnakhleh.github.io/encs4380-dynamics-sparky/Homework2/AseelNakhleh1230736_P1/P1.html` |
| P2 | `` |
| P3 | `` |
| P4 | `` |


## Homework Validation

The following checks are required to verify the accuracy of the PID controller calculations.

| Check | Expected Result |
|---|---|
| 1 · P-only controller with K = 1, τ = 1 s, Kp = 9 | Closed-loop time constant = 0.1 s and steady-state error = 10% |
| 2 · PI controller with K = 1, τ = 1 s, Kp = 1, Ki = 1 | Natural frequency = 1 rad/s and damping ratio = 1 |
| 3 · PI controller with step input | Zero steady-state error under stable, unsaturated conditions |

Validation results will be displayed in the toolkit and documented after testing.

## Applying PID to Our Project

The toolkit also demonstrates how PID control can be applied to a real engineering system.

For our Micromouse project, PID control can be used to regulate motor speed. The motor model, controller parameters, and performance requirements will be selected using measured data.

The project application will include:

- Motor model and parameter values.
- Source of the model parameters.
- Selected performance requirements.
- Final PID gains.
- Simulated system response.
- Generated Arduino code.

## Live Website

The PID Control Toolkit will be integrated into the existing Team Sparky website under a new **Control** section.

**Website Link:** https://aseelnakhleh.github.io/encs4380-dynamics-sparky/

## AI Assistance

AI tools were used to help us understand PID control concepts and clarify some theoretical ideas related to the modules. The team members were responsible for developing and implementing their assigned modules.

## Screenshots and Validation Tests

Screenshots, validation tests, and test results for each part (P1–P4) are documented in its individual README file.


