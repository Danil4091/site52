import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { Check, Delete, Eraser, Flame, Keyboard, Minus } from "lucide-react";

/* ═══════════════════════ LaTeX-рендеринг ═══════════════════════
   Принимает строку из базы/API и рендерит:
     $$…$$  — блочные формулы (displayMode, центрируются)
     $…$ и \(…\) — строчные
   Всё остальное остаётся обычным текстом. Ошибки LaTeX не валят страницу. */

type Part = { kind: "text" | "tex" | "block"; value: string };

function parseTex(text: string): Part[] {
  const out: Part[] = [];
  const re = /\$\$([\s\S]+?)\$\$|\\\(([\s\S]+?)\\\)|\$([^$\n]+?)\$/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ kind: "text", value: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ kind: "block", value: m[1] });
    else out.push({ kind: "tex", value: m[2] ?? m[3] ?? "" });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", value: text.slice(last) });
  return out;
}

function Tex({ tex, block }: { tex: string; block?: boolean }) {
  const html = katex.renderToString(tex, { displayMode: !!block, throwOnError: false, errorColor: "#ff7a6b" });
  return <span className={block ? "my-2 block overflow-x-auto" : undefined} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function LatexText({ text, className }: { text: string; className?: string }) {
  const parts = parseTex(text);
  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.kind === "text" ? <span key={i}>{p.value}</span> : <Tex key={i} tex={p.value} block={p.kind === "block"} />
      )}
    </span>
  );
}

/* ═══════════════════════ изображения задач ═══════════════════════ */
export function isImageRef(s: string): boolean {
  return /^https?:\/\//i.test(s) || /^image\/(png|jpe?g|webp|svg\+xml|gif);base64,/i.test(s);
}

export function TaskImage({ src, alt }: { src: string; alt: string }) {
  const [broken, setBroken] = useState(false);
  const [zoom, setZoom] = useState(false);
  if (broken || !isImageRef(src)) return null;
  return (
    <>
      <button type="button" onClick={() => setZoom(true)}
        className="group mt-3 block max-w-full cursor-zoom-in overflow-hidden rounded-xl border border-board-700/70 bg-board-950/40 transition-all duration-200 hover:-translate-y-0.5 hover:border-mark-blue/50"
        title="Нажмите, чтобы увеличить">
        <img src={src} alt={alt} loading="lazy" onError={() => setBroken(true)}
          className="max-h-72 w-auto max-w-full bg-white object-contain transition-transform duration-300 group-hover:scale-[1.02]" />
      </button>
      {zoom && (
        <div className="pop-in fixed inset-0 z-[80] flex cursor-zoom-out items-center justify-center bg-board-950/85 p-4 backdrop-blur-sm" onClick={() => setZoom(false)}>
          <img src={src} alt={alt} className="max-h-[92vh] max-w-[95vw] rounded-xl bg-white object-contain p-2 shadow-2xl" />
        </div>
      )}
    </>
  );
}

/* ═══════════════════════ ввод ответа ═══════════════════════
   Ответы ЕГЭ — целые или конечные десятичные дроби: только цифры,
   «-», запятая и точка. Всё остальное отбрасывается на вводе. */
export function sanitizeAnswer(s: string): string {
  return s.replace(/[^0-9.,-]/g, "").replace(/(?!^)-/g, "");
}

const KEYS: { k: string; kind?: "fn" | "ok" | "danger" }[] = [
  { k: "7" }, { k: "8" }, { k: "9" }, { k: "back", kind: "fn" },
  { k: "4" }, { k: "5" }, { k: "6" }, { k: "-", kind: "fn" },
  { k: "1" }, { k: "2" }, { k: "3" }, { k: ",", kind: "fn" },
  { k: "0" }, { k: "." }, { k: "clear", kind: "danger" }, { k: "ok", kind: "ok" },
];

