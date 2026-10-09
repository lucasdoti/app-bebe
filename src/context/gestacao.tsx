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
  peso_mae_kg: number | null;
  pressao_sistolica: number | null;
  pressao_diastolica: number | null;
};

export type Voto = -1 | 1 | 2;
export type Nome = {
  id: string;
  bebe_id: string;
  autor_id: string;
  nome: string;
  sexo: 'F' | 'M' | null;
  /** Votos por user_id. */
  votos: Record<string, Voto>;
};

export type GrupoMala = 'mae' | 'bebe' | 'documentos' | 'acompanhante';
export type ItemMala = { id: string; bebe_id: string; grupo: GrupoMala; nome: string; feito: boolean };

type ValorGestacao = {
  /** Consultas, exames e ultrassons do bebê selecionado, por data. */
  preNatal: PreNatal[];
  mala: ItemMala[];
  /** Nomes sugeridos com os votos, do mais votado para o menos. */
  nomes: Nome[];
  recarregar: () => Promise<void>;
};

const GestacaoContext = createContext<ValorGestacao | null>(null);

const CAMPOS_PN =
  'id, bebe_id, autor_id, tipo, data, titulo, local, anotacoes, perguntas, peso_fetal_g, comprimento_cm, batimentos_bpm, percentil_laudo, peso_mae_kg, pressao_sistolica, pressao_diastolica';

export const pontos = (n: Nome) => Object.values(n.votos).reduce<number>((soma, v) => soma + v, 0);

type Cache = { preNatal: PreNatal[]; mala: ItemMala[]; nomes?: Nome[] };

// Pré-natal, mala e nomes: poucos dados, carregados inteiros. Gravar exige internet.
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
  const [nomes, setNomes] = useState<Nome[]>([]);

  const recarregar = useCallback(async () => {
    if (!familiaId || !ids) {
      setPreNatal([]);
      setMala([]);
      setNomes([]);
      return;
    }
    const chave = `gestacao:${familiaId}`;
    const lista = ids.split(',');
    const [pn, ml, nm] = await Promise.all([
      supabase.from('pre_natal').select(CAMPOS_PN).in('bebe_id', lista).order('data'),
      supabase.from('mala_itens').select('id, bebe_id, grupo, nome, feito').in('bebe_id', lista).order('criado_em'),
      supabase
        .from('nomes')
        .select('id, bebe_id, autor_id, nome, sexo, nomes_votos(user_id, valor)')
        .in('bebe_id', lista)
        .order('criado_em'),
    ]);
    if (pn.error || ml.error || nm.error) {
      const cache = lerPref(chave);
      if (cache) {
        const c = JSON.parse(cache) as Cache;
        setPreNatal(c.preNatal);
        setMala(c.mala);
        setNomes(c.nomes ?? []);
      }
      return;
    }
    const listaNomes: Nome[] = nm.data.map(({ nomes_votos, ...n }) => ({
      ...n,
      sexo: n.sexo as Nome['sexo'],
      votos: Object.fromEntries(nomes_votos.map((v) => [v.user_id, v.valor as Voto])),
    }));
    setPreNatal(pn.data);
    setMala(ml.data);
    setNomes(listaNomes);
    salvarPref(chave, JSON.stringify({ preNatal: pn.data, mala: ml.data, nomes: listaNomes } satisfies Cache));
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nomes' }, () => recarregar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nomes_votos' }, () => recarregar())
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [familiaId, ids, recarregar]);

  const doBebe = useMemo(() => preNatal.filter((p) => p.bebe_id === bebeAtual?.id), [preNatal, bebeAtual]);
  const malaDoBebe = useMemo(() => mala.filter((m) => m.bebe_id === bebeAtual?.id), [mala, bebeAtual]);
  const nomesDoBebe = useMemo(
    () =>
      nomes
        .filter((n) => n.bebe_id === bebeAtual?.id)
        .sort((a, b) => pontos(b) - pontos(a) || a.nome.localeCompare(b.nome)),
    [nomes, bebeAtual],
  );

  return (
    <GestacaoContext.Provider value={{ preNatal: doBebe, mala: malaDoBebe, nomes: nomesDoBebe, recarregar }}>
      {children}
    </GestacaoContext.Provider>
  );
}

export function useGestacao() {
  const valor = useContext(GestacaoContext);
  if (!valor) throw new Error('useGestacao precisa estar dentro de GestacaoProvider');
  return valor;
}
