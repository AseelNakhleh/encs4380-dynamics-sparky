
const tauSlider = document.getElementById("tau");
const omegaSlider = document.getElementById("omega");

// ========================================
// 1. Frequency Response Calculations
// ========================================

function response(tau, omega) {

    const M = 1 / Math.sqrt(1 + (omega * tau) ** 2);

    const phase = -Math.atan(omega * tau);

    return { M, phase };
}

// ========================================
// 2. Update Results and Graphs
// ========================================

function update() {

    const tau = Number(tauSlider.value);
    const omega = Number(omegaSlider.value);

    const { M, phase } = response(tau, omega);

    const cutoff = 1 / tau;

    // Display slider values

    document.getElementById("tauValue").textContent =
        tau.toFixed(2);

    document.getElementById("omegaValue").textContent =
        omega.toFixed(1);

    // Display calculated results

    document.getElementById("M").textContent =
        M.toFixed(4);

    document.getElementById("phase").textContent =
        (phase * 180 / Math.PI).toFixed(2) + "°";

    document.getElementById("cutoff").textContent =
        cutoff.toFixed(3) + " rad/s";

    document.getElementById("error").textContent =
        ((M - 1) * 100).toFixed(2) + "%";

    // ========================================
    // 3. Dynamic-Error Calculator
    // ========================================

    const f = Number(
        document.getElementById("errorFrequency").value
    );

    const calcM = response(tau, 2 * Math.PI * f).M;

    document.getElementById("calculatedError").textContent =
        ((calcM - 1) * 100).toFixed(2) + "%";

    // ========================================
    // 4. Input and Output Sine Waves
    // ========================================

    const t = [];
    const input = [];
    const output = [];

   
for (let i = 0; i <= 1000; i++) {
    const time = i * 10 / 1000;


        t.push(time);

        input.push(
            Math.sin(omega * time)
        );

        output.push(
            M * Math.sin(omega * time + phase)
        );
    }

    if (typeof Plotly === "undefined") {
        console.error("Plotly did not load.");
        return;
    }

    const config = {
        responsive: true
    };

    Plotly.react("sinePlot", [

        {
            x: t,
            y: input,
            name: "Input",
            mode: "lines",
            line: {
                color: "blue",
                width: 3
            }
        },

        {
            x: t,
            y: output,
            name: "Output",
            mode: "lines",
            line: {
                color: "orange",
                width: 3
            }
        }

    ], {

        title: {
            text: "Input and Output Sine Waves"
        },

        xaxis: {
            title: "Time (s)"
        },

        yaxis: {
            title: "Amplitude"
        },

        margin: {
            t: 50
        }

    }, config);

    // ========================================
    // 5. Bode Plot Calculations
    // ========================================

    const frequencies = [];
    const magnitude = [];
    const phases = [];

    for (let i = 0; i <= 200; i++) {

        const w = cutoff * Math.pow(
            10,
            -2 + 4 * i / 200
        );

        const r = response(tau, w);

        frequencies.push(w);

        magnitude.push(
            20 * Math.log10(r.M)
        );

        phases.push(
            r.phase * 180 / Math.PI
        );
    }

    // ========================================
    // 6. Bode Magnitude Plot
    // ========================================

    Plotly.react("bodeMagnitude", [

        {
            x: frequencies,
            y: magnitude,
            mode: "lines",
            name: "Magnitude",
            line: {
                color: "blue",
                width: 3
            }
        }

    ], {

        title: {
            text: "Bode Magnitude"
        },

        
xaxis: {
    title: "Frequency (rad/s)",
    type: "log",
    dtick: 1
},


        yaxis: {
            title: "Magnitude (dB)"
        },

        // Red dashed cutoff-frequency line

        shapes: [{
            type: "line",

            x0: cutoff,
            x1: cutoff,

            y0: -45,
            y1: 5,

            line: {
                color: "red",
                dash: "dash",
                width: 2
            }
        }],

        // Corrected cutoff-frequency annotation

        annotations: [{
            x: Math.log10(cutoff),
            y: -3.0103,

            xref: "x",
            yref: "y",

            text:
                `ωc = ${cutoff.toFixed(2)} rad/s<br>-3.01 dB`,

            showarrow: true,
            arrowhead: 2,

            ax: 80,
            ay: -55,

            bgcolor: "white",
            bordercolor: "gray",
            borderwidth: 1,

            font: {
                size: 13,
                color: "black"
            }
        }]

    }, config);

    // ========================================
    // 7. Bode Phase Plot
    // ========================================

    Plotly.react("bodePhase", [

        {
            x: frequencies,
            y: phases,
            mode: "lines",
            name: "Phase",
            line: {
                color: "blue",
                width: 3
            }
        }

    ], {

        title: {
            text: "Bode Phase"
        },

       
xaxis: {
    title: "Frequency (rad/s)",
    type: "log",
    dtick: 1
},


        yaxis: {
            title: "Phase (degrees)",
            range: [-95, 5]
        },

        // Red dashed cutoff-frequency line

        shapes: [{
            type: "line",

            x0: cutoff,
            x1: cutoff,

            y0: -95,
            y1: 5,

            line: {
                color: "red",
                dash: "dash",
                width: 2
            }
        }],

        // Corrected cutoff-frequency annotation

        annotations: [{
            x: Math.log10(cutoff),
            y: -45,

            xref: "x",
            yref: "y",

            text:
                `ωc = ${cutoff.toFixed(2)} rad/s<br>-45°`,

            showarrow: true,
            arrowhead: 2,

            ax: 80,
            ay: -55,

            bgcolor: "white",
            bordercolor: "gray",
            borderwidth: 1,

            font: {
                size: 13,
                color: "black"
            }
        }]

    }, config);
}

