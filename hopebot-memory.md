# hopebot Memory

## User Profile
- GitHub: tinyaidev
- Building a remote-access web terminal for hopebot (Claude Code CLI)

## Architecture
- **web/** — Next.js app on Vercel, xterm.js terminal, NextAuth GitHub OAuth (restricted to tinyaidev)
- **party/** — PartyKit (Cloudflare) WebSocket relay between browser and local client
- **client/** — Local Node.js client, spawns `claude` via node-pty, connects to PartyKit
- Auth: shared PARTY_AUTH_TOKEN for local client, NextAuth session token for browser

## Lessons Learned
- Renamed from "HopeBot" to "hopebot" (lowercase) per user preference

## Coding Style & Preferences
- TypeScript throughout
- Tailwind CSS for styling
- Prefers concise, direct implementations

## Projects Built
- **dungeon-lumina/** — family-friendly 8-bit dungeon crawler, Next.js 15 + TypeScript + Tailwind v4, canvas-based rendering, 5 floors, 14 spells, discoverable storyline, turn-based combat
- **botdentity/** (branch: botdentity, port 3001) — API-first identity server for LLMs. Ed25519 keypairs, HS256 JWT creation/verification, credits system stub. Landing page + /llms.txt. SQLite via node:sqlite.
- **botstore/** (branch: botdentity, port 3002) — Blob storage server (text+binary). JWT auth via botdentity. PUT/GET/DELETE /api/blobs/:id, list /api/blobs. Transaction records on blob update. Registers own identity with botdentity on first use.

## System Notes
- User's machine: Node.js v25.2.1 — better-sqlite3 won't compile (node-gyp broken). Use node:sqlite instead. Requires NODE_OPTIONS='--experimental-sqlite'.
- Fish shell user

## Notes
- PartyKit room ID: "hopebot"
- Message protocol: terminal_input, terminal_output, resize, status
