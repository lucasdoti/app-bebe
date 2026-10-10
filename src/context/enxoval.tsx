import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { FormaPagamento } from '@/lib/dinheiro';
import { lerPref, salvarPref } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { useBebes } from './bebes';
import { useSessao } from './sessao';

export type Categoria = 'roupa' | 'higiene' | 'quarto' | 'passeio' | 'alimentacao' | 'outros';
export type Tamanho = 'RN' | 'P' | 'M' | 'G' | 'GG' | '1' | '2' | '3';

export type ItemEnxoval = {
  id: string;
  bebe_id: string;
  categoria: Categoria;
  nome: string;
  tamanho: Tamanho | null;
  quantidade: number;
  /** true = ainda falta conseguir; false = já temos. */
  falta: boolean;
  prioridade: 'essencial' | 'bom' | null;
  /** Aparece na página do chá de bebê. */
  no_cha: boolean;
  /** Link do produto que a família quer (http/https). */
  link: string | null;
};

export const CATEGORIAS: { valor: Categoria; titulo: string; sugestoes: string[] }[] = [
  {
    valor: 'roupa',
    titulo: 'Roupas',
    sugestoes: [
      'Body manga curta',
      'Body manga longa',
      'Macacão',
      'Mijão ou calça',
      'Casaquinho',
      'Pijama',
      'Meia',
      'Luvinha',
      'Touca',
      'Saída de maternidade',
    ],
  },
  {
    valor: 'higiene',
    titulo: 'Banho e higiene',
    sugestoes: [
      'Toalha com capuz',
      'Fralda de pano',
      'Fralda descartável (pacote)',
      'Lenço umedecido',
      'Pomada para assaduras',
      'Sabonete líquido',
      'Banheira',
      'Termômetro',
    ],
  },
  {
    valor: 'quarto',
    titulo: 'Sono e quarto',
    sugestoes: ['Lençol de berço', 'Saco de dormir', 'Manta', 'Cobertor', 'Mosquiteiro', 'Trocador'],
  },
  {
    valor: 'passeio',
    titulo: 'Passeio',
    sugestoes: ['Bebê-conforto', 'Carrinho', 'Sling ou canguru', 'Bolsa de maternidade'],
  },
  {
    valor: 'alimentacao',
    titulo: 'Alimentação',
    sugestoes: ['Mamadeira', 'Babador', 'Paninho de boca', 'Bomba tira-leite', 'Almofada de amamentação'],
  },
  { valor: 'outros', titulo: 'Outros', sugestoes: ['Chupeta', 'Mordedor', 'Brinquedo'] },
];

export const TAMANHOS: Tamanho[] = ['RN', 'P', 'M', 'G', 'GG', '1', '2', '3'];

export type Gasto = {
  id: string;
  bebe_id: string;
  autor_id: string;
  tipo: 'compra' | 'presente';
  descricao: string;
  valor: number | null;
  data: string;
  categoria: Categoria | null;
  forma_pagamento: FormaPagamento | null;
  parcelas: number | null;
  quem_deu: string | null;
  agradecido: boolean;
};

export type Cha = {
  bebe_id: string;
  token: string;
  ativo: boolean;
  data_evento: string | null;
  local: string | null;
  mensagem: string | null;
  pix: string | null;
};

export type Reserva = { id: string; item_id: string; nome: string; quantidade: number; mensagem: string | null; criado_em: string };

type ValorEnxoval = {
  /** Chá de bebê do bebê selecionado (null = ainda não criado). */
  cha: Cha | null;
  /** Reservas de presentes do chá, por item. */
  reservas: Reserva[];
  /** O que a família já tem. */
  itens: ItemEnxoval[];
  /** O que ainda falta conseguir. */
  faltam: ItemEnxoval[];
  /** Compras e presentes do bebê selecionado, do mais recente para o mais antigo. */
  gastos: Gasto[];
  orcamento: number | null;
  recarregar: () => Promise<void>;
};

const EnxovalContext = createContext<ValorEnxoval | null>(null);

