"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  buildBackup,
  createId,
  entriesFromBackup,
  loadEntries,
  persistEntries,
  type CravingEntry,
} from "@/lib/localStore";
import { computeStats, formatDateTime, formatDuration } from "@/lib/stats";

type Tab = "log" | "stats" | "history" | "data";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
};

const PLACE_OPTIONS = [
  "Дома",
  "На работе",
  "Улица / балкон",
  "Кафе / бар",
  "В машине",
  "У друга",
];

const FEELING_OPTIONS = [
  "Тревога",
  "Скука",
  "Злость",
  "Усталость",
  "Стресс",
  "Радость / расслабление",
];

const ACTION_OPTIONS = [
  "Ничего не делал(а), просто переждал(а)",
  "5 глубоких вдохов",
  "Выпил(а) стакан воды",
  "Пошёл(ла) прогулку",
  "Написал(а) другу",
  "Пожевал(а) жвачку / съел(а) конфету",
];

function toLocalInputValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function CravingTracker() {
  const [tab, setTab] = useState<Tab>("log");

  const [entries, setEntries] = useState<CravingEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const [datetime, setDatetime] = useState(() => toLocalInputValue(new Date()));
  const [place, setPlace] = useState("");
  const [beforeCraving, setBeforeCraving] = useState("");
  const [feeling, setFeeling] = useState("");
  const [intensity, setIntensity] = useState(5);
  const [alternativeAction, setAlternativeAction] = useState("");
  const [smoked, setSmoked] = useState(false);

  const [timerStart, setTimerStart] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setEntries(loadEntries());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) persistEntries(entries);
  }, [entries, hydrated]);

  useEffect(() => {
    if (timerStart === null) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - timerStart) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [timerStart]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const stats = useMemo(() => computeStats(entries), [entries]);

  const suggestionPool = useMemo(() => {
    const pick = (values: string[]) => {
      const seen = new Set<string>();
      const result: string[] = [];
      for (const value of values) {
        const key = value.trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        result.push(key);
        if (result.length >= 4) break;
      }
      return result;
    };
    return {
      places: pick([...entries.map((e) => e.place), ...PLACE_OPTIONS]),
      feelings: pick([...entries.map((e) => e.feeling), ...FEELING_OPTIONS]),
      actions: pick([
        ...entries.map((e) => e.alternativeAction),
        ...ACTION_OPTIONS,
      ]),
    };
  }, [entries]);

  const commitEntry = useCallback(
    (durationSec: number | null) => {
      const occurred = new Date(datetime);
      if (Number.isNaN(occurred.getTime())) {
        setToast("Проверь дату и время");
        return;
      }

      const entry: CravingEntry = {
        id: createId(),
        occurredAt: occurred.toISOString(),
        place: place.trim(),
        beforeCraving: beforeCraving.trim(),
        feeling: feeling.trim(),
        intensity,
        alternativeAction: alternativeAction.trim(),
        smoked,
        durationSec,
        createdAt: new Date().toISOString(),
      };

      setEntries((prev) =>
        [entry, ...prev].sort((a, b) =>
          a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : 0
        )
      );

      setBeforeCraving("");
      setFeeling("");
      setAlternativeAction("");
      setPlace("");
      setIntensity(5);
      setSmoked(false);
      setTimerStart(null);
      setElapsed(0);
      setToast(
        smoked
          ? "Записал(а). Это тоже данные — не наказание, а информация."
          : "Записал(а). Тяга прошла — это победа!"
      );
    },
    [alternativeAction, beforeCraving, datetime, feeling, intensity, place, smoked]
  );

  const handleStartTimer = () => {
    setDatetime(toLocalInputValue(new Date()));
    setTimerStart(Date.now());
    setElapsed(0);
  };

  const handleSave = (event: FormEvent) => {
    event.preventDefault();
    commitEntry(timerStart === null ? null : elapsed);
  };

  const handleStopTimerAndSave = () => {
    commitEntry(elapsed);
  };

  const handleDelete = (id: string) => {
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
    setToast("Запись удалена");
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(buildBackup(entries), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `bez-tyagi-backup-${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setToast("Резервная копия сохранена в файл");
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const imported = entriesFromBackup(JSON.parse(text));
      if (!imported.length) {
        setToast("В файле не найдено записей");
        return;
      }
      setEntries((prev) => {
        const byId = new Map(prev.map((entry) => [entry.id, entry]));
        for (const entry of imported) byId.set(entry.id, entry);
        return [...byId.values()].sort((a, b) =>
          a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : 0
        );
      });
      setToast(`Импортировано записей: ${imported.length}`);
    } catch {
      setToast("Не удалось прочитать файл");
    }
  };

  const handleInstall = async () => {
    if (!installEvent) {
      setToast("Меню браузера → «Установить приложение»");
      return;
    }
    await installEvent.prompt();
    setInstallEvent(null);
  };

  const handleClearAll = () => {
    if (!window.confirm("Удалить все записи с телефона? Действие необратимо.")) {
      return;
    }
    setEntries([]);
    setToast("Все записи удалены");
  };

  const isStandalone =
    typeof window !== "undefined" &&
    window.matchMedia?.("(display-mode: standalone)").matches;

  return (
    <div className="flex flex-1 flex-col gap-4 pb-24">
      <section className="grid grid-cols-3 gap-2">
        <StatTile
          label="Дней без сигареты"
          value={stats.daysSmokeFree === null ? "—" : `${stats.daysSmokeFree}`}
          accent="text-emerald-300"
        />
        <StatTile
          label="Тяг сегодня"
          value={`${stats.todayCount}`}
          hint={stats.todayAvg === null ? undefined : `средн. ${stats.todayAvg}`}
        />
        <StatTile
          label="Пережил(а) тягу"
          value={`${stats.wins}`}
          hint={`${stats.strongWins} сильных`}
          accent="text-sky-300"
        />
      </section>

      {tab === "log" && (
        <form
          onSubmit={handleSave}
          className="space-y-4 rounded-3xl bg-slate-900/70 p-4 ring-1 ring-slate-800"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Новая запись</h2>
            {timerStart !== null ? (
              <span className="rounded-full bg-sky-500/15 px-3 py-1 text-xs font-medium text-sky-300">
                Тяга идёт · {formatDuration(elapsed) ?? "0 сек"}
              </span>
            ) : null}
          </div>

          {timerStart === null ? (
            <button
              type="button"
              onClick={handleStartTimer}
              className="w-full rounded-2xl border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-sm font-medium text-sky-200"
            >
              ⏱ Тяга началась прямо сейчас — запустить таймер
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStopTimerAndSave}
              className="w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950"
            >
              ✅ Тяга прошла — сохранить ({formatDuration(elapsed) ?? "0 сек"})
            </button>
          )}

          <Field label="Дата и время тяги">
            <input
              type="datetime-local"
              value={datetime}
              onChange={(event) => setDatetime(event.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Место">
            <input
              type="text"
              value={place}
              onChange={(event) => setPlace(event.target.value)}
              placeholder="Дом, работа, улица..."
              className={inputClass}
            />
            <Chips
              options={suggestionPool.places}
              onPick={setPlace}
              active={place}
            />
          </Field>

          <Field label="Что было прямо перед тягой">
            <textarea
              rows={2}
              value={beforeCraving}
              onChange={(event) => setBeforeCraving(event.target.value)}
              placeholder="Кофе, ссора, звонок, окончание задачи..."
              className={`${inputClass} resize-none`}
            />
          </Field>

          <Field label="Чувство за 10–30 секунд до тяги">
            <textarea
              rows={2}
              value={feeling}
              onChange={(event) => setFeeling(event.target.value)}
              placeholder="Тревога, скука, злость, усталость..."
              className={`${inputClass} resize-none`}
            />
            <Chips
              options={suggestionPool.feelings}
              onPick={setFeeling}
              active={feeling}
            />
          </Field>

          <Field label={`Сила тяги: ${intensity}/10`}>
            <input
              type="range"
              min={1}
              max={10}
              value={intensity}
              onChange={(event) => setIntensity(Number(event.target.value))}
              className="w-full accent-sky-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>Едва заметно</span>
              <span>Невозможно терпеть</span>
            </div>
          </Field>

          <Field label="Что сделал(а) вместо">
            <textarea
              rows={2}
              value={alternativeAction}
              onChange={(event) => setAlternativeAction(event.target.value)}
              placeholder="Вода, вдохи, прогулка, ничего..."
              className={`${inputClass} resize-none`}
            />
            <Chips
              options={suggestionPool.actions}
              onPick={setAlternativeAction}
              active={alternativeAction}
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSmoked(false)}
              className={`rounded-2xl px-3 py-3 text-sm font-medium ring-1 transition ${
                smoked
                  ? "bg-slate-900 text-slate-300 ring-slate-800"
                  : "bg-emerald-500/20 text-emerald-200 ring-emerald-500/50"
              }`}
            >
              Не закурил(а)
            </button>
            <button
              type="button"
              onClick={() => setSmoked(true)}
              className={`rounded-2xl px-3 py-3 text-sm font-medium ring-1 transition ${
                smoked
                  ? "bg-rose-500/20 text-rose-200 ring-rose-500/50"
                  : "bg-slate-900 text-slate-300 ring-slate-800"
              }`}
            >
              Закурил(а)
            </button>
          </div>

          <button
            type="submit"
            className="w-full rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-slate-950 transition active:scale-[0.99]"
          >
            Сохранить эпизод
          </button>
          <p className="text-center text-[11px] text-slate-500">
            Всё хранится только в этом телефоне. Интернет не нужен.
          </p>
        </form>
      )}

      {tab === "stats" && <StatsView entries={entries} stats={stats} />}

      {tab === "history" && (
        <section className="space-y-2">
          {entries.length === 0 ? (
            <p className="rounded-3xl bg-slate-900/70 p-4 text-xs text-slate-400 ring-1 ring-slate-800">
              Пока нет записей. Запиши хотя бы 20–30 эпизодов — и ты увидишь свои
              главные триггеры.
            </p>
          ) : (
            entries.map((entry) => (
              <article
                key={entry.id}
                className="rounded-2xl bg-slate-900/70 p-3 ring-1 ring-slate-800"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-[11px] text-slate-400">
                    <span className="font-medium text-slate-200">
                      {formatDateTime(entry.occurredAt)}
                    </span>
                    <span className="ml-2 rounded-full bg-slate-800 px-2 py-0.5 text-sky-300">
                      {entry.intensity}/10
                    </span>
                    {entry.durationSec ? (
                      <span className="ml-2 text-slate-500">
                        длилась {formatDuration(entry.durationSec)}
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(entry.id)}
                    className="rounded-lg px-2 py-1 text-[11px] text-slate-500 ring-1 ring-slate-800"
                  >
                    Удалить
                  </button>
                </div>

                <div className="mt-2 space-y-0.5 text-[12px] text-slate-200">
                  {entry.place ? <Row label="Место" value={entry.place} /> : null}
                  {entry.beforeCraving ? (
                    <Row label="Перед тягой" value={entry.beforeCraving} />
                  ) : null}
                  {entry.feeling ? (
                    <Row label="Чувство" value={entry.feeling} />
                  ) : null}
                  {entry.alternativeAction ? (
                    <Row label="Вместо" value={entry.alternativeAction} />
                  ) : null}
                </div>

                <p
                  className={`mt-2 text-[11px] font-medium ${
                    entry.smoked ? "text-rose-300" : "text-emerald-300"
                  }`}
                >
                  {entry.smoked ? "Закурил(а)" : "Не закурил(а) — победа"}
                </p>
              </article>
            ))
          )}
        </section>
      )}

      {tab === "data" && (
        <section className="space-y-3 rounded-3xl bg-slate-900/70 p-4 text-sm ring-1 ring-slate-800">
          <h2 className="text-base font-semibold">Данные и установка</h2>
          <p className="text-xs text-slate-400">
            Записи хранятся локально в браузере телефона ({entries.length} шт.).
            Ни один сервер их не получает.
          </p>

          {!isStandalone ? (
            <button
              type="button"
              onClick={handleInstall}
              className="w-full rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-slate-950"
            >
              📲 Установить на главный экран
            </button>
          ) : (
            <p className="rounded-2xl bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200 ring-1 ring-emerald-500/40">
              Приложение уже установлено и работает в автономном режиме.
            </p>
          )}

          <button
            type="button"
            onClick={handleExport}
            className="w-full rounded-2xl border border-slate-700 px-4 py-3 text-sm text-slate-100"
          >
            ⬇️ Сохранить резервную копию (JSON)
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-2xl border border-slate-700 px-4 py-3 text-sm text-slate-100"
          >
            ⬆️ Загрузить резервную копию
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleImportFile(file);
              event.target.value = "";
            }}
          />

          <a
            href="/app.html"
            download="bez-tyagi.html"
            className="block w-full rounded-2xl border border-slate-700 px-4 py-3 text-center text-sm text-slate-100"
          >
            📄 Скачать автономную версию одним файлом
          </a>

          <button
            type="button"
            onClick={handleClearAll}
            className="w-full rounded-2xl border border-rose-500/40 px-4 py-3 text-sm text-rose-300"
          >
            🗑 Удалить все записи
          </button>
        </section>
      )}

      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
          <p className="rounded-full bg-slate-800/95 px-4 py-2 text-center text-xs text-slate-100 ring-1 ring-slate-700">
            {toast}
          </p>
        </div>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto grid max-w-md grid-cols-4 px-2 py-2 text-[11px]">
          <TabButton active={tab === "log"} onClick={() => setTab("log")}>
            Запись
          </TabButton>
          <TabButton active={tab === "stats"} onClick={() => setTab("stats")}>
            Аналитика
          </TabButton>
          <TabButton
            active={tab === "history"}
            onClick={() => setTab("history")}
          >
            История
          </TabButton>
          <TabButton active={tab === "data"} onClick={() => setTab("data")}>
            Данные
          </TabButton>
        </div>
      </nav>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-50 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500";

function StatTile({
  label,
  value,
  hint,
  accent = "text-slate-50",
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-900/70 p-3 ring-1 ring-slate-800">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-1 text-xl font-semibold ${accent}`}>{value}</p>
      {hint ? <p className="text-[10px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-slate-300">{label}</label>
      {children}
    </div>
  );
}

function Chips({
  options,
  onPick,
  active,
}: {
  options: string[];
  onPick: (value: string) => void;
  active: string;
}) {
  if (!options.length) return null;
  return (
    <div className="flex flex-wrap gap-1 pt-1">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onPick(option)}
          className={`rounded-full px-2.5 py-1 text-[11px] ring-1 transition ${
            active.trim() === option
              ? "bg-sky-500/20 text-sky-200 ring-sky-500/50"
              : "bg-slate-800/70 text-slate-300 ring-slate-700"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="text-slate-500">{label}: </span>
      {value}
    </p>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-2 py-2 font-medium transition ${
        active ? "bg-slate-800 text-sky-300" : "text-slate-500"
      }`}
    >
      {children}
    </button>
  );
}

