// =====================================
// PRONTIO - core/utils.js
// Utilidades genéricas do PRONTIO:
// - Datas
// - Horas
// - Formatações simples
//
// Convenções:
//   PRONTIO.core.utils.hojeISO()
//   PRONTIO.core.utils.formatarDataBR("2025-12-07")
//   PRONTIO.core.utils.formatarHora("14:32:10")
//
// Não usa mais ES Modules.
// =====================================

(function (global) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  const core = (PRONTIO.core = PRONTIO.core || {});
  const utils = (core.utils = core.utils || {});

  // -----------------------------------------
  // Funções internas
  // -----------------------------------------

  function hojeISOInternal() {
    const hoje = new Date();
    const yyyy = hoje.getFullYear();
    const mm = String(hoje.getMonth() + 1).padStart(2, "0");
    const dd = String(hoje.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function formatarDataBRInternal(iso) {
    if (!iso) return "";
    const [yyyy, mm, dd] = iso.split("-");
    if (!yyyy || !mm || !dd) return iso;
    return `${dd}/${mm}/${yyyy}`;
  }

  function formatarHoraInternal(hora) {
    // espera "HH:MM" ou "HH:MM:SS"
    if (!hora) return "";
    const partes = hora.split(":");
    if (partes.length < 2) return hora;
    return `${partes[0]}:${partes[1]}`;
  }

  // -----------------------------------------
  // API pública
  // -----------------------------------------

  utils.hojeISO = hojeISOInternal;
  utils.formatarDataBR = formatarDataBRInternal;
  utils.formatarHora = formatarHoraInternal;

})(window);