// Enxoval da família, carregado inteiro. Gravar exige internet.
export function EnxovalProvider({ children }: { children: ReactNode }) {
  const { familia } = useSessao();
  const { bebes, bebeAtual } = useBebes();
  const familiaId = familia?.id ?? null;
  const ids = useMemo(() => bebes.map((b) => b.id).sort().join(','), [bebes]);
  const [itens, setItens] = useState<ItemEnxoval[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [orcamentos, setOrcamentos] = useState<Record<string, number>>({});
  const [chas, setChas] = useState<Cha[]>([]);
  const [reservas, setReservas] = useState<(Reserva & { bebe_id: string })[]>([]);

  const recarregar = useCallback(async () => {
    if (!familiaId || !ids) return;
    const chave = `enxoval:${familiaId}`;
    const lista = ids.split(',');
    const [ch, rs] = await Promise.all([
      supabase.from('cha_bebe').select('bebe_id, token, ativo, data_evento, local, mensagem, pix').in('bebe_id', lista),
      supabase
        .from('cha_reservas')
        .select('id, item_id, bebe_id, nome, quantidade, mensagem, criado_em')
        .in('bebe_id', lista)
        .order('criado_em', { ascending: false }),
    ]);
    if (!ch.error) setChas(ch.data);
    if (!rs.error) setReservas(rs.data);
    const [it, gs, oc] = await Promise.all([
      supabase
        .from('enxoval_itens')
        .select('id, bebe_id, categoria, nome, tamanho, quantidade, falta, prioridade, no_cha, link')
        .in('bebe_id', lista)
        .order('criado_em'),
      supabase
        .from('enxoval_gastos')
        .select('id, bebe_id, autor_id, tipo, descricao, valor, data, categoria, forma_pagamento, parcelas, quem_deu, agradecido')
        .in('bebe_id', lista)
        .order('data', { ascending: false })
        .order('criado_em', { ascending: false }),
      supabase.from('enxoval_orcamento').select('bebe_id, valor').in('bebe_id', lista),
    ]);
    if (it.error || gs.error || oc.error) {
      const cache = lerPref(chave);
      if (cache) {
        const c = JSON.parse(cache);
        // Versões antigas guardavam só a lista de itens.
        setItens(Array.isArray(c) ? c : c.itens);
        if (!Array.isArray(c)) {
          setGastos(c.gastos ?? []);
          setOrcamentos(c.orcamentos ?? {});
        }
      }
      return;
    }
    const listaGastos = gs.data.map((g) => ({ ...g, valor: g.valor === null ? null : Number(g.valor) }));
    const mapa = Object.fromEntries(oc.data.map((o) => [o.bebe_id, Number(o.valor)]));
    setItens(it.data);
    setGastos(listaGastos);
    setOrcamentos(mapa);
    salvarPref(chave, JSON.stringify({ itens: it.data, gastos: listaGastos, orcamentos: mapa }));
  }, [familiaId, ids]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  useEffect(() => {
    if (!familiaId || !ids) return;
    const canal = supabase
      .channel(`enxoval:${familiaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'enxoval_itens' }, () => recarregar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'enxoval_gastos' }, () => recarregar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'enxoval_orcamento' }, () => recarregar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cha_reservas' }, () => recarregar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cha_bebe' }, () => recarregar())
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [familiaId, ids, recarregar]);

  const doBebe = useMemo(() => itens.filter((i) => i.bebe_id === bebeAtual?.id && !i.falta), [itens, bebeAtual]);
  const faltam = useMemo(() => itens.filter((i) => i.bebe_id === bebeAtual?.id && i.falta), [itens, bebeAtual]);
  const gastosDoBebe = useMemo(() => gastos.filter((g) => g.bebe_id === bebeAtual?.id), [gastos, bebeAtual]);
  const orcamento = bebeAtual ? (orcamentos[bebeAtual.id] ?? null) : null;
  const cha = chas.find((c) => c.bebe_id === bebeAtual?.id) ?? null;
  const reservasDoBebe = useMemo(() => reservas.filter((r) => r.bebe_id === bebeAtual?.id), [reservas, bebeAtual]);

  return (
    <EnxovalContext.Provider
      value={{ itens: doBebe, faltam, gastos: gastosDoBebe, orcamento, cha, reservas: reservasDoBebe, recarregar }}>
      {children}
    </EnxovalContext.Provider>
  );
}

export function useEnxoval() {
  const valor = useContext(EnxovalContext);
  if (!valor) throw new Error('useEnxoval precisa estar dentro de EnxovalProvider');
  return valor;
}

// Texto para mandar no WhatsApp: categorias em negrito e roupas agrupadas por tamanho.
export function textoDoEnxoval(nome: string, itens: ItemEnxoval[]) {
  const linhas = [`*Enxoval de ${nome}* 👶`];
  let total = 0;
  for (const c of CATEGORIAS) {
    const daCategoria = itens.filter((i) => i.categoria === c.valor && i.quantidade > 0);
    if (!daCategoria.length) continue;
    linhas.push('', `*${c.titulo}*`);
    const grupos = c.valor === 'roupa' ? [...TAMANHOS, null] : [null];
    for (const t of grupos) {
      const doTamanho = daCategoria.filter((i) => (c.valor === 'roupa' ? i.tamanho === t : true));
      if (!doTamanho.length) continue;
      if (c.valor === 'roupa') linhas.push(t ? `_Tamanho ${t}_` : '_Sem tamanho_');
      for (const i of doTamanho) {
        linhas.push(`• ${i.quantidade} ${i.nome}`);
        total += i.quantidade;
      }
    }
  }
  linhas.push('', `Total: ${total} ${total === 1 ? 'item' : 'itens'}`);
  return linhas.join('\n');
}

// Com link, ele vai na linha de baixo (o WhatsApp transforma em link clicável).
const descreverItem = (i: ItemEnxoval, sufixo = '') =>
  `${i.quantidade} ${i.nome}${i.tamanho ? ` (${i.tamanho})` : ''}${sufixo}${i.link ? `\n  ${i.link}` : ''}`;

// Para responder "o que o bebê precisa?": essenciais primeiro, depois o resto por categoria.
export function textoDoQueFalta(nome: string, faltam: ItemEnxoval[]) {
  const linhas = [`*O que ainda falta para ${nome}* 👶`];
  const essenciais = faltam.filter((i) => i.prioridade === 'essencial');
  if (essenciais.length) {
    linhas.push('', '*⭐ Mais importantes*');
    for (const i of essenciais) linhas.push(`• ${descreverItem(i)}`);
  }
  const resto = faltam.filter((i) => i.prioridade !== 'essencial');
  for (const c of CATEGORIAS) {
    const daCategoria = resto.filter((i) => i.categoria === c.valor);
    if (!daCategoria.length) continue;
    linhas.push('', `*${c.titulo}*`);
    for (const i of daCategoria) linhas.push(`• ${descreverItem(i, i.prioridade === 'bom' ? ' _(seria bom ter)_' : '')}`);
  }
  linhas.push('', 'Obrigado pelo carinho! 💛');
  return linhas.join('\n');
}
