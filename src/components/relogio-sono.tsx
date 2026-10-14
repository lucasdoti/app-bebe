import { useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';

import type { Faixa, Trecho } from '@/lib/sono';
import { fontes } from '@/theme/cores';
import { useTema } from '@/theme/tema';

const MAX = 340;
const MIN_DIA = 1440;

// Ângulo no relógio de 24h: 00h no topo, girando no sentido horário.
function ponto(cx: number, cy: number, r: number, minuto: number) {
  const a = (minuto / MIN_DIA) * 2 * Math.PI - Math.PI / 2;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arco(cx: number, cy: number, r: number, de: number, ate: number) {
  const fim = Math.min(ate, de + MIN_DIA - 0.01);
  const a = ponto(cx, cy, r, de);
  const b = ponto(cx, cy, r, fim);
  const grande = fim - de > MIN_DIA / 2 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${grande} 1 ${b.x} ${b.y}`;
}

// Relógio de 24h: sonos em arcos lilás, mamadas em pontos rosa no anel de fora,
// a próxima soneca sugerida mais clara e o ponteiro do "agora".
export function RelogioSono({
  inicioDia,
  sonos,
  mamadas,
  sugestao,
  agora,
  children,
}: {
  inicioDia: number;
  sonos: Trecho[];
  mamadas: number[];
  sugestao?: Faixa | null;
  /** Só no dia de hoje. */
  agora?: number | null;
  /** O que aparece no centro do relógio. */
  children?: ReactNode;
}) {
  const { cores } = useTema();
  const [largura, setLargura] = useState(0);
  const lado = Math.min(largura, MAX);
  const c = lado / 2;
  const espessura = lado * 0.075;
  const r = c - espessura * 1.9;
  const rMamada = c - espessura * 0.55;
  const min = (t: number) => (t - inicioDia) / 60_000;

  return (
    <View onLayout={(e) => setLargura(e.nativeEvent.layout.width)} style={{ alignItems: 'center' }}>
      {lado > 0 && (
        <View style={{ width: lado, height: lado }}>
          <Svg width={lado} height={lado}>
            {/* Trilha do dia e marcas das horas */}
            <Circle cx={c} cy={c} r={r} stroke={cores.grade} strokeWidth={espessura} fill="none" />
            {Array.from({ length: 24 }, (_, h) => {
              const a = ponto(c, c, r - espessura / 2 - 4, h * 60);
              const b = ponto(c, c, r - espessura / 2 - (h % 6 ? 8 : 12), h * 60);
              return (
                <Line key={h} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={cores.textoSuave} strokeWidth={h % 6 ? 1 : 2} opacity={0.6} />
              );
            })}
            {[0, 6, 12, 18].map((h) => {
              const p = ponto(c, c, r - espessura / 2 - 26, h * 60);
              return (
                <SvgText
                  key={h}
                  x={p.x}
                  y={p.y + 5}
                  fill={cores.textoSuave}
                  fontSize={13}
                  fontFamily={fontes.negrito}
                  textAnchor="middle">
                  {`${String(h).padStart(2, '0')}h`}
                </SvgText>
              );
            })}

            {/* Sugestão: um sono "fantasma", mais claro que os registrados */}
            {sugestao && (
              <Path
                d={arco(c, c, r, min(sugestao.ini), min(sugestao.fim))}
                stroke={cores.sono}
                strokeWidth={espessura}
                strokeLinecap="round"
                fill="none"
                opacity={0.45}
              />
            )}

            {sonos.map((s) => (
              <Path
                key={s.id}
                d={arco(c, c, r, min(s.ini), Math.max(min(s.fim), min(s.ini) + 3))}
                stroke={cores.sono}
                strokeWidth={espessura}
                strokeLinecap="round"
                fill="none"
              />
            ))}

            {mamadas.map((t, i) => {
              const p = ponto(c, c, rMamada, min(t));
              return <Circle key={i} cx={p.x} cy={p.y} r={espessura * 0.32} fill={cores.mamada} />;
            })}

            {agora != null && (
              <G>
                {(() => {
                  const a = ponto(c, c, r - espessura / 2 - 2, min(agora));
                  const b = ponto(c, c, r + espessura / 2 + 2, min(agora));
                  return <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={cores.texto} strokeWidth={3} strokeLinecap="round" />;
                })()}
              </G>
            )}
          </Svg>
          <View
            style={{
              pointerEvents: 'none',
              position: 'absolute',
              top: c - r * 0.62,
              left: c - r * 0.72,
              width: r * 1.44,
              height: r * 1.24,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
            }}>
            {children}
          </View>
        </View>
      )}
    </View>
  );
}

// Legenda curta embaixo do relógio.
export function LegendaRelogio({ comSugestao }: { comSugestao: boolean }) {
  const { cores } = useTema();
  const item = (cor: string, texto: string, clara?: boolean) => (
    <View key={texto} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View
        style={{
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: cor,
          opacity: clara ? 0.45 : 1,
        }}
      />
      <Text style={{ fontFamily: fontes.media, fontSize: 14, color: cores.textoSuave }}>{texto}</Text>
    </View>
  );
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16 }}>
      {item(cores.sono, 'Sono')}
      {item(cores.mamada, 'Mamada')}
      {comSugestao && item(cores.sono, 'Sugestão', true)}
    </View>
  );
}
