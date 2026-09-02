import * as monaco from "monaco-editor";
import "./style.css";

const editor = monaco.editor.create(
    document.getElementById("editor"),
    {
        value: `def solve(nums):
    total = 0

    for x in nums:
        total += x

    return total
`,
        language: "python",
        theme: "vs-dark",
        automaticLayout: true,
        minimap: {
            enabled: false
        }
    }
);

// Get output panel
const output = document.getElementById("output");



// Create the Pyodide Web Worker
const pyodideWorker = new Worker(
    new URL("./pyodide.worker.js", import.meta.url),
    {
        type: "module"
    }
);

// Track Pyodide state
let pyodideReady = false;

// Listen for messages from the worker
pyodideWorker.onmessage = (event) => {
    console.log("MESSAGE FROM WORKER:", event.data);

    const message = event.data;

    if (message.type === "ready") {
        pyodideReady = true;
        output.textContent = "Python ready.";
    }

    if (message.type === "result") {
        output.textContent = message.result;
    }

    if (message.type === "error") {
        output.textContent = message.error;
    }
};


// Run button logic

const runButton = document.getElementById("run-button");

runButton.addEventListener("click", () => {
    console.log("RUN BUTTON CLICKED");

    if (!pyodideReady) {
        output.textContent = "Python is still loading...";
        return;
    }

    const code = editor.getValue();

    console.log("CODE BEING SENT:", code);

    output.textContent = "Running...";

    pyodideWorker.postMessage({
        type: "run",
        code: code
    });
});