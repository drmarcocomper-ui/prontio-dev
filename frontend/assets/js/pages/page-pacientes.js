// frontend/assets/js/pages/page-pacientes.js
// ✅ Padronização (2026): usar nomeCompleto e remover nome_paciente

(function (global, document) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});

  const callApiData =
    (PRONTIO.api && PRONTIO.api.callApiData) ||
    global.callApiData ||
    function () {
      console.error("[Pacientes] callApiData não encontrado. Verifique assets/js/api.js.");
      return Promise.reject(new Error("API não inicializada (callApiData indefinido)."));
    };

  function setPacienteAtualGlobalFromPacientes(id, nomeCompleto) {
    var nome = String(nomeCompleto || "").trim();

    var info = {
      origem: "pacientes",
      id: id,
      idPaciente: id,
      ID_Paciente: id,

      // ✅ oficial
      nomeCompleto: nome,

      // alias (compat com módulos antigos; não é a verdade)
      nome: nome
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

  function formatarWarnings_(warnings) {
    if (!warnings || !Array.isArray(warnings) || warnings.length === 0) return "";

    const partes = [];

    warnings.forEach(function (w) {
      if (!w) return;
      const msg = String(w.message || "Aviso.").trim();
      const code = w.code ? String(w.code).trim() : "";
      let linha = "Atenção: " + msg + (code ? " (" + code + ")" : "");

      const matches = w.details && Array.isArray(w.details.matches) ? w.details.matches : null;
      if (matches && matches.length) {
        const itens = matches.slice(0, 3).map(function (m) {
          const nome = (m && m.nomeCompleto) ? String(m.nomeCompleto) : (m && m.nome ? String(m.nome) : "Sem nome");
          const id = (m && m.idPaciente) ? String(m.idPaciente) : "";
          return id ? (nome + " [ID: " + id + "]") : nome;
        });
        linha += " Possíveis registros: " + itens.join("; ") + ".";
      }

      partes.push(linha);
    });

    return partes.join(" ");
  }

  function mostrarWarnings_(warnings) {
    const txt = formatarWarnings_(warnings);
    if (!txt) return false;
    mostrarMensagem(txt, "info");
    return true;
  }

  async function copiarTextoParaClipboard_(texto) {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(texto);
        return true;
      }
    } catch (_) {}

    try {
      const ta = document.createElement("textarea");
      ta.value = texto;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return !!ok;
    } catch (_) {
      return false;
    }
  }

  function montarResumoPacienteParaCopiar_(p) {
    if (!p) return "";
    const id = String(p.idPaciente || p.ID_Paciente || p.id || "");
    const nome = String(p.nomeCompleto || p.nomeExibicao || p.nome || "");
    const cpf = String(p.cpf || "");
    const tel = String(p.telefonePrincipal || p.telefone1 || p.telefone || "");
    const email = String(p.email || "");
    const plano = String(p.planoSaude || "");
    return [
      "PRONTIO — Dados do paciente",
      "ID: " + id,
      "Nome: " + nome,
      cpf ? ("CPF: " + cpf) : "",
      tel ? ("Telefone: " + tel) : "",
      email ? ("E-mail: " + email) : "",
      plano ? ("Plano: " + plano) : ""
    ].filter(Boolean).join("\n");
  }

  let pacienteSelecionadoId = null;
  let pacienteSelecionadoNomeCompleto = null;
  let pacienteSelecionadoAtivo = null;
  let pacientesCache = [];

  let modoEdicao = false;
  let idEmEdicao = null;

  let criterioOrdenacao = "dataCadastroDesc";

  let debounceTimer = null;
  let carregando = false;

  let usarPaginacao = false;
  let pageAtual = 1;
  let pageSizeAtual = 50;
  let lastPaging = null;

  // ✅ Modo carregando: trava UI durante chamadas e aplica aria-busy
  function setLoading_(isLoading) {
    carregando = !!isLoading;

    try {
      document.body.classList.toggle("is-loading", carregando);
    } catch (_) {}

    try {
      const wrap = document.querySelector(".tabela-wrapper");
      if (wrap) wrap.setAttribute("aria-busy", carregando ? "true" : "false");
    } catch (_) {}

    const disableIds = [
      "btnCarregarPacientes",
      "btnNovoPaciente",
      "btnSalvarPaciente",
      "btnCancelarEdicao",
      "btnEditar",
      "btnInativar",
      "btnReativar",
      "btnIrProntuario",
      "btnCopiarDadosPaciente",
      "btnPaginaAnterior",
      "btnPaginaProxima",
      "chkUsarPaginacao",
      "selectPageSize",
      "btnConfigColunas"
    ];

    if (carregando) {
      disableIds.forEach(function (id) {
        const el = document.getElementById(id);
        if (el) el.disabled = true;
      });

      try {
        const filtro = document.getElementById("filtroTexto");
        if (filtro) filtro.disabled = true;
        const ativos = document.getElementById("chkSomenteAtivos");
        if (ativos) ativos.disabled = true;
        const orden = document.getElementById("selectOrdenacao");
        if (orden) orden.disabled = true;
      } catch (_) {}
    } else {
      try {
        const filtro = document.getElementById("filtroTexto");
        if (filtro) filtro.disabled = false;
        const ativos = document.getElementById("chkSomenteAtivos");
        if (ativos) ativos.disabled = false;
        const orden = document.getElementById("selectOrdenacao");
        if (orden) orden.disabled = false;
        const btnCols = document.getElementById("btnConfigColunas");
        if (btnCols) btnCols.disabled = false;

        const chkPag = document.getElementById("chkUsarPaginacao");
        if (chkPag) chkPag.disabled = false;

        const selPage = document.getElementById("selectPageSize");
        if (selPage) selPage.disabled = !usarPaginacao;

        const btnPrev = document.getElementById("btnPaginaAnterior");
        const btnNext = document.getElementById("btnPaginaProxima");
        if (btnPrev) btnPrev.disabled = !(usarPaginacao && lastPaging && lastPaging.hasPrev);
        if (btnNext) btnNext.disabled = !(usarPaginacao && lastPaging && lastPaging.hasNext);

        // Botões da lista dependem de seleção ativa
        const hasSel = !!pacienteSelecionadoId;
        const btnIr = document.getElementById("btnIrProntuario");
        const btnEd = document.getElementById("btnEditar");
        const btnIn = document.getElementById("btnInativar");
        const btnRe = document.getElementById("btnReativar");
        const btnCp = document.getElementById("btnCopiarDadosPaciente");

        if (btnIr) btnIr.disabled = !hasSel;
        if (btnEd) btnEd.disabled = !hasSel;
        if (btnCp) btnCp.disabled = !hasSel;

        // Inativar/reativar depende de ativo
        if (btnIn && btnRe) {
          if (!hasSel) {
            btnIn.disabled = true;
            btnRe.disabled = true;
          } else {
            if (pacienteSelecionadoAtivo) {
              btnIn.disabled = false;
              btnRe.disabled = true;
            } else {
              btnIn.disabled = true;
              btnRe.disabled = false;
            }
          }
        }

        // Form / edição
        const btnSalvar = document.getElementById("btnSalvarPaciente");
        const btnCancelar = document.getElementById("btnCancelarEdicao");
        if (btnSalvar) btnSalvar.disabled = false;
        if (btnCancelar) btnCancelar.disabled = !modoEdicao;

        const btnNovo = document.getElementById("btnNovoPaciente");
        if (btnNovo) btnNovo.disabled = false;

        const btnCar = document.getElementById("btnCarregarPacientes");
        if (btnCar) btnCar.disabled = false;
      } catch (_) {}
    }
  }

  function initPacientesPage() {
    initEventos();
    carregarConfigColunas();
    carregarPreferenciasPaginacao_();
    registrarAtalhosTeclado_();
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

    const btnCopiar = document.getElementById("btnCopiarDadosPaciente");

    const chkUsarPaginacao = document.getElementById("chkUsarPaginacao");
    const paginacaoControles = document.getElementById("paginacaoControles");
    const selectPageSize = document.getElementById("selectPageSize");
    const btnPaginaAnterior = document.getElementById("btnPaginaAnterior");
    const btnPaginaProxima = document.getElementById("btnPaginaProxima");

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

    if (btnCopiar) {
      btnCopiar.addEventListener("click", async function () {
        if (!pacienteSelecionadoId) {
          mostrarMensagem("Selecione um paciente primeiro.", "info");
          return;
        }
        const p = pacientesCache.find(function (px) {
          return String(px.idPaciente || px.ID_Paciente || px.id || "") === String(pacienteSelecionadoId);
        });
        if (!p) {
          mostrarMensagem("Paciente não encontrado na lista carregada.", "erro");
          return;
        }

        const texto = montarResumoPacienteParaCopiar_(p);
        const ok = await copiarTextoParaClipboard_(texto);
        if (ok) mostrarMensagem("Dados do paciente copiados para a área de transferência.", "sucesso");
        else mostrarMensagem("Não foi possível copiar automaticamente. Selecione e copie manualmente.", "info");
      });
    }

    function scheduleReload(ms) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        if (carregando) return;
        if (usarPaginacao) pageAtual = 1;
        carregarPacientes();
      }, ms);
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
        if (carregando) return;
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

    if (chkUsarPaginacao) {
      chkUsarPaginacao.addEventListener("change", function () {
        if (carregando) return;
        usarPaginacao = !!chkUsarPaginacao.checked;
        pageAtual = 1;
        salvarPreferenciasPaginacao_();
        if (paginacaoControles) paginacaoControles.style.display = usarPaginacao ? "flex" : "none";
        carregarPacientes();
      });
    }

    if (selectPageSize) {
      selectPageSize.addEventListener("change", function () {
        if (carregando) return;
        const n = parseInt(selectPageSize.value, 10);
        if (n && n > 0) pageSizeAtual = n;
        pageAtual = 1;
        salvarPreferenciasPaginacao_();
        if (usarPaginacao) carregarPacientes();
      });
    }

    if (btnPaginaAnterior) {
      btnPaginaAnterior.addEventListener("click", function () {
        if (carregando || !usarPaginacao) return;
        if (pageAtual > 1) {
          pageAtual -= 1;
          carregarPacientes();
        }
      });
    }

    if (btnPaginaProxima) {
      btnPaginaProxima.addEventListener("click", function () {
        if (carregando || !usarPaginacao) return;
        if (lastPaging && lastPaging.hasNext) {
          pageAtual += 1;
          carregarPacientes();
        }
      });
    }
  }

  function registrarAtalhosTeclado_() {
    document.addEventListener("keydown", function (ev) {
      try {
        const key = String(ev.key || "").toLowerCase();

        const tag = (ev.target && ev.target.tagName) ? String(ev.target.tagName).toLowerCase() : "";
        const isTypingField = (tag === "input" || tag === "textarea" || tag === "select");

        if (key === "escape") {
          const painel = document.getElementById("painelColunas");
          if (painel && !painel.classList.contains("oculto")) {
            painel.classList.add("oculto");
            ev.preventDefault();
            return;
          }
          if (modoEdicao) {
            sairModoEdicao(true);
            ev.preventDefault();
            return;
          }
          return;
        }

        if (isTypingField) return;

        if ((ev.ctrlKey || ev.metaKey) && key === "n") {
          const btnNovo = document.getElementById("btnNovoPaciente");
          if (btnNovo && !btnNovo.disabled) {
            btnNovo.click();
            ev.preventDefault();
          }
          return;
        }

        if ((ev.ctrlKey || ev.metaKey) && key === "f") {
          const filtro = document.getElementById("filtroTexto");
          if (filtro && typeof filtro.focus === "function") {
            filtro.focus();
            try { filtro.select(); } catch (_) {}
            ev.preventDefault();
          }
          return;
        }
      } catch (_) {}
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

    const obsImportantes = getValue("obsImportantes");
    const obsClinicas = getValue("observacoesClinicas");
    const obsAdministrativas = getValue("observacoesAdministrativas");
    const obsAdmFinal = obsAdministrativas || obsImportantes;

    return {
      nomeCompleto: getValue("nomeCompleto"),
      nomeSocial: getValue("nomeSocial"),
      dataNascimento: (document.getElementById("dataNascimento") || {}).value || "",
      sexo: (document.getElementById("sexo") || {}).value || "",
      estadoCivil: getValue("estadoCivil"),
      cpf: getValue("cpf"),
      rg: getValue("rg"),
      rgOrgaoEmissor: getValue("rgOrgaoEmissor"),
      telefone1: getValue("telefone1"),
      telefone2: getValue("telefone2"),
      email: getValue("email"),
      cep: getValue("cep"),
      logradouro: getValue("logradouro"),
      numero: getValue("numero"),
      complemento: getValue("complemento"),
      enderecoBairro: getValue("enderecoBairro"),
      enderecoCidade: getValue("enderecoCidade"),
      enderecoUf: getValue("enderecoUf"),
      planoSaude: getValue("planoSaude"),
      numeroCarteirinha: getValue("numeroCarteirinha"),
      observacoesClinicas: obsClinicas,
      observacoesAdministrativas: obsAdmFinal,
      obsImportantes: obsImportantes
    };
  }

  function preencherFormularioComPaciente(p) {
    const setValue = function (id, v) {
      const el = document.getElementById(id);
      if (el) el.value = v || "";
    };

    setValue("nomeCompleto", p.nomeCompleto || p.nome || "");
    setValue("nomeSocial", p.nomeSocial || "");
    setValue("dataNascimento", normalizeToISODateString_(p.dataNascimento || ""));
    setValue("sexo", p.sexo || "");
    setValue("estadoCivil", p.estadoCivil || "");
    setValue("cpf", p.cpf || "");
    setValue("rg", p.rg || "");
    setValue("rgOrgaoEmissor", p.rgOrgaoEmissor || "");
    setValue("telefone1", p.telefone1 || p.telefone || "");
    setValue("telefone2", p.telefone2 || "");
    setValue("email", p.email || "");
    setValue("cep", p.cep || "");
    setValue("logradouro", p.logradouro || "");
    setValue("numero", p.numero || "");
    setValue("complemento", p.complemento || "");
    setValue("enderecoBairro", p.enderecoBairro || p.bairro || "");
    setValue("enderecoCidade", p.enderecoCidade || p.cidade || "");
    setValue("enderecoUf", p.enderecoUf || "");
    setValue("planoSaude", p.planoSaude || "");
    setValue("numeroCarteirinha", p.numeroCarteirinha || "");
    setValue("observacoesClinicas", p.observacoesClinicas || "");
    setValue("observacoesAdministrativas", p.observacoesAdministrativas || "");
    setValue("obsImportantes", p.obsImportantes || p.observacoesAdministrativas || "");
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

  function salvarPreferenciasPaginacao_() {
    try {
      global.localStorage.setItem("prontio_pacientes_paginacao", JSON.stringify({
        enabled: !!usarPaginacao,
        pageSize: pageSizeAtual
      }));
    } catch (_) {}
  }

  function carregarPreferenciasPaginacao_() {
    const chk = document.getElementById("chkUsarPaginacao");
    const select = document.getElementById("selectPageSize");
    const controles = document.getElementById("paginacaoControles");

    try {
      const json = global.localStorage.getItem("prontio_pacientes_paginacao");
      if (json) {
        const cfg = JSON.parse(json);
        usarPaginacao = !!cfg.enabled;
        if (cfg.pageSize) pageSizeAtual = parseInt(cfg.pageSize, 10) || pageSizeAtual;
      }
    } catch (_) {}

    if (chk) chk.checked = !!usarPaginacao;
    if (select) select.value = String(pageSizeAtual);
    if (controles) controles.style.display = usarPaginacao ? "flex" : "none";
  }

  function atualizarUiPaginacao_(paging) {
    const btnPrev = document.getElementById("btnPaginaAnterior");
    const btnNext = document.getElementById("btnPaginaProxima");
    const info = document.getElementById("paginacaoInfo");
    const controles = document.getElementById("paginacaoControles");

    if (!usarPaginacao) {
      lastPaging = null;
      if (controles) controles.style.display = "none";
      return;
    }

    if (controles) controles.style.display = "flex";
    lastPaging = paging || null;

    const total = paging && typeof paging.total === "number" ? paging.total : null;
    const totalPages = paging && typeof paging.totalPages === "number" ? paging.totalPages : null;

    if (info) {
      if (total != null && totalPages != null) {
        info.textContent = "Página " + pageAtual + " de " + totalPages + " — " + total + " registro(s)";
      } else {
        info.textContent = "Página " + pageAtual;
      }
    }

    if (btnPrev) btnPrev.disabled = !(paging && paging.hasPrev);
    if (btnNext) btnNext.disabled = !(paging && paging.hasNext);
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
    setLoading_(true);

    const payload = estaEditando ? Object.assign({ idPaciente: idEmEdicao }, dados) : dados;

    let resp;
    try {
      resp = await callApiData({ action, payload });
    } catch (err) {
      const msg = (err && err.message) || "Erro ao salvar/atualizar paciente.";
      console.error("PRONTIO: erro em salvarPaciente:", err);
      mostrarMensagem(msg, "erro");
      setLoading_(false);
      return;
    }

    await carregarPacientes();

    mostrarMensagem(mensagemSucesso, "sucesso");

    const warnings = resp && resp.warnings ? resp.warnings : null;
    if (warnings && Array.isArray(warnings) && warnings.length) {
      mostrarWarnings_(warnings);
    }

    const form = document.getElementById("formPaciente");
    if (form) form.reset();
    if (estaEditando) sairModoEdicao(false);
    mostrarSecaoCadastro(false);

    setLoading_(false);
  }

  async function carregarPacientes() {
    if (carregando) return;

    const prevSelectedId = pacienteSelecionadoId ? String(pacienteSelecionadoId) : null;
    const prevEditId = (modoEdicao && idEmEdicao) ? String(idEmEdicao) : null;

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

    if (usarPaginacao) {
      payload.page = pageAtual;
      payload.pageSize = pageSizeAtual;
    }

    setLoading_(true);

    let data;
    try {
      data = await callApiData({
        action: "Pacientes_Listar",
        payload: payload
      });
    } catch (err) {
      const msg = (err && err.message) || "Erro ao carregar pacientes.";
      console.error("PRONTIO: erro em carregarPacientes:", err);
      mostrarMensagem(msg, "erro");
      setLoading_(false);
      return;
    }

    pacientesCache = (data && (data.pacientes || data.lista || data.items)) || [];
    aplicarFiltrosETabela();

    if (usarPaginacao) atualizarUiPaginacao_(data && data.paging ? data.paging : null);
    else atualizarUiPaginacao_(null);

    mostrarMensagem("Pacientes carregados: " + pacientesCache.length, "sucesso");

    if (pacientesCache.length === 0) {
      atualizarSelecaoPaciente(null, null, null);
      if (modoEdicao) sairModoEdicao(false);
      setLoading_(false);
      return;
    }

    if (prevSelectedId) {
      const pSel = pacientesCache.find(function (p) {
        return String(p.idPaciente || p.ID_Paciente || p.id || "") === prevSelectedId;
      });

      if (pSel) {
        const id = String(pSel.idPaciente || pSel.ID_Paciente || pSel.id || "");
        const nome = String(pSel.nomeCompleto || pSel.nome || "");
        const ativo =
          typeof pSel.ativo === "boolean"
            ? pSel.ativo
            : String(pSel.ativo || "").toUpperCase() === "SIM" ||
              String(pSel.ativo || "").toLowerCase() === "true";

        atualizarSelecaoPaciente(id, nome, ativo);

        const tr = document.querySelector("#tabelaPacientesBody tr[data-idPaciente='" + id + "']");
        if (tr) {
          const linhas = document.querySelectorAll("#tabelaPacientesBody tr");
          linhas.forEach(function (linha) { linha.classList.remove("linha-selecionada"); });
          tr.classList.add("linha-selecionada");
        }
      } else {
        atualizarSelecaoPaciente(null, null, null);
      }
    }

    if (prevEditId) {
      const pEdit = pacientesCache.find(function (p) {
        return String(p.idPaciente || p.ID_Paciente || p.id || "") === prevEditId;
      });

      if (pEdit) {
        modoEdicao = true;
        idEmEdicao = prevEditId;
        preencherFormularioComPaciente(pEdit);
        atualizarUIEdicao();
        mostrarSecaoCadastro(true);
      } else {
        modoEdicao = false;
        idEmEdicao = null;
        atualizarUIEdicao();
      }
    }

    setLoading_(false);
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
      tr.dataset.nomeCompleto = nome; // ✅ padronizado
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
        ["ativo", ativoBool ? "SIM" : "NAO"],

        ["nomeSocial", p.nomeSocial || ""],
        ["estadoCivil", p.estadoCivil || ""],
        ["rgOrgaoEmissor", p.rgOrgaoEmissor || ""],
        ["cep", p.cep || ""],
        ["logradouro", p.logradouro || ""],
        ["numero", p.numero || ""],
        ["complemento", p.complemento || ""],
        ["observacoesClinicas", p.observacoesClinicas || ""],
        ["observacoesAdministrativas", p.observacoesAdministrativas || ""]
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

    aplicarVisibilidadeColunas();
  }

  function selecionarPacienteNaTabela(tr) {
    const id = tr.dataset.idPaciente || null;
    const nome = tr.dataset.nomeCompleto || "";
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

  function atualizarSelecaoPaciente(id, nomeCompleto, ativo) {
    pacienteSelecionadoId = id;
    pacienteSelecionadoNomeCompleto = nomeCompleto;
    pacienteSelecionadoAtivo = ativo;

    const infoDiv = document.getElementById("pacienteSelecionadoInfo");
    const btnIrProntuario = document.getElementById("btnIrProntuario");
    const btnInativar = document.getElementById("btnInativar");
    const btnReativar = document.getElementById("btnReativar");
    const btnEditar = document.getElementById("btnEditar");
    const btnCopiar = document.getElementById("btnCopiarDadosPaciente");

    if (!id) {
      if (infoDiv) infoDiv.textContent = "Nenhum paciente selecionado.";
      if (btnIrProntuario) btnIrProntuario.disabled = true;
      if (btnInativar) btnInativar.disabled = true;
      if (btnReativar) btnReativar.disabled = true;
      if (btnEditar) btnEditar.disabled = true;
      if (btnCopiar) btnCopiar.disabled = true;
      clearPacienteAtualGlobal();
      return;
    }

    if (infoDiv) infoDiv.textContent = "Paciente selecionado: " + nomeCompleto + " (ID: " + id + ")";
    if (btnIrProntuario) btnIrProntuario.disabled = false;
    if (btnEditar) btnEditar.disabled = false;
    if (btnCopiar) btnCopiar.disabled = false;

    if (btnInativar && btnReativar) {
      if (ativo) {
        btnInativar.disabled = false;
        btnReativar.disabled = true;
      } else {
        btnInativar.disabled = true;
        btnReativar.disabled = false;
      }
    }

    setPacienteAtualGlobalFromPacientes(id, nomeCompleto);
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

    setPacienteAtualGlobalFromPacientes(pacienteSelecionadoId, pacienteSelecionadoNomeCompleto || "");

    try {
      global.localStorage.setItem(
        "prontio.prontuarioContexto",
        JSON.stringify({
          origem: "pacientes",
          ID_Paciente: pacienteSelecionadoId,
          idPaciente: pacienteSelecionadoId,
          // ✅ padronizado (removido nome_paciente)
          nomeCompleto: pacienteSelecionadoNomeCompleto || "",
          // alias (compat)
          nome: pacienteSelecionadoNomeCompleto || ""
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
    if (carregando) return;

    if (!pacienteSelecionadoId) {
      mostrarMensagem("Selecione um paciente na lista primeiro.", "info");
      return;
    }

    const acaoTexto = ativoDesejado ? "reativar" : "inativar";
    if (!global.confirm("Tem certeza que deseja " + acaoTexto + " este paciente?")) return;

    mostrarMensagem("Alterando status do paciente (" + acaoTexto + ")...", "info");
    setLoading_(true);

    try {
      await callApiData({
        action: "Pacientes_AlterarStatusAtivo",
        payload: { idPaciente: pacienteSelecionadoId, ativo: ativoDesejado }
      });
    } catch (err) {
      const msg = (err && err.message) || "Erro ao alterar status do paciente.";
      console.error("PRONTIO: erro em alterarStatusPaciente:", err);
      mostrarMensagem(msg, "erro");
      setLoading_(false);
      return;
    }

    mostrarMensagem("Status do paciente atualizado com sucesso.", "sucesso");
    await carregarPacientes();
    setLoading_(false);
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
