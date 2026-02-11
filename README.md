# hopebot

A persistent general-purpose AI agent with remote web terminal access. Connect to a local Claude Code CLI session from anywhere through your browser.

## Architecture

```
Browser (xterm.js) ⟷ PartyKit relay (Cloudflare) ⟷ Local client (node-pty) ⟷ claude CLI
```

- **`web/`** — Next.js app (Vercel). Hosts the xterm.js terminal UI and NextAuth GitHub OAuth login.
- **`party/`** — PartyKit WebSocket relay (Cloudflare). Routes terminal I/O between browser and local client.
- **`client/`** — Local Node.js client. Spawns `claude` via node-pty and connects to the PartyKit relay.

## Setup

1. Copy `.env.example` and fill in values:
   ```sh
   cp .env.example .env
   ```

2. Install dependencies in each directory:
   ```sh
   cd web && npm install
   cd ../party && npm install
   cd ../client && npm install
   ```

## Running

Start all three components (each in its own terminal):

```sh
# Terminal 1 — Next.js web app
cd web && npm run dev

# Terminal 2 — PartyKit relay
cd party && npm run dev

# Terminal 3 — Local client (spawns claude CLI)
cd client && npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) and sign in with GitHub.

## Deploying

```sh
# Deploy PartyKit relay
cd party && npm run deploy

# Deploy web app (via Vercel CLI or git push to Vercel-connected repo)
cd web && npm run build
```
