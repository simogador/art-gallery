// Remplace `next/image` dans les tests navigateur (alias de vitest.navigateur.config.mts) : une simple
// balise `img`, sans requête vers /_next/image ni vers l'extérieur.
type Props = { src: string; alt: string; fill?: boolean; priority?: boolean; sizes?: string; [autre: string]: unknown }

export default function Image({ src, alt, fill: _fill, priority: _priority, sizes: _sizes, ...reste }: Props) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} {...reste} />
}
