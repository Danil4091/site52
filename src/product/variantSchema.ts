/* ══════════════════════════════════════════════════════════════════
   Схема варианта ЕГЭ/ОГЭ, валидация JSON и генерация ссылок.
   Формат совпадает с ТЗ: variantTitle / subject / timeLimitMinutes /
   tasks[{ id, number, topic, latex_statement, answer, solution_latex,
   points, type }].
   ══════════════════════════════════════════════════════════════════ */

export type TaskType = "short_answer" | "detailed_answer";

/** Одна задача варианта (как лежит в JSON и в состоянии). */
export interface VariantTaskDef {
  id: string;
  number: number;
  topic: string;
  latex_statement: string;
  /** Эталон для части 1; для части 2 — null. */
  answer: string | null;
  solution_latex: string;
  points: number;
  type: TaskType;
}

/** Разобранная «шапка» варианта без сервисных полей. */
export interface ParsedVariant {
  variantTitle: string;
  subject: string;
  timeLimitMinutes: number;
  tasks: VariantTaskDef[];
}

/** Опубликованный вариант: шапка + уникальная ссылка + метаданные. */
export interface PublishedVariant extends ParsedVariant {
  id: string;
  linkCode: string;
  publishedAt: string;
  authorName: string;
}

export interface VariantValidationError {
  /** Где ошибка: "variantTitle", "tasks[3].number" и т.п. */
  path: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: VariantValidationError[];
  variant?: ParsedVariant;
}

/* ───────────────────────── валидация ───────────────────────── */

const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

export function validateVariantJson(raw: unknown): ValidationResult {
  const errors: VariantValidationError[] = [];
  const add = (path: string, message: string) => errors.push({ path, message });

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    add("(корень)", "Ожидается JSON-объект с полями variantTitle и tasks, а не массив и не скаляр.");
    return { ok: false, errors };
  }

  const obj = raw as Record<string, unknown>;

  /* шапка */
  if (!isNonEmptyString(obj.variantTitle)) add("variantTitle", "Отсутствует или пусто — укажите название варианта.");
  const subject = isNonEmptyString(obj.subject) ? obj.subject : "math_profile";
  const timeRaw = obj.timeLimitMinutes;
  const timeLimitMinutes =
    typeof timeRaw === "number" && Number.isFinite(timeRaw) && timeRaw > 0
      ? Math.round(timeRaw)
      : (add("timeLimitMinutes", "Должно быть положительное число минут (например, 235)."), 235);

  /* массив задач */
  if (!Array.isArray(obj.tasks)) {
    add("tasks", "Отсутствует или не массив — нужен список задач.");
    return { ok: false, errors };
  }
  if (obj.tasks.length === 0) add("tasks", "Массив пуст — добавьте хотя бы одну задачу.");

  const tasks: VariantTaskDef[] = [];
  const seenNumbers = new Set<number>();

  obj.tasks.forEach((t, i) => {
    const p = `tasks[${i}]`;
    if (typeof t !== "object" || t === null || Array.isArray(t)) {
      add(p, "Элемент не является объектом-задачей.");
      return;
    }
    const task = t as Record<string, unknown>;

    const number = task.number;
    if (typeof number !== "number" || !Number.isFinite(number) || number < 1) {
      add(`${p}.number`, "Номер задачи — целое число от 1.");
      return;
    }
    if (seenNumbers.has(number)) add(`${p}.number`, `Номер ${number} встречается дважды — номера должны быть уникальны.`);
    seenNumbers.add(number);

    if (!isNonEmptyString(task.latex_statement)) add(`${p}.latex_statement`, "Условие пустое — заполните latex_statement.");

    const typeRaw = task.type;
    const type: TaskType = typeRaw === "detailed_answer" ? "detailed_answer" : typeRaw === "short_answer" ? "short_answer" : (add(`${p}.type`, `Тип должен быть "short_answer" или "detailed_answer", получено «${String(typeRaw)}».`), "short_answer");

    /* ответ обязателен для части 1; для части 2 допустим null */
    const answer = task.answer;
    if (type === "short_answer") {
      if (answer === null || answer === undefined || (typeof answer === "string" && answer.trim() === "")) {
        add(`${p}.answer`, "Для short_answer обязателен непустой эталон ответа.");
      } else if (typeof answer !== "string" && typeof answer !== "number") {
        add(`${p}.answer`, "Ответ должен быть строкой или числом.");
      }
    }

    const points = typeof task.points === "number" && Number.isFinite(task.points) && task.points >= 0 ? task.points : (add(`${p}.points`, "Баллы — неотрицательное число."), 1);
    const topic = isNonEmptyString(task.topic) ? task.topic : `Задание ${number}`;
    const solution = typeof task.solution_latex === "string" ? task.solution_latex : "";
    const id = isNonEmptyString(task.id) ? task.id : `t${number}_${i}`;

    tasks.push({
      id,
      number,
      topic,
      latex_statement: String(task.latex_statement ?? ""),
      answer: type === "detailed_answer" ? null : answer === null || answer === undefined ? null : String(answer),
      solution_latex: solution,
      points,
      type,
    });
  });

  if (errors.length > 0) return { ok: false, errors };

  const variantTitle = String(obj.variantTitle).trim();
  tasks.sort((a, b) => a.number - b.number);
  return { ok: true, errors: [], variant: { variantTitle, subject, timeLimitMinutes, tasks } };
}

