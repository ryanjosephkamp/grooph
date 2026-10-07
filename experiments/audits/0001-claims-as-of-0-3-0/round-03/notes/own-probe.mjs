// Static comparison/export/MCP probes only. The caller supplies a NEW EMPTY scratch.
import {mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync, existsSync, symlinkSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=resolve(process.argv[2]), scratch=resolve(process.argv[3]);
assert.equal(readdirSync(scratch).length,0); rmSync(scratch,{recursive:true}); mkdirSync(scratch);
const core=await import(join(root,'packages/core/dist/src/index.js'));
const {handle}=await import(join(root,'packages/cli/dist/src/mcp.js'));
const cli=join(root,'packages/cli/bin/grooph.js');
const cap=(n,then)=>({kind:'max-iterations',n,...(then?{then}:{})});
const budget=(limit,then,measure='dispatches')=>({kind:'budget',measure,limit,...(then?{then}:{})});
const human=(every,then)=>({kind:'human',every,...(then?{then}:{})});
const agent=(id,role='builder')=>({id,kind:'agent',name:id,role,brief:'Do the next item.',outputs:[id+'.md'],allow:['read-files','write-outputs']});
const g=stops=>({grooph:0,id:'own',name:'Own static probe',version:1,goal:'Work through a list.',target:{harness:'claude-code'},nodes:[agent('worker'),agent('sorter','planner'),{id:'done',kind:'stop',name:'Done',outcome:'success'},{id:'halted',kind:'stop',name:'Halted',outcome:'halt'},{id:'gate',kind:'human-gate',name:'Go?',prompt:'Go?',options:['yes','no']}],edges:[{id:'ws',from:'worker',to:'sorter'},{id:'sw',from:'sorter',to:'worker',when:{verdict:'more'}},{id:'sd',from:'sorter',to:'done',when:{verdict:'finished'}},{id:'sh',from:'sorter',to:'halted',when:{verdict:'stuck'}},{id:'sg',from:'sorter',to:'gate',when:{verdict:'ask'}},{id:'gd',from:'gate',to:'done',when:'pass'},{id:'gh',from:'gate',to:'halted',when:'fail'}],loops:[{id:'list',name:'List',members:['worker','sorter'],back:['sw'],mode:'grind',stops}]});
const errors=d=>core.validate(d,{forExport:true}).filter(x=>x.severity==='error').map(x=>x.code);
const call=(project,name,args)=>handle({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}},{project,version:'0.4.0',harness:'claude-code',session:'static-audit',env:{},now:()=>new Date('2026-10-06T00:00:00Z')}).then(x=>x.result);
const textOf=r=>r.content.filter(x=>x.type==='text').map(x=>x.text).join('\n');
let number=0;
const cliExport=(dir,doc,flags=[])=>{const file=join(dir,'incoming.json');writeFileSync(file,core.canonicalize(doc));return spawnSync(process.execPath,[cli,'export',file,'--target','claude-code','--into',join(dir,'project'),...flags],{cwd:dir,env:{...process.env,GROOPH_MODELS:''},encoding:'utf8'});};
const last=p=>(p.stdout+p.stderr).trimEnd().split('\n').at(-1);
function tree(dir){if(!existsSync(dir))return{};const out={};for(const f of readdirSync(dir,{withFileTypes:true})){const full=join(dir,f.name);if(f.isDirectory())for(const [p,c]of Object.entries(tree(full)))out[f.name+'/'+p]=c;else if(f.isFile())out[f.name]=readFileSync(full).toString('base64');}return out;}
async function pair(label,a,b,held){
  assert.deepEqual(errors(a),[],label+' source');assert.deepEqual(errors(b),[],label+' copy');
  const adopted=core.adoptWorkingCopy(a,b,{run:'r1'});assert.equal(adopted.ok,true);
  const check=core.checkAdoption(a,adopted.doc); if(held!==undefined)assert.equal(check.refused.length>0,held,label);
  const dir=join(scratch,String(++number));mkdirSync(dir);mkdirSync(join(dir,'project'));
  assert.equal(cliExport(dir,a).status,0);const before=tree(join(dir,'project'));
  const p=cliExport(dir,b);assert.equal(p.status,check.refused.length?1:0,label+' CLI');if(p.status)assert.deepEqual(tree(join(dir,'project')),before,label+' no write');
  const mp=join(dir,'mcp');mkdirSync(mp);let r=await call(mp,'grooph_export',{graph:a,into:'.'});assert.equal(r.isError,undefined,textOf(r));const kept=tree(mp);
  r=await call(mp,'grooph_export',{graph:b,into:'.'});assert.equal(r.isError===true,check.refused.length>0,label+' MCP');if(r.isError)assert.deepEqual(tree(mp),kept,label+' MCP no write');
  console.log(JSON.stringify({label,core:check.refused.map(c=>({name:c.name,reason:c.loosens})),labels:check.changes.map(c=>({name:c.name,tightens:c.tightens,unjudged:c.unjudged})),cli:p.status,cliLast:last(p),mcpError:r.isError===true,mcpLines:textOf(r).split('\n').filter(l=>/brakes:|loosens/.test(l))}));
}
await pair('three stops: move a leading equal budget ahead of two halts',g([cap(2),budget(2),budget(2,'done')]),g([budget(2,'done'),cap(2),budget(2)]),true);
await pair('kind and measure changed in place',g([budget(8)]),g([budget(8,'done','minutes')]),true);
await pair('then changed from halt to success',g([cap(2,'halted')]),g([cap(2,'done')]),true);
await pair('then goes inside loop',g([cap(2)]),g([cap(2,'worker')]),true);
await pair('human cannot launder later leading cap',g([budget(9)]),g([cap(2,'done'),budget(9),human(1)]),true);
await pair('divisor asking 4 to 2',g([human(4),cap(6,'done')]),g([human(2),cap(6,'done')]),false);
await pair('non-divisor asking 3 to 2',g([human(3),cap(8,'done')]),g([human(2),cap(8,'done')]),true);
await pair('new human every 100 ahead of cap 1',g([cap(1)]),g([human(100,'done'),cap(1)]),false);
await pair('new human every 100 can displace cap on pass 100',g([cap(100)]),g([human(100,'done'),cap(100)]),false);
await pair('new leading stop then gate gets not judged',g([cap(2)]),g([budget(1,'gate'),cap(2)]),false);
await pair('lower halt via then retains tightening label',g([cap(3,'halted')]),g([cap(2,'halted')]),false);
const road=g([cap(2)]), bypass=structuredClone(road);bypass.edges.push({id:'wd',from:'worker',to:'done',when:{verdict:'skip'}});
await pair('documented road straight to end',road,bypass,false);
await pair('documented removal of halting diminishing returns',g([{kind:'diminishing-returns',rounds:2},cap(4)]),g([cap(4)]),false);
const judged=g([cap(2),{kind:'bar-passed'}]);judged.nodes[1].role='critic';judged.edges.find(e=>e.id==='ws').evidence=['diff'];judged.edges.find(e=>e.id==='sw').when='fail';judged.edges.find(e=>e.id==='sd').when='pass';judged.loops[0].mode='judgment';judged.loops[0].bar={name:'Review',inspects:[{kind:'file',ref:'CHECK.md'}],acceptance:'Every item holds.'};
const barFirst=structuredClone(judged);barFirst.loops[0].stops.reverse();await pair('documented retained critic bar ahead of halt',judged,barFirst,false);
const tpl=JSON.parse(readFileSync(join(root,'patterns/debate-then-build.grooph.json')));let tx=JSON.stringify({...tpl,template:undefined});for(const s of tpl.template.slots)tx=tx.split('{{'+s.key+'}}').join(String(s.example).replaceAll('\\','\\\\').replaceAll('"','\\"'));const debate=JSON.parse(tx), swap=structuredClone(debate);[swap.loops[0].stops[1],swap.loops[0].stops[2]]=[swap.loops[0].stops[2],swap.loops[0].stops[1]];await pair('debate cap and budget swapped only tightens',debate,swap,false);
// Export baseline controls. Each starts with a pristine package in a separate directory.
for(const mode of ['unchanged','cap-raised','allow','allow-unknown','no-kept','malformed','mismatch-id','stale-graph','stale-lead','stale-mapping','missing-agent','edited-agent','new-id','link']){
  const dir=join(scratch,'baseline-'+mode);mkdirSync(dir);mkdirSync(join(dir,'project'));const a=g([cap(2)]),b=g([cap(20)]);assert.equal(cliExport(dir,a).status,0);
  const base=join(dir,'project','.grooph','own'),path=join(base,'graph.grooph.json');let flags=[],incoming=b;
  if(mode==='unchanged')incoming=a;
  if(mode==='allow')flags=['--allow','loop:list.stops'];if(mode==='allow-unknown')flags=['--allow','node:no-such'];
  if(mode==='no-kept')rmSync(path);if(mode==='malformed')writeFileSync(path,'{broken');if(mode==='mismatch-id')writeFileSync(path,core.canonicalize({...a,id:'other'}));
  if(mode==='stale-graph')writeFileSync(path,core.canonicalize(b));if(mode==='stale-lead')writeFileSync(join(base,'LEAD.md'),'changed');if(mode==='stale-mapping')writeFileSync(join(base,'MAPPING.md'),'changed');
  const agentPath=join(dir,'project','.claude','agents','own--worker.md');if(mode==='missing-agent')rmSync(agentPath);if(mode==='edited-agent')writeFileSync(agentPath,readFileSync(agentPath,'utf8')+'\nHand edit.\n');
  if(mode==='new-id')incoming={...b,id:'new-own'};
  if(mode==='link'){rmSync(path);const target=join(dir,'other-graph.json');writeFileSync(target,core.canonicalize(a));symlinkSync(target,path);}
  const before=tree(join(dir,'project')),p=cliExport(dir,incoming,flags);if(p.status)assert.deepEqual(tree(join(dir,'project')),before,mode+' no write');
  console.log(JSON.stringify({baseline:mode,exit:p.status,last:last(p),lines:(p.stdout+p.stderr).split('\n').filter(l=>/brakes:|not compared|loosen|link|no change named/.test(l))}));
  if(['no-kept','malformed','mismatch-id','stale-graph','stale-lead','stale-mapping'].includes(mode)){
    const q=cliExport(dir,incoming,['--uncompared',...(mode==='stale-lead'||mode==='stale-mapping'?['--allow','loop:list.stops']:[])]);
    console.log(JSON.stringify({baseline:mode+' explicitly uncompared',exit:q.status,last:last(q)}));assert.equal(q.status,0);
  }
}
// MCP replacement is not a brake override; exercise stale-baseline reply and deliberate text recording.
const mp=join(scratch,'mcp-special');mkdirSync(mp);let r=await call(mp,'grooph_export',{graph:g([cap(2)]),into:'.'});assert.equal(r.isError,undefined);
r=await call(mp,'grooph_export',{graph:g([cap(20)]),into:'.',replace:true});assert.equal(r.isError,true);console.log('MCP replace without allow:',textOf(r));
r=await call(mp,'grooph_export',{graph:g([cap(20)]),into:'.',allow:['loop:list.stops']});assert.equal(r.isError,undefined);console.log('MCP allow:',textOf(r).split('\n').filter(l=>/brakes:|loosens/.test(l)).join('\n'));
writeFileSync(join(mp,'.grooph/own/graph.grooph.json'),core.canonicalize(g([cap(200)])));
r=await call(mp,'grooph_export',{graph:g([cap(200)]),into:'.'});assert.equal(r.isError,true);console.log('MCP stale no replace:',textOf(r));
r=await call(mp,'grooph_export',{graph:g([cap(200)]),into:'.',replace:true});assert.equal(r.isError,undefined);assert.match(textOf(r),/brakes: not compared/);console.log('MCP stale replace:',textOf(r).split('\n').filter(l=>/brakes:/.test(l)).join('\n'));
r=await call(mp,'grooph_note',{text:'Static audit note; no session started.'});assert.equal(r.isError,undefined);console.log('MCP note without filename:',existsSync(join(mp,'.grooph/events/said-static-audit.jsonl')));
r=await handle({jsonrpc:'2.0',id:2,method:'tools/list'},{project:mp,version:'0.4.0',harness:'claude-code',session:'static-audit',env:{},now:()=>new Date('2026-10-06T00:00:00Z')});console.log('MCP tool count:',r.result.tools.length);
