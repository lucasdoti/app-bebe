import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ALVO_TOQUE, fontes, raio } from '@/theme/cores';
import { useTema } from '@/theme/tema';

export function Tela({ children, centralizar }: { children: ReactNode; centralizar?: boolean }) {
  const { cores } = useTema();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: cores.fundo }}>
      <ScrollView
        contentContainerStyle={[estilos.conteudo, centralizar && { flexGrow: 1, justifyContent: 'center' }]}
        keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

type Variante = 'titulo' | 'subtitulo' | 'corpo' | 'suave' | 'rotulo';

export function Texto({ variante = 'corpo', style, ...props }: TextProps & { variante?: Variante }) {
  const { cores } = useTema();
  const base = {
    titulo: { fontFamily: fontes.extra, fontSize: 30, lineHeight: 36, color: cores.texto },
    subtitulo: { fontFamily: fontes.negrito, fontSize: 20, lineHeight: 26, color: cores.texto },
    corpo: { fontFamily: fontes.regular, fontSize: 17, lineHeight: 24, color: cores.texto },
    suave: { fontFamily: fontes.regular, fontSize: 15, lineHeight: 21, color: cores.textoSuave },
    rotulo: { fontFamily: fontes.media, fontSize: 15, lineHeight: 20, color: cores.textoSuave },
  }[variante];
  return <Text style={[base, style]} {...props} />;
}

export function Botao({
  titulo,
  onPress,
  variante = 'primario',
  carregando,
  desabilitado,
  icone,
}: {
  titulo: string;
  onPress: () => void;
  variante?: 'primario' | 'secundario' | 'texto';
  carregando?: boolean;
  desabilitado?: boolean;
  icone?: ReactNode;
}) {
  const { cores } = useTema();
  const inativo = desabilitado || carregando;
  const fundo = variante === 'primario' ? cores.primaria : variante === 'secundario' ? cores.cartao : 'transparent';
  const corTexto = variante === 'primario' ? cores.textoNaPrimaria : cores.texto;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={inativo}
      style={({ pressed }) => [
        estilos.botao,
        {
          backgroundColor: fundo,
          borderColor: variante === 'secundario' ? cores.borda : 'transparent',
          opacity: inativo ? 0.55 : pressed ? 0.8 : 1,
        },
      ]}>
      {carregando ? (
        <ActivityIndicator color={corTexto} />
      ) : (
        <View style={estilos.linha}>
          {icone}
          <Text style={{ fontFamily: fontes.negrito, fontSize: 17, color: corTexto }}>{titulo}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Campo({ rotulo, style, ...props }: TextInputProps & { rotulo: string }) {
  const { cores } = useTema();
  return (
    <View style={{ gap: 6 }}>
      <Texto variante="rotulo">{rotulo}</Texto>
      <TextInput
        placeholderTextColor={cores.textoSuave}
        style={[
          estilos.campo,
          { backgroundColor: cores.cartao, borderColor: cores.borda, color: cores.texto },
          style,
        ]}
        {...props}
      />
    </View>
  );
}

export function Cartao({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { cores } = useTema();
  return (
    <View style={[estilos.cartao, { backgroundColor: cores.cartao, borderColor: cores.borda }, style]}>
      {children}
    </View>
  );
}

// Grupo de opções lado a lado (ex.: Mãe / Pai / Outro).
export function Escolha<T extends string>({
  rotulo,
  opcoes,
  valor,
  onChange,
}: {
  rotulo: string;
  opcoes: { valor: T; titulo: string }[];
  valor: T | null;
  onChange: (valor: T) => void;
}) {
  const { cores } = useTema();
  return (
    <View style={{ gap: 6 }}>
      <Texto variante="rotulo">{rotulo}</Texto>
      <View style={estilos.linha}>
        {opcoes.map((o) => {
          const ativo = o.valor === valor;
          return (
            <Pressable
              key={o.valor}
              accessibilityRole="radio"
              accessibilityState={{ selected: ativo }}
              onPress={() => onChange(o.valor)}
              style={[
                estilos.opcao,
                {
                  backgroundColor: ativo ? cores.primaria : cores.cartao,
                  borderColor: ativo ? cores.primaria : cores.borda,
                },
              ]}>
              <Text
                style={{
                  fontFamily: fontes.negrito,
                  fontSize: 16,
                  color: ativo ? cores.textoNaPrimaria : cores.texto,
                }}>
                {o.titulo}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Aviso({ texto, tipo = 'erro' }: { texto: string | null; tipo?: 'erro' | 'info' }) {
  const { cores } = useTema();
  if (!texto) return null;
  return (
    <Texto
      accessibilityRole="alert"
      style={{ color: tipo === 'erro' ? cores.perigo : cores.textoSuave, textAlign: 'center' }}>
      {texto}
    </Texto>
  );
}

const estilos = StyleSheet.create({
  conteudo: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    padding: 20,
    gap: 16,
  },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  botao: {
    minHeight: ALVO_TOQUE,
    borderRadius: raio.botao,
    borderWidth: 1.5,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  campo: {
    minHeight: ALVO_TOQUE,
    borderRadius: raio.botao,
    borderWidth: 1.5,
    paddingHorizontal: 18,
    fontFamily: fontes.media,
    fontSize: 17,
  },
  cartao: {
    borderRadius: raio.cartao,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  opcao: {
    flex: 1,
    minHeight: ALVO_TOQUE,
    borderRadius: raio.botao,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
