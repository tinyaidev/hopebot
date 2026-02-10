import type {
  Party,
  Server,
  Connection,
  ConnectionContext,
  Request,
} from "partykit/server";
import { getNextAuthSession } from "./utils/auth";

type ConnectionType = "browser" | "local";

interface ConnectionState {
  user: { name?: string | null; email?: string | null } | null;
}

interface Message {
  type: "terminal_input" | "terminal_output" | "resize" | "status";
  payload?: string;
  cols?: number;
  rows?: number;
  localClient?: "connected" | "disconnected";
}

function ok(): Response {
  return new Response("OK", { status: 200 });
}

function error(msg: string, status = 401): Response {
  return new Response(msg, { status });
}

export default class TerminalRelay implements Server {
  readonly room: Party;
  private connectionTypes = new Map<string, ConnectionType>();

  constructor(room: Party) {
    this.room = room;
  }

  onConnect(conn: Connection<ConnectionState>, ctx: ConnectionContext) {
    const url = new URL(ctx.request.url);
    const type = url.searchParams.get("type") as ConnectionType;

    if (type !== "browser" && type !== "local") {
      conn.close(4000, "Missing or invalid type parameter");
      return;
    }

    // Validate auth token for local client
    if (type === "local") {
      const token = url.searchParams.get("token");
      const expectedToken = (this.room.env.PARTY_AUTH_TOKEN as string)?.trim();
      if (!token || token !== expectedToken) {
        conn.close(4001, "Invalid auth token");
        return;
      }
    }

    // Browser connections start unauthenticated — they must POST to /auth
    // after connecting to prove their identity
    if (type === "browser") {
      conn.setState({ user: null });
    }

    this.connectionTypes.set(conn.id, type);

    // Notify browsers when local client connects
    if (type === "local") {
      this.broadcast(
        JSON.stringify({ type: "status", localClient: "connected" }),
        "browser"
      );
    }

    // Notify new browser of local client status
    if (type === "browser") {
      const hasLocal = this.hasConnectionOfType("local");
      conn.send(
        JSON.stringify({
          type: "status",
          localClient: hasLocal ? "connected" : "disconnected",
        })
      );
    }
  }

  async onRequest(request: Request): Promise<Response> {
    if (request.method === "POST") {
      const url = new URL(request.url);
      if (url.pathname.endsWith("/auth")) {
        return this.authenticateUser(request);
      }
    }
    return error("Not found", 404);
  }

  async authenticateUser(proxiedRequest: Request): Promise<Response> {
    const url = new URL(proxiedRequest.url);
    const id = url.searchParams.get("_pk");

    const connection = id && (this.room.getConnection(id) as Connection<ConnectionState> | undefined);
    if (!connection) {
      return error(`No connection with id ${id}`);
    }

    const user = await getNextAuthSession(proxiedRequest);
    if (!user) {
      return error("No valid session found");
    }

    connection.setState({ user });
    connection.send(
      JSON.stringify({ type: "status", authenticated: true })
    );

    return ok();
  }

  onMessage(
    message: string | ArrayBuffer,
    sender: Connection<ConnectionState>
  ) {
    const senderType = this.connectionTypes.get(sender.id);
    if (!senderType) return;

    let parsed: Message;
    try {
      parsed = JSON.parse(message as string);
    } catch {
      return;
    }

    if (senderType === "browser") {
      // Reject unauthenticated browser connections
      if (!sender.state?.user) {
        sender.send(
          JSON.stringify({
            type: "terminal_output",
            payload: "\r\n\x1b[31mNot authenticated. Please sign in.\x1b[0m\r\n",
          })
        );
        return;
      }

      // Route terminal_input and resize from browser → local client
      if (parsed.type === "terminal_input" || parsed.type === "resize") {
        this.broadcast(message as string, "local");
      }
    } else if (senderType === "local") {
      // Route terminal_output from local client → browsers
      if (parsed.type === "terminal_output") {
        this.broadcast(message as string, "browser");
      }
    }
  }

  onClose(conn: Connection) {
    const type = this.connectionTypes.get(conn.id);
    this.connectionTypes.delete(conn.id);

    // Notify browsers when local client disconnects
    if (type === "local" && !this.hasConnectionOfType("local")) {
      this.broadcast(
        JSON.stringify({ type: "status", localClient: "disconnected" }),
        "browser"
      );
    }
  }

  onError(conn: Connection) {
    this.onClose(conn);
  }

  private broadcast(message: string, targetType: ConnectionType) {
    for (const conn of this.room.getConnections()) {
      if (this.connectionTypes.get(conn.id) !== targetType) continue;
      // Only send to authenticated browser connections
      if (targetType === "browser") {
        const state = (conn as Connection<ConnectionState>).state;
        if (!state?.user) continue;
      }
      conn.send(message);
    }
  }

  private hasConnectionOfType(type: ConnectionType): boolean {
    for (const [, connType] of this.connectionTypes) {
      if (connType === type) return true;
    }
    return false;
  }
}
