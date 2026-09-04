import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, BookOpenCheck, CalendarDays, CheckCircle2, ChevronDown, ClipboardList, Eraser, Eye, Flame, Info,
  Lightbulb, MinusCircle, Play, Rocket, Snowflake, Sparkles, Target, Timer, Users, XCircle,
} from "lucide-react";
import { EGE_DATE_LABEL, EGE_DATE_NOTE } from "./config";
import { FREEZE_COST, useApp, type CustomTask, type ExamResult, type ExamMode } from "./store";
import {
  BANK, PROB_PROBLEMS, REAL_VARIANT, VARIANTS, answersMatch, daysUntilExam, getDailyTip, greeting,
} from "./data";
import { AnswerInput, Heatmap, LatexText, Sparkline, StreakFlame, TaskImage, XpBar } from "./ui";
import { FloatingFormulas, useTypewriter } from "./shell";
import ExamModeSelector from "./ExamModeSelector";

/* ═══════════════════════ ГЛАВНАЯ ═══════════════════════ */

interface DailyTask {
  number: number;
  topic: string;
  statement: string;
  answer: string;
  explain?: string;
}

/**
 * «Задача дня» — случайная задача из всего пула первой части:
 * реальные задания варианта + тренажёр вероятностей + банк,
 * загруженный преподавателем. Выбор детерминирован по номеру дня:
 * каждый день — новая задача, в течение суток одна и та же.
 */
function useTaskOfDay(): DailyTask | null {
  const { taskBank } = useApp();
  return useMemo(() => {
    const pool: DailyTask[] = [];
    for (const t of REAL_VARIANT) {
      if (t.part === 1 && t.answer) pool.push({ number: t.number, topic: t.category, statement: t.statement, answer: t.answer, explain: t.solution });
    }
    for (const p of PROB_PROBLEMS) {
      pool.push({ number: /сложная/i.test(p.topic) ? 5 : 4, topic: p.topic, statement: p.text, answer: p.answer, explain: p.explain });
    }
    for (const t of taskBank) {
      if (t.exam_type === "ege" && !t.is_second_part && t.correct_answer) {
        pool.push({ number: t.task_number, topic: t.topic, statement: t.condition_text, answer: t.correct_answer, explain: t.solution_text ?? undefined });
      }
    }
    if (!pool.length) return null;
    const dayIndex = Math.floor(Date.now() / 86_400_000);
    return pool[dayIndex % pool.length];
  }, [taskBank]);
}

/** Прогноз балла: экстраполяция среднего прироста за последние попытки. */
function useForecast(seconds: number[]): number | null {
  return useMemo(() => {
    if (seconds.length < 3) return null;
    const recent = seconds.slice(-5);
    const deltas: number[] = [];
    for (let i = 1; i < recent.length; i++) deltas.push(recent[i] - recent[i - 1]);
    const avgDelta = deltas.reduce((s, d) => s + d, 0) / deltas.length;
    const last = recent[recent.length - 1];
    /* прогноз на ~3 варианта вперёд, ограничиваем диапазоном */
    return Math.max(0, Math.min(100, Math.round(last + avgDelta * 3)));
  }, [seconds]);
}

