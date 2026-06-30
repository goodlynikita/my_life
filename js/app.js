/* ============================================================
   APP ENTRY POINT
   Source-of-truth order: Firebase first (always, if configured),
   then the seeded data.json (only if Firebase is genuinely empty),
   and finally whatever is cached in this browser's localStorage —
   used only when neither of the above is reachable (offline).
   ============================================================ */

function waitForFirebaseSync(maxWaitMs) {
  /* firebase-sync.js загружается как ES-модуль (type="module"), который
     по спецификации откладывается до DOMContentLoaded — теоретически
     это гарантирует готовность window.FirebaseSync к этому моменту.
     На практике в некоторых браузерах/условиях сети это поведение может
     отличаться, поэтому на всякий случай дожидаемся явно, с коротким
     лимитом, чтобы не зависнуть навсегда, если модуль реально не грузится. */
  return new Promise((resolve) => {
    const start = Date.now();
    function check() {
      if (window.FirebaseSync) { resolve(true); return; }
      if (Date.now() - start > maxWaitMs) { resolve(false); return; }
      setTimeout(check, 30);
    }
    check();
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await waitForFirebaseSync(2000);
  const firebaseReady = window.FirebaseSync && FirebaseSync.isConfigured();

  if (firebaseReady) {
    const remoteResult = await FirebaseSync.pullIntoStore();
    // remoteResult === true  -> real data was found and loaded into Store
    // remoteResult === false -> Firebase node is genuinely empty (null)
    // remoteResult === 'error' -> network/config problem, Firebase unreachable
    if (remoteResult === false) {
      const seed = await Store.loadSeedFromRepo();
      Store.replaceAll(seed || Store.defaultData());
      await FirebaseSync.pushNow();
    } else if (remoteResult === 'error') {
      const cached = await Store.load();
      if (!cached) Store.replaceAll(Store.defaultData());
    }
  } else {
    const cached = await Store.load();
    if (!cached) {
      const seed = await Store.loadSeedFromRepo();
      Store.replaceAll(seed || Store.defaultData());
    }
  }

  Router.render();
});
