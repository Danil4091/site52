import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock3, Flag, XCircle } from "lucide-react";
import { useApp } from "./store";
import { AnswerInput, LatexText } from "./ui";
import Part2Task from "./Part2Task";
import { answersMatch, SCALE } from "./data";
import type { VariantTaskDef } from "./variantSchema";

/**
 * Запуск авторского (опубликованного) варианта по уникальной ссылке.
 *
 * Автономный режим: первая часть, подсчёт первичного и тестового баллов
 * работают полностью без авторизации и без привязки к преподавателю.
 * Вторая часть рендерится через Part2Task (с гейтингом по преподавателю).
 */
export default function PublishedVariantRunner() {
  const { activeVariant, go, recordPublishedAttempt, user } = useApp();
  const v = activeVariant;

  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [secondsLeft, setSecondsLeft] = useState((v?.timeLimitMinutes ?? 235) * 60);
  const [finished, setFinished] = useState(false);

  const short = useMemo(() => (v ? v.tasks.filter((t) => t.type === "short_answer") : []), [v]);
  const detailed = useMemo(() => (v ? v.tasks.filter((t) => t.type === "detailed_answer") : []), [v]);

  /* таймер варианта */
  useEffect(() => {
    if (!v || finished) return;
    const id = setInterval(() => setSecondsLeft((s) => (s <= 1 ? (setFinished(true), 0) : s - 1)), 1000);
    return () => clearInterval(id);
  }, [v, finished]);

  /* сброс при смене варианта */
  useEffect(() => {
    setAnswers({});
    setFinished(false);
    setSecondsLeft((v?.timeLimitMinutes ?? 235) * 60);
  }, [v?.id]);

  if (!v) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="font-display text-xl font-bold text-chalk-50">Вариант не найден</p>
        <p className="mt-2 text-[13px] text-chalk-400">Ссылка недействительна или вариант ещё не опубликован на этом устройстве.</p>
        <button onClick={() => go("variants")} className="btn-gold mt-5 px-6 py-3 text-sm">К вариантам</button>
      </div>
    );
  }

  /* ── подсчёт баллов по первой части (работает без авторизации) ── */
  const rows = short.map((t) => {
    const given = (answers[t.number] ?? "").trim() || null;
    const correct = given !== null && t.answer !== null && answersMatch(given, t.answer);
    return { task: t, given, correct };
  });
  const correctCount = rows.filter((r) => r.correct).length;
  const primary = rows.reduce((s, r) => s + (r.correct ? r.task.points : 0), 0);
  const maxPrimary = short.reduce((s, t) => s + t.points, 0);
  const secondary = maxPrimary > 0 ? (primary <= 31 ? (SCALE[primary] ?? Math.round((primary / maxPrimary) * 100)) : Math.round((primary / maxPrimary) * 100)) : 0;
  const mistakes = rows.filter((r) => r.given !== null && !r.correct).length;

  const submit = () => {
    if (finished) return;
    setFinished(true);
    recordPublishedAttempt(v.variantTitle, primary, secondary, mistakes);
    window.scrollTo({ top: 0 });
  };

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-5">
      {/* шапка */}
      <div className="rise flex flex-wrap items-center gap-3">
        <button onClick={() => go("variants")} className="btn-ghost px-3 py-2 text-[12.5px] !text-chalk-400 hover:!text-mark-red">
          <ArrowLeft className="h-4 w-4" /> Выйти
        </button>
        <div className="min-w-0 flex-1">
          <p className="tick text-mark-yellow">Авторский вариант{user ? "" : " · автономный режим"}</p>
          <h1 className="truncate font-display text-lg font-bold text-chalk-50">{v.variantTitle}</h1>
        </div>
        <span className={`flex items-center gap-2 rounded-lg border px-3 py-2 font-mono text-sm font-bold tabular-nums ${secondsLeft < 30 * 60 ? "border-mark-red/50 bg-mark-red/10 text-mark-red" : "border-board-600/70 bg-board-800/60 text-chalk-100"}`}>
          <Clock3 className="h-4 w-4" />{fmt(secondsLeft)}
        </span>
      </div>

      {/* результат после завершения */}
      {finished && (
        <div className="pop-in card mt-5 border-mark-green/40 p-6 text-center">
          <p className="tick text-mark-green">Вариант завершён</p>
          <p className="mt-1 font-display text-5xl font-bold tabular-nums text-chalk-50">{secondary}</p>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-chalk-500">тестовый балл</p>
          <p className="mt-2 text-[13px] text-chalk-300">
            Первичный балл (часть 1): <b className="text-mark-yellow">{primary}</b> из {maxPrimary} · верно {correctCount} из {short.length}
          </p>
          <p className="mt-1 text-[11.5px] text-chalk-500">
            {detailed.length > 0 ? `Развёрнутые ответы (${detailed.length}) отправлены на проверку преподавателю.` : "Все задания с автопроверкой."}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button onClick={() => go("analytics")} className="btn-gold px-5 py-2.5 text-sm">Аналитика</button>
            <button onClick={() => go("variants")} className="btn-ghost px-5 py-2.5 text-sm">Другой вариант</button>
          </div>
        </div>
      )}

      {/* часть 1 */}
      {short.length > 0 && (
        <>
          <p className="tick mt-7 text-mark-yellow">Часть 1 · краткий ответ</p>
          <div className="mt-3 space-y-4">
            {short.map((t, i) => {
              const r = rows.find((x) => x.task.id === t.id)!;
              return (
                <div key={t.id} className={`card card-hover rise rise-${Math.min((i % 5) + 1, 5)} p-5`}>
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-board-700/80 font-display text-[14px] font-bold text-mark-yellow">{t.number}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold text-chalk-50">Задание {t.number} · {t.topic}</p>
                      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-chalk-500">{t.points} б. · короткий ответ</p>
                    </div>
                    {finished && (
                      <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${r.correct ? "bg-mark-green/15 text-mark-green" : "bg-mark-red/15 text-mark-red"}`}>
                        {r.correct ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                        {r.correct ? "верно" : "неверно"}
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-[14.5px] leading-relaxed text-chalk-100"><LatexText text={t.latex_statement} /></p>
                  <div className="mt-4 flex items-center gap-2">
                    <AnswerInput
                      label={`№${t.number} · ${t.topic}`}
                      value={answers[t.number] ?? ""}
                      onChange={(val) => setAnswers((x) => ({ ...x, [t.number]: val }))}
                      onSubmit={submit}
                      className="max-w-xs"
                    />
                    {finished && t.answer && <span className="font-mono text-[13px] font-bold text-mark-green">эталон: {t.answer}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* часть 2 */}
      {detailed.length > 0 && (
        <>
          <p className="tick mt-8 text-mark-blue">Часть 2 · развёрнутый ответ</p>
          <div className="mt-3 space-y-4">
            {detailed.map((t) => (
              <Part2Task key={t.id} task={t} />
            ))}
          </div>
        </>
      )}

      {/* кнопка завершения */}
      {!finished && (
        <div className="mt-8 flex justify-center">
          <button onClick={submit} className="btn-gold px-8 py-3.5 text-[15px]">
            <Flag className="h-4 w-4" /> Завершить и проверить часть 1
          </button>
        </div>
      )}
    </div>
  );
}
