// Ficha de saúde: tipos e a comparação usada nos avisos ("está na lista a evitar").

export type TipoSaude = 'pezinho' | 'condicao' | 'evitar_remedio' | 'evitar_alimento' | 'alergia' | 'fonte';
export type StatusSaude = 'pendente' | 'normal' | 'alterado' | 'investigacao' | 'confirmado' | 'descartado';

export type ItemSaude = {
  id: string;
  bebe_id: string;
  tipo: TipoSaude;
  nome: string;
  status: StatusSaude | null;
  data: string | null;
  detalhe: string | null;
};

export const nomeStatus: Record<StatusSaude, string> = {
  pendente: 'Aguardando resultado',
  normal: 'Normal',
  alterado: 'Alterado',
  investigacao: 'Em investigação (reteste)',
  confirmado: 'Confirmado',
  descartado: 'Descartado',
};

// Sem acento e em minúsculas: "Dipirona Sódica" e "dipirona" se encontram.
export const normalizar = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// Palavras genéricas de bula e de comida que sozinhas não identificam nada ("ácido fólico" não é AAS).
const GENERICAS = new Set([
  'acido', 'sodico', 'sodica', 'potassio', 'infantil', 'gotas', 'xarope', 'comprimido', 'comprimidos', 'pediatrico',
  'pediatrica', 'solucao', 'suspensao', 'creme', 'pomada', 'injetavel', 'capsula', 'capsulas', 'oral', 'mais', 'para',
  'com', 'sem', 'leite', 'feijao', 'farinha', 'suco', 'molho', 'caldo',
]);

// Palavras que identificam o item. Na lista, siglas em maiúsculas de 3 letras também contam (AAS).
const palavras = (t: string, siglas = false) =>
  t
    .split(/[^A-Za-zÀ-ÿ0-9]+/)
    .filter((p) => p)
    .map((p) => ({ p: normalizar(p), sigla: p.length === 3 && p === p.toUpperCase() && /[A-Z]/.test(p) }))
    .filter(({ p, sigla }) => (p.length >= 4 && !GENERICAS.has(p)) || (siglas ? sigla : p.length === 3))
    .map(({ p }) => p);

// Itens da lista que aparecem no texto (nome de remédio ou de alimento).
// Compara palavra a palavra: "Dipirona (Novalgina)" encontra "Novalgina gotas".
export function itensNaLista(texto: string, lista: ItemSaude[]) {
  const alvo = normalizar(texto);
  if (alvo.trim().length < 3) return [];
  const doTexto = new Set(palavras(texto));
  return lista.filter((i) => {
    const nome = normalizar(i.nome).trim();
    if (nome.length >= 3 && (alvo.includes(nome) || nome.includes(alvo.trim()))) return true;
    return palavras(i.nome, true).some((p) => doTexto.has(p));
  });
}

const dataBR = (iso: string) => iso.split('-').reverse().join('/');

// Texto para levar ao médico ou mandar pelo WhatsApp: o que é importante saber antes de receitar.
export function textoDaFicha(nome: string, ficha: ItemSaude[]) {
  const de = (t: TipoSaude) => ficha.filter((i) => i.tipo === t);
  const linhas = [`*Ficha de saúde de ${nome}*`];
  const condicoes = de('condicao').filter((c) => c.status !== 'descartado');
  if (condicoes.length) {
    linhas.push('', '*⚠️ Condições*');
    for (const c of condicoes)
      linhas.push(`• ${c.nome}${c.status ? ` (${nomeStatus[c.status].toLowerCase()})` : ''}${c.detalhe ? ` – ${c.detalhe}` : ''}`);
  }
  const blocos: [TipoSaude, string][] = [
    ['evitar_remedio', '🚫 Remédios e substâncias a evitar'],
    ['evitar_alimento', '🚫 Alimentos a evitar'],
    ['alergia', '⚠️ Alergias'],
  ];
  for (const [tipo, titulo] of blocos) {
    const lista = de(tipo);
    if (!lista.length) continue;
    linhas.push('', `*${titulo}*`);
    for (const i of lista) linhas.push(`• ${i.nome}${i.detalhe ? ` – ${i.detalhe}` : ''}`);
  }
  const fonte = de('fonte')[0];
  if (fonte) linhas.push('', `_Lista: ${fonte.nome}_`);
  const pezinho = de('pezinho')[0];
  if (pezinho)
    linhas.push(
      '',
      `*Teste do pezinho*: ${pezinho.status ? nomeStatus[pezinho.status] : 'sem resultado'}${pezinho.data ? ` (coleta em ${dataBR(pezinho.data)})` : ''}${pezinho.detalhe ? ` – ${pezinho.detalhe}` : ''}`,
    );
  if (linhas.length === 1) linhas.push('', 'Nenhuma condição, restrição ou alergia anotada.');
  return linhas.join('\n');
}

// Cola de vários itens de uma vez (um por linha, ou separados por vírgula/ponto e vírgula).
export function separarLista(texto: string) {
  return [
    ...new Set(
      texto
        .split(/[\n;,]+/)
        .map((l) => l.replace(/^[\s•\-*\d.)]+/, '').trim())
        .filter((l) => l.length >= 2)
        .map((l) => l.slice(0, 120)),
    ),
  ];
}
