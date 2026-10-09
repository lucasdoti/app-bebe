import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { Registro } from '@/lib/registros';
import { lerPref, salvarPref } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { useBebes } from './bebes';
import { useRegistros } from './registros';
import { useSessao } from './sessao';

export type Remedio = {
  id: string;
  bebe_id: string;
  nome: string;
  dose: string;
  intervalo_h: number;
  inicio: string;
  duracao_dias: number | null;
  ativo: boolean;
};

export type Lembrete = {
  id: string;
  bebe_id: string;
  tipo: 'mamada' | 'personalizado';
  titulo: string;
  proximo_em: string | null;
  recorrencia: 'nenhuma' | 'diaria' | 'semanal';
  intervalo_min: number | null;
  ativo: boolean;
};

export type Dose = Extract<Registro, { tipo: 'dose' }>;

export type SituacaoRemedio = {
  remedio: Remedio;
  ultimaDose: Dose | null;
  /** Quando a próxima dose fica liberada (ms). */
  proxima: number;
  liberada: boolean;
  terminou: boolean;
};

type ValorRemedios = {
  remedios: Remedio[];
  lembretes: Lembrete[];
  situacao: (agora: number) => SituacaoRemedio[];
  recarregar: () => Promise<void>;
};

const RemediosContext = createContext<ValorRemedios | null>(null);
const HORA = 3600_000;

export function fimDoTratamento(r: Remedio) {
  return r.duracao_dias ? new Date(r.inicio).getTime() + r.duracao_dias * 24 * HORA : null;
}

// Remédios e lembretes da família. Gravar exige internet; as doses dadas são registros (funcionam offline).
export function RemediosProvider({ children }: { children: ReactNode }) {
  const { familia } = useSessao();
  const { bebes, bebeAtual } = useBebes();
  const { doBebe } = useRegistros();
  const familiaId = familia?.id ?? null;
  const ids = useMemo(() => bebes.map((b) => b.id).sort().join(','), [bebes]);
  const [remedios, setRemedios] = useState<Remedio[]>([]);
  const [lembretes, setLembretes] = useState<Lembrete[]>([]);

  const recarregar = useCallback(async () => {
    if (!familiaId || !ids) return;
    const lista = ids.split(',');
    const [rm, lb] = await Promise.all([
      supabase
        .from('remedios')
        .select('id, bebe_id, nome, dose, intervalo_h, inicio, duracao_dias, ativo')
        .in('bebe_id', lista)
        .order('criado_em'),
      supabase
        .from('lembretes')
        .select('id, bebe_id, tipo, titulo, proximo_em, recorrencia, intervalo_min, ativo')
        .in('bebe_id', lista)
        .order('criado_em'),
    ]);
    const chave = `remedios:${familiaId}`;
    if (rm.error || lb.error) {
      const cache = lerPref(chave);
      if (cache) {
        const c = JSON.parse(cache);
        setRemedios(c.remedios);
        setLembretes(c.lembretes);
      }
      return;
    }
    const lista2 = rm.data.map((r) => ({ ...r, intervalo_h: Number(r.intervalo_h) }));
    setRemedios(lista2);
    setLembretes(lb.data);
    salvarPref(chave, JSON.stringify({ remedios: lista2, lembretes: lb.data }));
  }, [familiaId, ids]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  useEffect(() => {
    if (!familiaId || !ids) return;
    const canal = supabase
      .channel(`remedios:${familiaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'remedios' }, () => recarregar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lembretes' }, () => recarregar())
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [familiaId, ids, recarregar]);

  const doBebeAtual = useMemo(() => remedios.filter((r) => r.bebe_id === bebeAtual?.id), [remedios, bebeAtual]);
  const lembretesDoBebe = useMemo(() => lembretes.filter((l) => l.bebe_id === bebeAtual?.id), [lembretes, bebeAtual]);

  const situacao = useCallback(
    (agora: number) =>
      doBebeAtual
        .filter((r) => r.ativo)
        .map((remedio) => {
          const ultimaDose =
            (doBebe.find((x) => x.tipo === 'dose' && x.detalhes.remedio_id === remedio.id) as Dose | undefined) ?? null;
          const proxima = ultimaDose
            ? new Date(ultimaDose.inicio).getTime() + remedio.intervalo_h * HORA
            : new Date(remedio.inicio).getTime();
          const fim = fimDoTratamento(remedio);
          return { remedio, ultimaDose, proxima, liberada: proxima <= agora, terminou: fim !== null && agora > fim };
        }),
    [doBebeAtual, doBebe],
  );

  return (
    <RemediosContext.Provider value={{ remedios: doBebeAtual, lembretes: lembretesDoBebe, situacao, recarregar }}>
      {children}
    </RemediosContext.Provider>
  );
}

export function useRemedios() {
  const valor = useContext(RemediosContext);
  if (!valor) throw new Error('useRemedios precisa estar dentro de RemediosProvider');
  return valor;
}
