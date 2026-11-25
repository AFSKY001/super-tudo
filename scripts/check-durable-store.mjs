import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { create } = require('./durable-store.js');

function memoryAdapter() {
  const records = new Map();
  let sequence = Promise.resolve();
  return {
    records,
    read(owner) { return Promise.resolve(records.get(owner) || null); },
    commit(record, expectedRevision) {
      const write = sequence.then(() => {
        const currentRevision = records.get(record.owner)?.revision || 0;
        if (currentRevision !== expectedRevision) throw new Error('Snapshot alterado em outra aba.');
        const revision = currentRevision + 1;
        records.set(record.owner, structuredClone({ ...record, revision }));
        return revision;
      });
      sequence = write.catch(() => {});
      return write;
    }
  };
}

const state = { notes: [{ id: 'n1', text: 'rascunho' }], settings: { theme: 'dark' } };
const syncMeta = { owner: 'org-a:user-1', revisions: {}, queue: [{ client_id: 'op-1' }], conflicts: {} };

test('CI exige IndexedDB habilitado para não aceitar testes ignorados', () => {
  if (process.env.DURABLE_STORE_REQUIRE_INDEXEDDB === '1') {
    assert.ok(globalThis.indexedDB && typeof globalThis.indexedDB.open === 'function',
      'fake-indexeddb deveria estar carregado neste job.');
  }
});

test('grava e recupera estado completo junto com a fila', async () => {
  const adapter = memoryAdapter();
  const store = create(adapter);
  const revision = await store.save('org-a:user-1', state, syncMeta);
  const restored = await store.load('org-a:user-1');
  assert.equal(revision, 1);
  assert.deepEqual(restored.state, state);
  assert.deepEqual(restored.syncMeta, syncMeta);
  assert.equal(restored.revision, 1);
});

test('serializa gravações concorrentes e mantém revisão crescente', async () => {
  const adapter = memoryAdapter();
  const store = create(adapter);
  const results = await Promise.all([
    store.save('org-a:user-1', { value: 1 }, syncMeta),
    store.save('org-a:user-1', { value: 2 }, syncMeta),
    store.save('org-a:user-1', { value: 3 }, syncMeta)
  ]);
  assert.deepEqual(results, [1, 2, 3]);
  assert.equal((await store.load('org-a:user-1')).state.value, 3);
});

test('isola snapshots entre empresas e usuários', async () => {
  const adapter = memoryAdapter();
  const store = create(adapter);
  await store.save('org-a:user-1', { company: 'a' }, syncMeta);
  await store.save('org-b:user-1', { company: 'b' }, { ...syncMeta, owner: 'org-b:user-1' });
  assert.equal((await store.load('org-a:user-1')).state.company, 'a');
  assert.equal((await store.load('org-b:user-1')).state.company, 'b');
  assert.equal(await store.load('org-c:user-1'), null);
});

test('rejeita identidade divergente e fila inválida sem gravar', async () => {
  const adapter = memoryAdapter();
  const store = create(adapter);
  await assert.rejects(
    async () => store.save('org-a:user-1', state, { ...syncMeta, owner: 'org-b:user-1' }),
    /outra identidade/
  );
  await assert.rejects(
    async () => store.save('org-a:user-1', state, { owner: 'org-a:user-1', revisions: {}, queue: {}, conflicts: {} }),
    /Fila de sincronização inválida/
  );
  assert.equal(adapter.records.size, 0);
});


test('exige proprietário explícito nos metadados', async () => {
  const adapter = memoryAdapter();
  const store = create(adapter);
  await assert.rejects(
    async () => store.save('org-a:user-1', state, { revisions: {}, queue: [], conflicts: {} }),
    /outra identidade/
  );
  assert.equal(adapter.records.size, 0);
});

