import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { Marco } from '@/lib/marcos';
import { lerPref, salvarPref } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { useBebes } from './bebes';
import { useSessao } from './sessao';

type ValorMarcos = {
  /** Marcos do bebê selecionado, do mais antigo para o mais novo. */
  marcos: Marco[];
  recarregar: () => Promise<void>;
};

const MarcosContext = createContext<ValorMarcos | null>(null);

// Marcos (primeiras vezes e desenvolvimento): guardados também no aparelho para abrir sem internet.
export function MarcosProvider({ children }: { children: ReactNode }) {
  const { familia } = useSessao();
  const { bebes, bebeAtual } = useBebes();
  const familiaId = familia?.id ?? null;
  const ids = useMemo(() => bebes.map((b) => b.id).sort().join(','), [bebes]);
  const [todos, setTodos] = useState<Marco[]>(() => {
    try {
      return familiaId ? JSON.parse(lerPref(`marcos:${familiaId}`) ?? '[]') : [];
    } catch {
      return [];
    }
  });

  const recarregar = useCallback(async () => {
    if (!familiaId || !ids) return;
    const chave = `marcos:${familiaId}`;
    const { data, error } = await supabase
      .from('marcos')
      .select('id, bebe_id, tipo, codigo, titulo, data, detalhe')
      .in('bebe_id', ids.split(','))
      .order('data');
    if (error) {
      const cache = lerPref(chave);
      if (cache) setTodos(JSON.parse(cache));
      return;
    }
    setTodos(data);
    salvarPref(chave, JSON.stringify(data));
  }, [familiaId, ids]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  useEffect(() => {
    if (!familiaId || !ids) return;
    const canal = supabase
      .channel(`marcos:${familiaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marcos' }, () => recarregar())
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [familiaId, ids, recarregar]);

  const marcos = useMemo(() => todos.filter((d) => d.bebe_id === bebeAtual?.id), [todos, bebeAtual]);

  return <MarcosContext.Provider value={{ marcos, recarregar }}>{children}</MarcosContext.Provider>;
}

export function useMarcos() {
  const valor = useContext(MarcosContext);
  if (!valor) throw new Error('useMarcos precisa estar dentro de MarcosProvider');
  return valor;
}
