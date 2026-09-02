import { loadPyodide, version as pyodideVersion } from "pyodide";

let pyodide = null;
let pyodideReady = false;

async function initialize() {
    console.log("PYODIDE WORKER STARTED");
    console.log("LOADING PYODIDE...");

    pyodide = await loadPyodide({
        indexURL: `https://cdn.jsdelivr.net/pyodide/v${pyodideVersion}/full/`
    });

    pyodideReady = true;

    console.log("PYODIDE LOADED");

    self.postMessage({
        type: "ready"
    });
}

initialize();

self.onmessage = async (event) => {
    console.log("WORKER RECEIVED:", event.data);

    const { type, code } = event.data;

    if (type === "run") {
        if (!pyodideReady) {
            self.postMessage({
                type: "error",
                error: "Python is still loading."
            });

            return;
        }

        try {
            const result = await pyodide.runPythonAsync(code);

            self.postMessage({
                type: "result",
                result: String(result)
            });
        } catch (error) {
            self.postMessage({
                type: "error",
                error: error.toString()
            });
        }
    }
};