import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import Core from '../routine.js';

const rootDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const routineSource=fs.readFileSync(path.join(rootDir,'routine.js'),'utf8');
const indexSource=fs.readFileSync(path.join(rootDir,'index.html'),'utf8');
assert.match(routineSource,/function migrate\(\)[\s\S]{0,700}bridge\.migrateCronogramaModelsToChecklists\(\)[\s\S]{0,4000}routine-assigned-checklists-v2[\s\S]{0,2600}if\(S\.migrations\.includes\('routine-v1'\)\)return/,'Migração de checklists atribuídos deve rodar mesmo quando routine-v1 já existe.');
assert.match(routineSource,/const checklistItems=c=>\{const raw=Array\.isArray\(c\?\.l\)&&c\.l\.length\?c\.l:[\s\S]{0,140}c\.i\.split\('\|'\)/,'Itens legados em formato pipe precisam ser lidos para gerar as atividades.');
assert.match(routineSource,/function assign\(pid\)[\s\S]{0,700}person\.perm\.includes\('r:rot'\)/,'Atribuir uma Rotina deve liberar a permissão de menu da pessoa.');
assert.match(routineSource,/function modelPage\(\)[\s\S]{0,700}V\.rotChecklistHub=true;R\(\)[\s\S]{0,100}Modelos de checklist/,'A tela de modelos precisa manter o acesso aos modelos de checklist.');
assert.match(indexSource,/migrateCronogramaModelsToChecklists\(\),window\.__ST_CLOUD_SYNC_READY__=true,window\.dispatchEvent\(new Event\('st:cloud-sync-ready'\)\)/,'A Rotina deve repetir a migração depois que os dados da nuvem forem carregados.');
assert.match(indexSource,/window\.__ST_CLOUD_SYNC_READY__=true,window\.dispatchEvent\(new Event\('st:cloud-sync-ready'\)\)/,'A conclusão da sincronização deve ficar registrada para scripts carregados depois.');
assert.match(routineSource,/if\(root\.__ST_CLOUD_SYNC_READY__\)\{migrate\(\);generateDay\(\);syncFunctions\(\);\}/,'A migração deve executar mesmo se a hidratação terminar antes de routine.js carregar.');
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
assert.equal(Core.dateValue('2026-11-23'),'2026-11-23','Data sem horário deve preservar o dia do calendário.');
assert.equal(Core.dateValue('23/11/2026'),'2026-11-23','Data brasileira deve ser normalizada.');
const instant='2026-11-23T01:30:00Z';
assert.equal(Core.dateValue(instant),Core.localDate(new Date(instant)),'Timestamp ISO deve ser convertido para o dia local.');
assert.equal(Core.dateValue('data-inválida'),'','Data inválida não pode gerar ocorrência.');

assert.equal(Core.state(first.created[0],new Date(2026,10,24,0,1)),'overdue','Ocorrência do dia anterior fica atrasada após a virada local.');
assert.equal(Core.state(first.created[0],new Date(2026,10,22,23,59)),'pending','Ocorrência futura não fica atrasada antes do dia.');

console.log('PASS - verificações do núcleo de Rotina, datas locais, migração de dias e imutabilidade.');
