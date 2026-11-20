import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const html=readFileSync(path.join(root,'index.html'),'utf8'),worker=readFileSync(path.join(root,'sw.js'),'utf8');
const offline=new Set([...worker.match(/const STATIC = \[([\s\S]*?)\];/)[1].matchAll(/'\.\/([^']+)'/g)].map(m=>m[1]));
test('app styles and scripts are local and available in the installed offline version',()=>{
 assert.equal([...worker.match(/const STATIC = \[([\s\S]*?)\];/)[1].matchAll(/'\.\/([^']+)'/g)].length,offline.size,'duplicate offline resource');
 for(const match of html.matchAll(/<(script|link)\b[^>]*(?:src|href)="([^"]+)"[^>]*>/g)){
  const url=match[2];if(!/\.(js|css)$/.test(url))continue;
  assert.ok(!/^https?:/.test(url),'external startup dependency: '+url);assert.ok(offline.has(url),'missing offline startup file: '+url);assert.ok(existsSync(path.join(root,url)),url);
 }
});
test('the Firebase SDK module graph resolves only to locally cached files',()=>{
 const pending=['js/firebase-sync.js'],seen=new Set();
 while(pending.length){const file=pending.pop();if(seen.has(file))continue;seen.add(file);const code=readFileSync(path.join(root,file),'utf8');
  for(const m of code.matchAll(/\bfrom\s*["']([^"']+)["']/g)){const url=m[1];assert.ok(url.startsWith('./'),'external module dependency: '+url);const target=path.posix.normalize(path.posix.join(path.posix.dirname(file),url));assert.ok(offline.has(target),'missing offline SDK module: '+target);pending.push(target);}
 }
 assert.ok(seen.has('js/vendor/firebase-10.12.0/firebase-auth.js'));
});
test('both app typefaces and the complete icon fallback survive an offline first screen change',()=>{
 for(const css of ['css/app-fonts.css','css/winter-fonts.css','css/vendor/tabler-icons-3.48.0.css']){
  assert.ok(offline.has(css));for(const m of readFileSync(path.join(root,css),'utf8').matchAll(/url\(["']?([^\s)'"?]+)/g)){
   const font=path.posix.normalize(path.posix.join(path.posix.dirname(css),m[1]));assert.ok(offline.has(font),font);assert.equal(readFileSync(path.join(root,font)).subarray(0,4).toString(),'wOF2',font);
  }
 }
});
