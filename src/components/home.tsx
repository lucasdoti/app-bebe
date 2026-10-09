import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Bebe } from '@/context/bebes';
import { ALVO_TOQUE, fontes, raio } from '@/theme/cores';
import { useTema } from '@/theme/tema';
import { Texto } from './ui';

export type NomeIcone = ComponentProps<typeof MaterialCommunityIcons>['name'];

// Cartão da home: ícone na cor do tipo de registro, valor grande e um detalhe.
export function CartaoResumo({
  cor,
  icone,
  titulo,
  valor,
  detalhe,
}: {
  cor: string;
  icone: NomeIcone;
  titulo: string;
  valor: string;
  detalhe?: string;
}) {
  const { cores } = useTema();
  return (
    <View style={[estilos.cartao, { backgroundColor: cores.cartao, borderColor: cores.borda }]}>
      <View style={[estilos.bolinha, { backgroundColor: cor }]}>
        <MaterialCommunityIcons name={icone} size={26} color={cores.textoNaPrimaria} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Texto variante="rotulo">{titulo}</Texto>
        <Text style={{ fontFamily: fontes.extra, fontSize: 22, lineHeight: 28, color: cores.texto }}>{valor}</Text>
        {detalhe && <Texto variante="suave">{detalhe}</Texto>}
      </View>
    </View>
  );
}

// Botão grande de registro rápido do rodapé.
export function BotaoRegistro({
  cor,
  icone,
  titulo,
  onPress,
}: {
  cor: string;
  icone: NomeIcone;
  titulo: string;
  onPress: () => void;
}) {
  const { cores } = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Registrar ${titulo.toLowerCase()}`}
      onPress={onPress}
      style={({ pressed }) => [estilos.registro, { backgroundColor: cor, opacity: pressed ? 0.8 : 1 }]}>
      <MaterialCommunityIcons name={icone} size={28} color={cores.textoNaPrimaria} />
      <Text style={{ fontFamily: fontes.negrito, fontSize: 15, color: cores.textoNaPrimaria }}>{titulo}</Text>
    </Pressable>
  );
}

// Troca de bebê no topo da tela (só aparece com mais de um).
export function SeletorBebe({
  bebes,
  atual,
  onEscolher,
}: {
  bebes: Bebe[];
  atual: Bebe | null;
  onEscolher: (id: string) => void;
}) {
  const { cores } = useTema();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {bebes.map((b) => {
        const ativo = b.id === atual?.id;
        return (
          <Pressable
            key={b.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: ativo }}
            onPress={() => onEscolher(b.id)}
            style={[
              estilos.chip,
              {
                backgroundColor: ativo ? cores.primaria : cores.cartao,
                borderColor: ativo ? cores.primaria : cores.borda,
              },
            ]}>
            <Text
              style={{
                fontFamily: fontes.negrito,
                fontSize: 16,
                color: ativo ? cores.textoNaPrimaria : cores.texto,
              }}>
              {b.nome}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  cartao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: raio.cartao,
    borderWidth: 1,
    padding: 18,
  },
  bolinha: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  registro: {
    flex: 1,
    minHeight: 76,
    borderRadius: raio.botao,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  chip: {
    minHeight: ALVO_TOQUE,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
