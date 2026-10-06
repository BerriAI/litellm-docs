"""Top-level architecture artwork. Explanations belong in the surrounding article."""
from drawing import *

def simple(x,y,w,h,title,body=(),color=BLUE,bg='white'):
 return rect(x,y,w,h,bg,EDGE,15,True)+txt(x+22,y+53,title,24,INK,500)+lines(x+22,y+88,body,18,MUTED,26)

def tiny_trace(x,y,w,color=BLUE):
 s=rect(x,y,w,35,'#fff',EDGE,6)
 s+=path(f'M{x+13} {y+10} V{y+24} H{x+30}',color,1.5)
 s+=dot(x+13,y+10,color,2)+dot(x+30,y+24,color,2)
 s+=path(f'M{x+23} {y+10} H{x+w-15} M{x+39} {y+24} H{x+w-24}',color,2.3)
 return s

manifest=[]
# 1. One left-to-right path, with parallelism named only where it matters.
b=''
positions=[(56,218),(326,242),(620,206),(878,242),(1172,212)]
for (x,w),(nx,nw) in zip(positions,positions[1:]):b+=arrow(x+w,235,nx-10,235)
b+=simple(56,108,218,259,'Traces',[],BLUE)
for j in range(3):b+=tiny_trace(78+j*4,199+j*42,162-j*4,[BLUE,TEAL,PURPLE][j])
b+=simple(326,108,242,259,'Review',['One per execution'],BLUE)
for j in range(3):b+=rect(348,218+j*37,198,27,PALE,'none',6)+txt(447,237+j*37,f'Reviewer {chr(65+j)}',14,BLUE,550,'middle')
b+=simple(620,108,206,259,'Group',['Similar observations'],PURPLE)
for g,(color,bg) in enumerate([(BLUE,PALE),(TEAL,GREEN),(PURPLE,LAV)]):
 for j in range(3):b+=rect(644+g*53+j*3,232+j*25,41,18,bg,color,4)
b+=simple(878,108,242,259,'Investigate',['Check original traces'],TEAL)
for j in range(3):b+=rect(900,218+j*37,198,27,GREEN,'none',6)+txt(999,237+j*37,f'Pattern {chr(65+j)}',14,TEAL,550,'middle')
b+=simple(1172,108,212,259,'Findings',['With source evidence'],BLUE)
for j in range(3):
 b+=rect(1194,214+j*38,168,30,TOKENS['surface-3'],EDGE,6)+check(1209,229+j*38,[BLUE,TEAL,PURPLE][j])+path(f'M1227 {223+j*38} H1345 M1227 {234+j*38} H1320',TOKENS['line-2'],2)
b+=pill(372,56,150,'In parallel',MUTED,TOKENS['surface-3'])+pill(623,56,200,'Parallel batches',MUTED,TOKENS['surface-3'])+pill(924,56,150,'In parallel',MUTED,TOKENS['surface-3'])
b+=txt(723,405,'Reconcile across batches',15,MUTED,450,'middle')
manifest.append(render('01-pipeline','Lens investigation pipeline','Agent traces are reviewed in parallel, similar observations are grouped in parallel batches and reconciled, candidate patterns are investigated against original traces in parallel, and findings retain source evidence.',b,450))

# 2. Three executions, three reviewers, three concrete observations.
b=txt(56,61,'Executions',21,INK,580)+txt(524,61,'Reviewers',21,INK,580)+pill(693,38,144,'In parallel')+txt(996,61,'Observations',21,INK,580)
examples=[['Page text ends at 8,000 characters'],['grep fails, then the terminal succeeds'],['The agent declines to read a PDF']]
for j,y in enumerate([100,237,374]):
 color=[BLUE,TEAL,PURPLE][j];bg=[PALE,GREEN,LAV][j]
 b+=rect(56,y,350,99,'white',EDGE,14,True)+txt(81,y+38,f'Execution {chr(65+j)}',23,INK,580)+txt(81,y+71,'Model calls · tools · subagents',17,MUTED)
 b+=arrow(406,y+50,514,y+50)
 b+=rect(524,y,350,99,bg,'none',14)+txt(550,y+38,f'Review {chr(65+j)}',23,INK,580)+txt(550,y+71,'Read · search · Python',17,color)
 b+=arrow(874,y+50,986,y+50)
 b+=rect(996,y,388,99,'white',EDGE,14,True)+txt(1018,y+38,examples[j][0],18,INK,550)+txt(1018,y+71,'+ source quote',16,MUTED,400)
b+=txt(1384,518,'Illustrative observations',12,MUTED,450,'end')
manifest.append(render('02-parallel-review','Parallel trace review','One reviewer per execution opens trace data using tools and returns observations with source quotes. Three illustrative examples show truncated page content, grep recovery through the terminal, and an unread PDF. Recorded subagents remain part of the trace evidence.',b,550))

# 3. Fan-in, without registry or batching implementation details.
b=txt(56,59,'Observation batches',21,INK,580)+pill(435,36,160,'In parallel',PURPLE,LAV)
for j,y in enumerate([97,241,385]):
 b+=rect(56,y,252,104,'white',EDGE,14,True)+txt(80,y+37,f'Batch {chr(65+j)}',23,INK,580)
 for k,(s,col,bg) in enumerate([('page',BLUE,PALE),('grep',TEAL,GREEN),('PDF',PURPLE,LAV)]):b+=pill(80+k*69,y+57,59,s,col,bg)
 b+=arrow(308,y+52,390,y+52)
 b+=rect(402,y,250,104,LAV,'none',14)+txt(426,y+39,f'Group batch {chr(65+j)}',23,INK,580)+txt(426,y+74,'Candidate patterns',17,PURPLE)
 b+=path(f'M652 {y+52} H721 Q739 {y+52} 739 {y+52+(16 if j==0 else -16 if j==2 else 0)} V277 Q739 293 755 293 H784',TOKENS['line-2'],1.6,True)
