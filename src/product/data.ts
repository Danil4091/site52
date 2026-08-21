/* ────────────────────────────────────────────────────────────────────
   Репетитор из Коми · данные продукта
   ──────────────────────────────────────────────────────────────────── */
import type { LucideIcon } from "lucide-react";
import {
  Brain, CalendarCheck, ClipboardList, Crown, Crosshair, Eraser, Flag, Flame, Footprints,
  Gauge, Gift, Medal, Moon, Rocket, Star, Tags, Target, Timer, TrendingUp, Users, Zap,
} from "lucide-react";
import { EGE_DATE } from "./config";

export const STUDENT = { name: "Артём", fullName: "Артём Попов", grade: "11 класс", city: "Сыктывкар", streak: 6, goal: 84 };

/** Дата ЕГЭ — берётся из конфигурации (VITE_EGE_DATE, по умолчанию 7 июня 2026). */
export const EXAM_DATE = EGE_DATE;

export interface ProductVariant {
  id: string; year: number; title: string; region: string;
  difficulty: "базовый" | "средний" | "сложный";
  available?: boolean; isReal?: boolean;
}

export const VARIANTS: ProductVariant[] = [
  { id: "v-real-2023", year: 2023, title: "Основной период · реальные задания", region: "Открытый банк ФИПИ 2022–2023 · 19 заданий", difficulty: "средний", available: true, isReal: true },
  { id: "v-2024-sib", year: 2024, title: "Досрочный период", region: "Сибирь", difficulty: "сложный" },
  { id: "v-2024-main", year: 2024, title: "Основной период", region: "Урал", difficulty: "средний" },
  { id: "v-probe-7", year: 2026, title: "Пробник платформы №7", region: "авторский · Репетитор из Коми", difficulty: "сложный" },
];

export interface AttemptRecord {
  id: number | string; variantId: string; label: string;
  secondary: number; mistakes: number; date: string;
  ts?: number; // unix-время попытки — для еженедельного отчёта
}

const _d = (days: number) => Date.now() - days * 86_400_000;
export const INITIAL_ATTEMPTS: AttemptRecord[] = [
  { id: 1, variantId: "v-2022-res", label: "Резервный 2022", secondary: 74, mistakes: 2, date: "12 мая", ts: _d(9) },
  { id: 2, variantId: "v-2023-main", label: "Основной 2023", secondary: 79, mistakes: 1, date: "15 мая", ts: _d(5) },
  { id: 3, variantId: "v-2023-dv", label: "Досрочный 2023 · ДВ", secondary: 84, mistakes: 1, date: "18 мая", ts: _d(1) },
];

export const SCALE: Record<number, number> = {
  0: 0, 1: 5, 2: 9, 3: 14, 4: 18, 5: 23, 6: 27, 7: 33, 8: 39, 9: 45, 10: 50, 11: 56, 12: 62,
  13: 68, 14: 70, 15: 72, 16: 74, 17: 76, 18: 78, 19: 80, 20: 82, 21: 84, 22: 86, 23: 88,
  24: 90, 25: 92, 26: 94, 27: 96, 28: 98, 29: 99, 30: 100, 31: 100,
};

export interface BankTopic {
  number: number; topic: string; part: 1 | 2;
  success: number; solved: number; attempts: number;
  trend: "up" | "down" | "flat"; note: string;
}

