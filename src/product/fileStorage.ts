/* ══════════════════════════════════════════════════════════════════
   Хранилище файлов (PDF-методички) на IndexedDB.

   Почему не localStorage: у него общий жёсткий лимит ~5 МБ на ВСЕ
   данные сайта, а PDF в base64 растёт на 33%. Файл в 2 МБ вместе с
   попытками/задачами легко превышает лимит → запись молча не
   сохраняется → «скачивается мусор». IndexedDB хранит Blob как есть
   (без base64) и даёт сотни МБ.

   Если IndexedDB недоступен (приватный режим) — фолбэк на dataURL в
   localStorage (старое поведение, с ограничением по размеру).
   ══════════════════════════════════════════════════════════════════ */

const DB_NAME = "komi-files";
const STORE = "files";
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB недоступен"));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Не удалось открыть IndexedDB"));
  });
  return dbPromise;
}

/** true, если IndexedDB реально работает (не приватный режим). */
export async function isIndexedDbAvailable(): Promise<boolean> {
  try {
    const db = await openDb();
    return !!db;
  } catch {
    return false;
  }
}

/** Сохраняет Blob файла под id. */
export async function saveFileBlob(id: string, blob: Blob): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Не удалось сохранить файл"));
    tx.onabort = () => reject(tx.error ?? new Error("Запись прервана"));
  });
}

/** Возвращает Blob файла или null, если его нет. */
export async function getFileBlob(id: string): Promise<Blob | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as Blob) ?? null);
    req.onerror = () => reject(req.error ?? new Error("Не удалось прочитать файл"));
  });
}

/** Удаляет файл. */
export async function deleteFileBlob(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Не удалось удалить файл"));
  });
}
