// Links de produto: só http/https, completando o "https://" quando a pessoa cola sem ele.

export function normalizarLink(texto: string): string | null {
  const t = texto.trim();
  if (!t) return null;
  const comEsquema = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const url = new URL(comEsquema);
    if (!/^https?:$/.test(url.protocol) || !url.hostname.includes('.')) return null;
    return comEsquema.slice(0, 500);
  } catch {
    return null;
  }
}

// "amazon.com.br" a partir do link, para saber de que loja é antes de abrir.
export function siteDoLink(link: string) {
  try {
    return new URL(link).hostname.replace(/^www\./, '');
  } catch {
    return link;
  }
}

export const linkSeguro = (link: string | null | undefined): link is string => !!link && /^https?:\/\//i.test(link);
