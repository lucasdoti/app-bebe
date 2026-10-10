import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

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

type ValorEnxoval = {
  itens: ItemEnxoval[];
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

  const recarregar = useCallback(async () => {
    if (!familiaId || !ids) return;
    const chave = `enxoval:${familiaId}`;
    const { data, error } = await supabase
      .from('enxoval_itens')
      .select('id, bebe_id, categoria, nome, tamanho, quantidade')
      .in('bebe_id', ids.split(','))
      .order('criado_em');
    if (error) {
      const cache = lerPref(chave);
      if (cache) setItens(JSON.parse(cache));
      return;
    }
    setItens(data);
    salvarPref(chave, JSON.stringify(data));
  }, [familiaId, ids]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  useEffect(() => {
    if (!familiaId || !ids) return;
    const canal = supabase
      .channel(`enxoval:${familiaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'enxoval_itens' }, () => recarregar())
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [familiaId, ids, recarregar]);

  const doBebe = useMemo(() => itens.filter((i) => i.bebe_id === bebeAtual?.id), [itens, bebeAtual]);

  return <EnxovalContext.Provider value={{ itens: doBebe, recarregar }}>{children}</EnxovalContext.Provider>;
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
