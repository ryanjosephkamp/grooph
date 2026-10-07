// Argument-only port; original round-two script left unchanged.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const R=process.argv[2];
const N=process.argv[3];
const core=await import(R+'/packages/core/dist/src/index.js');
const source={grooph:0,id:'order-probe',name:'Stop order probe',version:1,goal:'Build, test, and halt at the dispatch budget.',target:{harness:'claude-code'},nodes:[{id:'builder',kind:'agent',name:'Builder',role:'builder',brief:'Build.',outputs:['out.txt'],allow:['read-files','edit-files']},{id:'tests',kind:'check',name:'Tests',check:{kind:'command',run:'false',pass:'exit 0'}},{id:'done',kind:'stop',name:'Done',outcome:'success'}],edges:[{id:'e-build-test',from:'builder',to:'tests'},{id:'e-test-fail',from:'tests',to:'builder',when:'fail'},{id:'e-test-pass',from:'tests',to:'done',when:'pass'}],loops:[{id:'work',name:'Work',members:['builder','tests'],back:['e-test-fail'],mode:'grind',stops:[{kind:'budget',measure:'dispatches',limit:2},{kind:'budget',measure:'dispatches',limit:2,then:'done'}]}]};
const working=structuredClone(source);working.loops[0].stops.reverse();
for(const [label,doc]of [['source',source],['working',working]]) console.log(label, 'errors',JSON.stringify(core.validate(doc,{forExport:true}).filter(x=>x.severity==='error')),'stops',JSON.stringify(doc.loops[0].stops));
const adopted=core.adoptWorkingCopy(source,working,{run:'r1'});
console.log('core adoption',JSON.stringify(adopted.ok?core.checkAdoption(source,adopted.doc):adopted,null,2));
const cwd=N+'/scratch/stop-order';const run=cwd+'/.grooph/order-probe/runs/r1';mkdirSync(run,{recursive:true});
writeFileSync(cwd+'/.grooph/order-probe/graph.grooph.json',core.canonicalize(source));writeFileSync(run+'/graph.grooph.json',core.canonicalize(working));writeFileSync(run+'/notes.jsonl','');
const p=spawnSync(process.execPath,[R+'/packages/cli/bin/grooph.js','adopt',run,'--write','--into',cwd+'/adopted.json'],{cwd,encoding:'utf8'});console.log('CLI exit',p.status,p.stdout,p.stderr);
if(p.status===0)console.log('written stops',JSON.parse(readFileSync(cwd+'/adopted.json','utf8')).loops[0].stops);
