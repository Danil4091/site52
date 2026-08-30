import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  ACHIEVEMENTS, INITIAL_ATTEMPTS, REAL_ANSWER_KEY, REAL_VARIANT, SCALE,
  answersMatch, seedMistakes, todayShort,
  type AttemptRecord, type MistakeGroup,
} from "./data";
import {
  makeLinkCode, resolveTeacher,
  type ParsedVariant, type PublishedVariant,
} from "./variantSchema";
import { getForStudent, getAssignment, setStatus } from "./assignments";
import { hasServerAuth, isApiEnabled, submitAttemptApi } from "./api";

export interface ProductUser {
  /** Ник — единственный публичный идентификатор (виден в рейтинге). */
  nickname: string;
  role: "student" | "teacher";
  /** ID пользователя на сервере (UUID) — для запросов профиля/аналитики. */
  serverId?: string;
  /** Имя и e-mail — опциональны, не показываются публично. */
  name?: string;
  email?: string;
  grade?: string; goal?: number; weakTopic?: string;
  teacherCode?: string; teacherName?: string;
  /** ID преподавателя, к которому привязан ученик (для проверки 2-й части). */
  teacherId?: string;
  consentVersion?: string; consentAt?: string;
  /** Для будущего Telegram-бота: напоминания о стриках, мини-тесты. */
  telegram_id?: string;
  /** Ник друга, по чьей ссылке зарегистрировался (реферальная система). */
  referredBy?: string;
}

/* ── реферальная система: коды и общий журнал приглашений ── */
export const makeInviteCode = (nick: string) =>
  `KOMI-${nick.replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase()}`;

const REFLOG_KEY = "komi-reflog-v1";
export const FREEZE_COST = 100; // XP за одну «заморозку» серии
export function logReferral(code: string, nick: string) {
  try {
    const log = JSON.parse(localStorage.getItem(REFLOG_KEY) ?? "[]") as { code: string; nick: string; ts: number }[];
    log.push({ code, nick, ts: Date.now() });
    localStorage.setItem(REFLOG_KEY, JSON.stringify(log));
  } catch { /* ок */ }
}
export function readReferrals(code: string): string[] {
  try {
    const log = JSON.parse(localStorage.getItem(REFLOG_KEY) ?? "[]") as { code: string; nick: string }[];
    return log.filter((e) => e.code === code).map((e) => e.nick);
  } catch { return []; }
}

export type Route =
  | "home" | "bank" | "variants" | "probability" | "run" | "results"
  | "analytics" | "admin" | "rating" | "mistakes" | "achieve" | "trainer"
  | "variant-run" | "marathon" | "assignment-run" | "profile" | "materials" | "skills";

export interface TopicStat { solved: number; attempts: number; }
export interface NotifItem { id: number; type: "achievement" | "lesson" | "feed" | "system" | "homework"; title: string; body: string; time: string; read: boolean; assignmentId?: string; }
export interface Toast { id: number; msg: string; }

/* Задача банка — формат совпадает с API и JSON-импортом. */
export interface CustomTask {
  id: string;
  exam_type: "ege" | "oge";
  task_number: number;
  topic: string;
  condition_text: string;
  solution_text?: string;
  correct_answer?: string | null;
  is_second_part: boolean;
  difficulty_level: number;
  /** Критерии оценивания ФИПИ (часть 2, разбалловка 1/2/3). */
  criteria?: string;
  /** Чертёж/график: https://… или data-URL image/… */
  image_url?: string;
  source?: string;
  createdAt: string;
}

const scoped = (key: string, scope: string) => `${key}@${scope}`;
const dayIso = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const yesterdayIso = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayIso(d); };

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}
/** Читает массив; при повреждённых/устаревших данных возвращает []. */
function readArr<T>(key: string): T[] {
  const v = read<unknown>(key, []);
  return Array.isArray(v) ? (v as T[]) : [];
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ок */ }
}

export function loadSession(): ProductUser | null {
  const u = read<ProductUser | null>("komi-session-v1", null);
  /* старая/битая сессия без ника — сбрасываем, чтобы не было «@undefined» */
  if (u && typeof u.nickname !== "string") return null;
  return u;
}
export function saveSession(user: ProductUser | null) {
  try {
    if (user) localStorage.setItem("komi-session-v1", JSON.stringify(user));
    else localStorage.removeItem("komi-session-v1");
  } catch { /* ок */ }
}

interface StreakState { days: number; best: number; last: string; xp: number; freezes: number; }

interface AppState {
  user: ProductUser | null;
  scope: string;
  route: Route;
  attempts: AttemptRecord[];
  mistakes: MistakeGroup[];
  unlocked: Record<string, number>;
  topicStats: Record<number, TopicStat>;
  notifs: NotifItem[];
  toasts: Toast[];
  burst: number;
  variantId: string;
  lastResult: ExamResult | null;
  nightOwl: boolean;
  probBest: number;

