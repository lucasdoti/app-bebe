// Gera src/data/oms.ts com os parâmetros LMS dos Padrões de Crescimento Infantil da OMS (2006),
// de 0 a 3 anos, amostrados a cada 7 dias. Fonte: tabelas por dia publicadas pela OMS no
// repositório oficial github.com/WorldHealthOrganization/anthro (data-raw/growthstandards).
// Uso: node scripts/gerar-oms.mjs
import { writeFileSync } from 'node:fs';

const BASE = 'https://raw.githubusercontent.com/WorldHealthOrganization/anthro/master/data-raw/growthstandards';
const ARQUIVOS = { peso: 'weianthro.txt', altura: 'lenanthro.txt', cabeca: 'hcanthro.txt' };
const PASSO = 7;
const ULTIMO_DIA = 1106; // pouco mais de 36 meses, múltiplo de 7

const saida = {};
for (const [indicador, arquivo] of Object.entries(ARQUIVOS)) {
  const texto = await (await fetch(`${BASE}/${arquivo}`)).text();
  const linhas = texto.trim().split('\n').slice(1).map((l) => l.trim().split('\t'));
  saida[indicador] = {};
  for (const [codigo, sexo] of [['1', 'M'], ['2', 'F']]) {
    const porDia = new Map(linhas.filter((l) => l[0] === codigo).map((l) => [Number(l[1]), l.slice(2, 5).map(Number)]));
    const L = [], M = [], S = [];
    for (let dia = 0; dia <= ULTIMO_DIA; dia += PASSO) {
      const [l, m, s] = porDia.get(dia);
      L.push(l); M.push(m); S.push(s);
    }
    saida[indicador][sexo] = { L, M, S };
  }
}

writeFileSync(
  'src/data/oms.ts',
  `// Gerado por scripts/gerar-oms.mjs — não editar à mão.
// Padrões de Crescimento Infantil da OMS (2006): parâmetros LMS por sexo, a cada ${PASSO} dias, de 0 a ${ULTIMO_DIA} dias.
// Altura: comprimento deitado até 2 anos e altura em pé depois, como nas tabelas da OMS.
export const PASSO_DIAS = ${PASSO};
export type Indicador = 'peso' | 'altura' | 'cabeca';
export const OMS: Record<Indicador, Record<'M' | 'F', { L: number[]; M: number[]; S: number[] }>> = ${JSON.stringify(saida)};
`,
);
console.log('src/data/oms.ts gerado');
