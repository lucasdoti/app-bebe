// Regra da sugestão de roupa (PRD: "Sugestão de roupa inteligente").
// Faixas iniciais, a validar com o pediatra. Nada aqui é recomendação médica.

export type Contexto = 'casa' | 'passeio' | 'sono';
export type Transporte = 'carrinho' | 'sling' | 'carro';
export type ContextoAjuste = 'passeio' | 'sono';

export type Peca =
  | 'body_curto'
  | 'body_longo'
  | 'macacao'
  | 'casaco'
  | 'casaco_grosso'
  | 'meia'
  | 'gorro'
  | 'manta'
  | 'pijama'
  | 'saco';

export const nomePeca: Record<Peca, string> = {
  body_curto: 'Body manga curta',
  body_longo: 'Body manga longa',
  macacao: 'Macacão',
  casaco: 'Casaco',
  casaco_grosso: 'Casaco grosso',
  meia: 'Meia',
  gorro: 'Gorro',
  manta: 'Manta',
  pijama: 'Pijama',
  saco: 'Saco de dormir',
};

// Acordado (em casa ou passeio): camadas pela sensação térmica.
const FAIXAS_DIA: { min: number; camadas: string; pecas: Peca[] }[] = [
  { min: 27, camadas: '1 camada leve', pecas: ['body_curto'] },
  { min: 22, camadas: '1 camada', pecas: ['body_longo'] },
  { min: 18, camadas: '2 camadas', pecas: ['body_longo', 'macacao'] },
  { min: 13, camadas: '3 camadas', pecas: ['body_longo', 'macacao', 'casaco', 'meia'] },
  { min: -Infinity, camadas: '4 camadas', pecas: ['body_longo', 'macacao', 'casaco_grosso', 'gorro', 'manta'] },
];

// Dormindo: saco de dormir pelo TOG, a partir da temperatura do quarto.
const FAIXAS_SONO: { min: number; tog: string; pecas: Peca[] }[] = [
  { min: 27, tog: 'sem saco ou saco 0,2 TOG', pecas: ['body_curto'] },
  { min: 24, tog: 'saco 0,5 TOG', pecas: ['body_curto', 'saco'] },
  { min: 21, tog: 'saco 1,0 TOG', pecas: ['body_longo', 'saco'] },
  { min: 18, tog: 'saco 2,5 TOG', pecas: ['body_longo', 'saco'] },
  { min: 16, tog: 'saco 2,5 TOG', pecas: ['body_longo', 'pijama', 'saco'] },
  { min: -Infinity, tog: 'saco 3,5 TOG', pecas: ['body_longo', 'pijama', 'saco'] },
];

export type Previsao = {
  /** Quanto a sensação térmica cai nas próximas 6 h (positivo = esfria). */
  queda: number;
  horaMinima: string | null;
  chuva: boolean;
  ventoForte: boolean;
};

export type Entrada = {
  nome: string;
  contexto: Contexto;
  transporte: Transporte;
  /** Sensação térmica lá fora, em °C. */
  sensacao: number;
  /** Temperatura do quarto informada pelos pais (só para o sono). */
  tempQuarto: number | null;
  idadeDias: number;
  /** Ajuste pessoal do bebê, de -1,5 a +1,5 camadas. */
  ajuste: number;
  previsao: Previsao | null;
};

export type Sugestao = {
  pecas: Peca[];
  titulo: string;
  motivos: string[];
  avisos: string[];
};

const limitar = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
const graus = (t: number) => `${Math.round(t)} °C`;

export function contextoDoAjuste(c: Contexto): ContextoAjuste {
  return c === 'sono' ? 'sono' : 'passeio';
}

// Ajuste de ±0,5 ou mais muda de faixa: cada 0,5 vale uma camada.
export function deslocamento(ajuste: number) {
  return Math.trunc(Math.round(ajuste * 100) / 50);
}

function explicarAjuste(nome: string, desloc: number, contexto: Contexto) {
  const quando = contexto === 'sono' ? ' dormindo' : '';
  const sente = desloc > 0 ? 'frio' : 'calor';
  const n = Math.abs(desloc);
  if (contexto === 'sono')
    return `${nome} costuma sentir ${sente}${quando}: sugeri ${n === 1 ? 'uma faixa' : `${n} faixas`} mais ${desloc > 0 ? 'quente' : 'fresca'}.`;
  return `${nome} costuma sentir ${sente}${quando}: sugeri ${n} ${n === 1 ? 'camada' : 'camadas'} a ${desloc > 0 ? 'mais' : 'menos'}.`;
}

export function sugerir(e: Entrada): Sugestao | null {
  const motivos: string[] = [];
  const avisos: string[] = [];
  const desloc = deslocamento(e.ajuste);

  if (e.contexto === 'sono') {
    if (e.tempQuarto === null) return null;
    let i = FAIXAS_SONO.findIndex((f) => e.tempQuarto! >= f.min);
    motivos.push(`Quarto a ${graus(e.tempQuarto)}.`);
    if (desloc) {
      i = limitar(i + desloc, 0, FAIXAS_SONO.length - 1);
      motivos.push(explicarAjuste(e.nome, desloc, e.contexto));
    }
    avisos.push('Berço livre: sem gorro, manta solta, travesseiro ou bichos de pelúcia.');
    const f = FAIXAS_SONO[i];
    return { pecas: f.pecas, titulo: f.tog[0].toUpperCase() + f.tog.slice(1), motivos, avisos };
  }

  let i = FAIXAS_DIA.findIndex((f) => e.sensacao >= f.min);
  motivos.push(`Sensação térmica de ${graus(e.sensacao)}: ${FAIXAS_DIA[i].camadas}.`);
  let ajusteTotal = 0;

  if (e.idadeDias < 28) {
    ajusteTotal++;
    motivos.push('Recém-nascido regula pior a temperatura: uma camada a mais.');
  }
  if (e.contexto === 'passeio' && e.transporte === 'sling') {
    ajusteTotal--;
    motivos.push('No sling ou no colo, o corpo de quem carrega aquece: uma camada a menos.');
  }
  if (desloc) {
    ajusteTotal += desloc;
    motivos.push(explicarAjuste(e.nome, desloc, e.contexto));
  }
  i = limitar(i + ajusteTotal, 0, FAIXAS_DIA.length - 1);

  if (e.contexto === 'passeio' && e.previsao) {
    const p = e.previsao;
    if (p.queda >= 5)
      avisos.push(`Esfria ${Math.round(p.queda)} °C${p.horaMinima ? ` até as ${p.horaMinima}` : ''}: leve um casaco extra.`);
    if (p.chuva)
      avisos.push(
        e.transporte === 'carrinho' ? 'Chance de chuva: leve a capa do carrinho.' : 'Chance de chuva: leve uma capa ou guarda-chuva.',
      );
    if (p.ventoForte) avisos.push('Vento forte: prefira um casaco corta-vento.');
  }
  if (e.contexto === 'passeio' && e.transporte === 'carro' && FAIXAS_DIA[i].pecas.includes('casaco_grosso'))
    avisos.push('Na cadeirinha, tire o casaco grosso e cubra com a manta por cima do cinto.');

  return { pecas: FAIXAS_DIA[i].pecas, titulo: FAIXAS_DIA[i].pecas.map((p) => nomePeca[p]).join(' + '), motivos, avisos };
}
