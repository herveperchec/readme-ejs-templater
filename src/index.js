/**
 * @file Entry point to generate readme file
 * @description @hperchec/readme-generator [/src/index.js]
 * @author Hervé Perchec <herve.perchec@gmail.com>
 */

/**
 * @module readme-generator
 * @type {object}
 * @typicalname readmeGenerator
 * @description
 * From: `@hperchec/readme-generator@{{{{VERSION}}}}`
 * @example
 * const readmeGenerator = require('@hperchec/readme-generator')
 */

'use strict'

/**
 * Configuration object definition
 * @typedef {object} Configuration
 * @property {string} [fileName] - Output file name: `README.md` by default. Only for **generate** method
 * @property {string} [destFolder] - Output path, default is `process.cwd` (project root). Only for **generate** method
 * @property {string} [templatePath] - Template path: default is `.docs/readme/template.md`
 * @property {string} [ejsDataPath] -  Path to EJS data file: default is `.docs/readme/data.js`
 * @property {object} [ejsOptions] - EJS options: see also {@link https://www.npmjs.com/package/ejs#options EJS documentation}.
 * @property {string[]} [ejsOptions.root] - The path of template folder is automatically included.
 * @property {string[]} [ejsOptions.views] - The path of template folder and the path of internal partials are automatically included.
 * @property {boolean} [appendAutoGenMessage] - If true, append "don't edit" message to rendered markdown. Default is **true**.
 * @property {boolean} [autoToc] - If true, parse `<!-- toc -->` special comment to automatically inject generated table of contents. Default is **true**.
 * The `markdown-toc` package is used for this feature, check the {@link https://www.npmjs.com/package/markdown-toc documentation}.
 * @property {Function} [slugify] - If provided, will be used by `markdown-toc` to slugify headings id.
 * Default uses `github-slugger` (⚠ v1.5.0): see [**slug** method documentation](https://github.com/Flet/github-slugger#usage).
 */

// Dependencies
const path = require('path')
const fs = require('fs')
const colors = require('colors') // eslint-disable-line no-unused-vars
const merge = require('lodash.merge')
const ejs = require('ejs')
const mdu = require('markdown-utils')
const markdownTable = require('markdown-table')
const markdownToc = require('markdown-toc')
const asciitree = require('ascii-tree')
const GithubSlugger = require('github-slugger') // (⚠ v1.5.0 - v2 is ESM only)

const slugger = new GithubSlugger()

// Constants
const { DEFAULT_INIT_TARGET_RELATIVE_PATH } = require('./constants')

/**
 * Exports
 */

/**
 * @alias module:readme-generator.generate
 * @param {Configuration} config - The configuration object
 * @returns {void}
 * @throws Throws error if render or file writing fails
 * @description
 * Writes rendered README markdown to file
 * @example
 * const result = readmeGenerator.generate({
 *   // Your options
 *   // ...
 * })
 * // => output to README.md file
 */
const generate = exports.generate = function (config) { // eslint-disable-line no-unused-vars
  // First, parse custom config
  const processedConfig = processConfig(config)
  // Target file path
  const targetFilePath = path.join(processedConfig.destFolder, processedConfig.fileName)

  // Some console outputs
  console.log(`Auto-generating "${processedConfig.fileName}" file`)
  console.log()
  console.log('- Syntax: ' + 'ejs'.yellow)

  // Render markdown
  const renderResult = render(processedConfig)

  try {
    // Try to write file (synchronous)
    fs.writeFileSync(targetFilePath, renderResult)
  } catch (error) {
    // Log fail and throw error
    console.log('- Status:', '✘ FAILED'.red)
    throw error
  }
  // Log success
  console.log('- Status:', '✔ OK'.green)
  console.log('- Written to: "' + (targetFilePath).cyan + '"')
  console.log()
}

/**
 * @alias module:readme-generator.render
 * @param {Configuration} config - Same as generate config but `fileName` and `destFolder` option are just ignored
 * @returns {string} Returns the rendered markdown as string
 * @description
 * Render README markdown
 * @example
 * const result = readmeGenerator.render({
 *   // Your options
 *   // ...
 * })
 */
