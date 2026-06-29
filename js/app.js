/* ============================================================
   APP ENTRY POINT
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  await Store.load();
  if (window.FirebaseSync && FirebaseSync.isConfigured()) {
    const hadRemoteData = await FirebaseSync.pullIntoStore();
    if (!hadRemoteData) {
      // Firebase is empty (first device to ever connect) — push what we
      // have locally (or the seeded data.json) so every other device
      // that connects afterwards sees the same real data immediately.
      await FirebaseSync.pushNow();
    }
  }
  Router.render();
});