export const BANK: BankTopic[] = [
  { number: 1, topic: "Планиметрия", part: 1, success: 95, solved: 19, attempts: 20, trend: "up", note: "Треугольники, площади, углы. Начните с прямоугольных треугольников — из них складывается половина заданий №1." },
  { number: 2, topic: "Векторы", part: 1, success: 90, solved: 18, attempts: 20, trend: "up", note: "Скалярное произведение, координаты, длина вектора. Главное — не путать порядок координат." },
  { number: 3, topic: "Стереометрия", part: 1, success: 85, solved: 17, attempts: 20, trend: "flat", note: "Объёмы и площади поверхностей. Пять ключевых формул покрывают 90% заданий." },
  { number: 4, topic: "Простая вероятность", part: 1, success: 75, solved: 15, attempts: 20, trend: "flat", note: "Классическая вероятность: благоприятные исходы делим на все." },
  { number: 5, topic: "Сложная вероятность", part: 1, success: 80, solved: 16, attempts: 20, trend: "up", note: "Теоремы сложения и умножения. Ключевой вопрос: события «или» или «и»." },
  { number: 6, topic: "Уравнения", part: 1, success: 60, solved: 12, attempts: 20, trend: "down", note: "Показательные, логарифмические, дробно-рациональные. Всегда проверяйте ОДЗ." },
  { number: 7, topic: "Вычисления и преобразования", part: 1, success: 70, solved: 14, attempts: 20, trend: "flat", note: "Формулы сокращённого умножения, степени, корни. Тренируйте скорость счёта." },
  { number: 8, topic: "Производная и первообразная", part: 1, success: 55, solved: 11, attempts: 20, trend: "down", note: "Производная — угловой коэффициент касательной. Читайте график f′." },
  { number: 9, topic: "Прикладные задачи", part: 1, success: 48, solved: 10, attempts: 20, trend: "down", note: "Задачи «из жизни»: плитка, участки, дорожки. Рисуйте чертёж." },
  { number: 10, topic: "Текстовые задачи", part: 1, success: 38, solved: 8, attempts: 20, trend: "down", note: "Движение, работа, сплавы. Приём: таблица → уравнение → проверка." },
  { number: 11, topic: "Графики функций", part: 1, success: 84, solved: 17, attempts: 20, trend: "up", note: "Чтение графиков функции и производной: экстремумы, знаки, перегибы." },
  { number: 12, topic: "Исследование функций", part: 1, success: 91, solved: 18, attempts: 20, trend: "up", note: "Критические точки и сравнение значений на концах отрезка." },
  { number: 13, topic: "Уравнения", part: 2, success: 72, solved: 9, attempts: 12, trend: "up", note: "Тригонометрические уравнения с отбором корней на отрезке." },
  { number: 14, topic: "Стереометрия", part: 2, success: 64, solved: 7, attempts: 11, trend: "flat", note: "Правильный чертёж — половина баллов. Сечения и углы между прямыми." },
  { number: 15, topic: "Неравенства", part: 2, success: 45, solved: 4, attempts: 9, trend: "flat", note: "Метод интервалов плюс аккуратный разбор ОДЗ." },
  { number: 16, topic: "Экономическая задача", part: 2, success: 40, solved: 3, attempts: 8, trend: "down", note: "Кредиты и вклады. Заводите таблицу платежей." },
  { number: 17, topic: "Планиметрия", part: 2, success: 68, solved: 6, attempts: 9, trend: "up", note: "Идеально оформляйте пункт «а» и пробуйте «б» — частичные баллы считаются." },
  { number: 18, topic: "Параметры", part: 2, success: 30, solved: 2, attempts: 7, trend: "flat", note: "Графический метод: семейства прямых и окружностей." },
  { number: 19, topic: "Числа и их свойства", part: 2, success: 52, solved: 4, attempts: 8, trend: "up", note: "Делимость и остатки. Пункты «а» и «б» приносят баллы почти всегда." },
];

export const TASK_OF_DAY = {
  number: 9, topic: "Прикладные задачи",
  statement: "Плиточнику нужно выложить пол прямоугольной комнаты размером 3 м × 4 м квадратной плиткой со стороной 50 см. Плитка продаётся упаковками по 8 штук. Какое наименьшее число упаковок нужно купить?",
  answer: "6",
  explain: "Площадь пола 12 м². Площадь одной плитки 0,25 м², значит нужно 48 плиток. 48 ÷ 8 = 6 упаковок ровно.",
};

/* ─────────────────────── советы дня ───────────────────────
   Методические мини-советы: по одному в день, выбор по дате. */
export const DAILY_TIPS: string[] = [
  "В части 1 ответ записывай без единиц измерения — только число. «6 упаковок» в бланке — это ошибка.",
  "Получил ответ в части 1 — подставь его обратно в условие. 10 секунд проверки спасают балл.",
  "№13: сначала отбери корни на промежутке, и только потом оформляй. Большинство потерь — на отборе.",
  "Застрял на задаче дольше 5 минут? Пропусти и вернись в конце. Баллы одинаковые, время — нет.",
  "В вероятности всегда сначала считай общее число исходов n, потом благоприятные m. P = m/n.",
  "Черновик — не место для хаоса. Нумеруй задачи, чтобы при переносе в бланк ничего не перепутать.",
  "№17 (экономическая): таблица платежей по годам решает задачу почти сама. Заводи её всегда.",
  "Десятичную дробь в ответе можно писать и с точкой, и с запятой — проверим оба варианта.",
  "Стереометрия части 1: выучи 5 формул объёмов наизусть — это 90% всех заданий №3.",
  "Решаешь вариант — засекай время. На экзамене 3 ч 55 мин, и на части 2 нужно оставить минимум 2 часа.",
  "Параметры (№18) начинаются с рисунка. Семейство прямых + окружность — твой план Б.",
  "Ошибка в вычислениях — тоже ошибка. Проверяй арифметику так же тщательно, как метод.",
  "В №12 (наибольшее значение) не забудь сравнить значение в критической точке и на концах отрезка.",
  "Разбор одной ошибки полезнее пяти новых задач. Журнал ошибок — твой главный инструмент роста.",
  "Теория чисел (№19): пункты «а» и «б» приносят баллы почти всегда — никогда не пропускай их.",
  "За день до экзамена не решай новые сложные задачи. Повтори формулы и выспись.",
  "В части 2 пиши «Дано» и пояснения к каждому шагу — эксперт ставит баллы за логику, а не за ответ.",
  "Серия из 3 задач в день бьёт «марафон по 4 часа в воскресенье». Регулярность важнее объёма.",
];

