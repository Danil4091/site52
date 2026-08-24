/* ══════════════════════════════════════════════════════════════════
   Бесплатные методички.
   Ученики скачивают теорию бесплатно; преподаватель управляет
   библиотекой из кабинета (вкладка «Методички»).

   Хранение:
     • демо-материалы встроены в код (структурированный конспект —
        при скачивании собирается аккуратный печатный документ);
     • добавленные преподавателем — сам файл лежит в IndexedDB
        (fileId), в localStorage только метаданные. Если IndexedDB
        недоступен — фолбэк на data-URL в localStorage. В боевом
        режиме файлы уходят на сервер: POST /api/materials (multipart)
        → папка materials/ рядом с uploads/, отдача через /api/static.
   ══════════════════════════════════════════════════════════════════ */

import { deleteFileBlob, getFileBlob, isIndexedDbAvailable, saveFileBlob } from "./fileStorage";
import { API_URL, getToken, isApiEnabled } from "./api";

/** Заголовки с JWT-токеном (для запросов, требующих прав преподавателя). */
function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/* ─────────────────── серверное хранилище (когда подключён бэкенд) ───────────────────
   Когда VITE_API_URL задан и бэкенд отвечает, методички живут на сервере:
   файл — на диске сервера, метаданные — в БД. Тогда методичка видна всем
   ученикам (а не только в чьём-то браузере) и скачивается нормальным PDF.
   При любой ошибке сети — мягкий фолбэк на локальное хранилище.        */

export const SRV_PREFIX = "srv:";

export interface ServerMaterialMeta {
  id: string; title: string; tag: string; topic: string;
  part: number; pages: number; downloads: number;
  file_size_kb: number | null; has_file: boolean;
}

/** Список методичек с сервера. При ошибке — null ( caller фолбэчится). */
export async function fetchServerMaterials(): Promise<ServerMaterialMeta[] | null> {
  if (!isApiEnabled()) return null;
  try {
    const res = await fetch(`${API_URL}/api/materials`);
    if (!res.ok) return null;
    return (await res.json()) as ServerMaterialMeta[];
  } catch {
    return null;
  }
}

/** Загрузка методички на сервер. Возвращает метаданные или null (фолбэк). */
export async function uploadServerMaterial(
  meta: { title: string; tag: string; topic: string; part: number; pages: number },
  file: File,
): Promise<ServerMaterialMeta | null> {
  /* Без серверного токена (преподаватель не вошёл через API) — фолбэк. */
  if (!isApiEnabled()) {
    console.warn("[materials] API выключен — файл сохранится локально.");
    return null;
  }
  if (!getToken()) {
    console.warn("[materials] Нет серверного токена: войдите через сервер (кнопка «Перезайти»), иначе файл сохранится только локально.");
    return null;
  }
  try {
    const fd = new FormData();
    fd.append("title", meta.title);
    fd.append("tag", meta.tag);
    fd.append("topic", meta.topic);
    fd.append("part", String(meta.part));
    fd.append("pages", String(meta.pages));
    fd.append("file", file);
    const res = await fetch(`${API_URL}/api/materials/upload`, {
      method: "POST",
      headers: authHeaders(),
      body: fd,
    });
    if (!res.ok) {
      console.warn(`[materials] Сервер отклонил загрузку: HTTP ${res.status}. Файл сохранится локально.`);
      return null;
    }
    return (await res.json()) as ServerMaterialMeta;
  } catch (e) {
    console.warn("[materials] Ошибка загрузки на сервер, файл сохранится локально.", e);
    return null;
  }
}

