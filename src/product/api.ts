/* ══════════════════════════════════════════════════════════════════
   Конфигурация API (production readiness).
   Базовый URL берётся из переменной окружения VITE_API_URL
   (файл .env в корне фронтенда). В демо-режиме, когда бэкенд не
   поднят, приложение работает на localStorage, а эти хелперы
   используются при подключении реального сервера.
   ══════════════════════════════════════════════════════════════════ */

/** Явно задан ли VITE_API_URL в .env (а не взят из дефолта). */
const RAW_ENV = ((import.meta.env.VITE_API_URL as string | undefined) ?? "").trim();

/**
 * Базовый URL API. Если VITE_API_URL не задан — берём тот же хост, с
 * которого открыт сайт (window.location.hostname) + порт 8000. Это
 * позволяет открывать сайт по локальному IP (http://192.168.x.x:5173):
 * запросы пойдут на http://192.168.x.x:8000, а не на localhost, и будут
 * работать с любого устройства в локальной сети.
 */
const FALLBACK_HOST =
  typeof window !== "undefined" && window.location.hostname
    ? window.location.hostname
    : "localhost";
export const API_URL: string = (RAW_ENV || `http://${FALLBACK_HOST}:8000`).replace(/\/+$/, "");

export const isApiEnabled = (): boolean => API_URL.length > 0;

/** true, только если пользователь явно прописал VITE_API_URL в .env. */
export const isApiExplicit = (): boolean => RAW_ENV.length > 0;

/* Dev-диагностика: сразу видно, что попало в сборку из .env.
   Если в консоли «VITE_API_URL = (пусто)» — файл .env не подхватился:
   он должен лежать В КОРНЕ проекта (рядом с package.json), называться
   ровно «.env» (не .env.txt!) и требовать полного перезапуска npm run dev. */
if (import.meta.env.DEV) {
  console.info(
    `%c[API]%c VITE_API_URL = ${API_URL} (${isApiExplicit() ? "из .env" : "дефолт"}) · API включён: ${isApiEnabled() ? "да" : "нет"}`,
    "color:#5ee6a8;font-weight:bold",
    "color:inherit"
  );
}

/** Проверка доступности сервера (GET /api/health). Возвращает true, если бэкенд отвечает. */
export async function checkBackendHealth(): Promise<boolean> {
  if (!isApiEnabled()) return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`${API_URL}/api/health`, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

/** Детальная диагностика подключения — чтобы видеть, ПОЧЕМУ файл не уходит на сервер. */
export async function getConnectionInfo(): Promise<{
  apiUrl: string;
  online: boolean;
  hasToken: boolean;
  hint: string;
}> {
  const online = await checkBackendHealth();
  const hasToken = getToken() !== null;
  let hint = "Сервер подключён — методички будут сохраняться на сервере.";
  if (!isApiEnabled()) {
    hint = "API выключен (VITE_API_URL пуст). Файлы сохраняются локально.";
  } else if (!online) {
    hint =
      `Сервер не отвечает по адресу ${API_URL}. Убедитесь, что бэкенд запущен ` +
      "(docker compose up -d) и сайт открыт локально (localhost:5173 или IP:5173), а не через предпросмотр.";
  } else if (!hasToken) {
    hint = "Сервер онлайн, но нет токена: войдите через сервер (кнопка «Перезайти»), иначе файл сохранится только локально.";
  }
  return { apiUrl: API_URL, online, hasToken, hint };
}

/* ─────────────────── Токен авторизации (JWT) ─────────────────── */

const TOKEN_KEY = "komi-token-v1";

/** Сохранить JWT-токен, полученный при входе/регистрации. */
export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch { /* ок */ }
}

/** Текущий токен (null, если не вошли через сервер). */
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch { /* ок */ }
}

/** true, если есть живой серверный токен (авторизация через БД). */
export const hasServerAuth = (): boolean => getToken() !== null;

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  /* Если есть токен — автоматически подставляем его в заголовок. */
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const msg = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(msg || `Ошибка ${res.status}`);
  }
  return (await res.json()) as T;
}

