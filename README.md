# Invokyr Save Editor

Editor web de saves do **Invokyr** (Ludogram, Steam AppID `3883570`). Roda 100% no navegador: o `.sav` é lido, editado e gravado localmente e **nunca é enviado a servidor algum**.

> Projeto de fã, **não afiliado à Ludogram**. Edite saves por sua conta e risco e **faça backup antes**: feche o jogo e lembre que o Steam Cloud pode sobrescrever o arquivo.

## Status

Em planejamento/bootstrap. O plano completo, com fases e decisões, está em [`docs/PLAN.md`](docs/PLAN.md).

## Princípios

- **A fonte da verdade é o jogo instalado.** A documentação herdada (`docs/legacy/`) não foi verificada contra a build atual, que acabou de ser atualizada. A estrutura do save é conferida no binário antes de virar código.
- Round-trip sem perdas: só os campos tocados pela pessoa mudam.
- Sem telemetria, sem upload, sem backend.

## Estrutura

| Pasta | Conteúdo |
| :-- | :-- |
| `docs/PLAN.md` | Plano do projeto |
| `docs/legacy/` | Spec e guias herdados (não verificados), com dados pessoais trocados por placeholders |
| `docs/design/` | Design das 7 telas (`invokyr.pen`) e screenshots |
| `reference/save_codec.py` | Codec Python de referência, usado como oráculo nos testes |

## Segurança

Veja [`SECURITY.md`](SECURITY.md). Os `.sav` estão no `.gitignore`: eles contêm SteamID64 de outros jogadores.
