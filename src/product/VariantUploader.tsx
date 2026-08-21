import { useCallback, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, CheckCircle2, Copy, Download, FileJson, FileUp, Link2, Sparkles, Trash2, UploadCloud, XCircle,
} from "lucide-react";
import { useApp } from "./store";
import { LatexText } from "./ui";
import { isApiEnabled, loginTeacher, uploadVariant } from "./api";
import {
  sampleVariantJson, validateVariantJson, variantLink,
  type ParsedVariant, type PublishedVariant, type VariantValidationError,
} from "./variantSchema";

const TOKEN_KEY = "komi-teacher-token";

/**
 * Загрузка и публикация авторских вариантов.
 *
 * Поток: перетащить/выбрать .json → валидация структуры → предпросмотр
 * задач с рендерингом LaTeX → «Опубликовать» → уникальная ссылка для учеников.
 * Ошибки JSON и отсутствующие поля выводятся в список и toast-уведомления.
 */
export default function VariantUploader() {
  const { publishVariant, pushToast } = useApp();

  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [errors, setErrors] = useState<VariantValidationError[]>([]);
  const [parsed, setParsed] = useState<ParsedVariant | null>(null);
  const [published, setPublished] = useState<PublishedVariant | null>(null);
  const [publishing, setPublishing] = useState(false);
  /** Ссылка, возвращённая сервером (если вариант ушёл в БД). */
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setErrors([]);
    setParsed(null);
    setPublished(null);
    setPublishing(false);
    setServerUrl(null);
    setFileName(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleText = useCallback((text: string, name: string) => {
    setPublished(null);
    setFileName(name);
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "неизвестная ошибка";
      setErrors([{ path: "(файл)", message: `Некорректный JSON — файл не прошёл JSON.parse: ${msg}` }]);
      setParsed(null);
      pushToast("Ошибка: некорректный формат JSON");
      return;
    }
    const res = validateVariantJson(raw);
    if (!res.ok || !res.variant) {
      setErrors(res.errors);
      setParsed(null);
      pushToast(`Ошибка: ${res.errors.length} проблем(а) в структуре файла`);
      return;
    }
    setErrors([]);
    setParsed(res.variant);
    pushToast(`«${res.variant.variantTitle}» · ${res.variant.tasks.length} задач`);
  }, [pushToast]);

  const handleFile = (file: File | null | undefined) => {
    if (!file) return;
    if (!/\.json$/i.test(file.name)) {
      setErrors([{ path: "(файл)", message: `Нужен файл .json, получен «${file.name}».` }]);
      setParsed(null);
      setFileName(file.name);
      pushToast("Ошибка: нужен файл .json");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => handleText(String(reader.result ?? ""), file.name);
    reader.readAsText(file, "utf-8");
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  /** Публикация: при поднятом API — в БД (только преподаватель), иначе локально. */
  const doPublish = async () => {
    if (!parsed || publishing) return;
    setPublishing(true);

    if (isApiEnabled()) {
      try {
        // Токен преподавателя: берём сохранённый или логинимся (демо-доступ).
        let token = localStorage.getItem(TOKEN_KEY) ?? "";
        if (!token) {
          const login = await loginTeacher("teacher@komi.ru", "1234");
          token = login.token;
          localStorage.setItem(TOKEN_KEY, token);
        }
        const res = await uploadVariant(parsed, token);
        const pub: PublishedVariant = {
          ...parsed,
          id: res.variant_id,
          linkCode: res.short_code,
          publishedAt: new Date().toISOString(),
          authorName: "Преподаватель",
        };
        setPublished(pub);
        setServerUrl(res.public_url);
        pushToast(`Вариант сохранён в базе · ${res.short_code}`);
        setPublishing(false);
        return;
      } catch {
        pushToast("Сервер недоступен — публикую локально (демо)");
      }
    }

    // Локальная публикация (демо-режим или сервер лёг).
    const pub = publishVariant(parsed);
    setPublished(pub);
    setServerUrl(null);
    pushToast(`Вариант опубликован · ссылка ${pub.linkCode}`);
    setPublishing(false);
  };

  const copyLink = () => {
    if (!published) return;
    navigator.clipboard?.writeText(serverUrl ?? variantLink(published.linkCode));
    pushToast("Ссылка скопирована — отправьте ученикам");
  };

  const downloadSample = () => {
    const blob = new Blob([sampleVariantJson()], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "variant-sample.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    pushToast("Шаблон варианта скачан");
  };

  const part1 = useMemo(() => parsed?.tasks.filter((t) => t.type === "short_answer") ?? [], [parsed]);
  const part2 = useMemo(() => parsed?.tasks.filter((t) => t.type === "detailed_answer") ?? [], [parsed]);
  const maxPoints = useMemo(() => parsed?.tasks.reduce((s, t) => s + t.points, 0) ?? 0, [parsed]);

  return (
    <div>
      {/* ── зона загрузки ── */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
        className={`card card-hover flex cursor-pointer flex-col items-center justify-center border-2 border-dashed px-6 py-12 text-center transition-all duration-200 ${dragOver ? "scale-[1.01] !border-mark-yellow bg-mark-yellow/8" : "!border-board-600/70 hover:!border-mark-yellow/50"}`}
      >
        <span className={`flex h-14 w-14 items-center justify-center rounded-2xl transition-colors duration-200 ${dragOver ? "bg-mark-yellow text-board-950" : "bg-board-700/70 text-mark-yellow"}`}>
          <UploadCloud className="h-7 w-7" />
        </span>
        <p className="mt-4 font-display text-[15px] font-bold text-chalk-50">
          {dragOver ? "Отпустите файл — проверим структуру" : "Перетащите .json вариант сюда"}
        </p>
        <p className="mt-1 text-[12px] text-chalk-500">или нажмите, чтобы выбрать файл · структура валидируется до публикации</p>
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
        <div className="mt-4 flex flex-wrap justify-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button onClick={downloadSample} className="btn-ghost px-4 py-2 text-[12px]"><Download className="h-3.5 w-3.5" />Скачать шаблон</button>
          {fileName && <button onClick={reset} className="btn-ghost px-4 py-2 text-[12px]"><Trash2 className="h-3.5 w-3.5" />Сбросить</button>}
        </div>
      </div>

      {/* ── ошибки валидации ── */}
      {errors.length > 0 && (
        <div className="pop-in card mt-4 !border-mark-red/40 p-5">
          <p className="flex items-center gap-2 text-[13.5px] font-bold text-mark-red">
            <AlertTriangle className="h-4 w-4" /> Файл не прошёл валидацию · {errors.length} ошибк(и)
          </p>
          <ul className="mt-3 max-h-56 space-y-1.5 overflow-y-auto">
            {errors.map((e, i) => (
              <li key={i} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-chalk-300">
                <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mark-red" />
                <span><b className="font-mono text-[11.5px] text-mark-red">{e.path}</b> — {e.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── предпросмотр распознанного варианта ── */}
      {parsed && (
        <div className="pop-in mt-5">
          <div className="card p-5">
            <div className="flex flex-wrap items-center gap-3">
              <FileJson className="h-5 w-5 text-mark-green" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-[15px] font-bold text-chalk-50">{parsed.variantTitle}</p>
                <p className="text-[11px] text-chalk-500">
                  {fileName ?? "вариант"} · {parsed.tasks.length} задач · {part1.length} кратких / {part2.length} развёрнутых · до {maxPoints} б. · {parsed.timeLimitMinutes} мин
                </p>
              </div>
              <span className="chip !text-mark-green"><CheckCircle2 className="h-3.5 w-3.5" />структура валидна</span>
            </div>
          </div>

          {/* карточки задач с LaTeX */}
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {parsed.tasks.map((t, i) => (
              <div key={t.id} className={`card card-hover rise rise-${Math.min((i % 5) + 1, 5)} p-4`}>
                <div className="flex items-center gap-2.5">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-display text-[13px] font-bold ${t.type === "short_answer" ? "bg-board-700/80 text-mark-yellow" : "bg-board-700/80 text-mark-blue"}`}>{t.number}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-bold text-chalk-50">{t.topic}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-chalk-500">{t.points} б. · {t.type === "short_answer" ? "краткий ответ" : "развёрнутый ответ"}</p>
                  </div>
                </div>
                <p className="mt-2.5 text-[12.5px] leading-relaxed text-chalk-200"><LatexText text={t.latex_statement} /></p>
                {t.type === "short_answer" && t.answer && (
                  <p className="mt-2 font-mono text-[11.5px] text-mark-green">эталон: {t.answer}</p>
                )}
                {t.type === "detailed_answer" && (
                  <p className="mt-2 font-mono text-[11px] text-chalk-500">ответ: null (проверяет преподаватель)</p>
                )}
              </div>
            ))}
          </div>

          {/* публикация */}
          {!published ? (
            <div className="mt-5 flex justify-center">
              <button onClick={doPublish} disabled={publishing} className="btn-gold px-8 py-3.5 text-[15px] disabled:opacity-60">
                {publishing ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-board-950/30 border-t-board-950" />
                    Публикуем…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Опубликовать вариант
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="pop-in card mt-5 !border-mark-green/40 p-5 text-center">
              <p className="flex items-center justify-center gap-2 text-[14px] font-bold text-mark-green">
                <CheckCircle2 className="h-4.5 w-4.5" /> «{published.variantTitle}» опубликован
              </p>
              <p className="mt-1 text-[12px] text-chalk-400">Уникальная ссылка для учеников (код <b className="font-mono text-mark-yellow">{published.linkCode}</b>):</p>
              <div className="mx-auto mt-3 flex max-w-lg items-center gap-2 rounded-lg border border-board-600/70 bg-board-950/60 px-3 py-2.5">
                <Link2 className="h-4 w-4 shrink-0 text-mark-yellow" />
                <code className="min-w-0 flex-1 truncate text-left font-mono text-[11.5px] text-chalk-200">{serverUrl ?? variantLink(published.linkCode)}</code>
                <button onClick={copyLink} className="btn-gold shrink-0 px-3 py-1.5 text-[11.5px]"><Copy className="h-3.5 w-3.5" />Копировать</button>
              </div>
              <p className="mt-2.5 text-[11px] text-chalk-500">Откройте ссылку в новой вкладке — вариант запустится у ученика без авторизации.</p>
            </div>
          )}
        </div>
      )}

      {/* подсказка по структуре */}
      <div className="card mt-5 p-4">
        <p className="flex items-center gap-2 text-[12px] font-bold text-chalk-400"><FileUp className="h-3.5 w-3.5 text-mark-yellow" />Обязательные поля</p>
        <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-chalk-500">
          variantTitle · tasks[] · tasks[].number · tasks[].latex_statement · tasks[].answer (null для detailed_answer)
        </p>
      </div>
    </div>
  );
}
