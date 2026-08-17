import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, BookOpenCheck, CalendarDays, ChevronDown, ClipboardList, Flame,
  Lightbulb, Play, Sparkles, Target, TrendingUp, Zap,
} from "lucide-react";
import { useApp } from "./store";
import {
  BANK, PROB_PROBLEMS, REAL_VARIANT, TASK_OF_DAY, VARIANTS, answersMatch, daysUntilExam, greeting,
} from "./data";
import { LatexText, Sparkline, TaskImage } from "./ui";
import { FloatingFormulas, useTypewriter } from "./shell";

/* ═══════════════════════ ГЛАВНАЯ ═══════════════════════ */
export function HomePage() {
  const { user, attempts, topicStats, mistakes, unlocked, go, startVariant } = useApp();
  const { out } = useTypewriter(user ? `Продолжаем готовиться, ${user.name.split(" ")[0]}?` : "Решай. Разбирай ошибки. Расти.");
  const days = daysUntilExam();
  const best = attempts.length ? Math.max(...attempts.map((a) => a.secondary)) : null;
  const unresolved = mistakes.filter((m) => !m.resolved).length;
  const weak = BANK.filter((t) => {
    const s = topicStats[t.number];
    return s && s.attempts > 0 && s.solved / s.attempts < 0.5;
  });
  const spark = attempts.slice(-10).map((a) => a.secondary);

  return (
    <div className="relative">
      <div className="board-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <FloatingFormulas />

      <div className="relative mx-auto max-w-[1380px] px-4 py-12 sm:px-5">
        <p className="rise flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.25em] text-mark-yellow">
          <Sparkles className="h-3.5 w-3.5" /> До ЕГЭ — <span className="tabular-nums text-chalk-50">{days} дней</span>
        </p>
        <h1 className="rise rise-1 mt-4 font-display text-4xl font-bold leading-[1.05] tracking-tight text-chalk-50 sm:text-6xl">
          Сначала — <span className="text-mark-yellow">балл</span>.<br />
          Потом — всё остальное.
        </h1>
        <p className="rise rise-2 mt-4 max-w-xl text-base leading-relaxed text-chalk-400 sm:text-lg">
          {out}<span className="caret" />
        </p>

        <div className="rise rise-3 mt-8 flex flex-wrap items-center gap-3">
          <button onClick={() => startVariant("v-real-2023")}
            className="group flex items-center gap-2.5 rounded-xl bg-mark-yellow px-6 py-3.5 text-[15px] font-bold text-board-950 shadow-lg shadow-mark-yellow/20 transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98]">
            <Play className="h-5 w-5" />
            Решить вариант
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
          </button>
          <button onClick={() => go("bank")}
            className="flex items-center gap-2 rounded-xl border border-board-600/70 bg-board-800/60 px-5 py-3.5 text-[14px] font-bold text-chalk-200 transition-all duration-200 hover:border-mark-green/50 hover:text-mark-green active:scale-[0.98]">
            <BookOpenCheck className="h-4.5 w-4.5" />
            Банк заданий
          </button>
        </div>

        {/* KPI */}
        <div className="rise rise-4 mt-12 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Лучший балл", value: best === null ? "—" : best, suffix: "/ 100", icon: Target, tone: "text-mark-yellow" },
            { label: "Попыток", value: attempts.length, suffix: "", icon: ClipboardList, tone: "text-mark-blue" },
            { label: "Серия дней", value: 6, suffix: "", icon: Flame, tone: "text-mark-red" },
            { label: "Ошибок в журнале", value: unresolved, suffix: "", icon: Lightbulb, tone: "text-mark-pink" },
          ].map((k) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className="group rounded-xl border border-board-600/50 bg-board-850/70 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-mark-yellow/40 hover:bg-board-800/70">
                <div className="flex items-center justify-between">
                  <p className="text-[10.5px] font-bold uppercase tracking-wide text-chalk-500">{k.label}</p>
                  <Icon className={`h-4 w-4 ${k.tone} transition-transform duration-200 group-hover:scale-110`} />
                </div>
                <p className="mt-2 font-display text-3xl font-bold tabular-nums text-chalk-50">
                  {k.value}<span className="ml-1 text-xs font-semibold text-chalk-500">{k.suffix}</span>
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_320px]">
          {/* динамика */}
          <div className="rise rise-5 rounded-xl border border-board-600/50 bg-board-850/70 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-sm font-bold text-chalk-50">Динамика тестового балла</h2>
                <p className="text-[11.5px] text-chalk-500">{attempts.length ? `${attempts.length} попыток · цель ${user?.goal ?? 84}` : "решите первый вариант"}</p>
              </div>
              <TrendingUp className="h-4.5 w-4.5 text-mark-green" />
            </div>
            <div className="mt-4">
              {spark.length >= 2 ? (
                <Sparkline values={spark} width={560} height={110} />
              ) : (
                <div className="flex h-[110px] items-center justify-center rounded-lg border border-dashed border-board-600/70 text-[12px] text-chalk-500">
                  График появится после двух попыток
                </div>
              )}
            </div>
          </div>

          {/* слабые темы / задача дня */}
          <div className="rise rise-5 flex flex-col gap-4">
            <div className="rounded-xl border border-board-600/50 bg-board-850/70 p-5">
              <h2 className="flex items-center gap-2 font-display text-sm font-bold text-chalk-50">
                <Zap className="h-4 w-4 text-mark-red" /> Требуют внимания
              </h2>
              {weak.length ? (
                <ul className="mt-3 space-y-2">
                  {weak.slice(0, 3).map((t) => (
                    <li key={t.number} className="flex items-center gap-2.5 rounded-lg border border-board-600/40 bg-board-800/50 px-3 py-2 transition-colors hover:border-mark-red/40">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-mark-red/20 text-[11px] font-bold text-mark-red">{t.number}</span>
                      <span className="truncate text-[12px] font-semibold text-chalk-200">№{t.number} · {t.topic}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-[12px] leading-relaxed text-chalk-500">Слабых тем пока нет — тренируйтесь в банке заданий.</p>
              )}
            </div>

            <div className="flex-1 rounded-xl border border-mark-yellow/30 bg-board-850/70 p-5">
              <p className="text-[10.5px] font-bold uppercase tracking-wide text-mark-yellow">Задача дня · №{TASK_OF_DAY.number} {TASK_OF_DAY.topic}</p>
              <p className="mt-2.5 text-[13px] leading-relaxed text-chalk-200"><LatexText text={TASK_OF_DAY.statement} /></p>
              <button onClick={() => go("bank")} className="mt-3.5 flex items-center gap-1.5 text-[12.5px] font-bold text-mark-yellow transition-colors hover:text-mark-green">
                Решить в банке <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        <p className="rise rise-5 mt-10 text-center font-hand text-2xl text-chalk-500">
          {attempts.length ? "Отличная работа — держим темп до июня!" : "Первый вариант — самый важный. Начните сегодня."}
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════ БАНК ЗАДАНИЙ ═══════════════════════ */
type Filter = "all" | "part1" | "part2" | "weak";

export function BankPage() {
  const { topicStats, go, startVariant } = useApp();
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<number | null>(null);

  const rows = useMemo(() =>
    BANK.map((t) => {
      const s = topicStats[t.number];
      const stat = s ? { success: s.attempts ? Math.round((s.solved / s.attempts) * 100) : 0, solved: s.solved, attempts: s.attempts } : { success: 0, solved: 0, attempts: 0 };
      return { ...t, stat };
    }), [topicStats]);

  const list = useMemo(() => {
    if (filter === "part1") return rows.filter((t) => t.part === 1);
    if (filter === "part2") return rows.filter((t) => t.part === 2);
    if (filter === "weak") return rows.filter((t) => t.stat.attempts > 0 && t.stat.success < 50);
    return rows;
  }, [filter, rows]);

  const color = (s: { success: number; attempts: number }) =>
    s.attempts === 0 ? { num: "bg-board-600", pct: "text-chalk-500", bar: "bg-board-600", card: "border-board-600/40 hover:border-board-600/70" }
    : s.success > 80 ? { num: "bg-mark-green/80", pct: "text-mark-green", bar: "bg-mark-green", card: "border-mark-green/30 hover:border-mark-green/60" }
    : s.success < 50 ? { num: "bg-mark-red/80", pct: "text-mark-red", bar: "bg-mark-red", card: "border-mark-red/30 hover:border-mark-red/60" }
    : { num: "bg-mark-yellow/80", pct: "text-mark-yellow", bar: "bg-mark-yellow", card: "border-mark-yellow/25 hover:border-mark-yellow/50" };

  const taskOfDay = BANK.find((t) => t.number === TASK_OF_DAY.number);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-5">
      <p className="rise text-[11px] font-bold uppercase tracking-[0.25em] text-mark-yellow">Кодификатор ФИПИ</p>
      <h1 className="rise rise-1 mt-2 font-display text-3xl font-bold tracking-tight text-chalk-50 sm:text-4xl">Банк заданий</h1>
      <p className="rise rise-2 mt-2 text-sm text-chalk-400">19 тем профильного ЕГЭ. Статистика строится по вашим реальным ответам.</p>

      <div className="rise rise-2 mt-6 flex flex-wrap gap-1.5">
        {([["all", "Все 19"], ["part1", "Часть 1"], ["part2", "Часть 2"], ["weak", "Слабые"]] as [Filter, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`rounded-full px-4 py-1.5 text-[12.5px] font-bold transition-all duration-200 active:scale-95 ${filter === k ? "bg-mark-yellow text-board-950 shadow-sm" : "border border-board-600/70 bg-board-800/60 text-chalk-400 hover:border-mark-yellow/50 hover:text-chalk-100"}`}>
            {l}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((t, i) => {
          const c = color(t.stat);
          const isOpen = open === t.number;
          const isTaskOfDay = taskOfDay?.number === t.number;
          return (
            <div key={t.number} className={`group rounded-xl border bg-board-850/70 p-4 transition-all duration-200 hover:-translate-y-0.5 ${c.card} ${isTaskOfDay ? "ring-1 ring-mark-yellow/40" : ""} rise rise-${Math.min((i % 5) + 1, 5)}`}>
              <button onClick={() => setOpen(isOpen ? null : t.number)} className="flex w-full items-center gap-3 text-left">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold text-board-950 ${c.num}`}>{t.number}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-chalk-100">№{t.number} · {t.topic}</span>
                  <span className="block text-[10.5px] font-semibold uppercase tracking-wide text-chalk-500">часть {t.part}{isTaskOfDay ? " · задача дня" : ""}</span>
                </span>
                <span className={`text-lg font-bold tabular-nums ${c.pct}`}>{t.stat.attempts === 0 ? "—" : `${t.stat.success}%`}</span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-chalk-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
              </button>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-board-700/70">
                <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${t.stat.success}%` }} />
              </div>
              {isOpen && (
                <div className="pop-in mt-3 border-t border-board-600/50 pt-3">
                  <p className="text-[12px] leading-relaxed text-chalk-300">{t.note}</p>
                  {t.stat.attempts > 0 && <p className="mt-2 text-[11px] font-semibold text-chalk-500">решено {t.stat.solved} из {t.stat.attempts}</p>}
                  {isTaskOfDay && (
                    <div className="mt-3 rounded-lg border border-mark-yellow/25 bg-board-800/60 p-3">
                      <p className="text-[12.5px] leading-relaxed text-chalk-200"><LatexText text={TASK_OF_DAY.statement} /></p>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-[12px] font-bold text-mark-yellow">Показать разбор</summary>
                        <p className="mt-1.5 text-[12px] leading-relaxed text-chalk-300"><LatexText text={TASK_OF_DAY.explain} /></p>
                      </details>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filter === "weak" && list.length === 0 && (
        <div className="rise rise-2 mt-6 rounded-xl border border-dashed border-board-600/70 bg-board-850/40 px-5 py-8 text-center">
          <p className="text-sm font-bold text-chalk-200">Слабых тем пока нет</p>
          <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-chalk-500">Они появятся, когда по теме наберётся хотя бы одна попытка с точностью ниже 50%.</p>
        </div>
      )}

      <div className="rise rise-4 mt-8 flex justify-center">
        <button onClick={() => startVariant("v-real-2023")} className="group flex items-center gap-2 rounded-xl bg-mark-yellow px-6 py-3 text-sm font-bold text-board-950 shadow-lg shadow-mark-yellow/20 transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98]">
          <CalendarDays className="h-4 w-4" /> Собрать всё в вариант <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════ ВАРИАНТЫ ═══════════════════════ */
export function VariantsPage() {
  const { attempts, startVariant } = useApp();
  const bestBy = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of attempts) { const c = m.get(a.variantId); if (c === undefined || a.secondary > c) m.set(a.variantId, a.secondary); }
    return m;
  }, [attempts]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-5">
      <p className="rise text-[11px] font-bold uppercase tracking-[0.25em] text-mark-yellow">Реальные КИМы</p>
      <h1 className="rise rise-1 mt-2 font-display text-3xl font-bold tracking-tight text-chalk-50 sm:text-4xl">Варианты</h1>
      <p className="rise rise-2 mt-2 text-sm text-chalk-400">Полные варианты из открытого банка ФИПИ: 19 заданий, таймер 3 ч 55 мин, автопроверка части 1.</p>

      <ul className="mt-6 space-y-3">
        {VARIANTS.map((v, i) => {
          const score = bestBy.get(v.id);
          const available = v.available !== false;
          return (
            <li key={v.id} className={`group rounded-xl border border-board-600/50 bg-board-850/70 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-mark-yellow/40 ${!available ? "opacity-60" : ""} rise rise-${Math.min(i + 2, 5)}`}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-mark-yellow/15 text-mark-yellow"><ClipboardList className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[14px] font-bold text-chalk-50">
                    {v.title} {v.year}
                    {v.isReal && <span className="rounded-full bg-mark-green/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-mark-green">реальные задания</span>}
                    <span className="rounded-full bg-board-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-chalk-300">{v.difficulty}</span>
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-chalk-500">{v.region}</p>
                </div>
                {!available ? (
                  <span className="rounded-lg border border-dashed border-board-600/70 px-4 py-2 text-sm font-semibold text-chalk-500">Скоро в банке</span>
                ) : score !== undefined ? (
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-lg font-bold tabular-nums text-mark-yellow">{score}</div>
                      <div className="text-[10px] font-medium uppercase tracking-wide text-chalk-500">ваш балл</div>
                    </div>
                    <button onClick={() => startVariant(v.id)} className="rounded-lg border border-board-600/70 px-4 py-2.5 text-sm font-semibold text-chalk-200 transition-all hover:border-mark-green/50 hover:text-mark-green active:scale-[0.98]">Ещё раз</button>
                  </div>
                ) : (
                  <button onClick={() => startVariant(v.id)} className="group/btn flex items-center gap-2 rounded-lg bg-mark-yellow px-5 py-2.5 text-sm font-bold text-board-950 transition-all hover:brightness-110 active:scale-[0.98]">
                    Начать <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover/btn:translate-x-0.5" />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ═══════════════════════ РЕШЕНИЕ ВАРИАНТА ═══════════════════════ */
const EXAM_SECONDS = 3 * 3600 + 55 * 60;
function fmt(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function RunPage() {
  const { submitExam, go } = useApp();
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [seconds, setSeconds] = useState(EXAM_SECONDS);
  const [current, setCurrent] = useState(1);

  const part1 = REAL_VARIANT.filter((t) => t.part === 1);
  const part2 = REAL_VARIANT.filter((t) => t.part === 2);
  const task = REAL_VARIANT.find((t) => t.number === current)!;
  const answered = part1.filter((t) => (answers[t.number] ?? "").trim()).length;
  const tense = seconds < 30 * 60;

  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  const finish = () => {
    const payload: Record<string, string> = {};
    for (const [k, v] of Object.entries(answers)) payload[Number(k)] = v;
    submitExam(payload, EXAM_SECONDS - seconds);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-5">
      {/* шапка */}
      <div className="rise flex flex-wrap items-center gap-3">
        <button onClick={() => go("variants")} className="rounded-lg border border-board-600/70 px-3 py-2 text-[12.5px] font-bold text-chalk-400 transition-colors hover:border-mark-red/50 hover:text-mark-red">← Выйти</button>
        <div>
          <h1 className="font-display text-lg font-bold text-chalk-50">Основной период · реальные задания</h1>
          <p className="text-[11px] text-chalk-500">Отвечено {answered} из {part1.length} (часть 1)</p>
        </div>
        <span className={`ml-auto flex items-center gap-2 rounded-lg border px-3 py-2 font-mono text-sm font-bold tabular-nums ${tense ? "border-mark-red/50 bg-mark-red/10 text-mark-red" : "border-board-600/70 bg-board-800/60 text-chalk-100"}`}>
          {fmt(seconds)}
        </span>
        <button onClick={finish} className="rounded-lg bg-mark-yellow px-4 py-2 text-[13px] font-bold text-board-950 transition-all hover:brightness-110 active:scale-[0.98]">Завершить</button>
      </div>

      {/* навигация по заданиям */}
      <div className="rise rise-1 mt-5 flex flex-wrap gap-1.5">
        {REAL_VARIANT.map((t) => {
          const done = t.part === 1 && (answers[t.number] ?? "").trim();
          const active = current === t.number;
          return (
            <button key={t.number} onClick={() => setCurrent(t.number)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-[12px] font-bold transition-all duration-150 active:scale-90 ${active ? "bg-mark-yellow text-board-950 ring-2 ring-mark-yellow/40" : done ? "bg-mark-green/20 text-mark-green" : t.part === 2 ? "bg-board-700/60 text-chalk-500" : "bg-board-800 text-chalk-300 hover:bg-board-700"}`}>
              {t.number}
            </button>
          );
        })}
      </div>

      {/* условие */}
      <div key={current} className="pop-in mt-5 rounded-xl border border-board-600/50 bg-board-850/70 p-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-mark-yellow/15 text-[13px] font-bold text-mark-yellow">№{task.number}</span>
          <span className="text-[11px] font-bold uppercase tracking-wide text-chalk-500">{task.category} · часть {task.part} · {task.maxScore} б.</span>
        </div>
        <p className="mt-4 text-[15px] leading-relaxed text-chalk-100"><LatexText text={task.statement} /></p>
        {task.imageUrls?.map((src, i) => <TaskImage key={i} src={src} alt={`Чертёж к заданию ${task.number}`} />)}

        {task.part === 1 ? (
          <div className="mt-5">
            <input
              value={answers[task.number] ?? ""}
              onChange={(e) => setAnswers((a) => ({ ...a, [task.number]: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && current < 12 && setCurrent((c) => c + 1)}
              placeholder="Ваш ответ — например 0,6"
              className="w-full rounded-lg border-2 border-board-600/70 bg-board-800/60 px-4 py-3 font-mono text-lg font-semibold text-chalk-50 outline-none transition-all placeholder:font-sans placeholder:text-[13px] placeholder:font-normal placeholder:text-chalk-500 focus:border-mark-yellow focus:ring-4 focus:ring-mark-yellow/10"
              aria-label={`Ответ к заданию ${task.number}`}
              autoFocus
            />
            {task.hint && <p className="mt-2.5 flex items-center gap-1.5 text-[11.5px] text-chalk-500"><Lightbulb className="h-3.5 w-3.5 shrink-0 text-mark-yellow" />{task.hint}</p>}
            <div className="mt-4 flex gap-2">
              <button onClick={() => setCurrent((c) => Math.max(1, c - 1))} disabled={current === 1} className="rounded-lg border border-board-600/70 px-4 py-2.5 text-[13px] font-bold text-chalk-300 transition-all hover:text-chalk-100 disabled:opacity-30">← Назад</button>
              <button onClick={() => setCurrent((c) => Math.min(19, c + 1))} disabled={current === 19} className="ml-auto rounded-lg bg-board-700 px-5 py-2.5 text-[13px] font-bold text-chalk-100 transition-all hover:bg-board-600 disabled:opacity-30">Дальше →</button>
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-lg border border-mark-blue/30 bg-mark-blue/5 p-4">
            <p className="text-[13px] font-bold text-mark-blue">Развёрнутый ответ</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-chalk-300">Выполните решение на бланке — его проверит преподаватель вручную по критериям. Автопроверка здесь не применяется.</p>
          </div>
        )}
      </div>

      <div className="rise rise-3 mt-6 flex justify-center">
        <button onClick={finish} className="rounded-xl bg-mark-yellow px-8 py-3.5 text-[15px] font-bold text-board-950 shadow-lg shadow-mark-yellow/20 transition-all hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98]">
          Завершить вариант и проверить
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════ РЕЗУЛЬТАТЫ ═══════════════════════ */
export function ResultsPage() {
  const { lastResult, go, mistakes } = useApp();
  if (!lastResult) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="text-chalk-400">Пока нет результатов — решите вариант.</p>
        <button onClick={() => go("variants")} className="mt-4 rounded-lg bg-mark-yellow px-5 py-2.5 text-sm font-bold text-board-950">К вариантам</button>
      </div>
    );
  }
  const r = lastResult;
  const passed = r.secondary >= 70;
  const unresolved = mistakes.filter((m) => !m.resolved).length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-5">
      <p className="rise text-center text-[11px] font-bold uppercase tracking-[0.25em] text-mark-yellow">Вариант проверен</p>
      <div className="rise rise-1 mt-6 rounded-xl border border-board-600/50 bg-board-850/70 p-8 text-center">
        <p className="text-[11px] font-bold uppercase tracking-wide text-chalk-500">Тестовый балл</p>
        <p className={`mt-1 font-display text-7xl font-bold tabular-nums ${passed ? "text-mark-green" : "text-mark-yellow"}`}>{r.secondary}</p>
        <div className="mx-auto mt-3 h-2 max-w-sm overflow-hidden rounded-full bg-board-700">
          <div className={`h-full rounded-full ${passed ? "bg-mark-green" : "bg-mark-yellow"} transition-all duration-1000`} style={{ width: `${r.secondary}%` }} />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[["первичный", `${r.primary} / 12`], ["верно", String(r.correct)], ["ошибки", String(r.incorrect)], ["пропуски", String(r.skipped)]].map(([l, v]) => (
            <div key={l} className="rounded-lg border border-board-600/40 bg-board-800/50 px-3 py-3">
              <p className="text-xl font-bold tabular-nums text-chalk-50">{v}</p>
              <p className="text-[10px] font-medium uppercase tracking-wide text-chalk-500">{l}</p>
            </div>
          ))}
        </div>
        <p className={`mt-5 rounded-lg border px-4 py-3 text-[13px] font-semibold ${passed ? "border-mark-green/30 bg-mark-green/5 text-mark-green" : "border-mark-yellow/30 bg-mark-yellow/5 text-mark-yellow"}`}>
          {r.secondary >= 80 ? "Отличный результат — уровень топ-вузов!" : passed ? "Порог вуза пройден. Дальше — только выше." : "Порог пока не пройден — разберите ошибки ниже."}
        </p>
      </div>

      <div className="rise rise-2 mt-5 rounded-xl border border-board-600/50 bg-board-850/70 p-5">
        <h2 className="font-display text-sm font-bold text-chalk-50">Разбор части 1</h2>
        <ul className="mt-3 divide-y divide-board-700/60">
          {r.rows.map((row) => (
            <li key={row.number} className="flex items-start gap-3 py-3">
              <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold ${row.status === "correct" ? "bg-mark-green/20 text-mark-green" : row.status === "incorrect" ? "bg-mark-red/20 text-mark-red" : "bg-board-700 text-chalk-500"}`}>
                {row.number}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-semibold text-chalk-200">
                  ваш ответ: <span className="font-mono">{row.given ?? "—"}</span>
                  <span className="mx-1.5 text-chalk-500">·</span>
                  эталон: <span className="font-mono text-mark-green">{row.reference}</span>
                </p>
                {row.solution && <p className="mt-1 text-[12px] leading-relaxed text-chalk-400"><LatexText text={row.solution} /></p>}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="rise rise-3 mt-6 flex flex-wrap justify-center gap-2.5">
        {unresolved > 0 && (
          <button onClick={() => go("mistakes")} className="rounded-lg border border-mark-red/40 bg-mark-red/10 px-5 py-2.5 text-sm font-bold text-mark-red transition-all hover:bg-mark-red/20">
            Разобрать {unresolved} ошибок
          </button>
        )}
        <button onClick={() => go("analytics")} className="rounded-lg bg-mark-yellow px-5 py-2.5 text-sm font-bold text-board-950 transition-all hover:brightness-110">Аналитика</button>
        <button onClick={() => go("variants")} className="rounded-lg border border-board-600/70 px-5 py-2.5 text-sm font-bold text-chalk-300 transition-all hover:text-chalk-100">Другой вариант</button>
      </div>
    </div>
  );
}

/* ═══════════════════════ ТРЕНАЖЁР ВЕРОЯТНОСТЕЙ ═══════════════════════ */
export function ProbabilityPage() {
  const { setProbBest, recordAnswer } = useApp();
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [verdicts, setVerdicts] = useState<Record<string, "correct" | "wrong">>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const total = Object.keys(verdicts).length;
  const correct = Object.values(verdicts).filter((v) => v === "correct").length;
  const pct = total ? Math.round((correct / total) * 100) : 0;

  const check = (id: string, answer: string, num: number) => {
    const given = inputs[id] ?? "";
    if (!given.trim()) return;
    const ok = answersMatch(given, answer);
    setVerdicts((v) => ({ ...v, [id]: ok ? "correct" : "wrong" }));
    setRevealed((r) => ({ ...r, [id]: true }));
    recordAnswer(num, ok);
    const t = total + (verdicts[id] ? 0 : 1);
    const c = correct + (ok ? 1 : 0);
    if (t >= 4) setProbBest(Math.round((c / t) * 100));
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-5">
      <p className="rise text-[11px] font-bold uppercase tracking-[0.25em] text-mark-yellow">Тренажёр · №4 и №5</p>
      <div className="rise rise-1 mt-2 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl font-bold tracking-tight text-chalk-50 sm:text-4xl">Теория вероятностей</h1>
        <span className="rounded-lg border border-board-600/70 bg-board-800/60 px-4 py-2 text-sm font-bold tabular-nums text-chalk-100">
          {correct}/{total}{total > 0 && <span className="ml-1 text-chalk-500">· {pct}%</span>}
        </span>
      </div>
      {total > 0 && (
        <div className="rise rise-1 mt-3 h-1.5 overflow-hidden rounded-full bg-board-700">
          <div className={`h-full rounded-full ${pct >= 80 ? "bg-mark-green" : pct >= 50 ? "bg-mark-yellow" : "bg-mark-red"} transition-all duration-500`} style={{ width: `${pct}%` }} />
        </div>
      )}

      <ul className="mt-6 space-y-4">
        {PROB_PROBLEMS.map((p, i) => {
          const v = verdicts[p.id];
          const num = /сложная/i.test(p.topic) ? 5 : 4;
          return (
            <li key={p.id} className={`rounded-xl border bg-board-850/70 p-5 transition-all duration-200 ${v === "correct" ? "border-mark-green/40" : v === "wrong" ? "border-mark-red/40" : "border-board-600/50"} rise rise-${Math.min((i % 5) + 1, 5)}`}>
              <div className="flex items-center gap-2">
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-bold text-board-950 ${num === 5 ? "bg-mark-blue" : "bg-mark-green"}`}>№{num}</span>
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-chalk-500">{p.topic}</span>
              </div>
              <p className="mt-3 text-[13.5px] leading-relaxed text-chalk-100"><LatexText text={p.text} /></p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <input
                  value={inputs[p.id] ?? ""}
                  onChange={(e) => setInputs((x) => ({ ...x, [p.id]: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && check(p.id, p.answer, num)}
                  disabled={!!v}
                  placeholder="Ответ, например 0,25"
                  className="w-full flex-1 rounded-lg border-2 border-board-600/70 bg-board-800/60 px-3.5 py-2.5 font-mono text-[15px] font-semibold text-chalk-50 outline-none transition-all placeholder:font-sans placeholder:text-[13px] placeholder:font-normal placeholder:text-chalk-500 focus:border-mark-yellow focus:ring-4 focus:ring-mark-yellow/10 disabled:opacity-60"
                  aria-label={`Ответ к задаче ${p.id}`}
                />
                <button onClick={() => check(p.id, p.answer, num)} disabled={!!v || !(inputs[p.id] ?? "").trim()}
                  className="rounded-lg bg-mark-yellow px-5 py-2.5 text-[13px] font-bold text-board-950 transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40">
                  Проверить
                </button>
              </div>
              {revealed[p.id] && (
                <div className={`pop-in mt-3 rounded-lg border px-4 py-3 text-[12.5px] leading-relaxed ${v === "correct" ? "border-mark-green/30 bg-mark-green/5 text-mark-green" : "border-mark-red/30 bg-mark-red/5 text-mark-red"}`}>
                  <b>Ответ: {p.answer.replace(".", ",")}.</b> <span className="text-chalk-200"><LatexText text={p.explain} /></span>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {total === PROB_PROBLEMS.length && (
        <div className="pop-in mt-6 rounded-xl border border-mark-yellow/30 bg-board-850/70 p-6 text-center">
          <p className="font-display text-2xl font-bold text-chalk-50">Тренажёр пройден: {pct}%</p>
          <p className="mt-1 text-[13px] text-chalk-400">{pct >= 80 ? "Ачивка «Вероятностный снайпер» ваша!" : "Пройдите ещё раз — ошибки разбираются прямо здесь."}</p>
        </div>
      )}
    </div>
  );
}
