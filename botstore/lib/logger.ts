export function log(event: string, data: Record<string, unknown> = {}): void {
  process.stdout.write(JSON.stringify({ event, ts: new Date().toISOString(), ...data }) + '\n');
}
