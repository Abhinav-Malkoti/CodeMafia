# CODEMAFIA

> **Debug. Collaborate. Find the Impostor.**

CodeMafia is a browser-based multiplayer coding game built around **real-time collaborative code editing**, **shared game state**, **player presence**, and **in-browser Python execution**.

The project is currently in its **multiplayer/editor foundation phase**. The core infrastructure is working, while the actual Mafia game mechanics—roles, voting, scoring, impostor logic, and complete round progression—are planned for the next phase.

---

## 1. Project Overview

CodeMafia combines a collaborative code editor with a social-deduction game.

The intended gameplay experience is:

1. Players join the same game room.
2. Each player enters a name.
3. Connected players are shown as online.
4. Everyone shares the same code editor.
5. Players collaboratively debug the code.
6. Python code can be executed directly in the browser.
7. The host starts a game round.
8. Future versions will introduce hidden roles, an impostor, voting, scoring, and victory conditions.

### Current milestone

The following foundation is already implemented:

- Monaco code editor
- Python language editing
- Yjs shared document
- Real-time synchronization through y-websocket
- Shared collaborative code
- Player presence through Yjs Awareness
- Shared game state through Y.Map
- Host identification
- Host-only START action
- Waiting → Playing state transition
- Round initialization
- Pyodide Python execution
- Web Worker-based Python execution
- Run button state management
- Output/error display

---

# 2. Goals

## Primary Goal

Build a multiplayer coding environment where players can collaboratively debug code while participating in a Mafia-style social deduction game.

## Technical Goals

- Provide real-time collaborative editing.
- Keep all players in the same synchronized room.
- Display currently connected players.
- Maintain shared game state.
- Allow only the host to start the game.
- Execute Python locally in the browser.
- Keep Python execution separate from the main UI thread.
- Create a foundation that can later support roles, voting, scoring, and game rounds.

---

# 3. Current Architecture

```text
                         CODEMAFIA
                            │
                            ▼
                    ┌───────────────┐
                    │   index.html  │
                    │ HTML / UI     │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │    main.js    │
                    │ Application   │
                    │ Controller    │
                    └───────┬───────┘
                            │
             ┌──────────────┼──────────────┐
             │              │              │
             ▼              ▼              ▼
      ┌────────────┐ ┌─────────────┐ ┌──────────────┐
      │   Monaco   │ │    Yjs      │ │ Pyodide      │
      │   Editor   │ │ Collaboration│ │ Web Worker   │
      └─────┬──────┘ └──────┬──────┘ └──────────────┘
            │               │
            │               ▼
            │       ┌─────────────────┐
            └──────►│ MonacoBinding   │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ WebsocketProvider│
                    └────────┬────────┘
                             │
                             ▼
                    WebSocket Server
                       localhost:1234
                             │
                 ┌───────────┴───────────┐
                 ▼                       ▼
              Client A               Client B
```

---

# 4. Tech Stack

| Technology | Purpose |
|---|---|
| HTML5 | Application structure |
| CSS | UI styling |
| JavaScript / ES Modules | Application logic |
| Vite | Development server and build tooling |
| Monaco Editor | Browser code editor |
| Yjs | Shared CRDT-based application state |
| y-monaco | Monaco ↔ Yjs integration |
| y-websocket | Yjs WebSocket synchronization |
| Yjs Awareness | Player presence |
| Pyodide | Python runtime in the browser |
| Web Worker | Isolated Python execution |

---

# 5. Core Components

## 5.1 `index.html`

The main HTML entry point.

It provides the basic DOM structure used by the application.

Important elements include:

```html
<div id="app">
    <header>
        <div>
            <h1>CODEMAFIA</h1>
            <span>Debug. Collaborate. Find the Impostor.</span>
        </div>

        <button id="run-button">▶ RUN</button>
    </header>

    <main>
        <div id="editor"></div>

        <section id="output-panel">
            <div id="output-header">OUTPUT</div>
            <pre id="output"></pre>
        </section>
    </main>
</div>

<script type="module" src="/src/main.js"></script>
```

The complete game UI also needs the elements referenced by `main.js`, such as:

- `#player-list`
- `#game-status`
- `#round-title`
- `#round-info`
- `#start-button`

---

# 6. `main.js`

`main.js` is currently the main application controller.

It coordinates:

- Yjs
- WebSocket connection
- player identity
- player presence
- shared code
- shared game state
- Monaco
- Pyodide Worker
- START button
- RUN button
- UI updates

