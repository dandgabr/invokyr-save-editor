import type { Locale } from './i18n';
import type { EnumEntry } from './schema/enums';

const names: Record<string, [string, string]> = {
  Roxo: ['Purple', 'Morado'],
  'Azul-escuro': ['Dark blue', 'Azul oscuro'],
  Azul: ['Blue', 'Azul'],
  Verde: ['Green', 'Verde'],
  Amarelo: ['Yellow', 'Amarillo'],
  Vermelho: ['Red', 'Rojo'],
  Rosa: ['Pink', 'Rosa'],
  Branco: ['White', 'Blanco'],
  Dourado: ['Gold', 'Dorado'],
  Rádio: ['Radio', 'Radio'],
  'Guarda-roupa': ['Wardrobe', 'Armario'],
  Espelho: ['Mirror', 'Espejo'],
  'Globo de discoteca': ['Disco ball', 'Bola de discoteca'],
  Campainha: ['Doorbell', 'Timbre'],
  'Caixa de dados de fogos': ['Fireworks dice box', 'Caja de dados de fuegos artificiales'],
  'Caixa de dados cúbica': ['Cube dice box', 'Caja de dados cúbica'],
  'Relógio antigo': ['Old clock', 'Reloj antiguo'],
  'Porta do Henry': ["Henry's door", 'Puerta de Henry'],
  'Porta do Corredor': ['Corridor door', 'Puerta del pasillo'],
  Padrão: ['Default', 'Predeterminado'],
  Gelo: ['Ice', 'Hielo'],
  Selva: ['Jungle', 'Selva'],
  Deserto: ['Desert', 'Desierto'],
  Abismo: ['Abyss', 'Abismo'],
  Cinzas: ['Ash', 'Cenizas'],
  Infinito: ['Endless', 'Infinito'],
  Nenhum: ['None', 'Ninguno'],
  Caçador: ['Hunter', 'Cazador'],
  Cavaleiro: ['Horseman', 'Jinete'],
  Crocodilo: ['Crocodile', 'Cocodrilo'],
  Iéti: ['Yeti', 'Yeti'],
  Planta: ['Plant', 'Planta'],
  'Edição Definitiva': ['Ultimate', 'Definitivo'],
  Manequim: ['Mannequin', 'Maniquí'],
  'Pessoa Amaldiçoada': ['Cursed player', 'Jugador maldito'],
  Pinguim: ['Penguin', 'Pingüino'],
  'Boneco de Neve': ['Snowman', 'Muñeco de nieve'],
  Abonado: ['Money Man', 'Hombre rico'],
  Alpinista: ['Climber', 'Alpinista'],
  'Fantasma da TV': ['TV ghost', 'Fantasma del televisor'],
  Faraó: ['Pharaoh', 'Faraón'],
  Minhoca: ['Sand worm', 'Gusano de arena'],
  '1 estrela': ['1 star', '1 estrella'],
  '2 estrelas': ['2 stars', '2 estrellas'],
  '3 estrelas': ['3 stars', '3 estrellas'],
  '4 estrelas': ['4 stars', '4 estrellas'],
  '5 estrelas': ['5 stars', '5 estrellas'],
  Abelhas: ['Bees', 'Abejas'],
  'Monstro-porta': ['Door monster', 'Monstruo puerta'],
  Mímico: ['Mimic', 'Mímico'],
  Aranha: ['Spider', 'Araña'],
  Saúde: ['Health', 'Salud'],
  Estamina: ['Stamina', 'Resistencia'],
  Agilidade: ['Speed', 'Velocidad'],
  'Pulo duplo': ['Double jump', 'Salto doble'],
  Pochete: ['Fanny pack', 'Riñonera'],
  Clássico: ['Classic', 'Clásico'],
  'Azul néon': ['Neon blue', 'Azul neón'],
  Vegetação: ['Vegetation', 'Vegetación'],
  Dourada: ['Golden', 'Dorada'],
  'Pedra ocre': ['Ochre stone', 'Piedra ocre'],
  'Elixir de vitalidade máxima': ['Maximum vitality elixir', 'Elixir de vitalidad máxima'],
  'Aumenta a vida máxima do herói (bônus acumulado de +20 PV por nível).': [
    'Increases the hero’s maximum health (cumulative +20 HP per level).',
    'Aumenta la salud máxima del héroe (+20 PV acumulados por nivel).',
  ],
  'Vigor acadêmico & fôlego': ['Stamina and endurance', 'Resistencia y aguante'],
  'Aumenta a estamina máxima do herói.': [
    'Increases the hero’s maximum stamina.',
    'Aumenta la resistencia máxima del héroe.',
  ],
  'Botas de expedição & agilidade': ['Expedition boots and speed', 'Botas de expedición y velocidad'],
  'Aumenta a velocidade de corrida e sprint.': [
    'Increases running and sprint speed.',
    'Aumenta la velocidad de carrera y esprint.',
  ],
  'Cada nível concede um espaço extra para itens carregados.': [
    'Each level adds one slot for carried items.',
    'Cada nivel agrega un espacio para objetos cargados.',
  ],
  'Encantamento de salto arcano': ['Arcane jump enchantment', 'Encantamiento de salto arcano'],
  'Segundo salto no ar (habilidade única).': [
    'A second jump in the air (one-time upgrade).',
    'Un segundo salto en el aire (mejora única).',
  ],
};

export function localizedName(label: string, locale: Locale): string {
  if (locale === 'pt-BR') return label;
  const pair = names[label];
  return pair ? pair[locale === 'es-419' ? 1 : 0] : label;
}

export const enumName = (entry: EnumEntry, locale: Locale): string => localizedName(entry.label, locale);
export function enumNameOf(entries: readonly EnumEntry[], id: number, locale: Locale): string {
  const entry = entries.find((candidate) => candidate.id === id);
  return entry ? enumName(entry, locale) : `#${id}`;
}
