import type { DdevStatus } from '@shared/types'

export type StatusTone = 'success' | 'warning' | 'destructive' | 'muted'

export function statusTone(status: DdevStatus): StatusTone {
  switch (status) {
    case 'running':
      return 'success'
    case 'starting':
    case 'paused':
      return 'warning'
    case 'unhealthy':
      return 'destructive'
    default:
      return 'muted'
  }
}

export function statusLabel(status: DdevStatus): string {
  if (status === '.ddev/config.yaml missing') return 'config missing'
  if (status === 'project directory missing') return 'directory missing'
  return status
}

export function isBusy(status: DdevStatus): boolean {
  return status === 'starting'
}

const TYPE_LABELS: Record<string, string> = {
  php: 'PHP',
  laravel: 'Laravel',
  wordpress: 'WordPress',
  drupal: 'Drupal',
  drupal11: 'Drupal 11',
  typo3: 'TYPO3',
  magento2: 'Magento 2',
  craftcms: 'Craft CMS',
  shopware6: 'Shopware 6',
  backdrop: 'Backdrop',
  cakephp: 'CakePHP',
  symfony: 'Symfony',
  silverstripe: 'Silverstripe',
  generic: 'Generic'
}

export function projectTypeLabel(type: string): string {
  if (!type) return 'Unknown'
  return TYPE_LABELS[type] ?? type
}

export function formatTime(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

/** First line of a possibly multi-line status/error string, capped for inline display. */
export function firstLine(text: string, max = 80): string {
  const line = text.split('\n')[0]
  return line.length > max ? `${line.slice(0, max)}…` : line
}

export function hostName(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}
