/* Firebase 10.12 restores a saved session only after an account lookup/refresh.
   A hanging request can delay onAuthStateChanged for a minute on mobile.
   Let the SDK take its own network-error/offline path for a verified local account.
   This never creates an auth user or enables data writes before FirebaseSync merges. */
(function () {
  if (!window.fetch || typeof AbortController === 'undefined') return;
  var original = window.fetch, cached;
  function validAccount(user) {
    try {
      return user && user.uid && user.apiKey === window.FIREBASE_CONFIG.apiKey && !/@coach\.you-app$/i.test(user.email || '') && typeof Store !== 'undefined' && Store.hasLocalBackup(user.uid) ? user : null;
    } catch (e) { return null; }
  }
  function account() {
    if (cached) return cached;
    cached = new Promise(function (resolve) {
      var key = 'firebase:authUser:' + (window.FIREBASE_CONFIG || {}).apiKey + ':[DEFAULT]', db, done = false;
      function finish(value) {
        if (done) return;
        done = true; clearTimeout(timer);
        if (db) db.close();
        var user = validAccount(value);
        if (!user) try { user = validAccount(JSON.parse(localStorage.getItem(key) || 'null')); } catch (e) {}
        resolve(user);
      }
      var timer = setTimeout(function () { finish(null); }, 100);
      try {
        if (!window.indexedDB) { finish(JSON.parse(localStorage.getItem(key) || 'null')); return; }
        var request = indexedDB.open('firebaseLocalStorageDb');
        request.onupgradeneeded = function () { request.transaction.abort(); };
        request.onerror = function () { try { finish(JSON.parse(localStorage.getItem(key) || 'null')); } catch (e) { finish(null); } };
        request.onblocked = function () { finish(null); };
        request.onsuccess = function () {
          db = request.result;
          if (done) { db.close(); return; }
          if (!db.objectStoreNames.contains('firebaseLocalStorage')) { finish(null); return; }
          var read = db.transaction('firebaseLocalStorage', 'readonly').objectStore('firebaseLocalStorage').get(key);
          read.onsuccess = function () { var value = read.result && read.result.value; finish(value); };
          read.onerror = function () { finish(null); };
        };
      } catch (e) { try { finish(JSON.parse(localStorage.getItem(key) || 'null')); } catch (e) { finish(null); } }
    });
    return cached;
  }
  function sameRequest(url, body, user) {
    if (!user) return false;
    try {
      if (url.hostname === 'securetoken.googleapis.com') {
        var params = new URLSearchParams(body), token = (user.stsTokenManager || {}).refreshToken;
        return !!token && params.get('grant_type') === 'refresh_token' && params.get('refresh_token') === token;
      }
      var token = JSON.parse(body).idToken, payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      var claims = JSON.parse(atob(payload));
      return claims.sub === user.uid && claims.aud === window.FIREBASE_CONFIG.projectId;
    } catch (e) { return false; }
  }
  window.fetch = async function (input, options) {
    var self = this, url;
    try { url = new URL(typeof input === 'string' ? input : input.url); } catch (e) {}
    var authRead = url && url.protocol === 'https:' && ((url.hostname === 'identitytoolkit.googleapis.com' && url.pathname === '/v1/accounts:lookup') || (url.hostname === 'securetoken.googleapis.com' && url.pathname === '/v1/token'));
    if (window._appReady || !authRead || !options || typeof options.body !== 'string' || url.searchParams.get('key') !== (window.FIREBASE_CONFIG || {}).apiKey) return original.call(self, input, options);
    var user = await account();
    if (!sameRequest(url, options.body, user)) return original.call(self, input, options);
    var controller = new AbortController(), signal = options.signal || (input && input.signal);
    function abort() { controller.abort(); }
    if (signal) { if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true }); }
    var timer = setTimeout(abort, 1000);
    try { return await original.call(self, input, Object.assign({}, options, { signal: controller.signal })); }
    finally { clearTimeout(timer); if (signal) signal.removeEventListener('abort', abort); }
  };
})();
