import { useEffect, useMemo, useRef, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { X } from "lucide-react";

/* ─────────────── LaTeX + markdown-картинки ─────────────── */
type Part = { kind: "text" | "tex" | "img"; value: string; alt?: string };
function parse(text: string): Part[] {
  const out: Part[] = [];
  const re = /\$\$([\s\S]+?)\$\$|\\\(([\s\S]+?)\\\)|\$([^$\n]+?)\$|!\[([^\]]*)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ kind: "text", value: text.slice(last, m.index) });
    if (m[5] !== undefined) out.push({ kind: "img", value: m[5], alt: m[4] || "Чертёж" });
    else out.push({ kind: "tex", value: m[1] ?? m[2] ?? m[3] ?? "" });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", value: text.slice(last) });
  return out;
}

export function isImageRef(s: string): boolean {
  return /^(https?:\/\/|image\/)/i.test(s);
}

let zoomSetter: ((src: string | null) => void) | null = null;

export function TaskImage({ src, alt }: { src: string; alt: string }) {
  const [broken, setBroken] = useState(false);
  if (broken || !isImageRef(src)) {
    return <span className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-chalk-600/40 bg-board-800/40 px-3 py-2.5 text-[11.5px] font-medium text-chalk-500">Чертёж недоступен</span>;
  }
  return (
    <button type="button" onClick={() => zoomSetter?.(src)} className="group mt-3 block max-w-full cursor-zoom-in overflow-hidden rounded-xl border border-board-600/50 bg-board-850 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-mark-yellow/60 hover:shadow-lg" title="Нажмите, чтобы увеличить">
      <img src={src} alt={alt} loading="lazy" onError={() => setBroken(true)} className="max-h-72 w-auto max-w-full bg-white object-contain transition-transform duration-300 group-hover:scale-[1.02]" />
    </button>
  );
}

function ZoomOverlay() {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    zoomSetter = setSrc;
    return () => { zoomSetter = null; };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSrc(null);
    if (src) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [src]);
  if (!src) return null;
  return (
    <div className="pop-in fixed inset-0 z-[80] flex cursor-zoom-out items-center justify-center bg-board-950/90 p-4 backdrop-blur-sm" onClick={() => setSrc(null)} role="dialog" aria-label="Увеличенный чертёж">
      <img src={src} alt="Чертёж крупно" className="max-h-[92vh] max-w-[95vw] rounded-xl bg-white object-contain p-2 shadow-2xl" />
      <span className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-board-800 text-chalk-200"><X className="h-5 w-5" /></span>
    </div>
  );
}

export function LatexText({ text, className }: { text: string; className?: string }) {
  const parts = useMemo(() => parse(text), [text]);
  return (
    <span className={className}>
      <ZoomOverlay />
      {parts.map((p, i) => {
        if (p.kind === "img") return <TaskImage key={i} src={p.value} alt={p.alt ?? "Чертёж"} />;
        if (p.kind === "tex") {
          return <span key={i} dangerouslySetInnerHTML={{ __html: katex.renderToString(p.value, { throwOnError: false, errorColor: "#ff8b6a" }) }} />;
        }
        return <span key={i}>{p.value}</span>;
      })}
    </span>
  );
}

/* ─────────────── конфетти (canvas, без зависимостей) ─────────────── */
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
    const COLORS = ["#f2c14e", "#a8d5a2", "#8fd0e8", "#efa9c9", "#ff8b6a", "#f5f1e4"];
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

/* ─────────────── аватар ─────────────── */
const AVATAR_COLORS = ["bg-mark-yellow text-board-950", "bg-mark-green text-board-950", "bg-mark-blue text-board-950", "bg-mark-pink text-board-950", "bg-mark-red text-board-950", "bg-board-600 text-chalk-50"];
export function Avatar({ name, className = "h-9 w-9 text-[11px]" }: { name: string; className?: string }) {
  const color = AVATAR_COLORS[name.length % AVATAR_COLORS.length];
  const init = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return <span className={`flex shrink-0 items-center justify-center rounded-full font-bold ${color} ${className}`}>{init}</span>;
}

/* ─────────────── спарклайн (SVG) ─────────────── */
export function Sparkline({ values, width = 160, height = 44 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (width - 8) + 4;
    const y = height - 6 - ((v - min) / range) * (height - 12);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden="true">
      <polyline points={pts.join(" ")} fill="none" stroke="var(--color-mark-yellow)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1].split(",")[0]} cy={pts[pts.length - 1].split(",")[1]} r="3.5" fill="var(--color-mark-yellow)" />
    </svg>
  );
}
