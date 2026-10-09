import { duracao, HORA, inicioDoDia } from './tempo';

export type Lado = 'E' | 'D';
export type Leite = 'materno' | 'formula';

export type DetalhesMamada = { lados: { lado: Lado; inicio: string; fim: string | null }[] };
export type DetalhesMamadeira = { ml: number; leite: Leite };
export type DetalhesRefeicao = {
  alimento: string;
  quantidade?: 'pouco' | 'metade' | 'tudo';
  aceitacao?: 'gostou' | 'normal' | 'recusou';
};
export type DetalhesFralda = { xixi: boolean; coco: boolean; cor?: string; consistencia?: string; penico?: boolean };

type Base = {
  id: string;
  bebe_id: string;
  autor_id: string;
  inicio: string;
  fim: string | null;
};

export type Registro =
  | (Base & { tipo: 'mamada'; detalhes: DetalhesMamada })
  | (Base & { tipo: 'mamadeira'; detalhes: DetalhesMamadeira })
  | (Base & { tipo: 'refeicao'; detalhes: DetalhesRefeicao })
  | (Base & { tipo: 'sono'; detalhes: Record<string, never> })
  | (Base & { tipo: 'fralda'; detalhes: DetalhesFralda })
  | (Base & { tipo: 'contracao'; detalhes: Record<string, never> })
  | (Base & { tipo: 'movimentos'; detalhes: { quantidade: number } })
  | (Base & { tipo: 'dose'; detalhes: { remedio_id: string; nome: string; dose: string } })
  | (Base & { tipo: 'febre'; detalhes: { temperatura: number } });

export const temperaturaTexto = (t: number) => `${t.toFixed(1).replace('.', ',')} °C`;

export type Tipo = Registro['tipo'];

export const nomeLado: Record<Lado, string> = { E: 'esquerdo', D: 'direito' };

const ms = (iso: string) => new Date(iso).getTime();