// ========================================
// 8. Module 2 Validation Tests
// ========================================

function runValidationTests() {

    // Test 1:
    // tau = 0.2 s
    // omega = 2 rad/s

    const r1 = response(0.2, 2);

    const phase1 = Math.abs(
        r1.phase * 180 / Math.PI
    );

    // Test 2:
    // Maximum dynamic error = 5%
    // Maximum frequency = 100 Hz

    const tauMax =
        Math.sqrt(1 / 0.95 ** 2 - 1) /
        (2 * Math.PI * 100);

    // Phase lag at 50 Hz

    const phase50 = Math.abs(
        response(tauMax, 2 * Math.PI * 50).phase *
        180 / Math.PI
    );

    // Expected and calculated results

    const tests = [

        ["Amplitude Ratio", 0.93, r1.M, 0.01],

        ["Phase Lag (°)", 21.8, phase1, 0.1],

        ["Maximum τ (ms)", 0.52, tauMax * 1000, 0.02],

        ["Phase at 50 Hz (°)", 9.3, phase50, 0.1]

    ];

    let html =
        "<h2>7. Module 2 Validation Tests</h2>";

    html +=
        "<table border='1' cellpadding='10'>";

    html +=
        "<tr><th>Test</th><th>Expected</th>" +
        "<th>Calculated</th><th>Result</th></tr>";

    tests.forEach(
        ([name, expected, calculated, tolerance]) => {

            const passed =
                Math.abs(expected - calculated) <= tolerance;

            html += `
                <tr>
                    <td>${name}</td>
                    <td>${expected}</td>
                    <td>${calculated.toFixed(3)}</td>
                    <td>${passed ? "PASS" : "FAIL"}</td>
                </tr>
            `;
        }
    );

    html += "</table>";

    document.getElementById("validation").innerHTML =
        html;
}


// ========================================
// 9. Predict, Then Check
// ========================================

const predictionSelect =
    document.getElementById("prediction");

const saveButton =
    document.getElementById("savePrediction");

const checkButton =
    document.getElementById("checkPrediction");

const predictionResult =
    document.getElementById("predictionResult");

let initialOmega;
let initialM;
let savedPrediction;

// Step 1: Save the user's prediction

saveButton.addEventListener("click", function () {

    if (predictionSelect.value === "") {
        predictionResult.textContent =
            "Please select a prediction first.";
        return;
    }

    initialOmega = Number(omegaSlider.value);

    if (initialOmega >= Number(omegaSlider.max)) {
        predictionResult.textContent =
            "Please lower the frequency slider first.";
        return;
    }

    const tau = Number(tauSlider.value);

    initialM = response(tau, initialOmega).M;

    savedPrediction = predictionSelect.value;

    // Lock tau so only frequency changes
    tauSlider.disabled = true;

    predictionSelect.disabled = true;
    saveButton.disabled = true;
    checkButton.disabled = false;

    predictionResult.textContent =
        "Prediction saved! Now increase the " +
        "frequency slider and click Check Prediction.";
});

// Step 2: Check the actual result

checkButton.addEventListener("click", function () {

    const newOmega = Number(omegaSlider.value);

    if (newOmega <= initialOmega) {
        predictionResult.textContent =
            "Please increase the input frequency first.";
        return;
    }

    const tau = Number(tauSlider.value);

    const newM = response(tau, newOmega).M;

    // Determine what happened
    let actualResult;

    if (newM < initialM - 0.000001) {
        actualResult = "decrease";
    } else if (newM > initialM + 0.000001) {
        actualResult = "increase";
    } else {
        actualResult = "same";
    }

    // Compare the user's guess with the actual result
    if (savedPrediction === actualResult) {

        predictionResult.textContent =
            "Correct! Amplitude ratio changed from " +
            initialM.toFixed(4) + " to " +
            newM.toFixed(4) + ". " +
            "Increasing frequency decreases the output amplitude.";

    } else {

        predictionResult.textContent =
            "Incorrect. Amplitude ratio changed from " +
            initialM.toFixed(4) + " to " +
            newM.toFixed(4) + ". " +
            "Increasing frequency decreases the output amplitude.";
    }

    // Allow another prediction
    tauSlider.disabled = false;
    predictionSelect.disabled = false;
    saveButton.disabled = false;
    checkButton.disabled = true;

});


// ========================================
// 10. Slider Event Listeners
// ========================================

tauSlider.addEventListener("input", update);

omegaSlider.addEventListener("input", update);

document.getElementById("errorFrequency")
    .addEventListener("input", update);

// ========================================
// 11. Run Everything
// ========================================

runValidationTests();

update();
