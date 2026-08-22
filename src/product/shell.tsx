import { useEffect, useState } from "react";
import {
  BarChart3, BookOpenCheck, CalendarDays, ClipboardList, Eraser, Flame, Home,
  Library, LogIn, LogOut, Moon, Settings, Sun, Trophy, UserRound,
} from "lucide-react";
import { useTheme } from "./theme";
import { useApp, type Route } from "./store";
import { NotificationsBell } from "./NotificationsBell";
import { levelFromXp } from "./ui";
import { titleForLevel } from "./data";

const NAV: { key: Route; label: string; short: string; icon: typeof Home }[] = [
  { key: "home", label: "Главная", short: "Главная", icon: Home },
  { key: "bank", label: "Банк заданий", short: "Банк", icon: Library },
  { key: "variants", label: "Варианты", short: "Варианты", icon: ClipboardList },
  { key: "probability", label: "Вероятность", short: "Вероят.", icon: Flame },
  { key: "mistakes", label: "Ошибки", short: "Ошибки", icon: Eraser },
  { key: "rating", label: "Рейтинг", short: "Рейтинг", icon: Trophy },
  { key: "analytics", label: "Аналитика", short: "Аналитика", icon: BarChart3 },
];

/* Нижняя навигация: 5 вкладок, весь функционал доступен максимум в 1–2 тапа.
   Ошибки и ачивки — иконками в шапке/странице «Рейтинг», тренажёры — из Банка. */
const MOBILE_STUDENT: { key: Route; label: string; icon: typeof Home }[] = [
  { key: "home", label: "Главная", icon: Home },
  { key: "bank", label: "Банк", icon: Library },
  { key: "variants", label: "Варианты", icon: ClipboardList },
  { key: "analytics", label: "Аналитика", icon: BarChart3 },
  { key: "rating", label: "Рейтинг", icon: Trophy },
];
const MOBILE_TEACHER: { key: Route; label: string; icon: typeof Home }[] = [
  { key: "home", label: "Главная", icon: Home },
  { key: "bank", label: "Банк", icon: Library },
  { key: "admin", label: "Кабинет", icon: Settings },
  { key: "variants", label: "Варианты", icon: ClipboardList },
  { key: "rating", label: "Рейтинг", icon: Trophy },
];

const TICKER_EVENTS = [
  "@anna_ukhta — 96 баллов за вариант «Основной 2023»",
  "@dima_syr занимается 18 дней подряд",
  "@masha_pech разобрала 5 ошибок в журнале",
  "@arseniy_komi решает 12 задач по теме «Параметры»",
  "@polina_vork: личный рекорд — 87 баллов",
  "@egor_mik: 85% точности в тренажёре вероятностей",
  "@vlada_mik присоединилась к платформе",
  "@nikita_int — 80 баллов за вариант «Досрочный 2024»",
  "@kira_ezhva занимается 14 дней подряд",
  "@timofey — решил №18 «Параметры» на 4 балла",
];

