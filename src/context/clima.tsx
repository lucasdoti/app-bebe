import * as Location from 'expo-location';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { buscarClima, type Cidade, type Clima, type Local } from '@/lib/clima';
import { lerPref, salvarPref } from '@/lib/storage';

type ValorClima = {
  local: Local | null;
  clima: Clima | null;
  carregando: boolean;
  erro: string | null;
  usarLocalizacao: () => Promise<void>;
  escolherCidade: (c: Cidade) => Promise<void>;
  atualizar: () => Promise<void>;
};

const ClimaContext = createContext<ValorClima | null>(null);

const VALIDADE_MS = 30 * 60_000;

function lerJSON<T>(chave: string): T | null {
  const texto = lerPref(chave);
  if (!texto) return null;
  try {
    return JSON.parse(texto) as T;
  } catch {
    return null;
  }
}

// Clima pela localização do celular (ou por uma cidade escolhida), guardado por 30 min.
export function ClimaProvider({ children }: { children: ReactNode }) {
  const [local, setLocal] = useState<Local | null>(() => lerJSON('clima_local'));
  const [clima, setClima] = useState<Clima | null>(() => lerJSON('clima_cache'));
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async (l: Local) => {
    setCarregando(true);
    setErro(null);
    try {
      const novo = await buscarClima(l);
      setClima(novo);
      salvarPref('clima_cache', JSON.stringify(novo));
    } catch {
      setErro('Sem conexão para buscar o clima. Mostrando o último disponível.');
    } finally {
      setCarregando(false);
    }
  }, []);

  const definirLocal = useCallback(
    async (l: Local) => {
      setLocal(l);
      salvarPref('clima_local', JSON.stringify(l));
      await carregar(l);
    },
    [carregar],
  );

  const posicaoAtual = useCallback(async () => {
    const recente = await Location.getLastKnownPositionAsync({ maxAge: 60 * 60_000 });
    const pos = recente ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
    return { lat: pos.coords.latitude, lon: pos.coords.longitude, nome: null };
  }, []);

  const usarLocalizacao = useCallback(async () => {
    setErro(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErro('Sem permissão de localização. Escolha a cidade pelo nome.');
        return;
      }
      setCarregando(true);
      await definirLocal(await posicaoAtual());
    } catch {
      setCarregando(false);
      setErro('Não deu para descobrir a localização. Escolha a cidade pelo nome.');
    }
  }, [definirLocal, posicaoAtual]);

  const escolherCidade = useCallback(
    (c: Cidade) => definirLocal({ lat: c.lat, lon: c.lon, nome: c.nome }),
    [definirLocal],
  );

  const atualizar = useCallback(async () => {
    if (local) await carregar(local);
  }, [local, carregar]);

  // Ao abrir: se a localização já foi permitida, acompanha onde a família está; senão usa o local salvo.
  useEffect(() => {
    let ativo = true;
    (async () => {
      const salvo = lerJSON<Local>('clima_local');
      if (!salvo) return;
      let l = salvo;
      if (salvo.nome === null) {
        try {
          const { status } = await Location.getForegroundPermissionsAsync();
          if (status === 'granted') l = await posicaoAtual();
        } catch {
          // Mantém o local salvo.
        }
      }
      const cache = lerJSON<Clima>('clima_cache');
      if (!ativo) return;
      if (l !== salvo) {
        setLocal(l);
        salvarPref('clima_local', JSON.stringify(l));
      }
      if (!cache || Date.now() - cache.obtidoEm > VALIDADE_MS || l !== salvo) carregar(l);
    })();
    const id = setInterval(() => {
      const l = lerJSON<Local>('clima_local');
      if (l) carregar(l);
    }, VALIDADE_MS);
    return () => {
      ativo = false;
      clearInterval(id);
    };
  }, [carregar, posicaoAtual]);

  return (
    <ClimaContext.Provider value={{ local, clima, carregando, erro, usarLocalizacao, escolherCidade, atualizar }}>
      {children}
    </ClimaContext.Provider>
  );
}

export function useClima() {
  const valor = useContext(ClimaContext);
  if (!valor) throw new Error('useClima precisa estar dentro de ClimaProvider');
  return valor;
}
