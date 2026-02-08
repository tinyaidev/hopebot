"use client";

import { useEffect, useRef, useState } from "react";
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

export default function Terminal() {
  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const wsRef = useRef<PartySocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");

  useEffect(() => {
    if (!termRef.current) return;

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

    // Terminal input → WebSocket
    const onDataDisposable = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "terminal_input", payload: data }));
      }
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

    return () => {
      onDataDisposable.dispose();
      onResizeDisposable.dispose();
      window.removeEventListener("resize", handleResize);
      ws.close();
      term.dispose();
    };
  }, []);

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-gray-700">
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
      <div ref={termRef} className="flex-1" />
    </div>
  );
}
