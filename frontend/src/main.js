import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import * as Y from "yjs";
import { MonacoBinding } from "y-monaco";
import { WebsocketProvider } from "y-websocket";
import "./style.css";;


// ===============================
// YJS SETUP
// ===============================

const doc = new Y.Doc();

const provider = new WebsocketProvider(
    "ws://localhost:1234",
    "codemafia-room",
    doc
);


// ===============================
// SHARED GAME STATE
// ===============================

const gameState = doc.getMap("gameState");
const sharedCode = doc.getText("code");


// ===============================
// PLAYER IDENTITY
// ===============================

const playerName =
    prompt("Enter your player name:") || "Player";

provider.awareness.setLocalStateField("user", {
    name: playerName
});

console.log("PLAYER:", playerName);


// ===============================
// PLAYER LIST
// ===============================

provider.awareness.on("change", () => {

    const players = [];

    provider.awareness.getStates().forEach((state) => {

        if (state.user) {
            players.push(state.user.name);
        }

    });

    console.log("PLAYERS ONLINE:", players);

    const playerList =
        document.getElementById("player-list");

    if (!playerList) {
        return;
    }

    playerList.innerHTML = "";

    players.forEach((player) => {

        const playerElement =
            document.createElement("div");

        playerElement.textContent = `🟢 ${player}`;

        playerList.appendChild(playerElement);

    });

});


// ===============================
// YJS DEBUG
// ===============================

console.log("CLIENT ID:", doc.clientID);
console.log("ROOM:", provider.roomname);
console.log(
    "INITIAL SHARED CODE:",
    sharedCode.toString()
);

sharedCode.observe((event) => {

    console.log(
        "YJS UPDATE:",
        sharedCode.toString(),
        "ORIGIN:",
        event.transaction.origin
    );

});

console.log(
    "INITIAL YJS TEXT:",
    sharedCode.toString()
);

sharedCode.observe(() => {

    console.log(
        "YJS TEXT CHANGED:",
        sharedCode.toString()
    );

});

if (!gameState.has("status")) {
    gameState.set("status", "waiting");
}

if (!gameState.has("host")) {
    gameState.set("host", playerName);
}


// ===============================
// GAME STATE DEBUG (OBSERVER)
// ===============================

gameState.observe(() => {

    const status = gameState.get("status");
    const round = gameState.get("round");

    console.log(
        "GAME STATE:",
        Object.fromEntries(gameState.entries())
    );

    const gameStatus =
        document.getElementById("game-status");

    const roundTitle =
        document.getElementById("round-title");

    const roundInfo =
        document.getElementById("round-info");


    if (status === "waiting") {

        gameStatus.textContent =
            "Waiting for host to start the game.";

        roundTitle.textContent =
            "Waiting for game...";

        roundInfo.textContent = "";

    }


    if (status === "playing") {

        gameStatus.textContent =
            "Game in progress";

        roundTitle.textContent =
            `ROUND ${round}`;

        roundInfo.textContent =
            "Debug the code and find the impostor.";

    }

});




// ===============================
// MONACO WEB WORKER
// ===============================

self.MonacoEnvironment = {
    getWorker() {
        return new EditorWorker();
    }
};


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

// ===============================
// sync handler
// ===============================

provider.on("sync", (isSynced) => {

    console.log("Yjs synced:", isSynced);

    if (!isSynced) {
        return;
    }


    console.log(
        "GAME STATUS:",
        gameState.get("status")
    );

    console.log(
        "GAME HOST:",
        gameState.get("host")
    );

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

    runButton.disabled = false;
    runButton.textContent = "▶ RUN";

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

const startButton = document.getElementById("start-button");

startButton.addEventListener("click", () => {

    const currentHost = gameState.get("host");

    if (currentHost !== playerName) {
        console.log("Only the host can start the game.");
        return;
    }

    gameState.set("status", "playing");
    gameState.set("round", 1);

    console.log("GAME STARTED");
});

runButton.disabled = true;
runButton.textContent = "Loading Python...";

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