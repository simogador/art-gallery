import { cookies } from 'next/headers'
import { Hero, SectionOeuvres, ParcourirGalerie, CollectionVide, Artists, Exhibitions } from '@/components/sections'
import { BoutonConseil } from '@/components/ui/BoutonConseil'
import { accueilPublic } from '@/lib/catalogue'
import { fr } from '@/lib/i18n'
import { COOKIE_PAYS, lirePays, nomPays } from '@/lib/livraison'

// Story 3.10 (FR-18) : accueil curatorial. Sélection de l'équipe (œuvres marquées, vendues exclues)
// puis dernières œuvres publiées, en vignettes de la galerie qui mènent à la fiche, et « Parcourir
// la galerie ». Tout se lit par le module catalogue (règle VISIBLE, cache de 60 s) ; le prix livré
// vers le pays du visiteur (cookie `pays`) rend la page par requête. Sans œuvre marquée, la
// sélection est absente ; sans œuvre visible, l'état vide s'affiche ; les sections artistes et
// expositions vides sont masquées.
export default async function HomePage() {
  const pays = lirePays(cookies().get(COOKIE_PAYS)?.value)
  const paysNom = nomPays(pays)
  const { artistes, expositions, miseEnAvant, selection, nouveautes, chiffres } = await accueilPublic(pays)
  const aDesOeuvres = selection.length > 0 || nouveautes.length > 0
  return (
    <>
      <Hero
        oeuvre={miseEnAvant}
        chiffres={chiffres}
        expositionEnCours={expositions.some((e) => e.status === 'en-cours')}
      />
      {selection.length > 0 && (
        <SectionOeuvres id="selection" {...fr.accueil.selection} oeuvres={selection} paysNom={paysNom} />
      )}
      {nouveautes.length > 0 && (
        <SectionOeuvres id="nouveautes" {...fr.accueil.nouveautes} oeuvres={nouveautes} paysNom={paysNom} />
      )}
      {!aDesOeuvres && <CollectionVide />}
      <ParcourirGalerie />
      <section aria-label={fr.conseilWhatsApp.section} className="container-premium py-12 text-center">
        <BoutonConseil className="inline-block" />
      </section>
      {artistes.length > 0 && <Artists artists={artistes} />}
      {expositions.length > 0 && <Exhibitions exhibitions={expositions} />}
    </>
  )
}
