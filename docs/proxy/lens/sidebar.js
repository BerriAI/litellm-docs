const imported = require('./imported/sidebar.json');

module.exports = {
  type: 'category',
  label: 'LiteLLM Lens',
  link: {type: 'doc', id: 'proxy/lens/index'},
  items: [
    {type: 'doc', id: 'proxy/lens/deployment', label: 'Deployment'},
    {type: 'doc', id: 'proxy/lens/first-trace', label: 'Send your first trace'},
    {
      type: 'category',
      label: 'Integrations',
      items: [...imported.integrations, 'proxy/lens/integrations/openclaw', 'proxy/lens/integrations/hermes'],
    },
    {
      type: 'category',
      label: 'Coding agent sessions',
      link: {type: 'doc', id: 'proxy/lens/coding-agents'},
      items: imported['coding-agents'],
    },
    'proxy/lens/investigations',
    'proxy/lens/api',
  ],
};