/** Совет на сегодня (стабильный в течение суток). */
export function getDailyTip(): string {
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  return DAILY_TIPS[dayIndex % DAILY_TIPS.length];
}

export interface ProbProblem { id: string; topic: string; text: string; answer: string; explain: string; }
export const PROB_PROBLEMS: ProbProblem[] = [
  { id: "p1", topic: "Простая вероятность", text: String.raw`На тарелке 16 пирожков: 7 с мясом, 5 с капустой и 4 с вишней. Наташа наугад выбирает один пирожок. Найдите вероятность того, что он окажется с вишней.`, answer: "0.25", explain: String.raw`$n = 16$, благоприятных $m = 4$. $P = \dfrac{4}{16} = 0{,}25$.` },
  { id: "p2", topic: "Простая вероятность", text: String.raw`В фирме такси свободно 20 машин: 9 чёрных, 4 жёлтых и 7 зелёных. Найдите вероятность того, что приедет жёлтое такси.`, answer: "0.2", explain: String.raw`$P = \dfrac{4}{20} = 0{,}2$.` },
  { id: "p3", topic: "Простая вероятность", text: String.raw`В сборнике 25 билетов, в двух из них вопрос о грибах. Найдите вероятность того, что в случайно выбранном билете НЕ будет вопроса о грибах.`, answer: "0.92", explain: String.raw`Без грибов $25 - 2 = 23$: $P = \dfrac{23}{25} = 0{,}92$.` },
  { id: "p4", topic: "Простая вероятность", text: String.raw`Игральную кость бросают один раз. Найдите вероятность того, что выпадет число очков, большее 3.`, answer: "0.5", explain: String.raw`Благоприятные: 4, 5, 6 — три из шести: $P = \dfrac{3}{6} = 0{,}5$.` },
  { id: "p5", topic: "Простая вероятность", text: String.raw`Какова вероятность того, что случайно выбранное двузначное число делится на 5?`, answer: "0.2", explain: String.raw`Двузначных чисел 90, кратных пяти — 18: $P = \dfrac{18}{90} = 0{,}2$.` },
  { id: "p6", topic: "Сложная вероятность", text: String.raw`Монету бросают трижды. Найдите вероятность того, что орёл выпадет ровно два раза.`, answer: "0.375", explain: String.raw`Исходов $2^3 = 8$, благоприятных 3: $P = \dfrac{3}{8} = 0{,}375$.` },
  { id: "p7", topic: "Сложная вероятность", text: String.raw`Две фабрики выпускают стёкла: первая — 45% (брак 3%), вторая — 55% (брак 1%). Найдите вероятность того, что купленное стекло бракованное.`, answer: "0.019", explain: String.raw`Полная вероятность: $P = 0{,}45 \cdot 0{,}03 + 0{,}55 \cdot 0{,}01 = 0{,}019$.` },
  { id: "p8", topic: "Сложная вероятность", text: String.raw`Биатлонист стреляет пять раз, вероятность попадания 0,8. Найдите вероятность, что первые три — попадания, последние два — промахи.`, answer: "0.02048", explain: String.raw`$P = 0{,}8^3 \cdot 0{,}2^2 = 0{,}02048$.` },
  { id: "p9", topic: "Сложная вероятность", text: String.raw`Вероятность, что кофе закончится в автомате, 0,3; что в обоих — 0,12. Найдите вероятность, что кофе останется в обоих.`, answer: "0.52", explain: String.raw`$P(A \cup B) = 0{,}48$. Останется в обоих: $1 - 0{,}48 = 0{,}52$.` },
  { id: "p10", topic: "Сложная вероятность", text: String.raw`Кость бросили два раза, шестёрка не выпала ни разу. Найдите условную вероятность того, что сумма очков равна 8.`, answer: "0.12", explain: String.raw`Исходов без шестёрки 25, сумма 8: три исхода: $P = \dfrac{3}{25} = 0{,}12$.` },
  { id: "p11", topic: "Сложная вероятность", text: String.raw`Три лампы, вероятность перегорания каждой за год 0,3 (независимо). Найдите вероятность, что хотя бы одна лампа не перегорит.`, answer: "0.973", explain: String.raw`Перегорят все: $0{,}3^3 = 0{,}027$. Хотя бы одна уцелеет: $1 - 0{,}027 = 0{,}973$.` },
  { id: "p12", topic: "Сложная вероятность", text: String.raw`Монету бросают 10 раз. Во сколько раз вероятность «ровно 5 орлов» больше вероятности «ровно 4 орла»?`, answer: "1.2", explain: String.raw`$\dfrac{C_{10}^{5}}{C_{10}^{4}} = \dfrac{252}{210} = 1{,}2$.` },
];

