# Design das telas

`invokyr.pen` é o arquivo do [Pencil](https://pencil.dev) com as telas; as capturas `screen-*.png` mostram as telas 2 a 7. A tela 1 (Sessão & Heróis) existe no `.pen`, mas a captura não está no repo porque mostrava SteamIDs e apelidos reais; no `.pen` eles foram trocados por placeholders.

Os tokens (cores, tipografia) foram levados para `src/ui/tokens.css`: fundo mogno `#100A08`, borda de latão `#7A6028`, texto dourado `#E5C158` (o `#D4AF37` ficou só no design), verde (`--btn-green-*`), vermelho de lacre (`--btn-wax-*`), Cinzel e Inter.

## O design é um mockup, não a fonte dos dados

Os textos de exemplo do design vieram da primeira especificação do projeto (removida do repo), que a análise do jogo corrigiu (veja `docs/SCHEMA_VERIFIED.md` §7). O app segue o **visual** do design e os **dados verificados**. Diferenças deliberadas:

| No design | No app (verificado no jogo) |
| :-- | :-- |
| 31 monstros/estatuetas, bitmask `0x7FFFFFFF` | 17 figuras (as estatuetas do bestiário), máscara `0x1FFFF` |
| Nomes de monstros inventados ("O Banqueiro", "Verme da Areia", "Estátua Chorona") | Nomes do próprio jogo em pt-BR ("Abonado", "Minhoca", "Manequim") |
| 5 portas (índices 0 a 4) | 2 portas com chave: Henry e Corredor |
| Rótulos das 6 skins ("Clássico" a "Pedra Ocre") | Mantidos: o jogo não tem nomes localizados para skins; índice 0 a 5, na ordem do jogo |
| Itens como "Espada de Ferro" e "Escudo de Carvalho" | Catálogo real: 135 itens por `itemAlias`, 6 com bateria |
| Dificuldade de 1 a 5 | Enum de 0 a 4, exibido como 1 a 5 estrelas |
| Vida "+25 PV por nível" | Bônus cumulativo de +20 PV por nível (20 a 160) |
| Biomas "Manor" | `BiomeChoice`: Padrão, Gelo, Selva, Deserto, Abismo, Cinzas, Infinito |

Ainda não implementado do design: ícones nas abas e botões e o catálogo em tela cheia.
