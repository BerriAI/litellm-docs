const imported = require('./imported/sidebar.json');

module.exports = {
  type: 'category',
  label: 'LiteLLM Lens',
  link: {type: 'doc', id: 'proxy/lens/index'},
  items: [
    {
      type: 'category',
      label: 'Set up Lens',
      link: {type: 'doc', id: 'proxy/lens/deployment'},
      items: [
        'proxy/lens/deployment/local',
        'proxy/lens/deployment/litellm',
        'proxy/lens/deployment/kubernetes',
        'proxy/lens/deployment/server',
        'proxy/lens/deployment/docker-compose',
        'proxy/lens/deployment/docker',
        'proxy/lens/deployment/storage',
        'proxy/lens/deployment/configuration',
        'proxy/lens/deployment/releases',
        'proxy/lens/deployment/upgrades',
        'proxy/lens/deployment/development',
      ],
    },
    {type: 'doc', id: 'proxy/lens/first-trace', label: 'Send your first trace'},
    {
      type: 'category',
      label: 'Integrations',
      items: ['proxy/lens/framework-examples', ...imported.integrations, 'proxy/lens/integrations/openclaw', 'proxy/lens/integrations/hermes'],
    },
    {
      type: 'category',
      label: 'Coding agent sessions',
      link: {type: 'doc', id: 'proxy/lens/coding-agents'},
      items: imported['coding-agents'],
    },
    'proxy/lens/investigations',
    'proxy/lens/api',
    {type: 'doc', id: 'proxy/lens/scalability', label: 'Scalability design'},
  ],
};