Conceptually:

```text
main.js
│
├── YJS SETUP
│
├── SHARED GAME STATE
│
├── PLAYER IDENTITY
│
├── PLAYER LIST
│
├── YJS DEBUG
│
├── GAME INITIALIZATION
│
├── GAME STATE OBSERVER
│
├── MONACO WEB WORKER
│
├── MONACO EDITOR
│
├── YJS ↔ MONACO BINDING
│
├── YJS CONNECTION
│
├── PYODIDE WORKER
│
├── WORKER MESSAGE HANDLING
│
└── BUTTON EVENTS
    ├── START
    └── RUN
```

---

# 7. Yjs Architecture

A Yjs document is created for every browser client:

```javascript
const doc = new Y.Doc();
```

The document contains two important shared structures.

```text
Y.Doc
│
├── Y.Text("code")
│
│     Shared Python source
│
└── Y.Map("gameState")
      │
      ├── status
      ├── host
      └── round
```

---

# 8. Shared Code

The collaborative editor uses:

```javascript
const sharedCode = doc.getText("code");
```

This is the shared source-code object.

The Monaco editor is connected to it through:

```javascript
const binding = new MonacoBinding(
    sharedCode,
    editor.getModel(),
    new Set([editor])
);
```

Therefore:

```text
Player types
      ↓
Monaco
      ↓
MonacoBinding
      ↓
Y.Text("code")
      ↓
Yjs update
      ↓
WebSocket
      ↓
Other client
      ↓
Other Y.Text
      ↓
Other Monaco editor
```

This is the core real-time collaboration workflow.

---

# 9. WebSocket Room

The project currently connects to:

```text
ws://localhost:1234
```

using:

```javascript
const provider = new WebsocketProvider(
    "ws://localhost:1234",
    "codemafia-room",
    doc
);
```

The room name is:

```text
codemafia-room
```

Every browser connecting to the same room participates in the same shared Yjs session.

---

# 10. Player Identity

When the application starts, the user is asked for a name:

```javascript
const playerName =
    prompt("Enter your player name:") || "Player";
```

That name is published through Yjs Awareness:

```javascript
provider.awareness.setLocalStateField("user", {
    name: playerName
});
```

This is currently a simple development identity system.

There is no authentication yet.

---

# 11. Player Presence

Player presence is handled using:

```javascript
provider.awareness
```

Whenever awareness changes:

```javascript
provider.awareness.on("change", () => {
    ...
});
```

The application collects all connected users:

```javascript
provider.awareness.getStates().forEach((state) => {
    if (state.user) {
        players.push(state.user.name);
    }
});
```

The UI can then render:

```text
🟢 Abhinav
🟢 Pandey
```

### Presence workflow

```text
Client joins
     ↓
Player enters name
     ↓
Awareness state published
     ↓
Other clients receive awareness update
     ↓
"change" event fires
     ↓
Player list rebuilt
```

During development this was verified through console output such as:

```text
PLAYERS ONLINE: ['Abhinav']

PLAYERS ONLINE: ['Abhinav', 'Pandey']

PLAYERS ONLINE: ['Abhinav']
```

The last state occurs when the second client disconnects.

---

# 12. Shared Game State

The game uses:

```javascript
const gameState = doc.getMap("gameState");
```

Current fields:

```text
gameState
├── status
├── host
└── round
```

Example:

```javascript
{
    status: "playing",
    host: "Abhinav",
    round: 1
}
```

---

# 13. Game Initialization

The application initializes the state only when a value does not already exist:

```javascript
if (!gameState.has("status")) {
    gameState.set("status", "waiting");
}

if (!gameState.has("host")) {
    gameState.set("host", playerName);
}
```

This is important because a second player joining should not overwrite the existing host.

### Initial state

```text
status = waiting
host   = first player
```

---

# 14. Game State Machine

The current game has two states:

```text
       ┌──────────────┐
       │   WAITING    │
       └──────┬───────┘
              │
          HOST START
              │
              ▼
       ┌──────────────┐
       │   PLAYING    │
       │   round = 1  │
       └──────────────┘
```

## Waiting

```text
status = "waiting"
```

UI:

```text
Waiting for host to start the game.
Waiting for game...
```

## Playing

```text
status = "playing"
round = 1
```

UI:

```text
Game in progress
ROUND 1
Debug the code and find the impostor.
```

---

# 15. Game State Observer

The application observes changes to the shared game state:

