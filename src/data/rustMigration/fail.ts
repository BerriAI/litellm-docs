// The data files fail the build when they drift out of shape.
export function fail(message: string): never {
  throw new Error(`Rust migration: ${message}`);
}
