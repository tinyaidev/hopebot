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

## Notes
- PartyKit room ID: "hopebot"
- Message protocol: terminal_input, terminal_output, resize, status
