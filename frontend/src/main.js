import * as monaco from "monaco-editor";
import * as Y from "yjs";
import { MonacoBinding } from "y-monaco";
import { WebsocketProvider } from "y-websocket";
import "./style.css";


// ===============================
// YJS SETUP
// ===============================

const doc = new Y.Doc();

const provider = new WebsocketProvider(
    "ws://localhost:1234",
    "codemafia-room",
    doc
);

const sharedCode = doc.getText("code");

console.log("CLIENT ID:", doc.clientID);
console.log("ROOM:", provider.roomname);
console.log("INITIAL SHARED CODE:", sharedCode.toString());

sharedCode.observe((event) => {
    console.log(
        "YJS UPDATE:",
        sharedCode.toString(),
        "ORIGIN:",
        event.transaction.origin
    );
});

console.log("ROOM: codemafia-room");
console.log("INITIAL YJS TEXT:", sharedCode.toString());

sharedCode.observe(() => {
    console.log("YJS TEXT CHANGED:", sharedCode.toString());
});




// ===============================
// MONACO EDITOR
// ===============================

const editor = monaco.editor.create(
    document.getElementById("editor"),
    {
        value: "",
        language: "python",
        theme: "vs-dark",
        automaticLayout: true,
        minimap: {
            enabled: false
        }
    }
);


// ===============================
// YJS ↔ MONACO BINDING
// ===============================

const binding = new MonacoBinding(
    sharedCode,
    editor.getModel(),
    new Set([editor])
);


// ===============================
// YJS CONNECTION
// ===============================

provider.on("status", (event) => {
    console.log("Yjs server:", event.status);
});

//sync handler
provider.on("sync", (isSynced) => {
    console.log("Yjs synced:", isSynced);
});

// ===============================
// OUTPUT
// ===============================

const output = document.getElementById("output");


// ===============================
// PYODIDE WORKER
// ===============================

const pyodideWorker = new Worker(
    new URL("./pyodide.worker.js", import.meta.url),
    {
        type: "module"
    }
);

let pyodideReady = false;


// ===============================
// WORKER MESSAGES
// ===============================

pyodideWorker.onmessage = (event) => {

    const message = event.data;

    console.log("MESSAGE FROM WORKER:", message);


    if (message.type === "ready") {

        pyodideReady = true;

        output.textContent = "Python ready.";

        return;
    }


    if (message.type === "result") {

        let finalOutput = message.output || "";

        if (message.result !== "undefined") {
            finalOutput += message.result;
        }

        output.textContent = finalOutput;

        return;
    }


    if (message.type === "error") {

        output.textContent = message.error;

        return;
    }
};


// ===============================
// RUN BUTTON
// ===============================

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