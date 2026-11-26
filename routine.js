(function(root){
'use strict';
const pad=n=>String(n).padStart(2,'0');
const localDate=(d=new Date())=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const parseDate=s=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s||''));if(!m)return null;const d=new Date(+m[1],+m[2]-1,+m[3],12);return d.getFullYear()===+m[1]&&d.getMonth()===+m[2]-1&&d.getDate()===+m[3]?d:null;};
const dateValue=v=>{if(typeof v==='number')return Number.isFinite(v)?localDate(new Date(v)):'';const s=String(v??'').trim();if(parseDate(s))return s;const br=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);if(br){const iso=br[3]+'-'+br[2]+'-'+br[1];return parseDate(iso)?iso:'';}const d=s?new Date(s):null;return d&&!Number.isNaN(d.getTime())?localDate(d):'';};
const addDays=(s,n)=>{const d=parseDate(s);if(!d)return'';d.setDate(d.getDate()+Number(n||0));return localDate(d);};
const minutes=d=>d.getHours()*60+d.getMinutes();
const hm=s=>{const m=/^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(s||''));return m?+m[1]*60+ +m[2]:480;};
const idOf=(a,b,d)=>String(a)+'|'+String(b)+'|'+String(d);
const occurs=(r,day)=>{const d=parseDate(day);if(!d||!r)return false;if(r.type==='date')return r.date===day;if(r.type==='dates')return(r.dates||[]).includes(day);const matches=date=>{if(r.type==='daily')return true;if(r.type==='weekly')return(r.days||[]).map(Number).includes(date.getDay());if(r.type==='monthly')return(r.days||[]).map(Number).includes(date.getDate());return false;};if(!matches(d)||r.startDate&&day<r.startDate||r.endDate&&day>r.endDate)return false;const count=Number(r.count);if(!Number.isInteger(count)||count<1)return true;const start=parseDate(r.startDate);if(!start||start>d)return false;let total=0,cursor=new Date(start.getFullYear(),start.getMonth(),start.getDate(),12);while(cursor<=d){if(matches(cursor))total++;if(total>count)return false;cursor.setDate(cursor.getDate()+1);}return total<=count;};
const snap=(m,a)=>({modelId:m.id,modelName:m.name,title:String(a.title||''),description:String(a.description||''),steps:[...(a.steps||[])],checklistSnapshot:[...(a.checklistSnapshot||[])],turns:[...(a.turns||[])],legacyChecklistByPerson:{...(a.legacyChecklistByPerson||{})},functionId:a.functionId||'',photo:a.photo||'none',mandatory:a.mandatory!==false,recurrence:JSON.parse(JSON.stringify(a.recurrence||{type:'weekly',days:[0,1,2,3,4,5,6]})),time:a.time||'08:00'});
const makeOccurrence=(at,m,a,day,now=Date.now())=>({id:idOf(at.id,a.id,day),assignmentId:at.id,activityId:a.id,executorId:at.executorId,date:day,status:'pending',snapshot:snap(m,a),madeAt:null,madeBy:null,madeByName:'',viaSystem:false,photoId:null,note:'',createdAt:now,updatedAt:now});
const state=(o,now=new Date())=>{if(!o)return'pending';if(o.status==='done'||o.status==='dismissed')return o.status;const d=localDate(now);if(o.date<d)return'overdue';if(o.date>d)return'pending';return minutes(now)>hm(o.snapshot.time)?'overdue':'pending';};
const activeOn=(a,d)=>a&&a.active!==false&&(!a.from||a.from<=d)&&(!a.until||a.until>=d);
const generate=(db,day,now=Date.now())=>{const created=[],updated=[],models=new Map((db.models||[]).map(m=>[String(m.id),m]));for(const at of db.assignments||[]){if(!activeOn(at,day))continue;const m=models.get(String(at.modelId));if(!m||m.archivedAt)continue;for(const a of m.activities||[]){if(!a.title||!occurs(a.recurrence,day))continue;const id=idOf(at.id,a.id,day),old=(db.occurrences||{})[id];if(!old)created.push(makeOccurrence(at,m,a,day,now));else if(old.status==='pending'&&state(old,new Date(now))==='pending'&&day>=localDate(new Date(now))){const next=snap(m,a);if(JSON.stringify(old.snapshot)!==JSON.stringify(next))updated.push({...old,snapshot:next,updatedAt:now});}}}return{created,updated};};
const legacyWeekdays=days=>[...new Set((Array.isArray(days)?days:[]).map(Number).filter(day=>Number.isInteger(day)&&day>=0&&day<7).map(day=>(day+1)%7))].sort((a,b)=>a-b);

const recipeNormalize=value=>{
 const source=value&&typeof value==='object'?value:{};
 return {
  nome:String(source.nome||'').trim(),
  ingredientes:(Array.isArray(source.ingredientes)?source.ingredientes:[]).slice(0,14).map(item=>({nome:String(item?.nome||'').trim(),unidade:String(item?.unidade||'').trim(),peso:String(item?.peso??'').trim()})),
  pesoInicial:String(source.pesoInicial??'').trim(),pesoFinal:String(source.pesoFinal??'').trim(),
  rendimento:String(source.rendimento??'').trim(),unidadeRendimento:String(source.unidadeRendimento||'').trim(),
  pessoas:String(source.pessoas??'').trim(),tempoPreparo:String(source.tempoPreparo||'').trim(),
  tempoForno:String(source.tempoForno||'').trim(),preparo:String(source.preparo||''),
  usaEmbalagem:String(source.usaEmbalagem||'nao'),tipoEmbalagem:String(source.tipoEmbalagem||'').trim(),
  quantidadeEmbalagem:String(source.quantidadeEmbalagem??'').trim(),responsavel:String(source.responsavel||'').trim(),
  dataVersao:String(source.dataVersao||'').trim()
 };
};
const recipeValidate=value=>{
 const recipe=recipeNormalize(value);
 if(!recipe.nome)return 'Informe o nome da receita.';
 const ingredients=recipe.ingredientes.filter(item=>item.nome);
 if(!ingredients.length)return 'Adicione pelo menos um ingrediente.';
 if(ingredients.some(item=>!item.unidade||!item.peso||!Number.isFinite(Number(item.peso))||Number(item.peso)<=0))return 'Complete a unidade e o peso de todos os ingredientes informados.';
 for(const [key,label] of [['pesoInicial','peso inicial'],['pesoFinal','peso final'],['rendimento','rendimento'],['pessoas','quantidade de pessoas']]){
  const fieldValue=recipe[key];
  if(fieldValue!==''&&(!Number.isFinite(Number(fieldValue))||Number(fieldValue)<0))return 'Confira o campo '+label+'.';
 }
 if(recipe.pessoas!==''&&(!Number.isInteger(Number(recipe.pessoas))||Number(recipe.pessoas)<1))return 'A quantidade de pessoas deve ser um número inteiro maior que zero.';
 if(recipe.usaEmbalagem==='sim'&&(!recipe.tipoEmbalagem||!recipe.quantidadeEmbalagem||!Number.isFinite(Number(recipe.quantidadeEmbalagem))||Number(recipe.quantidadeEmbalagem)<=0))return 'Informe o tipo e a quantidade de embalagens.';
 return '';
};
const recipeIngredient=()=>({nome:'',unidade:'',peso:''});

