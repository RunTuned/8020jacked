// Injectable clock so tests (and undo timers) can control time.
let nowFn: () => number = () => Date.now();

export function now(): number {
  return nowFn();
}

export function setClock(fn: () => number): void {
  nowFn = fn;
}

export function resetClock(): void {
  nowFn = () => Date.now();
}

export function uid(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `${now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