test('rejeita metadados de sincronização incompletos ou com tipos inválidos', async () => {
  const adapter = memoryAdapter();
  const store = create(adapter);
  const invalidMetadata = [
    { ...syncMeta, revisions: [] },
    { ...syncMeta, revisions: null },
    { ...syncMeta, conflicts: [] },
    { ...syncMeta, conflicts: null }
  ];
  for (const metadata of invalidMetadata) {
    await assert.rejects(
      async () => store.save('org-a:user-1', state, metadata),
      /Revisões de sincronização inválidas|Conflitos de sincronização inválidos/
    );
  }
  assert.equal(adapter.records.size, 0);
});

test('aceita o formato real dos metadados da fila de sincronização do app', async () => {
  const adapter = memoryAdapter();
  const store = create(adapter);
  const owner = 'atacarejo-super-tudo:user-123';
  const appSyncMeta = {
    owner,
    revisions: { 'notes|note-1': 7 },
    queue: [{
      key: 'notes|note-1',
      module: 'notes',
      record_id: 'note-1',
      kind: 'notes',
      deleted: false,
      client_id: 'client-op-123',
      status: ''
    }],
    conflicts: {},
    lastSync: '2026-11-25T20:00:00.000Z'
  };
  assert.equal(await store.save(owner, { notes: [{ id: 'note-1', text: 'local' }] }, appSyncMeta), 1);
  const restored = await store.load(owner);
  assert.deepEqual(restored.syncMeta, appSyncMeta);
  assert.equal(restored.syncMeta.queue[0].client_id, 'client-op-123');
  assert.equal(restored.syncMeta.lastSync, appSyncMeta.lastSync);
});

test('mantém filas independentes quando o mesmo usuário alterna de empresa', async () => {
  const adapter = memoryAdapter();
  const store = create(adapter);
  const user = 'user-123';
  const ownerA = 'empresa-a:' + user;
  const ownerB = 'empresa-b:' + user;
  const queueA = { ...syncMeta, owner: ownerA, queue: [{ client_id: 'pending-a' }] };
  const queueB = { ...syncMeta, owner: ownerB, queue: [{ client_id: 'pending-b' }] };
  await store.save(ownerA, { company: 'A' }, queueA);
  await store.save(ownerB, { company: 'B' }, queueB);
  assert.deepEqual((await store.load(ownerA)).syncMeta.queue, queueA.queue);
  assert.deepEqual((await store.load(ownerB)).syncMeta.queue, queueB.queue);
  assert.equal((await store.load(ownerA)).state.company, 'A');
  assert.equal((await store.load(ownerB)).state.company, 'B');
});

test('leitura aguarda gravação pendente na mesma instância', async () => {
  let release;
  const adapter = {
    record: null,
    read: async () => adapter.record,
    commit: record => new Promise(resolve => {
      release = () => {
        adapter.record = structuredClone({ ...record, revision: 1 });
        resolve(1);
      };
    })
  };
  const store = create(adapter);
  const saving = store.save('org-a:user-1', state, syncMeta);
  const loading = store.load('org-a:user-1');
  while (!release) await Promise.resolve();
  release();
  await saving;
  const restored = await loading;
  assert.deepEqual(restored.state, state);
  assert.equal(restored.revision, 1);
});



test('serializa leitura iniciada antes de gravações imediatas', async () => {
  let releaseFirstRead;
  let reads = 0;
  let record = null;
  const adapter = {
    read: async () => {
      reads += 1;
      if (reads === 1) {
        return new Promise(resolve => { releaseFirstRead = () => resolve(record); });
      }
      return record;
    },
    commit: async (next, expectedRevision) => {
      const current = Number(record && record.revision) || 0;
      if (current !== expectedRevision) throw new Error('Snapshot alterado em outra aba.');
      record = structuredClone({ ...next, revision: current + 1 });
      return current + 1;
    }
  };
  const store = create(adapter);
  const loading = store.load('org-a:user-1');
  const firstSave = store.save('org-a:user-1', { value: 1 }, syncMeta);
  await Promise.resolve();
  assert.equal(reads, 1);
  releaseFirstRead();
  assert.equal(await loading, null);
  assert.equal(await firstSave, 1);
  assert.equal(await store.save('org-a:user-1', { value: 2 }, syncMeta), 2);
});

