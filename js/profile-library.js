/*
 * Local profile snapshot library.
 *
 * MHTML captures can be far larger than localStorage's small text quota, and
 * their images need to be re-parsed into fresh blob URLs after a reload.
 * IndexedDB is designed for exactly that: it keeps the original file locally
 * while a small companion record holds the editor state for that snapshot.
 */
(function (global) {
  'use strict';

  var DB_NAME = 'jai-css-studio-profile-library';
  var DB_VERSION = 1;
  var META = 'snapshots';
  var FILES = 'files';

  function open() {
    return new Promise(function (resolve, reject) {
      if (!global.indexedDB) {
        reject(new Error('This browser does not support local profile storage.'));
        return;
      }
      var request = global.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = function () {
        var db = request.result;
        if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES, { keyPath: 'id' });
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error('Could not open local profile storage.')); };
    });
  }

  function list() {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        // Metadata and captures are one logical record. Older builds could
        // leave only the metadata behind, which produced a selectable profile
        // that could never open. Repair those records before the switcher sees
        // them, and collapse repeated imports of the same source file.
        var tx = db.transaction([META, FILES], 'readwrite');
        var metaStore = tx.objectStore(META);
        var fileStore = tx.objectStore(FILES);
        var metaRequest = metaStore.getAll();
        var fileRequest = fileStore.getAll();
        var records = null;
        var files = null;
        var cleaned = null;
        var removed = 0;

        function repair() {
          if (!records || !files || cleaned) return;
          var filesById = {};
          var metaById = {};
          files.forEach(function (record) { if (record && record.id) filesById[record.id] = record; });
          records.forEach(function (record) { if (record && record.id) metaById[record.id] = record; });

          // A file with no metadata is just as unusable as metadata with no
          // file. Clear both shapes so browser storage cannot slowly fill with
          // invisible leftovers.
          records = records.filter(function (record) {
            if (record && record.id && filesById[record.id] && filesById[record.id].file) return true;
            if (record && record.id) metaStore.delete(record.id);
            removed++;
            return false;
          });
          files.forEach(function (record) {
            if (!record || !record.id || metaById[record.id]) return;
            fileStore.delete(record.id);
            removed++;
          });

          // New records carry a file fingerprint. The filename+label fallback
          // repairs duplicates written before fingerprints were introduced.
          var seen = {};
          records.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
          cleaned = records.filter(function (record) {
            var key = record.sourceKey || ('legacy:' + (record.filename || '') + '|' + (record.label || ''));
            if (!key || key === 'legacy:|') return true;
            if (!seen[key]) { seen[key] = true; return true; }
            metaStore.delete(record.id);
            fileStore.delete(record.id);
            removed++;
            return false;
          });
        }

        metaRequest.onsuccess = function () { records = metaRequest.result || []; repair(); };
        fileRequest.onsuccess = function () { files = fileRequest.result || []; repair(); };
        metaRequest.onerror = fileRequest.onerror = function () {
          reject(metaRequest.error || fileRequest.error || new Error('Could not read saved profiles.'));
        };
        tx.oncomplete = function () {
          db.close();
          cleaned = cleaned || [];
          cleaned.removedCount = removed;
          resolve(cleaned);
        };
        tx.onerror = function () { reject(tx.error || new Error('Could not repair saved profiles.')); };
        tx.onabort = function () { reject(tx.error || new Error('Could not repair saved profiles.')); };
      });
    });
  }

  function put(meta, file) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction([META, FILES], 'readwrite');
        tx.objectStore(META).put(meta);
        tx.objectStore(FILES).put({ id: meta.id, file: file });
        tx.oncomplete = function () { db.close(); resolve(); };
        tx.onerror = function () { reject(tx.error || new Error('Could not save this profile locally.')); };
        tx.onabort = function () { reject(tx.error || new Error('Could not save this profile locally.')); };
      });
    });
  }

  function update(meta) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(META, 'readwrite');
        tx.objectStore(META).put(meta);
        tx.oncomplete = function () { db.close(); resolve(); };
        tx.onerror = function () { reject(tx.error || new Error('Could not update this saved profile.')); };
        tx.onabort = function () { reject(tx.error || new Error('Could not update this saved profile.')); };
      });
    });
  }

  function file(id) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(FILES, 'readonly');
        var request = tx.objectStore(FILES).get(id);
        request.onsuccess = function () {
          var record = request.result;
          if (!record || !record.file) reject(new Error('The saved profile file is missing.'));
          else resolve(record.file);
        };
        request.onerror = function () { reject(request.error || new Error('Could not read this saved profile.')); };
        tx.oncomplete = function () { db.close(); };
      });
    });
  }

  function remove(id) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction([META, FILES], 'readwrite');
        tx.objectStore(META).delete(id);
        tx.objectStore(FILES).delete(id);
        tx.oncomplete = function () { db.close(); resolve(); };
        tx.onerror = function () { reject(tx.error || new Error('Could not remove this saved profile.')); };
        tx.onabort = function () { reject(tx.error || new Error('Could not remove this saved profile.')); };
      });
    });
  }

  global.JaiProfileLibrary = { list: list, put: put, update: update, file: file, remove: remove };
})(window);
