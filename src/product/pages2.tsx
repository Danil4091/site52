import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowUpFromLine, Check, CheckCircle2, Copy, Crown, Download, FileJson, Flame,
  KeyRound, Link2, Medal, MinusCircle, Plus, Sparkles, Tag, Target, Trash2, TrendingDown, TrendingUp, Upload, Users, X, XCircle,
} from "lucide-react";
import { useApp, type CustomTask } from "./store";

/* recharts вынесен в отдельный ленивый чанк (AnalyticsChart.tsx) —
   грузится параллельно и только при открытии «Аналитики». */
const AnalyticsChart = lazy(() => import("./AnalyticsChart"));
import { ACHIEVEMENTS, BANK, ERROR_TAGS, LEADER_SEED, REAL_VARIANT, type AchieveSnapshot, type AttemptRecord } from "./data";
import { Avatar, Heatmap, LatexText, TitleBadge, levelFromXp } from "./ui";
import VariantUploader from "./VariantUploader";
import { variantLink } from "./variantSchema";
import { ADMIN_NICKNAME, RU_AVG_SCORE_2026 } from "./config";
import TeacherDashboard, { AssignmentsPanel, TeacherReportPanel } from "./TeacherDashboard";
import MaterialsAdmin from "./MaterialsAdmin";

/* Статистика всего сайта — отдельный ленивый чанк (recharts внутри). */
const SiteStatsPanel = lazy(() => import("./SiteStatsPanel"));

