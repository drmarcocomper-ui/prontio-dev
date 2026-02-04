(function (global, document) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.features = PRONTIO.features || {};
  PRONTIO.features.prontuario = PRONTIO.features.prontuario || {};

  const { qs, qsa, parseDataHora, setBtnMais_, escapeHtml_, sortByDateDesc_, setMensagem_, formatDataHoraCompleta_ } = PRONTIO.features.prontuario.utils;
  const { callApiDataTry_ } = PRONTIO.features.prontuario.api;
  const { carregarResumoPaciente_ } = PRONTIO.features.prontuario.paciente;

  let idEvolucaoEmEdicao = null;
  let historicoCompletoCarregado = false;

  let evoPaging = {
    btnMais: null,
    cursor: null,
    hasMore: false,
    loading: false,
    lista: [],
    lastLimit: 10,
  };

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
        <div class="evo-texto">${String(ev.texto || "").replace(/\n/g, "<br>")}</div>
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

      if (historicoCompletoCarregado) {
        const currentLimit = evoPaging.lastLimit && evoPaging.lastLimit > 0 ? evoPaging.lastLimit : 1;
        carregarEvolucoesPaginadas_(ctx, { append: false, limit: currentLimit });
      }
    } catch (e) {
      // ✅ P1: Mensagem de erro com detalhes
      const detalhe = e && e.message ? ` (${e.message})` : "";
      console.error("[PRONTIO] Erro ao salvar evolução:", e);
      setMensagemEvolucao({ tipo: "erro", texto: `Erro ao salvar evolução.${detalhe}` });
    }
  }

  PRONTIO.features.prontuario.evolucoes = {
    abrirNovaEvolucao_,
    salvarEvolucao,
    carregarEvolucoesPaginadas_,
    setBtnMaisRef: (btn) => (evoPaging.btnMais = btn),
    getEvoPaging: () => evoPaging,
    setHistoricoCarregado: (v) => (historicoCompletoCarregado = !!v),
  };
})(window, document);
