/**
 * Curated catalog of DDEV add-ons, grouped by category, plus per-framework
 * recommended bundles. Add-on ids are GitHub `owner/repo` paths passed verbatim
 * to `ddev add-on get`. Kept intentionally small and high-signal rather than
 * mirroring the full 240+ registry (that lives behind the "Browse registry"
 * page); this is the opinionated subset we suggest during onboarding.
 */

export type ServiceCategory =
  | 'cache'
  | 'search'
  | 'queue'
  | 'storage'
  | 'dbtools'
  | 'frontend'
  | 'dev'

export interface ServiceSpec {
  /** `owner/repo` for `ddev add-on get`. */
  id: string
  /** Short display name. */
  name: string
  category: ServiceCategory
  /** One-line benefit. */
  blurb: string
  /** GitHub stars at curation time (rough popularity signal). */
  stars: number
  /** Maintained under the official `ddev` org. */
  official: boolean
}

export const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  cache: 'Cache & data stores',
  search: 'Search engines',
  queue: 'Queues & messaging',
  storage: 'Object storage',
  dbtools: 'Database UIs',
  frontend: 'Frontend & build',
  dev: 'Dev & debugging'
}

export const SERVICES: ServiceSpec[] = [
  // cache / data
  { id: 'ddev/ddev-redis', name: 'Redis', category: 'cache', stars: 36, official: true, blurb: 'In-memory cache, sessions, and queue backend.' },
  { id: 'ddev/ddev-redis-insight', name: 'Redis Insight', category: 'cache', stars: 2, official: true, blurb: 'Web UI to browse and query Redis.' },
  { id: 'ddev/ddev-memcached', name: 'Memcached', category: 'cache', stars: 4, official: true, blurb: 'High-performance memory object cache.' },
  { id: 'ddev/ddev-mongo', name: 'MongoDB', category: 'cache', stars: 7, official: true, blurb: 'Document (NoSQL) database service.' },
  // search
  { id: 'ddev/ddev-elasticsearch', name: 'Elasticsearch', category: 'search', stars: 15, official: true, blurb: 'Full-text search and analytics engine.' },
  { id: 'ddev/ddev-opensearch', name: 'OpenSearch', category: 'search', stars: 9, official: true, blurb: 'Open-source search and analytics (ES fork).' },
  { id: 'ddev/ddev-solr', name: 'Apache Solr', category: 'search', stars: 16, official: true, blurb: 'Solr search server for indexing.' },
  { id: 'ddev/ddev-typo3-solr', name: 'TYPO3 Solr', category: 'search', stars: 12, official: true, blurb: 'Apache Solr wired for TYPO3 EXT:solr.' },
  { id: 'ddev/ddev-drupal-solr', name: 'Drupal Solr', category: 'search', stars: 14, official: true, blurb: 'Apache Solr preconfigured for Drupal.' },
  { id: 'kevinquillen/ddev-meilisearch', name: 'Meilisearch', category: 'search', stars: 11, official: false, blurb: 'Fast, typo-tolerant search (Laravel Scout).' },
  { id: 'kevinquillen/ddev-typesense', name: 'Typesense', category: 'search', stars: 3, official: false, blurb: 'Privacy-friendly instant-search engine.' },
  // queue / messaging
  { id: 'ddev/ddev-rabbitmq', name: 'RabbitMQ', category: 'queue', stars: 9, official: true, blurb: 'AMQP message broker and queue manager.' },
  { id: 'tyler36/ddev-laravel-queue', name: 'Laravel queue worker', category: 'queue', stars: 6, official: false, blurb: 'Runs `queue:work` automatically as a daemon.' },
  { id: 'tyler36/ddev-laravel-reverb', name: 'Laravel Reverb', category: 'queue', stars: 0, official: false, blurb: 'WebSocket server daemon for Laravel Reverb.' },
  // storage
  { id: 'ddev/ddev-minio', name: 'MinIO', category: 'storage', stars: 11, official: true, blurb: 'S3-compatible object storage for local dev.' },
  // db tools
  { id: 'ddev/ddev-phpmyadmin', name: 'phpMyAdmin', category: 'dbtools', stars: 21, official: true, blurb: 'Web UI for MySQL / MariaDB.' },
  { id: 'ddev/ddev-adminer', name: 'Adminer', category: 'dbtools', stars: 18, official: true, blurb: 'Lightweight web DB browser (MySQL/PG).' },
  { id: 'MurzNN/ddev-pgadmin', name: 'pgAdmin', category: 'dbtools', stars: 0, official: false, blurb: 'Web UI for PostgreSQL databases.' },
  // frontend / build
  { id: 's2b/ddev-vite-sidecar', name: 'Vite (sidecar)', category: 'frontend', stars: 35, official: false, blurb: 'Exposes the Vite dev server with HMR over HTTPS.' },
  { id: 'ddev/ddev-browsersync', name: 'BrowserSync', category: 'frontend', stars: 40, official: true, blurb: 'Live-reload and auto-refresh on file changes.' },
  { id: 'ddev/ddev-pnpm', name: 'pnpm', category: 'frontend', stars: 10, official: true, blurb: 'Fast, disk-efficient Node package manager.' },
  { id: 'ddev/ddev-nvm', name: 'nvm', category: 'frontend', stars: 2, official: true, blurb: 'Node Version Manager inside the web container.' },
  { id: 'OpenForgeProject/ddev-bun', name: 'Bun', category: 'frontend', stars: 10, official: false, blurb: 'Bun JS runtime, bundler, and package manager.' },
  // dev / debugging
  { id: 'iljapolanskis/ddev-buggregator', name: 'Buggregator', category: 'dev', stars: 2, official: false, blurb: 'Free Ray/Telescope-style debug server (dumps, mail, profiling).' },
  { id: 'ddev/ddev-cron', name: 'Cron', category: 'dev', stars: 34, official: true, blurb: 'Run scheduled tasks / cron jobs in the web container.' }
]

