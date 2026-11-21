/* Bootstrap and global modal wiring. */
(function () {
  const SL = window.SL;

  document.addEventListener("click", function (event) {
    const action = event.target.closest("[data-modal-action]");
    if (action) {
      event.preventDefault();
      const key = action.getAttribute("data-modal-action");
      if (SL.modalHandlers[key]) SL.modalHandlers[key](action, action.dataset);
      return;
    }
    if (event.target.closest("[data-modal-close]")) {
      event.preventDefault();
      SL.closeModal();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && document.getElementById("modal-root").classList.contains("is-active")) SL.closeModal();
  });

  window.addEventListener("resize", function () {
    const canvas = document.getElementById("wheel-canvas");
    if (canvas && SL.currentRoute && SL.currentRoute.path === "/spin" && SL.redrawWheel) SL.redrawWheel(canvas);
  });

  SL.startRouter();
})();