test('impede que uma aba sobrescreva snapshot mais recente de outra', async () => {
  const adapter = memoryAdapter();
  const tabA = create(adapter);
  const tabB = create(adapter);
  await tabA.save('org-a:user-1', { value: 'versão A' }, syncMeta);
  await tabB.load('org-a:user-1');
  await tabA.save('org-a:user-1', { value: 'versão A2' }, syncMeta);
  await assert.rejects(
    tabB.save('org-a:user-1', { value: 'versão antiga B' }, syncMeta),
    /outra aba/
  );
  assert.equal((await tabA.load('org-a:user-1')).state.value, 'versão A2');
});

test('falha de gravação não envenena a fila de gravações seguintes', async () => {
  let fail = true;
  const adapter = {
    read: async () => null,
    commit: async (record, expectedRevision) => {
      if (fail) { fail = false; throw new Error('quota'); }
      return expectedRevision + 1;
    }
  };
  const store = create(adapter);
  await assert.rejects(store.save('org-a:user-1', state, syncMeta), /quota/);
  assert.equal(await store.save('org-a:user-1', state, syncMeta), 1);
});

test('preserva snapshot incompatível sem substituí-lo durante a leitura', async () => {
  const adapter = memoryAdapter();
  const original = { format: 99, owner: 'org-a:user-1', revision: 7, payload: 'preservar' };
  adapter.records.set('org-a:user-1', structuredClone(original));
  const store = create(adapter);
  await assert.rejects(
    store.load('org-a:user-1'),
    /incompatível ou corrompido/
  );
  assert.deepEqual(adapter.records.get('org-a:user-1'), original);
});

test('não sobrescreve snapshot existente com identidade interna divergente', async () => {
  const adapter = memoryAdapter();
  const original = {
    format: 1,
    owner: 'org-a:user-1',
    revision: 4,
    state: { protected: true },
    syncMeta: { owner: 'org-b:user-1', queue: [] }
  };
  adapter.records.set('org-a:user-1', structuredClone(original));
  const store = create(adapter);
  await assert.rejects(
    store.save('org-a:user-1', state, syncMeta),
    /outra identidade/
  );
  assert.deepEqual(adapter.records.get('org-a:user-1'), original);
});

test('rejeita revisão inválida e preserva o snapshot original', async () => {
  const adapter = memoryAdapter();
  const original = {
    format: 1,
    owner: 'org-a:user-1',
    revision: -3,
    state: { protected: true },
    syncMeta
  };
  adapter.records.set('org-a:user-1', structuredClone(original));
  const store = create(adapter);
  await assert.rejects(
    store.load('org-a:user-1'),
    /incompatível ou corrompido/
  );
  await assert.rejects(
    store.save('org-a:user-1', state, syncMeta),
    /incompatível ou corrompido/
  );
  assert.deepEqual(adapter.records.get('org-a:user-1'), original);
});

test('isola os dados salvos e restaurados de mutações externas', async () => {
  const adapter = memoryAdapter();
  const store = create(adapter);
  const input = { nested: { value: 'original' } };
  const pending = store.save('org-a:user-1', input, syncMeta);
  input.nested.value = 'alterado depois da chamada';
  await pending;
  const restored = await store.load('org-a:user-1');
  assert.equal(restored.state.nested.value, 'original');
  restored.state.nested.value = 'mutação na cópia restaurada';
  const again = await store.load('org-a:user-1');
  assert.equal(again.state.nested.value, 'original');
});

test('adaptador IndexedDB valida revisão e snapshot atual antes do compare-and-set', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('./durable-store.js', import.meta.url), 'utf8');
  const commitBody = source.slice(source.indexOf('function commit(record, expectedRevision)'));
  assert.match(commitBody, /Number\.isSafeInteger\(expectedRevision\)/);
  assert.match(commitBody, /validateRecord\(current, record\.owner\)/);
  assert.ok(commitBody.indexOf('validateRecord(current, record.owner)') < commitBody.indexOf('currentRevision !== expectedRevision'));
});


