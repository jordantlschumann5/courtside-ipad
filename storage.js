const DB_NAME = 'courtside-offline-v1';
const STORE = 'games';
const SETUP_STORE = 'setups';

function open() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(SETUP_STORE)) db.createObjectStore(SETUP_STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function perform(storeName, mode, operation) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const request = operation(tx.objectStore(storeName));
    let value;
    request.onsuccess = () => { value = request.result; };
    tx.oncomplete = () => { db.close(); resolve(value); };
    tx.onerror = () => { db.close(); reject(tx.error || request.error); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error('Storage transaction aborted.')); };
  });
}

export const listGames = () => perform(STORE, 'readonly', store => store.getAll());
export const getGame = id => perform(STORE, 'readonly', store => store.get(id));
export const putGame = game => perform(STORE, 'readwrite', store => store.put(game));
export const listSetups = () => perform(SETUP_STORE, 'readonly', store => store.getAll());
export const putSetup = setup => perform(SETUP_STORE, 'readwrite', store => store.put(setup));
export const deleteSetup = id => perform(SETUP_STORE, 'readwrite', store => store.delete(id));
