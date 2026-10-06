document.addEventListener('DOMContentLoaded', function () {
  loadStore();
  bindUiEvents();
  updateDate();
  checkResponsive();
  applyCustomizations();

  if (AppState.currentUser) {
    enterApp();
  }
});
