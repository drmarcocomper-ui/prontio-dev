/**
 * PRONTIO - Página de Agenda (front)
 *
 * Melhorias aplicadas (sem quebrar):
 * - Robustez contra "corridas" (race) em carregar dia/semana (token de requisição).
 * - Status: suporta melhor status canônicos do backend (MARCADO/ATENDIDO/AGUARDANDO/REMARCADO)
 *   mantendo compat com rótulos antigos ("Agendado"/"Concluído"/etc.).
 * - Resumo do dia: contabiliza ATENDIDO além de CONCLUIDO.
 * - Mensagens de erro mais consistentes e seguras.
 *
 * ✅ PASSO 1 (Agenda - contrato local):
 * - Consultas de DIA/SEMANA não usam mais inicio/fim em ISO/UTC.
 * - Dia usa Agenda_ListarDia (payload: {data:"YYYY-MM-DD"}).
 * - Semana usa Agenda_ListarSemana (payload: {data_referencia:"YYYY-MM-DD"}).
 * - Pré-validação envia permitirEncaixe (VALIDAR == SALVAR).
 *
 * ✅ PASSO 3 (Estado no front - retrocompat):
 * - modoVisao e filtros persistem via PRONTIO.core.storage (quando disponível),
 *   com fallback para localStorage e mantendo chaves legadas.
 * - abrirProntuario grava contexto em PRONTIO.core.state (pacienteAtual/agendaAtual)
 *   e mantém localStorage legado (prontio.pacienteSelecionado / prontio.prontuarioContexto).
 */