```javascript
gameState.observe(() => {
    ...
});
```

It reads:

```javascript
const status = gameState.get("status");
const round = gameState.get("round");
```

Then updates the UI.

This creates a reactive flow:

```text
Y.Map changes
      ↓
gameState.observe()
      ↓
read status / round
      ↓
update DOM
```

---

# 16. Host System

The host is stored in shared game state:

```javascript
gameState.get("host")
```

When START is clicked:

```javascript
const currentHost = gameState.get("host");
```

The current player is compared against the host:

```javascript
if (currentHost !== playerName) {
    console.log("Only the host can start the game.");
    return;
}
```

If the player is the host:

```javascript
gameState.set("status", "playing");
gameState.set("round", 1);
```

Therefore:

```text
START clicked
     ↓
Read shared host
     ↓
Is local player the host?
     │
 ┌───┴────┐
 NO       YES
 │         │
Reject     ▼
       status=playing
       round=1
```

---

# 17. Monaco Editor

The project uses Monaco Editor:

```javascript
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
```

Current configuration:

- Python language
- Dark theme
- Automatic layout
- Minimap disabled

---

# 18. Monaco Web Worker

The Monaco editor worker is imported using:

```javascript
import EditorWorker from
"monaco-editor/esm/vs/editor/editor.worker?worker";
```

Then configured:

```javascript
self.MonacoEnvironment = {
    getWorker() {
        return new EditorWorker();
    }
};
```

This allows Monaco's worker functionality to work correctly in the Vite environment.

---

# 19. Pyodide

Python execution is handled by Pyodide.

The application creates a dedicated worker:

```javascript
const pyodideWorker = new Worker(
    new URL("./pyodide.worker.js", import.meta.url),
    {
        type: "module"
    }
);
```

The Python runtime therefore does not execute directly in the main UI code.

---

# 20. Python Execution Workflow

```text
User clicks RUN
       ↓
Check pyodideReady
       ↓
Read editor.getValue()
       ↓
Show "Running..."
       ↓
postMessage()
       ↓
Pyodide Worker
       ↓
Execute Python
       ↓
Return message
       ↓
main.js
       ↓
Update #output
```

The message sent to the worker is:

```javascript
pyodideWorker.postMessage({
    type: "run",
    code: code
});
```

---

# 21. Worker Readiness

Initially:

```javascript
let pyodideReady = false;
```

RUN is disabled:

```javascript
runButton.disabled = true;
runButton.textContent = "Loading Python...";
```

When the worker sends:

```javascript
{
    type: "ready"
}
```

the application performs:

```javascript
pyodideReady = true;

output.textContent = "Python ready.";

runButton.disabled = false;
runButton.textContent = "▶ RUN";
```

This prevents the user from trying to execute Python before the runtime has loaded.

---

# 22. Worker Result Handling

A successful worker message contains:

```javascript
{
    type: "result",
    output: "...",
    result: "..."
}
```

The application combines the available values and displays them in:

```text
#output
```

Errors use:

```javascript
{
    type: "error",
    error: "..."
}
```

and are also displayed in the output panel.

---

# 23. Current Runtime Workflows

## 23.1 Application Startup

```text
index.html
    ↓
main.js
    ↓
Create Y.Doc
    ↓
Connect WebSocket
    ↓
Create gameState + sharedCode
    ↓
Ask player name
    ↓
Publish awareness
    ↓
Initialize game state if needed
    ↓
Create Monaco
    ↓
Bind Monaco ↔ Yjs
    ↓
Create Pyodide Worker
    ↓
Wait for ready
```

---

## 23.2 Player Joins

```text
Open application
      ↓
Enter name
      ↓
Awareness state created
      ↓
Provider broadcasts presence
      ↓
All clients receive update
      ↓
Player list changes
```

---

## 23.3 Collaborative Editing

```text
Player A edits
      ↓
Monaco
      ↓
Y.Text
      ↓
WebSocket
      ↓
Player B Y.Text
      ↓
Player B Monaco
```

---

## 23.4 Starting a Game

```text
Host clicks START
      ↓
Read gameState.host
      ↓
Validate local player
      ↓
status = playing
round = 1
      ↓
Yjs synchronization
      ↓
All clients observe state
      ↓
UI changes to ROUND 1
```

---

## 23.5 Running Python

```text
RUN
 ↓
Is Python ready?
 ↓
editor.getValue()
 ↓
Worker.postMessage()
 ↓
Pyodide executes
 ↓
result/error
 ↓
Output panel
```

