import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';

export type Locale = 'en-US' | 'pt-BR' | 'es-419';
export const LOCALE_STORAGE_KEY = 'invokyr.locale';
const LOCALES: readonly Locale[] = ['en-US', 'pt-BR', 'es-419'];

export function resolveLocale(saved: string | null, browserLanguages: readonly string[]): Locale {
  if (LOCALES.includes(saved as Locale)) return saved as Locale;
  for (const language of browserLanguages) {
    const primary = language.toLowerCase().split('-')[0];
    if (primary === 'pt') return 'pt-BR';
    if (primary === 'es') return 'es-419';
    if (primary === 'en') return 'en-US';
  }
  return 'en-US';
}

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}
const LocaleContext = createContext<LocaleState | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    } catch {
      // Storage can be disabled without preventing use of the editor.
    }
    return resolveLocale(saved, navigator.languages ?? [navigator.language]);
  });
  useEffect(() => {
    document.documentElement.lang = locale;
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      // The current selection still works for this tab.
    }
  }, [locale]);
  return <LocaleContext.Provider value={{ locale, setLocale }}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleState {
  const state = useContext(LocaleContext);
  if (!state) throw new Error('LocaleProvider missing');
  return state;
}

export const selectText = (locale: Locale, en: string, pt: string, es: string): string =>
  locale === 'pt-BR' ? pt : locale === 'es-419' ? es : en;

export function useText() {
  const { locale } = useLocale();
  return (en: string, pt: string, es: string) => selectText(locale, en, pt, es);
}

export function LanguageSelect() {
  const { locale, setLocale } = useLocale();
  const text = useText();
  return (
    <label className="inline language-select">
      <span className="field-label">{text('Language', 'Idioma', 'Idioma')}</span>
      <select
        className="input input-sm"
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
      >
        <option value="en-US">English (US)</option>
        <option value="pt-BR">Português (Brasil)</option>
        <option value="es-419">Español (Latinoamérica)</option>
      </select>
    </label>
  );
}
