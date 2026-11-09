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
  return foldDefaultFallbacks(parsed);
}

// The proxy hands default_fallbacks (from router_settings or litellm_settings) to the router, which
// folds them into its fallbacks as {"*": [...]}. The core takes them already folded, as Python's
// Router does at construction.
export function foldDefaultFallbacks(config) {
  const settings = config.router_settings ?? {};
  const list = settings.default_fallbacks ?? config.litellm_settings?.default_fallbacks;
  if (!Array.isArray(list) || !list.length) return config;
  const fallbacks = Array.isArray(settings.fallbacks) ? settings.fallbacks : [];
  if (fallbacks.some(entry => entry && typeof entry === 'object' && '*' in entry)) return config;
  return {...config, router_settings: {...settings, fallbacks: [...fallbacks, {'*': list}]}};
}
