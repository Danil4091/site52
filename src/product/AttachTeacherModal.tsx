import { useEffect, useState } from "react";
import { GraduationCap, KeyRound, X } from "lucide-react";
import { useApp } from "./store";

/**
 * Модалка привязки ученика к преподавателю по коду приглашения.
 * Открывается из Part2Task, когда включён автономный режим.
 */
export default function AttachTeacherModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { attachTeacher, pushToast } = useApp();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setCode(""); setError(null); setBusy(false); }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = () => {
    if (!code.trim()) { setError("Введите код преподавателя"); return; }
    setBusy(true);
    /* небольшая задержка, чтобы привязка ощущалась как запрос к серверу */
    setTimeout(() => {
      const res = attachTeacher(code);
      setBusy(false);
      if (!res.ok) {
        setError("Код не найден. Проверьте приглашение или запросите код у преподавателя.");
        return;
      }
      pushToast(`Вы привязаны к преподавателю: ${res.teacherName}`);
      onClose();
    }, 450);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-board-950/70 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="pop-in w-full max-w-md rounded-t-2xl border border-board-600/60 bg-board-850 p-6 shadow-2xl sm:rounded-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Привязка к преподавателю">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-mark-yellow text-board-950">
              <GraduationCap className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold tracking-tight text-chalk-50">Код преподавателя</h2>
              <p className="text-[11px] text-chalk-500">откроет автопроверку второй части</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-chalk-500 transition-colors hover:bg-board-700 hover:text-chalk-50" aria-label="Закрыть">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative mt-5">
          <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-chalk-500" />
          <input
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null); }}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Например KOMI-2026"
            className="w-full rounded-lg border-2 border-board-600/70 bg-board-800/60 py-2.5 pl-9 pr-3.5 font-mono text-sm font-semibold tracking-widest text-chalk-50 outline-none transition-all placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder:text-chalk-500 focus:border-mark-yellow focus:ring-4 focus:ring-mark-yellow/10"
            aria-label="Код преподавателя"
            autoFocus
          />
        </div>

        {error && <p className="mt-2.5 text-[12.5px] font-semibold text-mark-red">{error}</p>}

        <button
          onClick={submit}
          disabled={busy}
          className="mt-4 w-full rounded-lg bg-mark-yellow py-3 text-sm font-bold text-board-950 shadow-md transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? "Проверяем…" : "Привязать преподавателя"}
        </button>

        <p className="mt-3 text-center text-[11px] leading-relaxed text-chalk-500">
          Код выдаёт преподаватель на занятии или в личном сообщении. Для демо подойдёт <b className="font-mono text-mark-yellow">KOMI-2026</b>.
        </p>
      </div>
    </div>
  );
}