export function HomePage() {
  const {
    user, attempts, topicStats, mistakes, go, startVariant, streak, todaySolved,
    inviteCode, referrals, marathonBest, pushToast, buyFreeze,
  } = useApp();
  const [modeSelectorOpen, setModeSelectorOpen] = useState(false);
  const [pendingVariantId, setPendingVariantId] = useState<string | null>(null);
  
  const handleStartVariant = (id: string) => {
    setPendingVariantId(id);
    setModeSelectorOpen(true);
  };
  
  const handleModeSelect = (mode: ExamMode) => {
    if (pendingVariantId) {
      startVariant(pendingVariantId, mode);
    }
    setModeSelectorOpen(false);
    setPendingVariantId(null);
  };
  
  const days = daysUntilExam();
  const best = attempts.length ? Math.max(...attempts.map((a) => a.secondary)) : null;
  const unresolved = mistakes.filter((m) => !m.resolved).length;
  const firstWeak = BANK.find((t) => {
    const s = topicStats[t.number];
    return s && s.attempts > 0 && s.solved / s.attempts < 0.5;
  });
  const spark = attempts.slice(-10).map((a) => a.secondary);
  const forecast = useForecast(attempts.map((a) => a.secondary));
  const taskOfDay = useTaskOfDay();
  const dailyTip = getDailyTip();
  /* серия есть, но сегодня ещё ни одной задачи — серия может сгореть */
  const streakAtRisk = streak.days > 0 && !todaySolved;
  const { out } = useTypewriter(user ? `Продолжаем, @${user.nickname}? Балл сам себя не поднимет.` : "Решай. Разбирай ошибки. Расти.");

  return (
    <div className="relative">
      <div className="board-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <FloatingFormulas />

      <div className="relative mx-auto max-w-[1380px] px-4 pb-4 pt-10 sm:px-5">
        {/* живая строка состояния — счёт, серия, опыт */}
        <div className="rise card flex flex-wrap items-center gap-x-8 gap-y-4 px-6 py-5">
          <div>
            <p className="tick">До ЕГЭ по профилю</p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-5xl font-bold leading-none tabular-nums text-chalk-50">{days}</span>
              <span className="text-sm font-semibold text-chalk-400">дней</span>
            </p>
            <p
              className="mt-1.5 flex cursor-help items-center gap-1.5 text-[10.5px] font-medium text-chalk-500"
              title={`${EGE_DATE_LABEL} · ${EGE_DATE_NOTE}`}
            >
              <CalendarDays className="h-3 w-3 shrink-0 text-mark-blue" />
              {EGE_DATE_LABEL}
              <Info className="h-3 w-3 shrink-0 text-chalk-500" />
              <span className="hidden sm:inline">· {EGE_DATE_NOTE}</span>
            </p>
          </div>
          <div className="hidden h-12 w-px bg-board-700 sm:block" />
          <div className="flex flex-col gap-2">
            <StreakFlame days={streak.days} active={todaySolved} freezes={streak.freezes} />
            <button
              onClick={buyFreeze}
              disabled={streak.xp < FREEZE_COST}
              className={`group flex w-fit items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-all active:scale-95 ${
                streak.xp >= FREEZE_COST
                  ? "border-mark-blue/40 bg-mark-blue/10 text-mark-blue hover:bg-mark-blue/20"
                  : "cursor-not-allowed border-board-600/50 bg-board-800/40 text-chalk-600"
              }`}
              title={streak.xp >= FREEZE_COST ? `Купить заморозку за ${FREEZE_COST} XP` : `Нужно ${FREEZE_COST} XP (у вас ${streak.xp})`}
            >
              <Snowflake className="h-3.5 w-3.5" />
              Страховка серии · {FREEZE_COST} XP
            </button>
          </div>
          <div className="hidden h-12 w-px bg-board-700 sm:block" />
          <XpBar xp={streak.xp} className="min-w-[180px] flex-1 sm:max-w-xs" />
          <div className="ml-auto text-right">
            <p className="tick">{greeting()}</p>
            <p className="mt-1 max-w-xs text-[13px] font-semibold leading-snug text-chalk-300">{out}<span className="caret" /></p>
          </div>
        </div>

        {/* серия под угрозой — решающий момент удержания */}
        {streakAtRisk && (
          <div className="rise rise-1 mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-mark-red/40 bg-mark-red/10 px-5 py-4">
            <Flame className="flame-live h-6 w-6 shrink-0 text-mark-red" />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-bold text-mark-red">Серия {streak.days} {streak.days === 1 ? "день" : "дней"} под угрозой!</p>
              <p className="text-[12px] text-chalk-300">Сегодня ещё не решено ни одной задачи — реши хотя бы одну, чтобы не потерять прогресс.</p>
            </div>
            <button
              onClick={() => go(firstWeak ? "trainer" : "probability")}
              className="btn-gold shrink-0 px-4 py-2.5 text-[12.5px]"
            >
              {firstWeak ? `Тренировать №${firstWeak.number}` : "Решить задачу"}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* bento */}
        <div className="mt-4 grid grid-cols-12 gap-4">
          {/* решить вариант */}
          <div className="rise rise-1 card card-hover col-span-12 flex flex-col justify-between p-6 lg:col-span-7">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="tick text-mark-yellow">Основной режим</p>
                <h1 className="mt-2 font-display text-2xl font-bold leading-tight text-chalk-50 sm:text-3xl">
                  Вариант из реальных заданий ФИПИ
                </h1>
              </div>
              <span className="chip"><Timer className="h-3.5 w-3.5 text-mark-blue" />3 ч 55 мин</span>
            </div>
            <p className="mt-3 max-w-md text-[13.5px] leading-relaxed text-chalk-400">
              20 заданий (часть 1: №1–13, часть 2: №14–20), автопроверка части 1, шкала перевода в тестовый балл.
              {unresolved > 0 && <> У вас <b className="text-mark-red">{unresolved}</b> неразобранных ошибок — вариант закроет сразу несколько.</>}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button onClick={() => handleStartVariant("v-real-2023")} className="btn-gold px-6 py-3.5 text-[15px]">
                <Play className="h-5 w-5" /> Решить вариант <ArrowRight className="h-4 w-4" />
              </button>
              <button onClick={() => go("bank")} className="btn-ghost px-5 py-3.5 text-[14px]">
                <BookOpenCheck className="h-4 w-4" /> Банк заданий
              </button>
            </div>
          </div>

          {/* тепловая карта */}
          <div className="rise rise-2 card col-span-12 p-5 lg:col-span-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-sm font-bold text-chalk-50">Тепловая карта номеров</h2>
              <button onClick={() => go("analytics")} className="text-[11.5px] font-bold text-mark-blue transition-colors hover:text-chalk-50">аналитика →</button>
            </div>
            <Heatmap stats={topicStats} />
          </div>

          {/* задача дня — случайная из всего банка части 1 */}
          <div className="rise rise-3 card col-span-12 p-5 md:col-span-5">
            <h2 className="flex items-center gap-2 font-display text-sm font-bold text-chalk-50">
              <Sparkles className="h-4 w-4 text-mark-yellow" />
              {taskOfDay ? `Задача дня · №${taskOfDay.number} ${taskOfDay.topic}` : "Задача дня"}
            </h2>
            {taskOfDay ? (
              <TaskOfDayBlock task={taskOfDay} />
            ) : (
              <p className="mt-2.5 text-[12.5px] text-chalk-500">Задачи части 1 появятся здесь — загрузите банк в кабинете преподавателя.</p>
            )}
          </div>

          {/* продолжить */}
          <div className="rise rise-4 card card-hover col-span-12 flex flex-col p-5 md:col-span-4"
            onClick={() => go(unresolved > 0 ? "mistakes" : "probability")} role="button" tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && go(unresolved > 0 ? "mistakes" : "probability")}>
            <p className="tick">{unresolved > 0 ? "Продолжить разбор" : "Тренажёр"}</p>
            {unresolved > 0 ? (
              <>
                <p className="mt-2 font-display text-3xl font-bold tabular-nums text-mark-red">{unresolved}</p>
                <p className="text-[12.5px] font-semibold text-chalk-300">ошибок ждут разбора</p>
                <p className="mt-auto flex items-center gap-1.5 pt-3 text-[12px] font-bold text-mark-yellow"><Eraser className="h-3.5 w-3.5" />Открыть журнал <ArrowRight className="h-3.5 w-3.5" /></p>
              </>
            ) : (
              <>
                <p className="mt-2 font-display text-3xl font-bold text-mark-green">№4–5</p>
                <p className="text-[12.5px] font-semibold text-chalk-300">вероятность без промахов</p>
                <p className="mt-auto flex items-center gap-1.5 pt-3 text-[12px] font-bold text-mark-yellow"><Target className="h-3.5 w-3.5" />12 задач <ArrowRight className="h-3.5 w-3.5" /></p>
              </>
            )}
          </div>

          {/* динамика */}
          <div className="rise rise-5 card col-span-12 p-5 md:col-span-3">
            <p className="tick">Лучший балл</p>
            <p className="mt-1 font-display text-4xl font-bold tabular-nums text-chalk-50">{best ?? "—"}</p>
            {spark.length >= 2 ? (
              <div className="mt-2"><Sparkline values={spark} /></div>
            ) : (
              <p className="mt-2 text-[11.5px] leading-relaxed text-chalk-500">Решите два варианта — здесь появится график роста.</p>
            )}
            {forecast !== null && (
              <p className="mt-2 flex items-center gap-1.5 rounded-lg border border-mark-blue/25 bg-mark-blue/5 px-2.5 py-2 text-[11px] font-semibold text-mark-blue" title="Экстраполяция по приросту за последние 5 попыток — на ~3 варианта вперёд">
                <Target className="h-3.5 w-3.5 shrink-0" />
                Прогноз: <b className="tabular-nums">{forecast}</b> через 3 варианта
              </p>
            )}
          </div>

          {/* марафон */}
          <div className="rise rise-5 card card-hover col-span-12 flex flex-col p-5 md:col-span-6"
            onClick={() => go("marathon")} role="button" tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && go("marathon")}>
            <div className="flex items-center justify-between">
              <p className="tick text-mark-red">Скоростной режим</p>
              <Rocket className="h-5 w-5 text-mark-red" />
            </div>
            <p className="mt-2 font-display text-xl font-bold text-chalk-50">Марафон · часть 1</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-chalk-400">
              Решай задачи подряд на время — бонус XP за скорость.
            </p>
            <p className="mt-auto flex items-center gap-1.5 pt-3 text-[12px] font-bold text-mark-yellow">
              <Timer className="h-3.5 w-3.5" />
              {marathonBest > 0 ? `Лучший: ${marathonBest}/10 · Сыграть ещё` : "Сыграть первый"}
              <ArrowRight className="h-3.5 w-3.5" />
            </p>
          </div>

          {/* приведи друга */}
          <div className="rise rise-5 card col-span-12 flex flex-col p-5 md:col-span-6">
            <div className="flex items-center justify-between">
              <p className="tick text-mark-pink">Реферальная система</p>
              <Users className="h-5 w-5 text-mark-pink" />
            </div>
            <p className="mt-2 font-display text-xl font-bold text-chalk-50">Приведи друга</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-chalk-400">
              Друг получает <b className="text-mark-green">+30 XP</b>, ты — <b className="text-mark-green">+50 XP</b> за каждого.
            </p>
            {user ? (
              <div className="mt-auto pt-3">
                <div className="flex items-center gap-2 rounded-lg border border-board-600/70 bg-board-950/60 px-3 py-2.5">
                  <code className="min-w-0 flex-1 truncate font-mono text-[12px] font-bold text-mark-yellow">{inviteCode}</code>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const link = `${location.origin}${location.pathname}?ref=${inviteCode}`;
                      navigator.clipboard?.writeText(link);
                      pushToast("Ссылка-приглашение скопирована");
                    }}
                    className="btn-ghost shrink-0 px-3 py-1.5 text-[11.5px]"
                  >
                    Копировать ссылку
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-chalk-500">
                  Приглашено: <b className="tabular-nums text-chalk-200">{referrals.length}</b>
                </p>
              </div>
            ) : (
              <p className="mt-auto pt-3 text-[11.5px] text-chalk-500">Войди, чтобы получить свою ссылку-приглашение.</p>
            )}
          </div>
        </div>

        {/* совет дня */}
        <div className="rise rise-5 mt-4 flex items-start gap-3 rounded-xl border border-board-600/50 bg-board-850/70 px-5 py-4">
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-mark-yellow" />
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-chalk-500">Совет дня</p>
            <p className="mt-1 text-[13px] font-medium leading-relaxed text-chalk-200">{dailyTip}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskOfDayBlock({ task }: { task: DailyTask }) {
  const { recordAnswer } = useApp();
  const [input, setInput] = useState("");
  const [verdict, setVerdict] = useState<null | boolean>(null);
  const [revealed, setRevealed] = useState(false);
  const check = () => {
    if (!input.trim()) return;
    const ok = answersMatch(input, task.answer);
    setVerdict(ok);
    recordAnswer(task.number, ok);
  };
  return (
    <>
      <p className="mt-2.5 text-[13px] leading-relaxed text-chalk-300">
        <LatexText text={task.statement} />
      </p>
      <div className="mt-3 flex gap-2">
        <AnswerInput label="Задача дня" value={input} onChange={(v) => { setInput(v); setVerdict(null); }} onSubmit={check} placeholder="Ответ" className="!py-2 !text-[14px]" />
        <button onClick={check} className="btn-gold shrink-0 px-4 py-2 text-[12.5px]">ОК</button>
      </div>
      {verdict !== null && (
        <p className={`pop-in mt-2 text-[12px] font-bold ${verdict ? "text-mark-green" : "text-mark-red"}`}>
          {verdict ? "Верно! +10 XP" : "Мимо. Решение ниже — разберитесь и закройте."}
        </p>
      )}
      {/* Разбор доступен только после отправки ответа — иначе это подсказка. */}
      {verdict !== null && (
        <button onClick={() => setRevealed((r) => !r)} className="mt-2 text-[11.5px] font-bold text-mark-blue transition-colors hover:text-chalk-50">
          {revealed ? "Скрыть решение" : "Показать решение"}
        </button>
      )}
      {verdict !== null && revealed && task.explain && (
        <p className="pop-in mt-1.5 rounded-lg border border-mark-yellow/25 bg-mark-yellow/5 p-2.5 text-[12px] leading-relaxed text-chalk-300">
          <LatexText text={task.explain} />
        </p>
      )}
    </>
  );
}