  /* геймификация и удержание */
  streak: StreakState;
  todaySolved: boolean;
  taskBank: CustomTask[];

  /* тренажёр темы: очередь + решённые задачи (персист, дедуп на бэке/фронте) */
  trainerTopic: number | null;
  solvedTaskIds: string[];
  openTrainer: (n: number) => void;
  markTaskSolved: (taskId: string, taskNumber: number) => void;
  celebrate: () => void;

  /* авторские варианты: публикация, ссылки, запуск */
  publishedVariants: PublishedVariant[];
  activeVariant: PublishedVariant | null;
  publishVariant: (v: ParsedVariant) => PublishedVariant;
  unpublishVariant: (id: string) => void;
  runPublishedVariant: (code: string) => boolean;
  attachTeacher: (code: string) => { ok: boolean; teacherName?: string };
  recordPublishedAttempt: (label: string, primary: number, secondary: number, mistakes: number) => void;

  /* марафон, рефералы, теги ошибок */
  marathonCount: number;
  marathonBest: number;
  referrals: string[];
  tagsAssigned: number;
  tagStats: Record<string, number>;
  recordMarathon: (correct: number, total: number, seconds: number) => void;
  assignTag: (mistakeNumber: number, tag: string) => void;
  buyFreeze: () => void;
  freezesBought: number;
  inviteCode: string;

  /* домашние задания от преподавателя */
  activeAssignmentId: string | null;
  openAssignment: (id: string) => void;
  completeAssignment: (id: string, score: number) => void;

  go: (r: Route) => void;
  login: (u: ProductUser) => void;
  logout: () => void;
  patchUser: (p: Partial<ProductUser>) => void;
  bindTeacherLocal: (code: string) => { ok: boolean; teacherName?: string };
  unbindTeacherLocal: () => void;
  pushToast: (msg: string) => void;
  addNotif: (n: Omit<NotifItem, "id" | "time" | "read">) => void;
  markAllRead: () => void;
  startVariant: (id: string) => void;
  submitExam: (answers: Record<number, string>, secondsSpent: number, opts?: { navigate?: boolean }) => ExamResult;
  toggleResolved: (number: number) => void;
  recordAnswer: (taskNumber: number, correct: boolean) => void;
  setProbBest: (pct: number) => void;
  deleteAccount: () => void;
  collectExport: () => Record<string, unknown>;

  /* банк задач (админка) */
  addTask: (t: Omit<CustomTask, "id" | "createdAt">) => CustomTask;
  removeTask: (id: string) => void;
  importTasks: (list: CustomTask[]) => { added: number; skipped: number };
}

export interface ExamRow { number: number; given: string | null; reference: string; status: "correct" | "incorrect" | "skipped"; solution?: string; }
export interface ExamResult {
  variantTitle: string; rows: ExamRow[];
  correct: number; incorrect: number; skipped: number;
  primary: number; secondary: number; secondsSpent: number;
}

const Ctx = createContext<AppState | null>(null);

const TASKBANK_KEY = "komi-taskbank-v1";
const PUBLISHED_KEY = "komi-published-variants-v1";

/* ── Версия схемы сохранённого состояния ─────────────────────────────
   Если структура данных менялась (новые поля, другой формат), старые
   записи в localStorage могут уронить приложение при чтении. При
   несовпадении версии все komi-* ключи сбрасываются — приложение
   стартует чистым вместо падения. Поднимайте VERSION при изменении
   любых персист-структур. */
const STATE_VERSION_KEY = "komi-state-version";
const STATE_VERSION = "2026-02-v5"; // v5: код привязки SYSOLA-PRO (без фамилии)

