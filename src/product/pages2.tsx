import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowUpFromLine, Check, Copy, Crown, Download, FileJson, Flame,
  KeyRound, Link2, Medal, Plus, Sparkles, Target, Trash2, TrendingDown, TrendingUp, Upload, Users, X,
} from "lucide-react";
import {
  Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useApp, type CustomTask } from "./store";
import { ACHIEVEMENTS, BANK, LEADER_SEED, type AchieveSnapshot } from "./data";
import { Avatar, Heatmap, LatexText } from "./ui";
import VariantUploader from "./VariantUploader";
import { variantLink } from "./variantSchema";

/* ═══════════════════════ АНАЛИТИКА ═══════════════════════ */
export function AnalyticsPage() {
  const { attempts, topicStats, user } = useApp();
  const has = attempts.length > 0;
  const data = attempts.map((a, i) => ({ variant: `П${i + 1}`, secondary: a.secondary, mistakes: a.mistakes }));
  const latest = data[data.length - 1];
  const avg = has ? Math.round(attempts.reduce((s, a) => s + a.secondary, 0) / attempts.length) : 0;
  const mistakes3 = attempts.slice(-3).reduce((s, a) => s + a.mistakes, 0);

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
          <div className="rise rise-2 mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Текущий балл", value: latest.secondary, suffix: "/ 100", tone: "text-mark-green" },
              { label: "Средний балл", value: avg, suffix: "/ 100", tone: "text-chalk-50" },
              { label: "Попыток", value: attempts.length, suffix: "", tone: "text-chalk-50" },
              { label: "Ошибки 0.1 (за 3)", value: mistakes3, suffix: "", tone: mistakes3 > 3 ? "text-mark-red" : "text-mark-yellow" },
            ].map((k) => (
              <div key={k.label} className="card card-hover p-4">
                <p className="tick">{k.label}</p>
                <p className={`mt-1.5 font-display text-3xl font-bold tabular-nums ${k.tone}`}>{k.value}<span className="ml-1 text-xs font-semibold text-chalk-500">{k.suffix}</span></p>
              </div>
            ))}
          </div>

          <div className="rise rise-3 card mt-4 p-5">
            <h2 className="font-display text-sm font-bold text-chalk-50">Динамика баллов и «ошибок 0.1»</h2>
            <div className="mt-3 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 6, right: 4, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-board-700)" vertical={false} />
                  <XAxis dataKey="variant" tickLine={false} axisLine={{ stroke: "var(--color-board-700)" }} tick={{ fontSize: 11, fill: "var(--color-chalk-500)" }} />
                  <YAxis yAxisId="left" domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-chalk-500)" }} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 5]} allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-chalk-500)" }} />
                  <Tooltip contentStyle={{ backgroundColor: "var(--color-board-850)", border: "1px solid var(--color-board-600)", borderRadius: 10, fontSize: 12, color: "var(--color-chalk-200)" }} cursor={{ fill: "var(--color-board-800)" }} />
                  <ReferenceLine yAxisId="left" y={70} stroke="var(--color-mark-blue)" strokeDasharray="5 5" label={{ value: "порог 70", fill: "var(--color-mark-blue)", fontSize: 10, position: "insideTopRight" }} />
                  <Bar yAxisId="right" dataKey="mistakes" name="Ошибки 0.1" fill="var(--color-mark-red)" radius={[4, 4, 0, 0]} barSize={14} opacity={0.85} />
                  <Line yAxisId="left" type="monotone" dataKey="secondary" name="Тестовый балл" stroke="var(--color-mark-green)" strokeWidth={2.5} dot={{ r: 3.5, fill: "var(--color-mark-green)", strokeWidth: 0 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rise rise-4 card mt-4 p-5">
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
  const { attempts, mistakes, unlocked, probBest, nightOwl, streak, topicStats } = useApp();
  const best = attempts.length ? Math.max(...attempts.map((a) => a.secondary)) : 0;
  const snapshot: AchieveSnapshot = {
    attempts: attempts.length, best, streak: streak.days,
    resolvedMistakes: mistakes.filter((m) => m.resolved).length, probBest, nightOwl,
    solvedTasks: Object.values(topicStats).reduce((s, t) => s + t.solved, 0),
    probSolved: (topicStats[4]?.solved ?? 0) + (topicStats[5]?.solved ?? 0),
    perfectVariants: attempts.filter((a) => a.mistakes === 0 && a.secondary > 0).length,
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
            <div key={p.nick} className="flex w-24 flex-col items-center sm:w-28">
              {medals[i]}
              <div className="mt-2"><Avatar name={p.name} className="h-12 w-12 text-[13px]" /></div>
              <p className="mt-1.5 max-w-full truncate text-[12px] font-bold text-chalk-50">{p.name}</p>
              <p className="font-mono text-[10px] text-chalk-500">@{p.nick}</p>
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
              <Avatar name={p.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-chalk-50">{p.name} <span className="font-mono text-[10.5px] font-semibold text-chalk-500">@{p.nick}</span></p>
                <p className="text-[10.5px] text-chalk-500">{p.city} · {p.streak} дн. серия</p>
              </div>
              <span className={`flex items-center gap-0.5 text-[11px] font-bold tabular-nums ${p.delta > 0 ? "text-mark-green" : p.delta < 0 ? "text-mark-red" : "text-chalk-600"}`}>
                {p.delta > 0 ? <TrendingUp className="h-3 w-3" /> : p.delta < 0 ? <TrendingDown className="h-3 w-3" /> : "—"}{p.delta !== 0 && Math.abs(p.delta)}
              </span>
              <span className="font-display text-[16px] font-bold tabular-nums text-chalk-50">{p.score}</span>
            </li>
          ))}
        </ul>
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
  const { mistakes, toggleResolved, go } = useApp();
  const unresolved = mistakes.filter((g) => !g.resolved).length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-5">
      <p className="rise tick text-mark-red">Работа над ошибками</p>
      <h1 className="rise rise-1 mt-2 font-display text-3xl font-bold tracking-tight text-chalk-50 sm:text-4xl">Журнал ошибок</h1>
      <p className="rise rise-2 mt-2 text-sm text-chalk-400">
        {mistakes.length === 0 ? "Чисто — ошибок пока нет." : `Неразобранных: ${unresolved}. Разбор ошибок даёт +6 баллов за месяц.`}
      </p>

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
      source: t.source ? String(t.source) : undefined,
      createdAt: new Date().toISOString(),
    });
  });
  return { ok, errors };
}

