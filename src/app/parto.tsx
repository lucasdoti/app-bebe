import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { BotoesDaHora } from '@/components/botoes-da-hora';
import { Botao, Cabecalho, Cartao, Tela, Texto } from '@/components/ui';
import { useBebes } from '@/context/bebes';
import { useGestacao } from '@/context/gestacao';
import { abrirMapa, abrirWhatsApp, ligar, nomePapel, useParto, type Contato } from '@/context/parto';
import { ALVO_TOQUE, fontes } from '@/theme/cores';
import { useTema } from '@/theme/tema';

function BotaoIcone({ icone, rotulo, onPress }: { icone: 'phone' | 'whatsapp' | 'map-marker' | 'pencil-outline'; rotulo: string; onPress: () => void }) {
  const { cores } = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      onPress={onPress}
      style={({ pressed }) => ({
        width: ALVO_TOQUE,
        height: ALVO_TOQUE,
        borderRadius: ALVO_TOQUE / 2,
        borderWidth: 1.5,
        borderColor: cores.borda,
        backgroundColor: cores.cartao,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}>
      <MaterialCommunityIcons name={icone} size={22} color={cores.texto} />
    </Pressable>
  );
}

function LinhaContato({ c }: { c: Contato }) {
  return (
    <View style={{ gap: 6, paddingVertical: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Texto variante="rotulo">{nomePapel[c.papel]}</Texto>
          <Texto style={{ fontFamily: fontes.negrito }}>{c.nome}</Texto>
          {c.telefone && <Texto variante="suave">{c.telefone}</Texto>}
          {c.endereco && <Texto variante="suave">{c.endereco}</Texto>}
          {c.observacao && <Texto variante="suave">{c.observacao}</Texto>}
        </View>
        <BotaoIcone
          icone="pencil-outline"
          rotulo={`Editar ${c.nome}`}
          onPress={() => router.push({ pathname: '/contato/[id]', params: { id: c.id } })}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {c.telefone && <BotaoIcone icone="phone" rotulo={`Ligar para ${c.nome}`} onPress={() => ligar(c.telefone!)} />}
        {c.telefone && <BotaoIcone icone="whatsapp" rotulo={`WhatsApp de ${c.nome}`} onPress={() => abrirWhatsApp(c.telefone!)} />}
        {c.endereco && <BotaoIcone icone="map-marker" rotulo={`Rota até ${c.nome}`} onPress={() => abrirMapa(c.endereco!)} />}
      </View>
    </View>
  );
}

// Tudo o que importa no dia do parto, a um toque.
export default function ChegouAHora() {
  const { bebeAtual } = useBebes();
  const { contatos, plano } = useParto();
  const { mala } = useGestacao();
  const { cores } = useTema();
  if (!bebeAtual) return null;

  const definidos = plano.filter((p) => p.preferencia).length;
  const prontos = mala.filter((m) => m.feito).length;

  return (
    <Tela>
      <Cabecalho titulo="Chegou a hora" />

      <BotoesDaHora />

      <View style={{ backgroundColor: cores.fralda, borderRadius: 16, padding: 14, gap: 6 }}>
        <Texto style={{ fontFamily: fontes.extra, color: cores.textoNaPrimaria }}>Quando ir para a maternidade</Texto>
        {[
          'Contrações regulares a cada 5 minutos, de cerca de 1 minuto, por 1 hora (ou como a obstetra orientou)',
          'Perda de líquido pela vagina (bolsa rompeu)',
          'Sangramento',
          'Bebê mexendo menos que o normal',
          'Dor forte que não passa, febre, dor de cabeça forte ou visão embaçada',
        ].map((s) => (
          <Texto key={s} style={{ color: cores.textoNaPrimaria }}>
            • {s}
          </Texto>
        ))}
      </View>

      <Cartao>
        <Texto variante="subtitulo">Contatos</Texto>
        {contatos.length === 0 && (
          <Texto variante="suave">Obstetra, maternidade, doula e pediatra. Ficam salvos no celular mesmo sem internet.</Texto>
        )}
        {contatos.map((c) => (
          <LinhaContato key={c.id} c={c} />
        ))}
        <Botao
          titulo="Adicionar contato"
          variante="secundario"
          onPress={() => router.push({ pathname: '/contato/[id]', params: { id: 'novo' } })}
        />
      </Cartao>

      <Cartao>
        <Texto variante="subtitulo">Plano de parto</Texto>
        <Texto variante="suave">
          {plano.length ? `${definidos} de ${plano.length} preferências definidas` : 'As preferências de vocês para levar à maternidade.'}
        </Texto>
        <Botao titulo={plano.length ? 'Ver plano de parto' : 'Montar plano de parto'} variante="secundario" onPress={() => router.push('/plano-parto')} />
      </Cartao>

      <Cartao>
        <Texto variante="subtitulo">Mala da maternidade</Texto>
        <Texto variante="suave">{mala.length ? `${prontos} de ${mala.length} itens prontos` : 'Ainda não começaram a lista.'}</Texto>
        <Botao titulo="Ver mala" variante="secundario" onPress={() => router.push('/mala')} />
      </Cartao>
    </Tela>
  );
}
