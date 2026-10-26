import asyncio,logging,os,json,subprocess,sys
from pathlib import Path
import httpx,uvicorn,redis
logging.disable(logging.CRITICAL)
import litellm
litellm.disable_aiohttp_transport=True
from litellm.proxy import proxy_server
from litellm.litellm_core_utils.logging_worker import GLOBAL_LOGGING_WORKER
port=int(sys.argv[1]); label=sys.argv[2]
secret=json.loads(subprocess.check_output(['security','find-generic-password','-s','Claude Code-credentials','-w'],text=True))
token=secret['claudeAiOauth']['accessToken']
original=httpx.AsyncClient.send
async def observe(self,request,*args,**kwargs):
    if request.url.host != 'api.anthropic.com':return await original(self,request,*args,**kwargs)
    auth=request.headers.get('authorization','')
    limited=auth=='Bearer sk-ant-oat-fake-limited' or request.headers.get('x-api-key')=='fake-limited'
    record={'worker':label,'limited_fixture':limited,'real_oauth_matches':auth=='Bearer '+token,'gateway_key_absent':'x-litellm-api-key' not in request.headers,'api_key_absent':'x-api-key' not in request.headers,'route':request.url.path}
    if limited:
        response=httpx.Response(429,headers={'retry-after':'168307'},request=request,json={'type':'error','error':{'type':'rate_limit_error','message':'Controlled exhausted subscription fixture'}})
    elif auth=='Bearer '+token:
        response=await original(self,request,*args,**kwargs)
    elif request.headers.get('x-api-key')=='fake-gateway-key':
        response=httpx.Response(200,request=request,json={'id':'msg_fixture','type':'message','role':'assistant','model':'claude-sonnet-5-5','content':[{'type':'text','text':'gateway fixture'}],'stop_reason':'end_turn','usage':{'input_tokens':2,'output_tokens':2}})
    else:
        raise RuntimeError('Unexpected QA credential blocked before upstream')
    record['status']=response.status_code
    with open('/tmp/anthropic-cooldown-qa/outbound.jsonl','a') as f:f.write(json.dumps(record)+'\n')
    return response
httpx.AsyncClient.send=observe
asyncio.run(proxy_server.initialize(config='/tmp/anthropic-cooldown-qa/config.yaml'))
@proxy_server.app.get('/qa/state')
async def state():
    await GLOBAL_LOGGING_WORKER.flush()
    active=await proxy_server.llm_router.cooldown_cache.async_get_active_cooldowns(model_ids=['shared-anthropic'],parent_otel_span=None)
    r=redis.Redis(host='127.0.0.1',port=14141)
    return {'worker':label,'shared_cooled':bool(active),'redis_cooldown_entries':sum(1 for _ in r.scan_iter(match='*cooldown*')), 'redis_configured': proxy_server.llm_router.cache.redis_cache is not None, 'allowed_fails':str(proxy_server.llm_router.allowed_fails_policy), 'models':[(m['model_name'],m['model_info'].get('id')) for m in proxy_server.llm_router.model_list], 'failure_callbacks':[getattr(c,'__name__',type(c).__name__) for c in litellm.failure_callback]}
uvicorn.run(proxy_server.app,host='127.0.0.1',port=port,log_level='critical',access_log=False)
