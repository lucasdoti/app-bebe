import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import type { NomeIcone } from '@/components/home';
import { Texto } from '@/components/ui';
import { descricao, observacaoDe, type Registro, type Tipo } from '@/lib/registros';
import { horaCurta } from '@/lib/tempo';
import { ALVO_TOQUE, fontes, type Paleta } from '@/theme/cores';
import { useTema } from '@/theme/tema';

export function corDoTipo(t: Tipo, cores: Paleta) {
  const mapa: Record<Tipo, string> = {
    mamada: cores.mamada,
    mamadeira: cores.mamada,
    refeicao: cores.mamada,
    agua: cores.clima,
    sono: cores.sono,
    fralda: cores.fralda,
    contracao: cores.mamada,
    movimentos: cores.sono,
    dose: cores.medidas,
    febre: cores.fralda,
  };
  return mapa[t];
}

export function iconeDoTipo(r: Registro): NomeIcone {
  if (r.tipo === 'refeicao') return 'food-apple-outline';
  if (r.tipo === 'agua') return 'cup-water';
  if (r.tipo === 'sono') return 'sleep';
  if (r.tipo === 'contracao') return 'timer-outline';
  if (r.tipo === 'movimentos') return 'gesture-tap';
  if (r.tipo === 'dose') return 'pill';
  if (r.tipo === 'febre') return 'thermometer';
  if (r.tipo === 'fralda') return r.detalhes.penico ? 'toilet' : 'human-baby-changing-table';
  return 'baby-bottle-outline';
}

// Uma linha da linha do tempo (home e histórico): hora, ícone, o que foi e quem registrou. Tocar abre a edição.
export function LinhaRegistro({ registro: x, agora, autor }: { registro: Registro; agora: number; autor: string }) {
  const { cores } = useTema();
  const d = descricao(x, agora);
  const obs = observacaoDe(x);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/registro/[id]', params: { id: x.id } })}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: ALVO_TOQUE,
        opacity: pressed ? 0.7 : 1,
      })}>
      <Text style={{ width: 48, fontFamily: fontes.negrito, fontSize: 15, color: cores.textoSuave }}>
        {horaCurta(x.inicio)}
      </Text>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: corDoTipo(x.tipo, cores),
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <MaterialCommunityIcons name={iconeDoTipo(x)} size={20} color={cores.textoNaPrimaria} />
      </View>
      <View style={{ flex: 1 }}>
        <Texto style={{ fontFamily: fontes.negrito }}>
          {d.titulo}
          {x.fim === null && x.tipo !== 'sono' ? ' (agora)' : ''}
        </Texto>
        <Texto variante="suave">{[d.detalhe, `por ${autor}`].filter(Boolean).join(' · ')}</Texto>
        {obs && (
          <Texto variante="suave" numberOfLines={2} style={{ fontStyle: 'italic' }}>
            “{obs}”
          </Texto>
        )}
      </View>
    </Pressable>
  );
}
