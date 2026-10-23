export type OsKind = 'windows' | 'linux' | 'steamdeck' | 'macos' | 'unknown';

export interface SaveLocation {
  os: OsKind;
  /** Rótulo humano do sistema detectado. */
  label: string;
  /** Caminho sugerido da pasta `saves` (pode conter ~ ou %VARS%). */
  path: string | null;
  /** Caminhos alternativos (Flatpak, biblioteca em outro disco...). */
  alternatives: string[];
  /** Observação exibida na tela de boas-vindas. */
  note: string;
}

export const APP_ID = '3883570';
const TAIL = `AppData/LocalLow/Ludogram/Invokyr/saves/`;
const PREFIX = `compatdata/${APP_ID}/pfx/drive_c/users/steamuser/${TAIL}`;

export interface NavigatorLike {
  userAgent?: string;
  platform?: string;
  userAgentData?: { platform?: string };
}

export function detectOs(nav: NavigatorLike): OsKind {
  const ua = nav.userAgent ?? '';
  const platform = (nav.userAgentData?.platform ?? nav.platform ?? '').toLowerCase();
  // SteamOS/Steam Deck: o Chromium do modo desktop identifica Linux; o UA costuma citar "SteamOS" ou "Deck".
  if (/steamos|steam deck|\bdeck\b/i.test(ua)) return 'steamdeck';
  if (platform.includes('win') || /windows/i.test(ua)) return 'windows';
  if (platform.includes('mac') || /macintosh|mac os x/i.test(ua)) return 'macos';
  if (platform.includes('linux') || /linux|x11/i.test(ua)) return 'linux';
  return 'unknown';
}

export function saveLocationFor(os: OsKind): SaveLocation {
  switch (os) {
    case 'windows':
      return {
        os,
        label: 'Windows',
        path: `%USERPROFILE%\\AppData\\LocalLow\\Ludogram\\Invokyr\\saves\\`,
        alternatives: [],
        note: 'Cole o caminho na barra de endereço do seletor de arquivos. A pasta AppData é oculta.',
      };
    case 'linux':
    case 'steamdeck':
      return {
        os,
        label: os === 'steamdeck' ? 'Steam Deck (SteamOS)' : 'Linux (Steam/Proton)',
        path: `~/.local/share/Steam/steamapps/${PREFIX}`,
        alternatives: [
          `~/.steam/steam/steamapps/${PREFIX}`,
          `~/.var/app/com.valvesoftware.Steam/.local/share/Steam/steamapps/${PREFIX} (Steam via Flatpak)`,
          `<sua biblioteca Steam>/steamapps/${PREFIX} (jogo instalado em outro disco)`,
        ],
        note: 'No seletor de arquivos, use Ctrl+L para digitar o caminho e Ctrl+H para mostrar arquivos ocultos.',
      };
    case 'macos':
      return {
        os,
        label: 'macOS',
        path: null,
        alternatives: [],
        note: 'O Invokyr não tem versão nativa para macOS. Se você joga via camada de compatibilidade, procure a pasta Ludogram/Invokyr/saves dentro do prefixo dela.',
      };
    default:
      return {
        os: 'unknown',
        label: 'Sistema não identificado',
        path: null,
        alternatives: [],
        note: 'Não foi possível identificar o sistema. Procure a pasta Ludogram/Invokyr/saves dentro de AppData/LocalLow.',
      };
  }
}
