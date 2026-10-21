import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ALVO_TOQUE, fontes } from '@/theme/cores';
import { useTema } from '@/theme/tema';

type Oferta = { texto: string; desfazer: () => Promise<unknown> | void };

// "Item apagado · Desfazer" por alguns segundos, no lugar de pedir confirmação antes de apagar.
// Uso: const { oferecer, barra } = useDesfazer(); ... <Tela rodape={barra}>
export function useDesfazer(segundos = 7) {
  const { cores } = useTema();
  const [oferta, setOferta] = useState<Oferta | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function oferecer(texto: string, desfazer: Oferta['desfazer']) {
    clearTimeout(timer.current);
    setOferta({ texto, desfazer });
    timer.current = setTimeout(() => setOferta(null), segundos * 1000);
  }

  const barra = oferta ? (
    <View
      accessibilityRole="alert"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: cores.texto,
        borderRadius: 16,
        paddingLeft: 16,
        minHeight: ALVO_TOQUE,
      }}>
      <Text style={{ flex: 1, fontFamily: fontes.media, fontSize: 15, color: cores.fundo }}>{oferta.texto}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={async () => {
          const o = oferta;
          setOferta(null);
          clearTimeout(timer.current);
          await o.desfazer();
        }}
        style={{ minHeight: ALVO_TOQUE, paddingHorizontal: 16, justifyContent: 'center' }}>
        <Text style={{ fontFamily: fontes.extra, fontSize: 15, color: cores.fundo }}>Desfazer</Text>
      </Pressable>
    </View>
  ) : undefined;

  return { oferecer, barra };
}
