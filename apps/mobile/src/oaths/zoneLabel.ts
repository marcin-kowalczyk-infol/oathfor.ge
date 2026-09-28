type Translate = (key: string) => string;
/** Readable zone name: Warsaw, London and UTC are translated, other zones show their city part. */
export function zoneLabel(zone: string, t: Translate): string {
  if (zone === 'Europe/Warsaw') return t('timePicker.warsaw');
  if (zone === 'Europe/London') return t('timePicker.london');
  if (zone === 'UTC') return t('timePicker.utc');
  return zone.split('/').slice(1).join(' / ').replaceAll('_', ' ') || zone;
}
