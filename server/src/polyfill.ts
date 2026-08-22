/**
 * @colyseus/schema v3 uses the native TC39 "decorator metadata" proposal
 * (Symbol.metadata) to register each Schema class's fields. Node.js does
 * not define Symbol.metadata globally yet, so without this polyfill every
 * @type(...) decorator silently fails to register and the server crashes
 * with "Cannot read properties of undefined (reading 'Symbol(Symbol.metadata)')"
 * the first time it tries to encode state.
 *
 * This must be imported before any file that defines a Schema class
 * (see the very first line of index.ts).
 */
if (!(Symbol as unknown as { metadata?: symbol }).metadata) {
  (Symbol as unknown as { metadata: symbol }).metadata = Symbol.for("Symbol.metadata");
}
