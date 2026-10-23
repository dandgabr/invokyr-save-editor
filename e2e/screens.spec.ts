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
  await expect(page.getByRole('heading', { name: 'Pochete' })).toBeVisible();
  await page.getByRole('button', { name: /Maximizar apenas Red/ }).click();
  await expect(page.getByText('Nível 8 de 8 (+160 PV)')).toBeVisible();
  await expect(page.getByText('Nível 7 de 7')).toBeVisible();
  await expect(page.getByRole('switch', { name: /Salto arcano: habilitado/ })).toBeVisible();
  const dlg = await review(page);
  await expect(dlg).toContainText('save.upgrades.redUpgrades');
});

test('Inventário: adiciona item pelo catálogo com bateria e ajusta a carga', async ({ page }) => {
  await page.getByRole('tab', { name: /Inventários/ }).click();
  await expect(page.getByText('3 de 3 slots ocupados')).toBeVisible();
  await expect(page.getByRole('button', { name: '+ Adicionar item' })).toBeDisabled();
  await page
    .getByRole('button', { name: /^Remover Dado de Teletransporte/ })
    .first()
    .click();
  await page.getByRole('button', { name: '+ Adicionar item' }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg).toContainText('Índice geral de relíquias');
  await dlg.getByLabel('Buscar relíquia').fill('lança');
  await dlg.getByRole('button', { name: /^Requisitar Lança-chamas/ }).click();
  await expect(dlg).not.toBeVisible();
  await expect(page.getByRole('heading', { name: /Itens carregados/ })).toBeFocused();
  await expect(page.getByText('Lança-chamas').first()).toBeVisible();
  const slider = page.getByRole('slider', { name: /Carga da bateria de Lança-chamas/ });
  await expect(slider).toHaveValue('100');
  await slider.fill('85');
  await expect(page.getByText(/Carga da bateria de Lança-chamas, jogador 1, posição 3: 85%/)).toBeVisible();
  const save = await review(page);
  await expect(save).toContainText('Lança-chamas');
  await expect(save).not.toContainText('g_fire');
});

test('Pochete libera até cinco itens e não pode ser reduzida com os slots ocupados', async ({ page }) => {
  await page.getByRole('tab', { name: /Status & Upgrades/ }).click();
  await page.getByRole('button', { name: 'Aumentar Pochete' }).click();
  await page.getByRole('tab', { name: /Inventários/ }).click();
  await expect(page.getByText('3 de 4 slots ocupados')).toBeVisible();
  await page.getByRole('button', { name: '+ Adicionar item' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Requisitar Lança-chamas/ })
    .click();
  await expect(page.getByText('4 de 4 slots ocupados')).toBeVisible();

  await page.getByRole('tab', { name: /Status & Upgrades/ }).click();
  await page.getByRole('button', { name: 'Aumentar Pochete' }).click();
  await page.getByRole('tab', { name: /Inventários/ }).click();
  await page.getByRole('button', { name: '+ Adicionar item' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Requisitar Dado Antigravidade/ })
    .click();
  await expect(page.getByText('5 de 5 slots ocupados')).toBeVisible();
  await expect(page.getByRole('button', { name: '+ Adicionar item' })).toBeDisabled();
  await page.getByRole('tab', { name: /Status & Upgrades/ }).click();
  await expect(page.getByRole('button', { name: 'Diminuir Pochete' })).toBeDisabled();
  await expect(page.getByText('Remova itens carregados antes de reduzir a Pochete.')).toBeVisible();
});

test('Bancada mostra tipo, descrição e carga dos itens carregados', async ({ page }) => {
  await page.getByRole('tab', { name: /Inventários/ }).click();
  const item = page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name: 'Dado Bomba ou Cura' }) });
  await expect(item).toContainText('Dados');
  await expect(item).toContainText('Carga: não se aplica');
  await expect(item).toContainText('Dado associado a bomba ou cura');
  await expect(item).not.toContainText('dice_boomheal');
});

test('Partida com vários jogadores não atribui inventário a herói sem prova', async ({ page }) => {
  await page.getByRole('tab', { name: /Status & Upgrades/ }).click();
  await page.getByRole('button', { name: 'Aumentar Pochete' }).click();
  await page.getByRole('tab', { name: /Inventários/ }).click();
  await page.getByRole('button', { name: '+ Adicionar item' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Requisitar Lança-chamas/ })
    .click();
  await page.getByRole('tab', { name: /Sessão & Heróis/ }).click();
  const ziggy = page.getByRole('article', { name: 'Ziggy' });
  await ziggy.getByPlaceholder('Vago (SteamID64)').fill('76561198000000002');
  await ziggy.getByPlaceholder('Vago (SteamID64)').blur();
  await page.getByRole('tab', { name: /Inventários/ }).click();
  await expect(page.getByRole('heading', { name: /Personagem: não confirmado \(jogador 1\)/ })).toBeVisible();
  await expect(page.getByText(/4 itens carregados\. Novas adições ficam limitadas a 3/)).toBeVisible();
  await expect(page.getByText(/Novas adições ficam limitadas a 3/)).toBeVisible();
  await page.getByRole('tab', { name: /Status & Upgrades/ }).click();
  await expect(page.getByRole('button', { name: 'Diminuir Pochete' })).toBeDisabled();
  await expect(
    page.getByText(/A associação entre personagem e inventário não está confirmada/),
  ).toBeVisible();
});

