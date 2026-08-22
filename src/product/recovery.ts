/* ══════════════════════════════════════════════════════════════════
   Восстановление пароля БЕЗ почты и без бота-рассыльщика.

   Два бесплатных механизма (идеальны для стартапа):
     1. РЕЗЕРВНЫЙ КОД — генерируется при регистрации, показывается ОДИН
        раз, ученик его сохраняет. Для восстановления: ник + код + новый пароль.
     2. СБРОС ЧЕРЕЗ ПРЕПОДАВАТЕЛЯ — учитель в кабинете генерирует ученику
        новый пароль и передаёт его лично (он и так доверенное лицо).

   В демо-режиме коды лежат в localStorage, в бою — на сервере
   (POST /api/auth/recover, POST /api/teacher/reset-student-password).
   ══════════════════════════════════════════════════════════════════ */

const CODES_KEY = "komi-recovery-codes-v1";

type CodeMap = Record<string, string>;

function readCodes(): CodeMap {
  try {
    const raw = localStorage.getItem(CODES_KEY);
    const v = raw ? JSON.parse(raw) : {};
    return v && typeof v === "object" ? (v as CodeMap) : {};
  } catch {
    return {};
  }
}
function writeCodes(m: CodeMap) {
  try { localStorage.setItem(CODES_KEY, JSON.stringify(m)); } catch { /* ок */ }
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // без 0/O/1/I — не перепутать

/** Генерирует человекочитаемый код вида KXYZ-ABCD. */
export function generateRecoveryCode(): string {
  let out = "";
  for (let i = 0; i < 8; i++) {
    if (i === 4) out += "-";
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

const normalizeCode = (c: string) => c.trim().toUpperCase().replace(/\s+/g, "");

/** Сохранить код для ника (вызывается при регистрации и при сбросе учителем). */
export function saveRecoveryCode(nickname: string, code: string): void {
  const m = readCodes();
  m[nickname.toLowerCase()] = normalizeCode(code);
  writeCodes(m);
}

/** Проверить код для ника. */
export function verifyRecoveryCode(nickname: string, code: string): boolean {
  const m = readCodes();
  const stored = m[nickname.toLowerCase()];
  if (!stored) return false;
  return stored === normalizeCode(code);
}

/** Есть ли у ника сохранённый код. */
export function hasRecoveryCode(nickname: string): boolean {
  const m = readCodes();
  return Boolean(m[nickname.toLowerCase()]);
}

/* ── демо-режим: смена пароля по резервному коду ── */

const USERS_KEY = "komi-users-v1";

interface StoredUserLike { nickname: string; password: string; [k: string]: unknown; }

function readUsers(): StoredUserLike[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? (v as StoredUserLike[]) : [];
  } catch {
    return [];
  }
}

/**
 * Сброс пароля по резервному коду (демо-режим).
 * Возвращает true при успехе. Код остаётся действительным —
 * его можно использовать повторно, пока ученик не сменит его в профиле.
 */
export function resetPasswordByCode(nickname: string, code: string, newPassword: string): boolean {
  const nick = nickname.trim().toLowerCase();
  if (!verifyRecoveryCode(nick, code)) return false;
  const users = readUsers();
  const u = users.find((x) => x.nickname === nick);
  if (!u) return false;
  u.password = newPassword;
  try { localStorage.setItem(USERS_KEY, JSON.stringify(users)); } catch { /* ок */ }
  return true;
}
