import { type Locale, selectText } from '../i18n';
import { enumNameOf, localizedName } from '../i18n-labels';
import {
  BIOMES,
  BOARD_MONSTERS,
  FURNITURES,
  HEROES,
  KEY_DOORS,
  UPGRADE_KEYS,
  UPGRADES,
} from '../schema/enums';
import type { SaveValues } from '../schema/types';

/** Keep save paths in the data model; give people a readable field name in the review. */
export function fieldName(path: string, locale: Locale, values?: SaveValues): string {
  const tr = (en: string, pt: string, es: string) => selectText(locale, en, pt, es);
  if (path.startsWith('meta.characterOwners')) {
    const index = Number(/^meta\.characterOwners\[(\d+)\]/.exec(path)?.[1] ?? -1);
    return `${tr('Hero assignment', 'Atribuição de heróis', 'Asignación de héroes')}${index >= 0 ? ` • ${HEROES[index]?.label ?? index + 1}` : ''}`;
  }
  if (path === 'meta.playerCount') return tr('Player count', 'Número de jogadores', 'Número de jugadores');
  if (path.startsWith('save.playerInventories')) {
    const player = Number(/^save\.playerInventories\[(\d+)\]/.exec(path)?.[1] ?? -1);
    const slot = Number(/\.(?:itemStringIds|itemBatteryLevels)\[(\d+)\]/.exec(path)?.[1] ?? -1);
    return `${tr('Carried items', 'Itens carregados', 'Objetos cargados')}${player >= 0 ? ` • ${tr('player', 'jogador', 'jugador')} ${player + 1}` : ''}${slot >= 0 ? ` • ${tr('position', 'posição', 'posición')} ${slot + 1}` : ''}`;
  }
  if (path.startsWith('save.gameRoomTools'))
    return tr(
      'Tools on the bench/shelf',
      'Ferramentas na bancada/prateleira',
      'Herramientas en la mesa/estante',
    );
  if (path.startsWith('save.gameRoomSkinIndex'))
    return tr('Game room appearance', 'Estética do salão', 'Aspecto de la sala');
  if (path.startsWith('save.playerColors')) {
    const index = Number(/^save\.playerColors\[(\d+)\]/.exec(path)?.[1] ?? -1);
    const hero = index >= 0 ? values?.save?.playerColors?.[index]?.playerCharacter : undefined;
    const identity =
      hero !== undefined && hero >= 0
        ? HEROES[hero]?.label
        : index >= 0
          ? `${tr('entry', 'entrada', 'entrada')} ${index + 1}`
          : null;
    return `${tr('Hero outfit color', 'Cor da roupa do herói', 'Color del atuendo del héroe')}${identity ? ` • ${identity}` : ''}`;
  }
  if (path.startsWith('save.furnitures')) {
    const index = Number(/^save\.furnitures\.furnitures\[(\d+)\]/.exec(path)?.[1] ?? -1);
    const id = index >= 0 ? values?.save?.furnitures?.furnitures?.[index] : undefined;
    const item = FURNITURES.find((entry) => entry.id === id);
    return `${tr('Library furniture', 'Mobílias da biblioteca', 'Muebles de la biblioteca')}${item ? ` • ${localizedName(item.label, locale)}` : index >= 0 ? ` • ${tr('entry', 'entrada', 'entrada')} ${index + 1}` : ''}`;
  }
  if (path.startsWith('save.unlockedKeyDoors')) {
    const index = Number(/^save\.unlockedKeyDoors\[(\d+)\]/.exec(path)?.[1] ?? -1);
    const id = index >= 0 ? values?.save?.unlockedKeyDoors?.[index] : undefined;
    const door = KEY_DOORS.find((entry) => entry.id === id);
    return `${tr('Locked passages', 'Passagens com chave', 'Pasajes con llave')}${door ? ` • ${localizedName(door.label, locale)}` : index >= 0 ? ` • ${tr('entry', 'entrada', 'entrada')} ${index + 1}` : ''}`;
  }
  if (path.startsWith('save.upgrades')) {
    const match = /^save\.upgrades\.([a-z]+Upgrades)(?:\[(\d+)\])?/.exec(path);
    const heroIndex = UPGRADE_KEYS.findIndex((key) => key === match?.[1]);
    const hero = heroIndex >= 0 ? HEROES[heroIndex]?.label : null;
    const upgradeIndex = match?.[2] === undefined ? -1 : Number(match[2]);
    const uid =
      heroIndex >= 0 && upgradeIndex >= 0
        ? values?.save?.upgrades?.[UPGRADE_KEYS[heroIndex]!]?.[upgradeIndex]?.x
        : undefined;
    const upgrade = UPGRADES.find((entry) => entry.uid === uid);
    const detail = upgrade
      ? localizedName(upgrade.label, locale)
      : upgradeIndex >= 0
        ? `${tr('entry', 'entrada', 'entrada')} ${upgradeIndex + 1}`
        : null;
    return `${tr('Hero upgrades', 'Upgrades dos heróis', 'Mejoras de héroes')}${hero ? ` • ${hero}` : ''}${detail ? ` • ${detail}` : ''}`;
  }
  if (path.startsWith('save.bank'))
    return tr('Library vault balance', 'Saldo do cofre', 'Saldo de la bóveda');
  if (path.startsWith('save.version')) return tr('Save version', 'Versão do save', 'Versión de la partida');
  if (path.startsWith('collection.monsterFigurines'))
    return tr('Collected figurines', 'Figuras colecionadas', 'Figuras coleccionadas');
  if (
    path.startsWith('collection.completedBoardKeys') ||
    path.startsWith('collection.bestBoardDifficulties')
  ) {
    const completed = path.startsWith('collection.completedBoardKeys');
    const index = Number(/\[(\d+)\]/.exec(path)?.[1] ?? -1);
    const boardKey =
      index < 0
        ? undefined
        : completed
          ? values?.collection?.completedBoardKeys?.[index]
          : values?.collection?.bestBoardDifficulties?.[index]?.boardKey;
    const [biome, monster] = boardKey?.split(':').map(Number) ?? [];
    const board =
      biome !== undefined && monster !== undefined
        ? `${enumNameOf(BIOMES, biome, locale)} • ${enumNameOf(BOARD_MONSTERS, monster, locale)}`
        : index >= 0
          ? `${tr('entry', 'entrada', 'entrada')} ${index + 1}`
          : null;
    const label = completed
      ? tr('Completed boards', 'Tabuleiros concluídos', 'Tableros completados')
      : tr('Board difficulty', 'Dificuldade do tabuleiro', 'Dificultad del tablero');
    return `${label}${board ? ` • ${board}` : ''}`;
  }
  if (path.startsWith('collection.bestEndlessRank'))
    return tr('Best Endless rank', 'Melhor ranque Endless', 'Mejor rango infinito');
  if (path.startsWith('collection.completedHouseRuleIds'))
    return tr('House rules', 'Regras da casa', 'Reglas de la casa');
  if (path.startsWith('save.playTimeSeconds')) return tr('Play time', 'Tempo de jogo', 'Tiempo de juego');
  if (path.startsWith('save.shop')) return tr('Shop progress', 'Progresso da loja', 'Progreso de la tienda');
  return tr('Other save data', 'Outros dados do save', 'Otros datos de la partida');
}

