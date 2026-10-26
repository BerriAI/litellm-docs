import httpx,json,sys
from pathlib import Path
import litellm
port=int(sys.argv[1]); kind=sys.argv[2] if len(sys.argv)>2 else 'oauth'
headers={'x-litellm-api-key':'sk-local-pr41522-regression-only-gateway-key-00000000'}
if kind=='oauth':headers['Authorization']='Bearer sk-ant-oat-fake-limited'
else:headers['x-api-key']='fake-limited'
with httpx.Client(timeout=60) as c:
 for i in range(2):
  r=c.post(f'http://127.0.0.1:{port}/v1/messages',headers=headers,json={'model':'claude-sonnet-5-5','messages':[{'role':'user','content':'hello'}],'max_tokens':litellm.get_max_tokens('anthropic/claude-sonnet-5-5')})
  print(json.dumps({'caller':'limited-fixture','request':i+1,'status':r.status_code}),flush=True)
  print(c.get(f'http://127.0.0.1:{port}/qa/state').json(),flush=True)
