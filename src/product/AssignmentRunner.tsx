import { useMemo, useState } from "react";
import { ArrowRight, BookOpen, CheckCircle2, ClipboardList, PenLine, XCircle } from "lucide-react";
import { useApp } from "./store";
import { PROB_PROBLEMS, PART1_COUNT, REAL_VARIANT, SCALE, answersMatch } from "./data";
import { getAssignment, submitSolution, type PickedTask } from "./assignments";
import { AnswerInput, LatexText } from "./ui";

interface HwProblem {
  id: string;
  number: number;
  topic: string;
  statement: string;
  answer: string;
  solution?: string;
  /** 1 = автопроверка (краткий ответ), 2 = ручная проверка (развёрнутое решение) */
  part: 1 | 2;
  maxScore?: number;
  criteria?: string;
}

/** Собрать список задач для ДЗ (вариант, блок по теме или свой набор). */
function buildProblems(kind: "variant" | "block" | "custom", variantId?: string, topicNumber?: number, taskCount?: number, picked?: PickedTask[]): HwProblem[] {
  if (kind === "custom") {
    return (picked ?? []).map((p) => ({
      id: p.id, number: p.number, topic: p.topic,
      statement: p.statement, answer: p.answer ?? "", solution: p.solution,
      part: p.part ?? 1, maxScore: p.maxScore, criteria: p.criteria,
    }));
  }
  if (kind === "variant") {
    if (variantId === "v-real-2023") {
      return REAL_VARIANT.filter((t) => t.part === 1).map((t) => ({
        id: `real-${t.number}`, number: t.number, topic: t.category,
        statement: t.statement, answer: t.answer ?? "", solution: t.solution,
        part: 1 as const, maxScore: t.maxScore,
      }));
    }
    /* авторский вариант берётся из publishedVariants через store в компоненте */
    return [];
  }
  /* блок по теме */
  const out: HwProblem[] = [];
  if (topicNumber === 4 || topicNumber === 5) {
    PROB_PROBLEMS.filter((p) => (p.topic.includes("Сложная") ? 5 : 4) === topicNumber)
      .forEach((p) => out.push({ id: `prob-${p.id}`, number: topicNumber ?? 4, topic: p.topic, statement: p.text, answer: p.answer, solution: p.explain, part: 1, maxScore: 1 }));
  }
  REAL_VARIANT.filter((t) => t.part === 1 && t.number === topicNumber)
    .forEach((t) => out.push({ id: `real-${t.number}-${out.length}`, number: t.number, topic: t.category, statement: t.statement, answer: t.answer ?? "", solution: t.solution, part: 1, maxScore: t.maxScore }));
  const limit = taskCount ?? 10;
  return out.slice(0, limit);
}

