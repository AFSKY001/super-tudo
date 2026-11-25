/* Durable local snapshot storage. Not wired into app startup yet. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.STDurableStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const FORMAT = 1;
  const DB_NAME = 'st-app-durable-v1';
  const STORE_NAME = 'snapshots';

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function validObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function validateOwner(owner) {
    const value = String(owner || '').trim();
    if (!value || value.length > 300) throw new TypeError('Identificador da empresa/usuário inválido.');
    return value;
  }

  function validateSnapshot(snapshot, owner) {
    if (!validObject(snapshot) || !validObject(snapshot.state) || !validObject(snapshot.syncMeta)) {
      throw new TypeError('Snapshot local inválido.');
    }
    if (snapshot.syncMeta.owner && snapshot.syncMeta.owner !== owner) {
      throw new Error('O snapshot pertence a outra identidade.');
    }
    if (!Array.isArray(snapshot.syncMeta.queue)) {
      throw new TypeError('Fila de sincronização inválida.');
    }
  }

  function create(adapter) {
    if (!adapter || typeof adapter.read !== 'function' || typeof adapter.commit !== 'function') {
      throw new TypeError('Adaptador de armazenamento inválido.');
    }

    let writes = Promise.resolve();

    function load(owner) {
      const key = validateOwner(owner);
      return Promise.resolve(adapter.read(key)).then(function (record) {
        if (record == null) return null;
        if (!validObject(record) || record.format !== FORMAT || record.owner !== key) {
          throw new Error('Snapshot local incompatível ou corrompido; os dados foram preservados.');
        }
        validateSnapshot(record, key);
        return {
          owner: key,
          revision: Number(record.revision) || 0,
          savedAt: record.savedAt || null,
          state: clone(record.state),
          syncMeta: clone(record.syncMeta)
        };
      });
    }

    function save(owner, state, syncMeta) {
      const key = validateOwner(owner);
      const snapshot = { state: clone(state), syncMeta: clone(syncMeta) };
      validateSnapshot(snapshot, key);
      const record = {
        format: FORMAT,
        owner: key,
        savedAt: new Date().toISOString(),
        state: snapshot.state,
        syncMeta: snapshot.syncMeta
      };
      const operation = writes.then(function () {
        return adapter.commit(record);
      });
      writes = operation.catch(function () {});
      return operation;
    }

    return Object.freeze({ load: load, save: save });
  }

  function createIndexedDbAdapter(indexedDB) {
    if (!indexedDB || typeof indexedDB.open !== 'function') {
      throw new Error('IndexedDB não está disponível neste aparelho.');
    }

    let databasePromise;
    function database() {
      if (!databasePromise) {
        databasePromise = new Promise(function (resolve, reject) {
          const request = indexedDB.open(DB_NAME, 1);
          request.onupgradeneeded = function () {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
              db.createObjectStore(STORE_NAME, { keyPath: 'owner' });
            }
          };
          request.onsuccess = function () { resolve(request.result); };
          request.onerror = function () { reject(request.error || new Error('Falha ao abrir armazenamento local.')); };
          request.onblocked = function () { reject(new Error('Atualização do armazenamento local bloqueada por outra aba.')); };
        });
      }
      return databasePromise;
    }

    function read(owner) {
      return database().then(function (db) {
        return new Promise(function (resolve, reject) {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const request = tx.objectStore(STORE_NAME).get(owner);
          let result = null;
          request.onsuccess = function () { result = request.result || null; };
          request.onerror = function () { reject(request.error || new Error('Falha ao ler snapshot local.')); };
          tx.oncomplete = function () { resolve(result); };
          tx.onerror = function () { reject(tx.error || new Error('Falha na leitura local.')); };
          tx.onabort = function () { reject(tx.error || new Error('Leitura local cancelada.')); };
        });
      });
    }

    function commit(record) {
      return database().then(function (db) {
        return new Promise(function (resolve, reject) {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const request = store.get(record.owner);
          let revision = 0;
          request.onsuccess = function () {
            revision = (Number(request.result && request.result.revision) || 0) + 1;
            store.put(Object.assign({}, record, { revision: revision }));
          };
          request.onerror = function () {
            try { tx.abort(); } catch (_) {}
            reject(request.error || new Error('Falha ao preparar gravação local.'));
          };
          tx.oncomplete = function () { resolve(revision); };
          tx.onerror = function () { reject(tx.error || new Error('Falha ao gravar snapshot local.')); };
          tx.onabort = function () { reject(tx.error || new Error('Gravação local cancelada.')); };
        });
      });
    }

    return Object.freeze({ read: read, commit: commit });
  }

  return Object.freeze({
    create: create,
    createIndexedDbAdapter: createIndexedDbAdapter,
    format: FORMAT
  });
});
