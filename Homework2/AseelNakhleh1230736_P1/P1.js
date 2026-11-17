// ============================================
// 1. GET HTML ELEMENTS
// ============================================

const plantType = document.getElementById("plantType");

const gainSlider = document.getElementById("gain");
const tauSlider = document.getElementById("tau");

const omegaNSlider = document.getElementById("omegaN");
const zetaSlider = document.getElementById("zeta");

const kpSlider = document.getElementById("kp");
const kiSlider = document.getElementById("ki");
const kdSlider = document.getElementById("kd");

const setpointSlider = document.getElementById("setpoint");

const firstOrderParameters =
    document.getElementById("firstOrderParameters");

const secondOrderParameters =
    document.getElementById("secondOrderParameters");



const prediction = document.getElementById("prediction");

const savePrediction =
    document.getElementById("savePrediction");

const checkPrediction =
    document.getElementById("checkPrediction");

const predictionResult =
    document.getElementById("predictionResult");

// ============================================
// 2. SIMULATION SETTINGS
// ============================================

const DT = 0.001;
const SIMULATION_TIME = 30;
const U_MIN = -10;
const U_MAX = 10;
const SETTLING_BAND = 0.02;

// ============================================
// 3. HELPER FUNCTIONS
// ============================================

function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
}

function getParameters() {

    return {
        type: plantType.value,

        K: parseFloat(gainSlider.value),

        tau: parseFloat(tauSlider.value),

        omegaN: parseFloat(omegaNSlider.value),

        zeta: parseFloat(zetaSlider.value),

        kp: parseFloat(kpSlider.value),

        ki: parseFloat(kiSlider.value),

        kd: parseFloat(kdSlider.value),

        setpoint: parseFloat(setpointSlider.value)
    };
}

// ============================================
// 4. UPDATE SLIDER VALUES
// ============================================

function updateSliderValues() {

    const p = getParameters();

    document.getElementById("gainValue")
        .textContent = p.K.toFixed(1);

    document.getElementById("tauValue")
        .textContent = p.tau.toFixed(1) + " s";

    document.getElementById("omegaNValue")
        .textContent = p.omegaN.toFixed(1) + " rad/s";

    document.getElementById("zetaValue")
        .textContent = p.zeta.toFixed(1);

    document.getElementById("kpValue")
        .textContent = p.kp.toFixed(1);

    document.getElementById("kiValue")
        .textContent = p.ki.toFixed(1);

    document.getElementById("kdValue")
        .textContent = p.kd.toFixed(1);

    document.getElementById("setpointValue")
        .textContent = p.setpoint.toFixed(1);
}

// ============================================
// 5. PLANT SELECTION
// ============================================

function updatePlantSelection() {

    if (plantType.value === "first") {

        firstOrderParameters.style.display = "block";

        secondOrderParameters.style.display = "none";

    } else {

        firstOrderParameters.style.display = "none";

        secondOrderParameters.style.display = "block";
    }
}

// ============================================
// 6. PID SIMULATION
// ============================================

function simulatePID(p) {

    const time = [];
    const output = [];
    const reference = [];
    const control = [];

    let y = 0;
    let velocity = 0;

    let integral = 0;

    let previousY = 0;
    let previousTime = 0;

    const steps = Math.round(SIMULATION_TIME / DT);

    for (let i = 0; i <= steps; i++) {

        const t = i * DT;

        // Step input is applied at t = 0
        const r = p.setpoint;

     
        const error = r - y;

        
        const derivativeMeasurement =
            i === 0 ? 0 : (y - previousY) / DT;

     
        const P = p.kp * error;

        // Derivative term
        const D = -p.kd * derivativeMeasurement;


        const proposedIntegral =
            integral + error * DT;

    
        const proposedU =
            P + p.ki * proposedIntegral + D;

        const pushingUpper =
            proposedU > U_MAX && error > 0;

        const pushingLower =
            proposedU < U_MIN && error < 0;

        if (!pushingUpper && !pushingLower) {
            integral = proposedIntegral;
        }

   
        const rawU =
            P + p.ki * integral + D;

        const u = clamp(rawU, U_MIN, U_MAX);

        time.push(t);
        output.push(y);
        reference.push(r);
        control.push(u);

        previousY = y;
        previousTime = t;

        
        if (p.type === "first") {


            const dydt =
                (p.K * u - y) / p.tau;

            y += DT * dydt;

        } else {

            

            const acceleration =
                p.omegaN * p.omegaN *
                (p.K * u - y)
                - 2 * p.zeta * p.omegaN * velocity;

            // Euler integration
            y += DT * velocity;

            velocity += DT * acceleration;
        }

       
        if (!Number.isFinite(y) ||
            !Number.isFinite(velocity)) {
            break;
        }
    }

    return {
        time,
        output,
        reference,
        control,
        finalOutput: output[output.length - 1]
    };
}

