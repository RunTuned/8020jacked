import type { StateStorage } from "zustand/middleware";

/** localStorage when there is one (the phone), else memory (server render, tests). */
export function safeStorage(): StateStorage {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const k = "8020jacked:probe";
      window.localStorage.setItem(k, "1");
      window.localStorage.removeItem(k);
      return window.localStorage;
    }
  } catch {
    // private mode or blocked storage: fall through
  }
  const mem = new Map<string, string>();
  return {
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => void mem.set(k, v),
    removeItem: (k) => void mem.delete(k),
  };
}
