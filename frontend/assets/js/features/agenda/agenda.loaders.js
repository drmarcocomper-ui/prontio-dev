// frontend/assets/js/features/agenda/agenda.loaders.js
/**
 * PRONTIO — Agenda Loaders (Front) - OTIMIZADO
 * ------------------------------------------------------------
 * ✅ Cache local com "stale-while-revalidate"
 * ✅ Mostra dados em cache instantaneamente
 * ✅ Atualiza com dados frescos em background
 *
 * Responsabilidades:
 * - Carregar agendamentos da API (dia/semana)
 * - Formatar DTOs para UI usando formatters
 * - Enriquecer com cache de pacientes
 * - Aplicar filtros
 * - Atualizar view com estados (loading/erro/sucesso)
 * - Gerenciar concorrência (reqSeq)
 */

(function (global) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.features = PRONTIO.features || {};
  PRONTIO.features.agenda = PRONTIO.features.agenda || {};

  const FX = () => PRONTIO.features.agenda.formatters || {};
  const FILTROS = () => PRONTIO.features.agenda.filtros || {};

  // ========================================
  // Cache Local (stale-while-revalidate)
  // ========================================
  const CACHE_KEY_PREFIX = "prontio.agenda.cache.";
  const CACHE_MAX_AGE_MS = 2 * 60 * 1000; // ✅ 2 minutos (reduzido de 5)

  function getCacheKey(tipo, data) {
    return CACHE_KEY_PREFIX + tipo + "." + data;
  }

  function getFromCache(tipo, data) {
    try {
      const key = getCacheKey(tipo, data);
      const raw = localStorage.getItem(key);
      if (!raw) return null;

      const cached = JSON.parse(raw);
      if (!cached || !cached.timestamp || !Array.isArray(cached.items)) return null;

      // Verifica se cache ainda é válido
      const age = Date.now() - cached.timestamp;
      if (age > CACHE_MAX_AGE_MS) {
        localStorage.removeItem(key);
        return null;
      }

      return cached.items;
    } catch (_) {
      return null;
    }
  }

  function saveToCache(tipo, data, items) {
    try {
      const key = getCacheKey(tipo, data);
      const cached = {
        timestamp: Date.now(),
        items: items || []
      };
      localStorage.setItem(key, JSON.stringify(cached));
    } catch (_) {
      // localStorage cheio ou indisponível
    }
  }

  // ✅ Invalidar cache de uma data específica (chamado após mutações)
  function invalidateCache(tipo, data) {
    try {
      const key = getCacheKey(tipo, data);
      localStorage.removeItem(key);
    } catch (_) {}
  }

  // ✅ Invalidar todo o cache da agenda (usado em operações críticas)
  function invalidateAllCache() {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach((k) => {
        if (k.startsWith(CACHE_KEY_PREFIX)) {
          localStorage.removeItem(k);
        }
      });
    } catch (_) {}
  }

  function createAgendaLoaders(ctx) {
    const { api, state, view } = ctx || {};

    if (!api || !state || !view) {
      console.error("[AgendaLoaders] Dependências não fornecidas (api/state/view).");
      return null;
    }

    let dom = null;

    // ========================================
    // Helpers
    // ========================================

    function getFormatters() {
      return FX();
    }

    function getFiltros() {
      return FILTROS();
    }

    function generateSlots(horaInicio, horaFim, intervalo) {
      const fx = getFormatters();
      const slots = [];
      const startMin = fx.timeToMinutes ? fx.timeToMinutes(horaInicio) : 480;
      const endMin = fx.timeToMinutes ? fx.timeToMinutes(horaFim) : 1080;
      const step = intervalo || 15;

      for (let m = startMin; m < endMin; m += step) {
        slots.push(fx.minutesToTime ? fx.minutesToTime(m) : "00:00");
      }
      return slots;
    }

    function enrichWithPacientesCache(uiList) {
      if (!state.pacientesCache || typeof state.pacientesCache.enrichUiList !== "function") {
        return uiList;
      }
      return state.pacientesCache.enrichUiList(uiList);
    }

    function applyFilters(uiList) {
      const filtros = getFiltros();
      if (!filtros.normalizeFilters || !filtros.matchesAgendamento) {
        return uiList;
      }

      const normalized = filtros.normalizeFilters(state.filtros || {});
      if (!normalized.termo && !normalized.statusFiltro) {
        return uiList;
      }

      const resolveNome = (ag) => {
        if (state.pacientesCache && typeof state.pacientesCache.resolveNomeFromId === "function") {
          return state.pacientesCache.resolveNomeFromId(ag.ID_Paciente);
        }
        return ag.nomeCompleto || "";
      };

      return uiList.filter((ag) =>
        filtros.matchesAgendamento(ag, normalized.termo, normalized.statusFiltro, resolveNome)
      );
    }

    function buildDayMap(uiList, slots) {
      const map = new Map();
      slots.forEach((s) => map.set(s, []));

      uiList.forEach((ag) => {
        const h = ag.hora_inicio || "";
        if (map.has(h)) {
          map.get(h).push(ag);
        } else {
          // slot não existe na grade, adiciona mesmo assim
          map.set(h, [ag]);
        }
      });

      return map;
    }

    function buildWeekMap(uiList, dias) {
      // { [ymd]: { [hhmm]: ag[] } }
      const byDayHour = {};
      dias.forEach((d) => {
        byDayHour[d] = {};
      });

      uiList.forEach((ag) => {
        const d = ag.data || "";
        const h = ag.hora_inicio || "";
        if (!byDayHour[d]) byDayHour[d] = {};
        if (!byDayHour[d][h]) byDayHour[d][h] = [];
        byDayHour[d][h].push(ag);
      });

      return byDayHour;
    }

    function getNowInfo() {
      const now = new Date();
      const fx = getFormatters();
      const dataStr = fx.formatDateToInput ? fx.formatDateToInput(now) : "";
      const hhmm = fx.minutesToTime
        ? fx.minutesToTime(now.getHours() * 60 + now.getMinutes())
        : "00:00";
      return { dataStr, hhmm };
    }

    // ========================================
    // Renderizar Dia (helper interno)
    // ========================================

    function renderDia_(ymd, rawItems, callbacks) {
      const fx = getFormatters();

      state.agendamentosPeriodo = rawItems;

      // Converte DTO -> UI
      let uiList = rawItems.map((dto) =>
        fx.dtoToUi ? fx.dtoToUi(dto) : dto
      );

      // Enriquece com cache de pacientes
      uiList = enrichWithPacientesCache(uiList);

      // Aplica filtros
      uiList = applyFilters(uiList);

      state.agendamentosDiaUi = uiList;

      // Gera slots
      const slots = generateSlots(
        state.config?.hora_inicio_padrao || "08:00",
        state.config?.hora_fim_padrao || "18:00",
        state.config?.duracao_grade_minutos || 15
      );

      // Monta mapa hora -> agendamentos
      const map = buildDayMap(uiList, slots);

      // Info de "agora"
      const now = getNowInfo();
      const isHoje = now.dataStr === ymd;

      // Renderiza em tabela (novo layout)
      if (view.renderDayTable) {
        view.renderDayTable({
          slots,
          map,
          now,
          isHoje,
          horaFoco: state.horaFocoDia || null,
          callbacks
        });
      }

      // Resumo
      if (view.setResumo && fx.computeResumoDia) {
        view.setResumo(fx.computeResumoDia(uiList));
      }
    }

    // ========================================
    // Carregar Dia (com cache stale-while-revalidate)
    // ========================================

    async function carregarDia() {
      const fx = getFormatters();
      const ymd = state.dataSelecionada || (fx.formatDateToInput ? fx.formatDateToInput(new Date()) : "");

      if (!ymd) {
        console.warn("[AgendaLoaders] dataSelecionada vazia.");
        return;
      }

      const mySeq = ++state.reqSeqDia;

      // Callbacks para a view
      const callbacks = {
        onNovo: (hora) => {
          if (state.controllerActions?.abrirModalNovo) {
            state.controllerActions.abrirModalNovo(hora);
          }
        },
        onBloquear: (hora) => {
          if (state.controllerActions?.abrirModalBloqueio) {
            state.controllerActions.abrirModalBloqueio(hora);
          }
        },
        onChangeStatus: (idAgenda, novoStatus, cardEl) => {
          if (state.controllerActions?.mudarStatus) {
            state.controllerActions.mudarStatus(idAgenda, novoStatus, cardEl);
          }
        },
        onEditar: (ag) => {
          if (state.controllerActions?.abrirModalEditar) {
            state.controllerActions.abrirModalEditar(ag);
          }
        },
        onAtender: (ag) => {
          if (state.controllerActions?.abrirProntuario) {
            state.controllerActions.abrirProntuario(ag);
          }
        },
        onDesbloquear: (idAgenda, cardEl) => {
          if (state.controllerActions?.desbloquear) {
            state.controllerActions.desbloquear(idAgenda, cardEl);
          }
        },
        onCancelar: (ag) => {
          // Cancela o agendamento mudando o status para "Cancelado"
          if (state.controllerActions?.mudarStatus) {
            state.controllerActions.mudarStatus(ag.ID_Agenda, "Cancelado", null);
          }
        }
      };

      // ✅ PASSO 1: Mostrar dados do cache instantaneamente (se existir)
      const cachedItems = getFromCache("dia", ymd);
      if (cachedItems && cachedItems.length > 0) {
        renderDia_(ymd, cachedItems, callbacks);
        // Mostra indicador sutil de atualização (não bloqueia)
        if (view.showDayUpdating) view.showDayUpdating();
      } else {
        // Sem cache: mostra loading normal
        if (view.showDayLoading) view.showDayLoading();
      }

      // ✅ PASSO 2: Buscar dados frescos da API
      try {
        const raw = await api.listar({
          periodo: { inicio: ymd, fim: ymd },
          filtros: { incluirCancelados: false }
        });

        // Concorrência: se outra requisição mais nova chegou, ignora esta
        if (mySeq !== state.reqSeqDia) {
          console.log("[AgendaLoaders] Requisição de dia obsoleta, ignorando.");
          return;
        }

        // API retorna { items: [...], count: N } ou array direto
        const freshItems = (raw && Array.isArray(raw.items)) ? raw.items : (Array.isArray(raw) ? raw : []);

        // ✅ PASSO 3: Salvar no cache
        saveToCache("dia", ymd, freshItems);

        // ✅ PASSO 4: Renderizar dados frescos
        renderDia_(ymd, freshItems, callbacks);

        if (view.hideDayLoading) view.hideDayLoading();
        if (view.hideDayUpdating) view.hideDayUpdating();

      } catch (err) {
        if (mySeq !== state.reqSeqDia) return;

        console.error("[AgendaLoaders] Erro ao carregar dia:", err);
        if (view.hideDayLoading) view.hideDayLoading();
        if (view.hideDayUpdating) view.hideDayUpdating();

        // Se tinha cache, não mostra erro (dados antigos ainda visíveis)
        if (!cachedItems && view.showDayError) {
          view.showDayError(err?.message || "Erro ao carregar agendamentos.");
        }
      }
    }

    // ========================================
    // Carregar Semana
    // ========================================

    async function carregarSemana() {
      const fx = getFormatters();
      const refYmd = state.dataSelecionada || (fx.formatDateToInput ? fx.formatDateToInput(new Date()) : "");

      if (!refYmd) {
        console.warn("[AgendaLoaders] dataSelecionada vazia.");
        return;
      }

      const mySeq = ++state.reqSeqSemana;

      if (view.showWeekLoading) view.showWeekLoading();

      try {
        // Calcula período da semana (seg-dom)
        const week = fx.weekPeriodFrom ? fx.weekPeriodFrom(refYmd) : { inicio: refYmd, fim: refYmd, dias: [refYmd] };

        const raw = await api.listar({
          periodo: { inicio: week.inicio, fim: week.fim },
          filtros: { incluirCancelados: false }
        });

        // Concorrência
        if (mySeq !== state.reqSeqSemana) {
          console.log("[AgendaLoaders] Requisição de semana obsoleta, ignorando.");
          return;
        }

        // API retorna { items: [...], count: N } ou array direto
        state.agendamentosPeriodo = (raw && Array.isArray(raw.items)) ? raw.items : (Array.isArray(raw) ? raw : []);

        // Converte DTO -> UI
        let uiList = state.agendamentosPeriodo.map((dto) =>
          fx.dtoToUi ? fx.dtoToUi(dto) : dto
        );

        // Enriquece com cache
        uiList = enrichWithPacientesCache(uiList);

        // Aplica filtros
        uiList = applyFilters(uiList);

        state.agendamentosSemanaUi = uiList;

        // Gera slots
        const slots = generateSlots(
          state.config?.hora_inicio_padrao || "08:00",
          state.config?.hora_fim_padrao || "18:00",
          state.config?.duracao_grade_minutos || 15
        );

        // Monta mapa dia/hora -> agendamentos
        const byDayHour = buildWeekMap(uiList, week.dias);

        // Info de "agora"
        const now = getNowInfo();

        // Callbacks
        const callbacks = {
          onIrParaDia: (data, hora) => {
            state.dataSelecionada = data;
            state.horaFocoDia = hora || null;
            if (state.controllerActions?.setVisao) {
              state.controllerActions.setVisao("dia");
            }
          },
          onDblClickNovo: (data, hora) => {
            state.dataSelecionada = data;
            if (dom?.inputData) {
              dom.inputData.value = data;
            }
            if (state.controllerActions?.abrirModalNovo) {
              state.controllerActions.abrirModalNovo(hora);
            }
          }
        };

        // Renderiza
        if (view.renderWeekGrid) {
          view.renderWeekGrid({
            dias: week.dias,
            slots,
            byDayHour,
            now,
            callbacks
          });
        }

        if (view.hideWeekLoading) view.hideWeekLoading();

      } catch (err) {
        if (mySeq !== state.reqSeqSemana) return;

        console.error("[AgendaLoaders] Erro ao carregar semana:", err);
        if (view.hideWeekLoading) view.hideWeekLoading();
        if (view.showWeekError) {
          view.showWeekError(err?.message || "Erro ao carregar agendamentos.");
        }
      }
    }

    // ========================================
    // Init
    // ========================================

    function init(domRefs) {
      dom = domRefs || null;
    }

    // ✅ Wrapper para invalidar cache de uma data
    function invalidateCacheDia(data) {
      const ymd = data || state.dataSelecionada || "";
      if (ymd) invalidateCache("dia", ymd);
    }

    function invalidateCacheSemana(data) {
      const fx = getFormatters();
      const ymd = data || state.dataSelecionada || "";
      if (ymd && fx.weekPeriodFrom) {
        const week = fx.weekPeriodFrom(ymd);
        if (week.inicio) invalidateCache("semana", week.inicio);
      }
    }

    return {
      init,
      carregarDia,
      carregarSemana,
      // ✅ Funções de invalidação de cache
      invalidateCacheDia,
      invalidateCacheSemana,
      invalidateAllCache: invalidateAllCache
    };
  }

  PRONTIO.features.agenda.loaders = { createAgendaLoaders };
})(window);