test('IndexedDB serializa primeiras gravações concorrentes e permite recuperação após reload', async t => {
  if (!globalThis.indexedDB || typeof globalThis.indexedDB.open !== 'function') {
    t.skip('IndexedDB não está disponível neste runtime.');
    return;
  }
  const owner = 'ci-race:' + process.pid + ':' + Date.now() + ':' + Math.random().toString(36).slice(2);
  const adapterA = require('./durable-store.js').createIndexedDbAdapter(globalThis.indexedDB);
  const adapterB = require('./durable-store.js').createIndexedDbAdapter(globalThis.indexedDB);
  const storeA = create(adapterA);
  const storeB = create(adapterB);
  const outcomes = await Promise.allSettled([
    storeA.save(owner, { winner: 'A' }, { ...syncMeta, owner }),
    storeB.save(owner, { winner: 'B' }, { ...syncMeta, owner })
  ]);
  assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter(result => result.status === 'rejected').length, 1);
  const winner = await storeA.load(owner);
  assert.ok(['A', 'B'].includes(winner.state.winner));
  const staleStore = outcomes[0].status === 'rejected' ? storeA : storeB;
  await staleStore.load(owner);
  await staleStore.save(owner, { winner: 'recovered' }, { ...syncMeta, owner });
  assert.equal((await staleStore.load(owner)).state.winner, 'recovered');
});

test('IndexedDB real persiste snapshot e bloqueia gravação obsoleta entre instâncias', async t => {
  if (!globalThis.indexedDB || typeof globalThis.indexedDB.open !== 'function') {
    t.skip('IndexedDB nativo indisponível neste runtime.');
    return;
  }
  const owner = 'ci-indexeddb:' + process.pid + ':' + Date.now() + ':' + Math.random().toString(36).slice(2);
  const adapterA = require('./durable-store.js').createIndexedDbAdapter(globalThis.indexedDB);
  const adapterB = require('./durable-store.js').createIndexedDbAdapter(globalThis.indexedDB);
  const storeA = create(adapterA);
  const storeB = create(adapterB);
  const firstState = { notes: [{ id: 'idb-1', text: 'persistido' }] };
  await storeA.save(owner, firstState, { ...syncMeta, owner });
  const stale = await storeB.load(owner);
  assert.deepEqual(stale.state, firstState);
  await storeA.save(owner, { notes: [{ id: 'idb-1', text: 'versão nova' }] }, { ...syncMeta, owner });
  await assert.rejects(
    storeB.save(owner, { notes: [{ id: 'idb-1', text: 'versão obsoleta' }] }, { ...syncMeta, owner }),
    /outra aba/
  );
  const latest = await storeA.load(owner);
  assert.equal(latest.state.notes[0].text, 'versão nova');
});



test('IndexedDB aborta transação sem deixar snapshot parcial e permite nova gravação', async t => {
  if (!globalThis.indexedDB || !globalThis.IDBObjectStore) {
    t.skip('IndexedDB não está disponível neste runtime.');
    return;
  }
  const owner = 'ci-abort:' + process.pid + ':' + Date.now() + ':' + Math.random().toString(36).slice(2);
  const adapter = require('./durable-store.js').createIndexedDbAdapter(globalThis.indexedDB);
  const store = create(adapter);
  const prototype = globalThis.IDBObjectStore.prototype;
  const originalPut = prototype.put;
  let abortNextWrite = true;
  prototype.put = function (...args) {
    if (abortNextWrite && this.transaction && this.transaction.mode === 'readwrite') {
      abortNextWrite = false;
      this.transaction.abort();
      return undefined;
    }
    return originalPut.apply(this, args);
  };
  try {
    await assert.rejects(
      store.save(owner, { partial: true }, { ...syncMeta, owner }),
      /cancelada|AbortError|aborted/i
    );
  } finally {
    prototype.put = originalPut;
  }
  assert.equal(await adapter.read(owner), null);
  assert.equal(await store.save(owner, { recovered: true }, { ...syncMeta, owner }), 1);
  assert.deepEqual((await store.load(owner)).state, { recovered: true });
});

