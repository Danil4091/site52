import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { BookOpenCheck, ClipboardList, Crown, Flame, GraduationCap, Target, TrendingUp, Users } from "lucide-react";
import type { AttemptRecord } from "./data";
import type { TopicStat } from "./store";
import { Avatar } from "./ui";
import { fetchAdminStudents, hasServerAuth, isApiEnabled } from "./api";

/* ══════════════════════════════════════════════════════════════════
   Статистика всего сайта — панель создателя платформы.
   Демо-режим: агрегация по всем локальным аккаунтам (komi-users-v1
   и скоупированные данные каждого ученика). В боевом режиме этот
   блок заменяется одним запросом GET /api/admin/site-stats.
   ══════════════════════════════════════════════════════════════════ */

interface LocalUser {
  nickname: string;
  role: string;
  goal?: number;
  teacherCode?: string;
  registeredAt?: number;
  isDemo?: boolean;
}

function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

interface SiteData {
  students: LocalUser[];
  teachers: LocalUser[];
  totalAttempts: number;
  avgScore: number;          // средний балл по всем решённым вариантам
  avgBest: number;           // средний лучший результат ученика
  totalSolved: number;       // суммарно решённых задач (часть 1)
  activeWeek: number;        // учеников с активностью за 7 дней
  buckets: { label: string; count: number }[];
  activity: { day: string; count: number }[];
  errorTopics: { topic: string; count: number }[];
  topStudents: { nick: string; best: number; attempts: number; goal?: number }[];
}

/** Ученик из БД (GET /api/admin/students). */
interface DbStudent {
  id: string; nickname: string; full_name: string | null; goal: number | null;
  streak_days: number; xp: number; created_at: string | null;
  attempts: number; avg_score: number | null; best_score: number | null; solved: number;
}

function collect(dbStudents: DbStudent[] = []): SiteData {
  const users = readLS<LocalUser[]>("komi-users-v1", []);
  const localStudents = users.filter((u) => u.role === "student");
  const teachers = users.filter((u) => u.role === "teacher");
  const dbMap = new Map(dbStudents.map((s) => [s.nickname, s]));

  /* Объединяем локальных (демо) и серверных (БД) учеников по нику без дублей,
     чтобы реально зарегистрированные пользователи отображались в статистике. */
  const seen = new Set<string>();
  const students: LocalUser[] = [];
  for (const s of localStudents) {
    if (!seen.has(s.nickname)) { seen.add(s.nickname); students.push(s); }
  }
  for (const s of dbStudents) {
    if (!seen.has(s.nickname)) {
      seen.add(s.nickname);
      students.push({
        nickname: s.nickname, role: "student", goal: s.goal ?? undefined,
        registeredAt: s.created_at ? new Date(s.created_at).getTime() : undefined,
      });
    }
  }

  let totalAttempts = 0;
  let sumSecondary = 0;
  let sumBest = 0;
  let bestCount = 0;
  let totalSolved = 0;
  let activeWeek = 0;
  const weekAgo = Date.now() - 7 * 86_400_000;
  const bucketDefs = [
    { label: "<40", min: 0, max: 39 },
    { label: "40–54", min: 40, max: 54 },
    { label: "55–69", min: 55, max: 69 },
    { label: "70–79", min: 70, max: 79 },
    { label: "80–89", min: 80, max: 89 },
    { label: "90+", min: 90, max: 100 },
  ];
  const buckets = bucketDefs.map((b) => ({ label: b.label, count: 0 }));

  /* активность за последние 14 дней */
  const days: { day: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    days.push({ day: `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}`, count: 0 });
  }
  const dayKey = (ts: number) => {
    const d = new Date(ts);
    return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  const errorMap = new Map<string, number>();
  const top: SiteData["topStudents"] = [];

  for (const s of students) {
    const db = dbMap.get(s.nickname);
    if (db) {
      /* Серверный ученик: статистика из БД. */
      totalAttempts += db.attempts;
      if (db.attempts > 0) {
        sumSecondary += (db.avg_score ?? 0) * db.attempts;
        const best = db.best_score ?? 0;
        sumBest += best;
        bestCount++;
        const idx = bucketDefs.findIndex((b) => best >= b.min && best <= b.max);
        if (idx >= 0) buckets[idx].count++;
        top.push({ nick: s.nickname, best, attempts: db.attempts, goal: s.goal });
      }
      totalSolved += db.solved;
      continue;
    }
    /* Локальный (демо) ученик: статистика из localStorage. */
    const attempts = readLS<AttemptRecord[]>(`komi-attempts-v1@${s.nickname}`, []);
    totalAttempts += attempts.length;
    let best = 0;
    let weekActive = false;
    for (const a of attempts) {
      sumSecondary += a.secondary;
      best = Math.max(best, a.secondary);
      const ts = a.ts;
      if (ts !== undefined) {
        if (ts >= weekAgo) weekActive = true;
        const slot = days.find((d) => d.day === dayKey(ts));
        if (slot) slot.count++;
      }
    }
    if (attempts.length > 0) {
      sumBest += best;
      bestCount++;
      const idx = bucketDefs.findIndex((b) => best >= b.min && best <= b.max);
      if (idx >= 0) buckets[idx].count++;
      top.push({ nick: s.nickname, best, attempts: attempts.length, goal: s.goal });
    }
    if (weekActive) activeWeek++;

    const topics = readLS<Record<number, TopicStat>>(`komi-topic-stats-v1@${s.nickname}`, {});
    for (const t of Object.values(topics)) totalSolved += t.solved;

    const mistakes = readLS<{ topic: string; occurrences: unknown[] }[]>(`komi-mistakes-v1@${s.nickname}`, []);
    for (const m of mistakes) {
      if (m && m.topic) errorMap.set(m.topic, (errorMap.get(m.topic) ?? 0) + (m.occurrences?.length ?? 1));
    }
  }

  top.sort((a, b) => b.best - a.best);

  return {
    students,
    teachers,
    totalAttempts,
    avgScore: totalAttempts ? Math.round(sumSecondary / totalAttempts) : 0,
    avgBest: bestCount ? Math.round(sumBest / bestCount) : 0,
    totalSolved,
    activeWeek,
    buckets,
    activity: days,
    errorTopics: [...errorMap.entries()].map(([topic, count]) => ({ topic, count })).sort((a, b) => b.count - a.count).slice(0, 6),
    topStudents: top.slice(0, 5),
  };
}

/* плавный счётчик чисел (уважает reduced-motion) */
function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);
  return value;
}