/** Сброс пароля (см. backend/app/main.py: POST /api/auth/forgot-password). */
export function requestPasswordReset(email: string) {
  return apiFetch<{ ok: boolean; message: string }>("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

/** Привязка ученика к преподавателю по коду (POST /api/students/bind-teacher). */
export function bindTeacherApi(teacherCode: string, token: string) {
  return apiFetch<{
    ok: boolean;
    teacher: { id: string; nickname: string; full_name: string; code: string };
  }>("/api/students/bind-teacher", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ teacher_code: teacherCode }),
  });
}

/** Отвязка от преподавателя (DELETE /api/students/bind-teacher). */
export function unbindTeacherApi(token: string) {
  return apiFetch<{ ok: boolean }>("/api/students/bind-teacher", {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

/* ─────────────────────────── Варианты (API v1) ─────────────────────────── */

export interface VariantUploadResult {
  variant_id: string;
  short_code: string;
  public_url: string;
}

/** Публичный профиль пользователя, возвращаемый сервером. */
export interface ApiUser {
  id: string;
  nickname: string;
  full_name: string | null;
  role: "student" | "teacher" | "admin";
  email: string | null;
  teacher_id: string | null;
  teacher_code: string | null;
}

interface AuthResult {
  token: string;
  role: string;
  nickname: string;
  user: ApiUser;
  recovery_code?: string;
  teacher_id?: string | null;
}

/**
 * Универсальный вход через сервер (по нику или email) → JWT-токен.
 * Токен сохраняется автоматически (setToken) и дальше подставляется
 * во все запросы. Возвращает профиль пользователя.
 */
export async function apiLogin(identifier: { nickname?: string; email?: string }, password: string): Promise<ApiUser> {
  const res = await apiFetch<AuthResult>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ ...identifier, password }),
  });
  setToken(res.token);
  return res.user;
}

/**
 * Регистрация через сервер. Возвращает профиль + резервный код
 * (показывается один раз). Токен сохраняется автоматически.
 */
export async function apiRegister(data: {
  nickname: string;
  password: string;
  full_name?: string;
  email?: string;
  teacher_code?: string;
}): Promise<ApiUser & { recovery_code: string }> {
  const res = await apiFetch<AuthResult & { recovery_code: string }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
  setToken(res.token);
  return { ...res.user, recovery_code: res.recovery_code };
}

/**
 * Публикация варианта на сервере (POST /api/v1/variants/upload, только преподаватель).
 * Токен подставляется автоматически из сессии (apiFetch).
 */
export function uploadVariant(payload: unknown) {
  return apiFetch<VariantUploadResult>("/api/v1/variants/upload", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/* ─────────────────── Попытки (связь с БД) ─────────────────── */

/**
 * Отправка попытки на сервер (POST /api/v1/attempts/submit).
 * Автопроверка части 1 происходит на сервере; попытка становится видна
 * преподавателю в кабинете. Требуется серверный токен (apiFetch подставит).
 */
export function submitAttemptApi(variantId: string, answers: { task_number: number; answer: string }[]) {
  return apiFetch<{ id: string; primary_score: number; secondary_score: number; answered: number }>(
    "/api/v1/attempts/submit",
    { method: "POST", body: JSON.stringify({ variant_id: variantId, answers }) }
  );
}

/** Ученики преподавателя со статистикой (GET /api/teacher/students). */
export function fetchTeacherStudents() {
  return apiFetch<{
    students: {
      id: string; nickname: string; full_name: string | null;
      attempts: number; avg_score: number | null; best_score: number | null;
    }[];
  }>("/api/teacher/students");
}

/** ВСЕ ученики из БД для «Статистики сайта» (GET /api/admin/students). */
export function fetchAdminStudents() {
  return apiFetch<{
    students: {
      id: string; nickname: string; full_name: string | null; goal: number | null;
      streak_days: number; xp: number; created_at: string | null;
      attempts: number; avg_score: number | null; best_score: number | null; solved: number;
    }[];
  }>("/api/admin/students");
}

/** Публичное получение варианта по UUID или короткому коду (GET /api/v1/variants/{id}). */
export function fetchVariant(variantId: string) {
  return apiFetch<{
    id: string;
    variantTitle: string;
    subject: string;
    timeLimitMinutes: number;
    tasks: unknown[];
    publicUrl: string;
  }>(`/api/v1/variants/${variantId}`);
}
