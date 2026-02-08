/**
 * PRONTIO - Auth Service (Supabase)
 * Autenticação usando Supabase Auth
 */

(function (global) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.services = PRONTIO.services || {};

  const getSupabase = () => PRONTIO.supabase;

  // ============================================================
  // AUTH SERVICE
  // ============================================================

  const AuthService = {

    /**
     * Login com email e senha
     */
    async login(email, password) {
      const supabase = getSupabase();

      try {
        const result = await supabase.signIn(email, password);

        if (result.error) {
          return { success: false, error: result.error.message || "Erro ao fazer login" };
        }

        if (!result.access_token) {
          return { success: false, error: "Credenciais inválidas" };
        }

        // Busca dados do usuário na tabela usuario
        const userData = await this._carregarDadosUsuario(result.user?.id);

        if (!userData) {
          return { success: false, error: "Usuário não encontrado no sistema" };
        }

        // Salva sessão (usa nomes compatíveis com session.js)
        PRONTIO.session = {
          userId: userData.id,
          idUsuario: userData.id,
          authUserId: result.user?.id,
          clinicaId: userData.clinica_id,
          idClinica: userData.clinica_id,
          nome: userData.nome_completo,
          nomeCompleto: userData.nome_completo,
          email: userData.email,
          perfil: userData.perfil,
          idProfissional: userData.profissional_id,
          profissionalId: userData.profissional_id
        };

        localStorage.setItem("prontio_session", JSON.stringify(PRONTIO.session));

        return {
          success: true,
          data: {
            user: userData,
            session: PRONTIO.session
          }
        };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    /**
     * Logout
     */
    async logout() {
      const supabase = getSupabase();

      try {
        await supabase.signOut();
        PRONTIO.session = null;
        localStorage.removeItem("prontio_session");
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    /**
     * Verifica se está autenticado
     */
    isAuthenticated() {
      const supabase = getSupabase();
      const session = supabase.getSession();
      return !!session?.access_token;
    },

    /**
     * Recupera sessão salva
     */
    async recuperarSessao() {
      try {
        const raw = localStorage.getItem("prontio_session");
        if (!raw) return null;

        const session = JSON.parse(raw);
        PRONTIO.session = session;

        // Verifica se o token do Supabase ainda é válido
        const supabase = getSupabase();
        const supabaseSession = supabase.getSession();

        if (!supabaseSession?.access_token) {
          this.logout();
          return null;
        }

        return session;
      } catch {
        return null;
      }
    },

    /**
     * Registra novo usuário
     */
    async registrar(email, password, dados) {
      const supabase = getSupabase();

      try {
        // Cria usuário no Supabase Auth
        const result = await supabase.signUp(email, password);

        if (result.error) {
          return { success: false, error: result.error.message };
        }

        // Cria registro na tabela usuario
        const { data, error } = await supabase
          .from("usuario")
          .insert({
            auth_user_id: result.user?.id,
            clinica_id: dados.clinicaId,
            nome_completo: dados.nomeCompleto,
            login: email,
            email: email,
            perfil: dados.perfil || "secretaria"
          });

        if (error) {
          return { success: false, error: error.message };
        }

        return { success: true, data: { user: data } };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    /**
     * Carrega dados do usuário da tabela usuario
     */
    async _carregarDadosUsuario(authUserId) {
      if (!authUserId) return null;

      const supabase = getSupabase();

      try {
        const { data, error } = await supabase
          .from("usuario")
          .select("*")
          .eq("auth_user_id", authUserId)
          .single();

        if (error || !data) {
          return null;
        }

        return data;
      } catch {
        return null;
      }
    },

    /**
     * Retorna usuário atual
     */
    getUsuarioAtual() {
      return PRONTIO.session || null;
    },

    /**
     * Retorna ID da clínica atual
     */
    getClinicaId() {
      return PRONTIO.session?.clinicaId || null;
    }
  };

  // Exporta
  PRONTIO.services.auth = AuthService;

  // Inicializa sessão se existir
  AuthService.recuperarSessao();

  console.info("[PRONTIO.services.auth] Serviço Supabase inicializado");

})(window);