/* Реальный вариант: №1–12 (часть 1, автопроверка) + №13–19 (часть 2). */
export interface VariantTask {
  number: number; category: string; part: 1 | 2; maxScore: number;
  statement: string; answer?: string; hint?: string; solution?: string; criteria?: string;
  imageUrls?: string[];
}
const TRIANGLE_IMG = "https://image.qwenlm.ai/generated-images/d5d2090a-162d-404e-b6c5-f6115aa93836/_result.png";
const TANGENT_IMG = "https://image.qwenlm.ai/generated-images/b3b7aba0-064b-47dd-bea3-9c57ad633b13/_result.png";

export const REAL_VARIANT: VariantTask[] = [
  { number: 1, category: "Планиметрия", part: 1, maxScore: 1, imageUrls: [TRIANGLE_IMG], statement: "В треугольнике ABC угол C равен 90°, AC = 4, BC = 3. Найдите синус угла A.", hint: "Дробную часть отделяйте запятой или точкой.", solution: "AB = √(4² + 3²) = 5. sin A = 3/5 = 0,6.", answer: "0.6" },
  { number: 2, category: "Векторы", part: 1, maxScore: 1, statement: String.raw`Даны векторы \( \vec{a} = (3; 4) \) и \( \vec{b} = (1; 2) \). Найдите скалярное произведение \( \vec{a} \cdot \vec{b} \).`, hint: "x₁x₂ + y₁y₂.", solution: "3·1 + 4·2 = 11.", answer: "11" },
  { number: 3, category: "Стереометрия", part: 1, maxScore: 1, statement: "Объём прямоугольного параллелепипеда равен 60, два его ребра равны 3 и 4. Найдите третье ребро.", hint: "V = abc.", solution: "c = 60 / (3·4) = 5.", answer: "5" },
  { number: 4, category: "Простая вероятность", part: 1, maxScore: 1, statement: "Вероятность того, что новый аккумулятор бракованный, равна 0,06. Найдите вероятность того, что случайно выбранный аккумулятор исправен.", hint: "1 − P.", solution: "1 − 0,06 = 0,94.", answer: "0.94" },
  { number: 5, category: "Сложная вероятность", part: 1, maxScore: 1, statement: String.raw`Вероятность попадания для первого стрелка \( 0{,}7 \), для второго \( 0{,}8 \). Они стреляют по одному разу. Найдите вероятность того, что попадут оба.`, hint: "Независимые события перемножаются.", solution: "0,7 · 0,8 = 0,56.", answer: "0.56" },
  { number: 6, category: "Уравнения", part: 1, maxScore: 1, statement: String.raw`Найдите корень уравнения \( \log_2 (x + 3) = 4 \).`, hint: "Правая часть — степень двойки.", solution: "x + 3 = 16, x = 13.", answer: "13" },
  { number: 7, category: "Вычисления и преобразования", part: 1, maxScore: 1, statement: String.raw`Найдите значение выражения \( (\sqrt{23} - \sqrt{15})(\sqrt{23} + \sqrt{15}) \).`, hint: "Разность квадратов.", solution: "23 − 15 = 8.", answer: "8" },
  { number: 8, category: "Производная и первообразная", part: 1, maxScore: 1, imageUrls: [TANGENT_IMG], statement: "К графику функции y = f(x) проведена касательная, проходящая через точки (0; 1) и (2; 5). Найдите значение производной в точке касания.", hint: "Производная = угловой коэффициент касательной.", solution: "f′(x₀) = (5 − 1) / (2 − 0) = 2.", answer: "2" },
  { number: 9, category: "Прикладные задачи", part: 1, maxScore: 1, statement: "Плиточнику нужно выложить пол 3 м × 4 м квадратной плиткой со стороной 50 см. Плитка продаётся упаковками по 8 штук. Какое наименьшее число упаковок нужно купить?", hint: "Сначала — сколько плиток всего.", solution: "12 м² / 0,25 м² = 48 плиток → 48/8 = 6 упаковок.", answer: "6" },
  { number: 10, category: "Текстовые задачи", part: 1, maxScore: 1, statement: "Моторная лодка прошла против течения 15 км и вернулась, затратив на обратный путь на 40 минут меньше. Найдите скорость течения (км/ч), если скорость лодки в неподвижной воде 12 км/ч.", hint: "Уравнение по времени: t = S / v.", solution: "15/(12−v) − 15/(12+v) = 2/3 → v = 3 км/ч.", answer: "3" },
  { number: 11, category: "Графики функций", part: 1, maxScore: 1, statement: "На рисунке изображён график производной функции f(x). Найдите количество точек, в которых касательная к графику f(x) параллельна прямой y = 3x − 7.", hint: "Касательная параллельна прямой, когда f′(x) = 3.", solution: "Прямая y = 3 пересекает график производной в трёх точках. Ответ: 3.", answer: "3" },
  { number: 12, category: "Исследование функций", part: 1, maxScore: 1, statement: String.raw`Найдите наибольшее значение функции \( y = \ln(x + 5)^5 - 5x \) на отрезке \( [-4{,}5;\ 0] \).`, hint: "Найдите производную и критические точки.", solution: "y′ = 5/(x+5) − 5 = 0 → x = −4. y(−4) = 0 — наибольшее.", answer: "0" },
  { number: 13, category: "Уравнения", part: 2, maxScore: 2, statement: String.raw`а) Решите уравнение \( 2\cos^2 x - 5\sin x + 1 = 0 \). б) Укажите корни на отрезке \( \left[ 0;\ \dfrac{3\pi}{2} \right] \).`, criteria: "1 балл — верный ответ в п. а; 2 балла — оба пункта (π/6, 5π/6).", solution: "Через cos²x = 1 − sin²x: 2sin²x + 5sinx − 3 = 0 → sinx = 1/2." },
  { number: 14, category: "Стереометрия", part: 2, maxScore: 2, statement: "В правильной четырёхугольной пирамиде сторона основания равна 4, боковое ребро равно 3. Найдите угол между боковым ребром и плоскостью основания.", criteria: "1 балл — верное построение; 2 балла — arccos(2√2/3).", solution: "Половина диагонали 2√2. cos φ = 2√2/3." },
  { number: 15, category: "Неравенства", part: 2, maxScore: 2, statement: String.raw`Решите неравенство \( \log_2 (x + 3) + \log_2 (x - 1) \leqslant 5 \).`, criteria: "1 балл — верный переход; 2 балла — ответ (1; 5].", solution: "ОДЗ x > 1; x² + 2x − 35 ≤ 0 → x ∈ (1; 5]." },
  { number: 16, category: "Экономическая задача", part: 2, maxScore: 2, statement: "В июле планируется взять кредит. Каждый январь долг возрастает на 20%, с февраля по июнь выплачивается часть долга. Найдите сумму кредита, если за 4 года выплачено 311 040 руб.", criteria: "1 балл — верная модель; 2 балла — 200 000 руб.", solution: "Геометрическая прогрессия со знаменателем 1,2 → S = 200 000 руб." },
  { number: 17, category: "Планиметрия", part: 2, maxScore: 3, statement: "Окружность проходит через вершины B и C треугольника ABC и пересекает стороны AB и AC в точках C₁ и B₁. Докажите, что треугольник ABC подобен треугольнику AB₁C₁.", criteria: "1 балл — доказано подобие; 3 балла — полная задача.", solution: "Вписанный четырёхугольник → ∠AB₁C₁ = ∠ABC; общий угол A." },
  { number: 18, category: "Параметры", part: 2, maxScore: 4, statement: String.raw`Найдите все значения параметра \( a \), при каждом из которых уравнение \( |x^2 - 4x + 3| = a \) имеет ровно три различных корня.`, criteria: "1 балл — анализ графика; 4 балла — a = 1.", solution: "Минимум «загнутой» части y = 1 при x = 2 → три корня при a = 1." },
  { number: 19, category: "Числа и их свойства", part: 2, maxScore: 4, statement: "На доске написано более 40, но менее 48 целых чисел. Среднее арифметическое равно −3, среднее положительных — 4, отрицательных — −8. а) Сколько чисел? б) Каких больше? в) Наибольшее количество положительных?", criteria: "1 балл — п. а; 2 балла — п. б; 4 балла — все пункты.", solution: "4p − 8n = −3(p + n) → 7p = 5n. Полный разбор — на занятии." },
];

