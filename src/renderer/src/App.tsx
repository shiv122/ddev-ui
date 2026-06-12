import { AnimatePresence, motion } from 'motion/react'
import { Shell } from '@/components/app/shell'
import { useRouter } from '@/lib/router'
import { DashboardPage } from '@/pages/dashboard'
import { ProjectPage } from '@/pages/project'
import { CreateProjectPage } from '@/pages/create-project'
import { AddonsPage } from '@/pages/addons'
import { OperationsPage } from '@/pages/operations'
import { DoctorPage } from '@/pages/doctor'
import { SettingsPage } from '@/pages/settings'

function routeKey(view: string, name?: string): string {
  return name ? `${view}:${name}` : view
}

export default function App(): React.JSX.Element {
  const { route } = useRouter()

  let page: React.JSX.Element
  let key: string
  switch (route.view) {
    case 'dashboard':
      page = <DashboardPage />
      key = routeKey('dashboard')
      break
    case 'project':
      page = <ProjectPage name={route.name} initialTab={route.tab} />
      key = routeKey('project', route.name)
      break
    case 'create':
      page = <CreateProjectPage />
      key = routeKey('create')
      break
    case 'addons':
      page = <AddonsPage />
      key = routeKey('addons')
      break
    case 'operations':
      page = <OperationsPage selected={route.selected} />
      key = routeKey('operations')
      break
    case 'doctor':
      page = <DoctorPage />
      key = routeKey('doctor')
      break
    case 'settings':
      page = <SettingsPage />
      key = routeKey('settings')
      break
  }

  return (
    <Shell>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={key}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          className="h-full"
        >
          {page}
        </motion.div>
      </AnimatePresence>
    </Shell>
  )
}
