// =====================================
// PRONTIO - ui/modals.js
// Helpers genéricos para modais no PRONTIO
//
// - Usa os helpers de DOM de core/dom.js (qs, show, hide)
// - Não cria HTML, só controla o DOM existente
// - Padrão de markup (exemplo):
//     <div id="modalExemplo" class="modal-overlay hidden">...</div>
//
// Suporte extra:
// - Bind automático de botões com data-attributes:
//    * [data-modal-open="idOuSeletor"]  → abre modal
//    * [data-modal-close="idOuSeletor"] → fecha modal
//
// OBS: pura lógica de UI. Nada de regra de negócio aqui.
// =====================================

(function (global, document) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.ui = PRONTIO.ui || {};
  PRONTIO.core = PRONTIO.core || {};
  PRONTIO.core.dom = PRONTIO.core.dom || {};

  const dom = PRONTIO.core.dom;

  // Fallbacks caso algo não esteja definido
  const qs =
    typeof dom.qs === "function"
      ? dom.qs
      : function (selector, scope) {
          return (scope || document).querySelector(selector);
        };

  const show =
    typeof dom.show === "function"
      ? dom.show
      : function (el) {
          if (!el) return;
          el.style.display = "";
          el.classList.remove("hidden", "is-hidden");
        };

  const hide =
    typeof dom.hide === "function"
      ? dom.hide
      : function (el) {
          if (!el) return;
          el.style.display = "none";
          el.classList.add("hidden", "is-hidden");
        };

  // -----------------------------------------
  // Funções internas
  // -----------------------------------------

  /**
   * Retorna o elemento de modal a partir de id, seletor ou HTMLElement.
   * Aceita:
   *  - HTMLElement
   *  - "#id", ".classe", "seletor complexo"
   *  - "idSimples" (vira "#idSimples")
   *
   * @param {string|HTMLElement} modalIdOrEl
   * @returns {HTMLElement|null}
   */
  function getModalElement(modalIdOrEl) {
    if (!modalIdOrEl) return null;

    if (modalIdOrEl instanceof HTMLElement) return modalIdOrEl;

    if (typeof modalIdOrEl === "string") {
      const selector =
        modalIdOrEl.startsWith("#") || modalIdOrEl.startsWith(".")
          ? modalIdOrEl
          : "#" + modalIdOrEl;
      return qs(selector);
    }

    return null;
  }

  /**
   * Abre um modal.
   * @param {string|HTMLElement} modalIdOrEl - id (sem #), seletor ou elemento
   */
  function openInternal(modalIdOrEl) {
    const el = getModalElement(modalIdOrEl);
    if (!el) return;
    show(el);
    // Futuro: foco inicial, trap de foco, ESC etc.
  }

  /**
   * Fecha um modal.
   * @param {string|HTMLElement} modalIdOrEl
   */
  function closeInternal(modalIdOrEl) {
    const el = getModalElement(modalIdOrEl);
    if (!el) return;
    hide(el);
  }

  /**
   * Ativa fechamento ao clicar no "backdrop" (overlay).
   * Exige que a marcação siga o padrão:
   *   <div id="modalExemplo" class="modal-overlay hidden"> ... </div>
   *
   * @param {string} modalSelector - seletor do modal overlay
   */
  function bindCloseOnBackdropInternal(modalSelector) {
    const modal = qs(modalSelector);
    if (!modal) return;

    modal.addEventListener("click", function (event) {
      if (event.target === modal) {
        closeInternal(modal);
      }
    });
  }

  /**
   * Liga um botão interno para fechar o modal.
   * @param {string} modalSelector
   * @param {string} buttonSelector
   */
  function bindCloseButtonInternal(modalSelector, buttonSelector) {
    const modal = qs(modalSelector);
    const btn = qs(buttonSelector);
    if (!modal || !btn) return;

    btn.addEventListener("click", function () {
      closeInternal(modal);
    });
  }

  /**
   * Bind automático usando data-attributes:
   *   data-modal-open
   *   data-modal-close
   *
   * @param {Document|HTMLElement} [root=document]
   */
  function bindModalTriggersInternal(root) {
    if (!root || !(root instanceof HTMLElement || root instanceof Document)) {
      return;
    }

    // Abrir modais
    const openButtons = root.querySelectorAll("[data-modal-open]");
    openButtons.forEach(function (btn) {
      const attrValue = btn.getAttribute("data-modal-open");
      let target = attrValue && attrValue.trim();
      if (!target) {
        const href = btn.getAttribute("href");
        if (href && href.startsWith("#")) target = href;
      }
      if (!target) return;

      btn.addEventListener("click", function (event) {
        event.preventDefault();
        openInternal(target);
      });
    });

    // Fechar modais
    const closeButtons = root.querySelectorAll("[data-modal-close]");
    closeButtons.forEach(function (btn) {
      const attrValue = btn.getAttribute("data-modal-close");
      let target = attrValue && attrValue.trim();
      if (!target) {
        const href = btn.getAttribute("href");
        if (href && href.startsWith("#")) target = href;
      }
      if (!target) return;

      btn.addEventListener("click", function (event) {
        event.preventDefault();
        closeInternal(target);
      });
    });
  }

  // -----------------------------------------
  // API pública (namespace PRONTIO.ui.modals)
  // -----------------------------------------

  PRONTIO.ui.modals = {
    open: openInternal,
    close: closeInternal,
    bindCloseOnBackdrop: bindCloseOnBackdropInternal,
    bindCloseButton: bindCloseButtonInternal,
    bindTriggers: bindModalTriggersInternal
  };
})(window, document);
