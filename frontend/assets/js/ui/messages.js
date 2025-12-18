// =====================================
// PRONTIO - ui/messages.js
// Sistema simples de mensagens por página
//
// Uso típico na página:
//   const msgs = PRONTIO.ui.createPageMessages('#mensagem');
//   msgs.info('Carregando...');
//   msgs.sucesso('Salvo com sucesso');
//   msgs.erro('Erro ao salvar');
//   msgs.clear();
// =====================================

(function (global, document) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.ui = PRONTIO.ui || {};

  function createPageMessages(selectorOrElement) {
    let el = null;

    if (typeof selectorOrElement === 'string') {
      el = document.querySelector(selectorOrElement);
    } else if (
      selectorOrElement &&
      typeof selectorOrElement === 'object' &&
      selectorOrElement.nodeType === 1
    ) {
      el = selectorOrElement;
    }

    if (!el) {
      console.warn('[PRONTIO.ui.messages] Elemento não encontrado para mensagens:', selectorOrElement);
      return {
        info: () => {},
        sucesso: () => {},
        erro: () => {},
        clear: () => {}
      };
    }

    function clear() {
      el.textContent = '';
      el.style.display = 'none';
      el.classList.remove('msg-info', 'msg-sucesso', 'msg-erro');
    }

    function show(texto, tipo) {
      if (!texto) {
        clear();
        return;
      }

      el.textContent = texto;
      el.style.display = 'block';

      el.classList.remove('msg-info', 'msg-sucesso', 'msg-erro');
      if (tipo === 'erro') el.classList.add('msg-erro');
      else if (tipo === 'sucesso') el.classList.add('msg-sucesso');
      else el.classList.add('msg-info');
    }

    return {
      info: (t) => show(t, 'info'),
      sucesso: (t) => show(t, 'sucesso'),
      erro: (t) => show(t, 'erro'),
      clear
    };
  }

  PRONTIO.ui.createPageMessages = createPageMessages;
})(window, document);
