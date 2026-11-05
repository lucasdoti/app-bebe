// O que fica no aparelho depois de "Sair da conta": o tema, a sessão (o próprio signOut cuida dela),
// um convite ainda não usado e o que o convidado guardou na página pública do chá.
// Todo o resto é dado da família e sai: registros, ficha de saúde, enxoval, localização...
export function fica(chave: string) {
  return chave === 'modo_tema' || chave === 'convite_pendente' || chave.startsWith('sb-') || chave.startsWith('cha_');
}

export const chavesDaConta = (chaves: string[]) => chaves.filter((c) => !fica(c));
