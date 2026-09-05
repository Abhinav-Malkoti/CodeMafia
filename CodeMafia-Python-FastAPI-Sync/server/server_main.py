import json
import logging
from typing import Dict, List, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

# =====================================================================
# SYSTEM LOGGING & APPLICATION SETUP
# =====================================================================
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("CodeMafiaServer")

app = FastAPI(title="CodeMafia Authoritative Backend", version="1.0.0")

# Enable Cross-Origin Resource Sharing (CORS) for local frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================================================================
# SYSTEM HEALTH CHECK (Prevents 404 on Root GET)
# =====================================================================
@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "CodeMafia Authoritative Backend is running!",
        "websocket_endpoint": "/ws/{room_id}"
    }

# =====================================================================
# IN-MEMORY PARTITIONED GAME ROOMS
# =====================================================================
class GameRoom:
    def __init__(self, room_id: str):
        self.room_id = room_id
        self.phase: str = "waiting"       # Current state machine phase ("waiting", "playing")
        self.host: Optional[str] = None   # Username of the room host
        self.current_code: str = (
            "# Welcome to CodeMafia!\n"
            "# Collaborate to debug and find the Impostor.\n\n"
            "def add(a, b):\n"
            "    return a + b\n"
        )
        # Partitioned active connections: WebSocket client -> Username string
        self.active_players: Dict[WebSocket, str] = {}

    def add_player(self, websocket: WebSocket, username: str) -> bool:
        """Registers a player in the room. Returns True if designated as Host."""
        self.active_players[websocket] = username
        logger.info(f"User '{username}' joined Room '{self.room_id}'.")
        
        # Automatic Host Assignment
        if not self.host:
            self.host = username
            logger.info(f"User '{username}' assigned as Host for Room '{self.room_id}'.")
            return True
        return False

    def remove_player(self, websocket: WebSocket) -> Optional[str]:
        """Disconnects a player and triggers Host Re-election if necessary."""
        if websocket in self.active_players:
            username = self.active_players.pop(websocket)
            logger.info(f"User '{username}' left Room '{self.room_id}'.")
            
            # Automatic Host Re-election
            if self.host == username:
                if self.active_players:
                    # Elect the next available active player as Host
                    self.host = list(self.active_players.values())[0]
                    logger.info(f"Host left. User '{self.host}' elected as new Host for '{self.room_id}'.")
                else:
                    self.host = None
                    logger.info(f"Room '{self.room_id}' is empty. Host reset to None.")
            return username
        return None

    def get_player_names(self) -> List[str]:
        """Returns list of currently active player names."""
        return list(self.active_players.values())

    def get_state_payload(self) -> dict:
        """Generates the authoritative state payload for client rendering."""
        return {
            "type": "room_state",
            "status": self.phase,
            "host": self.host,
            "players": self.get_player_names(),
            "code": self.current_code
        }


# Dynamic room dictionary to partition games in memory
rooms: Dict[str, GameRoom] = {}

def get_or_create_room(room_id: str) -> GameRoom:
    """Locates an existing room or creates a new one dynamically."""
    if room_id not in rooms:
        rooms[room_id] = GameRoom(room_id)
        logger.info(f"Dynamically created GameRoom: {room_id}")
    return rooms[room_id]


# =====================================================================
# WEBSOCKET BROADCAST MANAGER
# =====================================================================
class ConnectionManager:
    async def connect(self, websocket: WebSocket, room_id: str):
        await websocket.accept()
        logger.info(f"WebSocket handshake completed for Room: {room_id}")

    async def broadcast_to_room(self, room_id: str, message: dict, exclude: Optional[WebSocket] = None):
        """Sends a JSON payload to everyone in a room, with optional sender exclusion."""
        if room_id not in rooms:
            return
        
        payload = json.dumps(message)
        room = rooms[room_id]
        
        # Purge disconnected sockets cleanly during broadcast attempts
        dead_connections = []
        for ws in list(room.active_players.keys()):
            if ws == exclude:
                continue
            try:
                await ws.send_text(payload)
            except Exception as e:
                logger.error(f"Failed to communicate with socket: {e}")
                dead_connections.append(ws)
                
        # Handle cleanup of dead sockets
        for ws in dead_connections:
            username = room.remove_player(ws)
            if username:
                await self.broadcast_room_state(room_id)

    async def broadcast_room_state(self, room_id: str):
        """Broadcasts the latest canonical room status to the whole room."""
        if room_id in rooms:
            room = rooms[room_id]
            await self.broadcast_to_room(room_id, room.get_state_payload())


manager = ConnectionManager()


# =====================================================================
# WEBSOCKET ROUTE & GAME LOOP
# =====================================================================
@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    await manager.connect(websocket, room_id)
    room = get_or_create_room(room_id)
    
    current_username = None
    
    try:
        while True:
            # Wait for client input packet
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
            except json.JSONDecodeError:
                logger.warning(f"Malformed JSON received from client: {data}")
                continue
                
            msg_type = message.get("type")
            
            # --- PHASE 2: DYNAMIC JOINING & UNIQUE USERNAME VALIDATION ---
            if msg_type == "join":
                username = message.get("username", "Anonymous").strip()
                if not username:
                    username = "Player"
                
                # Check for duplicate names inside this specific partitioned room
                existing_names = room.get_player_names()
                base_username = username
                counter = 1
                while username in existing_names:
                    username = f"{base_username} ({counter})"
                    counter += 1
                
                current_username = username
                room.add_player(websocket, username)
                
                # Broadcast the newly updated roster to everyone in the room
                await manager.broadcast_room_state(room_id)
                
            # --- PHASE 3: COLLABORATIVE CODE UPDATE EVENT ---
            elif msg_type == "code_update":
                new_code = message.get("code", "")
                room.current_code = new_code
                
                # Echo-Free Broadcast: Send the update to everyone EXCEPT the typing client
                sync_message = {
                    "type": "code_synced",
                    "code": new_code,
                    "sender": current_username
                }
                await manager.broadcast_to_room(room_id, sync_message, exclude=websocket)
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected from Room '{room_id}'")
    except Exception as e:
        logger.error(f"Active connection error: {e}")
    finally:
        # Tear down connection cleanly and broadcast updated presence
        username_removed = room.remove_player(websocket)
        
        # Garbage-collect room from memory if it is completely empty
        if not room.active_players:
            if room_id in rooms:
                del rooms[room_id]
                logger.info(f"Room '{room_id}' is empty; garbage collected.")
        else:
            await manager.broadcast_room_state(room_id)