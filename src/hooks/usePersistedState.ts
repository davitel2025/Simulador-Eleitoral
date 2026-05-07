import { useCallback, useState } from "react";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readPersistedValue<T>(key: string, defaultValue: T): T {
  try {
    if (typeof window === "undefined") return defaultValue;
    const raw = window.localStorage.getItem(key);
    if (!raw) return defaultValue;
    const saved = JSON.parse(raw);
    if (isPlainObject(defaultValue) && isPlainObject(saved)) {
      return { ...defaultValue, ...saved } as T;
    }
    return saved as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Mantem um estado React sincronizado com localStorage usando JSON.
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => readPersistedValue(key, defaultValue));

  const setPersistedState = useCallback(
    (value: T | ((prev: T) => T)) => {
      setState((prev) => {
        const nextValue =
          typeof value === "function" ? (value as (previous: T) => T)(prev) : value;
        try {
          if (typeof window !== "undefined") {
            window.localStorage.setItem(key, JSON.stringify(nextValue));
          }
        } catch {
          // Em navegadores restritivos, o estado continua funcionando sem persistencia.
        }
        return nextValue;
      });
    },
    [key]
  );

  return [state, setPersistedState];
}

/**
 * Remove todas as entradas de localStorage que usam o prefixo informado.
 */
export function clearPersistedStateByPrefix(prefix: string): void {
  try {
    if (typeof window === "undefined") return;
    const keysToRemove: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(prefix)) keysToRemove.push(key);
    }
    keysToRemove.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Falhas no localStorage nao devem impedir o reset visual em memoria.
  }
}
