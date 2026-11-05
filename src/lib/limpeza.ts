// O que fica no aparelho depois de "Sair da conta": o tema, a sessão (o próprio signOut cuida dela),
// um convite ainda não usado e o que o convidado guardou na página pública do chá.
// Todo o resto é dado da família e sai: registros, ficha de saúde, enxoval, localização...
export function fica(chave: string) {
  return chave === 'modo_tema' || chave === 'convite_pendente' || chave.startsWith('sb-') || chave.startsWith('cha_');
}

export const chavesDaConta = (chaves: string[]) => chaves.filter((c) => !fica(c));

// Ordem de "Sair da conta": cancelar as notificações exige ainda estar logado, então vem primeiro.
// Sem internet ou com demora, o cancelamento não pode impedir a saída.
export async function encerrarSessao(passos: {
  cancelarNotificacoes: () => Promise<unknown>;
  sairDoAparelho: () => Promise<unknown>;
  limparDados: () => void;
  limiteMs?: number;
}) {
  let relogio: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise((ok) => {
    relogio = setTimeout(ok, passos.limiteMs ?? 3000);
  });
  await Promise.race([passos.cancelarNotificacoes().catch(() => {}), limite]);
  clearTimeout(relogio);
  await passos.sairDoAparelho();
  passos.limparDados();
}
