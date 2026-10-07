// Static probes only; no harness or model is started. Scratch must be new and empty.
import {readdirSync, rmSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=resolve(process.argv[2]), scratch=resolve(process.argv[3]);
assert.equal(readdirSync(scratch).length,0);rmSync(scratch,{recursive:true});mkdirSync(scratch);
const core=await import(join(root,'packages/core/dist/src/index.js'));
const {handle}=await import(join(root,'packages/cli/dist/src/mcp.js'));
const old=JSON.parse(readFileSync(process.argv[4]));
old.loops[0].stops=[{kind:'max-iterations',n:2}];
const compile=doc=>{const x=core.tryCompile(doc,'claude-code');assert.equal(x.ok,true);return x.result.files;};
const a=compile(old), b=core.tryCompile(old,'claude-code',{models:{strong:'audit-model'}});
assert.equal(b.ok,true);assert.notDeepEqual(a,b.result.files);
console.log('Same graph with another model map: different compiled files:',Object.keys(a).filter(k=>a[k]!==b.result.files[k]));
const x=structuredClone(old),y=structuredClone(old);
x.loops[0].stops=[{kind:'human',every:3},{kind:'max-iterations',n:8,then:'done'}];
y.loops[0].stops=[{kind:'human',every:2},{kind:'max-iterations',n:8,then:'done'}];
console.log('Exact periodic askings:',[1,2,3,4,5,6].map(pass=>({pass,round:pass-1,sourceAsks:pass%3===0,copyAsks:pass%2===0})));
console.log('Comparison reason:',core.checkAdoption(x,y).refused.map(c=>({name:c.name,reason:c.loosens})));
const cli=join(root,'packages/cli/bin/grooph.js');
const put=(project,doc,flags=[])=>{const file=join(scratch,'incoming.json');writeFileSync(file,core.canonicalize(doc));return spawnSync(process.execPath,[cli,'export',file,'--target','claude-code','--into',project,...flags],{cwd:scratch,encoding:'utf8',env:{...process.env,GROOPH_MODELS:''}});};
const text=r=>r.result.content.filter(c=>c.type==='text').map(c=>c.text).join('\n');
const call=(project,graph,more={})=>handle({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'grooph_export',arguments:{graph,into:'.',...more}}},{project,version:'0.4.0',harness:'claude-code',session:'static-audit',env:{}});
const loose=structuredClone(old);loose.loops[0].stops[0].n=20;
// A coherent hand change is expressly documented: nothing authenticates the earlier baseline.
const p=join(scratch,'coherent');mkdirSync(p);assert.equal(put(p,old).status,0);
for(const [path,contents]of Object.entries(compile(loose)))if(/\/(graph\.grooph\.json|LEAD\.md|MAPPING\.md)$/.test(path))writeFileSync(join(p,path),contents);
let r=put(p,loose);assert.equal(r.status,0);console.log('Coherent baseline rewrite CLI:',r.stdout.trimEnd().split('\n').at(-1));
let m=await call(p,loose);assert.equal(m.result.isError,undefined);console.log('Coherent baseline rewrite MCP:',text(m).split('\n').filter(l=>l.startsWith('brakes:')));
// Other-harness state only: alter the kept target. This does not compile or validate the Codex target.
for(const door of ['CLI','MCP']){
 const q=join(scratch,'mixed-'+door);mkdirSync(q);assert.equal(put(q,old).status,0);
 writeFileSync(join(q,'.grooph',old.id,'graph.grooph.json'),core.canonicalize({...old,target:{harness:'codex'}}));
 if(door==='CLI'){
  r=put(q,old);assert.equal(r.status,1);console.log('Mixed baseline CLI refused:',(r.stdout+r.stderr).trim());
  r=put(q,old,['--uncompared']);assert.equal(r.status,0);assert.match(r.stdout,/brakes: not compared/);console.log('Mixed baseline CLI explicit:',r.stdout.trimEnd().split('\n').at(-1));
 }else{
  m=await call(q,old);assert.equal(m.result.isError,true);console.log('Mixed baseline MCP refused:',text(m));
  m=await call(q,old,{replace:true});assert.equal(m.result.isError,undefined);assert.match(text(m),/brakes: not compared/);console.log('Mixed baseline MCP explicit:',text(m).split('\n').filter(l=>l.startsWith('brakes:')));
 }
}
