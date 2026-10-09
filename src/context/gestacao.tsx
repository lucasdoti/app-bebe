import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { lerPref, salvarPref } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { useBebes } from './bebes';
import { useSessao } from './sessao';

export type TipoPreNatal = 'consulta' | 'exame' | 'ultrassom';

export type PreNatal = {
  id: string;
  bebe_id: string;
  autor_id: string;
  tipo: TipoPreNatal;
  data: string;
  titulo: string;
  local: string | null;
  anotacoes: string | null;
  perguntas: string | null;
  peso_fetal_g: number | null;
  comprimento_cm: number | null;
  batimentos_bpm: number | null;
  percentil_laudo: number | null;
};

export type GrupoMala = 'mae' | 'bebe' | 'documentos' | 'acompanhante';
export type ItemMala = { id: string; bebe_id: string; grupo: GrupoMala; nome: string; feito: boolean };

type ValorGestacao = {
  /** Consultas, exames e ultrassons do bebê selecionado, por data. */
  preNatal: PreNatal[];
  mala: ItemMala[];
  recarregar: () => Promise<void>;
};

const GestacaoContext = createContext<ValorGestacao | null>(null);

const CAMPOS_PN =
  'id, bebe_id, autor_id, tipo, data, titulo, local, anotacoes, perguntas, peso_fetal_g, comprimento_cm, batimentos_bpm, percentil_laudo';

// Pré-natal e mala da maternidade: poucos dados, carregados inteiros. Gravar exige internet.
export function GestacaoProvider({ children }: { children: ReactNode }) {
  const { familia } = useSessao();
  const { bebes, bebeAtual } = useBebes();
  const familiaId = familia?.id ?? null;
  const ids = useMemo(
    () =>
      bebes
        .filter((b) => b.status === 'gestacao' || b.parto_previsto)
        .map((b) => b.id)
        .sort()
        .join(','),
    [bebes],
  );
  const [preNatal, setPreNatal] = useState<PreNatal[]>([]);
  const [mala, setMala] = useState<ItemMala[]>([]);

  const recarregar = useCallback(async () => {
    if (!familiaId || !ids) {
      setPreNatal([]);
      setMala([]);
      return;
    }
    const lista = ids.split(',');
    const [pn, ml] = await Promise.all([
      supabase.from('pre_natal').select(CAMPOS_PN).in('bebe_id', lista).order('data'),
      supabase.from('mala_itens').select('id, bebe_id, grupo, nome, feito').in('bebe_id', lista).order('criado_em'),
    ]);
    if (pn.error || ml.error) {
      const cache = lerPref(`gestacao:${familiaId}`);
      if (cache) {
        const c = JSON.parse(cache);
        setPreNatal(c.preNatal);
        setMala(c.mala);
      }
      return;
    }
    setPreNatal(pn.data);
    setMala(ml.data);
    salvarPref(`gestacao:${familiaId}`, JSON.stringify({ preNatal: pn.data, mala: ml.data }));
  }, [familiaId, ids]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  useEffect(() => {
    if (!familiaId || !ids) return;
    const canal = supabase
      .channel(`gestacao:${familiaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pre_natal' }, () => recarregar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mala_itens' }, () => recarregar())
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [familiaId, ids, recarregar]);

  const doBebe = useMemo(() => preNatal.filter((p) => p.bebe_id === bebeAtual?.id), [preNatal, bebeAtual]);
  const malaDoBebe = useMemo(() => mala.filter((m) => m.bebe_id === bebeAtual?.id), [mala, bebeAtual]);

  return (
    <GestacaoContext.Provider value={{ preNatal: doBebe, mala: malaDoBebe, recarregar }}>
      {children}
    </GestacaoContext.Provider>
  );
}

export function useGestacao() {
  const valor = useContext(GestacaoContext);
  if (!valor) throw new Error('useGestacao precisa estar dentro de GestacaoProvider');
  return valor;
}
