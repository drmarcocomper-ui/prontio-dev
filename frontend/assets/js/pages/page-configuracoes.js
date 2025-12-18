// =====================================
// PRONTIO - pages/page-configuracoes.js
// Página de Configurações do PRONTIO
//
// Responsabilidades:
// - Carregar configurações via API (AgendaConfig_Obter)
// - Enviar configurações via API (AgendaConfig_Salvar)
// - Lidar com formulário de:
//   - dados do médico
//   - dados da clínica
//   - logo (URL)
//   - parâmetros da agenda (horário padrão, dias ativos, etc.)
//
// Integrações:
// - API: PRONTIO.api.callApi (core/api.js)
// - Mensagens: PRONTIO.widgets.toast (se disponível) ou <div id="mensagemConfig">
//
// Inicialização:
// - Registrada em PRONTIO.registerPageInitializer("configuracoes", fn)
// - Chamada por main.js quando <body data-page="configuracoes">
// =====================================

(function (global, document) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  const api = PRONTIO.api || {};
  const callApi =
    typeof api.callApi === "function"
      ? api.callApi
      : typeof global.callApi === "function"
      ? global.callApi
      : null;

  // Widgets de mensagem (toast) – se disponíveis
  const widgets = (PRONTIO.widgets = PRONTIO.widgets || {});
  const toastWidget = widgets.toast || null;
  const pageMessages =
    toastWidget && typeof toastWidget.createPageMessages === "function"
      ? toastWidget.createPageMessages("#mensagemConfig")
      : null;

  // -----------------------------------------
  // Helpers de mensagem
  // -----------------------------------------

  function mostrarMensagemConfig(texto, tipo) {
    // Se o widget de toast estiver disponível, usa ele
    if (pageMessages) {
      const opts =
        tipo === "sucesso"
          ? { autoHide: true, autoHideDelay: 3500 }
          : { autoHide: false };

      switch (tipo) {
        case "sucesso":
          pageMessages.sucesso(texto, opts);
          return;
        case "erro":
          pageMessages.erro(texto, opts);
          return;
        case "aviso":
          pageMessages.aviso(texto, opts);
          return;
        default:
          pageMessages.info(texto, opts);
          return;
      }
    }

    // Fallback: manipula <div id="mensagemConfig"> diretamente
    const div = document.getElementById("mensagemConfig");
    if (!div) return;

    if (!texto) {
      div.style.display = "none";
      div.textContent = "";
      div.className = "mensagem";
      return;
    }

    div.style.display = "block";
    div.textContent = texto;
    div.className = "mensagem";

    switch (tipo) {
      case "sucesso":
        div.classList.add("mensagem-sucesso");
        break;
      case "erro":
        div.classList.add("mensagem-erro");
        break;
      case "aviso":
        div.classList.add("mensagem-aviso");
        break;
      default:
        div.classList.add("mensagem-info");
        break;
    }
  }

  function limparMensagemConfig() {
    if (pageMessages) {
      pageMessages.clear();
      return;
    }
    const div = document.getElementById("mensagemConfig");
    if (!div) return;
    div.style.display = "none";
    div.textContent = "";
    div.className = "mensagem";
  }

  // -----------------------------------------
  // Helpers de formulário (dias da semana)
  // -----------------------------------------

  /**
   * Lê os checkboxes dos dias da semana e retorna um array de códigos (SEG, TER, ...).
   */
  function obterDiasAtivosDoFormulario() {
    const chks = document.querySelectorAll(".chk-dia-ativo");
    const dias = [];
    chks.forEach((chk) => {
      if (chk.checked) {
        dias.push(chk.value);
      }
    });
    return dias;
  }

  /**
   * Marca os checkboxes de dias da semana com base em um array de códigos.
   * @param {string[]} dias
   */
  function aplicarDiasAtivosNoFormulario(dias) {
    const chks = document.querySelectorAll(".chk-dia-ativo");
    const setDias = new Set(dias || []);
    chks.forEach((chk) => {
      chk.checked = setDias.has(chk.value);
    });
  }

  // -----------------------------------------
  // Carregar configurações do backend
  // -----------------------------------------

  async function carregarConfiguracoes() {
    if (!callApi) {
      console.error(
        "[PRONTIO.configuracoes] callApi não encontrado. Verifique core/api.js."
      );
      mostrarMensagemConfig(
        "Erro interno: API não disponível no front. Verifique console.",
        "erro"
      );
      return;
    }

    try {
      mostrarMensagemConfig("Carregando configurações...", "info");

      // IMPORTANTE:
      // core/api.js já garante:
      // - envio em formato { action, payload }
      // - resposta { success, data, errors } tratada
      // - lança erro em caso de !success
      // Aqui recebemos DIRETO o objeto data (cfg).
      const cfg = await callApi({
        action: "AgendaConfig_Obter",
        payload: {},
      });

      const configData = cfg || {};

      // Dados do médico
      const medicoNomeEl = document.getElementById("medicoNomeCompleto");
      const medicoCrmEl = document.getElementById("medicoCRM");
      const medicoEspEl = document.getElementById("medicoEspecialidade");

      if (medicoNomeEl) {
        medicoNomeEl.value = configData.medicoNomeCompleto || "";
      }
      if (medicoCrmEl) {
        medicoCrmEl.value = configData.medicoCRM || "";
      }
      if (medicoEspEl) {
        medicoEspEl.value = configData.medicoEspecialidade || "";
      }

      // Dados da clínica
      const clinicaNomeEl = document.getElementById("clinicaNome");
      const clinicaEnderecoEl = document.getElementById("clinicaEndereco");
      const clinicaTelefoneEl = document.getElementById("clinicaTelefone");
      const clinicaEmailEl = document.getElementById("clinicaEmail");

      if (clinicaNomeEl) {
        clinicaNomeEl.value = configData.clinicaNome || "";
      }
      if (clinicaEnderecoEl) {
        clinicaEnderecoEl.value = configData.clinicaEndereco || "";
      }
      if (clinicaTelefoneEl) {
        clinicaTelefoneEl.value = configData.clinicaTelefone || "";
      }
      if (clinicaEmailEl) {
        clinicaEmailEl.value = configData.clinicaEmail || "";
      }

      // Logo (URL)
      const logoInput = document.getElementById("clinicaLogoUrl");
      if (logoInput) {
        logoInput.value = configData.logoUrl || "";
      }

      // Preferências da agenda
      const horaIniEl = document.getElementById("agendaHoraInicioPadrao");
      const horaFimEl = document.getElementById("agendaHoraFimPadrao");
      const intervaloEl = document.getElementById("agendaIntervaloMinutos");

      if (horaIniEl) {
        horaIniEl.value = configData.hora_inicio_padrao || "";
      }
      if (horaFimEl) {
        horaFimEl.value = configData.hora_fim_padrao || "";
      }
      if (intervaloEl) {
        intervaloEl.value =
          configData.duracao_grade_minutos != null
            ? String(configData.duracao_grade_minutos)
            : "";
      }

      aplicarDiasAtivosNoFormulario(configData.dias_ativos || []);

      mostrarMensagemConfig(
        "Configurações carregadas com sucesso.",
        "sucesso"
      );
    } catch (error) {
      console.error("[PRONTIO.configuracoes] Erro ao carregar configurações:", error);
      const msg =
        (error && error.message) ||
        "Erro inesperado ao carregar configurações.";
      mostrarMensagemConfig(msg, "erro");
    }
  }

  // -----------------------------------------
  // Salvar configurações no backend
  // -----------------------------------------

  async function salvarConfiguracoes() {
    if (!callApi) {
      console.error(
        "[PRONTIO.configuracoes] callApi não encontrado. Verifique core/api.js."
      );
      mostrarMensagemConfig(
        "Erro interno: API não disponível no front. Verifique console.",
        "erro"
      );
      return;
    }

    const medicoNomeCompletoEl =
      document.getElementById("medicoNomeCompleto");
    const medicoCrmEl = document.getElementById("medicoCRM");
    const medicoEspEl = document.getElementById("medicoEspecialidade");

    const clinicaNomeEl = document.getElementById("clinicaNome");
    const clinicaEnderecoEl = document.getElementById("clinicaEndereco");
    const clinicaTelefoneEl = document.getElementById("clinicaTelefone");
    const clinicaEmailEl = document.getElementById("clinicaEmail");
    const clinicaLogoUrlEl = document.getElementById("clinicaLogoUrl");

    const horaIniEl = document.getElementById("agendaHoraInicioPadrao");
    const horaFimEl = document.getElementById("agendaHoraFimPadrao");
    const intervaloEl = document.getElementById("agendaIntervaloMinutos");

    const medicoNomeCompleto = (medicoNomeCompletoEl?.value || "").trim();
    const medicoCRM = (medicoCrmEl?.value || "").trim();
    const medicoEspecialidade = (medicoEspEl?.value || "").trim();

    const clinicaNome = (clinicaNomeEl?.value || "").trim();
    const clinicaEndereco = (clinicaEnderecoEl?.value || "").trim();
    const clinicaTelefone = (clinicaTelefoneEl?.value || "").trim();
    const clinicaEmail = (clinicaEmailEl?.value || "").trim();

    const logoUrl = (clinicaLogoUrlEl?.value || "").trim();

    const agendaHoraInicioPadrao = horaIniEl ? horaIniEl.value : "";
    const agendaHoraFimPadrao = horaFimEl ? horaFimEl.value : "";
    const agendaIntervaloMinutos = intervaloEl ? intervaloEl.value : "";

    const agendaDiasAtivos = obterDiasAtivosDoFormulario();

    // Validações mínimas
    if (!medicoNomeCompleto) {
      mostrarMensagemConfig("Informe o nome completo do médico.", "erro");
      return;
    }
    if (!medicoCRM) {
      mostrarMensagemConfig("Informe o CRM.", "erro");
      return;
    }

    mostrarMensagemConfig("Salvando configurações...", "info");

    const payloadConfig = {
      medicoNomeCompleto,
      medicoCRM,
      medicoEspecialidade,
      clinicaNome,
      clinicaEndereco,
      clinicaTelefone,
      clinicaEmail,
      logoUrl,
      hora_inicio_padrao: agendaHoraInicioPadrao,
      hora_fim_padrao: agendaHoraFimPadrao,
      duracao_grade_minutos: Number(agendaIntervaloMinutos || 30),
      dias_ativos: agendaDiasAtivos,
    };

    try {
      // callApi lança erro se success === false lá no backend
      await callApi({
        action: "AgendaConfig_Salvar",
        payload: payloadConfig,
      });

      mostrarMensagemConfig("Configurações salvas com sucesso.", "sucesso");
    } catch (error) {
      console.error("[PRONTIO.configuracoes] Erro ao salvar configurações:", error);
      const msg =
        (error && error.message) ||
        "Erro inesperado ao salvar configurações.";
      mostrarMensagemConfig(msg, "erro");
    }
  }

  // -----------------------------------------
  // Inicializador da página
  // -----------------------------------------

  function initConfiguracoesPage() {
    const form = document.getElementById("formConfiguracoes");
    const btnRecarregar = document.getElementById("btnRecarregarConfig");

    if (!callApi) {
      console.error(
        "[PRONTIO.configuracoes] callApi não disponível. Verifique core/api.js."
      );
      mostrarMensagemConfig(
        "Erro interno: API não disponível no front. Verifique console.",
        "erro"
      );
      return;
    }

    if (form) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        salvarConfiguracoes();
      });
    }

    if (btnRecarregar) {
      btnRecarregar.addEventListener("click", function () {
        carregarConfiguracoes();
      });
    }

    // Carrega configurações iniciais ao abrir a página
    carregarConfiguracoes();
  }

  // -----------------------------------------
  // Registro no PRONTIO (para main.js)
  // -----------------------------------------

  if (typeof PRONTIO.registerPageInitializer === "function") {
    PRONTIO.registerPageInitializer("configuracoes", initConfiguracoesPage);
  } else {
    // fallback: se o app.js ainda não estiver no padrão novo
    PRONTIO.pages = PRONTIO.pages || {};
    PRONTIO.pages.configuracoes = {
      init: initConfiguracoesPage,
    };
  }
})(window, document);
