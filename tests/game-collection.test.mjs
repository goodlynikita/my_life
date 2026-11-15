import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const syncSource=readFileSync(new URL('../js/firebase-sync.js',import.meta.url),'utf8');
const mergeContext=vm.createContext({});vm.runInContext(syncSource.slice(syncSource.indexOf('  function _norm('),syncSource.indexOf('  /* какие разделы'))+syncSource.slice(syncSource.indexOf('  const _isObj ='),syncSource.indexOf('  function _startRetry()'))+';globalThis.merge=merge3;',mergeContext);
const source=readFileSync(new URL('../js/game.js',import.meta.url),'utf8');
const expected=JSON.parse(readFileSync(new URL('./fixtures/game-v317-stats.json',import.meta.url),'utf8'));
const fixed=Date.parse('2026-11-16T12:00:00+03:00');
class Clock extends Date{constructor(...a){super(...(a.length?a:[fixed]));}static now(){return fixed;}}
function model(data){
 let store=structuredClone(data);const writes=[];
 const Store={get:()=>store,set:(path,value)=>{writes.push(path);const keys=path.split('.');let o=store;for(const k of keys.slice(0,-1))o=o[k]??={};o[keys.at(-1)]=structuredClone(value);}};
 const Screens={},window={Screens,AUTH_CONFIG:{ownerEmail:'owner@invalid'},FirebaseSync:{currentUser:()=>({email:'owner@invalid'})}};
 let code=source.replace('return { avail, on, state,','return { _ach:achievements,_capture:captureAchievements,_items:wrItems,_look:lookOf,_equip:equipBadge,avail, on, state,');
 const context=vm.createContext({window,Screens,Store,FirebaseSync:window.FirebaseSync,Date:Clock,localStorage:{getItem:()=>null,setItem:()=>{}},document:{querySelector:()=>null},console,setTimeout:()=>0,clearTimeout:()=>{},trDayDateOf:(_p,s)=>{const [d,m]=s.split('.').map(Number);return new Clock(2026,m-1,d);}});
 vm.runInContext(code,context);return{game:window.Game,Store,writes,get data(){return store;},plain:v=>JSON.parse(JSON.stringify(v))};
}
function seed(){return{game:{seenLvl:28,look:2,bg:'ice',frame:'diamond',gotItems:['bg:ice','fr:diamond','fr:blue'],seenItems:['look:0','look:1','look:2']},habits:{list:[{id:'h'}],months:{'2026-11':{h:{14:'done',15:'done',16:'done'}}}},tasks:{list:Array.from({length:12},(_,i)=>({id:'t'+i,title:'Task',done:true,doneAt:fixed-i*1000}))},goals:{directions:[{id:'g1',done:true,doneAt:fixed-86400000,amount:100}]},finance:{spend:{'2026-11':[{amt:100,at:fixed,once:false}]}}};}
function stats(s){return{total:s.total,L:s.L,title:s.title,stage:s.stage,next:s.next,sk:s.sk,s:s.s,todayXp:s.todayXp,todayEv:s.todayEv,evs:s.evs};}
test('collection preserves v317 XP, levels, skill XP, events and streak calculations',()=>{const cases=[{},seed(),{...seed(),game:{sex:'f',rest:[0,6],needsOff:['cap'],quests:{}}}];for(let i=0;i<cases.length;i++){const a=model(cases[i]);assert.deepEqual(a.plain(stats(a.game.state())),expected[i]);a.game._capture(a.game.state());assert.deepEqual(a.plain(stats(a.game.state())),expected[i]);}});
test('legacy looks and already earned frame remain available without increasing XP',()=>{const m=model(seed()),S=m.game.state(),before=S.total;m.game._capture(S);const items=m.game._items(S);assert.equal(m.game._look(S),2);assert.equal(items.find(x=>x.key==='fr:diamond').ok,true);assert.equal(items.find(x=>x.key==='look:5').ok,true);assert.equal(m.game.state().total,before);assert.equal(m.game._ach(S).find(x=>x.id==='st7').ok,true);});
test('completed task history survives cleanup, deduplicates IDs and counts new completions once',()=>{const m=model(seed());m.game._capture(m.game.state());m.Store.set('tasks.list',[]);assert.equal(m.game._ach(m.game.state()).find(x=>x.id==='task10').v,12);m.Store.set('tasks.list',[{id:'t0',title:'Same',done:true},{id:'new',title:'New',done:true}]);m.game._capture(m.game.state());assert.equal(m.game._ach(m.game.state()).find(x=>x.id==='task10').v,13);m.game._capture(m.game.state());assert.equal(m.game._ach(m.game.state()).find(x=>x.id==='task10').v,13);});
test('achievement capture is idempotent and changes only the added game archive',()=>{const raw=seed(),m=model(raw),before=m.plain(m.data);m.game._capture(m.game.state());m.game._capture(m.game.state());assert.deepEqual(m.writes,['game.achievementBook']);const after=m.plain(m.data);delete after.game.achievementBook;assert.deepEqual(after,before);});
test('new milestones are unique, earned rewards remain earned after records disappear',()=>{const m=model(seed());m.game._capture(m.game.state());const before=m.game._ach(m.game.state());assert.equal(before.length,47);assert.equal(new Set(before.map(a=>a.id)).size,47);assert.equal(m.game._items(m.game.state()).filter(x=>x.kind==='bg').length,12);assert.equal(m.game._items(m.game.state()).filter(x=>x.kind==='frame').length,15);m.Store.set('goals.directions',[]);assert.equal(m.game._ach(m.game.state()).find(x=>x.id==='goal1').ok,true);});
test('showcase enforces three earned badges, supports removing, rejects locked and unknown badges',()=>{const m=model(seed());m.game._capture(m.game.state());for(const id of['task10','goal1','st7'])assert.equal(m.game._equip(id),true);assert.equal(m.game._equip('st30'),false);assert.equal(m.game._equip('st365'),false);assert.equal(m.game._equip('unknown'),false);assert.equal(m.game._equip('goal1'),true);assert.equal(m.game._equip('st30'),true);assert.equal(m.data.game.showcase.length,3);});

test('separate device contributions merge without losing earned rewards or completed tasks',()=>{
 const a=model(seed()),b=model(seed());a.Store.set('tasks.list',[{id:'phone.task/one',title:'Phone',done:true}]);b.Store.set('tasks.list',[{id:'laptop[task]two',title:'Laptop',done:true}]);a.game._capture(a.game.state());b.game._capture(b.game.state());
 const x=a.data.game.achievementBook,y=b.data.game.achievementBook;
 const merge=(u,v)=>JSON.parse(JSON.stringify(mergeContext.merge(undefined,u,v,[])));
 const joined=merge(x,y),m=model({...seed(),tasks:{list:[]},game:{...seed().game,achievementBook:joined}});
 assert.equal(m.game._ach(m.game.state()).find(t=>t.id==='task10').v,2);assert.equal(m.game._ach(m.game.state()).find(t=>t.id==='st100').ok,true);
 assert.ok(Object.keys(joined.tasksById).every(k=>/^t[a-f0-9]+$/.test(k)));assert.deepEqual(merge(x,y),merge(y,x));
});
