(function (global, document) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.features = PRONTIO.features || {};
  PRONTIO.features.prontuario = PRONTIO.features.prontuario || {};

  const { qs, qsa, parseDataHora, setBtnMais_, escapeHtml_, sortByDateDesc_, setMensagem_, formatDataHoraCompleta_, showToast_ } = PRONTIO.features.prontuario.utils;
  const { callApiDataTry_ } = PRONTIO.features.prontuario.api;
  const { carregarResumoPaciente_ } = PRONTIO.features.prontuario.paciente;

  // Cache de anamneses para o modal
  let anamnesesCache = [];

  let idEvolucaoEmEdicao = null;
  let historicoCompletoCarregado = false;

  // ✅ P4: Usa factory de utils para estado de paginação
  const { createPagingState_ } = PRONTIO.features.prontuario.utils;
  let evoPaging = createPagingState_();

  // ✅ P2: Usa função genérica de utils
  function setMensagemEvolucao(obj) {
    setMensagem_("#mensagemEvolucao", obj);
  }

  function abrirNovaEvolucao_() {
    const card = qs("#cardNovaEvolucao");
    if (!card) return;
    card.style.display = "";
    const txt = qs("#textoEvolucao");
    if (txt) txt.focus();
  }

  // ✅ P2: Usa função genérica de utils (também corrige o bug P1)
  function ordenarEvolucoes(lista) {
    return sortByDateDesc_(lista, ["dataHoraRegistro", "dataHora", "data", "criadoEm"]);
  }

  function renderListaEvolucoes(lista, ul, vazio) {
    ul.innerHTML = "";

    if (!lista || !lista.length) {
      vazio.classList.remove("is-hidden");
      vazio.textContent = "Nenhuma evolução registrada para este paciente.";
      return;
    }

    vazio.classList.add("is-hidden");

    lista.forEach((ev, index) => {
      const li = document.createElement("li");
      li.className = "evolucao-item";

      const idEvo = ev.idEvolucao || ev.ID_Evolucao || ev.id || "";
      const autor = ev.autor || ev.profissional || "";
      const origem = ev.origem || "";
      const dataRaw = ev.dataHoraRegistro || ev.dataHora || ev.data || ev.criadoEm || "";

      // ✅ P2: Usa função genérica de formatação
      const dataFmt = formatDataHoraCompleta_(dataRaw) || String(dataRaw || "");

      let botoesHTML = "";
      if (index === 0) {
        botoesHTML = `
          <div class="evo-actions">
            <button type="button" class="btn btn-secondary btn-sm btn-evo-usar-modelo" data-id="${idEvo}">Usar como modelo</button>
            <button type="button" class="btn btn-secondary btn-sm btn-evo-editar" data-id="${idEvo}">Editar evolução</button>
          </div>
        `;
      }

      li.innerHTML = `
        <div class="evo-header">
          <span class="evo-data">${dataFmt || ""}</span>
          ${autor ? `<span class="evo-autor">${escapeHtml_(autor)}</span>` : ""}
          ${origem ? `<span class="evo-origem badge">${escapeHtml_(origem)}</span>` : ""}
        </div>
        <div class="evo-texto">${escapeHtml_(ev.texto || "").replace(/\n/g, "<br>")}</div>
        ${botoesHTML}
      `;

      ul.appendChild(li);

      if (index === 0) {
        const btnModelo = li.querySelector(".btn-evo-usar-modelo");
        const btnEditar = li.querySelector(".btn-evo-editar");

        if (btnModelo) {
          btnModelo.addEventListener("click", () => {
            abrirNovaEvolucao_();
            const txt = qs("#textoEvolucao");
            if (txt) {
              txt.value = ev.texto || "";
              idEvolucaoEmEdicao = null;
              txt.focus();
            }
          });
        }

        if (btnEditar) {
          btnEditar.addEventListener("click", () => {
            abrirNovaEvolucao_();
            const txt = qs("#textoEvolucao");
            if (txt) {
              txt.value = ev.texto || "";
              idEvolucaoEmEdicao = idEvo;
              txt.focus();
            }
          });
        }
      }
    });
  }

  async function carregarEvolucoesPaginadas_(ctx, opts) {
    opts = opts || {};
    const append = !!opts.append;
    const ul = qs("#listaEvolucoesPaciente");
    const vazio = qs("#listaEvolucoesPacienteVazia");
    if (!ul || !vazio) return;

    if (evoPaging.loading) return;
    evoPaging.loading = true;

    let limit = Number(opts.limit);
    if (!limit || isNaN(limit) || limit < 1) limit = 10;
    if (limit > 200) limit = 200;
    evoPaging.lastLimit = limit;

    setBtnMais_(evoPaging.btnMais, evoPaging.hasMore, true);

    if (!ctx.idPaciente) {
      vazio.classList.remove("is-hidden");
      vazio.textContent = "Nenhum paciente selecionado.";
      evoPaging.loading = false;
      evoPaging.cursor = null;
      evoPaging.hasMore = false;
      evoPaging.lista = [];
      setBtnMais_(evoPaging.btnMais, false, false);
      return;
    }

    if (!append) {
      vazio.classList.remove("is-hidden");
      vazio.textContent = limit === 1 ? "Carregando última evolução clínica..." : "Carregando evoluções...";
      ul.innerHTML = "";
      evoPaging.lista = [];
      evoPaging.cursor = null;
      evoPaging.hasMore = false;
    }

    try {
      const payload = { idPaciente: ctx.idPaciente, limit: limit };
      if (append && evoPaging.cursor) payload.cursor = evoPaging.cursor;

      const data = await callApiDataTry_(
        ["Prontuario.Evolucao.ListarPorPacientePaged", "Prontuario.Evolucao.ListarPorPaciente", "Evolucao.ListarPorPaciente"],
        payload
      );

      const itemsPaged = data && (data.items || data.evolucoes || data.lista);
      let lista = Array.isArray(itemsPaged) ? itemsPaged : Array.isArray(data) ? data : [];
      lista = ordenarEvolucoes(lista);

      const nextCursor =
        data && (data.nextCursor || (data.page && data.page.nextCursor))
          ? data.nextCursor || data.page.nextCursor
          : null;
      const hasMore = !!(data && (data.hasMore || (data.page && data.page.hasMore)));

      if (!append) evoPaging.lista = lista.slice();
      else evoPaging.lista = evoPaging.lista.concat(lista);

      renderListaEvolucoes(evoPaging.lista, ul, vazio);

      evoPaging.cursor = nextCursor || null;
      evoPaging.hasMore = !!(hasMore && evoPaging.cursor);

      historicoCompletoCarregado = true;
    } catch (e) {
      // ✅ P1: Mensagem de erro com detalhes
      const detalhe = e && e.message ? ` (${e.message})` : "";
      console.error("[PRONTIO] Erro ao carregar evoluções:", e);
      vazio.classList.remove("is-hidden");
      vazio.textContent = `Erro ao carregar evoluções.${detalhe}`;
      evoPaging.cursor = null;
      evoPaging.hasMore = false;
    } finally {
      evoPaging.loading = false;
      setBtnMais_(evoPaging.btnMais, evoPaging.hasMore, false);
    }
  }

  async function salvarEvolucao(ctx, ev) {
    ev.preventDefault();

    const txt = qs("#textoEvolucao");
    const texto = txt && txt.value ? txt.value.trim() : "";
    if (!texto) {
      setMensagemEvolucao({ tipo: "erro", texto: "Digite a evolução." });
      return;
    }

    const payload = { idPaciente: ctx.idPaciente, idAgenda: ctx.idAgenda, texto, origem: "PRONTUARIO" };
    if (idEvolucaoEmEdicao) payload.idEvolucao = idEvolucaoEmEdicao;

    try {
      await callApiDataTry_(["Prontuario.Evolucao.Salvar", "Evolucao.Salvar"], payload);

      setMensagemEvolucao({
        tipo: "sucesso",
        texto: idEvolucaoEmEdicao ? "Evolução atualizada." : "Evolução registrada.",
      });

      if (txt) txt.value = "";
      idEvolucaoEmEdicao = null;

      carregarResumoPaciente_(ctx);

      // Sempre recarrega a lista após salvar
      const currentLimit = evoPaging.lastLimit && evoPaging.lastLimit > 0 ? evoPaging.lastLimit : 10;
      carregarEvolucoesPaginadas_(ctx, { append: false, limit: currentLimit });
    } catch (e) {
      // ✅ P1: Mensagem de erro com detalhes
      const detalhe = e && e.message ? ` (${e.message})` : "";
      console.error("[PRONTIO] Erro ao salvar evolução:", e);
      setMensagemEvolucao({ tipo: "erro", texto: `Erro ao salvar evolução.${detalhe}` });
    }
  }

  // ============================================================
  // INSERIR ANAMNESE NA EVOLUCAO
  // ============================================================

  function abrirModalSelecionarAnamnese_(ctx) {
    const modal = qs("#modalSelecionarAnamnese");
    if (!modal) {
      showToast_("Modal de anamnese nao encontrado.", "error");
      return;
    }

    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");

    carregarAnamnesesParaModal_(ctx);

    // Eventos de fechar
    const closeButtons = modal.querySelectorAll("[data-close-modal-anamnese]");
    closeButtons.forEach((btn) => {
      btn.onclick = () => fecharModalSelecionarAnamnese_();
    });

    // Clique no backdrop fecha
    modal.onclick = (ev) => {
      if (ev.target === modal) fecharModalSelecionarAnamnese_();
    };
  }

  function fecharModalSelecionarAnamnese_() {
    const modal = qs("#modalSelecionarAnamnese");
    if (modal) {
      modal.style.display = "none";
      modal.setAttribute("aria-hidden", "true");
    }
  }

  async function carregarAnamnesesParaModal_(ctx) {
    const lista = qs("#modalAnamneseLista");
    const vazio = qs("#modalAnamneseVazio");

    if (!lista) return;

    lista.innerHTML = "";
    if (vazio) {
      vazio.textContent = "Carregando anamneses...";
      vazio.style.display = "block";
    }

    const idPaciente = ctx.idPaciente || ctx.ID_Paciente || "";
    if (!idPaciente) {
      if (vazio) vazio.textContent = "Nenhum paciente selecionado.";
      return;
    }

    try {
      const data = await callApiDataTry_(
        ["Anamnese.ListarPorPaciente"],
        { idPaciente: idPaciente }
      );

      anamnesesCache = data && data.anamneses ? data.anamneses : [];

      if (!anamnesesCache.length) {
        if (vazio) vazio.textContent = "Nenhuma anamnese registrada para este paciente.";
        return;
      }

      // Ordena alfabeticamente pelo nome do template
      anamnesesCache.sort((a, b) => {
        const nomeA = (a.nomeTemplate || "").toLowerCase();
        const nomeB = (b.nomeTemplate || "").toLowerCase();
        return nomeA.localeCompare(nomeB);
      });

      if (vazio) vazio.style.display = "none";

      anamnesesCache.forEach((anamnese) => {
        const item = document.createElement("div");
        item.className = "anamnese-select-item";

        const templateNome = anamnese.nomeTemplate || (anamnese.dados && anamnese.dados.titulo) || "Anamnese";

        item.innerHTML = `
          <div class="anamnese-select-item__info">
            <span class="anamnese-select-item__nome">${escapeHtml_(templateNome)}</span>
          </div>
          <button type="button" class="btn btn-primary btn-sm">Inserir</button>
        `;

        const btnInserir = item.querySelector("button");
        btnInserir.addEventListener("click", () => {
          inserirAnamneseNaEvolucao_(anamnese);
          fecharModalSelecionarAnamnese_();
        });

        lista.appendChild(item);
      });

    } catch (err) {
      console.error("[PRONTIO] Erro ao carregar anamneses:", err);
      if (vazio) vazio.textContent = "Erro ao carregar anamneses.";
    }
  }

  function inserirAnamneseNaEvolucao_(anamnese) {
    const textarea = qs("#textoEvolucao");
    if (!textarea) return;

    const textoFormatado = formatarAnamneseParaEvolucao_(anamnese);

    // Se já houver texto, adiciona no final com separador
    if (textarea.value.trim()) {
      textarea.value = textarea.value.trim() + "\n\n---\n\n" + textoFormatado;
    } else {
      textarea.value = textoFormatado;
    }

    textarea.focus();
    showToast_("Anamnese inserida na evolucao.", "success");
  }

  function formatarAnamneseParaEvolucao_(anamnese) {
    const dados = anamnese.dados || {};
    const titulo = anamnese.nomeTemplate || dados.titulo || "Anamnese";

    // Formato simplificado (titulo + texto) - insere apenas o texto
    if (dados.texto) {
      return dados.texto;
    }

    // Formato legado (campos estruturados) - mantido para compatibilidade
    const linhas = [];
    linhas.push(`ANAMNESE (${titulo})`);
    linhas.push("");

    if (dados.queixaPrincipal) {
      linhas.push("QUEIXA PRINCIPAL:");
      linhas.push(dados.queixaPrincipal);
      linhas.push("");
    }

    if (dados.inicio || dados.evolucao || dados.fatoresAgravantes) {
      linhas.push("HISTORIA DA DOENCA ATUAL:");
      if (dados.inicio) linhas.push("- Inicio: " + dados.inicio);
      if (dados.evolucao) linhas.push("- Evolucao: " + dados.evolucao);
      if (dados.fatoresAgravantes) linhas.push("- Fatores agravantes/atenuantes: " + dados.fatoresAgravantes);
      linhas.push("");
    }

    if (dados.pessoais || dados.pessoaisOutros || dados.familiares) {
      linhas.push("ANTECEDENTES:");
      if (dados.pessoais && Array.isArray(dados.pessoais) && dados.pessoais.length) {
        linhas.push("- Pessoais: " + dados.pessoais.join(", "));
      }
      if (dados.pessoaisOutros) linhas.push("- Outros: " + dados.pessoaisOutros);
      if (dados.familiares) linhas.push("- Familiares: " + dados.familiares);
      linhas.push("");
    }

    if (dados.medicamentos && Array.isArray(dados.medicamentos) && dados.medicamentos.length) {
      linhas.push("MEDICAMENTOS EM USO:");
      dados.medicamentos.forEach((med) => {
        const partes = [];
        if (med.nome) partes.push(med.nome);
        if (med.dose) partes.push(med.dose);
        if (med.frequencia) partes.push(med.frequencia);
        if (partes.length) linhas.push("- " + partes.join(" - "));
      });
      linhas.push("");
    }

    if (dados.temAlergia || dados.alergias) {
      linhas.push("ALERGIAS:");
      if (dados.temAlergia) linhas.push("- Possui alergias: " + dados.temAlergia);
      if (dados.alergias) linhas.push("- " + dados.alergias);
      linhas.push("");
    }

    if (dados.tabagismo || dados.etilismo || dados.atividadeFisica) {
      linhas.push("HABITOS DE VIDA:");
      if (dados.tabagismo) linhas.push("- Tabagismo: " + dados.tabagismo);
      if (dados.etilismo) linhas.push("- Etilismo: " + dados.etilismo);
      if (dados.atividadeFisica) linhas.push("- Atividade fisica: " + dados.atividadeFisica);
      linhas.push("");
    }

    if (dados.pa || dados.fc || dados.temperatura || dados.peso || dados.altura || dados.observacoes) {
      linhas.push("EXAME FISICO:");
      const sinais = [];
      if (dados.pa) sinais.push("PA: " + dados.pa);
      if (dados.fc) sinais.push("FC: " + dados.fc);
      if (dados.temperatura) sinais.push("Temp: " + dados.temperatura);
      if (dados.peso) sinais.push("Peso: " + dados.peso + "kg");
      if (dados.altura) sinais.push("Altura: " + dados.altura + "cm");
      if (sinais.length) linhas.push("- " + sinais.join(" | "));
      if (dados.observacoes) linhas.push("- Obs: " + dados.observacoes);
      linhas.push("");
    }

    return linhas.join("\n").trim();
  }

  function setupInserirAnamneseBtn_(ctx) {
    const btn = qs("#btnInserirAnamnese");
    if (btn) {
      btn.addEventListener("click", () => abrirModalSelecionarAnamnese_(ctx));
    }

    // ESC fecha o modal
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        const modal = qs("#modalSelecionarAnamnese");
        if (modal && modal.style.display !== "none") {
          fecharModalSelecionarAnamnese_();
        }
      }
    });
  }

  PRONTIO.features.prontuario.evolucoes = {
    abrirNovaEvolucao_,
    salvarEvolucao,
    carregarEvolucoesPaginadas_,
    setBtnMaisRef: (btn) => (evoPaging.btnMais = btn),
    getEvoPaging: () => evoPaging,
    setHistoricoCarregado: (v) => (historicoCompletoCarregado = !!v),
    setupInserirAnamneseBtn_,
  };
})(window, document);
