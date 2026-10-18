/** For @Transform: trims a string before it's validated. Other values pass through. */
export const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
