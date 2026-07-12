import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.itest.ts'],
    // Integração fala com a API real sob rate limit de 4 req/s
    fileParallelism: false,
  },
})
