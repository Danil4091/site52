/* ══════════════════════════════════════════════════════════════════
   Конфигурация API (production readiness).
   Базовый URL берётся из переменной окружения VITE_API_URL
   (файл .env в корне фронтенда). В демо-режиме, когда бэкенд не
   поднят, приложение работает на localStorage, а эти хелперы
   используются при подключении реального сервера.
   ══════════════════════════════════════════════════════════════════ */

export const API_URL: string = ((import.meta.env.VITE_API_URL as string | undefined) ?? "").trim().replace(/\/+$/, "");

export const isApiEnabled = (): boolean => API_URL.length > 0;

/* Dev-диагностика: сразу видно, что попало в сборку из .env.
   Если в консоли «VITE_API_URL = (пусто)» — файл .env не подхватился:
   он должен лежать В КОРНЕ проекта (рядом с package.json), называться
   ровно «.env» (не .env.txt!) и требовать полного перезапуска npm run dev. */
if (import.meta.env.DEV) {
  console.info(
    `%c[API]%c VITE_API_URL = ${API_URL || "(пусто — демо-режим)"} · включён: ${isApiEnabled() ? "да" : "нет"}`,
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

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
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

/** Вход преподавателя → Bearer-токен (POST /api/v1/auth/login). */
export function loginTeacher(email: string, password: string) {
  return apiFetch<{ token: string; role: string; nickname: string }>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

/** Публикация варианта на сервере (POST /api/v1/variants/upload, только преподаватель). */
export function uploadVariant(payload: unknown, token: string) {
  return apiFetch<VariantUploadResult>("/api/v1/variants/upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
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
