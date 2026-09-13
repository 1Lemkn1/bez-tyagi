import { CravingTracker } from "./CravingTracker";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <section className="mx-auto flex min-h-screen max-w-md flex-col px-4 pt-6">
        <header className="mb-4">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-500/15 text-lg ring-1 ring-sky-500/40">
              🫁
            </span>
            <div>
              <h1 className="text-xl font-semibold leading-tight tracking-tight">
                Без Тяги
              </h1>
              <p className="text-[11px] text-slate-500">
                локальный трекер триггеров · без сервера
              </p>
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-400">
            Записывай каждый эпизод тяги: мозг учится замечать триггеры, и сила
            привычки постепенно падает.
          </p>
        </header>

        <CravingTracker />
      </section>
    </main>
  );
}