/** Удаляет методичку на сервере (для преподавателя). */
export async function deleteServerMaterial(serverId: string): Promise<void> {
  if (!isApiEnabled() || !getToken()) return;
  try {
    await fetch(`${API_URL}/api/materials/${serverId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
  } catch { /* ок */ }
}

/** URL скачивания серверной методички. */
export function serverDownloadUrl(serverId: string): string {
  return `${API_URL}/api/materials/${serverId}/download`;
}
export interface MaterialSection {
  h: string;
  body: string; // допускаются переносы строк и unicode-математика (√, ², π, ≤)
}

export interface StudyMaterial {
  id: string;
  title: string;
  tag: string;          // «№18 Параметры», «Часть 1»…
  topic: string;        // группа для фильтра
  part: 0 | 1 | 2;      // 0 = обе части
  pages: number;
  downloads: number;
  addedAt: number;
  kind: "demo" | "file";
  content?: MaterialSection[];   // для demo — печатается в документ
  fileId?: string;               // id Blob в IndexedDB (основное хранение)
  fileData?: string;             // dataURL-фолбэк, если IndexedDB недоступен
  fileUrl?: string;              // прямая ссылка на PDF
  fileName?: string;
  fileSizeKb?: number;
}

const KEY = "komi-materials-v1";
const DL_KEY = "komi-materials-dl-v1";

function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/* ─────────────────── демо-библиотека (реальные конспекты) ─────────────────── */

const D = 86_400_000;
const now = Date.now();

export const DEMO_MATERIALS: StudyMaterial[] = [
  {
    id: "dm-trig",
    title: "Тригонометрия: полный справочник формул",
    tag: "№13 · Часть 1+2",
    topic: "Алгебра",
    part: 0,
    pages: 4,
    downloads: 412,
    addedAt: now - 210 * D,
    kind: "demo",
    content: [
      { h: "Основные тождества", body: "sin²x + cos²x = 1\ntg x = sin x / cos x,  ctg x = cos x / sin x\ntg x · ctg x = 1\n1 + tg²x = 1 / cos²x,  1 + ctg²x = 1 / sin²x" },
      { h: "Двойной и половинный угол", body: "sin 2x = 2 sin x cos x\ncos 2x = cos²x − sin²x = 2cos²x − 1 = 1 − 2sin²x\ntg 2x = 2tg x / (1 − tg²x)\nsin²x = (1 − cos 2x)/2,  cos²x = (1 + cos 2x)/2  ← главный приём в №13!" },
      { h: "Сумма и разность", body: "sin(x ± y) = sin x cos y ± cos x sin y\ncos(x ± y) = cos x cos y ∓ sin x sin y\nФормулы преобразования суммы в произведение:\nsin a + sin b = 2 sin((a+b)/2) cos((a−b)/2)" },
      { h: "Частые значения (запомнить!)", body: "sin 30° = 1/2,  sin 45° = √2/2,  sin 60° = √3/2\ncos 30° = √3/2,  cos 45° = √2/2,  cos 60° = 1/2\nПериод sin и cos — 2π, tg и ctg — π" },
    ],
  },
  {
    id: "dm-eq13",
    title: "№13 Уравнения: все методы решения",
    tag: "№13 · Часть 2",
    topic: "Алгебра",
    part: 2,
    pages: 6,
    downloads: 358,
    addedAt: now - 195 * D,
    kind: "demo",
    content: [
      { h: "Какие уравнения дают", body: "Тригонометрические (чаще всего), показательные, логарифмические, смешанные. Балл: 2 первичных (1 — за верные корни, 1 — за отбор)." },
      { h: "Базовые приёмы", body: "1) Замена переменной: t = sin x, t = 2ˣ, t = log₂x — сводим к квадратному.\n2) Однородные уравнения: делим на cos²x (cos x ≠ 0 проверить отдельно!).\n3) Разложение на множители: вынесение, формулы, группировка.\n4) Метод мажорант: если f(x) ≤ 1 ≤ g(x), то равенство только при f = g = 1." },
      { h: "Отбор корней — три способа", body: "а) Тригонометрическая окружность — отметить корни серии и сосчитать попавшие в промежуток.\nб) Неравенство: решить двойное неравенство для k — самый надёжный способ.\nв) Перебор целых k — подходит, если промежуток короткий." },
      { h: "Где теряют баллы", body: "• Забыли ОДЗ (tg, ctg, логарифмы, деление).\n• Потеряли серию корней при замене.\n• Неверный отбор: лишний или пропущенный корень = 0 баллов за пункт «б»." },
    ],
  },
  {
    id: "dm-param18",
    title: "№18 Параметры: графический метод",
    tag: "№18 · Часть 2",
    topic: "Параметры",
    part: 2,
    pages: 5,
    downloads: 291,
    addedAt: now - 180 * D,
    kind: "demo",
    content: [
      { h: "Идея метода", body: "Рисуем в координатах (x; y) семейство графиков, зависящих от a, и смотрим, при каких a выполняется условие («ровно 2 корня», «есть решение» и т.д.).\nКлюч: «количество корней» = количество пересечений графиков." },
      { h: "Что надо уметь рисовать", body: "• y = |f(x)| — часть ниже оси OX отражается вверх.\n• y = f(|x|) — правая половина отражается влево (чётность).\n• Семейство прямых y = a (горизонтали) и y = ax (пучок через начало).\n• Окружности: (x − a)² + (y − b)² = r² — центр (a; b), радиус r." },
      { h: "Типовой план решения", body: "1) Преобразовать уравнение к виду f(x) = g(x, a).\n2) Построить график f(x) (с модулями/симметриями).\n3) Провести семейство g и найти критические положения a: касание, прохождение через «изломы».\n4) Выписать ответ промежутками и отдельными значениями." },
      { h: "Критические положения (проверь каждое!)", body: "Касание прямой и окружности: расстояние от центра до прямой = r.\nПрохождение через вершину параболы/«излом» модуля — подставить точку.\nГраничные значения a, где меняется число корней." },
    ],
  },
  {
    id: "dm-prob",
    title: "Теория вероятностей: формулы для №4–5",
    tag: "№4–5 · Часть 1",
    topic: "Вероятность",
    part: 1,
    pages: 3,
    downloads: 517,
    addedAt: now - 160 * D,
    kind: "demo",
    content: [
      { h: "Классическое определение", body: "P(A) = m / n, где m — благоприятные исходы, n — все равновозможные.\nГлавное — правильно посчитать n! «Выбор двух из пяти» — это сочетания C₅² = 10, а не 20." },
      { h: "«И» и «ИЛИ»", body: "Независимые события «и» (оба): P(A·B) = P(A) · P(B).\nНесовместные «или»: P(A+B) = P(A) + P(B).\nОбщий случай: P(A+B) = P(A) + P(B) − P(A·B).\nПротивоположное: P(Ā) = 1 − P(A)." },
      { h: "«Хотя бы один» — главный приём", body: "P(хотя бы один) = 1 − P(ни одного).\nПример: три стрелка попадают с вероятностями 0,7; 0,8; 0,9. Ни один: 0,3·0,2·0,1 = 0,006. Хотя бы один: 0,994." },
      { h: "Ловушки ЕГЭ", body: "• «Наугад выбирают два» — порядок НЕ важен (сочетания).\n• «По очереди» / «первый и второй» — порядок важен.\n• Условная вероятность: сужаем пространство исходов («известно, что…»).\n• Ответ округляем до сотых, если просит условие!" },
    ],
  },
  {
    id: "dm-finance17",
    title: "№17 Экономическая задача: кредиты и вклады",
    tag: "№17 · Часть 2",
    topic: "Финансовая",
    part: 2,
    pages: 4,
    downloads: 244,
    addedAt: now - 140 * D,
    kind: "demo",
    content: [
      { h: "Базовая модель", body: "Долг S каждый период умножается на k = 1 + r/100 (r — процентная ставка), затем выплачивается часть.\nЗаписывайте схему по периодам — таблица спасает от ошибок." },
      { h: "Дифференцированные платежи", body: "Долг уменьшается на равные части: S/n каждый месяц.\nПроценты начисляются на остаток — сумма выплат считается арифметической прогрессией." },
      { h: "Аннуитетные платежи (равные)", body: "Платёж X одинаков каждый период. Баланс: S·kⁿ = X·(kⁿ⁻¹ + kⁿ⁻² + … + 1) = X·(kⁿ − 1)/(k − 1).\nОтсюда X = S·kⁿ·(k−1)/(kⁿ−1). Это формула, которую нужно знать наизусть." },
      { h: "Вклады и сложные проценты", body: "Вклад растёт: S·kⁿ (ежегодное начисление).\nЕсли начисление ежемесячное, а снимают раз в год — аккуратно считайте базу начисления.\nПроцесс «вклад + снятие» расписывайте по годам таблицей." },
    ],
  },
  {
    id: "dm-deriv",
    title: "Производная: таблица и геометрический смысл",
    tag: "№7, 12 · Обе части",
    topic: "Анализ",
    part: 0,
    pages: 3,
    downloads: 388,
    addedAt: now - 120 * D,
    kind: "demo",
    content: [
      { h: "Таблица производных", body: "(xⁿ)′ = n·xⁿ⁻¹,  (√x)′ = 1/(2√x),  (1/x)′ = −1/x²\n(sinx)′ = cosx,  (cosx)′ = −sinx,  (eˣ)′ = eˣ,  (lnx)′ = 1/x\n(aˣ)′ = aˣ·ln a,  (logₐx)′ = 1/(x·ln a)" },
      { h: "Правила", body: "(u ± v)′ = u′ ± v′\n(u·v)′ = u′v + uv′\n(u/v)′ = (u′v − uv′)/v²\n(f(g(x)))′ = f′(g(x))·g′(x)  ← правило цепочки, про него забывают!" },
      { h: "Геометрический смысл", body: "f′(x₀) = угловой коэффициент касательной в точке x₀.\nКасательная: y = f(x₀) + f′(x₀)(x − x₀).\nКасательная параллельна прямой y = kx + b ⇔ f′(x) = k." },
      { h: "Монотонность и экстремумы (№12)", body: "f′ > 0 — возрастает, f′ < 0 — убывает.\nТочки, где f′ = 0 или не существует, — кандидаты в экстремумы.\nНаибольшее значение на отрезке: сравнить f в критических точках и на концах!" },
    ],
  },
  {
    id: "dm-stereo",
    title: "Стереометрия: объёмы, сечения, координаты",
    tag: "№3, 14 · Обе части",
    topic: "Геометрия",
    part: 0,
    pages: 5,
    downloads: 203,
    addedAt: now - 100 * D,
    kind: "demo",
    content: [
      { h: "Объёмы (выучить наизусть)", body: "Призма/параллелепипед: V = S·h\nПирамида: V = ⅓·S·h\nЦилиндр: V = πr²h,  конус: V = ⅓πr²h\nШар: V = 4/3·πr³,  сфера: S = 4πr²" },
      { h: "Сечения", body: "Сечение — пересечение плоскости с гранями. Строим по точкам: ищем общие точки плоскости сечения с рёбрами и соединяем.\nПриём «следов»: продолжайте стороны сечения до пересечения с плоскостями граней." },
      { h: "Координатный метод — спасение №14", body: "1) Ввести систему координат (удобно — за вершину прямого угла).\n2) Найти координаты нужных точек.\n3) Угол прямых: cos φ = |u⃗·v⃗| / (|u⃗|·|v⃗|).\n4) Угол прямой и плоскости: через нормаль n⃗: sin φ = |u⃗·n⃗|/(|u⃗||n⃗|).\n5) Расстояние от точки до плоскости: |Ax₀+By₀+Cz₀+D|/√(A²+B²+C²)." },
      { h: "Метод вспомогательного объёма", body: "Расстояние от точки до плоскости можно найти из равенства объёмов: V = ⅓·S·h, посчитанных двумя способами. Работает, когда координаты громоздкие." },
    ],
  },
  {
    id: "dm-plan16",
    title: "№16 Планиметрия: ключевые факты",
    tag: "№16 · Часть 2",
    topic: "Геометрия",
    part: 2,
    pages: 4,
    downloads: 176,
    addedAt: now - 80 * D,
    kind: "demo",
    content: [
      { h: "Окружности", body: "Вписанный угол = ½ дуги, на которую опирается.\nКасательная ⊥ радиусу в точке касания.\nКасательная и секущая: |AB|² = |AC|·|AD|.\nДве касательные из одной точки равны." },
      { h: "Вписанные четырёхугольники", body: "Четырёхугольник вписан ⇔ сумма противоположных углов = 180°.\nЭто главный источник равных углов в задачах — ищите вписанные четырёхугольники!" },
      { h: "Подобие — где искать", body: "Равные углы: вписанные на одну дугу, накрест лежащие, общий угол + равный второй.\nСредние линии, высоты прямоугольного треугольника — классика подобия.\nОтношение площадей подобных = k²." },
      { h: "Структура решения", body: "Пункт «а» (доказательство) — 1 балл, пункт «б» (вычисление) — 2 балла.\nДаже если «б» не вышло — оформите «а» идеально. Частичные баллы решают." },
    ],
  },
  {
    id: "dm-log",
    title: "Логарифмы и степени: свойства и ловушки",
    tag: "№6, 15 · Часть 1+2",
    topic: "Алгебра",
    part: 0,
    pages: 3,
    downloads: 329,
    addedAt: now - 60 * D,
    kind: "demo",
    content: [
      { h: "Свойства логарифмов", body: "logₐ(xy) = logₐx + logₐy\nlogₐ(x/y) = logₐx − logₐy\nlogₐxⁿ = n·logₐx\nlogₐb = 1/log_b a,  logₐb·log_b c = logₐ c  ← переход к новому основанию" },
      { h: "Степени", body: "aᵐ·aⁿ = aᵐ⁺ⁿ,  aᵐ/aⁿ = aᵐ⁻ⁿ,  (aᵐ)ⁿ = aᵐⁿ\na⁻ⁿ = 1/aⁿ,  a^(1/n) = ⁿ√a\n(a·b)ⁿ = aⁿ·bⁿ — а для суммы так нельзя: (a+b)² ≠ a²+b²!" },
      { h: "ОДЗ — проверяй всегда", body: "logₐf(x): f(x) > 0, a > 0, a ≠ 1.\n√f(x): f(x) ≥ 0.  Знаменатель ≠ 0.\nВ №15 потерянное ОДЗ = потерянный балл." },
      { h: "Топ-5 ошибок", body: "1) log(a+b) ≠ log a + log b.\n2) Забыли, что основание логарифма тоже может быть переменной (a ≠ 1!).\n3) При возведении в квадрат появились лишние корни.\n4) Сократили на выражение, равное нулю.\n5) Переход log²x = (log x)² перепутали с log(x²)." },
    ],
  },
  {
    id: "dm-num19",
    title: "№19 Числа и их свойства: делимость",
    tag: "№19 · Часть 2",
    topic: "Числа",
    part: 2,
    pages: 4,
    downloads: 152,
    addedAt: now - 40 * D,
    kind: "demo",
    content: [
      { h: "Признаки делимости", body: "на 2 — последняя цифра чётная; на 5 — 0 или 5; на 10 — 0\nна 3 и 9 — сумма цифр; на 4 — две последние цифры; на 8 — три последние\nна 11 — разность сумм цифр на чётных и нечётных местах" },
      { h: "Остатки — главный инструмент", body: "Числа с одинаковым остатком при делении на m ведут себя одинаково.\nКвадраты по модулю 4 дают только 0 или 1; по модулю 3 — 0 или 1.\nЭто мгновенно закрывает пункты «а» про «может ли быть…»" },
      { h: "Принцип Дирихле", body: "Если кроликов больше, чем клеток, в какой-то клетке ≥ 2 кроликов.\nПрименение: «докажите, что найдутся два числа с одинаковым остатком» — остатков m, чисел m+1." },
      { h: "Структура полного решения", body: "«а» — привести пример (конкретные числа!). 1 балл.\n«б» — доказать невозможность (остатки/чётность). 1 балл.\n«в» — найти максимум/минимум: оценка + пример, её достигающий. 2 балла.\nОценка без примера и пример без оценки — по 0." },
    ],
  },
];

/* ─────────────────── хранилище ─────────────────── */

export function readUserMaterials(): StudyMaterial[] {
  return readLS<StudyMaterial[]>(KEY, []);
}

/** Все материалы: добавленные преподавателем (сверху) + демо-библиотека. */
export function readAllMaterials(): StudyMaterial[] {
  const dl = readLS<Record<string, number>>(DL_KEY, {});
  const withDl = (list: StudyMaterial[]) =>
    list.map((m) => ({ ...m, downloads: m.downloads + (dl[m.id] ?? 0) }));
  return [...withDl(readUserMaterials()), ...withDl(DEMO_MATERIALS)];
}

/**
 * Асинхронная сводная загрузка: серверные методички (когда бэкенд
 * подключён) + локальные + демо. Серверные преобразуются в StudyMaterial
 * с fileId "srv:<id>" — скачивание идёт через бэкенд.
 */
export async function loadAllMaterials(): Promise<StudyMaterial[]> {
  const dl = readLS<Record<string, number>>(DL_KEY, {});
  const withDl = (list: StudyMaterial[]) =>
    list.map((m) => ({ ...m, downloads: m.downloads + (dl[m.id] ?? 0) }));

  const server = await fetchServerMaterials();
  const serverMaterials: StudyMaterial[] = (server ?? []).map((s) => ({
    id: `${SRV_PREFIX}${s.id}`,
    title: s.title, tag: s.tag, topic: s.topic, part: s.part as StudyMaterial["part"],
    pages: s.pages, downloads: s.downloads, addedAt: 0, kind: "file" as const,
    fileId: `${SRV_PREFIX}${s.id}`,
    fileUrl: serverDownloadUrl(s.id),
    fileSizeKb: s.file_size_kb ?? undefined,
  }));

  return [...serverMaterials, ...withDl(readUserMaterials()), ...withDl(DEMO_MATERIALS)];
}

export function addMaterial(m: Omit<StudyMaterial, "id" | "downloads" | "addedAt" | "kind"> & { kind: StudyMaterial["kind"] }): StudyMaterial {
  const full: StudyMaterial = { ...m, id: `mat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, downloads: 0, addedAt: Date.now() };
  const list = readUserMaterials();
  try {
    localStorage.setItem(KEY, JSON.stringify([full, ...list]));
  } catch {
    throw new Error("Файл слишком большой для локального хранилища (лимит ~2.5 МБ). Используйте прямую ссылку или боевой режим — там файл уйдёт на сервер.");
  }
  /* Проверяем, что запись реально сохранилась (иначе при скачивании будет «мусор»). */
  const saved = readUserMaterials().find((x) => x.id === full.id);
  if (!saved || (!!full.fileData && !saved.fileData)) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* откат */ }
    throw new Error("Файл не поместился в хранилище браузера. Используйте прямую ссылку на PDF или боевой режим.");
  }
  return full;
}

