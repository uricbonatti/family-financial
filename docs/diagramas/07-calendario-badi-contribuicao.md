# Contribuição aos Fundos e calendário Badí’

```mermaid
flowchart TD
  A([Planejar contribuição]) --> B[Valor por Festa, início, distribuição por fundo]
  B --> C{Tabela do calendário Badí’ tem o ano?}
  C -- não --> D[Avisar e pedir datas do ano<br/>Naw-Rúz, Ayyám-i-Há]
  D --> C
  C -- sim --> E[Gerar as 19 Festas do ano:<br/>mês n começa em Naw-Rúz + 19×(n−1);<br/>Ayyám-i-Há = intervalo entre Naw-Rúz − 361<br/>(4 ou 5 dias); Alá vem depois]
  E --> F[Criar despesa recorrente a cada 19 dias<br/>categoria Fundos, protegida RN10]
  F --> G[Projeção: uma ocorrência por Festa<br/>2 Festas em alguns meses gregorianos]
  G --> H[Saldo projetado 12 meses RN12]
  G --> I[Lembrete antes da Festa]
  I --> J[Marcar como paga e ajustar o valor real]
```
