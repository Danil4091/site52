import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Check, ChevronDown, Eye, Infinity as InfinityIcon, Layers, RefreshCw, Trophy, Zap,
} from "lucide-react";
import { useApp } from "./store";
import { BANK } from "./data";
import { checkTaskAnswer, fetchTopicFeed, type FeedMeta, type FeedTask } from "./feed";
import { AnswerInput, LatexText } from "./ui";

type ItemStatus = "open" | "wrong" | "solved";

interface QueueItem {
  task: FeedTask;
  status: ItemStatus;
  given: string;
  revealed: boolean;
  checking: boolean;
  wrongTries: number;
}

const PAGE_MORE = 5;

function SkeletonCard() {
  return (
    <div className="card animate-pulse p-5">
      <div className="h-4 w-28 rounded bg-board-700/70" />
      <div className="mt-4 h-3 w-full rounded bg-board-700/50" />
      <div className="mt-2 h-3 w-2/3 rounded bg-board-700/50" />
      <div className="mt-5 h-11 w-full rounded-lg bg-board-700/50" />
    </div>
  );
}

export default function TrainerPage() {
  const { trainerTopic, taskBank, solvedTaskIds, markTaskSolved, celebrate, pushToast, go } = useApp();
  const topicMeta = BANK.find((t) => t.number === trainerTopic) ?? BANK[4];
  const number = topicMeta.number;

  const [size, setSize] = useState<5 | 10 | 0>(5); // 0 = вся оставшаяся очередь
  const [autoRefill, setAutoRefill] = useState(true);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [meta, setMeta] = useState<FeedMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const celebrated = useRef(false);

  const toItems = (tasks: FeedTask[]): QueueItem[] =>
    tasks.map((task) => ({ task, status: "open", given: "", revealed: false, checking: false, wrongTries: 0 }));

  /* первая страница очереди */
  const load = useCallback(async (topicNumber: number, limit: number | undefined) => {
    setLoading(true);
    const page = await fetchTopicFeed(topicNumber, { limit, offset: 0, solvedIds: solvedTaskIds, extra: taskBank });
    setMeta(page.meta);
    setQueue(toItems(page.items));
    setLoading(false);
  }, [solvedTaskIds, taskBank]);

  useEffect(() => {
    celebrated.current = false;
    void load(number, size === 0 ? undefined : size);
  }, [number, size, load]);

  /* «Показать ещё»: следующая порция из НЕрешённых */
  const showMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    const page = await fetchTopicFeed(number, { limit: PAGE_MORE, offset: queue.length, solvedIds: solvedTaskIds, extra: taskBank });
    setQueue((q) => [...q, ...toItems(page.items)]);
    setMeta(page.meta);
    setLoadingMore(false);
  };

  /* производные показатели */
  const solvedInQueue = queue.filter((q) => q.status === "solved").length;
  const solvedTotal = (meta?.solved ?? 0) + solvedInQueue;
  const remainingLive = meta ? meta.total - solvedTotal : 0;
  const unsolvedInQueue = queue.filter((q) => q.status !== "solved").length;
  const hasMore = remainingLive - unsolvedInQueue > 0;
  const allDone = meta !== null && meta.total > 0 && remainingLive === 0 && unsolvedInQueue === 0 && queue.length > 0;
  const pct = meta && meta.total ? Math.round((solvedTotal / meta.total) * 100) : 0;

  /* тема закрыта на 100% — один раз конфетти + тост */
  useEffect(() => {
    if (allDone && !celebrated.current) {
      celebrated.current = true;
      celebrate();
      pushToast(`Тема «${topicMeta.topic}» закрыта на 100%! +50 XP`);
    }
  }, [allDone, celebrate, pushToast, topicMeta.topic]);

  const check = async (itemId: string) => {
    const item = queue.find((q) => q.task.id === itemId);
    if (!item || item.checking || item.status === "solved" || !item.given.trim()) return;

    setQueue((q) => q.map((x) => (x.task.id === itemId ? { ...x, checking: true } : x)));
    const verdict = await checkTaskAnswer(item.task, item.given);

    if (verdict.correct) {
      markTaskSolved(item.task.id, number);
      setQueue((q) => q.map((x) => (x.task.id === itemId ? { ...x, status: "solved", checking: false } : x)));

      /* автоподгрузка: под solved-задачу в очередь заезжает следующая нерешённая */
      if (autoRefill) {
        const nextOffset = queue.length - 1; // solved уже не в пуле нерешённых
        const page = await fetchTopicFeed(number, { limit: 1, offset: nextOffset, solvedIds: [...solvedTaskIds, item.task.id], extra: taskBank });
        if (page.items.length) {
          setQueue((q) => [...q, ...toItems(page.items)]);
        }
        setMeta(page.meta);
      } else {
        setMeta((m) => (m ? { ...m, solved: m.solved + 1 } : m));
      }
    } else {
      setQueue((q) => q.map((x) => (x.task.id === itemId ? { ...x, status: "wrong", checking: false, wrongTries: x.wrongTries + 1 } : x)));
    }
  };

  const setGiven = (itemId: string, v: string) =>
    setQueue((q) => q.map((x) => (x.task.id === itemId ? { ...x, given: v, status: x.status === "wrong" && v !== x.given ? "open" : x.status } : x)));

  const toggleRevealed = (itemId: string) =>
    setQueue((q) => q.map((x) => (x.task.id === itemId ? { ...x, revealed: !x.revealed } : x)));

  const solvedCards = useMemo(() => queue.filter((q) => q.status === "solved"), [queue]);
  void solvedCards;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-5">
      {/* ── шапка темы: счёт вместо лозунгов ── */}
      <button onClick={() => go("bank")} className="btn-ghost mb-5 px-3 py-2 text-[12.5px]">
        <ArrowLeft className="h-3.5 w-3.5" /> Банк заданий
      </button>

      <div className="rise card relative overflow-hidden p-6">
        <div className="board-grid pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative flex flex-wrap items-center gap-x-8 gap-y-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-mark-yellow/12 font-display text-2xl font-bold text-mark-yellow">
            №{number}
          </span>
          <div className="min-w-[180px] flex-1">
            <p className="tick">Тренировка по теме</p>
            <h1 className="mt-1 font-display text-2xl font-bold leading-tight text-chalk-50 sm:text-3xl">{topicMeta.topic}</h1>
            <p className="mt-1.5 max-w-md text-[12.5px] leading-relaxed text-chalk-400">{topicMeta.note}</p>
          </div>
          <div className="text-right">
            <p key={solvedTotal} className="count-pop font-display text-5xl font-bold tabular-nums leading-none text-chalk-50">
              {solvedTotal}<span className="text-2xl text-chalk-500">/{meta?.total ?? "…"}</span>
            </p>
            <p className="mt-1 text-[10.5px] font-bold uppercase tracking-wider text-chalk-500">решено верно</p>
          </div>
        </div>
        <div className="xp-track relative mt-5">
          <div className="xp-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px] font-semibold text-chalk-500">
          <span>{pct}% темы закрыто</span>
          {remainingLive > 0 ? <span>осталось {remainingLive}</span> : meta && meta.total > 0 ? <span className="text-mark-green">тема пройдена</span> : null}
        </div>
      </div>

      {/* ── настройки сессии ── */}
      {!allDone && meta && meta.total > 0 && (
        <div className="rise rise-1 mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
          <div className="flex overflow-hidden rounded-xl border border-board-600/60">
            {([[5, "5 задач"], [10, "10 задач"], [0, "Все"]] as [5 | 10 | 0, string][]).map(([v, label]) => (
              <button key={v} onClick={() => setSize(v)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-[12.5px] font-bold transition-all duration-200 ${size === v ? "bg-mark-yellow text-board-950" : "bg-board-850/60 text-chalk-300 hover:text-chalk-50"}`}>
                {v === 0 && <InfinityIcon className="h-3.5 w-3.5" />}{label}
              </button>
            ))}
          </div>
          <label className="flex cursor-pointer select-none items-center gap-2.5 text-[12.5px] font-semibold text-chalk-300">
            <button
              onClick={() => setAutoRefill((a) => !a)}
              role="switch"
              aria-checked={autoRefill}
              className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${autoRefill ? "bg-mark-green" : "bg-board-700"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-chalk-50 shadow transition-all duration-200 ${autoRefill ? "left-[22px]" : "left-0.5"}`} />
            </button>
            подгружать новую при верном ответе
          </label>
        </div>
      )}

      {/* ── очередь задач ── */}
      <div className="mt-5 space-y-3.5">
        {loading && (<><SkeletonCard /><SkeletonCard /><SkeletonCard /></>)}

        {!loading && meta && meta.total === 0 && (
          <div className="rise card p-8 text-center">
            <Layers className="mx-auto h-9 w-9 text-chalk-500" />
            <p className="mt-3 font-display text-base font-bold text-chalk-200">Задач по теме пока нет</p>
            <p className="mt-1 text-[12.5px] text-chalk-500">Преподаватель добавит их в кабинете — или загляните в другую тему.</p>
          </div>
        )}

        {!loading && queue.map((item, i) => {
          const solved = item.status === "solved";
          const wrong = item.status === "wrong";
          return (
            <div key={item.task.id}
              className={`card rise rise-${Math.min((i % 4) + 1, 5)} overflow-hidden transition-colors duration-300 ${solved ? "!border-mark-green/40" : wrong ? "!border-mark-red/45" : ""}`}>
              {/* строка статуса */}
              <div className={`flex items-center gap-3 border-b px-5 py-3 ${solved ? "border-mark-green/25 bg-mark-green/8" : wrong ? "border-mark-red/25 bg-mark-red/8" : "border-board-700/50 bg-board-850/40"}`}>
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold ${solved ? "bg-mark-green text-board-950" : wrong ? "bg-mark-red/20 text-mark-red" : "bg-board-700 text-chalk-300"}`}>
                  {solved ? <Check className="h-4 w-4" /> : item.task.id.split("-").pop()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-chalk-50">
                    Задача {i + 1} из {meta?.total ?? "…"}
                    <span className="ml-2 font-mono text-[10.5px] font-semibold text-chalk-500">{item.task.topic}</span>
                  </p>
                </div>
                {solved && <span className="chip !border-mark-green/40 !text-mark-green">решена · +10 XP</span>}
                {wrong && <span className="chip !border-mark-red/40 !text-mark-red">неверно · попытка {item.wrongTries}</span>}
              </div>

              {/* свёрнутое тело решённой */}
              {solved ? (
                <div className="solved-flash px-5 py-3">
                  <button onClick={() => toggleRevealed(item.task.id)} className="flex items-center gap-1.5 text-[12px] font-bold text-mark-blue transition-colors hover:text-chalk-50">
                    <Eye className="h-3.5 w-3.5" /> {item.revealed ? "Скрыть разбор" : "Разбор"}
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${item.revealed ? "rotate-180" : ""}`} />
                  </button>
                  {item.revealed && item.task.solution && (
                    <p className="pop-in mt-2 text-[12.5px] leading-relaxed text-chalk-300"><LatexText text={item.task.solution} /></p>
                  )}
                </div>
              ) : (
                <div className="p-5">
                  <p className="text-[14px] leading-relaxed text-chalk-200"><LatexText text={item.task.statement} /></p>

                  <div key={`${item.task.id}-${item.wrongTries}`} className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <AnswerInput
                      label={`№${number} · задача ${i + 1}`}
                      value={item.given}
                      onChange={(v) => setGiven(item.task.id, v)}
                      onSubmit={() => void check(item.task.id)}
                      invalid={wrong}
                      autoFocus={i === 0 && queue.findIndex((q) => q.status !== "solved") === 0}
                    />
                    <div className="flex shrink-0 gap-2">
                      <button onClick={() => void check(item.task.id)} disabled={!item.given.trim() || item.checking}
                        className="btn-gold flex-1 px-5 py-3 text-[13.5px] disabled:opacity-40 sm:flex-none">
                        {item.checking ? <RefreshCw className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : "Проверить"}
                      </button>
                      <button onClick={() => toggleRevealed(item.task.id)}
                        className={`btn-ghost px-3.5 py-3 text-[12.5px] ${wrong ? "!border-mark-yellow/50 !text-mark-yellow" : ""}`}>
                        <Eye className="h-4 w-4" /> {item.revealed ? "Скрыть" : "Решение"}
                      </button>
                    </div>
                  </div>

                  {wrong && (
                    <p className="pop-in mt-2.5 text-[12px] font-semibold text-mark-red">
                      Не совпало. Проверьте запятую/точку и вычисления — или откройте разбор.
                    </p>
                  )}
                  {item.revealed && item.task.solution && (
                    <div className="pop-in mt-3 rounded-lg border border-mark-yellow/30 bg-mark-yellow/5 p-3.5">
                      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-mark-yellow"><Zap className="h-3.5 w-3.5" />Разбор</p>
                      <p className="text-[13px] leading-relaxed text-chalk-200"><LatexText text={item.task.solution} /></p>
                      <p className="mt-1.5 font-mono text-[12.5px] font-bold text-mark-green">Ответ: {item.task.answer.replace(".", ",")}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── подвал очереди ── */}
      {!loading && !allDone && hasMore && (
        <div className="mt-6 flex justify-center">
          <button onClick={() => void showMore()} disabled={loadingMore}
            className="btn-ghost px-6 py-3 text-sm disabled:opacity-50">
            {loadingMore
              ? <RefreshCw className="h-4 w-4 animate-spin motion-reduce:animate-none" />
              : <Layers className="h-4 w-4" />}
            Показать ещё {PAGE_MORE}
          </button>
        </div>
      )}

      {/* ── тема пройдена: empty state ── */}
      {!loading && allDone && (
        <div className="pop-in card mt-6 overflow-hidden p-8 text-center">
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="board-grid absolute inset-0" />
          </div>
          <span className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-mark-yellow/15">
            <Trophy className="h-10 w-10 text-mark-yellow" />
          </span>
          <h2 className="relative mt-4 font-display text-2xl font-bold text-chalk-50">Тема закрыта на 100%</h2>
          <p className="relative mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-chalk-400">
            Все {meta?.total} задач по теме «{topicMeta.topic}» решены верно. Тепловая карта на главной уже зеленеет.
          </p>
          <div className="relative mt-6 flex flex-wrap justify-center gap-2.5">
            <button onClick={() => go("variants")} className="btn-gold px-6 py-3 text-sm">Закрепить в варианте</button>
            <button onClick={() => go("bank")} className="btn-ghost px-5 py-3 text-sm">Другая тема</button>
          </div>
        </div>
      )}
    </div>
  );
}
