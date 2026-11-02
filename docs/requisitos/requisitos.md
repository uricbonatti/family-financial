# Family Financial — Requisitos e Diagramas

Aplicação desktop (Electron) para planejamento financeiro familiar: registrar renda e despesas (atuais e futuras), ver gráficos e gerar um plano de redução de despesas.

## 1. Escopo

**Dentro:** renda (salário), despesas pontuais / recorrentes / parceladas, despesas futuras planejadas, projeção mensal, gráficos, plano de redução de despesas com acompanhamento.
**Fora (v1):** integração bancária, nuvem/multiusuário em rede, app mobile, investimentos, impostos.

## 2. Perfis

| Perfil | Descrição |
|---|---|
| Família (usuário único) | Quem opera o app no computador. Sem login na v1; os dados são locais. |
| Membro | Pessoa da família a quem uma renda ou despesa é atribuída (opcional). |

## 3. Requisitos funcionais

### Renda
- **RF01** Cadastrar renda (descrição, valor líquido, membro, dia de recebimento, vigência início/fim opcional).
- **RF02** Editar valor da renda mantendo histórico (aumento de salário vale a partir de uma data).
- **RF03** Permitir mais de uma renda (ex.: dois salários, renda extra).

### Renda pontual e sazonal
- **RF25** Cadastrar entrada **pontual** (valor, data de recebimento, membro, tipo, situação prevista/recebida) para 13º salário, 1/3 de férias, bicos e freelances.
- **RF26** Oferecer **modelos rápidos** (13º – 1ª parcela, 13º – 2ª parcela, 1/3 de férias, bico, freelance, outro) que preenchem descrição e valor sugerido a partir do salário vigente do membro.
- **RF27** Permitir repetição **anual** da entrada (13º e férias), gerando as ocorrências futuras por projeção.
- **RF28** Marcar a entrada como recebida e ajustar o valor real; entradas previstas entram no saldo projetado, as recebidas no saldo realizado.
- **RF29** Editar e excluir rendas fixas e pontuais; encerrar uma renda fixa sem apagar o histórico.

### Fundos Bahá’ís e calendário Badí’
- **RF30** Planejar a contribuição aos Fundos Bahá’ís por Festa dos 19 Dias: valor fixo, % da renda fixa ou **por faixa de renda fixa mensal** (cada faixa define o valor por Festa; a última não tem limite), início, fim opcional e lembrete antes da Festa. Nos modos % e faixa, se a renda mudar o app avisa e oferece atualizar o valor (RN15).
- **RF31** No formulário de despesa recorrente, oferecer a periodicidade **“a cada 19 dias (calendário Badí’)”** para despesas recorrentes; as ocorrências caem nas datas das Festas, não em dias fixos do mês.
- **RF32** Manter uma **tabela do calendário Badí’ por ano** (Naw-Rúz, Ayyám-i-Há, Jejum e as 19 Festas), pré-carregada e editável; os dias de Ayyám-i-Há são calculados pela RN11 a partir de dois Naw-Rúz consecutivos. Vir pré-carregada com a tabela oficial da Casa Universal de Justiça para **172 a 221 B.E. (2015 a 2065)**, conferida contra a fórmula da RN11 (sem divergências); avisar quando o último ano da tabela estiver perto de acabar.
- **RF33** Distribuir cada contribuição por fundo (Local, Nacional, Continental, Internacional e outros) com soma de 100%.
- **RF34** Mostrar a próxima Festa, a lista das próximas Festas, a provisão mensal sugerida (total anual ÷ 12) e o total dos próximos 12 meses.
- **RF35** Opcionalmente contribuir um percentual extra sobre entradas pontuais (13º, férias, bicos) e reservar um valor para o Ayyám-i-Há.
- **RF36** Modo privado para ocultar os valores dos Fundos na tela.

