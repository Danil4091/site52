/* ══════════════════════════════════════════════════════════════════
   Данные для кабинета преподавателя.
   В локальном режиме статистика учеников читается напрямую из
   localStorage (ключи скоупированы по нику), поэтому преподаватель
   видит РЕАЛЬНУЮ активность учеников, зарегистрированных на этом
   устройстве по его коду. В продакшене те же поля придут из БД.
   ══════════════════════════════════════════════════════════════════ */
import type { AttemptRecord } from "./data";
import type { TopicStat } from "./store";
import { ADMIN_TEACHER_CODE } from "./config";

/** Одна запись активности ученика (что решал и когда). */
export interface ActivityEntry {
  ts: number;
  kind: "task" | "variant";
  taskNumber?: number;
  topic?: string;
  correct?: boolean;
  label?: string;
  score?: number;
}

export interface StreakLike { days: number; best: number; last: string; xp: number; freezes: number; }

export interface StudentStats {
  nick: string;
  attempts: AttemptRecord[];
  topics: Record<number, TopicStat>;
  streak: StreakLike;
  activity: ActivityEntry[];
  solvedCount: number;
  bestScore: number;
  avgScore: number;
  lastActive: number | null;
  registeredAt: number;
}

const scoped = (base: string, nick: string) => `${base}@${nick}`;
function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

/** Собрать полную статистику ученика по его нику. */
export function readStudentStats(nick: string): StudentStats {
  const attempts = readLS<AttemptRecord[]>(scoped("komi-attempts", nick), []);
  const topics = readLS<Record<number, TopicStat>>(scoped("komi-topics", nick), {});
  const streak = readLS<StreakLike>(scoped("komi-streak", nick), { days: 0, best: 0, last: "", xp: 0, freezes: 0 });
  const activity = readLS<ActivityEntry[]>(scoped("komi-activity", nick), []);
  const solvedCount = Object.values(topics).reduce((s, t) => s + (t.solved || 0), 0);
  const scores = attempts.map((a) => a.secondary);
  const bestScore = scores.length ? Math.max(...scores) : 0;
  const avgScore = scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0;
  const lastActive = activity.length
    ? Math.max(...activity.map((a) => a.ts))
    : attempts.length ? Math.max(...attempts.map((a) => a.ts ?? 0)) : null;
  return { nick, attempts, topics, streak, activity, solvedCount, bestScore, avgScore, lastActive, registeredAt: 0 };
}

/** Ники всех пользователей, привязанных к данному коду преподавателя. */
export function linkedStudentNicks(teacherCode: string): { nick: string; goal?: number; registeredAt: number }[] {
  const users = readLS<{ nickname: string; role: string; teacherCode?: string; goal?: number; registeredAt?: number }[]>("komi-users-v1", []);
  const code = (teacherCode || "").toUpperCase();
  if (!code) return [];
  return users
    .filter((u) => u.role === "student" && (u.teacherCode || "").toUpperCase() === code)
    .map((u) => ({ nick: u.nickname, goal: u.goal, registeredAt: u.registeredAt ?? 0 }));
}

/* ─────────────────── демо-ученики (локальный режим) ───────────────────
   Чтобы кабинет преподавателя не был пустым до появления реальных
   учеников, при первом входе преподавателя создаются 3 демо-ученика
   с правдоподобной историей. Помечены флагом isDemo. */

const DEMO_FLAG = "komi-demo-students-v1";
const DAY = 86_400_000;

interface DemoDef { nick: string; goal: number; base: number; growth: number; attempts: number; }
const DEMO_DEFS: DemoDef[] = [
  { nick: "masha_vk", goal: 90, base: 62, growth: 4.2, attempts: 8 },
  { nick: "dima_lg", goal: 80, base: 55, growth: 2.6, attempts: 6 },
  { nick: "polina_vork", goal: 70, base: 48, growth: 1.8, attempts: 5 },
];
const VARIANT_LABELS = ["Резервный 2022", "Основной 2023", "Досрочный 2023 · ДВ", "Основной 2024", "Пробник №7"];

