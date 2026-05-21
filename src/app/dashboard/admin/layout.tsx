import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { AdminNav } from '@/components/dashboard/AdminNav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/auth/connexion')
  if ((session.user as any).role !== 'admin') redirect('/dashboard')

  return (
    <div className="min-h-screen bg-background pt-16 md:pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex min-h-[calc(100vh-4rem)] md:min-h-[calc(100vh-5rem)]">

        {/* Sidebar desktop */}
        <aside className="w-56 flex-shrink-0 py-10 pr-8 hidden md:flex md:flex-col border-r border-neutral-100">
          <div className="mb-8">
            <p className="font-sans text-[10px] uppercase tracking-[0.25em] text-gold mb-1">
              Administration
            </p>
            <p className="font-sans text-xs text-neutral-500">Errancy</p>
          </div>
          <AdminNav />
        </aside>

        {/* Main */}
        <main className="flex-1 py-10 pb-24 md:pb-12 min-w-0 md:pl-10">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-background border-t border-neutral-200">
        <AdminNav mobile />
      </div>
    </div>
  )
}