const render = exports.render = function (config) {
  // First, parse custom config
  const processedConfig = processConfig(config)

  // Data
  const data = require(processedConfig.ejsDataPath)
  // Use ejs to template README file
  // Merge with user data
  const ejsData = merge({
    ...defaultEjsData,
    $config: processedConfig
  }, data)

  // Read file
  let input = fs.readFileSync(processedConfig.templatePath, { encoding: 'utf8' })
  // Append auto generated message to input
  if (processedConfig.appendAutoGenMessage) {
    input += '\n<%- include(\'common/auto-generated-message.md\') %>'
  }
  // Render
  let content = ejs.render(input, ejsData, processedConfig.ejsOptions)

  // Then, parse for auto toc
  if (processedConfig.autoToc) {
    // markdown-toc 'firsth1' option is broken when using "<!-- toc -->" special comment in template
    // See https://github.com/jonschlinkert/markdown-toc/pull/192
    // So, as we can't use insert method for the moment, we generate our own toc
    // with the help of markdown-toc utils

    const escapeTocComment = (comment) => {
      // <!-- toc --> = <\!-- toc -->
      const parsable = comment.match(/<!-- toc -->/)
      if (parsable) {
        return '<\\!-- toc -->'
      }
      // <\!-- toc --> = <\\!-- toc -->
      const isAlreadyEscaped = comment.match(/<\\!-- toc -->/)
      if (isAlreadyEscaped) {
        return '<\\\\!-- toc -->'
      }
      // Else return as is
      return comment
    }

    const unescapeTocComment = (comment) => {
      // <\!-- toc --> = <!-- toc -->
      const isEscaped = comment.match(/<\\!-- toc -->/)
      if (isEscaped) {
        return '<!-- toc -->'
      }
      // <\\!-- toc --> = <\!-- toc -->
      const isDoubleEscaped = comment.match(/<\\\\!-- toc -->/)
      if (isDoubleEscaped) {
        return '<\\!-- toc -->'
      }
      // Else return as is
      return comment
    }

    // First, escape toc comments from content
    content = content.replaceAll(/<[\\]?!-- toc -->/g, escapeTocComment)

    // Then parse with markdown-toc
    const tocTokens = markdownToc(content)
      .json
      .filter((tok) => tok.lvl > 1) // keep only min h2
      .map((tok) => markdownToc.linkify(tok, { slugify: processedConfig.slugify })) // linkify content (accepts custom slugger)

    // Generate bullets
    const bullets = markdownToc.bullets(tocTokens, {
      firsth1: false,
      highest: 1, // force to 1 to ignore h1
      maxdepth: 6, // set manually maxdepth,
      chars: '-'
    })

    // Revert toc comments escaping
    content = content.replaceAll(/<[\\]{1,2}!-- toc -->/g, unescapeTocComment)

    // Find "<!-- toc -->" special comment in template
    content = content.replace(/(?:<!-- toc -->)/g, bullets)

    // Finally, unescape volontary escaped toc comments
    content = content.replaceAll(/<\\!-- toc -->/g, unescapeTocComment)
  }

  return content
}

/**
 * @alias module:readme-generator.processConfig
 * @param {Configuration} config - The config object to process
 * @returns {Configuration} Returns the processed configuration
 * @description
 * Takes a custom config as unique parameter and merges it with the default configuration object.
 * @example
 * const processedConfig = readmeGenerator.processConfig({
 *   // Your config
 *   // ...
 * })
 * // => returns the processed config object
 */
const processConfig = exports.processConfig = function (config) {
  const result = {}
  result.fileName = config.fileName || defaultConfig.fileName
  result.destFolder = config.destFolder || defaultConfig.destFolder
  result.templatePath = config.templatePath || defaultConfig.templatePath
  result.ejsDataPath = config.ejsDataPath || defaultConfig.ejsDataPath
  // If custom ejs options
  if (config.ejsOptions) {
    result.ejsOptions = {
      root: defaultConfig.ejsOptions.root, // root prop see below (always array)
      views: defaultConfig.ejsOptions.views, // views prop see below (always array)
      ...config.ejsOptions
    }
    // Ensure that ejs root option includes templatePath folder
    const rootTemplatePath = path.dirname(result.templatePath)
    if (!result.ejsOptions.root.includes(rootTemplatePath)) {
      result.ejsOptions.root.unshift(rootTemplatePath)
    }
    // Ensure that ejs views option includes viewsInternalIncludesPath & viewsTemplatePath
    const viewsInternalIncludesPath = path.resolve(__dirname, 'partials')
    if (!result.ejsOptions.views.includes(viewsInternalIncludesPath)) {
      result.ejsOptions.views.unshift(viewsInternalIncludesPath)
    }
    const viewsTemplatePath = path.dirname(result.templatePath)
    if (!result.ejsOptions.views.includes(viewsTemplatePath)) {
      result.ejsOptions.views.unshift(viewsTemplatePath)
    }
  } else {
    result.ejsOptions = defaultConfig.ejsOptions
  }
  result.appendAutoGenMessage = config.appendAutoGenMessage !== undefined
    ? config.appendAutoGenMessage
    : defaultConfig.appendAutoGenMessage
  result.autoToc = config.autoToc !== undefined
    ? config.autoToc
    : defaultConfig.autoToc
  result.slugify = config.slugify !== undefined
    ? config.slugify
    : defaultConfig.slugify
  return result
}

