import { Transform } from 'class-transformer';

/** Trims surrounding whitespace from string input before validation. */
export const Trim = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
