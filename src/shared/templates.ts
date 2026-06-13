/**
 * DDevUI app templates — first-class support for non-PHP stacks on top of
 * ddev's `generic` project type.
 *
 * Mechanism: ddev merges every `.ddev/config.*.yaml` over the base config, so
 * a template is just `ddev config --project-type=generic` plus our own
 * `config.<id>.yaml` declaring `web_extra_daemons` (the dev server) and
 * `web_extra_exposed_ports` (router → https://<name>.ddev.site).
 *
 * The daemon command is hardened so the dev server comes up reliably:
 *  - installs dependencies INSIDE the container (so native modules match Linux,
 *    not the host OS), exactly once, tracked by a sentinel — restarts are fast;
 *  - seeds `.env` from `.env.example` when missing;
 *  - waits quietly (instead of crash-looping) when there's no app yet;
 *  - `exec`s the dev server so signals/restarts propagate cleanly.
 */

export interface TemplateFile {
  /** Relative to the project root. */
  path: string
  content: string
}

export interface AppTemplate {
  id: string
  label: string
  hint: string
  /** Brand icon key, resolved by the renderer. */
  brand: 'nextjs' | 'vite' | 'express' | 'fastapi' | 'django' | 'flask'
  /** Container port the dev server listens on (also surfaced in the wizard). */
  port: number
  /** Default Node version offered in the wizard (node-based stacks). */
  needsNode: boolean
  files: TemplateFile[]
  /** Shown in the wizard so users know what happens and what's next. */
  notes: string[]
}

/**
 * Build the `bash -lc '…'` daemon line. NOTE: kept free of single/double quotes
 * so it nests cleanly inside the double-quoted YAML scalar below.
 */
function nodeDaemon(command: string): string {
  return [
    'cd /var/www/html',
    // No app yet? Don't crash-loop — wait until the user scaffolds + restarts.
    'if [ ! -f package.json ]; then echo ddev: no package.json yet - scaffold your app then run ddev restart; exec sleep infinity; fi',
    // Seed .env from .env.example on first run.
    '[ -f .env ] || { [ -f .env.example ] && cp .env.example .env; }',
    // Install in-container once (or when the lockfile changes) so native modules
    // (e.g. @next/swc, lightningcss) match Linux rather than the host OS — the
    // usual cause of a stuck 502. The sentinel keeps later restarts fast.
    'if [ ! -f node_modules/.ddev-installed ] || [ package-lock.json -nt node_modules/.ddev-installed ]; then npm install --no-audit --no-fund && touch node_modules/.ddev-installed; fi',
    `exec ${command}`
  ].join('; ')
}

function pythonDaemon(command: string): string {
  return [
    'cd /var/www/html',
    '[ -f .env ] || { [ -f .env.example ] && cp .env.example .env; }',
    '[ -f requirements.txt ] && pip install -q -r requirements.txt',
    `exec ${command}`
  ].join('; ')
}

function daemonYaml(id: string, daemonCommand: string, port: number): string {
  return `# DDevUI template: ${id} — merged over .ddev/config.yaml (safe to edit).
# Delete node_modules/.ddev-installed inside the container to force a reinstall.
web_extra_daemons:
  - name: ${id}
    command: "bash -lc '${daemonCommand}'"
    directory: /var/www/html
web_extra_exposed_ports:
  - name: ${id}
    container_port: ${port}
    http_port: 80
    https_port: 443
`
}

function nodeDaemonYaml(id: string, command: string, port: number): string {
  return daemonYaml(id, nodeDaemon(command), port)
}

function pythonDaemonYaml(id: string, command: string, port: number): string {
  return daemonYaml(id, pythonDaemon(command), port)
}

const PYTHON_DOCKERFILE = `# Python runtime for this project's web container (DDevUI template)
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y -o Dpkg::Options::="--force-confnew" --no-install-recommends --no-install-suggests python3 python3-pip python3-venv
RUN python3 -m venv /opt/venv && chmod -R ugo+w /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
`

const DB_NOTE =
  'Database is optional — if you keep one, reach it from containers at host "db" (user/password/database all "db").'

const FIRST_START_NOTE =
  'First start installs dependencies in the container and compiles once — the URL may show 502 for up to a minute, then it goes live. Later restarts are fast.'

const INSTALL_NOTE =
  'Dependencies install inside the container so native modules match Linux — you don’t need to run install on your host.'

