const DATABASE_NAME = "melody-rain";
const STORE_NAME = "settings";
const LAST_FOLDER_KEY = "last-asset-folder";

export interface RememberedDirectoryHandle {
  kind: "directory";
  name: string;
  entries(): AsyncIterableIterator<[string, RememberedDirectoryEntry]>;
  queryPermission?(descriptor: { mode: "read" }): Promise<PermissionState>;
}

interface RememberedDirectoryEntry {
  kind: "file" | "directory";
  name: string;
  getFile?(): Promise<File>;
  entries?(): AsyncIterableIterator<[string, RememberedDirectoryEntry]>;
}

type DirectoryPickerWindow = Window & typeof globalThis & {
  showDirectoryPicker?: () => Promise<RememberedDirectoryHandle>;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("无法打开本地项目设置"));
  });
}

async function readSetting<T>(key: string): Promise<T | null> {
  const database = await openDatabase();
  return new Promise<T | null>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("无法读取本地项目设置"));
  }).finally(() => database.close());
}

async function writeSetting(key: string, value: unknown): Promise<void> {
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(value, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("无法保存素材文件夹选择"));
  }).finally(() => database.close());
}

export function canRememberFolder(): boolean {
  return typeof window !== "undefined" && typeof (window as DirectoryPickerWindow).showDirectoryPicker === "function";
}

export async function chooseAssetFolder(): Promise<RememberedDirectoryHandle> {
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
  if (!picker) throw new Error("当前浏览器不支持记住素材文件夹；请使用 Chrome 或 Edge。");
  return picker();
}

export async function rememberAssetFolder(handle: RememberedDirectoryHandle): Promise<void> {
  await writeSetting(LAST_FOLDER_KEY, handle);
}

export function lastRememberedAssetFolder(): Promise<RememberedDirectoryHandle | null> {
  return readSetting<RememberedDirectoryHandle>(LAST_FOLDER_KEY);
}

export async function canReadFolder(handle: RememberedDirectoryHandle): Promise<boolean> {
  return (await handle.queryPermission?.({ mode: "read" })) === "granted";
}

export async function filesInFolder(handle: RememberedDirectoryHandle): Promise<File[]> {
  const files: File[] = [];
  const collect = async (directory: RememberedDirectoryHandle): Promise<void> => {
    for await (const [, entry] of directory.entries()) {
      if (entry.kind === "file" && entry.getFile) files.push(await entry.getFile());
      if (entry.kind === "directory" && entry.entries) await collect(entry as RememberedDirectoryHandle);
    }
  };
  await collect(handle);
  return files;
}
