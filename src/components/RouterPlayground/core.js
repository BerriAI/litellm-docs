import yaml from 'js-yaml';

// Loads the router core (the WebAssembly build under static/router-playground/) once per page.
// The build comes from ./core; see its README.

export function loadCore(base) {
  if (!loadCore.promise) {
    loadCore.promise = import(/* webpackIgnore: true */ `${base}router_playground.js`).then(async core => {
      await core.default({module_or_path: `${base}router_playground_bg.wasm`});
      return core;
    });
  }
  return loadCore.promise;
}

export function parseConfig(text) {
  const parsed = yaml.load(text);
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.model_list)) {
    throw new Error('The config needs a model_list.');
  }
  return parsed;
}
