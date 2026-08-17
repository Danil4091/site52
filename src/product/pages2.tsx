import { useMemo, useState } from "react";
import {
  AlertCircle, AlertTriangle, Award, CalendarCheck, CheckCheck, Crown, Copy, Flame,
  KeyRound, Link2, Medal, Sparkles, Target, TrendingDown, TrendingUp, Users, Zap,
} from "lucide-react";
import {
  Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useApp } from "./store";
import { ACHIEVEMENTS, BANK, LEADER_SEED, type AchieveSnapshot } from "./data";
import { Avatar, ConfettiBurst } from "./ui";

/* ═══════════════════════ АНАЛИТИКА ═══════════════════════ */
export function AnalyticsPage() {
  const { attempts, topicStats, user } = useApp();
  const has = attempts.length > 0;
  const data = attempts.map((a, i) => ({ variant: `П${i + 1}`, secondary: a.secondary, mistakes: a.mistakes }));
  const latest = data[data.length - 1];
  const avg = has ? Math.round(attempts.reduce((s, a) => s + a.secondary, 0) / attempts.length) : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-5">
      <p className="rise text-[11px] font-bold uppercase tracking-[0.25em] text-mark-yellow">Личный кабинет</p>
      <h1 className="rise rise-1 mt-2 font-display text-3xl font-bold tracking-tight text-chalk-50 sm:text-4xl">
        Аналитика <span className="text-chalk-500">/</span> {user?.name ?? "Гость"}
      </h1>

      {!has ? (
        <div className="rise rise-2 mt-8 flex flex-col items-center rounded-xl border border-dashed border-board-600/70 bg-board-850/40 px-6 py-16 text-center">
          <Target className="h-10 w-10 text-chalk-500" />
          <p className="mt-4 font-display text-lg font-bold text-chalk-200">Здесь появится ваша статистика</p>
          <p className="mt-1 max-w-sm text-[13px] text-chalk-500">Решите первый вариант — график баллов, матрица тем и «зоны роста» построятся автоматически.</p>
        </div>
      ) : (
        <>
          <div className="rise rise-2 mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Текущий балл", value: latest.secondary, suffix: "/ 100" },
              { label: "Средний балл", value: avg, suffix: "/ 100" },
              { label: "Попыток", value: attempts.length, suffix: "" },
              { label: "Ошибок 0.1", value: data.slice(-3).reduce((s, d) => s + d.mistakes, 0), suffix: "за 3" },
            ].map((k) => (
              <div key={k.label} className="rounded-xl border border-board-600/50 bg-board-850/70 p-4 transition-all hover:-translate-y-0.5 hover:border-mark-yellow/40">
                <p className="text-[10.5px] font-bold uppercase tracking-wide text-chalk-500">{k.label}</p>
                <p className="mt-2 font-display text-3xl font-bold tabular-nums text-chalk-50">{k.value}<span className="ml-1 text-xs font-semibold text-chalk-500">{k.suffix}</span></p>
              </div>
            ))}
          </div>

          <div className="rise rise-3 mt-5 rounded-xl border border-board-600/50 bg-board-850/70 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-sm font-bold text-chalk-50">Динамика баллов и ошибок</h2>
                <p className="text-[11.5px] text-chalk-500">линия — тестовый балл (0–100), столбцы — «ошибки 0.1»</p>
              </div>
              <div className="flex items-center gap-4 text-[11px] font-semibold text-chalk-400">
                <span className="flex items-center gap-1.5"><span className="h-1 w-5 rounded-full bg-mark-green" /> балл</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-mark-red/70" /> ошибки</span>
              </div>
            </div>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(228,223,205,0.08)" vertical={false} />
                  <XAxis dataKey="variant" tickLine={false} axisLine={{ stroke: "rgba(228,223,205,0.15)" }} tick={{ fontSize: 11, fill: "#8ba194" }} />
                  <YAxis yAxisId="left" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} width={36} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#8ba194" }} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} width={28} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#8ba194" }} />
                  <Tooltip cursor={{ fill: "rgba(244,241,228,0.04)" }} contentStyle={{ backgroundColor: "#122b22", border: "1px solid rgba(228,223,205,0.15)", borderRadius: 12, fontSize: 12, color: "#e4dfcd" }} formatter={(value: number | string, name: string) => (name === "secondary" ? [`${value} баллов`, "Тестовый балл"] : [`${value}`, "Ошибки 0.1"])} />
                  <ReferenceLine yAxisId="left" y={70} stroke="rgba(228,223,205,0.3)" strokeDasharray="5 5" label={{ value: "порог вуза · 70", position: "insideBottomLeft", fill: "#8ba194", fontSize: 10.5 }} />
                  <Bar yAxisId="right" dataKey="mistakes" fill="rgba(255,139,106,0.7)" radius={[4, 4, 0, 0]} barSize={16} />
                  <Line yAxisId="left" type="monotone" dataKey="secondary" stroke="#a8d5a2" strokeWidth={2.5} dot={{ r: 3.5, fill: "#a8d5a2", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#f2c14e" }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* матрица тем */}
          <div className="rise rise-4 mt-5 rounded-xl border border-board-600/50 bg-board-850/70 p-5">
            <h2 className="font-display text-sm font-bold text-chalk-50">Матрица успеваемости · Часть 1</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {BANK.filter((t) => t.part === 1).map((t) => {
                const s = topicStats[t.number];
                const pct = s && s.attempts ? Math.round((s.solved / s.attempts) * 100) : null;
                const tone = pct === null ? "border-board-600/40" : pct > 80 ? "border-mark-green/35" : pct < 50 ? "border-mark-red/35" : "border-mark-yellow/30";
                const numTone = pct === null ? "bg-board-600" : pct > 80 ? "bg-mark-green/80" : pct < 50 ? "bg-mark-red/80" : "bg-mark-yellow/80";
                return (
                  <div key={t.number} className={`rounded-xl border bg-board-800/50 p-3 transition-all hover:-translate-y-0.5 ${tone}`}>
                    <div className="flex items-center gap-2">
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-board-950 ${numTone}`}>{t.number}</span>
                      <span className="truncate text-[11px] font-semibold text-chalk-300">{t.topic}</span>
                    </div>
                    <p className={`mt-2 font-display text-2xl font-bold tabular-nums ${pct === null ? "text-chalk-600" : pct > 80 ? "text-mark-green" : pct < 50 ? "text-mark-red" : "text-mark-yellow"}`}>
                      {pct === null ? "—" : `${pct}%`}
                    </p>
                    <p className="mt-0.5 text-[10px] font-medium text-chalk-500">{s && s.attempts ? `решено ${s.solved} из ${s.attempts}` : "ещё не решали"}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════ РЕЙТИНГ + АЧИВКИ ═══════════════════════ */
type BoardTab = "rating" | "achieve";

export function RatingPage() {
  const { unlocked, attempts, probBest, mistakes, nightOwl } = useApp();
  const [tab, setTab] = useState<BoardTab>("rating");

  const best = attempts.length ? Math.max(...attempts.map((a) => a.secondary)) : 0;
  const snapshot: AchieveSnapshot = {
    attempts: attempts.length, best, streak: 6,
    resolvedMistakes: mistakes.filter((m) => m.resolved).length, probBest, nightOwl,
  };

  const board = useMemo(() => {
    const players = LEADER_SEED.map((p) => ({ ...p, you: false }));
    const me = { id: 0, name: "Вы", nick: "you", city: "Сыктывкар", score: best, solved: 0, streak: 6, delta: 1, you: true };
    return [...players, me].sort((a, b) => b.score - a.score).map((p, i) => ({ ...p, rank: i + 1 }));
  }, [best]);

  const MEDALS = ["bg-mark-yellow text-board-950", "bg-chalk-300 text-board-950", "bg-mark-red text-board-950"];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-5">
      <p className="rise text-[11px] font-bold uppercase tracking-[0.25em] text-mark-yellow">Рейтинг учеников</p>
      <h1 className="rise rise-1 mt-2 font-display text-3xl font-bold tracking-tight text-chalk-50 sm:text-4xl">Лидерборд платформы</h1>
      <p className="rise rise-2 mt-2 text-sm text-chalk-400">В публичном рейтинге — только имя и ник, без фамилий.</p>

      <div className="rise rise-2 mt-6 flex w-fit gap-1 rounded-lg border border-board-600/70 bg-board-800/60 p-1">
        {([["rating", "Рейтинг"], ["achieve", "Достижения"]] as [BoardTab, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-[13px] font-bold transition-all ${tab === k ? "bg-mark-yellow text-board-950" : "text-chalk-400 hover:text-chalk-100"}`}>
            {k === "achieve" && <Award className="h-3.5 w-3.5" />}{l}
          </button>
        ))}
      </div>

      {tab === "rating" ? (
        <>
          {/* пьедестал */}
          <div className="rise rise-3 mt-6 grid grid-cols-3 items-end gap-3">
            {[1, 0, 2].map((seedIdx) => {
              const p = board[seedIdx];
              if (!p) return null;
              return (
                <div key={p.id} className={`relative rounded-xl border border-board-600/50 bg-board-850/70 px-3 pb-5 text-center transition-all hover:-translate-y-1 ${seedIdx === 0 ? "pt-10 ring-1 ring-mark-yellow/50" : seedIdx === 1 ? "pt-6" : "pt-8"}`}>
                  {seedIdx === 0 && <Crown className="absolute -top-3.5 left-1/2 h-6 w-6 -translate-x-1/2 text-mark-yellow" />}
                  <span className={`absolute left-1/2 top-3 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full text-[12px] font-bold tabular-nums ${MEDALS[seedIdx]}`}>{p.rank}</span>
                  <div className="mt-5 flex flex-col items-center">
                    <Avatar name={p.name} className={seedIdx === 0 ? "h-14 w-14 text-base" : "h-11 w-11 text-[12px]"} />
                    <p className="mt-2 truncate text-[12.5px] font-bold text-chalk-100">{p.name}</p>
                    <p className="font-mono text-[10px] text-chalk-500">@{p.nick} · {p.city}</p>
                    <p className="mt-1.5 font-display text-xl font-bold tabular-nums text-mark-yellow">{p.score}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rise rise-4 mt-5 overflow-hidden rounded-xl border border-board-600/50 bg-board-850/70">
            <ul className="divide-y divide-board-700/60">
              {board.slice(3).map((p) => (
                <li key={p.id} className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-board-800/50 ${p.you ? "bg-mark-yellow/5" : ""}`}>
                  <span className="w-8 text-center text-[13px] font-bold tabular-nums text-chalk-500">{p.rank}</span>
                  <Avatar name={p.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-chalk-100">
                      {p.name} <span className="font-mono text-[10.5px] font-semibold text-chalk-500">@{p.nick}</span>
                      {p.you && <span className="ml-1.5 rounded-full bg-mark-yellow px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-board-950">вы</span>}
                    </p>
                    <p className="text-[10.5px] text-chalk-500">{p.city}</p>
                  </div>
                  <span className={`flex w-10 items-center justify-center ${p.delta > 0 ? "text-mark-green" : p.delta < 0 ? "text-mark-red" : "text-chalk-600"}`}>
                    {p.delta > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : p.delta < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : "—"}
                  </span>
                  <span className="w-14 text-right font-display text-[15px] font-bold tabular-nums text-chalk-50">{p.score}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="rise rise-5 mt-4 text-center text-[11px] text-chalk-500">Рейтинг пересчитывается каждое воскресенье в 21:00 МСК · победитель получает бесплатный разбор варианта</p>
        </>
      ) : (
        <div className="rise rise-3 mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ACHIEVEMENTS.map((a) => {
            const at = unlocked[a.id];
            const prog = a.progress(snapshot);
            const Icon = a.icon;
            return (
              <div key={a.id} className={`relative overflow-hidden rounded-xl border p-4 transition-all hover:-translate-y-0.5 ${at !== undefined ? "border-mark-yellow/40 bg-board-850/80" : "border-board-600/50 bg-board-850/50"}`}>
                {at !== undefined && <span className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-mark-yellow/10" />}
                <div className="relative flex items-start gap-3">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${at !== undefined ? "bg-mark-yellow/15 text-mark-yellow" : "bg-board-700 text-chalk-500"}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className={`text-[13.5px] font-bold leading-tight ${at !== undefined ? "text-chalk-50" : "text-chalk-400"}`}>{a.title}</p>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-chalk-500">{a.desc}</p>
                  </div>
                </div>
                <div className="relative mt-3">
                  {at !== undefined ? (
                    <p className="text-[10.5px] font-bold uppercase tracking-wider text-mark-yellow">получено {new Date(at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between text-[10.5px] font-bold text-chalk-500">
                        <span>прогресс</span><span className="tabular-nums">{prog.cur}/{prog.goal}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-board-700">
                        <div className="h-full rounded-full bg-chalk-400" style={{ width: `${Math.min(100, (prog.cur / prog.goal) * 100)}%` }} />
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ ЖУРНАЛ ОШИБОК ═══════════════════════ */
export function MistakesPage() {
  const { mistakes, toggleResolved, go } = useApp();
  const [filter, setFilter] = useState<"open" | "done" | "all">("open");
  const resolved = mistakes.filter((g) => g.resolved).length;
  const openCount = mistakes.length - resolved;
  const list = mistakes.filter((g) => (filter === "all" ? true : filter === "done" ? g.resolved : !g.resolved))
    .sort((a, b) => b.occurrences.length - a.occurrences.length);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-5">
      <p className="rise text-[11px] font-bold uppercase tracking-[0.25em] text-mark-yellow">Работа над ошибками</p>
      <h1 className="rise rise-1 mt-2 font-display text-3xl font-bold tracking-tight text-chalk-50 sm:text-4xl">Журнал ошибок</h1>
      <p className="rise rise-2 mt-2 text-sm text-chalk-400">Каждая ошибка после варианта попадает сюда автоматически. Разбор ошибок — самый быстрый способ поднять балл.</p>

      <div className="rise rise-2 mt-5 flex flex-wrap items-center gap-2">
        {([["open", `Ждут разбора · ${openCount}`], ["done", `Разобранные · ${resolved}`], ["all", "Все"]] as ["open" | "done" | "all", string][]).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`rounded-full px-3.5 py-1.5 text-[12px] font-bold transition-all active:scale-95 ${filter === k ? "bg-mark-yellow text-board-950" : "border border-board-600/70 bg-board-800/60 text-chalk-400 hover:text-chalk-100"}`}>
            {l}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="rise rise-3 mt-6 flex flex-col items-center rounded-xl border border-dashed border-board-600/70 bg-board-850/40 px-6 py-14 text-center">
          <CheckCheck className="h-10 w-10 text-mark-green" />
          <p className="mt-4 font-display text-lg font-bold text-chalk-200">Журнал чист — хвостов нет!</p>
          <p className="mt-1 max-w-xs text-[12.5px] text-chalk-500">Ошибки из новых попыток будут появляться здесь автоматически.</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {list.map((g, i) => (
            <li key={g.number} className={`rounded-xl border bg-board-850/70 p-4 transition-all hover:-translate-y-0.5 ${g.resolved ? "border-mark-green/30 opacity-70" : "border-board-600/50"} rise rise-${Math.min(i + 2, 5)}`}>
              <div className="flex items-start gap-4">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[13px] font-bold text-board-950 ${g.occurrences.length >= 3 ? "bg-mark-red" : g.occurrences.length === 2 ? "bg-mark-yellow" : "bg-chalk-400"}`}>№{g.number}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`text-[14px] font-bold text-chalk-50 ${g.resolved ? "line-through decoration-mark-green/60" : ""}`}>{g.topic}</p>
                    <span className="rounded-full bg-board-700 px-2 py-0.5 text-[10.5px] font-bold tabular-nums text-chalk-300">{g.occurrences.length} раз(а)</span>
                    {g.resolved && <span className="flex items-center gap-1 rounded-full bg-mark-green/15 px-2 py-0.5 text-[10.5px] font-bold text-mark-green"><CheckCheck className="h-3 w-3" />разобрано</span>}
                  </div>
                  <ul className="mt-2 space-y-1">
                    {g.occurrences.slice(0, 3).map((o, j) => (
                      <li key={j} className="flex flex-wrap items-center gap-x-2 text-[11.5px] text-chalk-400">
                        <span className="font-semibold text-chalk-300">{o.variant}</span><span className="text-chalk-600">·</span>
                        <span>{o.date}</span><span className="text-chalk-600">·</span>
                        <span>ваш: <b className="font-mono text-mark-red">{o.given ?? "—"}</b></span>
                        <span>эталон: <b className="font-mono text-mark-green">{o.reference}</b></span>
                      </li>
                    ))}
                  </ul>
                </div>
                <button onClick={() => toggleResolved(g.number)}
                  className={`shrink-0 rounded-lg px-3 py-2 text-[11.5px] font-bold transition-all active:scale-95 ${g.resolved ? "border border-board-600/70 text-chalk-400 hover:text-chalk-100" : "bg-mark-green/20 text-mark-green hover:bg-mark-green/30"}`}>
                  {g.resolved ? "Вернуть" : "Разобрано"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {mistakes.length > 0 && (
        <div className="rise rise-4 mt-6 flex justify-center">
          <button onClick={() => go("variants")} className="rounded-xl bg-mark-yellow px-6 py-3 text-sm font-bold text-board-950 shadow-lg shadow-mark-yellow/20 transition-all hover:-translate-y-0.5 hover:brightness-110">
            Решить вариант заново
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ КАБИНЕТ ПРЕПОДАВАТЕЛЯ ═══════════════════════ */
export function AdminPage() {
  const { user, pushToast } = useApp();
  const [codes] = useState([
    { code: "KOMI-2026", label: "Основной набор · 2026", used: 14 },
    { code: "PROBNIK-7", label: "Пробник №7 · февраль", used: 6 },
  ]);

  if (user?.role !== "teacher") {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <KeyRound className="mx-auto h-10 w-10 text-chalk-500" />
        <p className="mt-4 font-display text-lg font-bold text-chalk-200">Кабинет доступен преподавателю</p>
        <p className="mt-1 text-[13px] text-chalk-500">Войдите как «Даниил · преподаватель» через окно входа.</p>
      </div>
    );
  }

  const students = [
    { name: "Анна Морозова", nick: "anna_mz", city: "Ухта", last: 96, attempts: 14, streak: 12 },
    { name: "Дмитрий Логачёв", nick: "dima_lg", city: "Сыктывкар", last: 79, attempts: 11, streak: 8 },
    { name: "Мария Виткова", nick: "masha_vk", city: "Печора", last: 68, attempts: 9, streak: 5 },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-5">
      <p className="rise text-[11px] font-bold uppercase tracking-[0.25em] text-mark-yellow">Кабинет преподавателя</p>
      <h1 className="rise rise-1 mt-2 font-display text-3xl font-bold tracking-tight text-chalk-50 sm:text-4xl">{user.name}</h1>
      <p className="rise rise-2 mt-2 text-sm text-chalk-400">Ученики, присоединившиеся по вашим кодам, и их реальная статистика.</p>

      <div className="rise rise-2 mt-6 grid gap-4 lg:grid-cols-2">
        {/* приглашения */}
        <div className="rounded-xl border border-board-600/50 bg-board-850/70 p-5">
          <h2 className="flex items-center gap-2 font-display text-sm font-bold text-chalk-50"><Link2 className="h-4 w-4 text-mark-yellow" />Коды приглашений</h2>
          <ul className="mt-3 space-y-2.5">
            {codes.map((c) => (
              <li key={c.code} className="flex items-center gap-3 rounded-lg border border-board-600/40 bg-board-800/50 px-3 py-2.5">
                <span className="font-mono text-[13px] font-bold tracking-wider text-mark-yellow">{c.code}</span>
                <span className="min-w-0 flex-1 truncate text-[11px] text-chalk-500">{c.label} · {c.used} учеников</span>
                <button onClick={() => { navigator.clipboard?.writeText(`${location.origin}${location.pathname}?invite=${c.code}`); pushToast(`Ссылка ${c.code} скопирована`); }}
                  className="flex items-center gap-1 rounded-md border border-board-600/70 px-2.5 py-1.5 text-[11px] font-bold text-chalk-300 transition-all hover:border-mark-green/50 hover:text-mark-green active:scale-95">
                  <Copy className="h-3 w-3" />Ссылка
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-chalk-500">Ученик открывает ссылку — код подставляется в регистрацию автоматически.</p>
        </div>

        {/* сводка */}
        <div className="rounded-xl border border-board-600/50 bg-board-850/70 p-5">
          <h2 className="flex items-center gap-2 font-display text-sm font-bold text-chalk-50"><Users className="h-4 w-4 text-mark-green" />Сводка</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {[["Учеников", students.length], ["Средний балл", 81], ["Активны сегодня", 2], ["Цель 80+ достигли", 1]].map(([l, v]) => (
              <div key={String(l)} className="rounded-lg border border-board-600/40 bg-board-800/50 px-3 py-3">
                <p className="font-display text-2xl font-bold tabular-nums text-chalk-50">{v}</p>
                <p className="text-[10px] font-medium uppercase tracking-wide text-chalk-500">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ученики */}
      <div className="rise rise-3 mt-5 overflow-hidden rounded-xl border border-board-600/50 bg-board-850/70">
        <div className="border-b border-board-700/60 px-5 py-3.5">
          <h2 className="font-display text-sm font-bold text-chalk-50">Мои ученики</h2>
        </div>
        <ul className="divide-y divide-board-700/60">
          {students.map((s) => (
            <li key={s.nick} className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors hover:bg-board-800/50">
              <Avatar name={s.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-bold text-chalk-50">{s.name} <span className="font-mono text-[11px] font-semibold text-chalk-500">@{s.nick}</span></p>
                <p className="text-[11px] text-chalk-500">{s.city} · {s.attempts} попыток</p>
              </div>
              <span className="flex items-center gap-1 text-[11.5px] font-bold tabular-nums text-mark-red"><Flame className="h-3.5 w-3.5" />{s.streak} дн.</span>
              <span className="rounded-lg bg-mark-yellow/15 px-2.5 py-1 font-display text-[15px] font-bold tabular-nums text-mark-yellow">{s.last}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="rise rise-4 mt-5 flex items-center gap-2 text-[11.5px] text-chalk-500">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-mark-yellow" />
        В демо-режиме показаны тестовые ученики. После подключения бэкенда здесь появится реальная статистика из базы.
      </p>
    </div>
  );
}

export { ConfettiBurst, Medal, CalendarCheck, Zap, AlertCircle, AlertTriangle };
