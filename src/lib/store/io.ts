// "Download my data" / "Bring back my progress": one JSON file. Photos stay on the phone.
import { CREATOR_ID, type AppState } from "../types";
import { migrate, pickState, SCHEMA_VERSION } from "./initial";

export interface ExportFile {
  app: "8020jacked";
  creatorId: typeof CREATOR_ID;
  schemaVersion: number;
  exportedAt: string;
  state: AppState;
}

export function exportJSON(state: AppState, at: number): string {
  const file: ExportFile = {
    app: "8020jacked",
    creatorId: CREATOR_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date(at).toISOString(),
    state: pickState(state),
  };
  return JSON.stringify(file, null, 2);
}

export type ImportResult = { ok: true; state: AppState } | { ok: false; error: string };

export function parseImport(text: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file couldn't be read." };
  }
  const f = data as Partial<ExportFile>;
  if (!f || f.app !== "8020jacked" || f.creatorId !== CREATOR_ID || typeof f.state !== "object") {
    return { ok: false, error: "That isn't an 8020jacked file." };
  }
  if (typeof f.schemaVersion === "number" && f.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, error: "That file is from a newer version. Update the app first." };
  }
  return { ok: true, state: migrate(f.state, f.schemaVersion ?? 1) };
}

export function exportFileName(date: string): string {
  return `8020jacked-my-data-${date}.json`;
}
