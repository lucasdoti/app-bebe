// Os 20 dentes de leite. Posição 1 = incisivo central (no meio) até 5 = segundo molar (no fundo).
// Lado é o do bebê: olhando de frente para ele, o lado direito do bebê fica à sua esquerda.
// Idades típicas de nascimento (em meses), pela tabela da American Dental Association; variar alguns meses é normal.

export type Arcada = 'sup' | 'inf';
export type LadoDente = 'dir' | 'esq';

export type Dente = {
  codigo: string;
  arcada: Arcada;
  lado: LadoDente;
  posicao: 1 | 2 | 3 | 4 | 5;
  tipo: string;
  meses: [number, number];
};

export type DenteNascido = {
  id: string;
  bebe_id: string;
  codigo: string;
  nasceu_em: string;
  observacao: string | null;
};

const TIPOS = ['Incisivo central', 'Incisivo lateral', 'Canino', 'Primeiro molar', 'Segundo molar'];

const IDADES: Record<Arcada, [number, number][]> = {
  sup: [
    [8, 12],
    [9, 13],
    [16, 22],
    [13, 19],
    [25, 33],
  ],
  inf: [
    [6, 10],
    [10, 16],
    [17, 23],
    [14, 18],
    [23, 31],
  ],
};

export const DENTES: Dente[] = (['sup', 'inf'] as Arcada[]).flatMap((arcada) =>
  (['dir', 'esq'] as LadoDente[]).flatMap((lado) =>
    ([1, 2, 3, 4, 5] as const).map((posicao) => ({
      codigo: `${arcada}-${lado}-${posicao}`,
      arcada,
      lado,
      posicao,
      tipo: TIPOS[posicao - 1],
      meses: IDADES[arcada][posicao - 1],
    })),
  ),
);

export const denteDoCodigo = (codigo: string) => DENTES.find((d) => d.codigo === codigo);

// "Incisivo central de baixo, lado esquerdo"
export function nomeDente(d: Dente) {
  return `${d.tipo} de ${d.arcada === 'sup' ? 'cima' : 'baixo'}, lado ${d.lado === 'dir' ? 'direito' : 'esquerdo'}`;
}

export const faixaTexto = (d: Dente) => `costuma nascer entre ${d.meses[0]} e ${d.meses[1]} meses`;

// Próximos a nascer: os que ainda faltam, na ordem em que costumam aparecer (os pares saem juntos).
export function proximos(nascidos: Set<string>) {
  return DENTES.filter((d) => !nascidos.has(d.codigo)).sort(
    (a, b) => a.meses[0] - b.meses[0] || a.meses[1] - b.meses[1] || a.codigo.localeCompare(b.codigo),
  );
}
