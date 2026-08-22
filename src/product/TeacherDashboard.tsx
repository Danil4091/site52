import { useEffect, useMemo, useState } from "react";
import {
  BarChart3, BookOpen, CalendarDays, CheckCircle2, ChevronLeft, ClipboardList,
  Copy, Flame, GraduationCap, Send, Sparkles, Target, Trash2, Users, XCircle,
} from "lucide-react";
import { useApp } from "./store";
import { BANK } from "./data";
import { Avatar } from "./ui";
import {
  ensureDemoStudents, linkedStudentNicks, readStudentStats, timeAgo,
  type ActivityEntry, type StudentStats,
} from "./teacherData";
import {
  createAssignment, deleteAssignment, readAssignments,
  type Assignment, type AssignmentKind,
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

  useEffect(() => { ensureDemoStudents(); }, []);
  const code = user?.teacherCode || "ARTEM-PRO";
  const students = useMemo(() => linkedStudentNicks(code), [code, tick]);
  const list = useMemo(() => readAssignments(), [tick]);

  const remove = (id: string) => { deleteAssignment(id); setTick((t) => t + 1); pushToast("ДЗ удалено"); };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-chalk-50">Домашние задания</h2>
          <p className="text-[11.5px] text-chalk-500">отправьте вариант или блок задач — ученики получат уведомление</p>
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
          const done = a.targets.filter((t) => t.status === "done").length;
          return (
            <div key={a.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${a.kind === "variant" ? "bg-mark-blue/15 text-mark-blue" : "bg-mark-green/15 text-mark-green"}`}>
                  {a.kind === "variant" ? <ClipboardList className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold text-chalk-50">{a.title}</p>
                  <p className="text-[11px] text-chalk-500">
                    {a.kind === "variant" ? "Вариант" : `Блок · №${a.topicNumber} · ${a.taskCount} задач`}
                    {a.deadline ? ` · до ${new Date(a.deadline).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}` : ""}
                  </p>
                </div>
                <span className="chip"><CheckCircle2 className="h-3.5 w-3.5 text-mark-green" />{done}/{a.targets.length} выполнили</span>
                <button onClick={() => remove(a.id)} className="btn-ghost !px-2.5 !py-2 !text-mark-red"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {a.targets.map((t) => (
                  <span key={t.nick} className={`chip !text-[10.5px] ${t.status === "done" ? "!border-mark-green/50 !text-mark-green" : t.status === "opened" ? "!border-mark-yellow/50 !text-mark-yellow" : ""}`}>
                    @{t.nick}{t.status === "done" && t.score !== undefined ? ` · ${t.score}` : t.status === "done" ? " · ✓" : t.status === "opened" ? " · решает" : " · новое"}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {showNew && <NewAssignmentModal students={students.map((s) => s.nick)} onClose={() => setShowNew(false)} onSent={() => { setShowNew(false); setTick((t) => t + 1); }} />}
    </div>
  );
}

/* ─────────────────── форма нового ДЗ ─────────────────── */
function NewAssignmentModal({ students, onClose, onSent }: { students: string[]; onClose: () => void; onSent: () => void }) {
  const { user, publishedVariants, pushToast } = useApp();
  const [kind, setKind] = useState<AssignmentKind>("block");
  const [variantId, setVariantId] = useState("v-real-2023");
  const [topicNumber, setTopicNumber] = useState(4);
  const [taskCount, setTaskCount] = useState(5);
  const [message, setMessage] = useState("");
  const [deadline, setDeadline] = useState("");
  const [sel, setSel] = useState<string[]>(students);

  const toggle = (n: string) => setSel((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]));

  const send = () => {
    if (!sel.length) { pushToast("Выберите хотя бы одного ученика"); return; }
    const title = kind === "variant"
      ? `Вариант: ${variantId === "v-real-2023" ? "Реальный вариант 2023 (ФИПИ)" : publishedVariants.find((v) => v.id === variantId)?.variantTitle ?? "Авторский вариант"}`
      : `Блок задач · №${topicNumber} ${BANK.find((b) => b.number === topicNumber)?.topic ?? ""} (${taskCount} шт)`;
    createAssignment({
      fromNick: user?.nickname ?? "teacher",
      fromName: user?.name ?? "Артём",
      title, kind,
      variantId: kind === "variant" ? variantId : undefined,
      topicNumber: kind === "block" ? topicNumber : undefined,
      taskCount: kind === "block" ? taskCount : undefined,
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
        <div className="mt-4 grid grid-cols-2 gap-2">
          {([["block", "Блок задач по теме", BookOpen], ["variant", "Целый вариант", ClipboardList]] as [AssignmentKind, string, typeof BookOpen][]).map(([k, l, I]) => (
            <button key={k} onClick={() => setKind(k)} className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-[12.5px] font-bold transition-all ${kind === k ? "border-mark-yellow bg-mark-yellow/10 text-mark-yellow" : "border-board-600/70 text-chalk-400 hover:text-chalk-200"}`}>
              <I className="h-4 w-4" />{l}
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