/** Экранная цифровая клавиатура — на смартфонах инпут не «уезжает». */
export function Numpad({ value, onChange, onSubmit, className = "" }: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  className?: string;
}) {
  const press = (k: string) => {
    if (k === "back") return onChange(value.slice(0, -1));
    if (k === "clear") return onChange("");
    if (k === "ok") return onSubmit?.();
    onChange(sanitizeAnswer(value + k));
  };
  return (
    <div className={`grid grid-cols-4 gap-1.5 ${className}`} role="group" aria-label="Цифровая клавиатура">
      {KEYS.map(({ k, kind }) => (
        <button key={k} type="button" onClick={() => press(k)}
          className={`numpad-key flex items-center justify-center ${
            kind === "ok" ? "!bg-mark-green !text-board-950 hover:!bg-mark-green" :
            kind === "danger" ? "!text-mark-red" :
            kind === "fn" ? "!text-mark-yellow" : ""
          }`}
          aria-label={k === "back" ? "Стереть символ" : k === "clear" ? "Очистить" : k === "ok" ? "Готово" : k}>
          {k === "back" ? <Delete className="h-5 w-5" /> :
           k === "clear" ? <Eraser className="h-5 w-5" /> :
           k === "ok" ? <Check className="h-5 w-5" /> :
           k === "-" ? <Minus className="h-4 w-4" /> : k}
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════ тепловая карта №1–19 ═══════════════════════ */
export function heatColor(solved: number, attempts: number): { bg: string; fg: string; label: string } {
  if (attempts === 0) return { bg: "transparent", fg: "var(--color-chalk-500)", label: "нет попыток" };
  const r = (solved / attempts) * 100;
  if (r >= 80) return { bg: "color-mix(in srgb, var(--color-mark-green) 22%, transparent)", fg: "var(--color-mark-green)", label: `${Math.round(r)}%` };
  if (r >= 50) return { bg: "color-mix(in srgb, var(--color-mark-yellow) 20%, transparent)", fg: "var(--color-mark-yellow)", label: `${Math.round(r)}%` };
  return { bg: "color-mix(in srgb, var(--color-mark-red) 22%, transparent)", fg: "var(--color-mark-red)", label: `${Math.round(r)}%` };
}

export function Heatmap({ stats, className = "" }: {
  stats: Record<number, { solved: number; attempts: number }>;
  className?: string;
}) {
  const cell = (n: number) => {
    const s = stats[n] ?? { solved: 0, attempts: 0 };
    const h = heatColor(s.solved, s.attempts);
    return (
      <div key={n} title={`№${n} · решено ${s.solved} из ${s.attempts}`}
        className={`card-hover flex h-12 flex-col items-center justify-center rounded-lg border sm:h-14 ${s.attempts === 0 ? "border-dashed border-board-600/70" : "border-board-700/60"}`}
        style={{ background: h.bg }}>
        <span className="font-display text-[13px] font-bold leading-none" style={{ color: s.attempts ? h.fg : "var(--color-chalk-500)" }}>{n}</span>
        <span className="mt-0.5 font-mono text-[9px] font-semibold" style={{ color: s.attempts ? h.fg : "var(--color-chalk-600)" }}>{h.label}</span>
      </div>
    );
  };
  return (
    <div className={className}>
      <p className="tick mb-2">Часть 1 · №1–12</p>
      <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">{Array.from({ length: 12 }, (_, i) => cell(i + 1))}</div>
      <p className="tick mb-2 mt-4">Часть 2 · №13–19</p>
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">{Array.from({ length: 7 }, (_, i) => cell(i + 13))}</div>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-[10.5px] font-semibold text-chalk-500">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--color-mark-green)" }} /> ≥ 80%</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--color-mark-yellow)" }} /> 50–79%</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--color-mark-red)" }} /> &lt; 50%</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-dashed border-chalk-600" /> не решали</span>
      </div>
    </div>
  );
}

/* ═══════════════════════ XP / уровень / стрик ═══════════════════════ */
export const levelFromXp = (xp: number) => Math.floor(xp / 100) + 1;

export function XpBar({ xp, className = "" }: { xp: number; className?: string }) {
  const level = levelFromXp(xp);
  const prog = xp % 100;
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between">
        <span className="font-display text-[13px] font-bold text-mark-yellow">LVL {level}</span>
        <span className="font-mono text-[11px] font-semibold tabular-nums text-chalk-400">{prog} / 100 XP</span>
      </div>
      <div className="xp-track mt-1.5">
        <div className="xp-fill" style={{ width: `${prog}%` }} />
      </div>
    </div>
  );
}

