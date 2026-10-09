import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { GraficoUltrassom } from '@/components/grafico-ultrassom';
import { dataHoraCurta } from '@/components/inicio-gestacao';
import { Botao, Cabecalho, Cartao, Tela, Texto } from '@/components/ui';
import { useBebes } from '@/context/bebes';
import { useGestacao, type PreNatal, type TipoPreNatal } from '@/context/gestacao';
import { idadeGestacionalNaData, pesoTexto } from '@/lib/gestacao';
import { hojeISO } from '@/lib/idade';
import { ALVO_TOQUE, fontes } from '@/theme/cores';
import { useTema } from '@/theme/tema';

const icones: Record<TipoPreNatal, 'stethoscope' | 'clipboard-text-outline' | 'heart-pulse'> = {
  consulta: 'stethoscope',
  exame: 'clipboard-text-outline',
  ultrassom: 'heart-pulse',
};

const abrir = (id: string, tipo?: TipoPreNatal) =>
  router.push({ pathname: '/pre-natal/[id]', params: tipo ? { id, tipo } : { id } });

function Item({ p, parto }: { p: PreNatal; parto: string | null }) {
  const { cores } = useTema();
  const cor = p.tipo === 'ultrassom' ? cores.sono : p.tipo === 'exame' ? cores.fralda : cores.clima;
  const ig = parto ? idadeGestacionalNaData(parto, hojeISO(new Date(p.data))) : null;
  const detalhes = [
    ig && ig.totalDias >= 0 && `${ig.semanas} sem e ${ig.dias} d`,
    p.peso_fetal_g && pesoTexto(p.peso_fetal_g),
    p.batimentos_bpm && `${p.batimentos_bpm} bpm`,
    p.local,
  ].filter(Boolean);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => abrir(p.id)}
      style={({ pressed }) => ({
        minHeight: ALVO_TOQUE,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        opacity: pressed ? 0.7 : 1,
      })}>
      <View
        style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: cor, alignItems: 'center', justifyContent: 'center' }}>
        <MaterialCommunityIcons name={icones[p.tipo]} size={22} color={cores.textoNaPrimaria} />
      </View>
      <View style={{ flex: 1 }}>
        <Texto style={{ fontFamily: fontes.negrito }}>{p.titulo}</Texto>
        <Texto variante="suave">{[dataHoraCurta(p.data), ...detalhes].join(' · ')}</Texto>
      </View>
    </Pressable>
  );
}

// Pré-natal: próximas consultas e exames, histórico e evolução do peso nos ultrassons.
export default function PreNatalLista() {
  const { bebeAtual } = useBebes();
  const { preNatal } = useGestacao();
  if (!bebeAtual) return null;

  const agora = Date.now() - 60 * 60_000;
  const proximos = preNatal.filter((p) => new Date(p.data).getTime() >= agora);
  const anteriores = preNatal.filter((p) => new Date(p.data).getTime() < agora).reverse();
  const comPeso = preNatal.filter((p) => p.tipo === 'ultrassom' && p.peso_fetal_g && new Date(p.data).getTime() < Date.now());

  return (
    <Tela>
      <Cabecalho titulo="Pré-natal" />

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['consulta', 'exame', 'ultrassom'] as TipoPreNatal[]).map((t) => (
          <View key={t} style={{ flex: 1 }}>
            <Botao
              titulo={{ consulta: '+ Consulta', exame: '+ Exame', ultrassom: '+ Ultrassom' }[t]}
              variante="secundario"
              onPress={() => abrir('novo', t)}
            />
          </View>
        ))}
      </View>

      <Cartao>
        <Texto variante="subtitulo">Próximos</Texto>
        {proximos.length === 0 && <Texto variante="suave">Nenhuma consulta ou exame agendado.</Texto>}
        {proximos.map((p) => (
          <Item key={p.id} p={p} parto={bebeAtual.parto_previsto} />
        ))}
      </Cartao>

      {bebeAtual.parto_previsto && comPeso.length > 0 && (
        <Cartao>
          <Texto variante="subtitulo">Peso estimado nos ultrassons</Texto>
          <GraficoUltrassom ultrassons={comPeso} parto={bebeAtual.parto_previsto} />
        </Cartao>
      )}

      <Cartao>
        <Texto variante="subtitulo">Histórico</Texto>
        {anteriores.length === 0 && <Texto variante="suave">As consultas, exames e ultrassons realizados aparecem aqui.</Texto>}
        {anteriores.map((p) => (
          <Item key={p.id} p={p} parto={bebeAtual.parto_previsto} />
        ))}
      </Cartao>
    </Tela>
  );
}
