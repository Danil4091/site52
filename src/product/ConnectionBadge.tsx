import { useEffect, useState } from "react";
import { Server, ServerOff } from "lucide-react";
import { API_URL, checkBackendHealth, isApiExplicit } from "./api";

/* ══════════════════════════════════════════════════════════════════
   Индикатор соединения с сервером в шапке.
   — серый «демо-режим»: бэкенд не отвечает, VITE_API_URL не задан
     явно (работает дефолт localhost:8000), данные в localStorage.
   — зелёный «сервер подключён»: бэкенд отвечает на /api/health.
   — красный «сервер недоступен»: VITE_API_URL задан явно, но бэкенд
     не отвечает.
   Перепроверяет каждые 30 секунд.
   ══════════════════════════════════════════════════════════════════ */

type Status = "demo" | "online" | "offline";

export default function ConnectionBadge() {
  const [status, setStatus] = useState<Status>("demo");

  useEffect(() => {
    let alive = true;
    const probe = async () => {
      const ok = await checkBackendHealth();
      if (!alive) return;
      if (ok) setStatus("online");
      else setStatus(isApiExplicit() ? "offline" : "demo");
    };
    void probe();
    const timer = setInterval(() => void probe(), 30_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const meta = {
    demo: {
      label: "Демо-режим",
      title:
        `Бэкенд не отвечает (${API_URL}), VITE_API_URL не задан явно.\n` +
        `Работаем в демо-режиме: данные в вашем браузере.\n` +
        `Чтобы включить общую базу, запустите бэкенд: docker compose up -d\n` +
        `(или задайте VITE_API_URL в .env и перезапустите npm run dev).`,
      dot: "bg-chalk-500",
      text: "text-chalk-400",
      icon: <ServerOff className="h-3.5 w-3.5" />,
    },
    online: {
      label: "Сервер подключён",
      title: `Бэкенд отвечает по адресу ${API_URL}.\nДанные синхронизируются с общей базой.`,
      dot: "bg-mark-green",
      text: "text-mark-green",
      icon: <Server className="h-3.5 w-3.5" />,
    },
    offline: {
      label: "Сервер недоступен",
      title:
        `VITE_API_URL = ${API_URL}, но бэкенд не отвечает.\n` +
        `Проверьте: запущен ли он (docker compose up -d) и открывается ли ${API_URL}/api/health.`,
      dot: "bg-mark-red",
      text: "text-mark-red",
      icon: <ServerOff className="h-3.5 w-3.5" />,
    },
  }[status];

  return (
    <span
      className={`hidden items-center gap-1.5 rounded-full border border-board-700/70 bg-board-800/60 px-2.5 py-1 text-[10.5px] font-semibold lg:inline-flex ${meta.text}`}
      title={meta.title}
      aria-label={meta.title}
    >
      <span className="relative flex h-1.5 w-1.5">
        {status === "online" && (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:animate-none ${meta.dot}`} />
        )}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      </span>
      {meta.icon}
      {meta.label}
    </span>
  );
}
