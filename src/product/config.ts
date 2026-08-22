/**
 * Конфигурация фронтенда — всё берётся из переменных окружения Vite (`.env`).
 * Значения по умолчанию используются, если переменная не задана.
 */

const env = import.meta.env as Record<string, string | undefined>;

/* ── Дата ЕГЭ (задача: вынести в .env, VITE_EGE_DATE) ──
   Ориентировочно — 7 июня 2027 (уточняется ФИПИ). */
export const EGE_DATE_ISO: string = env.VITE_EGE_DATE ?? "2027-06-07";

/** Дата ЕГЭ как объект (локальное время, 10:00). */
export const EGE_DATE: Date = new Date(`${EGE_DATE_ISO}T10:00:00`);

/** Человекочитаемая подпись даты. */
export const EGE_DATE_LABEL: string = EGE_DATE.toLocaleDateString("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** Пометка рядом со счётчиком. */
export const EGE_DATE_NOTE = "Дата предварительная (уточняется ФИПИ)";

/* ── Средний тестовый балл по РФ (профильная математика, 2026) ──
   Отображается на графике аналитики для сравнения с результатом ученика. */
export const RU_AVG_SCORE_2026: number = Number(env.VITE_RU_AVG_SCORE) || 64;

/* ── Ссылка на группу ВК (задача: VITE_VK_GROUP_URL) ── */
export const VK_GROUP_URL: string = env.VITE_VK_GROUP_URL ?? "https://vk.com/repetitor_iz_komi";

/* ── Фото преподавателя (VITE_TUTOR_PHOTO_URL); при ошибке — аватар-заглушка ── */
export const TUTOR_PHOTO_URL: string =
  env.VITE_TUTOR_PHOTO_URL ?? "https://image.qwenlm.ai/generated-images/d0edb133-d8b8-464b-bee4-72342d154ab2/_result.png";

/* ── Мастер-аккаунт преподавателя (локальный режим) ──
   В продакшене преподавателя создаёт backend/scripts/create_admin.py
   из серверного .env. Здесь — зеркало для автономного режима, чтобы
   преподаватель мог войти через обычную форму (без демо-кнопок). */
export const ADMIN_NICKNAME: string = env.VITE_ADMIN_NICKNAME ?? "daniil";
export const ADMIN_PASSWORD: string = env.VITE_ADMIN_PASSWORD ?? "Pudov-Ege-2026";
export const ADMIN_TEACHER_CODE: string = env.VITE_ADMIN_TEACHER_CODE ?? "PUDOV-PRO";
export const ADMIN_DISPLAY_NAME = "Даниил Пудов";
export const ADMIN_FULL_NAME = "Даниил Андреевич Пудов";
