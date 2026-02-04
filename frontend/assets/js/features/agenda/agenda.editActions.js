// frontend/assets/js/features/agenda/agenda.editActions.js
(function (global) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.features = PRONTIO.features || {};
  PRONTIO.features.agenda = PRONTIO.features.agenda || {};

  // Getter para formatters - evita erro se ainda não carregou
  const getFX = () => PRONTIO.features.agenda.formatters || {};

  // ✅ P0-2: Timeout para validação de conflito (10 segundos)
  const VALIDAR_CONFLITO_TIMEOUT_MS = 10000;

  // ✅ P2: Limites de duração do agendamento (em minutos)
  const DURACAO_MIN = 5;      // Mínimo 5 minutos
  const DURACAO_MAX = 480;    // Máximo 8 horas (480 minutos)

  // ✅ P3: Helper para mostrar/esconder loading em botões
  function setButtonLoading_(btn, isLoading) {
    if (!btn) return;
    if (isLoading) {
      btn.classList.add("btn-loading");
      btn.dataset.originalText = btn.textContent;
      btn.textContent = "Aguarde...";
    } else {
      btn.classList.remove("btn-loading");
      if (btn.dataset.originalText) {
        btn.textContent = btn.dataset.originalText;
        delete btn.dataset.originalText;
      }
    }
  }

  // ✅ Helper para adicionar timeout a uma Promise
  function withTimeout_(promise, ms, errorMsg) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(errorMsg || "Timeout"));
      }, ms);

      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  function createAgendaEditActions({ api, state, view, loaders }) {
    if (!api || !state || !view || !loaders) {
      console.error("[AgendaEditActions] Dependências ausentes.");
      return {};
    }

    // ✅ P0-2: Validar conflito COM timeout de 10 segundos
    async function validarConflito_(payload) {
      try {
        await withTimeout_(
          api.validarConflito(payload || {}),
          VALIDAR_CONFLITO_TIMEOUT_MS,
          "Tempo esgotado ao validar horário. Tente novamente."
        );
        return { ok: true };
      } catch (e) {
        return {
          ok: false,
          erro: (e && e.message) ? String(e.message) : "Conflito de horário.",
          code: (e && e.code) ? String(e.code) : "CONFLICT"
        };
      }
    }

    function _getSelectedPacienteId_(p) {
      try {
        if (!p) return "";
        const id = p.idPaciente ? String(p.idPaciente).trim() : "";
        return id;
      } catch (_) {
        return "";
      }
    }

    function _assertPacienteSelecionado_(mode) {
      // mode: "novo" | "editar"
      const dom = state.dom;
      if (!dom) return { ok: true };

      const inputEl = (mode === "editar") ? dom.editNomePaciente : dom.novoNomePaciente;
      const selected = (mode === "editar") ? state.pacienteEditar : state.pacienteNovo;

      const typed = inputEl ? String(inputEl.value || "").trim() : "";
      const idSel = _getSelectedPacienteId_(selected);

      // Se não digitou nada, ok (agenda pode existir sem paciente)
      if (!typed) return { ok: true };

      // Se digitou algo, mas não selecionou da lista/picker => não temos idPaciente
      if (!idSel) {
        return {
          ok: false,
          message:
            'Para vincular o paciente, selecione-o pela lista (autocomplete) ou clique em "Selecionar". ' +
            "Somente digitar o nome não vincula ao cadastro."
        };
      }

      return { ok: true };
    }

    // ✅ P2: Valida duração do agendamento
    function _validarDuracao_(duracao) {
      if (!duracao || isNaN(duracao) || duracao < DURACAO_MIN) {
        return {
          ok: false,
          message: `Duração mínima é ${DURACAO_MIN} minutos.`
        };
      }
      if (duracao > DURACAO_MAX) {
        return {
          ok: false,
          message: `Duração máxima é ${DURACAO_MAX} minutos (${DURACAO_MAX / 60} horas).`
        };
      }
      return { ok: true };
    }

    // =========================================================
    // NOVO (submit)
    // =========================================================
    async function submitNovo() {
      const dom = state.dom;
      if (!dom) return;

      view.safeDisable && view.safeDisable(dom.btnSubmitNovo, true);

      const dataStr = dom.inputData && dom.inputData.value ? String(dom.inputData.value) : "";
      const horaStr = dom.novoHoraInicio && dom.novoHoraInicio.value ? String(dom.novoHoraInicio.value) : "";
      const duracao = parseInt(String(dom.novoDuracao ? dom.novoDuracao.value : "0"), 10);

      if (!dataStr || !horaStr) {
        view.setFormMsg && view.setFormMsg(dom.msgNovo, "Preencha data e hora inicial.", "erro");
        view.safeDisable && view.safeDisable(dom.btnSubmitNovo, false);
        return;
      }

      // ✅ P2: Valida duração com limites
      const chkD = _validarDuracao_(duracao);
      if (!chkD.ok) {
        view.setFormMsg && view.setFormMsg(dom.msgNovo, chkD.message, "erro");
        view.safeDisable && view.safeDisable(dom.btnSubmitNovo, false);
        return;
      }

      // ✅ Se digitou nome, exige seleção para vincular (idPaciente)
      const chkP = _assertPacienteSelecionado_("novo");
      if (!chkP.ok) {
        view.setFormMsg && view.setFormMsg(dom.msgNovo, chkP.message, "erro");
        view.safeDisable && view.safeDisable(dom.btnSubmitNovo, false);
        return;
      }

      const permitirEncaixe = dom.novoPermiteEncaixe ? dom.novoPermiteEncaixe.checked === true : false;

      // ✅ P3: Mostra loading durante validação
      view.setFormMsg && view.setFormMsg(dom.msgNovo, "Validando horário...", "info");
      setButtonLoading_(dom.btnSubmitNovo, true);

      const v = await validarConflito_({
        data: dataStr,
        horaInicio: horaStr,
        duracaoMin: duracao,
        ignoreIdAgenda: null,
        permitirEncaixe,
        tipo: dom.novoTipo && dom.novoTipo.value ? String(dom.novoTipo.value) : "CONSULTA"
      });

      setButtonLoading_(dom.btnSubmitNovo, false);

      if (!v.ok) {
        view.setFormMsg && view.setFormMsg(dom.msgNovo, v.erro || "Conflito de horário.", "erro");
        view.safeDisable && view.safeDisable(dom.btnSubmitNovo, false);
        return;
      }

      const idPaciente = _getSelectedPacienteId_(state.pacienteNovo);

      const payload = {
        data: dataStr,
        horaInicio: horaStr,
        duracaoMin: duracao,
        idPaciente: idPaciente || null, // null => sem vínculo (evita string vazia)
        titulo: dom.novoMotivo ? String(dom.novoMotivo.value || "") : "",
        notas: "",
        tipo: dom.novoTipo ? String(dom.novoTipo.value || "CONSULTA") : "CONSULTA",
        origem: dom.novoOrigem ? String(dom.novoOrigem.value || "RECEPCAO") : "RECEPCAO",
        permitirEncaixe: permitirEncaixe
      };

      view.setFormMsg && view.setFormMsg(dom.msgNovo, "Salvando...", "info");

      try {
        await api.criar(payload);
        view.setFormMsg && view.setFormMsg(dom.msgNovo, "Agendamento criado!", "sucesso");

        // ✅ Invalida cache antes de recarregar
        loaders.invalidateCacheDia && loaders.invalidateCacheDia(dataStr);
        await loaders.carregarDia();

        setTimeout(function () {
          if (view.closeModal) view.closeModal(dom.modalNovo);
          if (dom.formNovo && typeof dom.formNovo.reset === "function") dom.formNovo.reset();
          if (dom.novoDuracao) dom.novoDuracao.value = 15;
          // Limpa estado e campo do paciente
          state.pacienteNovo = null;
          if (dom.novoNomePaciente) dom.novoNomePaciente.value = "";
          view.setFormMsg && view.setFormMsg(dom.msgNovo, "", "");
          view.safeDisable && view.safeDisable(dom.btnSubmitNovo, false);
        }, 600);
      } catch (err) {
        view.setFormMsg && view.setFormMsg(dom.msgNovo, "Erro ao salvar: " + (err.message || String(err)), "erro");
        view.safeDisable && view.safeDisable(dom.btnSubmitNovo, false);
      }
    }

    // =========================================================
    // BLOQUEIO (submit)
    // =========================================================
    async function submitBloqueio() {
      const dom = state.dom;
      if (!dom) return;

      view.safeDisable && view.safeDisable(dom.btnSubmitBloqueio, true);

      const dataStr = dom.inputData && dom.inputData.value ? String(dom.inputData.value) : "";
      const horaStr = dom.bloqHoraInicio && dom.bloqHoraInicio.value ? String(dom.bloqHoraInicio.value) : "";
      const duracao = parseInt(String(dom.bloqDuracao ? dom.bloqDuracao.value : "0"), 10);

      if (!dataStr || !horaStr || !duracao) {
        view.setFormMsg && view.setFormMsg(dom.msgBloqueio, "Preencha hora inicial e duração.", "erro");
        view.safeDisable && view.safeDisable(dom.btnSubmitBloqueio, false);
        return;
      }

      view.setFormMsg && view.setFormMsg(dom.msgBloqueio, "Validando horário...", "info");
      const v = await validarConflito_({
        data: dataStr,
        horaInicio: horaStr,
        duracaoMin: duracao,
        ignoreIdAgenda: null,
        permitirEncaixe: false,
        tipo: "BLOQUEIO"
      });

      if (!v.ok) {
        view.setFormMsg && view.setFormMsg(dom.msgBloqueio, v.erro || "Conflito de horário.", "erro");
        view.safeDisable && view.safeDisable(dom.btnSubmitBloqueio, false);
        return;
      }

      view.setFormMsg && view.setFormMsg(dom.msgBloqueio, "Salvando bloqueio...", "info");

      try {
        await api.bloquearHorario({
          data: dataStr,
          horaInicio: horaStr,
          duracaoMin: duracao,
          titulo: "BLOQUEIO",
          notas: "",
          origem: "SISTEMA"
        });

        view.setFormMsg && view.setFormMsg(dom.msgBloqueio, "Horário bloqueado!", "sucesso");

        // ✅ Invalida cache antes de recarregar
        loaders.invalidateCacheDia && loaders.invalidateCacheDia(dataStr);
        await loaders.carregarDia();

        setTimeout(function () {
          if (view.closeModal) view.closeModal(dom.modalBloqueio);
          if (dom.formBloqueio && typeof dom.formBloqueio.reset === "function") dom.formBloqueio.reset();
          if (dom.bloqDuracao) dom.bloqDuracao.value = 60;
          view.setFormMsg && view.setFormMsg(dom.msgBloqueio, "", "");
          view.safeDisable && view.safeDisable(dom.btnSubmitBloqueio, false);
        }, 600);
      } catch (err) {
        view.setFormMsg && view.setFormMsg(dom.msgBloqueio, "Erro ao bloquear: " + (err.message || String(err)), "erro");
        view.safeDisable && view.safeDisable(dom.btnSubmitBloqueio, false);
      }
    }

    // =========================================================
    // EDITAR (modal + submit)
    // =========================================================
    function abrirModalEditar(ag) {
      const dom = state.dom;
      if (!dom) return;

      // ✅ P0-3: Validar que agendamento existe e tem ID válido
      const idAgenda = ag?.ID_Agenda || ag?.idAgenda || ag?.idEvento || "";
      if (!ag || !idAgenda) {
        console.error("[AgendaEditActions] Tentativa de editar agendamento inválido:", ag);
        view.setFormMsg && view.setFormMsg(dom.msgEditar, "Agendamento inválido para edição.", "erro");
        return;
      }

      state.agendamentoEmEdicao = ag;

      if (dom.editIdAgenda) dom.editIdAgenda.value = idAgenda;
      if (dom.editData) dom.editData.value = ag?.data || dom.inputData?.value || "";
      if (dom.editHoraInicio) dom.editHoraInicio.value = ag?.hora_inicio || "";
      if (dom.editDuracao) dom.editDuracao.value = ag?.duracao_minutos || 15;

      if (dom.editNomePaciente) dom.editNomePaciente.value = String(ag?.nomeCompleto || "").trim();

      if (dom.editTipo) dom.editTipo.value = ag?.tipo || "";
      if (dom.editMotivo) dom.editMotivo.value = ag?.motivo || "";
      if (dom.editOrigem) dom.editOrigem.value = ag?.origem || "";
      if (dom.editCanal) dom.editCanal.value = ag?.canal || "";
      if (dom.editPermiteEncaixe) dom.editPermiteEncaixe.checked = ag && ag.permite_encaixe === true;

      view.setFormMsg && view.setFormMsg(dom.msgEditar, "", "");
      view.safeDisable && view.safeDisable(dom.btnSubmitEditar, false);
      view.openModal && view.openModal(dom.modalEdit, dom.editHoraInicio || dom.editNomePaciente);
    }

    function fecharModalEditar() {
      const dom = state.dom;
      if (!dom) return;

      view.closeModal && view.closeModal(dom.modalEdit);
      dom.formEditar && dom.formEditar.reset();

      state.agendamentoEmEdicao = null;
      state.pacienteEditar = null;

      view.setFormMsg && view.setFormMsg(dom.msgEditar, "", "");
      view.safeDisable && view.safeDisable(dom.btnSubmitEditar, false);
    }

    async function submitEditar() {
      const dom = state.dom;
      if (!dom) return;

      view.safeDisable && view.safeDisable(dom.btnSubmitEditar, true);

      const idAgenda = dom.editIdAgenda ? String(dom.editIdAgenda.value || "").trim() : "";
      if (!idAgenda) {
        view.setFormMsg && view.setFormMsg(dom.msgEditar, "Agendamento inválido para edição.", "erro");
        view.safeDisable && view.safeDisable(dom.btnSubmitEditar, false);
        return;
      }

      const dataStr = dom.editData && dom.editData.value;
      const horaStr = dom.editHoraInicio && dom.editHoraInicio.value;
      const duracao = parseInt(String(dom.editDuracao ? dom.editDuracao.value : "0"), 10);

      if (!dataStr || !horaStr) {
        view.setFormMsg && view.setFormMsg(dom.msgEditar, "Preencha data e hora inicial.", "erro");
        view.safeDisable && view.safeDisable(dom.btnSubmitEditar, false);
        return;
      }

      // ✅ P2: Valida duração com limites
      const chkD = _validarDuracao_(duracao);
      if (!chkD.ok) {
        view.setFormMsg && view.setFormMsg(dom.msgEditar, chkD.message, "erro");
        view.safeDisable && view.safeDisable(dom.btnSubmitEditar, false);
        return;
      }

      // ✅ Se digitou nome, exige seleção para vincular (idPaciente)
      const chkP = _assertPacienteSelecionado_("editar");
      if (!chkP.ok) {
        view.setFormMsg && view.setFormMsg(dom.msgEditar, chkP.message, "erro");
        view.safeDisable && view.safeDisable(dom.btnSubmitEditar, false);
        return;
      }

      const permitirEncaixe = dom.editPermiteEncaixe ? dom.editPermiteEncaixe.checked === true : false;

      // ✅ P3: Mostra loading durante validação
      view.setFormMsg && view.setFormMsg(dom.msgEditar, "Validando horário...", "info");
      setButtonLoading_(dom.btnSubmitEditar, true);

      const v = await validarConflito_({
        data: dataStr,
        horaInicio: horaStr,
        duracaoMin: duracao,
        ignoreIdAgenda: idAgenda,
        permitirEncaixe,
        tipo: dom.editTipo && dom.editTipo.value ? dom.editTipo.value : "CONSULTA"
      });

      setButtonLoading_(dom.btnSubmitEditar, false);

      if (!v.ok) {
        view.setFormMsg && view.setFormMsg(dom.msgEditar, v.erro || "Conflito de horário.", "erro");
        view.safeDisable && view.safeDisable(dom.btnSubmitEditar, false);
        return;
      }

      const idPaciente = _getSelectedPacienteId_(state.pacienteEditar);

      const patch = {
        data: dataStr,
        horaInicio: horaStr,
        duracaoMin: duracao,
        idPaciente: idPaciente,
        tipo: dom.editTipo ? (dom.editTipo.value || "CONSULTA") : "CONSULTA",
        titulo: dom.editMotivo ? (dom.editMotivo.value || "") : "",
        origem: dom.editOrigem ? (dom.editOrigem.value || "RECEPCAO") : "RECEPCAO",
        permitirEncaixe: permitirEncaixe
      };

      view.setFormMsg && view.setFormMsg(dom.msgEditar, "Salvando alterações...", "info");

      try {
        await api.atualizar(idAgenda, patch);
        view.setFormMsg && view.setFormMsg(dom.msgEditar, "Agendamento atualizado!", "sucesso");

        // ✅ Invalida cache antes de recarregar
        loaders.invalidateCacheDia && loaders.invalidateCacheDia(dataStr);
        loaders.invalidateCacheSemana && loaders.invalidateCacheSemana(dataStr);

        if (state.modoVisao === "dia") await loaders.carregarDia();
        else await loaders.carregarSemana();

        setTimeout(fecharModalEditar, 600);
      } catch (err) {
        view.setFormMsg && view.setFormMsg(dom.msgEditar, "Erro ao atualizar: " + (err.message || String(err)), "erro");
        view.safeDisable && view.safeDisable(dom.btnSubmitEditar, false);
      }
    }

    // =========================================================
    // STATUS / DESBLOQUEIO / PRONTUÁRIO
    // =========================================================

    // ✅ P1: Helper para mostrar erro (toast ou console)
    function showError_(message) {
      const toast = PRONTIO.widgets?.toast;
      const toastEl = document.getElementById("toast-agenda") || document.getElementById("mensagem");
      if (toast && toastEl) {
        toast.show({ target: toastEl, text: message, type: "erro", autoHide: true, autoHideDelay: 5000 });
      } else {
        console.error("[AgendaEditActions]", message);
        // Fallback para alert em caso de erro crítico sem toast disponível
        alert(message);
      }
    }

    // ✅ P1: Helper para mostrar aviso (toast ou console)
    function showAviso_(message) {
      const toast = PRONTIO.widgets?.toast;
      const toastEl = document.getElementById("toast-agenda") || document.getElementById("mensagem");
      if (toast && toastEl) {
        toast.show({ target: toastEl, text: message, type: "aviso", autoHide: true, autoHideDelay: 5000 });
      } else {
        console.warn("[AgendaEditActions]", message);
        alert(message);
      }
    }

    async function mudarStatus(idAgenda, labelUi, cardEl) {
      if (!idAgenda) return;
      if (state.inFlight?.statusById?.has(idAgenda)) return;

      state.inFlight.statusById.add(idAgenda);
      cardEl && cardEl.classList.add("agendamento-atualizando");

      try {
        const FX = getFX();
        if (!FX.mapStatusToBackend) {
          console.error("[AgendaEditActions] formatters.mapStatusToBackend não carregado");
          return;
        }
        const statusCanon = FX.mapStatusToBackend(labelUi);
        if (statusCanon === "CANCELADO") await api.cancelar(idAgenda, "Cancelado pela agenda");
        else await api.atualizar(idAgenda, { status: statusCanon });

        // ✅ P1: Invalida apenas o cache do modo atual (evita invalidação excessiva)
        if (state.modoVisao === "dia") {
          loaders.invalidateCacheDia && loaders.invalidateCacheDia();
          await loaders.carregarDia();
        } else {
          loaders.invalidateCacheSemana && loaders.invalidateCacheSemana();
          await loaders.carregarSemana();
        }
      } catch (err) {
        console.error(err);
        showError_("Erro ao mudar status: " + (err.message || String(err)));
        cardEl && cardEl.classList.remove("agendamento-atualizando");
      } finally {
        state.inFlight.statusById.delete(idAgenda);
      }
    }

    async function desbloquear(idAgenda, cardEl) {
      if (!idAgenda) return;
      if (state.inFlight?.desbloquearById?.has(idAgenda)) return;

      const ok = confirm("Deseja realmente remover este bloqueio de horário?");
      if (!ok) return;

      state.inFlight.desbloquearById.add(idAgenda);
      cardEl && cardEl.classList.add("agendamento-atualizando");

      try {
        await api.desbloquearHorario(idAgenda, "Bloqueio removido");

        // ✅ P1: Invalida apenas o cache do modo atual (evita invalidação excessiva)
        if (state.modoVisao === "dia") {
          loaders.invalidateCacheDia && loaders.invalidateCacheDia();
          await loaders.carregarDia();
        } else {
          loaders.invalidateCacheSemana && loaders.invalidateCacheSemana();
          await loaders.carregarSemana();
        }
      } catch (err) {
        console.error(err);
        showError_("Erro ao remover bloqueio: " + (err.message || String(err)));
        cardEl && cardEl.classList.remove("agendamento-atualizando");
      } finally {
        state.inFlight.desbloquearById.delete(idAgenda);
      }
    }

    function abrirProntuario(ag) {
      // Normaliza: aceita ID_Paciente, idPaciente ou id_paciente
      const idPaciente = String(ag?.ID_Paciente || ag?.idPaciente || ag?.id_paciente || "").trim();

      if (!ag || !idPaciente) {
        showAviso_("Este agendamento não está vinculado a um paciente cadastrado. Selecione um paciente no agendamento para vincular ao prontuário.");
        return;
      }

      try {
        localStorage.setItem("prontio.pacienteSelecionado", JSON.stringify({
          ID_Paciente: idPaciente,
          nomeCompleto: String(ag.nomeCompleto || "").trim(),
          nome: String(ag.nomeCompleto || "").trim()
        }));
      } catch (_) {}

      const params = new URLSearchParams();
      params.set("idPaciente", idPaciente);
      if (ag.ID_Agenda) params.set("idAgenda", ag.ID_Agenda);
      global.location.href = "prontuario.html?" + params.toString();
    }

    return {
      submitNovo,
      submitEditar,
      submitBloqueio,
      abrirModalEditar,
      fecharModalEditar,
      mudarStatus,
      desbloquear,
      abrirProntuario
    };
  }

  PRONTIO.features.agenda.editActions = { createAgendaEditActions };
})(window);
