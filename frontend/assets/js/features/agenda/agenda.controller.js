// frontend/assets/js/features/agenda/agenda.controller.js
/**
 * PRONTIO — Agenda Controller (Front)
 * ------------------------------------------------------------
 * Modelo ouro (replicável):
 * - Agenda: usa SOMENTE AgendaApi (features/agenda/agenda.api.js) com actions canônicas.
 * - Pacientes: usa SOMENTE PacientesApi (features/pacientes/pacientes.api.js).
 * - View: render/estado visual (features/agenda/agenda.view.js).
 * - Formatters: helpers puros (features/agenda/agenda.formatters.js).
 * - Widgets: typeahead genérico (assets/js/widgets/widget-typeahead.js).
 */

(function (global) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.features = PRONTIO.features || {};
  PRONTIO.features.agenda = PRONTIO.features.agenda || {};

  const FX = PRONTIO.features.agenda.formatters;
  const createAgendaApi = PRONTIO.features.agenda.api && PRONTIO.features.agenda.api.createAgendaApi;
  const createAgendaView = PRONTIO.features.agenda.view && PRONTIO.features.agenda.view.createAgendaView;

  const createPacientesPicker =
    PRONTIO.features &&
    PRONTIO.features.pacientes &&
    PRONTIO.features.pacientes.picker &&
    typeof PRONTIO.features.pacientes.picker.createPacientesPicker === "function"
      ? PRONTIO.features.pacientes.picker.createPacientesPicker
      : null;

  const createPacientesApi =
    PRONTIO.features &&
    PRONTIO.features.pacientes &&
    PRONTIO.features.pacientes.api &&
    typeof PRONTIO.features.pacientes.api.createPacientesApi === "function"
      ? PRONTIO.features.pacientes.api.createPacientesApi
      : null;

  const attachTypeahead =
    PRONTIO.widgets &&
    PRONTIO.widgets.typeahead &&
    typeof PRONTIO.widgets.typeahead.attach === "function"
      ? PRONTIO.widgets.typeahead.attach
      : null;

  function createAgendaController(env) {
    const agendaApi = createAgendaApi ? createAgendaApi(PRONTIO) : null;
    const pacientesApi = createPacientesApi ? createPacientesApi(PRONTIO) : null;

    const view = createAgendaView ? createAgendaView({ document: env && env.document ? env.document : document }) : null;

    const state = {
      modoVisao: (localStorage.getItem("prontio.agenda.modoVisao") === "semana") ? "semana" : "dia",
      filtros: loadFiltros_("prontio.agenda.filtros.v1"),
      dataSelecionada: "",

      agsDiaUi: [],
      horaFocoDia: null,

      pacienteNovo: null,
      pacienteEditar: null,
      agendamentoEmEdicao: null,

      reqSeqDia: 0,
      reqSeqSemana: 0,
      inFlightStatus: new Set(),
      inFlightDesbloq: new Set(),

      config: {
        hora_inicio_padrao: "08:00",
        hora_fim_padrao: "18:00",
        duracao_grade_minutos: 15
      },
      configCarregada: false
    };

    let dom = null;
    let pacientesPicker = null;

    let detachTypeaheadNovo = null;
    let detachTypeaheadEditar = null;

    // =========================
    // Storage filtros
    // =========================
    function loadFiltros_(key) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return { nome: "", status: "" };
        const obj = JSON.parse(raw);
        return {
          nome: String(obj && obj.nome ? obj.nome : ""),
          status: String(obj && obj.status ? obj.status : "")
        };
      } catch (_) {
        return { nome: "", status: "" };
      }
    }

    function saveFiltros_() {
      try {
        localStorage.setItem("prontio.agenda.filtros.v1", JSON.stringify(state.filtros));
      } catch (_) {}
    }

    // =========================
    // Helpers gerais
    // =========================
    function setTodayIfEmpty_() {
      if (!dom || !dom.inputData) return;
      if (!dom.inputData.value) dom.inputData.value = FX.formatDateToInput(new Date());
      state.dataSelecionada = dom.inputData.value;
    }

    function getSlotsByConfig_() {
      const inicioMin = FX.timeToMinutes(state.config.hora_inicio_padrao) ?? 8 * 60;
      const fimMin = FX.timeToMinutes(state.config.hora_fim_padrao) ?? 18 * 60;
      const passo = parseInt(String(state.config.duracao_grade_minutos || 15), 10) || 15;

      const slots = [];
      for (let t = inicioMin; t <= fimMin; t += passo) slots.push(FX.minutesToTime(t));
      return { slots, inicioMin, fimMin, passo };
    }

    function getNowSlot_() {
      const now = new Date();
      const dataStr = FX.formatDateToInput(now);
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const { slots, inicioMin, fimMin, passo } = getSlotsByConfig_();
      if (nowMin < inicioMin || nowMin > fimMin) return { dataStr, hhmm: null };
      const idx = FX.clamp(Math.floor((nowMin - inicioMin) / passo), 0, slots.length - 1);
      return { dataStr, hhmm: slots[idx] || null };
    }

    function getFiltroNormalized_() {
      const termo = FX.stripAccents(state.filtros.nome || "").toLowerCase().trim();
      const statusFiltro = FX.stripAccents(state.filtros.status || "").toLowerCase().trim();
      return { termo, statusFiltro };
    }

    function matchesFiltroStatus_(statusValue, statusFiltro) {
      if (!statusFiltro) return true;
      const s = FX.stripAccents(String(statusValue || "")).toLowerCase();

      if (statusFiltro.includes("concl")) return s.includes("concl") || s.includes("atendid");
      if (statusFiltro.includes("agend")) return s.includes("agend") || s.includes("marc");
      if (statusFiltro.includes("em atendimento") || statusFiltro.includes("em_atend") || statusFiltro.includes("atend")) {
        return s.includes("em_atend") || s.includes("em atend") || (s.includes("atend") && !s.includes("atendid"));
      }
      return s.includes(statusFiltro);
    }

    function matchesFiltro_(ag, termo, statusFiltro) {
      if (!ag) return false;
      if (termo) {
        const nome = FX.stripAccents(String(ag.nome_paciente || "")).toLowerCase();
        if (!nome.includes(termo)) return false;
      }
      if (statusFiltro) return matchesFiltroStatus_(ag.status, statusFiltro);
      return true;
    }

    // =========================
    // Config (canônico)
    // =========================
    async function ensureConfigLoaded_() {
      if (state.configCarregada) return;
      try {
        if (!agendaApi || typeof agendaApi.configObter !== "function") throw new Error("AgendaApi.configObter indisponível.");
        const data = await agendaApi.configObter();
        if (data && typeof data === "object") {
          state.config.hora_inicio_padrao = data.hora_inicio_padrao || state.config.hora_inicio_padrao;
          state.config.hora_fim_padrao = data.hora_fim_padrao || state.config.hora_fim_padrao;
          const dur = parseInt(String(data.duracao_grade_minutos || ""), 10);
          if (isFinite(dur) && dur > 0) state.config.duracao_grade_minutos = dur;
        }
      } catch (err) {
        console.warn("[AgendaController] config indisponível, usando defaults:", err);
      } finally {
        state.configCarregada = true;
      }
    }

    // =========================
    // Render Dia (via View)
    // =========================
    function renderDia_() {
      if (!view || !dom) return;

      const dataStr = dom.inputData.value;
      const { termo, statusFiltro } = getFiltroNormalized_();
      const { slots } = getSlotsByConfig_();
      const now = getNowSlot_();
      const isHoje = now.dataStr === dataStr;

      view.setResumo(FX.computeResumoDia(state.agsDiaUi || []));

      const map = new Map();
      (state.agsDiaUi || []).forEach((ag) => {
        const hora = FX.normalizeHora(ag.hora_inicio);
        if (!hora) return;
        if (!matchesFiltro_(ag, termo, statusFiltro)) return;
        if (!map.has(hora)) map.set(hora, []);
        map.get(hora).push(ag);
      });

      view.renderDaySlots({
        slots,
        map,
        now,
        isHoje,
        horaFoco: state.horaFocoDia,
        callbacks: {
          onNovo: (hora) => actions.abrirModalNovo(hora),
          onBloquear: (hora) => actions.abrirModalBloqueio(hora),
          onAtender: (ag) => actions.abrirProntuario(ag),
          onEditar: (ag) => actions.abrirModalEditar(ag),
          onChangeStatus: (idAgenda, novoLabel, cardEl) => actions.mudarStatus(idAgenda, novoLabel, cardEl),
          onDesbloquear: (idAgenda, cardEl) => actions.desbloquear(idAgenda, cardEl)
        }
      });

      state.horaFocoDia = null;
    }

    // =========================
    // Load Dia/Semana (AgendaApi.listar)
    // =========================
    async function carregarDia_() {
      if (!dom) return;
      const dataStr = dom.inputData.value;
      if (!dataStr) return;

      const mySeq = ++state.reqSeqDia;
      await ensureConfigLoaded_();
      view && view.showDayLoading && view.showDayLoading();

      try {
        if (!agendaApi || typeof agendaApi.listar !== "function") throw new Error("AgendaApi.listar indisponível.");

        const data = await agendaApi.listar({
          periodo: { inicio: dataStr, fim: dataStr },
          filtros: { incluirCancelados: false }
        });

        if (mySeq !== state.reqSeqDia) return;

        const itemsDto = (data && data.items) ? data.items : [];
        state.agsDiaUi = (itemsDto || [])
          .map(FX.dtoToUi)
          .filter(Boolean)
          .filter((x) => x.data === dataStr);

        renderDia_();
      } catch (err) {
        if (mySeq !== state.reqSeqDia) return;
        console.error(err);
        view && view.showDayError && view.showDayError("Não foi possível carregar a agenda do dia: " + (err.message || String(err)));
      } finally {
        view && view.hideDayLoading && view.hideDayLoading();
      }
    }

    async function carregarSemana_() {
      if (!dom || !view) return;
      const refStr = dom.inputData.value;
      if (!refStr) return;

      const mySeq = ++state.reqSeqSemana;
      await ensureConfigLoaded_();

      if (view.refs && view.refs.semanaGridEl) view.refs.semanaGridEl.innerHTML = '<div class="agenda-loading">Carregando semana...</div>';

      try {
        if (!agendaApi || typeof agendaApi.listar !== "function") throw new Error("AgendaApi.listar indisponível.");

        const per = FX.weekPeriodFrom(refStr);
        const data = await agendaApi.listar({
          periodo: { inicio: per.inicio, fim: per.fim },
          filtros: { incluirCancelados: false }
        });

        if (mySeq !== state.reqSeqSemana) return;

        const itemsDto = (data && data.items) ? data.items : [];
        const agsUi = (itemsDto || []).map(FX.dtoToUi).filter(Boolean);

        const { termo, statusFiltro } = getFiltroNormalized_();
        const byDayHour = {};

        agsUi.forEach((ui) => {
          if (!ui || !ui.data) return;
          const horaNorm = FX.normalizeHora(ui.hora_inicio);
          if (!horaNorm) return;
          if (!matchesFiltro_(ui, termo, statusFiltro)) return;

          if (!byDayHour[ui.data]) byDayHour[ui.data] = {};
          if (!byDayHour[ui.data][horaNorm]) byDayHour[ui.data][horaNorm] = [];
          byDayHour[ui.data][horaNorm].push(ui);
        });

        const { slots } = getSlotsByConfig_();
        const now = getNowSlot_();

        view.renderWeekGrid({
          dias: per.dias,
          slots,
          byDayHour,
          now,
          callbacks: {
            onIrParaDia: (ds, hora) => {
              state.horaFocoDia = hora;
              dom.inputData.value = ds;
              actions.setVisao("dia");
            },
            onDblClickNovo: (ds, hora) => {
              dom.inputData.value = ds;
              actions.setVisao("dia");
              setTimeout(() => actions.abrirModalNovo(hora), 50);
            }
          }
        });
      } catch (err) {
        if (mySeq !== state.reqSeqSemana) return;
        console.error(err);
        if (view.refs && view.refs.semanaGridEl) {
          view.refs.semanaGridEl.innerHTML = "";
          const wrap = (env && env.document ? env.document : document).createElement("div");
          wrap.className = "agenda-erro";
          wrap.textContent = "Não foi possível carregar a semana: " + (err.message || String(err));
          view.refs.semanaGridEl.appendChild(wrap);
        }
      }
    }

    // =========================
    // Validar conflito (AgendaApi.validarConflito)
    // =========================
    async function validarConflito_(payload) {
      if (!agendaApi || typeof agendaApi.validarConflito !== "function") return { ok: true, conflitos: [] };

      try {
        await agendaApi.validarConflito(payload);
        return { ok: true, conflitos: [] };
      } catch (e) {
        const code = e && e.code ? String(e.code) : "";
        const msg = e && e.message ? String(e.message) : "Conflito de horário.";
        const conflitos = [];

        try {
          const det = e && e.details ? e.details : null;
          const arr = det && det.conflitos ? det.conflitos : null;
          if (arr && arr.length) {
            for (let i = 0; i < arr.length; i++) {
              const c = arr[i];
              const hi = c && c.inicio ? FX.hhmmFromIso(c.inicio) : "";
              const hf = c && c.fim ? FX.hhmmFromIso(c.fim) : "";
              const isBloq = String(c && c.tipo ? c.tipo : "").toUpperCase().indexOf("BLOQ") >= 0;
              conflitos.push({ bloqueio: isBloq, hora_inicio: hi, hora_fim: hf });
            }
          }
        } catch (_) {}

        if (code === "CONFLICT") return { ok: false, erro: msg, conflitos, code };
        return { ok: true, conflitos: [] };
      }
    }

    function describeConflitos_(r) {
      if (!r) return "Conflito de horário.";
      const conflitos = Array.isArray(r.conflitos) ? r.conflitos : [];
      if (!conflitos.length) return (r.erro || "Conflito de horário.");

      const top = conflitos.slice(0, 2).map((c) => {
        const tipo = c.bloqueio ? "Bloqueio" : "Consulta";
        const hi = c.hora_inicio || "?";
        const hf = c.hora_fim || "?";
        return `${tipo} ${hi}–${hf}`;
      });

      const extra = conflitos.length > 2 ? ` (+${conflitos.length - 2})` : "";
      return `Conflito no horário. ${top.join(" | ")}${extra}`;
    }

    function hasBloqueio_(r) {
      const conflitos = Array.isArray(r && r.conflitos) ? r.conflitos : [];
      return conflitos.some((c) => c && c.bloqueio === true);
    }

    // =========================
    // Typeahead (widget) + PacientesApi
    // =========================
    function setupTypeahead_() {
      if (!attachTypeahead) {
        console.warn("[AgendaController] widget-typeahead não carregado.");
        return;
      }
      if (!pacientesApi || typeof pacientesApi.buscarSimples !== "function") {
        console.warn("[AgendaController] PacientesApi indisponível.");
        return;
      }

      function renderPaciente(p) {
        const parts = [];
        if (p.documento) parts.push(p.documento);
        if (p.telefone) parts.push(p.telefone);
        if (p.data_nascimento) parts.push("Nasc.: " + p.data_nascimento);
        return { title: p.nome || "(sem nome)", subtitle: parts.join(" • ") };
      }

      function invalidateIfMismatch(inputEl, selectedGetter, selectedClear) {
        const typed = String(inputEl.value || "").trim();
        const sel = selectedGetter();
        const selNome = sel && sel.nome ? String(sel.nome).trim() : "";
        if (!typed || !sel) return;
        if (typed !== selNome) selectedClear();
      }

      if (dom.novoNomePaciente) {
        detachTypeaheadNovo && detachTypeaheadNovo();
        detachTypeaheadNovo = attachTypeahead({
          inputEl: dom.novoNomePaciente,
          minChars: 2,
          debounceMs: 220,
          fetchItems: async (q) => {
            const data = await pacientesApi.buscarSimples(q, 12);
            return (data && data.pacientes) ? data.pacientes : [];
          },
          renderItem: renderPaciente,
          onInputChanged: () => {
            invalidateIfMismatch(dom.novoNomePaciente, () => state.pacienteNovo, () => { state.pacienteNovo = null; });
          },
          onSelect: (p) => {
            state.pacienteNovo = p;
            dom.novoNomePaciente.value = p.nome || "";
            if (p.telefone && dom.novoTelefone && !String(dom.novoTelefone.value || "").trim()) {
              dom.novoTelefone.value = p.telefone;
            }
          }
        });
      }

      if (dom.editNomePaciente) {
        detachTypeaheadEditar && detachTypeaheadEditar();
        detachTypeaheadEditar = attachTypeahead({
          inputEl: dom.editNomePaciente,
          minChars: 2,
          debounceMs: 220,
          fetchItems: async (q) => {
            const data = await pacientesApi.buscarSimples(q, 12);
            return (data && data.pacientes) ? data.pacientes : [];
          },
          renderItem: renderPaciente,
          onInputChanged: () => {
            invalidateIfMismatch(dom.editNomePaciente, () => state.pacienteEditar, () => { state.pacienteEditar = null; });
          },
          onSelect: (p) => {
            state.pacienteEditar = p;
            dom.editNomePaciente.value = p.nome || "";
          }
        });
      }
    }

    // =========================
    // Actions públicos
    // =========================
    const actions = {
      init(_dom) {
        dom = _dom;

        if (!FX) console.warn("[AgendaController] formatters não carregado.");
        if (!agendaApi) console.warn("[AgendaController] agenda.api não carregado.");
        if (!pacientesApi) console.warn("[AgendaController] pacientes.api não carregado.");

        setTodayIfEmpty_();
        view && view.setVisao && view.setVisao(state.modoVisao, dom.btnVisaoDia, dom.btnVisaoSemana);

        if (dom.inputFiltroNome) dom.inputFiltroNome.value = state.filtros.nome || "";
        if (dom.selectFiltroStatus) dom.selectFiltroStatus.value = state.filtros.status || "";

        // Picker modal (reutilizável) — usa PacientesApi
        if (createPacientesPicker && pacientesApi && dom.modalPacientes && dom.buscaPacienteTermo && dom.listaPacientesEl && dom.msgPacientesEl) {
          pacientesPicker = createPacientesPicker({
            document: env && env.document ? env.document : document,
            modalEl: dom.modalPacientes,
            inputTermoEl: dom.buscaPacienteTermo,
            listEl: dom.listaPacientesEl,
            msgEl: dom.msgPacientesEl,
            closeBtnEl: dom.btnFecharModalPacientes,
            view: view,
            searchFn: async (termo, limite) => {
              const data = await pacientesApi.buscarSimples(termo, limite || 30);
              return (data && data.pacientes) ? data.pacientes : [];
            },
            onSelect: (p, ctx) => {
              const mode = (ctx && ctx.mode) ? String(ctx.mode) : "novo";
              if (mode === "editar") {
                state.pacienteEditar = p;
                if (dom.editNomePaciente) dom.editNomePaciente.value = p && p.nome ? p.nome : "";
              } else {
                state.pacienteNovo = p;
                if (dom.novoNomePaciente) dom.novoNomePaciente.value = p && p.nome ? p.nome : "";
                if (p && p.telefone && dom.novoTelefone && !String(dom.novoTelefone.value || "").trim()) {
                  dom.novoTelefone.value = p.telefone;
                }
              }
            }
          });

          pacientesPicker.bind();
        }

        // Typeahead inline
        setupTypeahead_();

        actions.setVisao(state.modoVisao);
      },

      clearPaciente(mode) {
        if (mode === "editar") {
          state.pacienteEditar = null;
          if (dom.editNomePaciente) dom.editNomePaciente.value = "";
        } else {
          state.pacienteNovo = null;
          if (dom.novoNomePaciente) dom.novoNomePaciente.value = "";
          if (dom.novoTelefone) dom.novoTelefone.value = "";
        }
      },

      setVisao(modo) {
        if (modo !== "dia" && modo !== "semana") return;
        state.modoVisao = modo;
        try { localStorage.setItem("prontio.agenda.modoVisao", modo); } catch (_) {}
        view && view.setVisao && view.setVisao(modo, dom.btnVisaoDia, dom.btnVisaoSemana);
        if (modo === "dia") carregarDia_();
        else carregarSemana_();
      },

      onChangeData() {
        state.dataSelecionada = dom.inputData.value || "";
        if (state.modoVisao === "dia") carregarDia_();
        else carregarSemana_();
      },

      onHoje() {
        dom.inputData.value = FX.formatDateToInput(new Date());
        state.dataSelecionada = dom.inputData.value;
        if (state.modoVisao === "dia") carregarDia_();
        else carregarSemana_();
      },

      onAgora() {
        const now = getNowSlot_();
        if (!now.hhmm) return;

        if (dom.inputData.value !== now.dataStr) {
          dom.inputData.value = now.dataStr;
          state.dataSelecionada = now.dataStr;
          if (state.modoVisao === "dia") {
            state.horaFocoDia = now.hhmm;
            carregarDia_();
          } else {
            carregarSemana_();
          }
          return;
        }

        if (state.modoVisao === "dia" && view && view.refs && view.refs.listaHorariosEl) {
          const elNow = view.refs.listaHorariosEl.querySelector(`.agenda-slot[data-hora="${now.hhmm}"]`);
          elNow && elNow.scrollIntoView({ block: "start", behavior: "smooth" });
        } else if (state.modoVisao === "semana" && view && view.refs && view.refs.semanaGridEl) {
          const marker = view.refs.semanaGridEl.querySelector(`.semana-row[data-hora="${now.hhmm}"]`);
          marker && marker.scrollIntoView({ block: "start", behavior: "smooth" });
        }
      },

      onNav(delta) {
        if (!dom.inputData.value) return;
        const d = FX.parseInputDate(dom.inputData.value);
        if (state.modoVisao === "semana") d.setDate(d.getDate() + 7 * delta);
        else d.setDate(d.getDate() + 1 * delta);
        dom.inputData.value = FX.formatDateToInput(d);
        state.dataSelecionada = dom.inputData.value;
        if (state.modoVisao === "dia") carregarDia_();
        else carregarSemana_();
      },

      onFiltrosChanged(nome, status) {
        state.filtros.nome = String(nome || "");
        state.filtros.status = String(status || "");
        saveFiltros_();
        if (state.modoVisao === "dia") renderDia_();
        else carregarSemana_();
      },

      limparFiltros() {
        state.filtros.nome = "";
        state.filtros.status = "";
        saveFiltros_();
        if (dom.inputFiltroNome) dom.inputFiltroNome.value = "";
        if (dom.selectFiltroStatus) dom.selectFiltroStatus.value = "";
        if (state.modoVisao === "dia") renderDia_();
        else carregarSemana_();
      },

      openPacientePicker(mode) {
        if (!pacientesPicker) {
          alert("Seletor de pacientes não disponível (picker não carregado).");
          return;
        }
        pacientesPicker.open({ mode: mode === "editar" ? "editar" : "novo" });
      },
      closePacientePicker() { pacientesPicker && pacientesPicker.close(); },
      isPacientePickerOpen() { return pacientesPicker ? pacientesPicker.isOpen() : false; },

      abrirModalNovo(horaPre) {
        if (horaPre && dom.novoHoraInicio) dom.novoHoraInicio.value = horaPre;
        view && view.openModal && view.openModal(dom.modalNovo, dom.novoHoraInicio || dom.novoNomePaciente);
        view && view.setFormMsg && view.setFormMsg(dom.msgNovo, "", "");
        view && view.safeDisable && view.safeDisable(dom.btnSubmitNovo, false);
        if (dom.novoPermiteEncaixe) dom.novoPermiteEncaixe.checked = false;
      },

      fecharModalNovo() {
        view && view.closeModal && view.closeModal(dom.modalNovo);
        dom.formNovo && dom.formNovo.reset();
        if (dom.novoDuracao) dom.novoDuracao.value = 15;
        view && view.setFormMsg && view.setFormMsg(dom.msgNovo, "", "");
        state.pacienteNovo = null;
        view && view.safeDisable && view.safeDisable(dom.btnSubmitNovo, false);
      },

      abrirModalEditar(ag) {
        state.agendamentoEmEdicao = ag;

        if (dom.editIdAgenda) dom.editIdAgenda.value = ag.ID_Agenda || "";
        if (dom.editData) dom.editData.value = ag.data || dom.inputData.value || "";
        if (dom.editHoraInicio) dom.editHoraInicio.value = ag.hora_inicio || "";
        if (dom.editDuracao) dom.editDuracao.value = ag.duracao_minutos || 15;

        if (dom.editNomePaciente) dom.editNomePaciente.value = ag.nome_paciente || "";
        if (dom.editTipo) dom.editTipo.value = ag.tipo || "";
        if (dom.editMotivo) dom.editMotivo.value = ag.motivo || "";
        if (dom.editOrigem) dom.editOrigem.value = ag.origem || "";
        if (dom.editCanal) dom.editCanal.value = ag.canal || "";
        if (dom.editPermiteEncaixe) dom.editPermiteEncaixe.checked = ag && ag.permite_encaixe === true;

        view && view.setFormMsg && view.setFormMsg(dom.msgEditar, "", "");
        view && view.safeDisable && view.safeDisable(dom.btnSubmitEditar, false);
        view && view.openModal && view.openModal(dom.modalEdit, dom.editHoraInicio || dom.editNomePaciente);
      },

      fecharModalEditar() {
        view && view.closeModal && view.closeModal(dom.modalEdit);
        dom.formEditar && dom.formEditar.reset();
        state.agendamentoEmEdicao = null;
        state.pacienteEditar = null;
        view && view.setFormMsg && view.setFormMsg(dom.msgEditar, "", "");
        view && view.safeDisable && view.safeDisable(dom.btnSubmitEditar, false);
      },

      abrirModalBloqueio(horaPre) {
        if (horaPre && dom.bloqHoraInicio) dom.bloqHoraInicio.value = horaPre;
        view && view.setFormMsg && view.setFormMsg(dom.msgBloqueio, "", "");
        view && view.safeDisable && view.safeDisable(dom.btnSubmitBloqueio, false);
        view && view.openModal && view.openModal(dom.modalBloqueio, dom.bloqHoraInicio);
      },

      fecharModalBloqueio() {
        view && view.closeModal && view.closeModal(dom.modalBloqueio);
        dom.formBloqueio && dom.formBloqueio.reset();
        if (dom.bloqDuracao) dom.bloqDuracao.value = 60;
        view && view.setFormMsg && view.setFormMsg(dom.msgBloqueio, "", "");
        view && view.safeDisable && view.safeDisable(dom.btnSubmitBloqueio, false);
      },

      abrirProntuario(ag) {
        if (!ag.ID_Paciente) {
          alert("Este agendamento não está vinculado a um paciente cadastrado.\n\nSelecione um paciente no agendamento para vincular ao prontuário.");
          return;
        }
        try {
          localStorage.setItem("prontio.pacienteSelecionado", JSON.stringify({
            ID_Paciente: ag.ID_Paciente,
            nome: ag.nome_paciente || "",
            documento: ag.documento_paciente || "",
            telefone: ag.telefone_paciente || ""
          }));
        } catch (_) {}

        const params = new URLSearchParams();
        params.set("idPaciente", ag.ID_Paciente);
        if (ag.ID_Agenda) params.set("idAgenda", ag.ID_Agenda);
        global.location.href = "prontuario.html?" + params.toString();
      },

      async mudarStatus(idAgenda, labelUi, cardEl) {
        if (!idAgenda) return;
        if (state.inFlightStatus.has(idAgenda)) return;

        state.inFlightStatus.add(idAgenda);
        cardEl && cardEl.classList.add("agendamento-atualizando");

        try {
          const statusCanon = FX.mapStatusToBackend(labelUi);
          if (statusCanon === "CANCELADO") await agendaApi.cancelar(idAgenda, "Cancelado pela agenda");
          else await agendaApi.atualizar(idAgenda, { status: statusCanon });

          if (state.modoVisao === "dia") await carregarDia_();
          else await carregarSemana_();
        } catch (err) {
          console.error(err);
          alert("Erro ao mudar status: " + (err.message || String(err)));
          cardEl && cardEl.classList.remove("agendamento-atualizando");
        } finally {
          state.inFlightStatus.delete(idAgenda);
        }
      },

      async desbloquear(idAgenda, cardEl) {
        if (!idAgenda) return;
        if (state.inFlightDesbloq.has(idAgenda)) return;

        const ok = confirm("Deseja realmente remover este bloqueio de horário?");
        if (!ok) return;

        state.inFlightDesbloq.add(idAgenda);
        cardEl && cardEl.classList.add("agendamento-atualizando");

        try {
          await agendaApi.desbloquearHorario(idAgenda, "Bloqueio removido");
          if (state.modoVisao === "dia") await carregarDia_();
          else await carregarSemana_();
        } catch (err) {
          console.error(err);
          alert("Erro ao remover bloqueio: " + (err.message || String(err)));
          cardEl && cardEl.classList.remove("agendamento-atualizando");
        } finally {
          state.inFlightDesbloq.delete(idAgenda);
        }
      },

      async submitNovo() {
        view && view.safeDisable && view.safeDisable(dom.btnSubmitNovo, true);

        const dataStr = dom.inputData.value;
        const horaStr = dom.novoHoraInicio && dom.novoHoraInicio.value;
        const duracao = parseInt(String(dom.novoDuracao ? dom.novoDuracao.value : "0"), 10);

        if (!dataStr || !horaStr || !duracao) {
          view && view.setFormMsg && view.setFormMsg(dom.msgNovo, "Preencha data, hora inicial e duração.", "erro");
          view && view.safeDisable && view.safeDisable(dom.btnSubmitNovo, false);
          return;
        }

        const permitirEncaixe = dom.novoPermiteEncaixe ? dom.novoPermiteEncaixe.checked === true : false;

        view && view.setFormMsg && view.setFormMsg(dom.msgNovo, "Validando horário...", "info");
        const v = await validarConflito_({
          data: dataStr,
          hora_inicio: horaStr,
          duracao_minutos: duracao,
          ignoreIdAgenda: "",
          permitirEncaixe,
          tipo: dom.novoTipo && dom.novoTipo.value ? dom.novoTipo.value : "CONSULTA"
        });

        if (!v.ok) {
          const msg = describeConflitos_(v);
          if (hasBloqueio_(v)) {
            view && view.setFormMsg && view.setFormMsg(dom.msgNovo, msg, "erro");
            view && view.safeDisable && view.safeDisable(dom.btnSubmitNovo, false);
            return;
          }
          if (!permitirEncaixe) {
            view && view.setFormMsg && view.setFormMsg(dom.msgNovo, msg + " Marque “Permitir encaixe” para salvar mesmo com conflito de consultas.", "erro");
            view && view.safeDisable && view.safeDisable(dom.btnSubmitNovo, false);
            return;
          }
        }

        const idPaciente = state.pacienteNovo && state.pacienteNovo.idPaciente ? String(state.pacienteNovo.idPaciente) : "";

        const payload = {
          data: dataStr,
          hora_inicio: horaStr,
          duracao_minutos: duracao,
          idPaciente: idPaciente,
          titulo: dom.novoMotivo ? (dom.novoMotivo.value || "") : "",
          notas: "",
          tipo: dom.novoTipo ? (dom.novoTipo.value || "CONSULTA") : "CONSULTA",
          origem: dom.novoOrigem ? (dom.novoOrigem.value || "RECEPCAO") : "RECEPCAO",
          permitirEncaixe: permitirEncaixe
        };

        view && view.setFormMsg && view.setFormMsg(dom.msgNovo, "Salvando...", "info");

        try {
          await agendaApi.criar(payload);
          view && view.setFormMsg && view.setFormMsg(dom.msgNovo, "Agendamento criado com sucesso!", "sucesso");
          await carregarDia_();
          setTimeout(() => actions.fecharModalNovo(), 650);
        } catch (err) {
          console.error(err);
          view && view.setFormMsg && view.setFormMsg(dom.msgNovo, "Erro ao salvar: " + (err.message || String(err)), "erro");
          view && view.safeDisable && view.safeDisable(dom.btnSubmitNovo, false);
        }
      },

      async submitEditar() {
        view && view.safeDisable && view.safeDisable(dom.btnSubmitEditar, true);

        const idAgenda = dom.editIdAgenda ? String(dom.editIdAgenda.value || "").trim() : "";
        if (!idAgenda) {
          view && view.setFormMsg && view.setFormMsg(dom.msgEditar, "Agendamento inválido para edição.", "erro");
          view && view.safeDisable && view.safeDisable(dom.btnSubmitEditar, false);
          return;
        }

        const dataStr = dom.editData && dom.editData.value;
        const horaStr = dom.editHoraInicio && dom.editHoraInicio.value;
        const duracao = parseInt(String(dom.editDuracao ? dom.editDuracao.value : "0"), 10);

        if (!dataStr || !horaStr || !duracao) {
          view && view.setFormMsg && view.setFormMsg(dom.msgEditar, "Preencha data, hora inicial e duração.", "erro");
          view && view.safeDisable && view.safeDisable(dom.btnSubmitEditar, false);
          return;
        }

        const permitirEncaixe = dom.editPermiteEncaixe ? dom.editPermiteEncaixe.checked === true : false;

        view && view.setFormMsg && view.setFormMsg(dom.msgEditar, "Validando horário...", "info");
        const v = await validarConflito_({
          data: dataStr,
          hora_inicio: horaStr,
          duracao_minutos: duracao,
          ignoreIdAgenda: idAgenda,
          permitirEncaixe,
          tipo: dom.editTipo && dom.editTipo.value ? dom.editTipo.value : "CONSULTA"
        });

        if (!v.ok) {
          const msg = describeConflitos_(v);
          if (hasBloqueio_(v)) {
            view && view.setFormMsg && view.setFormMsg(dom.msgEditar, msg, "erro");
            view && view.safeDisable && view.safeDisable(dom.btnSubmitEditar, false);
            return;
          }
          if (!permitirEncaixe) {
            view && view.setFormMsg && view.setFormMsg(dom.msgEditar, msg + " Marque “Permitir encaixe” para salvar mesmo com conflito de consultas.", "erro");
            view && view.safeDisable && view.safeDisable(dom.btnSubmitEditar, false);
            return;
          }
        }

        const idPaciente = state.pacienteEditar && state.pacienteEditar.idPaciente ? String(state.pacienteEditar.idPaciente) : "";

        const patch = {
          data: dataStr,
          hora_inicio: horaStr,
          duracao_minutos: duracao,
          idPaciente: idPaciente,
          tipo: dom.editTipo ? (dom.editTipo.value || "CONSULTA") : "CONSULTA",
          titulo: dom.editMotivo ? (dom.editMotivo.value || "") : "",
          origem: dom.editOrigem ? (dom.editOrigem.value || "RECEPCAO") : "RECEPCAO",
          permitirEncaixe: permitirEncaixe
        };

        view && view.setFormMsg && view.setFormMsg(dom.msgEditar, "Salvando alterações...", "info");

        try {
          await agendaApi.atualizar(idAgenda, patch);
          view && view.setFormMsg && view.setFormMsg(dom.msgEditar, "Agendamento atualizado com sucesso!", "sucesso");
          if (state.modoVisao === "dia") await carregarDia_();
          else await carregarSemana_();
          setTimeout(() => actions.fecharModalEditar(), 650);
        } catch (err) {
          console.error(err);
          view && view.setFormMsg && view.setFormMsg(dom.msgEditar, "Erro ao atualizar: " + (err.message || String(err)), "erro");
          view && view.safeDisable && view.safeDisable(dom.btnSubmitEditar, false);
        }
      },

      async submitBloqueio() {
        view && view.safeDisable && view.safeDisable(dom.btnSubmitBloqueio, true);

        const dataStr = dom.inputData.value;
        const horaStr = dom.bloqHoraInicio && dom.bloqHoraInicio.value;
        const duracao = parseInt(String(dom.bloqDuracao ? dom.bloqDuracao.value : "0"), 10);

        if (!dataStr || !horaStr || !duracao) {
          view && view.setFormMsg && view.setFormMsg(dom.msgBloqueio, "Preencha hora inicial e duração.", "erro");
          view && view.safeDisable && view.safeDisable(dom.btnSubmitBloqueio, false);
          return;
        }

        view && view.setFormMsg && view.setFormMsg(dom.msgBloqueio, "Validando horário...", "info");
        const v = await validarConflito_({
          data: dataStr,
          hora_inicio: horaStr,
          duracao_minutos: duracao,
          ignoreIdAgenda: "",
          permitirEncaixe: false,
          tipo: "BLOQUEIO"
        });

        if (!v.ok) {
          view && view.setFormMsg && view.setFormMsg(dom.msgBloqueio, describeConflitos_(v), "erro");
          view && view.safeDisable && view.safeDisable(dom.btnSubmitBloqueio, false);
          return;
        }

        const payload = {
          data: dataStr,
          hora_inicio: horaStr,
          duracao_minutos: duracao,
          titulo: "BLOQUEIO",
          notas: "",
          origem: "SISTEMA"
        };

        view && view.setFormMsg && view.setFormMsg(dom.msgBloqueio, "Salvando bloqueio...", "info");

        try {
          await agendaApi.bloquearHorario(payload);
          view && view.setFormMsg && view.setFormMsg(dom.msgBloqueio, "Horário bloqueado com sucesso!", "sucesso");
          if (state.modoVisao === "dia") await carregarDia_();
          else await carregarSemana_();
          setTimeout(() => actions.fecharModalBloqueio(), 650);
        } catch (err) {
          console.error(err);
          view && view.setFormMsg && view.setFormMsg(dom.msgBloqueio, "Erro ao salvar bloqueio: " + (err.message || String(err)), "erro");
          view && view.safeDisable && view.safeDisable(dom.btnSubmitBloqueio, false);
        }
      }
    };

    return { state, actions, view };
  }

  PRONTIO.features.agenda.controller = { createAgendaController };
})(window);
