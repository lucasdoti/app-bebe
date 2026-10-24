// Marcos do bebê: "primeiras vezes" (lembranças) e marcos do desenvolvimento.
// Desenvolvimento: os quatro marcos de cada faixa da Caderneta da Criança (Ministério da Saúde),
// com a escrita adaptada. Cada marco costuma aparecer até a faixa seguinte; se não aparecer, vale comentar na consulta.

export type TipoMarco = 'primeira' | 'desenvolvimento';
export type Area = 'social' | 'maos' | 'fala' | 'movimento';

export type Marco = {
  id: string;
  bebe_id: string;
  tipo: TipoMarco;
  codigo: string | null;
  titulo: string;
  data: string;
  detalhe: string | null;
};

export type SugestaoPrimeira = { codigo: string; titulo: string; pergunta?: string };

export const PRIMEIRAS: SugestaoPrimeira[] = [
  { codigo: 'pv-sorriso', titulo: 'Primeiro sorriso' },
  { codigo: 'pv-risada', titulo: 'Primeira risada' },
  { codigo: 'pv-rolou', titulo: 'Rolou pela primeira vez' },
  { codigo: 'pv-papinha', titulo: 'Primeira papinha', pergunta: 'O que comeu?' },
  { codigo: 'pv-sentou', titulo: 'Sentou sozinho' },
  { codigo: 'pv-engatinhou', titulo: 'Engatinhou' },
  { codigo: 'pv-mama', titulo: 'Primeiro "mamã"' },
  { codigo: 'pv-papa', titulo: 'Primeiro "papá"' },
  { codigo: 'pv-em-pe', titulo: 'Ficou em pé com apoio' },
  { codigo: 'pv-tchau', titulo: 'Primeiro tchau' },
  { codigo: 'pv-palavra', titulo: 'Primeira palavra', pergunta: 'Qual palavra?' },
  { codigo: 'pv-passos', titulo: 'Primeiros passos' },
  { codigo: 'pv-mar', titulo: 'Primeiro banho de mar ou piscina' },
  { codigo: 'pv-viagem', titulo: 'Primeira viagem', pergunta: 'Para onde?' },
  { codigo: 'pv-cabelo', titulo: 'Primeiro corte de cabelo' },
];

export const nomeArea: Record<Area, string> = { social: 'Social', maos: 'Mãos', fala: 'Fala', movimento: 'Movimento' };

export type MarcoDesenvolvimento = { codigo: string; area: Area; titulo: string; faixa: number };

// Faixas da Caderneta (em meses). Cada marco é esperado até a faixa seguinte.
export const FAIXAS = [1, 2, 4, 6, 9, 12, 15, 18, 24, 30, 36];

const LISTA: Record<number, [Area, string][]> = {
  1: [
    ['social', 'Olha para um rosto'],
    ['fala', 'Reage a sons (se assusta, para de chorar)'],
    ['movimento', 'De bruços, levanta a cabeça por um instante'],
    ['maos', 'Segura o dedo quando encosta na mão dele'],
  ],
  2: [
    ['social', 'Sorri quando conversam com ele'],
    ['maos', 'Abre as mãos'],
    ['fala', 'Faz sons além do choro'],
    ['movimento', 'Mexe ativamente braços e pernas'],
  ],
  4: [
    ['social', 'Responde quando brincam com ele (sorri, se agita)'],
    ['maos', 'Segura objetos'],
    ['fala', 'Balbucia ("aaa", "ggg")'],
    ['movimento', 'De bruços, levanta a cabeça apoiado nos antebraços'],
  ],
  6: [
    ['social', 'Estica o braço para pegar objetos'],
    ['maos', 'Leva objetos à boca'],
    ['fala', 'Vira para o lado de onde vem o som'],
    ['movimento', 'Rola (muda de posição sozinho)'],
  ],
  9: [
    ['social', 'Brinca de esconde-achou'],
    ['maos', 'Passa objetos de uma mão para a outra'],
    ['fala', 'Repete sílabas ("mamama", "papapa")'],
    ['movimento', 'Senta sem apoio'],
  ],
  12: [
    ['social', 'Imita gestos (tchau, bater palmas)'],
    ['maos', 'Pega coisas pequenas com a ponta dos dedos (pinça)'],
    ['fala', 'Fala "enrolado", imitando uma conversa'],
    ['movimento', 'Anda com apoio'],
  ],
  15: [
    ['social', 'Faz gestos quando pedem'],
    ['maos', 'Coloca objetos dentro de um pote'],
    ['fala', 'Fala pelo menos uma palavra'],
    ['movimento', 'Anda sem apoio'],
  ],
  18: [
    ['social', 'Mostra dois objetos quando pedem'],
    ['maos', 'Empilha 2 blocos'],
    ['fala', 'Fala pelo menos três palavras'],
    ['movimento', 'Anda para trás'],
  ],
  24: [
    ['social', 'Tira uma peça de roupa sozinho'],
    ['maos', 'Empilha 3 blocos'],
    ['fala', 'Aponta duas figuras quando pedem'],
    ['movimento', 'Chuta uma bola'],
  ],
  30: [
    ['social', 'Se veste com ajuda'],
    ['maos', 'Empilha 6 blocos'],
    ['fala', 'Junta duas palavras ("quer água")'],
    ['movimento', 'Pula com os dois pés'],
  ],
  36: [
    ['social', 'Brinca com outras crianças'],
    ['maos', 'Imita um risco em pé no papel'],
    ['fala', 'Entende duas ações ("quem dorme?", "quem come?")'],
    ['movimento', 'Arremessa uma bola'],
  ],
};

export const DESENVOLVIMENTO: MarcoDesenvolvimento[] = FAIXAS.flatMap((faixa) =>
  LISTA[faixa].map(([area, titulo]) => ({ codigo: `dv-${faixa}-${area}`, area, titulo, faixa })),
);

// Idade (em meses) até a qual o marco costuma aparecer: a faixa seguinte (aos 36, até 42).
export function esperadoAte(faixa: number) {
  const i = FAIXAS.indexOf(faixa);
  return FAIXAS[i + 1] ?? faixa + 6;
}

export function nomeFaixa(m: number) {
  if (m === 1) return '1 mês';
  if (m < 24) return `${m} meses`;
  const anos = Math.floor(m / 12);
  return m % 12 ? `${anos} anos e meio` : `${anos} anos`;
}

// Faixa atual: a maior faixa já alcançada pela idade (antes de 1 mês, a de 1 mês).
export function faixaAtual(meses: number) {
  return [...FAIXAS].reverse().find((f) => meses >= f) ?? FAIXAS[0];
}
