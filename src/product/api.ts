/* ══════════════════════════════════════════════════════════════════
   Конфигурация API (production readiness).
   Базовый URL берётся из переменной окружения VITE_API_URL
   (файл .env в корне фронтенда). В демо-режиме, когда бэкенд не
   поднят, приложение работает на localStorage, а эти хелперы
   используются при подключении реального сервера.
   ══════════════════════════════════════════════════════════════════ */

export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export const isApiEnabled = (): boolean => API_URL.length > 0;

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
