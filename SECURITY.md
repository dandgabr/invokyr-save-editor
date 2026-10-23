# Security Policy / Política de segurança

## Reporting a vulnerability

Use [GitHub's private vulnerability reporting form](https://github.com/dandgabr/invokyr-save-editor/security/advisories/new)
to send suspected vulnerabilities directly to the maintainer. The repository
has private vulnerability reporting enabled. The custom form is defined in
[`.github/VULNERABILITY_REPORT.yml`](.github/VULNERABILITY_REPORT.yml).

Do not report suspected vulnerabilities through public issues, discussions,
pull requests or other public channels. Do not include credentials, tokens,
real save files or personal data in a report: a `.sav` contains the Steam IDs
of other players, so use synthetic saves. If the private report option is
unavailable, contact the maintainer through the
[repository owner's GitHub profile](https://github.com/dandgabr) and request a
private reporting channel without disclosing technical details.

Include the affected commit or deployed version, the relevant component and
configuration, the browser and operating system, the security impact, and steps
or a proof of concept sufficient to reproduce the issue safely. Please allow
the maintainer to assess and coordinate a fix before public disclosure; no
response-time commitment is made.

## Scope and threat model

- The editor is a static page that processes the save **locally**. Any behavior
  that sends a save, or data from it, outside the browser is a vulnerability.
- Save files are untrusted input: the ZIP container (zip bombs, forged sizes,
  duplicate or encrypted entries), the MessagePack payload (depth, size, hostile
  keys) and out-of-range values must be handled without crashing or running code.
- Writing must not damage the opened save: in direct-write mode a backup is
  made first and a failed write must leave the original intact; in download mode
  nothing overwrites the original.
- Personal data (Steam IDs, nicknames) must never be committed to the repository.

Supply-chain controls: dependencies are kept at their latest versions with zero
known vulnerabilities (`npm audit` in CI), and GitHub Actions are pinned by commit SHA.

## Relatando uma vulnerabilidade

Use o [formulário privado de relato de vulnerabilidades do GitHub](https://github.com/dandgabr/invokyr-save-editor/security/advisories/new)
para enviar o relato diretamente ao mantenedor. O repositório tem o relato privado habilitado, e o
formulário personalizado está em [`.github/VULNERABILITY_REPORT.yml`](.github/VULNERABILITY_REPORT.yml).

Não relate vulnerabilidades por issues, discussões, pull requests ou outros canais públicos. Não inclua
credenciais, tokens, saves reais nem dados pessoais: um `.sav` contém os SteamIDs de outros jogadores, então
use saves sintéticos. Se a opção de relato privado não estiver disponível, contate o mantenedor pelo
[perfil do dono do repositório](https://github.com/dandgabr) e peça um canal privado, sem divulgar detalhes técnicos.

Informe o commit ou a versão publicada afetados, o componente e a configuração, o navegador e o sistema
operacional, o impacto de segurança e passos (ou uma prova de conceito) suficientes para reproduzir com
segurança. Dê ao mantenedor tempo para avaliar e coordenar a correção antes da divulgação pública; não há
compromisso de prazo de resposta.

**Escopo:** o editor é uma página estática que processa o save localmente. Qualquer comportamento que envie
o save, ou dados dele, para fora do navegador é uma vulnerabilidade. Saves são entrada não confiável (ZIP,
MessagePack e valores fora de faixa não podem travar o app nem executar código), e a gravação não pode
danificar o save aberto.
