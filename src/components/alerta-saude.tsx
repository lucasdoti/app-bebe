import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { useSaude } from '@/context/saude';
import { fontes, raio } from '@/theme/cores';
import { useTema } from '@/theme/tema';

// Faixa na home quando a ficha de saúde tem algo que cuidadores e médicos precisam saber.
export function AlertaSaude() {
  const { temAlerta, condicoes, remediosEvitar, alimentosEvitar, alergias } = useSaude();
  const { cores } = useTema();
  if (!temAlerta) return null;

  const ativas = condicoes.filter((c) => c.status !== 'descartado').map((c) => c.nome);
  const partes = [
    remediosEvitar.length && `${remediosEvitar.length} ${remediosEvitar.length === 1 ? 'remédio' : 'remédios'} a evitar`,
    alimentosEvitar.length && `${alimentosEvitar.length} ${alimentosEvitar.length === 1 ? 'alimento' : 'alimentos'}`,
    alergias.length && `${alergias.length} ${alergias.length === 1 ? 'alergia' : 'alergias'}`,
  ].filter(Boolean);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Abrir a ficha de saúde"
      onPress={() => router.push('/saude')}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 56,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: raio.botao,
        backgroundColor: cores.aviso,
        borderWidth: 1,
        borderColor: cores.fralda,
        opacity: pressed ? 0.8 : 1,
      })}>
      <MaterialCommunityIcons name="alert-circle-outline" size={24} color={cores.textoNaPrimaria} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fontes.extra, fontSize: 16, color: cores.textoNaPrimaria }}>
          {ativas.length ? ativas.join(', ') : 'Ficha de saúde'}
        </Text>
        <Text style={{ fontFamily: fontes.media, fontSize: 14, color: cores.textoNaPrimaria }}>
          {partes.length ? `${partes.join(' · ')} · ver lista` : 'Ver o que evitar'}
        </Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={24} color={cores.textoNaPrimaria} />
    </Pressable>
  );
}
