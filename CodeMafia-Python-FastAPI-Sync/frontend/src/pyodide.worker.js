import { loadPyodide, version as pyodideVersion } from "pyodide";

let pyodide = null;
let pyodideReady = false;

// Initialize the Pyodide WebAssembly runtime inside the Web Worker
async function initialize() {
    try {
        pyodide = await loadPyodide({
            indexURL: `https://cdn.jsdelivr.net/pyodide/v${pyodideVersion}/full/`
        });
        pyodideReady = true;
        console.log("Pyodide Wasm environment fully loaded inside Worker thread.");
    } catch (e) {
        console.error("Failed to load Pyodide runtime inside Worker:", e);
    }
}
initialize();

// Listen for execution commands from the main thread
self.onmessage = async (event) => {
    const { code } = event.data;

    if (!pyodideReady) {
        self.postMessage({
            error: "Python execution engine is still loading. Please wait a moment."
        });
        return;
    }

    try {
        let stdoutBuffer = "";

        // Capture python print statement outputs dynamically
        pyodide.setStdout({
            batched: (text) => {
                stdoutBuffer += text + "\n";
            }
        });

        // Run client's code asynchronously
        const evalResult = await pyodide.runPythonAsync(code);
        let finalOutput = stdoutBuffer;

        // If there's an evaluation return value (and it's not None/undefined), append it
        if (evalResult !== undefined && String(evalResult) !== "None") {
            finalOutput += String(evalResult);
        }

        // Post combined run results back to main thread
        self.postMessage({
            results: finalOutput || "Code executed successfully with no output."
        });

    } catch (error) {
        self.postMessage({
            error: error.toString()
        });
    }
};