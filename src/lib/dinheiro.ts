// Valores em reais: formatação, máscara de digitação e parcelas.

const formato = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const reais = (v: number) => formato.format(v).replace(/ /g, ' ');

// Máscara enquanto digita, em centavos: "12345" -> "123,45"; "1234567" -> "12.345,67".
export function mascaraDinheiro(texto: string) {
  const n = texto.replace(/\D/g, '').replace(/^0+/, '').slice(0, 9);
  if (!n) return '';
  const centavos = n.padStart(3, '0');
  const inteiro = centavos.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${inteiro},${centavos.slice(-2)}`;
}

export function paraNumero(texto: string): number | null {
  if (!texto.trim()) return null;
  const n = Number(texto.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export const paraTextoDinheiro = (v: number | null) => (v === null ? '' : mascaraDinheiro(v.toFixed(2)));

export type FormaPagamento = 'pix' | 'debito' | 'credito' | 'dinheiro' | 'boleto';

export const nomeForma: Record<FormaPagamento, string> = {
  pix: 'Pix',
  debito: 'Débito',
  credito: 'Crédito',
  dinheiro: 'Dinheiro',
  boleto: 'Boleto',
};

// Parcelas de uma compra no crédito: estimativa de uma por mês, a partir do mês seguinte à compra.
export function parcelasDoMes(valor: number, parcelas: number, dataCompra: string) {
  const [a, m] = dataCompra.split('-').map(Number);
  const valorParcela = valor / parcelas;
  return Array.from({ length: parcelas }, (_, i) => {
    const d = new Date(a, m - 1 + i + 1, 1);
    return { mes: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, valor: valorParcela, numero: i + 1 };
  });
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function rotuloMes(mes: string) {
  const [a, m] = mes.split('-').map(Number);
  return `${MESES[m - 1]}/${String(a).slice(2)}`;
}
