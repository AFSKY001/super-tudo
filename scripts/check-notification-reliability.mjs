import fs from 'node:fs/promises';
const [html,sw,pkgText]=await Promise.all([
 fs.readFile('index.html','utf8'),
 fs.readFile('sw.js','utf8'),
 fs.readFile('package.json','utf8')
]);
const pkg=JSON.parse(pkgText),fail=[];
const check=(ok,message)=>{if(!ok)fail.push(message);};
const start=html.slice(html.indexOf('function pushScheduleReconnect'),html.indexOf('function pushVersionNotice'));
const stop=html.slice(html.indexOf('function pushStop'),html.indexOf('function notify('));
check(start.includes("notificationChannel['subscribe']((status,error)=>"),'notification channel must observe subscription status.');
check(start.includes("status==='SUBSCRIBED'"),'successful subscription must be tracked.');
check(start.includes("setConnectionStatus('connected')")&&start.includes("setConnectionStatus('connecting')")&&start.includes("setConnectionStatus(navigator.onLine?'reconnecting':'offline')"),'notification connection state must be reflected in the bell indicator.');
check(start.includes("['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)"),'channel failures must trigger recovery.');
check(start.includes("setTimeout(()=>{V['pushRetryTimer']=null;pushRecover();},3000)"),'failed channels must retry with a bounded delay.');
check(start.includes("window['addEventListener']('online'")&&start.includes("window['addEventListener']('offline'"),'network transitions must be observed.');
check(start.includes("document['addEventListener']('visibilitychange'"),'returning to the foreground must re-establish Realtime.');
check(stop.includes("clearTimeout(V['pushRetryTimer'])")&&stop.includes("V['pushRealtimeConnected']=false"),'logout must cancel retries and reset connection state.');
check(pkg.version==='3.74.72'&&html.includes("const APP_VERSION='3.74.72'")&&sw.includes("super-tudo-v3.74.72"),'release versions must be aligned.');
check(html.includes('@supabase/supabase-js@2.119.2'),'the app must use the current pinned Supabase SDK.');
check(html.includes("'realtime':{'worker':!0x0}"),'Realtime heartbeat must use the browser worker.');
check(sw.includes("self.addEventListener('push'")&&sw.includes('event.waitUntil')&&sw.includes('showNotification'),'service worker must retain background push delivery.');
if(fail.length){console.error(fail.join('\n'));process.exit(1);}
console.log('PASS - notification reliability: Realtime status, reconnect, lifecycle, logout and push service worker');
