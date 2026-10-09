import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import type { Sexo } from '@/context/bebes';
import {
  DIA_MAXIMO,
  PERCENTIS,
  percentil,
  percentilTexto,
  valorNoPercentil,
  type Indicador,
  type Ponto,
} from '@/lib/crescimento';
import { deISO } from '@/lib/idade';
import { fontes } from '@/theme/cores';
import { useTema } from '@/theme/tema';
import { Texto } from './ui';

const ALTURA = 260;
const MARGEM = { topo: 12, direita: 34, baixo: 28, esquerda: 40 };
const DIAS_MES = 30.4375;

export const unidade: Record<Indicador, string> = { peso: 'kg', altura: 'cm', cabeca: 'cm' };

export function formatar(valor: number, indicador: Indicador) {
  return `${valor.toFixed(indicador === 'peso' ? 2 : 1).replace('.', ',')} ${unidade[indicador]}`;
}

// Passo "redondo" para os rótulos do eixo.
function passoRedondo(intervalo: number, alvo: number) {
  const bruto = intervalo / alvo;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  return [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= bruto) ?? bruto;
}

// Curva de crescimento: faixas de percentil da OMS ao fundo e a linha do bebê por cima.
export function GraficoCrescimento({
  indicador,
  sexo,
  idadeAtualDias,
  pontos,
}: {
  indicador: Indicador;
  sexo: Sexo;
  idadeAtualDias: number;
  pontos: Ponto[];
}) {
  const { cores } = useTema();
  const [largura, setLargura] = useState(0);
  const [selecionado, setSelecionado] = useState<number | null>(null);

  const ultimoDia = Math.max(idadeAtualDias, ...pontos.map((p) => p.dias), 0);
  const xMax = Math.min(DIA_MAXIMO, Math.max(180, ultimoDia + 60));

  // Curvas de referência amostradas a cada 7 dias.
  const dias: number[] = [];
  for (let d = 0; d < xMax; d += 7) dias.push(d);
  dias.push(xMax);
  const curvas = PERCENTIS.map(({ z }) => dias.map((d) => valorNoPercentil(indicador, sexo, d, z)));

  const valores = [...curvas[0], ...curvas[4], ...pontos.map((p) => p.valor)];
  const passoY = passoRedondo(Math.max(...valores) - Math.min(...valores), 4);
  const yMin = Math.floor(Math.min(...valores) / passoY) * passoY;
  const yMax = Math.ceil(Math.max(...valores) / passoY) * passoY;

  const w = Math.max(largura - MARGEM.esquerda - MARGEM.direita, 1);
  const h = ALTURA - MARGEM.topo - MARGEM.baixo;
  const x = (d: number) => MARGEM.esquerda + (d / xMax) * w;
  const y = (v: number) => MARGEM.topo + (1 - (v - yMin) / (yMax - yMin)) * h;

  const linha = (vs: number[]) => vs.map((v, i) => `${i ? 'L' : 'M'}${x(dias[i]).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const faixa = (baixo: number[], alto: number[]) =>
    `${linha(alto)}${[...baixo].reverse().map((v, i) => `L${x(dias[dias.length - 1 - i]).toFixed(1)},${y(v).toFixed(1)}`).join('')}Z`;

  const meses = xMax / DIAS_MES;
  const passoMeses = meses <= 7 ? 1 : meses <= 14 ? 2 : meses <= 24 ? 3 : 6;
  const ticksX: number[] = [];
  for (let m = 0; m <= meses; m += passoMeses) ticksX.push(m);
  const ticksY: number[] = [];
  for (let v = yMin; v <= yMax + 1e-9; v += passoY) ticksY.push(v);

  const ordenados = [...pontos].sort((a, b) => a.dias - b.dias);
  const caminhoBebe = ordenados.map((p, i) => `${i ? 'L' : 'M'}${x(p.dias)},${y(p.valor)}`).join('');
  const sel = selecionado !== null ? ordenados[selecionado] : null;

  const estiloRotulo = { fontFamily: fontes.media, fontSize: 11, fill: cores.textoSuave };

  return (
    <View onLayout={(e) => setLargura(e.nativeEvent.layout.width)} style={{ gap: 8 }}>
      {largura > 0 && (
        <Svg width={largura} height={ALTURA} accessibilityLabel={`Gráfico de ${indicador} com as curvas da OMS`}>
          {ticksY.map((v) => (
            <G key={`y${v}`}>
              <Line x1={MARGEM.esquerda} x2={MARGEM.esquerda + w} y1={y(v)} y2={y(v)} stroke={cores.grade} strokeWidth={1} />
              <SvgText x={MARGEM.esquerda - 6} y={y(v) + 4} textAnchor="end" {...estiloRotulo}>
                {String(Number(v.toFixed(2))).replace('.', ',')}
              </SvgText>
            </G>
          ))}
          {ticksX.map((m) => (
            <SvgText key={`x${m}`} x={x(m * DIAS_MES)} y={ALTURA - 8} textAnchor="middle" {...estiloRotulo}>
              {m === 0 ? 'nasc.' : `${m}m`}
            </SvgText>
          ))}

          <Path d={faixa(curvas[0], curvas[4])} fill={cores.medidas} fillOpacity={0.25} />
          <Path d={faixa(curvas[1], curvas[3])} fill={cores.medidas} fillOpacity={0.45} />
          <Path d={linha(curvas[2])} stroke={cores.medidas} strokeWidth={1.5} fill="none" />
          {[0, 2, 4].map((i) => (
            <SvgText key={`p${i}`} x={MARGEM.esquerda + w + 4} y={y(curvas[i].at(-1)!) + 4} {...estiloRotulo}>
              {PERCENTIS[i].p}
            </SvgText>
          ))}

          {ordenados.length > 1 && (
            <Path d={caminhoBebe} stroke={cores.medidasForte} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          )}
          {ordenados.map((p, i) => (
            <G key={`${p.data}${i}`} onPress={() => setSelecionado(i === selecionado ? null : i)}>
              <Circle cx={x(p.dias)} cy={y(p.valor)} r={i === selecionado ? 7 : 5} fill={cores.medidasForte} stroke={cores.cartao} strokeWidth={2} />
              {/* Área de toque maior que o ponto. */}
              <Rect x={x(p.dias) - 18} y={y(p.valor) - 18} width={36} height={36} fill="transparent" />
            </G>
          ))}
        </Svg>
      )}
      {sel ? (
        <Texto>
          {deISO(sel.data)}: {formatar(sel.valor, indicador)} ·{' '}
          {percentilTexto(percentil(indicador, sexo, sel.dias, sel.valor))}
        </Texto>
      ) : (
        <Texto variante="suave">
          Faixa clara: percentis 3 a 97 da OMS. Faixa escura: 15 a 85. Linha do meio: percentil 50. Toque num ponto
          para ver o valor.
        </Texto>
      )}
    </View>
  );
}
