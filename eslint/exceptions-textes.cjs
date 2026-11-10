// Story 3.2 (décision du porteur du 2026-11-05, comme en 3.1) : fichiers des surfaces de l'epic 3
// pas encore refaits, exemptés de la règle react/jsx-no-literals (textes visibles en dur) de
// .eslintrc.js. Fichiers nommés un à un (un nouveau fichier n'est jamais exempté). Cette liste ne
// fait que diminuer : chaque story qui refait une de ces pages en passe les textes au dictionnaire
// (src/lib/i18n/fr.ts) et la retire ; la CI échoue si une entrée y est ajoutée
// (scripts/verifier-exceptions-prisma.cjs origin/main eslint/exceptions-textes.cjs).
module.exports = [
  'src/app/galerie/[id]/ArtworkDetail.tsx', // fiche, stories 3.5 à 3.8
]
