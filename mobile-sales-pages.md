# Plano de Otimização das Páginas de Vendas para Mobile

Este documento descreve a arquitetura, tarefas de implementação e critérios de aceitação para transformar as páginas de vendas do projeto **Rotina com Deus** em uma experiência mobile-first premium.

---

## 📋 Overview

O objetivo deste projeto é revisar e otimizar os arquivos HTML (`index.html`, `v2.html`, `obrigado.html`), o stylesheet (`src/style.css`) e o javascript (`src/main.js`) para garantir que 100% da experiência de navegação em smartphones seja impecável, com alta performance, excelente contraste visual, navegação por toque fluida e foco máximo em conversão direta.

**Tipo de Projeto:** WEB (Mobile-First responsive)

---

## 🏆 Success Criteria

1. **Nenhum transbordo horizontal (overflow-x):** A rolagem lateral deve ser totalmente nula em qualquer largura de tela até 320px.
2. **Sticky CTA funcional:** Um botão flutuante de checkout no rodapé em dispositivos móveis que aparece após a seção Hero.
3. **Legibilidade premium:** Tamanhos de fonte equilibrados (evitando fontes pequenas demais ou títulos cortados no mobile).
4. **Layout de Vídeo otimizado:** O vídeo de vendas deve preencher o formato vertical de smartphones de maneira nativa e responsiva.
5. **Passagem no Checklist:** Aprovação de 100% nos testes do checklist do Antigravity Kit (sem erros críticos de design ou UX).

---

## 🛠️ Tech Stack

- **Linguagens:** HTML5, CSS3 nativo (Vanilla CSS), JavaScript (Vite)
- **Biblioteca de Carrossel:** Swiper.js (via CDN)
- **Integração:** Checkout Nexano / WhatsApp API

---

## 📂 File Structure

Não haverá novos arquivos, apenas otimização da estrutura atual:
```plaintext
Rotina com Deus/
├── index.html           # Landing page principal (vendas)
├── v2.html              # Landing page variante B (vendas)
├── obrigado.html        # Página de pós-conversão
└── src/
    ├── style.css        # Folha de estilos unificada
    └── main.js          # Comportamentos javascript e interações
```

---

## 📝 Task Breakdown

Abaixo está o detalhamento das tarefas por fase e prioridade.

### P0: Fundações & Estrutura Mobile-First

#### **Task 1: Ajuste de Variáveis de Tipografia e Viewport**
- **Agente Responsável:** `frontend-specialist`
- **Skill Associada:** `frontend-design`
- **Prioridade:** P0
- **Dependências:** Nenhuma
- **Descrição:** Ajustar e otimizar os clamps de fontes no `:root` do CSS para telas menores (abaixo de 480px), garantindo legibilidade perfeita e reduzindo as chances de quebra de layout em telas pequenas.
- **INPUT:** `src/style.css`
- **OUTPUT:** `src/style.css` com variáveis de tipografia mobile calibradas.
- **VERIFY:** Emular tela mobile no navegador e confirmar se o h1 e subtítulos não quebram linhas de forma inapropriada.

#### **Task 2: Eliminar Overflow Lateral (Scroll Horizontal)**
- **Agente Responsável:** `frontend-specialist`
- **Skill Associada:** `clean-code`
- **Prioridade:** P0
- **Dependências:** Task 1
- **Descrição:** Adicionar regras rígidas nas seções e containers (`overflow-x: hidden` e largura máxima de `100%`) para erradicar totalmente a barra de rolagem lateral em smartphones.
- **INPUT:** `src/style.css`, `index.html`, `v2.html`
- **OUTPUT:** Código livre de problemas de largura.
- **VERIFY:** Testar rolagem no console do emulador do navegador.

---

### P1: UI Otimizada & Sticky CTA

#### **Task 3: Implementar Botão Sticky CTA Flutuante**
- **Agente Responsável:** `frontend-specialist`
- **Skill Associada:** `frontend-design`
- **Prioridade:** P1
- **Dependências:** Task 2
- **Descrição:** Criar a estrutura HTML e estilização para o botão flutuante de checkout no rodapé da página móvel. O botão deve ser fixo na base e usar a classe `.btn-primary` com animação de pulso sutil.
- **INPUT:** `index.html`, `v2.html`, `src/style.css`
- **OUTPUT:** Elemento `#sticky-cta` implementado e estilizado.
- **VERIFY:** Confirmar que o botão flutua corretamente na base do viewport na simulação mobile.

#### **Task 4: Controlar Exibição do Sticky CTA com Rolagem**
- **Agente Responsável:** `frontend-specialist`
- **Skill Associada:** `react-best-practices` (ou Vite JavaScript nativo)
- **Prioridade:** P1
- **Dependências:** Task 3
- **Descrição:** Implementar no `src/main.js` a lógica para exibir o Sticky CTA apenas quando o usuário passar do botão da seção Hero. Deve ocultar de volta caso ele retorne ao topo da página.
- **INPUT:** `src/main.js`
- **OUTPUT:** Lógica de exibição condicional baseada na posição do scroll vertical.
- **VERIFY:** Rolar a página no emulador mobile e atestar o surgimento suave (fade-in) do botão flutuante.

#### **Task 5: Calibração de Vídeo e Imagens**
- **Agente Responsável:** `frontend-specialist`
- **Skill Associada:** `frontend-design`
- **Prioridade:** P1
- **Dependências:** Task 2
- **Descrição:** Ajustar o `.hero-video-wrapper` no mobile para que o vídeo de vendas não sofra cortes e ocupe o máximo possível do espaço visível, ajustando a proporção para 9:16 vertical de forma perfeita.
- **INPUT:** `src/style.css`, `index.html`, `v2.html`
- **OUTPUT:** CSS atualizado para o container de vídeo responsivo.
- **VERIFY:** Reproduzir o vídeo simulando mobile e atestar o enquadramento.

---

### P2: Página de Sucesso (Obrigado) & Polimento

#### **Task 6: Otimizar obrigado.html para Dispositivos Móveis**
- **Agente Responsável:** `frontend-specialist`
- **Skill Associada:** `frontend-design`
- **Prioridade:** P2
- **Dependências:** Task 2
- **Descrição:** Otimizar o estilo do cartão de sucesso e passos instrucionais da página de agradecimento, garantindo que o botão do WhatsApp ocupe 100% da largura útil do cartão móvel.
- **INPUT:** `obrigado.html`
- **OUTPUT:** Layout da página de obrigado ajustado para visualização em pé.
- **VERIFY:** Conferir contraste e alcance do CTA principal.

---

## 🏁 Phase X: Final Verification

> 🔴 **Regra de Validação Absoluta:** Nenhuma alteração é dada por concluída antes de executar os scripts de auditoria abaixo.

1. **Checklist Geral de Validação:**
   ```bash
   python .agent/scripts/checklist.py .
   ```
2. **Auditoria de Acessibilidade & UX:**
   ```bash
   python .agent/skills/frontend-design/scripts/ux_audit.py .
   ```
3. **Build da Aplicação:**
   ```bash
   npm run build
   ```
4. **Verificação de Regras Específicas:**
   - [ ] Confirmar que **NÃO** existem códigos hexadecimais de cor púrpura/violeta (Regra Purple Ban).
   - [ ] Confirmar que o layout não segue estruturas clichês ou templates óbvios.
   - [ ] Verificar a suavidade de animações e carrosséis Swiper no toque.