const expandChecklistItems=({idPrefix,title,description='',steps=[],turns=[],photo='none',mandatory=true,recurrence={type:'daily'},time='08:00',source={}}={})=>{
 const items=(Array.isArray(steps)?steps:[]).map(String).filter(step=>step.trim()&&step.trim()[0]!=='#');
 const shifts=Array.isArray(turns)&&turns.length?turns.map(String):[''];
 return shifts.flatMap((turn,turnIndex)=>items.map((step,index)=>({
  id:String(idPrefix)+(turn?'|turn|'+turnIndex:'')+'|item|'+index,
  title:step,
  description:[String(description||('Checklist: '+String(title||''))),turn?'Turno: '+turn:''].filter(Boolean).join(' · '),
  steps:[],checklistSnapshot:[step],turns:turn?[turn]:[],
  source:{...source,type:'legacy-assigned-checklist-item'},
  functionId:'',photo,mandatory,
  recurrence:JSON.parse(JSON.stringify(recurrence)),time,updatedAt:Date.now()
 })));
};
const Core={localDate,dateValue,parseDate,addDays,minutes,hm,idOf,occurs,snap,makeOccurrence,state,activeOn,generate,legacyWeekdays,expandChecklistItems};
Core.recipes={normalize:recipeNormalize,validate:recipeValidate,ingredient:recipeIngredient};
root.SuperTudoRoutineCore=Core;if(typeof module!=='undefined'&&module.exports)module.exports=Core;
const bridge=root.__ST_ROUTINE_BRIDGE__;if(!root.document||!bridge)return;
const S=bridge.S,V=bridge.V,CK=bridge.CK,person=bridge.person,teamOf=bridge.teamOf,isFullAccess=bridge.isFullAccess,migFix=bridge.migFix,save=bridge.save,today=bridge.today,esc=bridge.esc,rConf=bridge.rConf,rMov=bridge.rMov,rPdc=bridge.rPdc,rAvaReg=bridge.rAvaReg,rRegLanc=bridge.rRegLanc,LANC_KEYS=bridge.LANC_KEYS,FS=bridge.FS,RSEC=bridge.RSEC;
let R=bridge.R,rMenu=bridge.rMenu,rMenuCore=bridge.rMenuCore;
const $=id=>root.document.getElementById(id),e=v=>esc(String(v??'')),Pickers=root.SuperTudoPickers;
function installRoutineStyles(){
 if(!root.document||$('st-routine-checkbox-styles'))return;
 const style=root.document.createElement('style');style.id='st-routine-checkbox-styles';
 style.textContent=`
 .rt-task-row{display:flex;align-items:center;gap:12px;padding:10px 12px;min-height:68px;transition:background .25s ease,border-color .25s ease}\n .rt-task-row.is-completing{background:color-mix(in srgb,var(--ok) 9%,var(--cd));border-color:color-mix(in srgb,var(--ok) 38%,var(--bd))}\n .rt-task-row.is-unchecking{background:color-mix(in srgb,var(--ok) 5%,var(--cd));border-color:var(--bd)}
 .rt-task-check{position:relative;isolation:isolate;width:28px;height:28px;min-width:28px;border:2px solid var(--bd);border-radius:7px;background:var(--bg);color:var(--texto-inverso);display:grid;place-items:center;font:800 19px/1 system-ui;padding:0;touch-action:manipulation;transition:background .25s ease,border-color .25s ease,transform .25s cubic-bezier(.2,.8,.2,1)}\n .rt-task-check::after{content:"";position:absolute;inset:-5px;border:2px solid var(--ok);border-radius:10px;opacity:0;pointer-events:none}\n .rt-task-row.is-completing .rt-task-check{animation:rt-check-pop .42s cubic-bezier(.2,.8,.2,1) both}\n .rt-task-row.is-completing .rt-task-check::after{animation:rt-check-wave .95s ease-out 2 both}\n .rt-task-row.is-unchecking .rt-task-check::after{animation:rt-uncheck-wave .72s ease-out both}
 .rt-task-check.is-checked{background:var(--ok);border-color:var(--ok)}
 .rt-task-check:disabled{opacity:.65}
 .rt-task-open{flex:1;min-width:0;min-height:46px;border:0;background:transparent;color:var(--tx);display:flex;align-items:center;gap:10px;text-align:left;padding:0;touch-action:manipulation}
 .rt-task-copy{display:flex;flex:1;min-width:0;flex-direction:column;gap:3px}
 .rt-task-copy b{position:relative;display:inline-block;align-self:flex-start;max-width:100%;overflow-wrap:anywhere;font-size:14px}\n .rt-task-row.is-completing .rt-task-copy b::after{content:"";position:absolute;left:0;top:54%;width:100%;height:2px;border-radius:2px;background:var(--ok);transform:scaleX(0);transform-origin:left center;animation:rt-paper-strike 2s cubic-bezier(.2,.8,.2,1) forwards}\n .rt-task-row.is-completing .rt-task-copy b{color:var(--tx);transition:color .3s ease}
 .rt-task-status{font-size:11px;font-weight:700;color:var(--mu);white-space:nowrap}
 .rt-task-status.is-late{color:var(--no)}.rt-task-status.is-done{color:var(--ok)}
 .rt-task-chevron{font-size:25px;line-height:1;color:var(--mu)}\n @keyframes rt-check-pop{0%{transform:scale(.82)}55%{transform:scale(1.16)}100%{transform:scale(1)}}\n @keyframes rt-check-wave{0%{transform:scale(.65);opacity:.7}100%{transform:scale(1.85);opacity:0}}\n @keyframes rt-uncheck-wave{0%{transform:scale(.7);opacity:.55}100%{transform:scale(1.9);opacity:0}}\n @keyframes rt-paper-strike{0%{transform:scaleX(0)}100%{transform:scaleX(1)}}\n @media(prefers-reduced-motion:reduce){.rt-task-row,.rt-task-check{transition:none!important}.rt-task-row.is-completing .rt-task-copy b::after{animation:none;transform:scaleX(1)}.rt-task-row.is-completing .rt-task-check,.rt-task-row.is-completing .rt-task-check::after,.rt-task-row.is-unchecking .rt-task-check::after{animation:none!important}}
 .rt-details-sheet{display:flex;flex-direction:column;gap:12px;padding:12px 16px calc(20px + env(safe-area-inset-bottom,0px));}
 .rt-sheet-head{align-items:flex-start}.rt-sheet-head h3{margin:4px 0 0;font-size:19px;overflow-wrap:anywhere}
 .rt-sheet-kicker{font-size:10px;letter-spacing:1px;font-weight:800;color:var(--mu)}
 .rt-detail-status{align-self:flex-start;padding:5px 10px;border-radius:99px;background:var(--sf);font-size:12px;font-weight:700}
 .rt-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
 .rt-detail-block{min-width:0;padding:11px;border:1px solid var(--bd);border-radius:12px;background:var(--sf)}
 .rt-detail-block>b{display:block;font-size:14px;margin-top:3px}
 .rt-detail-block>p{margin:6px 0 0;font-size:13px;overflow-wrap:anywhere}
 .rt-detail-block ul{margin:8px 0 0;padding-left:20px;font-size:13px}
 .rt-detail-block li+li{margin-top:5px}
 .rt-photo-warning{padding:10px 12px;border-radius:10px;background:color-mix(in srgb,var(--wa) 14%,var(--cd));border:1px solid var(--wa);font-size:13px}
 .rt-photo-pick{display:inline-flex;align-items:center;min-height:42px;margin-top:8px}
 .rt-photo-input{position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;overflow:hidden!important;clip:rect(0,0,0,0)!important}
 .rt-detail-actions{display:flex;gap:8px;flex-wrap:wrap;padding-top:4px}
 .rt-detail-actions .bt{min-height:44px}
 @media(max-width:380px){.rt-task-status{font-size:10px}.rt-detail-grid{gap:6px}.rt-detail-block{padding:9px}}
 `;
 root.document.head.appendChild(style);
}
installRoutineStyles();
const uid=()=>root.crypto?.randomUUID?root.crypto.randomUUID():'rt-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
const day=()=>typeof today==='function'?today():localDate(),dayValue=v=>Core.dateValue(v),touch=o=>(o.updatedAt=Date.now(),o);
const db=()=>{S.routineModels=Array.isArray(S.routineModels)?S.routineModels:[];S.routineAssignments=Array.isArray(S.routineAssignments)?S.routineAssignments:[];S.routineOccurrences=S.routineOccurrences&&typeof S.routineOccurrences==='object'?S.routineOccurrences:{};S.migrations=Array.isArray(S.migrations)?S.migrations:[];return{models:S.routineModels,assignments:S.routineAssignments,occurrences:S.routineOccurrences};};
const who=id=>typeof person==='function'?person(id):(S.team||[]).find(p=>String(p.id)===String(id));
const whoName=id=>who(id)?.n||'Pessoa não encontrada';
const supervisor=id=>(S.team||[]).find(p=>(p.lead||[]).map(String).includes(String(id)));
const clone=o=>JSON.parse(JSON.stringify(o));
const checklistItems=c=>{const raw=Array.isArray(c?.l)&&c.l.length?c.l:Array.isArray(c?.i)?c.i:typeof c?.i==='string'?c.i.split('|'):[];return raw.filter(x=>x&&String(x)[0]!=='#').map(String);};
function recordDay(r){const v=r&&(r.data||r.d||r.date||r.createdAt);return Core.dateValue(v);}
function recordForPerson(rows,d,pid,pattern){const p=who(pid),name=String(p?.n||'').trim().toLocaleLowerCase(),uniqueName=!!name&&(S.team||[]).filter(x=>String(x.n||'').trim().toLocaleLowerCase()===name).length===1;return(Array.isArray(rows)?rows:[]).some(r=>{if(!r||recordDay(r)!==d)return false;if(pattern&&!pattern.test(String(r.arq||r.src||r.tipo||r.t||'')))return false;const owners=[r.pid,r.executorId,r.responsavelId,r.by,r.resp,r.r,r.rid].filter(x=>x!=null).map(String);return owners.includes(String(pid))||uniqueName&&owners.some(owner=>owner.trim().toLocaleLowerCase()===name);});}
const defs=[
{id:'conferencia_entrada',label:'Conferência de entrada',section:'conf',exists:()=>typeof rConf==='function'},
{id:'conferencia_ruptura',label:'Conferência de ruptura',section:'conf',exists:()=>typeof rConf==='function',feitoEm:(d,p)=>recordForPerson(S.movB,d,p,/ruptura/i)},
{id:'alteracao_preco',label:'Alteração de preço',section:'mov',exists:()=>typeof rMov==='function',feitoEm:(d,p)=>recordForPerson(S.movB,d,p,/pre[cç]o|etiqueta/i)},
{id:'recebimento_temperatura',label:'Recebimento e temperatura',launch:'temp',exists:()=>!!S.log?.temp,feitoEm:(d,p)=>recordForPerson(S.log.temp,d,p)},
{id:'vencidos',label:'Registro de vencidos',launch:'vtc',exists:()=>!!(S.log?.vtc||S.log?.vsc),feitoEm:(d,p)=>recordForPerson([...(S.log?.vtc||[]),...(S.log?.vsc||[])],d,p)},
{id:'avariados',label:'Registro de avariados',launch:'atc',exists:()=>!!(S.log?.atc||S.log?.asc),feitoEm:(d,p)=>recordForPerson([...(S.log?.atc||[]),...(S.log?.asc||[])],d,p)},
{id:'etiquetas',label:'Etiquetas',section:'mov',exists:()=>typeof rMov==='function',feitoEm:(d,p)=>recordForPerson(S.movB,d,p,/etiqueta/i)},
{id:'pedido_prateleira',label:'Pedido para prateleira',section:'pdc',exists:()=>typeof rPdc==='function',feitoEm:(d,p)=>(S.pdc||[]).some(r=>r.d===d&&String(r.rp||r.by||'')===String(p))},
{id:'avaliacao',label:'Avaliação',section:'ava',exists:()=>typeof rAvaReg==='function',feitoEm:(d,p)=>(S.ev||[]).some(r=>r.d===d&&String(r.p||'')===String(p))},
{id:'entregas',label:'Entregas',launch:'ent',exists:()=>typeof rRegLanc==='function',feitoEm:(d,p)=>recordForPerson(S.log?.ent,d,p)}
];
for(const key of LANC_KEYS||[]){if(!defs.some(f=>f.launch===key)&&FS[key])defs.push({id:'lanc_'+key,label:FS[key].n||key,launch:key,exists:()=>true});}for(const row of RSEC||[]){const key=row[0];if(key&&key!=='home'&&key!=='lanc'&&!defs.some(f=>f.section===key))defs.push({id:'sec_'+key,label:row[2]||key,section:key,exists:()=>true});}
const FUNCOES=Object.fromEntries(defs.filter(f=>f.exists()).map(f=>[f.id,{label:f.label,abrir:()=>openFunction(f),...(f.feitoEm?{feitoEm:f.feitoEm}:{})}]));
root.FUNCOES=FUNCOES;
function openFunction(f){V.tab='reg';if(f.launch){V.rs='lanc';V.reg=f.launch;}else{V.rs=f.section||'home';V.reg=null;}V.rotTask=null;R();}
function migrate(){
 const D=db();
 if(typeof migFix==='function'){try{migFix();}catch(err){console.warn('Migração dos modelos antigos de cronograma:',err);}}
 if(typeof bridge.migrateCronogramaModelsToChecklists==='function'){
  try{bridge.migrateCronogramaModelsToChecklists();}
  catch(err){console.warn('Conversão dos modelos antigos para checklists:',err);}
 }
 S.routineMigrationWarnings=Array.isArray(S.routineMigrationWarnings)?S.routineMigrationWarnings:[];
 const modelMap=new Map(),assignmentIds=new Set(D.assignments.map(a=>a.id));
 const grantRoutinePermission=pid=>{
  const person=who(pid);if(!person)return false;
  person.perm=Array.isArray(person.perm)?person.perm:[];
  if(person.perm.includes('r:rot'))return false;
  person.perm=[...person.perm,'r:rot'];return true;
 };
 const assignedChecklistMigration='routine-assigned-checklists-v2';
 let added=false;
  Object.entries(CK||{}).forEach(([ckid,checklist])=>{
   const pid=String(checklist?.p||'').trim(),name=String(checklist?.n||'').trim();
   if(!pid||!who(pid)||!name)return;
   const steps=checklistItems(checklist);
   if(!steps.length)return;
   const turns=Array.isArray(checklist.t)?checklist.t.map(String).filter(Boolean):[];
   const photoRequired=checklist.ph===true||checklist.ph===1||['true','1','sim','required','obrigatoria'].includes(String(checklist.ph||'').trim().toLowerCase());
   const signature=JSON.stringify([pid,name.toLowerCase(),steps,turns,photoRequired]);
   let hash=2166136261;
   for(let i=0;i<signature.length;i++)hash=Math.imul(hash^signature.charCodeAt(i),16777619)>>>0;
   const suffix=hash.toString(36),modelId='legacy-assigned-checklist-'+pid+'-'+suffix;
   const assignmentId='legacy-assigned-checklist-assignment-'+pid+'-'+suffix;
   let model=D.models.find(item=>String(item.id)===modelId);
   if(!model){
    const activities=expandChecklistItems({
     idPrefix:'legacy-assigned-activity-'+suffix,title:name,
     description:'Checklist atribuído no cadastro do funcionário.',
     steps,turns,photo:photoRequired?'required':'none',mandatory:true,
     recurrence:{type:'daily'},time:'08:00',
     source:{checklistId:String(ckid)}
    });
    model=touch({id:modelId,name,description:'Migrado automaticamente do checklist atribuído ao funcionário.',legacyId:String(ckid),legacyChecklistIds:[String(ckid)],legacySignature:suffix,activities,createdAt:Date.now()});
    D.models.push(model);added=true;
   }else{
    const oldIds=Array.isArray(model.legacyChecklistIds)?model.legacyChecklistIds:[];
    if(!oldIds.includes(String(ckid))){model.legacyChecklistIds=[...oldIds,String(ckid)];added=true;}
    const legacyActivities=(model.activities||[]).filter(activity=>activity?.source?.type==='legacy-assigned-checklist'&&Array.isArray(activity.steps)&&activity.steps.length);
    if(legacyActivities.length){
     const oldActivityIds=new Set(legacyActivities.map(activity=>String(activity.id)));
     const migrated=legacyActivities.flatMap(activity=>expandChecklistItems({
      idPrefix:String(activity.id),title:name,description:activity.description||('Checklist: '+name),
      steps:activity.steps,turns:activity.turns||turns,photo:activity.photo|| (photoRequired?'required':'none'),
      mandatory:activity.mandatory!==false,recurrence:activity.recurrence||{type:'daily'},
      time:activity.time||'08:00',
      source:{checklistId:String(ckid),originalActivityId:String(activity.id)}
     }));
     model.activities=(model.activities||[]).filter(activity=>!oldActivityIds.has(String(activity.id))).concat(migrated);
     for(const [occurrenceId,occurrence] of Object.entries(D.occurrences)){
      if(oldActivityIds.has(String(occurrence.activityId))&&String(occurrence.assignmentId)===assignmentId&&occurrence.status==='pending'&&String(occurrence.date)>=day())delete D.occurrences[occurrenceId];
     }
     touch(model);added=true;
    }
   }
   if(!assignmentIds.has(assignmentId)){
    D.assignments.push(touch({id:assignmentId,modelId,executorId:pid,from:day(),until:null,active:true,source:'legacy-assigned-checklist'}));
    assignmentIds.add(assignmentId);added=true;
   }
   if(grantRoutinePermission(pid))added=true;
  });
  if(!S.migrations.includes(assignedChecklistMigration)){S.migrations.push(assignedChecklistMigration);added=true;}
  if(added)save();
 if(S.migrations.includes('routine-v1'))return;
 const recurrenceFor=days=>{const mapped=Core.legacyWeekdays(days);return{type:'weekly',days:mapped.length?mapped:[0,1,2,3,4,5,6]};};
 const activityFrom=(item,turn,index,source)=>{
  const checklist=item.ckid&&CK[item.ckid],steps=checklist?checklistItems(checklist):Array.isArray(item.steps)?item.steps.map(String):[];
  return touch({
   id:String(item.id||uid())+(turn?'|turn|'+index:''),
   title:String(item.t||'Atividade')+(turn?' — '+String(turn):''),
   description:item.desc||'',steps:[...steps],checklistSnapshot:[...steps],turns:turn?[String(turn)]:[],
   legacyChecklistByPerson:{...(item.ckByPerson||{})},
   source:{type:source,checklistId:item.ckid||''},functionId:'',
   photo:item.photoMode==='required'?'required':item.photoMode==='optional'?'optional':'none',
   mandatory:false,recurrence:recurrenceFor(item.days),time:item.time||'08:00',updatedAt:Date.now()
  });
 };
 for(const old of S.tmod||[]){
  if(!old?.id)continue;
  const id='legacy-model-'+old.id;
  if(!D.models.some(m=>m.id===id)){
   const activities=[];
   for(const item of old.items||[]){
    const turns=item.ckid&&CK[item.ckid]&&Array.isArray(CK[item.ckid].t)?CK[item.ckid].t.filter(Boolean):[];
    if(turns.length)turns.forEach((turn,index)=>activities.push(activityFrom(item,turn,index,'legacy-model-checklist')));
    else activities.push(activityFrom(item,'',0,'legacy-model'));
   }
   D.models.push(touch({id,name:old.n||'Rotina migrada',description:'Migrada do modelo antigo de cronograma.',legacyId:old.id,activities,createdAt:Date.now()}));
  }
  modelMap.set(String(old.id),id);
 }
 const ptGroups=new Map();
 for(const old of S.pt||[]){
  if(!old?.pid||!old.id)continue;
  const baseId=String(old.id).replace(/-turn-\d+$/,'');
  const key=String(old.pid)+'|'+baseId;
  if(!ptGroups.has(key))ptGroups.set(key,[]);
  ptGroups.get(key).push(old);
 }
 for(const rows of ptGroups.values()){
  const first=rows[0],pid=String(first.pid);
  let modelId=first.mid&&modelMap.get(String(first.mid));
  if(!modelId){
   modelId='legacy-personal-'+pid+'-'+String(first.id).replace(/-turn-\d+$/,'');
   if(!D.models.some(m=>m.id===modelId)){
    const activities=rows.map((row,index)=>{
     const checklist=row.ckid&&CK[row.ckid],steps=checklist?checklistItems(checklist):Array.isArray(row.steps)?row.steps.map(String):[];
     return touch({
      id:'legacy-activity-'+row.id,title:String(row.t||'Atividade migrada')+(row.ckt?' — '+String(row.ckt):''),
      description:row.desc||'',steps,checklistSnapshot:[...steps],turns:row.ckt?[String(row.ckt)]:[],
      source:{type:'legacy-personal-checklist',checklistId:row.ckid||'',legacyCkId:row.legacyCkId||''},
      functionId:'',photo:row.photoMode==='required'?'required':row.photoMode==='optional'?'optional':'none',
      mandatory:false,recurrence:recurrenceFor(row.days),time:row.time||'08:00',updatedAt:Date.now()
     });
    });
    D.models.push(touch({id:modelId,name:first.t||'Rotina individual migrada',description:'Atividade individual migrada do cronograma/checklist.',legacyId:first.id,activities,createdAt:Date.now()}));
   }
  }
  const archivedAt=rows.map(row=>row.archivedAt).filter(Boolean).sort().at(-1)||null;
  const from=dayValue(first.createdAt||first.from)||day();
  const assignmentId='legacy-assignment-'+pid+'-'+modelId+'-'+from+'-'+(archivedAt?dayValue(archivedAt):'active');
  if(!assignmentIds.has(assignmentId)){
   D.assignments.push(touch({id:assignmentId,modelId,executorId:pid,from,until:archivedAt?addDays(dayValue(archivedAt),-1):null,active:!archivedAt,source:'legacy-pt'}));
   assignmentIds.add(assignmentId);
  }
  if(!who(pid))S.routineMigrationWarnings.push(touch({id:'orphan-person-'+pid,personId:pid,reason:'A atribuição antiga aponta para uma pessoa que não existe mais no cadastro.',updatedAt:Date.now()}));
 }
 for(const old of S.tasks||[]){
  if(!old?.id)continue;
  const recipients=Array.isArray(old.r)?old.r:[];
  const resolved=recipients.map(name=>({name,matches:(S.team||[]).filter(p=>String(p.n).trim().toLocaleLowerCase()===String(name).trim().toLocaleLowerCase())}));
  const targets=resolved.filter(item=>item.matches.length===1).map(item=>item.matches[0]);
  for(const item of resolved.filter(item=>item.matches.length!==1)){
   S.routineMigrationWarnings.push(touch({id:'unmatched-task-'+old.id+'-'+String(item.name),taskId:old.id,recipient:String(item.name),reason:item.matches.length?'Nome de responsável duplicado no cadastro.':'Responsável não encontrado no cadastro.',updatedAt:Date.now()}));
  }
  const people=targets.length?targets:[null];
  for(const target of people){
   const pid=target?String(target.id):'';
   const ckid=old.ckByPerson&&(old.ckByPerson[pid]||old.ckByPerson[target?.n])||old.ckid||'';
   const checklist=ckid&&CK[ckid],turns=Array.isArray(old.turns)&&old.turns.length?[...old.turns]:checklist&&Array.isArray(checklist.t)?checklist.t.filter(Boolean):[];
   const modelId='legacy-task-'+old.id+'-'+(target?pid:'shared');
   if(!D.models.some(m=>m.id===modelId)){
    const repeat=old.repeat==='weekly'?{type:'weekly',days:[...(old.days||[])]}:old.repeat==='monthly'?{type:'monthly',days:[Number(old.day||1)]}:old.repeat==='date'?{type:'date',date:old.date||''}:{type:'daily'};
    const steps=checklist?checklistItems(checklist):Array.isArray(old.steps)?old.steps.map(String):[];
    const turnList=turns.length?turns:[''];
    const activities=turnList.map((turn,index)=>touch({
     id:'legacy-task-activity-'+old.id+(target?'-'+pid:'')+(turn?'|turn|'+index:''),
     title:String(old.t||'Atividade migrada')+(turn?' — '+String(turn):''),
     description:old.desc||'',steps:[...steps],checklistSnapshot:[...steps],turns:turn?[String(turn)]:[],
     legacyChecklistByPerson:{...(old.ckByPerson||{})},source:{type:'legacy-task',taskId:old.id,checklistId:ckid},
     functionId:'',photo:old.photoMode==='required'?'required':old.photoMode==='optional'?'optional':'none',
     mandatory:false,recurrence:repeat,time:old.time||'08:00',updatedAt:Date.now()
    }));
    D.models.push(touch({id:modelId,name:old.t||'Cronograma migrado',description:old.desc||'',legacyId:old.id,activities,createdAt:Date.now()}));
   }
   if(target){
    const assignmentId='legacy-task-assignment-'+old.id+'-'+pid;
    if(!assignmentIds.has(assignmentId)){
     D.assignments.push(touch({id:assignmentId,modelId,executorId:pid,from:dayValue(old.createdAt)||day(),until:null,active:true,source:'legacy-task'}));
     assignmentIds.add(assignmentId);
    }
   }
  }
 }
 S.migrations.push('routine-v1');
 save();
}
function refreshPending(m){for(const o of Object.values(db().occurrences)){if(o.status!=='pending'||o.date<day()||Core.state(o)!=='pending')continue;const at=db().assignments.find(a=>a.id===o.assignmentId);if(at?.modelId!==m.id)continue;const a=(m.activities||[]).find(x=>x.id===o.activityId);if(!a||!Core.occurs(a.recurrence,o.date)){Object.assign(o,{status:'dismissed',dismissedBy:'system',note:'Ocorrência cancelada após alteração do modelo.',updatedAt:Date.now()});continue;}o.snapshot=Core.snap(m,a);touch(o);}}
function generateDay(d=day()){const D=db(),r=Core.generate(D,d);r.created.forEach(o=>D.occurrences[o.id]=o);r.updated.forEach(o=>D.occurrences[o.id]=o);if(r.created.length||r.updated.length)save();return r;}
function syncFunctions(d=day()){let changed=false;for(const o of Object.values(db().occurrences)){if(o.date!==d||o.status!=='pending'||o.snapshot.photo==='required')continue;const f=FUNCOES[o.snapshot.functionId];if(!f?.feitoEm)continue;try{if(f.feitoEm(d,o.executorId)){Object.assign(o,{status:'done',madeAt:Date.now(),madeBy:'system',madeByName:'Sistema',viaSystem:true,updatedAt:Date.now()});changed=true;}}catch(err){console.warn('Falha ao verificar função da Rotina',err);}}if(changed)save();return changed;}
let photoPromise;
function photoDb(){if(!root.indexedDB)return Promise.reject(new Error('IndexedDB indisponível.'));if(!photoPromise)photoPromise=new Promise((ok,no)=>{const r=indexedDB.open('super-tudo-routine-photos',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('photos'))r.result.createObjectStore('photos');};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});return photoPromise;}
const req=r=>new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});
async function savePhoto(file){if(!file)return null;if(!root.createImageBitmap)throw new Error('Não foi possível preparar a foto neste navegador.');const bmp=await root.createImageBitmap(file),scale=Math.min(1,900/Math.max(bmp.width,bmp.height)),canvas=root.document.createElement('canvas');canvas.width=Math.max(1,Math.round(bmp.width*scale));canvas.height=Math.max(1,Math.round(bmp.height*scale));const ctx=canvas.getContext('2d',{alpha:false});if(!ctx){bmp.close?.();throw new Error('Não foi possível preparar a foto neste navegador.');}ctx.drawImage(bmp,0,0,canvas.width,canvas.height);bmp.close?.();const blob=await new Promise((ok,no)=>canvas.toBlob(b=>b?ok(b):no(new Error('Falha ao comprimir foto.')),'image/jpeg',.7)),id=uid(),d=await photoDb();await req(d.transaction('photos','readwrite').objectStore('photos').put(blob,id));return id;}
async function readPhoto(id){const d=await photoDb();return req(d.transaction('photos','readonly').objectStore('photos').get(id));}
async function deletePhoto(id){const d=await photoDb();return req(d.transaction('photos','readwrite').objectStore('photos').delete(id));}
function photoSheet(){return'<div class="ov dim" data-sheet-overlay onclick="rtPhotoClose()"></div><section class="sheet" data-sheet><div data-sheet-handle tabindex="0" role="button" aria-label="Arraste para fechar" style="height:22px;display:grid;place-items:center"><span style="width:38px;height:4px;border-radius:8px;background:var(--bd)"></span></div><div class="row sp"><h3>Prova da atividade</h3><button class="bt g" onclick="rtPhotoClose()">Fechar</button></div><img src="'+e(V.rtPhotoUrl||'')+'" alt="Foto de comprovação da atividade" style="display:block;width:100%;max-height:70vh;object-fit:contain;border-radius:var(--r-m);background:var(--sf)"></section>';}
function closePhoto(){const url=V.rtPhotoUrl;V.rtPhotoUrl='';V.sh=0;if(url)root.URL.revokeObjectURL(url);rMenu();}
async function viewPhoto(id){const o=db().occurrences[id];if(!o?.photoId)return;try{const blob=await readPhoto(o.photoId);if(!blob)return root.stAlert('A foto não está armazenada neste aparelho. Importe o backup de Rotinas que contém as fotos.');if(V.rtPhotoUrl)root.URL.revokeObjectURL(V.rtPhotoUrl);V.rtPhotoUrl=root.URL.createObjectURL(blob);V.sh='routine-photo';rMenu();}catch(err){root.stAlert(err.message||'Não foi possível abrir a foto.');}}
function canManage(){return(typeof isFullAccess==='function'&&isFullAccess())||!!V.me&&(['master','admin','gerente','encarregado'].includes(V.me.role)||(V.me.perm||[]).includes('r:cro'));}
function currentPerson(){return who(V.me?.id||V.cloudIdentity?.team_member_id||'');}
function team(){const p=currentPerson();return p&&typeof teamOf==='function'?teamOf(p):[];}
function modelPage(){
 if(V.rotChecklistHub&&typeof bridge.rRotChecklistHub==='function')return bridge.rRotChecklistHub();
 if(!canManage())return'<div class="c mu">Sem permissão para administrar Rotinas.</div>';
 generateDay();syncFunctions();const warnings=S.routineMigrationWarnings||[];
 return'<div class="row sp"><div><h2 style="margin:0">Modelos de Rotina</h2><p class="mu">Modelos reutilizáveis e atribuições por pessoa.</p></div><div class="row"><button class="bt g" onclick="V.rotChecklistHub=true;R()">☑ Modelos de checklist</button><button class="bt" onclick="rtNew()">+ Criar</button></div></div>'+(warnings.length?'<div class="c wa"><b>Revisar atribuições antigas</b><p class="mu">'+warnings.length+' registro(s) antigo(s) não puderam ser associados automaticamente a uma pessoa. Os dados originais foram preservados.</p></div>':'')+db().models.filter(m=>!m.archivedAt).map(m=>'<div class="c"><div class="row sp"><b>'+e(m.name)+'</b><span class="b ok">'+(m.activities||[]).length+' atividade(s)</span></div><p class="mu">'+e(m.description||'Sem descrição')+'</p><div class="row"><button class="bt g" onclick="rtEdit(\''+e(m.id)+'\')">Editar</button><button class="bt g" onclick="rtCopy(\''+e(m.id)+'\')">Duplicar</button><button class="bt d" onclick="rtArchive(\''+e(m.id)+'\')">Arquivar</button></div></div>').join('')||'<div class="c mu">Nenhum modelo cadastrado.</div>';}
