import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpenText, Download, Eye, FileText, GraduationCap, Printer, Search, X } from "lucide-react";
import { useApp } from "./store";
import {
  bumpDownload, downloadFile, materialPrintHtml, readAllMaterials,
  type StudyMaterial,
} from "./materials";

const PART_LABEL: Record<number, string> = { 0: "обе части", 1: "часть 1", 2: "часть 2" };

/* ─────────────────── читалка / скачивание ─────────────────── */
function ReaderModal({ m, onClose, onDownloaded }: { m: StudyMaterial; onClose: () => void; onDownloaded: () => void }) {
  const isFile = !!m.fileData || !!m.fileUrl;

  const saveAsPdf = () => {
    /* печатаем содержимое методички в скрытом iframe → диалог «Сохранить как PDF» */
    const frame = document.createElement("iframe");
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    if (!doc) { frame.remove(); return; }
    doc.open();
    doc.write(materialPrintHtml(m));
    doc.close();
    setTimeout(() => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      setTimeout(() => frame.remove(), 1500);
    }, 350);
    bumpDownload(m.id);
    onDownloaded();
  };

  const direct = () => {
    const r = downloadFile(m);
    if (r === "none") return; // файла нет — счётчик не накручиваем, мусор не скачиваем
    bumpDownload(m.id);
    onDownloaded();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-board-950/80 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="pop-in flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-2xl border border-board-700 bg-board-900 shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-start gap-3 border-b border-board-700/70 px-5 py-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-mark-red/15 text-mark-red">
            <FileText className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-bold leading-tight text-chalk-50">{m.title}</h2>
            <p className="mt-0.5 text-[11.5px] text-chalk-500">
              {m.tag} · {PART_LABEL[m.part]} · {m.pages} стр. · скачали {m.downloads} раз
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-chalk-500 transition-colors hover:bg-board-800 hover:text-chalk-50" aria-label="Закрыть">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="code-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {isFile ? (
            <div className="rounded-xl border border-board-700 bg-board-850 p-5">
              <p className="text-[13px] font-semibold text-chalk-200">PDF-файл от преподавателя</p>
              <p className="mt-1 text-[12px] text-chalk-500">
                {m.fileName ?? "material.pdf"}{m.fileSizeKb ? ` · ${m.fileSizeKb > 1024 ? (m.fileSizeKb / 1024).toFixed(1) + " МБ" : m.fileSizeKb + " КБ"}` : ""}
              </p>
              <p className="mt-3 text-[12px] leading-relaxed text-chalk-400">
                Нажмите «Скачать PDF» — файл сохранится на устройство. Бесплатно, без регистрации.
              </p>
            </div>
          ) : (
            (m.content ?? []).map((s, i) => (
              <section key={i} className="mb-5">
                <h3 className="flex items-center gap-2 font-display text-[14px] font-bold text-mark-yellow">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-mark-yellow/15 text-[11px]">{i + 1}</span>
                  {s.h}
                </h3>
                <pre className="mt-2 whitespace-pre-wrap rounded-lg border-l-[3px] border-mark-green/60 bg-board-850 px-4 py-3 font-mono text-[12.5px] leading-relaxed text-chalk-200">
                  {s.body}
                </pre>
              </section>
            ))
          )}
        </div>

        <div className="flex flex-wrap gap-2.5 border-t border-board-700/70 px-5 py-4">
          {isFile ? (
            <button onClick={direct} className="btn-gold flex-1 justify-center px-5 py-3 text-[13.5px]">
              <Download className="h-4 w-4" />Скачать PDF
            </button>
          ) : (
            <>
              <button onClick={saveAsPdf} className="btn-gold flex-1 justify-center px-5 py-3 text-[13.5px]">
                <Printer className="h-4 w-4" />Скачать как PDF
              </button>
              <span className="flex items-center text-[10.5px] text-chalk-600">через диалог печати браузера</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── каталог ученика ─────────────────── */
export default function MaterialsPage() {
  const { pushToast } = useApp();
  const [all, setAll] = useState<StudyMaterial[]>(readAllMaterials);
  const [query, setQuery] = useState("");
  const [part, setPart] = useState<0 | 1 | 2>(0);
  const [topic, setTopic] = useState("Все");
  const [reading, setReading] = useState<StudyMaterial | null>(null);

  const topics = useMemo(() => ["Все", ...Array.from(new Set(all.map((m) => m.topic)))], [all]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((m) => {
      if (part !== 0 && m.part !== 0 && m.part !== part) return false;
      if (topic !== "Все" && m.topic !== topic) return false;
      if (q && !`${m.title} ${m.tag} ${m.topic}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [all, query, part, topic]);

  const totalDownloads = useMemo(() => all.reduce((s, m) => s + m.downloads, 0), [all]);

  const refresh = () => setAll(readAllMaterials());

  /* Чтобы методичка, добавленная преподавателем в кабинете, сразу появилась
     у ученика при возврате на вкладку (демо-режим, общее localStorage). */
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    const onFocus = () => refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-5">
      {/* шапка */}
      <div className="rise relative overflow-hidden rounded-2xl border border-mark-yellow/30 bg-board-850 p-6 sm:p-8">
        <div className="board-grid pointer-events-none absolute inset-0" aria-hidden="true" />
        <GraduationCap className="pointer-events-none absolute -right-4 -top-6 h-36 w-36 rotate-12 text-mark-yellow/10" aria-hidden="true" />
        <div className="relative">
          <p className="tick text-mark-yellow">Бесплатно · без регистрации</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-chalk-50 sm:text-4xl">
            Методички и теория
          </h1>
          <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-chalk-400">
            Конспекты и справочники, собранные за 5 лет преподавания: формулы, методы, типичные ловушки ЕГЭ.
            Скачивайте бесплатно — <b className="text-chalk-200">{all.length} материалов, {totalDownloads} скачиваний</b>.
          </p>
        </div>
      </div>

      {/* фильтры */}
      <div className="rise rise-1 mt-5 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-chalk-600" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти методичку: «параметры», «вероятность»…"
            className="w-full rounded-xl border border-board-600/70 bg-board-850 py-3 pl-10 pr-4 text-[13px] text-chalk-50 outline-none transition-all placeholder:text-chalk-600 focus:border-mark-yellow"
            aria-label="Поиск методичек"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {([0, 1, 2] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPart(p)}
              className={`inline-flex min-h-[44px] items-center rounded-full px-4 py-2 text-[12.5px] font-bold transition-all active:scale-95 ${part === p ? "bg-mark-yellow text-board-950 shadow-lg shadow-mark-yellow/20" : "card text-chalk-300 hover:text-chalk-50"}`}
            >
              {p === 0 ? "Все части" : `Часть ${p}`}
            </button>
          ))}
        </div>
      </div>

      <div className="rise rise-2 mt-3 flex flex-wrap gap-1.5">
        {topics.map((t) => (
          <button
            key={t}
            onClick={() => setTopic(t)}
            className={`rounded-full border px-3.5 py-1.5 text-[11.5px] font-bold transition-all active:scale-95 ${topic === t ? "border-mark-green/70 bg-mark-green/15 text-mark-green" : "border-board-600/70 text-chalk-500 hover:text-chalk-300"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* сетка карточек */}
      {list.length === 0 ? (
        <div className="rise rise-3 mt-8 rounded-xl border border-dashed border-board-600 px-6 py-14 text-center">
          <BookOpenText className="mx-auto h-9 w-9 text-chalk-600" />
          <p className="mt-3 font-display text-lg font-bold text-chalk-300">Ничего не нашлось</p>
          <p className="mt-1 text-[12.5px] text-chalk-500">Попробуйте другой запрос или сбросьте фильтры.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-3.5 sm:grid-cols-2">
          {list.map((m, i) => (
            <div key={m.id} className={`card card-hover rise rise-${Math.min((i % 5) + 1, 5)} group flex flex-col p-5`}>
              <div className="flex items-start gap-3.5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-mark-red/12 text-mark-red transition-transform duration-200 group-hover:-rotate-3 group-hover:scale-105">
                  <FileText className="h-5.5 w-5.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-bold leading-snug text-chalk-50">{m.title}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="chip !py-0.5 text-[10px]">{m.tag}</span>
                    <span className="chip !py-0.5 text-[10px]">{m.topic}</span>
                    {m.kind === "file" && <span className="chip !border-mark-red/40 !py-0.5 !text-mark-red text-[10px]">PDF</span>}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-4 text-[11px] font-semibold text-chalk-500">
                <span>{m.pages} стр.</span>
                <span className="flex items-center gap-1"><Download className="h-3 w-3" />{m.downloads}</span>
                <span className="ml-auto">{PART_LABEL[m.part]}</span>
              </div>

              <div className="mt-4 flex gap-2">
                <button onClick={() => setReading(m)} className="btn-gold flex-1 justify-center px-4 py-2.5 text-[12.5px]">
                  <Download className="h-4 w-4" />Скачать
                </button>
                <button onClick={() => setReading(m)} className="btn-ghost px-4 py-2.5 text-[12.5px]" aria-label="Посмотреть">
                  <Eye className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="rise rise-5 mt-8 text-center text-[11.5px] text-chalk-600">
        Новые методички добавляет преподаватель — загляните позже. Все материалы бесплатны.
      </p>

      {reading && (
        <ReaderModal
          m={reading}
          onClose={() => setReading(null)}
          onDownloaded={() => {
            refresh();
            pushToast("Скачивание началось · спасибо за интерес к математике!");
          }}
        />
      )}
    </div>
  );
}
