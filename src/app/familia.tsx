import { useState } from 'react';
import { View } from 'react-native';

import { Aviso, Botao, Campo, Escolha, Tela, Texto } from '@/components/ui';
import { useSessao } from '@/context/sessao';
import { conviteGuardado, esquecerConvite, formatarCodigo } from '@/lib/convite';
import { mensagemDeErro, supabase, type Papel } from '@/lib/supabase';

type Modo = 'criar' | 'entrar';

const opcoesPapel: { valor: Papel; titulo: string }[] = [
  { valor: 'mae', titulo: 'Mãe' },
  { valor: 'pai', titulo: 'Pai' },
  { valor: 'outro', titulo: 'Outro' },
];

// Primeiro acesso: cria a família ou entra numa existente pelo código de convite.
export default function FamiliaScreen() {
  const { sessao, recarregarFamilia, sair } = useSessao();
  const convite = conviteGuardado();
  const nomeGoogle = (sessao?.user.user_metadata?.full_name as string | undefined)?.split(' ')[0] ?? '';

  const [modo, setModo] = useState<Modo>(convite ? 'entrar' : 'criar');
  const [meuNome, setMeuNome] = useState(nomeGoogle);
  const [papel, setPapel] = useState<Papel | null>(null);
  const [nomeFamilia, setNomeFamilia] = useState('');
  const [codigo, setCodigo] = useState(convite ?? '');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    setErro(null);
    if (!meuNome.trim()) return setErro('Diga seu nome.');
    if (!papel) return setErro('Escolha se você é mãe, pai ou outro.');
    if (modo === 'criar' && !nomeFamilia.trim()) return setErro('Dê um nome para a família.');
    if (modo === 'entrar' && formatarCodigo(codigo).length < 11) return setErro('Digite o código completo.');

    setCarregando(true);
    const { error } =
      modo === 'criar'
        ? await supabase.rpc('criar_familia', {
            p_nome_familia: nomeFamilia.trim(),
            p_meu_nome: meuNome.trim(),
            p_papel: papel,
          })
        : await supabase.rpc('entrar_familia', {
            p_codigo: formatarCodigo(codigo),
            p_meu_nome: meuNome.trim(),
            p_papel: papel,
          });
    if (error) {
      setCarregando(false);
      setErro(mensagemDeErro(error));
      return;
    }
    esquecerConvite();
    await recarregarFamilia();
  }

  return (
    <Tela centralizar>
      <View style={{ gap: 6 }}>
        <Texto variante="titulo">Sua família</Texto>
        <Texto variante="suave">
          Pai e mãe ficam na mesma família e veem os mesmos registros, em tempo real.
        </Texto>
      </View>

      <Escolha
        rotulo="O que você quer fazer?"
        opcoes={[
          { valor: 'criar', titulo: 'Criar família' },
          { valor: 'entrar', titulo: 'Tenho convite' },
        ]}
        valor={modo}
        onChange={(m) => {
          setModo(m);
          setErro(null);
        }}
      />

      <Campo rotulo="Seu nome" value={meuNome} onChangeText={setMeuNome} autoComplete="given-name" placeholder="Ex.: Ana" />
      <Escolha rotulo="Você é" opcoes={opcoesPapel} valor={papel} onChange={setPapel} />

      {modo === 'criar' ? (
        <Campo
          rotulo="Nome da família"
          value={nomeFamilia}
          onChangeText={setNomeFamilia}
          placeholder="Ex.: Família Silva"
        />
      ) : (
        <Campo
          rotulo="Código de convite"
          value={codigo}
          onChangeText={(t) => setCodigo(t.toUpperCase())}
          onBlur={() => setCodigo(formatarCodigo(codigo))}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="BEBE-7K2X9P"
        />
      )}

      <Aviso texto={erro} />

      <Botao
        titulo={modo === 'criar' ? 'Criar família' : 'Entrar na família'}
        onPress={confirmar}
        carregando={carregando}
      />
      <Botao titulo="Sair da conta" variante="texto" onPress={sair} />
    </Tela>
  );
}
