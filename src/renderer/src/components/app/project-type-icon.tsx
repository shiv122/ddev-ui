import {
  SiCakephp,
  SiCraftcms,
  SiDrupal,
  SiLaravel,
  SiPhp,
  SiShopware,
  SiSymfony,
  SiTypo3,
  SiWordpress
} from '@icons-pack/react-simple-icons'
import { Box, Layers, ShoppingCart, Droplet } from 'lucide-react'
import { cn } from '@/lib/utils'

type IconComponent = React.ComponentType<{ className?: string }>

const TYPE_ICONS: Record<string, IconComponent> = {
  php: SiPhp,
  laravel: SiLaravel,
  wordpress: SiWordpress,
  'wp-bedrock': SiWordpress,
  drupal: SiDrupal,
  drupal6: SiDrupal,
  drupal7: SiDrupal,
  drupal8: SiDrupal,
  drupal9: SiDrupal,
  drupal10: SiDrupal,
  drupal11: SiDrupal,
  drupal12: SiDrupal,
  backdrop: SiDrupal,
  symfony: SiSymfony,
  typo3: SiTypo3,
  craftcms: SiCraftcms,
  shopware6: SiShopware,
  cakephp: SiCakephp,
  magento: ShoppingCart,
  magento2: ShoppingCart,
  silverstripe: Droplet,
  generic: Box
}

export function projectTypeIcon(type: string): IconComponent {
  return TYPE_ICONS[type] ?? Layers
}

/** Brushed-metal tile with the project type's brand mark. */
export function ProjectTypeIcon({
  type,
  className,
  iconClassName
}: {
  type: string
  className?: string
  iconClassName?: string
}): React.JSX.Element {
  const Icon = projectTypeIcon(type)
  return (
    <div
      className={cn(
        'metal-tile flex shrink-0 items-center justify-center rounded-lg text-foreground/85',
        className ?? 'size-10'
      )}
    >
      <Icon className={iconClassName ?? 'size-5'} />
    </div>
  )
}
