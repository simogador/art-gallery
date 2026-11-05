import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Story 3.1 : les tailles de texte de tailwind.config.ts (DESIGN.md) sont des tailles, pas des
// couleurs ; sans cette déclaration, tailwind-merge retirerait `text-input` devant `text-foreground`.
const TAILLES_TEXTE = [
  'display-2xl', 'display-xl', 'display-lg', 'display-md', 'display-sm', 'display-xs',
  'heading-sm', 'body-strong', 'price-lg', 'label-caps', 'caption', 'button', 'input',
]

const twMerge = extendTailwindMerge({
  extend: { classGroups: { 'font-size': [{ text: TAILLES_TEXTE }] } },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
