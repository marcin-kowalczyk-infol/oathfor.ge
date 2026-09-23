export const copy = {
  pl: {
    pending: 'Sprawdzanie połączenia…',
    success: 'Połączenie z API działa.',
    error: 'Nie udało się potwierdzić połączenia.',
    retry: 'Spróbuj ponownie',
  },
  en: {
    pending: 'Checking connection…',
    success: 'Connected to the API.',
    error: 'Could not confirm the connection.',
    retry: 'Try again',
  },
} as const;

export type DiagnosticLocale = keyof typeof copy;
