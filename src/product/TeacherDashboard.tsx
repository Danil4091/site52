import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, BarChart3, BookOpen, CalendarDays, CheckCircle2, ChevronLeft, ClipboardList,
  Clock, Copy, Flame, GraduationCap, PenLine, Send, Sparkles, Target, Trash2, TrendingUp, Users, XCircle,
} from "lucide-react";
import { useApp } from "./store";
import { BANK, REAL_VARIANT } from "./data";
import { Avatar, LatexText } from "./ui";
import {
  ensureDemoStudents, groupReport, linkedStudentNicks, readStudentStats, studentInsights, timeAgo,
  type ActivityEntry, type StudentStats,
} from "./teacherData";
import {
  createAssignment, deadlineMeta, deleteAssignment, gradeSolution, readAssignments,
  type Assignment, type AssignmentKind, type PickedTask,
} from "./assignments";

/* ─────────────────── мини-столбчатая диаграмма баллов ─────────────────── */
function ScoreBars({ attempts }: { attempts: StudentStats["attempts"] }) {
  if (!attempts.length) {
    return <p className="py-6 text-center text-[12px] text-chalk-500">Пока нет решённых вариантов</p>;
  }
  const W = 320, H = 120, pad = 6;
  const bw = (W - pad * 2) / attempts.length;
  const y = (v: number) => H - pad - (v / 100) * (H - pad * 2);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {/* порог 70 */}
      <line x1={pad} x2={W - pad} y1={y(70)} y2={y(70)} stroke="var(--color-mark-green)" strokeWidth="1" strokeDasharray="4 4" opacity="0.6" />
      <text x={W - pad} y={y(70) - 4} textAnchor="end" fontSize="8" fill="var(--color-mark-green)" opacity="0.8">порог 70</text>
      {attempts.map((a, i) => {
        const h = H - pad - y(a.secondary);
        const color = a.secondary >= 80 ? "var(--color-mark-green)" : a.secondary >= 70 ? "var(--color-mark-yellow)" : "var(--color-mark-red)";
        return (
          <g key={a.id}>
            <rect x={pad + i * bw + bw * 0.18} y={y(a.secondary)} width={bw * 0.64} height={h} rx="3" fill={color} opacity="0.9">
              <title>{`${a.label}: ${a.secondary} баллов`}</title>
            </rect>
            <text x={pad + i * bw + bw / 2} y={y(a.secondary) - 4} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="var(--color-chalk-300)">{a.secondary}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ─────────────────── тепловая карта тем ученика ─────────────────── */
function TopicMiniMap({ topics }: { topics: StudentStats["topics"] }) {
  const cell = (n: number) => {
    const t = topics[n];
    const has = t && t.attempts > 0;
    const r = has ? (t.solved / t.attempts) * 100 : 0;
    const bg = !has ? "var(--color-board-800)" : r >= 80 ? "color-mix(in srgb, var(--color-mark-green) 55%, var(--color-board-800))" : r >= 50 ? "color-mix(in srgb, var(--color-mark-yellow) 55%, var(--color-board-800))" : "color-mix(in srgb, var(--color-mark-red) 55%, var(--color-board-800))";
    return (
      <div key={n} title={`№${n}: ${has ? Math.round(r) + "%" : "нет данных"}`} className="flex h-8 items-center justify-center rounded-md text-[10px] font-bold text-chalk-100" style={{ background: bg }}>
        {n}
      </div>
    );
  };
  return <div className="grid grid-cols-12 gap-1">{Array.from({ length: 12 }, (_, i) => cell(i + 1))}</div>;
}

/* ─────────────────── лента активности ─────────────────── */
function ActivityFeed({ items }: { items: ActivityEntry[] }) {
  if (!items.length) return <p className="py-4 text-center text-[12px] text-chalk-500">Активности пока нет</p>;
  return (
    <ul className="space-y-2">
      {items.slice(0, 8).map((a, i) => (
        <li key={i} className="flex items-center gap-2.5 rounded-lg border border-board-700/50 bg-board-800/40 px-3 py-2">
          {a.kind === "variant" ? (
            <ClipboardList className="h-4 w-4 shrink-0 text-mark-blue" />
          ) : a.correct ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-mark-green" />
          ) : (
            <XCircle className="h-4 w-4 shrink-0 text-mark-red" />
          )}
          <span className="min-w-0 flex-1 truncate text-[12px] text-chalk-200">
            {a.kind === "variant" ? <>Вариант «{a.label}» — <b className="text-mark-yellow">{a.score}</b> баллов</> : <>№{a.taskNumber} {a.topic}</>}
          </span>
          <span className="shrink-0 text-[10.5px] text-chalk-500">{timeAgo(a.ts)}</span>
        </li>
      ))}
    </ul>
  );
}

/* ═══════════════════════ КАБИНЕТ ПРЕПОДАВАТЕЛЯ ═══════════════════════ */
export default function TeacherDashboard() {
  const { user, pushToast } = useApp();
  const [selected, setSelected] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  /* при первом открытии — демо-ученики (локальный режим) */
  useEffect(() => { ensureDemoStudents(); }, []);

  const code = user?.teacherCode || "ARTEM-PRO";
  const students = useMemo(() => {
    const linked = linkedStudentNicks(code);
    return linked.map((l) => ({ ...readStudentStats(l.nick), goal: l.goal, registeredAt: l.registeredAt }));
  }, [code]);

  const active = selected ? students.find((s) => s.nick === selected) ?? null : null;

  const totalSolved = students.reduce((s, x) => s + x.solvedCount, 0);
  const avgAll = students.length ? Math.round(students.reduce((s, x) => s + x.avgScore, 0) / students.length) : 0;
  const weekAgo = Date.now() - 7 * 86_400_000;
  const activeWeek = students.filter((s) => (s.lastActive ?? 0) >= weekAgo).length;

  const copyInvite = () => {
    const link = `${location.origin}${location.pathname}?ref=${code}`;
    navigator.clipboard?.writeText(link).catch(() => {});
    setCopied(true);
    pushToast("Ссылка-приглашение скопирована");
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div>
      {/* шапка кабинета */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-mark-yellow/15 text-mark-yellow"><GraduationCap className="h-5 w-5" /></span>
          <div>
            <h2 className="font-display text-lg font-bold text-chalk-50">Мои ученики</h2>
            <p className="text-[11.5px] text-chalk-500">зарегистрировались по вашему коду · всего {students.length}</p>
          </div>
        </div>
        <button onClick={copyInvite} className="btn-ghost px-4 py-2 text-[12.5px]">
          {copied ? <CheckCircle2 className="h-4 w-4 text-mark-green" /> : <Copy className="h-4 w-4" />}
          {copied ? "Скопировано" : "Ссылка-приглашение"}
        </button>
      </div>

      {/* сводка */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { icon: Users, label: "Учеников", value: String(students.length), color: "text-mark-blue" },
          { icon: Flame, label: "Активны за неделю", value: String(activeWeek), color: "text-mark-red" },
          { icon: BarChart3, label: "Средний балл", value: String(avgAll), color: "text-mark-yellow" },
          { icon: Target, label: "Решено задач", value: String(totalSolved), color: "text-mark-green" },
        ].map((c) => {
          const I = c.icon;
          return (
            <div key={c.label} className="card card-hover p-4">
              <div className="flex items-center gap-2"><I className={`h-4 w-4 ${c.color}`} /><span className="text-[11px] font-semibold text-chalk-500">{c.label}</span></div>
              <p className="mt-2 font-display text-2xl font-bold tabular-nums text-chalk-50">{c.value}</p>
            </div>
          );
        })}
      </div>

      {!active ? (
        /* ── список учеников ── */
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {students.length === 0 && (
            <div className="card col-span-full px-6 py-12 text-center">
              <Users className="mx-auto h-10 w-10 text-chalk-500" />
              <p className="mt-3 font-display text-base font-bold text-chalk-200">Пока нет учеников</p>
              <p className="mt-1 text-[13px] text-chalk-500">Отправьте ученикам ссылку-приглашение — после регистрации по вашему коду они появятся здесь со всей статистикой.</p>
            </div>
          )}
          {students.map((s) => (
            <button key={s.nick} onClick={() => setSelected(s.nick)} className="card card-hover p-4 text-left">
              <div className="flex items-center gap-3">
                <Avatar name={s.nick} className="h-11 w-11 text-[13px]" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate font-mono text-[14px] font-bold text-chalk-50">
                    @{s.nick}
                    {s.goal && <span className="chip !py-0.5 !text-[9.5px]"><Target className="h-3 w-3" />цель {s.goal}</span>}
                  </p>
                  <p className="mt-0.5 text-[11px] text-chalk-500">
                    был(а) {timeAgo(s.lastActive)} · серия {s.streak.days} дн
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-xl font-bold tabular-nums text-mark-yellow">{s.bestScore}</p>
                  <p className="text-[9.5px] font-semibold uppercase tracking-wide text-chalk-500">лучший</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[10.5px] font-semibold text-chalk-500">Динамика баллов</p>
                  <div className="mt-1"><ScoreBars attempts={s.attempts.slice(-6)} /></div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display text-lg font-bold tabular-nums text-chalk-50">{s.solvedCount}</p>
                  <p className="text-[9.5px] font-semibold uppercase tracking-wide text-chalk-500">задач решено</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        /* ── детальный профиль ученика ── */
        <div className="mt-4">
          <button onClick={() => setSelected(null)} className="btn-ghost mb-3 px-3 py-1.5 text-[12px]"><ChevronLeft className="h-4 w-4" />К списку</button>
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="card p-4 lg:col-span-1">
              <div className="flex items-center gap-3">
                <Avatar name={active.nick} className="h-12 w-12 text-[14px]" />
                <div>
                  <p className="font-mono text-[15px] font-bold text-chalk-50">@{active.nick}</p>
                  <p className="text-[11px] text-chalk-500">был(а) {timeAgo(active.lastActive)}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {[
                  { l: "Лучший балл", v: String(active.bestScore), c: "text-mark-yellow" },
                  { l: "Средний балл", v: String(active.avgScore), c: "text-chalk-200" },
                  { l: "Решено задач", v: String(active.solvedCount), c: "text-mark-green" },
                  { l: "Серия", v: `${active.streak.days} дн`, c: "text-mark-red" },
                ].map((x) => (
                  <div key={x.l} className="rounded-lg border border-board-700/50 bg-board-800/40 px-3 py-2">
                    <p className={`font-display text-lg font-bold tabular-nums ${x.c}`}>{x.v}</p>
                    <p className="text-[9.5px] font-semibold uppercase tracking-wide text-chalk-500">{x.l}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[10.5px] font-semibold text-chalk-500">Успеваемость по темам (№1–12)</p>
              <div className="mt-1.5"><TopicMiniMap topics={active.topics} /></div>
            </div>

            <div className="card p-4 lg:col-span-1">
              <p className="flex items-center gap-2 text-[12px] font-bold text-chalk-200"><BarChart3 className="h-4 w-4 text-mark-yellow" />Баллы за варианты</p>
              <div className="mt-2"><ScoreBars attempts={active.attempts} /></div>
            </div>

            <div className="card p-4 lg:col-span-1">
              <p className="flex items-center gap-2 text-[12px] font-bold text-chalk-200"><Sparkles className="h-4 w-4 text-mark-blue" />Последняя активность</p>
              <div className="mt-2"><ActivityFeed items={active.activity} /></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ МЕНЕДЖЕР ДОМАШНИХ ЗАДАНИЙ ═══════════════════════ */
export function AssignmentsPanel() {
  const { user, pushToast } = useApp();
  const [showNew, setShowNew] = useState(false);
  const [tick, setTick] = useState(0);
  const [expandedSolution, setExpandedSolution] = useState<string | null>(null); // `${hwId}:${nick}`
  const [grades, setGrades] = useState<Record<string, string>>({}); // черновики оценок

  useEffect(() => { ensureDemoStudents(); }, []);
  /* тикаем раз в 30 с, чтобы дедлайны и «просрочено» обновлялись сами */
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const code = user?.teacherCode || "ARTEM-PRO";
  const students = useMemo(() => linkedStudentNicks(code), [code, tick]);
  const list = useMemo(() => readAssignments(), [tick]);

  const remove = (id: string) => { deleteAssignment(id); setTick((t) => t + 1); pushToast("ДЗ удалено"); };

  const grade = (hwId: string, nick: string) => {
    const raw = grades[`${hwId}:${nick}`];
    const val = raw === undefined ? NaN : Number(raw.replace(",", "."));
    if (!Number.isFinite(val) || val < 0) { pushToast("Введите оценку числом (например, 2)"); return; }
    gradeSolution(hwId, nick, val);
    setTick((t) => t + 1);
    pushToast(`Оценка ${val} выставлена — @${nick}`);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-chalk-50">Домашние задания</h2>
          <p className="text-[11.5px] text-chalk-500">вариант, блок задач или свой набор · дедлайны и ручная проверка части 2</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-gold px-4 py-2 text-[12.5px]"><Send className="h-4 w-4" />Отправить ДЗ</button>
      </div>

      <div className="mt-4 space-y-3">
        {list.length === 0 && (
          <div className="card px-6 py-12 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-chalk-500" />
            <p className="mt-3 font-display text-base font-bold text-chalk-200">ДЗ пока не отправлялись</p>
            <p className="mt-1 text-[13px] text-chalk-500">Нажмите «Отправить ДЗ», чтобы назначить ученикам вариант или блок задач по теме.</p>
          </div>
        )}
        {list.map((a) => {
          const meta = deadlineMeta(a);
          const maxPart2 = (a.pickedTasks ?? []).filter((t) => t.part === 2).reduce((s, t) => s + (t.maxScore ?? 2), 0);
          const hasSubmitted = a.targets.some((t) => t.status === "submitted");
          return (
            <div key={a.id} className={`card p-4 ${meta.overdue ? "!border-mark-red/40" : ""}`}>
              <div className="flex flex-wrap items-center gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${a.kind === "variant" ? "bg-mark-blue/15 text-mark-blue" : a.kind === "custom" ? "bg-mark-yellow/15 text-mark-yellow" : "bg-mark-green/15 text-mark-green"}`}>
                  {a.kind === "variant" ? <ClipboardList className="h-5 w-5" /> : a.kind === "custom" ? <Sparkles className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold text-chalk-50">{a.title}</p>
                  <p className="text-[11px] text-chalk-500">
                    {a.kind === "variant" ? "Вариант" : a.kind === "custom" ? `Свой набор · ${a.pickedTasks?.length ?? 0} задач(и)` : `Блок · №${a.topicNumber} · ${a.taskCount} задач`}
                    {maxPart2 > 0 && <span className="text-mark-pink"> · ч.2 на {maxPart2} б. (ручная проверка)</span>}
                  </p>
                </div>
                {/* дедлайн */}
                {a.deadline && (
                  <span className={`chip !text-[10.5px] ${meta.overdue ? "!border-mark-red/60 !text-mark-red" : meta.msLeft < 86_400_000 ? "!border-mark-yellow/60 !text-mark-yellow" : ""}`}>
                    <Clock className="h-3.5 w-3.5" />
                    {meta.overdue ? "просрочено" : `до ${new Date(a.deadline).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })} · ${meta.humanLeft}`}
                  </span>
                )}
                <span className="chip"><CheckCircle2 className="h-3.5 w-3.5 text-mark-green" />{meta.doneCount}/{a.targets.length} выполнили</span>
                <button onClick={() => remove(a.id)} className="btn-ghost !px-2.5 !py-2 !text-mark-red"><Trash2 className="h-4 w-4" /></button>
              </div>

              {/* прогресс выполнения к дедлайну */}
              {a.deadline && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[10.5px] font-semibold text-chalk-500">
                    <span>выполнение к дедлайну</span>
                    <span className="tabular-nums">{meta.progressPct}%{meta.submittedCount > 0 && ` · ${meta.submittedCount} ждут проверки`}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-board-700/60">
                    <div className={`h-full rounded-full transition-all duration-500 ${meta.overdue && meta.progressPct < 100 ? "bg-mark-red" : "bg-mark-green"}`} style={{ width: `${meta.progressPct}%` }} />
                  </div>
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {a.targets.map((t) => (
                  <span key={t.nick} className={`chip !text-[10.5px] ${t.status === "done" ? "!border-mark-green/50 !text-mark-green" : t.status === "opened" ? "!border-mark-yellow/50 !text-mark-yellow" : t.status === "expired" ? "!border-mark-red/50 !text-mark-red" : t.status === "submitted" ? "!border-mark-pink/50 !text-mark-pink" : ""}`}>
                    @{t.nick}
                    {t.status === "done" && t.manualScore !== undefined ? ` · ч.2: ${t.manualScore} б.` : t.status === "done" && t.score !== undefined ? ` · ${t.score}` : t.status === "done" ? " · ✓" : t.status === "opened" ? " · решает" : t.status === "expired" ? " · просрочено" : t.status === "submitted" ? " · сдал ч.2" : " · новое"}
                  </span>
                ))}
              </div>

              {/* ручная проверка части 2: решения, сданные учениками */}
              {hasSubmitted && (
                <div className="mt-3 rounded-lg border border-mark-pink/30 bg-mark-pink/5 p-3">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-mark-pink"><PenLine className="h-3.5 w-3.5" />Решения части 2 — ждут вашей проверки</p>
                  <div className="mt-2 space-y-2">
                    {a.targets.filter((t) => t.status === "submitted").map((t) => {
                      const key = `${a.id}:${t.nick}`;
                      const open = expandedSolution === key;
                      return (
                        <div key={t.nick} className="rounded-lg border border-board-600/50 bg-board-950/40 p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[12px] font-bold text-chalk-50">@{t.nick}</span>
                            {t.submittedAt && <span className="text-[10.5px] text-chalk-500">сдал(а) {timeAgo(t.submittedAt)}</span>}
                            <button onClick={() => setExpandedSolution(open ? null : key)} className="btn-ghost ml-auto !px-2.5 !py-1.5 !text-[11px]">
                              {open ? "Свернуть" : "Открыть решение"}
                            </button>
                          </div>
                          {open && (
                            <>
                              <pre className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg bg-board-950/70 p-3 font-mono text-[12px] leading-relaxed text-chalk-200">{t.solution || "(пусто)"}</pre>
                              <div className="mt-2 flex items-center gap-2">
                                <input
                                  value={grades[key] ?? ""}
                                  onChange={(e) => setGrades((g) => ({ ...g, [key]: e.target.value }))}
                                  placeholder={`Оценка (0–${maxPart2 || 2})`}
                                  inputMode="decimal"
                                  className="w-32 rounded-lg border border-board-600/70 bg-board-950/50 px-3 py-1.5 font-mono text-[12.5px] text-chalk-50 outline-none focus:border-mark-pink"
                                />
                                <button onClick={() => grade(a.id, t.nick)} className="btn-gold !px-3.5 !py-1.5 !text-[11.5px]">Оценить</button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showNew && <NewAssignmentModal students={students.map((s) => s.nick)} onClose={() => setShowNew(false)} onSent={() => { setShowNew(false); setTick((t) => t + 1); }} />}
    </div>
  );
}

/* ─────────────────── форма нового ДЗ (конструктор) ─────────────────── */
function NewAssignmentModal({ students, onClose, onSent }: { students: string[]; onClose: () => void; onSent: () => void }) {
  const { user, publishedVariants, taskBank, pushToast } = useApp();
  const [kind, setKind] = useState<AssignmentKind>("block");
  const [variantId, setVariantId] = useState("v-real-2023");
  const [topicNumber, setTopicNumber] = useState(4);
  const [taskCount, setTaskCount] = useState(5);
  const [message, setMessage] = useState("");
  const [deadline, setDeadline] = useState("");
  const [sel, setSel] = useState<string[]>(students);
  /* свой набор: выбранные из Банка задачи */
  const [picked, setPicked] = useState<PickedTask[]>([]);

  const toggle = (n: string) => setSel((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]));

  /* все задачи, которые можно выбрать из Банка (реальные + загруженные) */
  const bankTasks = useMemo<PickedTask[]>(() => {
    /* реальные задачи ФИПИ: и часть 1 (автопроверка), и часть 2 (ручная) */
    const real: PickedTask[] = REAL_VARIANT.map((t) => ({
      id: `bank-real-${t.number}`, number: t.number, topic: t.category,
      statement: t.statement, answer: t.answer, solution: t.solution,
      part: t.part, maxScore: t.maxScore, criteria: t.part === 2 ? t.solution : undefined,
    }));
    /* загруженные преподавателем: часть 1 + часть 2 */
    const custom: PickedTask[] = taskBank.map((t) => ({
      id: `bank-${t.id}`, number: t.task_number, topic: t.topic,
      statement: t.condition_text, answer: t.correct_answer, solution: t.solution_text,
      part: t.is_second_part ? 2 : 1, maxScore: t.is_second_part ? 2 : 1,
      criteria: t.is_second_part ? t.solution_text : undefined,
    }));
    return [...real, ...custom];
  }, [taskBank]);

  const pickedPart2 = picked.filter((t) => t.part === 2).length;

  const toggleTask = (t: PickedTask) =>
    setPicked((p) => (p.some((x) => x.id === t.id) ? p.filter((x) => x.id !== t.id) : [...p, t]));

  const send = () => {
    if (!sel.length) { pushToast("Выберите хотя бы одного ученика"); return; }
    if (kind === "custom" && !picked.length) { pushToast("Отметьте хотя бы одну задачу из Банка"); return; }
    const title = kind === "variant"
      ? `Вариант: ${variantId === "v-real-2023" ? "Реальный вариант 2023 (ФИПИ)" : publishedVariants.find((v) => v.id === variantId)?.variantTitle ?? "Авторский вариант"}`
      : kind === "custom"
        ? `Свой набор · ${picked.length} задач(и)`
        : `Блок задач · №${topicNumber} ${BANK.find((b) => b.number === topicNumber)?.topic ?? ""} (${taskCount} шт)`;
    createAssignment({
      fromNick: user?.nickname ?? "teacher",
      fromName: user?.name ?? "Артём",
      title, kind,
      variantId: kind === "variant" ? variantId : undefined,
      topicNumber: kind === "block" ? topicNumber : undefined,
      taskCount: kind === "block" ? taskCount : undefined,
      pickedTasks: kind === "custom" ? picked : undefined,
      message: message.trim() || undefined,
      deadline: deadline ? new Date(deadline + "T23:59:59").getTime() : undefined,
      students: sel,
    });
    pushToast(`ДЗ отправлено ${sel.length} ученикам`);
    onSent();
  };

  const label = "mb-1 block text-[10.5px] font-bold uppercase tracking-wider text-chalk-500";
  const input = "w-full rounded-lg border border-board-600/70 bg-board-950/50 px-3 py-2 text-[13px] text-chalk-50 outline-none transition-all placeholder:text-chalk-600 focus:border-mark-yellow";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-board-950/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="pop-in card max-h-[90vh] w-full max-w-lg overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-chalk-50">Новое домашнее задание</h3>
          <button onClick={onClose} className="btn-ghost !px-2 !py-2"><XCircle className="h-4 w-4" /></button>
        </div>

        {/* тип */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {([["block", "Блок по теме", BookOpen], ["variant", "Целый вариант", ClipboardList], ["custom", "Свой набор", Sparkles]] as [AssignmentKind, string, typeof BookOpen][]).map(([k, l, I]) => (
            <button key={k} onClick={() => setKind(k)} className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2.5 text-[11.5px] font-bold transition-all ${kind === k ? "border-mark-yellow bg-mark-yellow/10 text-mark-yellow" : "border-board-600/70 text-chalk-400 hover:text-chalk-200"}`}>
              <I className="h-4 w-4 shrink-0" />{l}
            </button>
          ))}
        </div>

        {kind === "variant" ? (
          <div className="mt-3">
            <label className={label}>Вариант</label>
            <select value={variantId} onChange={(e) => setVariantId(e.target.value)} className={input}>
              <option value="v-real-2023">Реальный вариант 2023 (ФИПИ)</option>
              {publishedVariants.map((v) => <option key={v.id} value={v.id}>{v.variantTitle}</option>)}
            </select>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <label className={label}>Тема</label>
              <select value={topicNumber} onChange={(e) => setTopicNumber(Number(e.target.value))} className={input}>
                {BANK.filter((b) => b.part === 1).map((b) => <option key={b.number} value={b.number}>№{b.number} {b.topic}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Задач</label>
              <select value={taskCount} onChange={(e) => setTaskCount(Number(e.target.value))} className={input}>
                {[5, 10, 15].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* свой набор: выбор задач из Банка */}
        {kind === "custom" && (
          <div className="mt-3">
            <label className={label}>
              Задачи из Банка · выбрано {picked.length}
              {pickedPart2 > 0 && (
                <span className="ml-1.5 rounded-full bg-mark-pink/15 px-2 py-0.5 text-[9.5px] font-bold text-mark-pink">
                  ч.2: {pickedPart2} шт · {picked.filter((t) => t.part === 2).reduce((s, t) => s + (t.maxScore ?? 2), 0)} б. (проверите вручную)
                </span>
              )}
            </label>
            <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-lg border border-board-600/50 bg-board-950/40 p-2.5">
              {bankTasks.map((t) => {
                const on = picked.some((x) => x.id === t.id);
                return (
                  <button key={t.id} onClick={() => toggleTask(t)}
                    className={`flex w-full items-start gap-2.5 rounded-md border px-2.5 py-2 text-left transition-all ${on ? "border-mark-green/50 bg-mark-green/8" : "border-board-700/50 hover:border-board-600"}`}>
                    <span className={`mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border ${on ? "border-mark-green bg-mark-green text-board-950" : "border-chalk-500/50"}`}>
                      {on && <CheckCircle2 className="h-3.5 w-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <b className="font-mono text-[11px] text-mark-yellow">№{t.number}</b>
                        <span className="text-[11px] font-bold text-chalk-300">{t.topic}</span>
                        {t.part === 2 ? (
                          <span className="rounded-full bg-mark-pink/15 px-1.5 py-0.5 text-[9px] font-bold text-mark-pink">ч.2 · {t.maxScore} б. · вручную</span>
                        ) : (
                          <span className="rounded-full bg-mark-blue/15 px-1.5 py-0.5 text-[9px] font-bold text-mark-blue">ч.1 · авто</span>
                        )}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-chalk-500">
                        <LatexText text={t.statement} />
                      </span>
                    </span>
                  </button>
                );
              })}
              {bankTasks.length === 0 && <p className="px-2 py-4 text-center text-[12px] text-chalk-500">В Банке пока нет задач.</p>}
            </div>
          </div>
        )}

        <div className="mt-3">
          <label className={label}>Сообщение ученикам (необязательно)</label>
          <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Например: повторите формулу полной вероятности" className={input} />
        </div>
        <div className="mt-3">
          <label className={label}>Срок (необязательно)</label>
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={input} />
        </div>

        <div className="mt-3">
          <label className={label}>Кому отправить · {sel.length}</label>
          <div className="flex flex-wrap gap-1.5">
            {students.map((n) => (
              <button key={n} onClick={() => toggle(n)} className={`chip !text-[11px] ${sel.includes(n) ? "!border-mark-green/60 !text-mark-green" : ""}`}>@{n}</button>
            ))}
          </div>
        </div>

        <button onClick={send} className="btn-gold mt-5 w-full justify-center py-2.5 text-[13.5px]"><Send className="h-4 w-4" />Отправить</button>
      </div>
    </div>
  );
}

/* ═══════════════════════ ОТЧЁТ ПРЕПОДАВАТЕЛЯ ═══════════════════════
   Сводная аналитика по группе: групповые метрики, инсайты по каждому
   ученику («чаще всего ошибается в №12 — исследование функций») и
   выполнение активных ДЗ к дедлайну.                                */
export function TeacherReportPanel() {
  const { user } = useApp();
  const [tick, setTick] = useState(0);
  useEffect(() => { ensureDemoStudents(); }, []);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const code = user?.teacherCode || "ARTEM-PRO";
  const students = useMemo(() => linkedStudentNicks(code), [code, tick]);
  const stats = useMemo(() => students.map((s) => readStudentStats(s.nick)), [students, tick]);
  const report = useMemo(() => groupReport(stats), [stats]);
  const activeHw = useMemo(() => readAssignments().filter((a) => a.deadline && a.deadline > Date.now()), [tick]);

  if (!students.length) {
    return (
      <div className="card px-6 py-12 text-center">
        <Users className="mx-auto h-10 w-10 text-chalk-500" />
        <p className="mt-3 font-display text-base font-bold text-chalk-200">Учеников пока нет</p>
        <p className="mt-1 text-[13px] text-chalk-500">Отчёт построится, когда ученики зарегистрируются по вашему коду.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="font-display text-lg font-bold text-chalk-50">Отчёт по группе</h2>
      <p className="text-[11.5px] text-chalk-500">сводная аналитика · обновляется автоматически</p>

      {/* групповые метрики */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Учеников", value: String(report.studentsCount), icon: Users, tone: "text-mark-blue" },
          { label: "Активны за неделю", value: String(report.activeWeek), icon: Flame, tone: "text-mark-yellow" },
          { label: "Средний лучший балл", value: String(report.avgBest), icon: BarChart3, tone: "text-mark-green" },
          { label: "Среднее решено задач", value: String(report.avgSolved), icon: Target, tone: "text-mark-pink" },
        ].map((k) => (
          <div key={k.label} className="card card-hover p-4">
            <k.icon className={`h-4.5 w-4.5 ${k.tone}`} />
            <p className={`mt-2 font-display text-2xl font-bold tabular-nums ${k.tone}`}>{k.value}</p>
            <p className="mt-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-chalk-500">{k.label}</p>
          </div>
        ))}
      </div>

      {/* ключевые выводы */}
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {report.hardest && (
          <div className="card flex items-start gap-3 !border-mark-red/40 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-mark-red/15 text-mark-red"><AlertTriangle className="h-4.5 w-4.5" /></span>
            <div>
              <p className="text-[12.5px] font-bold text-chalk-50">Слабое место группы</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-chalk-300">
                Группа чаще всего ошибается в <b className="text-mark-red">№{report.hardest.number} — {report.hardest.topic}</b>:{" "}
                {report.hardest.wrong} ошибок при {report.hardest.errorRate}% неуспешных попыток. Стоит дать дополнительный блок по этой теме.
              </p>
            </div>
          </div>
        )}
        {report.bestGrowth && report.bestGrowth.delta > 0 && (
          <div className="card flex items-start gap-3 !border-mark-green/40 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-mark-green/15 text-mark-green"><TrendingUp className="h-4.5 w-4.5" /></span>
            <div>
              <p className="text-[12.5px] font-bold text-chalk-50">Лучший прогресс</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-chalk-300">
                <b className="font-mono text-mark-green">@{report.bestGrowth.nick}</b> вырос(ла) на <b className="text-mark-green">+{report.bestGrowth.delta} баллов</b> с первой попытки. Похвалите — это работает.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* инсайты по каждому ученику */}
      <h3 className="mt-6 font-display text-sm font-bold text-chalk-50">На что обратить внимание</h3>
      <div className="mt-3 space-y-3">
        {stats.map((s) => {
          const ins = studentInsights(s);
          const goal = students.find((x) => x.nick === s.nick)?.goal;
          return (
            <div key={s.nick} className="card p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Avatar name={s.nick} />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[13px] font-bold text-chalk-50">@{s.nick}</p>
                  <p className="text-[10.5px] text-chalk-500">лучший {s.bestScore} · средний {s.avgScore}{goal ? ` · цель ${goal}` : ""} · был(а) {timeAgo(s.lastActive)}</p>
                </div>
                {s.bestScore >= (goal ?? 101) ? (
                  <span className="chip !border-mark-green/50 !text-mark-green"><CheckCircle2 className="h-3.5 w-3.5" />цель достигнута</span>
                ) : goal ? (
                  <span className="chip">до цели {goal - s.bestScore} б.</span>
                ) : null}
              </div>
              {ins.length ? (
                <ul className="mt-2.5 space-y-1.5">
                  {ins.map((i, idx) => (
                    <li key={`${s.nick}-${i.number ?? i.topic}-${idx}`} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-chalk-300">
                      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${idx === 0 ? "bg-mark-red" : "bg-mark-yellow"}`} />
                      <span>
                        <b className="text-chalk-50">@{s.nick}</b> {i.sentence}: {i.wrong} ошиб. из {i.attempts} попыток ({i.errorRate}%).
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2.5 text-[12.5px] text-chalk-500">Ошибок пока нет — отличная работа.</p>
              )}
            </div>
          );
        })}
      </div>

      {/* выполнение активных ДЗ */}
      <h3 className="mt-6 font-display text-sm font-bold text-chalk-50">Выполнение ДЗ к дедлайну</h3>
      {activeHw.length ? (
        <div className="mt-3 space-y-3">
          {activeHw.map((a) => {
            const m = deadlineMeta(a);
            return (
              <div key={a.id} className="card p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-chalk-50">{a.title}</p>
                    <p className="text-[10.5px] text-chalk-500">
                      до {new Date(a.deadline!).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })} · осталось {m.humanLeft}
                    </p>
                  </div>
                  <span className="chip"><Clock className="h-3.5 w-3.5 text-mark-yellow" />{m.doneCount}/{a.targets.length} · {m.progressPct}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-board-700/60">
                  <div className="h-full rounded-full bg-mark-yellow transition-all duration-500" style={{ width: `${m.progressPct}%` }} />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {a.targets.map((t) => (
                    <span key={t.nick} className={`chip !text-[10px] ${t.status === "done" ? "!border-mark-green/50 !text-mark-green" : t.status === "submitted" ? "!border-mark-pink/50 !text-mark-pink" : t.status === "opened" ? "!border-mark-yellow/50 !text-mark-yellow" : ""}`}>
                      @{t.nick}{t.status === "done" ? " ✓" : t.status === "submitted" ? " · ч.2" : t.status === "opened" ? " · решает" : ""}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 text-[12.5px] text-chalk-500">Активных ДЗ с дедлайном сейчас нет.</p>
      )}
    </div>
  );
}
