import { useEffect, useState } from "react";
import { ArrowLeft, KeyRound, Mail, X } from "lucide-react";
import { isApiEnabled, requestPasswordReset } from "./api";

/* ══════════════════════════════════════════════════════════════════
   Восстановление забытого пароля по E-mail.
   В демо-режиме имитирует отправку письма; в продакшене замените
   handleSubmit на вызов API (POST /api/auth/forgot-password).
   ══════════════════════════════════════════════════════════════════ */

export default function ForgotPasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setEmail(""); setSent(false); setError(null); }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async () => {
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError("Похоже, в e-mail опечатка"); return; }
    try {
      if (isApiEnabled()) await requestPasswordReset(email.trim());
      // в демо-режиме просто показываем подтверждение
      setSent(true);
    } catch {
      setSent(true); // не раскрываем, зарегистрирован ли e-mail
    }
  };

  const field =
    "w-full rounded-lg border-2 border-board-600/70 bg-board-800/60 px-3.5 py-2.5 text-sm font-medium text-chalk-50 outline-none transition-all duration-200 placeholder:text-chalk-500 focus:border-mark-yellow focus:bg-board-800 focus:ring-4 focus:ring-mark-yellow/10";

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-board-950/80 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="pop-in w-full max-w-md rounded-t-2xl border border-board-600/60 bg-board-850 p-6 shadow-2xl sm:rounded-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Восстановление пароля">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-mark-blue/15 text-mark-blue">
              <KeyRound className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold tracking-tight text-chalk-50">Восстановление пароля</h2>
              <p className="text-[11px] text-chalk-500">пришлём ссылку для сброса на e-mail</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-chalk-500 transition-colors hover:bg-board-700 hover:text-chalk-50" aria-label="Закрыть">
            <X className="h-4 w-4" />
          </button>
        </div>

        {sent ? (
          <div className="mt-6 text-center">
            <span className="pop-in mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-mark-green/15">
              <Mail className="h-6 w-6 text-mark-green" />
            </span>
            <p className="mt-4 text-[13.5px] font-semibold text-chalk-100">Письмо отправлено на {email.trim()}</p>
            <p className="mx-auto mt-1.5 max-w-xs text-[12px] leading-relaxed text-chalk-400">
              Перейдите по ссылке в письме, чтобы задать новый пароль. Ссылка действительна 30 минут.
            </p>
            <button onClick={onClose} className="mt-5 w-full rounded-lg bg-mark-yellow py-2.5 text-sm font-bold text-board-950 transition-all hover:brightness-110 active:scale-[0.98]">
              Понятно
            </button>
          </div>
        ) : (
          <>
            <p className="mt-4 text-[12.5px] leading-relaxed text-chalk-400">
              Укажите e-mail, на который зарегистрирован аккаунт. Мы отправим письмо со ссылкой для создания нового пароля.
            </p>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="E-mail"
              type="email"
              className={`${field} mt-3`}
              aria-label="E-mail для восстановления"
              autoFocus
            />
            {error && <p className="mt-2 text-[12px] font-semibold text-mark-red">{error}</p>}
            <button onClick={submit} className="mt-4 w-full rounded-lg bg-mark-yellow py-3 text-sm font-bold text-board-950 transition-all hover:brightness-110 active:scale-[0.98]">
              Отправить ссылку
            </button>
            <button onClick={onClose} className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-[12px] font-semibold text-chalk-400 transition-colors hover:text-chalk-100">
              <ArrowLeft className="h-3.5 w-3.5" /> Вернуться ко входу
            </button>
          </>
        )}
      </div>
    </div>
  );
}
