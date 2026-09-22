import React, {useState, useEffect, type ReactNode} from 'react';

function CodeBlock({ token }: {token: string | null}) {
  const codeWithToken = `
import os
from litellm import completion

# set ENV variables 
os.environ["LITELLM_TOKEN"] = '${token}'

messages = [{ "content": "Hello, how are you?","role": "user"}]

# openai call
response = completion(model="gpt-3.5-turbo", messages=messages)

# cohere call
response = completion("command-nightly", messages)
`;

  const codeWithoutToken = `
from litellm import completion

## set ENV variables
os.environ["OPENAI_API_KEY"] = "openai key"
os.environ["COHERE_API_KEY"] = "cohere key"


messages = [{ "content": "Hello, how are you?","role": "user"}]

# openai call
response = completion(model="gpt-3.5-turbo", messages=messages)

# cohere call
response = completion("command-nightly", messages)
`;
  return (
    <pre>
      {token ? codeWithToken : codeWithoutToken}
    </pre>
  )
}

export default function QueryParamReader(): ReactNode {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    setToken(token);
  }, []);

  return (
    <div>
      <CodeBlock token={token} />
    </div>
  );
}