---

# 24. Separation of Responsibilities

A key design principle of CodeMafia is separation of concerns.

| Responsibility | Component |
|---|---|
| Page structure | HTML |
| Styling | CSS |
| Application orchestration | `main.js` |
| Code editing | Monaco |
| Shared source | Y.Text |
| Shared game metadata | Y.Map |
| Real-time synchronization | y-websocket |
| Presence | Yjs Awareness |
| Monaco/Yjs connection | y-monaco |
| Python runtime | Pyodide |
| Python isolation | Web Worker |

This allows future game functionality to be added without rewriting the collaboration or execution foundation.

---

# 25. Current Data Model

```text
Y.Doc
│
├── "code"
│      Y.Text
│      └── Python source code
│
└── "gameState"
       Y.Map
       ├── status
       ├── host
       └── round

Awareness
│
└── user
       └── name
```

---

# 26. Current File Structure

A simplified representation of the current project is:

```text
CodeMafia/
│
├── index.html
│
├── src/
│   ├── main.js
│   ├── pyodide.worker.js
│   └── style.css
│
├── package.json
│
└── Vite configuration / project files
```

### `index.html`

Application UI and entry point.

### `src/main.js`

Main application controller.

### `src/pyodide.worker.js`

Python execution worker.

### `src/style.css`

Application styling.

### `package.json`

Project dependencies and npm scripts.

---

# 27. Development Environment

The current WebSocket configuration is:

```text
ws://localhost:1234
```

Therefore local development requires the Yjs WebSocket server to be available on port `1234`.

The frontend is run through the Vite development environment.

Use the project's `package.json` scripts for the exact npm commands.

---

# 28. Testing Checklist

## Collaboration

- [ ] Open Client A.
- [ ] Open Client B.
- [ ] Join both clients to `codemafia-room`.
- [ ] Enter different names.
- [ ] Verify both names appear.
- [ ] Disconnect Client B.
- [ ] Verify Client B disappears.
- [ ] Edit code in Client A.
- [ ] Verify Client B receives the same code.
- [ ] Edit code in Client B.
- [ ] Verify Client A receives the change.

## Python

- [ ] Wait for `Python ready.`
- [ ] Verify RUN becomes enabled.
- [ ] Run a simple Python print statement.
- [ ] Verify output appears.
- [ ] Run invalid Python.
- [ ] Verify the error appears.

## Game

- [ ] Initial state is waiting.
- [ ] Host is assigned.
- [ ] START is available to the host.
- [ ] Non-host cannot start.
- [ ] Host clicks START.
- [ ] Shared status becomes `playing`.
- [ ] Shared round becomes `1`.
- [ ] All clients observe the playing state.
- [ ] All clients display ROUND 1.

---

# 29. Current Limitations

The current implementation is a foundation and is not yet the complete game.

Not implemented yet:

- Role assignment
- Impostor selection
- Private role information
- Mafia mechanics
- Voting system
- Vote validation
- Vote resolution
- Scoring
- Timers
- Round countdown
- Multiple round progression
- Win/lose conditions
- End-game screen
- Player authentication
- Persistent user accounts
- Persistent game history
- Production WebSocket deployment
- Server-authoritative game validation
- Anti-cheating mechanisms

The host system is currently implemented at the client/shared-state level and should be strengthened with server-side authority before competitive gameplay is considered secure.

---

# 30. Planned Game Architecture

The current foundation can evolve into:

```text
                    CODEMAFIA GAME
                         │
                         ▼
                 ┌───────────────┐
                 │ GAME SESSION  │
                 └───────┬───────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
       Players          Roles         Round
          │              │              │
          │              ├── Citizen     ├── Challenge
          │              └── Impostor    ├── Debug
          │                             └── Timer
          │
          ▼
        Voting
          │
          ▼
    Vote Resolution
          │
          ▼
       Scoring
          │
          ▼
    Win Condition
```

---

# 31. Recommended Next Development Phase

The next major milestone should be the actual game engine.

### Phase 1 — Roles

Introduce:

```text
players
roles
impostor
```

The game should determine who the impostor is.

### Phase 2 — Private information

Players should only see information intended for them.

This will require more careful state design than the current public `gameState`.

### Phase 3 — Round challenges

Each round should have:

- Code
- Bug(s)
- Expected behavior
- Time limit
- Round metadata

### Phase 4 — Voting

Players choose who they believe is the impostor.

### Phase 5 — Vote resolution

