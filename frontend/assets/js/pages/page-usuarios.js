// =====================================
// PRONTIO - pages/page-usuarios.js
// Administração de usuários (multiusuário)
//
// Funcionalidades:
// - Listar usuários (Usuarios_Listar)
// - Criar novo usuário (Usuarios_Criar)
// - Editar usuário via modal (Usuarios_Atualizar)
//
// Requer perfil "admin" para gerenciar usuários.
// =====================================

(function (global, document) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  const api = PRONTIO.api || {};
  const auth = PRONTIO.auth || {};
  const widgets = (PRONTIO.widgets = PRONTIO.widgets || {});
  const toastWidget = widgets.toast || null;

  // ✅ IMPORTANTE:
  // callApi (envelope) != callApiData (data)
  const callApiData =
    typeof api.callApiData === "function"
      ? api.callApiData
      : typeof global.callApiData === "function"
      ? global.callApiData
      : null;

  let usuariosCache = []; // lista mais recente, para facilitar edição

  // -----------------------------------------
  // Mensagens
  // -----------------------------------------
  function showMessage(texto, tipo) {
    if (toastWidget && typeof toastWidget.createPageMessages === "function") {
      const pageMsg = toastWidget.createPageMessages("#mensagemUsuarios");
      const opts = { autoHide: tipo === "sucesso", autoHideDelay: 3000 };

      switch (tipo) {
        case "sucesso":
          pageMsg.sucesso(texto, opts);
          return;
        case "erro":
          pageMsg.erro(texto, opts);
          return;
        case "aviso":
          pageMsg.aviso(texto, opts);
          return;
        default:
          pageMsg.info(texto, opts);
          return;
      }
    }

    // fallback div
    const div = document.getElementById("mensagemUsuarios");
    if (!div) return;

    if (!texto) {
      div.className = "mensagem is-hidden";
      div.textContent = "";
      return;
    }

    div.className = "mensagem";
    div.textContent = texto;

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

  function clearMessage() {
    showMessage("", "info");
  }

  // -----------------------------------------
  // Modal helpers
  // -----------------------------------------
  function openEditModal() {
    const backdrop = document.getElementById("modalEditarUsuarioBackdrop");
    if (backdrop) {
      backdrop.classList.add("is-open");
    }
  }

  function closeEditModal() {
    const backdrop = document.getElementById("modalEditarUsuarioBackdrop");
    if (backdrop) {
      backdrop.classList.remove("is-open");
    }
  }

  function bindModalCloseButtons() {
    const backdrop = document.getElementById("modalEditarUsuarioBackdrop");
    if (!backdrop) return;

    const buttons = backdrop.querySelectorAll("[data-modal-close='modalEditarUsuarioBackdrop']");
    buttons.forEach((btn) => {
      if (btn.dataset.boundClose === "true") return;
      btn.dataset.boundClose = "true";
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        closeEditModal();
      });
    });

    // fechar com ESC
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        closeEditModal();
      }
    });
  }

  // -----------------------------------------
  // Carregar lista de usuários
  // -----------------------------------------
  async function carregarUsuarios() {
    if (!callApiData) {
      console.error("[PRONTIO.usuarios] callApiData não disponível.");
      showMessage("Erro interno: API não disponível.", "erro");
      return;
    }

    showMessage("Carregando usuários...", "info");

    try {
      const lista = await callApiData({
        action: "Usuarios_Listar",
        payload: {}
      });

      usuariosCache = Array.isArray(lista) ? lista : [];
      renderTabelaUsuarios(usuariosCache);
      showMessage("Usuários carregados com sucesso.", "sucesso");
    } catch (error) {
      console.error("[PRONTIO.usuarios] Erro ao carregar usuários:", error);
      const msg =
        (error && error.message) || "Erro inesperado ao carregar usuários.";
      showMessage(msg, "erro");
    }
  }

  function renderTabelaUsuarios(lista) {
    const tbody = document.getElementById("usuarios-tbody");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (!lista.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 6;
      td.textContent = "Nenhum usuário cadastrado.";
      td.className = "text-muted";
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    lista.forEach((u) => {
      const tr = document.createElement("tr");
      tr.dataset.userId = u.id || "";

      const tdNome = document.createElement("td");
      tdNome.textContent = u.nome || "";

      const tdLogin = document.createElement("td");
      tdLogin.textContent = u.login || "";

      const tdEmail = document.createElement("td");
      tdEmail.textContent = u.email || "";

      const tdPerfil = document.createElement("td");
      tdPerfil.textContent = u.perfil || "";

      const tdAtivo = document.createElement("td");
      tdAtivo.textContent = u.ativo ? "Ativo" : "Inativo";

      const tdAcoes = document.createElement("td");
      tdAcoes.className = "text-right";

      const btnEditar = document.createElement("button");
      btnEditar.type = "button";
      btnEditar.className = "btn btn-secondary btn-sm btn-usuarios-editar";
      btnEditar.textContent = "Editar";
      btnEditar.addEventListener("click", function () {
        abrirModalEditarUsuario(u.id);
      });

      tdAcoes.appendChild(btnEditar);

      tr.appendChild(tdNome);
      tr.appendChild(tdLogin);
      tr.appendChild(tdEmail);
      tr.appendChild(tdPerfil);
      tr.appendChild(tdAtivo);
      tr.appendChild(tdAcoes);

      tbody.appendChild(tr);
    });
  }

  // -----------------------------------------
  // Criar novo usuário
  // -----------------------------------------
  async function onSubmitNovoUsuario(event) {
    event.preventDefault();

    if (!callApiData) {
      showMessage("Erro interno: API não disponível.", "erro");
      return;
    }

    const nomeEl = document.getElementById("novoUsuarioNome");
    const loginEl = document.getElementById("novoUsuarioLogin");
    const emailEl = document.getElementById("novoUsuarioEmail");
    const perfilEl = document.getElementById("novoUsuarioPerfil");
    const senhaEl = document.getElementById("novoUsuarioSenha");

    const nome = (nomeEl?.value || "").trim();
    const login = (loginEl?.value || "").trim();
    const email = (emailEl?.value || "").trim();
    const perfil = (perfilEl?.value || "").trim() || "secretaria";
    const senha = senhaEl?.value || "";

    if (!nome) {
      showMessage("Informe o nome do usuário.", "erro");
      return;
    }
    if (!login) {
      showMessage("Informe o login do usuário.", "erro");
      return;
    }
    if (!senha) {
      showMessage("Informe uma senha para o usuário.", "erro");
      return;
    }

    showMessage("Criando usuário...", "info");

    try {
      await callApiData({
        action: "Usuarios_Criar",
        payload: {
          nome: nome,
          login: login,
          email: email,
          perfil: perfil,
          senha: senha
        }
      });

      showMessage("Usuário criado com sucesso.", "sucesso");

      if (nomeEl) nomeEl.value = "";
      if (loginEl) loginEl.value = "";
      if (emailEl) emailEl.value = "";
      if (senhaEl) senhaEl.value = "";

      carregarUsuarios();
    } catch (error) {
      console.error("[PRONTIO.usuarios] Erro ao criar usuário:", error);
      const msg =
        (error && error.message) || "Erro inesperado ao criar usuário.";
      showMessage(msg, "erro");
    }
  }

  // -----------------------------------------
  // Editar usuário via modal
  // -----------------------------------------
  function encontrarUsuarioPorId(id) {
    if (!id || !Array.isArray(usuariosCache)) return null;
    return usuariosCache.find((u) => String(u.id) === String(id)) || null;
  }

  function abrirModalEditarUsuario(idUsuario) {
    const usuario = encontrarUsuarioPorId(idUsuario);
    if (!usuario) {
      showMessage("Usuário não encontrado para edição.", "erro");
      return;
    }

    const idEl = document.getElementById("editarUsuarioId");
    const nomeEl = document.getElementById("editarUsuarioNome");
    const loginEl = document.getElementById("editarUsuarioLogin");
    const emailEl = document.getElementById("editarUsuarioEmail");
    const perfilEl = document.getElementById("editarUsuarioPerfil");
    const ativoEl = document.getElementById("editarUsuarioAtivo");

    if (idEl) idEl.value = usuario.id || "";
    if (nomeEl) nomeEl.value = usuario.nome || "";
    if (loginEl) loginEl.value = usuario.login || "";
    if (emailEl) emailEl.value = usuario.email || "";
    if (perfilEl) perfilEl.value = usuario.perfil || "secretaria";
    if (ativoEl) ativoEl.checked = !!usuario.ativo;

    openEditModal();
  }

  async function onSubmitEditarUsuario(event) {
    event.preventDefault();

    if (!callApiData) {
      showMessage("Erro interno: API não disponível.", "erro");
      return;
    }

    const idEl = document.getElementById("editarUsuarioId");
    const nomeEl = document.getElementById("editarUsuarioNome");
    const loginEl = document.getElementById("editarUsuarioLogin");
    const emailEl = document.getElementById("editarUsuarioEmail");
    const perfilEl = document.getElementById("editarUsuarioPerfil");
    const ativoEl = document.getElementById("editarUsuarioAtivo");

    const id = idEl?.value || "";
    const nome = (nomeEl?.value || "").trim();
    const login = (loginEl?.value || "").trim();
    const email = (emailEl?.value || "").trim();
    const perfil = (perfilEl?.value || "").trim() || "secretaria";
    const ativo = !!(ativoEl && ativoEl.checked);

    if (!id) {
      showMessage("Usuário inválido para edição.", "erro");
      return;
    }
    if (!nome) {
      showMessage("Informe o nome do usuário.", "erro");
      return;
    }
    if (!login) {
      showMessage("Informe o login do usuário.", "erro");
      return;
    }

    showMessage("Salvando alterações do usuário...", "info");

    try {
      await callApiData({
        action: "Usuarios_Atualizar",
        payload: {
          id: id,
          nome: nome,
          login: login,
          email: email,
          perfil: perfil,
          ativo: ativo
        }
      });

      showMessage("Usuário atualizado com sucesso.", "sucesso");
      closeEditModal();
      carregarUsuarios();
    } catch (error) {
      console.error("[PRONTIO.usuarios] Erro ao atualizar usuário:", error);
      const msg =
        (error && error.message) || "Erro inesperado ao atualizar usuário.";
      showMessage(msg, "erro");
    }
  }

  // -----------------------------------------
  // Permissão admin
  // -----------------------------------------
  function verificarPermissaoAdmin() {
    if (!auth || typeof auth.getUser !== "function") {
      return;
    }
    const user = auth.getUser();
    if (!user) return;

    const perfil = (user.perfil || "").toLowerCase();
    if (perfil !== "admin") {
      showMessage(
        "Apenas usuários administradores podem gerenciar usuários.",
        "erro"
      );
    }
  }

  // -----------------------------------------
  // Inicialização da página
  // -----------------------------------------
  function initUsuariosPage() {
    // Exige autenticação
    if (auth && typeof auth.requireAuth === "function") {
      auth.requireAuth();
    }

    verificarPermissaoAdmin();
    bindModalCloseButtons();

    const formNovo = document.getElementById("formNovoUsuario");
    if (formNovo) {
      formNovo.addEventListener("submit", onSubmitNovoUsuario);
    }

    const formEditar = document.getElementById("formEditarUsuario");
    if (formEditar) {
      formEditar.addEventListener("submit", onSubmitEditarUsuario);
    }

    const btnRecarregar = document.getElementById("btnRecarregarUsuarios");
    if (btnRecarregar) {
      btnRecarregar.addEventListener("click", function () {
        carregarUsuarios();
      });
    }

    carregarUsuarios();
  }

  if (typeof PRONTIO.registerPageInitializer === "function") {
    PRONTIO.registerPageInitializer("usuarios", initUsuariosPage);
  } else {
    PRONTIO.pages = PRONTIO.pages || {};
    PRONTIO.pages.usuarios = { init: initUsuariosPage };
  }
})(window, document);
