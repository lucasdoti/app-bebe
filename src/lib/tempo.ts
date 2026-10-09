const MIN = 60_000;
const HORA = 60 * MIN;

// "1h20", "45 min", "2 dias"
export function duracao(ms: number) {
  const min = Math.max(0, Math.floor(ms / MIN));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h >= 48) return `${Math.floor(h / 24)} dias`;
  const resto = min % 60;
  return resto ? `${h}h${String(resto).padStart(2, '0')}` : `${h}h`;
}

// "agora", "há 5 min", "há 1h20"
export function haQuanto(desde: Date | string, agora = new Date()) {
  const ms = agora.getTime() - new Date(desde).getTime();
  if (ms < MIN) return 'agora';
  return `há ${duracao(ms)}`;
}

// Cronômetro "08:32" ou "1:05:10".
export function cronometro(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const seg = String(s % 60).padStart(2, '0');
  return h ? `${h}:${m}:${seg}` : `${m}:${seg}`;
}

export function horaCurta(data: Date | string) {
  const d = new Date(data);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function inicioDoDia(agora = new Date()) {
  return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
}

// Quantos dias antes de hoje (0 = hoje, 1 = ontem).
export function diasAtras(data: Date | string, agora = new Date()) {
  return Math.round((inicioDoDia(agora).getTime() - inicioDoDia(new Date(data)).getTime()) / (24 * HORA));
}

export function rotuloDia(dias: number) {
  return dias === 0 ? 'Hoje' : dias === 1 ? 'Ontem' : `${dias} dias atrás`;
}

// Junta o dia escolhido ("hoje", "ontem") com a hora digitada "HH:MM".
export function combinar(dias: number, hhmm: string, agora = new Date()): Date | null {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  const base = inicioDoDia(agora);
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() - dias, h, min);
}

// Máscara enquanto digita: 1405 -> 14:05.
export function mascaraHora(texto: string) {
  const n = texto.replace(/\D/g, '').slice(0, 4);
  return n.length <= 2 ? n : `${n.slice(0, 2)}:${n.slice(2)}`;
}

export const MINUTO = MIN;
export { HORA };