export const SERVICE_BY_ID: Record<string, ServiceSpec> = Object.fromEntries(
  SERVICES.map((s) => [s.id, s])
)

export interface Recommendation {
  id: string
  /** Why this fits the framework (shown under the checkbox). */
  reason: string
  /** Pre-checked in the create wizard. */
  recommended: boolean
}

/**
 * Per-framework starter bundles. Keys match DDEV project types. The wizard
 * pre-checks `recommended` entries and offers the rest as optional extras.
 * Mailpit is built into DDEV, so it never appears here.
 */
export const FRAMEWORK_BUNDLES: Record<string, Recommendation[]> = {
  laravel: [
    { id: 'ddev/ddev-redis', reason: 'Cache, sessions, and the queue/broadcast backend.', recommended: true },
    { id: 'tyler36/ddev-laravel-queue', reason: 'Runs queue:work so jobs process automatically.', recommended: true },
    { id: 'ddev/ddev-cron', reason: 'Drives the Laravel scheduler (schedule:run).', recommended: true },
    { id: 'iljapolanskis/ddev-buggregator', reason: 'Dumps, mail, and profiling like Ray/Telescope, for free.', recommended: true },
    { id: 's2b/ddev-vite-sidecar', reason: 'Vite HMR over HTTPS for the front-end build.', recommended: false },
    { id: 'kevinquillen/ddev-meilisearch', reason: 'Laravel Scout full-text search.', recommended: false },
    { id: 'tyler36/ddev-laravel-reverb', reason: 'WebSockets if you use Reverb broadcasting.', recommended: false },
    { id: 'ddev/ddev-minio', reason: 'S3-compatible storage to exercise the s3 disk locally.', recommended: false }
  ],
  symfony: [
    { id: 'ddev/ddev-redis', reason: 'Cache and session store.', recommended: true },
    { id: 'ddev/ddev-rabbitmq', reason: 'Transport for Symfony Messenger.', recommended: true },
    { id: 'ddev/ddev-cron', reason: 'Scheduled commands.', recommended: false },
    { id: 'kevinquillen/ddev-meilisearch', reason: 'Search integration.', recommended: false },
    { id: 's2b/ddev-vite-sidecar', reason: 'Vite/Encore dev server with HMR.', recommended: false }
  ],
  wordpress: [
    { id: 'ddev/ddev-redis', reason: 'Object cache for faster page loads.', recommended: true },
    { id: 'ddev/ddev-phpmyadmin', reason: 'Browse and edit the WordPress database.', recommended: true },
    { id: 'ddev/ddev-cron', reason: 'Real cron instead of visitor-triggered wp-cron.', recommended: false },
    { id: 'ddev/ddev-elasticsearch', reason: 'Powers ElasticPress search.', recommended: false }
  ],
  drupal: [
    { id: 'ddev/ddev-redis', reason: 'Cache backend for Drupal.', recommended: true },
    { id: 'ddev/ddev-drupal-solr', reason: 'Search API + Apache Solr.', recommended: true },
    { id: 'ddev/ddev-adminer', reason: 'Quick database browser.', recommended: false },
    { id: 'ddev/ddev-cron', reason: 'Runs Drupal cron on a schedule.', recommended: false }
  ],
  typo3: [
    { id: 'ddev/ddev-typo3-solr', reason: 'Apache Solr for EXT:solr.', recommended: true },
    { id: 'ddev/ddev-redis', reason: 'Caching framework backend.', recommended: true },
    { id: 'ddev/ddev-adminer', reason: 'Quick database browser.', recommended: false }
  ],
  craftcms: [
    { id: 'ddev/ddev-redis', reason: 'Cache and queue backend for Craft.', recommended: true },
    { id: 'ddev/ddev-minio', reason: 'S3-compatible asset volumes.', recommended: false },
    { id: 'ddev/ddev-adminer', reason: 'Quick database browser.', recommended: false }
  ],
  magento2: [
    { id: 'ddev/ddev-opensearch', reason: 'Catalog search (required by Magento 2).', recommended: true },
    { id: 'ddev/ddev-redis', reason: 'Cache and session storage.', recommended: true },
    { id: 'ddev/ddev-rabbitmq', reason: 'Message queue for async operations.', recommended: true }
  ],
  shopware6: [
    { id: 'ddev/ddev-opensearch', reason: 'Product search backend.', recommended: true },
    { id: 'ddev/ddev-redis', reason: 'Cache and session storage.', recommended: true },
    { id: 'ddev/ddev-rabbitmq', reason: 'Async message handling.', recommended: false }
  ],
  silverstripe: [
    { id: 'ddev/ddev-redis', reason: 'Cache backend.', recommended: false },
    { id: 'ddev/ddev-solr', reason: 'Full-text search.', recommended: false },
    { id: 'ddev/ddev-adminer', reason: 'Quick database browser.', recommended: false }
  ],
  cakephp: [
    { id: 'ddev/ddev-redis', reason: 'Cache backend.', recommended: false },
    { id: 'ddev/ddev-adminer', reason: 'Quick database browser.', recommended: false }
  ],
  backdrop: [
    { id: 'ddev/ddev-adminer', reason: 'Quick database browser.', recommended: false },
    { id: 'ddev/ddev-redis', reason: 'Cache backend.', recommended: false }
  ],
  php: [
    { id: 'ddev/ddev-redis', reason: 'Common cache / data store.', recommended: false },
    { id: 'ddev/ddev-adminer', reason: 'Quick database browser.', recommended: false },
    { id: 'ddev/ddev-cron', reason: 'Scheduled jobs in the web container.', recommended: false }
  ],
  generic: [
    { id: 'ddev/ddev-redis', reason: 'Common cache / data store.', recommended: false },
    { id: 'ddev/ddev-minio', reason: 'S3-compatible object storage.', recommended: false },
    { id: 'ddev/ddev-adminer', reason: 'Quick database browser.', recommended: false }
  ]
}

/** Recommendations for a project type, falling back to the generic set. */
export function bundleFor(projectType: string): Recommendation[] {
  if (FRAMEWORK_BUNDLES[projectType]) return FRAMEWORK_BUNDLES[projectType]
  // drupal10 / drupal11 → drupal, etc.
  if (projectType.startsWith('drupal')) return FRAMEWORK_BUNDLES.drupal
  return FRAMEWORK_BUNDLES.php
}
