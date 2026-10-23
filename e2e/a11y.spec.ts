import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const fixture = new URL('../tests/fixtures/template.sav', import.meta.url).pathname;

const audit = async (page: import('@playwright/test').Page, where: string) => {
  const r = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const bad = r.violations.map(
    (v) => `${v.id} (${v.impact}): ${v.nodes.length}x ${v.nodes[0]?.target.join(' ')}`,
  );
  expect(bad, `violações de acessibilidade em ${where}`).toEqual([]);
};

test('boas-vindas não tem violações WCAG A/AA', async ({ page }) => {
  await page.goto('/');
  await audit(page, 'boas-vindas');
});

test('todas as telas, o catálogo e o diálogo de salvar não têm violações WCAG A/AA', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(fixture);
  for (const t of [/Sessão/, /Status/, /Inventários/, /Hub/, /Troféus/, /Trainer/]) {
    await page.getByRole('tab', { name: t }).click();
    await audit(page, String(t));
  }
  await page.getByRole('tab', { name: /Inventários/ }).click();
  await page.getByRole('button', { name: '+ Adicionar ferramenta' }).click();
  await audit(page, 'catálogo');
  await page.getByRole('button', { name: /Voltar ao inventário/ }).click();
  await page.getByRole('button', { name: 'Salvar (.sav)' }).click();
  await audit(page, 'diálogo de salvar');
});
