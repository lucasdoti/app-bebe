import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { LegendaRelogio, RelogioSono } from '@/components/relogio-sono';
import { Botao, Cabecalho, Cartao, Tela, Texto } from '@/components/ui';
import { nasceu, useBebes } from '@/context/bebes';
import { useRegistros } from '@/context/registros';
import { useAgora } from '@/hooks/use-agora';
import { descricao } from '@/lib/registros';
import { doDia, mediaSono, preverSono, type Previsao } from '@/lib/sono';
import { duracao, horaCurta, inicioDoDia, MINUTO } from '@/lib/tempo';
import { ALVO_TOQUE, fontes, raio } from '@/theme/cores';
import { useTema } from '@/theme/tema';

const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
// Os registros carregados cobrem 8 dias: hoje e os 7 anteriores.
const DIAS = 8;

const abrirRegistro = (id: string) => router.push({ pathname: '/registro/[id]', params: { id } });

// "13:00" a partir do minuto do dia.
const relogio = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

// "1h30" com zero à esquerda nos minutos, como nos cartões.
const tempo = (ms: number) => (ms < MINUTO ? '0 min' : duracao(ms));

export default function Sono() {
  const { bebeAtual } = useBebes();
  const reg = useRegistros();
  const { cores } = useTema();
  const [diasAtras, setDiasAtras] = useState(0);
  const dormindo = reg.doBebe.some((r) => r.tipo === 'sono' && r.fim === null);
  const agora = useAgora(dormindo ? 1000 : 30_000);

  if (!nasceu(bebeAtual)) return null;

  const dia = doDia(reg.doBebe, diasAtras, agora);
  const media = mediaSono(reg.doBebe, 7, agora);
  const previsao = diasAtras === 0 ? preverSono(reg.doBebe, bebeAtual.nascimento, media, agora) : null;
  const sonoAtual = reg.doBebe.find((r) => r.tipo === 'sono' && r.fim === null) ?? null;
  const ultimoSono = reg.doBebe.find((r) => r.tipo === 'sono' && r.fim !== null);
  const hoje = inicioDoDia(new Date(agora));

  const sugestao = previsao && previsao.tipo !== 'janela' ? previsao.faixa : null;

  const registrosDoDia = reg.doBebe
    .filter(
      (r) =>
        (r.tipo === 'sono' && dia.sonos.some((s) => s.id === r.id)) ||
        dia.mamadas.some((m) => m.id === r.id),
    )
    .reverse();

  return (
    <Tela>
      <Cabecalho titulo={`Sono de ${bebeAtual.nome}`} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {Array.from({ length: DIAS }, (_, i) => DIAS - 1 - i).map((n) => {
          const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - n);
          const ativo = n === diasAtras;
          return (
            <Pressable
              key={n}
              accessibilityRole="tab"
              accessibilityState={{ selected: ativo }}
              accessibilityLabel={n === 0 ? 'Hoje' : `${SEMANA[d.getDay()]} ${d.getDate()}`}
              onPress={() => setDiasAtras(n)}
              style={{
                width: ALVO_TOQUE,
                minHeight: ALVO_TOQUE + 16,
                borderRadius: raio.botao,
                borderWidth: 1.5,
                borderColor: ativo ? cores.sono : cores.borda,
                backgroundColor: ativo ? cores.sono : cores.cartao,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text style={{ fontFamily: fontes.media, fontSize: 13, color: ativo ? cores.textoNaPrimaria : cores.textoSuave }}>
                {n === 0 ? 'Hoje' : SEMANA[d.getDay()]}
              </Text>
              <Text style={{ fontFamily: fontes.extra, fontSize: 20, color: ativo ? cores.textoNaPrimaria : cores.texto }}>
                {d.getDate()}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Cartao>
        <RelogioSono
          inicioDia={dia.inicio}
          sonos={dia.sonos}
          mamadas={dia.mamadas.map((m) => m.em)}
          sugestao={sugestao}
          agora={diasAtras === 0 ? agora : null}>
          <Centro
            diasAtras={diasAtras}
            total={dia.total}
            agora={agora}
            dormindoDesde={diasAtras === 0 && sonoAtual ? sonoAtual.inicio : null}
            acordadoDesde={
              diasAtras === 0 && !sonoAtual && ultimoSono?.fim && agora - new Date(ultimoSono.fim).getTime() < 24 * 60 * MINUTO
                ? ultimoSono.fim
                : null
            }
            previsao={previsao}
          />
        </RelogioSono>
        <LegendaRelogio comSugestao={!!sugestao} />
      </Cartao>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Numero icone="weather-night" valor={tempo(dia.total)} rotulo="Sono total" />
        <Numero
          icone="weather-partly-cloudy"
          valor={tempo(dia.sonecas)}
          rotulo={dia.nSonecas === 1 ? '1 soneca' : `${dia.nSonecas} sonecas`}
        />
        <Numero icone="white-balance-sunny" valor={tempo(dia.acordado)} rotulo="Acordado" />
      </View>

      {previsao && <CartaoPrevisao previsao={previsao} />}

      <Cartao>
        <Texto variante="subtitulo">Média dos últimos 7 dias</Texto>
        {media.dias === 0 ? (
          <Texto variante="suave">
            Registre o sono por alguns dias para ver a média de {bebeAtual.nome}.
          </Texto>
        ) : (
          <>
            <Linha rotulo="Sono por dia" valor={tempo(media.total)} />
            <Linha rotulo="Sono da noite" valor={tempo(media.noite)} />
            <Linha
              rotulo="Sonecas"
              valor={`${media.nSonecas.toFixed(1).replace('.0', '').replace('.', ',')} por dia · ${tempo(media.sonecas)}`}
            />
            {media.janela !== null && <Linha rotulo="Tempo acordado entre sonos" valor={tempo(media.janela)} />}
            {media.dormir !== null && <Linha rotulo="Costuma dormir à noite" valor={`por volta de ${relogio(media.dormir)}`} />}
            {media.acordar !== null && <Linha rotulo="Costuma acordar" valor={`por volta de ${relogio(media.acordar)}`} />}
            <Texto variante="suave">
              {media.dias === 1 ? 'Com base em 1 dia' : `Com base em ${media.dias} dias`} com sono registrado.
            </Texto>
          </>
        )}
      </Cartao>

      <Cartao>
        <Texto variante="subtitulo">{diasAtras === 0 ? 'Sonos e mamadas de hoje' : 'Sonos e mamadas do dia'}</Texto>
        {registrosDoDia.length === 0 && <Texto variante="suave">Nada registrado neste dia.</Texto>}
        {registrosDoDia.map((x) => {
          const d = descricao(x, agora);
          const ehSono = x.tipo === 'sono';
          return (
            <Pressable
              key={x.id}
              accessibilityRole="button"
              onPress={() => abrirRegistro(x.id)}
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
                  backgroundColor: ehSono ? cores.sono : cores.mamada,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <MaterialCommunityIcons
                  name={ehSono ? 'sleep' : x.tipo === 'refeicao' ? 'silverware-fork-knife' : 'baby-bottle-outline'}
                  size={20}
                  color={cores.textoNaPrimaria}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Texto style={{ fontFamily: fontes.negrito }}>{d.titulo}</Texto>
                <Texto variante="suave">
                  {ehSono && x.fim ? `até ${horaCurta(x.fim)} · ${d.detalhe}` : d.detalhe}
                </Texto>
              </View>
            </Pressable>
          );
        })}
        <Botao
          titulo="Registrar sono que já passou"
          variante="secundario"
          onPress={() => router.push({ pathname: '/registro/[id]', params: { id: 'novo', tipo: 'sono' } })}
        />
      </Cartao>
    </Tela>
  );
}

function Centro({
  diasAtras,
  total,
  agora,
  dormindoDesde,
  acordadoDesde,
  previsao,
}: {
  diasAtras: number;
  total: number;
  agora: number;
  dormindoDesde: string | null;
  acordadoDesde: string | null;
  previsao: Previsao | null;
}) {
  const { cores } = useTema();
  const grande = { fontFamily: fontes.extra, fontSize: 30, lineHeight: 36, color: cores.texto, textAlign: 'center' } as const;
  const pequeno = { fontFamily: fontes.media, fontSize: 14, lineHeight: 19, color: cores.textoSuave, textAlign: 'center' } as const;

  if (diasAtras > 0) {
    return (
      <>
        <Text style={pequeno}>Dormiu</Text>
        <Text style={grande}>{tempo(total)}</Text>
        <Text style={pequeno}>neste dia</Text>
      </>
    );
  }
  if (dormindoDesde) {
    return (
      <>
        <Text style={pequeno}>Dormindo há</Text>
        <Text style={grande}>{tempo(agora - new Date(dormindoDesde).getTime())}</Text>
        <Text style={pequeno}>desde {horaCurta(dormindoDesde)}</Text>
      </>
    );
  }
  if (previsao && previsao.tipo !== 'janela' && !previsao.passou) {
    return (
      <>
        <Text style={pequeno}>{previsao.tipo === 'noite' ? 'Sono da noite em' : 'Próxima soneca em'}</Text>
        <Text style={grande}>{tempo(Math.max(0, previsao.previsto - agora))}</Text>
        <Text style={pequeno}>aprox. {horaCurta(new Date(previsao.previsto))}</Text>
      </>
    );
  }
  if (acordadoDesde) {
    return (
      <>
        <Text style={pequeno}>Acordado há</Text>
        <Text style={grande}>{tempo(agora - new Date(acordadoDesde).getTime())}</Text>
        <Text style={pequeno}>desde {horaCurta(acordadoDesde)}</Text>
      </>
    );
  }
  return (
    <>
      <Text style={pequeno}>Hoje</Text>
      <Text style={grande}>{tempo(total)}</Text>
      <Text style={pequeno}>de sono</Text>
    </>
  );
}

function CartaoPrevisao({ previsao }: { previsao: Previsao }) {
  const { cores } = useTema();
  let titulo: string;
  let texto: string;
  if (previsao.tipo === 'janela') {
    titulo = 'Tempo acordado';
    texto = `Bebês dessa idade costumam ficar acordados de ${duracao(previsao.min)} a ${duracao(previsao.max)} entre um sono e outro. Nos primeiros meses o sono ainda é irregular, então o app não sugere horário.`;
  } else {
    const faixa = `${horaCurta(new Date(previsao.faixa.ini))} e ${horaCurta(new Date(previsao.faixa.fim))}`;
    const qual = previsao.tipo === 'noite' ? 'Sono da noite' : 'Próxima soneca';
    titulo = previsao.passou ? 'Pode estar com sono' : `${qual} por volta de ${horaCurta(new Date(previsao.previsto))}`;
    texto = previsao.passou
      ? `A janela de ${qual.toLowerCase()} era entre ${faixa}. Observe os sinais de sono: bocejo, olhar parado, coçar os olhos.`
      : `Entre ${faixa}. ${
          previsao.pelaMedia
            ? 'Calculado pelo tempo que o bebê costuma ficar acordado nos últimos 7 dias.'
            : 'Calculado pela referência para a idade; com mais dias registrados, o app usa o ritmo do próprio bebê.'
        }`;
  }
  return (
    <Cartao>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: cores.sono,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <MaterialCommunityIcons name="clock-outline" size={24} color={cores.textoNaPrimaria} />
        </View>
        <Texto variante="subtitulo" style={{ flex: 1 }}>
          {titulo}
        </Texto>
      </View>
      <Texto variante="suave">{texto}</Texto>
      <Texto variante="suave" style={{ fontSize: 13 }}>
        É só uma sugestão: cada bebê tem seu ritmo.
      </Texto>
    </Cartao>
  );
}

function Numero({ icone, valor, rotulo }: { icone: 'weather-night' | 'weather-partly-cloudy' | 'white-balance-sunny'; valor: string; rotulo: string }) {
  const { cores } = useTema();
  return (
    <View
      style={{
        flex: 1,
        borderRadius: raio.cartao,
        borderWidth: 1,
        borderColor: cores.borda,
        backgroundColor: cores.cartao,
        padding: 12,
        gap: 4,
        alignItems: 'center',
      }}>
      <MaterialCommunityIcons name={icone} size={24} color={cores.sono} />
      <Text style={{ fontFamily: fontes.extra, fontSize: 18, color: cores.texto }}>{valor}</Text>
      <Text style={{ fontFamily: fontes.media, fontSize: 13, color: cores.textoSuave, textAlign: 'center' }}>{rotulo}</Text>
    </View>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Texto variante="suave" style={{ flex: 1 }}>
        {rotulo}
      </Texto>
      <Texto style={{ fontFamily: fontes.negrito }}>{valor}</Texto>
    </View>
  );
}
