// Fichiers qui importent encore Prisma hors des modules métier (AD-1, story 1.6).
// Cette liste ne fait que diminuer : on en retire un fichier quand il passe par un
// module de src/lib/<module>/. La CI échoue si une entrée y est ajoutée.
module.exports = [
  'prisma/seed.ts',
  'scripts/upload-images.ts',
  'src/app/api/admin/artistes/[id]/route.ts',
  'src/app/api/admin/oeuvres/[slug]/route.ts',
  'src/app/api/admin/utilisateurs/[id]/route.ts',
  'src/app/api/artiste/oeuvres/[slug]/route.ts',
  'src/app/api/artiste/oeuvres/route.ts',
  'src/app/api/checkout/route.ts',
  'src/app/api/upload/route.ts',
  'src/app/api/webhooks/stripe/route.ts',
  'src/app/auth/actions.ts',
  'src/app/confirmation/page.tsx',
  'src/app/dashboard/admin/artistes/page.tsx',
  'src/app/dashboard/admin/oeuvres/[slug]/page.tsx',
  'src/app/dashboard/admin/oeuvres/page.tsx',
  'src/app/dashboard/admin/page.tsx',
  'src/app/dashboard/admin/utilisateurs/[id]/page.tsx',
  'src/app/dashboard/admin/utilisateurs/page.tsx',
  'src/app/dashboard/artiste/oeuvres/[slug]/page.tsx',
  'src/app/dashboard/artiste/oeuvres/nouvelle/page.tsx',
  'src/app/dashboard/artiste/oeuvres/page.tsx',
  'src/app/dashboard/artiste/page.tsx',
]