export const REAL_ANSWER_KEY: Record<number, string> = Object.fromEntries(
  REAL_VARIANT.filter((t) => t.part === 1 && t.answer).map((t) => [t.number, t.answer as string])
);

/* ─────────────── достижения ─────────────── */
export interface AchieveSnapshot {
  attempts: number; best: number; streak: number; resolvedMistakes: number;
  probBest: number; nightOwl: boolean;
  solvedTasks: number;      // всего решено задач (части 1 + тренажёры)
  probSolved: number;       // решено задач по теории вероятностей (№4 + №5)
  perfectVariants: number;  // варианты, сданные без единой ошибки
  distinctTopics: number;   // тем, по которым решена хотя бы одна задача
  marathonCount: number;    // сыграно марафонов
  marathonBest: number;     // лучший результат марафона (верных из 10)
  referrals: number;        // приглашено друзей
  tagsAssigned: number;     // размечено ошибок тегами
  weeklyVariants: number;   // вариантов за последние 7 дней
  goalReached: boolean;     // достигнут целевой балл
  freezesBought: number;    // куплено страховок серии
}
export interface AchievementDef {
  id: string; title: string; desc: string; icon: LucideIcon;
  xp: number; // награда в XP при разблокировке
  test: (s: AchieveSnapshot) => boolean;
  progress: (s: AchieveSnapshot) => { cur: number; goal: number };
}
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first-task", title: "Первый шаг", desc: "Решить свою первую задачу", icon: Footprints, xp: 20, test: (s) => s.solvedTasks >= 1, progress: (s) => ({ cur: Math.min(s.solvedTasks, 1), goal: 1 }) },
  { id: "first-variant", title: "Боевое крещение", desc: "Завершить свой первый вариант", icon: ClipboardList, xp: 40, test: (s) => s.attempts >= 1, progress: (s) => ({ cur: Math.min(s.attempts, 1), goal: 1 }) },
  { id: "warmup", title: "Разогрев", desc: "Решить 3 варианта", icon: Zap, xp: 50, test: (s) => s.attempts >= 3, progress: (s) => ({ cur: Math.min(s.attempts, 3), goal: 3 }) },
  { id: "marathon", title: "Марафонец", desc: "Решить 5 вариантов", icon: Timer, xp: 80, test: (s) => s.attempts >= 5, progress: (s) => ({ cur: Math.min(s.attempts, 5), goal: 5 }) },
  { id: "streak-7", title: "Марафон · 7 дней", desc: "Удержать ударный режим 7 дней подряд", icon: Flame, xp: 60, test: (s) => s.streak >= 7, progress: (s) => ({ cur: Math.min(s.streak, 7), goal: 7 }) },
  { id: "streak-14", title: "Марафон · 14 дней", desc: "Удержать ударный режим 14 дней подряд", icon: Flame, xp: 100, test: (s) => s.streak >= 14, progress: (s) => ({ cur: Math.min(s.streak, 14), goal: 14 }) },
  { id: "streak-30", title: "Марафон · 30 дней", desc: "Месяц без пропусков. Железная дисциплина", icon: CalendarCheck, xp: 200, test: (s) => s.streak >= 30, progress: (s) => ({ cur: Math.min(s.streak, 30), goal: 30 }) },
  { id: "prob-genius", title: "Гений вероятностей", desc: "Решить 50 задач по теории вероятностей", icon: Crosshair, xp: 150, test: (s) => s.probSolved >= 50, progress: (s) => ({ cur: Math.min(s.probSolved, 50), goal: 50 }) },
  { id: "flawless", title: "Без ошибок", desc: "Сдать вариант на 100% — ни одного промаха", icon: Star, xp: 250, test: (s) => s.perfectVariants >= 1, progress: (s) => ({ cur: Math.min(s.perfectVariants, 1), goal: 1 }) },
  { id: "threshold", title: "Порог пройден", desc: "Набрать 70+ тестовых баллов", icon: Target, xp: 60, test: (s) => s.best >= 70, progress: (s) => ({ cur: Math.min(s.best, 70), goal: 70 }) },
  { id: "eighty", title: "Восемьдесят!", desc: "Набрать 80+ тестовых баллов", icon: TrendingUp, xp: 90, test: (s) => s.best >= 80, progress: (s) => ({ cur: Math.min(s.best, 80), goal: 80 }) },
  { id: "ninety", title: "Почти сотка", desc: "Набрать 90+ тестовых баллов", icon: Crown, xp: 120, test: (s) => s.best >= 90, progress: (s) => ({ cur: Math.min(s.best, 90), goal: 90 }) },
  { id: "hundred", title: "Сотка!", desc: "100 баллов за вариант. Легенда", icon: Star, xp: 300, test: (s) => s.best >= 100, progress: (s) => ({ cur: Math.min(s.best, 100), goal: 100 }) },
  { id: "eraser", title: "Охотник за ошибками", desc: "Разобрать 5 ошибок в журнале", icon: Eraser, xp: 50, test: (s) => s.resolvedMistakes >= 5, progress: (s) => ({ cur: Math.min(s.resolvedMistakes, 5), goal: 5 }) },
  { id: "sniper", title: "Вероятностный снайпер", desc: "80%+ точности в тренажёре вероятностей", icon: Crosshair, xp: 70, test: (s) => s.probBest >= 80, progress: (s) => ({ cur: Math.min(s.probBest, 80), goal: 80 }) },
  { id: "night-owl", title: "Ночная сова", desc: "Решить вариант после 22:00", icon: Moon, xp: 30, test: (s) => s.nightOwl, progress: (s) => ({ cur: s.nightOwl ? 1 : 0, goal: 1 }) },
  /* ── новые: марафон, рефералка, теги, отчёты ── */
  { id: "sprinter", title: "Спринтер", desc: "Сыграть свой первый марафон", icon: Rocket, xp: 30, test: (s) => s.marathonCount >= 1, progress: (s) => ({ cur: Math.min(s.marathonCount, 1), goal: 1 }) },
  { id: "marathon-master", title: "Марафон-мастер", desc: "Набрать 8+ из 10 в марафоне", icon: Gauge, xp: 80, test: (s) => s.marathonBest >= 8, progress: (s) => ({ cur: Math.min(s.marathonBest, 8), goal: 8 }) },
  { id: "friendly", title: "Дружелюбный", desc: "Пригласить 1 друга по своей ссылке", icon: Users, xp: 50, test: (s) => s.referrals >= 1, progress: (s) => ({ cur: Math.min(s.referrals, 1), goal: 1 }) },
  { id: "ambassador", title: "Амбассадор", desc: "Пригласить 3 друзей", icon: Gift, xp: 150, test: (s) => s.referrals >= 3, progress: (s) => ({ cur: Math.min(s.referrals, 3), goal: 3 }) },
  { id: "analyst", title: "Аналитик", desc: "Разметить 5 ошибок тегами причин", icon: Tags, xp: 40, test: (s) => s.tagsAssigned >= 5, progress: (s) => ({ cur: Math.min(s.tagsAssigned, 5), goal: 5 }) },
  { id: "weekly-hero", title: "Недельный герой", desc: "Решить 3 варианта за одну неделю", icon: CalendarCheck, xp: 70, test: (s) => s.weeklyVariants >= 3, progress: (s) => ({ cur: Math.min(s.weeklyVariants, 3), goal: 3 }) },
  { id: "goal-getter", title: "Целеустремлённый", desc: "Достичь своего целевого балла", icon: Flag, xp: 100, test: (s) => s.goalReached, progress: (s) => ({ cur: s.goalReached ? 1 : 0, goal: 1 }) },
  { id: "explorer", title: "Эрудит", desc: "Решить задачи по 10 разным темам", icon: Brain, xp: 90, test: (s) => s.distinctTopics >= 10, progress: (s) => ({ cur: Math.min(s.distinctTopics, 10), goal: 10 }) },
  { id: "centurion", title: "Сотник", desc: "Решить 100 задач суммарно", icon: Medal, xp: 200, test: (s) => s.solvedTasks >= 100, progress: (s) => ({ cur: Math.min(s.solvedTasks, 100), goal: 100 }) },
  { id: "prepared", title: "Предусмотрительный", desc: "Купить страховку серии", icon: Snowflake, xp: 30, test: (s) => s.freezesBought >= 1, progress: (s) => ({ cur: Math.min(s.freezesBought, 1), goal: 1 }) },
];

