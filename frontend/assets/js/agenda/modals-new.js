/**
 * PRONTIO - Agenda Modal Novo (Etapa 2A)
 * - Paciente obrigatório (typeahead)
 * - Botão salvar só habilita quando paciente selecionado
 * - Salva via Agenda.Criar (contrato canônico)
 */
(function (global) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.agenda = PRONTIO.agenda || {};

  const callApiData =
    (PRONTIO.api && PRONTIO.api.callApiData) ||
    global.callApiData;

  function safeDisable_(el, disabled) {
    if (!el) return;
    el.disabled = !!disabled;
    el.setAttribute("aria-disabled", disabled ? "true" : "false");
  }

  function setMsg_(el, msg, kind) {
    if (!el) return;
    el.textContent = msg || "";
    el.className = "form-message" + (kind ? " " + kind : "");
  }

  function normalizeOrigem_(v) {
    const s = String(v || "").trim().toUpperCase();
    if (s.includes("MED")) return "MEDICO";
    if (s.includes("SIS")) return "SISTEMA";
    return "RECEPCAO";
  }

  function bind(modalCtx) {
    const {
      inputData,
      modalEl,
      formEl,
      msgEl,
      inputHoraInicio,
      inputDuracao,
      inputNomePaciente,
      inputTelefone,
      inputTipo,
      inputMotivo,
      inputOrigem,
      chkPermiteEncaixe,
      btnSubmit,
      btnClose,
      btnCancel
    } = modalCtx;

    if (!modalEl || !formEl) return;

    const state = PRONTIO.agenda.state;

    function updateSubmit_() {
      const p = state.getPacienteSelecionado();
      const ok = p && String(p.ID_Paciente || "").trim() !== "";
      safeDisable_(btnSubmit, !ok);
    }

    function open(hora) {
      state.resetModalNovo();
      if (inputNomePaciente) inputNomePaciente.value = "";
      if (inputTelefone) inputTelefone.value = "";
      if (hora && inputHoraInicio) inputHoraInicio.value = hora;

      setMsg_(msgEl, "", "");
      updateSubmit_();

      modalEl.classList.remove("hidden");
      modalEl.classList.add("visible");
      modalEl.setAttribute("aria-hidden", "false");
      setTimeout(() => inputHoraInicio && inputHoraInicio.focus && inputHoraInicio.focus(), 0);
    }

    function close() {
      modalEl.classList.remove("visible");
      modalEl.classList.add("hidden");
      modalEl.setAttribute("aria-hidden", "true");
      try { formEl.reset(); } catch (_) {}
      state.resetModalNovo();
      updateSubmit_();
      setMsg_(msgEl, "", "");
    }

    // Typeahead obrigatório
    if (PRONTIO.agenda.patientsTypeahead && typeof PRONTIO.agenda.patientsTypeahead.attach === "function") {
      PRONTIO.agenda.patientsTypeahead.attach(inputNomePaciente, {
        onTyping: () => {
          state.setPacienteSelecionado(null);
          updateSubmit_();
        },
        onSelected: (p) => {
          state.setPacienteSelecionado(p);
          if (p && p.telefone && inputTelefone && !String(inputTelefone.value || "").trim()) {
            inputTelefone.value = p.telefone;
          }
          updateSubmit_();
        }
      });
    }

    // Submit
    formEl.addEventListener("submit", async (e) => {
      e.preventDefault();

      const p = state.getPacienteSelecionado();
      if (!p || !p.ID_Paciente) {
        setMsg_(msgEl, "Selecione um paciente da lista.", "erro");
        updateSubmit_();
        return;
      }

      const dataStr = String(inputData && inputData.value ? inputData.value : "").trim();
      const hora = String(inputHoraInicio && inputHoraInicio.value ? inputHoraInicio.value : "").trim();
      const dur = parseInt(String(inputDuracao && inputDuracao.value ? inputDuracao.value : "0"), 10);

      if (!dataStr || !hora || !dur || !isFinite(dur) || dur <= 0) {
        setMsg_(msgEl, "Preencha data, hora e duração.", "erro");
        return;
      }

      const payload = {
        data: dataStr,
        hora_inicio: hora,
        duracao_minutos: dur,
        ID_Paciente: String(p.ID_Paciente),
        tipo: (inputTipo && inputTipo.value) ? String(inputTipo.value) : "CONSULTA",
        motivo: (inputMotivo && inputMotivo.value) ? String(inputMotivo.value) : "",
        origem: normalizeOrigem_((inputOrigem && inputOrigem.value) ? inputOrigem.value : "RECEPCAO"),
        permitirEncaixe: (chkPermiteEncaixe && chkPermiteEncaixe.checked === true),
        permite_encaixe: (chkPermiteEncaixe && chkPermiteEncaixe.checked === true)
      };

      try {
        safeDisable_(btnSubmit, true);
        setMsg_(msgEl, "Salvando...", "info");

        await callApiData({ action: "Agenda.Criar", payload });

        setMsg_(msgEl, "Agendamento criado com sucesso!", "sucesso");

        // recarrega dia
        if (PRONTIO.agenda.day && typeof PRONTIO.agenda.day.loadDay === "function") {
          await PRONTIO.agenda.day.loadDay({
            data: dataStr,
            container: document.getElementById("agenda-lista-horarios")
          });
        }

        setTimeout(() => close(), 550);
      } catch (err) {
        setMsg_(msgEl, "Erro ao salvar: " + (err && err.message ? err.message : String(err)), "erro");
        safeDisable_(btnSubmit, false);
        updateSubmit_();
      }
    });

    // Close buttons
    btnClose && btnClose.addEventListener("click", () => close());
    btnCancel && btnCancel.addEventListener("click", () => close());
    modalEl.addEventListener("click", (e) => {
      if (e.target === modalEl) close();
    });

    updateSubmit_();

    return { open, close, updateSubmit: updateSubmit_ };
  }

  PRONTIO.agenda.modalNew = { bind };
})(window);