// ============================================
// 7. PERFORMANCE METRICS
// ============================================

function calculateMetrics(data, setpoint) {

    const { time, output } = data;

    if (output.length < 2 || setpoint <= 0) {
        return null;
    }

    

    let t10 = null;
    let t90 = null;

    for (let i = 0; i < output.length; i++) {

        if (t10 === null &&
            output[i] >= 0.1 * setpoint) {
            t10 = time[i];
        }

        if (t90 === null &&
            output[i] >= 0.9 * setpoint) {
            t90 = time[i];
        }
    }

    const riseTime =
        t10 !== null && t90 !== null
            ? t90 - t10
            : null;

    
    const maximumOutput = Math.max(...output);

    const overshoot = Math.max(
        0,
        ((maximumOutput - setpoint) / setpoint) * 100
    );


    const tolerance =
        SETTLING_BAND * Math.abs(setpoint);

    let lastOutsideIndex = -1;

    for (let i = 0; i < output.length; i++) {

        if (Math.abs(output[i] - setpoint) > tolerance) {
            lastOutsideIndex = i;
        }
    }

    let settlingTime = null;

    if (lastOutsideIndex < output.length - 1) {

        settlingTime =
            lastOutsideIndex < 0
                ? 0
                : time[lastOutsideIndex + 1];
    }

 

    const finalOutput =
        output[output.length - 1];

    const steadyStateError =
        setpoint - finalOutput;

    return {
        riseTime,
        overshoot,
        settlingTime,
        steadyStateError
    };
}

// ============================================
// 8. RESPONSE PLOT
// ============================================

function updateResponsePlot(data) {

    const traces = [
        {
            x: data.time,
            y: data.reference,
            mode: "lines",
            name: "Setpoint",
            line: {
                color: "#f59e0b",
                width: 3,
                dash: "dash"
            }
        },
        {
            x: data.time,
            y: data.output,
            mode: "lines",
            name: "System Output",
            line: {
                color: "#3949ab",
                width: 3
            }
        }
    ];

    const layout = {

        title: "Closed-Loop Step Response",

        xaxis: {
            title: "Time (s)",
            rangemode: "tozero"
        },

        yaxis: {
            title: "Amplitude"
        },

        legend: {
            orientation: "h",
            y: -0.3
        },

        margin: {
            l: 65,
            r: 25,
            t: 65,
            b: 90
        },

        paper_bgcolor: "#ffffff",
        plot_bgcolor: "#ffffff"
    };

    Plotly.react(
        "responsePlot",
        traces,
        layout,
        {
            responsive: true,
            displaylogo: false
        }
    );
}

// ============================================
// 9. CONTROL SIGNAL PLOT
// ============================================

