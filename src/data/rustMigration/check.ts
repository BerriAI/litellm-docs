import type {IsoDay} from './shared';

// The data fails the build when it drifts out of shape.
export function fail(message: string): never {
  throw new Error(`Rust migration: ${message}`);
}

// The UTC day of a timestamp or day string, failing the build on anything else.
export function isoDay(value: string, where: string): IsoDay {
  const time = Date.parse(value);
  if (!/^\d{4}-\d{2}-\d{2}(T|$)/.test(value) || !Number.isFinite(time)) {
    fail(`${where} has an invalid date: ${value}`);
  }
  return new Date(time).toISOString().slice(0, 10) as IsoDay;
}
