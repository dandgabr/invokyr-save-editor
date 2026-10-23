# Política de segurança

## Reportar uma vulnerabilidade

Use o **relato privado de vulnerabilidades** do GitHub (aba *Security* → *Report a vulnerability*). Não abra issue pública com detalhes de exploração.

## Escopo e modelo de ameaça

- O editor é estático e processa o `.sav` apenas localmente. Qualquer comportamento que envie o save ou dados dele para fora do navegador é uma vulnerabilidade.
- Saves de terceiros são entrada não confiável: ZIP (zip bomb, caminhos), MessagePack (profundidade/tamanho) e valores fora de faixa devem ser tratados sem travar nem executar código.
- Dados pessoais (SteamID64) nunca devem ser commitados.
