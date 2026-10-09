// Datas de nascimento são guardadas como 'AAAA-MM-DD' e tratadas no fuso local.

export function dataLocal(iso: string) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
}

// Idade em meses completos e dias que sobram.
export function idade(nascimento: string, hoje = new Date()) {
  const nasc = dataLocal(nascimento);
  let meses = (hoje.getFullYear() - nasc.getFullYear()) * 12 + (hoje.getMonth() - nasc.getMonth());
  if (hoje.getDate() < nasc.getDate()) meses--;
  // "Mesversário" deste mês; quem nasceu dia 31 faz mês no último dia dos meses mais curtos.
  const ultimoDia = new Date(nasc.getFullYear(), nasc.getMonth() + meses + 1, 0).getDate();
  const inicioDoMes = new Date(nasc.getFullYear(), nasc.getMonth() + meses, Math.min(nasc.getDate(), ultimoDia));
  const dias = Math.round((new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime() - inicioDoMes.getTime()) / 86_400_000);
  return { meses: Math.max(meses, 0), dias: Math.max(dias, 0) };
}

function plural(n: number, um: string, varios: string) {
  return `${n} ${n === 1 ? um : varios}`;
}

export function idadeTexto(nascimento: string, hoje = new Date()) {
  if (dataLocal(nascimento) > hoje) return 'ainda vai nascer';
  const { meses, dias } = idade(nascimento, hoje);
  if (meses === 0) return dias === 0 ? 'nasceu hoje' : plural(dias, 'dia', 'dias');
  if (meses < 24) {
    const m = plural(meses, 'mês', 'meses');
    return dias ? `${m} e ${plural(dias, 'dia', 'dias')}` : m;
  }
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  const a = plural(anos, 'ano', 'anos');
  return resto ? `${a} e ${plural(resto, 'mês', 'meses')}` : a;
}

// Fases do PRD: a home muda o destaque conforme a idade.
export type Fase = 'mamadas' | 'introducao' | 'crianca';

export function fase(nascimento: string, hoje = new Date()): Fase {
  const { meses } = idade(nascimento, hoje);
  if (meses < 6) return 'mamadas';
  if (meses < 12) return 'introducao';
  return 'crianca';
}

// Conversão entre 'DD/MM/AAAA' (digitado) e 'AAAA-MM-DD' (banco).
export function paraISO(texto: string): string | null {
  const m = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mes, a] = m;
  const data = new Date(Number(a), Number(mes) - 1, Number(d));
  if (data.getDate() !== Number(d) || data.getMonth() !== Number(mes) - 1) return null;
  return `${a}-${mes}-${d}`;
}

export function deISO(iso: string) {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

// Máscara enquanto digita: 01022026 -> 01/02/2026.
export function mascaraData(texto: string) {
  const n = texto.replace(/\D/g, '').slice(0, 8);
  if (n.length <= 2) return n;
  if (n.length <= 4) return `${n.slice(0, 2)}/${n.slice(2)}`;
  return `${n.slice(0, 2)}/${n.slice(2, 4)}/${n.slice(4)}`;
}

export function hojeISO(agora = new Date()) {
  const m = String(agora.getMonth() + 1).padStart(2, '0');
  const d = String(agora.getDate()).padStart(2, '0');
  return `${agora.getFullYear()}-${m}-${d}`;
}