function defaults(){return{id:uid(),title:'',description:'',steps:[],checklistSnapshot:[],source:{type:'manual'},functionId:'',photo:'none',mandatory:true,recurrence:{type:'weekly',days:[0,1,2,3,4,5,6]},time:'08:00'};}
function newModel(){V.rtDraft={id:'new',name:'',description:'',activities:[]};V.rtExtraTarget='';V.rtChecklist='';V.sh='routine-editor';rMenu();}
function editModel(id){const m=db().models.find(x=>x.id===id);if(!m)return;V.rtDraft=clone(m);V.rtExtraTarget='';V.rtChecklist='';V.sh='routine-editor';rMenu();}
function duplicateModel(id){const m=db().models.find(x=>x.id===id);if(!m)return;V.rtDraft=clone(m);V.rtDraft.id='new';V.rtDraft.name+=' (cópia)';V.rtDraft.activities=V.rtDraft.activities.map(a=>({...a,id:uid()}));V.sh='routine-editor';rMenu();}
function readDraft(){const d=V.rtDraft;if(!d)return;d.name=($('rt-name')?.value||'').trim();d.description=$('rt-description')?.value||'';delete d.profile;delete d.sector;d.activities=d.activities.map((a,i)=>{const g=k=>$('rt-'+k+'-'+i),mode=g('mode')?.dataset.valor||a.recurrence?.type||'weekly',endMode=g('end')?.dataset.valor||'never',days=String(g('days')?.dataset.valor||'').split(',').filter(Boolean).map(Number),monthDays=String(g('month-days')?.dataset.valor||'').split(',').filter(Boolean).map(Number),dates=String(g('dates')?.dataset.valor||'').split(',').filter(Boolean).sort();let recurrence;if(mode==='once')recurrence={type:'date',date:g('once')?.dataset.valor||day()};else if(mode==='dates')recurrence={type:'dates',dates};else{recurrence={type:mode,startDate:g('start')?.dataset.valor||day()};if(mode==='weekly')recurrence.days=days;if(mode==='monthly')recurrence.days=monthDays;if(endMode==='count')recurrence.count=Math.max(1,Math.min(999,Number(g('count')?.value)||1));if(endMode==='date')recurrence.endDate=g('end-date')?.dataset.valor||'';}return{...a,title:(g('title')?.value||'').trim(),description:g('desc')?.value||'',functionId:g('fn')?.dataset.valor||'',photo:g('photo')?.dataset.valor||'none',mandatory:g('mandatory')?.dataset.valor==='true',recurrence,time:Pickers?.formatTime(g('time')?.dataset.valor)||'08:00'};});return d;}
function activityHtml(a,i){const r=a.recurrence||{type:'weekly',days:[0,1,2,3,4,5,6]},mode=r.type==='date'?'once':r.type==='dates'?'dates':r.type||'weekly',selected=r.type==='weekly'?(r.days||[]).map(Number):r.type==='daily'?[0,1,2,3,4,5,6]:[],functions=Object.entries(FUNCOES).map(([id,f])=>({v:id,t:f.label})),modePicker=Pickers.segmentado([{v:'once',t:'Uma vez'},{v:'dates',t:'Datas específicas'},{v:'daily',t:'Diária'},{v:'weekly',t:'Semanal'},{v:'monthly',t:'Mensal'}],mode,{id:'rt-mode-'+i,label:'Frequência'}).replace('data-picker="segment"','data-picker="segment" data-repeat-mode'),endMode=r.count?'count':r.endDate?'date':'never',endPicker=Pickers.segmentado([{v:'never',t:'Sem término'},{v:'count',t:'Após quantidade'},{v:'date',t:'Até uma data'}],endMode,{id:'rt-end-'+i,label:'Término'}).replace('data-picker="segment"','data-picker="segment" data-repeat-end-mode'),days=Pickers.campoDias(selected,{id:'rt-days-'+i,label:'Dias da semana'}),monthDays=Pickers.campoDiaMes(r.type==='monthly'?(r.days||[]):[1],{id:'rt-month-days-'+i,label:'Dias do mês'}),dates=Pickers.campoDatas(r.dates||[],{id:'rt-dates-'+i}),once=Pickers.campoData(r.type==='date'?r.date:day(),{id:'rt-once-'+i,label:'Data da atividade'}),start=Pickers.campoData(r.startDate||day(),{id:'rt-start-'+i,label:'Começa em'}),endDate=Pickers.campoData(r.endDate||day(),{id:'rt-end-date-'+i,label:'Último dia'}),photo=Pickers.segmentado([{v:'none',t:'Não'},{v:'optional',t:'Opcional'},{v:'required',t:'Obrigatória'}],a.photo||'none',{id:'rt-photo-'+i,label:'Foto na conclusão'}),fn=Pickers.campoEscolha(functions,a.functionId||'',{id:'rt-fn-'+i,label:'Função associada',emptyLabel:'Nenhuma'}),time=Pickers.campoHora(a.time||'08:00',{id:'rt-time-'+i,label:'Horário',passo:5}),mandatory=Pickers.interruptor('Atividade obrigatória',a.mandatory!==false,{id:'rt-mandatory-'+i});return'<div class="c"><div class="row sp"><b>Atividade '+(i+1)+'</b><button class="bt d" onclick="rtRemove('+i+')">Excluir</button></div><label>Título<input id="rt-title-'+i+'" value="'+e(a.title)+'"></label><label>Instruções<textarea id="rt-desc-'+i+'" rows="2">'+e(a.description||'')+'</textarea></label><div class="u-mt8"><label>Função associada</label>'+fn+'</div><div class="stp-activity-controls"><div><label>Foto na conclusão</label>'+photo+'</div><div><label>Horário</label>'+time+'</div></div>'+mandatory+'<div class="u-mt8"><b>Quando realizar</b><p class="mu">Escolha uma data, dias específicos ou uma frequência.</p>'+modePicker+'<div class="stp-recurrence-section" data-repeat-section="once" '+(mode==='once'?'':'hidden')+'><label>Data</label>'+once+'</div><div class="stp-recurrence-section" data-repeat-section="dates" '+(mode==='dates'?'':'hidden')+'><label>Datas escolhidas</label>'+dates+'</div><div class="stp-recurrence-section" data-repeat-section="weekly" '+(mode==='weekly'?'':'hidden')+'><label>Dias da semana</label>'+days+'</div><div class="stp-recurrence-section" data-repeat-section="monthly" '+(mode==='monthly'?'':'hidden')+'><label>Dias do mês</label>'+monthDays+'</div><div class="stp-recurrence-section" data-repeat-section="recurring" '+(['daily','weekly','monthly'].includes(mode)?'':'hidden')+'><label>Começa em</label>'+start+'<label class="u-mt8">Quando parar</label>'+endPicker+'<div data-repeat-end="count" '+(endMode==='count'?'':'hidden')+'><label>Quantidade de vezes<input id="rt-count-'+i+'" type="number" min="1" max="999" step="1" value="'+(Number(r.count)||2)+'"></label></div><div data-repeat-end="date" '+(endMode==='date'?'':'hidden')+'><label>Repetir até</label>'+endDate+'</div></div></div></div>'; }
function syncRecurrenceFields(card){const mode=card.querySelector('[data-repeat-mode]')?.dataset.valor||'weekly',end=card.querySelector('[data-repeat-end-mode]')?.dataset.valor||'never';card.querySelectorAll('[data-repeat-section]').forEach(section=>{const name=section.dataset.repeatSection;section.hidden=name==='recurring'?!['daily','weekly','monthly'].includes(mode):name===mode?false:true;});card.querySelectorAll('[data-repeat-end]').forEach(section=>section.hidden=section.dataset.repeatEnd!==end);}
function bindRecurrenceFields(){if(!root.document||root.__stRoutineRecurrenceBound)return;root.__stRoutineRecurrenceBound=true;root.document.addEventListener('change',event=>{if(!event.target?.matches?.('[data-repeat-mode],[data-repeat-end-mode]'))return;const card=event.target.closest('.c');if(card)syncRecurrenceFields(card);});root.document.addEventListener('click',event=>{const target=event.target?.closest?.('[data-repeat-mode],[data-repeat-end-mode]');if(!target)return;const card=target.closest('.c');if(card)root.requestAnimationFrame?.(()=>syncRecurrenceFields(card));});}
bindRecurrenceFields();
function checklistPanel(){const list=Object.entries(CK||{}).filter(([,c])=>c&&!c.p&&!c.rc&&!c.rm),c=V.rtChecklist&&CK[V.rtChecklist];return'<label>Copiar itens de checklist<select onchange="rtChooseChecklist(this.value)"><option value="">Selecione</option>'+list.map(([id,x])=>'<option value="'+e(id)+'" '+(id===V.rtChecklist?'selected':'')+'>'+e(x.n)+'</option>').join('')+'</select></label>'+(c?'<div class="c">'+checklistItems(c).map((x,i)=>'<label><input type="checkbox" name="rt-ci" value="'+i+'" checked> '+e(x)+'</label>').join('')+'<button class="bt g" onclick="rtImportChecklist()">Copiar selecionados</button></div>':'');}
function editorSheet(){const d=V.rtDraft||{activities:[]};return'<div class="ov dim" data-sheet-overlay onclick="V.sh=0;rMenu()"></div><section class="sheet" data-sheet><div data-sheet-handle tabindex="0" role="button" aria-label="Arraste para fechar" style="height:22px;display:grid;place-items:center"><span style="width:38px;height:4px;border-radius:8px;background:var(--bd)"></span></div><div class="row sp"><h3>'+(d.id==='new'?'Criar Rotina':'Editar Rotina')+'</h3><button class="bt g" onclick="V.sh=0;rMenu()">Fechar</button></div><label>Nome<input id="rt-name" value="'+e(d.name)+'"></label><label>Descrição<textarea id="rt-description">'+e(d.description||'')+'</textarea></label><h3>Atividades</h3>'+d.activities.map(activityHtml).join('')+'<button class="bt g" onclick="rtAdd()">+ Atividade manual</button><div class="c"><h4>Importar checklist (cópia)</h4>'+checklistPanel()+'</div><div class="c"><label>Duplicar atividades de outra Rotina<select id="rt-copy-source"><option value="">Selecione</option>'+db().models.filter(m=>!m.archivedAt&&m.id!==d.id).map(m=>'<option value="'+e(m.id)+'">'+e(m.name)+'</option>').join('')+'</select></label><button class="bt g" onclick="rtCopyActivities()">Copiar atividades</button></div><div class="row u-mt8"><button class="bt" onclick="rtSave()">Salvar modelo</button><button class="bt g" onclick="V.sh=0;rMenu()">Cancelar</button></div></section>';}
function before(){if(V.rtDraft)readDraft();}
function addActivity(){before();V.rtDraft.activities.push(defaults());rMenu();}
function removeActivity(i){before();V.rtDraft.activities.splice(i,1);rMenu();}
function chooseChecklist(id){before();V.rtChecklist=id;rMenu();}
function importChecklist(){before();const c=CK[V.rtChecklist];if(!c)return;const selected=[...document.querySelectorAll('input[name="rt-ci"]:checked')].map(x=>+x.value),items=checklistItems(c).filter((_,i)=>selected.includes(i));if(!items.length)return root.stAlert('Selecione itens para copiar.');items.forEach(title=>{const a=defaults();a.title=title;a.source={type:'checklist-copy',checklistId:V.rtChecklist};a.checklistSnapshot=[title];V.rtDraft.activities.push(a);});rMenu();}
function copyActivities(){before();const m=db().models.find(x=>x.id===$('rt-copy-source')?.value);if(!m)return;V.rtDraft.activities.push(...clone(m.activities).map(a=>({...a,id:uid()})));rMenu();}
function saveModel(){readDraft();const d=V.rtDraft;if(!d?.name)return root.stAlert('Informe o nome do modelo.');if(!d.activities.length||d.activities.some(a=>!a.title))return root.stAlert('Informe o título de todas as atividades.');if(d.activities.some(a=>a.recurrence.type==='weekly'&&!a.recurrence.days?.length||a.recurrence.type==='monthly'&&!a.recurrence.days?.length||a.recurrence.type==='date'&&!a.recurrence.date||a.recurrence.type==='dates'&&!a.recurrence.dates?.length||['daily','weekly','monthly'].includes(a.recurrence.type)&&(!a.recurrence.startDate||a.recurrence.count!==undefined&&(!Number.isInteger(Number(a.recurrence.count))||Number(a.recurrence.count)<1)||a.recurrence.endDate!==undefined&&!parseDate(a.recurrence.endDate))))return root.stAlert('Complete as regras de recorrência.');const list=db().models,id=d.id==='new'?'rtm-'+uid():d.id,old=list.find(x=>x.id===id),m=touch({...d,id,activities:d.activities.map(a=>({...a,updatedAt:Date.now()})),createdAt:old?.createdAt||Date.now(),archivedAt:null});if(old)Object.assign(old,m);else list.push(m);refreshPending(m);if(V.rtExtraTarget)db().assignments.push(touch({id:'rta-'+uid(),modelId:id,executorId:String(V.rtExtraTarget),from:day(),until:null,active:true,source:'manual-extra'}));V.rtDraft=null;V.rtExtraTarget='';V.sh=0;save();rMenu();R();}
function archiveModel(id){const m=db().models.find(x=>x.id===id);if(!m)return;Promise.resolve(root.stConfirm('Arquivar o modelo? O histórico será preservado.')).then(ok=>{if(!ok)return;m.archivedAt=day();touch(m);db().assignments.filter(a=>a.modelId===id).forEach(a=>{a.active=false;touch(a);});save();R();});}
function personSection(p){const pid=String(p.id),leader=supervisor(pid),assignments=db().assignments.filter(a=>String(a.executorId)===pid),rows=assignments.map(a=>{const active=Core.activeOn(a,day());return'<div class="it"><div><b>'+e(db().models.find(m=>m.id===a.modelId)?.name||'Modelo indisponível')+'</b><div class="mu">'+(active?'Ativa':'Encerrada')+' · responsável '+e(leader?.n||'Liderança não definida em Dados')+'</div></div>'+(active?'<button class="bt d" onclick="rtEnd(\''+e(a.id)+'\')">Encerrar</button>':'')+'</div>';}).join('');return'<div class="c"><div class="row sp"><b>Rotinas</b><button class="bt g" onclick="rtExtra(\''+e(pid)+'\')">+ Atividade extra</button></div>'+(rows||'<p class="mu">Nenhuma rotina atribuída.</p>')+'<label>Modelo<select id="rt-assign-'+e(pid)+'"><option value="">Selecione</option>'+db().models.filter(m=>!m.archivedAt).map(m=>'<option value="'+e(m.id)+'">'+e(m.name)+'</option>').join('')+'</select></label>'+(leader?'<p class="mu">👑 Responsável definido em Dados: '+e(leader.n)+'</p>':'<p class="mu">Defina o líder e os subordinados em Dados para compartilhar a responsabilidade.</p>')+'<button class="bt" onclick="rtAssign(\''+e(pid)+'\')">Atribuir rotina</button></div>'; }
function assign(pid){const mid=$('rt-assign-'+pid)?.value;if(!mid)return root.stAlert('Escolha um modelo.');if(db().assignments.some(a=>a.modelId===mid&&String(a.executorId)===pid&&Core.activeOn(a,day())))return root.stAlert('Esse modelo já está atribuído.');db().assignments.push(touch({id:'rta-'+uid(),modelId:mid,executorId:pid,from:day(),until:null,active:true,source:'person-profile'}));const person=who(pid);if(person){person.perm=Array.isArray(person.perm)?person.perm:[];if(!person.perm.includes('r:rot'))person.perm=[...person.perm,'r:rot'];}save();R();}
function extra(pid){V.rtExtraTarget=pid;V.rtDraft={id:'new',name:'Atividade extra - '+whoName(pid),description:'Atividade individual adicional.',activities:[defaults()]};V.sh='routine-editor';rMenu();}
function endAssignment(id){const a=db().assignments.find(x=>x.id===id);if(!a)return;a.until=addDays(day(),-1);a.active=false;touch(a);save();R();}
function currentPerson(){return who(V.me?.id||V.cloudIdentity?.team_member_id||'');}
function visibleTeam(){const p=currentPerson();return p&&typeof teamOf==='function'?teamOf(p):[];}
function canSee(id){if(typeof isFullAccess==='function'&&isFullAccess())return true;const p=currentPerson();return!!p&&(String(p.id)===String(id)||visibleTeam().some(x=>String(x.id)===String(id)));}
function list(ids){return Object.values(db().occurrences).filter(o=>o.date===day()&&ids.includes(String(o.executorId))).sort((a,b)=>(Core.state(a)==='overdue'?-1:0)-(Core.state(b)==='overdue'?-1:0)||Core.hm(a.snapshot.time)-Core.hm(b.snapshot.time));}
function card(o){
 const st=Core.state(o),s=o.snapshot,master=typeof isFullAccess==='function'&&isFullAccess();
 const allowed=!master&&canSee(o.executorId)&&st!=='dismissed'&&!o.viaSystem;
 const checked=o.status==='done',status=st==='overdue'?'Atrasada':st==='dismissed'?'Dispensada':checked?'Concluída':'';
 return '<article class="c rt-task-row" data-routine-id="'+e(o.id)+'"><button type="button" class="rt-task-check '+(checked?'is-checked':'')+'" '+(!allowed?'disabled':'')+' aria-label="'+(checked?'Desmarcar ':'Marcar ')+e(s.title)+'" aria-checked="'+(checked?'true':'false')+'" role="checkbox" onclick="rtToggle(\''+e(o.id)+'\')">'+(checked?'<span aria-hidden="true">✓</span>':'')+'</button><button type="button" class="rt-task-open" onclick="rtDetails(\''+e(o.id)+'\')"><span class="rt-task-copy"><b>'+e(s.title)+'</b><span class="mu">'+(s.time?'Até '+e(s.time):'Sem horário definido')+'</span></span>'+(status?'<span class="rt-task-status '+(st==='overdue'?'is-late':checked?'is-done':'')+'">'+e(status)+'</span>':'')+'<span class="rt-task-chevron" aria-hidden="true">›</span></button></article>';
}
function refreshTaskRow(id,motion){\n const o=db().occurrences[id];if(!o)return false;\n const rows=[...root.document.querySelectorAll('.rt-task-row[data-routine-id]')],row=rows.find(node=>node.dataset.routineId===String(id));\n if(!row)return false;\n row.outerHTML=card(o);\n const updated=[...root.document.querySelectorAll('.rt-task-row[data-routine-id]')].find(node=>node.dataset.routineId===String(id));\n if(updated&&motion){updated.classList.add(motion);const check=updated.querySelector('.rt-task-check');if(check)check.setAttribute('aria-checked',o.status==='done'?'true':'false');}\n return true;\n}\nfunction openDetails(id,needsPhoto=false){const o=db().occurrences[id];if(!o)return;V.rtDetailId=id;V.rtDetailNeedsPhoto=!!needsPhoto;V.sh='routine-details';rMenu();}
function closeDetails(){V.rtDetailId='';V.rtDetailNeedsPhoto=false;V.sh=0;rMenu();}
function detailsSheet(){
 const o=db().occurrences[V.rtDetailId];if(!o)return '';
 const s=o.snapshot,st=Core.state(o),fn=FUNCOES[s.functionId],master=typeof isFullAccess==='function'&&isFullAccess();
 const allowed=!master&&canSee(o.executorId)&&st!=='dismissed'&&!o.viaSystem;
 const photoLabel=s.photo==='required'?'Obrigatória':s.photo==='optional'?'Opcional':'Não exigida';
 const recurrence=s.recurrence||{},weekdays=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
 const recurrenceText=recurrence.type==='daily'?'Todos os dias':recurrence.type==='weekly'?'Semanal · '+(recurrence.days||[]).map(day=>weekdays[Number(day)]).filter(Boolean).join(', '):recurrence.type==='monthly'?'Mensal · dia(s) '+(recurrence.days||[]).join(', '):recurrence.type==='date'?'Uma vez · '+(Core.dateValue(recurrence.date)||'data específica'):recurrence.type==='dates'?'Datas específicas · '+(recurrence.dates||[]).map(Core.dateValue).filter(Boolean).join(', '):'Conforme programação';
 const recurrenceInfo=recurrenceText+(s.turns?.length?' · Turno: '+s.turns.join(', '):'');
 const statusLabel=st==='done'?'Concluída':st==='overdue'?'Atrasada':st==='dismissed'?'Dispensada':'Pendente';
 const made=o.status==='done'?(o.viaSystem?'Concluída automaticamente pelo sistema':'Marcada por '+e(o.madeByName||whoName(o.madeBy))+(o.madeAt?' às '+new Date(o.madeAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'')):'';
 const steps=s.steps&&s.steps.length?'<div class="rt-detail-block"><b>Etapas e orientações</b><ul>'+s.steps.map(step=>'<li>'+e(step)+'</li>').join('')+'</ul></div>':'';
 const photoInput=allowed&&s.photo!=='none'&&o.status!=='done'?'<div class="rt-detail-block"><b>Comprovação por foto</b><p class="mu">'+(s.photo==='required'?'Esta atividade exige uma foto para ser marcada.':'Você pode anexar uma foto como comprovação.')+'</p><label class="bt g rt-photo-pick" for="rt-photo-'+e(o.id)+'">📷 '+(s.photo==='required'?'Adicionar foto obrigatória':'Adicionar foto (opcional)')+'</label><input id="rt-photo-'+e(o.id)+'" type="file" accept="image/*" capture="environment" class="rt-photo-input"></div>':'';
 const needPhoto=!!V.rtDetailNeedsPhoto&&s.photo==='required'&&!o.photoId;
 return '<div class="ov dim" data-sheet-overlay onclick="rtDetailsClose()"></div><section class="sheet rt-details-sheet" data-sheet role="dialog" aria-modal="true" aria-label="Detalhes da atividade"><div class="row sp rt-sheet-head"><div><span class="rt-sheet-kicker">DETALHES DA ATIVIDADE</span><h3>'+e(s.title)+'</h3></div><button type="button" class="bt g" onclick="rtDetailsClose()" aria-label="Fechar">Fechar</button></div><div class="rt-detail-status">'+e(statusLabel)+(st==='overdue'?' · '+e(s.time||''):'')+'</div>'+(needPhoto?'<div class="rt-photo-warning">Para marcar esta atividade, primeiro adicione a foto obrigatória.</div>':'')+'<div class="rt-detail-grid"><div class="rt-detail-block"><span class="mu">Horário limite</span><b>'+(s.time?e(s.time):'Não definido')+'</b></div><div class="rt-detail-block"><span class="mu">Foto na conclusão</span><b>'+photoLabel+'</b></div><div class="rt-detail-block"><span class="mu">Obrigatoriedade</span><b>'+(s.mandatory?'Obrigatória':'Opcional')+'</b></div><div class="rt-detail-block"><span class="mu">Responsável</span><b>'+e(whoName(o.executorId))+'</b></div><div class="rt-detail-block"><span class="mu">Frequência</span><b>'+e(recurrenceInfo)+'</b></div></div>'+(s.description?'<div class="rt-detail-block"><b>Instruções</b><p>'+e(s.description)+'</p></div>':'')+steps+(made?'<div class="rt-detail-block"><b>Registro</b><p>'+made+'</p></div>':'')+(o.photoId?'<div class="rt-detail-block"><b>Comprovação</b><p>Foto anexada.</p><button type="button" class="bt g" onclick="rtPhoto(\''+e(o.id)+'\')">Ver foto</button></div>':'')+photoInput+(fn?'<div class="rt-detail-block"><button type="button" class="bt g" onclick="rtOpenFn(\''+e(s.functionId)+'\')">Abrir função associada</button></div>':'')+(allowed?'<div class="rt-detail-actions">'+(o.status==='done'?'<button type="button" class="bt g" onclick="rtToggle(\''+e(o.id)+'\')">Desmarcar atividade</button>':'<button type="button" class="bt" onclick="rtDone(\''+e(o.id)+'\')">'+(s.photo==='required'?'Confirmar marcação':'Marcar atividade')+'</button>')+(o.status!=='done'?'<button type="button" class="bt g" onclick="rtDismiss(\''+e(o.id)+'\')">Dispensar atividade</button>':'')+'</div>':'')+'</section>';
}
function todayScreen(){generateDay();syncFunctions();const p=currentPerson(),master=typeof isFullAccess==='function'&&isFullAccess(),teamIds=master?(S.team||[]).filter(x=>!x.adm&&/encarregado/i.test(String(x.f||''))).map(x=>String(x.id)):visibleTeam().map(x=>String(x.id)),mine=p?[String(p.id)]:[],canTeam=master||teamIds.length>0,tab=master?'team':canTeam?(V.rtTab||'mine'):'mine',items=list(tab==='team'?teamIds:mine),done=items.filter(x=>x.status==='done').length,pct=items.length?Math.round(done/items.length*100):null;let html='<div class="row sp"><div><h2 style="margin:0">Rotina de hoje</h2><p class="mu">'+e(day())+'</p></div><button class="bt g" onclick="V.tab=\'reg\';V.rs=\'rot\';R()">Modelos</button></div>';if(canTeam&&!master)html+='<div class="chs"><button class="ch '+(tab==='mine'?'on':'')+'" onclick="V.rtTab=\'mine\';R()">Minha rotina</button><button class="ch '+(tab==='team'?'on':'')+'" onclick="V.rtTab=\'team\';R()">Equipe</button></div>';html+='<div class="c row sp"><div><div class="mu">Progresso do dia</div><div class="big">'+(pct==null?'—':pct+'%')+'</div><div class="mu">'+done+' de '+items.length+' concluídas</div></div><div class="st-check-ring" style="--st-progress:'+(pct||0)+'%"><span>'+(pct==null?'—':pct+'%')+'</span></div></div>';if(tab==='team'){const groups=new Map();items.forEach(o=>{const k=String(o.executorId);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(o);});html+=[...groups].map(([pid,rows])=>{const done=rows.filter(o=>o.status==='done').length,pct=Math.round(done/rows.length*100);return'<section class="c"><div class="row sp"><b>'+e(whoName(pid))+'</b><div class="row"><span class="mu">'+done+'/'+rows.length+'</span><div class="st-check-ring" style="--st-progress:'+pct+'%"><span>'+pct+'%</span></div></div></div>'+rows.map(card).join('')+'</section>';}).join('')||'<div class="c mu">Nenhuma rotina atribuída à equipe hoje.</div>';}else html+=items.map(card).join('')||'<div class="c mu">Nenhuma atividade atribuída para hoje.</div>';return html;}
async function dismiss(id){const o=db().occurrences[id];if(!o||!canSee(o.executorId)||o.status==='done'||o.status==='dismissed')return;const confirm=root.stConfirm?root.stConfirm('Dispensar esta atividade? Ela ficará registrada no histórico.'):Promise.resolve(root.confirm('Dispensar esta atividade?'));if(!await Promise.resolve(confirm))return;const me=V.me||V.cloudIdentity||{},mid=me.id||me.team_member_id||'';Object.assign(o,{status:'dismissed',dismissedAt:Date.now(),dismissedBy:mid||'unknown',dismissedByName:who(mid)?.n||me.n||me.name||'Usuário atual',updatedAt:Date.now()});save();R();}
async function complete(id){
 const o=db().occurrences[id];if(!o||!canSee(o.executorId)||o.status==='done'||o.status==='dismissed'||o.viaSystem)return;
 const file=$('rt-photo-'+id)?.files?.[0]||null;
 if(o.snapshot.photo==='required'&&!file&&!o.photoId){openDetails(id,true);return;}
 try{if(file)o.photoId=await savePhoto(file);const me=V.me||V.cloudIdentity||{},mid=me.id||me.team_member_id||'';Object.assign(o,{status:'done',madeAt:Date.now(),madeBy:mid||'unknown',madeByName:who(mid)?.n||me.n||me.name||'Usuário atual',viaSystem:false,updatedAt:Date.now()});save();if(V.sh==='routine-details'){V.sh=0;V.rtDetailId='';V.rtDetailNeedsPhoto=false;}if(!refreshTaskRow(id,'is-completing'))R();}
 catch(err){root.stAlert(err.message||'Não foi possível concluir.');}
}
async function undoComplete(id){
 const o=db().occurrences[id];if(!o||o.status!=='done'||o.viaSystem||!canSee(o.executorId)||typeof isFullAccess==='function'&&isFullAccess())return;
 const photoId=o.photoId;Object.assign(o,{status:'pending',madeAt:null,madeBy:null,madeByName:'',viaSystem:false,photoId:null,updatedAt:Date.now()});
 try{if(photoId)await deletePhoto(photoId);}catch(err){console.warn('Não foi possível remover a foto local da marcação desfeita.',err);}
 save();if(V.sh==='routine-details'){V.sh=0;V.rtDetailId='';V.rtDetailNeedsPhoto=false;}if(!refreshTaskRow(id,'is-unchecking'))R();
}
async function toggleComplete(id){
 const o=db().occurrences[id];if(!o||!canSee(o.executorId)||typeof isFullAccess==='function'&&isFullAccess()||o.status==='dismissed'||o.viaSystem)return;
 if(o.status==='done')return undoComplete(id);
 if(o.snapshot.photo==='required'&&!o.photoId){openDetails(id,true);return;}
 return complete(id);
}
const oldMenu=rMenuCore;if(typeof oldMenu==='function')rMenuCore=function(){if(V.sh==='routine-editor'||V.sh==='routine-photo'||V.sh==='routine-details'){$('mn').innerHTML='';$('sh').innerHTML=V.sh==='routine-editor'?editorSheet():V.sh==='routine-photo'?photoSheet():detailsSheet();return;}return oldMenu();};bridge.rMenuCore=rMenuCore;
bridge.rCroMain=todayScreen;bridge.rRotReg=modelPage;bridge.rCroReg=modelPage;bridge.rRot=todayScreen;bridge.rRotEmp=todayScreen;bridge.ptHTML=personSection;
root.rtNew=newModel;root.rtEdit=editModel;root.rtCopy=duplicateModel;root.rtArchive=archiveModel;root.rtAdd=addActivity;root.rtRemove=removeActivity;root.rtChooseChecklist=chooseChecklist;root.rtImportChecklist=importChecklist;root.rtCopyActivities=copyActivities;root.rtSave=saveModel;root.rtAssign=assign;root.rtExtra=extra;root.rtEnd=endAssignment;root.rtDone=complete;root.rtToggle=toggleComplete;root.rtDetails=openDetails;root.rtDetailsClose=closeDetails;root.rtDismiss=dismiss;root.rtOpenFn=id=>FUNCOES[id]?.abrir?.();root.rtPhoto=viewPhoto;root.rtPhotoClose=closePhoto;
root.rtGenerateDay=generateDay;root.rtSyncFunctions=syncFunctions;root.rtMigrate=migrate;
migrate();generateDay();syncFunctions();
const originalRender=R;let rendering=false;if(typeof originalRender==='function'){R=function(){if(!rendering){rendering=true;try{generateDay();syncFunctions();}finally{rendering=false;}}return originalRender.apply(this,arguments);};bridge.R=R;}
root.addEventListener('focus',()=>{generateDay();syncFunctions();});root.addEventListener('st:cloud-sync-ready',()=>{migrate();generateDay();syncFunctions();if(typeof R==='function')R();});if(root.__ST_CLOUD_SYNC_READY__){migrate();generateDay();syncFunctions();if(typeof R==='function')R();}root.document.addEventListener('visibilitychange',()=>{if(!root.document.hidden){generateDay();syncFunctions();}});
function scheduleLocalMidnight(){const now=new Date(),next=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1,0,0,5);root.setTimeout(()=>{generateDay();syncFunctions();scheduleLocalMidnight();},Math.max(1000,next.getTime()-now.getTime()));}scheduleLocalMidnight();

