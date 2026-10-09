import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { raio } from '@/theme/cores';
import { useTema } from '@/theme/tema';
import { Texto } from './ui';

// Painel que sobe do rodapé, perto do polegar, para registrar com um toque.
export function Folha({
  aberta,
  titulo,
  onFechar,
  children,
}: {
  aberta: boolean;
  titulo: string;
  onFechar: () => void;
  children: ReactNode;
}) {
  const { cores } = useTema();
  const margem = useSafeAreaInsets();
  return (
    <Modal visible={aberta} transparent animationType="slide" onRequestClose={onFechar}>
      <Pressable accessibilityLabel="Fechar" style={estilos.fundo} onPress={onFechar} />
      <View
        style={[
          estilos.folha,
          { backgroundColor: cores.fundo, borderColor: cores.borda, paddingBottom: 20 + margem.bottom },
        ]}>
        <View style={[estilos.alca, { backgroundColor: cores.borda }]} />
        <Texto variante="subtitulo">{titulo}</Texto>
        <ScrollView contentContainerStyle={{ gap: 14 }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  folha: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    maxHeight: '85%',
    borderTopLeftRadius: raio.cartao,
    borderTopRightRadius: raio.cartao,
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },
  alca: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center' },
});
