import './assets/globals.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { queryClient } from '@/lib/query-client'
import { RouterProvider } from '@/lib/router'
import { initOperationsStore } from '@/store/operations'
import App from './App'

initOperationsStore()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider>
        <TooltipProvider delayDuration={300}>
          <App />
          <Toaster theme="dark" position="bottom-right" richColors closeButton />
        </TooltipProvider>
      </RouterProvider>
    </QueryClientProvider>
  </StrictMode>
)
