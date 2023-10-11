/**
 * @hperchec/readme-generator [/.docs/readme/data.js]
 * @file Data for default readme template render
 * This data will be injected in ./template.md
 * @author Hervé Perchec <herve.perchec@gmail.com>
 */

'use strict'

// Constants
const { defaultInitTargetRelativePath } = require('../../src')

// Import package.json data
const pkg = require('../../package.json')
// Based on the package.json file, get some data and informations
const dependencies = pkg.dependencies || {}
const devDependencies = pkg.devDependencies || {}
const peerDependencies = pkg.peerDependencies || {}
const author = pkg.author
const contributors = pkg.contributors || []
const license = pkg.license || 'Unknown'
const homepage = pkg.homepage
const repository = pkg.repository
const packageUrl = `https://www.npmjs.com/package/${pkg.name}`
const projectUrl = repository.url.match(/^[git\+]?(.*)\.git$/)[1] // find string between 'git+' and '.git'
const projectPath = projectUrl.replace('https://gitlab.com/', '') // remove domain name
const issuesUrl = pkg.bugs.url

/**
 * Export data for readme file templating
 */
module.exports = {
  pkg,
  dependencies,
  devDependencies,
  peerDependencies,
  author,
  contributors,
  license,
  homepage,
  repository,
  packageUrl,
  projectUrl,
  projectPath,
  issuesUrl,
  // Custom data
  defaultInitTargetRelativePath: defaultInitTargetRelativePath
}