test('IndexedDB preserva registro corrompido e bloqueia leitura e gravação', async t => {
  if (!globalThis.indexedDB || typeof globalThis.indexedDB.open !== 'function') {
    t.skip('IndexedDB não está disponível neste runtime.');
    return;
  }
  const owner = 'ci-corrupt:' + process.pid + ':' + Date.now() + ':' + Math.random().toString(36).slice(2);
  const adapter = require('./durable-store.js').createIndexedDbAdapter(globalThis.indexedDB);
  await adapter.read(owner);
  const db = await new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open('st-app-durable-v1', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const original = { format: 99, owner, revision: 4, payload: 'preservar' };
  await new Promise((resolve, reject) => {
    const tx = db.transaction('snapshots', 'readwrite');
    tx.objectStore('snapshots').put(original);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('seed abortado'));
  });
  db.close();
  const store = create(adapter);
  await assert.rejects(store.load(owner), /incompatível ou corrompido/);
  await assert.rejects(
    store.save(owner, { safe: true }, { ...syncMeta, owner }),
    /incompatível ou corrompido/
  );
  assert.deepEqual(await adapter.read(owner), original);
});

test('falha de leitura inicial não envenena operações seguintes', async () => {
  let failRead = true;
  const records = new Map();
  const adapter = {
    read: async owner => {
      if (failRead) {
        failRead = false;
        throw new Error('falha temporária de leitura');
      }
      return records.get(owner) || null;
    },
    commit: async (record, expectedRevision) => {
      const current = records.get(record.owner);
      const revision = current ? current.revision : 0;
      if (revision !== expectedRevision) throw new Error('Snapshot alterado em outra aba.');
      records.set(record.owner, structuredClone({ ...record, revision: revision + 1 }));
      return revision + 1;
    }
  };
  const store = create(adapter);
  await assert.rejects(
    store.save('org-a:user-1', state, syncMeta),
    /falha temporária de leitura/
  );
  assert.equal(await store.save('org-a:user-1', state, syncMeta), 1);
  assert.equal((await store.load('org-a:user-1')).revision, 1);
});

test('falha de load não bloqueia leitura ou gravação posterior', async () => {
  let failRead = true;
  const records = new Map();
  const adapter = {
    read: async owner => {
      if (failRead) {
        failRead = false;
        throw new Error('leitura interrompida');
      }
      return records.get(owner) || null;
    },
    commit: async (record, expectedRevision) => {
      const revision = records.get(record.owner)?.revision || 0;
      if (revision !== expectedRevision) throw new Error('Snapshot alterado em outra aba.');
      records.set(record.owner, structuredClone({ ...record, revision: revision + 1 }));
      return revision + 1;
    }
  };
  const store = create(adapter);
  await assert.rejects(store.load('org-a:user-1'), /leitura interrompida/);
  assert.equal(await store.save('org-a:user-1', state, syncMeta), 1);
  assert.equal((await store.load('org-a:user-1')).revision, 1);
});

test('IndexedDB fecha conexão antiga quando outra aba solicita upgrade de versão', async t => {
  if (!globalThis.indexedDB || typeof globalThis.indexedDB.open !== 'function') {
    t.skip('IndexedDB não está disponível neste runtime.');
    return;
  }
  const adapter = require('./durable-store.js').createIndexedDbAdapter(globalThis.indexedDB);
  await adapter.read('ci-versionchange:' + process.pid);
  const upgrade = await new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open('st-app-durable-v1', 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('versionchange-probe')) {
        request.result.createObjectStore('versionchange-probe');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Upgrade ficou bloqueado inesperadamente.'));
  });
  upgrade.close();
  await assert.rejects(
    adapter.read('ci-versionchange:' + process.pid),
    error => error && (error.name === 'VersionError' || /version/i.test(error.message))
  );
});
