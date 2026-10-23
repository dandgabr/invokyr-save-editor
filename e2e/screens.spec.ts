import { expect, test } from '@playwright/test';

const fixture = new URL('../tests/fixtures/template.sav', import.meta.url).pathname;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(fixture);
  await expect(page.getByTestId('file-chip')).toBeVisible();
});

const review = async (page: import('@playwright/test').Page) => {
  await page.getByRole('button', { name: 'Salvar (.sav)' }).click();
  return page.getByRole('dialog');
};

test('Sessão: atribuir herói vago, ver o diff e desfazer', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /1 herói em campo/ })).toBeVisible();
  const ziggy = page.getByRole('article', { name: 'Ziggy' });
  await ziggy.getByPlaceholder('Vago (SteamID64)').fill('76561198000000002');
  await ziggy.getByPlaceholder('Vago (SteamID64)').blur();
  await expect(page.getByRole('heading', { name: /2 heróis em campo/ })).toBeVisible();
  const dlg = await review(page);
  await expect(dlg).toContainText('meta.playerCount');
  await expect(dlg).toContainText('save.playerInventories');
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await expect(page.getByRole('heading', { name: /1 herói em campo/ })).toBeVisible();
});

test('Sessão: SteamID inválido mostra erro e não altera', async ({ page }) => {
  const specs = page.getByRole('article', { name: 'Specs' });
  await specs.getByPlaceholder('Vago (SteamID64)').fill('abc');
  await specs.getByPlaceholder('Vago (SteamID64)').blur();
  await expect(specs.getByRole('alert')).toContainText('SteamID64');
  await expect(page.getByRole('button', { name: 'Desfazer' })).toBeDisabled();
});

test('Status: maximizar herói preenche os níveis e aparece no diff', async ({ page }) => {
  await page.getByRole('tab', { name: /Status & Upgrades/ }).click();
  await page.getByRole('button', { name: /Maximizar apenas Red/ }).click();
  await expect(page.getByText('Nível 8 de 8 (+160 PV)')).toBeVisible();
  await expect(page.getByText('Nível 7 de 7')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Habilitado & ativo' })).toBeVisible();
  const dlg = await review(page);
  await expect(dlg).toContainText('save.upgrades.redUpgrades');
});

test('Inventário: adiciona item pelo catálogo com bateria e ajusta a carga', async ({ page }) => {
  await page.getByRole('tab', { name: /Inventários/ }).click();
  await page.getByRole('button', { name: '+ Adicionar item' }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg).toContainText('Índice geral de relíquias');
  await dlg.getByLabel('Buscar relíquia').fill('lança');
  await dlg.getByRole('button', { name: '+ Requisitar' }).first().click();
  await dlg.getByRole('button', { name: /Voltar ao inventário/ }).click();
  await expect(page.getByText('Lança-chamas').first()).toBeVisible();
  const slider = page.getByRole('slider', { name: /Carga de/ });
  await expect(slider).toHaveValue('100');
  await slider.fill('85');
  await expect(page.getByText('Carga da bateria: 85%')).toBeVisible();
});

test('Hub: skin, portas e mobílias', async ({ page }) => {
  await page.getByRole('tab', { name: /Hub & Mobílias/ }).click();
  await page.getByRole('button', { name: /2: Vermelho/ }).click();
  await expect(page.getByRole('button', { name: /2: Vermelho/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /Desbloquear as 8 mobílias/ }).click();
  await expect(page.getByText('✓ Ativo')).toHaveCount(8);
  await page.getByRole('button', { name: /Destrancar as 2 portas/ }).click();
  await expect(page.getByText('Destrancada ✓')).toHaveCount(2);
});

test('Troféus: ativar todas as 17 figuras e desmarcar', async ({ page }) => {
  await page.getByRole('tab', { name: /Troféus/ }).click();
  await page.getByRole('button', { name: /Ativar todas as 17/ }).click();
  await expect(page.getByText('17 de 17 figuras')).toBeVisible();
  await expect(page.getByText('0x1ffff')).toBeVisible();
  await page.getByRole('button', { name: /Desmarcar todas/ }).click();
  await expect(page.getByText('0 de 17 figuras')).toBeVisible();
});

test('Presets: god mode gera alterações e o save revisado é gravado sem erros', async ({ page }) => {
  await page.getByRole('tab', { name: /Trainer Presets/ }).click();
  await page.getByRole('button', { name: 'Decretar modo supremo' }).click();
  await expect(page.locator('strong.gold')).toHaveText('99.999 moedas');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    (async () => {
      await page.getByRole('button', { name: 'Salvar (.sav)' }).click();
      await page.getByRole('button', { name: 'Baixar save editado' }).click();
    })(),
  ]);
  expect(download.suggestedFilename()).toBe('template.sav');
});
