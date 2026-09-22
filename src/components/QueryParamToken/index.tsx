import React, {useState, useEffect, type ReactNode} from 'react';

export default function QueryParamToken(): ReactNode {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    setToken(token);
  }, []);

  return (
    <span style={{ padding: 0, margin: 0 }}>
      {token ? <a href={`https://admin.litellm.ai/${token}`} target="_blank" rel="noopener noreferrer">admin.litellm.ai</a> : ""}
    </span>
  );
}
