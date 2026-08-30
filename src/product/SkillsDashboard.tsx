import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, Target, TreePine } from "lucide-react";
import { useApp } from "./store";
import { EXAM_LINES } from "./examLines";
import {
  fetchMasteryProfile, fetchReadinessProfile, isApiEnabled,
  type MasteryLine, type ReadinessLine, type SkillNode,
} from "./api";

function colorFor(v: number | null): string {
  if (v === null) return "var(--color-chalk-500)";
  if (v >= 80) return "#10b981";
  if (v >= 60) return "#f59e0b";
  if (v >= 40) return "#f97316";
  return "#ef4444";
}

function Bar({ value }: { value: number | null }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-700/60">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${value ?? 0}%`, backgroundColor: colorFor(value) }}
      />
    </div>
  );
}

function LineRow({
  num, title, mastery, readiness, expanded, onToggle, skills,
}: {
  num: number;
  title: string;
  mastery: number | null;
  readiness: number | null;
  expanded: boolean;
  onToggle: () => void;
  skills: SkillNode[];
}) {
  const gap = mastery !== null && readiness !== null ? Math.round(mastery - readiness) : null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800/70">
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white dark:bg-slate-700">
          {num}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
          <div className="mt-1.5 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Освоение (дома)</p>
              <div className="mt-0.5 flex items-center gap-2">
                <div className="flex-1"><Bar value={mastery} /></div>
                <span className="w-9 text-right text-xs font-bold tabular-nums" style={{ color: colorFor(mastery) }}>
                  {mastery === null ? "—" : `${mastery}%`}
                </span>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Готовность (экзамен)</p>
              <div className="mt-0.5 flex items-center gap-2">
                <div className="flex-1"><Bar value={readiness} /></div>
                <span className="w-9 text-right text-xs font-bold tabular-nums" style={{ color: colorFor(readiness) }}>
                  {readiness === null ? "—" : `${readiness}%`}
                </span>
              </div>
            </div>
          </div>
          {gap !== null && gap >= 15 && (
            <p className="mt-1 text-[11px] font-medium text-orange-600 dark:text-orange-400">
              Разрыв {gap}%: тему знаешь, но на экзамене теряешь — тренируй в режиме экзамена
            </p>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && skills.length > 0 && (
        <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-700">
          <div className="space-y-2.5">
            {skills.map((s) => (
              <div key={s.skill_id} className="flex items-center gap-3">
                <span className="w-40 truncate text-[12px] font-medium text-slate-700 dark:text-slate-300">{s.title}</span>
                <div className="flex-1"><Bar value={s.mastery} /></div>
                <span className="w-10 text-right text-xs font-bold tabular-nums" style={{ color: colorFor(s.mastery) }}>
                  {s.mastery === null ? "—" : `${s.mastery}%`}
                </span>
                <span className="hidden w-24 text-right text-[10.5px] text-slate-400 sm:block">
                  {s.attempts > 0 ? `${s.correct_attempts}/${s.attempts} верно` : "нет данных"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Дашборд навыков ученика (Этап 7).
 * Данные — GET /api/students/{id}/profile/mastery и .../profile/readiness.
 * Без сервера — клиентские данные по линиям из store.
 */
export default function SkillsDashboard() {
  const { user, topicStats } = useApp();
  const serverId = user?.serverId;

  const [masteryLines, setMasteryLines] = useState<MasteryLine[] | null>(null);
  const [readinessLines, setReadinessLines] = useState<ReadinessLine[] | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!isApiEnabled() || !serverId) {
      setLoading(false);
      return;
    }
    Promise.all([
      fetchMasteryProfile(serverId).catch(() => null),
      fetchReadinessProfile(serverId).catch(() => null),
    ]).then(([m, r]) => {
      if (!alive) return;
      setMasteryLines(m?.lines ?? null);
      setReadinessLines(r?.lines ?? null);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [serverId]);

  const rows = useMemo(() => {
    return EXAM_LINES.map((line) => {
      let mastery: number | null = null;
      let skills: SkillNode[] = [];
      const ml = masteryLines?.find((l) => l.line_number === line.number);
      if (ml) {
        skills = ml.subtopics.flatMap((st) => st.skills);
        const withMastery = skills.filter((s) => s.mastery !== null);
        mastery = withMastery.length
          ? Math.round(withMastery.reduce((acc, s) => acc + (s.mastery ?? 0), 0) / withMastery.length)
          : null;
      } else {
        const ts = topicStats[line.number];
        if (ts && ts.attempts > 0) mastery = Math.round((ts.solved / ts.attempts) * 100);
      }
      const readiness = readinessLines?.find((l) => l.line_number === line.number)?.readiness ?? null;
      return { num: line.number, title: line.title, mastery, readiness, skills };
    });
  }, [masteryLines, readinessLines, topicStats]);

  const weak = useMemo(() => {
    return rows
      .filter((r) => (r.mastery !== null && r.mastery < 60) || (r.readiness !== null && r.readiness < 60))
      .map((r) => ({ ...r, min: Math.min(r.mastery ?? 100, r.readiness ?? 100) }))
      .sort((a, b) => a.min - b.min)
      .slice(0, 5);
  }, [rows]);

  const hasData = rows.some((r) => r.mastery !== null || r.readiness !== null);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
          <TreePine className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">Навыки и готовность</h1>
          <p className="text-[12.5px] text-slate-500 dark:text-slate-400">
            Освоение — как решаешь дома; готовность — как выступишь на экзамене
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/70">
          Загружаем профиль навыков…
        </div>
      ) : !hasData ? (
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-800/70">
          <Target className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">Пока нет данных по навыкам</p>
          <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-slate-500 dark:text-slate-400">
            Реши несколько вариантов или потренируйся по темам — здесь появится прогресс по каждой линии ЕГЭ.
            {!serverId && " Для полной аналитики войди в аккаунт и подключись к серверу."}
          </p>
        </div>
      ) : (
        <>
          {weak.length > 0 && (
            <div className="mt-6 rounded-xl border border-orange-200 bg-orange-50/70 p-4 dark:border-orange-500/30 dark:bg-orange-500/10">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <h2 className="text-sm font-bold text-orange-800 dark:text-orange-300">Слабые места — начни с них</h2>
              </div>
              <ul className="mt-3 space-y-1.5">
                {weak.map((w) => (
                  <li key={w.num} className="flex items-center gap-2 text-[13px]">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-orange-600 text-[11px] font-bold text-white">
                      {w.num}
                    </span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{w.title}</span>
                    <span className="ml-auto text-[12px] font-bold tabular-nums text-orange-700 dark:text-orange-400">
                      {w.min}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 space-y-3">
            {rows.map((r) => (
              <LineRow
                key={r.num}
                num={r.num}
                title={r.title}
                mastery={r.mastery}
                readiness={r.readiness}
                expanded={expanded === r.num}
                onToggle={() => setExpanded(expanded === r.num ? null : r.num)}
                skills={r.skills}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
