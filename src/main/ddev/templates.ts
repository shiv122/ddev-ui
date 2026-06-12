import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { findTemplate } from '@shared/templates'

/**
 * Write an app template's files into a project directory. Called before
 * `ddev config` runs — ddev only writes config.yaml, so our config.<id>.yaml
 * overrides and web-build Dockerfiles are never clobbered.
 */
export async function materializeTemplate(dir: string, templateId: string): Promise<void> {
  const template = findTemplate(templateId)
  if (!template) throw new Error(`Unknown app template: ${templateId}`)
  for (const file of template.files) {
    const target = join(dir, file.path)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, file.content, 'utf8')
  }
}
