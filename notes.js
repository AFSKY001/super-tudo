(function(root){
'use strict';
if(!root.document)return;
const bridge=root.__ST_ROUTINE_BRIDGE__;
if(!bridge){root.__ST_NOTES_BOOT_ERROR__='routine_bridge_missing';return;}
const S=bridge.S,V=bridge.V,supa=bridge.supa,can=bridge.can,esc=bridge.esc;
const $=id=>root.document.getElementById(id);
const state={tab:'minhas',color:'',search:'',notes:[],loading:false,error:'',editor:null,readOnly:false,timer:null,saving:false,dirty:false,channel:null,saveChain:Promise.resolve(),lastUpdated:null,draftChain:Promise.resolve(),recoveredDraft:false};
const colors={amarelo:'#FFF1A6',rosa:'#FFD1E2',azul:'#C9E7FF',verde:'#D2F1CC',laranja:'#FFE0BD',lilas:'#E8D9FF',cinza:'#E7EAF0'};
const textColors={vermelho:'#A51D2D',azul:'#124F9B',verde:'#176334',roxo:'#5B278A'};
const markColors={amarelo:'#FFE16A',verde:'#B8E8A8',rosa:'#FFBFD5',azul:'#B8DFFF'};
const uid=()=>root.crypto?.randomUUID?root.crypto.randomUUID():'note-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
const org=()=>String(V.cloudIdentity?.org_id||'');
const user=()=>String(V.cloudIdentity?.id||V.me?.id||'');
const allowed=(p)=>typeof can==='function'&&can(p);
const fullAccess=()=>typeof bridge.isFullAccess==='function'&&bridge.isFullAccess();
const canCreate=()=>fullAccess()||allowed('l:notes');
const canView=()=>fullAccess()||allowed('r:notes')||allowed('l:notes')||allowed('m:notes');
const canModerate=()=>fullAccess()||allowed('m:notes');
const isOwner=n=>String(n?.author_id||'')===user();
const canEdit=n=>!!n&&(isOwner(n)?canCreate():!!n.shared&&canModerate());
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
const escHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const textOf=html=>{const d=new DOMParser().parseFromString(String(html||''),'text/html');return d.body.textContent||'';};
const allowedTags=new Set(['B','STRONG','I','EM','U','MARK','UL','OL','LI','BR','DIV','P','SPAN']);
const classOk=/^(tc-(vermelho|azul|verde|roxo)|mk-(amarelo|verde|rosa|azul))$/;
function sanitize(html){
 const doc=new DOMParser().parseFromString(String(html||''),'text/html');
 const walk=node=>{for(const child of [...node.childNodes]){
  if(child.nodeType===3)continue;
  if(child.nodeType!==1){child.remove();continue;}
  if(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','SVG','MATH','TEMPLATE'].includes(child.tagName)){child.remove();continue;}
  walk(child);
  if(!allowedTags.has(child.tagName)){child.replaceWith(...child.childNodes);continue;}
  const classes=child.tagName==='SPAN'?[...child.classList].filter(c=>classOk.test(c)):[];
  [...child.attributes].forEach(a=>child.removeAttribute(a.name));
  if(classes.length)child.className=classes.join(' ');
 }};
 walk(doc.body);return doc.body.innerHTML;
}
const dateLabel=value=>{if(!value)return'';const d=new Date(value);return Number.isNaN(d.getTime())?'':new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',year:'numeric'}).format(d);};
const status=t=>{const el=$('nt-status');if(el)el.textContent=t;};
let draftDbPromise=null;
function openDraftDb(){
 if(!root.indexedDB)return Promise.reject(new Error('Armazenamento local indisponível neste navegador.'));
 if(draftDbPromise)return draftDbPromise;
 draftDbPromise=new Promise((resolve,reject)=>{
  const request=root.indexedDB.open('super-tudo-notes-drafts',1);
  request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains('drafts'))db.createObjectStore('drafts',{keyPath:'key'});};
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>{draftDbPromise=null;reject(request.error||new Error('Não foi possível abrir o armazenamento local.'));};
  request.onblocked=()=>{draftDbPromise=null;reject(new Error('O armazenamento local está ocupado por outra aba.'));};
 });
 return draftDbPromise;
}
function draftKey(id){return 'draft:'+org()+':'+user()+':'+(id||'new');}
async function draftOperation(mode,action){
 const db=await openDraftDb();
 return new Promise((resolve,reject)=>{
  let result;
  const tx=db.transaction('drafts',mode),store=tx.objectStore('drafts');
  let request;
  try{request=action(store);}catch(error){reject(error);return;}
  if(request){request.onsuccess=()=>{result=request.result;};request.onerror=()=>reject(request.error||tx.error);}
  tx.oncomplete=()=>resolve(result);
  tx.onerror=()=>reject(tx.error||new Error('Falha no armazenamento local.'));
  tx.onabort=()=>reject(tx.error||new Error('Gravação local interrompida.'));
 });
}
function draftSnapshot(){
 const n=state.editor;
 return {key:draftKey(n?.id),noteId:n?.id||null,baseUpdatedAt:state.lastUpdated||null,title:String(n?.title||'').trim().slice(0,120),body:sanitize(n?.body||'').slice(0,20000),color:n?.color||'amarelo',pinned:!!n?.pinned,archived:!!n?.archived,shared:!!n?.shared,savedAt:Date.now()};
}
function persistDraft(){
 if(!state.editor||state.readOnly||!state.dirty)return state.draftChain;
 const draft=draftSnapshot();
 state.draftChain=state.draftChain.then(()=>draftOperation('readwrite',store=>store.put(draft))).catch(error=>{
  if(state.editor)status('Rascunho não protegido localmente: '+(error?.message||'falha no armazenamento.'));
  return false;
 });
 return state.draftChain;
}
function removeDraft(id){
 const key=draftKey(id);
 state.draftChain=state.draftChain.then(()=>draftOperation('readwrite',store=>store.delete(key))).catch(()=>false);
 return state.draftChain;
}
async function recoverDraft(id){
 try{return await draftOperation('readonly',store=>store.get(draftKey(id)));}catch(_){return null;}
}
const notify=t=>root.stAlert?.(t);
function noteColor(n){return colors[n.color]||colors.amarelo;}
function visibleNotes(){
 const q=normalize(state.search);
 return state.notes.filter(n=>{
  if(state.tab==='minhas'&&(!isOwner(n)||n.archived||n.deleted_at))return false;
  if(state.tab==='equipe'&&(!(n.shared&&(allowed('r:notes')||canModerate()))||isOwner(n)||n.archived||n.deleted_at))return false;
  if(state.tab==='arquivadas'&&(!isOwner(n)||!n.archived||n.deleted_at))return false;
  if(state.tab==='lixeira'&&(!isOwner(n)||!n.deleted_at))return false;
  if(state.color&&n.color!==state.color)return false;
  return !q||normalize((n.title||'')+' '+textOf(n.body||'')).includes(q);
 }).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||new Date(b.updated_at)-new Date(a.updated_at));
}
async function loadNotes(){
 if(state.tab==='lixeira')await cleanupTrash();
 if(!org()||!user()){state.error='Entre novamente para acessar suas notas.';render();return;}
 state.loading=true;state.error='';render();
 try{
  let query=supa.from('notas').select('*').eq('org_id',org()).order('pinned',{ascending:false}).order('updated_at',{ascending:false}).limit(500);
  if(state.tab==='lixeira')query=query.not('deleted_at','is',null);
  else query=query.is('deleted_at',null);
  if(state.tab==='arquivadas')query=query.eq('archived',true);
  else if(state.tab!=='lixeira')query=query.eq('archived',false);
  const {data,error}=await query;if(error)throw error;
  state.notes=Array.isArray(data)?data:[];
 }catch(error){state.error=error?.message||'Não foi possível carregar as notas.';}
 finally{state.loading=false;render();}
}
function noteCard(n,i){
 const title=n.title?'<h3>'+escHtml(n.title)+'</h3>':'';
 const body=sanitize(n.body||'');
 const author=(n.shared||!isOwner(n))?'<footer>👥 '+escHtml(n.author_name||'Equipe')+' · '+dateLabel(n.updated_at)+'</footer>':'';
 return '<article class="nt-card" data-id="'+escHtml(n.id)+'" data-color="'+escHtml(n.color||'amarelo')+'" style="--nt-bg:'+noteColor(n)+';--nt-rot:'+((((parseInt(String(n.id).replace(/-/g,'' ).slice(0,4),16)||0)%31)-15)/10)+'deg;--nt-i:'+Math.min(i,12)+'" onclick="window.stNotesOpenEditor(\''+escHtml(n.id)+'\')">'+(n.pinned?'<span class="nt-pin" aria-label="Fixada">●</span>':'')+title+'<div class="nt-card-body">'+body+'</div>'+author+'<div class="nt-card-actions" onclick="event.stopPropagation()">'+(canEdit(n)?(state.tab==='lixeira'?'<button type="button" aria-label="Restaurar" onclick="window.stNotesRestore(\''+escHtml(n.id)+'\')">↩</button><button type="button" aria-label="Excluir definitivamente" onclick="window.stNotesDelete(\''+escHtml(n.id)+'\')">⌫</button>':'<button type="button" aria-label="'+(n.pinned?'Desafixar':'Fixar')+'" onclick="window.stNotesTogglePin(\''+escHtml(n.id)+'\')">'+(n.pinned?'📌':'⌖')+'</button><button type="button" aria-label="'+(n.archived?'Restaurar':'Arquivar')+'" onclick="window.stNotesArchive(\''+escHtml(n.id)+'\')">'+(n.archived?'↩':'▣')+'</button><button type="button" aria-label="Excluir" onclick="window.stNotesDelete(\''+escHtml(n.id)+'\')">⌫</button>'):'')+'</div></article>';
}
function tabsHtml(){return '<div class="nt-tabs" role="tablist"><button type="button" class="'+(state.tab==='minhas'?'on':'')+'" onclick="window.stNotesTab(\'minhas\')">Minhas</button><button type="button" class="'+(state.tab==='equipe'?'on':'')+'" '+(allowed('r:notes')||canModerate()?'':'disabled')+' onclick="window.stNotesTab(\'equipe\')">Da equipe</button><button type="button" class="'+(state.tab==='arquivadas'?'on':'')+'" onclick="window.stNotesTab(\'arquivadas\')">Arquivadas</button></div>';}
function render(){
 const host=$('nt-root');if(!host)return;
 if(state.editor){root.document.body.classList.add('nt-editing');host.innerHTML=editorHtml();bindEditor();return;}
 root.document.body.classList.remove('nt-editing');
 const rows=visibleNotes();
 const colorsHtml='<button type="button" class="nt-color-filter '+(!state.color?'on':'')+'" aria-label="Todas as cores" onclick="window.stNotesFilterColor(\'\')">Todas</button>'+Object.keys(colors).map(c=>'<button type="button" class="nt-color-dot '+(state.color===c?'on':'')+'" style="--nt-dot:'+colors[c]+'" aria-label="'+c+'" onclick="window.stNotesFilterColor(\''+c+'\')"></button>').join('');
 const list=state.loading?'<div class="nt-empty"><span class="nt-spinner"></span><p>Carregando notas…</p></div>':state.error?'<div class="nt-empty"><p>'+escHtml(state.error)+'</p><button class="bt g" onclick="window.stNotesLoad()">Tentar novamente</button></div>':rows.length?'<div class="nt-grid">'+rows.map(noteCard).join('')+'</div>':'<div class="nt-empty"><div class="nt-empty-icon">✎</div><h3>'+({minhas:'Seu mural está vazio',equipe:'Nenhuma nota compartilhada',arquivadas:'Nenhuma nota arquivada',lixeira:'A lixeira está vazia'}[state.tab])+'</h3><p>'+({minhas:'Guarde aqui lembretes e informações importantes do seu trabalho.',equipe:'Quando alguém compartilhar uma nota com a equipe, ela aparecerá aqui.',arquivadas:'As notas arquivadas ficam guardadas aqui.',lixeira:'As notas excluídas ficam disponíveis por até 30 dias.'}[state.tab])+'</p>'+(state.tab==='minhas'&&canCreate()?'<button type="button" class="bt" onclick="window.stNotesNew()">Criar primeira nota</button>':'')+'</div>';
 host.innerHTML='<section class="nt-page"><div class="nt-head"><div><button type="button" class="nt-back" onclick="window.stNotesBack()">‹ Registros</button><h2>Bloco de notas</h2><p class="mu">Suas ideias e lembretes em um só lugar.</p></div><button type="button" class="nt-more" aria-label="Mais opções" onclick="window.stNotesMenu()">⋯</button></div>'+tabsHtml()+'<div class="nt-tools"><input type="search" placeholder="Buscar nas notas…" value="'+escHtml(state.search)+'" oninput="window.stNotesSearch(this.value)"><div class="nt-colors">'+colorsHtml+'</div></div>'+(state.tab==='lixeira'?'<div class="nt-trash-info">As notas são removidas definitivamente após 30 dias. <button type="button" onclick="window.stNotesEmptyTrash()">Esvaziar lixeira</button></div>':'')+list+(canCreate()&&state.tab==='minhas'?'<button type="button" class="nt-fab" aria-label="Nova nota" onclick="window.stNotesNew()">+</button>':'')+(state.menu?'<div class="nt-menu"><button type="button" onclick="window.stNotesTab(\'lixeira\')">Lixeira</button><button type="button" onclick="window.stNotesRefresh()">Atualizar</button></div>':'')+'</section>';
}
function editorHtml(){
 const n=state.editor,readOnly=state.readOnly,canToggleShare=!n.id||isOwner(n),body=sanitize(n.body||'');
 return '<section class="nt-editor" data-color="'+escHtml(n.color||'amarelo')+'" style="--nt-bg:'+noteColor(n)+'"><header class="nt-editor-head"><button type="button" class="nt-back" onclick="window.stNotesBack()">‹ Voltar</button><span id="nt-status" aria-live="polite">'+(state.saving?'Salvando…':n.id?'Salvo ✓':'')+'</span><button type="button" class="nt-done" onclick="window.stNotesBack()">Concluir</button></header><div class="nt-editor-colors" role="radiogroup" aria-label="Cor da nota">'+Object.keys(colors).map(c=>'<button type="button" role="radio" aria-checked="'+(n.color===c)+'" class="nt-color-dot '+(n.color===c?'on':'')+'" style="--nt-dot:'+colors[c]+'" aria-label="'+c+'" '+(readOnly?'disabled':'')+' onclick="window.stNotesSetColor(\''+c+'\')"></button>').join('')+'</div><div class="nt-editor-footer"><label class="nt-share"><input id="nt-share" type="checkbox" '+(n.shared?'checked':'')+' '+(readOnly||!canToggleShare?'disabled':'')+' onchange="window.stNotesShare(this.checked)"><span>Compartilhar com a equipe</span></label><span class="mu">'+(n.author_name?escHtml(n.author_name)+' · ':'')+dateLabel(n.updated_at||n.created_at)+'</span></div><input id="nt-title" class="nt-title" maxlength="120" placeholder="Título" value="'+escHtml(n.title||'')+'" '+(readOnly?'readonly':'')+'><div id="nt-body" class="nt-body" contenteditable="'+(!readOnly)+'" role="textbox" aria-label="Texto da nota" aria-multiline="true" data-placeholder="Escreva sua anotação…">'+body+'</div><div id="nt-toolbar" class="nt-toolbar" '+(readOnly?'hidden':'')+'><button type="button" data-cmd="bold"><b>B</b></button><button type="button" data-cmd="italic"><i>I</i></button><button type="button" data-cmd="underline"><u>U</u></button><button type="button" data-cmd="insertUnorderedList">•</button><span></span>'+Object.keys(textColors).map(c=>'<button type="button" class="nt-format-color" style="--nt-format:'+textColors[c]+'" data-class="tc-'+c+'" aria-label="Texto '+c+'">A</button>').join('')+'<span></span>'+Object.keys(markColors).map(c=>'<button type="button" class="nt-format-mark" style="--nt-format:'+markColors[c]+'" data-class="mk-'+c+'" aria-label="Marca-texto '+c+'">A</button>').join('')+'<button type="button" data-clear aria-label="Limpar formatação">Tx</button></div>'+(readOnly?'<p class="nt-readonly">Esta nota foi compartilhada com você. Somente o autor ou um moderador pode editá-la.</p>':'')+'</section>';
}
function bindEditor(){
 const title=$('nt-title'),body=$('nt-body'),toolbar=$('nt-toolbar');
 if(!title||!body)return;
 const changed=()=>{if(state.readOnly)return;state.editor.title=title.value.slice(0,120);state.editor.body=sanitize(body.innerHTML).slice(0,20000);state.dirty=true;persistDraft();scheduleSave();};
 title.addEventListener('input',changed);body.addEventListener('input',changed);
 body.addEventListener('paste',e=>{if(state.readOnly)return;e.preventDefault();const text=e.clipboardData?.getData('text/plain')||'';document.execCommand('insertText',false,text);});
 if(toolbar){toolbar.addEventListener('pointerdown',e=>{if(e.target.closest('button'))e.preventDefault();});toolbar.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.cmd)command(b.dataset.cmd);else if(b.dataset.class)applyClass(b.dataset.class);else if(b.hasAttribute('data-clear'))clearFormat();});}
 body.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();saveNow();}});
 const viewport=root.visualViewport;
 if(viewport){const update=()=>document.documentElement.style.setProperty('--nt-kb',Math.max(0,root.innerHeight-viewport.height-viewport.offsetTop)+'px');viewport.addEventListener('resize',update);viewport.addEventListener('scroll',update);update();}
}
function command(name){const body=$('nt-body');if(!body)return;body.focus();document.execCommand(name,false,null);state.editor.body=sanitize(body.innerHTML);state.dirty=true;persistDraft();scheduleSave();}
function selectionRange(){const sel=root.getSelection();if(!sel?.rangeCount)return null;const range=sel.getRangeAt(0);return $('nt-body')?.contains(range.commonAncestorContainer)?range:null;}
function applyClass(cls){const body=$('nt-body'),sel=root.getSelection(),range=selectionRange();if(!body||!range||range.collapsed)return;const fragment=range.extractContents();fragment.querySelectorAll('span').forEach(s=>{if([...s.classList].some(c=>c.startsWith(cls.slice(0,3))))s.replaceWith(...s.childNodes);});const span=document.createElement('span');span.className=cls;span.append(fragment);range.insertNode(span);sel.removeAllRanges();const next=document.createRange();next.selectNodeContents(span);sel.addRange(next);state.editor.body=sanitize(body.innerHTML);state.dirty=true;persistDraft();scheduleSave();}
function clearFormat(){const body=$('nt-body'),range=selectionRange(),sel=root.getSelection();if(!body||!range||range.collapsed)return;const frag=range.extractContents();frag.querySelectorAll('span,b,strong,i,em,u,mark').forEach(n=>n.replaceWith(...n.childNodes));range.insertNode(frag);state.editor.body=sanitize(body.innerHTML);state.dirty=true;persistDraft();scheduleSave();}
function scheduleSave(){status(root.navigator.onLine?'Salvando…':'Sem conexão · rascunho neste aparelho');state.dirty=true;clearTimeout(state.timer);state.timer=setTimeout(()=>saveNow(),800);}
async function saveNow(){
 if(!state.editor||state.readOnly)return true;
 if(!state.dirty)return true;
 clearTimeout(state.timer);
 const n=state.editor,title=String(n.title||'').trim().slice(0,120),body=sanitize(n.body||'').slice(0,20000);
 if(!title&&!textOf(body).trim()){state.dirty=false;status('');removeDraft(n.id||'new');return true;}
 const draftStored=await persistDraft();
 if(!root.navigator.onLine){status(draftStored===false?'Sem conexão. O navegador não conseguiu guardar este rascunho neste aparelho.':'Sem conexão · rascunho guardado neste aparelho');return false;}
 state.saving=true;status('Salvando…');
 const payload={title,body,color:n.color||'amarelo',pinned:!!n.pinned,archived:!!n.archived,shared:!!n.shared};
 const snapshot=JSON.stringify(payload),snapshotNoteId=n.id||null;
 const task=async()=>{
  try{
   let result;
   if(n.id){
    let q=supa.from('notas').update(payload).eq('id',n.id);
    if(state.lastUpdated)q=q.eq('updated_at',state.lastUpdated);
    result=await q.select('id,updated_at').maybeSingle();
    if(result.error)throw result.error;
    if(!result.data)throw new Error('Esta nota foi alterada em outro aparelho. Atualize o mural antes de salvar suas mudanças.');
   }else{
    result=await supa.from('notas').insert({...payload,org_id:org()}).select('id,updated_at').single();
    if(result.error)throw result.error;
    n.id=result.data.id;
   }
   state.lastUpdated=result.data.updated_at;n.updated_at=result.data.updated_at;state.saving=false;
   const current=JSON.stringify({title:String(n.title||'').trim().slice(0,120),body:sanitize(n.body||'').slice(0,20000),color:n.color||'amarelo',pinned:!!n.pinned,archived:!!n.archived,shared:!!n.shared});
   if(current===snapshot){state.dirty=false;await removeDraft(n.id);if(!snapshotNoteId)await removeDraft('new');status('Salvo ✓');return true;}
   state.dirty=true;if(!snapshotNoteId)await removeDraft('new');await persistDraft();status('Salvando…');scheduleSave();return true;
  }catch(error){state.saving=false;state.dirty=true;const message=error?.message||'Falha ao salvar';status(message.includes('alterada em outro aparelho')?'Conflito: atualize o mural antes de continuar.':'Não foi possível salvar. Tentando novamente…');state.error=message;if(!message.includes('alterada em outro aparelho')&&root.navigator.onLine){clearTimeout(state.timer);state.timer=setTimeout(()=>saveNow(),3000);}return false;}
 };
 state.saveChain=state.saveChain.then(task,task);return state.saveChain;
}
async function openEditor(id){
 const n=id?state.notes.find(x=>String(x.id)===String(id)):null;
 if(id&&!n){await loadNotes();return;}
 state.editor=n?{...n,body:sanitize(n.body||'')}:{id:null,title:'',body:'',color:'amarelo',pinned:false,archived:false,shared:false};
 state.readOnly=!!n&&!canEdit(n);state.dirty=false;state.recoveredDraft=false;state.lastUpdated=n?.updated_at||null;state.menu=false;
 if(!state.readOnly){const draft=await recoverDraft(n?.id||'new');if(draft&&(!draft.noteId||String(draft.noteId)===String(n?.id||''))){state.editor={...state.editor,title:draft.title||'',body:sanitize(draft.body||''),color:colors[draft.color]?draft.color:'amarelo',pinned:!!draft.pinned,archived:!!draft.archived,shared:!!draft.shared};state.lastUpdated=draft.baseUpdatedAt||n?.updated_at||null;state.dirty=true;state.recoveredDraft=true;}}
 render();if(state.recoveredDraft){status('Rascunho recuperado deste aparelho');if(root.navigator.onLine)scheduleSave();}
}
async function back(){
 if(state.editor){clearTimeout(state.timer);if(state.dirty){const saved=await saveNow();if(saved===false||state.dirty){notify('A nota ainda não foi salva. Mantenha o editor aberto e tente novamente quando a conexão estiver estável.');return false;}}state.editor=null;state.readOnly=false;}
 state.menu=false;render();await loadNotes();return true;
}
async function mutate(id,fields){
 const n=state.notes.find(x=>String(x.id)===String(id));if(!n||!canEdit(n))return notify('Você não tem permissão para alterar esta nota.');
 const {error}=await supa.from('notas').update(fields).eq('id',id);if(error)return notify(error.message||'Não foi possível atualizar a nota.');
 await loadNotes();
}
async function cleanupTrash(){
 if(!org()||!user()||!root.navigator.onLine)return;
 const cutoff=new Date(Date.now()-30*86400000).toISOString();
 const {error}=await supa.from('notas').delete().eq('org_id',org()).eq('author_id',user()).lt('deleted_at',cutoff);
 if(error)state.error='Não foi possível limpar notas antigas da lixeira.';
}
async function emptyTrash(){if(!await root.stConfirm('Excluir definitivamente todas as suas notas da lixeira? Esta ação não poderá ser desfeita.',{title:'Esvaziar lixeira'}))return;const {error}=await supa.from('notas').delete().eq('org_id',org()).eq('author_id',user()).not('deleted_at','is',null);if(error)return notify(error.message);await loadNotes();}
async function deleteNote(id){const n=state.notes.find(x=>String(x.id)===String(id));if(!n)return;if(!canEdit(n))return notify('Você não tem permissão para excluir esta nota.');if(state.tab==='lixeira'){if(!await root.stConfirm('Excluir definitivamente esta nota?',{title:'Excluir definitivamente'}))return;const {error}=await supa.from('notas').delete().eq('id',id);if(error)return notify(error.message);await loadNotes();return;}if(!await root.stConfirm('Mover esta nota para a lixeira?',{title:'Excluir nota',confirmText:'Mover para lixeira',cancelText:'Cancelar'}))return;const card=root.document.querySelector('.nt-card[data-id="'+String(id).replace(/[^a-zA-Z0-9_-]/g,'')+'"]');if(card){card.classList.add('nt-exiting');await new Promise(resolve=>setTimeout(resolve,320));}await mutate(id,{deleted_at:new Date().toISOString()});}
async function restore(id){await mutate(id,{deleted_at:null,archived:false});}
async function archive(id){const n=state.notes.find(x=>String(x.id)===String(id));if(!n)return;await mutate(id,{archived:!n.archived});}
async function togglePin(id){const n=state.notes.find(x=>String(x.id)===String(id));if(!n)return;await mutate(id,{pinned:!n.pinned});}
function subscribe(){
 if(state.channel){supa.removeChannel(state.channel);state.channel=null;}
 if(!org())return;
 state.channel=supa.channel('notes-'+org()).on('postgres_changes',{event:'*',schema:'public',table:'notas',filter:'org_id=eq.'+org()},()=>{if(!state.editor)loadNotes();}).subscribe();
}
function open(){
 if(!canView())return notify('Você não tem permissão para acessar o Bloco de notas.');
 V.tab='reg';V.rs='notes';V.reg=null;state.tab='minhas';state.search='';state.color='';state.editor=null;state.menu=false;bridge.R();subscribe();loadNotes();
}
async function backToRegistry(){const saved=await back();if(saved===false)return;if(state.channel){supa.removeChannel(state.channel);state.channel=null;}V.rs='home';V.reg=null;bridge.R();}
function setTab(tab){state.tab=tab;state.search='';state.color='';state.menu=false;loadNotes();}
function setColor(color){if(!state.editor||state.readOnly)return;state.editor.color=color;const el=document.querySelector('.nt-editor');if(el){el.dataset.color=color;el.style.setProperty('--nt-bg',colors[color]);}document.querySelectorAll('.nt-editor-colors button').forEach(b=>{const selected=b.getAttribute('aria-label')===color;b.setAttribute('aria-checked',String(selected));b.classList.toggle('on',selected);});state.dirty=true;persistDraft();scheduleSave();}
function share(value){if(!state.editor||state.readOnly)return;state.editor.shared=!!value;state.dirty=true;persistDraft();scheduleSave();}
function menu(){state.menu=!state.menu;render();}
function search(value){state.search=value;const cursor=$('nt-search');render();const input=document.querySelector('.nt-tools input');if(input){input.focus();input.setSelectionRange(value.length,value.length);}}
function refresh(){loadNotes();}
function newNote(){if(!canCreate())return notify('Você não tem permissão para criar notas.');openEditor(null);}
function setColorFilter(color){state.color=color;render();}
root.__ST_NOTES_MODULE_READY__=true;root.stNotesOpen=open;root.stNotesBack=()=>state.editor?back():backToRegistry();root.stNotesNew=newNote;root.stNotesTab=setTab;root.stNotesLoad=loadNotes;root.stNotesRefresh=refresh;root.stNotesMenu=menu;root.stNotesSearch=search;root.stNotesFilterColor=setColorFilter;root.stNotesSetColor=setColor;root.stNotesShare=share;root.stNotesTogglePin=togglePin;root.stNotesArchive=archive;root.stNotesDelete=deleteNote;root.stNotesRestore=restore;root.stNotesEmptyTrash=emptyTrash;root.stNotesOpenEditor=openEditor;
const originalReg=bridge.rReg;
bridge.rReg=function(){
 if(V.rs==='notes')return '<div class="regwrap"><div class="regbody" id="nt-root"><div class="nt-empty">Carregando bloco de notas…</div></div></div>';
 return originalReg.apply(this,arguments);
};
root.addEventListener('online',()=>{if(state.editor&&state.dirty)saveNow();else if(V.rs==='notes')loadNotes();});
root.document.addEventListener('visibilitychange',()=>{if(root.document.hidden&&state.editor&&state.dirty)saveNow();});
root.addEventListener('pagehide',()=>{if(state.editor&&state.dirty)saveNow();});
bridge.R();
})(window);
