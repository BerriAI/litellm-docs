import type {ReactNode} from 'react';
import Admonition from '@theme/Admonition';
import Link from '@docusaurus/Link';

const TRIAL_URL = 'https://www.litellm.ai/enterprise#trial';
const DEMO_URL = 'https://enterprise.litellm.ai/demo';

// A one-line note written inline (<EnterpriseFeature>text</EnterpriseFeature>)
// arrives as a plain string; block content separated by blank lines arrives
// already wrapped in <p> elements by MDX.
function Note({children}: {children?: ReactNode}) {
  if (children == null) return null;
  if (typeof children === 'string') return <p>{children}</p>;
  return <>{children}</>;
}

type Props = {
  /** Feature name used in the sentence, e.g. "SSO". */
  feature?: string;
  /** The feature ships in the open source image without a license. */
  free?: boolean;
  children?: ReactNode;
};

export default function EnterpriseFeature({
  feature,
  free = false,
  children,
}: Props): ReactNode {
  if (free) {
    return (
      <Admonition type="info" title="Free Enterprise feature">
        <p>
          Available with the <code>litellm[proxy]</code> package or any{' '}
          <code>litellm</code> docker image. No Enterprise license is required.
        </p>
        <Note>{children}</Note>
      </Admonition>
    );
  }

  return (
    <Admonition type="info" title="Enterprise feature">
      <p>
        {feature ? `${feature} requires` : 'This feature requires'} a LiteLLM
        Enterprise license. Start a <a href={TRIAL_URL}>free 30-day trial</a> or{' '}
        <a href={DEMO_URL}>book a demo</a>.{' '}
        <Link to="/docs/enterprise">See what Enterprise includes</Link>.
      </p>
      <Note>{children}</Note>
    </Admonition>
  );
}
