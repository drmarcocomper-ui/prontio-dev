// frontend/assets/js/features/agenda/agenda.events.js
(function (global) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.features = PRONTIO.features || {};
  PRONTIO.features.agenda = PRONTIO.features.agenda || {};

  // ✅ helper local: nome oficial no front é nomeCompleto
  function getNomeCompleto_(p) {
    if (!p) return "";
    return String(p.nomeCompleto || p.nome || "").trim();
  }

  function bindAgendaEvents({ document, dom, controller, state, view }) {
    // Init (controller precisa do dom)
    controller.initWithDom(dom);

    // Data change
    dom.inputData.addEventListener("change", () => controller.onChangeData(dom));

    // Hoje/agora
    dom.btnHoje && dom.btnHoje.addEventListener("click", () => controller.onClickHoje(dom));
    dom.btnAgora && dom.btnAgora.addEventListener("click", () => controller.onClickAgora(dom));

    // Navegação
    dom.btnDiaAnterior && dom.btnDiaAnterior.addEventListener("click", () => controller.onNavDia(dom, -1));
    dom.btnDiaPosterior && dom.btnDiaPosterior.addEventListener("click", () => controller.onNavDia(dom, +1));

    // Visão
    dom.btnVisaoDia && dom.btnVisaoDia.addEventListener("click", () => controller.onSetVisao(dom, "dia"));
    dom.btnVisaoSemana && dom.btnVisaoSemana.addEventListener("click", () => controller.onSetVisao(dom, "semana"));

    // Filtros
    let filtroDebounce = null;
    function scheduleFiltros() {
      if (filtroDebounce) clearTimeout(filtroDebounce);
      filtroDebounce = setTimeout(() => {
        controller.onFiltrosChanged(
          dom,
          dom.inputFiltroNome ? dom.inputFiltroNome.value : "",
          dom.selectFiltroStatus ? dom.selectFiltroStatus.value : ""
        );
      }, 120);
    }

    dom.inputFiltroNome &&
      dom.inputFiltroNome.addEventListener("input", () => scheduleFiltros());

    dom.inputFiltroNome &&
      dom.inputFiltroNome.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          scheduleFiltros();
        }
      });

    dom.selectFiltroStatus &&
      dom.selectFiltroStatus.addEventListener("change", () => scheduleFiltros());

    dom.btnLimparFiltros && dom.btnLimparFiltros.addEventListener("click", () => controller.onLimparFiltros(dom));

    // Ações
    dom.btnNovoAgendamento && dom.btnNovoAgendamento.addEventListener("click", () => controller.onOpenNovo());
    dom.btnBloquearHorario && dom.btnBloquearHorario.addEventListener("click", () => controller.onOpenBloqueio());

    // Modal Novo
    dom.btnFecharModalNovo && dom.btnFecharModalNovo.addEventListener("click", () => view.modalNovoClose());
    dom.btnCancelarModalNovo && dom.btnCancelarModalNovo.addEventListener("click", () => view.modalNovoClose());
    dom.modalNovo &&
      dom.modalNovo.addEventListener("click", (event) => {
        if (event.target === dom.modalNovo) view.modalNovoClose();
      });
    dom.formNovo && dom.formNovo.addEventListener("submit", (e) => { e.preventDefault(); controller.onSubmitNovo(dom); });

    // Modal Editar
    dom.btnFecharModalEditar && dom.btnFecharModalEditar.addEventListener("click", () => view.modalEditarClose());
    dom.btnCancelarEditar && dom.btnCancelarEditar.addEventListener("click", () => view.modalEditarClose());
    dom.modalEdit &&
      dom.modalEdit.addEventListener("click", (event) => {
        if (event.target === dom.modalEdit) view.modalEditarClose();
      });
    dom.formEditar && dom.formEditar.addEventListener("submit", (e) => { e.preventDefault(); controller.onSubmitEditar(dom); });

    // Modal Bloqueio
    dom.btnFecharModalBloqueio && dom.btnFecharModalBloqueio.addEventListener("click", () => view.modalBloqueioClose());
    dom.btnCancelarBloqueio && dom.btnCancelarBloqueio.addEventListener("click", () => view.modalBloqueioClose());
    dom.modalBloqueio &&
      dom.modalBloqueio.addEventListener("click", (event) => {
        if (event.target === dom.modalBloqueio) view.modalBloqueioClose();
      });
    dom.formBloqueio && dom.formBloqueio.addEventListener("submit", (e) => { e.preventDefault(); controller.onSubmitBloqueio(dom); });

    // Modal Pacientes (fallback)
    dom.btnSelecionarPaciente && dom.btnSelecionarPaciente.addEventListener("click", () => controller.onOpenPacientesNovo());
    dom.btnEditSelecionarPaciente && dom.btnEditSelecionarPaciente.addEventListener("click", () => controller.onOpenPacientesEditar());

    dom.btnFecharModalPacientes && dom.btnFecharModalPacientes.addEventListener("click", () => controller.onClosePacientes());
    dom.modalPacientes &&
      dom.modalPacientes.addEventListener("click", (event) => {
        if (event.target === dom.modalPacientes) controller.onClosePacientes();
      });

    // Limpar paciente (somente UI; seleção real é no state)
    dom.btnLimparPaciente &&
      dom.btnLimparPaciente.addEventListener("click", () => {
        state.pacienteNovo = null;
        dom.novoNomePaciente && (dom.novoNomePaciente.value = "");
      });

    dom.btnEditLimparPaciente &&
      dom.btnEditLimparPaciente.addEventListener("click", () => {
        state.pacienteEditar = null;
        // ✅ antes: state.agendamentoEmEdicao.nome_paciente
        dom.editNomePaciente && (dom.editNomePaciente.value = state.agendamentoEmEdicao ? (state.agendamentoEmEdicao.nomeCompleto || "") : "");
      });

    // Busca pacientes no modal (lista simples)
    let buscaTimeout = null;
    dom.buscaPacienteTermo &&
      dom.buscaPacienteTermo.addEventListener("input", () => {
        const termo = dom.buscaPacienteTermo.value;
        if (buscaTimeout) clearTimeout(buscaTimeout);
        buscaTimeout = setTimeout(async () => {
          if (!dom.msgPacientesEl || !dom.listaPacientesEl) return;

          const t = String(termo || "").trim();
          if (!t || t.length < 2) {
            dom.msgPacientesEl.textContent = "Digite pelo menos 2 caracteres para buscar.";
            dom.msgPacientesEl.className = "form-message info";
            dom.listaPacientesEl.innerHTML = "";
            return;
          }

          dom.msgPacientesEl.textContent = "Buscando pacientes...";
          dom.msgPacientesEl.className = "form-message info";
          dom.listaPacientesEl.innerHTML = "";

          try {
            const list = await controller.onBuscarPacientes(t);
            if (!list.length) {
              dom.msgPacientesEl.textContent = "Nenhum paciente encontrado.";
              dom.msgPacientesEl.className = "form-message info";
              dom.listaPacientesEl.innerHTML = "";
              return;
            }

            dom.msgPacientesEl.textContent = "";
            dom.msgPacientesEl.className = "form-message";

            dom.listaPacientesEl.innerHTML = "";
            list.forEach((p) => {
              const item = document.createElement("button");
              item.type = "button";
              item.className = "paciente-lista-item";

              const linha1 = document.createElement("div");
              linha1.className = "paciente-lista-nome";
              // ✅ antes: p.nome
              linha1.textContent = getNomeCompleto_(p) || "(sem nome)";

              const linha2 = document.createElement("div");
              linha2.className = "paciente-lista-detalhes";
              const parts = [];
              if (p.documento) parts.push(p.documento);
              if (p.telefone) parts.push(p.telefone);
              if (p.data_nascimento) parts.push("Nasc.: " + p.data_nascimento);
              linha2.textContent = parts.join(" • ");

              item.appendChild(linha1);
              item.appendChild(linha2);

              item.addEventListener("click", () => controller.onPacienteSelecionado(p, dom));
              dom.listaPacientesEl.appendChild(item);
            });
          } catch (err) {
            console.error(err);
            dom.msgPacientesEl.textContent = "Erro ao buscar pacientes: " + (err && err.message ? err.message : String(err));
            dom.msgPacientesEl.className = "form-message erro";
            dom.listaPacientesEl.innerHTML = "";
          }
        }, 300);
      });

    // Typeahead genérico (inputs do novo/editar)
    if (PRONTIO.widgets && PRONTIO.widgets.typeahead) {
      const { attachTypeahead } = PRONTIO.widgets.typeahead;

      attachTypeahead({
        inputEl: dom.novoNomePaciente,
        minChars: 2,
        fetchItems: async (q) => await controller.onBuscarPacientes(q),
        renderItem: (p) => ({
          // ✅ antes: p.nome
          title: getNomeCompleto_(p) || "(sem nome)",
          subtitle: [p.documento, p.telefone, p.data_nascimento ? "Nasc.: " + p.data_nascimento : ""].filter(Boolean).join(" • ")
        }),
        onSelect: (p) => {
          state.pacienteNovo = p;
          // ✅ antes: dom.novoNomePaciente.value = p.nome
          dom.novoNomePaciente && (dom.novoNomePaciente.value = getNomeCompleto_(p) || "");
          if (p.telefone && dom.novoTelefone && !String(dom.novoTelefone.value || "").trim()) dom.novoTelefone.value = p.telefone;
        }
      });

      attachTypeahead({
        inputEl: dom.editNomePaciente,
        minChars: 2,
        fetchItems: async (q) => await controller.onBuscarPacientes(q),
        renderItem: (p) => ({
          // ✅ antes: p.nome
          title: getNomeCompleto_(p) || "(sem nome)",
          subtitle: [p.documento, p.telefone, p.data_nascimento ? "Nasc.: " + p.data_nascimento : ""].filter(Boolean).join(" • ")
        }),
        onSelect: (p) => {
          state.pacienteEditar = p;
          // ✅ antes: dom.editNomePaciente.value = p.nome
          dom.editNomePaciente && (dom.editNomePaciente.value = getNomeCompleto_(p) || "");
        }
      });
    }

    // ESC fecha qualquer modal aberto
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (view.isModalVisible(dom.modalPacientes)) return view.modalPacientesClose();
      if (view.isModalVisible(dom.modalBloqueio)) return view.modalBloqueioClose();
      if (view.isModalVisible(dom.modalEdit)) return view.modalEditarClose();
      if (view.isModalVisible(dom.modalNovo)) return view.modalNovoClose();
    });
  }

  PRONTIO.features.agenda.events = { bindAgendaEvents };
})(window);
