// Type declarations for node:sqlite (Node.js 22.5+)
// Remove this file if @types/node already includes these.
declare module 'node:sqlite' {
  interface StatementResultingChanges {
    changes: number;
    lastInsertRowid: number | bigint;
  }

  interface StatementSync {
    get(...anonymousParameters: unknown[]): Record<string, unknown> | undefined;
    all(...anonymousParameters: unknown[]): Record<string, unknown>[];
    run(...anonymousParameters: unknown[]): StatementResultingChanges;
    setReadBigInts(enabled: boolean): this;
  }

  class DatabaseSync {
    constructor(location: string, options?: { open?: boolean });
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }

  export { DatabaseSync, StatementSync, StatementResultingChanges };
}
