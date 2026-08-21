import { useEffect, useState } from "react";
import { Eye, EyeOff, GraduationCap, KeyRound, LogIn, UserPlus, X } from "lucide-react";
import { useApp, loadSession, type ProductUser } from "./store";
import { ADMIN_DISPLAY_NAME, ADMIN_NICKNAME, ADMIN_PASSWORD, ADMIN_TEACHER_CODE } from "./config";
import { resolveTeacher } from "./variantSchema";
import { isApiEnabled } from "./api";
import type { LegalDoc } from "./LegalDocs";

type StoredUser = ProductUser & { password: string };

const USERS_KEY = "komi-users-v1";

/**
 * Чистая авторизация (без демо-кнопок).
 * Вход: ник + пароль. Регистрация: ник, пароль, подтверждение, опц. код преподавателя.
 * В автономном режиме мастер-аккаунт преподавателя создаётся автоматически
 * (в продакшене это делает backend/scripts/create_admin.py из серверного .env).
 */
function loadUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) return p;
    }
  } catch { /* ок */ }
  return [];
}

function saveUsers(users: StoredUser[]) {
  try { localStorage.setItem(USERS_KEY, JSON.stringify(users)); } catch { /* ок */ }
}

/** Автосид мастер-аккаунта преподавателя (только автономный режим). */
function seedAdminIfNeeded() {
  if (isApiEnabled()) return; // в продакшене — backend-скрипт
  const users = loadUsers();
  if (users.some((u) => u.nickname === ADMIN_NICKNAME && u.role === "teacher")) return;
  users.push({
    nickname: ADMIN_NICKNAME,
    name: ADMIN_DISPLAY_NAME,
    role: "teacher",
    password: ADMIN_PASSWORD,
    teacherCode: ADMIN_TEACHER_CODE,
  });
  saveUsers(users);
}

