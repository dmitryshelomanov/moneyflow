import { useEffect, useState } from "react";

function normalizeDebouncedValue(value: string, trim: boolean) {
  return trim ? value.trim() : value;
}

export function useDebouncedValue(
  value: string,
  delayMs: number,
  trim = false,
) {
  const normalizedValue = normalizeDebouncedValue(value, trim);
  const [debounced, setDebounced] = useState(() => normalizedValue);

  useEffect(() => {
    if (delayMs <= 0) {
      setDebounced((current) =>
        current === normalizedValue ? current : normalizedValue,
      );
      return;
    }

    const handle = window.setTimeout(() => {
      setDebounced((current) =>
        current === normalizedValue ? current : normalizedValue,
      );
    }, delayMs);

    return () => window.clearTimeout(handle);
  }, [delayMs, normalizedValue]);

  return debounced;
}
