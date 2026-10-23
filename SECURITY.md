# Security Policy

## Reporting a vulnerability

Use [GitHub's private vulnerability reporting form](https://github.com/dandgabr/invokyr-save-editor/security/advisories/new)
to send suspected vulnerabilities directly to the maintainers. The repository
has private vulnerability reporting enabled. The custom form is defined in
[`.github/VULNERABILITY_REPORT.yml`](.github/VULNERABILITY_REPORT.yml).

Do not report suspected vulnerabilities through public issues, discussions,
pull requests or other public channels. Do not include credentials, tokens,
real save files or personal data in a report: a `.sav` contains the Steam IDs
of other players, so use synthetic saves. If the private report option is
unavailable, contact the maintainers through the
[repository owner's GitHub profile](https://github.com/dandgabr) and request a
private reporting channel without disclosing technical details.

Include the affected commit or deployed version, the relevant component and
configuration, the browser and operating system, the security impact, and steps
or a proof of concept sufficient to reproduce the issue safely. Please allow
the maintainers to assess and coordinate a fix before public disclosure; no
response-time commitment is made.

## Scope and threat model

- The editor is a static page that processes the save **locally**. Any behavior
  that sends a save, or data from it, outside the browser is a vulnerability.
- Save files are untrusted input: the ZIP container (zip bombs, forged sizes,
  duplicate or encrypted entries), the MessagePack payload (depth, size, hostile
  keys) and out-of-range values must be handled without crashing or running code.
- Writing to the opened file must not damage it: a backup is made first and a
  failed write must leave the original intact.
- Personal data (Steam IDs, nicknames) must never be committed to the repository.

Supply-chain controls: dependencies are kept at their latest versions with zero
known vulnerabilities (`npm audit` in CI), and GitHub Actions are pinned by commit SHA.

## Relatar uma vulnerabilidade (pt-BR)

Use o [formulário privado do GitHub](https://github.com/dandgabr/invokyr-save-editor/security/advisories/new).
Não abra issue pública, não anexe o seu `.sav` real (ele contém SteamIDs de outros
jogadores) e use saves sintéticos para reproduzir.