const staticMessages: Record<string, [string, string]> = {
  'Inventário ausente': ['Inventory missing', 'Falta el inventario'],
  'Item não reconhecido pelo catálogo do jogo; valor preservado': [
    'Item not recognized in the game catalog; value preserved',
    'Objeto no reconocido en el catálogo del juego; valor conservado',
  ],
  'Carga inválida (não é um número finito)': [
    'Invalid charge (not a finite number)',
    'Carga inválida (no es un número finito)',
  ],
  'SteamID64 inválido': ['Invalid SteamID64', 'SteamID64 inválido'],
  'O mesmo SteamID64 aparece em mais de um herói': [
    'The same SteamID64 is assigned to more than one hero',
    'El mismo SteamID64 está asignado a más de un héroe',
  ],
  'Mobílias repetidas': ['Duplicate furniture', 'Muebles duplicados'],
  'Portas repetidas': ['Duplicate doors', 'Puertas duplicadas'],
};

export function diagnosticMessage(message: string, locale: Locale): string {
  if (locale === 'pt-BR') return message;
  const es = locale === 'es-419';
  const staticPair = staticMessages[message];
  if (staticPair) return staticPair[es ? 1 : 0];
  const pick = (en: string, spanish: string) => (es ? spanish : en);
  let m: RegExpExecArray | null;
  if ((m = /^Estrutura do save inesperada: (.+)$/.exec(message)))
    return pick(`Unexpected save structure: ${m[1]}`, `Estructura inesperada de la partida: ${m[1]}`);
  if ((m = /^Versão de save (.+) \(este editor conhece a (\d+)\)\. Edite com cuidado\.$/.exec(message)))
    return pick(
      `Save version ${m[1]} (this editor knows version ${m[2]}). Edit carefully.`,
      `Versión de partida ${m[1]} (este editor conoce la versión ${m[2]}). Edita con cuidado.`,
    );
  if ((m = /^Deve ter exatamente (\d+) posições \(tem (\d+)\)$/.exec(message)))
    return pick(
      `Expected exactly ${m[1]} slots (found ${m[2]})`,
      `Se esperaban exactamente ${m[1]} espacios (hay ${m[2]})`,
    );
  if ((m = /^playerCount (\d+) fora de 1\.\.(\d+)$/.exec(message)))
    return pick(
      `Player count ${m[1]} is outside 1..${m[2]}`,
      `Número de jugadores ${m[1]} fuera de 1..${m[2]}`,
    );
  if ((m = /^(\d+) heróis com dono, mas playerCount é (\d+)$/.exec(message)))
    return pick(
      `${m[1]} heroes have owners, but player count is ${m[2]}`,
      `${m[1]} héroes tienen dueño, pero hay ${m[2]} jugadores`,
    );
  if ((m = /^(\d+) inventários para playerCount (\d+) \(devem ser iguais\)$/.exec(message)))
    return pick(
      `${m[1]} inventories for ${m[2]} players (counts must match)`,
      `${m[1]} inventarios para ${m[2]} jugadores (deben coincidir)`,
    );
  if ((m = /^(\d+) itens excedem a capacidade comprovada de (\d+) slots$/.exec(message)))
    return pick(
      `${m[1]} items exceed the verified capacity of ${m[2]} slots`,
      `${m[1]} objetos superan la capacidad verificada de ${m[2]} espacios`,
    );
  if ((m = /^itemStringIds \((\d+)\) e itemBatteryLevels \((\d+)\) devem ter o mesmo tamanho$/.exec(message)))
    return pick(
      `Item and charge lists must have the same length (${m[1]} and ${m[2]})`,
      `Las listas de objetos y cargas deben tener el mismo tamaño (${m[1]} y ${m[2]})`,
    );
  if ((m = /^Carga (.+) fora de 0\.\.1 para um item com bateria$/.exec(message)))
    return pick(
      `Charge ${m[1]} is outside 0..1 for an item with a battery`,
      `Carga ${m[1]} fuera de 0..1 para un objeto con batería`,
    );
  if ((m = /^Item sem bateria deve ter carga -1 \(tem (.+)\)$/.exec(message)))
    return pick(
      `An item without a battery must have charge -1 (found ${m[1]})`,
      `Un objeto sin batería debe tener carga -1 (tiene ${m[1]})`,
    );
  if ((m = /^Skin (.+) fora de 0\.\.(\d+)$/.exec(message)))
    return pick(`Appearance ${m[1]} is outside 0..${m[2]}`, `Aspecto ${m[1]} fuera de 0..${m[2]}`);
  if ((m = /^Cor (.+) inválida \(0\.\.(\d+)\)$/.exec(message)))
    return pick(`Color ${m[1]} is invalid (0..${m[2]})`, `Color ${m[1]} inválido (0..${m[2]})`);
  if ((m = /^Herói (.+) inválido$/.exec(message)))
    return pick(`Invalid hero ${m[1]}`, `Héroe ${m[1]} inválido`);
  if ((m = /^Mobília (.+) inválida \(use 1\.\.(\d+)\)$/.exec(message)))
    return pick(`Invalid furniture ${m[1]} (use 1..${m[2]})`, `Mueble ${m[1]} inválido (usa 1..${m[2]})`);
  if ((m = /^Chave (.+) desconhecida \(válidas: (.+)\)$/.exec(message)))
    return pick(`Unknown key ${m[1]} (valid: ${m[2]})`, `Llave ${m[1]} desconocida (válidas: ${m[2]})`);
  if ((m = /^UID de upgrade (.+) desconhecido$/.exec(message)))
    return pick(`Unknown upgrade ID ${m[1]}`, `Identificador de mejora ${m[1]} desconocido`);
  if ((m = /^(.+): nível (.+) fora de 1\.\.(\d+)$/.exec(message)))
    return pick(
      `${localizedName(m[1]!, 'en-US')}: level ${m[2]} is outside 1..${m[3]}`,
      `${localizedName(m[1]!, 'es-419')}: nivel ${m[2]} fuera de 1..${m[3]}`,
    );
  if ((m = /^Upgrade (.+) repetido para o mesmo herói$/.exec(message)))
    return pick(`Upgrade ${m[1]} repeated for the same hero`, `Mejora ${m[1]} repetida para el mismo héroe`);
  if ((m = /^Bits fora da máscara válida (.+)$/.exec(message)))
    return pick(`Bits outside valid mask ${m[1]}`, `Bits fuera de la máscara válida ${m[1]}`);
  if ((m = /^Formato inválido (.+) \(esperado "bioma:monstro"\)$/.exec(message)))
    return pick(
      `Invalid board format ${m[1]} (expected biome:monster)`,
      `Formato de tablero inválido ${m[1]} (se espera bioma:monstruo)`,
    );
  if ((m = /^Dificuldade (.+) fora de 0\.\.4$/.exec(message)))
    return pick(`Difficulty ${m[1]} is outside 0..4`, `Dificultad ${m[1]} fuera de 0..4`);
  if ((m = /^Saldo deve ser inteiro entre 0 e (\d+)$/.exec(message)))
    return pick(
      `Balance must be a whole number between 0 and ${m[1]}`,
      `El saldo debe ser un entero entre 0 y ${m[1]}`,
    );
  return `${pick('Save validation issue', 'Problema de validación de la partida')}: ${message}`;
}