The game calculates:

- Number of votes
- Suspected player
- Whether the impostor was correctly identified

### Phase 6 — Scoring

Players receive points according to the game rules.

### Phase 7 — Multiple rounds

Implement:

```text
ROUND 1
  ↓
ROUND 2
  ↓
ROUND 3
  ↓
...
```

### Phase 8 — Game completion

Implement:

```text
GAME OVER
   ↓
Winner
   ↓
Scores
   ↓
Replay / New Game
```

---

# 32. Important Design Direction

The current collaboration infrastructure should remain separate from the actual game rules.

The intended architecture is:

```text
              APPLICATION
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
 COLLABORATION LAYER     GAME ENGINE
        │                     │
        │                     ├── Roles
        │                     ├── Rounds
        │                     ├── Voting
        │                     ├── Scoring
        │                     └── Win Conditions
        │
        ├── Yjs
        ├── Awareness
        ├── Monaco
        └── WebSocket
```

This keeps the game logic understandable and prevents `main.js` from becoming an unmanageable monolithic file.

---

# 33. Security Considerations for Later

The current application is suitable for development and prototyping.

For production gameplay, important security improvements will be needed.

## Current issue

A client currently participates directly in shared state management.

For example:

```javascript
gameState.set("status", "playing");
```

A malicious client could potentially attempt similar writes.


## Dependencies & Required Libraries

CodeMafia currently uses a small set of npm packages. The easiest setup is to install them through npm rather than downloading library files manually.

### Prerequisites

Install the following before starting development:

- **Node.js** — required for the frontend build tooling and npm.
- **npm** — normally installed together with Node.js.
- **A modern browser** — Chrome, Edge, or Firefox is recommended.
- **A local WebSocket server** — required by `y-websocket` for real-time collaboration.

Check your installations:

```bash
node --version
npm --version
```

### NPM Dependencies

The current frontend requires:

| Package | Purpose |
|---|---|
| `monaco-editor` | Browser-based VS Code-style code editor |
| `yjs` | CRDT-based shared document/state synchronization |
| `y-monaco` | Connects Monaco Editor with a Yjs shared text document |
| `y-websocket` | Synchronizes Yjs documents between connected players through WebSockets |

Install them with:

```bash
npm install monaco-editor yjs y-monaco y-websocket
```

If the project is being created from scratch with Vite, a typical setup is:

```bash
npm create vite@latest codemafia -- --template vanilla
cd codemafia
npm install
npm install monaco-editor yjs y-monaco y-websocket
```

### Pyodide

CodeMafia also uses **Pyodide** to execute Python code in the browser.

The Python runtime is loaded by:

```text
src/pyodide.worker.js
```

Pyodide is intentionally executed inside a **Web Worker** so Python execution does not block the main UI/editor thread.

The exact Pyodide loading method and version should match the implementation in `pyodide.worker.js`. Do not install a second Python runtime on the server just for browser execution.

### WebSocket / Yjs Server

The frontend connects to:

```text
ws://localhost:1234
```

using:

```javascript
new WebsocketProvider(
    "ws://localhost:1234",
    "codemafia-room",
    doc
);
```

Therefore, the local Yjs WebSocket server must be running on port `1234` during development.

Install the WebSocket server package if it is not already present:

```bash
npm install y-websocket
```

Depending on the installed `y-websocket` version, start the server using the command provided by that version/package setup. The important requirement for the current CodeMafia frontend is:

```text
WebSocket endpoint: ws://localhost:1234
Room: codemafia-room
```

### Recommended `package.json` Dependencies

Your `package.json` should contain the equivalent of:

```json
{
  "dependencies": {
    "monaco-editor": "^latest",
    "yjs": "^latest",
    "y-monaco": "^latest",
    "y-websocket": "^latest"
  }
}
```

For a real project/repository, **commit the generated `package-lock.json`** as well. This locks the dependency tree so other developers can reproduce the same installation more reliably.

### Installation Workflow

For an existing CodeMafia repository:

```bash
git clone <repository-url>
cd CodeMafia
npm install
npm run dev
```

In a second terminal, start the required Yjs WebSocket server on port `1234`.

Then open the Vite development URL shown by the terminal, commonly:

```text
http://localhost:5173
```

### Important: What Does NOT Need to Be Installed Separately

These are already provided through npm/browser tooling and should not be manually downloaded as individual JavaScript files:

- Monaco Editor
- Yjs
- Y-Monaco
- Y-WebSocket

