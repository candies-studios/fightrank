import type { PGliteOptions } from '@electric-sql/pglite'

/**
 * PostgREST hands dates and timestamps to the client as ISO strings. PGlite
 * parses them into `Date` objects by default, so we switch that off: both
 * backends must return byte-identical shapes or the repository above them would
 * need two code paths.
 */
const DATE_OID = 1082
const TIMESTAMP_OID = 1114
const TIMESTAMPTZ_OID = 1184
const NUMERIC_OID = 1700

const asText = (value: string): string => value

export const PGLITE_OPTIONS: PGliteOptions = {
  parsers: {
    [DATE_OID]: asText,
    [TIMESTAMP_OID]: asText,
    [TIMESTAMPTZ_OID]: asText,
    [NUMERIC_OID]: asText,
  },
}
