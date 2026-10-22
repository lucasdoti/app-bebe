import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { DenteNascido } from '@/lib/dentes';
import { lerPref, salvarPref } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { useBebes } from './bebes';
import { useSessao } from './sessao';

type ValorDentes = {
  /** Dentes que já nasceram, do bebê selecionado, do mais antigo para o mais novo. */
  dentes: DenteNascido[];
  recarregar: () => Promise<void>;
};

const DentesContext = createContext<ValorDentes | null>(null);

// Dentinhos: guardados também no aparelho para abrir sem internet.
export function DentesProvider({ children }: { children: ReactNode }) {
  const { familia } = useSessao();
  const { bebes, bebeAtual } = useBebes();
  const familiaId = familia?.id ?? null;
  const ids = useMemo(() => bebes.map((b) => b.id).sort().join(','), [bebes]);
  const [todos, setTodos] = useState<DenteNascido[]>(() => {
    try {
      return familiaId ? JSON.parse(lerPref(`dentes:${familiaId}`) ?? '[]') : [];
    } catch {
      return [];
    }
  });

  const recarregar = useCallback(async () => {
    if (!familiaId || !ids) return;
    const chave = `dentes:${familiaId}`;
    const { data, error } = await supabase
      .from('dentes')
      .select('id, bebe_id, codigo, nasceu_em, observacao')
      .in('bebe_id', ids.split(','))
      .order('nasceu_em');
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
      .channel(`dentes:${familiaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dentes' }, () => recarregar())
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [familiaId, ids, recarregar]);

  const dentes = useMemo(() => todos.filter((d) => d.bebe_id === bebeAtual?.id), [todos, bebeAtual]);

  return <DentesContext.Provider value={{ dentes, recarregar }}>{children}</DentesContext.Provider>;
}

export function useDentes() {
  const valor = useContext(DentesContext);
  if (!valor) throw new Error('useDentes precisa estar dentro de DentesProvider');
  return valor;
}
