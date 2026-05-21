import { prisma } from '../src/lib/prisma'

const CLOUD  = 'djiu4tirq'
const PRESET = 'errancy_artworks'
const UA     = 'ErrancyGallery/1.0 (https://errancy.art; contact@errancy.art)'

// ── Image sources ─────────────────────────────────────────────────────────────
// Kusama Pumpkin: Wikimedia Commons (original file, not thumbnail)
// All others: Metropolitan Museum of Art Open Access (public domain, high-res)
// ──────────────────────────────────────────────────────────────────────────────
const ARTWORKS: { slug: string; title: string; source: 'wikimedia' | 'direct'; ref: string }[] = [
  {
    slug:   'pumpkin-yellow-1994',
    title:  'Pumpkin (Yellow)',
    source: 'wikimedia',
    ref:    'Yayoi_Kusama_Pumpkin.jpg',
  },
  {
    slug:   'a-subtlety-2014',
    title:  'A Subtlety',
    source: 'direct',
    // Paul Gauguin — Ia Orana Maria (Hail Mary), 1891 — MET #438821
    ref: 'https://images.metmuseum.org/CRDImages/ep/original/DT1025.jpg',
  },
  {
    slug:   'infinity-nets-1958',
    title:  'Infinity Nets',
    source: 'direct',
    // Vincent van Gogh — L'Arlésienne, 1888–89 — MET #436529
    ref: 'https://images.metmuseum.org/CRDImages/ep/original/DT1396.jpg',
  },
  {
    slug:   'friendship-1963',
    title:  'Friendship',
    source: 'direct',
    // Gustav Klimt — Serena Pulitzer Lederer, 1899 — MET #436820
    ref: 'https://images.metmuseum.org/CRDImages/ep/original/DP-18885-001.jpg',
  },
  {
    slug:   'orange-red-yellow',
    title:  'Orange, Red, Yellow',
    source: 'direct',
    // Peter Paul Rubens — A Forest at Dawn with a Deer Hunt, ca. 1635 — MET #437526
    ref: 'https://images.metmuseum.org/CRDImages/ep/original/DP-25739-001.jpg',
  },
  {
    slug:   'no-61-rust-and-blue',
    title:  'No. 61 (Rust and Blue)',
    source: 'direct',
    // Édouard Manet — Madame Manet at Bellevue, 1880 — MET #438002
    ref: 'https://images.metmuseum.org/CRDImages/ep/original/DT4224.jpg',
  },
  {
    slug:   'hollywood-africans-1983',
    title:  'Hollywood Africans',
    source: 'direct',
    // Paul Cézanne — Madame Cézanne in a Red Dress, 1888–90 — MET #435876
    ref: 'https://images.metmuseum.org/CRDImages/ep/original/DP320128.jpg',
  },
  {
    slug:   'untitled-skull-1981',
    title:  'Untitled (Skull)',
    source: 'direct',
    // Pieter Claesz — Still Life with a Skull and a Writing Quill, 1628 — MET #435904
    ref: 'https://images.metmuseum.org/CRDImages/ep/original/DP145929.jpg',
  },
]

// ── Wikimedia original URL lookup ─────────────────────────────────────────────
async function getWikimediaUrl(filename: string): Promise<string> {
  const encoded = encodeURIComponent(`File:${filename}`)
  const apiUrl  = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encoded}&prop=imageinfo&iiprop=url&format=json`
  const res     = await fetch(apiUrl, { headers: { 'User-Agent': UA } })
  const data    = await res.json() as any
  const pages   = data?.query?.pages ?? {}
  const page    = Object.values(pages)[0] as any
  const url     = page?.imageinfo?.[0]?.url
  if (!url) throw new Error(`Fichier introuvable sur Wikimedia : ${filename}`)
  return url
}

// ── Fetch image buffer ────────────────────────────────────────────────────────
async function fetchBuffer(url: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept': 'image/*,*/*' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`)
  const ct = res.headers.get('content-type') ?? 'image/jpeg'
  return { buffer: Buffer.from(await res.arrayBuffer()), mimeType: ct.split(';')[0].trim() }
}

// ── Cloudinary unsigned upload ────────────────────────────────────────────────
async function uploadToCloudinary(buffer: Buffer, mimeType: string, slug: string): Promise<string> {
  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg'

  const form = new FormData()
  form.append('file',          new Blob([buffer], { type: mimeType }), `${slug}.${ext}`)
  form.append('upload_preset', PRESET)
  form.append('public_id',     slug)
  form.append('folder',        'errancy/artworks')

  const res  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, {
    method: 'POST',
    body:   form,
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Cloudinary ${res.status}: ${body.slice(0, 200)}`)
  }

  const data = await res.json() as any
  return data.secure_url as string
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  let success = 0
  let failure = 0

  for (const { slug, title, source, ref } of ARTWORKS) {
    process.stdout.write(`\n[${slug}] "${title}"\n`)
    try {
      // 1. Resolve source URL
      let imageUrl: string
      if (source === 'wikimedia') {
        process.stdout.write('  Wikimedia API … ')
        imageUrl = await getWikimediaUrl(ref)
        process.stdout.write('OK\n')
      } else {
        imageUrl = ref
      }

      // 2. Fetch buffer
      process.stdout.write(`  Fetch ${source === 'wikimedia' ? 'original' : 'MET CDN'} … `)
      const { buffer, mimeType } = await fetchBuffer(imageUrl)
      process.stdout.write(`${(buffer.length / 1024).toFixed(0)} KB (${mimeType})\n`)

      // 3. Upload to Cloudinary (unsigned preset)
      process.stdout.write('  Cloudinary upload … ')
      const cloudinaryUrl = await uploadToCloudinary(buffer, mimeType, slug)
      process.stdout.write('OK\n')
      console.log(`  → ${cloudinaryUrl}`)

      // 4. Update DB
      process.stdout.write('  DB update … ')
      await prisma.artwork.update({ where: { slug }, data: { imageUrl: cloudinaryUrl } })
      console.log('✓')

      success++
    } catch (err) {
      console.log('  ✗ ERREUR:', err instanceof Error ? err.message : JSON.stringify(err))
      failure++
    }
  }

  console.log('\n' + '─'.repeat(60))
  console.log(`Résultat : ${success} uploadée(s)   ${failure} échec(s)`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
