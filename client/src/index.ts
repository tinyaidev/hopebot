import "dotenv/config";
import * as path from "path";
import * as pty from "node-pty";
import PartySocket from "partysocket";

const PARTYKIT_HOST = process.env.PARTYKIT_HOST;
const PARTY_AUTH_TOKEN = process.env.PARTY_AUTH_TOKEN;
const ROOM_ID = process.env.ROOM_ID || "hopebot";

if (!PARTYKIT_HOST) {
  console.error("Error: PARTYKIT_HOST is required");
  process.exit(1);
}
if (!PARTY_AUTH_TOKEN) {
  console.error("Error: PARTY_AUTH_TOKEN is required");
  process.exit(1);
}

let ptyProcess: pty.IPty | null = null;

const ws = new PartySocket({
  host: PARTYKIT_HOST,
  room: ROOM_ID,
  query: {
    type: "local",
    token: PARTY_AUTH_TOKEN,
  },
});

ws.addEventListener("open", () => {
  console.log(`Connected to PartyKit (${PARTYKIT_HOST}, room: ${ROOM_ID})`);
  spawnPty();
});

ws.addEventListener("message", (event) => {
  let msg: { type: string; payload?: string; cols?: number; rows?: number };
  try {
    msg = JSON.parse(event.data as string);
  } catch {
    return;
  }

  if (msg.type === "terminal_input" && msg.payload && ptyProcess) {
    ptyProcess.write(msg.payload);
  } else if (msg.type === "resize" && msg.cols && msg.rows && ptyProcess) {
    ptyProcess.resize(msg.cols, msg.rows);
  }
});

ws.addEventListener("close", () => {
  console.log("Disconnected from PartyKit. Will attempt to reconnect...");
});

ws.addEventListener("error", (err) => {
  console.error("WebSocket error:", err);
});

function spawnPty() {
  if (ptyProcess) return;

  console.log("Spawning claude CLI...");
  ptyProcess = pty.spawn("claude", [], {
    name: "xterm-color",
    cols: 120,
    rows: 40,
    cwd: process.env.HOPEBOT_DIR || path.resolve(__dirname, "../.."),
    env: process.env as Record<string, string>,
  });

  ptyProcess.onData((data: string) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "terminal_output", payload: data }));
    }
  });

  ptyProcess.onExit(({ exitCode, signal }) => {
    console.log(`claude exited (code: ${exitCode}, signal: ${signal})`);
    ptyProcess = null;
    // Respawn after a short delay
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        console.log("Respawning claude...");
        spawnPty();
      }
    }, 1000);
  });
}

// Clean shutdown
function cleanup() {
  console.log("\nShutting down...");
  if (ptyProcess) {
    ptyProcess.kill();
    ptyProcess = null;
  }
  ws.close();
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
