// The three lines a guided step opens with, so a reader knows the situation before any control:
// setup (what is running), test (what goes wrong or what we want), fix (what the router does about
// it, and the setting). Each one restates its case in cases.js; keep them in step with it.

export const STORY = {
  weights: {
    setup: 'Two gpt-4o deployments, azure and openai, share 3 chat requests a second.',
    test: 'You want azure to take most of the traffic. Can the router send 3 of every 4 requests there?',
    fix: 'Give each deployment a weight. The router picks in proportion to it.',
  },
  'rpm-as-weight': {
    setup: 'Two gpt-4o deployments: small allows 60 requests a minute, big allows 600.',
    test: 'Split evenly, small runs into its limit. Does the router notice the difference without weights?',
    fix: 'Set rpm on each deployment. With no weights, the router splits traffic by rpm.',
  },
  order: {
    setup: 'Two gpt-4o deployments, primary and backup. Primary goes down from 0:40 to 1:10.',
    test: 'You want backup to sit idle until primary fails. Can the router hold it in reserve?',
    fix: 'Give primary order 1 and backup order 2. Order 2 only serves while order 1 cannot.',
  },
  'weighted-failover': {
    setup: 'Two gpt-4o deployments, east and west, no retries. East goes down at 0:30.',
    test: 'Calls that land on east fail until it cools down. Can they move to west straight away?',
    fix: 'Turn on enable_weighted_failover. A failed call is picked again on a peer in the same group.',
  },
  retries: {
    setup: 'Two gpt-4o deployments. One of them, flaky, fails 3 in 10 calls with a server error.',
    test: 'About 15% of all requests fail. Can the client stop seeing those errors?',
    fix: 'Set num_retries. A failed call is tried again, on another deployment, before the client hears back.',
  },
  'retry-policy': {
    setup: 'Two gpt-4o deployments. From 0:30 one of them, limited, turns some calls away with a 429.',
    test: 'Rate limits are worth retrying, other errors maybe not. Can you retry only the 429s?',
    fix: 'Set retry_policy. It sets the number of retries per error type.',
  },
  cooldown: {
    setup: 'Two gpt-4o deployments. From 0:30 every call to broken fails.',
    test: 'The router keeps sending traffic to broken, and every request there costs a retry. Can it stop?',
    fix: 'Set allowed_fails and cooldown_time. After that many failures in a minute, broken sits out.',
  },
  'cooldown-time': {
    setup: 'Two gpt-4o deployments. flapping fails from 0:30 to 0:45, then recovers.',
    test: 'How soon does flapping get traffic again after it is benched?',
    fix: 'cooldown_time sets how long a benched deployment sits out: 5 s before, 60 s after.',
  },
  'disable-cooldowns': {
    setup: 'Two gpt-4o deployments. From 0:30 every call to broken fails.',
    test: 'What happens when the router never benches a deployment?',
    fix: 'disable_cooldowns keeps every deployment in rotation, so broken keeps costing retries.',
  },
  'allowed-fails-policy': {
    setup: 'Two gpt-4o deployments. From 0:30 half the calls to limited get a 429 rate limit.',
    test: 'A few rate limits are normal. Should they bench limited the way an outage would?',
    fix: 'Set allowed_fails_policy. It sets how many failures of each error type a deployment takes before it sits out.',
  },
  fallbacks: {
    setup: 'gpt-4o has one deployment, openai, and claude has one, anthropic. openai is down from 0:30 to 1:30.',
    test: 'Every gpt-4o request fails while openai is down. Can they go to claude instead?',
    fix: 'Add fallbacks: gpt-4o to claude. When a whole group fails, the request moves to the next group.',
  },
  'default-fallbacks': {
    setup: 'gpt-4o and claude, one deployment each. openai is down from 0:30 to 1:30.',
    test: 'You do not want to write a fallback for every model. Is there one for all of them?',
    fix: 'Set default_fallbacks. It applies to every group that has no fallback of its own.',
  },
  'max-fallbacks': {
    setup: 'Three model groups, a, b and c. a falls back to b, b to c. a and b are down from 0:30.',
    test: 'A long fallback chain adds latency to every failed request. Can you cap it?',
    fix: 'Set max_fallbacks. With 1, a request tries b and then stops.',
  },
  'context-window-fallbacks': {
    setup: 'Most requests are normal chat. One in five has a prompt too long for gpt-4o.',
    test: 'Every long request fails on gpt-4o. Can they go to a model with a bigger window?',
    fix: 'Add context_window_fallbacks: gpt-4o to gpt-4.1. Only context window errors move.',
  },
  'client-fallbacks': {
    setup: 'Three kinds of request: one brings its own fallback, one has none, one opts out. openai goes down at 0:30.',
    test: 'Who gets an answer during the outage, and who decides?',
    fix: 'A request can bring its own fallbacks, use the router config, or turn them off with disable_fallbacks.',
  },
  'content-policy-fallbacks': {
    setup: 'Most requests are normal chat. One in five is refused by openai under its content policy.',
    test: 'anthropic would answer those requests. Can they go there instead of failing?',
    fix: 'Add content_policy_fallbacks: gpt-4o to claude. Only content policy errors move.',
  },
  'timeout-fallback': {
    setup: 'gpt-4o on openai, with claude available. From 0:30 openai answers 20 times slower.',
    test: 'Slow calls never fail, so nothing retries or falls back. The client just waits.',
    fix: 'Set a timeout and a fallback. A slow call becomes a failure, so the fallback takes over.',
  },
  'per-model-timeout': {
    setup: 'Two gpt-4o deployments, slow and steady. From 0:30 calls to slow take 20 times longer.',
    test: 'Only slow is the problem. Can you time it out without a global timeout?',
    fix: 'Put timeout in slow’s litellm_params. Its slow calls are cut short and retried on steady.',
  },
  alias: {
    setup: 'Clients ask for a model called smart. Today smart means gpt-4o.',
    test: 'You want to move smart to claude without changing any client.',
    fix: 'Set model_group_alias. Point smart at claude and the traffic follows.',
  },
  'team-deployment': {
    setup: 'Everyone shares one gpt-4o deployment. Team acme wants its own.',
    test: 'Can acme get a dedicated deployment while still asking for gpt-4o?',
    fix: 'Add a deployment with model_info.team_id: acme. Only acme’s requests land on it.',
  },
};
