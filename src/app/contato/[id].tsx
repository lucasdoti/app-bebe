import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Aviso, Botao, Cabecalho, Campo, Tela, Texto } from '@/components/ui';
import { useBebes } from '@/context/bebes';
import { nomePapel, useParto, type Papel } from '@/context/parto';
import { confirmar } from '@/lib/confirmar';
import { mensagemDeErro, supabase } from '@/lib/supabase';
import { fontes } from '@/theme/cores';
import { useTema } from '@/theme/tema';

const PAPEIS = Object.keys(nomePapel) as Papel[];

// Máscara de telefone brasileiro: (11) 98765-4321.
function mascaraTelefone(t: string) {
  const n = t.replace(/\D/g, '').slice(0, 11);
  if (n.length <= 2) return n;
  if (n.length <= 6) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
  if (n.length <= 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
}

function voltar() {
  if (router.canGoBack()) router.back();
  else router.replace('/parto');
}

export default function ContatoForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { bebeAtual } = useBebes();
  const { contatos, recarregar } = useParto();
  const { cores } = useTema();
  const existente = id === 'novo' ? null : (contatos.find((c) => c.id === id) ?? null);

  const [papel, setPapel] = useState<Papel>(existente?.papel ?? (contatos.some((c) => c.papel === 'obstetra') ? 'maternidade' : 'obstetra'));
  const [nome, setNome] = useState(existente?.nome ?? '');
  const [telefone, setTelefone] = useState(existente?.telefone ?? '');
  const [endereco, setEndereco] = useState(existente?.endereco ?? '');
  const [observacao, setObservacao] = useState(existente?.observacao ?? '');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setErro(null);
    if (!bebeAtual) return;
    if (!nome.trim()) return setErro(papel === 'maternidade' ? 'Qual o nome da maternidade?' : 'Qual o nome?');
    if (!telefone.trim() && !endereco.trim()) return setErro('Preencha o telefone ou o endereço.');
    const dados = {
      papel,
      nome: nome.trim(),
      telefone: telefone.trim() || null,
      endereco: endereco.trim() || null,
      observacao: observacao.trim() || null,
    };
    setCarregando(true);
    const { error } = existente
      ? await supabase.from('contatos_parto').update(dados).eq('id', existente.id)
      : await supabase.from('contatos_parto').insert({ ...dados, bebe_id: bebeAtual.id });
    setCarregando(false);
    if (error) return setErro(mensagemDeErro(error));
    await recarregar();
    voltar();
  }

  function apagar() {
    if (!existente) return;
    confirmar(`Apagar o contato ${existente.nome}?`, 'Apagar', async () => {
      const { error } = await supabase.from('contatos_parto').delete().eq('id', existente.id);
      if (error) return setErro(mensagemDeErro(error));
      await recarregar();
      voltar();
    });
  }

  return (
    <Tela>
      <Cabecalho titulo={existente ? existente.nome : 'Novo contato'} />
      <Texto variante="rotulo">Quem é</Texto>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {PAPEIS.map((p) => {
          const ativo = p === papel;
          return (
            <Pressable
              key={p}
              accessibilityRole="radio"
              accessibilityState={{ selected: ativo }}
              onPress={() => setPapel(p)}
              style={{
                minHeight: 48,
                paddingHorizontal: 16,
                borderRadius: 999,
                borderWidth: 1.5,
                borderColor: ativo ? cores.primaria : cores.borda,
                backgroundColor: ativo ? cores.primaria : cores.cartao,
                justifyContent: 'center',
              }}>
              <Text style={{ fontFamily: fontes.negrito, fontSize: 15, color: ativo ? cores.textoNaPrimaria : cores.texto }}>
                {nomePapel[p]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Campo
        rotulo="Nome"
        value={nome}
        onChangeText={setNome}
        placeholder={papel === 'maternidade' ? 'Ex.: Maternidade São Luiz' : 'Ex.: Dra. Ana'}
        autoCapitalize="words"
      />
      <Campo
        rotulo="Telefone"
        value={telefone}
        onChangeText={(t) => setTelefone(mascaraTelefone(t))}
        placeholder="(11) 98765-4321"
        keyboardType="phone-pad"
        inputMode="tel"
      />
      {(papel === 'maternidade' || endereco) && (
        <Campo
          rotulo="Endereço"
          value={endereco}
          onChangeText={setEndereco}
          placeholder="Rua, número, bairro e cidade"
        />
      )}
      <Campo
        rotulo="Observação (opcional)"
        value={observacao}
        onChangeText={setObservacao}
        placeholder="Ex.: entrada pelo pronto-socorro obstétrico"
      />
      <Aviso texto={erro} />
      <Botao titulo="Salvar" onPress={salvar} carregando={carregando} />
      {existente && <Botao titulo="Apagar contato" variante="texto" onPress={apagar} />}
    </Tela>
  );
}
