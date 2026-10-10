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

import { BebesProvider } from '@/context/bebes';
import { ClimaProvider } from '@/context/clima';
import { EnxovalProvider } from '@/context/enxoval';
import { GestacaoProvider } from '@/context/gestacao';
import { MedidasProvider } from '@/context/medidas';
import { PartoProvider } from '@/context/parto';
import { RegistrosProvider } from '@/context/registros';
import { RemediosProvider } from '@/context/remedios';
import { registrarServiceWorker } from '@/lib/notificacoes';
import { RoupaProvider } from '@/context/roupa';
import { SessaoProvider, useSessao } from '@/context/sessao';
import { VacinasProvider } from '@/context/vacinas';
import { TemaProvider, useTema } from '@/theme/tema';

SplashScreen.preventAutoHideAsync();
// Web Push: o service worker precisa estar registrado para receber os lembretes.
registrarServiceWorker();

export default function RootLayout() {
  return (
    <TemaProvider>
      <SessaoProvider>
        <BebesProvider>
          <RegistrosProvider>
            <MedidasProvider>
              <ClimaProvider>
                <RoupaProvider>
                  <GestacaoProvider>
                    <RemediosProvider>
                      <EnxovalProvider>
                        <VacinasProvider>
                          <PartoProvider>
                            <Rotas />
                          </PartoProvider>
                        </VacinasProvider>
                      </EnxovalProvider>
                    </RemediosProvider>
                  </GestacaoProvider>
                </RoupaProvider>
              </ClimaProvider>
            </MedidasProvider>
          </RegistrosProvider>
        </BebesProvider>
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
          <Stack.Screen name="ajustes" />
          <Stack.Screen name="bebe/[id]" />
          <Stack.Screen name="registro/[id]" />
          <Stack.Screen name="medidas" />
          <Stack.Screen name="medida/[id]" />
          <Stack.Screen name="roupa" />
          <Stack.Screen name="pre-natal/index" />
          <Stack.Screen name="pre-natal/[id]" />
          <Stack.Screen name="contracoes" />
          <Stack.Screen name="mala" />
          <Stack.Screen name="movimentos" />
          <Stack.Screen name="nomes" />
          <Stack.Screen name="remedios" />
          <Stack.Screen name="remedio/[id]" />
          <Stack.Screen name="lembretes" />
          <Stack.Screen name="enxoval" />
          <Stack.Screen name="vacinas" />
          <Stack.Screen name="vacina/[codigo]" />
          <Stack.Screen name="parto" />
          <Stack.Screen name="contato/[id]" />
          <Stack.Screen name="plano-parto" />
          <Stack.Screen name="resumo" />
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
