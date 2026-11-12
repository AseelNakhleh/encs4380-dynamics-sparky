
const gainSlider = document.getElementById("gain");
const tauSlider = document.getElementById("tau");
const inputType = document.getElementById("inputType");

const gainValue = document.getElementById("gainValue");
const tauValue = document.getElementById("tauValue");

const analysisText = document.getElementById("analysisText");

// =====================================
// 1. SENSOR RESPONSE GRAPH
// =====================================

function updateGraph() {
    const K = parseFloat(gainSlider.value);
    const tau = parseFloat(tauSlider.value);
    const type = inputType.value;

    gainValue.textContent = K.toFixed(1);
    tauValue.textContent = tau.toFixed(1) + " s";

    const time = [];
    const input = [];
    const output = [];
    const idealOutput = [];

    const maxTime = 8 * tau;
    const points = 400;

    for (let i = 0; i <= points; i++) {
        const t = (i / points) * maxTime;

        let x, y;

        if (type === "step") {
            x = 1;
            y = K * (1 - Math.exp(-t / tau));
        } else {
            x = t;
            y = K * (
                t - tau * (1 - Math.exp(-t / tau))
            );
        }

        time.push(t);
        input.push(x);
        output.push(y);
        idealOutput.push(K * x);
    }

    const traces = [
        {
            x: time,
            y: input,
            mode: "lines",
            name: "Input x(t)",
            line: {
                color: "#f59e0b",
                width: 3,
                dash: "dash"
            }
        },
        {
            x: time,
            y: output,
            mode: "lines",
            name: "Sensor Output y(t)",
            line: {
                color: "#3949ab",
                width: 4
            }
        }
    ];

    if (type === "step") {
        traces.push({
            x: [tau, 3 * tau],
            y: [
                K * (1 - Math.exp(-1)),
                K * (1 - Math.exp(-3))
            ],
            mode: "markers+text",
            name: "Response Markers",
            text: ["63.2%", "95%"],
            textposition: "top center",
            marker: {
                color: "#e11d48",
                size: 12
            }
        });
    } else {
        traces.push({
            x: time,
            y: idealOutput,
            mode: "lines",
            name: "Ideal Output Kx(t)",
            line: {
                color: "#16a34a",
                width: 2,
                dash: "dot"
            }
        });
    }

    const layout = {
        title: type === "step"
            ? "First-Order Step Response"
            : "First-Order Ramp Response",

        xaxis: {
            title: "Time (s)",
            rangemode: "tozero"
        },

        yaxis: {
            title: "Amplitude",
            rangemode: "tozero"
        },

        legend: {
            orientation: "h",
            y: -0.25
        },

        margin: {
            l: 65,
            r: 25,
            t: 65,
            b: 90
        },

        paper_bgcolor: "#ffffff",
        plot_bgcolor: "#ffffff",

        uirevision: "response-" + K + "-" + tau + "-" + type
    };

    Plotly.react("responsePlot", traces, layout, {
        responsive: true,
        displaylogo: false
    });

    updateAnalysis(K, tau, type);

    // Show logarithmic error only for step input
    const logSection =
        document.getElementById("logErrorSection");

    logSection.style.display =
        type === "step" ? "block" : "none";
}

// =====================================
// 2. RESPONSE ANALYSIS
// =====================================

function updateAnalysis(K, tau, type) {
    if (type === "step") {
        const yTau = K * (1 - Math.exp(-1));
        const y3Tau = K * (1 - Math.exp(-3));

        analysisText.innerHTML = `
            <strong>Step Response Analysis</strong><br><br>

            Time Constant (τ):
            ${tau.toFixed(2)} s<br>

            Final Output:
            ${K.toFixed(3)}<br>

            Output at t = τ:
            ${yTau.toFixed(3)} (63.2%)<br>

            Output at t = 3τ:
            ${y3Tau.toFixed(3)} (95.0%)
        `;
    } else {
        const steadyStateError = K * tau;

        analysisText.innerHTML = `
            <strong>Ramp Response Analysis</strong><br><br>

            Time Constant (τ):
            ${tau.toFixed(2)} s<br>

            Ramp Lag:
            ${tau.toFixed(2)} s<br>

            Steady-State Error:
            ${steadyStateError.toFixed(3)}
        `;
    }
}