export default function AuthModal({
  open,
  onClose,
  onOpenLegal,
  onForgot,
}: {
  open: boolean;
  onClose: () => void;
  onOpenLegal: (doc: LegalDoc) => void;
  onForgot: () => void;
}) {
  const { login } = useApp();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [invite, setInvite] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* при первом открытии — гарантируем мастер-аккаунт преподавателя */
  useEffect(() => { seedAdminIfNeeded(); }, []);

  /* автоподхват реферального кода преподавателя из URL: ?ref=ARTEM-PRO */
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref && ref.trim()) {
      setInvite(ref.trim().toUpperCase());
      setTab("register");
    }
  }, []);

  useEffect(() => {
    if (open) { setTab("login"); setError(null); setConsent(false); setPassword2(""); }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const field =
    "w-full rounded-lg border-2 border-board-600/70 bg-board-800/60 px-3.5 py-2.5 text-sm font-medium text-chalk-50 outline-none transition-all duration-200 placeholder:text-chalk-500 focus:border-mark-yellow focus:bg-board-800 focus:ring-4 focus:ring-mark-yellow/10";

  const cleanNick = (v: string) => v.trim().replace(/^@/, "").toLowerCase();

  const submit = () => {
    setError(null);
    const users = loadUsers();
    const nick = cleanNick(nickname);

    if (tab === "login") {
      if (!nick) { setError("Введите ник"); return; }
      const found = users.find((u) => u.nickname === nick && u.password === password);
      if (!found) { setError("Неверный ник или пароль"); return; }
      const { password: _pw, ...rest } = found;
      login(rest);
      onClose();
      return;
    }

    /* ── регистрация ── */
    if (!nick) { setError("Укажите ник — именно он будет виден в рейтинге"); return; }
    if (!/^[a-z0-9_]{3,16}$/.test(nick)) { setError("Ник: 3–16 символов, латиница, цифры и «_»"); return; }
    if (password.length < 4) { setError("Пароль — минимум 4 символа"); return; }
    if (password !== password2) { setError("Пароли не совпадают"); return; }
    if (!consent) { setError("Необходимо согласие на обработку персональных данных"); return; }
    if (users.some((u) => u.nickname === nick)) { setError("Такой ник уже занят — войдите или выберите другой"); return; }

    const code = invite.trim().toUpperCase();
    const teacherName = code ? resolveTeacher(code) : null;

    const user: StoredUser = {
      nickname: nick,
      role: "student",
      password,
      teacherCode: code || undefined,
      teacherName: teacherName ?? undefined,
      consentVersion: "1.0",
      consentAt: new Date().toISOString(),
    };
    saveUsers([...users, user]);
    const { password: _pw, ...rest } = user;
    login(rest);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-board-950/70 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="pop-in max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-board-600/60 bg-board-850 p-6 shadow-2xl sm:rounded-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Вход на платформу">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-mark-yellow text-board-950">
              <GraduationCap className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold tracking-tight text-chalk-50">Репетитор из Коми</h2>
              <p className="text-[11px] text-chalk-500">{tab === "login" ? "вход по нику и паролю" : "создание аккаунта"}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-chalk-500 transition-colors hover:bg-board-700 hover:text-chalk-50" aria-label="Закрыть">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 rounded-lg border border-board-600/70 bg-board-800/60 p-1">
          {(["login", "register"] as const).map((t) => (
            <button key={t} onClick={() => { setTab(t); setError(null); }}
              className={`flex items-center justify-center gap-1.5 rounded-md py-2 text-[13px] font-bold transition-all duration-200 ${tab === t ? "bg-mark-yellow text-board-950 shadow-sm" : "text-chalk-400 hover:text-chalk-50"}`}>
              {t === "login" ? <LogIn className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
              {t === "login" ? "Вход" : "Регистрация"}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Никнейм — например masha_2026"
            className={field}
            aria-label="Никнейм"
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <div className="relative">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Пароль"
              type={showPw ? "text" : "password"}
              className={`${field} pr-11`}
              aria-label="Пароль"
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-chalk-500 transition-colors hover:text-chalk-200" aria-label={showPw ? "Скрыть пароль" : "Показать пароль"}>
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {tab === "register" && (
            <>
              <input
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                placeholder="Повторите пароль"
                type={showPw ? "text" : "password"}
                className={field}
                aria-label="Подтверждение пароля"
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-chalk-500" />
                <input
                  value={invite}
                  onChange={(e) => setInvite(e.target.value.toUpperCase())}
                  placeholder="Код преподавателя (необязательно)"
                  className={`${field} pl-9 font-mono tracking-wider`}
                  aria-label="Код преподавателя"
                />
              </div>
              <p className="-mt-1.5 text-[10.5px] leading-snug text-chalk-500">
                Введите код вашего репетитора для проверки 2-й части. Без кода вы работаете в бесплатном автономном режиме.
              </p>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-board-600/70 bg-board-800/40 px-3 py-2.5 transition-colors hover:border-board-600">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-mark-yellow" />
                <span className="text-[11.5px] leading-relaxed text-chalk-300">
                  Я согласен(на) на обработку персональных данных и принимаю условия{" "}
                  <button type="button" onClick={() => onOpenLegal("terms")} className="font-bold text-mark-yellow underline-offset-2 hover:underline">Пользовательского соглашения</button>{" "}
                  и{" "}
                  <button type="button" onClick={() => onOpenLegal("privacy")} className="font-bold text-mark-yellow underline-offset-2 hover:underline">Политики конфиденциальности</button>
                </span>
              </label>
            </>
          )}

          {tab === "login" && (
            <button type="button" onClick={onForgot} className="text-[11.5px] font-semibold text-mark-blue transition-colors hover:text-chalk-50">
              Забыли пароль?
            </button>
          )}
        </div>

        {error && <p className="mt-3 text-[12.5px] font-semibold text-mark-red">{error}</p>}

        <button onClick={submit} className="mt-5 w-full rounded-lg bg-mark-yellow py-3 text-sm font-bold text-board-950 shadow-md transition-all duration-200 hover:brightness-110 active:scale-[0.98]">
          {tab === "login" ? "Войти" : "Создать аккаунт"}
        </button>
      </div>
    </div>
  );
}

export { loadSession };
