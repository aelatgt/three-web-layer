import resolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import sourceMaps from 'rollup-plugin-sourcemaps'
import typescript from 'rollup-plugin-typescript2'
import json from 'rollup-plugin-json'
import replace from 'rollup-plugin-replace'

const pkg = require('./package.json')

const libraryName = 'three-web-layer'

export default {
  input: `src/three/${libraryName}.ts`,
  output: [
    { file: pkg.main, name: 'WebLayer3D', format: 'umd', sourcemap: true },
    { file: pkg.module, format: 'es', sourcemap: true },
  ],
  external: ['three', 'ethereal'],
  watch: {
    include: 'src/**',
  },
  plugins: [
    // Allow json resolution
    json(),
    // Compile TypeScript files
    typescript({ useTsconfigDeclarationDir: true }),
    // Allow bundling cjs modules 
    commonjs({
      namedExports: {
        'lru_map': ['LRUMap'],
        'fast-sha256': ['hash']
      }
    }),
    // replace process.env.NODE_ENV
    replace({
      'process.env.NODE_ENV': JSON.stringify( 'production' )
    }),
    // Allow node_modules resolution, so you can use 'external' to control
    // which external modules to include in the bundle
    // https://github.com/rollup/rollup-plugin-node-resolve#usage
    resolve(),
    // Resolve source maps to the original source
    sourceMaps(),
  ],
}
