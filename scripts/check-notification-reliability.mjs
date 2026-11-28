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
check(start.includes(".on('postgres_changes',{'event':'DELETE','schema':'public','table':'app_notifications'}")&&start.includes('payload.old?.id')&&start.includes("String(item['cloud_id']||'')!==id"),'Realtime deletes from another device must remove only the matching cloud notification locally.');
const deleteHelper=html.slice(html.indexOf('async function pushDeleteAll'),html.indexOf('function pushStop'));
const deleteUi=html.slice(html.indexOf('async function ntDeleteAll'),html.indexOf('function buy'));
check(deleteHelper.includes("await pushCall('delete-all')")&&deleteHelper.includes("if(!result?.ok)throw"),'delete-all must wait for a positive server acknowledgement.');
check(deleteUi.includes('await pushDeleteAll()')&&deleteUi.indexOf('await pushDeleteAll()')<deleteUi.indexOf("S['log']['nt']=")&&deleteUi.includes('Conecte-se à internet'),'the UI must not erase local notifications before cloud deletion succeeds or when the cloud session is unavailable.');
check(start.includes("notificationChannel['subscribe']((status,error)=>"),'notification channel must observe subscription status.');
check(start.includes("status==='SUBSCRIBED'"),'successful subscription must be tracked.');
check(start.includes("setConnectionStatus('connected')")&&start.includes("setConnectionStatus('connecting')")&&start.includes("setConnectionStatus(navigator.onLine?'reconnecting':'offline')"),'notification connection state must be reflected in the bell indicator.');
check(start.includes("if(!known&&incoming?.['created_by']!==V['cloudIdentity']?.['id']){window.stNotificationArrival?.();window.stNotificationSound?.play"),'only genuinely new notifications from other users must animate the bell.');
check(html.includes('#bl.st-notification-arrival .ic')&&html.includes('@keyframes st-notification-arrival-wave')&&html.includes('window.stNotificationArrival=stNotificationArrival'),'incoming notification feedback must include the bell motion and expanding water-like rings.');
check(html.includes("@media(prefers-reduced-motion:reduce){#bl.st-notification-arrival .ic,#bl.st-notification-arrival .st-notification-waves i{animation:none!important}}"),'notification arrival motion must respect reduced-motion preferences.');
const catchup=html.slice(html.indexOf('async function pushSyncNotifications'),html.indexOf('async function pushEnsureSubscription'));
check(catchup.includes('Array.isArray(result?.notifications)')&&catchup.includes('new Set(rows.map')&&catchup.includes('remoteIds.has')&&catchup.includes("!item['cloud_id']"),'notification catch-up must reconcile stale cloud-backed local copies and preserve local-only entries.');
check(!catchup.includes('stNotificationArrival'),'initial notification catch-up must not replay arrival animations.');
check(start.includes("['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)"),'channel failures must trigger recovery.');
check(start.includes("setTimeout(()=>{V['pushRetryTimer']=null;pushRecover();},3000)"),'failed channels must retry with a bounded delay.');
check(start.includes("window['addEventListener']('online'")&&start.includes("window['addEventListener']('offline'"),'network transitions must be observed.');
check(start.includes("document['addEventListener']('visibilitychange'"),'returning to the foreground must re-establish Realtime.');
check(stop.includes("clearTimeout(V['pushRetryTimer'])")&&stop.includes("V['pushRealtimeConnected']=false"),'logout must cancel retries and reset connection state.');
check(typeof pkg.version==='string'&&html.includes("const APP_VERSION='"+pkg.version+"'")&&sw.includes("super-tudo-v"+pkg.version),'release versions must be aligned.');
check(html.includes('@supabase/supabase-js@2.119.2'),'the app must use the current pinned Supabase SDK.');
check(html.includes("'realtime':{'worker':!0x0}"),'Realtime heartbeat must use the browser worker.');
check(sw.includes("self.addEventListener('push'")&&sw.includes('event.waitUntil')&&sw.includes('showNotification'),'service worker must retain background push delivery.');
if(fail.length){console.error(fail.join('\n'));process.exit(1);}
console.log('PASS - notification reliability: Realtime status, reconnect, lifecycle, logout and push service worker');
