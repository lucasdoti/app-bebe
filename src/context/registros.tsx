import { randomUUID } from 'expo-crypto';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import type { DetalhesFralda, Lado, Leite, Registro } from '@/lib/registros';
import { lerPref, salvarPref } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { useBebes } from './bebes';
import { useSessao } from './sessao';

// O app grava primeiro aqui no aparelho (estado + fila de envio) e sincroniza com o
// Supabase quando há internet. O Realtime traz o que o outro responsável registrou.

type Operacao =
  | { op: 'inserir'; registro: Registro }
  | { op: 'atualizar'; id: string; mudancas: Partial<Pick<Registro, 'inicio' | 'fim' | 'detalhes'>> }
  | { op: 'excluir'; id: string };

type NovoRegistro = Omit<Registro, 'id' | 'autor_id' | 'bebe_id'> & { bebe_id?: string };

type ValorRegistros = {
  carregando: boolean;
  /** Registros do bebê selecionado, do mais recente para o mais antigo. */
  doBebe: Registro[];
  pendentes: number;
  criar: (novo: NovoRegistro) => Registro | null;
  atualizar: (id: string, mudancas: Partial<Pick<Registro, 'inicio' | 'fim' | 'detalhes'>>) => void;
  excluir: (id: string) => void;
  iniciarPeito: (lado: Lado) => void;
  trocarLado: (registro: Extract<Registro, { tipo: 'mamada' }>) => void;
  encerrar: (registro: Registro) => void;
  mamadeira: (ml: number, leite: Leite) => Registro | null;
  iniciarSono: () => Registro | null;
  iniciarContracao: () => Registro | null;
  fralda: (d: DetalhesFralda) => Registro | null;
};

const RegistrosContext = createContext<ValorRegistros | null>(null);

const DIAS_CARREGADOS = 8;
const CAMPOS = 'id, bebe_id, autor_id, tipo, inicio, fim, detalhes';

const ordenar = (lista: Registro[]) => [...lista].sort((a, b) => b.inicio.localeCompare(a.inicio));
const agoraISO = () => new Date().toISOString();

function aplicar(lista: Registro[], op: Operacao): Registro[] {
  switch (op.op) {
    case 'inserir':
      return lista.some((r) => r.id === op.registro.id) ? lista : [op.registro, ...lista];
    case 'atualizar':
      return lista.map((r) => (r.id === op.id ? ({ ...r, ...op.mudancas } as Registro) : r));
    case 'excluir':
      return lista.filter((r) => r.id !== op.id);
  }
}

function ehFalhaDeRede(erro: { message?: string; code?: string }) {
  return !erro.code && /fetch|network|load failed/i.test(erro.message ?? '');
}

// Supabase devolve datas como "2026-10-10T14:05:00+00:00"; padroniza para comparar como texto.
function normalizar(r: Registro): Registro {
  return { ...r, inicio: new Date(r.inicio).toISOString(), fim: r.fim && new Date(r.fim).toISOString() };
}

