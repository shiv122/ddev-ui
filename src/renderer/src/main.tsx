import './assets/globals.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { queryClient } from '@/lib/query-client'
import { RouterProvider } from '@/lib/router'
import { ThemeProvider, useTheme } from '@/lib/theme'
import { initOperationsStore } from '@/store/operations'
import App from './App'

initOperationsStore()

function ThemedToaster(): React.JSX.Element {
  const { theme } = useTheme()
  return <Toaster theme={theme} position="bottom-right" richColors closeButton />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RouterProvider>
          <TooltipProvider delayDuration={300}>
            <App />
            <ThemedToaster />
          </TooltipProvider>
        </RouterProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>
)
