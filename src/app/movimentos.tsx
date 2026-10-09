import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Botao, Cabecalho, Cartao, Tela, Texto } from '@/components/ui';
import { useRegistros } from '@/context/registros';
import { useAgora } from '@/hooks/use-agora';
import type { Registro } from '@/lib/registros';
import { cronometro, duracao, horaCurta, rotuloDia, diasAtras } from '@/lib/tempo';
import { ALVO_TOQUE, fontes } from '@/theme/cores';
import { useTema } from '@/theme/tema';

const META = 10;
type Sessao = Extract<Registro, { tipo: 'movimentos' }>;
const t = (iso: string) => new Date(iso).getTime();

// Contagem de movimentos do bebê: toque a cada mexida até chegar a 10 e veja quanto tempo levou.
export default function Movimentos() {
  const { doBebe, criar, atualizar } = useRegistros();
  const { cores } = useTema();
  const agora = useAgora(1000);

  const sessoes = doBebe.filter((r): r is Sessao => r.tipo === 'movimentos');
  const ativa = sessoes.find((r) => r.fim === null);
  const feitas = sessoes.filter((r) => r.fim !== null).slice(0, 14);

  function mexeu() {
    const momento = new Date().toISOString();
    if (!ativa) {
      criar({ tipo: 'movimentos', inicio: momento, fim: null, detalhes: { quantidade: 1 } });
      return;
    }
    const quantidade = ativa.detalhes.quantidade + 1;
    atualizar(ativa.id, { detalhes: { quantidade }, ...(quantidade >= META && { fim: momento }) });
  }

  const contagem = ativa?.detalhes.quantidade ?? 0;

  return (
    <Tela>
      <Cabecalho titulo="Movimentos do bebê" />
      <Texto variante="suave">
        Escolha um momento em que o bebê costuma estar ativo, deite de lado e toque a cada movimento (chute, giro,
        mexida). A contagem para sozinha em {META}.
      </Texto>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Mexeu. ${contagem} de ${META}`}
        onPress={mexeu}
        style={({ pressed }) => ({
          alignSelf: 'center',
          width: 220,
          height: 220,
          borderRadius: 110,
          backgroundColor: ativa ? cores.sono : cores.cartao,
          borderWidth: 3,
          borderColor: cores.sono,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          opacity: pressed ? 0.85 : 1,
        })}>
        <MaterialCommunityIcons name="gesture-tap" size={34} color={ativa ? cores.textoNaPrimaria : cores.texto} />
        <Text style={{ fontFamily: fontes.extra, fontSize: 44, color: ativa ? cores.textoNaPrimaria : cores.texto }}>
          {ativa ? `${contagem}/${META}` : 'Mexeu'}
        </Text>
        <Text style={{ fontFamily: fontes.negrito, fontSize: 16, color: ativa ? cores.textoNaPrimaria : cores.textoSuave }}>
          {ativa ? cronometro(agora - t(ativa.inicio)) : 'toque para começar'}
        </Text>
      </Pressable>

      {ativa && (
        <Botao
          titulo="Parar contagem"
          variante="secundario"
          onPress={() => atualizar(ativa.id, { fim: new Date().toISOString() })}
        />
      )}

      <View style={{ backgroundColor: cores.fralda, borderRadius: 14, padding: 12 }}>
        <Text style={{ fontFamily: fontes.media, fontSize: 15, color: cores.textoNaPrimaria }}>
          Se perceber o bebê mexendo menos que o normal, ou se não chegar a {META} movimentos em 2 horas, procure a
          maternidade ou a obstetra no mesmo dia. Não espere até o dia seguinte.
        </Text>
      </View>

      <Cartao>
        <Texto variante="subtitulo">Contagens anteriores</Texto>
        {feitas.length === 0 && <Texto variante="suave">Nenhuma contagem ainda.</Texto>}
        {feitas.map((s) => (
          <Pressable
            key={s.id}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/registro/[id]', params: { id: s.id } })}
            style={({ pressed }) => ({ minHeight: ALVO_TOQUE, justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
            <Texto style={{ fontFamily: fontes.negrito }}>
              {s.detalhes.quantidade} movimentos em {duracao(t(s.fim!) - t(s.inicio))}
            </Texto>
            <Texto variante="suave">
              {rotuloDia(diasAtras(s.inicio))} às {horaCurta(s.inicio)}
            </Texto>
          </Pressable>
        ))}
      </Cartao>
    </Tela>
  );
}
