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

  PRONTIO.features.prontuario.utils = {
    qs,
    qsa,
    parseDataHora,
    formatIsoDateToBR_,
    formatTipoReceitaLabel_,
    setBtnMais_,
    escapeHtml_,
    trapFocusInPanel_,
  };
})(window, document);
