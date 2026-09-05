# CodeMafia 🕵️‍♂️💻

Welcome to **CodeMafia**, a high-performance, server-authoritative multiplayer collaborative debugging and social deduction platform. 

This repository houses a secure, scalable, and cheat-resistant platform where developers collaborate to repair broken Python code in real-time, while trying to deduce who among them is the **Impostor** secretly sabotaging their efforts.

---

## 🚀 Architectural Vision: "Server Decides, Client Renders"

Unlike traditional collaborative code editors that rely on peer-to-peer syncing (like Yjs/CRDTs) where any player can modify the shared state via browser developer tools, CodeMafia utilizes a strict **server-authoritative model**. 

* **The Server Owns:** Player identities, room partitions, lobbies, canonical code state, role distribution, and game phases.
* **The Client Owns:** UI rendering, keyboard inputs, and secure local execution.

---

## 🛠️ Tech Stack

* **Backend:** Python 3.12, FastAPI (high-performance modular monolith)
* **Real-Time Networking:** WebSockets (low-latency, bidirectional JSON event payloads)
* **Frontend:** HTML5, CSS3, Vanilla ES6 JavaScript (zero React/framework overhead)
* **Code Editor:** Monaco Editor (the core engine behind VS Code)
* **Client-Side Python Engine:** Pyodide (Python compiled to WebAssembly) running inside isolated background Web Worker threads

---

## 📈 Current Development Progress

We have systematically executed the first three phases of our production roadmap, turning a peer-to-peer prototype into a highly secured collaborative workspace.

### Phase 1: Local Editor Sandbox (Completed)
* **Monaco Editor Integration:** Embedded a rich code editor with syntax highlighting, auto-indentation, and a professional dark mode (`vs-dark`) layout.
* **Wasm Python Execution:** Integrated **Pyodide** to run user-submitted code directly inside the browser using WebAssembly. This establishes a **"Zero-RCE" (Remote Code Execution) posture**—malicious scripts run sandboxed in the user's tab and can never compromise the server.
* **Isolated Web Worker Threads:** Moved heavy compilation and execution tasks to a background browser worker (`pyodide.worker.js`). If a user accidentally triggers an infinite loop (e.g., `while True: pass`), the main thread stays **100% responsive**, preventing browser tab freezes.

### Phase 2: FastAPI WebSocket Room Infrastructure (Completed)
* **Lobby Isolation & Partitioning:** Programmed dynamic `GameRoom` partitions in FastAPI memory. Activity in Room A has zero performance or data overlap with Room B.
* **Automatic Host Assignment:** The first player to connect to an empty room is instantly granted administrative privileges (the Room Host).
* **Self-Healing Host Re-election:** If the Host disconnects, the FastAPI backend instantly detects the closed socket, re-evaluates the active lobby roster, nominates the next active player as the Host, and broadcasts the updated status to all clients.
* **Sanitized Unique Usernames:** Prevents connection collisions. If "Alice" is in a room and another player tries to join as "Alice", the server automatically appends a suffix (e.g., "Alice (1)") to protect state integrity.

### Phase 3: Simple Debounced Collaborative Sync (Completed)
* **150ms Keyboard Debouncer:** Clients queue and buffer edits as they type, sending updates to the server *only* after a 150ms pause in typing. This reduces network packet volume by over **90%** compared to character-by-character live sharing.
* **Echo-Free Broadcasting:** When a player updates code, the server registers it and broadcasts the change to everyone in the room **except** the typing player. This prevents cursor lag and input echo.
* **Cursor & Selection Anchoring:** Leverages Monaco's native `.executeEdits()` with `forceMoveMarkers: true` and an edit-lock mechanism. Code synchronization merges programmatically without resetting the local user's cursor position or wiping out their Monaco Undo/Redo stack.

---

## 🏃‍♂️ How to Run the App Locally

Since the application is fully integrated, you can spin up the server and run multiple client tabs side-by-side to watch the real-time synchronization in action.

### 1. Start the FastAPI Backend Server
Navigate to the root directory of your project, ensure you have python installed, and run:

```bash
# Install dependencies
pip install fastapi uvicorn

# Spin up the server on port 8000
uvicorn server_main:app --reload --port 8000
```
*You can verify the backend is active by opening `http://localhost:8000/` in your browser. You will see an online status confirmation payload.*

### 2. Start the Frontend Development Server
Open a new terminal window, navigate to your frontend directory, and run:

```bash
cd frontend

# Install package dependencies
npm install

# Run the local Vite dev server
npm run dev
```
*Open the provided Vite URL (typically `http://localhost:5173/`) in your browser.*

### 3. Test Multiplayer Sync Side-by-Side
1. Open **Tab A** (Normal window) and join Room `mafia-test` as **Alice**. Notice that Alice receives the Host crown (👑).
2. Open **Tab B** (Incognito window) and join Room `mafia-test` as **Bob**. Alice and Bob should instantly see each other in their lobbies.
3. Type some Python code inside Alice's editor. Within a fraction of a second of Alice pausing, Bob's editor will seamlessly update with the new script while keeping his cursor intact!
4. Click **`▶ RUN CODE`** on either window to compile and execute your Python code safely and locally in the browser using WebAssembly.
