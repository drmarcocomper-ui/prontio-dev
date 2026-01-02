# PRONTIO — Catálogo de Ações da API (Contrato Front ↔ Backend)

## 1. Objetivo

Este documento define o **contrato oficial da API do PRONTIO**, descrevendo:

- ações (`action`)
- payloads esperados
- estrutura de resposta
- regras gerais de uso

Este contrato é **estável** e deve ser respeitado por:
- front-end
- backend (Apps Script ou qualquer backend futuro)

---

## 2. Princípios da API

1. A API é **orientada a ações**, não a endpoints REST.
2. Toda requisição segue o padrão `{ action, payload }`.
3. Toda resposta segue um envelope JSON padronizado.
4. O front-end **não conhece** banco de dados, planilhas ou schemas internos.
5. A API é a única porta de entrada para regras de negócio.

---

## 3. Formato padrão de requisição

Toda chamada deve seguir este formato:

{
  "action": "Modulo.Acao",
  "payload": {
    "...": "..."
  }
}

Regras:
- `action` é sempre uma string no formato `Modulo.Acao`
- `payload` é sempre um objeto (pode ser vazio `{}`)

---

## 4. Formato padrão de resposta

Toda resposta da API deve seguir este envelope:

{
  "success": true,
  "data": {},
  "errors": []
}

Campos:
- `success`: boolean
- `data`: objeto com os dados da resposta (ou `null`)
- `errors`: array de mensagens de erro (strings)

Regras:
- Nunca retornar dados fora desse envelope
- Nunca lançar erro “cru” para o front
- Erros de validação vão em `errors`

---

## 5. Convenção de nomes de ações

- Sempre no formato: `Modulo.Acao`
- Primeira letra do módulo em maiúscula
- Ação em PascalCase

Exemplos válidos:
- Agenda.List
- Agenda.Create
- Pacientes.Update
- Auth.Login

Exemplos inválidos:
- agenda_list
- getAgenda
- PACIENTES.CREATE

---

## 6. Ações por módulo

### 6.1 Auth

#### Auth.Login
Payload:
{
  "email": "string",
  "password": "string"
}

Resposta:
{
  "user": {},
  "token": "string"
}

---

#### Auth.Logout
Payload:
{}

Resposta:
{}

---

#### Auth.Me
Payload:
{}

Resposta:
{
  "user": {}
}

---

### 6.2 Agenda

#### Agenda.List
Payload:
{
  "date": "YYYY-MM-DD",
  "view": "day | week | month",
  "filters": {}
}

Resposta:
{
  "items": []
}

---

#### Agenda.Get
Payload:
{
  "idAgenda": "string"
}

Resposta:
{
  "agenda": {}
}

---

#### Agenda.Create
Payload:
{
  "data": {
    "idPaciente": "string",
    "data": "YYYY-MM-DD",
    "hora": "HH:mm",
    "tipo": "string",
    "observacoes": "string"
  }
}

Resposta:
{
  "idAgenda": "string"
}

---

#### Agenda.Update
Payload:
{
  "idAgenda": "string",
  "data": {}
}

Resposta:
{}

---

#### Agenda.Cancel
Payload:
{
  "idAgenda": "string",
  "motivo": "string"
}

Resposta:
{}

---

### 6.3 Pacientes

#### Pacientes.List
Payload:
{
  "search": "string",
  "page": 1
}

Resposta:
{
  "items": [],
  "total": 0
}

---

#### Pacientes.Get
Payload:
{
  "idPaciente": "string"
}

Resposta:
{
  "paciente": {}
}

---

#### Pacientes.Create
Payload:
{
  "data": {}
}

Resposta:
{
  "idPaciente": "string"
}

---

#### Pacientes.Update
Payload:
{
  "idPaciente": "string",
  "data": {}
}

Resposta:
{}

---

### 6.4 Atendimento

#### Atendimento.Start
Payload:
{
  "idAgenda": "string"
}

Resposta:
{
  "idAtendimento": "string"
}

---

#### Atendimento.Get
Payload:
{
  "idAtendimento": "string"
}

Resposta:
{
  "atendimento": {}
}

---

#### Atendimento.Finish
Payload:
{
  "idAtendimento": "string"
}

Resposta:
{}

---

### 6.5 Prontuario

#### Prontuario.Get
Payload:
{
  "idPaciente": "string"
}

Resposta:
{
  "prontuario": {}
}

---

### 6.6 Receita

#### Receita.Create
Payload:
{
  "idAtendimento": "string",
  "itens": []
}

Resposta:
{
  "idReceita": "string"
}

---

#### Receita.Get
Payload:
{
  "idReceita": "string"
}

Resposta:
{
  "receita": {}
}

---

### 6.7 Exames

#### Exames.Request
Payload:
{
  "idAtendimento": "string",
  "exames": []
}

Resposta:
{
  "idExame": "string"
}

---

### 6.8 Usuarios

#### Usuarios.List
Payload:
{}

Resposta:
{
  "items": []
}

---

## 7. Regras gerais obrigatórias

1. IDs são sempre gerados no backend
2. Front-end nunca usa nome como chave
3. Validação crítica acontece no backend
4. API nunca retorna estrutura interna de planilhas
5. Toda nova action deve ser documentada aqui

---

## 8. Versionamento futuro

Quando necessário:
- criar novas ações (não quebrar antigas)
- versionar via prefixo: AgendaV2.List
- manter compatibilidade enquanto possível

---

## 9. Status do documento

Versão: 1.0  
Status: ativo  

Este documento define o **contrato oficial da API do PRONTIO**.
