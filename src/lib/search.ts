/**
 * Builds a PostgREST `or` filter that matches `term` case-insensitively against any of `columns`.
 * Characters with special meaning in filter syntax are removed so user input cannot break the query.
 */
export function ilikeAny(columns: string[], term: string): string {
  const safe = term.replace(/[,()*%\\"]/g, " ").trim();
  return columns.map((c) => `${c}.ilike.%${safe}%`).join(",");
}