test('Hub: skin, portas e mobílias', async ({ page }) => {
  await page.getByRole('tab', { name: /Hub & Mobílias/ }).click();
  await page.getByRole('button', { name: /2: Vermelho/ }).click();
  await expect(page.getByRole('button', { name: /2: Vermelho/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /Desbloquear as 8 mobílias/ }).click();
  await expect(page.getByText('✓ Ativo')).toHaveCount(7);
  await expect(page.getByText('✓ Desbloqueado')).toHaveCount(1);
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

test('Presets: saldo inválido não vira 0 e valor acima do máximo é limitado', async ({ page }) => {
  await page.getByRole('tab', { name: /Trainer Presets/ }).click();
  const field = page.getByLabel('Saldo');
  const before = await field.inputValue();
  await expect(page.getByRole('button', { name: 'Definir 99.999' })).toBeVisible();
  await page.getByRole('button', { name: '+10.000' }).click();
  await expect(page.locator('strong.gold')).toHaveText('109.999 moedas');
  await field.fill('abc');
  await field.blur();
  await expect(page.getByRole('alert')).toContainText('apenas números');
  await field.fill('99999999999');
  await field.blur();
  await expect(page.getByRole('alert')).toContainText('2147483647');
  await expect(field).toHaveValue('99999999999');
  await field.fill('-1');
  await field.blur();
  await expect(page.getByRole('alert')).toContainText('zero');
  expect(before).not.toBe('');
});

test('Catálogo: botões Requisitar têm nome único e Ctrl+Z não age por baixo do modal', async ({ page }) => {
  await page.getByRole('tab', { name: /Inventários/ }).click();
  await page.getByRole('button', { name: '+ Adicionar ferramenta' }).click();
  const dlg = page.getByRole('dialog');
  const names = await dlg
    .getByRole('button', { name: /^Requisitar/ })
    .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  expect(new Set(names).size).toBe(names.length);
  await dlg.getByRole('button', { name: /^Requisitar Dado de Teletransporte —/ }).click();
  await expect(page.getByRole('status')).toContainText('adicionado');
  await expect(dlg).toBeVisible();
  await page.keyboard.press('Control+z'); // com o modal aberto não desfaz
  await dlg.getByRole('button', { name: /Voltar ao inventário/ }).click();
  await expect(page.getByRole('button', { name: 'Desfazer' })).toBeEnabled();
});

test('Inventário: remover item devolve o foco e anuncia', async ({ page }) => {
  await page.getByRole('tab', { name: /Inventários/ }).click();
  await page
    .getByRole('button', { name: /^Remover Dado de Teletransporte/ })
    .first()
    .click();
  await expect(page.getByRole('status')).toContainText('removido');
  await expect(page.getByRole('heading', { name: /Itens carregados/ })).toBeFocused();
});

test('Catálogo não oferece dados numéricos, outros ou itens internos', async ({ page }) => {
  await page.getByRole('tab', { name: /Inventários/ }).click();
  await page.getByRole('button', { name: '+ Adicionar ferramenta' }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByRole('button', { name: /Dados numéricos|Outros/ })).toHaveCount(0);
  await expect(dlg.getByText(/Mostrar também itens internos/)).toHaveCount(0);
  await expect(dlg.getByText('dice_tp', { exact: true })).toHaveCount(0);
  await expect(dlg.getByRole('button', { name: /^Dados \(/ })).toBeVisible();
});

test('Catálogo segue o destino selecionado ao decidir se fecha', async ({ page }) => {
  await page.getByRole('tab', { name: /Inventários/ }).click();
  await page
    .getByRole('button', { name: /^Remover Dado de Teletransporte/ })
    .first()
    .click();
  await page.getByRole('button', { name: '+ Adicionar ferramenta' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('combobox', { name: /Destino/ }).selectOption('p0');
  await dlg.getByRole('button', { name: /^Requisitar Lança-chamas/ }).click();
  await expect(dlg).not.toBeVisible();
  await expect(page.getByRole('heading', { name: /Itens carregados/ })).toBeFocused();
});

test('320px: nenhuma tela tem rolagem horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  for (const t of [/Sessão/, /Status/, /Inventários/, /Hub/, /Troféus/, /Trainer/]) {
    await page.getByRole('tab', { name: t }).click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, String(t)).toBeLessThanOrEqual(0);
  }
  await page.getByRole('tab', { name: /Inventários/ }).click();
  await page.getByRole('button', { name: '+ Adicionar ferramenta' }).click();
  const catalogOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(catalogOverflow, 'catálogo').toBeLessThanOrEqual(0);
});

test('Sessão: limpar o campo de um herói ocupado não o libera sem o botão', async ({ page }) => {
  const red = page.getByRole('article', { name: 'Red' });
  const field = red.getByRole('textbox');
  await field.fill('');
  await field.blur();
  await expect(red.getByRole('alert')).toContainText('Liberar slot');
  await expect(page.getByRole('heading', { name: /1 herói em campo/ })).toBeVisible();
});

test('Ctrl+S dentro de um campo abre a revisão de salvar', async ({ page }) => {
  await page.getByRole('tab', { name: /Trainer Presets/ }).click();
  await page.getByLabel('Saldo').focus();
  await page.keyboard.press('Control+s');
  await expect(page.getByRole('dialog')).toBeVisible();
});