export function StreakFlame({ days, active, className = "" }: { days: number; active: boolean; className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Flame className={`h-6 w-6 ${days > 0 ? (active ? "flame-live text-mark-red" : "text-mark-red/80") : "text-chalk-600"}`} />
      <div>
        <p key={days} className="count-pop font-display text-xl font-bold leading-none tabular-nums text-chalk-50">{days}</p>
        <p className="text-[10px] font-bold uppercase tracking-wider text-chalk-500">
          {active ? "дней · сегодня ✓" : "дней подряд"}
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════ конфетти ═══════════════════════ */
export function ConfettiBurst({ burst }: { burst: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prev = useRef(0);
  useEffect(() => {
    if (!burst || burst === prev.current) return;
    prev.current = burst;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = (canvas.width = window.innerWidth * dpr);
    const H = (canvas.height = window.innerHeight * dpr);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    const COLORS = ["#ffc94d", "#5ee6a8", "#6bd5ff", "#ff9ecb", "#ff7a6b", "#f2f5fc"];
    interface P { x: number; y: number; vx: number; vy: number; w: number; h: number; rot: number; vr: number; color: string; life: number; }
    const parts: P[] = [];
    const cannon = (x: number, dir: number) => {
      for (let i = 0; i < 55; i++) {
        const angle = -Math.PI / 2 + dir * (Math.random() * 0.9 + 0.15);
        const speed = (7 + Math.random() * 8) * dpr;
        parts.push({ x, y: H + 10, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, w: (5 + Math.random() * 6) * dpr, h: (8 + Math.random() * 8) * dpr, rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, color: COLORS[Math.floor(Math.random() * COLORS.length)], life: 1 });
      }
    };
    cannon(W * 0.12, -1);
    cannon(W * 0.88, 1);
    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, W, H);
      let alive = false;
      for (const p of parts) {
        p.vy += 0.22 * dpr; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= 0.008;
        if (p.y < H + 40 && p.life > 0) {
          alive = true;
          ctx.save();
          ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.6));
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        }
      }
      if (alive) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); ctx.clearRect(0, 0, W, H); };
  }, [burst]);
  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-[70]" aria-hidden="true" />;
}

/* ═══════════════════════ аватар и спарклайн ═══════════════════════ */
const AVATAR_COLORS = ["bg-mark-yellow text-board-950", "bg-mark-green text-board-950", "bg-mark-blue text-board-950", "bg-mark-pink text-board-950", "bg-mark-red text-board-950", "bg-board-600 text-chalk-50"];

export function Avatar({ name, className = "h-9 w-9 text-[11px]" }: { name: string; className?: string }) {
  const color = AVATAR_COLORS[name.length % AVATAR_COLORS.length];
  const init = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return <span className={`flex shrink-0 items-center justify-center rounded-full font-bold ${color} ${className}`}>{init}</span>;
}

export function Sparkline({ values, width = 160, height = 44 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (width - 8) + 4;
    const y = height - 6 - ((v - min) / range) * (height - 12);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const [lx, ly] = pts[pts.length - 1].split(",");
  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden="true">
      <polyline points={pts.join(" ")} fill="none" stroke="var(--color-mark-yellow)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="3.5" fill="var(--color-mark-yellow)" />
    </svg>
  );
}

/* ═══════════════════════ ГЛОБАЛЬНАЯ ПЛАВАЮЩАЯ КЛАВИАТУРА ═══════════════════════
   Одна клавиатура на всё приложение: N карт-задач = 1 клавиатура в DOM.
   AnswerInput при фокусе регистрирует себя; NumpadDock печатает строго
   в активное поле. preventDefault на pointerdown не даёт инпуту потерять
   фокус при клике по клавише — ввод никогда не «улетает» в соседнее поле. */

export interface FieldHandle {
  label: string;
  get: () => string;
  set: (v: string) => void;
  submit: () => void;
}

interface DockApi {
  register: (h: FieldHandle | null) => void;
}

const DockCtx = createContext<DockApi>({ register: () => {} });
export const useFieldDock = () => useContext(DockCtx);

