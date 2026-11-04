# Images de démonstration sur Cloudinary (story 2.9)

Le script `scripts/upload-images.ts` a envoyé sur Cloudinary une image pour chacune des huit œuvres du
catalogue de démonstration (artistes célèbres recopiés en base par l'ancien `prisma/seed.ts`). Depuis la
story 2.9, ces œuvres ne sont plus visibles sur le site (leurs artistes n'ont pas d'accord signé
enregistré) et le seed ne les crée plus. Les images, elles, restent sur Cloudinary.

**Aucune suppression n'est faite par le code ni par la CI.** La suppression revient au porteur, après
confirmation des droits (certaines images proviennent de collections ouvertes du Metropolitan Museum of
Art ou de Wikimedia Commons ; il faut vérifier qu'aucune n'est réutilisée ailleurs avant de la retirer).

## Où les trouver

- Compte Cloudinary : `djiu4tirq`.
- Dossier : `errancy/artworks/` (envoi non signé, préréglage `errancy_artworks`, `public_id` = slug de l'œuvre).
  Selon le réglage du préréglage, l'identifiant complet est `errancy/artworks/<slug>` (dossier + identifiant) ;
  vérifiez-le dans la médiathèque avant toute action.
- Les photos déposées par les vrais artistes sont ailleurs, sous `errancy/oeuvres/<id>/` (story 2.5) :
  ne touchez jamais à ce dossier.

## Liste

| Slug (identifiant Cloudinary) | Œuvre de démonstration | Image réellement envoyée (source) |
|---|---|---|
| `pumpkin-yellow-1994` | Pumpkin (Yellow) — Yayoi Kusama | Wikimedia Commons, fichier `Yayoi_Kusama_Pumpkin.jpg` |
| `a-subtlety-2014` | A Subtlety — Kara Walker | Paul Gauguin, *Ia Orana Maria*, 1891 (MET n° 438821, `DT1025.jpg`) |
| `infinity-nets-1958` | Infinity Nets — Yayoi Kusama | Vincent van Gogh, *L'Arlésienne*, 1888–1889 (MET n° 436529, `DT1396.jpg`) |
| `friendship-1963` | Friendship — Agnes Martin | Gustav Klimt, *Serena Pulitzer Lederer*, 1899 (MET n° 436820, `DP-18885-001.jpg`) |
| `orange-red-yellow` | Orange, Red, Yellow — Mark Rothko | Pierre Paul Rubens, *Forêt à l'aube avec une chasse au cerf*, vers 1635 (MET n° 437526, `DP-25739-001.jpg`) |
| `no-61-rust-and-blue` | No. 61 (Rust and Blue) — Mark Rothko | Édouard Manet, *Madame Manet à Bellevue*, 1880 (MET n° 438002, `DT4224.jpg`) |
| `hollywood-africans-1983` | Hollywood Africans — Jean-Michel Basquiat | Paul Cézanne, *Madame Cézanne à la robe rouge*, 1888–1890 (MET n° 435876, `DP320128.jpg`) |
| `untitled-skull-1981` | Untitled (Skull) — Jean-Michel Basquiat | Pieter Claesz, *Nature morte au crâne et à la plume*, 1628 (MET n° 435904, `DP145929.jpg`) |

## Ce qui n'est pas sur Cloudinary

Les portraits et images de couverture des artistes et des expositions de démonstration (`imageUrl`,
`coverUrl`) pointent directement vers Wikimedia Commons : rien à supprimer côté Cloudinary.

## Contrôle en lecture seule (éditeur SQL de Neon)

Œuvres dont l'image est encore une image de démonstration :

```sql
SELECT a."slug", a."imageUrl", ar."name", ar."accordSigneLe"
FROM "Artwork" a JOIN "Artist" ar ON ar."id" = a."artistId"
WHERE a."imageUrl" LIKE '%/errancy/artworks/%'
ORDER BY a."slug";
```

Avant de supprimer une image, assurez-vous que cette requête ne la liste plus, ou que l'œuvre concernée
est bien une œuvre de démonstration (artiste sans accord signé). La suppression des lignes de
démonstration en base viendra plus tard (story 2.10 ou à part, décision du porteur du 2026-11-04).