function Kpi({ icon: Icon, label, value, suffix, accent, delay }: {
  icon: typeof Users; label: string; value: number; suffix?: string; accent: string; delay: number;
}) {
  const n = useCountUp(value);
  return (
    <div className={`card card-hover rise rise-${delay} p-4`} style={{ animationDelay: `${delay * 60}ms` }}>
      <div className="flex items-center justify-between">
        <p className="text-[10.5px] font-bold uppercase tracking-wider text-chalk-500">{label}</p>
        <Icon className={`h-4 w-4 ${accent}`} />
      </div>
      <p className={`mt-2 font-display text-3xl font-bold tabular-nums leading-none ${accent}`}>
        {n}
        {suffix && <span className="ml-1 text-sm font-semibold text-chalk-500">{suffix}</span>}
      </p>
    </div>
  );
}

export default function SiteStatsPanel() {
  const [dbStudents, setDbStudents] = useState<DbStudent[]>([]);
  /* Серверный режим: подгружаем реально зарегистрированных учеников из БД,
     чтобы статистика сайта отражала базу, а не только локальную демо-копию. */
  useEffect(() => {
    let alive = true;
    if (isApiEnabled() && hasServerAuth()) {
      fetchAdminStudents()
        .then((r) => { if (alive) setDbStudents(r.students); })
        .catch(() => { /* офлайн — остаётся локальная статистика */ });
    }
    return () => { alive = false; };
  }, []);
  const data = useMemo(() => collect(dbStudents), [dbStudents]);
  const maxError = data.errorTopics[0]?.count ?? 1;

  return (
    <div>
      {/* заголовок панели создателя */}
      <div className="rise flex flex-wrap items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-mark-yellow/15 text-mark-yellow">
          <Crown className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-bold tracking-tight text-chalk-50 sm:text-2xl">Статистика всего сайта</h2>
          <p className="text-[12px] text-chalk-500">Панель создателя платформы · демо-режим агрегирует локальные аккаунты, в бою — один запрос к API</p>
        </div>
        <span className="chip !border-mark-green/50 !text-mark-green">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mark-green opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-mark-green" />
          </span>
          данные актуальны
        </span>
      </div>

      {/* KPI */}
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={Users} label="Учеников" value={data.students.length} accent="text-mark-yellow" delay={1} />
        <Kpi icon={GraduationCap} label="Преподавателей" value={data.teachers.length} accent="text-mark-blue" delay={2} />
        <Kpi icon={ClipboardList} label="Решено вариантов" value={data.totalAttempts} accent="text-mark-green" delay={3} />
        <Kpi icon={Target} label="Средний балл" value={data.avgScore} accent="text-mark-yellow" delay={4} />
        <Kpi icon={BookOpenCheck} label="Решено задач" value={data.totalSolved} accent="text-mark-green" delay={5} />
        <Kpi icon={Flame} label="Активны за неделю" value={data.activeWeek} accent="text-mark-red" delay={5} />
      </div>

      {/* графики */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* распределение баллов */}
        <div className="card rise rise-3 p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-display text-sm font-bold text-chalk-50">Распределение лучших баллов</h3>
            <p className="text-[11px] font-semibold text-chalk-500">ср. лучший: <b className="text-mark-yellow">{data.avgBest}</b></p>
          </div>
          <div className="mt-3 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.buckets} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-board-700)" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--color-board-700)" }} tick={{ fontSize: 10.5, fill: "var(--color-chalk-500)" }} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 10.5, fill: "var(--color-chalk-500)" }} />
                <Tooltip
                  cursor={{ fill: "var(--color-board-800)" }}
                  contentStyle={{ backgroundColor: "var(--color-board-850)", border: "1px solid var(--color-board-600)", borderRadius: 10, fontSize: 12, color: "var(--color-chalk-200)" }}
                  formatter={(v: number) => [`${v} уч.`, "учеников"]}
                />
                <Bar dataKey="count" fill="var(--color-mark-yellow)" radius={[6, 6, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* активность за 14 дней */}
        <div className="card rise rise-4 p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-display text-sm font-bold text-chalk-50">Активность · 14 дней</h3>
            <p className="flex items-center gap-1 text-[11px] font-semibold text-chalk-500"><TrendingUp className="h-3.5 w-3.5 text-mark-green" />решений в день</p>
          </div>
          <div className="mt-3 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.activity} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="actFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-mark-green)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="var(--color-mark-green)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-board-700)" vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={{ stroke: "var(--color-board-700)" }} tick={{ fontSize: 9.5, fill: "var(--color-chalk-500)" }} interval={2} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 10.5, fill: "var(--color-chalk-500)" }} />
                <Tooltip
                  cursor={{ stroke: "var(--color-board-600)" }}
                  contentStyle={{ backgroundColor: "var(--color-board-850)", border: "1px solid var(--color-board-600)", borderRadius: 10, fontSize: 12, color: "var(--color-chalk-200)" }}
                  formatter={(v: number) => [`${v} реш.`, "активность"]}
                />
                <Area type="monotone" dataKey="count" stroke="var(--color-mark-green)" strokeWidth={2.2} fill="url(#actFill)" dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ошибки и топ учеников */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card rise rise-4 p-5">
          <h3 className="font-display text-sm font-bold text-chalk-50">Где сайт теряет баллы</h3>
          <p className="mt-0.5 text-[11px] text-chalk-500">топ тем по числу ошибок всех учеников</p>
          {data.errorTopics.length === 0 ? (
            <p className="mt-6 text-[12.5px] text-chalk-500">Ошибок пока нет — ученики только начали.</p>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {data.errorTopics.map((t, i) => (
                <li key={t.topic}>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="font-semibold text-chalk-200">{i + 1}. {t.topic}</span>
                    <span className="font-bold tabular-nums text-mark-red">×{t.count}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-board-800">
                    <div className="h-full rounded-full bg-gradient-to-r from-mark-red/60 to-mark-red transition-all duration-700" style={{ width: `${(t.count / maxError) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card rise rise-5 p-5">
          <h3 className="font-display text-sm font-bold text-chalk-50">Лучшие ученики</h3>
          <p className="mt-0.5 text-[11px] text-chalk-500">по лучшему баллу за вариант</p>
          {data.topStudents.length === 0 ? (
            <p className="mt-6 text-[12.5px] text-chalk-500">Пока никто не решил вариант.</p>
          ) : (
            <ul className="mt-3 space-y-1">
              {data.topStudents.map((s, i) => (
                <li key={s.nick} className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-board-800/50">
                  <span className={`w-6 text-center font-display text-[13px] font-bold ${i === 0 ? "text-mark-yellow" : i < 3 ? "text-chalk-300" : "text-chalk-500"}`}>{i + 1}</span>
                  <Avatar name={s.nick} className="h-8 w-8 text-[11px]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[12.5px] font-bold text-chalk-100">@{s.nick}</p>
                    <p className="text-[10.5px] text-chalk-500">{s.attempts} вар. · цель {s.goal ?? "—"}</p>
                  </div>
                  <span className="font-display text-lg font-bold tabular-nums text-mark-green">{s.best}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
