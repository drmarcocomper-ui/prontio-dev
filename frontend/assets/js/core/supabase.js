/**
 * PRONTIO - Cliente Supabase
 * Conexão profissional com banco PostgreSQL
 */

(function (global) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});

  // ============================================================
  // CONFIGURAÇÃO SUPABASE
  // ============================================================

  const SUPABASE_URL = "https://amdyxagtjofofiomipnk.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtZHl4YWd0am9mb2Zpb21pcG5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1MDE1OTQsImV4cCI6MjA4NjA3NzU5NH0.3LxO9IBSus52AQeWCr7lVMcKH53A6mNFLKctn9S9Ed4";

  // ============================================================
  // CLIENTE SUPABASE (sem dependência externa)
  // ============================================================

  class SupabaseClient {
    constructor(url, key) {
      this.url = url;
      this.key = key;
      this.headers = {
        "apikey": key,
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
      };
    }

    // ========================================
    // AUTH
    // ========================================

    async signUp(email, password) {
      const res = await fetch(`${this.url}/auth/v1/signup`, {
        method: "POST",
        headers: { ...this.headers, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      return res.json();
    }

    async signIn(email, password) {
      const res = await fetch(`${this.url}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { ...this.headers, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.access_token) {
        this.setSession(data);
      }
      return data;
    }

    async signOut() {
      const session = this.getSession();
      if (session?.access_token) {
        await fetch(`${this.url}/auth/v1/logout`, {
          method: "POST",
          headers: {
            ...this.headers,
            "Authorization": `Bearer ${session.access_token}`
          }
        });
      }
      this.clearSession();
    }

    setSession(data) {
      localStorage.setItem("prontio_supabase_session", JSON.stringify({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user: data.user,
        expires_at: Date.now() + (data.expires_in * 1000)
      }));
    }

    getSession() {
      try {
        const raw = localStorage.getItem("prontio_supabase_session");
        if (!raw) return null;
        const session = JSON.parse(raw);
        if (session.expires_at && Date.now() > session.expires_at) {
          this.clearSession();
          return null;
        }
        return session;
      } catch {
        return null;
      }
    }

    clearSession() {
      localStorage.removeItem("prontio_supabase_session");
    }

    getUser() {
      const session = this.getSession();
      return session?.user || null;
    }

    getAuthHeaders() {
      const session = this.getSession();
      if (session?.access_token) {
        return {
          ...this.headers,
          "Authorization": `Bearer ${session.access_token}`
        };
      }
      return this.headers;
    }

    // ========================================
    // DATABASE - Query Builder
    // ========================================

    from(table) {
      return new QueryBuilder(this, table);
    }
  }

  // ============================================================
  // QUERY BUILDER
  // ============================================================

  class QueryBuilder {
    constructor(client, table) {
      this.client = client;
      this.table = table;
      this.queryParams = [];
      this.selectColumns = "*";
      this.orderByColumn = null;
      this.orderAscending = true;
      this.limitCount = null;
      this.offsetCount = null;
      this.singleRow = false;
    }

    select(columns = "*") {
      this.selectColumns = columns;
      return this;
    }

    eq(column, value) {
      this.queryParams.push(`${column}=eq.${encodeURIComponent(value)}`);
      return this;
    }

    neq(column, value) {
      this.queryParams.push(`${column}=neq.${encodeURIComponent(value)}`);
      return this;
    }

    gt(column, value) {
      this.queryParams.push(`${column}=gt.${encodeURIComponent(value)}`);
      return this;
    }

    gte(column, value) {
      this.queryParams.push(`${column}=gte.${encodeURIComponent(value)}`);
      return this;
    }

    lt(column, value) {
      this.queryParams.push(`${column}=lt.${encodeURIComponent(value)}`);
      return this;
    }

    lte(column, value) {
      this.queryParams.push(`${column}=lte.${encodeURIComponent(value)}`);
      return this;
    }

    like(column, pattern) {
      this.queryParams.push(`${column}=like.${encodeURIComponent(pattern)}`);
      return this;
    }

    ilike(column, pattern) {
      this.queryParams.push(`${column}=ilike.${encodeURIComponent(pattern)}`);
      return this;
    }

    in(column, values) {
      this.queryParams.push(`${column}=in.(${values.map(v => encodeURIComponent(v)).join(",")})`);
      return this;
    }

    is(column, value) {
      this.queryParams.push(`${column}=is.${value}`);
      return this;
    }

    or(conditions) {
      this.queryParams.push(`or=(${conditions})`);
      return this;
    }

    and(conditions) {
      this.queryParams.push(`and=(${conditions})`);
      return this;
    }

    order(column, { ascending = true } = {}) {
      this.orderByColumn = column;
      this.orderAscending = ascending;
      return this;
    }

    limit(count) {
      this.limitCount = count;
      return this;
    }

    offset(count) {
      this.offsetCount = count;
      return this;
    }

    single() {
      this.singleRow = true;
      this.limitCount = 1;
      return this;
    }

    maybeSingle() {
      this.singleRow = true;
      this.limitCount = 1;
      return this;
    }

    buildUrl() {
      let url = `${this.client.url}/rest/v1/${this.table}`;
      const params = [...this.queryParams];

      if (this.selectColumns !== "*") {
        params.push(`select=${encodeURIComponent(this.selectColumns)}`);
      }

      if (this.orderByColumn) {
        params.push(`order=${this.orderByColumn}.${this.orderAscending ? "asc" : "desc"}`);
      }

      if (this.limitCount !== null) {
        params.push(`limit=${this.limitCount}`);
      }

      if (this.offsetCount !== null) {
        params.push(`offset=${this.offsetCount}`);
      }

      if (params.length > 0) {
        url += "?" + params.join("&");
      }

      return url;
    }

    async execute(method = "GET", body = null) {
      const url = this.buildUrl();
      const options = {
        method,
        headers: this.client.getAuthHeaders()
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      try {
        const res = await fetch(url, options);

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          return {
            data: null,
            error: {
              message: errorData.message || `HTTP ${res.status}`,
              code: errorData.code || res.status
            }
          };
        }

        const data = await res.json();

        if (this.singleRow) {
          return { data: Array.isArray(data) ? data[0] || null : data, error: null };
        }

        return { data, error: null };
      } catch (err) {
        return { data: null, error: { message: err.message } };
      }
    }

    // SELECT
    async then(resolve) {
      const result = await this.execute("GET");
      resolve(result);
    }

    // INSERT
    async insert(data) {
      const url = `${this.client.url}/rest/v1/${this.table}`;
      const options = {
        method: "POST",
        headers: this.client.getAuthHeaders(),
        body: JSON.stringify(data)
      };

      try {
        const res = await fetch(url, options);
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          return { data: null, error: { message: errorData.message || `HTTP ${res.status}` } };
        }
        const result = await res.json();
        return { data: Array.isArray(result) ? result[0] : result, error: null };
      } catch (err) {
        return { data: null, error: { message: err.message } };
      }
    }

    // UPDATE
    async update(data) {
      const url = this.buildUrl();
      const options = {
        method: "PATCH",
        headers: this.client.getAuthHeaders(),
        body: JSON.stringify(data)
      };

      try {
        const res = await fetch(url, options);
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          return { data: null, error: { message: errorData.message || `HTTP ${res.status}` } };
        }
        const result = await res.json();
        return { data: result, error: null };
      } catch (err) {
        return { data: null, error: { message: err.message } };
      }
    }

    // DELETE
    async delete() {
      const url = this.buildUrl();
      const options = {
        method: "DELETE",
        headers: this.client.getAuthHeaders()
      };

      try {
        const res = await fetch(url, options);
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          return { data: null, error: { message: errorData.message || `HTTP ${res.status}` } };
        }
        return { data: true, error: null };
      } catch (err) {
        return { data: null, error: { message: err.message } };
      }
    }
  }

  // ============================================================
  // INSTÂNCIA GLOBAL
  // ============================================================

  const supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Exporta
  PRONTIO.supabase = supabase;
  PRONTIO.SupabaseClient = SupabaseClient;

  // Log
  console.info("[PRONTIO.supabase] Cliente inicializado:", SUPABASE_URL);

})(window);
