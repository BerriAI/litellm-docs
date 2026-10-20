import {fail} from './fail';

// A calendar day in UTC, like `2026-10-13`. Every date on the page is drawn
// and read at this precision, so a release and a plan on the same day line up.
export type IsoDay = `${number}-${number}-${number}`;

// The UTC day of a timestamp or day string, failing the build on anything else.
export function isoDay(value: string, where: string): IsoDay {
  const time = Date.parse(value);
  if (!/^\d{4}-\d{2}-\d{2}(T|$)/.test(value) || !Number.isFinite(time)) {
    fail(`${where} has an invalid date: ${value}`);
  }
  return new Date(time).toISOString().slice(0, 10) as IsoDay;
}
