import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import type { PreNatal } from '@/context/gestacao';
import { idadeGestacionalNaData, pesoMedioNaSemana, pesoTexto } from '@/lib/gestacao';
import { deISO, hojeISO } from '@/lib/idade';
import { fontes } from '@/theme/cores';
import { useTema } from '@/theme/tema';
import { Texto } from './ui';

const ALTURA = 220;
const M = { topo: 12, direita: 40, baixo: 26, esquerda: 44 };

// Peso fetal estimado em cada ultrassom, sobre a linha de peso médio aproximado por semana.
export function GraficoUltrassom({ ultrassons, parto }: { ultrassons: PreNatal[]; parto: string }) {
  const { cores } = useTema();
  const [largura, setLargura] = useState(0);
  const [sel, setSel] = useState<number | null>(null);

  const pontos = ultrassons.map((u) => {
    const ig = idadeGestacionalNaData(parto, hojeISO(new Date(u.data)));
    return { semanas: ig.totalDias / 7, peso: u.peso_fetal_g!, data: hojeISO(new Date(u.data)), ig };
  });
  const xMin = Math.max(8, Math.floor(Math.min(...pontos.map((p) => p.semanas)) / 4) * 4);
  const xMax = Math.min(42, Math.max(xMin + 8, Math.ceil(Math.max(...pontos.map((p) => p.semanas)) + 4)));
  const semanas: number[] = [];
  for (let s = xMin; s <= Math.min(xMax, 40); s++) semanas.push(s);
  const media = semanas.map((s) => pesoMedioNaSemana(s) ?? 0);

  const yMaxBruto = Math.max(...media, ...pontos.map((p) => p.peso));
  const passoY = yMaxBruto > 2000 ? 1000 : yMaxBruto > 800 ? 500 : yMaxBruto > 200 ? 100 : 50;
  const yMax = Math.ceil(yMaxBruto / passoY) * passoY;

  const w = Math.max(largura - M.esquerda - M.direita, 1);
  const h = ALTURA - M.topo - M.baixo;
  const x = (s: number) => M.esquerda + ((s - xMin) / (xMax - xMin)) * w;
  const y = (g: number) => M.topo + (1 - g / yMax) * h;

  const rotulo = { fontFamily: fontes.media, fontSize: 11, fill: cores.textoSuave };
  const ticksY: number[] = [];
  for (let v = 0; v <= yMax; v += passoY) ticksY.push(v);
  const ticksX: number[] = [];
  for (let s = Math.ceil(xMin / 4) * 4; s <= xMax; s += 4) ticksX.push(s);

  const atual = sel !== null ? pontos[sel] : null;

  return (
    <View onLayout={(e) => setLargura(e.nativeEvent.layout.width)} style={{ gap: 8 }}>
      {largura > 0 && (
        <Svg width={largura} height={ALTURA} accessibilityLabel="Gráfico do peso fetal estimado por semana">
          {ticksY.map((v) => (
            <G key={`y${v}`}>
              <Line x1={M.esquerda} x2={M.esquerda + w} y1={y(v)} y2={y(v)} stroke={cores.grade} strokeWidth={1} />
              <SvgText x={M.esquerda - 6} y={y(v) + 4} textAnchor="end" {...rotulo}>
                {v >= 1000 ? `${v / 1000} kg` : `${v} g`}
              </SvgText>
            </G>
          ))}
          {ticksX.map((s) => (
            <SvgText key={`x${s}`} x={x(s)} y={ALTURA - 8} textAnchor="middle" {...rotulo}>
              {`${s} sem`}
            </SvgText>
          ))}
          <Path
            d={semanas.map((s, i) => `${i ? 'L' : 'M'}${x(s).toFixed(1)},${y(media[i]).toFixed(1)}`).join('')}
            stroke={cores.medidas}
            strokeWidth={2}
            fill="none"
          />
          <SvgText x={x(semanas.at(-1)!) + 4} y={y(media.at(-1)!) + 4} {...rotulo}>
            média
          </SvgText>
          {pontos.length > 1 && (
            <Path
              d={pontos.map((p, i) => `${i ? 'L' : 'M'}${x(p.semanas)},${y(p.peso)}`).join('')}
              stroke={cores.medidasForte}
              strokeWidth={2}
              fill="none"
              strokeLinejoin="round"
            />
          )}
          {pontos.map((p, i) => (
            <G key={p.data + i} onPress={() => setSel(i === sel ? null : i)}>
              <Circle cx={x(p.semanas)} cy={y(p.peso)} r={i === sel ? 7 : 5} fill={cores.medidasForte} stroke={cores.cartao} strokeWidth={2} />
              <Rect x={x(p.semanas) - 18} y={y(p.peso) - 18} width={36} height={36} fill="transparent" />
            </G>
          ))}
        </Svg>
      )}
      <Texto variante={atual ? 'corpo' : 'suave'}>
        {atual
          ? `${deISO(atual.data)} (${atual.ig.semanas} sem e ${atual.ig.dias} d): ${pesoTexto(atual.peso)}`
          : 'Linha clara: peso médio aproximado por semana, só como referência. O percentil vem do laudo. Toque num ponto para ver o valor.'}
      </Texto>
    </View>
  );
}
