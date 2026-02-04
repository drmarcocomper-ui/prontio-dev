(function (global, document) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.features = PRONTIO.features || {};
  PRONTIO.features.prontuario = PRONTIO.features.prontuario || {};

  function qs(sel) { return document.querySelector(sel); }
  function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }

  function parseDataHora(raw) {
    if (!raw) return null;
    let d = new Date(raw);
    if (!isNaN(d.getTime())) return d;
    d = new Date(String(raw).replace(" ", "T"));
    return isNaN(d.getTime()) ? null : d;
  }

  function formatIsoDateToBR_(iso) {
    if (!iso) return "";
    const partes = String(iso).split("-");
    if (partes.length !== 3) return "";
    const [ano, mes, dia] = partes;
    if (!ano || !mes || !dia) return "";
    return `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${ano}`;
  }

  function formatTipoReceitaLabel_(raw) {
    const s = String(raw || "").trim();
    if (!s) return "Comum";
    const up = s.toUpperCase();
    if (up === "COMUM") return "Comum";
    if (up === "ESPECIAL") return "Especial";
    if (s === "Comum" || s === "Especial") return s;
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }

  function setBtnMais_(btn, hasMore, loading) {
    if (!btn) return;
    btn.style.display = hasMore ? "inline-flex" : "none";
    btn.disabled = !!loading;
  }

  function escapeHtml_(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function trapFocusInPanel_(panelAside, e) {
    if (!panelAside) return;
    if (e.key !== "Tab") return;

    const focusables = panelAside.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const list = Array.from(focusables).filter((el) => el.offsetParent !== null);
    if (!list.length) return;

    const first = list[0];
    const last = list[list.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  // ✅ P2: Função genérica para ordenar lista por data (decrescente)
  function sortByDateDesc_(lista, dateFields) {
    const fields = dateFields || ["dataHoraRegistro", "dataHoraCriacao", "dataHora", "data", "criadoEm"];
    return (lista || []).slice().sort((a, b) => {
      let da = null, db = null;
      for (const f of fields) {
        if (!da && a[f]) da = parseDataHora(a[f]);
        if (!db && b[f]) db = parseDataHora(b[f]);
      }
      da = da || new Date(0);
      db = db || new Date(0);
      return db - da;
    });
  }

  // ✅ P2: Função genérica para exibir mensagens de erro/sucesso
  function setMensagem_(selector, obj) {
    const el = qs(selector);
    if (!el) return;
    el.classList.remove("is-hidden", "msg-erro", "msg-sucesso");
    el.textContent = (obj && obj.texto) || "";
    if (obj && obj.tipo === "erro") el.classList.add("msg-erro");
    if (obj && obj.tipo === "sucesso") el.classList.add("msg-sucesso");
  }

  // ✅ P2: Formatar data completa (dd/mm/yyyy HH:mm)
  function formatDataHoraCompleta_(raw) {
    const dt = parseDataHora(raw);
    if (!dt || !dt.getTime()) return "";
    const dia = String(dt.getDate()).padStart(2, "0");
    const mes = String(dt.getMonth() + 1).padStart(2, "0");
    const ano = dt.getFullYear();
    const hora = String(dt.getHours()).padStart(2, "0");
    const min = String(dt.getMinutes()).padStart(2, "0");
    return `${dia}/${mes}/${ano} ${hora}:${min}`;
  }

  // ✅ P2: Factory para criar estado de paginação
  function createPagingState_() {
    return {
      btnMais: null,
      cursor: null,
      hasMore: false,
      loading: false,
      lista: [],
      lastLimit: 10,
    };
  }

  PRONTIO.features.prontuario.utils = {
    qs,
    qsa,
    parseDataHora,
    formatIsoDateToBR_,
    formatTipoReceitaLabel_,
    setBtnMais_,
    escapeHtml_,
    trapFocusInPanel_,
    sortByDateDesc_,
    setMensagem_,
    formatDataHoraCompleta_,
    createPagingState_,
  };
})(window, document);