/* ═══════════════════════ БАНК ЗАДАНИЙ ═══════════════════════ */
import { heatColor } from "./ui";

export function BankPage() {
  const { topicStats, go, openTrainer } = useApp();
  const [part, setPart] = useState<0 | 1 | 2>(0);
  const [open, setOpen] = useState<number | null>(null);

  const topics = useMemo(() => BANK.filter((t) => (part === 0 ? true : t.part === part)), [part]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-5">
      <p className="rise tick text-mark-yellow">Кодификатор ФИПИ · 19 тем</p>
      <h1 className="rise rise-1 mt-2 font-display text-3xl font-bold tracking-tight text-chalk-50 sm:text-4xl">Банк заданий</h1>
      <p className="rise rise-2 mt-2 text-sm text-chalk-400">Цвет номера — ваш процент успешных решений. Раскройте тему и решите задачу прямо здесь.</p>

      <div className="rise rise-2 mt-5 flex flex-wrap gap-1.5">
        {([[0, "Все 20"], [1, "Часть 1 · №1–13"], [2, "Часть 2 · №14–20"]] as [0 | 1 | 2, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setPart(k)}
            className={`inline-flex min-h-[44px] items-center rounded-full px-4 py-2 text-[12.5px] font-bold transition-all active:scale-95 ${part === k ? "bg-mark-yellow text-board-950 shadow-lg shadow-mark-yellow/20" : "card text-chalk-300 hover:text-chalk-50"}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {topics.map((t, i) => {
          const s = topicStats[t.number] ?? { solved: 0, attempts: 0 };
          const h = heatColor(s.solved, s.attempts);
          const isOpen = open === t.number;
          return (
            <div key={t.number} className={`card card-hover rise rise-${Math.min((i % 5) + 1, 5)} ${isOpen ? "sm:col-span-2 lg:col-span-3" : ""}`}>
              <button onClick={() => setOpen(isOpen ? null : t.number)} className="flex w-full items-center gap-3 p-4 text-left">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border font-display text-[14px] font-bold"
                  style={{ borderColor: s.attempts ? h.fg : "var(--color-board-600)", color: s.attempts ? h.fg : "var(--color-chalk-500)", background: h.bg }}>
                  {t.number}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-bold text-chalk-50">{t.topic}</span>
                  <span className="block text-[10.5px] font-semibold uppercase tracking-wide text-chalk-500">
                    часть {t.part} · {s.attempts ? `${h.label} из ${s.attempts} попыток` : "ещё не решали"}
                  </span>
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-chalk-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="pop-in flex flex-wrap items-center gap-4 border-t border-board-700/60 p-4">
                  <p className="min-w-[220px] flex-1 text-[12.5px] leading-relaxed text-chalk-400">{t.note}</p>
                  <button onClick={() => openTrainer(t.number)} className="btn-gold px-5 py-3 text-[13px]">
                    <Play className="h-4 w-4" /> Открыть тренажёр темы
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="rise rise-4 mt-8 flex justify-center">
        <button onClick={() => go("variants")} className="btn-gold px-6 py-3 text-sm">
          <CalendarDays className="h-4 w-4" /> Собрать всё в вариант <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════ ВАРИАНТЫ ═══════════════════════ */
export function VariantsPage() {
  const { attempts, startVariant, publishedVariants, runPublishedVariant } = useApp();
  const [modeSelectorOpen, setModeSelectorOpen] = useState(false);
  const [pendingVariantId, setPendingVariantId] = useState<string | null>(null);
  
  const handleStartVariant = (id: string) => {
    setPendingVariantId(id);
    setModeSelectorOpen(true);
  };
  
  const handleModeSelect = (mode: ExamMode) => {
    if (pendingVariantId) {
      startVariant(pendingVariantId, mode);
    }
    setModeSelectorOpen(false);
    setPendingVariantId(null);
  };
  
  const bestBy = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of attempts) { const c = m.get(a.variantId); if (c === undefined || a.secondary > c) m.set(a.variantId, a.secondary); }
    return m;
  }, [attempts]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-5">
      <p className="rise tick text-mark-yellow">Реальные КИМы</p>
      <h1 className="rise rise-1 mt-2 font-display text-3xl font-bold tracking-tight text-chalk-50 sm:text-4xl">Варианты</h1>
      <p className="rise rise-2 mt-2 text-sm text-chalk-400">20 заданий (часть 1: №1–13, часть 2: №14–20), таймер 3 ч 55 мин, автопроверка части 1.</p>

      <ul className="mt-6 space-y-3">
        {VARIANTS.map((v, i) => {
          const score = bestBy.get(v.id);
          const available = v.available !== false;
          return (
            <li key={v.id} className={`card card-hover rise rise-${Math.min(i + 2, 5)} p-5 ${!available ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-mark-yellow/12 text-mark-yellow"><ClipboardList className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[14px] font-bold text-chalk-50">
                    {v.title} {v.year}
                    {v.isReal && <span className="rounded-full bg-mark-green/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-mark-green">реальные задания</span>}
                    <span className="rounded-full bg-board-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-chalk-300">{v.difficulty}</span>
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-chalk-500">{v.region}</p>
                </div>
                {!available ? (
                  <span className="rounded-lg border border-dashed border-board-600/70 px-4 py-2 text-sm font-semibold text-chalk-500">Скоро в банке</span>
                ) : score !== undefined ? (
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-display text-lg font-bold tabular-nums text-mark-yellow">{score}</div>
                      <div className="text-[10px] font-medium uppercase tracking-wide text-chalk-500">ваш балл</div>
                    </div>
                    <button onClick={() => handleStartVariant(v.id)} className="btn-ghost px-4 py-2.5 text-sm">Ещё раз</button>
                  </div>
                ) : (
                  <button onClick={() => handleStartVariant(v.id)} className="btn-gold px-5 py-2.5 text-sm">Начать <ArrowRight className="h-4 w-4" /></button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* авторские варианты преподавателя */}
      {publishedVariants.length > 0 && (
        <>
          <p className="tick mt-9 text-mark-blue">От преподавателя</p>
          <h2 className="mt-1 font-display text-xl font-bold text-chalk-50">Авторские варианты</h2>
          <ul className="mt-4 space-y-3">
            {publishedVariants.map((pv, i) => (
              <li key={pv.id} className={`card card-hover rise rise-${Math.min(i + 2, 5)} p-5`}>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-mark-blue/12 text-mark-blue"><Sparkles className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-[14px] font-bold text-chalk-50">
                      {pv.variantTitle}
                      <span className="rounded-full bg-mark-blue/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-mark-blue">авторский</span>
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-chalk-500">
                      {pv.tasks.length} задач · {pv.timeLimitMinutes} мин · {pv.authorName}
                    </p>
                  </div>
                  <button onClick={() => runPublishedVariant(pv.linkCode)} className="btn-gold px-5 py-2.5 text-sm">Решать <ArrowRight className="h-4 w-4" /></button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
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
  /* «Показать решение» раскрывается только в режиме разбора */
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  /* false = активное тестирование, true = разбор результатов */
  const [review, setReview] = useState(false);
  const [reviewResult, setReviewResult] = useState<ExamResult | null>(null);

  const part1 = REAL_VARIANT.filter((t) => t.part === 1);
  const task = REAL_VARIANT.find((t) => t.number === current)!;
  const answered = part1.filter((t) => (answers[t.number] ?? "").trim()).length;
  const tense = !review && seconds < 30 * 60;

  useEffect(() => {
    if (review) return; // в разборе таймер остановлен
    const id = setInterval(() => setSeconds((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(id);
  }, [review]);

  /* Переход в режим разбора: сохраняем попытку (без ухода со страницы),
     фиксируем итоги и блокируем ответы. */
  const finish = () => {
    if (review) return;
    const result = submitExam(answers, EXAM_SECONDS - seconds, { navigate: false });
    setReviewResult(result);
    setReview(true);
    setRevealed({});
    setCurrent(1);
    window.scrollTo({ top: 0 });
  };

  /* время вышло — автоматически переводим в разбор */
  useEffect(() => {
    if (seconds === 0) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds]);

  const setAns = (v: string) => {
    if (review) return; // в разборе ответы заблокированы
    setAnswers((a) => ({ ...a, [task.number]: v }));
  };

  /* статус текущего задания в разборе */
  const rowFor = (n: number) => reviewResult?.rows.find((r) => r.number === n);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-5">
      <div className="rise flex flex-wrap items-center gap-3">
        <button onClick={() => go("variants")} className="btn-ghost px-3 py-2 text-[12.5px] !text-chalk-400 hover:!text-mark-red">← Выйти</button>
        <div>
          <h1 className="font-display text-lg font-bold text-chalk-50">Основной период · реальные задания</h1>
          <p className="text-[11px] text-chalk-500">
            {review ? "Режим разбора — ответы заблокированы" : `Отвечено ${answered} из ${part1.length} (часть 1)`}
          </p>
        </div>
        <span className={`ml-auto flex items-center gap-2 rounded-lg border px-3 py-2 font-mono text-sm font-bold tabular-nums ${review ? "border-board-600/70 bg-board-800/60 text-chalk-400" : tense ? "border-mark-red/50 bg-mark-red/10 text-mark-red" : "border-board-600/70 bg-board-800/60 text-chalk-100"}`}>
          <Timer className="h-4 w-4" />{review ? "—" : fmt(seconds)}
        </span>
        {review ? (
          <button onClick={() => go("results")} className="btn-gold px-4 py-2 text-[13px]">К полным результатам</button>
        ) : (
          <button onClick={finish} className="btn-gold px-4 py-2 text-[13px]">Завершить</button>
        )}
      </div>

      {/* Итоговая статистика — только в режиме разбора */}
      {review && reviewResult && (
        <div className="pop-in mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Первичный балл", value: `${reviewResult.primary} / ${part1.length}`, accent: "text-mark-yellow" },
            { label: "Тестовый балл", value: String(reviewResult.secondary), accent: "text-mark-green" },
            { label: "Верно", value: String(reviewResult.correct), accent: "text-mark-green" },
            { label: "Неверно / пропуск", value: `${reviewResult.incorrect} / ${reviewResult.skipped}`, accent: "text-mark-red" },
          ].map((s) => (
            <div key={s.label} className="card p-4 text-center">
              <p className={`font-display text-2xl font-bold tabular-nums ${s.accent}`}>{s.value}</p>
              <p className="mt-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-chalk-500">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="rise rise-1 mt-5 flex flex-wrap gap-1.5">
        {REAL_VARIANT.map((t) => {
          const done = t.part === 1 && (answers[t.number] ?? "").trim();
          const active = current === t.number;
          const r = rowFor(t.number);
          const reviewCls = r
            ? r.status === "correct" ? "bg-mark-green/25 text-mark-green"
              : r.status === "incorrect" ? "bg-mark-red/25 text-mark-red"
              : "bg-board-700/60 text-chalk-500"
            : "";
          return (
            <button key={t.number} onClick={() => setCurrent(t.number)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-[12px] font-bold transition-all duration-150 active:scale-90 ${active ? "bg-mark-yellow text-board-950 ring-2 ring-mark-yellow/40" : review ? reviewCls : done ? "bg-mark-green/20 text-mark-green" : t.part === 2 ? "bg-board-700/60 text-chalk-500" : "bg-board-800 text-chalk-300 hover:bg-board-700"}`}>
              {t.number}
            </button>
          );
        })}
      </div>

      <div key={current} className="card pop-in mt-5 p-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-mark-yellow/12 text-[13px] font-bold text-mark-yellow">№{task.number}</span>
          <span className="text-[11px] font-bold uppercase tracking-wide text-chalk-500">{task.category} · часть {task.part} · {task.maxScore} б.</span>
          {revealed[task.number] && <span className="chip !text-mark-yellow">решение открыто</span>}
        </div>
        <p className="mt-4 text-[15px] leading-relaxed text-chalk-100"><LatexText text={task.statement} /></p>
        {task.imageUrls?.map((src, i) => <TaskImage key={i} src={src} alt={`Чертёж к заданию ${task.number}`} />)}

        {task.part === 1 ? (
          <div className="mt-5">
            <AnswerInput
              label={`№${task.number} · ${task.category}`}
              value={answers[task.number] ?? ""}
              onChange={setAns}
              onSubmit={() => setCurrent((c) => Math.min(REAL_VARIANT.length, c + 1))}
              placeholder={review ? "Ответ зафиксирован" : "Ответ — только цифры, «-» и «,»"}
              autoFocus={!review}
              readOnly={review}
            />

            {/* Итог по заданию — только в разборе */}
            {review && rowFor(task.number) && (
              <div className={`pop-in mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border px-4 py-2.5 ${
                rowFor(task.number)!.status === "correct" ? "border-mark-green/40 bg-mark-green/8"
                : rowFor(task.number)!.status === "incorrect" ? "border-mark-red/40 bg-mark-red/8"
                : "border-board-600/50 bg-board-800/40"
              }`}>
                {rowFor(task.number)!.status === "correct" && <span className="flex items-center gap-1.5 text-[13px] font-bold text-mark-green"><CheckCircle2 className="h-4 w-4" />Верно · +1 балл</span>}
                {rowFor(task.number)!.status === "incorrect" && <span className="flex items-center gap-1.5 text-[13px] font-bold text-mark-red"><XCircle className="h-4 w-4" />Неверно</span>}
                {rowFor(task.number)!.status === "skipped" && <span className="flex items-center gap-1.5 text-[13px] font-bold text-chalk-400"><MinusCircle className="h-4 w-4" />Пропущено</span>}
                <span className="text-[12px] text-chalk-300">
                  ваш ответ: <b className="font-mono text-chalk-50">{rowFor(task.number)!.given ?? "—"}</b>
                  <span className="mx-1.5 text-chalk-500">·</span>
                  эталон: <b className="font-mono text-mark-green">{rowFor(task.number)!.reference}</b>
                </span>
              </div>
            )}

            {!review && task.hint && <p className="mt-2.5 flex items-center gap-1.5 text-[11.5px] text-chalk-500"><Lightbulb className="h-3.5 w-3.5 shrink-0 text-mark-yellow" />{task.hint}</p>}

            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => setCurrent((c) => Math.max(1, c - 1))} disabled={current === 1} className="btn-ghost px-4 py-2.5 text-[13px] disabled:opacity-30">← Назад</button>
              {/* «Показать решение» — только после завершения (режим разбора) */}
              {review && (
                <button onClick={() => setRevealed((r) => ({ ...r, [task.number]: !r[task.number] }))} className="btn-ghost px-4 py-2.5 text-[13px]">
                  <Eye className="h-4 w-4" /> {revealed[task.number] ? "Скрыть решение" : "Показать решение"}
                </button>
              )}
              <button onClick={() => setCurrent((c) => Math.min(REAL_VARIANT.length, c + 1))} disabled={current === REAL_VARIANT.length} className="btn-gold ml-auto px-5 py-2.5 text-[13px] disabled:opacity-30">Дальше →</button>
            </div>
            {!review && <p className="mt-3 text-[10.5px] text-chalk-600">Подсвеченная клавиатура печатает в это поле и принимает только цифры, «-» и «,»</p>}
          </div>
        ) : (
          <div className="mt-5 rounded-lg border border-mark-blue/30 bg-mark-blue/5 p-4">
            <p className="text-[13px] font-bold text-mark-blue">Развёрнутый ответ</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-chalk-300">Выполните решение на бланке — его проверит преподаватель вручную по критериям. Автопроверка здесь не применяется.</p>
            {/* Критерии — только в режиме разбора */}
            {review && (
              <button onClick={() => setRevealed((r) => ({ ...r, [task.number]: !r[task.number] }))} className="btn-ghost mt-3 px-4 py-2 text-[12.5px]">
                <Eye className="h-3.5 w-3.5" /> {revealed[task.number] ? "Скрыть критерии" : "Показать критерии и решение"}
              </button>
            )}
          </div>
        )}

        {review && revealed[task.number] && task.solution && (
          <div className="pop-in mt-4 rounded-lg border border-mark-yellow/30 bg-mark-yellow/5 p-4">
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-mark-yellow"><Lightbulb className="h-3.5 w-3.5" />{task.part === 2 ? "Критерии и разбор" : "Разбор"}</p>
            {task.criteria && <p className="mb-1.5 text-[12px] text-mark-blue">{task.criteria}</p>}
            <p className="text-[13.5px] leading-relaxed text-chalk-200"><LatexText text={task.solution} /></p>
          </div>
        )}
      </div>

      <div className="rise rise-3 mt-6 flex justify-center">
        {review ? (
          <button onClick={() => go("results")} className="btn-gold px-8 py-3.5 text-[15px]">К полным результатам</button>
        ) : (
          <button onClick={finish} className="btn-gold px-8 py-3.5 text-[15px]">Завершить вариант и проверить</button>
        )}
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
        <button onClick={() => go("variants")} className="btn-gold mt-4 px-5 py-2.5 text-sm">К вариантам</button>
      </div>
    );
  }
  const r = lastResult;
  const passed = r.secondary >= 70;
  const unresolved = mistakes.filter((m) => !m.resolved).length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-5">
      <p className="rise tick text-center text-mark-yellow">Вариант проверен</p>
      <div className="rise rise-1 card mt-6 p-8 text-center">
        <p className="tick">Тестовый балл</p>
        <p key={r.secondary} className={`count-pop mt-1 font-display text-7xl font-bold tabular-nums ${passed ? "text-mark-green" : "text-mark-yellow"}`}>{r.secondary}</p>
        <div className="mx-auto mt-3 h-2 max-w-sm overflow-hidden rounded-full bg-board-700">
          <div className={`h-full rounded-full ${passed ? "bg-mark-green" : "bg-mark-yellow"} transition-all duration-1000`} style={{ width: `${r.secondary}%` }} />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[["первичный", `${r.primary} / ${REAL_VARIANT.filter((t) => t.part === 1).length}`], ["верно", String(r.correct)], ["ошибки", String(r.incorrect)], ["пропуски", String(r.skipped)]].map(([l, v]) => (
            <div key={l} className="rounded-lg border border-board-600/40 bg-board-800/50 px-3 py-3">
              <p className="font-display text-xl font-bold tabular-nums text-chalk-50">{v}</p>
              <p className="text-[10px] font-medium uppercase tracking-wide text-chalk-500">{l}</p>
            </div>
          ))}
        </div>
        <p className={`mt-5 rounded-lg border px-4 py-3 text-[13px] font-semibold ${passed ? "border-mark-green/30 bg-mark-green/5 text-mark-green" : "border-mark-yellow/30 bg-mark-yellow/5 text-mark-yellow"}`}>
          {r.secondary >= 80 ? "Отличный результат — уровень топ-вузов!" : passed ? "Порог вуза пройден. Дальше — только выше." : "Порог пока не пройден — разберите ошибки ниже."}
        </p>
      </div>

      <div className="rise rise-2 card mt-5 p-5">
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
          <button onClick={() => go("mistakes")} className="btn-ghost !border-mark-red/40 !text-mark-red px-5 py-2.5 text-sm hover:!bg-mark-red/10">
            <Eraser className="h-4 w-4" /> Разобрать {unresolved} ошибок
          </button>
        )}
        <button onClick={() => go("analytics")} className="btn-gold px-5 py-2.5 text-sm">Аналитика</button>
        <button onClick={() => go("variants")} className="btn-ghost px-5 py-2.5 text-sm">Другой вариант</button>
      </div>
    </div>
  );
}

/* ═══════════════════════ ТРЕНАЖЁР ВЕРОЯТНОСТЕЙ ═══════════════════════ */
export function ProbabilityPage() {
  const { recordAnswer, setProbBest } = useApp();
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [verdicts, setVerdicts] = useState<Record<string, boolean>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const total = Object.keys(verdicts).length;
  const correct = Object.values(verdicts).filter(Boolean).length;
  const pct = total ? Math.round((correct / total) * 100) : 0;

  const check = (id: string, answer: string) => {
    const given = inputs[id] ?? "";
    if (!given.trim()) return;
    const ok = answersMatch(given, answer);
    setVerdicts((v) => ({ ...v, [id]: ok }));
    setRevealed((r) => ({ ...r, [id]: true }));
    recordAnswer(/сложная/i.test(id) ? 5 : 4, ok);
    const newTotal = total + (verdicts[id] === undefined ? 1 : 0);
    const newCorrect = correct + (verdicts[id] === undefined && ok ? 1 : 0);
    if (newTotal >= 4) setProbBest(Math.round((newCorrect / newTotal) * 100));
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-5">
      <p className="rise tick text-mark-yellow">Тренажёр · №4 и №5</p>
      <h1 className="rise rise-1 mt-2 font-display text-3xl font-bold tracking-tight text-chalk-50 sm:text-4xl">Теория вероятностей</h1>

      <div className="rise rise-2 card mt-5 flex items-center gap-4 px-5 py-4">
        <Target className={`h-6 w-6 ${pct >= 80 ? "text-mark-green" : pct >= 50 ? "text-mark-yellow" : "text-chalk-500"}`} />
        <div className="flex-1">
          <p className="font-display text-lg font-bold tabular-nums text-chalk-50">{correct}/{total}{total > 0 && <span className="ml-2 text-sm text-chalk-400">· {pct}%</span>}</p>
          <div className="xp-track mt-1.5"><div className="xp-fill" style={{ width: `${pct}%` }} /></div>
        </div>
        <p className="hidden max-w-[180px] text-[11px] leading-snug text-chalk-500 sm:block">80%+ откроет ачивку «Снайпер вероятностей»</p>
      </div>

      <ul className="mt-5 space-y-4">
        {PROB_PROBLEMS.map((p, i) => {
          const v = verdicts[p.id];
          return (
            <li key={p.id} className={`card rise rise-${Math.min((i % 5) + 1, 5)} p-5 ${v === true ? "!border-mark-green/40" : v === false ? "!border-mark-red/40" : ""}`}>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-board-700 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-mark-blue">№{i < 5 ? 4 : 5}</span>
                <span className="text-[11px] font-bold uppercase tracking-wide text-chalk-500">{p.topic}</span>
                {v !== undefined && (
                  <span className={`pop-in ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-bold ${v ? "bg-mark-green/15 text-mark-green" : "bg-mark-red/15 text-mark-red"}`}>{v ? "Верно" : "Неверно"}</span>
                )}
              </div>
              <p className="mt-3 text-[13.5px] leading-relaxed text-chalk-200"><LatexText text={p.text} /></p>
              <div className="mt-4">
                <AnswerInput
                  label={`№${i < 5 ? 4 : 5} · ${p.topic}`}
                  value={inputs[p.id] ?? ""}
                  onChange={(val) => setInputs((x) => ({ ...x, [p.id]: val }))}
                  onSubmit={() => check(p.id, p.answer)}
                  placeholder="Например 0,375"
                  className="!py-2.5 !text-[15px]"
                />
                <div className="mt-2 flex gap-2">
                  <button onClick={() => check(p.id, p.answer)} className="btn-gold px-4 py-2 text-[12.5px]">Проверить</button>
                  {/* Разбор — только после проверки ответа (иначе это подсказка). */}
                  {v !== undefined && (
                    <button onClick={() => setRevealed((r) => ({ ...r, [p.id]: !r[p.id] }))} className="btn-ghost px-3.5 py-2 text-[12px]">
                      <Eye className="h-3.5 w-3.5" /> {revealed[p.id] ? "Скрыть" : "Показать решение"}
                    </button>
                  )}
                </div>
              </div>
              {v !== undefined && revealed[p.id] && (
                <p className="pop-in mt-3 rounded-lg border border-mark-yellow/25 bg-mark-yellow/5 p-3 text-[12.5px] leading-relaxed text-chalk-200">
                  <b className="text-mark-yellow">Ответ: {p.answer.replace(".", ",")}.</b> <LatexText text={p.explain} />
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
    
    {/* Модальный выбор режима для главной страницы */}
    <ExamModeSelector
      isOpen={modeSelectorOpen}
      onClose={() => { setModeSelectorOpen(false); setPendingVariantId(null); }}
      onSelect={handleModeSelect}
    />
  );
}