Likewise, you do **not** need to install Python locally merely to execute the CodeMafia editor's Python snippets if the current Pyodide worker is configured to load Pyodide in the browser.

### Dependency Architecture

```text
                    CODEMAFIA
                        │
             ┌──────────┴──────────┐
             │                     │
        Frontend Runtime       Collaboration
             │                     │
      ┌──────┼──────┐              │
      │      │      │              │
   Monaco   Yjs   Pyodide      y-websocket
      │      │      │              │
      │      │      └─ Web Worker  │
      │      │                     │
      └──────┴─────────────────────┘
             │
          Browser
             │
             ▼
      WebSocket Server
         localhost:1234
```

### Why Each Dependency Exists

**Monaco Editor**

Provides the actual coding environment. It gives CodeMafia syntax highlighting, editing, cursor management, models, and the editor experience.

**Yjs**

Acts as the shared state/synchronization layer. The current application uses:

```javascript
doc.getText("code")
```

for shared source code and:

```javascript
doc.getMap("gameState")
```

for shared game state.

**Y-Monaco**

Bridges Monaco and Yjs. This is what allows edits made inside one player's Monaco editor to become changes to the shared Yjs text.

**Y-WebSocket**

Provides network synchronization between browser clients through a WebSocket server. Multiple players joining the same room can therefore share the same Yjs document.

**Pyodide**

Provides a browser-based Python runtime. Code entered in Monaco is sent to the Pyodide Web Worker and executed without requiring a traditional backend Python execution server for the current prototype.

**Web Worker**

The worker itself is a browser API rather than an npm dependency. It isolates Python execution from the main UI thread.

---

## Dependency Verification Checklist

Before considering the development environment ready, verify:

```text
[ ] Node.js installed
[ ] npm installed
[ ] npm install completed successfully
[ ] monaco-editor installed
[ ] yjs installed
[ ] y-monaco installed
[ ] y-websocket installed
[ ] Pyodide worker loads successfully
[ ] Yjs WebSocket server is running
[ ] WebSocket server is listening on port 1234
[ ] Browser can connect to ws://localhost:1234
[ ] Monaco editor loads
[ ] Python worker reports "ready"
[ ] Two browser clients can join codemafia-room
[ ] Player awareness shows both players
[ ] Shared code changes appear in both clients
```


## Future architecture

A production game should consider:

```text
Browser
   │
   ▼
Game Server
   │
   ├── Validate host
   ├── Validate roles
   ├── Validate votes
   ├── Validate scoring
   └── Validate round transitions
```

The client should primarily request actions, while authoritative game rules should be enforced by the server.

---

# 34. Debugging

The current implementation intentionally contains detailed console logging.

Examples:

```text
PLAYER:
CLIENT ID:
ROOM:
INITIAL SHARED CODE:
YJS UPDATE:
YJS TEXT CHANGED:
PLAYERS ONLINE:
GAME STATE:
Yjs server:
Yjs synced:
MESSAGE FROM WORKER:
RUN BUTTON CLICKED:
CODE BEING SENT:
GAME STARTED
```

These logs are useful during development.

Later, they can be replaced by a debug utility:

```javascript
const DEBUG = true;

function debug(...args) {
    if (DEBUG) {
        console.log(...args);
    }
}
```

---

# 35. Success Criteria for the Current Milestone

The foundation milestone can be considered successful when:

```text
✓ Multiple clients connect
✓ Same room is used
✓ Player presence works
✓ Shared code works
✓ Monaco works
✓ Python executes
✓ Output works
✓ Game state is synchronized
✓ Host is recognized
✓ Host can start the game
✓ Round 1 is synchronized
```

Once these are stable, the project can move into the actual Mafia game implementation.

---

# 36. Project Status

### Current status: FOUNDATION COMPLETE / GAMEPLAY NEXT

```text
Frontend UI                  ██████████  Complete
Monaco Editor                ██████████  Complete
Yjs Collaboration            ██████████  Complete
Player Presence              ██████████  Complete
Shared Game State            ██████████  Complete
Python Execution             ██████████  Complete
Host / Start Flow            ██████████  Complete

Role System                  ░░░░░░░░░░  Next
Impostor Logic               ░░░░░░░░░░  Next
Voting                       ░░░░░░░░░░  Next
Scoring                      ░░░░░░░░░░  Next
Round Engine                 ░░░░░░░░░░  Next
Win Conditions               ░░░░░░░░░░  Next
Production Security          ░░░░░░░░░░  Later
```

