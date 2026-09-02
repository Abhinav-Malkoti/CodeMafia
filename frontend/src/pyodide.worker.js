import { loadPyodide, version as pyodideVersion } from "pyodide";

let pyodide = null;

async function initialize() {
    pyodide = await loadPyodide({
    indexURL: `https://cdn.jsdelivr.net/pyodide/v${pyodideVersion}/full/`
});

    self.postMessage({
        type: "ready"
    });
}

initialize();

self.onmessage = async (event) => {
    const { type, code } = event.data;

    if (type === "run") {
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