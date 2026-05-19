import type { Metadata } from 'next'
import { RegisterForm } from './RegisterForm'

export const metadata: Metadata = {
  title: 'Créer un compte',
  description: 'Rejoignez Errancy et accédez à l\'ensemble de la collection.',
}

export default function InscriptionPage() {
  return <RegisterForm />
}
