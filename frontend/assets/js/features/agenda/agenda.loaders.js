// frontend/assets/js/features/agenda/agenda.loaders.js
/**
 * PRONTIO — Agenda Loaders (Front)
 * ------------------------------------------------------------
 * Responsável por:
 * - Carregar agenda do DIA e da SEMANA
 * - Controlar concorrência (race condition)
 * - Converter DTO -> UI
 * - Resolver nome do paciente via pacientesCache (front)
 * - Delegar renderização para a View
 *
 * Correções aplicadas:
 * ✅ Render inicial SEM precisar criar agendamento
 * ✅ Enriquecimento de nomeCompleto via pacientesCache
 * ✅ Garantia de data atual no primeiro load
 */

(function (global) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.features = PRONTIO.features || {};
  PRONTIO.features.agenda = PRONTIO.features.agenda || {};

  const FX = PRONTIO.features.agenda.formatters;

  function createAgendaLoaders({ api, state, view }) {
    if (!api || !state || !view) {
      console.error("[AgendaLoaders] Dependências ausentes.");
      return {};
    }

    // =========================
    // Init
    // =========================
    function init(dom) {
      state.dom = dom;
    }

    // =========================
    // Helpers
    // =========================
    function ensureDate_() {
      if (!state.dom?.inputData?.value) {
        state.dom.inputData.value = FX.formatDateToInput(new Date());
      }
      return state.dom.inputData.value;
    }

    function getSlotsByConfig_() {
      const inicioMin = FX.timeToMinutes(state.config?.hora_inicio_padrao || "08:00") ?? 8 * 60;
      const fimMin = FX.timeToMinutes(state.config?.hora_fim_padrao || "18:00") ?? 18 * 60;
      const passo = parseInt(String(state.config?.duracao_grade_minutos || 15), 10) || 15;

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

    function enrichPacientes_(list) {
      if (!state.pacientesCache || typeof state.pacientesCache.enrichUiList !== "function") {
        return list;
      }
      return state.pacientesCache.enrichUiList(list);
    }

    // =========================
    // Render DIA
    // =========================
    function renderDia_(dataStr) {
      const { slots } = getSlotsByConfig_();
      const now = getNowSlot_();
      const isHoje = now.dataStr === dataStr;

      const uiList = enrichPacientes_(state.agendamentosDiaUi || []);

      if (view.setResumo && FX.computeResumoDia) {
        view.setResumo(FX.computeResumoDia(uiList));
      }

      const map = new Map();
      uiList.forEach((ag) => {
        const hora = FX.normalizeHora(ag.hora_inicio);
        if (!hora) return;
        if (!map.has(hora)) map.set(hora, []);
        map.get(hora).push(ag);
      });

      view.renderDaySlots && view.renderDaySlots({
        slots,
        map,
        now,
        isHoje,
        horaFoco: state.horaFocoDia || null,
        callbacks: {
          onNovo: (hora) => state.controllerActions?.abrirModalNovo?.(hora),
          onBloquear: (hora) => state.controllerActions?.abrirModalBloqueio?.(hora),
          onAtender: (ag) => state.controllerActions?.abrirProntuario?.(ag),
          onEditar: (ag) => state.controllerActions?.abrirModalEditar?.(ag),
          onChangeStatus: (idAgenda, novoLabel, cardEl) =>
            state.controllerActions?.mudarStatus?.(idAgenda, novoLabel, cardEl),
          onDesbloquear: (idAgenda, cardEl) =>
            state.controllerActions?.desbloquear?.(idAgenda, cardEl)
        }
      });

      state.horaFocoDia = null;
    }

    // =========================
    // Render SEMANA
    // =========================
    function renderSemana_(refStr) {
      const per = FX.weekPeriodFrom(refStr);
      const { slots } = getSlotsByConfig_();
      const now = getNowSlot_();

      const uiList = enrichPacientes_(state.agendamentosSemanaUi || []);

      const byDayHour = {};
      uiList.forEach((ui) => {
        if (!ui || !ui.data) return;
        const horaNorm = FX.normalizeHora(ui.hora_inicio);
        if (!horaNorm) return;

        if (!byDayHour[ui.data]) byDayHour[ui.data] = {};
        if (!byDayHour[ui.data][horaNorm]) byDayHour[ui.data][horaNorm] = [];
        byDayHour[ui.data][horaNorm].push(ui);
      });

      view.renderWeekGrid && view.renderWeekGrid({
        dias: per.dias,
        slots,
        byDayHour,
        now,
        callbacks: {
          onIrParaDia: (ds, hora) => {
            state.horaFocoDia = hora;
            if (state.dom?.inputData) state.dom.inputData.value = ds;
            state.controllerActions?.setVisao?.("dia");
          },
          onDblClickNovo: (ds, hora) => {
            if (state.dom?.inputData) state.dom.inputData.value = ds;
            state.controllerActions?.setVisao?.("dia");
            setTimeout(() => state.controllerActions?.abrirModalNovo?.(hora), 50);
          }
        }
      });
    }

    // =========================
    // DIA
    // =========================
    async function carregarDia() {
      if (!state.dom) return;

      const dataStr = ensureDate_();
      const mySeq = ++state.reqSeqDia;

      view.showDayLoading?.();

      try {
        const data = await api.listar({
          periodo: { inicio: dataStr, fim: dataStr },
          filtros: { incluirCancelados: false }
        });

        if (mySeq !== state.reqSeqDia) return;

        const itemsDto = data?.items || [];
        state.agendamentosPeriodo = itemsDto;

        state.agendamentosDiaUi = itemsDto
          .map(FX.dtoToUi)
          .filter(Boolean)
          .filter((x) => x.data === dataStr);

        renderDia_(dataStr);
      } catch (err) {
        if (mySeq !== state.reqSeqDia) return;
        console.error(err);
        view.showDayError?.("Erro ao carregar agenda do dia.");
      } finally {
        view.hideDayLoading?.();
      }
    }

    // =========================
    // SEMANA
    // =========================
    async function carregarSemana() {
      if (!state.dom) return;

      const refStr = ensureDate_();
      const mySeq = ++state.reqSeqSemana;

      try {
        const per = FX.weekPeriodFrom(refStr);

        const data = await api.listar({
          periodo: { inicio: per.inicio, fim: per.fim },
          filtros: { incluirCancelados: false }
        });

        if (mySeq !== state.reqSeqSemana) return;

        const itemsDto = data?.items || [];
        state.agendamentosPeriodo = itemsDto;

        state.agendamentosSemanaUi = itemsDto
          .map(FX.dtoToUi)
          .filter(Boolean);

        renderSemana_(refStr);
      } catch (err) {
        if (mySeq !== state.reqSeqSemana) return;
        console.error(err);
        if (view.refs?.semanaGridEl) {
          view.refs.semanaGridEl.innerHTML = "";
          const wrap = (state.dom?.inputData?.ownerDocument || document).createElement("div");
          wrap.className = "agenda-erro";
          wrap.textContent = "Erro ao carregar agenda da semana.";
          view.refs.semanaGridEl.appendChild(wrap);
        }
      }
    }

    return {
      init,
      carregarDia,
      carregarSemana
    };
  }

  PRONTIO.features.agenda.loaders = { createAgendaLoaders };
})(window);