b+=simple(796,205,289,176,'Merge matches',['Across batches'],PURPLE)
b+=arrow(1085,293,1156,293)
b+=rect(1168,154,216,282,'white',EDGE,16,True)+txt(1190,195,'Patterns',25,INK,590)
for j,(s,col,bg) in enumerate([('Page truncation',BLUE,PALE),('grep failures',TEAL,GREEN),('Unread PDFs',PURPLE,LAV)]):b+=rect(1190,223+j*62,172,43,bg,'none',8)+txt(1276,250+j*62,s,16,col,550,'middle')
manifest.append(render('03-group-patterns','Group observations and merge matching patterns','Observation batches are grouped concurrently. Matching candidate patterns are merged across batches while different causes stay separate.',b,545))

# 4. Tools point back to the original evidence. Invalid citations have a short repair loop.
b=simple(56,78,300,171,'Candidate pattern',['Issue + evidence leads'],PURPLE)
b+=arrow(356,163,489,163)
b+=simple(500,78,350,171,'Investigator',['One agent per candidate'],TEAL)
b+=arrow(850,163,1090,163)+txt(973,138,'Validate citations',16,MUTED,500,'middle')
b+=simple(1102,78,282,171,'Finding',['Issue + explanation','+ source evidence'],BLUE)
b+=rect(500,366,350,106,GREEN,'none',14)+txt(675,407,'Original traces',23,INK,580,'middle')+txt(675,439,'+ initial review records',17,TEAL,450,'middle')
b+=arrow(675,366,675,259)+pill(594,296,162,'Read on demand',TEAL,GREEN)
b+=path('M975 164 V283 Q975 301 957 301 H819 Q802 301 802 284 V259',AMBER,1.6,True)
b+=pill(844,286,205,'Citation repair',AMBER,TOKENS['surface-3'])
manifest.append(render('04-investigate','Investigate candidate patterns','Each candidate has an investigator with access to original traces and review records. Finding citations are validated. Invalid output returns specific feedback so the agent can retry. An unsupported candidate may yield no finding.',b,530))

# 5. A single outward request path and a single return path.
b=simple(56,167,300,175,'Agent',['Instructions','+ selected evidence'],BLUE)
b+=arrow(356,251,489,251)
b+=rect(500,54,388,421,'white',EDGE,16,True)
tool_rows=[('Catalog','Locate traces and spans',BLUE,PALE),('Read','Open source text',TEAL,GREEN),('Search','Find relevant spans',TEAL,GREEN),('Python','Compute in a confined process',PURPLE,LAV)]
for j,(title,body,col,bg) in enumerate(tool_rows):
 y=76+j*97;b+=rect(522,y,344,79,bg,'none',10)+txt(541,y+30,title,22,col,590)+txt(541,y+58,body,16,MUTED)
b+=arrow(888,251,1051,251)
b+=simple(1064,167,320,175,'Trace workspace',['Spans · tools · subagents'],BLUE)
b+=path('M1224 342 V514 Q1224 534 1204 534 H225 Q206 534 206 514 V352',TOKENS['line-2'],1.8,True)
b+=pill(502,519,387,'Selected text or Python output')
manifest.append(render('05-evidence-workspace','On-demand access to trace evidence','The agent uses catalog, read, search and confined Python tools to inspect trace data. Only requested source text and computed output enter its context. Python receives selected evidence in data and runs within enforced runtime boundaries. Long investigations can compact conversation while retaining access to evidence and archived history.',b,590))

# 6. Deployment: five components and their connections.
b=simple(56,201,288,134,'Your agent',['Calls + traces'],BLUE)
b+=arrow(344,268,475,268)
b+=simple(486,187,410,160,'LiteLLM',['Gateway + Lens UI'],BLUE)
b+=simple(1082,70,302,130,'ClickHouse',['Trace storage'],TEAL)
b+=simple(1082,290,302,130,'Postgres',['Investigation state'],PURPLE)
b+=path('M896 237 H977 Q994 237 994 220 V152 Q994 135 1011 135 H1070',TOKENS['line-2'],1.8,True)
b+=path('M896 296 H977 Q994 296 994 313 V338 Q994 355 1011 355 H1070',TOKENS['line-2'],1.8,True)
b+=simple(486,469,410,133,'Lens worker',['Runs investigations'],TEAL)
b+=arrow(660,469,660,357)+arrow(725,347,725,459)+pill(624,393,137,'HTTPS')
manifest.append(render('06-deployment','Lens worker deployment','The agent sends calls and traces to LiteLLM. LiteLLM accesses ClickHouse for traces and Postgres for investigation state. The Lens worker uses the gateway over HTTPS for jobs, evidence and model calls, and reports progress and findings. It does not connect directly to databases or providers.',b,650))

(OUT/'manifest.json').write_text(json.dumps({'diagrams':manifest},indent=2))
print(f'Generated {len(manifest)} minimal diagrams.')
