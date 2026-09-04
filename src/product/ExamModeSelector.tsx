import { useState } from "react";
import { BookOpen, Timer, X } from "lucide-react";
import type { ExamMode } from "./store";

interface ExamModeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (mode: ExamMode) => void;
}

export default function ExamModeSelector({ isOpen, onClose, onSelect }: ExamModeSelectorProps) {
  const [selectedMode, setSelectedMode] = useState<ExamMode>("exam");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="rise-3 card w-full max-w-md p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-chalk-50">Выберите режим</h2>
          <button onClick={onClose} className="btn-ghost p-2 text-chalk-400 hover:text-mark-red">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-2 text-[13px] text-chalk-400">
          Как вы хотите решать этот вариант?
        </p>

        <div className="mt-5 space-y-3">
          {/* Режим экзамена */}
          <button
            onClick={() => setSelectedMode("exam")}
            className={`flex w-full items-start gap-4 rounded-xl border p-4 text-left transition-all ${
              selectedMode === "exam"
                ? "border-mark-yellow bg-mark-yellow/10 ring-2 ring-mark-yellow"
                : "border-board-600/50 bg-board-800/30 hover:border-mark-yellow/50"
            }`}
          >
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
              selectedMode === "exam" ? "bg-mark-yellow text-board-900" : "bg-board-700 text-chalk-400"
            }`}>
              <Timer className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className={`font-display text-base font-bold ${
                selectedMode === "exam" ? "text-mark-yellow" : "text-chalk-100"
              }`}>
                Как на экзамене
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-chalk-400">
                • Таймер 3ч 55мин<br/>
                • Без подсказок<br/>
                • Влияет на прогноз готовности<br/>
                • Статистика для учителя
              </p>
            </div>
          </button>

          {/* Режим домашней работы */}
          <button
            onClick={() => setSelectedMode("practice")}
            className={`flex w-full items-start gap-4 rounded-xl border p-4 text-left transition-all ${
              selectedMode === "practice"
                ? "border-mark-blue bg-mark-blue/10 ring-2 ring-mark-blue"
                : "border-board-600/50 bg-board-800/30 hover:border-mark-blue/50"
            }`}
          >
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
              selectedMode === "practice" ? "bg-mark-blue text-white" : "bg-board-700 text-chalk-400"
            }`}>
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className={`font-display text-base font-bold ${
                selectedMode === "practice" ? "text-mark-blue" : "text-chalk-100"
              }`}>
                Домашняя работа
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-chalk-400">
                • Без ограничения по времени<br/>
                • Можно использовать подсказки<br/>
                • Не влияет на готовность<br/>
                • Только прогресс по темам
              </p>
            </div>
          </button>
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1 px-4 py-3 text-sm">
            Отмена
          </button>
          <button
            onClick={() => onSelect(selectedMode)}
            className="btn-gold flex-1 px-4 py-3 text-sm font-bold"
          >
            Начать в режиме {selectedMode === "exam" ? "экзамена" : "домашней работы"}
          </button>
        </div>
      </div>
    </div>
  );
}
