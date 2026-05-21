'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { cn } from '@/lib/utils/cn'
import { Button, Input } from '@/components/ui'
import { gradient, accent } from '@/lib/db/mappers'

interface ArtworkData {
  slug: string
  title: string
  year: number
  medium: string
  dimensions: string
  price: number | null
  description: string
  imageUrl: string | null
  available: boolean
}

interface Props {
  artwork?:  ArtworkData
  mode:      'create' | 'edit'
  apiBase?:  string   // default '/api/artiste/oeuvres'
}

interface FormState {
  title:       string
  year:        string
  technique:   string
  dimensions:  string
  price:       string
  description: string
}

export function ArtworkForm({ artwork, mode, apiBase = '/api/artiste/oeuvres' }: Props) {
  const router = useRouter()

  const [form, setForm] = useState<FormState>({
    title:       artwork?.title       ?? '',
    year:        artwork?.year?.toString() ?? new Date().getFullYear().toString(),
    technique:   artwork?.medium      ?? '',
    dimensions:  artwork?.dimensions  ?? '',
    price:       artwork?.price?.toString() ?? '',
    description: artwork?.description ?? '',
  })

  const [imageFile,    setImageFile]    = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(artwork?.imageUrl ?? null)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [success,      setSuccess]      = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleChange = useCallback((
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }, [])

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }, [])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (!file || !file.type.startsWith('image/')) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const payload = {
        title:       form.title.trim(),
        year:        parseInt(form.year, 10),
        technique:   form.technique.trim(),
        dimensions:  form.dimensions.trim(),
        price:       form.price ? parseFloat(form.price) : null,
        description: form.description.trim(),
      }

      // Create or update artwork
      const url    = mode === 'create' ? apiBase : `${apiBase}/${artwork!.slug}`
      const method = mode === 'create' ? 'POST'  : 'PUT'

      const res  = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur lors de l\'enregistrement')

      const slug: string = data.slug

      // Upload image if selected
      if (imageFile) {
        const fd = new FormData()
        fd.append('file', imageFile)
        fd.append('artworkId', slug)

        const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd })
        if (!uploadRes.ok) {
          const uploadData = await uploadRes.json()
          throw new Error(uploadData.error ?? 'Erreur lors de l\'upload de l\'image')
        }
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/dashboard/artiste/oeuvres')
        router.refresh()
      }, 800)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inattendue')
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!artwork || !confirm(`Supprimer "${artwork.title}" ? Cette action est irréversible.`)) return
    setLoading(true)
    try {
      const res = await fetch(`${apiBase}/${artwork.slug}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Erreur lors de la suppression')
      }
      router.push('/dashboard/artiste/oeuvres')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inattendue')
      setLoading(false)
    }
  }

  const placeholderGradient = artwork ? gradient(artwork.slug) : 'from-neutral-200 to-neutral-300'
  const placeholderAccent   = artwork ? accent(artwork.slug)   : '#A8A8A2'

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">

      {/* ── Left column: text fields ── */}
      <div className="flex flex-col gap-6">

        {/* Titre + Année */}
        <div className="grid grid-cols-[1fr_100px] gap-4">
          <Input
            name="title"
            label="Titre *"
            placeholder="Sans titre"
            value={form.title}
            onChange={handleChange}
            required
            disabled={loading || success}
          />
          <Input
            name="year"
            label="Année *"
            type="number"
            min={1900}
            max={new Date().getFullYear()}
            value={form.year}
            onChange={handleChange}
            required
            disabled={loading || success}
          />
        </div>

        {/* Technique */}
        <Input
          name="technique"
          label="Technique *"
          placeholder="Huile et feuille d'or sur toile de lin"
          value={form.technique}
          onChange={handleChange}
          required
          disabled={loading || success}
        />

        {/* Dimensions + Prix */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            name="dimensions"
            label="Dimensions"
            placeholder="120 × 90 cm"
            value={form.dimensions}
            onChange={handleChange}
            disabled={loading || success}
          />
          <div className="flex flex-col gap-1.5">
            <label className="font-sans text-xs font-medium uppercase tracking-widest text-neutral-500">
              Prix (€)
            </label>
            <div className="relative flex items-center border border-neutral-200 rounded-sm hover:border-neutral-400 transition-colors duration-200">
              <span className="absolute left-3 font-sans text-sm text-neutral-400 pointer-events-none">€</span>
              <input
                name="price"
                type="number"
                min={0}
                step={100}
                placeholder="0"
                value={form.price}
                onChange={handleChange}
                disabled={loading || success}
                className="w-full font-sans text-sm text-foreground bg-transparent pl-8 pr-4 py-2.5 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <label className="font-sans text-xs font-medium uppercase tracking-widest text-neutral-500">
            Description
          </label>
          <textarea
            name="description"
            rows={7}
            placeholder="Décrivez l'œuvre, sa genèse, ses matériaux, le contexte de création…"
            value={form.description}
            onChange={handleChange}
            disabled={loading || success}
            className={cn(
              'w-full font-sans text-sm text-foreground bg-transparent',
              'border border-neutral-200 rounded-sm px-4 py-3',
              'placeholder:text-neutral-400',
              'hover:border-neutral-400 focus:border-foreground',
              'outline-none resize-none transition-colors duration-200',
              'disabled:opacity-40 disabled:cursor-not-allowed',
            )}
          />
        </div>

        {/* Error */}
        {error && (
          <p className="font-sans text-xs text-red-500 px-1">{error}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={loading}
            disabled={success}
          >
            {success ? 'Enregistré ✓' : mode === 'create' ? 'Publier l\'œuvre' : 'Enregistrer'}
          </Button>

          {mode === 'edit' && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading || success}
              className="font-sans text-xs uppercase tracking-widest text-neutral-400 hover:text-red-500 transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed px-2"
            >
              Supprimer
            </button>
          )}
        </div>
      </div>

      {/* ── Right column: image upload ── */}
      <div className="flex flex-col gap-4">
        <p className="font-sans text-xs font-medium uppercase tracking-widest text-neutral-500">
          Image
        </p>

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'relative cursor-pointer rounded-sm overflow-hidden',
            'border-2 border-dashed border-neutral-200',
            'hover:border-neutral-400 transition-colors duration-200',
            'aspect-[4/5]',
          )}
        >
          {imagePreview ? (
            <>
              {imagePreview.startsWith('blob:') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imagePreview}
                  alt="Aperçu"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <Image
                  src={imagePreview}
                  alt="Aperçu"
                  fill
                  sizes="340px"
                  className="object-cover"
                />
              )}
              <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors duration-200 flex items-end p-3">
                <span className="font-sans text-xs uppercase tracking-widest text-white/0 hover:text-white/80 transition-colors duration-200 bg-black/50 px-2 py-1 rounded-sm opacity-0 group-hover:opacity-100">
                  Changer
                </span>
              </div>
            </>
          ) : (
            <div className={`absolute inset-0 bg-gradient-to-br ${placeholderGradient} flex flex-col items-center justify-center gap-3`}>
              <UploadIcon color={placeholderAccent} />
              <div className="text-center px-4">
                <p className="font-sans text-xs text-neutral-600">
                  Glissez une image ici
                </p>
                <p className="font-sans text-[10px] text-neutral-400 mt-1">
                  ou cliquez pour sélectionner
                </p>
              </div>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="hidden"
          onChange={handleFile}
          disabled={loading || success}
        />

        {imagePreview && (
          <button
            type="button"
            onClick={() => { setImageFile(null); setImagePreview(null) }}
            className="font-sans text-xs uppercase tracking-widest text-neutral-400 hover:text-foreground transition-colors duration-200"
          >
            Retirer l&apos;image
          </button>
        )}

        <p className="font-sans text-[10px] text-neutral-400 leading-relaxed">
          JPEG, PNG, WebP · Max 10 Mo · Ratio portrait recommandé
        </p>
      </div>

    </form>
  )
}

/* ─── Icons ───────────────────────────────────────────────────────────────── */

function UploadIcon({ color }: { color: string }) {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  )
}