/* ───────────────────── генерация ссылки ───────────────────── */

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // без 0/O и 1/I

export function makeLinkCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return `VAR-${s}`;
}

export function variantLink(code: string): string {
  return `${location.origin}${location.pathname}?variant=${code}`;
}

/* ─────────────────── образцы кодов преподавателей ─────────────────── */

/** code → имя преподавателя. Преподаватель может добавить свои коды. */
export const TEACHER_CODES: Record<string, string> = {
  "KOMI-2026": "Даниил Пудов",
  "PROBNIK-7": "Даниил Пудов",
};

export function resolveTeacher(code: string): string | null {
  const c = code.trim().toUpperCase();
  if (TEACHER_CODES[c]) return TEACHER_CODES[c];
  /* любые коды формата KOMI-… считаем кодами основного преподавателя (демо) */
  if (/^KOMI-[A-Z0-9]{3,8}$/.test(c)) return "Даниил Пудов";
  return null;
}

/* ───────────────────── шаблон для скачивания ───────────────────── */

/** Готовый валидный вариант. Строится как объект и сериализуется —
 *  гарантированно проходит JSON.parse. */
export const SAMPLE_VARIANT = {
  variantTitle: "ЕГЭ Профиль 2026 — Вариант №1",
  subject: "math_profile",
  timeLimitMinutes: 235,
  tasks: [
    {
      id: "ege2026_v1_q1",
      number: 1,
      topic: "Планиметрия",
      latex_statement:
        "В треугольнике $ABC$ угол $C$ равен $90^{\\circ}$, $AC = 4$, $BC = 3$. Найдите $\\sin A$.",
      answer: "0.6",
      solution_latex:
        "По теореме Пифагора $AB = \\sqrt{AC^2 + BC^2} = \\sqrt{4^2 + 3^2} = 5$. Тогда $\\sin A = \\dfrac{BC}{AB} = \\dfrac{3}{5} = 0{,}6$.",
      points: 1,
      type: "short_answer",
    },
    {
      id: "ege2026_v1_q6",
      number: 6,
      topic: "Уравнения",
      latex_statement: "Найдите корень уравнения $\\log_2 (x + 3) = 4$.",
      answer: "13",
      solution_latex:
        "По определению логарифма $x + 3 = 2^4 = 16$, откуда $x = 13$.",
      points: 1,
      type: "short_answer",
    },
    {
      id: "ege2026_v1_q7",
      number: 7,
      topic: "Вычисления и преобразования",
      latex_statement:
        "Найдите значение выражения $(\\sqrt{23} - \\sqrt{15})(\\sqrt{23} + \\sqrt{15})$.",
      answer: "8",
      solution_latex:
        "По формуле разности квадратов: $(\\sqrt{23})^2 - (\\sqrt{15})^2 = 23 - 15 = 8$.",
      points: 1,
      type: "short_answer",
    },
    {
      id: "ege2026_v1_q13",
      number: 13,
      topic: "Уравнения",
      latex_statement:
        "а) Решите уравнение $2\\cos^2 x - 5\\sin x + 1 = 0$.\n\nб) Укажите корни этого уравнения, принадлежащие отрезку $\\left[ 0;\\ \\dfrac{3\\pi}{2} \\right]$.",
      answer: null,
      solution_latex:
        "а) Через тождество $\\cos^2 x = 1 - \\sin^2 x$: $2\\sin^2 x + 5\\sin x - 3 = 0$, откуда $\\sin x = \\dfrac{1}{2}$.\n\nКорни: $x = \\dfrac{\\pi}{6} + 2\\pi k$, $x = \\dfrac{5\\pi}{6} + 2\\pi k$.\n\nб) На отрезке: $x = \\dfrac{\\pi}{6}$ и $x = \\dfrac{5\\pi}{6}$.\n\nКритерии: 1 балл — верный ответ в п. а; 2 балла — оба пункта.",
      points: 2,
      type: "detailed_answer",
    },
    {
      id: "ege2026_v1_q15",
      number: 15,
      topic: "Неравенства",
      latex_statement: "Решите неравенство $\\log_2 (x + 3) + \\log_2 (x - 1) \\leqslant 5$.",
      answer: null,
      solution_latex:
        "ОДЗ: $x > 1$. Сумма логарифмов: $\\log_2 ((x+3)(x-1)) \\leqslant 5$, то есть $x^2 + 2x - 3 \\leqslant 32$, $x^2 + 2x - 35 \\leqslant 0$.\n\nКорни: $x = 5$ и $x = -7$, значит $x \\in [-7;\\ 5]$. С учётом ОДЗ: $x \\in (1;\\ 5]$.",
      points: 2,
      type: "detailed_answer",
    },
  ],
};

export function sampleVariantJson(): string {
  return JSON.stringify(SAMPLE_VARIANT, null, 2);
}
