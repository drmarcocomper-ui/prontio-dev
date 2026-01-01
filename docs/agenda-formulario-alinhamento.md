# PRONTIO — Formulário da Agenda alinhado ao schema canônico (profissional)

Este documento define **o que o formulário da Agenda deve ter** e **como cada campo mapeia** para o schema de persistência (aba `Agenda`) e para o backend (`Agenda.gs`).

---

## 1) Schema canônico da aba Agenda (persistência oficial)

**Aba `Agenda` (linha 1):**
- idAgenda
- idPaciente
- inicio
- fim
- titulo
- notas
- tipo
- status
- origem
- criadoEm
- atualizadoEm
- canceladoEm
- canceladoMotivo

> Tudo fora disso deve ser tratado como **metadado** e ir em `notas` (JSON).  
> Não manter colunas extras como Canal/Profissional/Sala/Bloqueio etc.

---

## 2) Contrato oficial do front com o backend (Agenda)

### 2.1 Criar/Atualizar (contrato local)
Payload base (consulta):
```json
{
  "data": "YYYY-MM-DD",
  "hora_inicio": "HH:MM",
  "duracao_minutos": 15,
  "ID_Paciente": "PAC-...",
  "tipo": "CONSULTA",
  "motivo": "texto curto",
  "origem": "RECEPCAO",
  "permitirEncaixe": false
}
