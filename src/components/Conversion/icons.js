import React from 'react';

// One-stroke line icons drawn for the docs. 24px grid, 1.6 stroke, currentColor,
// so they follow the theme in light and dark mode. A second tone
// (var(--cv-accent)) marks the one detail that carries the meaning.

function Svg({children, size = 24, title, ...rest}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      {...rest}>
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

// The fallback lets the icons work outside the conversion components too.
const A = {stroke: 'var(--cv-accent, var(--ifm-color-primary))'};
const AF = {fill: 'var(--cv-accent, var(--ifm-color-primary))', stroke: 'none'};

// A curly brace with a spark inside: code that calls models.
export const IconSdk = (p) => (
  <Svg {...p}>
    <path d="M8 4c-2 0-2.5 1-2.5 2.5v2.2c0 1.2-.7 2.3-2 2.3 1.3 0 2 1.1 2 2.3v2.2C5.5 19 6 20 8 20" />
    <path d="M16 4c2 0 2.5 1 2.5 2.5v2.2c0 1.2.7 2.3 2 2.3-1.3 0-2 1.1-2 2.3v2.2C18.5 19 18 20 16 20" />
    <path d="M12 8.5v7M8.5 12h7M9.6 9.6l4.8 4.8M14.4 9.6l-4.8 4.8" style={A} strokeWidth="1.3" />
  </Svg>
);

// Many lines funnel through one arch and fan out again.
export const IconGateway = (p) => (
  <Svg {...p}>
    <path d="M2 6c4 0 5 6 8 6M2 12h8M2 18c4 0 5-6 8-6" />
    <path d="M14 12c3 0 4-6 8-6M14 12h8M14 12c3 0 4 6 8 6" />
    <rect x="9.5" y="8.5" width="5" height="7" rx="2.5" style={A} />
  </Svg>
);

// A building with a shield on its face: the organization, protected.
export const IconEnterprise = (p) => (
  <Svg {...p}>
    <path d="M4 21V5.5L12 3l8 2.5V21M2.5 21h19" />
    <path d="M7.5 8h1.5M7.5 11.5h1.5M15 8h1.5" />
    <path d="M14 12.5l2.8-1 2.7 1v2.4c0 1.9-1.2 3.2-2.7 3.8-1.6-.6-2.8-1.9-2.8-3.8z" style={A} />
  </Svg>
);

// A key whose bow is a person: sign in with your identity provider.
export const IconSso = (p) => (
  <Svg {...p}>
    <circle cx="7.5" cy="8" r="2.2" style={A} />
    <path d="M3.8 15.5c.5-2.4 2-3.7 3.7-3.7s3.2 1.3 3.7 3.7" style={A} />
    <circle cx="7.5" cy="11" r="7" />
    <path d="M14 13.5l7.5 7.5M18 17.5l2-2M16 15.5l1.5-1.5" />
  </Svg>
);

// A page of lines with a magnifier over one of them.
export const IconAudit = (p) => (
  <Svg {...p}>
    <path d="M14 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9l4 4v4" />
    <path d="M7.5 8h6M7.5 11.5h3M7.5 15h2.5" />
    <circle cx="16.5" cy="16" r="3" style={A} />
    <path d="M18.7 18.2L21 20.5" style={A} />
  </Svg>
);

// Three people, the front one holding a small shield: delegated admin roles.
export const IconRoles = (p) => (
  <Svg {...p}>
    <circle cx="6" cy="7" r="2" />
    <path d="M2.5 14c.4-2 1.8-3.2 3.5-3.2" />
    <circle cx="18" cy="7" r="2" />
    <path d="M21.5 14c-.4-2-1.8-3.2-3.5-3.2" />
    <circle cx="12" cy="8.5" r="2.5" />
    <path d="M7.5 19c.5-3 2.3-4.8 4.5-4.8" />
    <path d="M15 14.5l2.5-.9 2.5.9v2c0 1.7-1.1 2.9-2.5 3.4-1.4-.5-2.5-1.7-2.5-3.4z" style={A} />
  </Svg>
);

// A key with a coin threaded on its ring: budgets on virtual keys.
export const IconBudget = (p) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="4.5" />
    <path d="M11.2 11.2L20 20M16.5 16.5l2-2M14.5 14.5l1.5-1.5" />
    <circle cx="16.5" cy="6.5" r="3.5" style={A} />
    <path d="M16.5 5v3" style={A} />
  </Svg>
);

