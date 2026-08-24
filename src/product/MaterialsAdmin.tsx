import { useEffect, useRef, useState } from "react";
import { Download, FileText, LogOut, Plus, Server, Trash2, UploadCloud } from "lucide-react";
import { useApp } from "./store";
import { addMaterialWithFile, deleteServerMaterial, downloadFile, loadAllMaterials, printMaterialInNewWindow, removeMaterial, SRV_PREFIX, type StudyMaterial } from "./materials";
import { API_URL, checkBackendHealth, hasServerAuth, isApiEnabled } from "./api";

/* Файлы хранятся в IndexedDB — лимит на порядки больше, чем у localStorage.
   50 МБ — мягкий потолок; в боевом режиме файл уйдёт на сервер, ограничений нет. */
const MAX_FILE_KB = 50 * 1024;

/* Панель «Методички» в кабинете преподавателя:
   загрузка PDF (файл или ссылка), список со счётчиком скачиваний, удаление. */
export default function MaterialsAdmin() {
  const { pushToast, logout } = useApp();
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [showForm, setShowForm] = useState(false);
  /* Куда уходят файлы: на сервер (видны всем) или локально (демо). */
  const [serverMode, setServerMode] = useState<"checking" | "ready" | "no-token" | "no-server">("checking");
  const [title, setTitle] = useState("");
  const [tag, setTag] = useState("");
  const [topic, setTopic] = useState("Алгебра");
  const [part, setPart] = useState<0 | 1 | 2>(0);
  const [pages, setPages] = useState(2);
  const [fileUrl, setFileUrl] = useState("");
  const [fileData, setFileData] = useState<string | null>(null);
  const [fileObj, setFileObj] = useState<File | null>(null);
  const [fileMeta, setFileMeta] = useState<{ name: string; sizeKb: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /* Асинхронная загрузка списка: сервер (если подключён) + локальные + демо. */
  useEffect(() => {
    void loadAllMaterials().then(setMaterials);
  }, []);

  /* Определяем, куда реально уходят файлы при загрузке:
     сервер+токен → «на сервере» (видны всем ученикам),
     сервер без токена → локально (вошли до запуска бэкенда — надо перезайти),
     нет сервера → демо-режим. */
  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!isApiEnabled()) {
        if (alive) setServerMode("no-server");
        return;
      }
      const ok = await checkBackendHealth();
      if (!alive) return;
      if (!ok) setServerMode("no-server");
      else if (!hasServerAuth()) setServerMode("no-token");
      else setServerMode("ready");
    })();
    return () => {
      alive = false;
    };
  }, []);

  const refresh = () => {
    void loadAllMaterials().then(setMaterials);
  };

  const field = "w-full rounded-lg border border-board-600/70 bg-board-950/50 px-3 py-2 text-[13px] text-chalk-50 outline-none transition-all placeholder:text-chalk-600 focus:border-mark-yellow";
  const label = "mb-1 block text-[10.5px] font-bold uppercase tracking-wider text-chalk-500";

  const onPickFile = (f: File | null) => {
    if (!f) return;
    if (f.type !== "application/pdf" && !/\.pdf$/i.test(f.name)) {
      pushToast("Нужен файл PDF");
      return;
    }
    const sizeKb = Math.round(f.size / 1024);
    if (sizeKb > MAX_FILE_KB) {
      pushToast(`Файл ${Math.round(sizeKb / 1024 * 10) / 10} МБ больше лимита демо-режима (50 МБ). В боевом режиме ограничений нет — файл уйдёт на сервер.`);
      return;
    }
    setFileObj(f);
    setFileMeta({ name: f.name, sizeKb });
    setFileUrl("");
    /* dataURL читаем только как фолбэк (если IndexedDB недоступен) */
    const reader = new FileReader();
    reader.onload = () => setFileData(String(reader.result));
    reader.readAsDataURL(f);
  };

  const submit = async () => {
    if (!title.trim()) return pushToast("Укажите название методички");
    if (!fileObj && !fileUrl.trim()) return pushToast("Загрузите PDF или укажите ссылку на файл");
    if (saving) return;
    setSaving(true);
    try {
      const saved = await addMaterialWithFile(
        {
          title: title.trim(),
          tag: tag.trim() || "Методичка",
          topic,
          part,
          pages: Math.max(1, pages),
          fileUrl: fileUrl.trim() || undefined,
          fileName: fileMeta?.name,
          fileSizeKb: fileMeta?.sizeKb,
        },
        fileObj,
        fileData,
      );
      refresh();
      setShowForm(false);
      setTitle(""); setTag(""); setFileUrl(""); setFileData(null); setFileObj(null); setFileMeta(null);
      if (fileRef.current) fileRef.current.value = "";
      /* Честно сообщаем, куда сохранилось: на сервер (видно всем) или
         локально (демо-режим — видно только в этом браузере). */
      pushToast(
        saved.savedTo === "server"
          ? "Методичка сохранена на сервере — ученики уже могут её скачать"
          : "Сохранено локально (демо-режим): войдите через сервер, чтобы методичку видели ученики",
      );
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const userMaterials = materials.filter((m) => m.kind === "file");
  const demoMaterials = materials.filter((m) => m.kind === "demo");

  return (
    <div>
      {/* Индикатор: куда уходят файлы. Главный кейс — вошли ДО запуска
          бэкенда: сессия без токена, файлы падают локально, ученики их
          не видят. Баннер объясняет и даёт кнопку «Перезайти». */}
      {serverMode === "ready" && (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-mark-green/30 bg-mark-green/8 px-4 py-3">
          <Server className="h-4 w-4 shrink-0 text-mark-green" />
          <p className="text-[12.5px] text-mark-green">
            Сервер подключён — файлы методичек сохраняются на сервере и видны всем ученикам.
          </p>
        </div>
      )}
      {serverMode === "no-token" && (
        <div className="mb-4 flex flex-wrap items-center gap-2.5 rounded-xl border border-mark-yellow/40 bg-mark-yellow/8 px-4 py-3">
          <Server className="h-4 w-4 shrink-0 text-mark-yellow" />
          <p className="min-w-0 flex-1 text-[12.5px] text-mark-yellow">
            Сервер работает, но вы вошли без серверной авторизации — методички сохраняются <b>локально</b> и не видны ученикам. Перезайдите в аккаунт, чтобы включить синхронизацию.
          </p>
          <button onClick={logout} className="btn-ghost !border-mark-yellow/50 !text-mark-yellow px-3 py-1.5 text-[11.5px] hover:!bg-mark-yellow/10">
            <LogOut className="h-3.5 w-3.5" />Перезайти
          </button>
        </div>
      )}
      {serverMode === "no-server" && (
        <div className="mb-4 space-y-2 rounded-xl border border-board-600/60 bg-board-800/50 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Server className="h-4 w-4 shrink-0 text-chalk-500" />
            <p className="text-[12.5px] text-chalk-400">
              Демо-режим: сервер не отвечает по адресу <code className="text-mark-yellow">{API_URL}</code>. Файлы сохраняются в этом браузере.
            </p>
          </div>
          <p className="pl-6 text-[11.5px] leading-relaxed text-chalk-500">
            Чтобы методички сохранялись на сервере: 1) запустите бэкенд — <code className="text-chalk-300">docker compose up -d</code>;
            2) откройте сайт <b className="text-chalk-300">локально</b> — <code className="text-chalk-300">localhost:3000</code> или{" "}
            <code className="text-chalk-300">IP-адрес:3000</code> (а не через предпросмотр); 3) войдите заново.
          </p>
        </div>
      )}

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
                {m.kind === "file" && (
                  m.id.startsWith(SRV_PREFIX)
                    ? <span className="ml-2 rounded-full bg-mark-green/15 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-mark-green" title="Файл на сервере — виден всем ученикам">на сервере</span>
                    : <span className="ml-2 rounded-full bg-mark-red/15 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-mark-red" title="Демо-режим: файл в этом браузере, ученики его не видят. Войдите через сервер.">локально</span>
                )}
              </p>
              <p className="mt-0.5 text-[11px] text-chalk-500">
                {m.tag} · {m.topic} · {m.pages} стр. · <b className="text-mark-yellow">{m.downloads}</b> скачиваний
                {m.fileSizeKb ? ` · ${m.fileSizeKb > 1024 ? (m.fileSizeKb / 1024).toFixed(1) + " МБ" : m.fileSizeKb + " КБ"}` : ""}
              </p>
            </div>
            {m.kind === "file" ? (
              <button
                onClick={async () => {
                  const r = await downloadFile(m);
                  if (r === "file") pushToast("PDF скачивается…");
                  else if (r === "url") pushToast("Открываю файл по ссылке…");
                  else pushToast("Файл не найден — укажите прямую ссылку или загрузите PDF заново");
                }}
                className="btn-ghost p-2.5" aria-label="Скачать" title="Скачать файл (проверить)">
                <Download className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={() => { printMaterialInNewWindow(m); }}
                className="btn-ghost p-2.5" aria-label="Открыть" title="Открыть печатную версию (демо-материал)">
                <Download className="h-4 w-4" />
              </button>
            )}
            {m.kind === "file" && (
              <button
                onClick={() => {
                  if (m.id.startsWith(SRV_PREFIX)) {
                    void deleteServerMaterial(m.id.slice(SRV_PREFIX.length)).then(refresh);
                  } else {
                    removeMaterial(m.id);
                    refresh();
                  }
                  pushToast("Методичка удалена");
                }}
                className="btn-ghost !border-mark-red/40 !text-mark-red p-2.5 hover:!bg-mark-red/10" aria-label="Удалить" title="Удалить">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
