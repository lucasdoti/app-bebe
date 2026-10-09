import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { lerPref, salvarPref } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { useBebes } from './bebes';
import { useSessao } from './sessao';

export type Medida = {
  id: string;
  bebe_id: string;
  autor_id: string;
  data: string;
  peso_kg: number | null;
  altura_cm: number | null;
  perimetro_cefalico_cm: number | null;
};

type ValorMedidas = {
  /** Medidas do bebê selecionado, da mais antiga para a mais recente. */
  doBebe: Medida[];
  recarregar: () => Promise<void>;
};

const MedidasContext = createContext<ValorMedidas | null>(null);
const CAMPOS = 'id, bebe_id, autor_id, data, peso_kg, altura_cm, perimetro_cefalico_cm';

// Medidas são poucas: carrega todas da família. Gravar exige internet (diferente dos registros).
export function MedidasProvider({ children }: { children: ReactNode }) {
  const { familia } = useSessao();
  const { bebes, bebeAtual } = useBebes();
  const familiaId = familia?.id ?? null;
  const idsBebes = useMemo(() => bebes.map((b) => b.id).sort().join(','), [bebes]);
  const [medidas, setMedidas] = useState<Medida[]>([]);

  const recarregar = useCallback(async () => {
    if (!familiaId || !idsBebes) return setMedidas([]);
    const { data, error } = await supabase
      .from('medidas')
      .select(CAMPOS)
      .in('bebe_id', idsBebes.split(','))
      .order('data');
    if (error) {
      const cache = lerPref(`medidas:${familiaId}`);
      if (cache) setMedidas(JSON.parse(cache));
      return;
    }
    setMedidas(data);
    salvarPref(`medidas:${familiaId}`, JSON.stringify(data));
  }, [familiaId, idsBebes]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  useEffect(() => {
    if (!familiaId || !idsBebes) return;
    const canal = supabase
      .channel(`medidas:${familiaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'medidas' }, () => recarregar())
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [familiaId, idsBebes, recarregar]);

  const doBebe = useMemo(() => medidas.filter((m) => m.bebe_id === bebeAtual?.id), [medidas, bebeAtual]);

  return <MedidasContext.Provider value={{ doBebe, recarregar }}>{children}</MedidasContext.Provider>;
}

export function useMedidas() {
  const valor = useContext(MedidasContext);
  if (!valor) throw new Error('useMedidas precisa estar dentro de MedidasProvider');
  return valor;
}
