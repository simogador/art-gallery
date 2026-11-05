// Story 3.2 (décision du porteur du 2026-11-05, comme en 3.1) : fichiers des surfaces de l'epic 3
// pas encore refaits, exemptés de la règle react/jsx-no-literals (textes visibles en dur) de
// .eslintrc.js. Fichiers nommés un à un (un nouveau fichier n'est jamais exempté). Cette liste ne
// fait que diminuer : chaque story qui refait une de ces pages en passe les textes au dictionnaire
// (src/lib/i18n/fr.ts) et la retire ; la CI échoue si une entrée y est ajoutée
// (scripts/verifier-exceptions-prisma.cjs origin/main eslint/exceptions-textes.cjs).
module.exports = [
  'src/app/artistes/ArtistsList.tsx', // story 3.11
  'src/app/artistes/[id]/ArtistProfile.tsx', // story 3.11
  'src/app/galerie/GalleryPage.tsx', // galerie, story 3.9
  'src/app/galerie/[id]/ArtworkDetail.tsx', // fiche, stories 3.5 à 3.8
  'src/components/sections/Artists.tsx', // accueil, story 3.10
  'src/components/sections/Exhibitions.tsx', // accueil, story 3.10
  'src/components/sections/Gallery.tsx', // accueil, story 3.10
  'src/components/sections/Hero.tsx', // accueil, story 3.10
]