// =====================================
// 3. LOGARITHMIC ERROR GRAPH
// =====================================

function updateErrorGraph() {
    const tau = parseFloat(tauSlider.value);

    const time = [];
    const errorFraction = [];

    for (let i = 0; i <= 200; i++) {
        const t = (i / 200) * 8 * tau;

        time.push(t);
        errorFraction.push(Math.exp(-t / tau));
    }

    const trace = {
        x: time,
        y: errorFraction,
        type: "scatter",
        mode: "lines",
        name: "Error Fraction",
        line: {
            color: "#e11d48",
            width: 3
        }
    };

    const layout = {
        title: "First-Order Error Fraction",

        xaxis: {
            title: "Time (s)"
        },

        yaxis: {
            title: "Error Fraction (Log Scale)",
            type: "log"
        },

        margin: {
            l: 75,
            r: 25,
            t: 65,
            b: 65
        },

        paper_bgcolor: "#ffffff",
        plot_bgcolor: "#ffffff",

        uirevision: "error-" + tau
    };

    Plotly.react("errorPlot", [trace], layout, {
        responsive: true,
        displaylogo: false
    });

    const slope = -1 / tau;

    document.getElementById("errorInfo").innerHTML = `
        <strong>Time Constant (τ):</strong>
        ${tau.toFixed(2)} s<br>

        <strong>Natural Logarithmic Slope:</strong>
        ${slope.toFixed(3)} s⁻¹
    `;
}

// =====================================
// 4. PREDICT, THEN CHECK
// =====================================

const prediction = document.getElementById("prediction");
const checkPrediction = document.getElementById("checkPrediction");
const predictionResult = document.getElementById("predictionResult");

checkPrediction.addEventListener("click", function () {
    if (prediction.value === "") {
        predictionResult.textContent =
            "Please select an answer first.";

        predictionResult.style.color = "#d97706";

    } else if (prediction.value === "slower") {
        predictionResult.textContent =
            "Correct! Increasing τ makes the sensor respond more slowly.";

        predictionResult.style.color = "#16a34a";

    } else {
        predictionResult.textContent =
            "Not quite! A larger τ means a slower sensor response.";

        predictionResult.style.color = "#dc2626";
    }
});

// =====================================
// 5. VALIDATION CHECKS
// =====================================

function updateValidation() {
    const K = parseFloat(gainSlider.value);
    const tau = parseFloat(tauSlider.value);

    const finalOutput = K;

    const atTau = K * (1 - Math.exp(-1));
    const at3Tau = K * (1 - Math.exp(-3));

    const percentageTau = (atTau / finalOutput) * 100;
    const percentage3Tau = (at3Tau / finalOutput) * 100;

    const tests = [
        {
            name: "Step at t = τ",
            expected: 63.2,
            calculated: percentageTau
        },
        {
            name: "Step at t = 3τ",
            expected: 95.0,
            calculated: percentage3Tau
        }
    ];

    let html = "";

    tests.forEach(test => {
        const passed =
            Math.abs(test.calculated - test.expected) < 0.1;

        html += `
            <tr>
                <td>${test.name}</td>
                <td>${test.expected.toFixed(1)}%</td>
                <td>${test.calculated.toFixed(3)}%</td>
                <td class="${passed ? "pass" : "fail"}">
                    ${passed ? "PASS" : "FAIL"}
                </td>
            </tr>
        `;
    });

    document.getElementById("validationResults").innerHTML = html;
}

// =====================================
// 6. EVENT LISTENERS
// =====================================

gainSlider.addEventListener("input", () => {
    updateGraph();
    updateValidation();
});

tauSlider.addEventListener("input", () => {
    updateGraph();
    updateErrorGraph();
    updateValidation();
});

inputType.addEventListener("change", () => {
    updateGraph();
});

// =====================================
// 7. INITIALIZE EVERYTHING
// =====================================

updateGraph();
updateErrorGraph();
updateValidation();
