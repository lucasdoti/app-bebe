import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';
import { View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { NomeIcone } from '@/components/home';
import { DentroDeAba } from '@/components/ui';
import { nasceu, useBebes } from '@/context/bebes';
import { fontes } from '@/theme/cores';
import { useTema } from '@/theme/tema';

// Abas do app. Depois do nascimento: Início, Histórico, Bebê e Família.
// Na gestação: Início, Pré-natal, Preparar e Família. As abas da outra fase ficam escondidas (href: null).
export default function LayoutAbas() {
  const { cores } = useTema();
  const { bebeAtual } = useBebes();
  const insets = useSafeAreaInsets();
  const nascido = nasceu(bebeAtual);
  const gestacao = !!bebeAtual && !nascido;

  // Ícone da aba ativa dentro de uma pílula pastel.
  const icone =
    (nome: NomeIcone) =>
    ({ focused, color }: { focused: boolean; color: ColorValue }) => (
      <View
        style={{
          width: 56,
          height: 30,
          borderRadius: 15,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: focused ? cores.primaria : 'transparent',
        }}>
        <MaterialCommunityIcons name={nome} size={24} color={focused ? cores.textoNaPrimaria : color} />
      </View>
    );
  const so = (mostrar: boolean) => (mostrar ? {} : { href: null });

  return (
    <DentroDeAba.Provider value>
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: cores.fundo },
          tabBarActiveTintColor: cores.texto,
          tabBarInactiveTintColor: cores.textoSuave,
          tabBarStyle: {
            backgroundColor: cores.cartao,
            borderTopColor: cores.borda,
            height: 72 + insets.bottom,
            paddingTop: 6,
            paddingBottom: insets.bottom + 10,
          },
          tabBarItemStyle: { minHeight: 56 },
          tabBarLabelStyle: { fontFamily: fontes.negrito, fontSize: 12, marginTop: 2 },
          tabBarLabelPosition: 'below-icon',
        }}>
        <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: icone('home-heart') }} />
        <Tabs.Screen name="historico" options={{ title: 'Histórico', tabBarIcon: icone('calendar-month-outline'), ...so(nascido) }} />
        <Tabs.Screen name="cuidados" options={{ title: 'Bebê', tabBarIcon: icone('baby-face-outline'), ...so(nascido) }} />
        <Tabs.Screen name="pre-natal" options={{ title: 'Pré-natal', tabBarIcon: icone('stethoscope'), ...so(gestacao) }} />
        <Tabs.Screen name="preparar" options={{ title: 'Preparar', tabBarIcon: icone('hanger'), ...so(gestacao) }} />
        <Tabs.Screen name="ajustes" options={{ title: 'Família', tabBarIcon: icone('account-heart-outline') }} />
      </Tabs>
    </DentroDeAba.Provider>
  );
}
