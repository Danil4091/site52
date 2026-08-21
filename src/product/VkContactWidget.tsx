import { useState } from "react";
import { ChevronDown, MessageCircle, X } from "lucide-react";
import { ADMIN_DISPLAY_NAME, TUTOR_PHOTO_URL, VK_GROUP_URL } from "./config";

/**
 * Виджет обратной связи и записи в ВК.
 * Десктоп: липкая карточка справа. Мобильные: компактная плашка внизу,
 * раскрывается в полную карточку.
 */

/** Аккуратный аватар-заглушка, если фото не загрузится. */
function FallbackAvatar() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-board-700">
      <span className="font-display text-6xl font-bold text-mark-yellow">А</span>
    </div>
  );
}

function CardBody({ onCollapse }: { onCollapse?: () => void }) {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <div className="relative overflow-hidden rounded-2xl border border-board-600/60 bg-board-850 shadow-2xl">
      <button
        onClick={onCollapse}
        className="absolute right-3 top-3 z-10 rounded-lg bg-board-950/60 p-1.5 text-chalk-400 backdrop-blur transition-colors hover:text-chalk-50"
        aria-label="Свернуть"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="relative h-44 w-full overflow-hidden">
        {imgFailed ? (
          <FallbackAvatar />
        ) : (
          <img
            src={TUTOR_PHOTO_URL}
            alt={`${ADMIN_DISPLAY_NAME} — репетитор по математике`}
            className="h-full w-full object-cover object-top"
            onError={() => setImgFailed(true)}
          />
        )}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-board-850 to-transparent" />
        <span className="absolute bottom-3 left-4 flex items-center gap-1.5 rounded-full bg-mark-green/15 px-2.5 py-1 text-[10.5px] font-bold text-mark-green backdrop-blur">
          <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-mark-green" />
          идёт набор
        </span>
      </div>

      <div className="p-5 pt-2">
        <h3 className="font-display text-[15px] font-bold tracking-tight text-chalk-50">
          {ADMIN_DISPLAY_NAME} — Репетитор по математике
        </h3>
        <p className="mt-2 text-[12.5px] leading-relaxed text-chalk-300">
          Застрял на задаче или хочешь записаться на годовой курс подготовки к ЕГЭ/ОГЭ? Напиши мне в ВК!
        </p>
        <a
          href={VK_GROUP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#0077FF] py-3 text-sm font-bold text-white shadow-lg shadow-[#0077FF]/25 transition-all duration-200 hover:brightness-110 hover:-translate-y-0.5 active:scale-[0.98]"
        >
          <MessageCircle className="h-4 w-4" />
          Написать в VK
        </a>
        <p className="mt-2.5 text-center text-[10.5px] text-chalk-500">первое занятие — бесплатно</p>
      </div>
    </div>
  );
}

const DISMISS_KEY = "komi-vk-widget-dismissed";

export default function VkContactWidget() {
  /* «скрыт на сессию» — крестик реально закрывает баннер */
  const [hidden, setHidden] = useState(() => sessionStorage.getItem(DISMISS_KEY) === "1");
  const [mobileOpen, setMobileOpen] = useState(false);

  const dismiss = () => {
    setHidden(true);
    setMobileOpen(false);
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* ок */ }
  };
  const restore = () => {
    setHidden(false);
    try { sessionStorage.removeItem(DISMISS_KEY); } catch { /* ок */ }
  };

  if (hidden) {
    /* компактная «точка возврата», чтобы баннер не терялся навсегда */
    return (
      <button
        onClick={restore}
        className="fixed bottom-20 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-[#0077FF] text-white shadow-2xl shadow-[#0077FF]/30 transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 active:scale-95 md:bottom-6"
        aria-label="Показать виджет «Написать в VK»"
        title="Написать репетитору в VK"
      >
        <MessageCircle className="h-5 w-5" />
      </button>
    );
  }

  return (
    <>
      {/* Десктоп: липкий сайдбар справа, крестик закрывает баннер */}
      <div className="pointer-events-none fixed right-5 top-24 z-30 hidden w-72 xl:block">
        <div className="pointer-events-auto sticky top-24">
          <CardBody onCollapse={dismiss} />
        </div>
      </div>

      {/* Мобильные: плашка внизу, раскрывается в карточку; крестик сворачивает обратно */}
      <div className="fixed inset-x-3 bottom-20 z-40 md:bottom-6 xl:hidden">
        {mobileOpen ? (
          <div className="pop-in">
            <CardBody onCollapse={() => setMobileOpen(false)} />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileOpen(true)}
              className="flex flex-1 items-center justify-center gap-2 rounded-full border border-board-600/60 bg-board-850/95 py-3 text-[13px] font-bold text-chalk-100 shadow-2xl backdrop-blur transition-all duration-200 hover:border-mark-yellow/50 active:scale-[0.98]"
            >
              <MessageCircle className="h-4 w-4 text-[#0077FF]" />
              Написать репетитору в VK
              <ChevronDown className="h-4 w-4 rotate-180 text-chalk-500" />
            </button>
            <button
              onClick={dismiss}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-board-600/60 bg-board-850/95 text-chalk-400 shadow-2xl backdrop-blur transition-colors hover:text-chalk-50 active:scale-95"
              aria-label="Скрыть виджет"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
