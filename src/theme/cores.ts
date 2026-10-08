// Paleta pastel. Cada tipo de registro tem sempre a mesma cor (botões, linha do tempo, gráficos).
export const paletaDia = {
  fundo: '#FFF8F0',
  cartao: '#FFFFFF',
  borda: '#F1E6D8',
  texto: '#3D3550',
  textoSuave: '#857B94',
  primaria: '#F4A7BB',
  textoNaPrimaria: '#3D2A35',
  perigo: '#C2546B',
  mamada: '#F7B6C8',
  sono: '#C9B6F2',
  fralda: '#F9DE8B',
  medidas: '#A8E6CF',
  clima: '#A7D3F5',
};

// Noite: azul-marinho bem escuro e pastéis dessaturados, com pouco brilho.
export const paletaNoite: typeof paletaDia = {
  fundo: '#0B1020',
  cartao: '#141B30',
  borda: '#232C46',
  texto: '#BFC3D9',
  textoSuave: '#767E9C',
  primaria: '#8E6574',
  textoNaPrimaria: '#F1E3E8',
  perigo: '#C77A8A',
  mamada: '#8E6574',
  sono: '#6F6293',
  fralda: '#8C7E52',
  medidas: '#5D8576',
  clima: '#5C7B95',
};

export type Paleta = typeof paletaDia;

export const fontes = {
  regular: 'Nunito_400Regular',
  media: 'Nunito_600SemiBold',
  negrito: 'Nunito_700Bold',
  extra: 'Nunito_800ExtraBold',
};

export const raio = { cartao: 24, botao: 20 };

// Alvo de toque mínimo, pensado para uma mão só.
export const ALVO_TOQUE = 56;
