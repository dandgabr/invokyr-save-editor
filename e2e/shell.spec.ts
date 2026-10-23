import { expect, test } from '@playwright/test';

const fixture = new URL('../tests/fixtures/template.sav', import.meta.url).pathname;

test('boas-vindas mostra o caminho do SO e privacidade', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Invokyr Archive Studio' })).toBeVisible();
  await expect(page.getByTestId('save-path')).toContainText('Ludogram');
  await expect(page.getByText('nunca é enviado a nenhum servidor')).toBeVisible();
});

test('abre um save, navega pelas abas e revisa o salvamento', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(fixture);

  await expect(page.getByTestId('file-chip')).toContainText('template.sav (v15)');
  await expect(page.getByRole('tab', { name: /Status & Upgrades/ })).toBeVisible();
  await page.getByRole('tab', { name: /Hub & Mobílias/ }).click();
  await expect(page.getByRole('tab', { name: /Hub & Mobílias/ })).toHaveAttribute('aria-selected', 'true');

  await expect(page.getByRole('button', { name: 'Desfazer' })).toBeDisabled();
  await page.keyboard.press('Control+s');
  await expect(page.getByRole('heading', { name: 'Revisar alterações' })).toBeVisible();
  await expect(page.getByText('Nenhuma alteração')).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('heading', { name: 'Revisar alterações' })).toBeHidden();

  // Nenhuma requisição para fora da origem: o save não sai da máquina.
  const origin = new URL(page.url()).origin;
  expect(
    requests.filter((u) => !u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:')),
  ).toEqual([]);
});

test('arquivo inválido mostra erro e continua na tela inicial', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles({
    name: 'ruim.sav',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('nao sou um zip'),
  });
  await expect(page.getByRole('alert')).toContainText('ruim.sav');
  await expect(page.getByRole('heading', { name: 'Invokyr Archive Studio' })).toBeVisible();
});
