/**
 * The Thai half of every message group must have exactly the English shape:
 * the same keys, strings where English has strings and functions with the
 * same parameters where English interpolates. A missing or misspelt key is a
 * type error, so the two languages cannot drift apart.
 */
export type Shape<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => string
    ? (...args: A) => string
    : T[K] extends string
      ? string
      : T[K] extends readonly string[]
        ? readonly string[]
        : T[K] extends readonly (readonly string[])[]
          ? T[K]
        : T[K] extends Record<string, string>
          ? string extends keyof T[K]
            ? Record<string, string>
            : Shape<T[K]>
          : Shape<T[K]>;
};

export function defineMessages<T>(en: T, th: Shape<T>) {
  return { en, th: th as T };
}
