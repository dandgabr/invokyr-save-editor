// Compara o build do Invokyr instalado na Steam com o build para o qual o schema foi verificado.
// Uso: npm run check:game   (ou INVOKYR_APPMANIFEST=/caminho/appmanifest_3883570.acf npm run check:game)
// Saída: 0 = build igual ao verificado; 1 = jogo atualizado (reverificar o schema); 2 = manifesto não encontrado.
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const APP_ID = '3883570';
const MANIFEST = `appmanifest_${APP_ID}.acf`;

export function parseBuildId(acf) {
  const m = /"buildid"\s+"(\d+)"/.exec(acf);
  return m ? m[1] : null;
}

function candidates() {
  const home = homedir();
  return [
    process.env.INVOKYR_APPMANIFEST,
    join(home, '.local/share/Steam/steamapps', MANIFEST),
    join(home, '.steam/steam/steamapps', MANIFEST),
    join(home, '.var/app/com.valvesoftware.Steam/.local/share/Steam/steamapps', MANIFEST),
    join('C:\\Program Files (x86)\\Steam\\steamapps', MANIFEST),
  ].filter(Boolean);
}

function main() {
  const verified = JSON.parse(readFileSync(new URL('../docs/schema.json', import.meta.url), 'utf-8')).build.steam_buildid;
  const path = candidates().find((p) => existsSync(p));
  if (!path) {
    console.error(`Manifesto ${MANIFEST} não encontrado. Defina INVOKYR_APPMANIFEST com o caminho dele (Steam → steamapps/).`);
    process.exit(2);
  }
  const installed = parseBuildId(readFileSync(path, 'utf-8'));
  if (installed === null) {
    console.error(`Não foi possível ler o buildid em ${path}.`);
    process.exit(2);
  }
  if (installed === String(verified)) {
    console.log(`OK: build instalado ${installed} = build verificado (docs/schema.json).`);
    return;
  }
  console.error(
    `ATENÇÃO: o jogo foi atualizado. Instalado: ${installed}; schema verificado: ${verified}.\n` +
      'Reverifique o schema do save (classes, enums, versão) conforme docs/ARCHITECTURE.md → "Depois de uma atualização do jogo".',
  );
  process.exit(1);
}

import { pathToFileURL } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
