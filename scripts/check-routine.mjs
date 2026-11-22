import assert from 'node:assert/strict';
import Core from '../routine.js';

const assignment={id:'assign-1',modelId:'model-1',executorId:'person-1',verifierId:'leader-1',from:'2026-11-22',active:true};
const activity={id:'activity-1',title:'Conferir setor',mandatory:true,photo:'required',time:'08:00',tolerance:15,recurrence:{type:'weekly',days:[1,2,3,4,5]}};
const model={id:'model-1',name:'Rotina do repositor',activities:[activity]};
const date=new Date(2026,10,23,8,15);
const day=Core.localDate(date);

assert.equal(day,'2026-11-23','Data deve usar o calendário local.');
assert.equal(Core.occurs({type:'weekly',days:[1]},'2026-11-23'),true,'Recorrência semanal deve usar segunda-feira como 1.');
assert.equal(Core.occurs({type:'monthly',days:[31]},'2026-01-31'),true,'Recorrência mensal deve aceitar o dia 31.');
assert.equal(Core.occurs({type:'date',date:'2026-11-23'},'2026-11-23'),true,'Data específica deve coincidir.');
assert.equal(Core.occurs({type:'date',date:'2026-11-22'},'2026-11-23'),false);

const db={models:[model],assignments:[assignment],occurrences:{}};
const first=Core.generate(db,day, date.getTime());
assert.equal(first.created.length,1,'Primeira geração cria uma ocorrência.');
assert.equal(first.created[0].id,'assign-1|activity-1|2026-11-23','ID determinístico assignment|activity|date.');
db.occurrences[first.created[0].id]=first.created[0];
const second=Core.generate(db,day,date.getTime());
assert.equal(second.created.length,0,'Reabrir não duplica ocorrência.');
assert.equal(second.updated.length,0,'Snapshot igual não gera atualização.');
assert.equal(Core.state(first.created[0],new Date(2026,10,23,8,15)),'pending','No limite da tolerância ainda está no prazo.');
assert.equal(Core.state(first.created[0],new Date(2026,10,23,8,16)),'overdue','Após a tolerância fica atrasada.');

const changed={...model,activities:[{...activity,title:'Título atualizado'}]};
const pendingUpdate=Core.generate({models:[changed],assignments:[assignment],occurrences:db.occurrences},day,date.getTime());
assert.equal(pendingUpdate.updated.length,1,'Ocorrência futura pendente recebe snapshot novo.');
assert.equal(pendingUpdate.updated[0].snapshot.title,'Título atualizado');

const completed={...first.created[0],status:'done',madeAt:date.getTime()};
const immutable=Core.generate({models:[changed],assignments:[assignment],occurrences:{[completed.id]:completed}},day,date.getTime());
assert.equal(immutable.updated.length,0,'Ocorrência concluída permanece imutável.');
assert.equal(completed.snapshot.title,'Conferir setor');

const next=Core.merge({models:[model],assignments:[assignment],occurrences:db.occurrences},{models:[model],assignments:[assignment],occurrences:db.occurrences});
assert.equal(next.models.length,1,'Importação repetida não duplica modelos.');
assert.equal(next.assignments.length,1,'Importação repetida não duplica atribuições.');
assert.equal(Object.keys(next.occurrences).length,1,'Importação repetida não duplica ocorrências.');

assert.equal(Core.activeOn({...assignment,until:'2026-11-22'},'2026-11-23'),false,'Atribuição encerrada não gera no dia seguinte.');
assert.equal(Core.activeOn(assignment,'2026-11-23'),true);

assert.equal(Core.dateValue('2026-11-23'),'2026-11-23','Data sem horário deve preservar o dia do calendário.');
assert.equal(Core.dateValue('23/11/2026'),'2026-11-23','Data brasileira deve ser normalizada.');
const instant='2026-11-23T01:30:00Z';
assert.equal(Core.dateValue(instant),Core.localDate(new Date(instant)),'Timestamp ISO deve ser convertido para o dia local, não cortado como texto.');
assert.equal(Core.dateValue('data-inválida'),'','Data inválida não pode gerar ocorrência.');

const newerModel={...model,name:'Modelo atualizado',updatedAt:20};
const olderModel={...model,name:'Modelo antigo',updatedAt:10};
const newerAssignment={...assignment,verifierId:'leader-2',updatedAt:30};
const mergedUpdates=Core.merge(
 {models:[olderModel],assignments:[assignment],occurrences:{}},
 {models:[newerModel],assignments:[newerAssignment],occurrences:{}}
);
assert.equal(mergedUpdates.models[0].name,'Modelo atualizado','Backup mais novo atualiza modelo existente sem duplicar.');
assert.equal(mergedUpdates.assignments[0].verifierId,'leader-2','Backup mais novo atualiza atribuição existente sem duplicar.');

const pendingOccurrence={...first.created[0],updatedAt:10,status:'pending'};
const doneOccurrence={...first.created[0],updatedAt:20,status:'done',madeAt:20,madeBy:'leader-1'};
const completedMerge=Core.merge(
 {models:[model],assignments:[assignment],occurrences:{[pendingOccurrence.id]:pendingOccurrence}},
 {models:[],assignments:[],occurrences:{[doneOccurrence.id]:doneOccurrence}}
);
assert.equal(completedMerge.occurrences[doneOccurrence.id].status,'done','Conclusão importada prevalece sobre pendência.');
const noRegression=Core.merge(
 {models:[model],assignments:[assignment],occurrences:{[doneOccurrence.id]:doneOccurrence}},
 {models:[],assignments:[],occurrences:{[pendingOccurrence.id]:{...pendingOccurrence,updatedAt:999}}}
);
assert.equal(noRegression.occurrences[doneOccurrence.id].status,'done','Backup antigo não reabre ocorrência concluída, mesmo com timestamp maior.');
assert.equal(Core.state(first.created[0],new Date(2026,10,24,0,1)),'overdue','Ocorrência do dia anterior fica atrasada após a virada local.');
assert.equal(Core.state(first.created[0],new Date(2026,10,22,23,59)),'pending','Ocorrência futura não fica atrasada antes do dia.');

console.log('PASS - verificações do núcleo de Rotina, datas locais, merge e imutabilidade.');
