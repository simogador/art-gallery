import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log("Seeding Errancy Gallery...");

  // ── Artistes ──────────────────────────────────────────────────────────────
  const artists = await Promise.all([
    prisma.artist.upsert({
      where: { slug: "mark-rothko" },
      update: {},
      create: {
        slug: "mark-rothko",
        name: "Mark Rothko",
        nationality: "Américain (né en Lettonie)",
        birthYear: 1903,
        deathYear: 1970,
        featured: true,
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Mark_Rothko%2C_1964_%28photograph_by_Jerry_Dantzic%29.jpg/440px-Mark_Rothko%2C_1964_%28photograph_by_Jerry_Dantzic%29.jpg",
        coverUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/No_61_Rust_and_Blue.jpg/1280px-No_61_Rust_and_Blue.jpg",
        bio: "Mark Rothko est l'un des artistes américains les plus importants du XXe siècle. Pionnier de l'expressionnisme abstrait, il développa son style distinctif de «Color Field» painting dans les années 1950, créant des œuvres monumentales composées de rectangles flottants aux couleurs lumineuses et vibrantes.",
        statement: "Je ne suis pas un peintre abstrait. Je ne m'intéresse pas aux relations entre formes et couleurs. La seule chose qui m'intéresse, c'est d'exprimer les émotions humaines fondamentales — tragédie, extase, destin.",
        website: null,
      },
    }),

    prisma.artist.upsert({
      where: { slug: "yayoi-kusama" },
      update: {},
      create: {
        slug: "yayoi-kusama",
        name: "Yayoi Kusama",
        nationality: "Japonaise",
        birthYear: 1929,
        featured: true,
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Yayoi_Kusama_2023_Cropped.jpg/440px-Yayoi_Kusama_2023_Cropped.jpg",
        coverUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Kusama_Infinity_Mirrored_Room.jpg/1280px-Kusama_Infinity_Mirrored_Room.jpg",
        bio: "Yayoi Kusama est une artiste japonaise dont l'œuvre couvre la peinture, la sculpture, les installations et la performance. Connue pour ses motifs de pois et ses installations «Infinity Mirrored Rooms», elle est l'artiste vivante la plus vendue au monde.",
        statement: "Mon art est une expression de ma vie, en particulier de mes maladies mentales. Je veux exprimer ce que je ressens dans l'espoir que les autres puissent le ressentir aussi.",
      },
    }),

    prisma.artist.upsert({
      where: { slug: "jean-michel-basquiat" },
      update: {},
      create: {
        slug: "jean-michel-basquiat",
        name: "Jean-Michel Basquiat",
        nationality: "Américain",
        birthYear: 1960,
        deathYear: 1988,
        featured: true,
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Jean-Michel_Basquiat_%281985%29.jpg/440px-Jean-Michel_Basquiat_%281985%29.jpg",
        coverUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Jean-Michel_Basquiat%2C_Untitled%2C_1982.jpg/1280px-Jean-Michel_Basquiat%2C_Untitled%2C_1982.jpg",
        bio: "Jean-Michel Basquiat a commencé sa carrière comme graffeur à New York sous le nom de SAMO avant de devenir l'une des figures majeures du néo-expressionnisme. Son œuvre explore la dichotomie entre richesse et pauvreté, intégration et ségrégation raciale, la religion et le colonialisme.",
        statement: "Je ne pense pas à l'art quand je travaille. J'essaie de penser à la vie.",
      },
    }),

    prisma.artist.upsert({
      where: { slug: "agnes-martin" },
      update: {},
      create: {
        slug: "agnes-martin",
        name: "Agnes Martin",
        nationality: "Américaine (née au Canada)",
        birthYear: 1912,
        deathYear: 2004,
        featured: false,
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Agnes_Martin_1960.jpg/440px-Agnes_Martin_1960.jpg",
        bio: "Agnes Martin est une artiste abstraite dont l'œuvre, caractérisée par de subtiles grilles et lignes horizontales, explore la beauté, l'innocence et la quiétude. Souvent associée au minimalisme, elle préférait être qualifiée d'expressionniste abstraite.",
        statement: "Quand je pense à l'art, je pense à la beauté. La beauté est la réponse à quelque chose que nous ne pouvons pas définir.",
      },
    }),

    prisma.artist.upsert({
      where: { slug: "kara-walker" },
      update: {},
      create: {
        slug: "kara-walker",
        name: "Kara Walker",
        nationality: "Américaine",
        birthYear: 1969,
        featured: false,
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Kara_Walker_2013.jpg/440px-Kara_Walker_2013.jpg",
        bio: "Kara Walker est connue pour ses silhouettes à grande échelle explorant la race, le genre, la sexualité, la violence et l'identité dans l'Amérique d'avant la guerre civile. Son œuvre confronte l'histoire américaine avec une urgence artistique et politique saisissante.",
        statement: "Je veux que mes œuvres soient inconfortables. L'inconfort est ce qui pousse les gens à agir.",
      },
    }),
  ]);

  console.log(`✓ ${artists.length} artistes créés`);

  // ── Œuvres ────────────────────────────────────────────────────────────────
  const rothko = artists[0];
  const kusama = artists[1];
  const basquiat = artists[2];
  const martin = artists[3];
  const walker = artists[4];

  const artworks = await Promise.all([
    // Rothko
    prisma.artwork.upsert({
      where: { slug: "no-61-rust-and-blue" },
      update: {},
      create: {
        slug: "no-61-rust-and-blue",
        title: "No. 61 (Rust and Blue)",
        year: 1953,
        medium: "Huile sur toile",
        dimensions: "294.6 × 232.1 cm",
        description: "Cette œuvre monumentale incarne la maturité du style de Rothko : deux rectangles flottants dans des tons de rouille et de bleu profond créent une tension émotionnelle puissante. La peinture invite le spectateur à une expérience méditative de la couleur pure.",
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/No_61_Rust_and_Blue.jpg/800px-No_61_Rust_and_Blue.jpg",
        price: 4800000,
        available: false,
        featured: true,
        artistId: rothko.id,
      },
    }),

    prisma.artwork.upsert({
      where: { slug: "orange-red-yellow" },
      update: {},
      create: {
        slug: "orange-red-yellow",
        title: "Orange, Red, Yellow",
        year: 1961,
        medium: "Huile sur toile",
        dimensions: "236.2 × 206.4 cm",
        description: "L'une des œuvres les plus célèbres de Rothko, vendue 86,9 millions de dollars en 2012. Les champs de couleur lumineux — orange, rouge, jaune — semblent rayonner de l'intérieur, créant une présence quasi spirituelle.",
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Mark_Rothko%2C_1961%2C_Orange%2C_Red%2C_Yellow%2C_oil_on_canvas%2C_236.2_x_206.4_cm%2C_Christie%27s.jpg/800px-Mark_Rothko%2C_1961%2C_Orange%2C_Red%2C_Yellow%2C_oil_on_canvas%2C_236.2_x_206.4_cm%2C_Christie%27s.jpg",
        price: 86900000,
        available: false,
        featured: true,
        artistId: rothko.id,
      },
    }),

    // Kusama
    prisma.artwork.upsert({
      where: { slug: "infinity-nets-1958" },
      update: {},
      create: {
        slug: "infinity-nets-1958",
        title: "Infinity Nets",
        year: 1958,
        medium: "Huile sur toile",
        dimensions: "106.7 × 106.7 cm",
        description: "Cette première œuvre de la série «Infinity Nets» établit le motif répétitif emblématique de Kusama. Des milliers de petits arcs peints à la main créent un réseau infini qui abolit la frontière entre fond et figure, reflétant l'expérience hallucinatoire de l'artiste.",
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Kusama_Infinity_Net.jpg/800px-Kusama_Infinity_Net.jpg",
        price: 7100000,
        available: false,
        featured: true,
        artistId: kusama.id,
      },
    }),

    prisma.artwork.upsert({
      where: { slug: "pumpkin-yellow-1994" },
      update: {},
      create: {
        slug: "pumpkin-yellow-1994",
        title: "Pumpkin (Yellow)",
        year: 1994,
        medium: "Acrylique sur toile",
        dimensions: "130.3 × 162.1 cm",
        description: "La citrouille est le motif le plus emblématique de Kusama, symbole de sa connexion profonde avec la nature et l'agriculture de son enfance. Ce motif familier, recouvert de pois noirs, est transformé en une icône de l'art contemporain.",
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Yayoi_Kusama_Pumpkin.jpg/800px-Yayoi_Kusama_Pumpkin.jpg",
        price: 3500000,
        available: false,
        featured: false,
        artistId: kusama.id,
      },
    }),

    // Basquiat
    prisma.artwork.upsert({
      where: { slug: "untitled-skull-1981" },
      update: {},
      create: {
        slug: "untitled-skull-1981",
        title: "Untitled (Skull)",
        year: 1981,
        medium: "Acrylique et crayon gras sur toile",
        dimensions: "205.7 × 175.9 cm",
        description: "Ce crâne monumental est l'une des œuvres les plus puissantes de Basquiat. Combinant imagery corporelle, texte griffonné et couleurs expressives, il explore la mortalité, l'identité noire et la violence systémique avec une urgence viscérale.",
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Jean-Michel_Basquiat%2C_Untitled%2C_1982.jpg/800px-Jean-Michel_Basquiat%2C_Untitled%2C_1982.jpg",
        price: 110500000,
        available: false,
        featured: true,
        artistId: basquiat.id,
      },
    }),

    prisma.artwork.upsert({
      where: { slug: "hollywood-africans-1983" },
      update: {},
      create: {
        slug: "hollywood-africans-1983",
        title: "Hollywood Africans",
        year: 1983,
        medium: "Acrylique et crayon gras sur toile",
        dimensions: "213.4 × 213.4 cm",
        description: "Peint lors d'un séjour à Los Angeles, Hollywood Africans examine les stéréotypes raciaux dans l'industrie du cinéma. Basquiat inclut des portraits de lui-même avec Toxic et Rammellzee, entourés de mots et de symboles dénonçant le racisme dans l'entertainment.",
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Jean-Michel_Basquiat_Hollywood_Africans_1983.jpg/800px-Jean-Michel_Basquiat_Hollywood_Africans_1983.jpg",
        price: 18000000,
        available: false,
        featured: false,
        artistId: basquiat.id,
      },
    }),

    // Martin
    prisma.artwork.upsert({
      where: { slug: "friendship-1963" },
      update: {},
      create: {
        slug: "friendship-1963",
        title: "Friendship",
        year: 1963,
        medium: "Or incisé sur gesso sur toile",
        dimensions: "188 × 188 cm",
        description: "Cette œuvre emblématique d'Agnes Martin présente une grille délicate incisée dans un fond doré. La répétition minutieuse des lignes crée un effet méditatif profond, évoquant la paix et la sérénité que l'artiste cherchait à transmettre.",
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Agnes_Martin_Friendship_1963.jpg/800px-Agnes_Martin_Friendship_1963.jpg",
        price: 28000000,
        available: false,
        featured: false,
        artistId: martin.id,
      },
    }),

    // Walker
    prisma.artwork.upsert({
      where: { slug: "a-subtlety-2014" },
      update: {},
      create: {
        slug: "a-subtlety-2014",
        title: "A Subtlety",
        year: 2014,
        medium: "Installation (sucre de canne, mélasse, polystyrène)",
        dimensions: "11 × 7.9 × 23 m",
        description: "Cette installation monumentale dans la Domino Sugar Factory de Brooklyn a attiré plus de 130 000 visiteurs. La Sphinx de sucre, sphinx noire recouvert de sucre blanc, explore l'histoire de l'esclavage dans la production de sucre aux Amériques.",
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Kara_Walker_A_Subtlety.jpg/800px-Kara_Walker_A_Subtlety.jpg",
        price: null,
        available: false,
        featured: true,
        artistId: walker.id,
      },
    }),
  ]);

  console.log(`✓ ${artworks.length} œuvres créées`);

  // ── Expositions ───────────────────────────────────────────────────────────
  const exhibitions = await Promise.all([
    prisma.exhibition.upsert({
      where: { slug: "chromatic-meditations" },
      update: {},
      create: {
        slug: "chromatic-meditations",
        title: "Chromatic Meditations",
        subtitle: "Rothko & la couleur comme langage",
        description: "Une exposition monographique consacrée à l'œuvre de Mark Rothko, explorant son évolution stylistique des figures expressionnistes des années 1940 aux champs de couleur monumentaux qui ont défini sa carrière. L'accrochage suit une progression émotionnelle — de la lumière vers l'obscurité — en dialogue avec la musique de Morton Feldman.",
        location: "Errancy Gallery, Paris — Grande Salle",
        startDate: new Date("2026-06-01"),
        endDate: new Date("2026-09-14"),
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/No_61_Rust_and_Blue.jpg/1280px-No_61_Rust_and_Blue.jpg",
        featured: true,
      },
    }),

    prisma.exhibition.upsert({
      where: { slug: "infinite-worlds" },
      update: {},
      create: {
        slug: "infinite-worlds",
        title: "Infinite Worlds",
        subtitle: "Kusama, Basquiat & l'art comme obsession",
        description: "Cette exposition confronte deux géants de l'art contemporain autour du thème de l'obsession créatrice. Les motifs infinis de Kusama dialoguent avec la graphie frénétique de Basquiat, révélant deux visions radicalement différentes d'un même besoin compulsif de créer.",
        location: "Errancy Gallery, Paris — Galerie Centrale",
        startDate: new Date("2026-10-15"),
        endDate: new Date("2027-01-31"),
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Kusama_Infinity_Net.jpg/1280px-Kusama_Infinity_Net.jpg",
        featured: true,
      },
    }),

    prisma.exhibition.upsert({
      where: { slug: "silence-and-resistance" },
      update: {},
      create: {
        slug: "silence-and-resistance",
        title: "Silence & Resistance",
        subtitle: "Martin, Walker & les voix de la marge",
        description: "Une exposition en diptyque réunissant l'œuvre méditative d'Agnes Martin et les silhouettes incisives de Kara Walker. Entre le silence contemplatif de l'une et la violence narrative de l'autre, cette exposition interroge la résistance comme forme artistique.",
        location: "Errancy Gallery, Paris — Salle Nord",
        startDate: new Date("2025-09-01"),
        endDate: new Date("2026-02-28"),
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Kara_Walker_A_Subtlety.jpg/1280px-Kara_Walker_A_Subtlety.jpg",
        featured: false,
      },
    }),
  ]);

  console.log(`✓ ${exhibitions.length} expositions créées`);

  // ── Relations œuvres ↔ expositions ───────────────────────────────────────
  await Promise.all([
    prisma.artworkExhibition.upsert({
      where: { artworkId_exhibitionId: { artworkId: artworks[0].id, exhibitionId: exhibitions[0].id } },
      update: {},
      create: { artworkId: artworks[0].id, exhibitionId: exhibitions[0].id },
    }),
    prisma.artworkExhibition.upsert({
      where: { artworkId_exhibitionId: { artworkId: artworks[1].id, exhibitionId: exhibitions[0].id } },
      update: {},
      create: { artworkId: artworks[1].id, exhibitionId: exhibitions[0].id },
    }),
    prisma.artworkExhibition.upsert({
      where: { artworkId_exhibitionId: { artworkId: artworks[2].id, exhibitionId: exhibitions[1].id } },
      update: {},
      create: { artworkId: artworks[2].id, exhibitionId: exhibitions[1].id },
    }),
    prisma.artworkExhibition.upsert({
      where: { artworkId_exhibitionId: { artworkId: artworks[4].id, exhibitionId: exhibitions[1].id } },
      update: {},
      create: { artworkId: artworks[4].id, exhibitionId: exhibitions[1].id },
    }),
    prisma.artworkExhibition.upsert({
      where: { artworkId_exhibitionId: { artworkId: artworks[6].id, exhibitionId: exhibitions[2].id } },
      update: {},
      create: { artworkId: artworks[6].id, exhibitionId: exhibitions[2].id },
    }),
    prisma.artworkExhibition.upsert({
      where: { artworkId_exhibitionId: { artworkId: artworks[7].id, exhibitionId: exhibitions[2].id } },
      update: {},
      create: { artworkId: artworks[7].id, exhibitionId: exhibitions[2].id },
    }),
  ]);

  console.log("✓ Relations artworks ↔ expositions créées");
  console.log("\nSeed terminé avec succès !");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
