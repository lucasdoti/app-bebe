import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Aviso, Botao, Cabecalho, Campo, Cartao, Tela, Texto } from '@/components/ui';
import { useBebes } from '@/context/bebes';
import { useGestacao, type GrupoMala, type ItemMala } from '@/context/gestacao';
import { mensagemDeErro, supabase } from '@/lib/supabase';
import { ALVO_TOQUE, fontes } from '@/theme/cores';
import { useTema } from '@/theme/tema';

const GRUPOS: { grupo: GrupoMala; titulo: string }[] = [
  { grupo: 'bebe', titulo: 'Para o bebê' },
  { grupo: 'mae', titulo: 'Para a mãe' },
  { grupo: 'documentos', titulo: 'Documentos' },
  { grupo: 'acompanhante', titulo: 'Para o acompanhante' },
];

// Sugestão inicial; cada família edita à vontade. Muitas maternidades têm a própria lista.
const LISTA_INICIAL: Record<GrupoMala, string[]> = {
  bebe: [
    'Bodies de manga curta e longa (6)',
    'Calças ou mijões (4)',
    'Macacões (3)',
    'Meias e luvinhas (3 pares)',
    'Gorrinho',
    'Manta',
    'Fraldas tamanho RN (1 pacote)',
    'Lenços umedecidos ou algodão',
    'Roupa da saída da maternidade',
    'Bebê-conforto instalado no carro',
  ],
  mae: [
    'Camisolas ou pijamas com abertura para amamentar (3)',
    'Sutiãs de amamentação (2)',
    'Calcinhas confortáveis (5)',
    'Absorventes pós-parto',
    'Absorventes para os seios',
    'Chinelo',
    'Itens de higiene',
    'Roupa para a saída',
  ],
  documentos: [
    'Documento com foto dos pais',
    'Cartão da gestante (pré-natal)',
    'Exames e laudos de ultrassom',
    'Carteirinha do plano de saúde',
    'Plano de parto, se tiver',
  ],
  acompanhante: ['Muda de roupa', 'Itens de higiene', 'Carregador de celular', 'Lanches e garrafa de água'],
};

export default function Mala() {
  const { bebeAtual } = useBebes();
  const { mala, recarregar } = useGestacao();
  const { cores } = useTema();
  const [novos, setNovos] = useState<Partial<Record<GrupoMala, string>>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);

  if (!bebeAtual) return null;

  async function executar(acao: PromiseLike<{ error: { message: string } | null }>) {
    setErro(null);
    const { error } = await acao;
    if (error) setErro(mensagemDeErro(error));
    await recarregar();
  }

  async function comecarLista() {
    setCriando(true);
    const itens = GRUPOS.flatMap(({ grupo }) => LISTA_INICIAL[grupo].map((nome) => ({ bebe_id: bebeAtual!.id, grupo, nome })));
    await executar(supabase.from('mala_itens').insert(itens));
    setCriando(false);
  }

  const alternar = (item: ItemMala) =>
    executar(supabase.from('mala_itens').update({ feito: !item.feito }).eq('id', item.id));
  const remover = (item: ItemMala) => executar(supabase.from('mala_itens').delete().eq('id', item.id));
  async function adicionar(grupo: GrupoMala) {
    const nome = novos[grupo]?.trim();
    if (!nome) return;
    setNovos({ ...novos, [grupo]: '' });
    await executar(supabase.from('mala_itens').insert({ bebe_id: bebeAtual!.id, grupo, nome }));
  }

  const prontos = mala.filter((m) => m.feito).length;

  return (
    <Tela>
      <Cabecalho titulo="Mala da maternidade" />
      {mala.length === 0 ? (
        <Cartao>
          <Texto>Comece com uma lista sugerida e ajuste do jeito de vocês. Vale conferir também a lista da sua maternidade.</Texto>
          <Botao titulo="Começar com a lista sugerida" onPress={comecarLista} carregando={criando} />
        </Cartao>
      ) : (
        <Texto variante="suave">
          {prontos} de {mala.length} itens prontos. Toque num item para marcar.
        </Texto>
      )}
      <Aviso texto={erro} />

      {mala.length > 0 &&
        GRUPOS.map(({ grupo, titulo }) => (
          <Cartao key={grupo}>
            <Texto variante="subtitulo">{titulo}</Texto>
            {mala
              .filter((m) => m.grupo === grupo)
              .map((item) => (
                <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: item.feito }}
                    onPress={() => alternar(item)}
                    style={({ pressed }) => ({
                      flex: 1,
                      minHeight: ALVO_TOQUE,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      opacity: pressed ? 0.7 : 1,
                    })}>
                    <MaterialCommunityIcons
                      name={item.feito ? 'check-circle' : 'checkbox-blank-circle-outline'}
                      size={28}
                      color={item.feito ? cores.medidasForte : cores.textoSuave}
                    />
                    <Text
                      style={{
                        flex: 1,
                        fontFamily: fontes.media,
                        fontSize: 16,
                        color: item.feito ? cores.textoSuave : cores.texto,
                        textDecorationLine: item.feito ? 'line-through' : 'none',
                      }}>
                      {item.nome}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Tirar ${item.nome} da lista`}
                    onPress={() => remover(item)}
                    style={{ width: ALVO_TOQUE, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialCommunityIcons name="delete-outline" size={22} color={cores.textoSuave} />
                  </Pressable>
                </View>
              ))}
            <Campo
              rotulo="Adicionar item"
              value={novos[grupo] ?? ''}
              onChangeText={(v) => setNovos({ ...novos, [grupo]: v })}
              onSubmitEditing={() => adicionar(grupo)}
              returnKeyType="done"
              placeholder="Ex.: Travesseiro de amamentação"
            />
          </Cartao>
        ))}
    </Tela>
  );
}
