import { useEffect, useRef } from 'react';
import { findItem, itemName } from '../catalog/catalog';
import { type Locale, selectText, useLocale, useText } from '../i18n';
import type { SaveValues } from '../schema/types';
import { hasErrors, type Issue } from '../schema/validate';
import { type Change, MAX_CHANGES } from '../state/document';
import { diagnosticMessage, fieldName } from './diagnostics';
import { formatValue } from './format';
import { reviewChanges } from './review';

function itemChangePath(path: string, locale: Locale): string | null {
  const player = /^save\.playerInventories\[(\d+)\]\.itemStringIds\[(\d+)\]$/.exec(path);
  if (player)
    return `${selectText(locale, 'Carried items', 'Itens carregados', 'Objetos cargados')} • ${selectText(locale, 'player', 'jogador', 'jugador')} ${Number(player[1]) + 1}, ${selectText(locale, 'position', 'posição', 'posición')} ${Number(player[2]) + 1}`;
  const bench = /^save\.gameRoomTools\.itemStringIds\[(\d+)\]$/.exec(path);
  if (bench)
    return `${selectText(locale, 'Tools on the bench/shelf', 'Ferramentas na bancada/prateleira', 'Herramientas en la mesa/estante')} • ${selectText(locale, 'position', 'posição', 'posición')} ${Number(bench[1]) + 1}`;
  return null;
}

function displayChangeValue(path: string, value: unknown, locale: Locale): string {
  if (itemChangePath(path, locale) && typeof value === 'string') {
    const item = findItem(value);
    return item
      ? itemName(item, locale)
      : selectText(locale, 'Unrecognized item', 'Item não reconhecido', 'Objeto no reconocido');
  }
  return formatValue(value, locale);
}

interface Props {
  changes: Change[];
  issues: Issue[];
  original: SaveValues;
  values: SaveValues;
  busy: boolean;
  inPlace: boolean;
  onBackup: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SaveDialog({
  changes,
  issues,
  original,
  values,
  busy,
  inPlace,
  onBackup,
  onConfirm,
  onCancel,
}: Props) {
  const t = useText();
  const { locale } = useLocale();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => {
      d?.close();
      opener?.focus(); // devolve o foco a quem abriu o diálogo
    };
  }, []);

  const truncated = changes.length >= MAX_CHANGES;
  const blocked = hasErrors(issues);
  const rows = reviewChanges(changes, original, values, locale);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="save-title"
      onCancel={(e) => {
        e.preventDefault(); // Esc não fecha durante a gravação
        if (!busy) onCancel();
      }}
    >
      <h2 id="save-title">
        {t('Review changes', 'Revisar alterações', 'Revisar cambios')} ({rows.length}
        {truncated ? '+' : ''})
      </h2>
      {changes.length === 0 ? (
        <p className="muted">
          {t(
            'No changes: the save data stays the same (the file is rewritten).',
            'Nenhuma alteração: os dados do save não mudam (o arquivo é regravado).',
            'Sin cambios: los datos de la partida no cambian (el archivo se vuelve a escribir).',
          )}
        </p>
      ) : (
        <>
          <div
            className="changes"
            role="region"
            aria-label={t('Changes list', 'Lista de alterações', 'Lista de cambios')}
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">{t('Field', 'Campo', 'Campo')}</th>
                  <th scope="col">{t('Before', 'Antes', 'Antes')}</th>
                  <th scope="col">{t('After', 'Depois', 'Después')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.path}>
                    <td>{c.label ?? itemChangePath(c.path, locale) ?? fieldName(c.path, locale, values)}</td>
                    <td>{c.beforeText ?? displayChangeValue(c.path, c.before, locale)}</td>
                    <td>{c.afterText ?? displayChangeValue(c.path, c.after, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {truncated && (
            <p className="muted">
              {t('Showing the first', 'Mostrando as primeiras', 'Mostrando los primeros')} {MAX_CHANGES}{' '}
              {t(
                'changes; there are more. All will be saved.',
                'alterações; há mais. Todas serão gravadas.',
                'cambios; hay más. Se guardarán todos.',
              )}
            </p>
          )}
        </>
      )}
      {issues.length > 0 && (
        <section className={blocked ? 'issues issues-error' : 'issues'} aria-labelledby="issues-title">
          <h3 id="issues-title">
            {blocked
              ? t('Fix before saving', 'Corrija antes de salvar', 'Corrige antes de guardar')
              : t('Warnings', 'Avisos', 'Avisos')}
          </h3>
          <ul>
            {issues.map((i) => (
              <li key={`${i.severity}-${i.path}-${i.message}`}>
                <strong>
                  {i.severity === 'error' ? t('Error', 'Erro', 'Error') : t('Warning', 'Aviso', 'Aviso')}:
                </strong>{' '}
                {fieldName(i.path, locale, values)} — {diagnosticMessage(i.message, locale)}
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="muted">
        {inPlace
          ? t(
              'A backup (.bak_date) will be created beside the file before it is overwritten. Close the game first.',
              'Um backup (.bak_data) será criado ao lado e o arquivo será gravado no lugar. Feche o jogo antes.',
              'Se creará una copia (.bak_fecha) junto al archivo antes de sobrescribirlo. Cierra el juego primero.',
            )
          : t(
              'Your browser cannot overwrite the file: the edited save will be downloaded. Download a backup of the original first, then copy the edited save to the game saves folder.',
              'Seu navegador não permite gravar no lugar: o save editado será baixado. Antes, baixe o backup do original e depois copie o save editado para a pasta de saves do jogo.',
              'Tu navegador no puede sobrescribir el archivo: se descargará la partida editada. Descarga antes una copia del original y luego copia la partida editada a la carpeta del juego.',
            )}
      </p>
      <div className="actions">
        <button type="button" className="btn btn-brass" onClick={onCancel} disabled={busy}>
          {t('Cancel', 'Cancelar', 'Cancelar')}
        </button>
        {!inPlace && (
          <button type="button" className="btn btn-brass" onClick={onBackup} disabled={busy}>
            {t('Download original backup', 'Baixar backup do original', 'Descargar copia del original')}
          </button>
        )}
        <button type="button" className="btn btn-green" onClick={onConfirm} disabled={busy || blocked}>
          {busy
            ? t('Saving…', 'Salvando…', 'Guardando…')
            : inPlace
              ? t('Confirm and save', 'Confirmar e salvar', 'Confirmar y guardar')
              : t('Download edited save', 'Baixar save editado', 'Descargar partida editada')}
        </button>
      </div>
    </dialog>
  );
}
