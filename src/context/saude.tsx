import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { ItemSaude } from '@/lib/saude';
import { lerPref, salvarPref } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { useBebes } from './bebes';
import { useSessao } from './sessao';

type ValorSaude = {
  /** Todos os itens da ficha do bebê selecionado. */
  ficha: ItemSaude[];
  pezinho: ItemSaude | null;
  condicoes: ItemSaude[];
  remediosEvitar: ItemSaude[];
  alimentosEvitar: ItemSaude[];
  alergias: ItemSaude[];
  fonte: ItemSaude | null;
  /** Há algo que médicos e cuidadores precisam saber (condição, lista a evitar ou alergia). */
  temAlerta: boolean;
  recarregar: () => Promise<void>;
};

const SaudeContext = createContext<ValorSaude | null>(null);

// Ficha de saúde. Fica guardada no aparelho: precisa abrir no consultório mesmo sem internet.
export function SaudeProvider({ children }: { children: ReactNode }) {
  const { familia } = useSessao();
  const { bebes, bebeAtual } = useBebes();
  const familiaId = familia?.id ?? null;
  const ids = useMemo(() => bebes.map((b) => b.id).sort().join(','), [bebes]);
  const [itens, setItens] = useState<ItemSaude[]>(() => {
    try {
      return familiaId ? JSON.parse(lerPref(`saude:${familiaId}`) ?? '[]') : [];
    } catch {
      return [];
    }
  });

  const recarregar = useCallback(async () => {
    if (!familiaId || !ids) return;
    const chave = `saude:${familiaId}`;
    const { data, error } = await supabase
      .from('saude_itens')
      .select('id, bebe_id, tipo, nome, status, data, detalhe')
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
      .channel(`saude:${familiaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'saude_itens' }, () => recarregar())
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [familiaId, ids, recarregar]);

  const valor = useMemo(() => {
    const ficha = itens.filter((i) => i.bebe_id === bebeAtual?.id);
    const de = (t: ItemSaude['tipo']) => ficha.filter((i) => i.tipo === t);
    const condicoes = de('condicao');
    const remediosEvitar = de('evitar_remedio');
    const alimentosEvitar = de('evitar_alimento');
    const alergias = de('alergia');
    return {
      ficha,
      pezinho: de('pezinho')[0] ?? null,
      condicoes,
      remediosEvitar,
      alimentosEvitar,
      alergias,
      fonte: de('fonte')[0] ?? null,
      temAlerta:
        condicoes.some((c) => c.status !== 'descartado') ||
        remediosEvitar.length > 0 ||
        alimentosEvitar.length > 0 ||
        alergias.length > 0,
      recarregar,
    };
  }, [itens, bebeAtual, recarregar]);

  return <SaudeContext.Provider value={valor}>{children}</SaudeContext.Provider>;
}

export function useSaude() {
  const valor = useContext(SaudeContext);
  if (!valor) throw new Error('useSaude precisa estar dentro de SaudeProvider');
  return valor;
}
