import { Alert, Platform } from 'react-native';

// Pergunta antes de ações que apagam algo. No web, Alert.alert não mostra botões.
export function confirmar(pergunta: string, rotulo: string, aoConfirmar: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(pergunta)) aoConfirmar();
    return;
  }
  Alert.alert(pergunta, undefined, [
    { text: 'Cancelar', style: 'cancel' },
    { text: rotulo, style: 'destructive', onPress: aoConfirmar },
  ]);
}
