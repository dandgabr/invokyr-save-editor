import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { decode } from '../src/codec/msgpack';
import { readContainer } from '../src/codec/zip';

const fixture = new URL('../tests/fixtures/template.sav', import.meta.url).pathname;

test('English is the fallback and the verified game build is visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Where to find your save/i })).toBeVisible();
  await expect(page.getByText(/Steam build 26154962/)).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
});

test('language choice persists, translates screens and leaves the save open', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Language').selectOption('pt-BR');
  await expect(page.getByRole('heading', { name: /Onde fica o seu save/ })).toBeVisible();
  await page.getByTestId('file-input').setInputFiles(fixture);
  await page.getByLabel('Idioma').selectOption('es-419');
  await expect(page.getByRole('tab', { name: /Sesión y héroes/ })).toBeVisible();
  await expect(page.getByTestId('file-chip')).toContainText('template.sav');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es-419');
  await page.reload();
  await expect(page.getByLabel('Idioma')).toHaveValue('es-419');
});

test('all major screens, catalog and review use Spanish without exposing save fields', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Language').selectOption('es-419');
  await page.getByTestId('file-input').setInputFiles(fixture);

  await page.getByRole('tab', { name: /Estado y mejoras/ }).click();
  await expect(page.getByRole('heading', { name: /Mejoras del héroe/ })).toBeVisible();
  await page.getByRole('tab', { name: /Inventarios y objetos/ }).click();
  await expect(page.getByRole('heading', { name: /Objetos cargados/ })).toBeVisible();
  await page.getByRole('button', { name: '+ Agregar herramienta' }).click();
  const catalog = page.getByRole('dialog');
  await catalog.getByRole('searchbox', { name: 'Buscar reliquia' }).fill('cámara');
  await expect(catalog.getByRole('heading', { name: 'Cámara', exact: true })).toBeVisible();
  await catalog.getByRole('button', { name: /^Solicitar Cámara —/ }).click();
  await expect(catalog).toBeVisible();
  await catalog.getByRole('button', { name: /Volver al inventario/ }).click();

  await page.getByRole('tab', { name: /Sala y muebles/ }).click();
  await expect(page.getByRole('heading', { name: 'Pasajes con llave' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Aspecto de la sala de juegos' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Desbloquear las 2 puertas' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Puerta de Henry/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Puerta del pasillo/ })).toBeVisible();
  await page.getByRole('tab', { name: /Trofeos y colección/ }).click();
  await expect(page.getByRole('heading', { name: 'Tableros completados' })).toBeVisible();
  await page.getByRole('tab', { name: /Ajustes rápidos/ }).click();
  await expect(page.getByRole('heading', { name: 'Acciones instantáneas' })).toBeVisible();

  await page.getByRole('button', { name: 'Guardar (.sav)' }).click();
  const review = page.getByRole('dialog');
  await expect(review).toContainText('Herramientas en la mesa/estante');
  await expect(review).not.toContainText('gameRoomTools');
  await expect(review).not.toContainText('unlockedKeyDoors');
});

