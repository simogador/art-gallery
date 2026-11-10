import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { BarreActions } from '@/app/galerie/[id]/BarreActions'
import { fr } from '@/lib/i18n'
import { ChoixMesure } from '@/components/ui/ChoixMesure'

// Barre d'actions de la fiche (story 4.7) : masquée pendant la saisie dans un champ, réaffichée à la sortie.
// Le CSS Tailwind n'est pas chargé : on lit l'attribut `data-saisie` et la présence de `max-lg:hidden`.
const barre = () => document.querySelector(`[aria-label="${fr.fiche.barre.nom}"]`) as HTMLElement

function Page() {
  return (
    <div>
      <input aria-label="champ" type="text" />
      <input aria-label="autre" type="text" />
      <select aria-label="choix"><option>a</option></select>
      <button type="button">bouton</button>
      <BarreActions etat="disponible" slug="nuit" artiste={{ slug: 'kara', nom: 'Kara' }} conseil={<a href="#c">Conseil</a>} />
    </div>
  )
}

describe('BarreActions (navigateur)', () => {
  it('lien de visite vers /galerie/[id]/visite', async () => {
    await render(<Page />)
    expect(barre().querySelector('a[href="/galerie/nuit/visite"]')?.textContent).toBe(fr.fiche.barre.visite)
  })

  it('masquée au focus d’un champ de saisie, réaffichée à la sortie, pas pour un bouton', async () => {
    const ecran = await render(<Page />)
    expect(barre().dataset.saisie).toBe('non')
    await ecran.getByRole('button', { name: 'bouton' }).click()
    expect(barre().dataset.saisie).toBe('non')
    ;(document.querySelector('input[aria-label="champ"]') as HTMLInputElement).focus()
    await expect.poll(() => barre().dataset.saisie).toBe('oui')
    expect(barre().className).toContain('max-lg:hidden')
    ;(document.querySelector('input[aria-label="champ"]') as HTMLInputElement).blur()
    await expect.poll(() => barre().dataset.saisie).toBe('non')
    expect(barre().className).not.toContain('max-lg:hidden')
  })

  it('pas de clignotement d’un champ à l’autre ; un select ne masque pas la barre', async () => {
    await render(<Page />)
    const [a, b] = Array.from(document.querySelectorAll('input')) as HTMLInputElement[]
    a.focus()
    await expect.poll(() => barre().dataset.saisie).toBe('oui')
    b.focus()
    await new Promise((r) => setTimeout(r, 50))
    expect(barre().dataset.saisie).toBe('oui')
    ;(document.querySelector('select') as HTMLSelectElement).focus()
    await expect.poll(() => barre().dataset.saisie).toBe('non')
  })

  it('démarre masquée si un champ a déjà le focus', async () => {
    const hote = document.createElement('input')
    document.body.append(hote)
    hote.focus()
    await render(<Page />)
    await expect.poll(() => barre().dataset.saisie).toBe('oui')
    hote.remove()
  })

  it('le corps de page est dégagé de la hauteur de la barre tant qu’elle est fixe, puis remis à zéro', async () => {
    const style = document.createElement('style')
    style.textContent = `[aria-label="${fr.fiche.barre.nom}"] { position: fixed; bottom: 0; height: 80px; box-sizing: border-box; }`
    document.head.append(style)
    const ecran = await render(<Page />)
    await expect.poll(() => document.body.style.paddingBottom).toBe('80px')
    await ecran.unmount()
    expect(document.body.style.paddingBottom).toBe('')
    style.remove()
  })

  it('la bannière de mesure ouverte soulève la barre (bottom: var(--hauteur-banniere)) et s’ajoute au dégagement du corps', async () => {
    const style = document.createElement('style')
    style.textContent = `[aria-label="${fr.fiche.barre.nom}"] { position: fixed; bottom: var(--hauteur-banniere, 0px); height: 80px; box-sizing: border-box; }`
    document.head.append(style)
    const ecran = await render(<><Page /><ChoixMesure choix={null} /></>)
    const hauteur = () => parseFloat(document.documentElement.style.getPropertyValue('--hauteur-banniere'))
    await expect.poll(hauteur).toBeGreaterThan(0)
    await expect.poll(() => document.body.style.paddingBottom).toBe(`${80 + hauteur()}px`)
    expect(parseFloat(getComputedStyle(barre()).bottom)).toBeCloseTo(hauteur(), 0)
    await ecran.unmount()
    style.remove()
  })
})
