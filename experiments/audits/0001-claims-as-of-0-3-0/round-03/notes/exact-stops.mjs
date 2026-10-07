// Independent finite firing model: no grooph semantics/model helpers imported.
import {join,resolve} from 'node:path';
const core=await import(join(resolve(process.argv[2]),'packages/core/dist/src/index.js'));
const cap=(n,then)=>({kind:'max-iterations',n,...(then?{then}:{})});
const budget=(limit,then)=>({kind:'budget',measure:'dispatches',limit,...(then?{then}:{})});
const human=every=>({kind:'human',every});
const options=[cap(1),cap(2),cap(3),cap(1,'done'),cap(2,'done'),budget(1),budget(2),budget(1,'done'),budget(2,'done'),human(1),human(2),human(3)];
const g=stops=>({grooph:0,id:'finite',name:'Finite',version:1,goal:'Work.',target:{harness:'claude-code'},nodes:[{id:'a',kind:'agent',name:'A',role:'builder',brief:'Work.',outputs:['a'],allow:['write-outputs']},{id:'b',kind:'agent',name:'B',role:'planner',brief:'Route.',outputs:['b'],allow:['write-outputs']},{id:'done',kind:'stop',name:'Done',outcome:'success'}],edges:[{id:'ab',from:'a',to:'b'},{id:'ba',from:'b',to:'a',when:{verdict:'more'}},{id:'bd',from:'b',to:'done',when:{verdict:'finished'}}],loops:[{id:'list',name:'List',members:['a','b'],back:['ba'],mode:'grind',stops}]});
function simulate(stops,t1,t2){
  const asking=[];let lead;
  for(let pass=1;pass<=8;pass++){
    const spent=(pass>=t1?1:0)+(pass>=t2?1:0);
    const first=stops.find(s=>s.kind==='max-iterations'?pass>=s.n:s.kind==='human'?pass%s.every===0:spent>=s.limit);
    if(!first)continue;
    if(first.kind==='human'){asking.push(pass);continue;}
    if(first.then){lead=pass;break;}
    return {protected:[...asking,pass],lead};
  }
  return {protected:asking,lead};
}
let pairs=0,witnessed=0,missed=0,heldNoWitness=0;
for(const a of options)for(const b of options){
  const was=[a,b],source=g(was);
  const edits=[[b,a],...[0,1].map(i=>was.filter((_,j)=>i!==j)),...options.flatMap(s=>[0,1,2].map(at=>[...was.slice(0,at),s,...was.slice(at)]))];
  for(const now of edits){
    if(JSON.stringify(was)===JSON.stringify(now))continue;
    if(core.validate(g(now),{forExport:true}).some(x=>x.severity==='error'))throw Error('invalid own host');
    pairs++;
    let witness;
    for(let t1=1;t1<=9&&!witness;t1++)for(let t2=t1;t2<=9&&!witness;t2++){
      const x=simulate(was,t1,t2),y=simulate(now,t1,t2);
      if(y.lead!==undefined&&x.protected.some(p=>p>=y.lead))witness={t1,t2,source:x,copy:y};
    }
    const check=core.checkAdoption(source,{...g(now),version:2});
    if(witness){witnessed++;if(!check.refused.some(c=>c.name==='loop:list.stops')){missed++;console.log('MISSED',JSON.stringify({was,now,witness,refused:check.refused}));}}
    else if(check.refused.length)heldNoWitness++;
  }
}
console.log(JSON.stringify({pairs,witnessed,missed,heldNoWitness,scope:'one plain loop; lists of 1 to 3 stops; cap, one shared budget measure, exact periodic humans; monotone budget reaches 1 and 2 on independently chosen passes 1..9; observe passes 1..8'}));
if(missed)process.exit(1);
