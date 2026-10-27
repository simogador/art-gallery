import { NextResponse } from 'next/server'
import { acteurCourant } from '@/lib/acces'
import { listerInscriptionsOuverture } from '@/lib/demandes'

// Export CSV des inscrits de la page de maintenance, réservé aux admins (FR-35).

function cellule(valeur: string): string {
  // Guillemets doublés, et neutralisation des formules pour les tableurs.
  const sure = /^[=+\-@\t\r]/.test(valeur) ? `'${valeur}` : valeur
  return `"${sure.replace(/"/g, '""')}"`
}

export async function GET() {
  if ((await acteurCourant()).type !== 'admin') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const inscrits = await listerInscriptionsOuverture()
  const lignes = [
    'email,consentement_le',
    ...inscrits.map((i) => `${cellule(i.email)},${cellule(i.consentementLe.toISOString())}`),
  ]
  const date = new Date().toISOString().slice(0, 10)
  // CRLF (RFC 4180) et BOM UTF-8, pour qu'Excel lise correctement les accents.
  return new NextResponse('\uFEFF' + lignes.join('\r\n') + '\r\n', {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="inscrits-ouverture-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
