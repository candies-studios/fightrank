/**
 * A PostgREST-compatible query builder over a real PostgreSQL instance
 * (PGlite — Postgres compiled to WebAssembly).
 *
 * This is a *translation layer*, not a fake database: every call here becomes
 * genuine SQL executed by genuine Postgres, against the same schema the
 * Supabase project uses. It exists so the repository layer can be written once.
 */

import type { PGlite } from '@electric-sql/pglite'
import type {
  PostgrestFilter,
  PostgrestLike,
  PostgrestResponse,
  PostgrestTable,
} from '../postgrest'

/** Columns that are jsonb and must be serialised rather than passed through. */
const JSONB_COLUMNS = new Set([
  'components',
  'details',
  'previous_value',
  'new_value',
  'value',
  'raw_user_meta_data',
])

type Filter = { column: string; operator: string; value: unknown; negate?: boolean }
type Order = { column: string; ascending: boolean; nullsFirst: boolean }

const OPERATOR_SQL: Record<string, string> = {
  eq: '=',
  neq: '<>',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  like: 'like',
  ilike: 'ilike',
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

function serialize(column: string, value: unknown): unknown {
  if (value === undefined) return null
  if (value === null) return null
  if (JSONB_COLUMNS.has(column)) return JSON.stringify(value)
  if (Array.isArray(value)) return value
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') return JSON.stringify(value)
  return value
}

class Builder<Row> implements PostgrestFilter<Row> {
  private filters: Filter[] = []
  private orders: Order[] = []
  private limitValue: number | null = null
  private offsetValue = 0
  private wantCount = false
  private headOnly = false

  private readonly db: PGlite
  private readonly table: string
  private readonly operation: 'select' | 'insert' | 'update' | 'upsert' | 'delete'
  private readonly payload?: Record<string, unknown>[] | Record<string, unknown>
  private readonly onConflict?: string

  constructor(
    db: PGlite,
    table: string,
    operation: 'select' | 'insert' | 'update' | 'upsert' | 'delete',
    payload?: Record<string, unknown>[] | Record<string, unknown>,
    onConflict?: string,
  ) {
    this.db = db
    this.table = table
    this.operation = operation
    this.payload = payload
    this.onConflict = onConflict
  }

  // --- filters --------------------------------------------------------------
  private push(column: string, operator: string, value: unknown, negate = false): this {
    this.filters.push({ column, operator, value, negate })
    return this
  }

  eq(column: string, value: unknown) { return this.push(column, 'eq', value) }
  neq(column: string, value: unknown) { return this.push(column, 'neq', value) }
  gt(column: string, value: unknown) { return this.push(column, 'gt', value) }
  gte(column: string, value: unknown) { return this.push(column, 'gte', value) }
  lt(column: string, value: unknown) { return this.push(column, 'lt', value) }
  lte(column: string, value: unknown) { return this.push(column, 'lte', value) }
  like(column: string, pattern: string) { return this.push(column, 'like', pattern) }
  ilike(column: string, pattern: string) { return this.push(column, 'ilike', pattern) }
  is(column: string, value: null | boolean) { return this.push(column, 'is', value) }
  in(column: string, values: readonly unknown[]) { return this.push(column, 'in', values) }
  not(column: string, operator: string, value: unknown) {
    return this.push(column, operator, value, true)
  }

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.orders.push({
      column,
      ascending: options?.ascending ?? true,
      nullsFirst: options?.nullsFirst ?? false,
    })
    return this
  }

  limit(count: number) {
    this.limitValue = count
    return this
  }

  range(from: number, to: number) {
    this.offsetValue = from
    this.limitValue = to - from + 1
    return this
  }

  withCount(head: boolean) {
    this.wantCount = true
    this.headOnly = head
    return this
  }

  // --- SQL ------------------------------------------------------------------
  private buildWhere(params: unknown[]): string {
    if (this.filters.length === 0) return ''
    const parts = this.filters.map((filter) => {
      const col = quoteIdent(filter.column)
      let clause: string
      if (filter.operator === 'is') {
        clause =
          filter.value === null ? `${col} is null` : `${col} is ${filter.value ? 'true' : 'false'}`
      } else if (filter.operator === 'in') {
        const values = (filter.value as unknown[]).map((v) => serialize(filter.column, v))
        if (values.length === 0) return 'false'
        params.push(values)
        clause = `${col} = any($${params.length})`
      } else {
        const sqlOp = OPERATOR_SQL[filter.operator]
        if (!sqlOp) throw new Error(`Unsupported operator "${filter.operator}"`)
        params.push(serialize(filter.column, filter.value))
        clause = `${col} ${sqlOp} $${params.length}`
      }
      return filter.negate ? `not (${clause})` : clause
    })
    return ` where ${parts.join(' and ')}`
  }

  private buildOrderLimit(): string {
    let sql = ''
    if (this.orders.length > 0) {
      sql += ` order by ${this.orders
        .map(
          (o) =>
            `${quoteIdent(o.column)} ${o.ascending ? 'asc' : 'desc'} nulls ${
              o.nullsFirst ? 'first' : 'last'
            }`,
        )
        .join(', ')}`
    }
    if (this.limitValue !== null) sql += ` limit ${Math.max(0, Math.floor(this.limitValue))}`
    if (this.offsetValue > 0) sql += ` offset ${Math.floor(this.offsetValue)}`
    return sql
  }

  private rowsPayload(): Record<string, unknown>[] {
    if (!this.payload) return []
    return Array.isArray(this.payload) ? this.payload : [this.payload]
  }

  private async execute(): Promise<PostgrestResponse<Row[]>> {
    const table = quoteIdent(this.table)
    const params: unknown[] = []
    let sql: string
    let count: number | null = null

    try {
      switch (this.operation) {
        case 'select': {
          if (this.wantCount) {
            const countParams: unknown[] = []
            const countSql = `select count(*)::int as c from ${table}${this.buildWhere(countParams)}`
            const res = await this.db.query<{ c: number }>(countSql, countParams)
            count = res.rows[0]?.c ?? 0
            if (this.headOnly) return { data: [], error: null, count }
          }
          sql = `select * from ${table}${this.buildWhere(params)}${this.buildOrderLimit()}`
          break
        }
        case 'insert':
        case 'upsert': {
          const rows = this.rowsPayload()
          if (rows.length === 0) return { data: [], error: null, count: 0 }
          const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))]
          const tuples = rows.map((row) => {
            const placeholders = columns.map((col) => {
              params.push(serialize(col, row[col]))
              return `$${params.length}`
            })
            return `(${placeholders.join(', ')})`
          })
          sql =
            `insert into ${table} (${columns.map(quoteIdent).join(', ')}) values ${tuples.join(', ')}`
          if (this.operation === 'upsert') {
            const conflict = (this.onConflict ?? 'id')
              .split(',')
              .map((c) => quoteIdent(c.trim()))
              .join(', ')
            const updates = columns
              .filter((c) => !(this.onConflict ?? 'id').split(',').map((x) => x.trim()).includes(c))
              .map((c) => `${quoteIdent(c)} = excluded.${quoteIdent(c)}`)
            sql += updates.length
              ? ` on conflict (${conflict}) do update set ${updates.join(', ')}`
              : ` on conflict (${conflict}) do nothing`
          }
          sql += ' returning *'
          break
        }
        case 'update': {
          const row = this.rowsPayload()[0] ?? {}
          const columns = Object.keys(row)
          if (columns.length === 0) return { data: [], error: null, count: 0 }
          const sets = columns.map((col) => {
            params.push(serialize(col, row[col]))
            return `${quoteIdent(col)} = $${params.length}`
          })
          sql = `update ${table} set ${sets.join(', ')}${this.buildWhere(params)} returning *`
          break
        }
        case 'delete': {
          sql = `delete from ${table}${this.buildWhere(params)} returning *`
          break
        }
      }

      const result = await this.db.query<Row>(sql, params)
      return { data: result.rows as Row[], error: null, count: count ?? result.rows.length }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { data: [] as Row[], error: { message }, count: null }
    }
  }

  then<A = PostgrestResponse<Row[]>, B = never>(
    onfulfilled?: ((value: PostgrestResponse<Row[]>) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return this.execute().then(onfulfilled, onrejected)
  }

  single(): PromiseLike<PostgrestResponse<Row>> {
    return this.execute().then((res) => {
      if (res.error) return { data: null as unknown as Row, error: res.error }
      const rows = res.data
      if (rows.length !== 1) {
        return {
          data: null as unknown as Row,
          error: {
            message:
              rows.length === 0
                ? 'JSON object requested, multiple (or no) rows returned'
                : 'More than one row returned',
            code: 'PGRST116',
          },
        }
      }
      return { data: rows[0], error: null }
    })
  }

  maybeSingle(): PromiseLike<PostgrestResponse<Row | null>> {
    return this.execute().then((res) => {
      if (res.error) return { data: null, error: res.error }
      return { data: res.data[0] ?? null, error: null }
    })
  }
}

class Table<Row> implements PostgrestTable<Row> {
  private readonly db: PGlite
  private readonly table: string

  constructor(db: PGlite, table: string) {
    this.db = db
    this.table = table
  }

  select(_columns?: string, options?: { count?: 'exact'; head?: boolean }) {
    const builder = new Builder<Row>(this.db, this.table, 'select')
    if (options?.count === 'exact') builder.withCount(options.head === true)
    return builder
  }

  insert(values: Record<string, unknown> | Record<string, unknown>[]) {
    return new Builder<Row>(this.db, this.table, 'insert', values)
  }

  update(values: Record<string, unknown>) {
    return new Builder<Row>(this.db, this.table, 'update', values)
  }

  upsert(
    values: Record<string, unknown> | Record<string, unknown>[],
    options?: { onConflict?: string },
  ) {
    return new Builder<Row>(this.db, this.table, 'upsert', values, options?.onConflict)
  }

  delete() {
    return new Builder<Row>(this.db, this.table, 'delete')
  }
}

export function createPostgrestShim(db: PGlite): PostgrestLike {
  return {
    from<Row = Record<string, unknown>>(table: string) {
      return new Table<Row>(db, table)
    },
  }
}
