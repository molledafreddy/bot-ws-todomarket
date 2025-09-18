// import typescript from 'rollup-plugin-typescript2'

// export default {
//     input: 'src/app.ts',
//     output: {
//         file: 'dist/app.js',
//         format: 'esm',
//     },
//     onwarn: (warning) => {
//         if (warning.code === 'UNRESOLVED_IMPORT') return
//     },
//     plugins: [typescript()],
// }

import typescript from 'rollup-plugin-typescript2'
import fs from 'fs'
import path from 'path'

// Obtiene todos los archivos .ts en src (no recursivo)
const srcDir = 'src'
const inputFiles = fs.readdirSync(srcDir)
  .filter(file => file.endsWith('.ts'))
  .map(file => path.join(srcDir, file))

export default {
    input: inputFiles,
    output: {
        dir: 'dist',
        format: 'esm',
        entryFileNames: '[name].js',
    },
    onwarn: (warning) => {
        if (warning.code === 'UNRESOLVED_IMPORT') return
    },
    plugins: [typescript()],
}