const ENV_NOTE = 'A missing .env is seeded from .env.example automatically; fill in any required values.'

export const APP_TEMPLATES: AppTemplate[] = [
  {
    id: 'nextjs',
    label: 'Next.js',
    hint: 'next dev on :3000',
    brand: 'nextjs',
    port: 3000,
    needsNode: true,
    files: [
      { path: '.ddev/config.nextjs.yaml', content: nodeDaemonYaml('nextjs', 'npm run dev -- -p 3000 -H 0.0.0.0', 3000) }
    ],
    notes: [
      FIRST_START_NOTE,
      INSTALL_NOTE,
      ENV_NOTE,
      'No app yet? Run tab → `npx create-next-app@latest . --yes`, then restart.',
      DB_NOTE
    ]
  },
  {
    id: 'vite',
    label: 'Vite',
    hint: 'vite dev on :5173',
    brand: 'vite',
    port: 5173,
    needsNode: true,
    files: [
      { path: '.ddev/config.vite.yaml', content: nodeDaemonYaml('vite', 'npm run dev -- --host 0.0.0.0 --port 5173', 5173) }
    ],
    notes: [
      FIRST_START_NOTE,
      INSTALL_NOTE,
      'Works for React/Vue/Svelte Vite apps — scaffold with `npm create vite@latest .` in the Run tab, then restart.',
      'HMR websockets are routed through the ddev router automatically.'
    ]
  },
  {
    id: 'express',
    label: 'Express / Node',
    hint: 'npm start on :3000',
    brand: 'express',
    port: 3000,
    needsNode: true,
    files: [{ path: '.ddev/config.express.yaml', content: nodeDaemonYaml('express', 'npm start', 3000) }],
    notes: [
      FIRST_START_NOTE,
      INSTALL_NOTE,
      'Expects `npm start` to listen on 0.0.0.0:3000 — adjust .ddev/config.express.yaml if your app differs.',
      DB_NOTE
    ]
  },
  {
    id: 'fastapi',
    label: 'FastAPI',
    hint: 'uvicorn on :8000',
    brand: 'fastapi',
    port: 8000,
    needsNode: false,
    files: [
      { path: '.ddev/web-build/Dockerfile.python', content: PYTHON_DOCKERFILE },
      {
        path: '.ddev/config.fastapi.yaml',
        content: pythonDaemonYaml('fastapi', 'uvicorn main:app --host 0.0.0.0 --port 8000 --reload', 8000)
      }
    ],
    notes: [
      FIRST_START_NOTE,
      'Expects `main.py` exposing `app` in the project root — edit .ddev/config.fastapi.yaml to change.',
      'requirements.txt is pip-installed (into a venv baked into the image) before the server starts.',
      ENV_NOTE,
      DB_NOTE
    ]
  },
  {
    id: 'django',
    label: 'Django',
    hint: 'runserver on :8000',
    brand: 'django',
    port: 8000,
    needsNode: false,
    files: [
      { path: '.ddev/web-build/Dockerfile.python', content: PYTHON_DOCKERFILE },
      {
        path: '.ddev/config.django.yaml',
        content: pythonDaemonYaml('django', 'python3 manage.py runserver 0.0.0.0:8000', 8000)
      }
    ],
    notes: [
      FIRST_START_NOTE,
      'Point settings.py DATABASES at host "db" (user/password/name: "db", port 3306/5432 by engine).',
      'Add your generated hostname to ALLOWED_HOSTS, e.g. ".ddev.site".',
      'requirements.txt is pip-installed automatically before runserver.'
    ]
  },
  {
    id: 'flask',
    label: 'Flask',
    hint: 'flask run on :5000',
    brand: 'flask',
    port: 5000,
    needsNode: false,
    files: [
      { path: '.ddev/web-build/Dockerfile.python', content: PYTHON_DOCKERFILE },
      {
        path: '.ddev/config.flask.yaml',
        content: pythonDaemonYaml('flask', 'flask --app app run --host 0.0.0.0 --port 5000 --debug', 5000)
      }
    ],
    notes: [
      FIRST_START_NOTE,
      'Expects `app.py` in the project root — edit .ddev/config.flask.yaml to change the entry point.',
      ENV_NOTE,
      DB_NOTE
    ]
  }
]

export function findTemplate(id: string): AppTemplate | undefined {
  return APP_TEMPLATES.find((t) => t.id === id)
}
