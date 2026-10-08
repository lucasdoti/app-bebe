import { Redirect, useLocalSearchParams } from 'expo-router';

import { useSessao } from '@/context/sessao';
import { guardarConvite } from '@/lib/convite';

// Link de convite: guarda o código e segue para o login ou para a tela da família.
export default function Convite() {
  const { codigo } = useLocalSearchParams<{ codigo: string }>();
  const { sessao, familia } = useSessao();
  if (codigo) guardarConvite(codigo);
  return <Redirect href={!sessao ? '/entrar' : familia ? '/' : '/familia'} />;
}
