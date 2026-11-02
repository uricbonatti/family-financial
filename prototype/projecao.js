// Motor de projeção do protótipo: gera os números de todas as telas (centavos inteiros, RN/RF em docs/requisitos).
// Rodar: node prototype/projecao.js  -> imprime a tabela e valida com assert.
const assert = require("assert");

// Tabela oficial da Casa Universal de Justiça (172 a 221 B.E.): Naw-Rúz, início e dias de Ayyám-i-Há por ano.
const TABELA = require("./calendario-badi-uhj.json").anos;
const NAW_RUZ = Object.fromEntries(Object.entries(TABELA).map(([a, v]) => [a, v.nawRuz]));
const MESES_BADI = ["Bahá", "Jalál", "Jamál", "Azamat", "Núr", "Rahmat", "Kalimát", "Kamál", "Asmá", "Izzat", "Mashíyyat", "Ilm", "Qudrat", "Qawl", "Masá'il", "Sharaf", "Sultán", "Mulk", "Alá"];
const dias = (a, b) => Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 864e5);
// Ayyám-i-Há = distância entre dois Naw-Rúz − 361 (19×19): 365 dias → 4, 366 dias → 5. Não depende do ano gregoriano bissexto.
const ayyamDias = ano => dias(NAW_RUZ[ano], NAW_RUZ[ano + 1]) - 361;

const add = (iso, d) => { const t = new Date(iso + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + d); return t.toISOString().slice(0, 10); };

// 19 Festas do ano badí': mês m começa em naw + 19*(m-1); o mês 19 (Alá) vem depois dos dias Ayyám-i-Há
function festas(anoBadi) {
  const naw = NAW_RUZ[anoBadi];
  return MESES_BADI.map((nome, i) => ({ ano: anoBadi, n: i + 1, nome, data: add(naw, i * 19 + (i === 18 ? ayyamDias(anoBadi) : 0)) }));
}
const FESTAS = [...festas(183), ...festas(184)];

const MESES = ["2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04", "2027-05", "2027-06", "2027-07", "2027-08", "2027-09", "2027-10"];
const ROT = ["Nov", "Dez", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out"];

const RENDA_FIXA = 980000;
const PONTUAIS = { "2026-11": 490000, "2026-12": 490000, "2027-01": 206667, "2027-03": 120000 }; // 13º x2, 1/3 férias Maria (jan) e João (mar)
const RECORRENTES = 507000; // aluguel 2400 + mercado 1500 + transporte 650 + lazer 520
const PARCELAS = [ // valor, 1ª e última competência
  [39000, "2026-11", "2027-05"], [52000, "2026-11", "2026-12"], [73000, "2026-11", "2027-06"], [34000, "2026-11", "2026-12"]];
const PLANEJADAS = { "2027-01": 450000 }; // viagem de férias
const VALOR_FESTA = 20000;

const cmp = (m, a, b) => m >= a && m <= b;
function projetar({ valorFesta = VALOR_FESTA, corteMensal = 0 } = {}) {
  let acum = 0;
  const linhas = MESES.map((m, i) => {
    const nFestas = FESTAS.filter(f => f.data.startsWith(m)).length;
    const fundos = nFestas * valorFesta;
    const parcelas = PARCELAS.reduce((s, [v, a, b]) => s + (cmp(m, a, b) ? v : 0), 0);
    const planejadas = PLANEJADAS[m] || 0;
    const renda = RENDA_FIXA, pont = PONTUAIS[m] || 0;
    const despesas = RECORRENTES - corteMensal + parcelas + fundos + planejadas;
    const saldo = renda + pont - despesas;
    acum += saldo;
    return { mes: ROT[i], m, nFestas, renda, pont, recorrentes: RECORRENTES - corteMensal, parcelas, fundos, planejadas, despesas, saldo, acum };
  });
  return { linhas, total: acum, nFestas: linhas.reduce((s, l) => s + l.nFestas, 0) };
}

const base = projetar(), plano = projetar({ corteMensal: 48000 });
module.exports = { ayyamDias, FESTAS, MESES_BADI, NAW_RUZ, base, plano, projetar, VALOR_FESTA };

if (require.main === module) {
  const R = c => (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  console.log("Festas:", FESTAS.filter(f => f.data >= "2026-09-01" && f.data <= "2027-10-31").map(f => f.data + " " + f.nome).join(" | "));
  base.linhas.forEach(l => console.log(l.mes.padEnd(4), String(l.nFestas), R(l.renda + l.pont).padStart(10), R(l.despesas).padStart(10), R(l.saldo).padStart(10), R(l.acum).padStart(11)));
  console.log("Total 12 meses:", R(base.total), "· com plano:", R(plano.total), "· Festas:", base.nFestas);
  // Checks
  assert.equal(FESTAS.find(f => f.nome === "Qudrat" && f.ano === 183).data, "2026-11-04");
  assert.equal(FESTAS.find(f => f.nome === "Alá" && f.ano === 183).data, "2027-03-02");
  assert.equal(FESTAS.find(f => f.nome === "Bahá" && f.ano === 184).data, NAW_RUZ[184]);
  // A fórmula (intervalo entre Naw-Rúz − 361) reproduz os dias de Ayyám-i-Há da tabela oficial nos 49 anos com ano seguinte.
  for (const [a, v] of Object.entries(TABELA)) if (TABELA[+a + 1]) assert.equal(ayyamDias(+a), v.ayyamDias, "Ayyám-i-Há " + a);
  assert.equal(ayyamDias(182), 5); // 5 dias: Naw-Rúz 20/03/2025 -> 21/03/2026 (366 dias)
  assert.equal(base.nFestas, 19);
  assert.equal(base.total, 12 * RENDA_FIXA + 1306667 - (12 * RECORRENTES + 1029000 + 450000 + 19 * VALOR_FESTA));
  assert.equal(plano.total - base.total, 12 * 48000);
  console.log("ok");
}
