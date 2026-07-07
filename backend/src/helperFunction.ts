export const helperFunctions = {
  minutesBetween(start?: Date | null, end?: Date | null): number | null {
    if (!start || !end) return null;
    return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000));
  },

  nonEmptyTrimmed(value?: string | null): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  },
};

declare global {
  // Keep this small and pure. Domain behavior belongs in modules, not globals.
  // eslint-disable-next-line no-var
  var helperFunction: typeof helperFunctions | undefined;
}

globalThis.helperFunction = helperFunctions;
