import {usePluginData} from '@docusaurus/useGlobalData';

// A LiteLLM figure fetched at build time by plugins/litellm-stats.js, e.g.
// <Stat id="stars" /> renders "59.8k". The markdown copy gets the same value.
export default function Stat({id}) {
  const stats = usePluginData('litellm-stats') || {};
  return stats[id] ?? null;
}
