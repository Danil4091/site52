import { useEffect, useRef, useState } from "react";
import { Bell, BookOpen, CalendarClock, CheckCheck, Info, Trophy, Zap } from "lucide-react";
import { useApp, type NotifItem } from "./store";

const ICONS: Record<NotifItem["type"], { icon: typeof Bell; cls: string }> = {
  achievement: { icon: Trophy, cls: "bg-mark-yellow/15 text-mark-yellow" },
  lesson: { icon: CalendarClock, cls: "bg-mark-green/15 text-mark-green" },
  feed: { icon: Zap, cls: "bg-mark-blue/15 text-mark-blue" },
  system: { icon: Info, cls: "bg-board-700 text-chalk-300" },
  homework: { icon: BookOpen, cls: "bg-mark-pink/15 text-mark-pink" },
};

export function NotificationsBell() {
  const { notifs, markAllRead, openAssignment } = useApp();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const unread = notifs.filter((i) => !i.read).length;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div className="relative" ref={boxRef}>
      <button onClick={() => setOpen((o) => !o)}
        className={`relative flex h-9 w-9 items-center justify-center rounded-lg border transition-all duration-200 active:scale-95 ${open ? "border-mark-yellow/60 bg-board-700 text-mark-yellow" : "border-board-600/70 bg-board-800/60 text-chalk-400 hover:text-chalk-50"}`}
        aria-label={`Уведомления${unread ? `, непрочитанных: ${unread}` : ""}`}>
        <Bell className="h-4 w-4" />
        {unread > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-mark-red px-1 text-[9px] font-bold text-board-950">{unread}</span>}
      </button>

      {open && (
        <div className="pop-in absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-board-600/70 bg-board-850 shadow-xl">
          <div className="flex items-center justify-between border-b border-board-700 px-4 py-3">
            <p className="text-[13px] font-bold text-chalk-50">Уведомления</p>
            <button onClick={markAllRead} className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold text-mark-green transition-colors hover:bg-board-700">
              <CheckCheck className="h-3.5 w-3.5" />
              Прочитать все
            </button>
          </div>
          <ul className="max-h-[min(24rem,60vh)] divide-y divide-board-700 overflow-y-auto">
            {notifs.length === 0 && <li className="px-4 py-8 text-center text-[12px] text-chalk-500">Пока тихо — решите вариант, и здесь появятся события</li>}
            {notifs.map((n) => {
              const meta = ICONS[n.type];
              const Icon = meta.icon;
              const clickable = !!n.assignmentId;
              return (
                <li key={n.id}
                  onClick={() => { if (n.assignmentId) { openAssignment(n.assignmentId); setOpen(false); } }}
                  className={`flex gap-3 px-4 py-3 transition-colors duration-200 hover:bg-board-800 ${n.read ? "" : "bg-board-800/50"} ${clickable ? "cursor-pointer" : ""}`}>
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.cls}`}><Icon className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[12.5px] font-bold text-chalk-50">{n.title}</p>
                      {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-mark-yellow" />}
                    </div>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-chalk-400">{n.body}</p>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-chalk-600">
                      {n.time}{clickable ? " · нажмите, чтобы открыть" : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