function updateControlPlot(data) {

    const upperLimit =
        data.time.map(() => U_MAX);

    const lowerLimit =
        data.time.map(() => U_MIN);

    const traces = [
        {
            x: data.time,
            y: data.control,
            mode: "lines",
            name: "Control Signal u(t)",
            line: {
                color: "#2563eb",
                width: 3
            }
        },
        {
            x: data.time,
            y: upperLimit,
            mode: "lines",
            name: "Upper Limit",
            line: {
                color: "#dc2626",
                dash: "dash",
                width: 2
            }
        },
        {
            x: data.time,
            y: lowerLimit,
            mode: "lines",
            name: "Lower Limit",
            line: {
                color: "#dc2626",
                dash: "dash",
                width: 2
            }
        }
    ];

    const layout = {

        title: "PID Control Signal",

        xaxis: {
            title: "Time (s)"
        },

        yaxis: {
            title: "Control Signal u(t)"
        },

        legend: {
            orientation: "h",
            y: -0.3
        },

        margin: {
            l: 65,
            r: 25,
            t: 65,
            b: 90
        },

        paper_bgcolor: "#ffffff",
        plot_bgcolor: "#ffffff"
    };

    Plotly.react(
        "controlPlot",
        traces,
        layout,
        {
            responsive: true,
            displaylogo: false
        }
    );

    document.getElementById("controlLimitInfo")
        .textContent =
        `Control signal limits: ${U_MIN} to ${U_MAX}`;
}

// ============================================
// 10. DISPLAY PERFORMANCE METRICS
// ============================================

function updateMetrics(metrics) {

    if (!metrics) {
        return;
    }

    document.getElementById("riseTime")
        .textContent =
        metrics.riseTime === null
            ? "Not reached"
            : metrics.riseTime.toFixed(3) + " s";

    document.getElementById("overshoot")
        .textContent =
        metrics.overshoot.toFixed(2) + "%";

    document.getElementById("settlingTime")
        .textContent =
        metrics.settlingTime === null
            ? "Not settled"
            : metrics.settlingTime.toFixed(3) + " s";

    document.getElementById("steadyStateError")
        .textContent =
        metrics.steadyStateError.toFixed(4);
}

// ============================================
// 11. VALIDATION TESTS
// ============================================

function runValidationTests() {

    const pOnly = {
        type: "first",
        K: 1,
        tau: 1,
        omegaN: 2,
        zeta: 0.7,
        kp: 9,
        ki: 0,
        kd: 0,
        setpoint: 1
    };

    const pi = {
        ...pOnly,
        kp: 1,
        ki: 1
    };

    const pData = simulatePID(pOnly);
    const piData = simulatePID(pi);

    // Measure P-only response
    const pFinal = pData.finalOutput;

    const target632 =
        pFinal * (1 - Math.exp(-1));

    let measuredTau = null;

    for (let i = 1; i < pData.output.length; i++) {

        if (pData.output[i] >= target632) {

            const y1 = pData.output[i - 1];
            const y2 = pData.output[i];

            const t1 = pData.time[i - 1];
            const t2 = pData.time[i];

            const fraction =
                (target632 - y1) / (y2 - y1);

            measuredTau =
                t1 + fraction * (t2 - t1);

            break;
        }
    }

    const measuredPError =
        Math.abs(1 - pFinal);

    // PI theoretical characteristics
    const naturalFrequency =
        Math.sqrt(pi.K * pi.ki / pi.tau);

    const dampingRatio =
        (1 + pi.K * pi.kp) /
        (2 * Math.sqrt(
            pi.tau * pi.K * pi.ki
        ));

    // PI simulated steady-state error
    const measuredPIError =
        Math.abs(1 - piData.finalOutput);

    const tests = [
        {
            name: "P-only: Time Constant",
            expected: "0.100 s",
            calculated: measuredTau === null
                ? "Not reached"
                : measuredTau.toFixed(4) + " s",
            passed: measuredTau !== null &&
                Math.abs(measuredTau - 0.1) < 0.005
        },
        {
            name: "P-only: Steady-State Error",
            expected: "10.0%",
            calculated:
                (measuredPError * 100).toFixed(2) + "%",
            passed:
                Math.abs(measuredPError - 0.1) < 0.005
        },
        {
            name: "PI: Natural Frequency",
            expected: "1.000 rad/s",
            calculated:
                naturalFrequency.toFixed(3) + " rad/s",
            passed:
                Math.abs(naturalFrequency - 1) < 0.001
        },
        {
            name: "PI: Damping Ratio",
            expected: "1.000",
            calculated: dampingRatio.toFixed(3),
            passed:
                Math.abs(dampingRatio - 1) < 0.001
        },
        {
            name: "PI: Steady-State Error",
            expected: "Approximately 0",
            calculated:
                measuredPIError.toFixed(6),
            passed: measuredPIError < 0.001
        }
    ];

    document.getElementById("validationResults")
        .innerHTML = tests.map(test => `
            <tr>
                <td>${test.name}</td>
                <td>${test.expected}</td>
                <td>${test.calculated}</td>
                <td class="${test.passed ? "pass" : "fail"}">
                    ${test.passed ? "PASS" : "FAIL"}
                </td>
            </tr>
        `).join("");
}