/* Fichas técnicas de receitas da padaria — extensão de Lançamentos */
(function registerBakeryRecipes(){
 const recipeKey='receitas';
 FS[recipeKey]=FS[recipeKey]||{n:'Ficha técnica de receitas',e:'🥖',f:'',F:[],ti:recipe=>recipe?.nome||'Receita'};
 if(!LANC_KEYS.includes(recipeKey))LANC_KEYS.push(recipeKey);
 if(bridge.REG_MENU_ICON_PATHS)bridge.REG_MENU_ICON_PATHS[recipeKey]='<path d="M4 10.5c0-2.5 2-4.5 4.5-4.5h7A4.5 4.5 0 0 1 20 10.5V19H4z"/><path d="M4 13h16M7 6l-1-2M12 5V2M17 6l1-2M8 16h.01M12 16h.01M16 16h.01"/>';
 const originalLaunchRenderer=bridge.rRegLanc;
 const recipeList=()=>{S.log=S.log&&typeof S.log==='object'?S.log:{};S.log[recipeKey]=Array.isArray(S.log[recipeKey])?S.log[recipeKey]:[];return S.log[recipeKey];};
 const recipeCanWrite=()=>typeof isFullAccess==='function'&&isFullAccess()||!!V.me&&(V.me.perm||[]).includes('l:receitas');
 const recipeBlank=()=>({id:'new',...Core.recipes.normalize({ingredientes:[Core.recipes.ingredient()],usaEmbalagem:'nao',responsavel:V.me?.n||V.cloudIdentity?.name||'',dataVersao:Core.localDate().split('-').reverse().join('/')+' · v1'})});
 const recipeField=(key,value)=>{if(!V.recipeDraft||!['nome','pesoInicial','pesoFinal','rendimento','unidadeRendimento','pessoas','tempoPreparo','tempoForno','preparo','usaEmbalagem','tipoEmbalagem','quantidadeEmbalagem','responsavel','dataVersao'].includes(key))return;V.recipeDraft[key]=value;};
 const recipeIngredientField=(index,key,value)=>{const row=V.recipeDraft?.ingredientes?.[index];if(!row||!['nome','unidade','peso'].includes(key))return;row[key]=value;};
 const recipeAddIngredient=()=>{if(!V.recipeDraft)return;if(V.recipeDraft.ingredientes.length>=14)return root.stAlert('A ficha permite até 14 ingredientes.');V.recipeDraft.ingredientes.push(Core.recipes.ingredient());R();};
 const recipeRemoveIngredient=index=>{if(!V.recipeDraft)return;V.recipeDraft.ingredientes.splice(index,1);if(!V.recipeDraft.ingredientes.length)V.recipeDraft.ingredientes.push(Core.recipes.ingredient());R();};
 const recipeNew=()=>{if(!recipeCanWrite())return root.stAlert('Você não tem permissão para cadastrar receitas.');V.recipeDraft=recipeBlank();R();};
 const recipeEdit=id=>{if(!recipeCanWrite())return root.stAlert('Você não tem permissão para editar receitas.');const recipe=recipeList().find(item=>String(item.id)===String(id));if(!recipe)return;V.recipeDraft={...Core.recipes.normalize(recipe),id:recipe.id,createdAt:recipe.createdAt||null};if(!V.recipeDraft.ingredientes.length)V.recipeDraft.ingredientes=[Core.recipes.ingredient()];R();};
 const recipeCancel=()=>{V.recipeDraft=null;R();};
 const recipeSave=()=>{
  if(!recipeCanWrite())return root.stAlert('Você não tem permissão para salvar receitas.');
  const draft=V.recipeDraft;if(!draft)return;
  const data=Core.recipes.normalize(draft),error=Core.recipes.validate(data);if(error)return root.stAlert(error);
  const rows=recipeList(),old=draft.id&&draft.id!=='new'?rows.find(item=>String(item.id)===String(draft.id)):null,now=Date.now();
  const record={...data,id:old?.id||'recipe-'+uid(),createdAt:old?.createdAt||draft.createdAt||now,updatedAt:now};
  if(old)Object.assign(old,record);else rows.unshift(record);
  V.recipeDraft=null;save();R();
 };
 const recipeDelete=async id=>{
  if(!recipeCanWrite())return root.stAlert('Você não tem permissão para excluir receitas.');
  const recipe=recipeList().find(item=>String(item.id)===String(id));if(!recipe)return;
  if(!await root.stConfirm('Excluir a ficha técnica de "'+(recipe.nome||'Receita')+'"? Esta ação não poderá ser desfeita.',{title:'Excluir ficha técnica'}))return;
  S.log[recipeKey]=recipeList().filter(item=>String(item.id)!==String(id));save();R();
 };
 const recipeFieldHtml=(label,key,value,type='text',extra='')=>'<label>'+label+'<input type="'+type+'" '+extra+' value="'+e(value??'')+'" oninput="stRecipeField(\''+key+'\',this.value)"></label>';
 const recipeIngredientsHtml=d=>d.ingredientes.map((item,index)=>{
  const field=(label,key,value,type='text',extra='')=>'<label>'+label+'<input type="'+type+'" '+extra+' value="'+e(value??'')+'" oninput="stRecipeIngredientField('+index+',\''+key+'\',this.value)"></label>';
  return '<div class="c"><div class="row sp"><b>Ingrediente '+(index+1)+'</b>'+(d.ingredientes.length>1?'<button type="button" class="bt d" onclick="stRecipeRemoveIngredient('+index+')">Excluir</button>':'')+'</div><div class="g2">'+field('Nome do ingrediente','nome',item.nome)+'</div><div class="g2">'+field('Unidade','unidade',item.unidade)+field('Peso / quantidade (g ou kg)','peso',item.peso,'number','min="0" step="any" inputmode="decimal"')+'</div></div>';
 }).join('');
 const recipeEditor=()=>{
  const d=V.recipeDraft,ingredientRows=recipeIngredientsHtml(d);
  return '<div class="row sp"><button type="button" class="bt g" onclick="stRecipeCancel()">‹ Receitas</button><span class="mu">Ficha técnica</span></div>'+
   '<div class="c"><h3>'+(d.id==='new'?'Nova receita':'Editar receita')+'</h3><p class="mu">Preencha os dados da receita e os ingredientes utilizados na produção.</p>'+recipeFieldHtml('Nome da receita','nome',d.nome)+'</div>'+
   '<div class="c"><div class="row sp"><div><h3>Ingredientes</h3><p class="mu">Até 14 ingredientes por receita.</p></div><span class="b">'+d.ingredientes.length+'/14</span></div>'+ingredientRows+
   '<button type="button" class="bt g" onclick="stRecipeAddIngredient()" '+(d.ingredientes.length>=14?'disabled':'')+'>+ Ingrediente</button></div>'+
   '<div class="c"><h3>Dados de produção</h3><div class="g2">'+recipeFieldHtml('Peso inicial da receita (g/kg)','pesoInicial',d.pesoInicial,'number','min="0" step="any" inputmode="decimal"')+recipeFieldHtml('Peso final da receita (g/kg)','pesoFinal',d.pesoFinal,'number','min="0" step="any" inputmode="decimal"')+'</div><div class="g2">'+recipeFieldHtml('Rendimento / quantidade produzida','rendimento',d.rendimento,'number','min="0" step="any" inputmode="decimal"')+recipeFieldHtml('Unidade do rendimento','unidadeRendimento',d.unidadeRendimento)+'</div><div class="g2">'+recipeFieldHtml('Quantidade de pessoas envolvidas','pessoas',d.pessoas,'number','min="1" step="1" inputmode="numeric"')+recipeFieldHtml('Tempo total de preparo','tempoPreparo',d.tempoPreparo)+'</div>'+recipeFieldHtml('Tempo de forno / cocção','tempoForno',d.tempoForno)+'</div>'+
   '<div class="c"><h3>Modo de preparo e observações</h3><label>Descreva o modo de preparo, etapas e observações<textarea rows="5" oninput="stRecipeField(\'preparo\',this.value)">'+e(d.preparo)+'</textarea></label></div>'+
   '<div class="c"><h3>Embalagem</h3><label>Necessita de embalagem?<select onchange="stRecipeField(\'usaEmbalagem\',this.value);R()"><option value="nao" '+(d.usaEmbalagem!=='sim'?'selected':'')+'>Não</option><option value="sim" '+(d.usaEmbalagem==='sim'?'selected':'')+'>Sim</option></select></label>'+(d.usaEmbalagem==='sim'?'<div class="g2">'+recipeFieldHtml('Qual embalagem?','tipoEmbalagem',d.tipoEmbalagem)+recipeFieldHtml('Quantas?','quantidadeEmbalagem',d.quantidadeEmbalagem,'number','min="0" step="any" inputmode="decimal"')+'</div>':'')+'</div>'+
   '<div class="c"><h3>Cadastro e controle</h3><div class="g2">'+recipeFieldHtml('Responsável','responsavel',d.responsavel)+recipeFieldHtml('Data / versão','dataVersao',d.dataVersao)+'</div></div>'+
   '<div class="row u-mt10"><button type="button" class="bt" onclick="stRecipeSave()">Salvar receita</button><button type="button" class="bt g" onclick="stRecipeCancel()">Cancelar</button></div>';
 };
 const recipeCard=recipe=>{
  const ingredients=(recipe.ingredientes||[]).filter(item=>item?.nome).length;
  const weight=recipe.pesoFinal?recipe.pesoFinal+' g/kg':'—';
  const yieldText=recipe.rendimento?[recipe.rendimento,recipe.unidadeRendimento].filter(Boolean).join(' '):'—';
  return '<article class="c"><div class="row sp"><div><b>'+e(recipe.nome||'Receita sem nome')+'</b><div class="mu">'+ingredients+' ingrediente(s) · Peso final: '+e(weight)+'</div></div><span class="b">'+e(recipe.dataVersao||'Sem versão')+'</span></div><div class="row sp u-mt8"><span class="mu">Rendimento: '+e(yieldText)+' · Preparo: '+e(recipe.tempoPreparo||'—')+'</span></div><div class="mu u-mt8">Responsável: '+e(recipe.responsavel||'—')+'</div><div class="row u-mt10"><button type="button" class="bt g" onclick="stRecipeEdit(\''+e(recipe.id)+'\')">Editar ficha</button><button type="button" class="bt d" onclick="stRecipeDelete(\''+e(recipe.id)+'\')">Excluir</button></div></article>';
 };
 const recipePage=()=>{
  if(V.recipeDraft)return recipeEditor();
  const rows=[...recipeList()].sort((a,b)=>(Number(b.updatedAt)||0)-(Number(a.updatedAt)||0));
  const plus='<div class="c launch-card launch-primary"><button type="button" class="launch-plus" aria-label="Cadastrar receita" title="Cadastrar receita" onclick="stRecipeNew()">+</button><div class="launch-primary-copy"><b>Nova ficha técnica</b><p class="launch-info">Cadastre os ingredientes, rendimento e padrão de produção da padaria.</p></div></div>';
  return '<section><div class="row sp"><div><h2>Ficha técnica de receitas</h2><p class="mu">Padaria · Controle e padronização da produção</p></div><span class="b">'+rows.length+' receita(s)</span></div>'+plus+'<div class="u-mt10"><h3>Receitas cadastradas</h3>'+(rows.length?rows.map(recipeCard).join(''):'<div class="c mu">Nenhuma receita cadastrada. Toque no botão + para criar a primeira ficha técnica.</div>')+'</div></section>';
 };
 bridge.rRegLanc=function(){if(V.reg===recipeKey)return recipePage();return typeof originalLaunchRenderer==='function'?originalLaunchRenderer.apply(this,arguments):'';};
 root.stRecipeField=recipeField;root.stRecipeIngredientField=recipeIngredientField;
 root.stRecipeAddIngredient=recipeAddIngredient;root.stRecipeRemoveIngredient=recipeRemoveIngredient;
 root.stRecipeNew=recipeNew;root.stRecipeEdit=recipeEdit;root.stRecipeCancel=recipeCancel;
 root.stRecipeSave=recipeSave;root.stRecipeDelete=recipeDelete;
})();

if(typeof R==='function')R();
})(typeof window!=='undefined'?window:globalThis);
