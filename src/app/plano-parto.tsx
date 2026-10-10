import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Linking, Platform, Pressable, Share, Text, View } from 'react-native';

import { Aviso, Botao, Cabecalho, Campo, Cartao, Tela, Texto } from '@/components/ui';
import { useBebes } from '@/context/bebes';
import { GRUPOS_PLANO, PLANO_SUGERIDO, textoDoPlano, useParto, type GrupoPlano, type ItemPlano } from '@/context/parto';
import { confirmar } from '@/lib/confirmar';
import { mensagemDeErro, supabase } from '@/lib/supabase';
import { ALVO_TOQUE, fontes } from '@/theme/cores';
import { useTema } from '@/theme/tema';

type Pref = ItemPlano['preferencia'];

function Opcao({ ativo, titulo, onPress }: { ativo: boolean; titulo: string; onPress: () => void }) {
  const { cores } = useTema();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: ativo }}
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 48,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: ativo ? cores.primaria : cores.borda,
        backgroundColor: ativo ? cores.primaria : cores.cartao,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ fontFamily: fontes.negrito, fontSize: 14, color: ativo ? cores.textoNaPrimaria : cores.texto }}>{titulo}</Text>
    </Pressable>
  );
}

export default function PlanoParto() {
  const { bebeAtual } = useBebes();
  const { plano, recarregar } = useParto();
  const { cores } = useTema();
  const [novos, setNovos] = useState<Partial<Record<GrupoPlano, string>>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  if (!bebeAtual) return null;

  async function executar(acao: PromiseLike<{ error: { message: string } | null }>) {
    setErro(null);
    const { error } = await acao;
    if (error) setErro(mensagemDeErro(error));
    await recarregar();
  }

  async function comecar() {
    setCriando(true);
    const itens = GRUPOS_PLANO.flatMap(({ grupo }) => PLANO_SUGERIDO[grupo].map((texto) => ({ bebe_id: bebeAtual!.id, grupo, texto })));
    await executar(supabase.from('plano_parto_itens').insert(itens));
    setCriando(false);
  }

  const escolher = (i: ItemPlano, p: Pref) =>
    executar(supabase.from('plano_parto_itens').update({ preferencia: i.preferencia === p ? null : p }).eq('id', i.id));

  async function adicionar(grupo: GrupoPlano) {
    const texto = novos[grupo]?.trim();
    if (!texto) return;
    setNovos({ ...novos, [grupo]: '' });
    await executar(supabase.from('plano_parto_itens').insert({ bebe_id: bebeAtual!.id, grupo, texto, preferencia: 'sim' }));
  }

  const texto = textoDoPlano(bebeAtual.nome, plano);
  const definidos = plano.filter((p) => p.preferencia).length;

  async function compartilhar() {
    try {
      if (Platform.OS === 'web' && !navigator.share) {
        await navigator.clipboard.writeText(texto);
        setAviso('Plano copiado. Cole onde quiser.');
        return;
      }
      await Share.share({ message: texto });
    } catch {
      // Cancelado.
    }
  }

  return (
    <Tela>
      <Cabecalho titulo="Plano de parto" />
      <Texto variante="suave">
        Marquem o que querem e o que não querem; o resto fica para decidir com a equipe. Conversem sobre o plano com a
        obstetra antes do parto.
      </Texto>

      {plano.length === 0 ? (
        <Cartao>
          <Texto>Comece com preferências comuns e ajuste do jeito de vocês.</Texto>
          <Botao titulo="Começar com sugestões" onPress={comecar} carregando={criando} />
        </Cartao>
      ) : (
        definidos > 0 && (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Botao
                titulo="WhatsApp"
                onPress={() => Linking.openURL(`https://wa.me/?text=${encodeURIComponent(texto)}`)}
                icone={<MaterialCommunityIcons name="whatsapp" size={20} color={cores.textoNaPrimaria} />}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Botao titulo="Compartilhar" variante="secundario" onPress={compartilhar} />
            </View>
          </View>
        )
      )}
      <Aviso texto={erro} />
      <Aviso texto={aviso} tipo="info" />

      {plano.length > 0 &&
        GRUPOS_PLANO.map(({ grupo, titulo }) => (
          <Cartao key={grupo}>
            <Texto variante="subtitulo">{titulo}</Texto>
            {plano
              .filter((p) => p.grupo === grupo)
              .map((i) => (
                <View key={i.id} style={{ gap: 6, paddingVertical: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Texto style={{ flex: 1 }}>{i.texto}</Texto>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Tirar "${i.texto}" do plano`}
                      onPress={() =>
                        confirmar('Tirar este item do plano?', 'Tirar', () =>
                          executar(supabase.from('plano_parto_itens').delete().eq('id', i.id)),
                        )
                      }
                      style={{ width: ALVO_TOQUE, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center' }}>
                      <MaterialCommunityIcons name="delete-outline" size={20} color={cores.textoSuave} />
                    </Pressable>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Opcao ativo={i.preferencia === 'sim'} titulo="Quero" onPress={() => escolher(i, 'sim')} />
                    <Opcao ativo={i.preferencia === 'nao'} titulo="Não quero" onPress={() => escolher(i, 'nao')} />
                  </View>
                </View>
              ))}
            <Campo
              rotulo="Adicionar preferência"
              value={novos[grupo] ?? ''}
              onChangeText={(v) => setNovos({ ...novos, [grupo]: v })}
              onSubmitEditing={() => adicionar(grupo)}
              returnKeyType="done"
              placeholder="Escreva e toque em concluir"
            />
          </Cartao>
        ))}
    </Tela>
  );
}
