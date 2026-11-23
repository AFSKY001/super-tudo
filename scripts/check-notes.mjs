import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const html=read('index.html'),notes=read('notes.js'),sql=read('supabase/migrations/20261123190000_create_notes_module.sql');
const build=read('scripts/build-protected.mjs'),sw=read('sw.js'),pkg=JSON.parse(read('package.json')),lock=JSON.parse(read('package-lock.json'));
const failures=[];
const check=(ok,message)=>{if(!ok)failures.push(message);};
try{new Function(notes);console.log('PASS - sintaxe do módulo de notas');}catch(error){failures.push('notes.js syntax: '+error.message);}
check(html.includes('<script src="/notes.js"></script>'),'index must load the notes module.');
check(build.includes("'notes.js'"),'protected build must include notes.js.');
check(sw.includes("'/notes.js'")&&sw.includes('super-tudo-v3.74.57'),'service worker must cache the notes module under the current version.');
check(pkg.version==='3.74.57'&&lock.version===pkg.version&&lock.packages?.['']?.version===pkg.version,'package versions must be aligned.');
check(html.includes("const APP_VERSION='3.74.57'")&&html.includes("'v':'3.74.57'"),'application version and release history must match.');
check(html.includes("['Bloco de notas',[['r:notes'")&&html.includes("['l:notes'")&&html.includes("['m:notes'"),'notes permissions must be exposed in the existing permission editor.');
check(html.includes('nt-page')&&html.includes('nt-card')&&html.includes('nt-editor')&&html.includes('prefers-reduced-motion:reduce){.nt-page'),'notes styles must use the shared design tokens and reduced-motion support.');
check(notes.includes("supa.from('notas')")&&notes.includes("schema:'public',table:'notas'"),'notes must use the Supabase table and Realtime.');
check(notes.includes("allowed('l:notes')")&&notes.includes("allowed('r:notes')")&&notes.includes("allowed('m:notes')"),'notes UI must check the three permission levels.');
check(notes.includes("if(!title&&!textOf(body).trim())")&&notes.includes("setTimeout(()=>saveNow(),800)"),'empty notes must not be inserted and autosave must be debounced.');
check(notes.includes("getData('text/plain')")&&notes.includes('function sanitize(html)')&&notes.includes("['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','SVG','MATH','TEMPLATE']"),'pasted text and displayed HTML must be sanitized.');
check(notes.includes("state.lastUpdated")&&notes.includes(".eq('updated_at',state.lastUpdated)"),'note updates must detect stale revisions rather than silently overwrite another device.');
check(notes.includes('if(!state.dirty)return true;')&&notes.includes('const current=JSON.stringify')&&notes.includes('if(current===snapshot)'),'autosave must preserve edits made while an earlier save is still in flight.');
check(notes.includes("supa.removeChannel(state.channel)")&&notes.includes("function backToRegistry()"),'Realtime subscription must be released when leaving the notes module.');
check(notes.includes('root.stNotesBack=()=>state.editor?back():backToRegistry()')&&notes.includes('if(saved===false)return'),'editor navigation must return to the board and keep the editor open if saving fails.');
check(notes.includes("state.tab==='lixeira'")&&notes.includes("30*86400000")&&notes.includes('stNotesRestore'),'trash must support restore and 30-day cleanup.');
check(sql.includes('org_id uuid not null')&&sql.includes('enable row level security')&&sql.includes('notas_select')&&sql.includes('notas_insert')&&sql.includes('notas_update')&&sql.includes('notas_delete'),'notes SQL must enforce tenant-scoped RLS for all operations.');
check(sql.includes("author_id := v_uid")&&sql.includes('new.author_id := old.author_id')&&sql.includes('new.author_name := old.author_name'),'author identity must be assigned by the database and immutable.');
check(sql.includes("notas_has_permission('l:notes'")&&sql.includes("notas_has_permission('r:notes'")&&sql.includes("notas_has_permission('m:notes'"),'database policies must enforce create, read, and moderation permissions.');
check(notes.includes('!!n.shared&&canModerate()')&&notes.includes("n.shared&&(allowed('r:notes')||canModerate())"),'moderators must only see and edit notes explicitly shared with the team.');
check(notes.includes('canToggleShare=!n.id||isOwner(n)')&&notes.includes("readOnly||!canToggleShare?'disabled':''"),'only the note author may change its sharing state.');
check(sql.includes("shared = true\n    and public.notas_has_permission('m:notes', org_id)"),'database moderation policies must not expose or mutate private notes.');
check(sql.includes('alter publication supabase_realtime add table public.notas'),'notes must be enabled for Realtime.');
if(failures.length){console.error('FAIL - notes contract');failures.forEach(x=>console.error(' - '+x));process.exit(1);}
console.log('PASS - contrato do Bloco de notas ('+22+' verificações)');
