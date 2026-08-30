import { useState } from "react";
import { Check } from "lucide-react";
import { classifyErrorPattern, isApiEnabled, type ErrorPatternType } from "./api";

export const ERROR_PATTERN_OPTIONS: { value: ErrorPatternType; label: string; hint: string }[] = [
  { value: "careless", label: "Невнимательность", hint: "Знаю, как решать, но ошибся по невнимательности" },
  { value: "calculation", label: "Вычисления", hint: "Правильный метод, но ошибка в счёте" },
  { value: "method", label: "Метод", hint: "Выбрал неверный способ решения" },
  { value: "theory", label: "Теория", hint: "Не знал формулу / правило" },
  { value: "reading", label: "Прочтение условия", hint: "Неверно понял условие задачи" },
  { value: "time", label: "Время", hint: "Не успел, решил в спешке" },
];

/**
 * Классификация ошибки (Этап 7). Показывается после неверного ответа.
 * Категория влияет на снижение Mastery (careless слабее, чем theory)
 * и на аналитику «почему теряются баллы».
 */
export default function ErrorPatternPicker({
  taskAttemptId,
  onDone,
}: {
  taskAttemptId: string | null;
  onDone?: (pattern: ErrorPatternType) => void;
}) {
  const [chosen, setChosen] = useState<ErrorPatternType | null>(null);
  const [saving, setSaving] = useState(false);

  const pick = async (p: ErrorPatternType) => {
    setChosen(p);
    setSaving(true);
    if (isApiEnabled() && taskAttemptId) {
      try {
        await classifyErrorPattern(taskAttemptId, p);
      } catch {
        /* в автономном режиме просто сохраняем локально */
      }
    }
    setSaving(false);
    onDone?.(p);
  };

  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50/70 p-4 dark:border-orange-500/30 dark:bg-orange-500/10">
      <p className="text-[12.5px] font-bold text-orange-800 dark:text-orange-300">
        Почему не получилось? Это поможет точнее считать прогресс
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ERROR_PATTERN_OPTIONS.map((o) => {
          const active = chosen === o.value;
          return (
            <button
              key={o.value}
              onClick={() => void pick(o.value)}
              disabled={saving}
              title={o.hint}
              className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] font-semibold transition-all duration-150 ${
                active
                  ? "border-orange-500 bg-orange-500 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-orange-300 hover:text-orange-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {active && <Check className="h-3.5 w-3.5" />}
              {o.label}
            </button>
          );
        })}
      </div>
      {chosen && (
        <p className="mt-2.5 text-[11.5px] font-medium text-orange-700 dark:text-orange-300">
          Сохранено. Категория влияет на то, насколько сильно снизится уровень навыка.
        </p>
      )}
    </div>
  );
}
