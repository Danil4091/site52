import { useEffect, useState } from "react";
import { Bot, CheckCircle2, ChevronDown, Eye, EyeOff, Lock, Send, Sparkles } from "lucide-react";
import { useApp } from "./store";
import { LatexText } from "./ui";
import AttachTeacherModal from "./AttachTeacherModal";
import type { VariantTaskDef } from "./variantSchema";

/**
 * Карточка задачи с развёрнутым ответом (вторая часть ЕГЭ/ОГЭ).
 *
 * Логика доступа:
 *  — автономный режим (нет привязанного преподавателя): автопроверка ИИ
 *    скрыта, показан баннер и призыв ввести код преподавателя;
 *  — с преподавателем: доступны «Автопроверка ИИ / отправить преподавателю»
 *    и «Посмотреть эталонное решение».
 *
 * Первая часть и подсчёт баллов работают полностью без привязки (см. runner).
 */
export default function Part2Task({ task }: { task: VariantTaskDef }) {
  const { user, pushToast } = useApp();
  const hasTeacher = !!user?.teacherCode;

  const [draft, setDraft] = useState("");
  const [showSolution, setShowSolution] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);

  /* симуляция ИИ-проверки */
  const [aiState, setAiState] = useState<"idle" | "checking" | "done">("idle");
  const [aiFeedback, setAiFeedback] = useState<string[]>([]);
  const [sentToTeacher, setSentToTeacher] = useState(false);

  useEffect(() => {
    if (!hasTeacher) { setAiState("idle"); setSentToTeacher(false); }
  }, [hasTeacher]);

  const runAiCheck = () => {
    if (aiState === "checking") return;
    setAiState("checking");
    setSentToTeacher(false);
    setTimeout(() => {
      const len = draft.trim().length;
      const fb: string[] = [];
      if (len === 0) {
        fb.push("Решение пустое — запишите ход рассуждений, ИИ сверит его с критериями ФИПИ.");
      } else {
        fb.push(`Черновик принят (${len} симв.). Структура решения распознаётся по критериям ФИПИ.`);
        if (/\\frac|\\dfrac|дроби|делим/i.test(draft)) fb.push("Обнаружено преобразование дробей — проверьте ОДЗ.");
        if (/sin|cos|tg|ctg|синус|косинус/i.test(draft)) fb.push("Тригонометрия: не забудьте отбор корней на промежутке.");
        if (/ОДЗ|область допустимых/i.test(draft)) fb.push("ОДЗ учтена — плюс к первому критерию.");
        fb.push("Черновик отправлен в кабинет преподавателя на финальную проверку.");
      }
      setAiFeedback(fb);
      setAiState("done");
      setSentToTeacher(true);
      pushToast("Отправлено преподавателю на проверку");
    }, 900);
  };

  return (
    <div className="card card-hover p-5">
      {/* шапка задачи */}
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-board-700/80 font-display text-[15px] font-bold text-mark-blue">
          {task.number}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold text-chalk-50">Задание {task.number} · {task.topic}</p>
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-chalk-500">развёрнутый ответ · до {task.points} б.</p>
        </div>
        <span className="chip !text-mark-blue">часть 2</span>
      </div>

      {/* условие */}
      <p className="mt-4 text-[15px] leading-relaxed text-chalk-100">
        <LatexText text={task.latex_statement} />
      </p>

      {/* поле для решения */}
      <div className="mt-4">
        <label className="tick">Ваше решение</label>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          placeholder="Запишите ход решения: формулы, преобразования, ответ…"
          className="mt-1.5 w-full resize-y rounded-lg border-2 border-board-600/70 bg-board-950/50 px-4 py-3 text-[13.5px] leading-relaxed text-chalk-100 outline-none transition-all placeholder:text-chalk-500 focus:border-mark-blue focus:ring-4 focus:ring-mark-blue/10"
          aria-label={`Решение задания ${task.number}`}
        />
      </div>

      {/* ── развилка по наличию преподавателя ── */}
      {!hasTeacher ? (
        <>
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-mark-red/30 bg-mark-red/8 p-4">
            <Lock className="mt-0.5 h-4.5 w-4.5 shrink-0 text-mark-red" />
            <div>
              <p className="text-[13px] font-bold text-mark-red">Автопроверка недоступна</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-chalk-300">
                Автопроверка второй части по критериям ФИПИ доступна только ученикам с привязанным преподавателем.
              </p>
            </div>
          </div>
          <button onClick={() => setAttachOpen(true)} className="btn-gold mt-3 w-full justify-center py-3 text-[14px]">
            <Sparkles className="h-4 w-4" /> Ввести код преподавателя
          </button>
          <p className="mt-2 text-center text-[11px] text-chalk-500">
            Первая часть и итоговые баллы работают без привязки — решайте свободно.
          </p>
        </>
      ) : (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            onClick={runAiCheck}
            disabled={aiState === "checking"}
            className="btn-gold flex-1 justify-center py-3 text-[13.5px] disabled:opacity-60"
          >
            {aiState === "checking" ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-board-950/30 border-t-board-950" />
                Проверяем по критериям…
              </>
            ) : (
              <>
                <Bot className="h-4 w-4" /> Автопроверка ИИ / отправить преподавателю
              </>
            )}
          </button>
          <button onClick={() => setShowSolution((s) => !s)} className="btn-ghost flex-1 justify-center py-3 text-[13.5px]">
            {showSolution ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showSolution ? "Скрыть эталон" : "Посмотреть эталонное решение"}
          </button>
        </div>
      )}

      {/* результат ИИ-проверки */}
      {hasTeacher && aiState === "done" && (
        <div className="pop-in mt-4 rounded-xl border border-mark-blue/30 bg-mark-blue/8 p-4">
          <p className="flex items-center gap-2 text-[13px] font-bold text-mark-blue">
            <CheckCircle2 className="h-4 w-4" /> Разбор по критериям ФИПИ {sentToTeacher && "· отправлено преподавателю"}
          </p>
          <ul className="mt-2 space-y-1.5">
            {aiFeedback.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-chalk-200">
                <ChevronDown className="mt-1 h-3.5 w-3.5 shrink-0 -rotate-90 text-mark-blue" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* эталонное решение (только с преподавателем) */}
      {hasTeacher && showSolution && task.solution_latex && (
        <div className="pop-in mt-4 rounded-xl border border-mark-yellow/30 bg-mark-yellow/5 p-4">
          <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-mark-yellow">
            <Eye className="h-3.5 w-3.5" /> Эталонное решение
          </p>
          <div className="mt-2 text-[13.5px] leading-relaxed text-chalk-200">
            <LatexText text={task.solution_latex} />
          </div>
        </div>
      )}

      <AttachTeacherModal open={attachOpen} onClose={() => setAttachOpen(false)} />
    </div>
  );
}
