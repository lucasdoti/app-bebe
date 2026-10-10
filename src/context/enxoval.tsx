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

type ValorEnxoval = {
  itens: ItemEnxoval[];
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

  const recarregar = useCallback(async () => {
    if (!familiaId || !ids) return;
    const chave = `enxoval:${familiaId}`;
    const lista = ids.split(',');
    const [it, gs, oc] = await Promise.all([
      supabase.from('enxoval_itens').select('id, bebe_id, categoria, nome, tamanho, quantidade').in('bebe_id', lista).order('criado_em'),
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
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [familiaId, ids, recarregar]);

  const doBebe = useMemo(() => itens.filter((i) => i.bebe_id === bebeAtual?.id), [itens, bebeAtual]);
  const gastosDoBebe = useMemo(() => gastos.filter((g) => g.bebe_id === bebeAtual?.id), [gastos, bebeAtual]);
  const orcamento = bebeAtual ? (orcamentos[bebeAtual.id] ?? null) : null;

  return (
    <EnxovalContext.Provider value={{ itens: doBebe, gastos: gastosDoBebe, orcamento, recarregar }}>
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