/* ─────────────── титулы по уровням (публичный статус в рейтинге) ─────────────── */
export interface LevelTitle { min: number; title: string; color: string; }
export const TITLES: LevelTitle[] = [
  { min: 25, title: "Гроссмейстер ЕГЭ", color: "text-mark-pink" },
  { min: 15, title: "Мастер", color: "text-mark-green" },
  { min: 10, title: "Боец", color: "text-mark-yellow" },
  { min: 5, title: "Разведчик", color: "text-mark-blue" },
  { min: 1, title: "Новичок", color: "text-chalk-500" },
];
export function titleForLevel(level: number): LevelTitle {
  return TITLES.find((t) => level >= t.min) ?? TITLES[TITLES.length - 1];
}

/* ─────────────── рейтинг (приватность: имя + ник, без фамилий) ─────────────── */
export const LEADER_SEED = [
  { id: 1, name: "Анна", nick: "anna_mz", city: "Ухта", score: 96, solved: 214, streak: 21, delta: 2, xp: 2640 },
  { id: 2, name: "Дмитрий", nick: "dima_lg", city: "Сыктывкар", score: 94, solved: 198, streak: 18, delta: 0, xp: 1520 },
  { id: 3, name: "Мария", nick: "masha_vk", city: "Печора", score: 91, solved: 187, streak: 24, delta: 1, xp: 1430 },
  { id: 4, name: "Арсений", nick: "senya_ch", city: "Усинск", score: 89, solved: 176, streak: 12, delta: -1, xp: 980 },
  { id: 5, name: "Полина", nick: "polina_nk", city: "Воркута", score: 87, solved: 169, streak: 15, delta: 3, xp: 940 },
  { id: 6, name: "Егор", nick: "egor_tr", city: "Сосногорск", score: 84, solved: 154, streak: 9, delta: -2, xp: 610 },
  { id: 7, name: "Влада", nick: "vlada_os", city: "Микунь", score: 82, solved: 148, streak: 11, delta: 1, xp: 520 },
  { id: 8, name: "Никита", nick: "nikita_rv", city: "Инта", score: 80, solved: 139, streak: 7, delta: 0, xp: 390 },
  { id: 9, name: "Кира", nick: "kira_zm", city: "Визинга", score: 78, solved: 131, streak: 14, delta: 2, xp: 330 },
  { id: 10, name: "Тимофей", nick: "tima_gg", city: "Эжва", score: 75, solved: 122, streak: 6, delta: -1, xp: 160 },
];

