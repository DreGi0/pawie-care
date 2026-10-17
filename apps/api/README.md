# @pawie/api

API REST de Pawie Care, hecha con NestJS 12. Las reglas de negocio que implementa están en [docs/reglas-de-negocio.md](../../docs/reglas-de-negocio.md) y su diseño en [docs/arquitectura.md](../../docs/arquitectura.md).

## Desarrollo

```bash
pnpm infra:up              # desde la raíz: PostgreSQL, Redis y Mailpit
cp .env.example .env
pnpm dev                   # http://localhost:3000, se recarga al guardar
```

## Comandos

| Comando           | Qué hace                                      |
| ----------------- | --------------------------------------------- |
| `pnpm dev`        | Servidor de desarrollo con recarga automática |
| `pnpm build`      | Compila a `dist/`                             |
| `pnpm start:prod` | Corre la versión compilada                    |
| `pnpm lint`       | oxlint con reglas que usan los tipos          |
| `pnpm typecheck`  | Revisión de tipos                             |
| `pnpm test`       | Tests unitarios (Vitest)                      |
| `pnpm test:e2e`   | Tests de punta a punta                        |
| `pnpm test:cov`   | Cobertura de tests                            |
