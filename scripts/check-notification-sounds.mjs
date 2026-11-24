import fs from 'node:fs/promises';
const [html,module,build,sw,pkgText]=await Promise.all([
 fs.readFile('index.html','utf8'),
 fs.readFile('notification-sounds.js','utf8'),
 fs.readFile('scripts/build-protected.mjs','utf8'),
 fs.readFile('sw.js','utf8'),
 fs.readFile('package.json','utf8')
]);
const pkg=JSON.parse(pkgText),fail=[];
const check=(ok,message)=>{if(!ok)fail.push(message);};
try{new Function(module);}catch(error){fail.push('notification-sounds.js syntax: '+error.message);}
check(pkg.version==='3.74.71','package version must be 3.74.71.');
check(html.includes("const APP_VERSION='3.74.71'"),'index APP_VERSION must match package version.');
check(sw.includes("const CACHE_NAME='super-tudo-v3.74.71'"),'service worker cache version must match package version.');
check(html.includes('<script src="/notification-sounds.js?v=3.74.71"></script>'),'sound module must be loaded by index.html.');
check(build.includes("'notification-sounds.js'"),'sound module must be copied into the protected deployment.');
check(html.includes("window.stNotificationSound?.play(incoming?.['cat'],V['cloudIdentity']?.['id'])"),'only newly received Realtime notifications must trigger the local sound.');
check(module.includes('silentStart')&&module.includes('silentEnd')&&module.includes('categories'),'local preferences must include quiet hours and notification categories.');
check(module.includes('localStorage')&&module.includes('AudioContext'),'sound settings must remain local and use browser audio.');
check(module.includes('function setConnectionStatus(state)')&&module.includes('data-connection="connected"'),'notification bell must expose an accessible live-connection indicator.');
check(html.includes("setConnectionStatus('connected')")&&html.includes("setConnectionStatus('reconnecting')")&&html.includes("setConnectionStatus('offline')"),'Realtime lifecycle must update the notification connection indicator.');
if(fail.length){console.error(fail.join('\n'));process.exit(1);}
console.log('PASS - notification sounds: syntax, integration, local preferences, quiet hours and deployment contract');
