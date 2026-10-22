import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';

import { DENTES, nomeDente, type Dente } from '@/lib/dentes';
import { fontes } from '@/theme/cores';
import { useTema } from '@/theme/tema';

const LARGURA = 320;
const ALTURA = 300;
const CX = LARGURA / 2;
const RX = 118;
const RY = 88;
// Boca aberta: arcada de cima e de baixo separadas, com as legendas no meio.
const CY_CIMA = 124;
const CY_BAIXO = 176;
// Ângulo de cada posição a partir do meio da boca (graus).
const ANGULO = [8, 24, 41, 59, 79];
// Largura e altura de cada tipo de dente: incisivos e canino menores, molares maiores.
const TAMANHO: [number, number][] = [
  [22, 28],
  [20, 26],
  [22, 28],
  [30, 30],
  [32, 32],
];

const rad = (g: number) => (g * Math.PI) / 180;

function posicaoDe(d: Dente) {
  const t = ANGULO[d.posicao - 1];
  // De frente para o bebê: o lado direito dele fica à esquerda da tela.
  const s = d.lado === 'dir' ? -1 : 1;
  const x = CX + s * RX * Math.sin(rad(t));
  const y = d.arcada === 'sup' ? CY_CIMA - RY * Math.cos(rad(t)) : CY_BAIXO + RY * Math.cos(rad(t));
  const giro = d.arcada === 'sup' ? s * t : -s * t;
  return { x, y, giro };
}

function arco(cy: number, cima: boolean) {
  const a = rad(86);
  const y = cima ? cy - RY * Math.cos(a) : cy + RY * Math.cos(a);
  return `M ${CX - RX * Math.sin(a)} ${y} A ${RX} ${RY} 0 0 ${cima ? 1 : 0} ${CX + RX * Math.sin(a)} ${y}`;
}

// Desenho da boca com os 20 dentes de leite. Nascidos preenchidos; o mais recente com um pontinho.
export function MapaDentes({
  nascidos,
  recente,
  selecionado,
  onEscolher,
}: {
  nascidos: Set<string>;
  recente: string | null;
  selecionado: string | null;
  onEscolher: (d: Dente) => void;
}) {
  const { cores } = useTema();
  return (
    <Svg width="100%" height={ALTURA} viewBox={`0 0 ${LARGURA} ${ALTURA}`} accessibilityLabel="Mapa dos dentes">
      {/* Gengivas */}
      <Path d={arco(CY_CIMA, true)} stroke={cores.mamada} strokeOpacity={0.35} strokeWidth={44} fill="none" />
      <Path d={arco(CY_BAIXO, false)} stroke={cores.mamada} strokeOpacity={0.35} strokeWidth={44} fill="none" />

      <SvgText x={CX} y={CY_CIMA - 26} fontSize={12} fontFamily={fontes.negrito} fill={cores.textoSuave} textAnchor="middle">
        em cima
      </SvgText>
      <SvgText x={CX} y={CY_BAIXO + 34} fontSize={12} fontFamily={fontes.negrito} fill={cores.textoSuave} textAnchor="middle">
        embaixo
      </SvgText>
      <SvgText x={4} y={(CY_CIMA + CY_BAIXO) / 2 + 4} fontSize={11} fontFamily={fontes.media} fill={cores.textoSuave}>
        direita do bebê
      </SvgText>
      <SvgText x={LARGURA - 4} y={(CY_CIMA + CY_BAIXO) / 2 + 4} fontSize={11} fontFamily={fontes.media} fill={cores.textoSuave} textAnchor="end">
        esquerda do bebê
      </SvgText>

      {DENTES.map((d) => {
        const { x, y, giro } = posicaoDe(d);
        const [w, h] = TAMANHO[d.posicao - 1];
        const nasceu = nascidos.has(d.codigo);
        const ativo = selecionado === d.codigo;
        return (
          <G key={d.codigo} onPress={() => onEscolher(d)} accessibilityLabel={nomeDente(d)}>
            <G transform={`translate(${x} ${y}) rotate(${giro})`}>
              {/* Área de toque maior que o dente. */}
              <Rect x={-22} y={-22} width={44} height={44} fill="transparent" />
              <Rect
                x={-w / 2}
                y={-h / 2}
                width={w}
                height={h}
                rx={d.posicao >= 4 ? 10 : 8}
                fill={nasceu ? cores.cartao : 'transparent'}
                stroke={ativo ? cores.texto : nasceu ? cores.medidasForte : cores.textoSuave}
                strokeWidth={ativo ? 3 : nasceu ? 2.5 : 1.5}
                strokeDasharray={nasceu || ativo ? undefined : '4 3'}
              />
              {nasceu && <Circle cx={0} cy={0} r={4} fill={cores.medidasForte} />}
            </G>
            {recente === d.codigo && <Circle cx={x} cy={d.arcada === 'sup' ? y - 22 : y + 22} r={4} fill={cores.primaria} />}
          </G>
        );
      })}
    </Svg>
  );
}