/* ═══════════════════════ ЕЖЕНЕДЕЛЬНЫЙ ОТЧЁТ ═══════════════════════ */
function WeeklyReport() {
  const { attempts, mistakes } = useApp();
  const resolvedMistakesTotal = mistakes.filter((m) => m.resolved).length;
  const weekAgo = Date.now() - 7 * 86_400_000;
  const week = attempts.filter((a) => a.ts !== undefined && a.ts >= weekAgo);

  const weekVariants = week.length;
  const first = week[0]?.secondary ?? 0;
  const last = week[week.length - 1]?.secondary ?? 0;
  const delta = week.length >= 2 ? last - first : 0;
  const best = week.length ? Math.max(...week.map((a) => a.secondary)) : 0;
  const avgMistakes = week.length ? Math.round((week.reduce((s, a) => s + a.mistakes, 0) / week.length) * 10) / 10 : 0;
  const unresolvedNow = mistakes.filter((m) => !m.resolved).length;

  const weekStart = new Date(weekAgo).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  const weekEnd = new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "short" });

  if (weekVariants === 0) return null;

  const verdict =
    delta >= 5 ? { icon: TrendingUp, tone: "text-mark-green", text: `Отличная неделя! Балл вырос на ${delta} пунктов.` }
    : delta > 0 ? { icon: TrendingUp, tone: "text-mark-green", text: `Небольшой рост: +${delta} пункт(а). Держите темп.` }
    : delta === 0 ? { icon: Target, tone: "text-mark-yellow", text: "Балл стабилен. Попробуйте разобрать ошибки — это даст прирост." }
    : { icon: TrendingDown, tone: "text-mark-red", text: `Спад на ${Math.abs(delta)} пункт(а). Сфокусируйтесь на «зонах роста» ниже.` };
  const V = verdict.icon;

  return (
    <div className="rise rise-2 card mt-4 overflow-hidden">
      <div className="flex items-center justify-between border-b border-board-700/50 px-5 py-4">
        <div>
          <h2 className="flex items-center gap-2 font-display text-sm font-bold text-chalk-50">
            <Sparkles className="h-4 w-4 text-mark-yellow" />
            Отчёт за неделю
          </h2>
          <p className="mt-0.5 text-[11px] text-chalk-500">{weekStart} — {weekEnd}</p>
        </div>
        <span className="chip"><Flame className="h-3.5 w-3.5 text-mark-red" />{weekVariants} вар.</span>
      </div>
      <div className="grid grid-cols-2 gap-px bg-board-700/40 sm:grid-cols-4">
        {[
          { label: "Решено вариантов", value: String(weekVariants), tone: "text-chalk-50" },
          { label: "Прирост балла", value: delta > 0 ? `+${delta}` : String(delta), tone: delta >= 0 ? "text-mark-green" : "text-mark-red" },
          { label: "Лучший балл", value: String(best), tone: "text-mark-yellow" },
          { label: "Ошибок 0.1 / вар.", value: String(avgMistakes), tone: avgMistakes > 2 ? "text-mark-red" : "text-chalk-50" },
        ].map((k) => (
          <div key={k.label} className="bg-board-850/80 px-4 py-4 text-center">
            <p className={`font-display text-2xl font-bold tabular-nums ${k.tone}`}>{k.value}</p>
            <p className="mt-1 text-[10.5px] font-semibold uppercase tracking-wide text-chalk-500">{k.label}</p>
          </div>
        ))}
      </div>
      <div className="flex items-start gap-2.5 px-5 py-4">
        <V className={`mt-0.5 h-4.5 w-4.5 shrink-0 ${verdict.tone}`} />
        <div>
          <p className={`text-[13px] font-bold ${verdict.tone}`}>{verdict.text}</p>
          <p className="mt-0.5 text-[11.5px] text-chalk-400">
            Разобрано ошибок за всё время: <b className="text-chalk-200">{resolvedMistakesTotal}</b> · сейчас в журнале: <b className="text-chalk-200">{unresolvedNow}</b>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ РАЗБОР ПОПЫТКИ ПО ЗАДАНИЯМ ═══════════════════════ */
/* Детализация: какие задания решены верно, где ошибка (неверный ответ),
   а какие пропущены (ученик не знает, как решать). */
function AttemptBreakdown({ attempt }: { attempt: AttemptRecord }) {
  const topicByNumber = useMemo(
    () => new Map(REAL_VARIANT.map((t) => [t.number, t.category])),
    []
  );
  const res = attempt.taskResults ?? {};
  const numbers = Array.from({ length: 12 }, (_, i) => i + 1);
  const wrong = numbers.filter((n) => res[n] === "incorrect");
  const skipped = numbers.filter((n) => res[n] === "skipped");
  const correct = numbers.filter((n) => res[n] === "correct");

  const cellCls = (n: number) => {
    const s = res[n];
    if (s === "correct") return "border-mark-green/50 bg-mark-green/12 text-mark-green";
    if (s === "incorrect") return "border-mark-red/50 bg-mark-red/12 text-mark-red";
    return "border-dashed border-chalk-500/50 bg-transparent text-chalk-500";
  };

  const Row = ({ nums, icon: Icon, tone, label, empty }: {
    nums: number[]; icon: typeof XCircle; tone: string; label: string; empty: string;
  }) => (
    <div className="rounded-lg border border-board-700/60 bg-board-950/40 p-3.5">
      <p className={`flex items-center gap-2 text-[12px] font-bold ${tone}`}>
        <Icon className="h-4 w-4" />
        {label}
        <span className="ml-auto rounded-md bg-board-800/80 px-2 py-0.5 font-mono text-[11px] tabular-nums">{nums.length}</span>
      </p>
      {nums.length === 0 ? (
        <p className="mt-2 text-[11.5px] text-chalk-500">{empty}</p>
      ) : (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {nums.map((n) => (
            <span key={n} className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold ${
              res[n] === "incorrect" ? "border-mark-red/40 bg-mark-red/8 text-mark-red" : "border-chalk-500/40 bg-board-800/60 text-chalk-300"
            }`}>
              <b className="font-mono">№{n}</b>
              <span className="text-chalk-500">{topicByNumber.get(n) ?? ""}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div>
      {/* сетка исходов по номерам */}
      <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
        {numbers.map((n) => (
          <div key={n} title={`№${n} · ${topicByNumber.get(n) ?? ""}`}
            className={`flex h-11 flex-col items-center justify-center rounded-md border transition-transform duration-150 hover:-translate-y-0.5 ${cellCls(n)}`}>
            <span className="font-mono text-[12px] font-bold leading-none">{n}</span>
            <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-wide opacity-70">
              {res[n] === "correct" ? "✓" : res[n] === "incorrect" ? "✗" : "—"}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10.5px] font-semibold text-chalk-500">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm border border-mark-green/50 bg-mark-green/12" />верно · {correct.length}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm border border-mark-red/50 bg-mark-red/12" />ошибка · {wrong.length}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm border border-dashed border-chalk-500/50" />пропуск · {skipped.length}</span>
      </div>

      {/* списки: ошибки vs пропуски */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Row nums={wrong} icon={XCircle} tone="text-mark-red" label="Ошибки — неверный ответ" empty="Ни одной ошибки — все введённые ответы верны." />
        <Row nums={skipped} icon={MinusCircle} tone="text-chalk-400" label="Пропуски — не решено" empty="Пропусков нет — попытка была на все задания." />
      </div>

      {skipped.length > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-mark-yellow/30 bg-mark-yellow/6 p-3 text-[11.5px] leading-relaxed text-chalk-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mark-yellow" />
          Пропуск — сигнал «не знаю, как решать». Откройте тренажёр по этим темам из Банка заданий: там есть разбор каждой задачи.
        </p>
      )}
    </div>
  );
}

/* ═══════════════════════ АНАЛИТИКА ═══════════════════════ */
export function AnalyticsPage() {
  const { attempts, topicStats, user, patchUser } = useApp();
  const has = attempts.length > 0;
  const data = attempts.map((a, i) => ({ variant: `П${i + 1}`, secondary: a.secondary, mistakes: a.mistakes }));
  const latest = data[data.length - 1];
  const avg = has ? Math.round(attempts.reduce((s, a) => s + a.secondary, 0) / attempts.length) : 0;
  const mistakes3 = attempts.slice(-3).reduce((s, a) => s + a.mistakes, 0);
  const goal = user?.goal ?? 80;
  const toGoal = latest ? goal - latest.secondary : null;
  /* выбранная попытка для детализации (по умолчанию — последняя) */
  const [selectedIdx, setSelectedIdx] = useState(attempts.length - 1);
  const selAttempt = attempts[Math.min(Math.max(selectedIdx, 0), attempts.length - 1)];
  /* при новой попытке — переключаемся на неё */
  useEffect(() => { setSelectedIdx(attempts.length - 1); }, [attempts.length]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-5">
      <p className="rise tick text-mark-yellow">Личный кабинет</p>
      <h1 className="rise rise-1 mt-2 font-display text-3xl font-bold tracking-tight text-chalk-50 sm:text-4xl">
        Аналитика <span className="text-chalk-500">/</span> {user?.name ?? "Гость"}
      </h1>

      {!has ? (
        <div className="rise rise-2 card mt-8 flex flex-col items-center px-6 py-16 text-center">
          <Target className="h-10 w-10 text-chalk-500" />
          <p className="mt-4 font-display text-lg font-bold text-chalk-200">Здесь появится ваша статистика</p>
          <p className="mt-1 max-w-sm text-[13px] text-chalk-500">Решите первый вариант — график баллов, тепловая карта и «зоны роста» построятся автоматически.</p>
        </div>
      ) : (
        <>
          <div className="rise rise-2 mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              { label: "Текущий балл", value: latest.secondary, suffix: "/ 100", tone: "text-mark-green" },
              { label: "Цель", value: goal, suffix: "/ 100", tone: "text-mark-yellow" },
              { label: "До цели", value: toGoal !== null ? (toGoal > 0 ? `+${toGoal}` : "✓") : "—", suffix: toGoal !== null && toGoal > 0 ? "баллов" : toGoal !== null ? "достигнуто" : "", tone: toGoal !== null && toGoal <= 0 ? "text-mark-green" : "text-mark-yellow" },
              { label: "Средний балл", value: avg, suffix: "/ 100", tone: "text-chalk-50" },
              { label: "Ошибки 0.1 (за 3)", value: mistakes3, suffix: "", tone: mistakes3 > 3 ? "text-mark-red" : "text-mark-yellow" },
            ].map((k) => (
              <div key={k.label} className="card card-hover p-4">
                <p className="tick">{k.label}</p>
                <p className={`mt-1.5 font-display text-3xl font-bold tabular-nums ${k.tone}`}>{k.value}<span className="ml-1 text-xs font-semibold text-chalk-500">{k.suffix}</span></p>
              </div>
            ))}
          </div>

          <WeeklyReport />

          <div className="rise rise-3 card mt-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-sm font-bold text-chalk-50">Динамика баллов и «ошибок 0.1»</h2>
              {/* выбор попытки для детализации */}
              {attempts.length > 1 && (
                <div className="flex items-center gap-1">
                  <span className="tick mr-1">Попытка</span>
                  {attempts.map((a, i) => (
                    <button key={a.id} onClick={() => setSelectedIdx(i)}
                      className={`rounded-md px-2 py-1 font-mono text-[11px] font-bold transition-all active:scale-90 ${
                        i === Math.min(Math.max(selectedIdx, 0), attempts.length - 1)
                          ? "bg-mark-yellow text-board-950"
                          : "bg-board-800/60 text-chalk-400 hover:bg-board-700 hover:text-chalk-200"
                      }`}
                      title={a.label}
                    >П{i + 1}</button>
                  ))}
                </div>
              )}
              {/* редактор цели */}
              <div className="flex items-center gap-2">
                <span className="tick">Ваша цель</span>
                <button
                  onClick={() => patchUser({ goal: Math.max(40, goal - 2) })}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-board-600/70 bg-board-800/60 text-sm font-bold text-chalk-300 transition-all hover:border-mark-yellow/50 hover:text-mark-yellow active:scale-90"
                  aria-label="Уменьшить цель"
                >−</button>
                <span key={goal} className="count-pop w-9 text-center font-display text-lg font-bold tabular-nums text-mark-yellow">{goal}</span>
                <button
                  onClick={() => patchUser({ goal: Math.min(100, goal + 2) })}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-board-600/70 bg-board-800/60 text-sm font-bold text-chalk-300 transition-all hover:border-mark-yellow/50 hover:text-mark-yellow active:scale-90"
                  aria-label="Увеличить цель"
                >+</button>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10.5px] font-semibold text-chalk-500">
              <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-5 border-t-2 border-dashed border-mark-yellow" />ваша цель</span>
              <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-5 border-t-2 border-dotted border-mark-blue" />средний по РФ · {RU_AVG_SCORE_2026}</span>
              <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-5 border-t-2 border-dashed border-mark-green/70" />порог · 70</span>
            </div>
            <Suspense
              fallback={
                <div className="mt-3 flex h-64 items-center justify-center rounded-lg border border-dashed border-board-700 text-[11px] font-semibold uppercase tracking-widest text-chalk-500">
                  Строим график…
                </div>
              }
            >
              <AnalyticsChart data={data} goal={goal} />
            </Suspense>
          </div>

          {/* детализация выбранной попытки: ошибки vs пропуски */}
          {selAttempt && (
            <div className="rise rise-4 card mt-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-sm font-bold text-chalk-50">
                  Разбор попытки <span className="text-mark-yellow">П{Math.min(Math.max(selectedIdx, 0), attempts.length - 1) + 1}</span>
                  <span className="ml-2 text-[11px] font-semibold text-chalk-500">{selAttempt.label} · {selAttempt.secondary} баллов</span>
                </h2>
              </div>
              <div className="mt-3">
                <AttemptBreakdown attempt={selAttempt} />
              </div>
            </div>
          )}

          <div className="rise rise-5 card mt-4 p-5">
            <h2 className="mb-3 font-display text-sm font-bold text-chalk-50">Тепловая карта номеров ЕГЭ · % успешных решений</h2>
            <Heatmap stats={topicStats} />
          </div>

          <div className="rise rise-5 card mt-4 p-5">
            <h2 className="flex items-center gap-2 font-display text-sm font-bold text-chalk-50"><Sparkles className="h-4 w-4 text-mark-pink" />Зоны роста</h2>
            <ul className="mt-3 space-y-2.5">
              {BANK.filter((t) => {
                const s = topicStats[t.number];
                return s && s.attempts > 0 && s.solved / s.attempts < 0.5;
              }).slice(0, 4).map((t) => (
                <li key={t.number} className="flex items-start gap-2.5 rounded-lg border border-mark-red/25 bg-mark-red/5 p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-mark-red" />
                  <p className="text-[12.5px] leading-relaxed text-chalk-300">
                    <b className="text-chalk-50">№{t.number} «{t.topic}»</b> — решается хуже 50%. {t.note}
                  </p>
                </li>
              ))}
              {BANK.every((t) => { const s = topicStats[t.number]; return !s || s.attempts === 0 || s.solved / s.attempts >= 0.5; }) && (
                <p className="text-[12.5px] text-chalk-500">Открытых просадок нет — отличная работа.</p>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════ РЕЙТИНГ + АЧИВКИ ═══════════════════════ */
export function RatingPage() {
  const {
    attempts, mistakes, unlocked, probBest, nightOwl, streak, topicStats, user,
    marathonCount, marathonBest, referrals, tagsAssigned, freezesBought,
  } = useApp();
  const best = attempts.length ? Math.max(...attempts.map((a) => a.secondary)) : 0;
  const solvedTasks = Object.values(topicStats).reduce((s, t) => s + t.solved, 0);
  const weekAgo = Date.now() - 7 * 86_400_000;
  const snapshot: AchieveSnapshot = {
    attempts: attempts.length, best, streak: streak.days,
    resolvedMistakes: mistakes.filter((m) => m.resolved).length, probBest, nightOwl,
    solvedTasks,
    probSolved: (topicStats[4]?.solved ?? 0) + (topicStats[5]?.solved ?? 0),
    perfectVariants: attempts.filter((a) => a.mistakes === 0 && a.secondary > 0).length,
    distinctTopics: Object.values(topicStats).filter((t) => t.solved > 0).length,
    marathonCount, marathonBest, referrals: referrals.length, tagsAssigned,
    weeklyVariants: attempts.filter((a) => a.ts !== undefined && a.ts >= weekAgo).length,
    goalReached: user?.goal !== undefined ? best >= user.goal : false,
    freezesBought,
  };

  const top = [...LEADER_SEED].sort((a, b) => b.score - a.score);
  const podium = [top[1], top[0], top[2]];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-5">
      <p className="rise tick text-mark-yellow">Лига «Республика»</p>
      <h1 className="rise rise-1 mt-2 font-display text-3xl font-bold tracking-tight text-chalk-50 sm:text-4xl">Рейтинг недели</h1>

      <div className="rise rise-2 mt-6 flex items-end justify-center gap-3">
        {podium.map((p, i) => {
          const heights = ["h-28", "h-36", "h-24"];
          const medals = [<Medal key="s" className="h-5 w-5 text-chalk-400" />, <Crown key="g" className="h-6 w-6 text-mark-yellow" />, <Medal key="b" className="h-5 w-5 text-mark-red" />];
          return (
            <div key={p.nick} className="flex w-20 flex-col items-center min-[400px]:w-24 sm:w-28">
              {medals[i]}
              <div className="mt-2"><Avatar name={p.nick} className="h-12 w-12 text-[13px]" /></div>
              <p className="mt-1.5 max-w-full truncate font-mono text-[12px] font-bold text-chalk-50">@{p.nick}</p>
              <TitleBadge xp={p.xp} compact />
              <p className="mt-0.5 font-display text-lg font-bold tabular-nums text-mark-yellow">{p.score}</p>
              <div className={`mt-1 w-full rounded-t-lg border border-b-0 border-board-600/50 bg-board-800/70 ${heights[i]}`} />
            </div>
          );
        })}
      </div>

      <div className="rise rise-3 card mt-6 overflow-hidden">
        <ul className="divide-y divide-board-700/60">
          {top.map((p, i) => (
            <li key={p.nick} className="card-hover flex items-center gap-3 px-4 py-3">
              <span className="w-7 text-center font-display text-[13px] font-bold tabular-nums text-chalk-500">{i + 1}</span>
              <Avatar name={p.nick} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate font-mono text-[13px] font-bold text-chalk-50">
                  @{p.nick}
                  <TitleBadge xp={p.xp} compact />
                </p>
                <p className="text-[10.5px] text-chalk-500">{p.city} · {p.streak} дн. серия · LVL {levelFromXp(p.xp)}</p>
              </div>
              <span className={`flex items-center gap-0.5 text-[11px] font-bold tabular-nums ${p.delta > 0 ? "text-mark-green" : p.delta < 0 ? "text-mark-red" : "text-chalk-600"}`}>
                {p.delta > 0 ? <TrendingUp className="h-3 w-3" /> : p.delta < 0 ? <TrendingDown className="h-3 w-3" /> : "—"}{p.delta !== 0 && Math.abs(p.delta)}
              </span>
              <span className="font-display text-[16px] font-bold tabular-nums text-chalk-50">{p.score}</span>
            </li>
          ))}
        </ul>
        {user && (
          <div className="flex items-center gap-3 border-t-2 border-mark-yellow/40 bg-mark-yellow/5 px-4 py-3">
            <span className="w-7 text-center font-display text-[13px] font-bold tabular-nums text-mark-yellow">вы</span>
            <Avatar name={user.nickname} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate font-mono text-[13px] font-bold text-chalk-50">
                @{user.nickname}
                <TitleBadge xp={streak.xp} compact />
              </p>
              <p className="text-[10.5px] text-chalk-500">{streak.days} дн. серия · LVL {levelFromXp(streak.xp)} · {streak.xp} XP</p>
            </div>
            <span className="font-display text-[16px] font-bold tabular-nums text-mark-yellow">{best}</span>
          </div>
        )}
      </div>

      <p className="tick mt-10 text-mark-pink">Достижения</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
        <h2 className="font-display text-xl font-bold text-chalk-50">Ваши ачивки</h2>
        <p className="font-mono text-[11.5px] font-semibold tabular-nums text-chalk-400">
          открыто <b className="text-mark-yellow">{Object.keys(unlocked).length}</b> из {ACHIEVEMENTS.length}
          {" · "}
          <b className="text-mark-green">+{ACHIEVEMENTS.filter((a) => unlocked[a.id]).reduce((s, a) => s + a.xp, 0)} XP</b>
        </p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ACHIEVEMENTS.map((a) => {
          const got = unlocked[a.id];
          const prog = a.progress(snapshot);
          const pctDone = Math.min(100, Math.round((prog.cur / prog.goal) * 100));
          const Icon = a.icon;
          return (
            <div key={a.id} className={`card card-hover relative p-4 ${got ? "!border-mark-yellow/50" : "opacity-90"}`}>
              <span className={`absolute right-3 top-3 rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${got ? "bg-mark-green/15 text-mark-green" : "bg-board-700/80 text-chalk-500"}`}>
                {got ? "Открыто" : "Закрыто"}
              </span>
              <div className="flex items-center gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${got ? "bg-mark-yellow/15 text-mark-yellow" : "bg-board-700/70 text-chalk-500"}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1 pr-14">
                  <p className={`truncate text-[13px] font-bold ${got ? "text-mark-yellow" : "text-chalk-200"}`}>{a.title}</p>
                  <p className="text-[10.5px] text-chalk-500">{a.desc}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold ${got ? "bg-mark-yellow/15 text-mark-yellow" : "bg-board-700/60 text-chalk-400"}`}>+{a.xp} XP</span>
                {!got && (
                  <div className="flex-1">
                    <div className="xp-track !h-[5px]"><div className="xp-fill" style={{ width: `${pctDone}%` }} /></div>
                  </div>
                )}
                {!got && <span className="font-mono text-[9.5px] font-semibold tabular-nums text-chalk-500">{prog.cur}/{prog.goal}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════ ЖУРНАЛ ОШИБОК ═══════════════════════ */
export function MistakesPage() {
  const { mistakes, toggleResolved, go, assignTag, tagStats } = useApp();
  const unresolved = mistakes.filter((g) => !g.resolved).length;
  const taggedStats = Object.entries(tagStats).sort((a, b) => b[1] - a[1]);
  const topTag = taggedStats[0];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-5">
      <p className="rise tick text-mark-red">Работа над ошибками</p>
      <h1 className="rise rise-1 mt-2 font-display text-3xl font-bold tracking-tight text-chalk-50 sm:text-4xl">Журнал ошибок</h1>
      <p className="rise rise-2 mt-2 text-sm text-chalk-400">
        {mistakes.length === 0 ? "Чисто — ошибок пока нет." : `Неразобранных: ${unresolved}. Разбор ошибок даёт +6 баллов за месяц.`}
      </p>

      {/* статистика по тегам причин */}
      {taggedStats.length > 0 && (
        <div className="rise rise-2 card mt-5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Tag className="h-4 w-4 text-mark-pink" />
            <h2 className="font-display text-sm font-bold text-chalk-50">Почему теряются баллы</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {taggedStats.map(([tag, count]) => (
              <span key={tag} className="chip" title={`${count} ${count === 1 ? "ошибка" : "ошибок"}`}>
                <span className="text-mark-pink">{tag}</span> <b className="tabular-nums text-chalk-50">×{count}</b>
              </span>
            ))}
          </div>
          {topTag && (
            <p className="mt-2.5 text-[11.5px] leading-relaxed text-chalk-400">
              Главная причина промахов — <b className="text-mark-pink">{topTag[0]}</b>. Сосредоточьтесь на ней: разбор именно этой категории даст максимальный прирост балла.
            </p>
          )}
        </div>
      )}

      {mistakes.length === 0 ? (
        <div className="rise rise-3 card mt-8 flex flex-col items-center px-6 py-16 text-center">
          <Check className="h-10 w-10 text-mark-green" />
          <p className="mt-4 font-display text-lg font-bold text-chalk-200">Ошибок нет</p>
          <button onClick={() => go("variants")} className="btn-gold mt-5 px-6 py-3 text-sm">Решить вариант</button>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {mistakes.map((g, i) => (
            <li key={g.number} className={`card rise rise-${Math.min(i + 2, 5)} p-4 ${g.resolved ? "opacity-70" : ""}`}>
              <div className="flex items-start gap-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-display text-[13px] font-bold ${g.resolved ? "bg-mark-green/15 text-mark-green" : "bg-mark-red/15 text-mark-red"}`}>№{g.number}</span>
                <div className="min-w-0 flex-1">
                  <p className={`text-[13.5px] font-bold ${g.resolved ? "text-chalk-400 line-through" : "text-chalk-50"}`}>{g.topic}</p>
                  <ul className="mt-1.5 space-y-1">
                    {g.occurrences.slice(0, 3).map((o, j) => (
                      <li key={j} className="text-[11.5px] text-chalk-400">
                        {o.variant} · {o.date} · ваш: <span className="font-mono text-mark-red">{o.given ?? "—"}</span> → эталон: <span className="font-mono text-mark-green">{o.reference}</span>
                      </li>
                    ))}
                  </ul>
                  {/* теги причины промаха */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10.5px] font-semibold uppercase tracking-wide text-chalk-500">Причина:</span>
                    {ERROR_TAGS.map((t) => (
                      <button key={t} onClick={() => assignTag(g.number, t)}
                        className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold transition-all active:scale-95 ${g.tag === t ? "border-mark-pink bg-mark-pink/20 text-mark-pink" : "border-board-600/60 text-chalk-400 hover:border-mark-pink/50 hover:text-mark-pink"}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={() => toggleResolved(g.number)}
                  className={`shrink-0 rounded-lg px-3 py-2 text-[11.5px] font-bold transition-all active:scale-95 ${g.resolved ? "card text-chalk-400 hover:text-chalk-100" : "bg-mark-green/20 text-mark-green hover:bg-mark-green/30"}`}>
                  {g.resolved ? "Вернуть" : "Разобрано"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {mistakes.length > 0 && (
        <div className="rise rise-4 mt-6 flex justify-center">
          <button onClick={() => go("variants")} className="btn-gold px-6 py-3 text-sm">Решить вариант заново</button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ КАБИНЕТ (скрытая админ-панель) ═══════════════════════
   Доступ: роль «teacher» ИЛИ секретный ключ ?panel=komi2026 (однократно в сессии). */

const EMPTY_FORM = {
  exam_type: "ege" as "ege" | "oge",
  task_number: 1,
  topic: "",
  condition_text: "",
  solution_text: "",
  correct_answer: "",
  is_second_part: false,
  difficulty_level: 1,
  criteria: "",
  image_url: "",
  source: "",
};

function validateImport(raw: string): { ok: CustomTask[]; errors: { row: number; msg: string }[] } {
  const errors: { row: number; msg: string }[] = [];
  let arr: unknown[];
  try {
    const parsed = JSON.parse(raw);
    arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.tasks) ? parsed.tasks : null as unknown as unknown[];
    if (!arr) throw new Error("нужен массив или {tasks: [...]}");
  } catch (e) {
    return { ok: [], errors: [{ row: 0, msg: `JSON не читается: ${e instanceof Error ? e.message : "ошибка"}` }] };
  }
  const ok: CustomTask[] = [];
  arr.forEach((item, i) => {
    const row = i + 1;
    const t = item as Record<string, unknown>;
    const fail = (msg: string) => { errors.push({ row, msg }); };
    if (typeof t !== "object" || t === null) return fail("не объект");
    if (!["ege", "oge"].includes(String(t.exam_type))) return fail("exam_type должен быть \"ege\" или \"oge\"");
    const num = Number(t.task_number);
    if (!Number.isInteger(num) || num < 1 || num > 25) return fail("task_number — целое 1–25");
    if (typeof t.condition_text !== "string" || !t.condition_text.trim()) return fail("condition_text обязателен");
    const isSecond = Boolean(t.is_second_part);
    const ans = t.correct_answer === null || t.correct_answer === undefined ? null : String(t.correct_answer);
    if (!isSecond && !ans) return fail("для части 1 обязателен correct_answer");
    const diff = Number(t.difficulty_level ?? 1);
    /* чертёж: валидируем формат ссылки */
    const imgRaw = t.image_url ?? t.image_path;
    const img = imgRaw === null || imgRaw === undefined ? undefined : String(imgRaw).trim();
    if (img && !(img.startsWith("http://") || img.startsWith("https://") || img.startsWith("image/")))
      return fail("image_url должен быть https://… или image/… (data-URL)");
    ok.push({
      id: `imp-${Date.now()}-${row}-${Math.random().toString(36).slice(2, 6)}`,
      exam_type: t.exam_type as "ege" | "oge",
      task_number: num,
      topic: String(t.topic ?? "Без темы"),
      condition_text: String(t.condition_text),
      solution_text: t.solution_text ? String(t.solution_text) : undefined,
      correct_answer: ans,
      is_second_part: isSecond,
      difficulty_level: Number.isInteger(diff) && diff >= 1 && diff <= 3 ? diff : 1,
      criteria: t.criteria ? String(t.criteria) : undefined,
      image_url: img || undefined,
      source: t.source ? String(t.source) : undefined,
      createdAt: new Date().toISOString(),
    });
  });
  return { ok, errors };
}

export function AdminPage() {
  const { user, taskBank, addTask, removeTask, importTasks, pushToast, publishedVariants, unpublishVariant, runPublishedVariant } = useApp();
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem("komi-admin") === "1");
  const [tab, setTab] = useState<"bank" | "import" | "variants" | "students" | "hw" | "report" | "site" | "materials">("students");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [importText, setImportText] = useState("");
  const [report, setReport] = useState<{ added: number; skipped: number; errors: { row: number; msg: string }[] } | null>(null);

  /* секретный ключ в URL открывает доступ без роли */
  useEffect(() => {
    if (new URLSearchParams(location.search).get("panel") === "komi2026") {
      sessionStorage.setItem("komi-admin", "1");
      setUnlocked(true);
    }
  }, []);

  const allowed = user?.role === "teacher" || unlocked;
  /* Создатель платформы: мастер-аккаунт (ник из .env) или секретный режим без входа. */
  const isOwner = user?.nickname === ADMIN_NICKNAME || (!user && unlocked);
  if (!allowed) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <KeyRound className="mx-auto h-10 w-10 text-chalk-500" />
        <p className="mt-4 font-display text-lg font-bold text-chalk-200">Кабинет скрыт</p>
        <p className="mt-1 text-[13px] text-chalk-500">Доступ у преподавателей. Либо откройте с секретным ключом: <code className="rounded bg-board-800 px-1.5 py-0.5 font-mono text-mark-yellow">?panel=komi2026</code></p>
      </div>
    );
  }

  const submitForm = () => {
    if (!form.condition_text.trim()) return pushToast("Заполните условие задачи");
    if (!form.is_second_part && !form.correct_answer.trim()) return pushToast("Для части 1 укажите правильный ответ");
    const img = form.image_url.trim();
    if (img && !(img.startsWith("http://") || img.startsWith("https://") || img.startsWith("image/")))
      return pushToast("image_url должен быть https://… или image/… (data-URL)");
    addTask({
      exam_type: form.exam_type,
      task_number: form.task_number,
      topic: form.topic.trim() || BANK.find((b) => b.number === form.task_number)?.topic || "Без темы",
      condition_text: form.condition_text.trim(),
      solution_text: form.solution_text.trim() || undefined,
      correct_answer: form.is_second_part ? null : form.correct_answer.trim(),
      is_second_part: form.is_second_part,
      difficulty_level: form.difficulty_level,
      criteria: form.criteria.trim() || undefined,
      image_url: img || undefined,
      source: form.source.trim() || undefined,
    });
    setForm(EMPTY_FORM);
    setShowForm(false);
    pushToast("Задача добавлена в банк");
  };

  const runImport = () => {
    if (!importText.trim()) return;
    const { ok, errors } = validateImport(importText);
    const res = importTasks(ok);
    setReport({ added: res.added, skipped: res.skipped, errors });
    pushToast(`Импорт: добавлено ${res.added}, пропущено дублей ${res.skipped}`);
  };

  const exportBank = () => {
    const blob = new Blob([JSON.stringify({ tasks: taskBank }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "taskbank.json";
    a.click();
  };

  /* Реальные ученики, привязанные к этому преподавателю по коду (задача 5).
     Читаются из локального хранилища аккаунтов; в продакшене — из БД по teacher_id. */
  const myCode = (user?.teacherCode ?? "").toUpperCase();
  const linkedStudents = useMemo(() => {
    try {
      const raw = localStorage.getItem("komi-users-v1");
      const users = raw ? (JSON.parse(raw) as { nickname: string; role: string; teacherCode?: string }[]) : [];
      return users.filter((u) => u.role === "student" && (u.teacherCode ?? "").toUpperCase() === myCode && myCode !== "");
    } catch { return []; }
  }, [myCode, tab]);

  const field = "w-full rounded-lg border border-board-600/70 bg-board-950/50 px-3 py-2 text-[13px] text-chalk-50 outline-none transition-all placeholder:text-chalk-600 focus:border-mark-yellow";
  const label = "mb-1 block text-[10.5px] font-bold uppercase tracking-wider text-chalk-500";

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-5">
      <p className="rise tick text-mark-yellow">
        {isOwner ? "Кабинет создателя платформы" : "Кабинет преподавателя"}
      </p>
      <h1 className="rise rise-1 mt-2 flex flex-wrap items-center gap-3 font-display text-3xl font-bold tracking-tight text-chalk-50 sm:text-4xl">
        {user?.name ?? "Администратор"}
        {isOwner && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-mark-yellow/50 bg-mark-yellow/10 px-3 py-1 text-[11px] font-bold text-mark-yellow">
            <Crown className="h-3.5 w-3.5" />
            создатель
          </span>
        )}
      </h1>

      <div className="rise rise-2 mt-6 flex flex-wrap gap-1.5">
        {([...(isOwner ? [["site", "🌐 Сайт"]] : []), ["students", "Ученики"], ["report", "Отчёт"], ["hw", "Домашние задания"], ["materials", "📚 Теория"], ["bank", "Банк задач"], ["import", "Импорт JSON"], ["variants", "Варианты"]] as ["bank" | "import" | "variants" | "students" | "hw" | "report" | "site" | "materials", string][]).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`inline-flex min-h-[44px] items-center rounded-full px-4 py-2 text-[12.5px] font-bold transition-all active:scale-95 ${tab === k ? "bg-mark-yellow text-board-950 shadow-lg shadow-mark-yellow/20" : "card text-chalk-300 hover:text-chalk-50"}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === "bank" && (
        <div className="mt-5">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold text-chalk-400">Задач в банке: <b className="text-chalk-50">{taskBank.length}</b></p>
            <div className="flex gap-2">
              <button onClick={exportBank} className="btn-ghost px-4 py-2 text-[12.5px]"><Download className="h-3.5 w-3.5" />Экспорт</button>
              <button onClick={() => setShowForm((s) => !s)} className="btn-gold px-4 py-2 text-[12.5px]"><Plus className="h-4 w-4" />{showForm ? "Свернуть" : "Добавить задачу"}</button>
            </div>
          </div>

          {showForm && (
            <div className="card pop-in mt-4 grid gap-5 p-5 lg:grid-cols-2">
              <div className="space-y-3.5">
                <div className="grid grid-cols-3 gap-3">
                  <div><label className={label}>Экзамен</label>
                    <select value={form.exam_type} onChange={(e) => setForm({ ...form, exam_type: e.target.value as "ege" | "oge" })} className={field}>
                      <option value="ege">ЕГЭ</option><option value="oge">ОГЭ</option>
                    </select></div>
                  <div><label className={label}>Номер 1–19</label>
                    <input type="number" min={1} max={19} value={form.task_number} onChange={(e) => setForm({ ...form, task_number: +e.target.value })} className={field} /></div>
                  <div><label className={label}>Сложность</label>
                    <select value={form.difficulty_level} onChange={(e) => setForm({ ...form, difficulty_level: +e.target.value })} className={field}>
                      <option value={1}>1 — базовая</option><option value={2}>2 — средняя</option><option value={3}>3 — сложная</option>
                    </select></div>
                </div>
                <div><label className={label}>Тема</label><input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="Уравнения" className={field} /></div>
                <div><label className={label}>Условие (LaTeX: $…$ или $$…$$)</label>
                  <textarea value={form.condition_text} onChange={(e) => setForm({ ...form, condition_text: e.target.value })} rows={4} placeholder="Найдите корень уравнения $\log_2(x+3)=4$." className={field} /></div>
                <div><label className={label}>Эталонное решение (LaTeX)</label>
                  <textarea value={form.solution_text} onChange={(e) => setForm({ ...form, solution_text: e.target.value })} rows={3} placeholder="$x+3=16 \Rightarrow x=13$" className={field} /></div>
                {form.is_second_part && (
                  <div><label className={label}>Критерии оценивания ФИПИ (часть 2)</label>
                    <textarea value={form.criteria} onChange={(e) => setForm({ ...form, criteria: e.target.value })} rows={3} placeholder="1 балл — верный ответ в п. а; 2 балла — оба пункта; 3 балла — полное обоснованное решение" className={field} /></div>
                )}
                <div><label className={label}>Чертёж / график (URL или data-URL)</label>
                  <input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://…/chertyozh.png или image/png;base64,…" className={field} />
                  {form.image_url.trim() && (
                    <img src={form.image_url.trim()} alt="Предпросмотр чертежа"
                      className="mt-2 max-h-40 w-auto max-w-full rounded-lg border border-board-600/50 bg-white object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      onLoad={(e) => { (e.target as HTMLImageElement).style.display = ""; }} />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={label}>Правильный ответ</label>
                    <input value={form.correct_answer} onChange={(e) => setForm({ ...form, correct_answer: e.target.value })} disabled={form.is_second_part} placeholder="13" className={`${field} disabled:opacity-40`} /></div>
                  <div><label className={label}>Источник</label><input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="ФИПИ, 2023" className={field} /></div>
                </div>
                <label className="flex items-center gap-2 text-[12.5px] font-semibold text-chalk-300">
                  <input type="checkbox" checked={form.is_second_part} onChange={(e) => setForm({ ...form, is_second_part: e.target.checked })} className="h-4 w-4 accent-[#ffc94d]" />
                  Часть 2 (проверяется вручную, без автоответа)
                </label>
                <button onClick={submitForm} className="btn-gold w-full px-4 py-3 text-sm">Сохранить задачу</button>
              </div>
              <div>
                <p className={label}>Живой предпросмотр</p>
                <div className="card min-h-[280px] p-4">
                  <p className="text-[10.5px] font-bold uppercase tracking-wider text-mark-yellow">№{form.task_number} · {form.topic || "тема"} · часть {form.is_second_part ? 2 : 1}</p>
                  <p className="mt-2 text-[14px] leading-relaxed text-chalk-100">
                    {form.condition_text ? <LatexText text={form.condition_text} /> : <span className="text-chalk-600">Условие появится здесь…</span>}
                  </p>
                  {form.image_url.trim() && (
                    <img src={form.image_url.trim()} alt="Чертёж"
                      className="mt-3 max-h-48 w-auto max-w-full rounded-lg border border-board-600/50 bg-white object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      onLoad={(e) => { (e.target as HTMLImageElement).style.display = ""; }} />
                  )}
                  {form.solution_text && (
                    <p className="mt-3 border-t border-board-700/60 pt-2 text-[12.5px] leading-relaxed text-chalk-400"><LatexText text={form.solution_text} /></p>
                  )}
                  {form.is_second_part && form.criteria.trim() && (
                    <p className="mt-2 border-t border-board-700/60 pt-2 text-[11.5px] leading-relaxed text-mark-yellow/90">
                      <b>Критерии:</b> <LatexText text={form.criteria} />
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 space-y-2.5">
            {taskBank.length === 0 && !showForm && (
              <div className="card px-6 py-12 text-center">
                <FileJson className="mx-auto h-9 w-9 text-chalk-500" />
                <p className="mt-3 text-[13px] text-chalk-400">Банк пуст. Добавьте первую задачу или импортируйте JSON.</p>
              </div>
            )}
            {[...taskBank].sort((a, b) => a.task_number - b.task_number).map((t) => (
              <div key={t.id} className="card card-hover flex items-start gap-3 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-mark-yellow/12 font-display text-[12.5px] font-bold text-mark-yellow">№{t.task_number}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-[12px] font-bold text-chalk-50">
                    {t.topic} · часть {t.is_second_part ? 2 : 1} · сложность {t.difficulty_level}
                    {t.is_second_part && t.criteria && <span className="rounded-full bg-mark-yellow/15 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-mark-yellow">критерии</span>}
                    {t.image_url && <span className="rounded-full bg-mark-blue/15 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-mark-blue">чертёж</span>}
                  </p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-chalk-300"><LatexText text={t.condition_text} /></p>
                  {t.image_url && (
                    <img src={t.image_url} alt={`Чертёж к №${t.task_number}`}
                      className="mt-2 max-h-24 w-auto max-w-full rounded-md border border-board-600/50 bg-white object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      onLoad={(e) => { (e.target as HTMLImageElement).style.display = ""; }} />
                  )}
                </div>
                <button onClick={() => { removeTask(t.id); pushToast("Задача удалена"); }} className="btn-ghost !border-mark-red/40 !text-mark-red shrink-0 p-2 hover:!bg-mark-red/10" aria-label="Удалить">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "import" && (
        <div className="card mt-5 p-5">
          <h2 className="flex items-center gap-2 font-display text-sm font-bold text-chalk-50"><Upload className="h-4 w-4 text-mark-yellow" />Массовая загрузка задач</h2>
          <p className="mt-1 text-[12px] text-chalk-500">Вставьте JSON: массив задач или объект <code className="font-mono text-mark-yellow">{"{tasks: [...]}"}</code>. Дубликаты (экзамен + номер + условие) пропускаются.</p>
          <textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={10}
            placeholder={'{\n  "tasks": [\n    { "exam_type": "ege", "task_number": 6, "topic": "Уравнения",\n      "condition_text": "Найдите корень уравнения $\\\\log_2(x+3)=4$.",\n      "solution_text": "$x+3=16 \\\\Rightarrow x=13$",\n      "correct_answer": "13", "is_second_part": false, "difficulty_level": 1 }\n  ]\n}'}
            className={`${field} mt-3 font-mono text-[12px]`} />
          <div className="mt-3 flex gap-2">
            <button onClick={runImport} className="btn-gold px-5 py-2.5 text-[13px]">Импортировать</button>
            <button onClick={() => setImportText("")} className="btn-ghost px-4 py-2.5 text-[12.5px]">Очистить</button>
          </div>
          {report && (
            <div className="pop-in mt-4 rounded-lg border border-board-600/60 bg-board-950/40 p-4">
              <p className="text-[13px] font-bold text-chalk-50">
                Добавлено: <span className="text-mark-green">{report.added}</span> ·
                Пропущено дублей: <span className="text-mark-yellow">{report.skipped}</span> ·
                Ошибок: <span className={report.errors.length ? "text-mark-red" : "text-chalk-500"}>{report.errors.length}</span>
              </p>
              {report.errors.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {report.errors.map((e, i) => (
                    <li key={i} className="text-[12px] text-mark-red">{e.row ? `строка ${e.row}: ` : ""}{e.msg}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "variants" && (
        <div className="mt-5 space-y-6">
          {/* опубликованные варианты */}
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-sm font-bold text-chalk-50"><Sparkles className="h-4 w-4 text-mark-yellow" />Опубликованные варианты</h2>
              <span className="text-[12px] font-semibold text-chalk-400">всего: <b className="text-chalk-50">{publishedVariants.length}</b></span>
            </div>
            {publishedVariants.length === 0 ? (
              <p className="mt-3 text-[12.5px] text-chalk-500">Пока нет опубликованных вариантов — загрузите .json ниже.</p>
            ) : (
              <ul className="mt-3 divide-y divide-board-700/60">
                {publishedVariants.map((v) => (
                  <li key={v.id} className="card-hover flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold text-chalk-50">{v.variantTitle}</p>
                      <p className="text-[10.5px] text-chalk-500">{v.tasks.length} задач · код <b className="font-mono text-mark-yellow">{v.linkCode}</b> · {new Date(v.publishedAt).toLocaleDateString("ru-RU")}</p>
                    </div>
                    <button onClick={() => runPublishedVariant(v.linkCode)} className="btn-ghost px-3 py-1.5 text-[11.5px]">Открыть</button>
                    <button onClick={() => { navigator.clipboard?.writeText(variantLink(v.linkCode)); pushToast(`Ссылка ${v.linkCode} скопирована`); }} className="btn-ghost px-3 py-1.5 text-[11.5px]"><Copy className="h-3 w-3" />Ссылка</button>
                    <button onClick={() => { unpublishVariant(v.id); pushToast("Вариант снят с публикации"); }} className="btn-ghost px-3 py-1.5 text-[11.5px] !text-mark-red hover:!border-mark-red/50"><Trash2 className="h-3 w-3" /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* загрузчик */}
          <VariantUploader />
        </div>
      )}

      {tab === "students" && (
        <div className="mt-5">
          <TeacherDashboard />
          <p className="mt-4 flex items-center gap-2 text-[11px] text-chalk-600"><Sparkles className="h-3.5 w-3.5 text-mark-yellow" />В продакшене статистика берётся из БД по teacher_id; здесь — из локального хранилища учеников, зарегистрированных по вашему коду.</p>
        </div>
      )}

      {tab === "report" && (
        <div className="mt-5">
          <TeacherReportPanel />
        </div>
      )}

      {tab === "site" && isOwner && (
        <div className="mt-5">
          <Suspense fallback={<div className="py-16 text-center text-[12px] font-mono uppercase tracking-widest text-chalk-500">Собираем статистику…</div>}>
            <SiteStatsPanel />
          </Suspense>
        </div>
      )}

      {tab === "materials" && (
        <div className="mt-5">
          <MaterialsAdmin />
        </div>
      )}

      {tab === "hw" && (
        <div className="mt-5">
          <AssignmentsPanel />
        </div>
      )}
    </div>
  );
}
