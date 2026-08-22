import { useRef, useState } from "react";
import { Download, FileText, Plus, Server, Trash2, UploadCloud } from "lucide-react";
import { useApp } from "./store";
import { addMaterial, downloadFile, readAllMaterials, removeMaterial, type StudyMaterial } from "./materials";

const MAX_LOCAL_KB = 2560; // ~2.5 МБ — предел localStorage; в бою файл уходит на сервер

/* Панель «Методички» в кабинете преподавателя:
   загрузка PDF (файл или ссылка), список со счётчиком скачиваний, удаление. */
export default function MaterialsAdmin() {
  const { pushToast } = useApp();
  const [materials, setMaterials] = useState<StudyMaterial[]>(readAllMaterials);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [tag, setTag] = useState("");
  const [topic, setTopic] = useState("Алгебра");
  const [part, setPart] = useState<0 | 1 | 2>(0);
  const [pages, setPages] = useState(2);
  const [fileUrl, setFileUrl] = useState("");
  const [fileData, setFileData] = useState<string | null>(null);
  const [fileMeta, setFileMeta] = useState<{ name: string; sizeKb: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const field = "w-full rounded-lg border border-board-600/70 bg-board-950/50 px-3 py-2 text-[13px] text-chalk-50 outline-none transition-all placeholder:text-chalk-600 focus:border-mark-yellow";
  const label = "mb-1 block text-[10.5px] font-bold uppercase tracking-wider text-chalk-500";

  const onPickFile = (f: File | null) => {
    if (!f) return;
    if (f.type !== "application/pdf" && !/\.pdf$/i.test(f.name)) {
      pushToast("Нужен файл PDF");
      return;
    }
    const sizeKb = Math.round(f.size / 1024);
    if (sizeKb > MAX_LOCAL_KB) {
      pushToast(`Файл ${Math.round(sizeKb / 1024 * 10) / 10} МБ больше лимита демо-режима (~2.5 МБ). В боевом режиме ограничений нет — файл уйдёт на сервер.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFileData(String(reader.result));
      setFileMeta({ name: f.name, sizeKb });
      setFileUrl("");
    };
    reader.readAsDataURL(f);
  };

  const submit = () => {
    if (!title.trim()) return pushToast("Укажите название методички");
    if (!fileData && !fileUrl.trim()) return pushToast("Загрузите PDF или укажите ссылку на файл");
    try {
      addMaterial({
        title: title.trim(),
        tag: tag.trim() || "Методичка",
        topic,
        part,
        pages: Math.max(1, pages),
        kind: "file",
        fileData: fileData ?? undefined,
        fileUrl: fileUrl.trim() || undefined,
        fileName: fileMeta?.name,
        fileSizeKb: fileMeta?.sizeKb,
      });
      setMaterials(readAllMaterials());
      setShowForm(false);
      setTitle(""); setTag(""); setFileUrl(""); setFileData(null); setFileMeta(null);
      if (fileRef.current) fileRef.current.value = "";
      pushToast("Методичка опубликована — ученики уже могут её скачать");
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Не удалось сохранить");
    }
  };

  const userMaterials = materials.filter((m) => m.kind === "file");
  const demoMaterials = materials.filter((m) => m.kind === "demo");

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-chalk-50">Библиотека методичек</h2>
          <p className="mt-0.5 text-[12px] text-chalk-500">
            Добавлено вами: <b className="text-chalk-50">{userMaterials.length}</b> · встроено в платформу: {demoMaterials.length} ·
            всего скачиваний: <b className="text-mark-yellow">{materials.reduce((s, m) => s + m.downloads, 0)}</b>
          </p>
        </div>
        <button onClick={() => setShowForm((s) => !s)} className="btn-gold px-4 py-2.5 text-[12.5px]">
          <Plus className="h-4 w-4" />{showForm ? "Свернуть" : "Добавить методичку"}
        </button>
      </div>

      {showForm && (
        <div className="card pop-in mt-4 grid gap-5 p-5 lg:grid-cols-2">
          <div className="space-y-3.5">
            <div><label className={label}>Название</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: «№18 Параметры: разбор 20 задач»" className={field} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={label}>Метка</label>
                <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="№18 · Часть 2" className={field} /></div>
              <div><label className={label}>Тема</label>
                <select value={topic} onChange={(e) => setTopic(e.target.value)} className={field}>
                  {["Алгебра", "Геометрия", "Вероятность", "Анализ", "Финансовая", "Параметры", "Числа", "Общее"].map((t) => <option key={t}>{t}</option>)}
                </select></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={label}>Часть</label>
                <select value={part} onChange={(e) => setPart(+e.target.value as 0 | 1 | 2)} className={field}>
                  <option value={0}>Обе части</option><option value={1}>Часть 1</option><option value={2}>Часть 2</option>
                </select></div>
              <div><label className={label}>Страниц</label>
                <input type="number" min={1} max={200} value={pages} onChange={(e) => setPages(+e.target.value)} className={field} /></div>
            </div>

            <div>
              <label className={label}>PDF-файл (до ~2.5 МБ в демо-режиме)</label>
              <button
                onClick={() => fileRef.current?.click()}
                className={`flex w-full items-center gap-3 rounded-lg border-2 border-dashed px-4 py-4 text-left transition-all active:scale-[0.99] ${fileData ? "border-mark-green/60 bg-mark-green/5" : "border-board-600/70 bg-board-950/40 hover:border-mark-yellow/60"}`}
              >
                <UploadCloud className={`h-5 w-5 shrink-0 ${fileData ? "text-mark-green" : "text-chalk-500"}`} />
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-semibold text-chalk-100">
                    {fileMeta ? fileMeta.name : "Выбрать PDF-файл"}
                  </span>
                  <span className="block text-[11px] text-chalk-500">
                    {fileMeta ? `${fileMeta.sizeKb > 1024 ? (fileMeta.sizeKb / 1024).toFixed(1) + " МБ" : fileMeta.sizeKb + " КБ"} · готово к публикации` : "кликните, чтобы выбрать файл с устройства"}
                  </span>
                </span>
              </button>
              <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => onPickFile(e.target.files?.[0] ?? null)} />
            </div>

            <div><label className={label}>…или прямая ссылка на PDF (Google Drive, Яндекс.Диск, свой сервер)</label>
              <input value={fileUrl} onChange={(e) => { setFileUrl(e.target.value); if (e.target.value) { setFileData(null); setFileMeta(null); } }} placeholder="https://…/metodichka.pdf" className={field} /></div>

            <button onClick={submit} className="btn-gold w-full px-4 py-3 text-sm">Опубликовать методичку</button>
          </div>

          <div>
            <p className={label}>Как это увидят ученики</p>
            <div className="card p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-mark-red/12 text-mark-red"><FileText className="h-4.5 w-4.5" /></span>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-chalk-50">{title.trim() || "Название методички"}</p>
                  <p className="mt-0.5 text-[10.5px] text-chalk-500">{tag.trim() || "Метка"} · {topic} · {pages} стр. · бесплатно</p>
                </div>
              </div>
              <div className="mt-3 rounded-lg bg-mark-blue/8 px-3.5 py-3 text-[11.5px] leading-relaxed text-mark-blue">
                <p className="flex items-center gap-1.5 font-bold"><Server className="h-3.5 w-3.5" />Для боевого режима</p>
                <p className="mt-1 text-chalk-400">Файлы уходят на сервер (папка materials/), лимит размера снимается, скачивание — прямой ссылкой. Демо хранит файлы в браузере.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* список */}
      <div className="mt-4 space-y-2.5">
        {userMaterials.length === 0 && !showForm && (
          <div className="card px-6 py-10 text-center">
            <FileText className="mx-auto h-9 w-9 text-chalk-600" />
            <p className="mt-3 text-[13px] text-chalk-400">Вы ещё не добавили методичек. Загрузите первую — ученики увидят её мгновенно.</p>
          </div>
        )}
        {[...userMaterials, ...demoMaterials].map((m) => (
          <div key={m.id} className="card card-hover flex items-center gap-3.5 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-mark-red/12 text-mark-red">
              <FileText className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-chalk-50">
                {m.title}
                {m.kind === "demo" && <span className="ml-2 rounded-full bg-board-700 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-chalk-400">встроенная</span>}
              </p>
              <p className="mt-0.5 text-[11px] text-chalk-500">
                {m.tag} · {m.topic} · {m.pages} стр. · <b className="text-mark-yellow">{m.downloads}</b> скачиваний
                {m.fileSizeKb ? ` · ${m.fileSizeKb > 1024 ? (m.fileSizeKb / 1024).toFixed(1) + " МБ" : m.fileSizeKb + " КБ"}` : ""}
              </p>
            </div>
            <button onClick={() => { downloadFile(m); pushToast("Скачивание началось"); }} className="btn-ghost p-2.5" aria-label="Скачать" title="Скачать (проверить файл)">
              <Download className="h-4 w-4" />
            </button>
            {m.kind === "file" && (
              <button onClick={() => { removeMaterial(m.id); setMaterials(readAllMaterials()); pushToast("Методичка удалена"); }} className="btn-ghost !border-mark-red/40 !text-mark-red p-2.5 hover:!bg-mark-red/10" aria-label="Удалить" title="Удалить">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