### Saldo projetado
- **RF37** Calcular o saldo projetado de 12 meses: renda fixa + entradas pontuais previstas − despesas (recorrentes, parcelas, planejadas e Fundos), mês a mês e acumulado.
- **RF38** Qualquer entrada ou despesa nova, inclusive extraordinária (ex.: prêmio de loteria), recalcula o saldo projetado a partir do mês em que ocorre.

### Despesas
- **RF04** Cadastrar despesa **pontual** (valor, data, categoria).
- **RF05** Cadastrar despesa **recorrente** (valor, periodicidade mensal/anual, dia, início, fim opcional).
- **RF06** Cadastrar despesa **parcelada** (valor total ou da parcela, nº de parcelas, 1ª data); o sistema gera as parcelas e indica quantas faltam.
- **RF07** Cadastrar despesa **futura/planejada** (qualquer um dos tipos acima com início no futuro); pode ser marcada como "confirmada" ao ocorrer.
- **RF08** Classificar cada despesa por categoria e por natureza: **essencial**, **flexível** ou **protegida**; e poder marcar a despesa como **valor irredutível** (RN14).
- **RF09** Editar, excluir e encerrar despesas (encerrar recorrente/parcelada sem apagar o passado).
- **RF10** Marcar uma ocorrência como paga e ajustar o valor real do mês.
- **RF11** Gerenciar categorias (criar, renomear, cor, essencial por padrão).

### Visão e gráficos
- **RF12** Painel mensal: renda, total de despesas, saldo, % comprometido da renda.
- **RF13** Gráfico de despesas por categoria (mês escolhido).
- **RF14** Gráfico de evolução mensal (renda × despesas × saldo), passado e projeção futura.
- **RF15** Gráfico de compromissos futuros (parcelas e recorrências por mês) mostrando quando as parcelas terminam.
- **RF16** Filtros por período (mês inicial e final), categoria, membro e tipo; com período definido, a lista mostra o total das ocorrências no intervalo (inclui planejadas).

### Plano de redução
- **RF17** Definir meta: reduzir X% ou R$ Y por mês, ou alcançar saldo-alvo, com prazo.
- **RF18** Gerar plano sugerindo cortes por categoria sobre o gasto médio dos próximos 12 meses, **incluindo compras pontuais e planejadas** (exceto as marcadas como valor irredutível), priorizando despesas flexíveis e de maior peso e respeitando o limite de corte por categoria (essenciais limitadas; protegidas nunca).
- **RF19** Ajustar o plano manualmente (alterar valor-alvo por categoria, excluir sugestões) e ver o efeito imediato no saldo projetado.
- **RF20** Mostrar a economia projetada mês a mês, incluindo o alívio de parcelas que terminam.
- **RF21** Acompanhar o plano: meta × realizado por categoria e mês, com indicador de desvio.
- **RF22** Alertar quando a categoria passa do alvo ou quando o saldo projetado fica negativo.

### Dados
- **RF23** Exportar/importar dados (JSON) e exportar relatório (CSV/PDF).
- **RF24** Backup local automático.

## 4. Requisitos não funcionais

- **RNF01** Funciona offline; dados só no computador do usuário (SQLite local).
- **RNF02** Windows como alvo principal, com instalador próprio (sem exigir administrador, dados preservados ao desinstalar); empacotamento que permita Linux/macOS depois.
- **RNF03** Abertura em menos de 3 s; painel com 5 anos de dados em menos de 1 s.
- **RNF04** Valores monetários em centavos inteiros (sem float); moeda BRL.
- **RNF05** Interface em português (pt-BR), tema claro/escuro, teclado acessível.
- **RNF06** Migrações de banco versionadas; backup antes de migrar.

## 5. Regras de negócio

