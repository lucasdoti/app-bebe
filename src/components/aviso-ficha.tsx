import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text, View } from 'react-native';

import { fontes } from '@/theme/cores';
import { useTema } from '@/theme/tema';

// Aviso forte quando um remédio ou alimento está na lista "a evitar" da ficha de saúde.
export function AvisoFicha({ texto }: { texto: string }) {
  const { cores } = useTema();
  return (
    <View
      accessibilityRole="alert"
      style={{
        flexDirection: 'row',
        gap: 10,
        alignItems: 'flex-start',
        borderRadius: 14,
        borderWidth: 2,
        borderColor: cores.perigo,
        padding: 12,
      }}>
      <MaterialCommunityIcons name="alert" size={22} color={cores.perigo} />
      <Text style={{ flex: 1, fontFamily: fontes.negrito, fontSize: 15, color: cores.perigo }}>{texto}</Text>
    </View>
  );
}
