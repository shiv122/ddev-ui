/** Option lists mirroring `ddev config` flag values (ddev v1.25). */

export const PHP_VERSIONS = ['8.5', '8.4', '8.3', '8.2', '8.1', '8.0', '7.4', '7.3', '7.2', '7.1', '7.0', '5.6']

export const DATABASES: Array<{ value: string; label: string }> = [
  { value: 'mariadb:11.8', label: 'MariaDB 11.8' },
  { value: 'mariadb:11.4', label: 'MariaDB 11.4' },
  { value: 'mariadb:10.11', label: 'MariaDB 10.11 (default)' },
  { value: 'mariadb:10.6', label: 'MariaDB 10.6' },
  { value: 'mariadb:10.4', label: 'MariaDB 10.4' },
  { value: 'mysql:8.4', label: 'MySQL 8.4' },
  { value: 'mysql:8.0', label: 'MySQL 8.0' },
  { value: 'mysql:5.7', label: 'MySQL 5.7' },
  { value: 'postgres:18', label: 'PostgreSQL 18' },
  { value: 'postgres:17', label: 'PostgreSQL 17' },
  { value: 'postgres:16', label: 'PostgreSQL 16' },
  { value: 'postgres:15', label: 'PostgreSQL 15' },
  { value: 'postgres:14', label: 'PostgreSQL 14' }
]

export const WEBSERVER_TYPES: Array<{ value: string; label: string }> = [
  { value: 'nginx-fpm', label: 'nginx + PHP-FPM (default)' },
  { value: 'apache-fpm', label: 'Apache + PHP-FPM' },
  { value: 'generic', label: 'Generic' }
]

export const PERFORMANCE_MODES: Array<{ value: string; label: string }> = [
  { value: 'global', label: 'Global default' },
  { value: 'none', label: 'None' },
  { value: 'mutagen', label: 'Mutagen' }
]

export const PROJECT_TYPES: Array<{ value: string; label: string; hint?: string }> = [
  { value: 'php', label: 'PHP', hint: 'Plain PHP / any framework' },
  { value: 'laravel', label: 'Laravel' },
  { value: 'wordpress', label: 'WordPress' },
  { value: 'drupal11', label: 'Drupal 11' },
  { value: 'drupal10', label: 'Drupal 10' },
  { value: 'drupal', label: 'Drupal (latest)' },
  { value: 'symfony', label: 'Symfony' },
  { value: 'typo3', label: 'TYPO3' },
  { value: 'craftcms', label: 'Craft CMS' },
  { value: 'magento2', label: 'Magento 2' },
  { value: 'shopware6', label: 'Shopware 6' },
  { value: 'silverstripe', label: 'Silverstripe' },
  { value: 'cakephp', label: 'CakePHP' },
  { value: 'backdrop', label: 'Backdrop' },
  { value: 'generic', label: 'Generic', hint: 'Non-PHP / custom' }
]

export const NODEJS_VERSIONS = ['auto', '24', '22', '20', '18']
