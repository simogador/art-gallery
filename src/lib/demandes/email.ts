// Validation d'e-mail, sans accès à la base.

// Adresse qu'un envoi d'e-mail acceptera : caractères usuels, domaine à au moins deux
// segments, pas de points consécutifs, partie locale de 64 caractères au plus.
const FORMAT_EMAIL = /^[a-z0-9._%+'-]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)+$/

export function normaliserEmail(email: unknown): string | null {
  if (typeof email !== 'string') return null
  const propre = email.trim().toLowerCase()
  if (propre.length > 254 || propre.includes('..')) return null
  return FORMAT_EMAIL.test(propre) ? propre : null
}