function ensureStateVersion() {
  try {
    if (localStorage.getItem(STATE_VERSION_KEY) === STATE_VERSION) return;
    Object.keys(localStorage)
      .filter((k) => k.startsWith("komi-"))
      .forEach((k) => localStorage.removeItem(k));
    localStorage.setItem(STATE_VERSION_KEY, STATE_VERSION);
  } catch { /* приватный режим — ок */ }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  ensureStateVersion();
  const [user, setUser] = useState<ProductUser | null>(loadSession);
  const [route, setRoute] = useState<Route>("home");
  const [variantId, setVariantId] = useState("v-real-2023");
  const [lastResult, setLastResult] = useState<ExamResult | null>(null);
  const [burst, setBurst] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const scope = user?.nickname ?? "guest";

  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [mistakes, setMistakes] = useState<MistakeGroup[]>([]);
  const [unlocked, setUnlocked] = useState<Record<string, number>>({});
  const [topicStats, setTopicStats] = useState<Record<number, TopicStat>>({});
  const [notifs, setNotifs] = useState<NotifItem[]>([]);
  const [nightOwl, setNightOwl] = useState(false);
  const [probBest, setProbBestState] = useState(0);
  const [streak, setStreak] = useState<StreakState>({ days: 0, best: 0, last: "", xp: 0, freezes: 0 });
  const [taskBank, setTaskBank] = useState<CustomTask[]>(() => read<CustomTask[]>(TASKBANK_KEY, []));
  const [trainerTopic, setTrainerTopic] = useState<number | null>(null);
  const [solvedTaskIds, setSolvedTaskIds] = useState<string[]>([]);
  const [publishedVariants, setPublishedVariants] = useState<PublishedVariant[]>(() =>
    read<PublishedVariant[]>(PUBLISHED_KEY, [])
  );
  const [activeVariant, setActiveVariant] = useState<PublishedVariant | null>(null);
  const justSwitched = useRef(false);

  /* марафон, реферальная система, теги ошибок */
  const [marathonCount, setMarathonCount] = useState(0);
  const [marathonBest, setMarathonBest] = useState(0);
  const [referrals, setReferrals] = useState<string[]>([]);
  const [tagsAssigned, setTagsAssigned] = useState(0);
  const [tagStats, setTagStats] = useState<Record<string, number>>({});
  const [freezesBought, setFreezesBought] = useState(0);
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);

  /* загрузка данных при смене пользователя — демо-набор только у «artom» */
  useEffect(() => {
    justSwitched.current = true;
    const s = scope;
    const demo = s === "artom";
    setAttempts(demo ? INITIAL_ATTEMPTS : readArr<AttemptRecord>(scoped("komi-attempts", s)));
    setMistakes(demo ? seedMistakes() : readArr<MistakeGroup>(scoped("komi-mistakes", s)));
    setUnlocked(demo ? { "first-variant": Date.now() - 6 * 86_400_000, threshold: Date.now() - 4 * 86_400_000, "streak-3": Date.now() - 3 * 86_400_000 } : read<Record<string, number>>(scoped("komi-achievements", s), {}));
    setTopicStats(demo ? demoTopicStats() : read<Record<number, TopicStat>>(scoped("komi-topics", s), {}));
    setNightOwl(read<boolean>(scoped("komi-nightowl", s), false));
    setProbBestState(read<number>(scoped("komi-probbest", s), 0));
    /* стрик: пропуск сжигает серию, если нет «страховки серии» (streak freeze).
       Поля дополняются значениями по умолчанию — старые/битые записи не валят приложение. */
    const rawSt = read<Partial<StreakState>>(scoped("komi-streak", s), {});
    const st: StreakState = {
      days: typeof rawSt.days === "number" ? rawSt.days : 0,
      best: typeof rawSt.best === "number" ? rawSt.best : 0,
      last: typeof rawSt.last === "string" ? rawSt.last : "",
      xp: typeof rawSt.xp === "number" ? rawSt.xp : 0,
      freezes: typeof rawSt.freezes === "number" ? rawSt.freezes : 0,
    };
    if (st.last && st.last !== dayIso() && st.last !== yesterdayIso()) {
      const missed = Math.max(0, Math.round((new Date(dayIso()).getTime() - new Date(st.last).getTime()) / 86_400_000) - 1);
      if (missed > 0 && st.freezes >= missed) {
        /* страховка сработала: списываем по одной заморозке за пропущенный день */
        st.freezes -= missed;
        st.last = yesterdayIso();
        setTimeout(() => {
          pushToast(`Страховка серии сработала: −${missed} заморозка, серия ${st.days} дн. сохранена`);
          addNotif({ type: "system", title: "Серия спасена ❄", body: `Вы пропустили ${missed} дн., но страховка сохранила серию. Решите задачу сегодня, чтобы продолжить.` });
        }, 400);
      } else {
        st.days = 0;
      }
    }
    if (demo && !st.last) { const d = { days: 6, best: 9, last: dayIso(), xp: 430, freezes: 1 }; setStreak(d); }
    else setStreak(st);
    setSolvedTaskIds(read<string[]>(scoped("komi-solvedtasks", s), []));
    setTrainerTopic(null);
    setMarathonCount(read<number>(scoped("komi-marathon-n", s), 0));
    setMarathonBest(read<number>(scoped("komi-marathon-best", s), 0));
    setTagsAssigned(read<number>(scoped("komi-tags-n", s), 0));
    setTagStats(read<Record<string, number>>(scoped("komi-tagstats", s), {}));
    setFreezesBought(read<number>(scoped("komi-freezes-bought", s), 0));

    /* рефералы: считаем из общего журнала по коду пользователя */
    if (user) {
      const code = makeInviteCode(user.nickname);
      const mine = readReferrals(code);
      setReferrals(mine);
      /* разово начисляем +50 XP за каждого нового приглашённого */
      const credited = read<number>(scoped("komi-ref-credited", s), 0);
      if (mine.length > credited) {
        setStreak((st) => ({ ...st, xp: st.xp + (mine.length - credited) * 50 }));
        write(scoped("komi-ref-credited", s), mine.length);
      }
      /* приветственный бонус +30 XP тому, кто пришёл по чужой ссылке (один раз) */
      if (user.referredBy && !read<boolean>(scoped("komi-welcome", s), false)) {
        setStreak((st) => ({ ...st, xp: st.xp + 30 }));
        write(scoped("komi-welcome", s), true);
      }
    } else {
      setReferrals([]);
    }
    setNotifs(demo ? [
      { id: 1, type: "achievement", title: "Серия — 6 дней!", body: "Ещё один день — и рекорд месяца по тренировкам будет вашим.", time: "2 ч назад", read: false },
      { id: 2, type: "lesson", title: "Занятие завтра в 18:00", body: "Даниил разберёт №18 «Параметры». Подготовьте вопросы по графическому методу.", time: "5 ч назад", read: false },
      { id: 3, type: "feed", title: "Анна обогнала вас в рейтинге", body: "Анна из Ухты набрала 96 баллов. Вы на 4-м месте в рейтинге недели.", time: "вчера", read: false },
    ] : []);
    setLastResult(null);
  }, [scope]);

  /* персист — только под ключом пользователя */
  useEffect(() => { if (scope !== "guest") write(scoped("komi-attempts", scope), attempts); }, [attempts, scope]);
  useEffect(() => { if (scope !== "guest") write(scoped("komi-mistakes", scope), mistakes); }, [mistakes, scope]);
  useEffect(() => { if (scope !== "guest") write(scoped("komi-achievements", scope), unlocked); }, [unlocked, scope]);
  useEffect(() => { if (scope !== "guest") write(scoped("komi-topics", scope), topicStats); }, [topicStats, scope]);
  useEffect(() => { if (scope !== "guest") write(scoped("komi-streak", scope), streak); }, [streak, scope]);
  useEffect(() => { write(TASKBANK_KEY, taskBank); }, [taskBank]);
  useEffect(() => { if (scope !== "guest") write(scoped("komi-solvedtasks", scope), solvedTaskIds); }, [solvedTaskIds, scope]);
  useEffect(() => { if (scope !== "guest") write(scoped("komi-marathon-n", scope), marathonCount); }, [marathonCount, scope]);
  useEffect(() => { if (scope !== "guest") write(scoped("komi-marathon-best", scope), marathonBest); }, [marathonBest, scope]);
  useEffect(() => { if (scope !== "guest") write(scoped("komi-referrals", scope), referrals); }, [referrals, scope]);
  useEffect(() => { if (scope !== "guest") write(scoped("komi-tags-n", scope), tagsAssigned); }, [tagsAssigned, scope]);
  useEffect(() => { if (scope !== "guest") write(scoped("komi-tagstats", scope), tagStats); }, [tagStats, scope]);
  useEffect(() => { if (scope !== "guest") write(scoped("komi-freezes-bought", scope), freezesBought); }, [freezesBought, scope]);

  const pushToast = useCallback((msg: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3400);
  }, []);

  const addNotif = useCallback((n: Omit<NotifItem, "id" | "time" | "read">) => {
    setNotifs((prev) => [{ ...n, id: Date.now() + Math.random(), time: "только что", read: false }, ...prev].slice(0, 20));
  }, []);

  /* решена хотя бы одна задача за сутки → +1 день серии (один раз в день), +XP */
  const registerSolve = useCallback(() => {
    const today = dayIso();
    setStreak((s) => {
      const sameDay = s.last === today;
      const cont = s.last === yesterdayIso();
      const days = sameDay ? s.days : cont ? s.days + 1 : 1;
      const xp = s.xp + 10 + (sameDay ? 0 : 15);
      return { days, best: Math.max(s.best, days), last: today, xp, freezes: s.freezes };
    });
  }, []);

  const bestScore = useMemo(() => (attempts.length ? Math.max(...attempts.map((a) => a.secondary)) : 0), [attempts]);
  const resolvedMistakes = useMemo(() => mistakes.filter((g) => g.resolved).length, [mistakes]);

  /* всего решено задач + решено по теории вероятностей (№4 + №5) */
  const solvedTasks = useMemo(
    () => Object.values(topicStats).reduce((s, t) => s + t.solved, 0),
    [topicStats]
  );
  const probSolved = useMemo(
    () => (topicStats[4]?.solved ?? 0) + (topicStats[5]?.solved ?? 0),
    [topicStats]
  );
  const perfectVariants = useMemo(
    () => attempts.filter((a) => a.mistakes === 0 && a.secondary > 0).length,
    [attempts]
  );

  /* новые метрики: темы, недельная активность, цель */
  const distinctTopics = useMemo(
    () => Object.values(topicStats).filter((t) => t.solved > 0).length,
    [topicStats]
  );
  const weeklyVariants = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86_400_000;
    return attempts.filter((a) => a.ts !== undefined && a.ts >= weekAgo).length;
  }, [attempts]);
  const goalReached = useMemo(
    () => (user?.goal !== undefined ? bestScore >= user.goal : false),
    [bestScore, user?.goal]
  );

  const snapshot = useMemo(
    () => ({
      attempts: attempts.length, best: bestScore, streak: streak.days, resolvedMistakes,
      probBest, nightOwl, solvedTasks, probSolved, perfectVariants,
      distinctTopics, marathonCount, marathonBest, referrals: referrals.length,
      tagsAssigned, weeklyVariants, goalReached, freezesBought,
    }),
    [attempts.length, bestScore, streak.days, resolvedMistakes, probBest, nightOwl, solvedTasks, probSolved, perfectVariants, distinctTopics, marathonCount, marathonBest, referrals.length, tagsAssigned, weeklyVariants, goalReached, freezesBought]
  );

  /* автопроверка достижений: конфетти + XP + тост + уведомление */
  useEffect(() => {
    if (justSwitched.current) { justSwitched.current = false; return; }
    const newly = ACHIEVEMENTS.filter((a) => unlocked[a.id] === undefined && a.test(snapshot));
    if (!newly.length) return;
    const now = Date.now();
    const xpGain = newly.reduce((s, a) => s + a.xp, 0);
    setUnlocked((prev) => {
      const next = { ...prev };
      for (const a of newly) next[a.id] = now;
      return next;
    });
    setStreak((s) => ({ ...s, xp: s.xp + xpGain }));
    setBurst((b) => b + 1);
    const title = newly.length === 1 ? `Ачивка: «${newly[0].title}» (+${newly[0].xp} XP)` : `Разблокировано ${newly.length} ачивок (+${xpGain} XP)`;
    setTimeout(() => pushToast(title), 400);
    addNotif({ type: "achievement", title, body: newly.map((a) => `«${a.title}»`).join(", ") });
  }, [snapshot, unlocked, pushToast, addNotif]);

  const go = useCallback((r: Route) => {
    setRoute(r);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, []);

  const login = useCallback((u: ProductUser) => {
    saveSession(u);
    setUser(u);
    pushToast(u.role === "teacher" ? `С возвращением, @${u.nickname}! Кабинет открыт` : `Добро пожаловать, @${u.nickname}!`);
    if (u.role === "teacher") setRoute("admin");
  }, [pushToast]);

  const logout = useCallback(() => {
    saveSession(null);
    setUser(null);
    setRoute("home");
    pushToast("Вы вышли из аккаунта");
  }, [pushToast]);

  const patchUser = useCallback((p: Partial<ProductUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const merged = { ...prev, ...p };
      saveSession(merged);
      return merged;
    });
  }, []);

  /**
   * Привязка ученика к преподавателю по коду (локальный режим).
   * Обновляет и сессию, и запись в общем списке пользователей —
   * именно по teacherCode кабинет репетитора находит своих учеников,
   * поэтому вся накопленная статистика (ключуется по нику) становится
   * ему видна моментально, без переноса данных.
   */
  const bindTeacherLocal = useCallback((code: string): { ok: boolean; teacherName?: string } => {
    const c = code.trim().toUpperCase();
    try {
      const users = read<{ nickname: string; role: string; teacherCode?: string; password?: string }[]>("komi-users-v1", []);
      const teacher = users.find((u) => u.role === "teacher" && (u.teacherCode || "").toUpperCase() === c);
      if (!teacher) return { ok: false };
      const teacherName = teacher.nickname;
      /* обновляем запись ученика в общем списке */
      const me = user?.nickname;
      if (me) {
        const next = users.map((u) =>
          u.nickname === me && u.role === "student" ? { ...u, teacherCode: c } : u
        );
        write("komi-users-v1", next);
      }
      /* обновляем сессию */
      setUser((prev) => {
        if (!prev) return prev;
        const merged = { ...prev, teacherCode: c, teacherName };
        saveSession(merged);
        return merged;
      });
      return { ok: true, teacherName };
    } catch {
      return { ok: false };
    }
  }, [user?.nickname]);

  const unbindTeacherLocal = useCallback((): void => {
    try {
      const users = read<{ nickname: string; role: string; teacherCode?: string }[]>("komi-users-v1", []);
      const me = user?.nickname;
      if (me) {
        const next = users.map((u) =>
          u.nickname === me && u.role === "student" ? { ...u, teacherCode: undefined } : u
        );
        write("komi-users-v1", next);
      }
      setUser((prev) => {
        if (!prev) return prev;
        const merged = { ...prev, teacherCode: undefined, teacherName: undefined };
        saveSession(merged);
        return merged;
      });
    } catch { /* ок */ }
  }, [user?.nickname]);

  const startVariant = useCallback((id: string) => {
    setVariantId(id);
    setRoute("run");
    window.scrollTo({ top: 0 });
  }, []);

  const submitExam = useCallback((answers: Record<string, string>, secondsSpent: number, opts?: { navigate?: boolean }): ExamResult => {
    const variant = { title: "Основной период", year: 2023 };
    const rows: ExamRow[] = REAL_VARIANT.filter((t) => t.part === 1).map((t) => {
      const ref = t.answer ?? REAL_ANSWER_KEY[t.number] ?? "";
      const given = (answers[t.number] ?? "").trim() || null;
      const status = given === null ? "skipped" : answersMatch(given, ref) ? "correct" : "incorrect";
      return { number: t.number, given, reference: ref, status, solution: t.solution };
    });
    const correct = rows.filter((r) => r.status === "correct").length;
    const incorrect = rows.filter((r) => r.status === "incorrect").length;
    const skipped = rows.filter((r) => r.status === "skipped").length;
    const primary = correct;
    const secondary = SCALE[primary] ?? 0;
    const variantLabel = `${variant.title} ${variant.year}`;

    const topicByNumber = new Map(REAL_VARIANT.map((t) => [t.number, t.category]));
    const wrong = rows.filter((r) => r.status !== "correct");
    if (wrong.length) {
      setMistakes((prev) => wrong.reduce((acc, r) => recordMistake(acc, r.number, topicByNumber.get(r.number) ?? `Задание ${r.number}`, r.given, r.reference, variantLabel), prev));
      addNotif({ type: "system", title: `В журнале ошибок: +${wrong.length}`, body: `«${variantLabel}» — ${todayShort()}. Разбор ошибок даёт +6 баллов за месяц.` });
    }
    setTopicStats((prev) => {
      const next = { ...prev };
      for (const r of rows) {
        const cur = next[r.number] ?? { solved: 0, attempts: 0 };
        next[r.number] = { solved: cur.solved + (r.status === "correct" ? 1 : 0), attempts: cur.attempts + 1 };
      }
      return next;
    });
    const h = new Date().getHours();
    if (h >= 22 || h < 5) { setNightOwl(true); write(scoped("komi-nightowl", scope), true); }

    registerSolve();

    /* разбивка по заданиям — для детализации «ошибка vs пропуск» в аналитике */
    const taskResults: Record<number, "correct" | "incorrect" | "skipped"> = {};
    for (const r of rows) taskResults[r.number] = r.status;

    const newAttempt: AttemptRecord = { id: Date.now(), variantId: "v-real-2023", label: variantLabel, secondary, mistakes: incorrect > 0 ? Math.min(incorrect, 2) : 0, date: todayShort(), ts: Date.now(), taskResults };
    const bestBefore = attempts.length ? Math.max(...attempts.map((a) => a.secondary)) : 0;
    setAttempts((a) => [...a, newAttempt]);

    /* Серверная синхронизация: если вошли через API, отправляем попытку в БД,
       чтобы она стала видна преподавателю в кабинете. Не блокируем UI. */
    if (hasServerAuth() && isApiEnabled()) {
      submitAttemptApi(
        "v-real-2023",
        REAL_VARIANT.filter((t) => t.part === 1).map((t) => ({
          task_number: t.number,
          answer: (answers[t.number] ?? "").trim(),
        })),
      ).catch(() => { /* офлайн — останется в localStorage */ });
    }

    if (secondary > bestBefore) {
      setTimeout(() => pushToast(`Новый личный рекорд: ${secondary} тестовых баллов!`), 700);
      addNotif({ type: "achievement", title: `Новый рекорд: ${secondary} баллов`, body: `Вы превзошли предыдущий лучший результат (${bestBefore}).` });
    }

    const result: ExamResult = { variantTitle: variantLabel, rows, correct, incorrect, skipped, primary, secondary, secondsSpent };
    setLastResult(result);
    if (opts?.navigate !== false) {
      setRoute("results");
      window.scrollTo({ top: 0 });
    }
    return result;
  }, [attempts, scope, pushToast, addNotif, registerSolve]);

  const toggleResolved = useCallback((number: number) => {
    setMistakes((prev) => prev.map((g) => (g.number === number ? { ...g, resolved: !g.resolved } : g)));
  }, []);

  const recordAnswer = useCallback((taskNumber: number, correct: boolean) => {
    setTopicStats((prev) => {
      const cur = prev[taskNumber] ?? { solved: 0, attempts: 0 };
      return { ...prev, [taskNumber]: { solved: cur.solved + (correct ? 1 : 0), attempts: cur.attempts + 1 } };
    });
    registerSolve();
  }, [registerSolve]);

  const setProbBest = useCallback((pct: number) => {
    setProbBestState((prev) => {
      const next = Math.max(prev, pct);
      write(scoped("komi-probbest", scope), next);
      return next;
    });
  }, [scope]);

  const collectExport = useCallback(() => ({
    exportedAt: new Date().toISOString(), profile: user, attempts, mistakes, topicStats,
    achievements: unlocked, probBest, streak, telegram_id: user?.telegram_id ?? null,
  }), [user, attempts, mistakes, topicStats, unlocked, probBest, streak]);

  const deleteAccount = useCallback(() => {
    const s = scope;
    try {
      ["komi-attempts", "komi-mistakes", "komi-achievements", "komi-topics", "komi-probbest", "komi-nightowl", "komi-streak"].forEach((k) => localStorage.removeItem(scoped(k, s)));
      const users = read<(ProductUser & { password: string })[]>("komi-users-v1", []);
      if (user) write("komi-users-v1", users.filter((u) => u.email !== user.email));
    } catch { /* ок */ }
    saveSession(null);
    setUser(null);
    setRoute("home");
    pushToast("Аккаунт и все данные удалены");
  }, [scope, user, pushToast]);

  /* ── банк задач (общий, управляется преподавателем) ── */
  const addTask = useCallback((t: Omit<CustomTask, "id" | "createdAt">): CustomTask => {
    const full: CustomTask = { ...t, id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, createdAt: new Date().toISOString() };
    setTaskBank((prev) => [full, ...prev]);
    return full;
  }, []);

  const removeTask = useCallback((id: string) => {
    setTaskBank((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /* ── тренажёр темы ── */
  const openTrainer = useCallback((n: number) => {
    setTrainerTopic(n);
    setRoute("trainer");
    window.scrollTo({ top: 0 });
  }, []);

  /** Задача решена верно: фиксируем id (дедуп), обновляем тему, стрик и XP. */
  const markTaskSolved = useCallback((taskId: string, taskNumber: number) => {
    setSolvedTaskIds((prev) => (prev.includes(taskId) ? prev : [...prev, taskId]));
    registerSolve();
    setTopicStats((prev) => {
      const cur = prev[taskNumber] ?? { solved: 0, attempts: 0 };
      return { ...prev, [taskNumber]: { solved: cur.solved + 1, attempts: cur.attempts + 1 } };
    });
    setStreak((s) => ({ ...s, xp: s.xp + 10 }));
  }, [registerSolve]);

  const celebrate = useCallback(() => setBurst((b) => b + 1), []);

  /* персист опубликованных вариантов (общие для всех на этом устройстве) */
  useEffect(() => { write(PUBLISHED_KEY, publishedVariants); }, [publishedVariants]);

  /* ── авторские варианты ── */
  const publishVariant = useCallback((v: ParsedVariant): PublishedVariant => {
    const full: PublishedVariant = {
      ...v,
      id: `pv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      linkCode: makeLinkCode(),
      publishedAt: new Date().toISOString(),
      authorName: user?.name ?? "Преподаватель",
    };
    setPublishedVariants((prev) => [full, ...prev]);
    return full;
  }, [user]);

  const unpublishVariant = useCallback((id: string) => {
    setPublishedVariants((prev) => prev.filter((v) => v.id !== id));
  }, []);

  const runPublishedVariant = useCallback((code: string): boolean => {
    const v = publishedVariants.find((x) => x.linkCode === code || x.id === code) ?? null;
    if (!v) return false;
    setActiveVariant(v);
    setRoute("variant-run");
    window.scrollTo({ top: 0 });
    return true;
  }, [publishedVariants]);

  /** Привязка ученика к преподавателю по коду приглашения. */
  const attachTeacher = useCallback((code: string): { ok: boolean; teacherName?: string } => {
    const teacherName = resolveTeacher(code);
    if (!teacherName) return { ok: false };
    const codeUp = code.trim().toUpperCase();
    setUser((prev) => {
      if (!prev) return prev;
      const merged = { ...prev, teacherCode: codeUp, teacherName };
      saveSession(merged);
      return merged;
    });
    return { ok: true, teacherName };
  }, []);

  /** Записать результат авторского варианта (работает и в автономном режиме). */
  const recordPublishedAttempt = useCallback((label: string, primary: number, secondary: number, mistakes: number) => {
    registerSolve();
    setAttempts((prev) => [...prev, {
      id: `ca-${Date.now()}`,
      variantId: `custom:${label}`,
      label,
      secondary,
      mistakes,
      date: todayShort(),
      ts: Date.now(),
    }]);
    void primary;
  }, [registerSolve]);

  /* ── марафон: фиксируем игру, лучший результат и XP за скорость ── */
  const recordMarathon = useCallback((correct: number, total: number, seconds: number) => {
    setMarathonCount((n) => n + 1);
    setMarathonBest((b) => Math.max(b, correct));
    /* XP: 10 за задачу + бонус за скорость (до 30) */
    const speedBonus = Math.max(0, Math.round(30 - seconds / total / 3));
    const xp = correct * 10 + speedBonus;
    setStreak((s) => ({ ...s, xp: s.xp + xp }));
    registerSolve();
    pushToast(`Марафон: ${correct}/${total} · +${xp} XP`);
  }, [registerSolve, pushToast]);

  /* ── теги ошибок: размечаем причину промаха ── */
  const assignTag = useCallback((mistakeNumber: number, tag: string) => {
    setMistakes((prev) => prev.map((g) => (g.number === mistakeNumber ? { ...g, tag } : g)));
    setTagsAssigned((n) => n + 1);
    setTagStats((prev) => ({ ...prev, [tag]: (prev[tag] ?? 0) + 1 }));
  }, []);

  /* ── страховка серии (streak freeze): 100 XP → 1 заморозка ── */
  const buyFreeze = useCallback(() => {
    if (streak.xp < FREEZE_COST) {
      pushToast(`Не хватает XP: нужно ${FREEZE_COST}, у вас ${streak.xp}`);
      return;
    }
    setStreak((s) => ({ ...s, xp: s.xp - FREEZE_COST, freezes: s.freezes + 1 }));
    setFreezesBought((n) => n + 1);
    pushToast(`Страховка серии куплена (−${FREEZE_COST} XP)`);
    addNotif({ type: "system", title: "Страховка серии ❄", body: "Один пропущенный день больше не сожжёт серию. Заморозка сработает автоматически." });
  }, [streak.xp, pushToast, addNotif]);

  /* ── домашние задания от преподавателя ── */
  const openAssignment = useCallback((id: string) => {
    if (!user) return;
    setStatus(id, user.nickname, "opened");
    setActiveAssignmentId(id);
    setRoute("assignment-run");
    window.scrollTo({ top: 0 });
  }, [user]);

  const completeAssignment = useCallback((id: string, score: number) => {
    if (!user) return;
    setStatus(id, user.nickname, "done", score);
    setActiveAssignmentId(null);
    pushToast(`ДЗ выполнено · ${score} баллов`);
    setRoute("results");
    window.scrollTo({ top: 0 });
  }, [user, pushToast]);

  /* авто-уведомления о новых ДЗ при входе ученика */
  useEffect(() => {
    if (!user || user.role !== "student") return;
    const fresh = getForStudent(user.nickname).filter((a) => a.targets.some((t) => t.nick === user.nickname && t.status === "new"));
    const notified = read<string[]>(scoped("komi-hw-notified", scope), []);
    fresh.filter((a) => !notified.includes(a.id)).forEach((a) => {
      addNotif({
        type: "homework",
        title: "📚 ДЗ от репетитора",
        body: `${a.title}${a.message ? " — " + a.message : ""}`,
        assignmentId: a.id,
      });
    });
    write(scoped("komi-hw-notified", scope), [...notified, ...fresh.map((a) => a.id)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  const importTasks = useCallback((list: CustomTask[]) => {
    let added = 0, skipped = 0;
    setTaskBank((prev) => {
      const next = [...prev];
      for (const t of list) {
        const dup = next.some((x) => x.exam_type === t.exam_type && x.task_number === t.task_number && x.condition_text.trim() === t.condition_text.trim());
        if (dup) { skipped++; continue; }
        next.unshift(t);
        added++;
      }
      return next;
    });
    return { added, skipped };
  }, []);

  const todaySolved = streak.last === dayIso();

  const value: AppState = {
    user, scope, route, attempts, mistakes, unlocked, topicStats, notifs, toasts, burst,
    variantId, lastResult, nightOwl, probBest,
    streak, todaySolved, taskBank,
    trainerTopic, solvedTaskIds, openTrainer, markTaskSolved, celebrate,
    publishedVariants, activeVariant, publishVariant, unpublishVariant, runPublishedVariant, attachTeacher, recordPublishedAttempt,
    marathonCount, marathonBest, referrals, tagsAssigned, tagStats, recordMarathon, assignTag, buyFreeze, freezesBought,
    inviteCode: user ? makeInviteCode(user.nickname) : "",
    activeAssignmentId, openAssignment, completeAssignment,
    go, login, logout, patchUser, pushToast, addNotif, bindTeacherLocal, unbindTeacherLocal,
    markAllRead: () => setNotifs((prev) => prev.map((n) => ({ ...n, read: true }))),
    startVariant, submitExam, toggleResolved, recordAnswer, setProbBest, deleteAccount, collectExport,
    addTask, removeTask, importTasks,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp вне AppProvider");
  return ctx;
}

function recordMistake(groups: MistakeGroup[], number: number, topic: string, given: string | null, reference: string, variant: string): MistakeGroup[] {
  const occ = { given, reference, variant, date: todayShort() };
  const existing = groups.find((g) => g.number === number);
  if (existing) return groups.map((g) => (g.number === number ? { ...g, resolved: false, occurrences: [occ, ...g.occurrences].slice(0, 6) } : g));
  return [{ number, topic, resolved: false, occurrences: [occ] }, ...groups];
}

function demoTopicStats(): Record<number, TopicStat> {
  const out: Record<number, TopicStat> = {};
  const demo: [number, number, number][] = [
    [1, 19, 20], [2, 18, 20], [3, 17, 20], [4, 15, 20], [5, 16, 20], [6, 12, 20],
    [7, 14, 20], [8, 11, 20], [9, 10, 20], [10, 8, 20], [11, 17, 20], [12, 18, 20],
    [13, 7, 10], [14, 5, 9], [15, 4, 9], [16, 3, 8], [17, 5, 9], [18, 2, 8], [19, 4, 8],
  ];
  for (const [n, solved, attempts] of demo) out[n] = { solved, attempts };
  return out;
}
