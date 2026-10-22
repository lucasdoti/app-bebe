import { router } from 'expo-router';
import { useState } from 'react';

import { INICIO } from '@/lib/app';
import { Aviso, Botao, Campo, Tela, Texto } from '@/components/ui';
import { useSessao } from '@/context/sessao';
import { mensagemDeErro, supabase } from '@/lib/supabase';

// Aberta pelo link do e-mail de "esqueci minha senha": a pessoa já está logada e escolhe a senha nova.
export default function NovaSenha() {
  const { sessao, senhaTrocada } = useSessao();
  const [senha, setSenha] = useState('');
  const [repetir, setRepetir] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setErro(null);
    if (senha.length < 6) return setErro('A senha precisa ter pelo menos 6 caracteres.');
    if (senha !== repetir) return setErro('As duas senhas não estão iguais.');
    setCarregando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setCarregando(false);
    if (error) return setErro(mensagemDeErro(error));
    senhaTrocada();
    router.replace(INICIO);
  }

  if (!sessao) {
    return (
      <Tela centralizar>
        <Texto variante="subtitulo">Link expirado</Texto>
        <Texto variante="suave">Peça um novo e-mail em "Esqueci minha senha", na tela de entrar.</Texto>
        <Botao titulo="Ir para entrar" onPress={() => router.replace('/entrar')} />
      </Tela>
    );
  }

  return (
    <Tela centralizar>
      <Texto variante="titulo">Nova senha</Texto>
      <Texto variante="suave">Escolha a senha nova para {sessao.user.email}.</Texto>
      <Campo
        rotulo="Senha nova"
        value={senha}
        onChangeText={setSenha}
        secureTextEntry
        autoComplete="new-password"
        placeholder="Pelo menos 6 caracteres"
      />
      <Campo
        rotulo="Repita a senha"
        value={repetir}
        onChangeText={setRepetir}
        secureTextEntry
        autoComplete="new-password"
        onSubmitEditing={salvar}
      />
      <Aviso texto={erro} />
      <Botao titulo="Salvar senha" onPress={salvar} carregando={carregando} />
    </Tela>
  );
}
