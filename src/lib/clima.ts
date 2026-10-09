// Open-Meteo: gratuita e sem chave. Chamada direto do app (PRD: "Clima").
import type { NomeIcone } from '@/components/home';
import type { Previsao } from './roupa';

export type Local = { lat: number; lon: number; nome: string | null };

export type Hora = { hora: string; temp: number; sensacao: number; chuvaProb: number; codigo: number; vento: number };

export type Clima = {
  atual: {
    temp: number;
    sensacao: number;
    umidade: number;
    chuvaMm: number;
    codigo: number;
    vento: number;
    dia: boolean;
  };
  /** Hora atual e as 6 seguintes. */
  horas: Hora[];
  obtidoEm: number;
};

export type Cidade = { nome: string; regiao: string; lat: number; lon: number };

export async function buscarClima({ lat, lon }: Local): Promise<Clima> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(3),
    longitude: lon.toFixed(3),
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m',
    hourly: 'temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m',
    forecast_hours: '7',
    timezone: 'auto',
  });
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!r.ok) throw new Error('Não foi possível buscar o clima agora.');
  const j = await r.json();
  const h = j.hourly;
  return {
    atual: {
      temp: j.current.temperature_2m,
      sensacao: j.current.apparent_temperature,
      umidade: j.current.relative_humidity_2m,
      chuvaMm: j.current.precipitation,
      codigo: j.current.weather_code,
      vento: j.current.wind_speed_10m,
      dia: j.current.is_day === 1,
    },
    horas: (h.time as string[]).map((t, i) => ({
      hora: t.slice(11, 16),
      temp: h.temperature_2m[i],
      sensacao: h.apparent_temperature[i],
      chuvaProb: h.precipitation_probability[i] ?? 0,
      codigo: h.weather_code[i],
      vento: h.wind_speed_10m[i],
    })),
    obtidoEm: Date.now(),
  };
}

export async function buscarCidades(nome: string): Promise<Cidade[]> {
  const params = new URLSearchParams({ name: nome, count: '5', language: 'pt', format: 'json' });
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
  if (!r.ok) throw new Error('Não foi possível buscar a cidade agora.');
  const j = await r.json();
  return (j.results ?? []).map((c: { name: string; admin1?: string; country?: string; latitude: number; longitude: number }) => ({
    nome: c.name,
    regiao: [c.admin1, c.country].filter(Boolean).join(', '),
    lat: c.latitude,
    lon: c.longitude,
  }));
}

// Resumo das próximas 6 h para os avisos do passeio.
export function previsao6h(c: Clima): Previsao {
  const proximas = c.horas.slice(1);
  let minima = proximas[0];
  for (const h of proximas) if (h.sensacao < minima.sensacao) minima = h;
  return {
    queda: minima ? c.atual.sensacao - minima.sensacao : 0,
    horaMinima: minima ? minima.hora.replace(':00', 'h') : null,
    chuva: c.atual.chuvaMm > 0 || c.horas.some((h) => h.chuvaProb >= 50),
    ventoForte: Math.max(c.atual.vento, ...c.horas.map((h) => h.vento)) >= 25,
  };
}

// Códigos de tempo da OMM usados pela Open-Meteo.
export function descricaoTempo(codigo: number, dia = true): { texto: string; icone: NomeIcone } {
  if (codigo === 0) return { texto: 'Céu limpo', icone: dia ? 'weather-sunny' : 'weather-night' };
  if (codigo <= 2) return { texto: 'Parcialmente nublado', icone: dia ? 'weather-partly-cloudy' : 'weather-night-partly-cloudy' };
  if (codigo === 3) return { texto: 'Nublado', icone: 'weather-cloudy' };
  if (codigo <= 48) return { texto: 'Neblina', icone: 'weather-fog' };
  if (codigo <= 57) return { texto: 'Garoa', icone: 'weather-rainy' };
  if (codigo <= 67) return { texto: 'Chuva', icone: 'weather-pouring' };
  if (codigo <= 77) return { texto: 'Neve', icone: 'weather-snowy' };
  if (codigo <= 82) return { texto: 'Pancadas de chuva', icone: 'weather-pouring' };
  return { texto: 'Tempestade', icone: 'weather-lightning-rainy' };
}
