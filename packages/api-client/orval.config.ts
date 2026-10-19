import { defineConfig } from 'orval';

// The API's contract (docs/arquitectura.md §3.4). `pnpm generate` writes src/generated/,
// which goes in git; CI generates it again and fails if it changed.
const input = { target: '../../apps/api/openapi.json' };

export default defineConfig({
  api: {
    input,
    output: {
      mode: 'tags-split',
      target: 'src/generated/endpoints',
      schemas: 'src/generated/model',
      client: 'react-query',
      httpClient: 'fetch',
      clean: true,
      formatter: 'prettier',
      override: {
        // Adds the base URL and the token, and throws ApiError for error responses.
        mutator: { path: 'src/fetcher.ts', name: 'customFetch' },
        // Each call returns the body; errors go to TanStack Query as ApiError.
        fetch: { includeHttpResponseReturnType: false },
        operations: {
          // A search changes nothing, so it's a query, cached by its body, even as a POST.
          Caregivers_search: { query: { useQuery: true, useMutation: false } },
        },
      },
    },
  },
  zod: {
    input,
    output: {
      mode: 'tags-split',
      target: 'src/generated/zod',
      client: 'zod',
      fileExtension: '.zod.ts',
      clean: true,
      formatter: 'prettier',
    },
  },
});