/** Детерминированный ГПСЧ, чтобы демо-данные были стабильными. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function ensureDemoStudents(): void {
  try {
    if (localStorage.getItem(DEMO_FLAG)) return;
    const users = readLS<Record<string, unknown>[]>("komi-users-v1", []);
    const now = Date.now();

    DEMO_DEFS.forEach((def, di) => {
      const rnd = mulberry32(1000 + di * 77);
      const registeredAt = now - (30 - di * 6) * DAY;

      /* аккаунт, привязанный к коду преподавателя */
      if (!users.some((u) => u.nickname === def.nick)) {
        users.push({
          nickname: def.nick, role: "student", password: "demo-" + def.nick,
          goal: def.goal, teacherCode: ADMIN_TEACHER_CODE, teacherName: "Артём",
          referredBy: undefined, consentVersion: "1.0", consentAt: new Date(registeredAt).toISOString(),
          registeredAt, isDemo: true,
        });
      }

      /* попытки варианта с ростом балла */
      const attempts: AttemptRecord[] = [];
      const activity: ActivityEntry[] = [];
      for (let i = 0; i < def.attempts; i++) {
        const ts = now - (def.attempts - i) * 3.2 * DAY - rnd() * DAY;
        const secondary = Math.min(98, Math.round(def.base + def.growth * i + (rnd() - 0.4) * 6));
        const mistakes = Math.max(0, 3 - Math.floor(i / 2) - (rnd() > 0.6 ? 1 : 0));
        const label = VARIANT_LABELS[i % VARIANT_LABELS.length];
        attempts.push({ id: `demo-${def.nick}-${i}`, variantId: "v-real-2023", label, secondary, mistakes, date: new Date(ts).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }), ts });
        activity.push({ ts, kind: "variant", label, score: secondary, correct: mistakes === 0 });
      }

      /* статистика по темам */
      const topics: Record<number, TopicStat> = {};
      for (let n = 1; n <= 12; n++) {
        const att = 4 + Math.floor(rnd() * 8);
        const ratio = Math.min(0.95, Math.max(0.2, def.base / 100 + (rnd() - 0.45) * 0.3));
        topics[n] = { solved: Math.round(att * ratio), attempts: att };
      }

      /* последние решённые задачи */
      const recentTopics = [4, 5, 6, 8, 10, 11];
      for (let i = 0; i < 6; i++) {
        const tn = recentTopics[i % recentTopics.length];
        activity.push({ ts: now - i * 0.4 * DAY - rnd() * 3600_000, kind: "task", taskNumber: tn, topic: topicName(tn), correct: rnd() > 0.35 });
      }
      activity.sort((a, b) => b.ts - a.ts);

      const solvedCount = Object.values(topics).reduce((s, t) => s + t.solved, 0);
      const streak: StreakLike = { days: 2 + di * 3, best: 5 + di * 4, last: new Date(now - (di === 1 ? DAY : 0)).toISOString().slice(0, 10), xp: 300 + di * 250, freezes: di === 0 ? 1 : 0 };

      localStorage.setItem(scoped("komi-attempts", def.nick), JSON.stringify(attempts));
      localStorage.setItem(scoped("komi-topics", def.nick), JSON.stringify(topics));
      localStorage.setItem(scoped("komi-streak", def.nick), JSON.stringify(streak));
      localStorage.setItem(scoped("komi-activity", def.nick), JSON.stringify(activity));
      localStorage.setItem(scoped("komi-solvedtasks", def.nick), JSON.stringify([]));
      void solvedCount;
    });

    localStorage.setItem("komi-users-v1", JSON.stringify(users));
    localStorage.setItem(DEMO_FLAG, "1");
  } catch { /* приватный режим — ок */ }
}

function topicName(n: number): string {
  const map: Record<number, string> = { 1: "Планиметрия", 2: "Векторы", 3: "Стереометрия", 4: "Простая вероятность", 5: "Сложная вероятность", 6: "Уравнения", 7: "Вычисления", 8: "Производная", 9: "Прикладные задачи", 10: "Текстовые задачи", 11: "Графики функций", 12: "Исследование функций" };
  return map[n] ?? `№${n}`;
}

/** Человекочитаемое «сколько времени назад». */
export function timeAgo(ts: number | null): string {
  if (!ts) return "ещё не было активности";
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "только что";
  if (min < 60) return `${min} мин назад`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} дн назад`;
  return new Date(ts).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}
