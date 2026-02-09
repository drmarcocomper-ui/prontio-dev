/**
 * PRONTIO - Pagina de Medicamentos
 * Cadastro e gerenciamento de medicamentos para receitas
 */

(function (global, document) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.pages = PRONTIO.pages || {};

  // Helpers
  const qs = (sel) => document.querySelector(sel);
  const qsa = (sel) => document.querySelectorAll(sel);

  // Estado
  let medicamentosLista = [];
  let editandoId = null;

  // Servico
  const getService = () => PRONTIO.services?.medicamentos || null;

  // ============================================================
  // CARREGAR LISTA
  // ============================================================

  async function carregarMedicamentos() {
    const container = qs("#listaMedicamentos");
    if (!container) return;

    container.innerHTML = '<p class="lista-vazia">Carregando medicamentos...</p>';

    const service = getService();
    if (!service) {
      container.innerHTML = '<p class="lista-vazia texto-erro">Servico de medicamentos nao disponivel.</p>';
      return;
    }

    const apenasAtivos = qs("#chkSomenteAtivos")?.checked ?? true;
    const apenasFavoritos = qs("#chkApenasFavoritos")?.checked ?? false;

    const result = await service.listar({ apenasAtivos, apenasFavoritos });

    if (!result.success) {
      container.innerHTML = `<p class="lista-vazia texto-erro">Erro: ${result.error}</p>`;
      return;
    }

    medicamentosLista = result.data?.medicamentos || [];
    renderLista();
  }

  function renderLista() {
    const container = qs("#listaMedicamentos");
    const contador = qs("#contadorMedicamentos");
    const filtro = (qs("#filtroTexto")?.value || "").toLowerCase().trim();

    if (!container) return;

    let lista = medicamentosLista;

    // Filtro por texto
    if (filtro) {
      lista = lista.filter(m =>
        (m.nome || "").toLowerCase().includes(filtro) ||
        (m.posologia || "").toLowerCase().includes(filtro)
      );
    }

    if (contador) {
      contador.textContent = `${lista.length} medicamento${lista.length !== 1 ? 's' : ''}`;
    }

    if (!lista.length) {
      container.innerHTML = '<p class="lista-vazia">Nenhum medicamento encontrado.</p>';
      return;
    }

    // Ordena alfabeticamente
    lista.sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

    container.innerHTML = lista.map(m => {
      const nome = m.nome || m.Nome_Medicacao || "(sem nome)";
      return `
      <div class="medicamento-card ${!m.ativo ? 'is-inativo' : ''}" data-id="${m.idMedicamento}">
        <div style="flex:1;font-weight:600;font-size:1rem;">${escapeHtml(nome)}</div>
        <div class="medicamento-card__actions">
          <button type="button" class="btn btn-sm secundario js-editar">Editar</button>
          <button type="button" class="btn btn-sm perigo js-deletar">Excluir</button>
        </div>
      </div>`;
    }).join("");

    // Bind eventos
    container.querySelectorAll(".medicamento-card").forEach(card => {
      const id = card.dataset.id;
      const med = medicamentosLista.find(m => m.idMedicamento === id);
      if (!med) return;

      card.querySelector(".js-editar")?.addEventListener("click", (e) => {
        e.stopPropagation();
        editarMedicamento(med);
      });

      card.querySelector(".js-deletar")?.addEventListener("click", async (e) => {
        e.stopPropagation();
        await deletarMedicamento(med);
      });

      card.addEventListener("click", () => editarMedicamento(med));
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ============================================================
  // FORMULARIO
  // ============================================================

  function mostrarFormulario() {
    const sec = qs("#secCadastroMedicamento");
    if (sec) sec.style.display = "";
  }

  function esconderFormulario() {
    const sec = qs("#secCadastroMedicamento");
    if (sec) sec.style.display = "none";
  }

  function limparFormulario() {
    editandoId = null;
    qs("#idMedicamento").value = "";
    qs("#nomeMedicamento").value = "";
    qs("#posologiaPadrao").value = "";
    qs("#quantidadePadrao").value = "";
    qs("#viaPadrao").value = "";
    qs("#tipoReceita").value = "COMUM";
    qs("#favoritoMedicamento").checked = false;

    qs("#tituloFormMedicamento").textContent = "Novo Medicamento";
    qs("#btnCancelarEdicao").style.display = "none";
    mostrarFormulario();
    qs("#nomeMedicamento")?.focus();
  }

  function editarMedicamento(med) {
    editandoId = med.idMedicamento;
    qs("#idMedicamento").value = med.idMedicamento || "";
    qs("#nomeMedicamento").value = med.nome || "";
    qs("#posologiaPadrao").value = med.posologia || "";
    qs("#quantidadePadrao").value = med.quantidade || "";
    qs("#viaPadrao").value = med.via || "";
    qs("#tipoReceita").value = med.tipoReceita || "COMUM";
    qs("#favoritoMedicamento").checked = !!med.favorito;

    qs("#tituloFormMedicamento").textContent = "Editar Medicamento";
    qs("#btnCancelarEdicao").style.display = "inline-flex";
    mostrarFormulario();

    qs("#secCadastroMedicamento")?.scrollIntoView({ behavior: "smooth", block: "start" });
    qs("#nomeMedicamento")?.focus();
  }

  async function salvarMedicamento(ev) {
    ev.preventDefault();

    const service = getService();
    if (!service) {
      mostrarMensagem("Servico nao disponivel", "erro");
      return;
    }

    const dados = {
      nome: qs("#nomeMedicamento")?.value?.trim() || "",
      posologia: qs("#posologiaPadrao")?.value?.trim() || "",
      quantidade: qs("#quantidadePadrao")?.value?.trim() || "",
      via: qs("#viaPadrao")?.value || "",
      tipoReceita: qs("#tipoReceita")?.value || "COMUM",
      favorito: qs("#favoritoMedicamento")?.checked || false
    };

    if (!dados.nome) {
      mostrarMensagem("Informe o nome do medicamento", "erro");
      return;
    }

    let result;
    if (editandoId) {
      result = await service.atualizar(editandoId, dados);
    } else {
      result = await service.criar(dados);
    }

    if (result.success) {
      mostrarMensagem(editandoId ? "Medicamento atualizado!" : "Medicamento cadastrado!", "sucesso");
      esconderFormulario();
      editandoId = null;
      await carregarMedicamentos();
    } else {
      mostrarMensagem(`Erro: ${result.error}`, "erro");
    }
  }

  // ============================================================
  // ACOES
  // ============================================================

  async function toggleFavorito(med) {
    const service = getService();
    if (!service) return;

    const result = await service.toggleFavorito(med.idMedicamento, !med.favorito);
    if (result.success) {
      med.favorito = !med.favorito;
      renderLista();
    }
  }

  async function excluirTodos() {
    const total = medicamentosLista.length;
    if (!total) {
      mostrarMensagem("Nenhum medicamento para excluir", "erro");
      return;
    }

    if (!confirm(`Excluir TODOS os ${total} medicamentos da lista?`)) return;

    const service = getService();
    if (!service) return;

    const btnExcluir = qs("#btnExcluirTodos");
    if (btnExcluir) {
      btnExcluir.disabled = true;
      btnExcluir.textContent = "Excluindo...";
    }

    let excluidos = 0;
    let erros = 0;

    for (const med of medicamentosLista) {
      const result = await service.atualizar(med.idMedicamento, { ativo: false });
      if (result.success) {
        excluidos++;
      } else {
        erros++;
        console.error(`[ExcluirTodos] Erro ao excluir ${med.nome}:`, result.error);
      }
    }

    if (btnExcluir) {
      btnExcluir.disabled = false;
      btnExcluir.textContent = "Excluir todos";
    }

    if (excluidos > 0) {
      const msg = erros ? `${excluidos} excluidos, ${erros} erros` : `${excluidos} medicamentos excluidos`;
      mostrarMensagem(msg, "sucesso");
    } else {
      mostrarMensagem("Nenhum medicamento foi excluido", "erro");
    }

    await carregarMedicamentos();
  }

  async function deletarMedicamento(med) {
    if (!confirm(`Excluir "${med.nome}" permanentemente?`)) return;

    const service = getService();
    if (!service) return;

    const result = await service.deletar(med.idMedicamento);

    if (result.success) {
      mostrarMensagem("Medicamento excluido", "sucesso");
      await carregarMedicamentos();
    } else {
      mostrarMensagem(`Erro: ${result.error}`, "erro");
    }
  }

  async function toggleAtivo(med) {
    const service = getService();
    if (!service) return;

    const novoStatus = !med.ativo;
    const result = await service.atualizar(med.idMedicamento, { ativo: novoStatus });

    if (result.success) {
      mostrarMensagem(novoStatus ? "Medicamento reativado" : "Medicamento inativado", "sucesso");
      await carregarMedicamentos();
    } else {
      mostrarMensagem(`Erro: ${result.error}`, "erro");
    }
  }

  // ============================================================
  // IMPORTAR CSV
  // ============================================================

  function abrirModalImportar() {
    const modal = qs("#modalImportarCsv");
    if (modal) {
      modal.style.display = "flex";
      qs("#csvImportArea").value = "";
      const fileInput = qs("#csvFileInput");
      if (fileInput) fileInput.value = "";
      const fileName = qs("#csvFileName");
      if (fileName) fileName.textContent = "Nenhum arquivo selecionado";
      qs("#csvImportArea")?.focus();
    }
  }

  function fecharModalImportar() {
    const modal = qs("#modalImportarCsv");
    if (modal) modal.style.display = "none";
  }

  function handleCsvFile(ev) {
    const file = ev.target.files?.[0];
    if (!file) return;

    const fileName = qs("#csvFileName");
    if (fileName) fileName.textContent = file.name;

    const reader = new FileReader();
    reader.onload = function (e) {
      const textarea = qs("#csvImportArea");
      if (textarea) textarea.value = e.target.result;
    };
    reader.readAsText(file, "UTF-8");
  }

  function detectarDelimitador(texto) {
    // Usa a primeira linha para detectar o delimitador
    const primeiraLinha = texto.split("\n")[0] || "";
    const tabs = (primeiraLinha.match(/\t/g) || []).length;
    const virgulas = (primeiraLinha.match(/,/g) || []).length;
    const pontoVirgulas = (primeiraLinha.match(/;/g) || []).length;

    if (tabs >= virgulas && tabs >= pontoVirgulas && tabs > 0) return "\t";
    if (pontoVirgulas >= virgulas && pontoVirgulas > 0) return ";";
    return ",";
  }

  function parseCsvLine(linha, delimitador) {
    const campos = [];
    let atual = "";
    let dentroAspas = false;

    for (let i = 0; i < linha.length; i++) {
      const ch = linha[i];

      if (ch === '"') {
        if (dentroAspas && linha[i + 1] === '"') {
          atual += '"';
          i++;
        } else {
          dentroAspas = !dentroAspas;
        }
      } else if (ch === delimitador && !dentroAspas) {
        campos.push(atual.trim());
        atual = "";
      } else {
        atual += ch;
      }
    }
    campos.push(atual.trim());
    return campos;
  }

  function normalizarNomeColuna(col) {
    return col.toLowerCase().replace(/[^a-z]/g, "");
  }

  function detectarCabecalho(cols) {
    const nomes = cols.map(normalizarNomeColuna);
    return nomes.some(n => n.includes("nome") || n.includes("medicacao") || n.includes("posologia"));
  }

  function mapearPorCabecalho(cabecalho, valores) {
    const mapa = {};
    cabecalho.forEach((col, i) => {
      const chave = normalizarNomeColuna(col);
      const val = (valores[i] || "").trim();

      if (chave.includes("nome") && chave.includes("medica")) mapa.Nome_Medicacao = val;
      else if (chave === "nome") mapa.Nome_Medicacao = val;
      else if (chave.includes("posologia")) mapa.Posologia = val;
      else if (chave.includes("quantidade")) mapa.Quantidade = val;
      else if (chave.includes("via")) mapa.Via_Administracao = val;
      else if (chave.includes("tipo") && chave.includes("receita")) mapa.Tipo_Receita = val;
      else if (chave.includes("favorito")) mapa.Favorito = val.toLowerCase() === "true" || val === "1";
      else if (chave.includes("ativo")) mapa.Ativo = val.toLowerCase() === "true" || val === "1";
    });
    return mapa;
  }

  async function processarCsv() {
    const csv = qs("#csvImportArea")?.value || "";
    if (!csv.trim()) {
      mostrarMensagem("Cole o conteudo CSV ou selecione um arquivo", "erro");
      return;
    }

    const linhas = csv.trim().split("\n");
    const delimitador = detectarDelimitador(csv);
    const medicamentos = [];
    let cabecalho = null;

    for (let i = 0; i < linhas.length; i++) {
      const linha = linhas[i].trim();
      if (!linha) continue;

      const cols = parseCsvLine(linha, delimitador);

      // Detecta cabecalho na primeira linha
      if (i === 0 && detectarCabecalho(cols)) {
        cabecalho = cols;
        continue;
      }

      let med;

      if (cabecalho) {
        med = mapearPorCabecalho(cabecalho, cols);
      } else {
        med = {
          Nome_Medicacao: (cols[0] || "").trim(),
          Posologia: (cols[1] || "").trim(),
          Quantidade: (cols[2] || "").trim(),
          Via_Administracao: (cols[3] || "").trim(),
          Tipo_Receita: (cols[4] || "COMUM").trim(),
          Favorito: (cols[5] || "").toLowerCase() === "true" || cols[5] === "1"
        };
      }

      if (!med.Nome_Medicacao) continue;

      if (!med.Tipo_Receita) med.Tipo_Receita = "COMUM";
      if (med.Favorito === undefined) med.Favorito = false;

      medicamentos.push(med);
    }

    if (!medicamentos.length) {
      mostrarMensagem("Nenhum medicamento valido encontrado no CSV", "erro");
      return;
    }

    const service = getService();
    if (!service) {
      mostrarMensagem("Servico nao disponivel", "erro");
      return;
    }

    // Feedback visual
    const btnProcessar = qs("#btnProcessarCsv");
    if (btnProcessar) {
      btnProcessar.disabled = true;
      btnProcessar.textContent = `Importando 0/${medicamentos.length}...`;
    }

    const result = await service.importarLote(medicamentos);

    if (btnProcessar) {
      btnProcessar.disabled = false;
      btnProcessar.textContent = "Importar";
    }

    if (result.success) {
      const msg = result.data?.erros
        ? `${result.data.importados} importados, ${result.data.erros} erros`
        : `${result.data?.importados || medicamentos.length} medicamentos importados!`;
      mostrarMensagem(msg, "sucesso");
      fecharModalImportar();
      await carregarMedicamentos();
    } else {
      mostrarMensagem(`Erro na importacao: ${result.error}`, "erro");
    }
  }

  // ============================================================
  // MENSAGENS
  // ============================================================

  function mostrarMensagem(texto, tipo) {
    const el = qs("#mensagem");
    if (!el) return;

    el.textContent = texto;
    el.className = `mensagem ${tipo || ""}`;
    el.style.display = "block";

    setTimeout(() => {
      el.style.display = "none";
    }, 4000);
  }

  // ============================================================
  // INIT
  // ============================================================

  function init() {
    // Form submit
    qs("#formMedicamento")?.addEventListener("submit", salvarMedicamento);

    // Botoes
    qs("#btnNovoMedicamento")?.addEventListener("click", limparFormulario);
    qs("#btnCancelarEdicao")?.addEventListener("click", esconderFormulario);
    qs("#btnImportarCsv")?.addEventListener("click", abrirModalImportar);
    qs("#btnExcluirTodos")?.addEventListener("click", excluirTodos);
    qs("#btnProcessarCsv")?.addEventListener("click", processarCsv);
    qs("#csvFileInput")?.addEventListener("change", handleCsvFile);

    // Modal fechar
    qsa("[data-close-modal]").forEach(btn => {
      btn.addEventListener("click", fecharModalImportar);
    });

    qs("#modalImportarCsv")?.addEventListener("click", (e) => {
      if (e.target === qs("#modalImportarCsv")) fecharModalImportar();
    });

    // Filtros
    qs("#filtroTexto")?.addEventListener("input", renderLista);
    qs("#chkSomenteAtivos")?.addEventListener("change", carregarMedicamentos);
    qs("#chkApenasFavoritos")?.addEventListener("change", carregarMedicamentos);

    // Carrega lista
    carregarMedicamentos();
  }

  PRONTIO.pages.medicamentos = { init };

})(window, document);