---

# 37. Summary

CodeMafia currently has a working technical foundation for a multiplayer browser coding game.

The core architecture is:

```text
Monaco
   ↕
Yjs
   ↕
WebSocket
   ↕
Other Players

Y.Map
   ↓
Game State
   ↓
UI

Monaco
   ↓
Worker
   ↓
Pyodide
   ↓
Python Output
```

The most important achievement so far is that the project is no longer just a static code editor. It now has the beginnings of a real multiplayer game architecture:

- shared collaborative code,
- live player presence,
- shared game state,
- host control,
- synchronized round state,
- and local Python execution.

The next step is to build the **actual CodeMafia game engine** on top of this stable foundation.




\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

##Installation of dependencies 

Yes. For the **current CodeMafia implementation**, you need a relatively small dependency set.

### 1. Node.js

Install **Node.js 20 LTS** or newer LTS.

Check:

```bash
node -v
npm -v
```

Recommended:

```text
Node.js: 20.x LTS
npm: 10.x+
```

---

## 2. Create the project

If you are starting from scratch:

```bash
npm create vite@latest codemafia
```

Choose:

```text
Framework: Vanilla
Variant: JavaScript
```

Then:

```bash
cd codemafia
npm install
```

---

# 3. Install the frontend libraries

Your current `main.js` imports these libraries:

```js
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import * as Y from "yjs";
import { MonacoBinding } from "y-monaco";
import { WebsocketProvider } from "y-websocket";
```

Install all four:

```bash
npm install monaco-editor yjs y-monaco y-websocket
```

### Recommended versions

For the current project, pin the versions rather than allowing npm to automatically change major versions:

```bash
npm install monaco-editor@0.52.2 yjs@13.6.27 y-monaco@0.1.6 y-websocket@2.0.4
```

Your `package.json` should then contain approximately:

```json
{
  "dependencies": {
    "monaco-editor": "0.52.2",
    "y-monaco": "0.1.6",
    "y-websocket": "2.0.4",
    "yjs": "13.6.27"
  }
}
```

The exact versions in your existing project should take precedence if you've already installed and tested them successfully.

---

# 4. Vite

Vite is the development/build system we're using.

If you created the project with:

```bash
npm create vite@latest codemafia
```

Vite is already installed.

Check:

```bash
npm list vite
```

If needed:

```bash
npm install -D vite
```

---

# 5. Yjs WebSocket server

This is **very important**.

Your frontend currently connects to:

```js
const provider = new WebsocketProvider(
    "ws://localhost:1234",
    "codemafia-room",
    doc
);
```

That means CodeMafia expects a **Yjs WebSocket server running on port `1234`**.

Install the server package:

```bash
npm install -g y-websocket
```

Then run:

```bash
HOST=localhost PORT=1234 npx y-websocket
```

On Windows PowerShell, use:

```powershell
$env:HOST="localhost"
$env:PORT="1234"
npx y-websocket
```

Your architecture is currently:

```text
Browser 1
   │
   │ WebSocket
   ▼
Yjs WebSocket Server
localhost:1234
   ▲
   │ WebSocket
   │
Browser 2
```

Both browsers connect to:

```text
codemafia-room
```

---

# 6. Pyodide

We are using **Pyodide inside a Web Worker** to execute Python in the browser.

Your project has:

```js
const pyodideWorker = new Worker(
    new URL("./pyodide.worker.js", import.meta.url),
    {
        type: "module"
    }
);
```

The important distinction is:

> **Pyodide is not currently an npm dependency in the same way Monaco/Yjs are.**

The `pyodide.worker.js` file is responsible for loading Pyodide.

For example, the worker can load Pyodide from the official distribution.

So you need to make sure your project contains:

```text
src/
├── main.js
├── pyodide.worker.js
└── style.css
```

If your existing `pyodide.worker.js` already works and the console shows:

```text
MESSAGE FROM WORKER:
{type: 'ready'}
```

**do not change it right now.**

That's already proof that your Pyodide worker is loading correctly.

---

# 7. Monaco worker

You already have:

```js
import EditorWorker from
"monaco-editor/esm/vs/editor/editor.worker?worker";
```

and:

```js
self.MonacoEnvironment = {
    getWorker() {
        return new EditorWorker();
    }
};
```

This is why we installed:

```bash
npm install monaco-editor
```

No separate Monaco server is required.

The browser runs Monaco locally.

---

