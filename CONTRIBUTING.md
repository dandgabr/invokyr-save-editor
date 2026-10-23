# Contribuindo

Obrigado por querer ajudar. Este é um projeto pequeno; o fluxo é simples.

## Preparar o ambiente

- Node 22 ou mais recente e `npm`.
- `npm ci` instala as dependências (versões exatas).
- Para o teste cruzado com o codec Python: `pip install msgpack`. Sem isso o teste é ignorado, sem aviso.
- Para os e2e (`npm run e2e`): fora do CI o Playwright usa `/usr/bin/chromium-browser`. No macOS e no Windows, defina `PLAYWRIGHT_CHROMIUM_PATH` ou rode `npx playwright install chromium`.

## Antes de abrir um PR

Rode o que o CI roda: `npm run lint`, `npm run docs:lint`, `npm run typecheck`, `npm test`, `npm run build` e `npm run e2e`.

- Commits no padrão convencional (`feat:`, `fix:`, `chore:`, `docs:`, `ci:`), com escopo opcional, em pt-BR.
- A `main` é protegida: exige os checks `verify` e `e2e`, histórico linear e não aceita force-push. Abra um PR a partir de uma branch.
- **Dependências:** a política é manter a versão mais recente e **zero vulnerabilidades** (`npm audit`). Uma dependência sem versão compatível ou com vulnerabilidade sem correção é **substituída por uma alternativa**, não congelada, e não se adicionam regras de ignorar no Dependabot. Remova dependências sem uso.
- **Dados pessoais:** nunca versione um `.sav` real, SteamIDs ou apelidos. Os fixtures usam SteamIDs placeholder (`765611980000000NN`).
- **A fonte da verdade é o jogo.** Mudança em campo, tipo, enum ou catálogo precisa de evidência do jogo e atualiza os documentos de schema (`docs/SCHEMA_VERIFIED.md`, `docs/SCHEMA_ITEMS.md`) e, se for o caso, `src/schema/*` e o catálogo (`node scripts/gen-catalog.mjs`). O `tests/docs.test.ts` falha se a documentação citar arquivos, comandos ou números que não batem com o código.

## Se o jogo for atualizado

Siga a seção "Depois de uma atualização do jogo" em [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Relatando problemas

Use os formulários de issue. Vulnerabilidades: [`SECURITY.md`](SECURITY.md).
