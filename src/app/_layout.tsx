import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/nunito';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { SessaoProvider, useSessao } from '@/context/sessao';
import { TemaProvider, useTema } from '@/theme/tema';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <TemaProvider>
      <SessaoProvider>
        <Rotas />
      </SessaoProvider>
    </TemaProvider>
  );
}

function Rotas() {
  const [fontesProntas] = useFonts({ Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold });
  const { carregando, sessao, familia } = useSessao();
  const { cores, noite } = useTema();
  const pronto = fontesProntas && !carregando;

  useEffect(() => {
    if (pronto) SplashScreen.hide();
  }, [pronto]);

  if (!pronto) return null;

  const logado = !!sessao;
  return (
    <>
      <StatusBar style={noite ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: cores.fundo } }}>
        <Stack.Protected guard={logado && !!familia}>
          <Stack.Screen name="index" />
        </Stack.Protected>
        <Stack.Protected guard={logado && !familia}>
          <Stack.Screen name="familia" />
        </Stack.Protected>
        <Stack.Protected guard={!logado}>
          <Stack.Screen name="entrar" />
        </Stack.Protected>
        <Stack.Screen name="convite/[codigo]" />
      </Stack>
    </>
  );
}
