import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { lerPref, salvarPref } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import type { Para } from '@/lib/vacinas';
import { useBebes } from './bebes';
import { useSessao } from './sessao';

export type VacinaAplicada = {
  id: string;
  bebe_id: string;
  para: Para;
  codigo: string | null;
  nome: string;
  data: string;
  local: string | null;
  lote: string | null;
  observacao: string | null;
};

type ValorVacinas = {
  /** Vacinas do bebê selecionado (dele e da mãe na gestação), por data. */
  aplicadas: VacinaAplicada[];
  recarregar: () => Promise<void>;
};

const VacinasContext = createContext<ValorVacinas | null>(null);

// Vacinas já tomadas. Gravar exige internet.
export function VacinasProvider({ children }: { children: ReactNode }) {
  const { familia } = useSessao();
  const { bebes, bebeAtual } = useBebes();
  const familiaId = familia?.id ?? null;
  const ids = useMemo(() => bebes.map((b) => b.id).sort().join(','), [bebes]);
  const [todas, setTodas] = useState<VacinaAplicada[]>([]);

  const recarregar = useCallback(async () => {
    if (!familiaId || !ids) return;
    const chave = `vacinas:${familiaId}`;
    const { data, error } = await supabase
      .from('vacinas_aplicadas')
      .select('id, bebe_id, para, codigo, nome, data, local, lote, observacao')
      .in('bebe_id', ids.split(','))
      .order('data');
    if (error) {
      const cache = lerPref(chave);
      if (cache) setTodas(JSON.parse(cache));
      return;
    }
    setTodas(data);
    salvarPref(chave, JSON.stringify(data));
  }, [familiaId, ids]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  useEffect(() => {
    if (!familiaId || !ids) return;
    const canal = supabase
      .channel(`vacinas:${familiaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vacinas_aplicadas' }, () => recarregar())
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [familiaId, ids, recarregar]);

  const aplicadas = useMemo(() => todas.filter((v) => v.bebe_id === bebeAtual?.id), [todas, bebeAtual]);

  return <VacinasContext.Provider value={{ aplicadas, recarregar }}>{children}</VacinasContext.Provider>;
}

export function useVacinas() {
  const valor = useContext(VacinasContext);
  if (!valor) throw new Error('useVacinas precisa estar dentro de VacinasProvider');
  return valor;
}