const fileMessages: Record<string, [string, string]> = {
  'O arquivo não é um ZIP válido (.sav)': [
    'The file is not a valid .sav archive',
    'El archivo no es una partida .sav válida',
  ],
  'ZIP sem diretório central (arquivo truncado?)': ['Incomplete .sav archive', 'Archivo .sav incompleto'],
  'Diretório central do ZIP corrompido': ['Corrupted .sav archive', 'Archivo .sav dañado'],
  'Arquivo grande demais para ser um save': [
    'File is too large to be a save',
    'El archivo es demasiado grande para ser una partida',
  ],
};

export function fileErrorMessage(message: string, locale: Locale): string {
  if (locale === 'pt-BR') return message;
  const pair = fileMessages[message];
  if (pair) return pair[locale === 'es-419' ? 1 : 0];
  const tr = (en: string, es: string) => (locale === 'es-419' ? es : en);
  let match: RegExpExecArray | null;
  if ((match = /^"(.+)" é grande demais para ser um save do Invokyr$/.exec(message)))
    return tr(
      `"${match[1]}" is too large to be an Invokyr save`,
      `"${match[1]}" es demasiado grande para ser una partida de Invokyr`,
    );
  if ((match = /^Entrada "(.+)" grande demais$/.exec(message)))
    return tr(
      `Archive entry "${match[1]}" is too large`,
      `La entrada "${match[1]}" del archivo es demasiado grande`,
    );
  if ((match = /^Contêiner inválido: stream "(.+)" não encontrado$/.exec(message)))
    return tr(
      `Invalid archive: missing stream "${match[1]}"`,
      `Archivo inválido: falta el stream "${match[1]}"`,
    );
  if ((match = /^Entrada "(.+)" com CRC inválido \(arquivo corrompido\)$/.exec(message)))
    return tr(
      `Archive entry "${match[1]}" has invalid CRC`,
      `La entrada "${match[1]}" tiene un CRC inválido`,
    );
  if ((match = /^Entrada "(.+)" com tamanho inconsistente$/.exec(message)))
    return tr(
      `Archive entry "${match[1]}" has an inconsistent size`,
      `La entrada "${match[1]}" tiene un tamaño inconsistente`,
    );
  if ((match = /^Método de compressão (.+) não suportado$/.exec(message)))
    return tr(`Unsupported compression method ${match[1]}`, `Método de compresión ${match[1]} no compatible`);
  if ((match = /^ZIP com nome de entrada duplicado: "(.+)"$/.exec(message)))
    return tr(`Duplicate archive entry "${match[1]}"`, `Entrada duplicada "${match[1]}" en el archivo`);
  return `${tr('File error', 'Error de archivo')}: ${message}`;
}
