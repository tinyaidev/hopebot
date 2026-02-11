"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import PartySocket from "partysocket";

async function identify(socket: PartySocket) {
  const url = `/terminal/auth?_pk=${socket._pk}`;
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) {
    console.error("Failed to authenticate PartyKit connection:", await res.text());
  }
}

const SPECIAL_KEYS = [
  { label: "Esc", seq: "\x1b" },
  { label: "Tab", seq: "\t" },
  { label: "↑", seq: "\x1b[A" },
  { label: "↓", seq: "\x1b[B" },
  { label: "←", seq: "\x1b[D" },
  { label: "→", seq: "\x1b[C" },
] as const;

export default function Terminal() {
  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const wsRef = useRef<PartySocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [ctrlHeld, setCtrlHeld] = useState(false);
  const ctrlHeldRef = useRef(false);

  // Keep ref in sync so onData callback sees current value
  useEffect(() => {
    ctrlHeldRef.current = ctrlHeld;
  }, [ctrlHeld]);

  const sendInput = useCallback((data: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "terminal_input", payload: data }));
    }
  }, []);

  useEffect(() => {
    if (!termRef.current) return;

    // Stable session ID for dedup across reconnects
    const browserSessionId = crypto.randomUUID();

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
      theme: {
        background: "#0d1117",
        foreground: "#c9d1d9",
        cursor: "#58a6ff",
        selectionBackground: "#264f78",
      },
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(termRef.current);

    // Try WebGL renderer for better performance
    try {
      const webglAddon = new WebglAddon();
      term.loadAddon(webglAddon);
      webglAddon.onContextLoss(() => webglAddon.dispose());
    } catch {
      // WebGL not supported, fall back to default canvas renderer
    }

    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    const partyHost = process.env.NEXT_PUBLIC_PARTYKIT_HOST;
    if (!partyHost) {
      term.writeln("\r\n\x1b[31mError: NEXT_PUBLIC_PARTYKIT_HOST not configured\x1b[0m");
      return;
    }

    const ws = new PartySocket({
      host: partyHost,
      room: "hopebot",
      query: {
        type: "browser",
        browserSessionId,
      },
    });

    wsRef.current = ws;

    ws.addEventListener("open", () => {
      // Authenticate by POSTing to /terminal/auth — Next.js rewrites this
      // to PartyKit, proxying the session cookie for validation
      identify(ws);
    });

    ws.addEventListener("message", (event) => {
      let msg: {
        type: string;
        payload?: string;
        localClient?: string;
        authenticated?: boolean;
      };
      try {
        msg = JSON.parse(event.data as string);
      } catch {
        return;
      }

      if (msg.type === "terminal_output" && msg.payload) {
        term.write(msg.payload);
      } else if (msg.type === "status") {
        if (msg.localClient !== undefined) {
          setStatus(msg.localClient === "connected" ? "connected" : "disconnected");
        }
        // Send initial size after authentication succeeds
        if (msg.authenticated) {
          ws.send(
            JSON.stringify({
              type: "resize",
              cols: term.cols,
              rows: term.rows,
            })
          );
        }
      }
    });

    ws.addEventListener("close", () => {
      setStatus("connecting");
    });

    // Terminal input → WebSocket (with Ctrl modifier support)
    const onDataDisposable = term.onData((data) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      let payload = data;
      if (ctrlHeldRef.current && data.length === 1) {
        const code = data.toUpperCase().charCodeAt(0);
        // Ctrl+A=1 .. Ctrl+Z=26
        if (code >= 65 && code <= 90) {
          payload = String.fromCharCode(code - 64);
        }
        setCtrlHeld(false);
      }
      ws.send(JSON.stringify({ type: "terminal_input", payload }));
    });

    // Terminal resize → WebSocket
    const onResizeDisposable = term.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols, rows }));
      }
    });

    // Window resize → fit terminal
    const handleResize = () => fitAddon.fit();
    window.addEventListener("resize", handleResize);

    // Reconnect when tab becomes visible again
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        ws.reconnect();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      onDataDisposable.dispose();
      onResizeDisposable.dispose();
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibility);
      ws.close();
      term.dispose();
    };
  }, []);

  const handleSpecialKey = useCallback((seq: string) => {
    sendInput(seq);
    // Focus terminal after button press
    xtermRef.current?.focus();
  }, [sendInput]);

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-gray-700 flex-shrink-0">
        <span className="text-sm font-medium text-gray-300">hopebot</span>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              status === "connected"
                ? "bg-green-500"
                : status === "connecting"
                  ? "bg-yellow-500 animate-pulse"
                  : "bg-red-500"
            }`}
          />
          <span className="text-xs text-gray-400">
            {status === "connected"
              ? "Connected"
              : status === "connecting"
                ? "Connecting..."
                : "Local client offline"}
          </span>
        </div>
      </div>
      {/* Special keys toolbar */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-[#161b22] border-b border-gray-700 flex-shrink-0">
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setCtrlHeld((v) => !v);
            xtermRef.current?.focus();
          }}
          className={`px-2.5 py-1 text-xs rounded font-mono transition-colors ${
            ctrlHeld
              ? "bg-blue-600 text-white ring-1 ring-blue-400"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
        >
          Ctrl
        </button>
        {SPECIAL_KEYS.map(({ label, seq }) => (
          <button
            key={label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleSpecialKey(seq)}
            className="px-2.5 py-1 text-xs rounded font-mono bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
          >
            {label}
          </button>
        ))}
      </div>
      <div ref={termRef} className="flex-1 min-h-0 overflow-hidden" />
    </div>
  );
}
