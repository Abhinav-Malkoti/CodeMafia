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



// Create the Pyodide Web Worker
const pyodideWorker = new Worker(
    new URL("./pyodide.worker.js", import.meta.url),
    {
        type: "module"
    }
);

// Listen for messages from the worker
pyodideWorker.onmessage = (event) => {
    console.log("Worker message:", event.data);

    if (event.data.type === "ready") {
        pyodideWorker.postMessage({
            type: "run",
            code: "'Hello CodeMafia'"
        });
    }
};