/* ─────────────── журнал ошибок ─────────────── */
export interface MistakeOccurrence { given: string | null; reference: string; variant: string; date: string; }
export interface MistakeGroup { number: number; topic: string; resolved: boolean; occurrences: MistakeOccurrence[]; tag?: string; }

/* Теги причин ошибок — для точечной работы над промахами */
export const ERROR_TAGS = ["Потеря знака", "ОДЗ", "Арифметика", "Невнимательность", "Не знал метод", "Не хватило времени"] as const;
export type ErrorTag = (typeof ERROR_TAGS)[number];
export function seedMistakes(): MistakeGroup[] {
  return [
    { number: 10, topic: "Текстовые задачи", resolved: false, occurrences: [
      { given: "12", reference: "18", variant: "Досрочный 2023 · ДВ", date: "18 мая" },
      { given: "20", reference: "18", variant: "Основной 2023", date: "15 мая" },
    ] },
    { number: 9, topic: "Прикладные задачи", resolved: false, occurrences: [
      { given: "5", reference: "6", variant: "Досрочный 2023 · ДВ", date: "18 мая" },
    ] },
    { number: 5, topic: "Сложная вероятность", resolved: false, occurrences: [
      { given: "0,5", reference: "0.56", variant: "Основной 2023", date: "15 мая" },
    ] },
    { number: 4, topic: "Простая вероятность", resolved: true, occurrences: [
      { given: "0,5", reference: "0.94", variant: "Резервный 2022", date: "12 мая" },
    ] },
  ];
}

/* ─────────────── помощники ─────────────── */
export function normalizeAnswer(raw: string): string {
  return raw.toLowerCase().split(/\s+/).join("").replace(/,/g, ".");
}
export function answersMatch(given: string, reference: string): boolean {
  const g = normalizeAnswer(given), r = normalizeAnswer(reference);
  if (!g) return false;
  if (g === r) return true;
  const ng = Number(g), nr = Number(r);
  return Number.isFinite(ng) && Number.isFinite(nr) && ng === nr;
}
export function daysUntilExam(): number {
  return Math.max(0, Math.ceil((EXAM_DATE.getTime() - Date.now()) / 86_400_000));
}
export function greeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Доброе утро";
  if (h >= 12 && h < 18) return "Добрый день";
  if (h >= 18 && h < 23) return "Добрый вечер";
  return "Доброй ночи";
}
export function todayShort(): string {
  return new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}
