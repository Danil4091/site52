import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, ShieldCheck, X } from "lucide-react";
import { resetPasswordByCode, verifyRecoveryCode } from "./recovery";

/* ══════════════════════════════════════════════════════════════════
   Восстановление пароля БЕЗ почты — через резервный код.
   Ученик вводит ник + резервный код (выданный при регистрации)
   и задаёт новый пароль. Бесплатно, работает офлайн, без рассылок.
   ══════════════════════════════════════════════════════════════════ */

export default function ForgotPasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setNickname(""); setCode(""); setNewPassword(""); setDone(false); setError(null); }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const cleanNick = (v: string) => v.trim().replace(/^@/, "").toLowerCase();

  const submit = () => {
    setError(null);
    const nick = cleanNick(nickname);
    if (!nick) { setError("Введите ник"); return; }
    if (!code.trim()) { setError("Введите резервный код"); return; }
    if (newPassword.length < 4) { setError("Новый пароль — минимум 4 символа"); return; }

    if (!verifyRecoveryCode(nick, code)) {
      setError("Код не подошёл. Проверьте, что вводите код, выданный при регистрации.");
      return;
    }
    const ok = resetPasswordByCode(nick, code, newPassword);
    if (!ok) { setError("Не удалось сменить пароль. Проверьте ник и код."); return; }
    setDone(true);
  };

  const field =
    "w-full rounded-lg border-2 border-board-600/70 bg-board-800/60 px-3.5 py-2.5 text-sm font-medium text-chalk-50 outline-none transition-all duration-200 placeholder:text-chalk-500 focus:border-mark-yellow focus:bg-board-800 focus:ring-4 focus:ring-mark-yellow/10";

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-board-950/80 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="pop-in max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-board-600/60 bg-board-850 p-6 shadow-2xl sm:rounded-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Восстановление пароля">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-mark-blue/15 text-mark-blue">
              <KeyRound className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold tracking-tight text-chalk-50">Восстановление пароля</h2>
              <p className="text-[11px] text-chalk-500">по резервному коду — без почты</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-chalk-500 transition-colors hover:bg-board-700 hover:text-chalk-50" aria-label="Закрыть">
            <X className="h-4 w-4" />
          </button>
        </div>

        {done ? (
          <div className="mt-6 text-center">
            <span className="pop-in mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-mark-green/15">
              <CheckCircle2 className="h-6 w-6 text-mark-green" />
            </span>
            <p className="mt-4 text-[13.5px] font-semibold text-chalk-100">Пароль обновлён</p>
            <p className="mx-auto mt-1.5 max-w-xs text-[12px] leading-relaxed text-chalk-400">
              Теперь войдите с новым паролем. Резервный код остался прежним — сохраните его.
            </p>
            <button onClick={onClose} className="mt-5 w-full rounded-lg bg-mark-yellow py-2.5 text-sm font-bold text-board-950 transition-all hover:brightness-110 active:scale-[0.98]">
              Ко входу
            </button>
          </div>
        ) : (
          <>
            <p className="mt-4 text-[12.5px] leading-relaxed text-chalk-400">
              Введите ник и резервный код, который вы получили при регистрации и сохранили. Затем задайте новый пароль.
            </p>
            <div className="mt-4 space-y-3">
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Ваш ник"
                className={field}
                aria-label="Ник"
              />
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-chalk-500" />
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Резервный код — например KX7Q-AB3D"
                  className={`${field} pl-9 font-mono tracking-wider`}
                  aria-label="Резервный код"
                />
              </div>
              <input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Новый пароль (минимум 4 символа)"
                type="password"
                className={field}
                aria-label="Новый пароль"
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
            </div>

            {error && <p className="mt-3 text-[12.5px] font-semibold text-mark-red">{error}</p>}

            <button onClick={submit} className="mt-5 w-full rounded-lg bg-mark-yellow py-3 text-sm font-bold text-board-950 shadow-md transition-all duration-200 hover:brightness-110 active:scale-[0.98]">
              Сменить пароль
            </button>

            <div className="mt-4 flex items-start gap-2 rounded-lg border border-board-600/60 bg-board-800/40 px-3 py-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-mark-blue" />
              <p className="text-[11px] leading-relaxed text-chalk-500">
                Нет кода или он утерян? Напишите своему преподавателю — он сбросит вам пароль в своём кабинете и передаст новый лично.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
