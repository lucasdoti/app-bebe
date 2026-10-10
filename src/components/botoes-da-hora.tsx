import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { abrirMapa, ligar, useParto } from '@/context/parto';
import { fontes, raio } from '@/theme/cores';
import { useTema } from '@/theme/tema';
import type { NomeIcone } from './home';
import { Botao, Texto } from './ui';

function Acao({ icone, titulo, detalhe, onPress }: { icone: NomeIcone; titulo: string; detalhe?: string; onPress: () => void }) {
  const { cores } = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        minHeight: 64,
        paddingHorizontal: 16,
        borderRadius: raio.botao,
        backgroundColor: cores.mamada,
        opacity: pressed ? 0.8 : 1,
      })}>
      <MaterialCommunityIcons name={icone} size={28} color={cores.textoNaPrimaria} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fontes.extra, fontSize: 18, color: cores.textoNaPrimaria }}>{titulo}</Text>
        {detalhe && (
          <Text numberOfLines={1} style={{ fontFamily: fontes.media, fontSize: 14, color: cores.textoNaPrimaria }}>
            {detalhe}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

// Ligar para a obstetra, para a maternidade e abrir a rota, com um toque cada.
export function BotoesDaHora() {
  const { contatos } = useParto();
  const obstetra = contatos.find((c) => c.papel === 'obstetra' && c.telefone);
  const maternidade = contatos.find((c) => c.papel === 'maternidade');

  if (!obstetra && !maternidade) {
    return (
      <View style={{ gap: 8 }}>
        <Texto variante="suave">Cadastre a obstetra e a maternidade para ligar e abrir a rota com um toque.</Texto>
        <Botao titulo="Cadastrar contatos" variante="secundario" onPress={() => router.push('/parto')} />
      </View>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      {obstetra && (
        <Acao icone="phone" titulo="Ligar para a obstetra" detalhe={obstetra.nome} onPress={() => ligar(obstetra.telefone!)} />
      )}
      {maternidade?.telefone && (
        <Acao
          icone="phone-in-talk"
          titulo="Ligar para a maternidade"
          detalhe={maternidade.nome}
          onPress={() => ligar(maternidade.telefone!)}
        />
      )}
      {maternidade?.endereco && (
        <Acao
          icone="car"
          titulo="Ir para a maternidade"
          detalhe={maternidade.endereco}
          onPress={() => abrirMapa(maternidade.endereco!)}
        />
      )}
    </View>
  );
}
