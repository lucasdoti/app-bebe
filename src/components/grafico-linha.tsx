import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { fontes } from '@/theme/cores';
import { useTema } from '@/theme/tema';
import { Texto } from './ui';

export type PontoLinha = { x: number; y: number; descricao: string };

const ALTURA = 200;
const M = { topo: 12, direita: 16, baixo: 26, esquerda: 44 };

function passoRedondo(intervalo: number, alvo: number) {
  const bruto = Math.max(intervalo, 1e-6) / alvo;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  return [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= bruto) ?? bruto;
}

// Uma série só, sem curva de referência: a evolução de um valor ao longo das semanas.
export function GraficoLinha({
  pontos,
  rotuloX,
  rotuloY,
  legenda,
}: {
  pontos: PontoLinha[];
  rotuloX: (x: number) => string;
  rotuloY: (y: number) => string;
  legenda: string;
}) {
  const { cores } = useTema();
  const [largura, setLargura] = useState(0);
  const [sel, setSel] = useState<number | null>(null);

  const xs = pontos.map((p) => p.x);
  const ys = pontos.map((p) => p.y);
  const xMin = Math.min(...xs) - 1;
  const xMax = Math.max(...xs, xMin + 4) + 1;
  const passoY = passoRedondo(Math.max(...ys) - Math.min(...ys) || 4, 4);
  const yMin = Math.floor(Math.min(...ys) / passoY) * passoY - passoY;
  const yMax = Math.ceil(Math.max(...ys) / passoY) * passoY + passoY;

  const w = Math.max(largura - M.esquerda - M.direita, 1);
  const h = ALTURA - M.topo - M.baixo;
  const x = (v: number) => M.esquerda + ((v - xMin) / (xMax - xMin)) * w;
  const y = (v: number) => M.topo + (1 - (v - yMin) / (yMax - yMin)) * h;
  const rotulo = { fontFamily: fontes.media, fontSize: 11, fill: cores.textoSuave };

  const ticksY: number[] = [];
  for (let v = yMin; v <= yMax + 1e-9; v += passoY) ticksY.push(v);
  const passoX = xMax - xMin > 24 ? 8 : 4;
  const ticksX: number[] = [];
  for (let v = Math.ceil(xMin / passoX) * passoX; v <= xMax; v += passoX) ticksX.push(v);

  return (
    <View onLayout={(e) => setLargura(e.nativeEvent.layout.width)} style={{ gap: 8 }}>
      {largura > 0 && (
        <Svg width={largura} height={ALTURA} accessibilityLabel={legenda}>
          {ticksY.map((v) => (
            <G key={`y${v}`}>
              <Line x1={M.esquerda} x2={M.esquerda + w} y1={y(v)} y2={y(v)} stroke={cores.grade} strokeWidth={1} />
              <SvgText x={M.esquerda - 6} y={y(v) + 4} textAnchor="end" {...rotulo}>
                {rotuloY(v)}
              </SvgText>
            </G>
          ))}
          {ticksX.map((v) => (
            <SvgText key={`x${v}`} x={x(v)} y={ALTURA - 8} textAnchor="middle" {...rotulo}>
              {rotuloX(v)}
            </SvgText>
          ))}
          {pontos.length > 1 && (
            <Path
              d={pontos.map((p, i) => `${i ? 'L' : 'M'}${x(p.x)},${y(p.y)}`).join('')}
              stroke={cores.medidasForte}
              strokeWidth={2}
              fill="none"
              strokeLinejoin="round"
            />
          )}
          {pontos.map((p, i) => (
            <G key={i} onPress={() => setSel(i === sel ? null : i)}>
              <Circle cx={x(p.x)} cy={y(p.y)} r={i === sel ? 7 : 5} fill={cores.medidasForte} stroke={cores.cartao} strokeWidth={2} />
              <Rect x={x(p.x) - 18} y={y(p.y) - 18} width={36} height={36} fill="transparent" />
            </G>
          ))}
        </Svg>
      )}
      <Texto variante={sel !== null ? 'corpo' : 'suave'}>
        {sel !== null ? pontos[sel].descricao : `${legenda} Toque num ponto para ver o valor.`}
      </Texto>
    </View>
  );
}