/**
 * @ignore
 * @type {string}
 */
exports.defaultInitTargetRelativePath = DEFAULT_INIT_TARGET_RELATIVE_PATH

/**
 * @alias module:readme-generator.defaultConfig
 * @type {Configuration}
 * @description
 * Returns the default configuration object.
 * This base configuration is used by `processConfig` method and so `generate` and `render` methods.
 * See also {@link module:readme-generator~Configuration Configuration} defaults.
 */
const defaultConfig = exports.defaultConfig = {
  fileName: 'README.md',
  destFolder: process.cwd(),
  templatePath: path.resolve(process.cwd(), DEFAULT_INIT_TARGET_RELATIVE_PATH, 'template.md'),
  ejsDataPath: path.resolve(process.cwd(), DEFAULT_INIT_TARGET_RELATIVE_PATH, 'data.js'),
  ejsOptions: {
    /**
     * Set project root for includes with an absolute path (e.g, /file.ejs).
     * Can be array to try to resolve include from multiple directories.
     */
    root: [
      // User template path
      path.resolve(process.cwd(), DEFAULT_INIT_TARGET_RELATIVE_PATH)
    ],
    /**
     *  An array of paths to use when resolving includes with relative paths.
     */
    views: [
      // Includes from readme-generator partials
      path.resolve(__dirname, 'partials'),
      // User template path
      path.resolve(process.cwd(), DEFAULT_INIT_TARGET_RELATIVE_PATH)
    ]
  },
  appendAutoGenMessage: true,
  autoToc: true,
  slugify: slugger.slug.bind(slugger)
}

/**
 * @alias module:readme-generator.defaultEjsData
 * @type {object}
 * @description
 * Returns the default EJS data object.
 * This base EJS data object is used by `render` methods and merged with user provided EJS data.
 */
const defaultEjsData = exports.defaultEjsData = {
  /**
   * @alias module:readme-generator.defaultEjsData.$config
   * @type {Configuration}
   * @description
   * Contains the default configuration by default.
   * Will be merged with custom configuration when using `generate` or `render` method.
   * @example
   * // Access configuration
   * $config.fileName // => README.md
   */
  $config: processConfig({}),
  /**
   * @alias module:readme-generator.defaultEjsData.$utils
   * @type {object}
   * @description
   * Contains the following methods:
   *
   * - `table`: generates a markdown table
   * - `asciiTree`: generates an "ASCII" tree
   * - ... all methods from `markdown-utils` package
   *
   * > Please check the following package documentations:
   * > - [markdown-utils](https://github.com/jonschlinkert/markdown-utils)
   * > - [markdown-table](https://www.npmjs.com/package/markdown-table) (⚠ v1.1.3)
   * > - [ascii-tree](https://www.npmjs.com/package/ascii-tree)
   * @example
   * // Generates a blockquote
   * $utils.blockquote('This is a blockquote')
   * // Generates a table
   * $utils.table([
   *   [ 'Column 1', 'Column 2' ],
   *   [ 'Value 1', 'Value 2' ]
   * ])
   * // Generates an ascii tree
   * $utils.asciiTree('*.\n**a\n**b\n*...')
   */
  $utils: {
    // markdown-utils
    ...mdu,
    // markdown-table
    table: markdownTable,
    // ascii-tree
    asciiTree: asciitree.generate
  }
}
