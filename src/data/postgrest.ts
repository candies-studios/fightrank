/**
 * The minimal PostgREST-shaped surface the repository layer depends on.
 *
 * `@supabase/supabase-js` satisfies this natively. The local PGlite demo
 * database satisfies it through a thin SQL translation layer
 * (`data/pglite/shim.ts`). Because both backends speak the same dialect there
 * is exactly ONE repository implementation in the codebase — no parallel query
 * code to drift apart.
 *
 * Deliberately no embedded-resource syntax: every join lives in a database
 * VIEW (see `supabase/migrations/0004_views.sql`), which both backends run.
 */

export interface PostgrestError {
  message: string
  code?: string
  details?: string
}

export interface PostgrestResponse<T> {
  data: T
  error: PostgrestError | null
  count?: number | null
}

export interface PostgrestFilter<Row> extends PromiseLike<PostgrestResponse<Row[]>> {
  eq(column: string, value: unknown): PostgrestFilter<Row>
  neq(column: string, value: unknown): PostgrestFilter<Row>
  gt(column: string, value: unknown): PostgrestFilter<Row>
  gte(column: string, value: unknown): PostgrestFilter<Row>
  lt(column: string, value: unknown): PostgrestFilter<Row>
  lte(column: string, value: unknown): PostgrestFilter<Row>
  like(column: string, pattern: string): PostgrestFilter<Row>
  ilike(column: string, pattern: string): PostgrestFilter<Row>
  is(column: string, value: null | boolean): PostgrestFilter<Row>
  in(column: string, values: readonly unknown[]): PostgrestFilter<Row>
  not(column: string, operator: string, value: unknown): PostgrestFilter<Row>
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): PostgrestFilter<Row>
  limit(count: number): PostgrestFilter<Row>
  range(from: number, to: number): PostgrestFilter<Row>
  single(): PromiseLike<PostgrestResponse<Row>>
  maybeSingle(): PromiseLike<PostgrestResponse<Row | null>>
}

export interface PostgrestTable<Row> {
  select(
    columns?: string,
    options?: { count?: 'exact'; head?: boolean },
  ): PostgrestFilter<Row>
  insert(values: Record<string, unknown> | Record<string, unknown>[]): PostgrestFilter<Row>
  update(values: Record<string, unknown>): PostgrestFilter<Row>
  upsert(
    values: Record<string, unknown> | Record<string, unknown>[],
    options?: { onConflict?: string },
  ): PostgrestFilter<Row>
  delete(): PostgrestFilter<Row>
}

export interface PostgrestLike {
  from<Row = Record<string, unknown>>(table: string): PostgrestTable<Row>
}

/** Throw on error, otherwise hand back the rows. */
export async function unwrap<T>(promise: PromiseLike<PostgrestResponse<T>>): Promise<T> {
  const { data, error } = await promise
  if (error) throw new Error(error.message)
  return data
}

export async function unwrapCount<T>(
  promise: PromiseLike<PostgrestResponse<T>>,
): Promise<{ data: T; count: number }> {
  const res = await promise
  if (res.error) throw new Error(res.error.message)
  return { data: res.data, count: res.count ?? 0 }
}