- **RN01** Saldo do mês = renda fixa vigente + entradas pontuais do mês − despesas do mês (ocorrências previstas ou reais).
- **RN02** Ocorrências de recorrentes e parcelas são **geradas por projeção**, não gravadas uma a uma; só valores reais ajustados são persistidos.
- **RN03** Parcela `n/N` termina na última data; a partir daí deixa de compor o comprometimento.
- **RN04** Corte máximo por natureza, configurável por categoria: essencial 10%, flexível 50%, protegida 0%.
- **RN05** O plano nunca sugere cortar categorias protegidas: parcelas já contratadas (a quitação antecipada pode aparecer só como informação) e Fundos Bahá’ís (RN10).
- **RN06** Mudança de renda ou de valor vale a partir da data de vigência e não altera meses passados.
- **RN07** Priorização do plano: `peso = gasto_reduzível × fator` (flexível 1,0 / essencial 0,2; protegida excluída); corta do maior peso até o limite da RN04 e passa à próxima categoria, até atingir a meta.
- **RN08** Entrada pontual compõe a renda **somente do mês da data de recebimento**; não altera a renda fixa mensal nem o % comprometido da renda fixa.
- **RN09** Sugestões de valor: 13º parcela = 50% do salário vigente; 1/3 de férias = salário vigente ÷ 3. O usuário sempre pode alterar.
- **RN10** A contribuição aos Fundos é voluntária e confidencial: fica como categoria **protegida** e o plano de redução nunca a sugere para corte (o usuário pode editar).
- **RN11** O ano badí começa no Naw-Rúz (definido pela Casa Universal de Justiça: equinócio de março calculado para Teerã; se ocorre antes do pôr do sol, o Naw-Rúz é aquele dia, senão o seguinte). Os 18 meses de 19 dias somam 342 dias; depois vêm os dias de **Ayyám-i-Há** e o mês de Alá (19 dias, Jejum). **Dias de Ayyám-i-Há = (distância entre dois Naw-Rúz consecutivos) − 361**: 365 dias → 4 dias; 366 dias → 5 dias. Não segue o bissexto gregoriano: depende de o Naw-Rúz avançar ou não um dia. Cada Festa começa ao pôr do sol da véspera; o app usa a data do dia listado.
- **RN12** Saldo projetado = Σ (renda fixa + pontuais previstas − despesas) dos próximos 12 meses. O plano de redução soma a economia mensal × 12.
- **RN13** O membro é opcional em rendas e despesas; sem membro, o lançamento é da **Família (compartilhada)**. Serve para filtros e agrupamentos (RF16) e para sugerir valores de renda pontual (RN09).
- **RN14** O plano considera o gasto médio mensal da categoria nos próximos 12 meses, **incluindo compras pontuais e planejadas**. A despesa marcada como **valor irredutível** fica fora da base de corte. O corte é guardado em **% do gasto reduzível** da categoria e aplicado mês a mês: uma compra planejada (ex.: viagem) também diminui pelo mesmo percentual; a economia mensal média × 12 é o ganho no saldo projetado (RN12).
- **RN16** VR/VA (renda fixa marcada “só mercado”) abate apenas despesas marcadas como mercado: entra no saldo até o valor gasto em mercado no mês; a sobra não vira dinheiro livre nem acumula.
- **RN17** Despesa paga no **cartão** pesa no mês do vencimento da fatura, conforme a janela configurada (dia de fechamento e de vencimento): compra até o dia do fechamento entra na fatura corrente; depois, na seguinte. Sem janela configurada, vale a data da compra. Boleto e à vista contam na própria data. A lista “Lançamentos do mês” continua pela data da compra.
- **RN18** Renda fixa pode ser recebida em **parcelas** (cada uma com % do valor do mês, somando 100%): dia fixo do mês (31 cai no último dia do mês curto) ou n-ésimo dia útil (seg–sex, sem feriados). Com a opção “o mês começa no 1º recebimento” ligada (padrão: desligada), o período de cada mês vai do 1º recebimento (VR/VA não conta) até a véspera do 1º recebimento do mês seguinte; despesas, rendas pontuais e vencimentos de fatura entram no período que contêm a data. Desligada, vale o mês do calendário.
- **RF40** Painel mostra o gasto do cartão no mês (fatura que vence no período) e o total restante do cartão (parcelas e compras futuras; recorrentes sem data final ficam de fora e são avisados).
- **RF39** Plano de redução gerado pelo Claude (Claude Code instalado no PC, com o login do usuário; sem chave de API): analisa cada despesa (tipo, natureza, mercado, irredutível, forma de pagamento) e sugere corte e motivo por despesa; o resultado preenche o editor do plano, e nada é salvo sem o usuário confirmar. Os dados só são enviados ao clicar em “Gerar com IA”; irredutíveis e protegidas nunca são cortadas.
- **RN15** Modo por faixa: vale o valor da primeira faixa cuja renda fixa mensal é menor ou igual ao limite (limite inclusivo); faixas com limites crescentes, valores positivos e a última sem limite. O valor planejado só muda quando o usuário confirma (a renda pode mudar sem alterar lançamentos já combinados).

