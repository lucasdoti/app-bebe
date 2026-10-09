import { randomUUID } from 'expo-crypto';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { Contexto, ContextoAjuste } from '@/lib/roupa';
import { contextoDoAjuste } from '@/lib/roupa';
import { lerPref, salvarPref } from '@/lib/storage';
import { mensagemDeErro, supabase } from '@/lib/supabase';
import { useBebes } from './bebes';
import { useSessao } from './sessao';

export type Resultado = 'frio' | 'ok' | 'calor';

/** Roupa que os pais disseram que iam usar; o app pergunta depois como o bebê ficou. */
export type Pendente = {
  id: string;
  bebeId: string;
  contexto: Contexto;
  sensacao: number;
  sugestao: string;
  marcadoEm: number;
  perguntarApos: number;
};

type ValorRoupa = {
  ajuste: (bebeId: string, contexto: Contexto) => number;
  /** Perguntas de feedback já liberadas para o bebê. */
  perguntas: (bebeId: string) => Pendente[];
  vouUsar: (p: Omit<Pendente, 'id' | 'marcadoEm' | 'perguntarApos'>) => Date;
  responder: (p: Pendente, resultado: Resultado) => Promise<string | null>;
  dispensar: (id: string) => void;
};

const RoupaContext = createContext<ValorRoupa | null>(null);
const CHAVE_PENDENTES = 'roupa_pendentes';

// Passeio: pergunta 1 h depois. Sono da noite: na manhã seguinte, às 7h. Cochilo: 2 h depois.
function quandoPerguntar(contexto: Contexto, agora = new Date()) {
  if (contexto !== 'sono') return new Date(agora.getTime() + 60 * 60_000);
  const h = agora.getHours();
  if (h >= 8 && h < 18) return new Date(agora.getTime() + 2 * 60 * 60_000);
  const manha = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 7);
  if (h >= 18) manha.setDate(manha.getDate() + 1);
  return manha;
}

export function RoupaProvider({ children }: { children: ReactNode }) {
  const { familia } = useSessao();
  const { bebes } = useBebes();
  const idsBebes = useMemo(() => bebes.map((b) => b.id).sort().join(','), [bebes]);
  const [ajustes, setAjustes] = useState<Record<string, number>>({});
  const [pendentes, setPendentes] = useState<Pendente[]>(() => {
    try {
      return JSON.parse(lerPref(CHAVE_PENDENTES) ?? '[]');
    } catch {
      return [];
    }
  });
  const [agora, setAgora] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const recarregar = useCallback(async () => {
    if (!idsBebes) return;
    const { data, error } = await supabase
      .from('roupa_ajuste')
      .select('bebe_id, contexto, ajuste_camadas')
      .in('bebe_id', idsBebes.split(','));
    if (error) {
      const cache = lerPref(`roupa_ajuste:${familia?.id}`);
      if (cache) setAjustes(JSON.parse(cache));
      return;
    }
    const mapa: Record<string, number> = {};
    for (const a of data) mapa[`${a.bebe_id}:${a.contexto}`] = Number(a.ajuste_camadas);
    setAjustes(mapa);
    salvarPref(`roupa_ajuste:${familia?.id}`, JSON.stringify(mapa));
  }, [idsBebes, familia?.id]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  useEffect(() => {
    if (!idsBebes) return;
    const canal = supabase
      .channel(`roupa_ajuste:${familia?.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'roupa_ajuste', filter: `bebe_id=in.(${idsBebes})` },
        () => recarregar(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [idsBebes, familia?.id, recarregar]);

  const guardar = useCallback((lista: Pendente[]) => {
    setPendentes(lista);
    salvarPref(CHAVE_PENDENTES, JSON.stringify(lista));
  }, []);

  const valor: ValorRoupa = {
    ajuste: (bebeId, contexto) => ajustes[`${bebeId}:${contextoDoAjuste(contexto)}`] ?? 0,
    perguntas: (bebeId) => pendentes.filter((p) => p.bebeId === bebeId && p.perguntarApos <= agora),
    vouUsar: (p) => {
      const quando = quandoPerguntar(p.contexto);
      // Uma pergunta por bebê e contexto: a escolha mais recente substitui a anterior.
      const outros = pendentes.filter(
        (x) => !(x.bebeId === p.bebeId && contextoDoAjuste(x.contexto) === contextoDoAjuste(p.contexto)),
      );
      guardar([...outros, { ...p, id: randomUUID(), marcadoEm: Date.now(), perguntarApos: quando.getTime() }]);
      return quando;
    },
    responder: async (p, resultado) => {
      const ctx: ContextoAjuste = contextoDoAjuste(p.contexto);
      const { error } = await supabase.rpc('registrar_feedback_roupa', {
        p_bebe: p.bebeId,
        p_contexto: ctx,
        p_sensacao: Math.round(p.sensacao * 10) / 10,
        p_sugestao: p.sugestao,
        p_resultado: resultado,
      });
      if (error) return mensagemDeErro(error);
      guardar(pendentes.filter((x) => x.id !== p.id));
      await recarregar();
      return null;
    },
    dispensar: (id) => guardar(pendentes.filter((x) => x.id !== id)),
  };

  return <RoupaContext.Provider value={valor}>{children}</RoupaContext.Provider>;
}

export function useRoupa() {
  const valor = useContext(RoupaContext);
  if (!valor) throw new Error('useRoupa precisa estar dentro de RoupaProvider');
  return valor;
}
