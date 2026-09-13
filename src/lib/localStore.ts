"use client";

export type CravingEntry = {
  id: string;
  occurredAt: string; // ISO-строка
  place: string;
  beforeCraving: string;
  feeling: string;
  intensity: number;
  alternativeAction: string;
  smoked: boolean;
  durationSec: number | null;
  createdAt: string;
};

const STORAGE_KEY = "bez-tyagi:entries:v1";
export const ENTRIES_LIMIT = 2000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeEntry(raw: unknown): CravingEntry | null {
  if (!isRecord(raw)) return null;

  const occurred = new Date(
    typeof raw.occurredAt === "string" ? raw.occurredAt : ""
  );
  if (Number.isNaN(occurred.getTime())) return null;

  const intensityRaw = Number(raw.intensity);
  const intensity = Number.isFinite(intensityRaw)
    ? Math.min(10, Math.max(1, Math.round(intensityRaw)))
    : 5;

  const durationRaw = Number(raw.durationSec);

  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : createId(),
    occurredAt: occurred.toISOString(),
    place: typeof raw.place === "string" ? raw.place : "",
    beforeCraving: typeof raw.beforeCraving === "string" ? raw.beforeCraving : "",
    feeling: typeof raw.feeling === "string" ? raw.feeling : "",
    intensity,
    alternativeAction:
      typeof raw.alternativeAction === "string" ? raw.alternativeAction : "",
    smoked: raw.smoked === true,
    durationSec:
      Number.isFinite(durationRaw) && durationRaw > 0
        ? Math.round(durationRaw)
        : null,
    createdAt:
      typeof raw.createdAt === "string" && raw.createdAt
        ? raw.createdAt
        : new Date().toISOString(),
  };
}

export function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function loadEntries(): CravingEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(normalizeEntry)
      .filter((entry): entry is CravingEntry => entry !== null)
      .sort((a, b) => compareDesc(a.occurredAt, b.occurredAt));
  } catch (error) {
    console.error("Не удалось прочитать локальные записи", error);
    return [];
  }
}

export function persistEntries(entries: CravingEntry[]): CravingEntry[] {
  if (typeof window === "undefined") return entries;

  const trimmed = entries.slice(0, ENTRIES_LIMIT);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error("Не удалось сохранить локальные записи", error);
  }
  return trimmed;
}

export function compareDesc(a: string, b: string) {
  return new Date(b).getTime() - new Date(a).getTime();
}

export function toIsoWithLocalOffset(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function buildBackup(entries: CravingEntry[]) {
  return {
    app: "bez-tyagi",
    version: 1,
    exportedAt: new Date().toISOString(),
    entries,
  };
}

export function entriesFromBackup(raw: unknown): CravingEntry[] {
  if (!isRecord(raw)) return [];
  const list = raw.entries;
  if (!Array.isArray(list)) return [];

  return list
    .map(normalizeEntry)
    .filter((entry): entry is CravingEntry => entry !== null)
    .sort((a, b) => compareDesc(a.occurredAt, b.occurredAt));
}
