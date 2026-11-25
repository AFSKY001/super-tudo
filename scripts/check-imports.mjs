import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const scriptTags=[...html.matchAll(/<script\\b([^>]*)>([\\s\\S]*?)<\\/script\\s*>/gi)];
let source='';
for(const match of scriptTags){
 const candidate=match[2];
 if(candidate.includes('function pimParse(')&&candidate.includes('function pimFingerprint(')){source=candidate;break;}
}
assert.ok(source,'Import parser script was not found');
const ast=parse(source,{ecmaVersion:'latest',sourceType:'script'});
const wanted=new Set(['pimNorm','pimParse','pimFingerprint']);
const declarations=ast.body.filter(node=>node.type==='FunctionDeclaration'&&wanted.has(node.id?.name));
for(const name of wanted)assert.ok(declarations.some(node=>node.id.name===name),'Missing '+name);
const code=declarations.map(node=>source.slice(node.start,node.end)).join('\\n')+'\\nglobalThis.api={pimParse,pimFingerprint};';
const context={motivoBusca:value=>({n:String(value||'').trim()})};
vm.runInNewContext(code,context);
const {pimParse,pimFingerprint}=context.api;

const semicolon='Produto;Descrição;Quantidade;Custo c/ imposto;Custo total;Motivo\\n123;Pão francês;2;3,50;7,00;Quebra operacional';
const parsed=pimParse(semicolon);
assert.equal(parsed.err,undefined);
assert.equal(parsed.rows.length,1);
assert.equal(parsed.rows[0].c,'123');
assert.equal(parsed.rows[0].q,2);
assert.equal(parsed.rows[0].vu,3.5);
assert.equal(parsed.rows[0].vt,7);
assert.equal(parsed.total,7);

const multiline='Produto,Descrição,Quantidade,Custo unitário,Valor total,Motivo\\r\\n456,"Pão, integral\\ncom sementes",3,2.50,7.50,"Quebra ""operacional"""';
const multi=pimParse(multiline);
assert.equal(multi.err,undefined);
assert.equal(multi.rows.length,1);
assert.equal(multi.rows[0].p,'Pão, integral\\ncom sementes');
assert.equal(multi.rows[0].m,'Quebra "operacional"');

const noTotal='Produto;Descrição;Quantidade;Custo com imposto;Motivo\\n789;Leite;2;4,25;Quebra operacional';
const calculated=pimParse(noTotal);
assert.equal(calculated.rows[0].vt,8.5);

const duplicate='Produto;Descrição;Quantidade;Custo c/ imposto;Motivo\\n111;Arroz;1;5,00;Quebra operacional\\n111;Arroz;1;5,00;Quebra operacional';
const duplicated=pimParse(duplicate);
assert.equal(duplicated.rows.length,1);
assert.equal(duplicated.errs.length,1);
assert.match(duplicated.errs[0].msg,/linha duplicada/);

const malformed=pimParse('Produto;Descrição;Quantidade;Custo c/ imposto;Motivo\\n111;"Arroz;1;5,00;Quebra operacional');
assert.match(malformed.err,/aspas abertas/);

assert.notEqual(pimFingerprint('arquivo A','Açougue'),pimFingerprint('arquivo B','Açougue'));
assert.notEqual(pimFingerprint('mesmo arquivo','Açougue'),pimFingerprint('mesmo arquivo','Padaria'));
assert.equal(pimFingerprint('mesmo arquivo','Açougue'),pimFingerprint('mesmo arquivo','Açougue'));

console.log('Import checks passed: CSV quoting/multiline, aliases, totals, duplicates, malformed quotes and fingerprints.');
