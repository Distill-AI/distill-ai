export function num(value: number | undefined | null): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