export function RegistrosProvider({ children }: { children: ReactNode }) {
  const { sessao, familia } = useSessao();
  const { bebes, bebeAtual } = useBebes();
  const familiaId = familia?.id ?? null;
  const userId = sessao?.user.id ?? null;
  const idsBebes = useMemo(() => bebes.map((b) => b.id).sort().join(','), [bebes]);

  const [registros, setRegistros] = useState<Registro[]>([]);
  const [fila, setFila] = useState<Operacao[]>([]);
  const [carregadoPara, setCarregadoPara] = useState<string | null>(null);
  const filaRef = useRef<Operacao[]>([]);
  const enviando = useRef(false);

  const chaveCache = familiaId && `registros:${familiaId}`;
  const chaveFila = familiaId && `fila:${familiaId}`;

  // Abre com o que estava salvo no aparelho.
  useEffect(() => {
    if (!chaveCache || !chaveFila) return;
    const cache = lerPref(chaveCache);
    const filaSalva = lerPref(chaveFila);
    filaRef.current = filaSalva ? JSON.parse(filaSalva) : [];
    setFila(filaRef.current);
    setRegistros(cache ? JSON.parse(cache) : []);
  }, [chaveCache, chaveFila]);

  useEffect(() => {
    if (chaveCache) salvarPref(chaveCache, JSON.stringify(registros));
  }, [chaveCache, registros]);

  const guardarFila = useCallback(
    (nova: Operacao[]) => {
      filaRef.current = nova;
      setFila(nova);
      if (chaveFila) salvarPref(chaveFila, JSON.stringify(nova));
    },
    [chaveFila],
  );

  // Envia a fila na ordem. Para na primeira falha de rede e tenta de novo depois.
  const enviarFila = useCallback(async () => {
    if (enviando.current) return;
    enviando.current = true;
    try {
      while (filaRef.current.length) {
        const op = filaRef.current[0];
        let erro: { message?: string; code?: string } | null = null;
        if (op.op === 'inserir') {
          const { id, bebe_id, tipo, inicio, fim, detalhes } = op.registro;
          ({ error: erro } = await supabase.from('registros').insert({ id, bebe_id, tipo, inicio, fim, detalhes }));
          // Já tinha chegado numa tentativa anterior.
          if (erro?.code === '23505') erro = null;
        } else if (op.op === 'atualizar') {
          ({ error: erro } = await supabase.from('registros').update(op.mudancas).eq('id', op.id));
        } else {
          ({ error: erro } = await supabase.from('registros').delete().eq('id', op.id));
        }
        if (erro && ehFalhaDeRede(erro)) return;
        if (erro) console.warn('Registro descartado na sincronização:', erro.message);
        guardarFila(filaRef.current.slice(1));
      }
    } finally {
      enviando.current = false;
    }
  }, [guardarFila]);

  // Busca os últimos dias no servidor e reaplica o que ainda não foi enviado.
  const recarregar = useCallback(async () => {
    if (!familiaId || !idsBebes) {
      if (familiaId) setCarregadoPara(familiaId);
      return;
    }
    const desde = new Date(Date.now() - DIAS_CARREGADOS * 24 * 3600_000).toISOString();
    const { data, error } = await supabase
      .from('registros')
      .select(CAMPOS)
      .in('bebe_id', idsBebes.split(','))
      .or(`inicio.gte.${desde},fim.is.null`)
      .order('inicio', { ascending: false });
    if (!error) {
      const doServidor = (data as Registro[]).map(normalizar);
      setRegistros(ordenar(filaRef.current.reduce(aplicar, doServidor)));
    }
    setCarregadoPara(familiaId);
  }, [familiaId, idsBebes]);

  useEffect(() => {
    enviarFila().then(recarregar);
  }, [enviarFila, recarregar]);

  // Tenta enviar de novo quando a internet volta, quando o app volta para a frente e a cada 20 s.
  useEffect(() => {
    const tentar = () => enviarFila().then(recarregar);
    const sub = AppState.addEventListener('change', (e) => e === 'active' && tentar());
    if (Platform.OS === 'web') window.addEventListener('online', tentar);
    const id = setInterval(() => filaRef.current.length && enviarFila(), 20_000);
    return () => {
      sub.remove();
      if (Platform.OS === 'web') window.removeEventListener('online', tentar);
      clearInterval(id);
    };
  }, [enviarFila, recarregar]);

  // Realtime: novidades do outro celular.
  useEffect(() => {
    if (!familiaId || !idsBebes) return;
    const canal = supabase
      .channel(`registros:${familiaId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'registros', filter: `bebe_id=in.(${idsBebes})` },
        ({ new: novo }) => setRegistros((l) => ordenar([normalizar(novo as Registro), ...l.filter((r) => r.id !== novo.id)])),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'registros', filter: `bebe_id=in.(${idsBebes})` },
        ({ new: novo }) =>
          setRegistros((l) => ordenar(l.map((r) => (r.id === novo.id ? normalizar(novo as Registro) : r)))),
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'registros' }, ({ old }) =>
        setRegistros((l) => l.filter((r) => r.id !== old.id)),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [familiaId, idsBebes]);

  const executar = useCallback(
    (op: Operacao) => {
      setRegistros((l) => ordenar(aplicar(l, op)));
      guardarFila([...filaRef.current, op]);
      enviarFila();
    },
    [enviarFila, guardarFila],
  );

  const criar = useCallback(
    (novo: NovoRegistro) => {
      const bebeId = novo.bebe_id ?? bebeAtual?.id;
      if (!bebeId || !userId) return null;
      const registro = { ...novo, id: randomUUID(), bebe_id: bebeId, autor_id: userId } as Registro;
      executar({ op: 'inserir', registro });
      return registro;
    },
    [bebeAtual, userId, executar],
  );

  const atualizar = useCallback<ValorRegistros['atualizar']>(
    (id, mudancas) => executar({ op: 'atualizar', id, mudancas }),
    [executar],
  );
  const excluir = useCallback((id: string) => executar({ op: 'excluir', id }), [executar]);

  const doBebe = useMemo(() => registros.filter((r) => r.bebe_id === bebeAtual?.id), [registros, bebeAtual]);

  const valor: ValorRegistros = {
    carregando: !!familiaId && carregadoPara !== familiaId,
    doBebe,
    pendentes: fila.length,
    criar,
    atualizar,
    excluir,
    iniciarPeito: (lado) => {
      const agora = agoraISO();
      criar({ tipo: 'mamada', inicio: agora, fim: null, detalhes: { lados: [{ lado, inicio: agora, fim: null }] } });
    },
    trocarLado: (r) => {
      const agora = agoraISO();
      const lados = r.detalhes.lados.map((s) => (s.fim ? s : { ...s, fim: agora }));
      const proximo: Lado = lados.at(-1)?.lado === 'E' ? 'D' : 'E';
      atualizar(r.id, { detalhes: { lados: [...lados, { lado: proximo, inicio: agora, fim: null }] } });
    },
    encerrar: (r) => {
      const agora = agoraISO();
      if (r.tipo === 'mamada') {
        const lados = r.detalhes.lados.map((s) => (s.fim ? s : { ...s, fim: agora }));
        atualizar(r.id, { fim: agora, detalhes: { lados } });
      } else {
        atualizar(r.id, { fim: agora });
      }
    },
    mamadeira: (ml, leite) => {
      const agora = agoraISO();
      salvarPref('leite_preferido', leite);
      return criar({ tipo: 'mamadeira', inicio: agora, fim: agora, detalhes: { ml, leite } });
    },
    iniciarSono: () => criar({ tipo: 'sono', inicio: agoraISO(), fim: null, detalhes: {} }),
    iniciarContracao: () => criar({ tipo: 'contracao', inicio: agoraISO(), fim: null, detalhes: {} }),
    fralda: (d) => {
      const agora = agoraISO();
      return criar({ tipo: 'fralda', inicio: agora, fim: agora, detalhes: d });
    },
  };

  return <RegistrosContext.Provider value={valor}>{children}</RegistrosContext.Provider>;
}

export function useRegistros() {
  const valor = useContext(RegistrosContext);
  if (!valor) throw new Error('useRegistros precisa estar dentro de RegistrosProvider');
  return valor;
}
