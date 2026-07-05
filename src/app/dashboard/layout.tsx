import { requireUser } from '@/lib/dal'
import { getUserProfile } from '@/lib/userSettings'
import { signOutAction } from './actions'
import { Sidebar } from '@/components/dashboard/Sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user    = await requireUser()
  const profile = getUserProfile(user.id)
  // Il display_name del profilo sovrascrive il nome dalla sessione di login
  const displayName = profile.displayName ?? user.name

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[--bg]">
      <Sidebar
        user={{ name: displayName, email: user.email, role: user.role }}
        signOutAction={signOutAction}
      />
      {/* Content — occupa tutto lo spazio rimanente */}
      <div className="flex-1 flex flex-col min-w-0">
        {children}
      </div>
    </div>
  )
}
