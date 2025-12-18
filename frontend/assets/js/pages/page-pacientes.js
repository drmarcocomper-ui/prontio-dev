(function (global, document) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});

  // ✅ Padrão PRONTIO (assets/js/api.js):
  // - callApiData() retorna SOMENTE data e lança erro se success=false
  const callApiData =
    (PRONTIO.api && PRONTIO.api.callApiData) ||
    global.callApiData ||
    function () {
      console.error("[Pacientes] callApiData não encontrado. Verifique assets/js/api.js.");
      return Promise.reject(new Error("API não inicializada (callApiData indefinido)."));
    };

  function setPacienteAtualGlobalFromPacientes(id, nome) {
    var info = {
      origem: "pacientes",
      id: id,
      idPaciente: id,
      ID_Paciente: id,
      nome: nome,
      nomeCompleto: nome
    };

    try {
      if (PRONTIO.core && PRONTIO.core.state && typeof PRONTIO.core.state.setPacienteAtual === "function") {
        PRONTIO.core.state.setPacienteAtual(info);
      } else if (PRONTIO.state && typeof PRONTIO.state.setPacienteAtual === "function") {
        PRONTIO.state.setPacienteAtual(info);
      } else if (typeof global.setPacienteAtual === "function") {
        global.setPacienteAtual(info);
      }
    } catch (e) {
      console.warn("[Pacientes] Erro ao setPacienteAtualGlobalFromPacientes:", e);
    }
  }

  function clearPacienteAtualGlobal() {
    try {
      if (PRONTIO.core && PRONTIO.core.state && typeof PRONTIO.core.state.clearPacienteAtual === "function") {
        PRONTIO.core.state.clearPacienteAtual();
      } else if (PRONTIO.state && typeof PRONTIO.state.clearPacienteAtual === "function") {
        PRONTIO.state.clearPacienteAtual();
      } else if (typeof global.clearPacienteAtual === "function") {
        global.clearPacienteAtual();
      }
    } catch (e) {
      console.warn("[Pacientes] Erro ao clearPacienteAtualGlobal:", e);
    }
  }

  function createLocalPageMessages(selector) {
    const el = document.querySelector(selector);
    if (!el) {
      return {
        info: function () {},
        sucesso: function () {},
        erro: function () {},
        clear: function () {}
      };
    }

    function clear() {
      el.textContent = "";
      el.style.display = "none";
      el.classList.remove("msg-info", "msg-sucesso", "msg-erro");
    }

    function show(texto, tipo) {
      if (!texto) {
        clear();
        return;
      }
      el.textContent = texto;
      el.style.display = "block";
      el.classList.remove("msg-info", "msg-sucesso", "msg-erro");
      if (tipo === "erro") el.classList.add("msg-erro");
      else if (tipo === "sucesso") el.classList.add("msg-sucesso");
      else el.classList.add("msg-info");
    }

    return {
      info: function (t) { show(t, "info"); },
      sucesso: function (t) { show(t, "sucesso"); },
      erro: function (t) { show(t, "erro"); },
      clear: clear
    };
  }

  const msgs = createLocalPageMessages("#mensagem");

  function mostrarMensagem(texto, tipo) {
    if (!texto) {
      msgs.clear();
      return;
    }
    if (tipo === "erro") msgs.erro(texto);
    else if (tipo === "sucesso") msgs.sucesso(texto);
    else msgs.info(texto);
  }

  let pacienteSelecionadoId = null;
  let pacienteSelecionadoNome = null;
  let pacienteSelecionadoAtivo = null;
  let pacientesCache = [];

  let modoEdicao = false;
  let idEmEdicao = null;

  let criterioOrdenacao = "dataCadastroDesc";

  let debounceTimer = null;
  let carregando = false;

  function initPacientesPage() {
    initEventos();
    carregarConfigColunas();
    carregarPacientes();
  }

  function initEventos() {
    const form = document.getElementById("formPaciente");
    const btnCarregar = document.getElementById("btnCarregarPacientes");
    const btnIrProntuario = document.getElementById("btnIrProntuario");
    const btnInativar = document.getElementById("btnInativar");
    const btnReativar = document.getElementById("btnReativar");
    const btnEditar = document.getElementById("btnEditar");
    const btnCancelarEdicao = document.getElementById("btnCancelarEdicao");
    const btnNovoPaciente = document.getElementById("btnNovoPaciente");
    const filtroTexto = document.getElementById("filtroTexto");
    const chkSomenteAtivos = document.getElementById("chkSomenteAtivos");
    const selectOrdenacao = document.getElementById("selectOrdenacao");
    const btnConfigColunas = document.getElementById("btnConfigColunas");
    const painelColunas = document.getElementById("painelColunas");
    const btnFecharPainelColunas = document.getElementById("btnFecharPainelColunas");
    const checkboxesColunas = document.querySelectorAll(".chk-coluna");

    if (form) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        salvarPaciente();
      });
    }

    if (btnCarregar) btnCarregar.addEventListener("click", function () { carregarPacientes(); });
    if (btnIrProntuario) btnIrProntuario.addEventListener("click", function () { irParaProntuario(); });
    if (btnInativar) btnInativar.addEventListener("click", function () { alterarStatusPaciente(false); });
    if (btnReativar) btnReativar.addEventListener("click", function () { alterarStatusPaciente(true); });
    if (btnEditar) btnEditar.addEventListener("click", function () { entrarModoEdicaoPacienteSelecionado(); });
    if (btnCancelarEdicao) btnCancelarEdicao.addEventListener("click", function () { sairModoEdicao(); });

    if (btnNovoPaciente) {
      btnNovoPaciente.addEventListener("click", function () {
        sairModoEdicao(false);
        mostrarSecaoCadastro(true);
        const nomeInput = document.getElementById("nomeCompleto");
        if (nomeInput) nomeInput.focus();
        mostrarMensagem("Novo paciente: preencha os dados e salve.", "info");
      });
    }

    function scheduleReload(ms) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () { carregarPacientes(); }, ms);
    }

    if (filtroTexto) {
      filtroTexto.addEventListener("input", function () { scheduleReload(250); });
      filtroTexto.addEventListener("focus", function () { scheduleReload(0); });
    }

    if (chkSomenteAtivos) chkSomenteAtivos.addEventListener("change", function () { scheduleReload(0); });

    if (selectOrdenacao) {
      selectOrdenacao.addEventListener("change", function () {
        criterioOrdenacao = selectOrdenacao.value;
        scheduleReload(0);
      });
    }

    if (btnConfigColunas && painelColunas) {
      btnConfigColunas.addEventListener("click", function () {
        painelColunas.classList.toggle("oculto");
      });
    }

    if (btnFecharPainelColunas && painelColunas) {
      btnFecharPainelColunas.addEventListener("click", function () {
        painelColunas.classList.add("oculto");
      });
    }

    document.addEventListener("click", function (ev) {
      if (!painelColunas || painelColunas.classList.contains("oculto")) return;
      if (btnConfigColunas && (btnConfigColunas === ev.target || btnConfigColunas.contains(ev.target))) return;
      if (painelColunas === ev.target || painelColunas.contains(ev.target)) return;
      painelColunas.classList.add("oculto");
    });

    checkboxesColunas.forEach(function (chk) {
      chk.addEventListener("change", function () {
        aplicarVisibilidadeColunas();
      });
    });
  }

  function mostrarSecaoCadastro(visivel) {
    const sec = document.getElementById("secCadastroPaciente");
    if (!sec) return;
    if (visivel) sec.classList.remove("oculto");
    else sec.classList.add("oculto");
  }

  function obterDadosFormularioPaciente() {
    const getValue = function (id) {
      const el = document.getElementById(id);
      return (el && el.value ? el.value : "").trim();
    };

    return {
      nomeCompleto: getValue("nomeCompleto"),
      dataNascimento: (document.getElementById("dataNascimento") || {}).value || "",
      sexo: (document.getElementById("sexo") || {}).value || "",
      cpf: getValue("cpf"),
      rg: getValue("rg"),
      telefone1: getValue("telefone1"),
      telefone2: getValue("telefone2"),
      email: getValue("email"),
      enderecoBairro: getValue("enderecoBairro"),
      enderecoCidade: getValue("enderecoCidade"),
      enderecoUf: getValue("enderecoUf"),
      planoSaude: getValue("planoSaude"),
      numeroCarteirinha: getValue("numeroCarteirinha"),
      obsImportantes: getValue("obsImportantes")
    };
  }

  function preencherFormularioComPaciente(p) {
    const setValue = function (id, v) {
      const el = document.getElementById(id);
      if (el) el.value = v || "";
    };

    setValue("nomeCompleto", p.nomeCompleto || p.nome || "");
    setValue("dataNascimento", normalizeToISODateString_(p.dataNascimento || ""));
    setValue("sexo", p.sexo || "");
    setValue("cpf", p.cpf || "");
    setValue("rg", p.rg || "");
    setValue("telefone1", p.telefone1 || p.telefone || "");
    setValue("telefone2", p.telefone2 || "");
    setValue("email", p.email || "");
    setValue("enderecoBairro", p.enderecoBairro || p.bairro || "");
    setValue("enderecoCidade", p.enderecoCidade || p.cidade || "");
    setValue("enderecoUf", p.enderecoUf || "");
    setValue("planoSaude", p.planoSaude || "");
    setValue("numeroCarteirinha", p.numeroCarteirinha || "");
    setValue("obsImportantes", p.obsImportantes || "");
  }

  function normalizeToISODateString_(valor) {
    if (!valor) return "";
    if (typeof valor === "string") {
      const s = valor.trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
        const parts = s.split("/");
        return parts[2] + "-" + parts[1] + "-" + parts[0];
      }
      return "";
    }
    const d = new Date(valor);
    if (isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function atualizarUIEdicao() {
    const btnSalvar = document.getElementById("btnSalvarPaciente");
    const btnCancelarEdicao = document.getElementById("btnCancelarEdicao");

    if (!btnSalvar || !btnCancelarEdicao) return;

    if (modoEdicao) {
      btnSalvar.textContent = "Atualizar paciente";
      btnCancelarEdicao.classList.remove("oculto");
      mostrarSecaoCadastro(true);
    } else {
      btnSalvar.textContent = "Salvar paciente";
      btnCancelarEdicao.classList.add("oculto");
    }
  }

  function formatarDataParaBR(valor) {
    if (!valor) return "";
    if (typeof valor === "string") {
      const s = valor.trim();
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
      const soData = s.substring(0, 10);
      const partes = soData.split("-");
      if (partes.length === 3) {
        const ano = partes[0];
        const mes = partes[1];
        const dia = partes[2];
        return dia.padStart(2, "0") + "/" + mes.padStart(2, "0") + "/" + ano;
      }
      return s;
    }
    const d = new Date(valor);
    if (isNaN(d.getTime())) return "";
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");
    return dia + "/" + mes + "/" + ano;
  }

  async function salvarPaciente() {
    if (carregando) return;

    const dados = obterDadosFormularioPaciente();

    if (!dados.nomeCompleto) {
      mostrarMensagem("Nome completo é obrigatório.", "erro");
      return;
    }

    let action = "Pacientes_Criar";
    let mensagemProcesso = "Salvando paciente...";
    let mensagemSucesso = "Paciente salvo com sucesso!";

    const estaEditando = modoEdicao && idEmEdicao;

    if (estaEditando) {
      action = "Pacientes_Atualizar";
      mensagemProcesso = "Atualizando paciente...";
      mensagemSucesso = "Paciente atualizado com sucesso!";
    }

    mostrarMensagem(mensagemProcesso, "info");

    const payload = estaEditando ? Object.assign({ idPaciente: idEmEdicao }, dados) : dados;

    try {
      carregando = true;
      await callApiData({ action, payload });
    } catch (err) {
      carregando = false;
      const msg = (err && err.message) || "Erro ao salvar/atualizar paciente.";
      console.error("PRONTIO: erro em salvarPaciente:", err);
      mostrarMensagem(msg, "erro");
      return;
    }

    carregando = false;

    await carregarPacientes();

    mostrarMensagem(mensagemSucesso, "sucesso");
    const form = document.getElementById("formPaciente");
    if (form) form.reset();
    if (estaEditando) sairModoEdicao(false);
    mostrarSecaoCadastro(false);
  }

  async function carregarPacientes() {
    if (carregando) return;

    const filtroTextoEl = document.getElementById("filtroTexto");
    const chkSomenteAtivos = document.getElementById("chkSomenteAtivos");

    const termo = filtroTextoEl ? (filtroTextoEl.value || "").trim() : "";
    const somenteAtivos = chkSomenteAtivos ? !!chkSomenteAtivos.checked : false;

    const payload = {
      q: termo,
      termo: termo,
      somenteAtivos: somenteAtivos,
      ordenacao: criterioOrdenacao
    };

    let data;
    try {
      carregando = true;
      data = await callApiData({
        action: "Pacientes_Listar",
        payload: payload
      });
    } catch (err) {
      carregando = false;
      const msg = (err && err.message) || "Erro ao carregar pacientes.";
      console.error("PRONTIO: erro em carregarPacientes:", err);
      mostrarMensagem(msg, "erro");
      return;
    }

    carregando = false;

    pacientesCache = (data && (data.pacientes || data.lista || data.items)) || [];
    aplicarFiltrosETabela();
    mostrarMensagem("Pacientes carregados: " + pacientesCache.length, "sucesso");

    if (pacientesCache.length === 0) atualizarSelecaoPaciente(null, null, null);
  }

  function aplicarFiltrosETabela() {
    const tbody = document.getElementById("tabelaPacientesBody");
    if (!tbody) return;

    tbody.innerHTML = "";

    const lista = pacientesCache.slice();

    lista.forEach(function (p) {
      const id = String(p.idPaciente || p.ID_Paciente || p.id || "");
      const nome = String(p.nomeCompleto || p.nome || "");
      const ativoBool =
        typeof p.ativo === "boolean"
          ? p.ativo
          : String(p.ativo || "").toLowerCase() === "true" || String(p.ativo || "").toUpperCase() === "SIM";

      const tr = document.createElement("tr");
      tr.dataset.idPaciente = id;
      tr.dataset.nomePaciente = nome;
      tr.dataset.ativo = ativoBool ? "SIM" : "NAO";

      if (!ativoBool) tr.classList.add("linha-inativa");
      if (pacienteSelecionadoId && id === pacienteSelecionadoId) tr.classList.add("linha-selecionada");

      const tdNome = document.createElement("td");
      tdNome.textContent = nome;
      tdNome.dataset.col = "nome";
      tr.appendChild(tdNome);

      const colDefs = [
        ["dataCadastro", formatarDataParaBR(p.dataCadastro || p.criadoEm || p.CriadoEm || "")],
        ["dataNascimento", formatarDataParaBR(p.dataNascimento || "")],
        ["sexo", p.sexo || ""],
        ["cpf", p.cpf || ""],
        ["rg", p.rg || ""],
        ["telefone1", p.telefone1 || p.telefone || ""],
        ["telefone2", p.telefone2 || ""],
        ["email", p.email || ""],
        ["enderecoBairro", p.enderecoBairro || p.bairro || ""],
        ["enderecoCidade", p.enderecoCidade || p.cidade || ""],
        ["enderecoUf", p.enderecoUf || ""],
        ["obsImportantes", p.obsImportantes || ""],
        ["planoSaude", p.planoSaude || ""],
        ["numeroCarteirinha", p.numeroCarteirinha || ""],
        ["ativo", ativoBool ? "SIM" : "NAO"]
      ];

      colDefs.forEach(function (entry) {
        const col = entry[0];
        const valor = entry[1];
        const td = document.createElement("td");
        td.textContent = valor;
        td.dataset.col = col;
        tr.appendChild(td);
      });

      tr.addEventListener("click", function () {
        selecionarPacienteNaTabela(tr);
      });

      tbody.appendChild(tr);
    });

    if (lista.every(function (p) {
      const id = String(p.idPaciente || p.ID_Paciente || p.id || "");
      return id !== pacienteSelecionadoId;
    })) {
      const linhas = document.querySelectorAll("#tabelaPacientesBody tr");
      linhas.forEach(function (linha) {
        linha.classList.remove("linha-selecionada");
      });
    }

    aplicarVisibilidadeColunas();
  }

  function selecionarPacienteNaTabela(tr) {
    const id = tr.dataset.idPaciente || null;
    const nome = tr.dataset.nomePaciente || "";
    const ativo = tr.dataset.ativo === "SIM";

    const linhas = document.querySelectorAll("#tabelaPacientesBody tr");
    linhas.forEach(function (linha) {
      linha.classList.remove("linha-selecionada");
    });

    tr.classList.add("linha-selecionada");

    atualizarSelecaoPaciente(id, nome, ativo);

    if (modoEdicao && id) {
      const p = pacientesCache.find(function (px) {
        return String(px.idPaciente || px.ID_Paciente || px.id || "") === id;
      });
      if (p) {
        preencherFormularioComPaciente(p);
        idEmEdicao = id;
      }
    }
  }

  function atualizarSelecaoPaciente(id, nome, ativo) {
    pacienteSelecionadoId = id;
    pacienteSelecionadoNome = nome;
    pacienteSelecionadoAtivo = ativo;

    const infoDiv = document.getElementById("pacienteSelecionadoInfo");
    const btnIrProntuario = document.getElementById("btnIrProntuario");
    const btnInativar = document.getElementById("btnInativar");
    const btnReativar = document.getElementById("btnReativar");
    const btnEditar = document.getElementById("btnEditar");

    if (!id) {
      if (infoDiv) infoDiv.textContent = "Nenhum paciente selecionado.";
      if (btnIrProntuario) btnIrProntuario.disabled = true;
      if (btnInativar) btnInativar.disabled = true;
      if (btnReativar) btnReativar.disabled = true;
      if (btnEditar) btnEditar.disabled = true;
      clearPacienteAtualGlobal();
      return;
    }

    if (infoDiv) infoDiv.textContent = "Paciente selecionado: " + nome + " (ID: " + id + ")";
    if (btnIrProntuario) btnIrProntuario.disabled = false;
    if (btnEditar) btnEditar.disabled = false;

    if (btnInativar && btnReativar) {
      if (ativo) {
        btnInativar.disabled = false;
        btnReativar.disabled = true;
      } else {
        btnInativar.disabled = true;
        btnReativar.disabled = false;
      }
    }

    setPacienteAtualGlobalFromPacientes(id, nome);
  }

  function entrarModoEdicaoPacienteSelecionado() {
    if (!pacienteSelecionadoId) {
      mostrarMensagem("Selecione um paciente na lista primeiro.", "info");
      return;
    }

    const p = pacientesCache.find(function (px) {
      return String(px.idPaciente || px.ID_Paciente || px.id || "") === String(pacienteSelecionadoId);
    });

    if (!p) {
      mostrarMensagem("Paciente selecionado não encontrado na lista carregada.", "erro");
      return;
    }

    modoEdicao = true;
    idEmEdicao = pacienteSelecionadoId;
    preencherFormularioComPaciente(p);
    atualizarUIEdicao();
    mostrarMensagem("Editando paciente: " + (p.nomeCompleto || p.nome || ""), "info");
  }

  function sairModoEdicao(limparMensagem) {
    if (limparMensagem === void 0) limparMensagem = true;

    modoEdicao = false;
    idEmEdicao = null;
    const form = document.getElementById("formPaciente");
    if (form) form.reset();
    atualizarUIEdicao();
    mostrarSecaoCadastro(false);
    if (limparMensagem) mostrarMensagem("Edição cancelada.", "info");
  }

  function irParaProntuario() {
    if (!pacienteSelecionadoId) {
      mostrarMensagem("Selecione um paciente na lista primeiro.", "info");
      return;
    }

    setPacienteAtualGlobalFromPacientes(pacienteSelecionadoId, pacienteSelecionadoNome || "");

    try {
      global.localStorage.setItem(
        "prontio.prontuarioContexto",
        JSON.stringify({
          origem: "pacientes",
          ID_Paciente: pacienteSelecionadoId,
          idPaciente: pacienteSelecionadoId,
          nome_paciente: pacienteSelecionadoNome || ""
        })
      );
    } catch (e) {
      console.warn("[Pacientes] Não foi possível salvar prontio.prontuarioContexto:", e);
    }

    const params = new URLSearchParams();
    params.set("idPaciente", pacienteSelecionadoId);
    global.location.href = "prontuario.html?" + params.toString();
  }

  async function alterarStatusPaciente(ativoDesejado) {
    if (!pacienteSelecionadoId) {
      mostrarMensagem("Selecione um paciente na lista primeiro.", "info");
      return;
    }

    const acaoTexto = ativoDesejado ? "reativar" : "inativar";
    if (!global.confirm("Tem certeza que deseja " + acaoTexto + " este paciente?")) return;

    mostrarMensagem("Alterando status do paciente (" + acaoTexto + ")...", "info");

    try {
      carregando = true;
      await callApiData({
        action: "Pacientes_AlterarStatusAtivo",
        payload: { idPaciente: pacienteSelecionadoId, ativo: ativoDesejado }
      });
    } catch (err) {
      carregando = false;
      const msg = (err && err.message) || "Erro ao alterar status do paciente.";
      console.error("PRONTIO: erro em alterarStatusPaciente:", err);
      mostrarMensagem(msg, "erro");
      return;
    }

    carregando = false;

    mostrarMensagem("Status do paciente atualizado com sucesso.", "sucesso");
    await carregarPacientes();

    const pacienteAtual = pacientesCache.find(function (p) {
      return String(p.idPaciente || p.ID_Paciente || p.id || "") === String(pacienteSelecionadoId);
    });

    if (!pacienteAtual) {
      atualizarSelecaoPaciente(null, null, null);
    } else {
      const id = String(pacienteAtual.idPaciente || pacienteAtual.ID_Paciente || pacienteAtual.id || "");
      const nome = String(pacienteAtual.nomeCompleto || pacienteAtual.nome || "");
      const ativo = typeof pacienteAtual.ativo === "boolean" ? pacienteAtual.ativo : String(pacienteAtual.ativo || "").toUpperCase() === "SIM";
      atualizarSelecaoPaciente(id, nome, ativo);
      aplicarFiltrosETabela();
    }
  }

  function carregarConfigColunas() {
    try {
      const json = global.localStorage.getItem("prontio_pacientes_cols_visiveis");
      if (!json) return;

      const cfg = JSON.parse(json);
      const checkboxes = document.querySelectorAll(".chk-coluna");
      checkboxes.forEach(function (cb) {
        const col = cb.dataset.col;
        if (Object.prototype.hasOwnProperty.call(cfg, col)) cb.checked = !!cfg[col];
      });
    } catch (e) {
      console.warn("Erro ao carregar configuração de colunas:", e);
    }
  }

  function aplicarVisibilidadeColunas() {
    const checkboxes = document.querySelectorAll(".chk-coluna");
    const cfg = {};

    checkboxes.forEach(function (cb) {
      const col = cb.dataset.col;
      const visivel = cb.checked;
      cfg[col] = visivel;

      const cells = document.querySelectorAll("th[data-col='" + col + "'], td[data-col='" + col + "']");
      cells.forEach(function (cell) {
        if (visivel) cell.classList.remove("oculto-col");
        else cell.classList.add("oculto-col");
      });
    });

    try {
      global.localStorage.setItem("prontio_pacientes_cols_visiveis", JSON.stringify(cfg));
    } catch (e) {
      console.warn("Erro ao salvar configuração de colunas:", e);
    }
  }

  try {
    if (typeof PRONTIO.registerPage === "function") {
      PRONTIO.registerPage("pacientes", initPacientesPage);
    } else {
      PRONTIO.pages = PRONTIO.pages || {};
      PRONTIO.pages.pacientes = { init: initPacientesPage };
    }
  } catch (e) {
    console.error("[PRONTIO.pacientes] Erro ao registrar página:", e);
  }
})(window, document);
