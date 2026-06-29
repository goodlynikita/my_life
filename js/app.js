/* ============================================================
   APP ENTRY POINT
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  await Store.load();
  if (window.FirebaseSync && FirebaseSync.isConfigured()) {
    await FirebaseSync.pullIntoStore();
  }
  Router.render();
});
