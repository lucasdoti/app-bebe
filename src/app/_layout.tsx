import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/nunito';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { BebesProvider } from '@/context/bebes';
import { ClimaProvider } from '@/context/clima';
import { EnxovalProvider } from '@/context/enxoval';
import { GestacaoProvider } from '@/context/gestacao';
import { MedidasProvider } from '@/context/medidas';
import { PartoProvider } from '@/context/parto';
import { SaudeProvider } from '@/context/saude';
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
                            <SaudeProvider>
                              <Rotas />
                            </SaudeProvider>
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
  const { carregando, sessao, familia, trocandoSenha } = useSessao();
  const { cores, noite } = useTema();
  const pronto = fontesProntas && !carregando;

  useEffect(() => {
    if (pronto) SplashScreen.hide();
  }, [pronto]);

  // Veio pelo link de "esqueci minha senha": vai direto escolher a senha nova.
  useEffect(() => {
    if (pronto && trocandoSenha) router.replace('/nova-senha');
  }, [pronto, trocandoSenha]);

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
          <Stack.Screen name="sono" />
          <Stack.Screen name="historico" />
          <Stack.Screen name="gastos" />
          <Stack.Screen name="gasto/[id]" />
          <Stack.Screen name="saude/index" />
          <Stack.Screen name="saude/medico" />
          <Stack.Screen name="cha/index" />
        </Stack.Protected>
        <Stack.Protected guard={logado && !familia}>
          <Stack.Screen name="familia" />
        </Stack.Protected>
        <Stack.Protected guard={!logado}>
          <Stack.Screen name="entrar" />
        </Stack.Protected>
        <Stack.Screen name="convite/[codigo]" />
        {/* Página do convidado do chá de bebê: aberta a quem tiver o link, sem login. */}
        <Stack.Screen name="cha/[token]" />
        {/* Senha nova depois do link de recuperação (a pessoa já chega logada). */}
        <Stack.Screen name="nova-senha" />
      </Stack>
    </>
  );
}
