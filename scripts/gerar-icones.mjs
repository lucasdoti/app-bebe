// Gera todos os ícones do app a partir de assets/logo/colinho-arte.svg.
// Uso: node scripts/gerar-icones.mjs
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';

const CREME = '#FFF8F0';
const arte = readFileSync('assets/logo/colinho-arte.svg', 'utf8')
  .replace(/<svg[^>]*>/, '')
  .replace('</svg>', '');

const svg = (conteudo) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${conteudo}</svg>`;
const centralizado = (escala, conteudo) => {
  const d = (1024 * (1 - escala)) / 2;
  return `<g transform="translate(${d} ${d}) scale(${escala})">${conteudo}</g>`;
};
const fundo = `<rect width="1024" height="1024" fill="${CREME}"/>`;
const arredondado = `<rect width="1024" height="1024" rx="224" fill="${CREME}"/>`;
// Ícone monocromático do Android: só as formas, numa cor.
const mono = arte
  .replace(/fill="#[0-9A-Fa-f]{6}"/g, 'fill="#000000"')
  .replace(/<path d="M4\d\d 550[^>]*\/>/g, '')
  .replace(/<path d="M5\d\d 550[^>]*\/>/g, '')
  .replace(/<circle cx="(426|598)"[^>]*\/>/g, '');

const saidas = [
  ['assets/images/icon.png', svg(fundo + arte), 1024],
  ['assets/images/splash-icon.png', svg(arte), 1024],
  ['assets/images/favicon.png', svg(arredondado + arte), 48],
  ['assets/images/logo.png', svg(arredondado + arte), 512],
  ['assets/images/android-icon-foreground.png', svg(centralizado(0.62, arte)), 1024],
  ['assets/images/android-icon-background.png', svg(fundo), 1024],
  ['assets/images/android-icon-monochrome.png', svg(centralizado(0.62, mono)), 1024],
  ['public/icon-192.png', svg(fundo + arte), 192],
  ['public/icon-512.png', svg(fundo + arte), 512],
  ['public/icon-maskable-512.png', svg(fundo + centralizado(0.8, arte)), 512],
  ['public/apple-touch-icon.png', svg(fundo + arte), 180],
];

for (const [arquivo, conteudo, tamanho] of saidas) {
  writeFileSync(arquivo, new Resvg(conteudo, { fitTo: { mode: 'width', value: tamanho } }).render().asPng());
  console.log(`${arquivo} (${tamanho}px)`);
}
