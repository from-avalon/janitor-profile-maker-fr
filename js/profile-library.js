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
        var tx = db.transaction(META, 'readonly');
        var request = tx.objectStore(META).getAll();
        request.onsuccess = function () { resolve(request.result || []); };
        request.onerror = function () { reject(request.error || new Error('Could not read saved profiles.')); };
        tx.oncomplete = function () { db.close(); };
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
