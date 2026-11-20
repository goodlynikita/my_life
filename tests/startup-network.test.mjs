import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../js/startup-network.js',import.meta.url),'utf8');
const lookup='https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=public-test-key',refresh='https://securetoken.googleapis.com/v1/token?key=public-test-key';
function token(uid='saved-user',aud='demo-project'){return 'header.'+Buffer.from(JSON.stringify({sub:uid,aud})).toString('base64url')+'.signature';}
function client({owner='saved-user',valid=true,email='person@example.invalid',ready=false,hang=false,credentialKey='public-test-key'}={}){
 const timers=new Map(),calls=[],writes=[],storage=new Map([['nik_backup_uid',owner],['nik_local_backup',valid?JSON.stringify({training:{plans:[{id:'keep'}]},tasks:{list:[]}}):'{invalid'],['firebase:authUser:public-test-key:[DEFAULT]',JSON.stringify({uid:'saved-user',apiKey:credentialKey,email,stsTokenManager:{refreshToken:'saved-refresh'}})]]);let next=0;
 const ctx=vm.createContext({URL,URLSearchParams,AbortController,atob,Promise,_appReady:ready,FIREBASE_CONFIG:{apiKey:'public-test-key',projectId:'demo-project'},
  localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>{writes.push(k);storage.set(k,v)}},setTimeout:(fn,ms)=>{timers.set(++next,{fn,ms});return next},clearTimeout:id=>timers.delete(id),
  fetch:(input,options)=>{
   calls.push({input,options});if(!hang)return Promise.resolve(new Response('unchanged',{status:200}));
   return new Promise((resolve,reject)=>{
    if(options?.signal?.aborted)return reject(new DOMException('aborted','AbortError'));
    options?.signal?.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')),{once:true});
   });
  }});ctx.window=ctx;
 vm.runInContext(readFileSync(new URL('../js/store.js',import.meta.url),'utf8')+';globalThis.Store=Store;',ctx);vm.runInContext(source,ctx);
 return{ctx,timers,calls,writes,fetch:(url=lookup,options={method:'POST',body:JSON.stringify({idToken:token()})})=>ctx.fetch(url,options)};
}
async function flush(){await new Promise(r=>setImmediate(r));}
test('a hanging restore for its verified saved account takes the SDK network-error path after one second',async()=>{
 const a=client({hang:true}),p=a.fetch();const rejected=assert.rejects(p,{name:'AbortError'});await flush();assert.equal(a.calls.length,1);assert.equal([...a.timers.values()][0].ms,1000);[...a.timers.values()][0].fn();await rejected;assert.equal(a.timers.size,0);assert.deepEqual(a.writes,[]);
});
for(const opts of[{owner:'different-user'},{owner:null},{valid:false},{email:'owner@coach.you-app'},{credentialKey:'another-project'},{ready:true}])test('ordinary SDK request remains untouched: '+JSON.stringify(opts),async()=>{const a=client(opts);const r=await a.fetch();assert.equal(await r.text(),'unchanged');assert.equal(a.calls[0].options.signal,undefined);assert.equal(a.timers.size,0);assert.deepEqual(a.writes,[]);});
for(const idToken of[token('different-user'),token('saved-user','different-project'),'invalid'])test('a token for another account/project or malformed token has no shortened deadline: '+idToken.slice(0,12),async()=>{const a=client();await a.fetch(lookup,{body:JSON.stringify({idToken})});assert.equal(a.calls[0].options.signal,undefined);});
test('a matching saved refresh token is covered, unrelated refreshes are untouched',async()=>{const a=client();await a.fetch(refresh,{body:'grant_type=refresh_token&refresh_token=saved-refresh'});assert.ok(a.calls[0].options.signal);await a.fetch(refresh,{body:'grant_type=refresh_token&refresh_token=other-refresh'});assert.equal(a.calls[1].options.signal,undefined);});
test('caller cancellation is preserved and timers are removed',async()=>{const a=client({hang:true}),controller=new AbortController(),p=a.fetch(lookup,{body:JSON.stringify({idToken:token()}),signal:controller.signal});const rejected=assert.rejects(p,{name:'AbortError'});await flush();assert.notEqual(a.calls[0].options.signal,controller.signal);controller.abort();await rejected;assert.equal(a.timers.size,0);});
test('a successful response is returned unchanged and unrelated APIs never get a deadline',async()=>{const a=client();const result=await a.fetch();assert.equal(await result.text(),'unchanged');assert.equal(a.timers.size,0);await a.fetch('https://another.invalid/v1/accounts:lookup',{body:JSON.stringify({idToken:token()})});assert.equal(a.calls[1].options.signal,undefined);});
