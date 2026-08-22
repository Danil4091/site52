import { useState } from "react";
import {
  CheckCircle2, Download, GraduationCap, KeyRound, Link2, LogOut,
  ShieldCheck, Sparkles, Target, Trash2, Unlink, UserRound,
} from "lucide-react";
import { useApp } from "./store";
import { Avatar, StreakFlame, TitleBadge, XpBar, levelFromXp } from "./ui";
import { ADMIN_TEACHER_CODE } from "./config";
import { isApiEnabled, bindTeacherApi } from "./api";

/**
 * Настройки профиля ученика / преподавателя.
 * Ключевой блок — «Мой преподаватель»: привязка по коду приглашения.
 * Вся накопленная статистика (попытки, XP, журнал ошибок) ключуется по нику,
 * поэтому при привязке она моментально становится видна в кабинете репетитора.
 */
export default function ProfileSettings() {
  const {
    user, streak, go, logout, patchUser,
    bindTeacherLocal, unbindTeacherLocal,
    collectExport, deleteAccount, pushToast, attempts,
  } = useApp();

  const [editingCode, setEditingCode] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [busy, setBusy] = useState(false);

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <UserRound className="mx-auto h-10 w-10 text-chalk-500" />
        <p className="mt-3 font-display text-lg font-bold text-chalk-200">Вы не вошли в аккаунт</p>
        <button onClick={() => go("home")} className="btn-gold mt-4 px-5 py-2.5 text-sm">На главную</button>
      </div>
    );
  }

  const isTeacher = user.role === "teacher";
  const linked = !!user.teacherCode;
  const level = levelFromXp(streak.xp);
  const bestScore = attempts.length ? Math.max(...attempts.map((a) => a.secondary)) : null;

  /* ── привязка: сначала пробуем сервер, потом локально ── */
  const doBind = async () => {
    const code = codeInput.trim().toUpperCase();
    if (!code) { pushToast("Введите код преподавателя"); return; }
    setBusy(true);
    let ok = false;
    let teacherName: string | undefined;

      if (isApiEnabled()) {
      try {
        const token = localStorage.getItem("komi-token") ?? "";
        const res = await bindTeacherApi(token, code);
        ok = res.ok;
        teacherName = res.teacher.nickname;
      } catch {
        /* сервер недоступен/код не найден → пробуем локально */
      }
    }    if (!ok) {
      const local = bindTeacherLocal(code);
      ok = local.ok;
      teacherName = local.teacherName;
    }

    setBusy(false);
    if (ok) {
      setEditingCode(false);
      setCodeInput("");
      pushToast(`Привязан к преподавателю @${teacherName ?? code}`);
    } else {
      pushToast(`Преподаватель с кодом ${code} не найден`);
    }
  };

  const doUnbind = () => {
    unbindTeacherLocal();
    setEditingCode(false);
    setCodeInput("");
    pushToast("Отвязан от преподавателя");
  };

  const downloadData = () => {
    const data = collectExport();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `komi-${user.nickname}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast("Данные выгружены в JSON");
  };

  const label = "mb-1 block text-[10.5px] font-bold uppercase tracking-wider text-chalk-500";
  const input = "w-full rounded-lg border border-board-600/70 bg-board-950/50 px-3 py-2.5 font-mono text-[14px] uppercase tracking-wider text-chalk-50 outline-none transition-all placeholder:normal-case placeholder:tracking-normal placeholder:text-chalk-600 focus:border-mark-yellow";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-5">
      <p className="rise tick text-mark-yellow">Личный кабинет</p>
      <h1 className="rise rise-1 mt-2 font-display text-3xl font-bold tracking-tight text-chalk-50 sm:text-4xl">Настройки профиля</h1>

      {/* ── карточка профиля ── */}
      <div className="rise rise-2 card mt-6 p-5">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={user.nickname} className="h-16 w-16 text-xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-xl font-bold text-chalk-50">@{user.nickname}</p>
              <span className={`chip !text-[10px] ${isTeacher ? "!border-mark-blue/50 !text-mark-blue" : "!border-mark-green/50 !text-mark-green"}`}>
                {isTeacher ? "преподаватель" : "ученик"}
              </span>
            </div>
            {user.name && <p className="mt-0.5 text-[12.5px] text-chalk-400">{user.name}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className="chip !text-[10.5px]"><Sparkles className="h-3.5 w-3.5 text-mark-yellow" />LVL {level}</span>
              <span className="chip !text-[10.5px]"><Target className="h-3.5 w-3.5 text-mark-blue" />Цель: {user.goal ?? "—"} б.</span>
              {bestScore !== null && <span className="chip !text-[10.5px]"><GraduationCap className="h-3.5 w-3.5 text-mark-green" />Лучший: {bestScore} б.</span>}
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <XpBar xp={streak.xp} />
          <StreakFlame days={streak.days} active={!!streak.last} freezes={streak.freezes} />
        </div>
        {!isTeacher && (
          <div className="mt-4 border-t border-board-700/60 pt-4">
            <label className={label}>Цель по баллам · {user.goal ?? 80}</label>
            <input
              type="range" min={40} max={100} step={2} value={user.goal ?? 80}
              onChange={(e) => patchUser({ goal: Number(e.target.value) })}
              className="w-full accent-[var(--color-mark-yellow)]"
            />
          </div>
        )}
      </div>

      {/* ── Мой преподаватель ── */}
      {!isTeacher && (
        <div className="rise rise-3 card mt-5 p-5">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-mark-blue/15 text-mark-blue"><Link2 className="h-4.5 w-4.5" /></span>
            <div>
              <h2 className="font-display text-base font-bold text-chalk-50">Мой преподаватель</h2>
              <p className="text-[11.5px] text-chalk-500">привязка по коду — открывает проверку части 2 и попадание в кабинет репетитора</p>
            </div>
          </div>

          {linked && !editingCode ? (
            /* уже привязан */
            <div className="mt-4 rounded-xl border border-mark-green/40 bg-mark-green/8 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Avatar name={user.teacherName ?? user.teacherCode ?? "?"} className="h-11 w-11 text-[13px]" />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[15px] font-bold text-chalk-50">@{user.teacherName ?? user.teacherCode}</p>
                  <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-mark-green">
                    <CheckCircle2 className="h-3.5 w-3.5" />Подключен · код {user.teacherCode}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-[11.5px] leading-relaxed text-chalk-400">
                Вся ваша статистика (попытки, баллы, XP, журнал ошибок) видна этому преподавателю в кабинете.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => { setEditingCode(true); setCodeInput(""); }} className="btn-ghost px-4 py-2 text-[12.5px]">
                  <KeyRound className="h-3.5 w-3.5" />Сменить код
                </button>
                <button onClick={doUnbind} className="btn-ghost !border-mark-red/40 !text-mark-red px-4 py-2 text-[12.5px]">
                  <Unlink className="h-3.5 w-3.5" />Отвязать
                </button>
              </div>
            </div>
          ) : (
            /* ввод кода */
            <div className="mt-4">
              <label className={label}>Код преподавателя</label>
              <div className="flex gap-2">
                <input
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  placeholder={ADMIN_TEACHER_CODE}
                  className={input}
                  onKeyDown={(e) => e.key === "Enter" && doBind()}
                  disabled={busy}
                />
                <button onClick={doBind} disabled={busy} className="btn-gold shrink-0 px-5 py-2.5 text-[13px] disabled:opacity-50">
                  {busy ? "Привязываем…" : "Привязать"}
                </button>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-chalk-500">
                Код даёт репетитор (например, <b className="font-mono text-mark-yellow">{ADMIN_TEACHER_CODE}</b>).
                После привязки ваши решения части 2 сможет проверять преподаватель, а ваша динамика появится у него в кабинете.
              </p>
              {linked && editingCode && (
                <button onClick={() => setEditingCode(false)} className="mt-2 text-[11.5px] font-bold text-chalk-400 underline decoration-chalk-500/40 underline-offset-2 hover:text-chalk-200">
                  Отмена — оставить @{user.teacherName ?? user.teacherCode}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Данные и аккаунт ── */}
      <div className="rise rise-4 card mt-5 p-5">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-mark-yellow/15 text-mark-yellow"><ShieldCheck className="h-4.5 w-4.5" /></span>
          <div>
            <h2 className="font-display text-base font-bold text-chalk-50">Данные и аккаунт</h2>
            <p className="text-[11.5px] text-chalk-500">152-ФЗ: вы управляете своими персональными данными</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={downloadData} className="btn-ghost px-4 py-2.5 text-[12.5px]">
            <Download className="h-3.5 w-3.5" />Скачать мои данные (JSON)
          </button>
          <button onClick={logout} className="btn-ghost px-4 py-2.5 text-[12.5px]">
            <LogOut className="h-3.5 w-3.5" />Выйти
          </button>
          <button onClick={() => { if (window.confirm("Удалить аккаунт и всю статистику безвозвратно?")) deleteAccount(); }}
            className="btn-ghost !border-mark-red/40 !text-mark-red px-4 py-2.5 text-[12.5px]">
            <Trash2 className="h-3.5 w-3.5" />Удалить аккаунт
          </button>
        </div>
      </div>
    </div>
  );
}
