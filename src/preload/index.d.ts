import type { DdevApi } from './index'

declare global {
  interface Window {
    ddev: DdevApi
  }
}

export {}
