import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import Core from '../routine.js';

const rootDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const routineSource=fs.readFileSync(path.join(rootDir,'routine.js'),'utf8');
const indexSource=fs.readFileSync(path.join(rootDir,'index.html'),'utf8');
const routinePhotoPolicySource=fs.readFileSync(path.join(rootDir,'supabase/migrations/20261126150000_restrict_routine_photo_storage_access.sql'),'utf8');
const routineAssignmentCloseSource=fs.readFileSync(path.join(rootDir,'supabase/migrations/20261126170000_dismiss_routine_occurrences_on_assignment_end.sql'),'utf8');
const routineSyncGuardFixSource=fs.readFileSync(path.join(rootDir,'supabase/migrations/20261128104700_fix_routine_occurrence_sync_guard.sql'),'utf8');
const routineHistoryGuardFixSource=fs.readFileSync(path.join(rootDir,'supabase/migrations/20261128105200_fix_routine_occurrence_history_json_shape.sql'),'utf8');
const routineAppRecordGuardFixSource=fs.readFileSync(path.join(rootDir,'supabase/migrations/20261128105800_fix_routine_app_record_write_guard.sql'),'utf8');
assert.match(routineAssignmentCloseSource,/after update of data on public\.app_records[\s\S]{0,500}dismiss_pending_routine_occurrences_on_assignment_end/,'Encerrar atribuição deve disparar dispensa no servidor.');
assert.ok(routineAssignmentCloseSource.includes("to_jsonb('dismissed'::text)"),'O servidor deve dispensar ocorrências pendentes sem exclusão física.');
assert.match(routineAssignmentCloseSource,/coalesce\(o\.data->'value'->>'status', o\.data->>'status'\) = 'pending'/,'Somente ocorrências pendentes podem ser dispensadas.');
assert.match(routineAssignmentCloseSource,/coalesce\(o\.data->'value'->>'date', o\.data->>'date'\) > a\.until_date/,'O histórico até a data final da atribuição deve ser preservado.');
assert.match(routineSyncGuardFixSource,/coalesce\(new\.data->'value',\s*new\.data\)\s*-\s*'status'\s*-\s*'updatedAt'\s*-\s*'note'/,'A proteção de sincronização deve comparar JSON tanto no formato plano quanto no formato value.');
assert.match(routineSyncGuardFixSource,/coalesce\(old\.data->'value',\s*old\.data\)\s*-\s*'status'\s*-\s*'updatedAt'\s*-\s*'note'/,'A comparação deve normalizar os dois lados do JSON para a mesma estrutura.');
assert.doesNotMatch(routineSyncGuardFixSource,/\(new\.data->'value'\s*-\s*'status'/,'A proteção não pode subtrair chaves diretamente de um campo value que pode não existir.');
assert.match(routineHistoryGuardFixSource,/coalesce\(new\.data->'value',\s*new\.data\)\s*-\s*'status'\s*-\s*'updatedAt'/,'A proteção do histórico deve normalizar registros planos e envelopados antes de comparar campos.');
assert.match(routineHistoryGuardFixSource,/coalesce\(old\.data->'value',\s*old\.data\)\s*-\s*'status'\s*-\s*'updatedAt'/,'A proteção do histórico deve normalizar o payload anterior e o novo.');
assert.doesNotMatch(routineHistoryGuardFixSource,/new\.data->'value'\s*-\s*'status'/,'O histórico não pode subtrair chaves diretamente de value quando o campo não existe.');
assert.match(routineAppRecordGuardFixSource,/coalesce\(new\.data->'value',\s*new\.data\)\s*-\s*'status'\s*-\s*'updatedAt'\s*-\s*'note'/,'A proteção de escrita deve tratar payload plano e envelopado no caminho de dispensa automática.');
assert.match(routineAppRecordGuardFixSource,/coalesce\(old\.data->'value',\s*old\.data\)\s*-\s*'status'\s*-\s*'updatedAt'\s*-\s*'note'/,'A proteção de escrita deve normalizar também o payload anterior.');
assert.doesNotMatch(routineAppRecordGuardFixSource,/new\.data->'value'\s*-\s*'status'/,'A proteção de escrita não pode subtrair chaves de value nulo.');
assert.match(routineSource,/function migrate\(\)[\s\S]{0,700}bridge\.migrateCronogramaModelsToChecklists\(\)[\s\S]{0,4000}routine-assigned-checklists-v2[\s\S]{0,5000}if\(S\.migrations\.includes\('routine-v1'\)\)return/,'Migração de checklists atribuídos deve rodar mesmo quando routine-v1 já existe.');
assert.match(routineSource,/const checklistItems=c=>\{const raw=Array\.isArray\(c\?\.l\)&&c\.l\.length\?c\.l:[\s\S]{0,140}c\.i\.split\('\|'\)/,'Itens legados em formato pipe precisam ser lidos para gerar as atividades.');
assert.match(routineSource,/function assign\(pid\)[\s\S]{0,800}ensureRoutinePermission\(pid\)/,'Atribuir uma Rotina deve liberar a permissão de menu da pessoa.');
assert.match(routineSource,/const photoRequired=checklist\.ph===true\|\|checklist\.ph===1\|\|\['true','1','sim','required','obrigatoria'\]/,'O texto false no campo legado de foto não pode virar foto obrigatória.');
assert.match(routineSource,/function card\(o\)[\s\S]{0,1800}role="checkbox"[\s\S]{0,700}rtDetails/,'A lista de Rotina deve usar um checkbox individual e abrir detalhes ao tocar na atividade.');
assert.match(routineSource,/function detailsSheet\(\)[\s\S]{0,6000}data-sheet[\s\S]{0,2500}Horário limite[\s\S]{0,1200}Foto na conclusão/,'Os detalhes devem abrir em uma janela inferior arrastável com horário e regra de foto.');
assert.match(routineSource,/async function undoComplete[\s\S]{0,800}status:'pending'[\s\S]{0,500}deletePhoto/,'Desmarcar uma conclusão manual deve voltar para pendente e limpar a comprovação associada.');
assert.match(routineSource,/async function savePhoto\(file,occurrenceId\)[\s\S]{0,1500}stRoutinePhotoUpload\(path,blob\)[\s\S]{0,300}return\{id,path\}/,'A comprovação deve ser comprimida, enviada ao Storage e associada à ocorrência.');
assert.match(routineSource,/photoId:null,photoPath:null/,'Novas ocorrências devem iniciar sem caminho de foto na nuvem.');
assert.match(routineSource,/async function viewPhoto\(id\)[\s\S]{0,900}stRoutinePhotoUrl\(o\.photoPath\)/,'A foto deve poder ser aberta pela nuvem em outro aparelho quando não houver cache local.');
assert.match(indexSource,/window\.stRoutinePhotoUpload=async function\(path,blob\)[\s\S]{0,900}storage\.from\('rotinas-evidencias'\)\.upload/,'O upload deve usar o bucket privado de evidências da Rotina.');
assert.match(indexSource,/window\.stRoutinePhotoUrl=async function\(path\)[\s\S]{0,700}createSignedUrl\(path,3600\)/,'A leitura da foto deve usar URL assinada temporária.');
assert.match(indexSource,/window\.stRoutinePhotoDelete=async function\(path\)[\s\S]{0,700}storage\.from\('rotinas-evidencias'\)\.remove/,'A exclusão da comprovação deve remover o objeto remoto associado.');
assert.match(routinePhotoPolicySource,/public\.can_read_routine_record\([\s\S]{0,180}split_part\(name, '\/', 3\)/,'A leitura de fotos deve seguir a autorização de leitura da ocorrência da Rotina.');
assert.match(routinePhotoPolicySource,/create or replace function public\.can_write_routine_photo_path[\s\S]{0,1200}has_perm_for_org\('r:rot'/,'O upload e a exclusão devem exigir permissão de Rotina e atribuição compatível.');
assert.match(routinePhotoPolicySource,/drop policy if exists rotinas_evidencias_select_org[\s\S]{0,500}create policy rotinas_evidencias_select_routine_access/,'As políticas antigas, abertas a qualquer membro da empresa, devem ser substituídas.');
assert.match(indexSource,/const baseMax=maxHeightFor\(sheet,false\),expandedMax=maxHeightFor\(sheet,true\)/,'Puxar a alça para cima deve expandir a janela até perto do topo.');
assert.match(indexSource,/sheet\.classList\.toggle\('st-sheet-expanded',to>\(baseMax\+expandedMax\)\/2\)/,'A janela deve manter o ponto de parada expandido ou parcial após a mola.');
assert.match(indexSource,/\.sheet\.st-sheet-expanded\{max-height:calc\(88vh \+ var\(--extra\)\)!important;max-height:calc\(88svh \+ var\(--extra\)\)!important/,'Janelas expandidas devem preservar espaço para rolagem interna quase até o topo.');
assert.match(routineSource,/function installRoutineStyles[\s\S]{0,9000}rt-task-check[\s\S]{0,5000}rt-paper-strike[\s\S]{0,9000}rt-details-sheet/,'A lista deve ter ondas no checkbox e risco animado na legenda.');
assert.match(routineSource,/function refreshTaskRow\(id,motion\)[\s\S]{0,900}row\.outerHTML=card\(o\)/,'Marcar e desmarcar devem atualizar somente a linha da atividade, sem redesenhar a tela inteira.');
assert.match(routineSource,/function refreshRoutineIndicators\(\)[\s\S]{0,2200}Core\.progress\(items\)[\s\S]{0,900}rt-day-progress-value[\s\S]{0,900}calendarDotMarkup\(dayNode\.dataset\.date,calendarIds\)/,'A conclusão local deve atualizar imediatamente o percentual, o progresso da equipe e os pontos do calendário.');
assert.match(routineSource,/function refreshTaskRow\(id,motion\)[\s\S]{0,1300}refreshRoutineIndicators\(\)/,'A atualização parcial da atividade deve recalcular os indicadores sem exigir recarregar a página.');
assert.match(routineSource,/data-date="'\+date\+'"/,'Cada dia do calendário deve expor sua data para atualizar os indicadores sem redesenhar a tela.');
assert.match(routineSource,/id="rt-day-progress-value"[\s\S]{0,500}id="rt-day-progress-count"[\s\S]{0,500}id="rt-day-progress-ring"/,'O progresso do dia deve possuir alvos estáveis para atualização imediata.');
assert.match(routineSource,/rt-paper-strike 2s/,'O risco da atividade concluída deve ser desenhado em aproximadamente dois segundos.');
assert.match(routineSource,/text-decoration-line:line-through;text-decoration-color:transparent;text-decoration-thickness:2px;text-decoration-skip-ink:none/,'O risco deve acompanhar todas as linhas do título, inclusive quando a atividade quebra em duas ou mais linhas.');
assert.doesNotMatch(routineSource,/rt-task-copy b::after/,'O risco não deve usar um pseudo-elemento de largura fixa que corte títulos em múltiplas linhas.');
assert.match(routineSource,/rt-check-wave \.95s ease-out 2/,'Marcar deve emitir ondas suaves no checkbox.');
assert.match(routineSource,/rt-uncheck-wave \.72s ease-out/,'Desmarcar deve emitir uma onda verde de saída.');
assert.match(routineSource,/if\(!refreshTaskRow\(id,'is-completing'\)\)R\(\)/,'A conclusão não deve chamar o render geral quando a linha está visível.');
assert.match(routineSource,/if\(!refreshTaskRow\(id,'is-unchecking'\)\)R\(\)/,'A desmarcação não deve chamar o render geral quando a linha está visível.');
assert.doesNotMatch(routineSource,/Marcar como feita/,'O botão antigo de marcar como feita deve ser removido da lista.');

assert.match(routineSource,/function modelPage\(\)[\s\S]{0,700}V\.rotChecklistHub=true;R\(\)[\s\S]{0,100}Modelos de checklist/,'A tela de modelos precisa manter o acesso aos modelos de checklist.');
assert.ok(indexSource.includes("if(!syncPersist())throw new Error(syncLastError||'Não foi possível persistir os dados recebidos da nuvem.');syncBaseline=syncRows(S);syncReady=!0x0;migrateCronogramaModelsToChecklists();window.__ST_CLOUD_SYNC_READY__=true;window.dispatchEvent(new Event('st:cloud-sync-ready'));"),'A Rotina deve repetir a migração somente depois de persistir o snapshot recebido da nuvem e liberar a sincronização.');
assert.match(indexSource,/window\.__ST_CLOUD_SYNC_READY__=true;window\.dispatchEvent\(new Event\('st:cloud-sync-ready'\)\)/,'A conclusão da sincronização deve ficar registrada para scripts carregados depois.');
assert.match(routineSource,/if\(root\.__ST_CLOUD_SYNC_READY__\)\{migrate\(\);generateDay\(\);syncFunctions\(\);if\(typeof R==='function'\)R\(\);\}/,'A migração deve executar mesmo se a hidratação terminar antes de routine.js carregar.');
assert.match(indexSource,/get rRotChecklistHub\(\)\{return rRotChecklistHub\},get migrateCronogramaModelsToChecklists\(\)\{return migrateCronogramaModelsToChecklists\}/,'O bridge deve expor a migração e a tela de modelos de checklist.');
assert.match(indexSource,/function rRotChecklistHub\(\)\{if\(V\.ce\)return rCe\(\);return/,'Ao editar um modelo, a tela de modelos deve encaminhar para o editor selecionado em vez de reapresentar a lista.');
console.log('PASS - integração da conversão de cronogramas com a tela de modelos de checklist.');

assert.match(routineSource,/function activityHtml\(a,i\)[\s\S]{0,3000}Pickers\.campoDias/,'O editor deve usar a grade global de dias da semana.');
assert.match(routineSource,/function readDraft\(\)[\s\S]{0,1800}g\('days'\)\?\.dataset\.valor[\s\S]{0,1400}recurrence,time:/,'O editor deve preservar o tipo de recorrência selecionado.');
assert.match(routineSource,/data-repeat-mode/);
assert.match(routineSource,/data-repeat-end-mode/);
assert.doesNotMatch(routineSource,/id="rt-profile"|id="rt-sector"|id="rt-tol-|Tolerância \(minutos\)|type="time"|name="rt-weekday-/,'O editor não deve manter campos antigos nem controles nativos de hora ou dias.');
assert.match(routineSource,/Pickers\.campoHora/,'Horário deve usar o seletor global.');
assert.match(routineSource,/Pickers\.segmentado/,'Foto deve usar controle segmentado.');
assert.match(routineSource,/Pickers\.interruptor/,'Atividade obrigatória deve usar switch.');
assert.match(routineSource,/Pickers\.campoEscolha/,'Função deve usar seletor customizado.');
assert.doesNotMatch(routineSource,/d\.profile=|d\.sector=|tolerance:/,'Novos modelos e atividades não devem salvar perfil, setor ou tolerância.');

assert.match(routineSource,/const supervisor=id=>\(S\.team\|\|\[\]\)\.find\(p=>\(p\.lead\|\|\[\]\)\.map\(String\)\.includes\(String\(id\)\)\)/,'A liderança responsável pela rotina deve vir exclusivamente da relação líder/subordinado cadastrada em Dados.');
assert.match(routineSource,/function personSection\(p\)[\s\S]{0,1500}Responsável definido em Dados/,'O cadastro de Rotinas deve apenas informar o líder definido em Dados, sem permitir escolher outro.');
assert.doesNotMatch(routineSource,/rt-leader-|Encarregado<select|verifierId/,'Rotinas não deve manter um segundo campo de encarregado/verificador.');
assert.match(routineSource,/function canSee\(id\)\{[^}]*visibleTeam\(\)/,'A liderança deve acessar as rotinas dos subordinados pela equipe cadastrada em Dados.');
assert.match(routineSource,/function todayScreen\(\)[\s\S]{0,500}teamIds=master\?[\s\S]{0,160}:visibleTeam\(\)\.map/,'A aba Equipe da Rotina deve listar os subordinados da liderança cadastrada em Dados.');
assert.match(routineSource,/teamIds=master\?\(S\.team\|\|\[\]\)\.filter\(x=>!x\.adm&&\/encarregado\/i\.test\(String\(x\.f\|\|''\)\)\)/,'O painel do Master deve acompanhar somente os encarregados, sem incluir os demais funcionários.');
assert.match(routineSource,/function calendarItemsOn\(date,ids\)[\s\S]{0,500}Core\.assignmentValidOn\(o,D\.assignments\)/,'O calendário deve ocultar ocorrências futuras de atribuições encerradas, preservando o histórico até a data final.');
assert.match(routineSource,/calendarMarkup\(master\?\(S\.team\|\|\[\]\)\.filter\(x=>!x\.adm\)\.map\(x=>String\(x\.id\)\):tab==='team'\?teamIds:mine/,'O calendário do Master deve considerar todos os funcionários não administrativos, sem limitar as atividades aos encarregados.');
assert.doesNotMatch(routineSource,/function calendarSheet\(\)[\s\S]{0,500}generateDay\(date\)/,'A renderização da janela do calendário não deve disparar gravações de ocorrências; deve usar a prévia não mutável de calendarItemsOn.');
const teamToggleSource=routineSource.slice(routineSource.indexOf('function toggleTeamPerson(pid)'),routineSource.indexOf('function todayScreen()'));
assert.ok(teamToggleSource.includes("V.rtExpandedPerson=String(V.rtExpandedPerson||'')===key?'':key")&&teamToggleSource.includes('R();')&&!teamToggleSource.includes('current.appendChild')&&!teamToggleSource.includes('querySelectorAll'),'A expansão deve ser renderizada a partir do estado, manter uma pessoa aberta por vez e sobreviver a novas renderizações.');
assert.ok(routineSource.includes('class="rt-person-progress">\'+completed+\'/\'+total'),'O resumo compacto deve mostrar atividades concluídas sobre o total previsto.');
assert.match(routineSource,/\.rt-task-status\.is-done\{color:var\(--tx\)\}/,'O status das atividades concluídas deve usar texto branco/neutro, não verde.');



const expanded=Core.expandChecklistItems({
 idPrefix:'legacy-checklist-test',title:'Abertura da loja',description:'Checklist atribuído no cadastro.',
 steps:['Conferir validade','Organizar gôndola','Verificar etiquetas'],
 turns:['Abertura','Fechamento'],photo:'required',mandatory:true,
 recurrence:{type:'daily'},time:'08:00',source:{checklistId:'ck-test'}
});
assert.ok(routineSource.indexOf('const expandChecklistItems=')<routineSource.indexOf('const Core={'),'O expansor precisa ser inicializado antes de ser exportado pelo núcleo.');
assert.equal(expanded.length,6,'Cada item do checklist deve virar uma atividade separada em cada turno.');
assert.deepEqual(expanded.map(item=>item.title),[
 'Conferir validade','Organizar gôndola','Verificar etiquetas',
 'Conferir validade','Organizar gôndola','Verificar etiquetas'
]);
assert.ok(expanded.every(item=>item.steps.length===0),'A atividade individual não deve renderizar o checklist inteiro como lista interna.');
assert.ok(expanded.every(item=>item.checklistSnapshot.length===1),'Cada atividade deve preservar somente seu próprio item no snapshot.');
assert.equal(new Set(expanded.map(item=>item.id)).size,6,'Cada item/turno precisa de ID determinístico e exclusivo.');
assert.ok(expanded.every(item=>item.photo==='required'&&item.mandatory),'Cada item deve preservar as regras de foto e obrigatoriedade do checklist.');
assert.match(routineSource,/legacyActivities\.flatMap\(activity=>expandChecklistItems/,'Modelos já migrados precisam ser convertidos para atividades individuais.');
assert.match(routineSource,/occurrence\.status==='pending'&&String\(occurrence\.date\)>=day\(\)\)delete D\.occurrences/,'Somente ocorrências pendentes atuais/futuras do cartão antigo devem ser regeneradas.');
assert.match(routineSource,/source:\{\.\.\.source,type:'legacy-assigned-checklist-item'\}/,'As novas atividades devem ser identificadas para a migração não se repetir.');

const assignment={id:'assign-1',modelId:'model-1',executorId:'person-1',verifierId:'leader-1',from:'2026-11-22',active:true};
const activity={id:'activity-1',title:'Conferir setor',mandatory:true,photo:'required',time:'08:15',recurrence:{type:'weekly',days:[1,2,3,4,5]}};
const model={id:'model-1',name:'Rotina do repositor',activities:[activity]};
const date=new Date(2026,10,23,8,15);
const day=Core.localDate(date);

assert.equal(day,'2026-11-23','Data deve usar o calendário local.');
assert.equal(Core.occurs({type:'weekly',days:[1]},'2026-11-23'),true,'Recorrência semanal deve usar segunda-feira como 1.');
assert.equal(Core.occurs({type:'monthly',days:[31]},'2026-01-31'),true,'Recorrência mensal deve aceitar o dia 31.');
assert.equal(Core.occurs({type:'date',date:'2026-11-23'},'2026-11-23'),true,'Data específica deve coincidir.');
assert.equal(Core.occurs({type:'date',date:'2026-11-22'},'2026-11-23'),false);
assert.equal(Core.occurs({type:'dates',dates:['2026-11-23','2026-11-25']},'2026-11-25'),true);
assert.equal(Core.occurs({type:'dates',dates:['2026-11-23','2026-11-25']},'2026-11-24'),false);
const limited={type:'weekly',days:[1,3],startDate:'2026-11-23',count:2};
assert.equal(Core.occurs(limited,'2026-11-23'),true);
assert.equal(Core.occurs(limited,'2026-11-25'),true);
assert.equal(Core.occurs(limited,'2026-11-30'),false);
assert.equal(Core.occurs({type:'daily',startDate:'2026-11-23',endDate:'2026-11-24'},'2026-11-25'),false);
assert.deepEqual(Core.legacyWeekdays([0,1,2,6]),[0,1,2,3],'Dias antigos do cronograma (segunda a domingo) devem ser convertidos para o padrão do calendário.');

const db={models:[model],assignments:[assignment],occurrences:{}};
const first=Core.generate(db,day, date.getTime());
assert.equal(first.created.length,1,'Primeira geração cria uma ocorrência.');
assert.equal(first.created[0].id,'assign-1|activity-1|2026-11-23','ID determinístico assignment|activity|date.');
assert.equal(Object.hasOwn(first.created[0],'verifierId'),false,'Novas ocorrências não devem carregar um encarregado paralelo; a liderança vem do cadastro do funcionário.');
db.occurrences[first.created[0].id]=first.created[0];
const second=Core.generate(db,day,date.getTime());
assert.equal(second.created.length,0,'Reabrir não duplica ocorrência.');
assert.equal(second.updated.length,0,'Snapshot igual não gera atualização.');
assert.equal(Core.state(first.created[0],new Date(2026,10,23,8,15)),'pending','No horário previsto a atividade permanece no prazo, sem tolerância.');
assert.equal(Core.state(first.created[0],new Date(2026,10,23,8,16)),'overdue','Um minuto após o horário previsto a atividade fica atrasada, sem tolerância.');
assert.equal(Object.hasOwn(first.created[0].snapshot,'tolerance'),false,'Novas ocorrências não devem carregar tolerância.');

const changed={...model,activities:[{...activity,title:'Título atualizado'}]};
const pendingUpdate=Core.generate({models:[changed],assignments:[assignment],occurrences:db.occurrences},day,date.getTime());
assert.equal(pendingUpdate.updated.length,1,'Ocorrência futura pendente recebe snapshot novo.');
assert.equal(pendingUpdate.updated[0].snapshot.title,'Título atualizado');

const completed={...first.created[0],status:'done',madeAt:date.getTime()};
const immutable=Core.generate({models:[changed],assignments:[assignment],occurrences:{[completed.id]:completed}},day,date.getTime());
assert.equal(immutable.updated.length,0,'Ocorrência concluída permanece imutável.');
assert.equal(completed.snapshot.title,'Conferir setor');

assert.equal(Core.activeOn({...assignment,until:'2026-11-22'},'2026-11-23'),false,'Atribuição encerrada não gera no dia seguinte.');
assert.equal(Core.activeOn(assignment,'2026-11-23'),true);
assert.equal(Core.assignmentValidOn({assignmentId:'ended',date:'2026-11-25'},[{id:'ended',active:false,from:'2026-10-01',until:'2026-11-25'}]),true,'Relatório deve preservar ocorrências até a data final da atribuição encerrada.');
assert.equal(Core.assignmentValidOn({assignmentId:'ended',date:'2026-11-26'},[{id:'ended',active:false,from:'2026-10-01',until:'2026-11-25'}]),false,'Relatório não pode contar ocorrências posteriores ao encerramento.');
assert.equal(Core.assignmentValidOn({assignmentId:'active',date:'2026-11-26'},[{id:'active',active:true,from:'2026-11-26'}]),true,'Relatório deve contar ocorrências da atribuição ativa.');

const performanceRows=[
 {status:'done',snapshot:{mandatory:true}},
 {status:'pending',snapshot:{mandatory:true}},
 {status:'done',snapshot:{mandatory:false}},
 {status:'dismissed',snapshot:{mandatory:true}},
 {status:'done',snapshot:{mandatory:true}}
];
assert.deepEqual(Core.progress(performanceRows),{done:2,total:3,pct:67},'O desempenho deve contar somente atividades obrigatórias não dispensadas, incluindo conclusão automática ou manual como uma única conclusão.');
assert.deepEqual(Core.progress([{status:'done',snapshot:{mandatory:false}}]),{done:0,total:0,pct:null},'Sem atividades obrigatórias, a porcentagem deve ser indisponível e não 0%.');
const performanceNow=new Date(2026,10,26,12,0,0);
const detailedPerformanceRows=[
 {status:'done',date:'2026-11-26',snapshot:{mandatory:true,time:'08:00'}},
 {status:'pending',date:'2026-11-25',snapshot:{mandatory:true,time:'08:00'}},
 {status:'pending',date:'2026-11-26',snapshot:{mandatory:true,time:'10:00'}},
 {status:'pending',date:'2026-11-26',snapshot:{mandatory:true,time:'14:00'}},
 {status:'pending',date:'2026-11-27',snapshot:{mandatory:true,time:'08:00'}},
 {status:'dismissed',date:'2026-11-26',snapshot:{mandatory:true,time:'08:00'}},
 {status:'done',date:'2026-11-26',snapshot:{mandatory:false,time:'08:00'}}
];
assert.deepEqual(Core.performance(detailedPerformanceRows,performanceNow),{done:1,overdue:2,pending:2,dismissed:1,total:5,scheduled:6,pct:20},'O painel deve separar concluídas, atrasadas, pendentes e dispensadas; dispensadas e opcionais não entram no percentual.');
assert.deepEqual(Core.performance([{status:'dismissed',date:'2026-11-26',snapshot:{mandatory:true,time:'08:00'}},{status:'done',date:'2026-11-26',snapshot:{mandatory:false,time:'08:00'}}],performanceNow),{done:0,overdue:0,pending:0,dismissed:1,total:0,scheduled:1,pct:null},'Período só com dispensadas/ opcionais deve ter percentual indisponível.');
const historicalDb={models:[{id:'m1',activities:[{id:'a1',title:'Diária',recurrence:{type:'daily'},mandatory:true}]}],assignments:[{id:'as1',modelId:'m1',executorId:'p1',active:true,from:'2026-10-01'}],occurrences:{}};
const oldDay=Core.generate(historicalDb,'2026-11-25');
assert.equal(oldDay.created.length,1,'A geração deve criar ocorrência para dia anterior ainda dentro da janela histórica.');
const completedId=oldDay.created[0].id;historicalDb.occurrences[completedId]={...oldDay.created[0],status:'done',snapshot:{...oldDay.created[0].snapshot,title:'Snapshot histórico original'}};
const rerunOldDay=Core.generate(historicalDb,'2026-11-25');
assert.equal(rerunOldDay.created.length,0,'A geração repetida não pode duplicar ocorrência histórica.');
assert.equal(rerunOldDay.updated.length,0,'A geração histórica não pode alterar snapshot de ocorrência já existente.');
assert.equal(historicalDb.occurrences[completedId].snapshot.title,'Snapshot histórico original','O histórico concluído deve permanecer imutável.');
const endedAssignmentDb={models:historicalDb.models,assignments:[{id:'ended',modelId:'m1',executorId:'p1',active:false,from:'2026-10-01',until:'2026-11-25'}],occurrences:{}};
assert.equal(Core.generate(endedAssignmentDb,'2026-11-25').created.length,1,'Atribuição encerrada deve manter geração histórica até a data final.');
assert.equal(Core.generate(endedAssignmentDb,'2026-11-26').created.length,0,'Atribuição encerrada não pode gerar ocorrências após a data final.');


assert.deepEqual(Core.progress([{status:'done',snapshot:{mandatory:true,viaSystem:true}},{status:'done',snapshot:{mandatory:true}}]),{done:2,total:2,pct:100},'Conclusões automáticas e manuais contam uma vez por ocorrência.');
assert.match(routineSource,/const progress=items=>\{[\s\S]{0,500}o\.snapshot\?\.mandatory!==false[\s\S]{0,250}status==='done'/,'O cálculo deve centralizar a regra de obrigatoriedade e conclusão.');
assert.match(routineSource,/overall=Core\.progress\(items\)/,'O indicador geral deve usar o mesmo cálculo padronizado.');
assert.match(routineSource,/personProgress=Core\.progress\(rows\)/,'O indicador por funcionário deve usar o mesmo cálculo padronizado.');
assert.match(routineSource,/personProgress\.pct==null\?'—':progress\+'%'/,'Sem atividades obrigatórias, o cartão da pessoa deve mostrar traço em vez de 0%.');
assert.match(routineSource,/overall\.total\+' obrigatórias concluídas/,'O total exibido deve informar que a porcentagem considera atividades obrigatórias.');

assert.equal(Core.dateValue('2026-11-23'),'2026-11-23','Data sem horário deve preservar o dia do calendário.');
assert.equal(Core.dateValue('23/11/2026'),'2026-11-23','Data brasileira deve ser normalizada.');
const instant='2026-11-23T01:30:00Z';
assert.equal(Core.dateValue(instant),Core.localDate(new Date(instant)),'Timestamp ISO deve ser convertido para o dia local.');
assert.equal(Core.dateValue('data-inválida'),'','Data inválida não pode gerar ocorrência.');

assert.equal(Core.state(first.created[0],new Date(2026,10,24,0,1)),'overdue','Ocorrência do dia anterior fica atrasada após a virada local.');
assert.equal(Core.state(first.created[0],new Date(2026,10,22,23,59)),'pending','Ocorrência futura não fica atrasada antes do dia.');

console.log('PASS - verificações do núcleo de Rotina, datas locais, migração de dias e imutabilidade.');

const employeeRoutineSection=routineSource.slice(routineSource.indexOf('function personSection(p)'),routineSource.indexOf('function assign(pid)'));
assert.ok(employeeRoutineSection.includes('Rotinas atribuídas')&&employeeRoutineSection.includes('Adicionar modelo'),'O cadastro deve atribuir modelos de rotina em um único fluxo.');
assert.ok(employeeRoutineSection.includes('Core.activeOn(a,day())'),'A lista do cadastro deve mostrar somente atribuições ativas.');
assert.ok(employeeRoutineSection.includes('rt-remove-assignment')&&employeeRoutineSection.includes('rtEnd('),'Cada modelo atribuído deve ter ação X para remover a atribuição.');
assert.ok(routineSource.includes('a.until=addDays(today,-1);a.active=false'),'Remover uma atribuição deve encerrá-la sem apagar o histórico anterior.');
assert.ok(routineSource.includes("o.status!=='pending'")&&routineSource.includes("status:'dismissed'")&&routineSource.includes("Atribuição removida do cadastro do funcionário."),'A remoção deve dispensar apenas ocorrências futuras pendentes, preservando as concluídas e o histórico passado.');
assert.ok(!employeeRoutineSection.includes('rtExtra')&&!employeeRoutineSection.includes('Encerrar'),'O cadastro de funcionário não deve oferecer atividade extra nem botão Encerrar nesta área.');
assert.ok(!indexSource.includes('pExtra(_0x34c024)+ptHTML(_0x34c024)'),'O cadastro não deve renderizar em paralelo a seleção legada por quadradinhos.');

assert.match(routineSource,/await root\.stPersistRoutineAssignment\(a\)/,'Remover uma atribuição deve aguardar a confirmação da sincronização antes de informar sucesso.');
assert.match(indexSource,/window\.stPersistRoutineAssignment=async function\(assignment\)[\s\S]{0,1800}await syncFlush\(\)[\s\S]{0,500}syncMeta\.queue\.some/,'A remoção deve aguardar o envio e verificar se a operação saiu da fila.');
assert.match(routineSource,/function list\(ids\)[\s\S]{0,700}Core\.activeOn\(assignment,day\(\)\)/,'A tela do funcionário não deve exibir ocorrências pendentes de uma atribuição encerrada.');



assert.match(indexSource,/employeeRoutineModelSelect[\s\S]{0,1200}addEmployeeRoutineModel/,'O cadastro de pessoa deve permitir escolher um único modelo e adicioná-lo à lista.');
assert.match(indexSource,/function addEmployeeRoutineModel\(\)[\s\S]{0,1800}function removeEmployeeRoutineModel/,'A seleção de modelos deve permitir adicionar e retirar itens sem recarregar o cadastro.');
assert.match(indexSource,/function removeEmployeeRoutineModel[\s\S]{0,1300}input\.remove\(\)/,'Retirar um modelo da seleção deve remover também seu valor enviado ao salvamento.');
assert.match(indexSource,/\['source'\].{0,20}'employee-profile-model'[\s\S]{0,500}archivedAt/,'Excluir uma atribuição criada pelo cadastro deve desmarcar o modelo e arquivar a atribuição, preservando histórico.');
assert.match(indexSource,/selectedModels=new Set\(_0x40cc98\['ckModels'\]\)[\s\S]{0,700}row\['archivedAt'\]=today\(\)/,'Salvar o cadastro deve arquivar atribuições de modelos que foram retiradas da seleção.');
assert.match(indexSource,/row\.mid===mid&&!row\.archivedAt[\s\S]{0,300}hadArchived[\s\S]{0,500}hadArchived\?'-'\+uid\(\)/,'Reatribuir um modelo arquivado deve criar uma nova atribuição sem sobrescrever o histórico anterior.');


const canMarkSource=routineSource.slice(routineSource.indexOf('function canMark(o)'),routineSource.indexOf('function list(ids)'));
assert.ok(canMarkSource.includes("typeof isFullAccess==='function'&&isFullAccess()")&&canMarkSource.includes("permissions.has('r:rot')")&&canMarkSource.includes("String(person.id)===String(o.executorId)")&&canMarkSource.includes("roles.includes('encarregado')")&&canMarkSource.includes("permissions.has('r:eqp')")&&canMarkSource.includes('visibleTeam().some')&&canMarkSource.includes('return own||leader'),'A marcação deve ficar limitada ao executor ou ao encarregado com r:eqp, sem liberar perfis de acesso total.');
assert.match(routineSource,/function card\(o\)[\s\S]{0,260}allowed=canMark\(o\)/,'A interface deve ocultar ações de marcar/dispensar para perfis sem autorização.');
assert.match(routineSource,/async function dismiss\(id\)[\s\S]{0,140}!canMark\(o\)/,'A dispensa também deve validar autorização antes de alterar a ocorrência.');
assert.match(routineSource,/async function complete\(id\)[\s\S]{0,140}!canMark\(o\)/,'A conclusão deve validar autorização antes de salvar foto ou alterar a ocorrência.');
assert.match(routineSource,/function detailsSheet\(\)[\s\S]{0,350}allowed=canMark\(o\)/,'A janela de detalhes só deve oferecer ações para quem pode marcar a atividade.');
assert.match(routineSource,/async function undoComplete\(id\)[\s\S]{0,180}status!=='done'[\s\S]{0,100}!canMark\(o\)/,'A desmarcação deve exigir a mesma autorização da marcação.');
assert.match(routineSource,/async function toggleComplete\(id\)[\s\S]{0,160}!canMark\(o\)/,'O alternador não deve aceitar ações de quem apenas consegue visualizar a equipe.');

const performanceBreakdown=Core.performance([
 {date:'2026-11-24',status:'done',snapshot:{mandatory:true,time:'08:00'}},
 {date:'2026-11-25',status:'pending',snapshot:{mandatory:true,time:'08:00'}},
 {date:'2026-11-26',status:'pending',snapshot:{mandatory:true,time:'08:00'}},
 {date:'2026-11-27',status:'pending',snapshot:{mandatory:true,time:'08:00'}},
 {date:'2026-11-25',status:'dismissed',snapshot:{mandatory:true,time:'08:00'}},
 {date:'2026-11-24',status:'done',snapshot:{mandatory:false,time:'08:00'}}
],new Date(2026,10,26,12,0));
assert.deepEqual(performanceBreakdown,{done:1,overdue:2,pending:1,dismissed:1,total:4,scheduled:5,pct:25},'O desempenho deve separar concluídas, atrasadas, pendentes e dispensadas; dispensadas ficam fora do denominador e atividades opcionais não entram.');
assert.deepEqual(Core.performance([{status:'dismissed',date:'2026-11-25',snapshot:{mandatory:true}}],new Date(2026,10,26,12,0)),{done:0,overdue:0,pending:0,dismissed:1,total:0,scheduled:1,pct:null},'Quando todas as atividades forem dispensadas, o percentual deve ser indisponível.');
assert.match(routineSource,/const performance=\s*\(items,now=new Date\(\)\)=>/,'O núcleo deve centralizar a classificação do desempenho.');
assert.match(routineSource,/const all=Core\.performance\(rows\)/,'O painel de desempenho deve usar o resumo padronizado.');
const historySource=routineSource.slice(routineSource.indexOf('function historyScreen()'),routineSource.indexOf('function todayScreen()'));
assert.doesNotMatch(historySource,/o\.status!=='dismissed'/,'O histórico não deve filtrar dispensadas antes de calcular seus indicadores.');
assert.match(routineSource,/all\.overdue[\s\S]{0,200}all\.dismissed/,'O resumo deve exibir atrasadas e dispensadas.');


assert.deepEqual(Core.calendarWeek('2026-11-27'),['2026-11-22','2026-11-23','2026-11-24','2026-11-25','2026-11-26','2026-11-27','2026-11-28'],'A semana compacta deve iniciar no domingo e manter datas locais.');
assert.equal(Core.calendarMonthGrid('2026-11-27').length,42,'A grade mensal deve manter seis semanas para não saltar de altura entre meses.');
assert.equal(Core.calendarMonthGrid('2026-11-27')[0],'2026-11-01','O calendário mensal deve começar no domingo da primeira semana do mês.');
assert.equal(Core.calendarShiftMonth('2026-01-31',1),'2026-02-28','Avançar mês deve limitar o dia ao último dia existente no mês de destino.');
assert.match(routineSource,/const calendarWeek=date=>[\s\S]{0,450}getDay\(\)/,'O cálculo da semana deve usar datas locais e semana iniciada no domingo.');
assert.match(routineSource,/const calendarMonthGrid=date=>[\s\S]{0,650}Array\.from\(\{length:42\}/,'O mês deve renderizar uma grade estável de seis semanas.');
assert.match(routineSource,/function calendarItemsOn\(date,ids\)[\s\S]{0,1000}const previews=Core\.generate\(D,date\)\.created\.filter/,'O calendário deve pré-visualizar atividades de qualquer data sem gravá-las antecipadamente.');
assert.doesNotMatch(routineSource,/const previews=date>=day\(\)\?Core\.generate/,'A prévia do calendário não deve ser limitada às datas atuais e futuras.');
const historicalPreviewDb={models:[{id:'m-hist',name:'Rotina histórica',activities:[{id:'a-hist',title:'Atividade histórica',recurrence:{type:'daily',startDate:'2026-01-01'},time:'08:00'}]}],assignments:[{id:'as-hist',modelId:'m-hist',executorId:'p-hist',from:'2026-01-01',active:true}],occurrences:{}};
const historicalPreviewBefore=JSON.stringify(historicalPreviewDb);
const historicalPreview=Core.generate(historicalPreviewDb,'2026-01-02');
assert.equal(historicalPreview.created.length,1,'Uma recorrência ativa deve aparecer como prévia em uma data passada sem ocorrência materializada.');
assert.equal(historicalPreview.created[0].date,'2026-01-02','A prévia histórica deve respeitar a data selecionada.');
assert.equal(JSON.stringify(historicalPreviewDb),historicalPreviewBefore,'Gerar prévia histórica não pode gravar nem alterar dados locais.');
assert.match(routineSource,/function calendarMarkup\(ids,canCreate\)[\s\S]{0,3000}aria-pressed/,'Os dias do calendário devem ter estado selecionado acessível.');
assert.match(routineSource,/function calendarSheet\(\)[\s\S]{0,2800}card\(o\)[\s\S]{0,1000}Programada/,'O painel inferior deve exibir registros existentes e prévias de atividades futuras.');
assert.match(routineSource,/function calendarSheet\(\)[\s\S]{0,1800}snapshot\?\.modelName\|\|'Rotina'/,'O painel do dia deve identificar o modelo de Rotina de cada atividade.');
assert.match(routineSource,/calendarMarkup\(master\?\(S\.team\|\|\[\]\)\.filter\(x=>!x\.adm\)\.map\(x=>String\(x\.id\)\):tab==='team'\?teamIds:mine,[\s\S]{0,400}includes\('r:rot'\)/,'A criação rápida deve exigir permissão r:rot e não deve aparecer para Master/admin, enquanto o calendário do Master inclui todos os funcionários.');
assert.match(routineSource,/function calendarNewActivity\(\)[\s\S]{0,1500}recurrence:\{type:'date',date,startDate:date\}/,'Nova atividade deve começar como pontual na data escolhida e permitir alterar a recorrência no editor.');
assert.match(routineSource,/function calendarNewActivity\(\)[\s\S]{0,1800}source==='manual-extra'[\s\S]{0,700}V\.rtDraft\.activities\.push/,'Novas atividades devem reutilizar o modelo extra individual existente, evitando duplicar atribuições.');
assert.match(routineSource,/function todayScreen\(\)[\s\S]{0,3000}calendarMarkup\(master\?\(S\.team\|\|\[\]\)\.filter\(x=>!x\.adm\)\.map\(x=>String\(x\.id\)\):tab==='team'\?teamIds:mine/,'O calendário deve incluir todos os funcionários no Master e respeitar Minha rotina/Equipe nos demais perfis.');
assert.match(routineSource,/V\.sh==='routine-calendar'[\s\S]{0,300}calendarSheet\(\)/,'O painel do calendário deve usar o gerenciador de janelas existente.');
assert.match(routineSource,/function calendarTouchEnd\(event\)[\s\S]{0,500}calendarShift\(end<start\?1:-1\)/,'O calendário deve aceitar deslize horizontal para navegar.');
assert.match(routineSource,/\.rt-calendar-day\{[\s\S]{0,500}min-height:58px/,'Os dias do calendário devem manter área de toque confortável.');
assert.match(routineSource,/\.rt-calendar-dot\.is-late\{background:var\(--no\)\}[\s\S]{0,160}\.is-pending\{background:var\(--pr\)\}[\s\S]{0,100}\.is-done\{background:var\(--ok\)\}/,'Os indicadores devem distinguir atrasadas, pendentes e concluídas por cor.');
assert.match(routineSource,/\.rt-calendar-sheet>\.sheet-body\{flex:1 1 auto!important;min-height:0;max-height:100%;overflow-y:auto/,'O calendário deve reservar o espaço restante da janela para uma área interna rolável, mesmo quando há muitas atividades.');
assert.match(routineSource,/function calendarSheet\(\)[\s\S]{0,1800}<div class="sheet-body">[\s\S]{0,2000}<\/div><\/section>/,'O conteúdo do calendário deve usar exatamente a classe sheet-body que recebe a rolagem interna.');
assert.match(routineSource,/\.rt-calendar-sheet\{[^}]*display:flex;flex-direction:column/,'O calendário deve herdar o limite de altura e os pontos de expansão do gerenciador global.');
assert.match(routineSource,/\.rt-calendar-sheet-head\{position:sticky;top:0/,'O cabeçalho e o botão de fechar do calendário devem permanecer acessíveis durante a rolagem.');
assert.match(routineSource,/\.rt-details-sheet\{[^}]*overflow:hidden/,'A janela de detalhes deve deixar a rolagem para o corpo interno, sem competir com o gesto de arrastar.');
assert.match(routineSource,/\.rt-details-sheet>\.sheet-body\{[^}]*overflow-y:auto/,'Os detalhes devem continuar roláveis dentro do limite global da janela.');
assert.doesNotMatch(routineSource,/\.rt-details-sheet\{[^}]*max-height:calc\(100(?:dvh|svh)/,'A janela de detalhes não deve ultrapassar o limite global de aproximadamente metade da tela.');
assert.doesNotMatch(routineSource,/\.rt-details-sheet\{[^}]*--extra:0px/,'A janela de detalhes não deve zerar a expansão elástica controlada pelo gerenciador global.');
assert.match(indexSource,/\.sheet\{display:flex;flex-direction:column;box-sizing:border-box;height:auto;overflow:hidden;transition:max-height 320ms/,'Todas as janelas devem crescer conforme o conteúdo e limitar o excesso ao corpo rolável.');
assert.match(indexSource,/\.sheet-body\{flex:1 1 auto;min-height:0;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain/,'Todas as janelas devem rolar internamente quando atingirem o limite de altura.');
assert.match(indexSource,/max-height:calc\(48svh \+ var\(--extra\)\)/,'O limite global mobile deve considerar a área visível com as barras do navegador abertas, mantendo o conteúdo excedente rolável.');
assert.doesNotMatch(routineSource,/function toggleTeamPerson\(pid\)[\s\S]{0,1400}scrollIntoView/,'A expansão não deve forçar a rolagem da página nem provocar reposicionamento global.');
assert.match(routineSource,/function todayScreen\(\)[\s\S]{0,5000}expanded=String\(V\.rtExpandedPerson\|\|'\'\)===pid[\s\S]{0,500}aria-expanded/,'A renderização deve refletir o estado expandido em uma única pessoa e manter aria-expanded sincronizado.');
assert.ok(routineSource.includes("class=\"c rt-person-card\" id=\"rt-person-card-\'+e(pid)"),'Cada pessoa deve ter um alvo estável para revelar suas atividades após a expansão.');
assert.ok(routineSource.includes(String.raw`onclick="rtToggleTeamPerson(\'`)&&routineSource.includes(String.raw`+e(pid)+'\')"`),'A expansão da equipe deve usar o controlador que revela as atividades na tela.');
assert.doesNotMatch(routineSource,/calendarWeek[\s\S]{0,1000}toISOString/,'O calendário não deve converter datas locais usando toISOString.');
assert.match(routineSource,/function ensureRoutinePermission\(pid\)[\s\S]{0,350}includes\('r:rot'\)/,'A atribuição de atividades individuais deve garantir a permissão de Rotina ao funcionário.');
assert.match(routineSource,/function saveModel\(\)[\s\S]{0,2200}if\(target\)[\s\S]{0,300}source:'manual-extra'[\s\S]{0,250}ensureRoutinePermission\(target\)/,'Salvar uma atividade extra individual deve criar a atribuição e conceder r:rot antes de sincronizar.');
assert.match(routineSource,/function assign\(pid\)[\s\S]{0,800}ensureRoutinePermission\(pid\)/,'A atribuição de um modelo também deve usar a mesma regra de permissão.');
