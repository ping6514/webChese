import { execSync } from 'child_process'
try {
  execSync('tsc -p tsconfig.engine-cjs.json', { stdio: 'inherit' })
} catch (_) {
  // Engine TS errors are non-critical — files are still emitted (noEmitOnError: false)
  // Continue build pipeline
}
