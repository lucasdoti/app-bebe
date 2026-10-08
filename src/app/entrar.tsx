import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { Aviso, Botao, Campo, Cartao, Tela, Texto } from '@/components/ui';
import { NOME_APP } from '@/lib/app';
import { conviteGuardado } from '@/lib/convite';
import { mensagemDeErro, supabase } from '@/lib/supabase';
import { fontes } from '@/theme/cores';
import { useTema } from '@/theme/tema';

type Modo = 'entrar' | 'criar';

function urlDeVolta() {
  return Platform.OS === 'web' ? window.location.origin : undefined;
}

export default function Entrar() {
  const { cores } = useTema();
  const [modo, setModo] = useState<Modo>('entrar');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const convite = conviteGuardado();

  async function enviar() {
    setErro(null);
    setInfo(null);
    if (!email.trim() || !senha) {
      setErro('Preencha e-mail e senha.');
      return;
    }
    setCarregando(true);
    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: senha,
          options: { emailRedirectTo: urlDeVolta() },
        });
        if (error) throw error;
        if (!data.session) {
          setInfo('Enviamos um link para o seu e-mail. Confirme e depois entre com sua senha.');
          setModo('entrar');
        }
      }
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setCarregando(false);
    }
  }

  async function entrarComGoogle() {
    setErro(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: urlDeVolta() },
    });
    if (error) setErro(mensagemDeErro(error));
  }

  return (
    <Tela centralizar>
      <View style={{ alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Texto style={{ fontSize: 56, lineHeight: 64 }}>🍼</Texto>
        <Texto variante="titulo">{NOME_APP}</Texto>
        <Texto variante="suave" style={{ textAlign: 'center' }}>
          A rotina do bebê, junto com quem cuida dele.
        </Texto>
      </View>

      {convite && (
        <Cartao style={{ backgroundColor: cores.sono, borderColor: cores.sono }}>
          <Texto>
            Você recebeu o convite <Texto style={{ fontFamily: fontes.negrito }}>{convite}</Texto>. Entre ou crie sua conta
            para participar da família.
          </Texto>
        </Cartao>
      )}

      {Platform.OS === 'web' && (
        <>
          <Botao
            titulo="Continuar com Google"
            variante="secundario"
            onPress={entrarComGoogle}
            icone={<Ionicons name="logo-google" size={20} color={cores.texto} />}
          />
          <Texto variante="suave" style={{ textAlign: 'center' }}>
            ou com e-mail
          </Texto>
        </>
      )}

      <Campo
        rotulo="E-mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        inputMode="email"
        placeholder="voce@email.com"
      />
      <Campo
        rotulo="Senha"
        value={senha}
        onChangeText={setSenha}
        secureTextEntry
        autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
        placeholder={modo === 'criar' ? 'Pelo menos 6 caracteres' : ''}
        onSubmitEditing={enviar}
      />

      <Aviso texto={erro} />
      <Aviso texto={info} tipo="info" />

      <Botao titulo={modo === 'entrar' ? 'Entrar' : 'Criar conta'} onPress={enviar} carregando={carregando} />
      <Botao
        titulo={modo === 'entrar' ? 'Não tenho conta' : 'Já tenho conta'}
        variante="texto"
        onPress={() => {
          setModo(modo === 'entrar' ? 'criar' : 'entrar');
          setErro(null);
        }}
      />
    </Tela>
  );
}
