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

test('sem File System Access, abrir arquivo funciona só com o teclado', async ({ page }) => {
  await page.addInitScript(() => {
    delete (window as any).showOpenFilePicker;
    delete (window as any).showDirectoryPicker;
  });
  await page.goto('/');
  const openBtn = page.getByRole('button', { name: 'Abrir arquivo .sav' });
  await expect(openBtn).toBeVisible();
  await openBtn.focus();
  await expect(openBtn).toBeFocused();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.keyboard.press('Enter')]);
  await chooser.setFiles(fixture);
  await expect(page.getByTestId('file-chip')).toContainText('template.sav');
});

test('abas seguem o padrão APG: setas, Home/End e roving tabindex', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(fixture);
  const tabs = page.getByRole('tab');
  await expect(tabs).toHaveCount(6);
  await expect(tabs.nth(0)).toHaveAttribute('tabindex', '0');
  await expect(tabs.nth(1)).toHaveAttribute('tabindex', '-1');
  await tabs.nth(0).focus();
  await page.keyboard.press('ArrowRight');
  await expect(tabs.nth(1)).toBeFocused();
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(tabs.nth(5)).toBeFocused();
  await page.keyboard.press('ArrowRight'); // dá a volta
  await expect(tabs.nth(0)).toBeFocused();
});

test('diálogo de salvar devolve o foco ao botão que o abriu e há um <h1> e <main>', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(fixture);
  await expect(page.getByRole('heading', { level: 1, name: 'Invokyr Archive Studio' })).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
  const save = page.getByRole('button', { name: 'Salvar (.sav)' });
  await save.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(save).toBeFocused();
});

test('soltar arquivo fora da zona de drop não navega para ele', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(fixture);
  const prevented = await page.evaluate(() => {
    const ev = new DragEvent('drop', { bubbles: true, cancelable: true });
    document.body.dispatchEvent(ev);
    return ev.defaultPrevented;
  });
  expect(prevented).toBe(true);
});