export default function AssignmentRunner() {
  const { activeAssignmentId, completeAssignment, publishedVariants, go, user } = useApp();
  const assignment = activeAssignmentId ? getAssignment(activeAssignmentId) : null;

  const problems = useMemo<HwProblem[]>(() => {
    if (!assignment) return [];
    if (assignment.kind === "variant" && assignment.variantId !== "v-real-2023") {
      const v = publishedVariants.find((x) => x.id === assignment.variantId);
      if (v) {
        return v.tasks.filter((t) => t.type === "short_answer").map((t) => ({
          id: t.id, number: t.number, topic: t.topic,
          statement: t.latex_statement, answer: t.answer ?? "", solution: t.solution_latex,
          part: 1 as const, maxScore: 1,
        }));
      }
    }
    return buildProblems(assignment.kind, assignment.variantId, assignment.topicNumber, assignment.taskCount, assignment.pickedTasks);
  }, [assignment, publishedVariants]);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [finished, setFinished] = useState(false);
  /** Развёрнутые решения части 2 — на ручную проверку преподавателю. */
  const [part2Solutions, setPart2Solutions] = useState<Record<string, string>>({});
  const [part2Sent, setPart2Sent] = useState(false);

  const part1 = problems.filter((p) => p.part === 1);
  const part2 = problems.filter((p) => p.part === 2);

  if (!assignment) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="text-chalk-400">Задание не найдено.</p>
        <button onClick={() => go("home")} className="btn-gold mt-4 px-5 py-2.5 text-sm">На главную</button>
      </div>
    );
  }

  /* часть 1: автопроверка; часть 2 оценивается вручную и в этот балл не входит */
  const total = part1.length;
  const doneCount = Object.values(checked).filter(Boolean).length;
  const correctCount = part1.filter((p) => checked[p.id] && answersMatch(answers[p.id] ?? "", p.answer)).length;

  const check = (p: HwProblem) => {
    if (!(answers[p.id] ?? "").trim()) return;
    setChecked((c) => ({ ...c, [p.id]: true }));
    setRevealed((r) => ({ ...r, [p.id]: true }));
  };

  const finish = () => {
    /* Часть 1: максимум PART1_COUNT первичных баллов → тестовый по шкале. */
    const score = assignment.kind === "variant"
      ? SCALE[Math.min(correctCount, PART1_COUNT)] ?? correctCount
      : Math.round((correctCount / Math.max(total, 1)) * 100);
    setFinished(true);
    completeAssignment(assignment.id, score);
  };

  if (finished) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-mark-green" />
        <h2 className="mt-3 font-display text-2xl font-bold text-chalk-50">ДЗ отправлено на проверку</h2>
        <p className="mt-2 text-[13.5px] text-chalk-400">
          Часть 1: верно {correctCount} из {total}.
          {part2.length > 0 && (part2Sent
            ? " Развёрнутые решения части 2 отправлены преподавателю — оценка появится после ручной проверки."
            : " Часть 2 вы не сдали — её можно дослать позже.")}
        </p>
        <p className="mt-1 text-[12px] text-chalk-500">Преподаватель увидит ваш результат в кабинете.</p>
        <button onClick={() => go("home")} className="btn-gold mt-5 px-6 py-2.5 text-sm">На главную</button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-5">
      {/* шапка ДЗ */}
      <div className="rise card flex flex-wrap items-center gap-3 p-4">
        <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${assignment.kind === "variant" ? "bg-mark-blue/15 text-mark-blue" : "bg-mark-green/15 text-mark-green"}`}>
          {assignment.kind === "variant" ? <ClipboardList className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-mark-pink">ДЗ от {assignment.fromName || "репетитора"}</p>
          <h1 className="truncate font-display text-lg font-bold text-chalk-50">{assignment.title}</h1>
          {assignment.message && <p className="mt-0.5 text-[12px] text-chalk-400">«{assignment.message}»</p>}
        </div>
        <span className="chip"><CheckCircle2 className="h-3.5 w-3.5 text-mark-green" />{doneCount}/{total}</span>
      </div>

      {/* часть 1 — краткие ответы с автопроверкой */}
      <div className="mt-4 space-y-3">
        {part1.map((p, i) => {
          const isChecked = !!checked[p.id];
          const ok = isChecked && answersMatch(answers[p.id] ?? "", p.answer);
          return (
            <div key={p.id} className={`card rise rise-${Math.min((i % 5) + 1, 5)} p-4 ${isChecked ? (ok ? "!border-mark-green/50" : "!border-mark-red/50") : ""}`}>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-board-700 font-display text-[12px] font-bold text-chalk-100">{p.number}</span>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-chalk-500">{p.topic}</span>
                {isChecked && (ok
                  ? <CheckCircle2 className="ml-auto h-4 w-4 text-mark-green" />
                  : <XCircle className="ml-auto h-4 w-4 text-mark-red" />)}
              </div>
              <p className="mt-2.5 text-[14px] leading-relaxed text-chalk-100"><LatexText text={p.statement} /></p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <AnswerInput
                  label={`№${p.number} ${p.topic}`}
                  value={answers[p.id] ?? ""}
                  onChange={(v) => setAnswers((a) => ({ ...a, [p.id]: v }))}
                  onSubmit={() => check(p)}
                  readOnly={isChecked}
                  invalid={isChecked && !ok}
                  className="!py-2.5 !text-[15px]"
                />
                {!isChecked ? (
                  <button onClick={() => check(p)} className="btn-gold shrink-0 px-4 py-2.5 text-[13px]">Проверить<ArrowRight className="h-4 w-4" /></button>
                ) : (
                  <button onClick={() => setRevealed((r) => ({ ...r, [p.id]: !r[p.id] }))} className="btn-ghost shrink-0 px-4 py-2.5 text-[12.5px]">
                    {revealed[p.id] ? "Скрыть решение" : "Показать решение"}
                  </button>
                )}
              </div>
              {revealed[p.id] && p.solution && (
                <p className="pop-in mt-2.5 rounded-lg border border-mark-yellow/25 bg-mark-yellow/5 p-3 text-[12.5px] leading-relaxed text-chalk-200">
                  <b className="text-mark-yellow">Ответ: {p.answer.replace(".", ",")}.</b> <LatexText text={p.solution} />
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* часть 2 — развёрнутые решения на ручную проверку */}
      {part2.length > 0 && (
        <div className="mt-6">
          <h2 className="flex items-center gap-2 font-display text-sm font-bold text-chalk-50">
            <PenLine className="h-4 w-4 text-mark-pink" />Часть 2 · развёрнутые решения
          </h2>
          <p className="mt-1 text-[11.5px] text-chalk-500">Запишите решение — преподаватель проверит его вручную по критериям ФИПИ.</p>
          <div className="mt-3 space-y-3">
            {part2.map((p, i) => (
              <div key={p.id} className={`card rise rise-${Math.min((i % 5) + 1, 5)} !border-mark-pink/30 p-4`}>
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-mark-pink/20 font-display text-[12px] font-bold text-mark-pink">{p.number}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-chalk-500">{p.topic}</span>
                  <span className="ml-auto rounded-full bg-mark-pink/15 px-2 py-0.5 text-[10px] font-bold text-mark-pink">до {p.maxScore ?? 2} б. · вручную</span>
                </div>
                <p className="mt-2.5 text-[14px] leading-relaxed text-chalk-100"><LatexText text={p.statement} /></p>
                {p.criteria && (
                  <p className="mt-2 rounded-lg border border-board-600/50 bg-board-950/40 p-2.5 text-[11.5px] leading-relaxed text-chalk-400">
                    <b className="text-chalk-300">Критерии:</b> <LatexText text={p.criteria} />
                  </p>
                )}
                <textarea
                  value={part2Solutions[p.id] ?? ""}
                  onChange={(e) => setPart2Solutions((s) => ({ ...s, [p.id]: e.target.value }))}
                  rows={5}
                  disabled={part2Sent}
                  placeholder="Запишите ход решения: формулы, преобразования, ответ…"
                  className="mt-3 w-full resize-y rounded-lg border border-board-600/70 bg-board-950/50 p-3 font-mono text-[13px] leading-relaxed text-chalk-100 outline-none transition-all placeholder:text-chalk-600 focus:border-mark-pink disabled:opacity-60"
                />
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-center">
            {part2Sent ? (
              <span className="chip !border-mark-green/50 !text-mark-green"><CheckCircle2 className="h-3.5 w-3.5" />Решения отправлены преподавателю на проверку</span>
            ) : (
              <button
                onClick={() => {
                  if (!user) return;
                  const combined = part2.map((p) => `№${p.number} (${p.topic}):\n${(part2Solutions[p.id] ?? "").trim() || "(нет решения)"}`).join("\n\n");
                  submitSolution(assignment.id, user.nickname, combined);
                  setPart2Sent(true);
                }}
                disabled={!part2.some((p) => (part2Solutions[p.id] ?? "").trim())}
                className="btn-ghost !border-mark-pink/50 !text-mark-pink px-6 py-2.5 text-[13px] disabled:opacity-40"
              >
                <PenLine className="h-4 w-4" />Отправить решения на проверку
              </button>
            )}
          </div>
        </div>
      )}

      {problems.length === 0 && (
        <div className="card mt-4 px-6 py-10 text-center">
          <p className="text-[13.5px] text-chalk-400">В этом задании пока нет доступных задач.</p>
        </div>
      )}

      {part1.length > 0 && (
        <div className="mt-5 flex justify-center">
          <button onClick={finish} disabled={doneCount === 0} className="btn-gold px-8 py-3 text-[14.5px] disabled:opacity-40">
            Завершить ДЗ{doneCount > 0 ? ` · ${correctCount}/${doneCount} верно` : ""}
          </button>
        </div>
      )}
      <p className="mt-2 text-center text-[11px] text-chalk-600">Вы вошли как @{user?.nickname} · результат увидит преподаватель</p>
    </div>
  );
}
