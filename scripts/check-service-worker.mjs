import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source=await fs.readFile('sw.js','utf8');
const handlers={};
const entries=new Map();
const deleted=[];
let networkFetch=async()=>new Response('unexpected network response',{status:200});

class MockRequest{
  constructor(input,init={}){
    this.url=typeof input==='string'?input:input.url;
    this.method=init.method||input.method||'GET';
    this.mode=init.mode||input.mode||'cors';
    this.cache=init.cache||input.cache||'default';
  }
}
const keyOf=value=>typeof value==='string'?value:value.url;
const cache={
  async put(request,response){entries.set(keyOf(request),response.clone());},
  async match(request){const value=entries.get(keyOf(request));return value?value.clone():null;}
};
const caches={
  async open(){return cache;},
  async match(request){return cache.match(request);},
  async keys(){return ['super-tudo-v3.74.80','unrelated-cache'];},
  async delete(name){deleted.push(name);return true;}
};
const self={
  location:{origin:'https://super-tudo.test'},
  registration:{showNotification:async()=>{}},
  clients:{claim:async()=>{},matchAll:async()=>[],openWindow:async()=>{}},
  addEventListener(type,handler){handlers[type]=handler;},
  skipWaiting:async()=>{}
};
vm.runInNewContext(source,{
  self,caches,fetch:(...args)=>networkFetch(...args),Request:MockRequest,
  Response,URL,Promise,console
},{filename:'sw.js'});

async function dispatch(url,mode='cors',method='GET'){
  let responsePromise;
  const event={
    request:new MockRequest(url,{mode,method}),
    respondWith(value){responsePromise=Promise.resolve(value);}
  };
  handlers.fetch(event);
  assert.ok(responsePromise,'Service Worker must call respondWith for this request.');
  return responsePromise;
}

const assetUrl='https://super-tudo.test/pickers.js';
await cache.put(new MockRequest(assetUrl),new Response('cached pickers',{status:200}));
networkFetch=async()=>new Response('server error',{status:500});
let response=await dispatch(assetUrl);
assert.equal(response.status,200,'HTTP 500 on an essential asset must use the cached copy.');
assert.equal(await response.text(),'cached pickers');

networkFetch=async()=>new Response('missing',{status:404});
response=await dispatch(assetUrl);
assert.equal(response.status,404,'HTTP 4xx must not be hidden by a stale cached asset.');

networkFetch=async()=>{throw new TypeError('network offline');};
response=await dispatch(assetUrl);
assert.equal(response.status,200,'Network failure must use the cached essential asset.');
assert.equal(await response.text(),'cached pickers');

await cache.put('/',new Response('cached application',{status:200}));
networkFetch=async()=>new Response('upstream error',{status:503});
response=await dispatch('https://super-tudo.test/','navigate');
assert.equal(response.status,200,'HTTP 5xx on navigation must use the cached application.');
assert.equal(await response.text(),'cached application');

networkFetch=async()=>new Response('not found',{status:404});
response=await dispatch('https://super-tudo.test/unknown','navigate');
assert.equal(response.status,404,'HTTP 4xx navigation responses must remain visible.');

networkFetch=async()=>{throw new TypeError('network offline');};
response=await dispatch('https://super-tudo.test/','navigate');
assert.equal(response.status,200,'Offline navigation must use the cached application.');
assert.equal(await response.text(),'cached application');

const activateEvent={waitUntil(promise){this.promise=promise;}};
handlers.activate(activateEvent);
await activateEvent.promise;
assert.ok(deleted.includes('super-tudo-v3.74.80'),'Activation must remove the previous Super Tudo cache.');
assert.ok(!deleted.includes('unrelated-cache'),'Activation must preserve unrelated Cache Storage entries.');

console.log('PASS - Service Worker runtime: cached picker fallback for HTTP 5xx/offline, 4xx passthrough, navigation fallback and scoped cache cleanup.');
