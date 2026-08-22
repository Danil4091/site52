/**
 * График динамики баллов (recharts).
 *
 * Вынесен в отдельный модуль, чтобы recharts (~430 КБ) НЕ входил в чанк
 * pages2.tsx, а грузился отдельным параллельным чанком только тогда,
 * когда открыта «Аналитика». pages2.tsx импортирует его через lazy().
 */
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RU_AVG_SCORE_2026 } from "./config";

export interface ChartPoint {
  variant: string;
  secondary: number;
  mistakes: number;
}

export default function AnalyticsChart({ data, goal }: { data: ChartPoint[]; goal: number }) {
  return (
    <div className="mt-3 h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 6, right: 4, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-board-700)" vertical={false} />
          <XAxis dataKey="variant" tickLine={false} axisLine={{ stroke: "var(--color-board-700)" }} tick={{ fontSize: 11, fill: "var(--color-chalk-500)" }} />
          <YAxis yAxisId="left" domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-chalk-500)" }} />
          <YAxis yAxisId="right" orientation="right" domain={[0, 5]} allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-chalk-500)" }} />
          <Tooltip
            contentStyle={{ backgroundColor: "var(--color-board-850)", border: "1px solid var(--color-board-600)", borderRadius: 10, fontSize: 12, color: "var(--color-chalk-200)" }}
            cursor={{ fill: "var(--color-board-800)" }}
          />
          <ReferenceLine yAxisId="left" y={70} stroke="var(--color-mark-green)" strokeOpacity={0.55} strokeDasharray="5 5" label={{ value: "порог 70", fill: "var(--color-mark-green)", fontSize: 9.5, position: "insideBottomLeft" }} />
          <ReferenceLine yAxisId="left" y={RU_AVG_SCORE_2026} stroke="var(--color-mark-blue)" strokeDasharray="2 4" label={{ value: `РФ · ${RU_AVG_SCORE_2026}`, fill: "var(--color-mark-blue)", fontSize: 9.5, position: "insideBottomRight" }} />
          <ReferenceLine yAxisId="left" y={goal} stroke="var(--color-mark-yellow)" strokeWidth={1.6} strokeDasharray="7 5" label={{ value: `ваша цель · ${goal}`, fill: "var(--color-mark-yellow)", fontSize: 10, position: "insideTopRight" }} />
          <Bar yAxisId="right" dataKey="mistakes" name="Ошибки 0.1" fill="var(--color-mark-red)" radius={[4, 4, 0, 0]} barSize={14} opacity={0.85} />
          <Line yAxisId="left" type="monotone" dataKey="secondary" name="Тестовый балл" stroke="var(--color-mark-green)" strokeWidth={2.5} dot={{ r: 3.5, fill: "var(--color-mark-green)", strokeWidth: 0 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