export function AdminPage() {
  const { user, taskBank, addTask, removeTask, importTasks, pushToast, publishedVariants, unpublishVariant, runPublishedVariant } = useApp();
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem("komi-admin") === "1");
  const [tab, setTab] = useState<"bank" | "import" | "variants" | "students">("bank");
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
    addTask({
      exam_type: form.exam_type,
      task_number: form.task_number,
      topic: form.topic.trim() || BANK.find((b) => b.number === form.task_number)?.topic || "Без темы",
      condition_text: form.condition_text.trim(),
      solution_text: form.solution_text.trim() || undefined,
      correct_answer: form.is_second_part ? null : form.correct_answer.trim(),
      is_second_part: form.is_second_part,
      difficulty_level: form.difficulty_level,
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

  const students = [
    { name: "Анна Морозова", nick: "anna_mz", city: "Ухта", last: 96, attempts: 14, streak: 12 },
    { name: "Дмитрий Логачёв", nick: "dima_lg", city: "Сыктывкар", last: 79, attempts: 11, streak: 8 },
    { name: "Мария Виткова", nick: "masha_vk", city: "Печора", last: 68, attempts: 9, streak: 5 },
  ];

  const field = "w-full rounded-lg border border-board-600/70 bg-board-950/50 px-3 py-2 text-[13px] text-chalk-50 outline-none transition-all placeholder:text-chalk-600 focus:border-mark-yellow";
  const label = "mb-1 block text-[10.5px] font-bold uppercase tracking-wider text-chalk-500";

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-5">
      <p className="rise tick text-mark-yellow">Кабинет преподавателя</p>
      <h1 className="rise rise-1 mt-2 font-display text-3xl font-bold tracking-tight text-chalk-50 sm:text-4xl">{user?.name ?? "Администратор"}</h1>

      <div className="rise rise-2 mt-6 flex flex-wrap gap-1.5">
        {([["bank", "Банк задач"], ["import", "Импорт JSON"], ["variants", "Варианты"], ["students", "Ученики"]] as ["bank" | "import" | "variants" | "students", string][]).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`rounded-full px-4 py-2 text-[12.5px] font-bold transition-all active:scale-95 ${tab === k ? "bg-mark-yellow text-board-950 shadow-lg shadow-mark-yellow/20" : "card text-chalk-300 hover:text-chalk-50"}`}>
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
                <div><label className={label}>Решение / критерии</label>
                  <textarea value={form.solution_text} onChange={(e) => setForm({ ...form, solution_text: e.target.value })} rows={3} placeholder="$x+3=16 \Rightarrow x=13$" className={field} /></div>
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
                  {form.solution_text && (
                    <p className="mt-3 border-t border-board-700/60 pt-2 text-[12.5px] leading-relaxed text-chalk-400"><LatexText text={form.solution_text} /></p>
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
                  <p className="text-[12px] font-bold text-chalk-50">{t.topic} · часть {t.is_second_part ? 2 : 1} · сложность {t.difficulty_level}</p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-chalk-300"><LatexText text={t.condition_text} /></p>
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
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="card p-5">
            <h2 className="flex items-center gap-2 font-display text-sm font-bold text-chalk-50"><Link2 className="h-4 w-4 text-mark-yellow" />Коды приглашений</h2>
            <ul className="mt-3 space-y-2.5">
              {[{ code: "KOMI-2026", label: "Основной набор", used: 14 }, { code: "PROBNIK-7", label: "Пробник №7", used: 6 }].map((c) => (
                <li key={c.code} className="flex items-center gap-3 rounded-lg border border-board-600/40 bg-board-950/40 px-3 py-2.5">
                  <span className="font-mono text-[13px] font-bold tracking-wider text-mark-yellow">{c.code}</span>
                  <span className="min-w-0 flex-1 truncate text-[11px] text-chalk-500">{c.label} · {c.used} учеников</span>
                  <button onClick={() => { navigator.clipboard?.writeText(`${location.origin}${location.pathname}?invite=${c.code}`); pushToast(`Ссылка ${c.code} скопирована`); }}
                    className="btn-ghost px-2.5 py-1.5 text-[11px]"><Copy className="h-3 w-3" />Ссылка</button>
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-5">
            <h2 className="flex items-center gap-2 font-display text-sm font-bold text-chalk-50"><Users className="h-4 w-4 text-mark-green" />Мои ученики</h2>
            <ul className="mt-3 divide-y divide-board-700/60">
              {students.map((s) => (
                <li key={s.nick} className="card-hover flex items-center gap-3 py-3">
                  <Avatar name={s.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-chalk-50">{s.name} <span className="font-mono text-[10.5px] text-chalk-500">@{s.nick}</span></p>
                    <p className="text-[10.5px] text-chalk-500">{s.city} · {s.attempts} попыток</p>
                  </div>
                  <span className="flex items-center gap-1 text-[11.5px] font-bold tabular-nums text-mark-red"><Flame className="h-3.5 w-3.5" />{s.streak}</span>
                  <span className="rounded-lg bg-mark-yellow/12 px-2.5 py-1 font-display text-[14px] font-bold tabular-nums text-mark-yellow">{s.last}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex items-center gap-2 text-[11px] text-chalk-500"><Sparkles className="h-3.5 w-3.5 text-mark-yellow" />В демо — тестовые ученики. С бэкендом здесь реальная статистика и telegram_id.</p>
          </div>
        </div>
      )}
    </div>
  );
}
