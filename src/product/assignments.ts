/* ══════════════════════════════════════════════════════════════════
   Домашние задания от преподавателя.
   Учитель отправляет ученикам вариант, блок задач по теме или свой
   набор из Банка (включая задачи части 2 с ручной проверкой) →
   у ученика появляется уведомление «ДЗ от репетитора».

   Жизненный цикл цели (targets):
     new → opened → done                     (часть 1 / варианты)
     new → opened → submitted → done         (часть 2: решение ждёт
                                               ручной оценки учителя)
     new/opened → expired                    (дедлайн прошёл —
                                               выставляется автоматически)

   Статусы хранятся в общем хранилище (локально — localStorage,
   в продакшене — БД по teacher_id / student_id).
   ══════════════════════════════════════════════════════════════════ */

export type AssignmentKind = "variant" | "block" | "custom";
export type AssignmentStatus = "new" | "opened" | "submitted" | "done" | "expired";

/** Задача, выбранная преподавателем из Банка для custom-набора. */
export interface PickedTask {
  id: string;
  number: number;
  topic: string;
  statement: string;
  answer?: string | null;
  solution?: string;
  /** 1 = автопроверка, 2 = ручная проверка преподавателем. */
  part?: 1 | 2;
  /** Максимум первичных баллов (для части 2 — из критериев). */
  maxScore?: number;
  criteria?: string;
}

export interface AssignmentTarget {
  nick: string;
  status: AssignmentStatus;
  score?: number;       // вторичный балл (вариант) или % (блок) или первичный (ч.2)
  completedAt?: number;
  /** Текст решения задач части 2 — на проверку преподавателю. */
  solution?: string;
  submittedAt?: number;
  /** Оценка преподавателя за часть 2 (выставляется вручную). */
  manualScore?: number;
  gradedAt?: number;
}

export interface Assignment {
  id: string;
  fromNick: string;
  fromName: string;
  title: string;
  kind: AssignmentKind;
  /** Для kind === "variant": id опубликованного варианта или "v-real-2023". */
  variantId?: string;
  /** Для kind === "block": номер темы (1–12) и количество задач. */
  topicNumber?: number;
  taskCount?: number;
  /** Для kind === "custom": конкретные задачи, выбранные из Банка. */
  pickedTasks?: PickedTask[];
  message?: string;
  deadline?: number;
  createdAt: number;
  targets: AssignmentTarget[];
}

const KEY = "komi-assignments-v1";

function readAll(): Assignment[] {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? (v as Assignment[]) : [];
  } catch { return []; }
}
function writeAll(list: Assignment[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ок */ }
}

/* ─────────────────── дедлайны ─────────────────── */

/**
 * Автоматически переводит просроченные цели в «expired».
 * Вызывается при чтении списка: дедлайн прошёл, а ученик так и не
 * сдал работу (new / opened) → статус «просрочено». Сданные
 * (submitted / done) не трогаем — они уже в работе у учителя.
 */
export function refreshExpired(): void {
  const now = Date.now();
  const all = readAll();
  let changed = false;
  for (const a of all) {
    if (!a.deadline || a.deadline >= now) continue;
    for (const t of a.targets) {
      if (t.status === "new" || t.status === "opened") {
        t.status = "expired";
        changed = true;
      }
    }
  }
  if (changed) writeAll(all);
}

export interface DeadlineMeta {
  overdue: boolean;
  /** миллисекунд до дедлайна (отрицательное, если прошёл) */
  msLeft: number;
  /** человек-целей выполнили (done) */
  doneCount: number;
  /** сдали на проверку (submitted) */
  submittedCount: number;
  /** процент выполнения к дедлайну: done / всего */
  progressPct: number;
  humanLeft: string; // «2 дн 4 ч», «сегодня», «просрочено»
}

export function deadlineMeta(a: Assignment): DeadlineMeta {
  const doneCount = a.targets.filter((t) => t.status === "done").length;
  const submittedCount = a.targets.filter((t) => t.status === "submitted").length;
  const progressPct = a.targets.length ? Math.round((doneCount / a.targets.length) * 100) : 0;
  if (!a.deadline) return { overdue: false, msLeft: Infinity, doneCount, submittedCount, progressPct, humanLeft: "" };
  const msLeft = a.deadline - Date.now();
  let humanLeft = "";
  if (msLeft <= 0) humanLeft = "просрочено";
  else if (msLeft < 3_600_000) humanLeft = `${Math.max(1, Math.ceil(msLeft / 60_000))} мин`;
  else if (msLeft < 86_400_000) humanLeft = `сегодня · ${Math.ceil(msLeft / 3_600_000)} ч`;
  else {
    const d = Math.floor(msLeft / 86_400_000);
    const h = Math.floor((msLeft % 86_400_000) / 3_600_000);
    humanLeft = h > 0 ? `${d} дн ${h} ч` : `${d} дн`;
  }
  return { overdue: msLeft <= 0, msLeft, doneCount, submittedCount, progressPct, humanLeft };
}

/* ─────────────────── чтение / создание ─────────────────── */

export function readAssignments(): Assignment[] {
  refreshExpired();
  return readAll();
}

export function createAssignment(a: Omit<Assignment, "id" | "createdAt" | "targets"> & { students: string[] }): Assignment {
  const full: Assignment = {
    ...a,
    id: `hw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
    targets: a.students.map((nick) => ({ nick, status: "new" })),
  };
  const all = readAll();
  writeAll([full, ...all]);
  return full;
}

/** Все задания, адресованные конкретному ученику. */
export function getForStudent(nick: string): Assignment[] {
  refreshExpired();
  return readAll().filter((a) => a.targets.some((t) => t.nick === nick));
}

export function getAssignment(id: string): Assignment | null {
  refreshExpired();
  return readAll().find((a) => a.id === id) ?? null;
}

export function setStatus(id: string, nick: string, status: AssignmentStatus, score?: number): void {
  const all = readAll();
  const next = all.map((a) =>
    a.id === id
      ? {
          ...a,
          targets: a.targets.map((t) =>
            t.nick === nick
              ? { ...t, status, score: score !== undefined ? score : t.score, completedAt: status === "done" ? Date.now() : t.completedAt }
              : t
          ),
        }
      : a
  );
  writeAll(next);
}

/* ─────────────────── часть 2: решения и ручная проверка ─────────────────── */

/** Ученик сдаёт текст решения части 2 на проверку преподавателю. */
export function submitSolution(id: string, nick: string, solution: string): void {
  const all = readAll();
  writeAll(
    all.map((a) =>
      a.id === id
        ? { ...a, targets: a.targets.map((t) => (t.nick === nick ? { ...t, status: "submitted", solution, submittedAt: Date.now() } : t)) }
        : a
    )
  );
}

/** Преподаватель оценивает решение части 2 вручную. */
export function gradeSolution(id: string, nick: string, manualScore: number): void {
  const all = readAll();
  writeAll(
    all.map((a) =>
      a.id === id
        ? { ...a, targets: a.targets.map((t) => (t.nick === nick ? { ...t, status: "done", manualScore, gradedAt: Date.now(), completedAt: Date.now() } : t)) }
        : a
    )
  );
}

export function deleteAssignment(id: string): void {
  writeAll(readAll().filter((a) => a.id !== id));
}
