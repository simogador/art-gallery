import type { ChoixConsentement } from './regles'

// Taux de consentement et de refus (story 4.8) : un compteur par jour (UTC) et par choix, sans
// identifiant, sans IP, sans cookie. Seul fichier du module qui touche la base ; le client Prisma est
// importé à l'appel, pour que les actions et les pages qui mesurent n'ouvrent pas de connexion à leur chargement.

export function jourUtc(instant: Date): Date {
  return new Date(Date.UTC(instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate()))
}

export async function compterChoix(choix: ChoixConsentement, instant: Date = new Date()): Promise<void> {
  const { prisma } = await import('@/lib/prisma')
  const jour = jourUtc(instant)
  // Une seule instruction atomique : deux premiers choix du jour simultanés ne perdent aucun compte.
  await prisma.$executeRaw`
    INSERT INTO "CompteurChoixMesure" ("jour", "choix", "nombre")
    VALUES (${jour}::date, ${choix}::"ChoixMesure", 1)
    ON CONFLICT ("jour", "choix") DO UPDATE SET "nombre" = "CompteurChoixMesure"."nombre" + 1`
}