// A vault door with a circular arrow on its dial: secrets that rotate.
export const IconSecrets = (p) => (
  <Svg {...p}>
    <rect x="3" y="3.5" width="18" height="16" rx="2" />
    <path d="M6 19.5v1.5M18 19.5v1.5" />
    <path d="M14.8 9.2a4 4 0 1 0 1.2 2.8" style={A} />
    <path d="M16.4 8.2l-1.6 1-1-1.6" style={A} />
    <circle cx="12" cy="11.5" r="1" style={AF} />
  </Svg>
);

// A globe with three points joined by one line: many regions, one license.
export const IconRegions = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3" strokeWidth="1.2" />
    <path d="M6.5 8.5L12 15.5l5.5-7" style={A} />
    <circle cx="6.5" cy="8.5" r="1.3" style={AF} />
    <circle cx="12" cy="15.5" r="1.3" style={AF} />
    <circle cx="17.5" cy="8.5" r="1.3" style={AF} />
  </Svg>
);

// A headset with a small clock at the mic: support with response times.
export const IconSupport = (p) => (
  <Svg {...p}>
    <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
    <rect x="3" y="13" width="3.5" height="5.5" rx="1.5" />
    <rect x="17.5" y="13" width="3.5" height="5.5" rx="1.5" />
    <path d="M19.2 18.5c0 1.5-1.3 2.5-3.2 2.5h-1" />
    <circle cx="12" cy="11.5" r="3" style={A} />
    <path d="M12 10v1.6l1 .7" style={A} />
  </Svg>
);

// A speech bubble behind a short fence: guardrails on prompts and replies.
export const IconGuardrails = (p) => (
  <Svg {...p}>
    <path d="M4 4h16a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-9l-4 3v-3H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
    <path d="M3 19.5h18M6 16.5v5M10 16.5v5M14 16.5v5M18 16.5v5" style={A} />
  </Svg>
);

// A plug meeting a wrench at one socket: tools over MCP.
export const IconMcp = (p) => (
  <Svg {...p}>
    <path d="M9 3v4M15 3v4M6.5 7h11v3a5.5 5.5 0 0 1-11 0z" />
    <path d="M12 15.5V18" />
    <path d="M12 18a3 3 0 1 0 3 3" style={A} />
  </Svg>
);

// A spend chart with a ceiling line: cost tracking and limits.
export const IconSpend = (p) => (
  <Svg {...p}>
    <path d="M3 20h18M3 20V4" />
    <path d="M3 7h18" style={A} strokeDasharray="2 2.5" />
    <path d="M6 17l4-4 3 2 5-6" />
  </Svg>
);

// A terminal prompt with a sparkle: hand the setup to a coding agent.
export const IconAgent = (p) => (
  <Svg {...p}>
    <rect x="2.5" y="4" width="19" height="16" rx="2" />
    <path d="M6 10l3 2.5L6 15M11 15h3" />
    <path d="M17.5 6.8v3.4M15.8 8.5h3.4" style={A} strokeWidth="1.4" />
  </Svg>
);

// A document with a down-arrow: markdown for machines.
export const IconMarkdown = (p) => (
  <Svg {...p}>
    <rect x="2.5" y="5" width="19" height="14" rx="2" />
    <path d="M6 15V9l2.5 3L11 9v6" />
    <path d="M16.5 9v6M14.5 13l2 2 2-2" style={A} />
  </Svg>
);

// Text lines arriving one after another, the newest still being written.
export const IconStream = (p) => (
  <Svg {...p}>
    <path d="M4 6h16M4 10.5h12M4 15h8" />
    <path d="M15 15h1.5M19 15h1" style={A} />
    <path d="M4 19.5h5" style={A} />
  </Svg>
);

