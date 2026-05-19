import type { Metadata } from 'next'
import { LoginForm } from './LoginForm'

export const metadata: Metadata = {
  title: 'Connexion',
  description: 'Connectez-vous à votre espace Errancy.',
}

export default function ConnexionPage() {
  return <LoginForm />
}
