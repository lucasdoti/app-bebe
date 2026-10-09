import { useEffect, useState } from 'react';

// Relógio para "há 1h20" e cronômetros. Atualiza a cada `intervaloMs`.
export function useAgora(intervaloMs = 30_000) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    setAgora(Date.now());
    const id = setInterval(() => setAgora(Date.now()), intervaloMs);
    return () => clearInterval(id);
  }, [intervaloMs]);
  return agora;
}
