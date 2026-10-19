// Lets `node --test` import the TypeScript data files the way webpack does:
// extensionless relative imports resolve to `.ts`, and JSON imports need no
// `with {type: 'json'}`. Node strips the types itself.
import {registerHooks} from 'node:module';

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.endsWith('.json')) {
      return {...next(specifier, context), importAttributes: {type: 'json'}};
    }
    try {
      return next(specifier, context);
    } catch (error) {
      if (!specifier.startsWith('.')) {
        throw error;
      }
      return next(`${specifier}.ts`, context);
    }
  },
});
