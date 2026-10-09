import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';

import type { Peca } from '@/lib/roupa';
import { nomePeca } from '@/lib/roupa';
import { useTema } from '@/theme/tema';

// Bebê ilustrado vestindo as peças sugeridas, uma por cima da outra.
export function Bonequinho({ pecas, tamanho = 150 }: { pecas: Peca[]; tamanho?: number }) {
  const { cores, noite } = useTema();
  const tem = (p: Peca) => pecas.includes(p);

  const pele = noite ? '#B39686' : '#F6D7C3';
  const contorno = cores.textoSuave;
  const corBody = noite ? '#C9CCE0' : '#FFFFFF';

  let torso = pele;
  let bracos = pele;
  let mangaCurta = false;
  let pernas = pele;
  let pes = pele;

  if (tem('body_curto')) {
    torso = corBody;
    mangaCurta = true;
  }
  if (tem('body_longo')) torso = bracos = corBody;
  if (tem('pijama')) torso = bracos = pernas = cores.mamada;
  if (tem('macacao')) torso = bracos = pernas = cores.sono;
  if (tem('meia')) pes = cores.fralda;
  const casaco = tem('casaco') || tem('casaco_grosso');
  const traco = { stroke: contorno, strokeWidth: 1.5 };

  return (
    <Svg
      width={tamanho}
      height={tamanho * 1.25}
      viewBox="0 0 120 150"
      accessibilityLabel={`Bebê vestindo ${pecas.map((p) => nomePeca[p].toLowerCase()).join(', ')}`}>
      {tem('manta') && <Rect x={8} y={70} width={104} height={74} rx={22} fill={cores.medidas} opacity={0.85} />}

      {/* Pernas e pés */}
      <Rect x={41} y={100} width={16} height={36} rx={8} fill={pernas} {...traco} />
      <Rect x={63} y={100} width={16} height={36} rx={8} fill={pernas} {...traco} />
      <Ellipse cx={48} cy={138} rx={10} ry={6} fill={pes} {...traco} />
      <Ellipse cx={72} cy={138} rx={10} ry={6} fill={pes} {...traco} />

      {/* Braços (manga curta pinta só o ombro) */}
      <Rect x={20} y={60} width={16} height={38} rx={8} fill={bracos} {...traco} />
      <Rect x={84} y={60} width={16} height={38} rx={8} fill={bracos} {...traco} />
      {mangaCurta && (
        <>
          <Rect x={20} y={60} width={16} height={14} rx={7} fill={corBody} {...traco} />
          <Rect x={84} y={60} width={16} height={14} rx={7} fill={corBody} {...traco} />
        </>
      )}

      {/* Tronco */}
      <Rect x={34} y={56} width={52} height={52} rx={18} fill={torso} {...traco} />

      {tem('saco') && (
        <Path d="M32 66 Q32 58 40 58 L80 58 Q88 58 88 66 L94 136 Q94 144 86 144 L34 144 Q26 144 26 136 Z" fill={cores.sono} {...traco} />
      )}

      {casaco && (
        <G>
          <Rect x={16} y={58} width={22} height={42} rx={10} fill={cores.clima} {...traco} />
          <Rect x={82} y={58} width={22} height={42} rx={10} fill={cores.clima} {...traco} />
          <Rect x={30} y={54} width={60} height={58} rx={20} fill={cores.clima} {...traco} />
          <Line x1={60} y1={58} x2={60} y2={110} stroke={contorno} strokeWidth={1.5} />
          {tem('casaco_grosso') && <Rect x={38} y={50} width={44} height={12} rx={6} fill={cores.clima} {...traco} />}
        </G>
      )}

      {/* Cabeça */}
      <Circle cx={60} cy={32} r={24} fill={pele} {...traco} />
      <Circle cx={51} cy={33} r={2.2} fill={cores.texto} />
      <Circle cx={69} cy={33} r={2.2} fill={cores.texto} />
      <Path d="M54 42 Q60 47 66 42" stroke={cores.texto} strokeWidth={1.8} fill="none" strokeLinecap="round" />
      <Circle cx={45} cy={40} r={3.5} fill={cores.mamada} opacity={0.7} />
      <Circle cx={75} cy={40} r={3.5} fill={cores.mamada} opacity={0.7} />

      {tem('gorro') && (
        <G>
          <Path d="M35 28 Q36 6 60 6 Q84 6 85 28 Z" fill={cores.mamada} {...traco} />
          <Rect x={33} y={24} width={54} height={8} rx={4} fill={cores.mamada} {...traco} />
          <Circle cx={60} cy={5} r={5} fill={cores.mamada} {...traco} />
        </G>
      )}
    </Svg>
  );
}