test('language switching preserves an unsaved edit and fits a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(fixture);
  await page.getByRole('tab', { name: /Hub & Furniture/ }).click();
  await page.getByRole('button', { name: /2: Red/ }).click();
  await page.getByLabel('Language').selectOption('pt-BR');
  await expect(page.getByRole('button', { name: /2: Vermelho/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Idioma').selectOption('es-419');
  await page.getByRole('button', { name: 'Guardar (.sav)' }).click();
  await expect(page.getByRole('dialog')).toContainText('Aspecto de la sala');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

test('validation messages follow the selected language', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(fixture);
  await page.getByRole('tab', { name: /Trainer Presets/ }).click();
  await page.getByRole('textbox', { name: 'Balance' }).fill('-1');
  await page.getByRole('textbox', { name: 'Balance' }).blur();
  await expect(page.getByRole('alert')).toContainText('cannot be below zero');
  await page.getByLabel('Language').selectOption('es-419');
  await expect(page.getByRole('alert')).toContainText('no puede ser menor que cero');
  await page.getByRole('tab', { name: /Sesión y héroes/ }).click();
  const specs = page.getByRole('article', { name: 'Specs' });
  await specs.getByPlaceholder('Libre (SteamID64)').fill('abc');
  await specs.getByPlaceholder('Libre (SteamID64)').blur();
  await expect(specs.getByRole('alert')).toContainText('17 dígitos');
  await page.getByLabel('Idioma').selectOption('pt-BR');
  await expect(specs.getByRole('alert')).toContainText('Informe um SteamID64');
});

test('changing language does not change the saved streams', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(fixture);
  await page.getByLabel('Language').selectOption('es-419');
  await page.getByLabel('Idioma').selectOption('pt-BR');
  await page.getByRole('button', { name: 'Salvar (.sav)' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Baixar save editado' }).click(),
  ]);
  const source = readContainer(new Uint8Array(readFileSync(fixture)));
  const result = readContainer(new Uint8Array(readFileSync((await download.path()) as string)));
  for (const stream of ['meta', 'save', 'collection'] as const) {
    expect(result.streams[stream]).toEqual(source.streams[stream]);
  }
  await expect(page.locator('.banner-ok')).toContainText('Save editado baixado');
  await page.getByLabel('Idioma').selectOption('es-419');
  await expect(page.locator('.banner-ok')).toContainText('Se descargó la partida editada');
});

test('save review identifies which hero each outfit change belongs to', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(fixture);
  await page
    .getByRole('article', { name: 'Red' })
    .getByRole('combobox', { name: /Outfit/ })
    .selectOption('5');
  await page
    .getByRole('article', { name: 'Specs' })
    .getByRole('combobox', { name: /Outfit/ })
    .selectOption('6');
  await page.getByRole('button', { name: 'Save (.sav)' }).click();
  const review = page.getByRole('dialog');
  await expect(review).toContainText('Hero outfit color • Red');
  await expect(review).toContainText('Hero outfit color • Specs');
  await expect(review).not.toContainText('playerColors');
});

test('edited save keeps its intended change after language switching', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(fixture);
  await page.getByRole('tab', { name: /Hub & Furniture/ }).click();
  await page.getByRole('button', { name: /2: Red/ }).click();
  await page.getByLabel('Language').selectOption('es-419');
  await page.getByLabel('Idioma').selectOption('pt-BR');
  await page.getByRole('button', { name: 'Salvar (.sav)' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Baixar save editado' }).click(),
  ]);
  const source = readContainer(new Uint8Array(readFileSync(fixture)));
  const result = readContainer(new Uint8Array(readFileSync((await download.path()) as string)));
  expect(result.streams.meta).toEqual(source.streams.meta);
  expect(result.streams.collection).toEqual(source.streams.collection);
  const original = decode(source.streams.save).value as Record<string, unknown>;
  const edited = decode(result.streams.save).value as Record<string, unknown>;
  expect(edited).toEqual({ ...original, gameRoomSkinIndex: 2 });
});

test('an open-file error banner changes language with the selector', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles({
    name: 'broken.sav',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('broken'),
  });
  await expect(page.getByRole('alert')).toContainText('Could not open');
  await page.getByLabel('Language').selectOption('es-419');
  await expect(page.getByRole('alert')).toContainText('No se pudo abrir');
  await expect(page.getByRole('alert')).not.toContainText('Could not open');
});

test('review names the door removed from a shifted save array', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(fixture);
  await page.getByRole('tab', { name: /Hub & Furniture/ }).click();
  await page.getByRole('button', { name: /Unlock all 2 doors/ }).click();
  await page.getByRole('button', { name: /Corridor door/ }).click();
  await page.getByRole('button', { name: 'Save (.sav)' }).click();
  const review = page.getByRole('dialog');
  await expect(review).toContainText('Locked passages • Corridor door');
  await expect(review).toContainText("Locked passages • Henry's door");
  await expect(review).not.toContainText('unlockedKeyDoors');
});
