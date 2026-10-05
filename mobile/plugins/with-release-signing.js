/**
 * Signs release builds with the Technova release key instead of the debug key.
 * The keystore and its password stay outside the repo, in ~/.gradle/gradle.properties:
 *   TECHNOVA_UPLOAD_STORE_FILE, TECHNOVA_UPLOAD_KEY_ALIAS,
 *   TECHNOVA_UPLOAD_STORE_PASSWORD, TECHNOVA_UPLOAD_KEY_PASSWORD
 * Without them (e.g. another laptop) release builds fall back to the debug key.
 */
const { withAppBuildGradle } = require('expo/config-plugins')

const RELEASE_CONFIG = `
        release {
            if (project.hasProperty('TECHNOVA_UPLOAD_STORE_FILE')) {
                storeFile file(TECHNOVA_UPLOAD_STORE_FILE)
                storePassword TECHNOVA_UPLOAD_STORE_PASSWORD
                keyAlias TECHNOVA_UPLOAD_KEY_ALIAS
                keyPassword TECHNOVA_UPLOAD_KEY_PASSWORD
            }
        }`

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, cfg => {
    let g = cfg.modResults.contents
    if (g.includes('TECHNOVA_UPLOAD_STORE_FILE')) return cfg
    g = g.replace(/signingConfigs \{\n/, m => m + RELEASE_CONFIG.slice(1) + '\n')
    // In the release build type, use the release key when it is configured
    g = g.replace(/(release \{[^}]*?)signingConfig signingConfigs\.debug/, (_, head) =>
      `${head}signingConfig project.hasProperty('TECHNOVA_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug`)
    cfg.modResults.contents = g
    return cfg
  })
}
