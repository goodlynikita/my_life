/* ============================================================
   APP ENTRY POINT
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  Store.load();
  if (window.GithubSync && GithubSync.isConfigured()) {
    await GithubSync.pullIntoStore();
  }
  Router.render();
});