function StatsView({
  entries,
  stats,
}: {
  entries: CravingEntry[];
  stats: ReturnType<typeof computeStats>;
}) {
  const maxCount = Math.max(1, ...stats.last7Days.map((day) => day.count));

  return (
    <section className="space-y-4">
      <div className="rounded-3xl bg-slate-900/70 p-4 ring-1 ring-slate-800">
        <h2 className="text-base font-semibold">Последние 7 дней</h2>
        <div className="mt-3 flex h-32 items-end gap-2">
          {stats.last7Days.map((day) => (
            <div key={day.dateKey} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t-lg bg-gradient-to-t from-sky-700 to-sky-400"
                  style={{
                    height: `${Math.max(4, (day.count / maxCount) * 100)}%`,
                  }}
                />
              </div>
              <span className="text-[10px] text-slate-500">{day.label}</span>
              <span className="text-[10px] text-slate-300">{day.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatTile label="Всего записей" value={`${stats.total}`} />
        <StatTile
          label="Срывов"
          value={`${stats.relapses}`}
          accent="text-rose-300"
        />
      </div>

      <TopList title="Частые места" items={stats.topPlaces} />
      <TopList title="Частые чувства" items={stats.topFeelings} />
      <TopList title="Что помогало" items={stats.topActions} />

      {entries.length === 0 ? (
        <p className="rounded-3xl bg-slate-900/70 p-4 text-xs text-slate-400 ring-1 ring-slate-800">
          Статистика появится после первых записей.
        </p>
      ) : null}
    </section>
  );
}

function TopList({
  title,
  items,
}: {
  title: string;
  items: { label: string; count: number }[];
}) {
  return (
    <div className="rounded-3xl bg-slate-900/70 p-4 ring-1 ring-slate-800">
      <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-1 text-[11px] text-slate-500">Пока нет данных</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {items.map((item) => (
            <li
              key={item.label}
              className="flex items-center justify-between gap-2 text-xs text-slate-300"
            >
              <span className="truncate">{item.label}</span>
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-sky-300">
                ×{item.count}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
