import { requireUser } from '@/lib/dal'
import { signOutAction } from './actions'
import { Sidebar } from '@/components/dashboard/Sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireUser()

  return (
    <div className="flex min-h-screen bg-[--bg]">
      <Sidebar
        user={{ name: user.name, email: user.email, role: user.role }}
        signOutAction={signOutAction}
      />
      {/* Content — occupa tutto lo spazio rimanente */}
      <div className="flex-1 flex flex-col min-w-0">
        {children}
      </div>
    </div>
  )
}
