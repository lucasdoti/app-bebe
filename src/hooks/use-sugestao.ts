import { useBebes } from '@/context/bebes';
import { useClima } from '@/context/clima';
import { useRoupa } from '@/context/roupa';
import { previsao6h } from '@/lib/clima';
import { idadeEmDias } from '@/lib/crescimento';
import { hojeISO } from '@/lib/idade';
import { sugerir, type Contexto, type Transporte } from '@/lib/roupa';

// Sugestão de roupa para o bebê selecionado, com o clima atual e o ajuste pessoal dele.
export function useSugestao(contexto: Contexto, transporte: Transporte, tempQuarto: number | null) {
  const { bebeAtual } = useBebes();
  const { clima } = useClima();
  const roupa = useRoupa();
  if (!bebeAtual || !clima) return null;
  return sugerir({
    nome: bebeAtual.nome,
    contexto,
    transporte,
    sensacao: clima.atual.sensacao,
    tempQuarto,
    idadeDias: idadeEmDias(bebeAtual.nascimento, hojeISO()),
    ajuste: roupa.ajuste(bebeAtual.id, contexto),
    previsao: previsao6h(clima),
  });
}
