export type LogType = 'action' | 'llm_prompt' | 'llm_response' | 'error';

export interface LogEntry {
    id?: number;
    timestamp: number;
    type: LogType;
    message: string;
    details?: unknown;
}

export const LOGS_UPDATED_EVENT = 'aiTeacher.logsUpdated';

const DB_NAME = 'AITeacherLogsDB';
const DB_VERSION = 1;
const STORE_NAME = 'logs';

let dbPromise: Promise<IDBDatabase> | null = null;

const initDB = (): Promise<IDBDatabase> => {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('Failed to open IndexedDB for logs');
            reject(request.error);
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, {
                    keyPath: 'id',
                    autoIncrement: true,
                });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                store.createIndex('type', 'type', { unique: false });
            }
        };
    });

    return dbPromise;
};

export const addLog = async (
    type: LogType,
    message: string,
    details?: unknown,
): Promise<number> => {
    try {
        const db = await initDB();
        const entry: LogEntry = {
            timestamp: Date.now(),
            type,
            message,
            details,
        };

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.add(entry);

            request.onsuccess = () => {
                window.dispatchEvent(new CustomEvent(LOGS_UPDATED_EVENT));
                resolve(request.result as number);
            };
            request.onerror = () => reject(request.error);
        });
    } catch (err) {
        console.error('Failed to add log:', err);
        return -1;
    }
};

export const getLogs = async (
    limit: number = 100,
    offset: number = 0,
): Promise<LogEntry[]> => {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index('timestamp');

            // Open a cursor to get records ordered by timestamp descending
            const request = index.openCursor(null, 'prev');
            const results: LogEntry[] = [];
            let advanced = false;

            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;

                if (cursor) {
                    if (!advanced && offset > 0) {
                        advanced = true;
                        cursor.advance(offset);
                    } else {
                        results.push(cursor.value);
                        if (results.length < limit) {
                            cursor.continue();
                        } else {
                            resolve(results);
                        }
                    }
                } else {
                    resolve(results);
                }
            };

            request.onerror = () => reject(request.error);
        });
    } catch (err) {
        console.error('Failed to get logs:', err);
        return [];
    }
};

export const clearLogs = async (): Promise<void> => {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();

            request.onsuccess = () => {
                window.dispatchEvent(new CustomEvent(LOGS_UPDATED_EVENT));
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    } catch (err) {
        console.error('Failed to clear logs:', err);
    }
};
