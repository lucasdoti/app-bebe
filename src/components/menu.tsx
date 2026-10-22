import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { Href } from 'expo-router';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import type { NomeIcone } from '@/components/home';
import { Cartao, Texto } from '@/components/ui';
import { ALVO_TOQUE, fontes } from '@/theme/cores';
import { useTema } from '@/theme/tema';

// Linha de menu das abas: ícone na cor do assunto, título, um detalhe vivo e a setinha.
export function ItemMenu({
  cor,
  icone,
  titulo,
  detalhe,
  href,
}: {
  cor: string;
  icone: NomeIcone;
  titulo: string;
  detalhe?: string;
  href: Href;
}) {
  const { cores } = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(href)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        minHeight: ALVO_TOQUE + 8,
        opacity: pressed ? 0.7 : 1,
      })}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: cor,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <MaterialCommunityIcons name={icone} size={24} color={cores.textoNaPrimaria} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Texto style={{ fontFamily: fontes.negrito }}>{titulo}</Texto>
        {!!detalhe && <Texto variante="suave">{detalhe}</Texto>}
      </View>
      <MaterialCommunityIcons name="chevron-right" size={24} color={cores.textoSuave} />
    </Pressable>
  );
}

export function GrupoMenu({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Cartao>
      <Texto variante="rotulo">{titulo}</Texto>
      {children}
    </Cartao>
  );
}
