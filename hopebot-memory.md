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

## Notes
- PartyKit room ID: "hopebot"
- Message protocol: terminal_input, terminal_output, resize, status
