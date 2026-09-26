// The data files fail the build when they drift out of shape.
export function fail(message) {
  throw new Error(`Rust migration: ${message}`);
}
