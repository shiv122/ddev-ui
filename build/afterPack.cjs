// electron-builder afterPack hook: ad-hoc sign the macOS app bundle.
//
// We have no Apple Developer ID, so electron-builder skips code signing. But it
// assembles the bundle (our Info.plist, icon, resources) on top of Electron's
// built-in linker signature, which invalidates it. macOS then refuses to open
// the downloaded app, reporting it as "damaged". Re-signing the finished bundle
// ad-hoc ('-') produces a valid signature. The app is still unnotarized, so
// users must right-click → Open (or clear the quarantine flag) on first launch,
// but it is no longer flagged as damaged.
const { execFileSync } = require('node:child_process')
const path = require('node:path')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return
  const appName = `${context.packager.appInfo.productFilename}.app`
  const appPath = path.join(context.appOutDir, appName)
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], {
    stdio: 'inherit'
  })
  console.log(`  • ad-hoc signed ${appName} (afterPack)`)
}