(function (global, document) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});

  const callApiData =
    (PRONTIO.api && PRONTIO.api.callApiData) ||
    global.callApiData ||
    function () {
      console.error("[PRONTIO.agenda] callApiData não está definido.");
      return Promise.reject(new Error("API não inicializada (callApiData indefinido)."));
    };

  // ===========================
  // PASSO 3 - Storage/State (compat)
  // ===========================
  const coreStorage = PRONTIO.core && PRONTIO.core.storage ? PRONTIO.core.storage : null;
  const coreState = PRONTIO.core && PRONTIO.core.state ? PRONTIO.core.state : null;

  function storageGetJSON_(key, fallback) {
    try {
      if (coreStorage && typeof coreStorage.getJSON === "function") {
        return coreStorage.getJSON(key, fallback);
      }
    } catch (_) {}
    // fallback localStorage
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function storageSetJSON_(key, obj) {
    try {
      if (coreStorage && typeof coreStorage.setJSON === "function") {
        coreStorage.setJSON(key, obj);
        return;
      }
    } catch (_) {}
    try {
      localStorage.setItem(key, JSON.stringify(obj));
    } catch (_) {}
  }

  function storageGetString_(key, fallback) {
    try {
      if (coreStorage && typeof coreStorage.getItem === "function") {
        const v = coreStorage.getItem(key);
        return v == null ? fallback : String(v);
      }
    } catch (_) {}
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : String(v);
    } catch (_) {
      return fallback;
    }
  }

  function storageSetString_(key, value) {
    try {
      if (coreStorage && typeof coreStorage.setItem === "function") {
        coreStorage.setItem(key, String(value));
        return;
      }
    } catch (_) {}
    try {
      localStorage.setItem(key, String(value));
    } catch (_) {}
  }

  // Chaves (core + legado)
  const CORE_PREFS_KEY = "prontio.ui.agenda.prefs.v1";
  const LEGACY_MODO_KEY = "prontio.agenda.modoVisao"; // legado já usado
  const LEGACY_FILTER_KEY = "prontio.agenda.filtros.v1"; // legado já usado
  const CORE_FILTER_KEY = "prontio.ui.agenda.filtros.v1";

  function loadAgendaPrefs_() {
    const prefs = storageGetJSON_(CORE_PREFS_KEY, null) || {};
    // legado
    const legacyModo = storageGetString_(LEGACY_MODO_KEY, null);
    const legacyFiltros = storageGetJSON_(LEGACY_FILTER_KEY, null);

    const out = {
      modoVisao: prefs.modoVisao || (legacyModo ? String(legacyModo) : "dia"),
      filtros: Object.assign({ nome: "", status: "" }, prefs.filtros || {})
    };

    if ((!prefs.filtros || !Object.keys(prefs.filtros || {}).length) && legacyFiltros) {
      out.filtros.nome = String(legacyFiltros.nome || "");
      out.filtros.status = String(legacyFiltros.status || "");
    }

    // normaliza
    if (out.modoVisao !== "dia" && out.modoVisao !== "semana") out.modoVisao = "dia";
    out.filtros.nome = String(out.filtros.nome || "");
    out.filtros.status = String(out.filtros.status || "");

    return out;
  }

  function saveAgendaPrefs_(patch) {
    const current = loadAgendaPrefs_();
    const merged = Object.assign({}, current, patch || {});
    if (patch && patch.filtros) merged.filtros = Object.assign({}, current.filtros || {}, patch.filtros);

    // core
    storageSetJSON_(CORE_PREFS_KEY, merged);

    // retrocompat
    storageSetString_(LEGACY_MODO_KEY, merged.modoVisao);
    storageSetJSON_(LEGACY_FILTER_KEY, merged.filtros || { nome: "", status: "" });

    // também mantém uma key "core filtros" específica (facilita migração futura)
    storageSetJSON_(CORE_FILTER_KEY, merged.filtros || { nome: "", status: "" });

    return merged;
  }

  function initAgendaPage() {
    const body = document.body;
    const pageId = body.dataset.pageId || body.getAttribute("data-page") || null;
    if (pageId !== "agenda") return;

    function get(id) {
      const el = document.getElementById(id);
      if (!el) console.warn(`Agenda: elemento #${id} não encontrado no DOM.`);
      return el;
    }

    // =====================
    // Elementos principais
    // =====================
    const inputData = get("input-data");
    if (!inputData) return;

    const btnHoje = get("btn-hoje");
    const btnAgora = get("btn-agora");
    const btnDiaAnterior = get("btn-dia-anterior");
    const btnDiaPosterior = get("btn-dia-posterior");

    const listaHorariosEl = get("agenda-lista-horarios");

    const resumoTotalEl = get("resumo-total");
    const resumoConfirmadosEl = get("resumo-confirmados");
    const resumoFaltasEl = get("resumo-faltas");
    const resumoCanceladosEl = get("resumo-cancelados");
    const resumoConcluidosEl = get("resumo-concluidos");
    const resumoEmAtendimentoEl = get("resumo-em-atendimento");

    const btnNovoAgendamento = get("btn-novo-agendamento");
    const btnBloquearHorario = get("btn-bloquear-horario");

    const secDia = document.querySelector(".agenda-dia");
    const secSemana = document.getElementById("agenda-semana");
    const semanaGridEl = get("agenda-semana-grid");
    const btnVisaoDia = get("btn-visao-dia");
    const btnVisaoSemana = get("btn-visao-semana");

    const inputFiltroNome = get("filtro-nome");
    const selectFiltroStatus = get("filtro-status");
    const btnLimparFiltros = get("btn-limpar-filtros");

    // =====================
    // PASSO 3: modoVisao/filtros via core.storage (com legado)
    // =====================
    const agendaPrefs = loadAgendaPrefs_();
    let modoVisao = agendaPrefs.modoVisao; // "dia" | "semana"

    // Persistência de filtros (mantém shape atual do arquivo)
    const FILTER_KEY = LEGACY_FILTER_KEY; // legado permanece
    const filtrosState = (function loadFiltros_Compat_() {
      const fromCore = storageGetJSON_(CORE_FILTER_KEY, null);
      const fromLegacy = storageGetJSON_(FILTER_KEY, null);
      const base = { nome: "", status: "" };

      const src = fromCore || fromLegacy || base;
      return {
        nome: String(src && src.nome ? src.nome : ""),
        status: String(src && src.status ? src.status : "")
      };
    })();

    let agendamentosOriginaisDia = [];
    let agendamentosOriginaisSemana = []; // DTOs UI (todos do período)
    let horaFocoDia = null;

    // =====================
    // Controle anti-race (não quebra; só evita UI voltar no tempo)
    // =====================
    let reqSeqDia = 0;
    let reqSeqSemana = 0;

    // =====================
    // Modais - Novo
    // =====================
    const modalOverlay = get("modal-novo-agendamento");
    const btnFecharModal = get("btn-fechar-modal");
    const btnCancelarModal = get("btn-cancelar-modal");
    const formNovoAgendamento = get("form-novo-agendamento");
    const mensagemNovoAgendamento = get("novo-agendamento-mensagem");

    const inputHoraInicio = get("novo-hora-inicio");
    const inputDuracao = get("novo-duracao");
    const inputNomePaciente = get("novo-nome-paciente");
    const inputTelefone = get("novo-telefone");
    const inputTipo = get("novo-tipo");
    const inputMotivo = get("novo-motivo");
    const inputOrigem = get("novo-origem");
    const inputCanal = get("novo-canal");
    const chkNovoPermiteEncaixe = get("novo-permite-encaixe");

    const btnSelecionarPaciente = get("btn-selecionar-paciente");
    const btnLimparPaciente = get("btn-limpar-paciente");
    const btnSubmitNovo = get("btn-submit-novo");

    // =====================
    // Modais - Editar
    // =====================
    const modalEdit = get("modal-editar-agendamento");
    const btnFecharModalEditar = get("btn-fechar-modal-editar");
    const btnCancelarEditar = get("btn-cancelar-editar");
    const formEditarAgendamento = get("form-editar-agendamento");
    const msgEditarAgendamento = get("editar-agendamento-mensagem");

    const inputEditIdAgenda = get("edit-id-agenda");
    const inputEditData = get("edit-data");
    const inputEditHoraInicio = get("edit-hora-inicio");
    const inputEditDuracao = get("edit-duracao");
    const inputEditNomePaciente = get("edit-nome-paciente");
    const inputEditTipo = get("edit-tipo");
    const inputEditMotivo = get("edit-motivo");
    const inputEditOrigem = get("edit-origem");
    const inputEditCanal = get("edit-canal");
    const chkEditPermiteEncaixe = get("edit-permite-encaixe");

    const btnEditSelecionarPaciente = get("btn-edit-selecionar-paciente");
    const btnEditLimparPaciente = get("btn-edit-limpar-paciente");
    const btnSubmitEditar = get("btn-submit-editar");

    let agendamentoEmEdicao = null;

    // =====================
    // Modais - Bloqueio
    // =====================
    const modalBloqueio = get("modal-bloqueio");
    const btnFecharModalBloqueio = get("btn-fechar-modal-bloqueio");
    const btnCancelarBloqueio = get("btn-cancelar-bloqueio");
    const formBloqueio = get("form-bloqueio");
    const mensagemBloqueio = get("bloqueio-mensagem");
    const inputBloqHoraInicio = get("bloq-hora-inicio");
    const inputBloqDuracao = get("bloq-duracao");
    const btnSubmitBloqueio = get("btn-submit-bloqueio");

    // =====================
    // Modal - Pacientes (fallback)
    // =====================
    const modalPacientes = get("modal-pacientes");
    const inputBuscaPaciente = get("busca-paciente-termo");
    const listaPacientesEl = get("lista-pacientes");
    const msgPacientesEl = get("pacientes-resultado-msg");
    const btnFecharModalPacientes = get("btn-fechar-modal-pacientes");

    // =====================
    // Estado seleção paciente
    // =====================
    let pacienteSelecionado = null;
    let pacienteSelecionadoEditar = null;
    let contextoSelecaoPaciente = "novo";
    let buscaPacienteTimeout = null;

    // =====================
    // Config Agenda (backend)
    // =====================
    let agendaConfig = {
      hora_inicio_padrao: "08:00",
      hora_fim_padrao: "18:00",
      duracao_grade_minutos: 15
    };
    let agendaConfigCarregada = false;

    // =====================
    // Controle de concorrência (ações)
    // =====================
    const inFlight = {
      statusById: new Set(),
      removerBloqById: new Set()
    };

    // =====================
    // Helpers gerais
    // =====================
    function stripAccents(s) {
      return String(s || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    }

    function safeDisable(el, disabled) {
      if (!el) return;
      el.disabled = !!disabled;
      el.setAttribute("aria-disabled", disabled ? "true" : "false");
    }

    function setFormMsg(el, text, kind) {
      if (!el) return;
      el.textContent = text || "";
      el.className = "form-message" + (kind ? " " + kind : "");
    }

    function clamp_(n, a, b) {
      const x = Number(n);
      if (!isFinite(x)) return a;
      return Math.max(a, Math.min(b, x));
    }

    function saveFiltros_() {
      // PASSO 3: salvar em core prefs também
      try {
        // core filtros (chave dedicada)
        storageSetJSON_(CORE_FILTER_KEY, { nome: filtrosState.nome, status: filtrosState.status });

        // core prefs (agregado)
        saveAgendaPrefs_({
          modoVisao,
          filtros: { nome: filtrosState.nome, status: filtrosState.status }
        });

        // legado ainda é mantido pelo saveAgendaPrefs_ (LEGACY_FILTER_KEY).
        // mas garantimos explicitamente por compat:
        storageSetJSON_(FILTER_KEY, { nome: filtrosState.nome, status: filtrosState.status });
      } catch (_) {}
    }

    function applyFiltrosToUI_() {
      if (inputFiltroNome) inputFiltroNome.value = filtrosState.nome || "";
      if (selectFiltroStatus) selectFiltroStatus.value = filtrosState.status || "";
    }

    // =====================
    // Helpers modais
    // =====================
    let ultimoFocusAntesModal = null;

    function isModalVisible(modalEl) {
      return !!modalEl && !modalEl.classList.contains("hidden");
    }

    function openModal(modalEl, focusEl) {
      if (!modalEl) return;
      ultimoFocusAntesModal = document.activeElement;

      modalEl.classList.remove("hidden");
      modalEl.classList.add("visible");
      modalEl.setAttribute("aria-hidden", "false");

      setTimeout(() => {
        if (focusEl && typeof focusEl.focus === "function") focusEl.focus();
      }, 0);
    }

    function closeModal(modalEl) {
      if (!modalEl) return;

      modalEl.classList.remove("visible");
      modalEl.classList.add("hidden");
      modalEl.setAttribute("aria-hidden", "true");

      setTimeout(() => {
        if (ultimoFocusAntesModal && typeof ultimoFocusAntesModal.focus === "function") {
          ultimoFocusAntesModal.focus();
        }
        ultimoFocusAntesModal = null;
      }, 0);
    }

    // ==============
    // Helpers de hora
    // ==============
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
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      return `${hh}:${mm}`;
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
      const [year, month, day] = value.split("-").map(Number);
      return new Date(year, month - 1, day);
    }

    function setToday() {
      inputData.value = formatDateToInput(new Date());
    }

    function formatDataBonita(dataStr) {
      if (!dataStr) return "";
      const [y, m, d] = dataStr.split("-");
      return `${d}/${m}`;
    }

    function getDiaSemanaLabel(dataStr) {
      const dias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
      const [y, m, d] = dataStr.split("-").map(Number);
      const dt = new Date(y, m - 1, d);
      return dias[dt.getDay()];
    }

    // ⚠️ Helpers ISO permanecem por compatibilidade (não usados mais para consulta diária/semanal)
    function startOfDayIso_(dataStr) {
      const d = parseInputDate(dataStr);
      d.setHours(0, 0, 0, 0);
      return d.toISOString();
    }

    function endOfDayIso_(dataStr) {
      const d = parseInputDate(dataStr);
      d.setHours(23, 59, 59, 999);
      return d.toISOString();
    }

    function ymdFromIso_(iso) {
      try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return "";
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${dd}`;
      } catch (_) {
        return "";
      }
    }

    function hhmmFromIso_(iso) {
      try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return "";
        const hh = String(d.getHours()).padStart(2, "0");
        const mm = String(d.getMinutes()).padStart(2, "0");
        return `${hh}:${mm}`;
      } catch (_) {
        return "";
      }
    }

    function diffMinutes_(isoStart, isoEnd) {
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

    // ✅ Normaliza qualquer “agendamento” para o shape UI usado na página
    function normalizeUiAg_(ag) {
      if (!ag || typeof ag !== "object") return null;

      // Se já veio no formato legado/UI, preserva
      if (ag.ID_Agenda || ag.data || ag.hora_inicio) {
        const tipo = String(ag.tipo || "");
        const isBloqueio = ag.bloqueio === true || tipo.toUpperCase() === "BLOQUEIO";

        return {
          ID_Agenda: ag.ID_Agenda ? String(ag.ID_Agenda) : "",
          ID_Paciente: ag.ID_Paciente ? String(ag.ID_Paciente) : "",
          data: ag.data ? String(ag.data) : "",
          hora_inicio: ag.hora_inicio ? String(ag.hora_inicio) : "",
          hora_fim: ag.hora_fim ? String(ag.hora_fim) : "",
          duracao_minutos: ag.duracao_minutos ? Number(ag.duracao_minutos) : 0,
          nome_paciente: ag.nome_paciente ? String(ag.nome_paciente) : isBloqueio ? "Bloqueio" : "",
          telefone_paciente: ag.telefone_paciente ? String(ag.telefone_paciente) : "",
          documento_paciente: ag.documento_paciente ? String(ag.documento_paciente) : "",
          motivo: ag.motivo ? String(ag.motivo) : "",
          canal: ag.canal ? String(ag.canal) : "",
          origem: ag.origem ? String(ag.origem) : "",
          status: ag.status ? String(ag.status) : "",
          tipo: tipo,
          bloqueio: isBloqueio,
          permite_encaixe: ag.permite_encaixe === true
        };
      }

      // Caso tenha vindo no DTO novo (inicio/fim ISO), converte
      return dtoToUiAg_(ag);
    }

    function dtoToUiAg_(dto) {
      const inicioIso = dto && dto.inicio ? String(dto.inicio) : "";
      const fimIso = dto && dto.fim ? String(dto.fim) : "";

      const tipo = String(dto && dto.tipo ? dto.tipo : "");
      const isBloqueio = tipo.toUpperCase() === "BLOQUEIO";

      return {
        ID_Agenda: dto && (dto.idAgenda || dto.ID_Agenda) ? String(dto.idAgenda || dto.ID_Agenda) : "",
        ID_Paciente: dto && (dto.idPaciente || dto.ID_Paciente) ? String(dto.idPaciente || dto.ID_Paciente) : "",
        data: ymdFromIso_(inicioIso),
        hora_inicio: hhmmFromIso_(inicioIso),
        hora_fim: hhmmFromIso_(fimIso),
        duracao_minutos: diffMinutes_(inicioIso, fimIso),
        nome_paciente: dto && dto.titulo ? String(dto.titulo) : isBloqueio ? "Bloqueio" : "",
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

    function computeResumoDia_(ags) {
      const resumo = {
        total: 0,
        confirmados: 0,
        faltas: 0,
        cancelados: 0,
        concluidos: 0,
        em_atendimento: 0
      };

      (ags || []).forEach((ag) => {
        if (!ag) return;
        if (ag.bloqueio) return;
        resumo.total++;

        const s = stripAccents(String(ag.status || "")).toLowerCase();

        // faltas
        if (s.includes("falt")) {
          resumo.faltas++;
          return;
        }

        // cancelados
        if (s.includes("cancel")) {
          resumo.cancelados++;
          return;
        }

        // concluídos (aceita CONCLUIDO e ATENDIDO)
        if (s.includes("concl") || s.includes("atendid")) {
          resumo.concluidos++;
          return;
        }

        // em atendimento
        if (s.includes("em_atend") || s.includes("em atend") || (s.includes("atend") && !s.includes("atendid"))) {
          resumo.em_atendimento++;
          return;
        }

        // confirmados
        if (s.includes("confirm")) {
          resumo.confirmados++;
          return;
        }
      });

      return resumo;
    }

    async function carregarAgendaConfigSeNecessario() {
      if (agendaConfigCarregada) return;

      try {
        const data = await callApiData({ action: "AgendaConfig_Obter", payload: {} });
        if (data && typeof data === "object") {
          agendaConfig.hora_inicio_padrao = data.hora_inicio_padrao || agendaConfig.hora_inicio_padrao;
          agendaConfig.hora_fim_padrao = data.hora_fim_padrao || agendaConfig.hora_fim_padrao;

          // garante número válido
          const dur = parseInt(String(data.duracao_grade_minutos || ""), 10);
          if (isFinite(dur) && dur > 0) agendaConfig.duracao_grade_minutos = dur;
        }
      } catch (error) {
        console.warn("Agenda: erro ao carregar AgendaConfig_Obter, usando defaults.", error);
      } finally {
        agendaConfigCarregada = true;
      }
    }

    function getSlotsByConfig_() {
      const inicioMin = timeToMinutes(agendaConfig.hora_inicio_padrao) ?? 8 * 60;
      const fimMin = timeToMinutes(agendaConfig.hora_fim_padrao) ?? 18 * 60;
      const passo = parseInt(String(agendaConfig.duracao_grade_minutos || 15), 10) || 15;

      const slots = [];
      for (let t = inicioMin; t <= fimMin; t += passo) slots.push(minutesToTime(t));
      return { slots, inicioMin, fimMin, passo };
    }

    function getNowSlot_() {
      const now = new Date();
      const dataStr = formatDateToInput(now);
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const { slots, inicioMin, fimMin, passo } = getSlotsByConfig_();
      if (nowMin < inicioMin || nowMin > fimMin) return { dataStr, hhmm: null };
      const idx = clamp_(Math.floor((nowMin - inicioMin) / passo), 0, slots.length - 1);
      return { dataStr, hhmm: slots[idx] || null };
    }

    // =========================================================
    // PRÉ-VALIDAÇÃO DE CONFLITO (ANTES DE SALVAR)
    // =========================================================
    async function preValidarConflito_(params) {
      const payload = {
        data: params.data,
        hora_inicio: params.hora_inicio,
        duracao_minutos: params.duracao_minutos,
        ignoreIdAgenda: params.ignoreIdAgenda || "",

        // ✅ PASSO 1.2: validar usa a MESMA regra e respeita permitirEncaixe
        permite_encaixe: params.permite_encaixe === true,
        permitirEncaixe: params.permite_encaixe === true
      };

      try {
        const r = await callApiData({ action: "Agenda_ValidarConflito", payload });

        if (!r || r.ok !== true) {
          return {
            ok: false,
            erro: r && r.erro ? String(r.erro) : "Conflito de horário.",
            conflitos: r && r.conflitos ? r.conflitos : [],
            intervalo: r && r.intervalo ? r.intervalo : null,
            code: r && r.code ? String(r.code) : ""
          };
        }

        return r;
      } catch (e) {
        console.warn("Pré-validação conflito indisponível (fallback):", e);
        // fallback seguro: não bloqueia usuário
        return { ok: true, conflitos: [], intervalo: null, erro: "" };
      }
    }

    function describeConflitos_(r) {
      if (!r) return "Conflito de horário.";
      const conflitos = Array.isArray(r.conflitos) ? r.conflitos : [];
      if (!conflitos.length) return r.erro || "Conflito de horário.";

      const top = conflitos.slice(0, 2).map((c) => {
        const tipo = c.bloqueio ? "Bloqueio" : "Consulta";
        const hi = c.hora_inicio || "?";
        const hf = c.hora_fim || "?";
        return `${tipo} ${hi}–${hf}`;
      });

      const extra = conflitos.length > 2 ? ` (+${conflitos.length - 2})` : "";
      return `Conflito no horário. ${top.join(" | ")}${extra}`;
    }

    function hasBloqueioInConflitos_(r) {
      const conflitos = Array.isArray(r && r.conflitos) ? r.conflitos : [];
      return conflitos.some((c) => c && c.bloqueio === true);
    }

    // ===========================
    // Typeahead de pacientes
    // ===========================
    function normalizePatientObj_(p) {
      if (!p) return null;
      return {
        ID_Paciente: String(p.ID_Paciente || p.id || p.ID || p.id_paciente || ""),
        nome: String(p.nome || ""),
        documento: String(p.documento || ""),
        telefone: String(p.telefone || ""),
        data_nascimento: String(p.data_nascimento || "")
      };
    }

    async function apiBuscarPacientesSimples_(termo, limite) {
      const t = String(termo || "").trim();
      if (!t || t.length < 2) return [];
      const data = await callApiData({
        action: "Pacientes_BuscarSimples",
        payload: { termo: t, limite: limite || 12 }
      });
      const arr = data && data.pacientes ? data.pacientes : [];
      return arr.map(normalizePatientObj_).filter(Boolean);
    }

    function setPacienteSelecionadoNoCampo_(inputEl, p) {
      if (!inputEl) return;
      if (!p) {
        delete inputEl.dataset.pacienteId;
        delete inputEl.dataset.pacienteNome;
        return;
      }
      inputEl.dataset.pacienteId = p.ID_Paciente || "";
      inputEl.dataset.pacienteNome = p.nome || "";
    }

    function clearPacienteSeTextoNaoBate_(inputEl, getSelectedFn, clearSelectedFn) {
      if (!inputEl) return;
      const sel = getSelectedFn();
      if (!sel) return;

      const typed = String(inputEl.value || "").trim();
      const selNome = String(sel.nome || "").trim();

      if (!typed) {
        clearSelectedFn();
        setPacienteSelecionadoNoCampo_(inputEl, null);
        return;
      }

      if (typed !== selNome) {
        clearSelectedFn();
        setPacienteSelecionadoNoCampo_(inputEl, null);
      }
    }

    function attachPatientTypeahead_(opts) {
      const inputEl = opts.inputEl;
      if (!inputEl) return;

      const getSelected = opts.getSelected;
      const setSelected = opts.setSelected;
      const onSelected = opts.onSelected || function () {};
      const onManualTyping = opts.onManualTyping || function () {};

      let panel = document.createElement("div");
      panel.className = "typeahead-panel hidden";
      panel.setAttribute("role", "listbox");

      let items = [];
      let activeIndex = -1;
      let debounceTimer = null;
      let lastQuery = "";

      function ensurePanelMounted_() {
        if (panel.parentNode) return;
        const parent = inputEl.parentElement;
        if (parent) parent.style.position = parent.style.position || "relative";
        (parent || inputEl.parentNode).appendChild(panel);
      }

      function hidePanel_() {
        panel.classList.add("hidden");
        panel.innerHTML = "";
        items = [];
        activeIndex = -1;
      }

      function showPanel_() {
        panel.classList.remove("hidden");
      }

      function render_() {
        if (!items.length) {
          hidePanel_();
          return;
        }

        panel.innerHTML = "";
        items.forEach((p, idx) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "typeahead-item";
          btn.setAttribute("role", "option");
          btn.dataset.index = String(idx);
          if (idx === activeIndex) btn.classList.add("active");

          const line1 = document.createElement("div");
          line1.className = "typeahead-item-nome";
          line1.textContent = p.nome || "(sem nome)";

          const line2 = document.createElement("div");
          line2.className = "typeahead-item-detalhes";
          const parts = [];
          if (p.documento) parts.push(p.documento);
          if (p.telefone) parts.push(p.telefone);
          if (p.data_nascimento) parts.push("Nasc.: " + p.data_nascimento);
          line2.textContent = parts.join(" • ");

          btn.appendChild(line1);
          if (line2.textContent) btn.appendChild(line2);

          btn.addEventListener("mousedown", (e) => e.preventDefault());

          btn.addEventListener("click", () => {
            setSelected(p);
            setPacienteSelecionadoNoCampo_(inputEl, p);
            inputEl.value = p.nome || "";
            hidePanel_();
            onSelected(p);
          });

          panel.appendChild(btn);
        });

        showPanel_();
      }

      async function fetchAndRender_(q) {
        const query = String(q || "").trim();
        if (query.length < 2) {
          hidePanel_();
          return;
        }

        lastQuery = query;
        try {
          const results = await apiBuscarPacientesSimples_(query, 12);
          if (String(inputEl.value || "").trim() !== lastQuery) return;

          items = results || [];
          activeIndex = items.length ? 0 : -1;
          render_();
        } catch (err) {
          hidePanel_();
          console.warn("Typeahead pacientes: erro ao buscar", err);
        }
      }

      inputEl.addEventListener("input", () => {
        clearPacienteSeTextoNaoBate_(inputEl, getSelected, () => setSelected(null));
        onManualTyping();

        const q = String(inputEl.value || "").trim();
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => fetchAndRender_(q), 220);
      });

      inputEl.addEventListener("focus", () => {
        ensurePanelMounted_();
        const q = String(inputEl.value || "").trim();
        if (q.length >= 2) {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => fetchAndRender_(q), 10);
        }
      });

      inputEl.addEventListener("blur", () => setTimeout(() => hidePanel_(), 180));

      inputEl.addEventListener("keydown", (e) => {
        if (panel.classList.contains("hidden")) return;

        if (e.key === "ArrowDown") {
          e.preventDefault();
          if (!items.length) return;
          activeIndex = Math.min(activeIndex + 1, items.length - 1);
          render_();
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          if (!items.length) return;
          activeIndex = Math.max(activeIndex - 1, 0);
          render_();
        } else if (e.key === "Enter") {
          if (activeIndex >= 0 && items[activeIndex]) {
            e.preventDefault();
            const p = items[activeIndex];
            setSelected(p);
            setPacienteSelecionadoNoCampo_(inputEl, p);
            inputEl.value = p.nome || "";
            hidePanel_();
            onSelected(p);
          }
        } else if (e.key === "Escape") {
          hidePanel_();
        }
      });

      ensurePanelMounted_();
    }

    // ===========================
    // Visão Dia / Semana
    // ===========================
    function setVisao(modo) {
      if (modo !== "dia" && modo !== "semana") return;

      modoVisao = modo;

      // PASSO 3: salvar em core prefs + manter legado
      saveAgendaPrefs_({
        modoVisao,
        filtros: { nome: filtrosState.nome, status: filtrosState.status }
      });

      if (modo === "dia") {
        secDia && secDia.classList.remove("hidden");
        secSemana && secSemana.classList.add("hidden");
        btnVisaoDia && btnVisaoDia.classList.add("view-active");
        btnVisaoSemana && btnVisaoSemana.classList.remove("view-active");
        carregarAgendaDia();
      } else {
        secDia && secDia.classList.add("hidden");
        secSemana && secSemana.classList.remove("hidden");
        btnVisaoDia && btnVisaoDia.classList.remove("view-active");
        btnVisaoSemana && btnVisaoSemana.classList.add("view-active");
        carregarAgendaSemana();
      }
    }

    // ===========================
    // Dia - render/estado
    // ===========================
    function limparListaHorarios() {
      if (listaHorariosEl) listaHorariosEl.innerHTML = "";
    }

    function mostrarEstadoCarregando() {
      if (!listaHorariosEl) return;
      listaHorariosEl.classList.add("loading");
      listaHorariosEl.innerHTML = '<div class="agenda-loading">Carregando agenda...</div>';
    }

    function removerEstadoCarregando() {
      if (!listaHorariosEl) return;
      listaHorariosEl.classList.remove("loading");
    }

    function mostrarErro(mensagem) {
      if (!listaHorariosEl) return;
      // evita injeção acidental por interpolação
      const wrap = document.createElement("div");
      wrap.className = "agenda-erro";
      wrap.textContent = String(mensagem || "Erro.");
      listaHorariosEl.innerHTML = "";
      listaHorariosEl.appendChild(wrap);
    }

    function atualizarResumoDia(resumo) {
      if (resumoTotalEl) resumoTotalEl.textContent = resumo?.total ?? 0;
      if (resumoConfirmadosEl) resumoConfirmadosEl.textContent = resumo?.confirmados ?? 0;
      if (resumoFaltasEl) resumoFaltasEl.textContent = resumo?.faltas ?? 0;
      if (resumoCanceladosEl) resumoCanceladosEl.textContent = resumo?.cancelados ?? 0;
      if (resumoConcluidosEl) resumoConcluidosEl.textContent = resumo?.concluidos ?? 0;
      if (resumoEmAtendimentoEl) resumoEmAtendimentoEl.textContent = resumo?.em_atendimento ?? 0;
    }

    function getFiltroNormalized_() {
      const termo = stripAccents(filtrosState.nome || "").toLowerCase().trim();
      const statusFiltro = stripAccents(filtrosState.status || "").toLowerCase().trim();
      return { termo, statusFiltro };
    }

    function matchesFiltroStatus_(statusValue, statusFiltro) {
      if (!statusFiltro) return true;
      const s = stripAccents(String(statusValue || "")).toLowerCase();

      // compat: filtro do select é humano ("concluído"), backend pode ser "ATENDIDO"
      if (statusFiltro.includes("concl")) {
        return s.includes("concl") || s.includes("atendid");
      }
      if (statusFiltro.includes("agend")) {
        return s.includes("agend") || s.includes("marc");
      }
      if (
        statusFiltro.includes("em atendimento") ||
        statusFiltro.includes("em_atend") ||
        statusFiltro.includes("atend")
      ) {
        return s.includes("em_atend") || s.includes("em atend") || (s.includes("atend") && !s.includes("atendid"));
      }

      return s.includes(statusFiltro);
    }

    function matchesFiltro_(ag, termo, statusFiltro) {
      if (!ag) return false;

      if (termo) {
        const nome = stripAccents(String(ag.nome_paciente || "")).toLowerCase();
        if (!nome.includes(termo)) return false;
      }

      if (statusFiltro) {
        if (!matchesFiltroStatus_(ag.status, statusFiltro)) return false;
      }

      return true;
    }

    // ✅ PASSO 1.1: consulta diária agora usa action local (sem ISO/UTC)
    async function carregarAgendaDia() {
      const dataStr = inputData.value;
      if (!dataStr) return;

      const mySeq = ++reqSeqDia;

      await carregarAgendaConfigSeNecessario();

      limparListaHorarios();
      mostrarEstadoCarregando();

      try {
        const data = await callApiData({
          action: "Agenda_ListarDia",
          payload: { data: dataStr }
        });

        if (mySeq !== reqSeqDia) return;

        // data = {resumo, horarios:[{hora, agendamentos:[...]}]}
        const horarios = data && data.horarios ? data.horarios : [];
        const flat = [];
        horarios.forEach((h) => {
          const arr = h && h.agendamentos ? h.agendamentos : [];
          arr.forEach((ag) => {
            const ui = normalizeUiAg_(ag);
            if (ui) flat.push(ui);
          });
        });

        agendamentosOriginaisDia = flat.filter((ag) => ag && ag.data === dataStr);
        atualizarResumoDia(computeResumoDia_(agendamentosOriginaisDia));
        aplicarFiltrosDia();
      } catch (error) {
        if (mySeq !== reqSeqDia) return;
        console.error(error);
        mostrarErro(
          "Não foi possível carregar a agenda do dia: " + (error && error.message ? error.message : String(error))
        );
      } finally {
        if (mySeq === reqSeqDia) removerEstadoCarregando();
      }
    }

    function aplicarFiltrosDia() {
      const { termo, statusFiltro } = getFiltroNormalized_();
      const { slots } = getSlotsByConfig_();

      const map = new Map();
      (agendamentosOriginaisDia || []).forEach((ag) => {
        const hora = normalizeHora(ag.hora_inicio);
        if (!hora) return;

        if (!matchesFiltro_(ag, termo, statusFiltro)) return;

        if (!map.has(hora)) map.set(hora, []);
        map.get(hora).push(ag);
      });

      const slotsRender = slots.map((hora) => ({ hora, agendamentos: map.get(hora) || [] }));
      desenharHorarios(slotsRender);
    }

    function desenharHorarios(horarios) {
      limparListaHorarios();
      if (!listaHorariosEl) return;

      if (!horarios || !horarios.length) {
        listaHorariosEl.innerHTML = '<div class="agenda-vazia">Nenhum horário para exibir.</div>';
        return;
      }

      let slotParaFoco = null;
      const now = getNowSlot_();
      const isHoje = now.dataStr === inputData.value;
      const hhNow = now.hhmm;

      horarios.forEach((slot) => {
        const { hora, agendamentos } = slot;

        const slotEl = document.createElement("div");
        slotEl.className = "agenda-slot";
        slotEl.dataset.hora = hora;

        if (isHoje && hhNow && hora === hhNow) slotEl.classList.add("slot-now");

        const horaEl = document.createElement("div");
        horaEl.className = "agenda-slot-hora";
        horaEl.textContent = hora;

        const conteudoEl = document.createElement("div");
        conteudoEl.className = "agenda-slot-conteudo";

        if (!agendamentos || agendamentos.length === 0) {
          const vazioEl = document.createElement("div");
          vazioEl.className = "agenda-slot-vazio";
          vazioEl.textContent = "Horário livre";
          conteudoEl.appendChild(vazioEl);

          const actionsEl = document.createElement("div");
          actionsEl.className = "agenda-slot-actions";

          const btnNovo = document.createElement("button");
          btnNovo.type = "button";
          btnNovo.className = "btn-status btn-status-atender agenda-slot-action-btn";
          btnNovo.textContent = "Novo";
          btnNovo.addEventListener("click", () => abrirModalNovoAgendamento(hora));

          const btnBloq = document.createElement("button");
          btnBloq.type = "button";
          btnBloq.className = "btn-status btn-status-cancelar agenda-slot-action-btn";
          btnBloq.textContent = "Bloquear";
          btnBloq.addEventListener("click", () => abrirModalBloqueio(hora));

          actionsEl.appendChild(btnNovo);
          actionsEl.appendChild(btnBloq);
          conteudoEl.appendChild(actionsEl);

          slotEl.addEventListener("dblclick", () => abrirModalNovoAgendamento(hora));
        } else {
          agendamentos.forEach((ag) => {
            const agEl = ag.bloqueio ? criarCartaoBloqueio(ag) : criarCartaoAgendamento(ag);
            conteudoEl.appendChild(agEl);
          });
        }

        slotEl.appendChild(horaEl);
        slotEl.appendChild(conteudoEl);
        listaHorariosEl.appendChild(slotEl);

        if (horaFocoDia && hora === horaFocoDia && !slotParaFoco) slotParaFoco = slotEl;
      });

      if (slotParaFoco) slotParaFoco.scrollIntoView({ block: "start", behavior: "smooth" });
      else if (isHoje && hhNow) {
        const elNow = listaHorariosEl.querySelector(`.agenda-slot[data-hora="${hhNow}"]`);
        if (elNow) elNow.scrollIntoView({ block: "start", behavior: "smooth" });
      }

      horaFocoDia = null;
    }

    function scrollToNow_() {
      const now = getNowSlot_();
      if (!now.hhmm) return;

      if (inputData.value !== now.dataStr) {
        inputData.value = now.dataStr;
        if (modoVisao === "dia") {
          horaFocoDia = now.hhmm;
          carregarAgendaDia();
        } else {
          carregarAgendaSemana();
        }
        return;
      }

      if (modoVisao === "dia") {
        const elNow = listaHorariosEl && listaHorariosEl.querySelector(`.agenda-slot[data-hora="${now.hhmm}"]`);
        if (elNow) elNow.scrollIntoView({ block: "start", behavior: "smooth" });
      } else {
        const marker = semanaGridEl && semanaGridEl.querySelector(`.semana-row[data-hora="${now.hhmm}"]`);
        if (marker) marker.scrollIntoView({ block: "start", behavior: "smooth" });
      }
    }

    // ===========================
    // Semana (grade completa)
    // ===========================
    async function carregarAgendaSemana() {
      const dataStr = inputData.value;
      if (!dataStr) return;

      const mySeq = ++reqSeqSemana;

      if (semanaGridEl) semanaGridEl.innerHTML = '<div class="agenda-loading">Carregando semana...</div>';

      try {
        await carregarAgendaConfigSeNecessario();

        // ✅ PASSO 1.1: consulta semanal agora usa action local (sem ISO/UTC)
        const data = await callApiData({
          action: "Agenda_ListarSemana",
          payload: { data_referencia: dataStr }
        });

        if (mySeq !== reqSeqSemana) return;

        // data = {dias:[{data:"YYYY-MM-DD", horarios:[{hora, agendamentos:[...]}]}]}
        const diasResp = data && data.dias ? data.dias : [];

        const agsUi = [];
        const byDayHour = {};

        diasResp.forEach((dia) => {
          const ds = dia && dia.data ? String(dia.data) : "";
          const horarios = dia && dia.horarios ? dia.horarios : [];

          if (!ds) return;

          horarios.forEach((h) => {
            const hh = h && h.hora ? String(h.hora) : "";
            const arr = h && h.agendamentos ? h.agendamentos : [];

            arr.forEach((ag) => {
              const ui = normalizeUiAg_(ag);
              if (!ui) return;

              // garante data/hora (alguns legados podem vir vazios)
              if (!ui.data) ui.data = ds;
              if (!ui.hora_inicio && hh) ui.hora_inicio = hh;

              agsUi.push(ui);

              const horaNorm = normalizeHora(ui.hora_inicio);
              if (!horaNorm) return;
              if (!byDayHour[ui.data]) byDayHour[ui.data] = {};
              if (!byDayHour[ui.data][horaNorm]) byDayHour[ui.data][horaNorm] = [];
              byDayHour[ui.data][horaNorm].push({ ...ui, __hora_norm: horaNorm });
            });
          });
        });

        agendamentosOriginaisSemana = agsUi;

        const dias = diasResp.map((d) => String(d.data || "")).filter(Boolean);

        const { slots } = getSlotsByConfig_();
        desenharSemanaGrid({ dias, slots, byDayHour });
      } catch (error) {
        if (mySeq !== reqSeqSemana) return;
        console.error(error);
        if (semanaGridEl) {
          const msg =
            "Não foi possível carregar a semana: " + (error && error.message ? error.message : String(error));
          semanaGridEl.innerHTML = "";
          const wrap = document.createElement("div");
          wrap.className = "agenda-erro";
          wrap.textContent = msg;
          semanaGridEl.appendChild(wrap);
        }
      }
    }

    function desenharSemanaGrid(ctx) {
      if (!semanaGridEl) return;
      semanaGridEl.innerHTML = "";

      const dias = ctx && ctx.dias ? ctx.dias : [];
      const slots = ctx && ctx.slots ? ctx.slots : [];
      const byDayHour = ctx && ctx.byDayHour ? ctx.byDayHour : {};

      if (!dias.length || !slots.length) {
        semanaGridEl.innerHTML = '<div class="agenda-vazia">Nenhum horário configurado para exibir.</div>';
        return;
      }

      const now = getNowSlot_();
      const { termo, statusFiltro } = getFiltroNormalized_();

      const headerRow = document.createElement("div");
      headerRow.className = "semana-row semana-header-row semana-sticky";
      headerRow.dataset.hora = "__header__";

      const corner = document.createElement("div");
      corner.className = "semana-cell semana-corner-cell semana-sticky-cell";
      corner.textContent = "";
      headerRow.appendChild(corner);

      // mantém o mesmo layout original (6 colunas) para não quebrar CSS existente
      dias.slice(0, 6).forEach((ds) => {
        const cell = document.createElement("div");
        cell.className = "semana-cell semana-header-cell semana-sticky-cell";
        cell.innerHTML = `
          <div class="semana-header-dia">${getDiaSemanaLabel(ds)}</div>
          <div class="semana-header-data">${formatDataBonita(ds)}</div>
        `;
        if (ds === now.dataStr) cell.classList.add("semana-header-today");
        headerRow.appendChild(cell);
      });

      semanaGridEl.appendChild(headerRow);

      slots.forEach((hora) => {
        const row = document.createElement("div");
        row.className = "semana-row";
        row.dataset.hora = hora;
        if (now.hhmm && hora === now.hhmm) row.classList.add("semana-row-now");

        const horaCell = document.createElement("div");
        horaCell.className = "semana-cell semana-hora-cell semana-sticky-col";
        horaCell.textContent = hora;
        row.appendChild(horaCell);

        dias.slice(0, 6).forEach((ds) => {
          const cell = document.createElement("div");
          cell.className = "semana-cell semana-slot-cell";
          if (ds === now.dataStr && now.hhmm && hora === now.hhmm) cell.classList.add("semana-slot-now");

          const agsNoHorario = ((byDayHour[ds] && byDayHour[ds][hora]) ? byDayHour[ds][hora] : [])
            .filter((ag) => matchesFiltro_(ag, termo, statusFiltro));

          if (agsNoHorario.length) {
            agsNoHorario.forEach((ag) => {
              const item = document.createElement("div");
              item.classList.add("semana-agenda-item");

              if (ag.bloqueio) {
                item.classList.add("semana-bloqueio-item");
                item.textContent = "Bloqueado";
              } else {
                const nome = ag.nome_paciente || "(sem nome)";
                const status = ag.status || "";
                const tipo = ag.tipo || "";
                const partes = [nome];
                if (tipo) partes.push(tipo);
                if (status) partes.push(status);
                item.textContent = partes.join(" • ");

                item.addEventListener("click", () => {
                  horaFocoDia = hora;
                  inputData.value = ds;
                  setVisao("dia");
                });
              }

              cell.appendChild(item);
            });
          } else {
            cell.classList.add("semana-slot-empty");
            cell.addEventListener("dblclick", () => {
              inputData.value = ds;
              setVisao("dia");
              setTimeout(() => abrirModalNovoAgendamento(hora), 50);
            });
          }

          row.appendChild(cell);
        });

        semanaGridEl.appendChild(row);
      });
    }

    // ===========================
    // Status (alinhado com backend)
    // ===========================
    const STATUS_OPTIONS = ["Agendado", "Confirmado", "Em atendimento", "Concluído", "Faltou", "Cancelado"];

    function normalizeStatusLabel_(s) {
      // aceita status UI e canônico backend
      const v = stripAccents(String(s || "")).trim().toLowerCase();
      if (!v) return "Agendado";

      // concluído/atendido
      if (v.includes("concl") || v.includes("atendid")) return "Concluído";

      // em atendimento
      if (v.includes("em_atend") || v.includes("em atend") || (v.includes("atend") && !v.includes("atendid"))) {
        return "Em atendimento";
      }

      // aguardando (backend canônico)
      if (v.includes("aguard")) return "Confirmado"; // melhor aproximação na UI atual

      // confirmado
      if (v.includes("confirm")) return "Confirmado";

      // faltou
      if (v.includes("falt")) return "Faltou";

      // cancelado
      if (v.includes("cancel")) return "Cancelado";

      // marcado/agendado
      if (v.includes("marc") || v.includes("agend")) return "Agendado";

      // remarcado (backend canônico) -> UI atual não tem opção, cai em Agendado
      if (v.includes("remarc")) return "Agendado";

      return "Agendado";
    }

    function mapStatusToBackend_(label) {
      // mantém compat com seu backend Agenda.gs (normaliza internamente)
      const v = stripAccents(String(label || "")).toLowerCase();
      if (v.includes("confirm")) return "CONFIRMADO";
      if (v.includes("em atend") || v.includes("em_atend")) return "EM_ATENDIMENTO";
      if (v.includes("atend") && !v.includes("concl")) return "EM_ATENDIMENTO";
      if (v.includes("concl")) return "CONCLUIDO"; // backend converte para ATENDIDO
      if (v.includes("falt")) return "FALTOU";
      if (v.includes("cancel")) return "CANCELADO";
      return "AGENDADO"; // backend converte para MARCADO
    }

    function getStatusClass(status) {
      if (!status) return "status-agendado";
      const s = stripAccents(String(status)).toLowerCase();

      if (s.includes("confirm")) return "status-confirmado";
      if (s.includes("em_atend") || s.includes("em atend") || (s.includes("atend") && !s.includes("atendid"))) {
        return "status-em-atendimento";
      }
      if (s.includes("falt")) return "status-falta";
      if (s.includes("cancel")) return "status-cancelado";
      if (s.includes("concl") || s.includes("atendid")) return "status-concluido";
      return "status-agendado";
    }

    function criarCartaoAgendamento(ag) {
      const card = document.createElement("div");
      card.className = "agendamento-card";
      card.classList.add(getStatusClass(ag.status));

      const linhaPrincipal = document.createElement("div");
      linhaPrincipal.className = "agendamento-linha-principal";

      const nomeWrap = document.createElement("div");
      nomeWrap.className = "agendamento-nome-wrap";

      const nome = document.createElement("span");
      nome.className = "agendamento-nome";
      nome.textContent = ag.nome_paciente || "(sem nome)";
      nomeWrap.appendChild(nome);

      const tipo = document.createElement("span");
      tipo.className = "agendamento-tipo";
      tipo.textContent = ag.tipo || "";

      linhaPrincipal.appendChild(nomeWrap);
      if (tipo.textContent) linhaPrincipal.appendChild(tipo);

      const linhaSecundaria = document.createElement("div");
      linhaSecundaria.className = "agendamento-linha-secundaria";

      const statusSelect = document.createElement("select");
      statusSelect.className = "agendamento-status-select";
      statusSelect.setAttribute("aria-label", "Alterar status do agendamento");

      STATUS_OPTIONS.forEach((opt) => {
        const o = document.createElement("option");
        o.value = opt;
        o.textContent = opt;
        statusSelect.appendChild(o);
      });

      statusSelect.value = normalizeStatusLabel_(ag.status);

      statusSelect.addEventListener("change", async () => {
        const novoStatus = statusSelect.value;
        await mudarStatusAgendamento(ag.ID_Agenda, novoStatus, card);
      });

      const canal = document.createElement("span");
      canal.className = "agendamento-canal";
      canal.textContent = ag.canal || "";

      linhaSecundaria.appendChild(statusSelect);
      if (canal.textContent) linhaSecundaria.appendChild(canal);

      const motivo = document.createElement("div");
      motivo.className = "agendamento-motivo";
      motivo.textContent = ag.motivo || "";

      card.appendChild(linhaPrincipal);
      card.appendChild(linhaSecundaria);
      if (motivo.textContent) card.appendChild(motivo);

      const acoes = document.createElement("div");
      acoes.className = "agendamento-acoes";

      const btnAtender = document.createElement("button");
      btnAtender.type = "button";
      btnAtender.className = "btn-status btn-status-atender";
      btnAtender.textContent = "Atender";
      btnAtender.addEventListener("click", () => abrirProntuario(ag));

      const btnEditar = document.createElement("button");
      btnEditar.type = "button";
      btnEditar.className = "btn-status btn-status-editar";
      btnEditar.textContent = "Editar";
      btnEditar.addEventListener("click", () => abrirModalEditarAgendamento(ag));

      acoes.appendChild(btnAtender);
      acoes.appendChild(btnEditar);
      card.appendChild(acoes);

      return card;
    }

    function criarCartaoBloqueio(ag) {
      const card = document.createElement("div");
      card.className = "agendamento-card bloqueio-card";

      const linhaPrincipal = document.createElement("div");
      linhaPrincipal.className = "agendamento-linha-principal";

      const label = document.createElement("span");
      label.className = "bloqueio-label";
      label.textContent = "Horário bloqueado";

      linhaPrincipal.appendChild(label);
      card.appendChild(linhaPrincipal);

      const info = document.createElement("div");
      info.className = "agendamento-motivo";
      info.textContent = `Das ${ag.hora_inicio} às ${ag.hora_fim}`;
      card.appendChild(info);

      const acoes = document.createElement("div");
      acoes.className = "agendamento-acoes";

      const btnRemover = document.createElement("button");
      btnRemover.type = "button";
      btnRemover.className = "btn-status btn-status-remover-bloqueio";
      btnRemover.textContent = "Remover bloqueio";
      btnRemover.addEventListener("click", () => removerBloqueio(ag.ID_Agenda, card));

      acoes.appendChild(btnRemover);
      card.appendChild(acoes);

      return card;
    }

    // ===========================
    // Prontuário (PASSO 3 + legado)
    // ===========================
    function abrirProntuario(ag) {
      if (!ag.ID_Paciente) {
        alert(
          "Este agendamento não está vinculado a um paciente cadastrado.\n\n" +
            "Selecione um paciente no agendamento para vincular ao prontuário."
        );
        return;
      }

      // PASSO 3: estado canônico (não quebra se core.state não existir)
      try {
        if (coreState && typeof coreState.setPacienteAtual === "function") {
          coreState.setPacienteAtual(String(ag.ID_Paciente));
        } else if (coreState && typeof coreState.set === "function") {
          coreState.set("pacienteAtualId", String(ag.ID_Paciente));
        }
        if (ag.ID_Agenda) {
          if (coreState && typeof coreState.setAgendaAtual === "function") {
            coreState.setAgendaAtual(String(ag.ID_Agenda));
          } else if (coreState && typeof coreState.set === "function") {
            coreState.set("agendaAtualId", String(ag.ID_Agenda));
          }
        }
      } catch (_) {}

      const infoPaciente = {
        ID_Paciente: ag.ID_Paciente,
        nome: ag.nome_paciente || "",
        documento: ag.documento_paciente || "",
        telefone: ag.telefone_paciente || ""
      };

      // Legado: mantém exatamente como estava (não quebrar fluxo antigo)
      try {
        localStorage.setItem("prontio.pacienteSelecionado", JSON.stringify(infoPaciente));
      } catch (e) {}

      const contextoProntuario = {
        ID_Paciente: ag.ID_Paciente,
        nome_paciente: ag.nome_paciente || "",
        documento_paciente: ag.documento_paciente || "",
        telefone_paciente: ag.telefone_paciente || "",
        ID_Agenda: ag.ID_Agenda || "",
        data: ag.data || "",
        hora_inicio: ag.hora_inicio || "",
        status: ag.status || "",
        tipo: ag.tipo || ""
      };

      try {
        localStorage.setItem("prontio.prontuarioContexto", JSON.stringify(contextoProntuario));
      } catch (e) {}

      const params = new URLSearchParams();
      params.set("idPaciente", ag.ID_Paciente);
      if (ag.ID_Agenda) params.set("idAgenda", ag.ID_Agenda);

      window.location.href = "prontuario.html?" + params.toString();
    }

    // ===========================
    // Ações (API)
    // ===========================
    async function mudarStatusAgendamento(ID_Agenda, novoStatus, cardEl) {
      if (!ID_Agenda) return;
      if (inFlight.statusById.has(ID_Agenda)) return;

      inFlight.statusById.add(ID_Agenda);
      if (cardEl) cardEl.classList.add("agendamento-atualizando");

      try {
        const backendStatus = mapStatusToBackend_(novoStatus);

        if (backendStatus === "CANCELADO") {
          await callApiData({
            action: "Agenda.Cancelar",
            payload: { idAgenda: ID_Agenda, motivo: "Cancelado pela agenda" }
          });
        } else {
          await callApiData({
            action: "Agenda.Atualizar",
            payload: { idAgenda: ID_Agenda, patch: { status: backendStatus } }
          });
        }

        if (modoVisao === "dia") await carregarAgendaDia();
        else await carregarAgendaSemana();
      } catch (error) {
        console.error(error);
        alert(
          "Erro ao mudar status do agendamento: " + (error && error.message ? error.message : String(error))
        );
        if (cardEl) cardEl.classList.remove("agendamento-atualizando");
      } finally {
        inFlight.statusById.delete(ID_Agenda);
      }
    }

    async function removerBloqueio(ID_Agenda, cardEl) {
      if (!ID_Agenda) return;
      if (inFlight.removerBloqById.has(ID_Agenda)) return;

      const confirma = confirm("Deseja realmente remover este bloqueio de horário?");
      if (!confirma) return;

      inFlight.removerBloqById.add(ID_Agenda);
      if (cardEl) cardEl.classList.add("agendamento-atualizando");

      try {
        await callApiData({
          action: "Agenda.Cancelar",
          payload: { idAgenda: ID_Agenda, motivo: "Bloqueio removido" }
        });

        if (modoVisao === "dia") await carregarAgendaDia();
        else await carregarAgendaSemana();
      } catch (error) {
        console.error(error);
        alert("Erro ao remover bloqueio: " + (error && error.message ? error.message : String(error)));
        if (cardEl) cardEl.classList.remove("agendamento-atualizando");
      } finally {
        inFlight.removerBloqById.delete(ID_Agenda);
      }
    }

    // ===========================
    // Pacientes (fallback modal)
    // ===========================
    function abrirModalPacientes() {
      if (inputBuscaPaciente) inputBuscaPaciente.value = "";
      if (msgPacientesEl) {
        msgPacientesEl.textContent = "Digite para buscar pacientes.";
        msgPacientesEl.className = "form-message info";
      }
      if (listaPacientesEl) listaPacientesEl.innerHTML = "";
      openModal(modalPacientes, inputBuscaPaciente);
    }

    function fecharModalPacientes() {
      closeModal(modalPacientes);
      if (inputBuscaPaciente) inputBuscaPaciente.value = "";
      if (listaPacientesEl) listaPacientesEl.innerHTML = "";
      if (msgPacientesEl) msgPacientesEl.textContent = "";
    }

    function aplicarPacienteSelecionado(p) {
      if (contextoSelecaoPaciente === "novo") {
        pacienteSelecionado = p;
        if (inputNomePaciente) inputNomePaciente.value = p ? p.nome : "";
        if (p && p.telefone && inputTelefone && !inputTelefone.value) inputTelefone.value = p.telefone;
        setPacienteSelecionadoNoCampo_(inputNomePaciente, p);
      } else {
        pacienteSelecionadoEditar = p;
        if (inputEditNomePaciente) inputEditNomePaciente.value = p ? p.nome : "";
        setPacienteSelecionadoNoCampo_(inputEditNomePaciente, p);
      }
    }

    function limparPacienteSelecionado() {
      pacienteSelecionado = null;
      if (inputNomePaciente) inputNomePaciente.value = "";
      setPacienteSelecionadoNoCampo_(inputNomePaciente, null);
    }

    function limparPacienteSelecionadoEditar() {
      pacienteSelecionadoEditar = null;
      if (inputEditNomePaciente) {
        inputEditNomePaciente.value = agendamentoEmEdicao ? agendamentoEmEdicao.nome_paciente || "" : "";
      }
      setPacienteSelecionadoNoCampo_(inputEditNomePaciente, null);
    }

    async function buscarPacientes(termo) {
      const t = String(termo || "").trim();
      if (!t || t.length < 2) {
        if (msgPacientesEl) {
          msgPacientesEl.textContent = "Digite pelo menos 2 caracteres para buscar.";
          msgPacientesEl.className = "form-message info";
        }
        if (listaPacientesEl) listaPacientesEl.innerHTML = "";
        return;
      }

      if (msgPacientesEl) {
        msgPacientesEl.textContent = "Buscando pacientes...";
        msgPacientesEl.className = "form-message info";
      }
      if (listaPacientesEl) listaPacientesEl.innerHTML = "";

      try {
        const data = await callApiData({
          action: "Pacientes_BuscarSimples",
          payload: { termo: t, limite: 30 }
        });

        const pacientes = data && data.pacientes ? data.pacientes : [];

        if (!pacientes.length) {
          if (msgPacientesEl) {
            msgPacientesEl.textContent = "Nenhum paciente encontrado para este termo.";
            msgPacientesEl.className = "form-message info";
          }
          if (listaPacientesEl) listaPacientesEl.innerHTML = "";
          return;
        }

        if (msgPacientesEl) {
          msgPacientesEl.textContent = "";
          msgPacientesEl.className = "form-message";
        }

        if (!listaPacientesEl) return;

        listaPacientesEl.innerHTML = "";
        pacientes.forEach((raw) => {
          const p = normalizePatientObj_(raw);
          const item = document.createElement("button");
          item.type = "button";
          item.className = "paciente-lista-item";

          const linha1 = document.createElement("div");
          linha1.className = "paciente-lista-nome";
          linha1.textContent = p.nome || "(sem nome)";

          const linha2 = document.createElement("div");
          linha2.className = "paciente-lista-detalhes";
          const partes = [];
          if (p.documento) partes.push(p.documento);
          if (p.telefone) partes.push(p.telefone);
          if (p.data_nascimento) partes.push("Nasc.: " + p.data_nascimento);
          linha2.textContent = partes.join(" • ");

          item.appendChild(linha1);
          item.appendChild(linha2);

          item.addEventListener("click", () => {
            aplicarPacienteSelecionado(p);
            fecharModalPacientes();
          });

          listaPacientesEl.appendChild(item);
        });
      } catch (error) {
        console.error(error);
        if (msgPacientesEl) {
          msgPacientesEl.textContent =
            "Erro ao buscar pacientes: " + (error && error.message ? error.message : String(error));
          msgPacientesEl.className = "form-message erro";
        }
        if (listaPacientesEl) listaPacientesEl.innerHTML = "";
      }
    }

    // ===========================
    // Modal: Novo
    // ===========================
    function abrirModalNovoAgendamento(horaPreSelecionada) {
      if (horaPreSelecionada && inputHoraInicio) inputHoraInicio.value = horaPreSelecionada;
      else if (inputHoraInicio && !inputHoraInicio.value) inputHoraInicio.value = "14:00";

      setFormMsg(mensagemNovoAgendamento, "", "");
      contextoSelecaoPaciente = "novo";
      safeDisable(btnSubmitNovo, false);

      if (chkNovoPermiteEncaixe) chkNovoPermiteEncaixe.checked = false;

      openModal(modalOverlay, inputHoraInicio || inputNomePaciente);
    }

    function fecharModalNovoAgendamento() {
      closeModal(modalOverlay);
      if (formNovoAgendamento) formNovoAgendamento.reset();
      if (inputDuracao) inputDuracao.value = 15;
      setFormMsg(mensagemNovoAgendamento, "", "");
      limparPacienteSelecionado();
      safeDisable(btnSubmitNovo, false);
    }

    async function salvarNovoAgendamento(event) {
      event.preventDefault();
      safeDisable(btnSubmitNovo, true);

      const dataStr = inputData.value;
      const horaStr = inputHoraInicio?.value;
      const duracao = parseInt(inputDuracao?.value || "0", 10);

      if (!dataStr || !horaStr || !duracao) {
        setFormMsg(mensagemNovoAgendamento, "Preencha data, hora inicial e duração.", "erro");
        safeDisable(btnSubmitNovo, false);
        return;
      }

      const permiteEncaixeUI = chkNovoPermiteEncaixe ? chkNovoPermiteEncaixe.checked === true : false;

      setFormMsg(mensagemNovoAgendamento, "Validando horário...", "info");
      const v = await preValidarConflito_({
        data: dataStr,
        hora_inicio: horaStr,
        duracao_minutos: duracao,
        ignoreIdAgenda: "",
        permite_encaixe: permiteEncaixeUI
      });

      if (!v.ok) {
        const msg = describeConflitos_(v);

        if (hasBloqueioInConflitos_(v)) {
          setFormMsg(mensagemNovoAgendamento, msg, "erro");
          safeDisable(btnSubmitNovo, false);
          return;
        }

        if (!permiteEncaixeUI) {
          setFormMsg(
            mensagemNovoAgendamento,
            msg + " Marque “Permitir encaixe” para salvar mesmo com conflito de consultas.",
            "erro"
          );
          safeDisable(btnSubmitNovo, false);
          return;
        }
      }

      const nomeLivre = (inputNomePaciente?.value || "").trim();
      const vinculado = pacienteSelecionado && pacienteSelecionado.ID_Paciente;

      if (!vinculado && nomeLivre) {
        setFormMsg(
          mensagemNovoAgendamento,
          "Aviso: paciente digitado sem seleção. O agendamento será salvo sem vínculo ao cadastro.",
          "info"
        );
      }

      const payload = {
        data: dataStr,
        hora_inicio: horaStr,
        duracao_minutos: duracao,
        ID_Paciente: vinculado ? pacienteSelecionado.ID_Paciente : "",
        motivo: inputMotivo?.value || "",
        tipo: inputTipo?.value || "",
        origem: inputOrigem?.value || "",
        permitirEncaixe: permiteEncaixeUI,
        permite_encaixe: permiteEncaixeUI
      };

      setTimeout(() => setFormMsg(mensagemNovoAgendamento, "Salvando...", "info"), 120);

      try {
        await callApiData({ action: "Agenda.Criar", payload });
        setFormMsg(mensagemNovoAgendamento, "Agendamento criado com sucesso!", "sucesso");
        await carregarAgendaDia();
        setTimeout(() => fecharModalNovoAgendamento(), 650);
      } catch (error) {
        console.error(error);
        setFormMsg(
          mensagemNovoAgendamento,
          "Erro ao salvar agendamento: " + (error && error.message ? error.message : String(error)),
          "erro"
        );
        safeDisable(btnSubmitNovo, false);
      }
    }

    // ===========================
    // Modal: Editar
    // ===========================
    function abrirModalEditarAgendamento(ag) {
      agendamentoEmEdicao = ag;

      pacienteSelecionadoEditar = null;
      if (ag && ag.ID_Paciente) {
        pacienteSelecionadoEditar = {
          ID_Paciente: ag.ID_Paciente,
          nome: ag.nome_paciente || "",
          documento: ag.documento_paciente || "",
          telefone: ag.telefone_paciente || ""
        };
      }

      contextoSelecaoPaciente = "editar";

      if (inputEditIdAgenda) inputEditIdAgenda.value = ag.ID_Agenda || "";
      if (inputEditData) inputEditData.value = ag.data || inputData.value || "";
      if (inputEditHoraInicio) inputEditHoraInicio.value = ag.hora_inicio || "";
      if (inputEditDuracao) inputEditDuracao.value = ag.duracao_minutos || 15;

      if (inputEditNomePaciente) inputEditNomePaciente.value = ag.nome_paciente || "";
      setPacienteSelecionadoNoCampo_(inputEditNomePaciente, pacienteSelecionadoEditar);

      if (inputEditTipo) inputEditTipo.value = ag.tipo || "";
      if (inputEditMotivo) inputEditMotivo.value = ag.motivo || "";
      if (inputEditOrigem) inputEditOrigem.value = ag.origem || "";
      if (inputEditCanal) inputEditCanal.value = ag.canal || "";

      if (chkEditPermiteEncaixe) chkEditPermiteEncaixe.checked = ag && ag.permite_encaixe === true;

      setFormMsg(msgEditarAgendamento, "", "");
      safeDisable(btnSubmitEditar, false);
      openModal(modalEdit, inputEditHoraInicio || inputEditNomePaciente);
    }

    function fecharModalEditarAgendamento() {
      closeModal(modalEdit);
      if (formEditarAgendamento) formEditarAgendamento.reset();
      agendamentoEmEdicao = null;
      pacienteSelecionadoEditar = null;
      setFormMsg(msgEditarAgendamento, "", "");
      safeDisable(btnSubmitEditar, false);
      setPacienteSelecionadoNoCampo_(inputEditNomePaciente, null);
    }

    async function salvarEdicaoAgendamento(event) {
      event.preventDefault();
      safeDisable(btnSubmitEditar, true);

      const idAgenda = inputEditIdAgenda?.value || "";
      if (!idAgenda) {
        setFormMsg(msgEditarAgendamento, "Agendamento inválido para edição.", "erro");
        safeDisable(btnSubmitEditar, false);
        return;
      }

      const dataStr = inputEditData?.value;
      const horaStr = inputEditHoraInicio?.value;
      const duracao = parseInt(inputEditDuracao?.value || "0", 10);

      if (!dataStr || !horaStr || !duracao) {
        setFormMsg(msgEditarAgendamento, "Preencha data, hora inicial e duração.", "erro");
        safeDisable(btnSubmitEditar, false);
        return;
      }

      const permiteEncaixeUI = chkEditPermiteEncaixe ? chkEditPermiteEncaixe.checked === true : false;

      setFormMsg(msgEditarAgendamento, "Validando horário...", "info");
      const v = await preValidarConflito_({
        data: dataStr,
        hora_inicio: horaStr,
        duracao_minutos: duracao,
        ignoreIdAgenda: idAgenda,
        permite_encaixe: permiteEncaixeUI
      });

      if (!v.ok) {
        const msg = describeConflitos_(v);

        if (hasBloqueioInConflitos_(v)) {
          setFormMsg(msgEditarAgendamento, msg, "erro");
          safeDisable(btnSubmitEditar, false);
          return;
        }

        if (!permiteEncaixeUI) {
          setFormMsg(
            msgEditarAgendamento,
            msg + " Marque “Permitir encaixe” para salvar mesmo com conflito de consultas.",
            "erro"
          );
          safeDisable(btnSubmitEditar, false);
          return;
        }
      }

      const payload = {
        idAgenda: idAgenda,
        permitirEncaixe: permiteEncaixeUI,
        permite_encaixe: permiteEncaixeUI,
        data: dataStr,
        hora_inicio: horaStr,
        duracao_minutos: duracao,
        tipo: inputEditTipo?.value || "",
        motivo: inputEditMotivo?.value || "",
        origem: inputEditOrigem?.value || ""
      };

      if (pacienteSelecionadoEditar && pacienteSelecionadoEditar.ID_Paciente) {
        payload.ID_Paciente = pacienteSelecionadoEditar.ID_Paciente;
      } else {
        payload.ID_Paciente = "";
      }

      setTimeout(() => setFormMsg(msgEditarAgendamento, "Salvando alterações...", "info"), 120);

      try {
        await callApiData({ action: "Agenda.Atualizar", payload });
        setFormMsg(msgEditarAgendamento, "Agendamento atualizado com sucesso!", "sucesso");

        if (modoVisao === "dia") await carregarAgendaDia();
        else await carregarAgendaSemana();

        setTimeout(() => fecharModalEditarAgendamento(), 650);
      } catch (error) {
        console.error(error);
        setFormMsg(
          msgEditarAgendamento,
          "Erro ao atualizar agendamento: " + (error && error.message ? error.message : String(error)),
          "erro"
        );
        safeDisable(btnSubmitEditar, false);
      }
    }

    // ===========================
    // Modal: Bloqueio
    // ===========================
    function abrirModalBloqueio(horaPreSelecionada) {
      if (horaPreSelecionada && inputBloqHoraInicio) inputBloqHoraInicio.value = horaPreSelecionada;
      else if (inputBloqHoraInicio && !inputBloqHoraInicio.value) inputBloqHoraInicio.value = "12:00";

      setFormMsg(mensagemBloqueio, "", "");
      safeDisable(btnSubmitBloqueio, false);

      openModal(modalBloqueio, inputBloqHoraInicio);
    }

    function fecharModalBloqueio() {
      closeModal(modalBloqueio);
      if (formBloqueio) formBloqueio.reset();
      if (inputBloqDuracao) inputBloqDuracao.value = 60;
      setFormMsg(mensagemBloqueio, "", "");
      safeDisable(btnSubmitBloqueio, false);
    }

    async function salvarBloqueio(event) {
      event.preventDefault();
      safeDisable(btnSubmitBloqueio, true);

      const dataStr = inputData.value;
      const horaStr = inputBloqHoraInicio?.value;
      const duracao = parseInt(inputBloqDuracao?.value || "0", 10);

      if (!dataStr || !horaStr || !duracao) {
        setFormMsg(mensagemBloqueio, "Preencha hora inicial e duração.", "erro");
        safeDisable(btnSubmitBloqueio, false);
        return;
      }

      setFormMsg(mensagemBloqueio, "Validando horário...", "info");
      const v = await preValidarConflito_({
        data: dataStr,
        hora_inicio: horaStr,
        duracao_minutos: duracao,
        ignoreIdAgenda: "",
        permite_encaixe: false
      });

      if (!v.ok) {
        const msg = describeConflitos_(v);
        setFormMsg(mensagemBloqueio, msg, "erro");
        safeDisable(btnSubmitBloqueio, false);
        return;
      }

      const payload = {
        data: dataStr,
        hora_inicio: horaStr,
        duracao_minutos: duracao,
        Bloqueio: true,
        tipo: "BLOQUEIO",
        motivo: "Bloqueio de horário",
        permitirEncaixe: false
      };

      setFormMsg(mensagemBloqueio, "Salvando bloqueio...", "info");

      try {
        await callApiData({ action: "Agenda.Criar", payload });
        setFormMsg(mensagemBloqueio, "Horário bloqueado com sucesso!", "sucesso");

        if (modoVisao === "dia") await carregarAgendaDia();
        else await carregarAgendaSemana();

        setTimeout(() => fecharModalBloqueio(), 650);
      } catch (error) {
        console.error(error);
        setFormMsg(
          mensagemBloqueio,
          "Erro ao salvar bloqueio: " + (error && error.message ? error.message : String(error)),
          "erro"
        );
        safeDisable(btnSubmitBloqueio, false);
      }
    }

    // ===========================
    // Inicializa typeahead nos inputs de paciente
    // ===========================
    attachPatientTypeahead_({
      inputEl: inputNomePaciente,
      getSelected: () => pacienteSelecionado,
      setSelected: (p) => (pacienteSelecionado = p),
      onSelected: (p) => {
        if (p && p.telefone && inputTelefone && !String(inputTelefone.value || "").trim()) {
          inputTelefone.value = p.telefone;
        }
      },
      onManualTyping: () => {}
    });

    attachPatientTypeahead_({
      inputEl: inputEditNomePaciente,
      getSelected: () => pacienteSelecionadoEditar,
      setSelected: (p) => (pacienteSelecionadoEditar = p),
      onSelected: () => {},
      onManualTyping: () => {}
    });

    // ===========================
    // Filtros (persistidos)
    // ===========================
    function setFiltros_(nome, status) {
      filtrosState.nome = String(nome || "");
      filtrosState.status = String(status || "");
      saveFiltros_();
    }

    let filtroDebounce = null;
    function onFiltrosChanged_() {
      if (filtroDebounce) clearTimeout(filtroDebounce);
      filtroDebounce = setTimeout(() => {
        if (modoVisao === "dia") aplicarFiltrosDia();
        else carregarAgendaSemana();
      }, 120);
    }

    function limparFiltros_() {
      setFiltros_("", "");
      applyFiltrosToUI_();
      if (modoVisao === "dia") aplicarFiltrosDia();
      else carregarAgendaSemana();
    }

    // =====================
    // Listeners gerais
    // =====================
    inputData.addEventListener("change", () => (modoVisao === "dia" ? carregarAgendaDia() : carregarAgendaSemana()));

    btnHoje &&
      btnHoje.addEventListener("click", () => {
        setToday();
        modoVisao === "dia" ? carregarAgendaDia() : carregarAgendaSemana();
      });

    btnAgora && btnAgora.addEventListener("click", () => scrollToNow_());

    btnDiaAnterior &&
      btnDiaAnterior.addEventListener("click", () => {
        if (!inputData.value) return;
        const d = parseInputDate(inputData.value);
        if (modoVisao === "semana") d.setDate(d.getDate() - 7);
        else d.setDate(d.getDate() - 1);
        inputData.value = formatDateToInput(d);
        modoVisao === "dia" ? carregarAgendaDia() : carregarAgendaSemana();
      });

    btnDiaPosterior &&
      btnDiaPosterior.addEventListener("click", () => {
        if (!inputData.value) return;
        const d = parseInputDate(inputData.value);
        if (modoVisao === "semana") d.setDate(d.getDate() + 7);
        else d.setDate(d.getDate() + 1);
        inputData.value = formatDateToInput(d);
        modoVisao === "dia" ? carregarAgendaDia() : carregarAgendaSemana();
      });

    btnVisaoDia && btnVisaoDia.addEventListener("click", () => setVisao("dia"));
    btnVisaoSemana && btnVisaoSemana.addEventListener("click", () => setVisao("semana"));

    inputFiltroNome &&
      inputFiltroNome.addEventListener("input", () => {
        setFiltros_(inputFiltroNome.value, selectFiltroStatus ? selectFiltroStatus.value : "");
        onFiltrosChanged_();
      });

    inputFiltroNome &&
      inputFiltroNome.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onFiltrosChanged_();
        }
      });

    selectFiltroStatus &&
      selectFiltroStatus.addEventListener("change", () => {
        setFiltros_(inputFiltroNome ? inputFiltroNome.value : "", selectFiltroStatus.value);
        onFiltrosChanged_();
      });

    btnLimparFiltros && btnLimparFiltros.addEventListener("click", () => limparFiltros_());

    btnNovoAgendamento && btnNovoAgendamento.addEventListener("click", () => abrirModalNovoAgendamento());
    btnBloquearHorario && btnBloquearHorario.addEventListener("click", () => abrirModalBloqueio());

    // Modal Novo
    btnFecharModal && btnFecharModal.addEventListener("click", () => fecharModalNovoAgendamento());
    btnCancelarModal && btnCancelarModal.addEventListener("click", () => fecharModalNovoAgendamento());
    modalOverlay &&
      modalOverlay.addEventListener("click", (event) => {
        if (event.target === modalOverlay) fecharModalNovoAgendamento();
      });
    formNovoAgendamento && formNovoAgendamento.addEventListener("submit", salvarNovoAgendamento);

    // Modal Editar
    btnFecharModalEditar && btnFecharModalEditar.addEventListener("click", () => fecharModalEditarAgendamento());
    btnCancelarEditar && btnCancelarEditar.addEventListener("click", () => fecharModalEditarAgendamento());
    modalEdit &&
      modalEdit.addEventListener("click", (event) => {
        if (event.target === modalEdit) fecharModalEditarAgendamento();
      });
    formEditarAgendamento && formEditarAgendamento.addEventListener("submit", salvarEdicaoAgendamento);

    // Modal Bloqueio
    btnFecharModalBloqueio && btnFecharModalBloqueio.addEventListener("click", () => fecharModalBloqueio());
    btnCancelarBloqueio && btnCancelarBloqueio.addEventListener("click", () => fecharModalBloqueio());
    modalBloqueio &&
      modalBloqueio.addEventListener("click", (event) => {
        if (event.target === modalBloqueio) fecharModalBloqueio();
      });
    formBloqueio && formBloqueio.addEventListener("submit", salvarBloqueio);

    // Modal Pacientes (fallback)
    btnSelecionarPaciente &&
      btnSelecionarPaciente.addEventListener("click", () => {
        contextoSelecaoPaciente = "novo";
        abrirModalPacientes();
      });

    btnLimparPaciente && btnLimparPaciente.addEventListener("click", () => limparPacienteSelecionado());

    btnEditSelecionarPaciente &&
      btnEditSelecionarPaciente.addEventListener("click", () => {
        contextoSelecaoPaciente = "editar";
        abrirModalPacientes();
      });

    btnEditLimparPaciente && btnEditLimparPaciente.addEventListener("click", () => limparPacienteSelecionadoEditar());

    btnFecharModalPacientes && btnFecharModalPacientes.addEventListener("click", () => fecharModalPacientes());
    modalPacientes &&
      modalPacientes.addEventListener("click", (event) => {
        if (event.target === modalPacientes) fecharModalPacientes();
      });

    inputBuscaPaciente &&
      inputBuscaPaciente.addEventListener("input", () => {
        const termo = inputBuscaPaciente.value;
        if (buscaPacienteTimeout) clearTimeout(buscaPacienteTimeout);
        buscaPacienteTimeout = setTimeout(() => buscarPacientes(termo), 300);
      });

    // ESC fecha qualquer modal aberto
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;

      if (isModalVisible(modalPacientes)) return fecharModalPacientes();
      if (isModalVisible(modalBloqueio)) return fecharModalBloqueio();
      if (isModalVisible(modalEdit)) return fecharModalEditarAgendamento();
      if (isModalVisible(modalOverlay)) return fecharModalNovoAgendamento();
    });

    // =====================
    // Inicialização
    // =====================
    applyFiltrosToUI_();
    if (!inputData.value) setToday();
    setVisao(modoVisao);
  }

  if (typeof PRONTIO.registerPage === "function") {
    PRONTIO.registerPage("agenda", initAgendaPage);
  } else {
    PRONTIO.pages = PRONTIO.pages || {};
    PRONTIO.pages.agenda = { init: initAgendaPage };
  }
})(window, document);