// A wrench over a function call's parentheses: tools the model can call.
export const IconTools = (p) => (
  <Svg {...p}>
    <path d="M7 4c-2 2-2 14 0 16M17 4c2 2 2 14 0 16" />
    <path d="M14.5 8.5a2.5 2.5 0 0 0-3.3 3.1L8.8 14a1 1 0 0 0 1.4 1.4l2.4-2.4a2.5 2.5 0 0 0 3.1-3.3l-1.4 1.4-1.4-1.4z" style={A} />
  </Svg>
);

// One request splitting into two routes, one of them the fallback.
export const IconRoute = (p) => (
  <Svg {...p}>
    <circle cx="5" cy="12" r="2" />
    <path d="M7 12h4c2 0 3-5 6-5h2M11 12c2 0 3 5 6 5h2" />
    <circle cx="19.5" cy="7" r="1.5" />
    <circle cx="19.5" cy="17" r="1.5" style={A} />
  </Svg>
);

// A key with a small tag: a virtual key with its own settings.
export const IconKey = (p) => (
  <Svg {...p}>
    <circle cx="7.5" cy="12" r="4" />
    <path d="M11.5 12H21M18 12v3M15 12v2" />
    <circle cx="7.5" cy="12" r="1.3" style={AF} />
  </Svg>
);

// A log with one highlighted line: request logs and spend data.
export const IconLogs = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
    <path d="M7 8h10M7 16h7" />
    <path d="M7 12h10" style={A} strokeWidth="2" />
  </Svg>
);

// Several provider tiles, one of them chosen.
export const IconProviders = (p) => (
  <Svg {...p}>
    <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" style={A} />
  </Svg>
);

// A graduation cap: the guided course.
export const IconCourse = (p) => (
  <Svg {...p}>
    <path d="M2.5 9L12 4.5 21.5 9 12 13.5z" />
    <path d="M6.5 11v4.5c1.5 1.5 3.4 2.2 5.5 2.2s4-.7 5.5-2.2V11" />
    <path d="M21.5 9v5.5" style={A} />
  </Svg>
);

// An open book: reference guides.
export const IconGuides = (p) => (
  <Svg {...p}>
    <path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z" />
    <path d="M12 6.5v13" style={A} />
  </Svg>
);

// Numbered steps down a page: tutorials.
export const IconSteps = (p) => (
  <Svg {...p}>
    <path d="M10 6h10M10 12h10M10 18h7" />
    <circle cx="5" cy="6" r="1.6" style={AF} />
    <circle cx="5" cy="12" r="1.6" />
    <circle cx="5" cy="18" r="1.6" />
  </Svg>
);

export const IconCopy = (p) => (
  <Svg size={16} {...p}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
  </Svg>
);

export const IconCheck = (p) => (
  <Svg size={16} strokeWidth="2.2" {...p}>
    <path d="M20 6L9 17l-5-5" />
  </Svg>
);

export const IconChevron = (p) => (
  <Svg size={16} strokeWidth="2" {...p}>
    <path d="M6 9l6 6 6-6" />
  </Svg>
);

export const IconExternal = (p) => (
  <Svg size={14} strokeWidth="2" {...p}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </Svg>
);

export const ICONS = {
  sdk: IconSdk,
  gateway: IconGateway,
  enterprise: IconEnterprise,
  sso: IconSso,
  audit: IconAudit,
  roles: IconRoles,
  budget: IconBudget,
  secrets: IconSecrets,
  regions: IconRegions,
  support: IconSupport,
  guardrails: IconGuardrails,
  mcp: IconMcp,
  spend: IconSpend,
  agent: IconAgent,
  markdown: IconMarkdown,
  stream: IconStream,
  tools: IconTools,
  route: IconRoute,
  key: IconKey,
  logs: IconLogs,
  providers: IconProviders,
  course: IconCourse,
  guides: IconGuides,
  steps: IconSteps,
};
