// =====================================
// PRONTIO - widgets/widget-toast.js
// Sistema de mensagens genéricas (barras de mensagem)
// - Usa o padrão de classes:
//   .mensagem, .mensagem-info, .mensagem-sucesso,
//   .mensagem-erro, .mensagem-aviso
//
// MIGRAÇÃO:
//   Antes: assets/js/ui/messages.js (ES module)
//   Agora: assets/js/widgets/widget-toast.js (IIFE + PRONTIO namespace)
// =====================================

(function (global) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  const widgets = (PRONTIO.widgets = PRONTIO.widgets || {});

  // Tenta usar helpers de DOM do core/dom.js (se existirem)
  const dom = PRONTIO.dom || {};

  const qs =
    dom.qs ||
    function (selector, root) {
      return (root || document).querySelector(selector);
    };

  const domShow =
    dom.show ||
    function (el) {
      if (!el) return;
      // Se você já usa .is-hidden no CSS, pode descomentar a linha abaixo:
      // el.classList.remove('is-hidden');
      el.style.display = "";
    };

  const domHide =
    dom.hide ||
    function (el) {
      if (!el) return;
      // el.classList.add('is-hidden');
      el.style.display = "none";
    };

  const CLASS_BASE = "mensagem";
  const CLASS_TYPES = {
    info: "mensagem-info",
    sucesso: "mensagem-sucesso",
    erro: "mensagem-erro",
    aviso: "mensagem-aviso",
  };

  // ------------------------------------------------------------
  // FUNÇÕES PRINCIPAIS
  // ------------------------------------------------------------

  /**
   * Exibe uma mensagem em um elemento.
   *
   * @param {Object} options
   * @param {string|HTMLElement} options.target - seletor CSS ou elemento da mensagem
   * @param {string} options.text                - texto da mensagem
   * @param {"info"|"sucesso"|"erro"|"aviso"} [options.type="info"]
   * @param {boolean} [options.autoHide=false]   - se true, esconde depois de ms
   * @param {number} [options.autoHideDelay=4000]
   */
  function show(options) {
    const {
      target,
      text,
      type = "info",
      autoHide = false,
      autoHideDelay = 4000,
    } = options || {};

    if (!target) {
      console.warn("PRONTIO.widgets.toast.show: 'target' é obrigatório.");
      return;
    }

    const el = target instanceof HTMLElement ? target : qs(String(target));

    if (!el) {
      console.warn(
        "PRONTIO.widgets.toast.show: elemento não encontrado:",
        target
      );
      return;
    }

    // Texto
    el.textContent = text || "";

    // Classes
    el.className = CLASS_BASE; // reset total
    const typeClass = CLASS_TYPES[type] || CLASS_TYPES.info;
    el.classList.add(typeClass);

    domShow(el);

    // Auto hide
    if (autoHide) {
      global.setTimeout(function () {
        hide(el);
      }, autoHideDelay);
    }
  }

  /**
   * Esconde uma mensagem.
   * @param {string|HTMLElement} target
   */
  function hide(target) {
    if (!target) return;

    const el = target instanceof HTMLElement ? target : qs(String(target));
    if (!el) return;

    domHide(el);
  }

  /**
   * Cria um atalho para mensagens de uma página específica:
   *    const msg = createPageMessages('#mensagemAgenda')
   *    msg.info('Carregando...')
   */
  function createPageMessages(targetIdOrSelector) {
    const target =
      typeof targetIdOrSelector === "string"
        ? targetIdOrSelector
        : "#mensagem";

    return {
      info(text, opts) {
        show({ target, text, type: "info", ...(opts || {}) });
      },
      sucesso(text, opts) {
        show({ target, text, type: "sucesso", ...(opts || {}) });
      },
      erro(text, opts) {
        show({ target, text, type: "erro", ...(opts || {}) });
      },
      aviso(text, opts) {
        show({ target, text, type: "aviso", ...(opts || {}) });
      },
      clear() {
        hide(target);
      },
    };
  }

  // ------------------------------------------------------------
  // EXPOSIÇÃO NO NAMESPACE PRONTIO
  // ------------------------------------------------------------

  widgets.toast = {
    show,
    hide,
    createPageMessages,
    // aliases convenientes
    showMessage: show,
    hideMessage: hide,
    page: createPageMessages,
  };

  // ------------------------------------------------------------
  // RETROCOMPAT — mantém PRONTIO.ui.messages funcionando
  // ------------------------------------------------------------
  try {
    PRONTIO.ui = PRONTIO.ui || {};
    PRONTIO.ui.messages = {
      show: show,
      hide: hide,
      page: createPageMessages,
    };
  } catch (e) {
    // ambiente sem window / PRONTIO.ui não disponível
  }
})(window);
