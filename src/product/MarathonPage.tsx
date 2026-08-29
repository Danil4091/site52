import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronRight, Flame, Play, RotateCcw, Timer, XCircle, Zap } from "lucide-react";
import { useApp } from "./store";
import { PROB_PROBLEMS, REAL_ANSWER_KEY, REAL_VARIANT, answersMatch } from "./data";
import { AnswerInput, LatexText } from "./ui";

interface MarathonTask {
  id: string;
  number: number;
  topic: string;
  statement: string;
  answer: string;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildPool(): MarathonTask[] {
  const variant = REAL_VARIANT.filter((t) => t.part === 1).map((t) => ({
    id: `v-${t.number}`,
    number: t.number,
    topic: t.category,
    statement: t.statement,
    answer: t.answer ?? REAL_ANSWER_KEY[t.number] ?? "",
  }));
  const prob = PROB_PROBLEMS.map((p) => ({
    id: p.id,
    number: /сложная/i.test(p.topic) ? 5 : 4,
    topic: p.topic,
    statement: p.text,
    answer: p.answer,
  }));
  return [...variant, ...prob];
}

export default function MarathonPage() {
  const { recordMarathon, go, pushToast } = useApp();
  const [phase, setPhase] = useState<"setup" | "play" | "done">("setup");
  const [count, setCount] = useState(10);
  const [tasks, setTasks] = useState<MarathonTask[]>([]);
  const [idx, setIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<null | boolean>(null);
  const startRef = useRef(0);

  const pool = useMemo(buildPool, []);
  const task = tasks[idx];

  /* тикающий таймер во время игры */
  useEffect(() => {
    if (phase !== "play") return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 250);
    return () => clearInterval(id);
  }, [phase]);

  const start = () => {
    setTasks(shuffle(pool).slice(0, count));
    setIdx(0);
    setCorrect(0);
    setElapsed(0);
    setInput("");
    setFeedback(null);
    startRef.current = Date.now();
    setPhase("play");
  };

  const submit = () => {
    if (!task || feedback !== null) return;
    const ok = answersMatch(input, task.answer);
    setFeedback(ok);
    if (ok) setCorrect((c) => c + 1);
    /* короткая пауза — показать вердикт, потом дальше */
    window.setTimeout(() => {
      if (idx + 1 >= tasks.length) {
        const total = tasks.length;
        const finalCorrect = correct + (ok ? 1 : 0);
        const seconds = Math.floor((Date.now() - startRef.current) / 1000);
        recordMarathon(finalCorrect, total, seconds);
        setPhase("done");
      } else {
        setIdx((i) => i + 1);
        setInput("");
        setFeedback(null);
      }
    }, 650);
  };

  const mmss = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-5">
      <p className="rise tick text-mark-red">Скоростной режим</p>
      <h1 className="rise rise-1 mt-2 font-display text-3xl font-bold tracking-tight text-chalk-50 sm:text-4xl">
        Марафон <span className="text-chalk-500">·</span> часть 1
      </h1>
      <p className="rise rise-2 mt-2 text-sm text-chalk-400">
        Решай задачи одну за другой на время. Чем быстрее — тем больше бонус XP. Ошибки не сбрасывают прогресс.
      </p>

      {phase === "setup" && (
        <div className="rise rise-3 card mt-8 p-6">
          <p className="tick">Сколько задач?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[5, 10, 15].map((n) => (
              <button key={n} onClick={() => setCount(n)}
                className={`rounded-xl border-2 px-6 py-3 font-display text-lg font-bold transition-all duration-200 active:scale-95 ${
                  count === n ? "border-mark-red bg-mark-red/10 text-mark-red" : "border-board-600/70 text-chalk-300 hover:border-board-600 hover:text-chalk-50"
                }`}>
                {n}
              </button>
            ))}
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[12px] text-chalk-500">
            <Zap className="h-3.5 w-3.5 text-mark-yellow" />
            Микс из реальных заданий части 1 (№1–13) и теории вероятностей.
          </p>
          <button onClick={start} className="btn-gold mt-5 w-full justify-center py-4 text-[15px]">
            <Play className="h-5 w-5" /> Старт
          </button>
        </div>
      )}

      {phase === "play" && task && (
        <div className="mt-6">
          {/* верхняя панель: таймер, счёт, прогресс */}
          <div className="card flex items-center gap-4 px-5 py-4">
            <span className="flex items-center gap-2 font-mono text-lg font-bold tabular-nums text-mark-yellow">
              <Timer className="h-4 w-4" /> {mmss}
            </span>
            <span className="flex items-center gap-1.5 font-display text-lg font-bold text-mark-green">
              <Flame className="h-4 w-4" /> {correct}
            </span>
            <div className="ml-auto flex items-center gap-1">
              {tasks.map((t, i) => (
                <span key={t.id} className={`h-2 w-2 rounded-full transition-all duration-300 ${
                  i < idx ? "bg-mark-green" : i === idx ? "scale-125 bg-mark-yellow" : "bg-board-600"
                }`} />
              ))}
            </div>
          </div>

          {/* карточка задачи */}
          <div key={task.id} className="card pop-in mt-4 p-6">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-mark-red/12 text-[13px] font-bold text-mark-red">№{task.number}</span>
              <span className="text-[11px] font-bold uppercase tracking-wide text-chalk-500">{task.topic} · задача {idx + 1} из {tasks.length}</span>
            </div>
            <p className="mt-4 text-[15px] leading-relaxed text-chalk-100"><LatexText text={task.statement} /></p>

            <div className="mt-5 flex gap-2">
              <AnswerInput
                label={`Марафон · №${task.number}`}
                value={input}
                onChange={(v) => { setInput(v); }}
                onSubmit={submit}
                placeholder="Ответ"
                autoFocus
                invalid={feedback === false}
              />
              <button onClick={submit} disabled={feedback !== null} className="btn-gold shrink-0 px-5 text-sm disabled:opacity-50">
                {feedback === null ? "Ответить" : feedback ? "Верно!" : "Мимо"}
              </button>
            </div>

            {feedback !== null && (
              <p className={`pop-in mt-3 flex items-center gap-2 text-[13px] font-bold ${feedback ? "text-mark-green" : "text-mark-red"}`}>
                {feedback ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {feedback ? "Засчитано! Дальше…" : `Правильный ответ: ${task.answer.replace(".", ",")}`}
              </p>
            )}
          </div>
        </div>
      )}

      {phase === "done" && (
        <div className="card pop-in mt-8 p-8 text-center">
          <Flame className="mx-auto h-12 w-12 text-mark-red" />
          <p className="mt-3 font-display text-5xl font-bold tabular-nums text-chalk-50">
            {correct}<span className="text-2xl text-chalk-500"> / {tasks.length}</span>
          </p>
          <p className="mt-2 text-[13px] text-chalk-400">
            Время: <b className="font-mono text-mark-yellow">{mmss}</b>
            {correct === tasks.length && <span className="ml-2 font-bold text-mark-green">· Идеально!</span>}
          </p>
          <p className="mt-1 text-[12px] text-chalk-500">XP начислены с бонусом за скорость — смотри в профиле.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2.5">
            <button onClick={() => { setPhase("setup"); }} className="btn-gold px-6 py-3 text-sm">
              <RotateCcw className="h-4 w-4" /> Ещё раз
            </button>
            <button onClick={() => go("home")} className="btn-ghost px-6 py-3 text-sm">
              На главную <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
