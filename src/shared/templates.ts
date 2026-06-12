/**
 * DDEV UI app templates — first-class support for non-PHP stacks on top of
 * ddev's `generic` project type.
 *
 * Mechanism: ddev merges every `.ddev/config.*.yaml` over the base config, so
 * a template is just `ddev config --project-type=generic` plus our own
 * `config.<id>.yaml` declaring `web_extra_daemons` (the dev server) and
 * `web_extra_exposed_ports` (router → https://<name>.ddev.site).
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
  /** Default Node version offered in the wizard (node-based stacks). */
  needsNode: boolean
  files: TemplateFile[]
  /** Shown in the wizard so users know what happens and what's next. */
  notes: string[]
}

function nodeDaemonYaml(id: string, command: string, port: number): string {
  return `# DDEV UI template: ${id} — merged over .ddev/config.yaml (safe to edit)
web_extra_daemons:
  - name: ${id}
    command: "bash -lc 'test -f package.json && npm install --no-audit --no-fund >/dev/null 2>&1; ${command}'"
    directory: /var/www/html
web_extra_exposed_ports:
  - name: ${id}
    container_port: ${port}
    http_port: 80
    https_port: 443
`
}

const PYTHON_DOCKERFILE = `# Python runtime for this project's web container (DDEV UI template)
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y -o Dpkg::Options::="--force-confnew" --no-install-recommends --no-install-suggests python3 python3-pip python3-venv
RUN python3 -m venv /opt/venv && chmod -R ugo+w /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
`

function pythonDaemonYaml(id: string, command: string, port: number): string {
  return `# DDEV UI template: ${id} — merged over .ddev/config.yaml (safe to edit)
web_extra_daemons:
  - name: ${id}
    command: "bash -lc 'test -f requirements.txt && pip install -q -r requirements.txt; ${command}'"
    directory: /var/www/html
web_extra_exposed_ports:
  - name: ${id}
    container_port: ${port}
    http_port: 80
    https_port: 443
`
}

const DB_NOTE =
  'Database is optional — if you keep one, reach it from containers at host "db" (user/password/database all "db").'

export const APP_TEMPLATES: AppTemplate[] = [
  {
    id: 'nextjs',
    label: 'Next.js',
    hint: 'next dev on :3000',
    brand: 'nextjs',
    needsNode: true,
    files: [{ path: '.ddev/config.nextjs.yaml', content: nodeDaemonYaml('nextjs', 'npm run dev -- -p 3000 -H 0.0.0.0', 3000) }],
    notes: [
      'No app yet? Scaffold inside the container: Run tab → `npx create-next-app@latest . --yes`, then restart.',
      'npm install runs automatically before the dev server starts.',
      DB_NOTE
    ]
  },
  {
    id: 'vite',
    label: 'Vite',
    hint: 'vite dev on :5173',
    brand: 'vite',
    needsNode: true,
    files: [{ path: '.ddev/config.vite.yaml', content: nodeDaemonYaml('vite', 'npm run dev -- --host 0.0.0.0 --port 5173', 5173) }],
    notes: [
      'Works for React/Vue/Svelte Vite apps — scaffold with `npm create vite@latest .` in the Run tab, then restart.',
      'HMR websockets are routed through the ddev router automatically.'
    ]
  },
  {
    id: 'express',
    label: 'Express / Node',
    hint: 'npm start on :3000',
    brand: 'express',
    needsNode: true,
    files: [{ path: '.ddev/config.express.yaml', content: nodeDaemonYaml('express', 'npm start', 3000) }],
    notes: [
      'Expects `npm start` to listen on 0.0.0.0:3000 — adjust .ddev/config.express.yaml if your app differs.',
      DB_NOTE
    ]
  },
  {
    id: 'fastapi',
    label: 'FastAPI',
    hint: 'uvicorn on :8000',
    brand: 'fastapi',
    needsNode: false,
    files: [
      { path: '.ddev/web-build/Dockerfile.python', content: PYTHON_DOCKERFILE },
      {
        path: '.ddev/config.fastapi.yaml',
        content: pythonDaemonYaml('fastapi', 'uvicorn main:app --host 0.0.0.0 --port 8000 --reload', 8000)
      }
    ],
    notes: [
      'Expects `main.py` exposing `app` in the project root — edit .ddev/config.fastapi.yaml to change.',
      'requirements.txt is pip-installed (into a venv baked into the image) before the server starts.',
      DB_NOTE
    ]
  },
  {
    id: 'django',
    label: 'Django',
    hint: 'runserver on :8000',
    brand: 'django',
    needsNode: false,
    files: [
      { path: '.ddev/web-build/Dockerfile.python', content: PYTHON_DOCKERFILE },
      {
        path: '.ddev/config.django.yaml',
        content: pythonDaemonYaml('django', 'python3 manage.py runserver 0.0.0.0:8000', 8000)
      }
    ],
    notes: [
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
    needsNode: false,
    files: [
      { path: '.ddev/web-build/Dockerfile.python', content: PYTHON_DOCKERFILE },
      {
        path: '.ddev/config.flask.yaml',
        content: pythonDaemonYaml('flask', 'flask --app app run --host 0.0.0.0 --port 5000 --debug', 5000)
      }
    ],
    notes: [
      'Expects `app.py` in the project root — edit .ddev/config.flask.yaml to change the entry point.',
      DB_NOTE
    ]
  }
]

export function findTemplate(id: string): AppTemplate | undefined {
  return APP_TEMPLATES.find((t) => t.id === id)
}
