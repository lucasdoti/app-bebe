import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { lerPref, salvarPref } from '@/lib/storage';
import { paletaDia, paletaNoite, type Paleta } from './cores';

export type ModoTema = 'auto' | 'dia' | 'noite';

type ValorTema = {
  cores: Paleta;
  noite: boolean;
  modo: ModoTema;
  setModo: (modo: ModoTema) => void;
};

const TemaContext = createContext<ValorTema | null>(null);

// Modo noite automático entre 20h e 6h.
function ehHorarioDeNoite(agora = new Date()) {
  const h = agora.getHours();
  return h >= 20 || h < 6;
}

export function TemaProvider({ children }: { children: ReactNode }) {
  const [modo, setModoState] = useState<ModoTema>(() => (lerPref('modo_tema') as ModoTema) || 'auto');
  const [horarioNoite, setHorarioNoite] = useState(ehHorarioDeNoite);

  useEffect(() => {
    const id = setInterval(() => setHorarioNoite(ehHorarioDeNoite()), 60_000);
    return () => clearInterval(id);
  }, []);

  const noite = modo === 'noite' || (modo === 'auto' && horarioNoite);

  function setModo(novo: ModoTema) {
    setModoState(novo);
    salvarPref('modo_tema', novo);
  }

  return (
    <TemaContext.Provider value={{ cores: noite ? paletaNoite : paletaDia, noite, modo, setModo }}>
      {children}
    </TemaContext.Provider>
  );
}

export function useTema() {
  const valor = useContext(TemaContext);
  if (!valor) throw new Error('useTema precisa estar dentro de TemaProvider');
  return valor;
}