// ============================================
// 12. PREDICT, THEN CHECK
// ============================================

let savedPrediction = "";
let predictionBaseline = null;

savePrediction.addEventListener("click", () => {

    if (prediction.value === "") {

        predictionResult.textContent =
            "Please choose a prediction first.";

        predictionResult.style.color = "#d97706";

        return;
    }

    savedPrediction = prediction.value;

    const p = getParameters();

    const data = simulatePID(p);

    predictionBaseline =
        Math.abs(p.setpoint - data.finalOutput);

    // Start the experiment at the current Ki.
    predictionResult.textContent =
        "Prediction saved! Now increase Ki, " +
        "observe the plot, then click Check Prediction.";

    predictionResult.style.color = "#243b72";

    checkPrediction.disabled = false;
});

checkPrediction.addEventListener("click", () => {

    if (savedPrediction === "" ||
        predictionBaseline === null) {

        predictionResult.textContent =
            "Save your prediction first.";

        return;
    }

    const p = getParameters();

    const data = simulatePID(p);

    const newError =
        Math.abs(p.setpoint - data.finalOutput);

    
    const tolerance = 1e-4;

    let observedResult = "same";

    if (newError < predictionBaseline - tolerance) {
        observedResult = "decrease";
    } else if (newError > predictionBaseline + tolerance) {
        observedResult = "increase";
    }

    if (savedPrediction === observedResult) {

        predictionResult.textContent =
            "Correct! Your prediction matches the " +
            "observed simulation. " +
            `Initial error: ${predictionBaseline.toFixed(4)}, ` +
            `new error: ${newError.toFixed(4)}.`;

        predictionResult.style.color = "#16a34a";

    } else {

        predictionResult.textContent =
            "Your prediction does not match the " +
            "observed simulation. " +
            `Initial error: ${predictionBaseline.toFixed(4)}, ` +
            `new error: ${newError.toFixed(4)}.`;

        predictionResult.style.color = "#dc2626";
    }

    // Allow another experiment without refreshing.
    savedPrediction = "";
    predictionBaseline = null;
    prediction.value = "";
    checkPrediction.disabled = true;
});

// ============================================
// 13. UPDATE EVERYTHING
// ============================================

function updateEverything() {

    updateSliderValues();

    updatePlantSelection();

    const p = getParameters();

    const data = simulatePID(p);

    const metrics =
        calculateMetrics(data, p.setpoint);

    updateResponsePlot(data);

    updateControlPlot(data);

    updateMetrics(metrics);
}

// ============================================
// 14. EVENT LISTENERS
// ============================================

const sliders = [
    gainSlider,
    tauSlider,
    omegaNSlider,
    zetaSlider,
    kpSlider,
    kiSlider,
    kdSlider,
    setpointSlider
];

sliders.forEach(slider => {

    slider.addEventListener("input", updateEverything);

});

plantType.addEventListener(
    "change",
    updateEverything
);

// ============================================
// 15. INITIALIZE
// ============================================

updateEverything();

runValidationTests();