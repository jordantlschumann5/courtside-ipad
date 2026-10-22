const DB_NAME = 'courtside-offline-v1';
const STORE = 'games';

function open() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function perform(mode, operation) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = operation(tx.objectStore(STORE));
    let value;
    request.onsuccess = () => { value = request.result; };
    tx.oncomplete = () => { db.close(); resolve(value); };
    tx.onerror = () => { db.close(); reject(tx.error || request.error); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error('Storage transaction aborted.')); };
  });
}

export const listGames = () => perform('readonly', store => store.getAll());
export const getGame = id => perform('readonly', store => store.get(id));
export const putGame = game => perform('readwrite', store => store.put(game));
