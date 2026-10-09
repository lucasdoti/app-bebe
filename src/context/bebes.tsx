import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { lerPref, salvarPref } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { useSessao } from './sessao';

export type Sexo = 'F' | 'M';

export type Bebe = {
  id: string;
  familia_id: string;
  nome: string;
  nascimento: string;
  sexo: Sexo;
  peso_nascer_kg: number | null;
  altura_nascer_cm: number | null;
};

type ValorBebes = {
  carregando: boolean;
  bebes: Bebe[];
  bebeAtual: Bebe | null;
  escolherBebe: (id: string) => void;
  recarregar: () => Promise<void>;
};

const BebesContext = createContext<ValorBebes | null>(null);

const CAMPOS = 'id, familia_id, nome, nascimento, sexo, peso_nascer_kg, altura_nascer_cm';
const chaveCache = (familiaId: string) => `bebes:${familiaId}`;

export function BebesProvider({ children }: { children: ReactNode }) {
  const { familia } = useSessao();
  const familiaId = familia?.id ?? null;
  const [bebes, setBebes] = useState<Bebe[]>([]);
  const [carregadoPara, setCarregadoPara] = useState<string | null>(null);
  const [atualId, setAtualId] = useState<string | null>(() => lerPref('bebe_atual'));

  const recarregar = useCallback(async () => {
    if (!familiaId) {
      setBebes([]);
      return;
    }
    const { data, error } = await supabase
      .from('bebes')
      .select(CAMPOS)
      .eq('familia_id', familiaId)
      .order('nascimento');
    if (error) {
      // Sem internet: usa a última lista conhecida neste aparelho.
      const cache = lerPref(chaveCache(familiaId));
      if (cache) setBebes(JSON.parse(cache));
    } else {
      setBebes(data);
      salvarPref(chaveCache(familiaId), JSON.stringify(data));
    }
    setCarregadoPara(familiaId);
  }, [familiaId]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  useEffect(() => {
    if (!familiaId) return;
    const canal = supabase
      .channel(`bebes:${familiaId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bebes', filter: `familia_id=eq.${familiaId}` },
        () => recarregar(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [familiaId, recarregar]);

  const escolherBebe = useCallback((id: string) => {
    setAtualId(id);
    salvarPref('bebe_atual', id);
  }, []);

  const bebeAtual = bebes.find((b) => b.id === atualId) ?? bebes[0] ?? null;
  const carregando = !!familiaId && carregadoPara !== familiaId;

  return (
    <BebesContext.Provider value={{ carregando, bebes, bebeAtual, escolherBebe, recarregar }}>
      {children}
    </BebesContext.Provider>
  );
}

export function useBebes() {
  const valor = useContext(BebesContext);
  if (!valor) throw new Error('useBebes precisa estar dentro de BebesProvider');
  return valor;
}