## Diagramas

Veja [../diagramas/](../diagramas/README.md).

## 6. Mapa de telas (base para o protótipo)

1. **Painel** — cards (renda, despesas, saldo, % comprometido), gráfico por categoria, evolução mensal.
2. **Renda** — rendas fixas e entradas pontuais/sazonais, com telas de **nova renda** e **editar renda**.
3. **Despesas** — tabela com filtros; formulário único com tipo (pontual/recorrente/parcelada), periodicidade (mensal, anual ou a cada 19 dias Badí’), natureza (essencial, flexível ou protegida) e opção "planejada".
4. **Futuro** — linha do tempo de compromissos e quando terminam as parcelas.
5. **Plano de redução** — meta, sugestões por categoria editáveis, saldo projetado antes × depois.
6. **Acompanhamento** — meta × realizado.
7. **Fundos Bahá’ís** — próxima Festa, Festas dos 19 dias, distribuição e calendário vigente; tela **Planejar contribuição**.
8. **Configurações** — categorias, limites de corte, backup/exportação.

## 7. Decisões (aprovadas para a implementação)

| # | Decisão | Alternativa |
|---|---|---|
| 1 | Usuário único, sem login, dados locais | Perfis por membro com PIN |
| 2 | Stack: Electron + React + TypeScript + SQLite pelo módulo nativo `node:sqlite` (Node 24 do Electron 45; sem compilar `better-sqlite3`) | Outra UI/DB |
| 3 | Salário informado como valor líquido | Bruto + descontos |
| 4 | Gráficos com Recharts | Chart.js / ECharts |
| 5 | Plano de redução por regra determinística (RN07), sem IA | Sugestões por IA |
| 6 | Moeda única, BRL | Multi-moeda |
| 7 | Membro opcional; padrão “Família (compartilhada)” | Membro obrigatório ou sem membro na despesa |

## 8. Estado da implementação (`code/`)

**Pronto:** renda fixa (com reajuste e histórico) e pontual/anual com modelos 13º/férias/bico/freelance e prévia de impacto; despesas pontual, recorrente (mensal, anual, a cada 19 dias Badí’) e parcelada, com valor irredutível, lançamentos do mês e valor real; saldo projetado de 12 meses (RF37/RF38); plano de redução (RN07, RN14) com ajuste manual e acompanhamento; Fundos Bahá’ís com calendário Badí’ oficial (172 a 221 B.E.), distribuição, extra sobre pontuais e modo privado; categorias e membros; banco SQLite relacional (chaves estrangeiras, restrições e migrações), backup diário, exportar/importar JSON; tema claro/escuro. Contribuição por faixa de renda e filtro por período em Despesas (com total do intervalo). Instalador do Windows (NSIS, por usuário, em português, instância única): `npm run dist`.

**Pendente (futuro):** exportar relatórios em CSV/PDF (RF23); lembrete antes da Festa (RF30); reserva para o Ayyám-i-Há (RF35); o prazo do plano de redução é só informativo (RF17).
