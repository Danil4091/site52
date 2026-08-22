/* ══════════════════════════════════════════════════════════════════
   Домашние задания от преподавателя.
   Учитель отправляет ученикам вариант или блок задач по теме →
   у ученика появляется уведомление «ДЗ от репетитора». Статусы
   отслеживаются в общем хранилище (в локальном режиме — localStorage,
   в продакшене — БД по teacher_id / student_id).
   ══════════════════════════════════════════════════════════════════ */

export type AssignmentKind = "variant" | "block";
export type AssignmentStatus = "new" | "opened" | "done";

export interface AssignmentTarget {
  nick: string;
  status: AssignmentStatus;
  score?: number;       // вторичный балл (вариант) или % (блок)
  completedAt?: number;
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

export function readAssignments(): Assignment[] {
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
  return readAll().filter((a) => a.targets.some((t) => t.nick === nick));
}

export function getAssignment(id: string): Assignment | null {
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

export function deleteAssignment(id: string): void {
  writeAll(readAll().filter((a) => a.id !== id));
}
