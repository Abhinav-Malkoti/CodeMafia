import * as monaco from 'monaco-editor';
import './style.css';

// =====================================================================
// APPLICATION STATE VARIABLES
// =====================================================================
let ws = null;                  // Active WebSocket instance
let editor = null;              // Monaco Editor instance
let isIncomingUpdate = false;   // Lock to prevent typing feedback loops
let codeDebounceTimeout = null; // Typing buffer timer

let currentUsername = "";
let roomID = "";
let isHost = false;
let currentPhase = "waiting";

// Establish a dedicated background worker thread to run Pyodide (isolated compilation)
const pyodideWorker = new Worker(new URL('./pyodide.worker.js', import.meta.url), { type: 'module' });

// =====================================================================
// 1. MONACO EDITOR INITIALISATION & KEYBOARD DEBOUNCING (PHASE 1 & 3)
// =====================================================================
function initEditor() {
    const editorContainer = document.getElementById('editor');
    if (!editorContainer) return;

    editor = monaco.editor.create(editorContainer, {
        value: `# Welcome to CodeMafia!\n# Collaborate to debug and find the Impostor.\n\ndef add(a, b):\n    return a + b\n`,
        language: 'python',
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: 'on',
        cursorBlinking: 'smooth'
    });

    // --- PHASE 3: CLIENT-SIDE KEYBOARD DEBOUNCER ---
    editor.onDidChangeModelContent(() => {
        // If this edit was triggered by a server broadcast, do NOT sync it back
        if (isIncomingUpdate) return;

        // Reset the timer. We wait for 150ms of typing silence before pushing to FastAPI
        clearTimeout(codeDebounceTimeout);
        codeDebounceTimeout = setTimeout(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                const updatedCode = editor.getValue();
                ws.send(JSON.stringify({
                    type: 'code_update',
                    code: updatedCode
                }));
                console.log("Pushed debounced code edit to server.");
            }
        }, 150); // 150ms debounce window
    });
}

// --- PHASE 3: CURSOR & SELECTION ANCHORING ---
function applyServerCode(newCode) {
    if (!editor) return;
    const currentCode = editor.getValue();
    if (currentCode === newCode) return;

    // Set the sync lock so our change listener ignores this programmatic update
    isIncomingUpdate = true;

    const model = editor.getModel();
    editor.pushUndoStop(); // Capture the state in Monaco's Undo stack

    // Use executeEdits to replace text. This is high-performance and anchors cursors
    editor.executeEdits("server-sync", [{
        range: model.getFullModelRange(),
        text: newCode,
        forceMoveMarkers: true // Moves cursor markers relatively so they don't jump to top
    }]);

    editor.pushUndoStop();

    // Release the sync lock
    isIncomingUpdate = false;
}

// =====================================================================
// 2. WEBSOCKET NETWORKING ROUTER (PHASE 2 & 3)
// =====================================================================
function connectToGame(selectedUsername, selectedRoom) {
    currentUsername = selectedUsername;
    roomID = selectedRoom;

    // Connect to your FastAPI WebSocket endpoint (defaulting to port 8000)
    const socketUrl = `ws://localhost:8000/ws/${roomID}`;
    ws = new WebSocket(socketUrl);

    ws.onopen = () => {
        console.log(`WebSocket connected to Room: ${roomID}`);
        // Immediately register identity on joining the channel
        ws.send(JSON.stringify({
            type: "join",
            username: currentUsername
        }));
    };

    ws.onmessage = (event) => {
        let message;
        try {
            message = JSON.parse(event.data);
        } catch (e) {
            console.error("Failed to parse socket message:", event.data);
            return;
        }

        switch (message.type) {
            case "room_state":
                handleRoomStateUpdate(message);
                break;
                
            // --- PHASE 3: RECEIVING SERVER SYNCED CODE ---
            case "code_synced":
                applyServerCode(message.code);
                break;
                
            case "error":
                alert(`Game Server Error: ${message.message}`);
                break;
            default:
                console.log("Other message type received:", message);
        }
    };

    ws.onclose = () => {
        console.warn("Disconnected from the game server.");
        alert("Connection closed. Reload to reconnect.");
    };

    ws.onerror = (err) => {
        console.error("WebSocket error:", err);
    };
}

// =====================================================================
// 3. RECEIVING SERVER-AUTHORITATIVE STATE & UI REDRAW (PHASE 2)
// =====================================================================
function handleRoomStateUpdate(payload) {
    currentPhase = payload.status; 
    const activePlayers = payload.players || [];
    const hostName = payload.host;
    
    // Check if the server has designated YOU as the host
    isHost = (hostName === currentUsername);

    // Redraw the player list panel
    updateLobbyUI(activePlayers, hostName);

    // Dynamic initial code sync when a player joins a room late
    if (payload.code !== undefined) {
        applyServerCode(payload.code);
    }

    // Toggle the START GAME button based on Host permissions
    const startBtn = document.getElementById("start-btn");
    if (startBtn) {
        if (currentPhase === "waiting") {
            startBtn.style.display = "block";
            startBtn.disabled = !isHost;
            startBtn.textContent = isHost ? "START GAME" : "Waiting for Host...";
        } else {
            startBtn.style.display = "none";
        }
    }
}

function updateLobbyUI(players, host) {
    const playerContainer = document.getElementById("player-list");
    if (!playerContainer) return;

    playerContainer.innerHTML = "";
    players.forEach(playerName => {
        const card = document.createElement("div");
        card.className = "player-card";
        
        let label = playerName;
        if (playerName === host) {
            label += " 👑 [Host]";
        }
        if (playerName === currentUsername) {
            label += " (You)";
        }

        card.textContent = label;
        playerContainer.appendChild(card);
    });
}

// =====================================================================
// 4. EVENT HANDLERS & MOUNT (PHASE 1)
// =====================================================================
document.addEventListener("DOMContentLoaded", () => {
    // Initialise Monaco Editor
    initEditor();

    // Collect Player Credentials to establish room connection
    const usernameInput = prompt("Enter your Player Name:", "Player_" + Math.floor(Math.random() * 1000));
    const roomInput = prompt("Enter Game Room ID:", "codemafia-room");

    if (usernameInput && roomInput) {
        connectToGame(usernameInput.trim(), roomInput.trim());
    } else {
        alert("Both Name and Room ID are required to join the game.");
    }

    // Connect Pyodide isolated code runner trigger button
    const runBtn = document.getElementById("run-btn");
    const outputConsole = document.getElementById("output");

    if (runBtn && outputConsole) {
        runBtn.addEventListener("click", () => {
            if (!editor) return;
            outputConsole.textContent = "Running standard tests on client...\n";
            const sourceCode = editor.getValue();
            pyodideWorker.postMessage({ code: sourceCode });
        });
    }
});

// Capture run output from Pyodide thread
pyodideWorker.onmessage = (event) => {
    const outputConsole = document.getElementById("output");
    if (!outputConsole) return;

    const { results, error } = event.data;
    if (error) {
        outputConsole.textContent = `Execution Error:\n${error}`;
    } else {
        outputConsole.textContent = `Execution Complete:\n${results}`;
    }
};