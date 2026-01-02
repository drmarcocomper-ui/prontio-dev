# PRONTIO — Arquitetura de Front-end (HTML/CSS/JS puro)

## 1. Objetivo

Este documento define a **arquitetura oficial do front-end do PRONTIO**, implementado com:

- HTML (uma página por módulo)
- CSS organizado por camadas
- JavaScript puro (sem frameworks pesados)

O foco é garantir:

- escalabilidade (crescimento sem “arquivo monstro”)
- previsibilidade (“onde coloco isso?” em segundos)
- baixo acoplamento (módulos independentes)
- facilidade de migração futura do backend sem reescrever front

---

## 2. Princípios fundamentais

1. **Front-end não conhece planilha**  
   A estrutura interna do Sheets é invisível para o front.

2. **Backend é API**  
   Toda chamada segue `{ action, payload }`, e toda resposta segue envelope JSON.

3. **Regras de negócio ficam no backend**  
   O front faz apenas UX, validações superficiais e apresentação.

4. **Localidade de mudança (Feature-First)**  
   Tudo que é de um módulo deve ficar próximo e coeso.

5. **Core mínimo e estável**  
   O core é infraestrutura compartilhada e muda pouco.

6. **Widgets são genéricos (Design System)**  
   Widgets não sabem nada de domínio médico.

---

## 3. Estrutura de diretórios (Front-end)

frontend/
├── *.html                           # páginas do sistema (1 por módulo)
├── partials/                        # topbar/sidebar
├── fragments/                       # blocos reutilizáveis HTML (pontuais)
└── assets/
    ├── css/
    ├── img/
    └── js/
        ├── core/
        ├── ui/
        ├── widgets/
        ├── pages/
        ├── features/
        └── print/

---

## 4. Camadas do JavaScript (responsabilidades e fronteiras)

### 4.1 `assets/js/core/` — Infraestrutura (mínimo e estável)

Responsabilidades:
- API client (`callApi`)
- sessão, autenticação, guard
- storage e estado global mínimo
- helpers genéricos (DOM, utils)
- tema
- UI base global (toast, loader, modal base)

Regras:
- `core/` **não pode conhecer** módulos
- algo só entra no core se for usado por **2+ módulos**
- core deve mudar **raramente**

---

### 4.2 `assets/js/pages/` — Bootstrap por página

Responsabilidades:
- carregar shell
- aplicar guard/autenticação
- iniciar a feature do módulo

Regras:
- não conter lógica de domínio
- não chamar actions do domínio
- manter-se pequeno

---

### 4.3 `assets/js/features/` — Módulos de negócio

Estrutura mínima:
- `*.entry`
- `*.controller`
- `*.api`
- `*.state`
- `*.view`
- `*.events`
- `*.formatters`

Regras:
- feature pode depender de `core/` e `widgets/`
- feature concentra toda a lógica do módulo

---

### 4.4 `assets/js/widgets/` — Design System

Widgets são componentes genéricos:
- não chamam API
- não conhecem domínio
- não dependem de features

Se conhece “agendamento”, não é widget.

---

### 4.5 `assets/js/ui/` — Shell global

Responsabilidades:
- sidebar/topbar
- responsive shell
- layout global

Sem regra de negócio.

---

### 4.6 `assets/js/print/` — Impressão

Responsabilidades:
- montar documentos
- reconstruir dados via API
- aplicar layout profissional

Regra:
- não depender do estado atual da página

---

## 5. Dependências permitidas

- pages → core, ui, features, widgets
- features → core, widgets
- ui → core, widgets
- widgets → core (helpers genéricos)
- core → NÃO depende de features
- print → core, widgets, api própria

---

## 6. Padrão de API no front-end

- `callApi({ action, payload })`
- resposta `{ success, data, errors }`

Actions do módulo ficam apenas em `*.api`.

---

## 7. Critério profissional para fragmentar arquivos

Fragmentar quando houver:
- motivos de mudança diferentes
- riscos diferentes
- crescimento inevitável

Fragmentar por **responsabilidade**, não por tamanho.

---

## 8. Checklist “onde coloco isso?”

1. Infra genérica? → core  
2. Entrada da página? → pages  
3. Lógica do módulo? → features  
4. Componente genérico? → widgets  
5. Shell global? → ui  
6. Impressão? → print  

---

## 9. Definição de sucesso

Arquitetura saudável quando:
- pages são pequenos
- core não é contaminado
- widgets são genéricos
- novas features entram sem refatoração
- o sistema é previsível

---

## 10. Status

Versão: 1.0  
Status: ativo  

Este documento define o padrão oficial do front-end PRONTIO.