/**
 * Сохраняет методичку с PDF-файлом. Сам файл кладёт в IndexedDB
 * (практически без ограничения размера), в localStorage — только
 * метаданные с fileId. Если IndexedDB недоступен — фолбэк на dataURL
 * в localStorage (с ограничением ~2.5 МБ).
 */
export async function addMaterialWithFile(
  meta: Omit<StudyMaterial, "id" | "downloads" | "addedAt" | "kind" | "fileId" | "fileData">,
  file: File | null,
  fileDataUrl: string | null,
): Promise<StudyMaterial & { savedTo: "server" | "local" }> {
  /* 1) Сервер (когда бэкенд подключён и есть токен преподавателя):
     файл живёт на сервере, виден всем ученикам. */
  if (file) {
    const serverMeta = await uploadServerMaterial(
      { title: meta.title, tag: meta.tag, topic: meta.topic, part: meta.part, pages: meta.pages },
      file,
    );
    if (serverMeta) {
      return {
        ...meta, id: `${SRV_PREFIX}${serverMeta.id}`, downloads: serverMeta.downloads,
        addedAt: Date.now(), kind: "file", fileId: `${SRV_PREFIX}${serverMeta.id}`,
        fileUrl: serverDownloadUrl(serverMeta.id), fileSizeKb: serverMeta.file_size_kb ?? undefined,
        savedTo: "server",
      };
    }
    /* сервер недоступен / нет токена — фолбэк на локальное хранилище ниже */
  }

  /* 2) Локально: файл в IndexedDB, метаданные в localStorage. */
  const id = `mat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  let fileId: string | undefined;
  let fileData: string | undefined;

  if (file) {
    if (await isIndexedDbAvailable()) {
      await saveFileBlob(id, file);   // Blob как есть, без base64
      fileId = id;
    } else if (fileDataUrl) {
      fileData = fileDataUrl;          // фолбэк для приватного режима
    } else {
      throw new Error("Не удалось сохранить файл. Используйте прямую ссылку на PDF.");
    }
  }

  const full: StudyMaterial = {
    ...meta, id, downloads: 0, addedAt: Date.now(), kind: "file", fileId, fileData,
  };
  const list = readUserMaterials();
  try {
    localStorage.setItem(KEY, JSON.stringify([full, ...list]));
  } catch {
    if (fileId) { try { await deleteFileBlob(fileId); } catch { /* ок */ } }
    throw new Error("Не удалось сохранить данные методички. Попробуйте ещё раз.");
  }
  return { ...full, savedTo: "local" };
}

export function removeMaterial(id: string): void {
  const target = readUserMaterials().find((m) => m.id === id);
  try {
    localStorage.setItem(KEY, JSON.stringify(readUserMaterials().filter((m) => m.id !== id)));
  } catch { /* ок */ }
  /* подчищаем Blob из IndexedDB (файловое хранилище) */
  if (target?.fileId) {
    deleteFileBlob(target.fileId).catch(() => { /* ок */ });
  }
}

export function bumpDownload(id: string): void {
  try {
    const dl = readLS<Record<string, number>>(DL_KEY, {});
    dl[id] = (dl[id] ?? 0) + 1;
    localStorage.setItem(DL_KEY, JSON.stringify(dl));
  } catch { /* ок */ }
}

/* ─────────────────── скачивание ─────────────────── */

/** data:application/pdf;base64,… → Blob (надёжнее, чем href=dataURL для больших файлов). */
function dataUrlToBlob(dataUrl: string): Blob | null {
  const m = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if (!m) return null;
  const mime = m[1] || "application/octet-stream";
  if (m[2]) {
    try {
      const bin = atob(m[3]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new Blob([bytes], { type: mime });
    } catch {
      return null;
    }
  }
  return new Blob([decodeURIComponent(m[3])], { type: mime });
}

/**
 * Скачивание методички (асинхронное). Приоритет:
 *  1) Blob из IndexedDB (fileId) — основное хранение;
 *  2) data-URL (фолбэк); 3) прямая ссылка (fileUrl).
 * Возвращает "file" | "url" | "none". Мусор не скачивается никогда.
 */
export async function downloadFile(m: StudyMaterial): Promise<"file" | "url" | "none"> {
  const name = m.fileName ?? `${m.title.replace(/[^\wа-яёА-ЯЁ0-9]+/g, "_") || "metodichka"}.pdf`;

  const triggerDownload = (blob: Blob): void => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  /* 0) серверная методичка — качаем PDF с бэкенда.
     Получаем файл через fetch и проверяем, что это именно PDF
     (application/pdf). Если сервер вернул ошибку (HTML/JSON) —
     НЕ скачиваем «хлам», а сообщаем, что файла нет. */
  if (m.fileId && m.fileId.startsWith(SRV_PREFIX)) {
    try {
      const res = await fetch(serverDownloadUrl(m.fileId.slice(SRV_PREFIX.length)));
      if (res.ok) {
        const ct = (res.headers.get("content-type") ?? "").toLowerCase();
        const isPdf = ct.includes("pdf") || ct.includes("octet-stream");
        if (isPdf) {
          const blob = await res.blob();
          if (blob.size > 0) {
            triggerDownload(blob);
            return "file";
          }
        }
      }
      /* Сервер вернул ошибку или не-PDF → файла по факту нет. */
      return "none";
    } catch {
      return "none"; // сеть недоступна
    }
  }

  /* 1) IndexedDB */
  if (m.fileId) {
    try {
      const blob = await getFileBlob(m.fileId);
      if (blob && blob.size > 0) {
        triggerDownload(blob);
        return "file";
      }
    } catch { /* переходим к фолбэку */ }
  }

  /* 2) data-URL фолбэк */
  if (m.fileData) {
    const blob = dataUrlToBlob(m.fileData);
    if (blob && blob.size > 0) {
      triggerDownload(blob);
      return "file";
    }
    return "none"; // битый data-URL — не скачиваем мусор
  }

  /* 3) прямая ссылка */
  if (m.fileUrl) {
    const a = document.createElement("a");
    a.href = m.fileUrl;
    a.download = name;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return "url";
  }

  return "none";
}

/** Открывает печатную версию демо-материала в новом окне (для «Сохранить как PDF»). */
export function printMaterialInNewWindow(m: StudyMaterial): void {
  const w = window.open("", "_blank", "width=900,height=1100");
  if (!w) return;
  w.document.open();
  w.document.write(materialPrintHtml(m));
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

/** Печатный HTML-документ для демо-материала (сохраняется как PDF через диалог печати). */
export function materialPrintHtml(m: StudyMaterial): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const sections = (m.content ?? [])
    .map(
      (s) => `<h2>${esc(s.h)}</h2><pre>${esc(s.body)}</pre>`,
    )
    .join("");
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"/>
<title>${esc(m.title)}</title>
<style>
  @page { margin: 18mm; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a2332; max-width: 760px; margin: 0 auto; padding: 24px; }
  header { border-bottom: 3px solid #ffc94d; padding-bottom: 14px; margin-bottom: 22px; }
  .brand { font-size: 12px; letter-spacing: .18em; text-transform: uppercase; color: #8a93a5; font-family: Arial, sans-serif; }
  h1 { font-size: 26px; margin: 8px 0 4px; }
  .tag { display: inline-block; background: #fff6dd; color: #7a5a00; font: 700 12px Arial, sans-serif; padding: 3px 10px; border-radius: 999px; }
  h2 { font-size: 17px; margin: 22px 0 6px; color: #14523c; }
  pre { font-family: 'Courier New', monospace; font-size: 13.5px; line-height: 1.65; white-space: pre-wrap; background: #f5f7fa; border-left: 3px solid #14523c; padding: 12px 14px; margin: 0; border-radius: 0 8px 8px 0; }
  footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #d8dde6; font: 12px Arial, sans-serif; color: #8a93a5; }
</style></head><body>
<header>
  <div class="brand">Репетитор из Коми · бесплатная методичка</div>
  <h1>${esc(m.title)}</h1>
  <span class="tag">${esc(m.tag)}</span>
</header>
${sections}
<footer>Подготовка к профильному ЕГЭ по математике · repetitor-iz-komi · материал бесплатен для учеников</footer>
</body></html>`;
}