export function LiveTicker() {
  const track = [...TICKER_EVENTS, ...TICKER_EVENTS];
  return (
    <div className="marquee relative border-b border-board-700/60 bg-board-850/70 backdrop-blur">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-board-900 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-board-900 to-transparent" />
      <div className="relative mx-auto flex max-w-[1380px] items-center gap-3 px-3 sm:px-5">
        <span className="flex shrink-0 items-center gap-1.5 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-mark-yellow">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mark-green opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-mark-green" />
          </span>
          Live
        </span>
        <div className="overflow-hidden" aria-label="Последние события учеников">
          <div className="marquee-track items-center gap-2 py-2">
            {track.map((e, i) => (
              <span key={i} className="mr-2 flex items-center gap-2 whitespace-nowrap rounded-full border border-board-600/60 bg-board-800/60 px-3 py-1 text-[11.5px] font-medium text-chalk-300 transition-colors duration-200 hover:border-mark-yellow/50 hover:text-chalk-50">
                <span className="h-1.5 w-1.5 rounded-full bg-mark-yellow" />
                {e}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Header() {
  const { theme, toggle } = useTheme();
  const { user, route, go, logout, streak } = useApp();

  const activeNav: Route = route === "run" ? "variants" : route === "results" ? "analytics" : route;

  return (
    <header className="sticky top-0 z-40 border-b border-board-700/70 bg-board-900/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1380px] items-center gap-2 px-3 sm:gap-3 sm:px-5">
        <button onClick={() => go("home")} className="group flex min-w-0 items-center gap-2.5" aria-label="На главную">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-mark-yellow text-board-950 shadow-sm transition-transform duration-200 group-hover:scale-105 group-active:scale-95">
            <svg viewBox="0 0 32 32" className="h-5 w-5" aria-hidden="true">
              <path d="M5.5 20l3.6-7.2h3.4l4.6 10.6L22.5 8h4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="hidden min-w-0 text-left min-[400px]:block">
            <span className="font-display block truncate text-[13px] font-bold leading-tight tracking-tight text-chalk-50">Репетитор из Коми</span>
            <span className="hidden text-[10px] font-medium text-chalk-500 sm:block">ЕГЭ · профильная математика</span>
          </span>
        </button>

        <nav className="ml-auto hidden items-center gap-1 xl:flex" aria-label="Основная навигация">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = activeNav === n.key;
            return (
              <button key={n.key} onClick={() => go(n.key)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[13px] font-semibold transition-all duration-200 ${active ? "bg-board-700 text-mark-yellow" : "text-chalk-400 hover:bg-board-800 hover:text-chalk-50"}`}
                aria-current={active ? "page" : undefined} title={n.label}>
                <Icon className="h-4 w-4" />
                <span className="hidden 2xl:inline">{n.label}</span>
                <span className="2xl:hidden">{n.short}</span>
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2 xl:ml-4">
          {/* журнал ошибок — на мобильных один тап из шапки */}
          <button onClick={() => go("mistakes")}
            className={`flex h-11 w-11 items-center justify-center rounded-lg border transition-colors duration-200 active:scale-95 md:hidden ${route === "mistakes" ? "border-mark-yellow/60 bg-board-700 text-mark-yellow" : "border-board-600/70 bg-board-800/60 text-chalk-400 hover:text-chalk-50"}`}
            aria-label="Журнал ошибок" title="Журнал ошибок">
            <Eraser className="h-4 w-4" />
          </button>
          <button onClick={toggle}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-board-600/70 bg-board-800/60 text-chalk-400 transition-all duration-200 hover:border-mark-yellow/50 hover:text-mark-yellow active:scale-95 md:h-9 md:w-9"
            aria-label={theme === "dark" ? "Светлая тема" : "Тёмная тема"} title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}>
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <NotificationsBell />
          <span className="hidden items-center gap-1 rounded-full bg-board-800/70 px-2.5 py-1.5 text-[12px] font-bold tabular-nums text-mark-red md:flex" title={`Серия: ${streak.days} дн. подряд · ${streak.xp} XP`}>
            <Flame className="h-3.5 w-3.5" />{streak.days}
          </span>
          <button onClick={() => go("achieve")}
            className={`hidden h-9 w-9 items-center justify-center rounded-lg border transition-colors duration-200 md:flex ${route === "achieve" || route === "rating" ? "border-mark-yellow/60 bg-board-700 text-mark-yellow" : "border-board-600/70 bg-board-800/60 text-chalk-400 hover:border-mark-yellow/50 hover:text-mark-yellow"}`}
            aria-label="Достижения" title="Достижения">
            <Trophy className="h-4 w-4" />
          </button>

          {user ? (
            <>
              <button onClick={() => go("profile")}
                className={`hidden items-center gap-2.5 rounded-full border py-1 pl-1 pr-3.5 transition-colors duration-200 sm:flex ${route === "profile" ? "border-mark-yellow/60 bg-board-700" : "border-board-600/70 bg-board-800/60 hover:border-board-600"}`}
                aria-label="Настройки профиля" title="Настройки профиля">
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${user.role === "teacher" ? "bg-mark-yellow text-board-950" : "bg-board-600 text-chalk-50"}`}>
                  {user.nickname.slice(0, 2).toUpperCase()}
                </span>
                <span className="text-left">
                  <span className="block text-[12px] font-bold leading-tight text-chalk-50">@{user.nickname}</span>
                  <span className={`block text-[9.5px] font-bold leading-tight ${titleForLevel(levelFromXp(streak.xp)).color}`}>
                    {user.role === "teacher" ? "преподаватель · " : ""}LVL {levelFromXp(streak.xp)} · {titleForLevel(levelFromXp(streak.xp)).title}
                  </span>
                </span>
              </button>
              {user.role === "teacher" && (
                <button onClick={() => go("admin")}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors duration-200 ${route === "admin" ? "border-mark-yellow/60 bg-board-700 text-mark-yellow" : "border-board-600/70 bg-board-800/60 text-chalk-400 hover:text-chalk-50"}`}
                  aria-label="Кабинет преподавателя" title="Кабинет преподавателя">
                  <Settings className="h-4 w-4" />
                </button>
              )}
              <button onClick={logout} className="flex h-11 w-11 items-center justify-center rounded-lg border border-board-600/70 bg-board-800/60 text-chalk-500 transition-colors duration-200 hover:border-mark-red/50 hover:text-mark-red md:h-9 md:w-9" aria-label="Выйти" title="Выйти">
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button onClick={() => window.dispatchEvent(new CustomEvent("komi:login"))} className="flex items-center gap-1.5 rounded-lg border border-board-600/70 bg-board-800/60 px-3 py-2 text-[12.5px] font-bold text-chalk-300 transition-all duration-200 hover:border-mark-yellow/50 hover:text-mark-yellow active:scale-[0.98]">
              <LogIn className="h-3.5 w-3.5" />
              Войти
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export function MobileNav() {
  const { user, route, go } = useApp();
  const items = user?.role === "teacher" ? MOBILE_TEACHER : MOBILE_STUDENT;
  const activeNav: Route = route === "run" ? "variants" : route === "results" ? "analytics" : route;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-board-700/70 bg-board-900/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Мобильная навигация">
      <div className="grid grid-cols-5">
        {items.map((n) => {
          const Icon = n.icon;
          const active = activeNav === n.key;
          return (
            <button key={n.key} onClick={() => go(n.key)}
              className={`relative flex flex-col items-center gap-0.5 py-2 text-[9.5px] font-semibold transition-colors duration-200 ${active ? "text-mark-yellow" : "text-chalk-500"}`}
              aria-current={active ? "page" : undefined}>
              <span className={`absolute top-0 h-0.5 w-8 rounded-full bg-mark-yellow transition-opacity duration-200 ${active ? "opacity-100" : "opacity-0"}`} />
              <Icon className="h-5 w-5" />
              {n.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function Footer() {
  const { go } = useApp();
  return (
    <footer className="mt-10 border-t border-board-700/70 bg-board-950/60 pb-24 pt-8 md:pb-8">
      <div className="mx-auto flex max-w-[1380px] flex-wrap items-center gap-x-6 gap-y-3 px-4 sm:px-5">
        <p className="text-[12px] font-semibold text-chalk-400">
          <span className="font-display">Репетитор из Коми</span> · подготовка к ЕГЭ по математике · 6+
        </p>
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] font-semibold text-chalk-500">
          <button onClick={() => go("bank")} className="transition-colors hover:text-mark-yellow">Банк заданий</button>
          <button onClick={() => go("variants")} className="transition-colors hover:text-mark-yellow">Варианты</button>
          <button onClick={() => go("rating")} className="transition-colors hover:text-mark-yellow">Рейтинг и ачивки</button>
        </nav>
        <p className="ml-auto text-[11px] text-chalk-600">© 2026 · Даниил Пудов · Сыктывкар</p>
      </div>
      <div className="mx-auto mt-3 flex max-w-[1380px] flex-wrap items-center gap-x-4 gap-y-1 px-4 sm:px-5">
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("komi:legal", { detail: "privacy" }))}
          className="text-[11px] font-semibold text-chalk-600 underline-offset-2 transition-colors hover:text-mark-blue hover:underline"
        >
          Политика конфиденциальности
        </button>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("komi:legal", { detail: "terms" }))}
          className="text-[11px] font-semibold text-chalk-600 underline-offset-2 transition-colors hover:text-mark-blue hover:underline"
        >
          Пользовательское соглашение (Оферта)
        </button>
        <span className="text-[11px] text-chalk-600">152-ФЗ · самозанятый</span>
      </div>
    </footer>
  );
}

export function Toasts() {
  const { toasts } = useApp();
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast-in pointer-events-auto flex items-center gap-2.5 rounded-xl border border-mark-green/40 bg-board-800 px-4 py-3 shadow-lg">
          <span className="h-2 w-2 shrink-0 rounded-full bg-mark-green" />
          <p className="text-[12.5px] font-semibold leading-snug text-chalk-50">{t.msg}</p>
        </div>
      ))}
    </div>
  );
}

/* декоративные плавающие формулы для главной */
export function FloatingFormulas() {
  const formulas = ["∫₀^∞ e⁻ˣ² dx = √π⁄2", "sin²α + cos²α = 1", "x = (−b ± √D) ⁄ 2a", "logₐb · log_b c = logₐc", "V = ⅓·S·h", "(1 + p⁄100)ⁿ", "f′(x₀) = k", "aₙ₊₁ − aₙ = d"];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {formulas.map((f, i) => (
        <span key={f} className="drift absolute font-hand text-lg text-chalk-600/40 sm:text-xl"
          style={{ left: `${(i * 13 + 6) % 92}%`, top: `${(i * 23 + 12) % 80}%`, "--dur": `${12 + (i % 5) * 3}s`, "--dx": `${(i % 2 ? 1 : -1) * (14 + i * 3)}px`, "--dy": `${(i % 3 ? -1 : 1) * (16 + i * 2)}px`, "--rot-a": `${-4 + i}deg`, "--rot-b": `${3 - i}deg` } as React.CSSProperties}>
          {f}
        </span>
      ))}
    </div>
  );
}

/* иконки для страниц */
export { BookOpenCheck, CalendarDays, UserRound };

/* хук: печатающаяся строка */
export function useTypewriter(full: string, speed = 16, startDelay = 400) {
  const [out, setOut] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setOut(full); setDone(true); return; }
    let i = 0;
    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => {
      interval = setInterval(() => {
        i += 1;
        setOut(full.slice(0, i));
        if (i >= full.length) { if (interval) clearInterval(interval); setDone(true); }
      }, speed);
    }, startDelay);
    return () => { clearTimeout(timeout); if (interval) clearInterval(interval); };
  }, [full, speed, startDelay]);
  return { out, done };
}
