import type { CravingEntry } from "./localStore";

export type DayStat = {
  dateKey: string;
  label: string;
  count: number;
  avgIntensity: number | null;
};

export type Stats = {
  total: number;
  todayCount: number;
  todayAvg: number | null;
  wins: number;
  relapses: number;
  strongWins: number;
  daysSmokeFree: number | null;
  topPlaces: { label: string; count: number }[];
  topFeelings: { label: string; count: number }[];
  topActions: { label: string; count: number }[];
  last7Days: DayStat[];
};

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function dateKey(date: Date) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dayLabel(date: Date) {
  return date.toLocaleDateString("ru-RU", { weekday: "short" });
}

function countTop(values: string[], limit = 3) {
  const counts = new Map<string, number>();

  for (const value of values) {
    const key = value.trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ru"))
    .slice(0, limit);
}

export function computeStats(entries: CravingEntry[]): Stats {
  const today = startOfDay(new Date());
  const todayKey = dateKey(today);

  const parsed = entries
    .map((entry) => ({ entry, date: new Date(entry.occurredAt) }))
    .filter((item) => !Number.isNaN(item.date.getTime()));

  const todayItems = parsed.filter(
    (item) => dateKey(item.date) === todayKey
  );

  const todayAvg = todayItems.length
    ? todayItems.reduce((sum, item) => sum + item.entry.intensity, 0) /
      todayItems.length
    : null;

  const sortedDesc = [...parsed].sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  );

  const lastSmoked = sortedDesc.find((item) => item.entry.smoked);
  const earliest = sortedDesc[sortedDesc.length - 1];

  let daysSmokeFree: number | null = null;
  const anchor = lastSmoked?.date ?? earliest?.date;
  if (anchor) {
    const diffMs = today.getTime() - startOfDay(anchor).getTime();
    const days = Math.floor(diffMs / 86_400_000);
    daysSmokeFree = Math.max(0, lastSmoked ? days : days);
  }

  const last7Days: DayStat[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);
    const key = dateKey(day);
    const items = parsed.filter((item) => dateKey(item.date) === key);

    last7Days.push({
      dateKey: key,
      label: dayLabel(day),
      count: items.length,
      avgIntensity: items.length
        ? items.reduce((sum, item) => sum + item.entry.intensity, 0) /
          items.length
        : null,
    });
  }

  return {
    total: entries.length,
    todayCount: todayItems.length,
    todayAvg: todayAvg === null ? null : Math.round(todayAvg * 10) / 10,
    wins: entries.filter((entry) => !entry.smoked).length,
    relapses: entries.filter((entry) => entry.smoked).length,
    strongWins: entries.filter(
      (entry) => !entry.smoked && entry.intensity >= 7
    ).length,
    daysSmokeFree,
    topPlaces: countTop(entries.map((entry) => entry.place)),
    topFeelings: countTop(entries.map((entry) => entry.feeling)),
    topActions: countTop(entries.map((entry) => entry.alternativeAction)),
    last7Days,
  };
}

export function formatDuration(seconds: number | null) {
  if (!seconds || seconds <= 0) return null;
  if (seconds < 60) return `${seconds} сек`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  return `${hours} ч ${minutes % 60} мин`;
}

export function formatDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
