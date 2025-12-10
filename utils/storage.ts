
const DB_NAME = 'SantaGiftDB';
const STORE_NAME = 'assets';

const getDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("IndexedDB not supported"));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
};

export const saveAsset = async (key: string, file: Blob) => {
  const db = await getDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(file, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

export const loadAllAssets = async () => {
  const db = await getDB();
  return new Promise<{ bgUrl: string | null, sockUrl: string | null, giftUrls: Record<number, string> }>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    
    const result = {
        bgUrl: null as string | null,
        sockUrl: null as string | null,
        giftUrls: {} as Record<number, string>
    };

    const request = store.openCursor();
    request.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest).result;
        if (cursor) {
            const key = cursor.key as string;
            const blob = cursor.value as Blob;
            const url = URL.createObjectURL(blob);
            
            if (key === 'bg') result.bgUrl = url;
            else if (key === 'sock') result.sockUrl = url;
            else if (key.startsWith('gift_')) {
                const id = parseInt(key.replace('gift_', ''), 10);
                if (!isNaN(id)) {
                    result.giftUrls[id] = url;
                }
            }
            cursor.continue();
        } else {
            resolve(result);
        }
    };
    request.onerror = () => reject(request.error);
  });
};

// --- Export / Import Logic ---

const blobToDataURL = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

const dataURLToBlob = async (dataURL: string): Promise<Blob> => {
    const res = await fetch(dataURL);
    return res.blob();
};

export const exportAssetsToJson = async (): Promise<string> => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAllKeys();
        
        request.onsuccess = async () => {
            const keys = request.result as string[];
            const exportData: Record<string, string> = {};
            
            // Fetch all values
            const valuesReq = store.getAll();
            valuesReq.onsuccess = async () => {
                const values = valuesReq.result as Blob[];
                try {
                    for (let i = 0; i < keys.length; i++) {
                        // Ensure we have a valid blob
                        if (values[i] instanceof Blob) {
                             exportData[keys[i]] = await blobToDataURL(values[i]);
                        }
                    }
                    resolve(JSON.stringify(exportData));
                } catch (e) {
                    reject(e);
                }
            };
            valuesReq.onerror = () => reject(valuesReq.error);
        };
        request.onerror = () => reject(request.error);
    });
};

// Robust Import Function
export const robustImportAssets = async (jsonString: string): Promise<void> => {
    let data: Record<string, string>;
    try {
        data = JSON.parse(jsonString);
    } catch (e) {
        throw new Error("Invalid JSON");
    }

    const keys = Object.keys(data);
    const blobs: Record<string, Blob> = {};

    // 1. Prepare Blobs (Async, no DB transaction yet)
    await Promise.all(keys.map(async (key) => {
        try {
            blobs[key] = await dataURLToBlob(data[key]);
        } catch (e) {
            console.error(`Error converting ${key}`, e);
        }
    }));

    // 2. Batch Save (Sync inside transaction)
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        Object.entries(blobs).forEach(([key, blob]) => {
            store.put(blob, key);
        });

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};