# 8. Complete installation command

If you're setting up CodeMafia on a **new machine**, the main commands are:

```bash
npm install
```

Then, if the dependencies aren't already in `package.json`:

```bash
npm install monaco-editor@0.52.2 yjs@13.6.27 y-monaco@0.1.6 y-websocket@2.0.4
```

Then install the Yjs server:

```bash
npm install -g y-websocket
```

---

# 9. Complete dependency table

| Dependency    |                 Version | Purpose                           |
| ------------- | ----------------------: | --------------------------------- |
| Node.js       |                20.x LTS | Runtime / development environment |
| npm           |                   10.x+ | Package manager                   |
| Vite          | current project version | Development server + bundler      |
| Monaco Editor |                `0.52.2` | Browser code editor               |
| Yjs           |               `13.6.27` | CRDT-based shared state           |
| y-monaco      |                 `0.1.6` | Connects Monaco with Yjs          |
| y-websocket   |                 `2.0.4` | WebSocket synchronization         |
| Pyodide       |           worker-loaded | Executes Python in browser        |

---

# 10. Commands to run CodeMafia

You need **two terminals**.

### Terminal 1 — Yjs server

```bash
HOST=localhost PORT=1234 npx y-websocket
```

Windows PowerShell:

```powershell
$env:HOST="localhost"
$env:PORT="1234"
npx y-websocket
```

Keep this terminal running.

---

### Terminal 2 — CodeMafia frontend

```bash
npm run dev
```

Vite will give you something similar to:

```text
Local: http://localhost:5173/
```

Open:

```text
http://localhost:5173
```

---

# 11. For another computer on the same network

This is something we'll need later when testing actual multiplayer.

Currently you have:

```js
"ws://localhost:1234"
```

`localhost` means:

> **this same computer**

So two browser windows on your computer can connect successfully.

But if you want:

```text
Laptop A
      \
       \
        Wi-Fi
         \
       Laptop B
```

then Laptop B cannot use:

```text
ws://localhost:1234
```

because that means **Laptop B itself**.

We'll eventually change it to something like:

```js
ws://192.168.1.10:1234
```

where `192.168.1.10` is the machine running the Yjs server.

**Don't change this yet** if we're still developing locally.

---

# 12. Recommended `package.json`

For the project we've built so far, I'd keep it roughly like this:

```json
{
  "name": "codemafia",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "monaco-editor": "0.52.2",
    "y-monaco": "0.1.6",
    "y-websocket": "2.0.4",
    "yjs": "13.6.27"
  },
  "devDependencies": {
    "vite": "^6.0.0"
  }
}
```

**However:** don't overwrite your existing `package.json` blindly. If your current project is already working, keep its existing Vite version and lockfile.

---

# 13. `node_modules` and `package-lock.json`

For GitHub, **do not commit `node_modules`**.

Your `.gitignore` should contain:

```gitignore
node_modules/
dist/
.env
.DS_Store
```

You **should commit**:

```text
package.json
package-lock.json
```

This is important because someone cloning your repository can simply run:

```bash
npm install
```

and get the dependency versions recorded by the lockfile.

---

# 14. Fresh clone workflow

Eventually your README should allow someone to do:

```bash
git clone <your-repository>
cd codemafia
npm install
```

Then start the Yjs server:

```bash
HOST=localhost PORT=1234 npx y-websocket
```

And in another terminal:

```bash
npm run dev
```

That's the complete current development setup.

### Current CodeMafia architecture

```text
                     CODEMAFIA
                         │
             ┌───────────┴───────────┐
             │                       │
        FRONTEND                  YJS SERVER
        Vite                     WebSocket
             │                    :1234
             │                       │
      ┌──────┼────────┐              │
      │      │        │              │
   Monaco   Yjs    Pyodide           │
    Editor   │      Worker            │
      │      │        │              │
      │      └────────┼──────────────┘
      │               │
      │        Shared Game State
      │               │
      └───────────────┘
```

And the three major things we've successfully established so far are:

```text
1. Monaco
   ↓
   Browser code editor

2. Yjs + WebSocket
   ↓
   Real-time shared code
   ↓
   Player presence
   ↓
   Shared game state

3. Pyodide Worker
   ↓
   Python execution
   ↓
   Output displayed in browser
```

So **don't install a bunch of additional libraries yet**. We have the core foundation we need. The next dependencies should only be added when we implement the actual Mafia game mechanics, voting, timers, backend/game validation, authentication, etc.

