function flatten(value: object, prefix = ''): Record<string, string> {
  return Object.fromEntries(Object.entries(value).flatMap(([key, message]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof message === 'string' ? [[path, message]] : Object.entries(flatten(message, path));
  }));
}

const pluralSuffix = /_(zero|one|two|few|many|other)$/;
function argumentsOf(message: string) {
  return [...new Set([...message.matchAll(/{{\s*([^},]+)(?:,[^}]*)?\s*}}/g)].map((match) => match[1].trim()))].sort().join(',');
}

// Validation for bundled catalogs, called by tests; never a remote translation loader.
export function validateCatalogs(catalogs: Record<'pl' | 'en', object>): string[] {
  const flat = { pl: flatten(catalogs.pl), en: flatten(catalogs.en) };
  const keys = new Set(Object.values(flat).flatMap((catalog) => Object.keys(catalog).map((key) => key.replace(pluralSuffix, ''))));
  const errors: string[] = [];
  for (const key of keys) {
    const messages: string[] = [];
    const isPlural = Object.values(flat).some((catalog) => Object.keys(catalog).some((path) => path.replace(pluralSuffix, '') === key && pluralSuffix.test(path)));
    for (const locale of ['pl', 'en'] as const) {
      const required = isPlural ? new Intl.PluralRules(locale).resolvedOptions().pluralCategories.map((category) => `${key}_${category}`) : [key];
      const present = Object.keys(flat[locale]).filter((path) => path.replace(pluralSuffix, '') === key);
      const paths = new Set([...required, ...present]);
      for (const path of paths) {
        const message = flat[locale][path];
        if (!message?.trim()) errors.push(`${locale}: missing ${path}`);
        else messages.push(message);
      }
    }
    if (new Set(messages.map(argumentsOf)).size > 1) errors.push(`arguments differ: ${key}`);
  }
  return errors;
}
