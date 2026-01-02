// frontend/assets/js/features/agenda/agenda.formatters.js
/**
 * PRONTIO — Agenda Formatters (Front)
 * ------------------------------------------------------------
 * Conteúdo 100% "puro" (sem DOM) para:
 * - Datas/horas (YYYY-MM-DD, HH:MM)
 * - ISO -> ymd/hhmm, diff em minutos
 * - Semana (cálculo seg->dom)
 * - Status UI <-> canônico backend
 * - CSS class por status
 * - Resumo do dia
 *
 * Regra:
 * - Não chama API
 * - Não acessa DOM
 * - Pode ser usado por widgets/features
 */

(function (global) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.features = PRONTIO.features || {};
  PRONTIO.features.agenda = PRONTIO.features.agenda || {};

  function stripAccents(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function timeToMinutes(hhmm) {
    if (!hhmm) return null;
    const parts = String(hhmm).split(":");
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  }

  function minutesToTime(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  function clamp(n, a, b) {
    const x = Number(n);
    if (!isFinite(x)) return a;
    return Math.max(a, Math.min(b, x));
  }

  function normalizeHora(value) {
    if (!value) return null;
    if (value instanceof Date) {
      return minutesToTime(value.getHours() * 60 + value.getMinutes());
    }
    const s = String(value).trim();
    const m = s.match(/^(\d{1,2}):(\d{2})/);
    if (!m) return null;
    return `${String(parseInt(m[1], 10)).padStart(2, "0")}:${m[2]}`;
  }

  function formatDateToInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function parseInputDate(value) {
    const [year, month, day] = String(value).split("-").map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }

  function formatDataBonita(dataStr) {
    if (!dataStr) return "";
    const [y, m, d] = String(dataStr).split("-");
    return `${d}/${m}`;
  }

  function getDiaSemanaLabel(dataStr) {
    const dias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const dt = parseInputDate(dataStr);
    return dias[dt.getDay()];
  }

  function ymdFromIso(iso) {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return "";
      return formatDateToInput(d);
    } catch (_) {
      return "";
    }
  }

  function hhmmFromIso(iso) {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return "";
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    } catch (_) {
      return "";
    }
  }

  function diffMinutes(isoStart, isoEnd) {
    try {
      const a = new Date(isoStart);
      const b = new Date(isoEnd);
      const ms = b.getTime() - a.getTime();
      if (!isFinite(ms)) return 0;
      return Math.max(1, Math.round(ms / 60000));
    } catch (_) {
      return 0;
    }
  }

  /**
   * Semana (seg->dom) a partir de uma data YYYY-MM-DD.
   * Retorna { inicio, fim, dias } (dias length=7)
   */
  function weekPeriodFrom(refYmd) {
    const ref = parseInputDate(refYmd);
    const day = ref.getDay(); // 0=dom
    const diffToMon = (day === 0) ? -6 : (1 - day);
    const mon = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + diffToMon, 0, 0, 0, 0);

    const dias = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i, 0, 0, 0, 0);
      dias.push(formatDateToInput(d));
    }
    return { inicio: dias[0], fim: dias[6], dias };
  }

  // ===========================
  // Status (UI <-> canônico)
  // ===========================
  const STATUS_OPTIONS_UI = ["Agendado", "Confirmado", "Em atendimento", "Concluído", "Faltou", "Cancelado"];

  function normalizeStatusLabel(uiOrCanon) {
    const v = stripAccents(String(uiOrCanon || "")).trim().toLowerCase();
    if (!v) return "Agendado";

    if (v.includes("concl") || v.includes("atendid")) return "Concluído";
    if (v.includes("em_atend") || v.includes("em atend") || (v.includes("atend") && !v.includes("atendid"))) return "Em atendimento";
    if (v.includes("aguard")) return "Confirmado";
    if (v.includes("confirm")) return "Confirmado";
    if (v.includes("falt")) return "Faltou";
    if (v.includes("cancel")) return "Cancelado";
    if (v.includes("marc") || v.includes("agend") || v.includes("remarc")) return "Agendado";

    return "Agendado";
  }

  function mapStatusToBackend(labelUi) {
    const v = stripAccents(String(labelUi || "")).toLowerCase();
    if (v.includes("confirm")) return "CONFIRMADO";
    if (v.includes("em atend") || v.includes("em_atend")) return "EM_ATENDIMENTO";
    if (v.includes("concl")) return "ATENDIDO";
    if (v.includes("falt")) return "FALTOU";
    if (v.includes("cancel")) return "CANCELADO";
    return "MARCADO";
  }

  function getStatusClass(statusCanonOrUi) {
    const s = stripAccents(String(statusCanonOrUi || "")).toLowerCase();
    if (s.includes("confirm")) return "status-confirmado";
    if (s.includes("aguard")) return "status-confirmado";
    if (s.includes("em_atend") || s.includes("em atend") || (s.includes("atend") && !s.includes("atendid"))) return "status-em-atendimento";
    if (s.includes("falt")) return "status-falta";
    if (s.includes("cancel")) return "status-cancelado";
    if (s.includes("concl") || s.includes("atendid")) return "status-concluido";
    return "status-agendado";
  }

  function computeResumoDia(uiAgs) {
    const resumo = {
      total: 0,
      confirmados: 0,
      faltas: 0,
      cancelados: 0,
      concluidos: 0,
      em_atendimento: 0
    };

    (uiAgs || []).forEach((ag) => {
      if (!ag || ag.bloqueio) return;
      resumo.total++;

      const s = stripAccents(String(ag.status || "")).toLowerCase();

      if (s.includes("falt")) return void resumo.faltas++;
      if (s.includes("cancel")) return void resumo.cancelados++;
      if (s.includes("concl") || s.includes("atendid")) return void resumo.concluidos++;
      if (s.includes("em_atend") || s.includes("em atend") || (s.includes("atend") && !s.includes("atendid"))) return void resumo.em_atendimento++;
      if (s.includes("confirm") || s.includes("aguard")) return void resumo.confirmados++;
    });

    return resumo;
  }

  /**
   * DTO canônico (backend) -> UI shape mínimo que a página usa hoje.
   * Observação: UI atual usa `nome_paciente` para exibir, mas DTO tem `titulo`.
   */
  function dtoToUi(dto) {
    const inicioIso = dto && dto.inicio ? String(dto.inicio) : "";
    const fimIso = dto && dto.fim ? String(dto.fim) : "";

    const tipo = String(dto && dto.tipo ? dto.tipo : "");
    const isBloqueio = tipo.toUpperCase() === "BLOQUEIO";

    return {
      ID_Agenda: dto && dto.idAgenda ? String(dto.idAgenda) : "",
      ID_Paciente: dto && dto.idPaciente ? String(dto.idPaciente) : "",
      data: ymdFromIso(inicioIso),
      hora_inicio: hhmmFromIso(inicioIso),
      hora_fim: hhmmFromIso(fimIso),
      duracao_minutos: diffMinutes(inicioIso, fimIso),

      nome_paciente: isBloqueio ? "Bloqueio" : (dto && dto.titulo ? String(dto.titulo) : "(sem nome)"),
      telefone_paciente: "",
      documento_paciente: "",
      motivo: dto && dto.notas ? String(dto.notas) : "",
      canal: "",
      origem: dto && dto.origem ? String(dto.origem) : "",
      status: dto && dto.status ? String(dto.status) : "",
      tipo: tipo,
      bloqueio: isBloqueio,
      permite_encaixe: false
    };
  }

  PRONTIO.features.agenda.formatters = {
    stripAccents,
    timeToMinutes,
    minutesToTime,
    clamp,
    normalizeHora,
    formatDateToInput,
    parseInputDate,
    formatDataBonita,
    getDiaSemanaLabel,
    ymdFromIso,
    hhmmFromIso,
    diffMinutes,
    weekPeriodFrom,
    STATUS_OPTIONS_UI,
    normalizeStatusLabel,
    mapStatusToBackend,
    getStatusClass,
    computeResumoDia,
    dtoToUi
  };
})(window);
