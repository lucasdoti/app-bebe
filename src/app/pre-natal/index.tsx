import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { GraficoLinha } from '@/components/grafico-linha';
import { GraficoUltrassom } from '@/components/grafico-ultrassom';
import { dataHoraCurta } from '@/components/inicio-gestacao';
import { Botao, Cabecalho, Cartao, Tela, Texto } from '@/components/ui';
import { useBebes } from '@/context/bebes';
import { useGestacao, type PreNatal, type TipoPreNatal } from '@/context/gestacao';
import { idadeGestacionalNaData, pesoTexto } from '@/lib/gestacao';
import { deISO, hojeISO } from '@/lib/idade';
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

      {bebeAtual.parto_previsto && <SaudeDaMae consultas={preNatal} parto={bebeAtual.parto_previsto} />}

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

const kg = (v: number) => `${String(Math.round(v * 10) / 10).replace('.', ',')} kg`;
// Pressão como se fala no consultório: 120/80 vira "12 por 8".
const pressao = (s: number, d: number) =>
  `${String(s / 10).replace('.', ',')} por ${String(d / 10).replace('.', ',')}`;

// Peso e pressão da mãe anotados nas consultas.
function SaudeDaMae({ consultas, parto }: { consultas: PreNatal[]; parto: string }) {
  const { cores } = useTema();
  const comPeso = consultas.filter((c) => c.peso_mae_kg !== null);
  const comPressao = consultas.filter((c) => c.pressao_sistolica !== null && c.pressao_diastolica !== null);
  if (!comPeso.length && !comPressao.length) return null;

  const semana = (c: PreNatal) => idadeGestacionalNaData(parto, hojeISO(new Date(c.data))).totalDias / 7;
  const ultimaPressao = comPressao.at(-1);
  const alta = comPressao.some((c) => c.pressao_sistolica! >= 140 || c.pressao_diastolica! >= 90);
  const ganho = comPeso.length > 1 ? comPeso.at(-1)!.peso_mae_kg! - comPeso[0].peso_mae_kg! : null;

  return (
    <Cartao>
      <Texto variante="subtitulo">Saúde da mãe</Texto>
      {comPeso.length > 0 && (
        <Texto>
          Peso: {kg(comPeso.at(-1)!.peso_mae_kg!)}
          {ganho !== null
            ? ` · ${ganho >= 0 ? '+' : ''}${kg(ganho)} desde ${deISO(hojeISO(new Date(comPeso[0].data)))}`
            : ''}
        </Texto>
      )}
      {comPeso.length > 1 && (
        <GraficoLinha
          pontos={comPeso.map((c) => ({
            x: semana(c),
            y: c.peso_mae_kg!,
            descricao: `${deISO(hojeISO(new Date(c.data)))}: ${kg(c.peso_mae_kg!)}`,
          }))}
          rotuloX={(v) => `${Math.round(v)} sem`}
          rotuloY={(v) => `${Math.round(v)}`}
          legenda="Peso da mãe (kg) por semana de gestação."
        />
      )}
      {ultimaPressao && (
        <Texto>
          Última pressão: {pressao(ultimaPressao.pressao_sistolica!, ultimaPressao.pressao_diastolica!)} em{' '}
          {deISO(hojeISO(new Date(ultimaPressao.data)))}
        </Texto>
      )}
      {comPressao.length > 1 && (
        <Texto variante="suave">
          {comPressao.map((c) => pressao(c.pressao_sistolica!, c.pressao_diastolica!)).join(' · ')}
        </Texto>
      )}
      {alta && (
        <View style={{ backgroundColor: cores.fralda, borderRadius: 14, padding: 12 }}>
          <Texto style={{ color: cores.textoNaPrimaria }}>
            Alguma medida chegou a 14 por 9 ou mais. Na gestação isso merece atenção: confira com a obstetra.
          </Texto>
        </View>
      )}
    </Cartao>
  );
}