// "45 s" ou "1 min 10 s": contrações são medidas em segundos.
export function duracaoSegundos(msTotal: number) {
  const s = Math.max(0, Math.round(msTotal / 1000));
  if (s < 60) return `${s} s`;
  return s % 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s / 60} min`;
}

export function emAndamento(r: Registro) {
  return r.fim === null;
}

// Tempo de cada lado do peito numa mamada.
export function temposPorLado(d: DetalhesMamada, agora = Date.now()) {
  const total = { E: 0, D: 0 };
  for (const t of d.lados) total[t.lado] += (t.fim ? ms(t.fim) : agora) - ms(t.inicio);
  return total;
}

export function ladoAtual(d: DetalhesMamada): Lado | null {
  return d.lados.at(-1)?.lado ?? null;
}

// Peito sugerido: o oposto do último lado usado.
export function ladoSugerido(registros: Registro[]): Lado {
  const ultima = registros.find((r) => r.tipo === 'mamada');
  if (!ultima || ultima.tipo !== 'mamada') return 'E';
  return ladoAtual(ultima.detalhes) === 'E' ? 'D' : 'E';
}

// Texto curto do registro para a linha do tempo e os cartões.
export function descricao(r: Registro, agora = Date.now()): { titulo: string; detalhe: string } {
  switch (r.tipo) {
    case 'mamada': {
      const t = temposPorLado(r.detalhes, agora);
      const partes = (['E', 'D'] as Lado[])
        .filter((l) => t[l] > 0 || r.detalhes.lados.some((s) => s.lado === l))
        .map((l) => `${nomeLado[l]} ${duracao(t[l])}`);
      return { titulo: 'Mamada no peito', detalhe: partes.join(' · ') };
    }
    case 'mamadeira':
      return {
        titulo: 'Mamadeira',
        detalhe: `${r.detalhes.ml} ml · ${r.detalhes.leite === 'formula' ? 'fórmula' : 'leite materno'}`,
      };
    case 'refeicao': {
      const extra = [
        r.detalhes.quantidade && { pouco: 'comeu pouco', metade: 'comeu metade', tudo: 'comeu tudo' }[r.detalhes.quantidade],
        r.detalhes.aceitacao && { gostou: 'gostou', normal: 'aceitou', recusou: 'recusou' }[r.detalhes.aceitacao],
      ].filter(Boolean);
      return { titulo: 'Refeição', detalhe: [r.detalhes.alimento, ...extra].join(' · ') };
    }
    case 'sono':
      return {
        titulo: r.fim ? 'Sono' : 'Dormindo',
        detalhe: duracao((r.fim ? ms(r.fim) : agora) - ms(r.inicio)),
      };
    case 'contracao':
      return {
        titulo: r.fim ? 'Contração' : 'Contração agora',
        detalhe: duracaoSegundos((r.fim ? ms(r.fim) : agora) - ms(r.inicio)),
      };
    case 'dose':
      return { titulo: `Remédio: ${r.detalhes.nome}`, detalhe: r.detalhes.dose };
    case 'febre':
      return { titulo: 'Temperatura', detalhe: temperaturaTexto(r.detalhes.temperatura) };
    case 'movimentos':
      return {
        titulo: r.fim ? 'Movimentos do bebê' : 'Contando movimentos',
        detalhe: `${r.detalhes.quantidade} em ${duracao((r.fim ? ms(r.fim) : agora) - ms(r.inicio))}`,
      };
    case 'fralda': {
      const d = r.detalhes;
      const oque = d.xixi && d.coco ? 'Xixi e cocô' : d.coco ? 'Cocô' : 'Xixi';
      const extra = [d.cor, d.consistencia].filter(Boolean).join(', ');
      return {
        titulo: d.penico ? `${oque} no penico` : oque,
        detalhe: extra ? `cocô ${extra}` : '',
      };
    }
  }
}

const ehAlimentacao = (r: Registro) => r.tipo === 'mamada' || r.tipo === 'mamadeira' || r.tipo === 'refeicao';

// Números dos cartões da home. `registros` vem ordenado do mais recente para o mais antigo.
export function resumo(registros: Registro[], agora = Date.now()) {
  const desde24h = agora - 24 * HORA;
  const hoje = inicioDoDia(new Date(agora)).getTime();

  const ultimaAlimentacao = registros.find(ehAlimentacao) ?? null;
  const peitoAtivo = registros.find((r) => r.tipo === 'mamada' && emAndamento(r)) ?? null;

  const sonos = registros.filter((r) => r.tipo === 'sono');
  const dormindo = sonos.find(emAndamento) ?? null;
  const ultimoSono = sonos.find((r) => !emAndamento(r)) ?? null;
  let sono24h = 0;
  let cochilos = 0;
  for (const s of sonos) {
    const ini = ms(s.inicio);
    const fim = s.fim ? ms(s.fim) : agora;
    if (fim <= desde24h) continue;
    sono24h += fim - Math.max(ini, desde24h);
    if (ini >= desde24h) cochilos++;
  }

  const fraldasHoje = registros.filter((r) => r.tipo === 'fralda' && ms(r.inicio) >= hoje) as Extract<
    Registro,
    { tipo: 'fralda' }
  >[];

  return {
    ultimaAlimentacao,
    peitoAtivo: peitoAtivo as Extract<Registro, { tipo: 'mamada' }> | null,
    dormindo,
    // Janela de vigília: desde o fim do último sono.
    acordadoDesde: !dormindo && ultimoSono?.fim ? ultimoSono.fim : null,
    sono24h,
    cochilos,
    fraldasHoje: fraldasHoje.length,
    xixiHoje: fraldasHoje.filter((r) => r.detalhes.xixi).length,
    cocoHoje: fraldasHoje.filter((r) => r.detalhes.coco).length,
    ultimaFralda: registros.find((r) => r.tipo === 'fralda') ?? null,
  };
}