function NumpadDock({ active, press }: { active: FieldHandle | null; press: (k: string) => void }) {
  if (!active) return null;
  return (
    <div
      className="dock-in fixed inset-x-2 bottom-[4.6rem] z-40 md:inset-x-auto md:bottom-5 md:right-5 md:w-[264px]"
      role="group"
      aria-label={`Экранная клавиатура — ввод в ${active.label}`}
    >
      <div className="rounded-2xl border border-board-600/70 bg-board-850/95 p-3 shadow-2xl shadow-black/50 backdrop-blur">
        <div className="mb-2 flex items-center gap-2 px-1">
          <Keyboard className="h-3.5 w-3.5 text-mark-yellow" />
          <span className="truncate text-[10.5px] font-bold uppercase tracking-wider text-chalk-400">
            ввод: <span className="text-mark-yellow">{active.label}</span>
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {KEYS.map(({ k, kind }) => (
            <button
              key={k}
              type="button"
              /* preventDefault сохраняет фокус на активном инпуте */
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => press(k)}
              className={`numpad-key flex items-center justify-center ${
                kind === "ok" ? "!bg-mark-green !text-board-950" :
                kind === "danger" ? "!text-mark-red" :
                kind === "fn" ? "!text-mark-yellow" : ""
              }`}
              aria-label={k === "back" ? "Стереть символ" : k === "clear" ? "Очистить" : k === "ok" ? "Проверить" : k}
            >
              {k === "back" ? <Delete className="h-5 w-5" /> :
               k === "clear" ? <Eraser className="h-5 w-5" /> :
               k === "ok" ? <Check className="h-5 w-5" /> :
               k === "-" ? <Minus className="h-4 w-4" /> : k}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function FieldDockProvider({ children }: { children: React.ReactNode }) {
  const handleRef = useRef<FieldHandle | null>(null);
  const [active, setActive] = useState<FieldHandle | null>(null);

  const register = useCallback((h: FieldHandle | null) => {
    handleRef.current = h;
    setActive(h);
  }, []);

  const press = useCallback((k: string) => {
    const h = handleRef.current;
    if (!h) return;
    if (k === "back") return h.set(h.get().slice(0, -1));
    if (k === "clear") return h.set("");
    if (k === "ok") return h.submit();
    h.set(sanitizeAnswer(h.get() + k));
  }, []);

  return (
    <DockCtx.Provider value={{ register }}>
      {children}
      <NumpadDock active={active} press={press} />
    </DockCtx.Provider>
  );
}

/** Инпут ответа, пристыкованный к глобальной клавиатуре.
    Принимает только цифры, «-», «,» и «.» — остальное отбрасывается. */
export function AnswerInput({
  label, value, onChange, onSubmit, placeholder = "Ответ — только цифры, «-» и «,»",
  autoFocus, invalid, className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  invalid?: boolean;
  className?: string;
}) {
  const { register } = useFieldDock();
  const ref = useRef({ value, onChange, onSubmit });
  ref.current = { value, onChange, onSubmit };
  const inputEl = useRef<HTMLInputElement>(null);

  /* при размонтировании поля клавиатура скрывается */
  useEffect(() => () => register(null), [register]);

  /* На мобильных глобальная клавиатура занимает низ экрана — поднимаем
     инпут в зону видимости, чтобы ответ не прятался под ней. */
  const scrollIntoView = () => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(
      () => inputEl.current?.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" }),
      240
    );
  };

  return (
    <input
      ref={inputEl}
      value={value}
      onChange={(e) => onChange(sanitizeAnswer(e.target.value))}
      onFocus={() => {
        register({
          label,
          get: () => ref.current.value,
          set: ref.current.onChange,
          submit: ref.current.onSubmit,
        });
        scrollIntoView();
      }}
      onBlur={() => register(null)}
      onKeyDown={(e) => { if (e.key === "Enter") onSubmit(); }}
      placeholder={placeholder}
      inputMode="decimal"
      autoComplete="off"
      autoFocus={autoFocus}
      aria-label={`Ответ: ${label}`}
      className={`w-full rounded-lg border-2 bg-board-950/50 px-4 py-3 font-mono text-lg font-semibold text-chalk-50 outline-none transition-all placeholder:font-sans placeholder:text-[13px] placeholder:font-normal placeholder:text-chalk-500 focus:ring-4 ${
        invalid
          ? "shake border-mark-red focus:border-mark-red focus:ring-mark-red/10"
          : "border-board-600/70 focus:border-mark-yellow focus:ring-mark-yellow/10"
      } ${className}`}
    />
  );
}
