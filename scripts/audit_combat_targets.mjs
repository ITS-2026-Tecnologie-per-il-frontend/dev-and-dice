// Run: node scripts/audit_combat_targets.mjs [--check]. Uses the same rules as combat.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { loadCandidateCreationData } from '../src/domain/dnd/VerifiedDatabase.ts'
import { activeCatalog } from '../src/domain/dnd/ActiveRules.ts'
import { combatTargeting } from '../src/domain/dnd/CombatTargets.ts'
import { catalogAbilityKind } from '../src/utils/Catalog.ts'

const directory=resolve('public/data/rules2014')
const data=await loadCandidateCreationData('runtime',async url=>{const file=join(directory,url.replace('runtime/',''));return {ok:existsSync(file),text:async()=>readFileSync(file,'utf8')}})
const catalog=activeCatalog(data,'it'),counts={},rows=[]
const escape=value=>String(value).replaceAll('|','\\|').replaceAll('\n',' ')
for(const entry of catalog.abilities) {
    const passive=catalogAbilityKind(entry).passive,spell=typeof entry.data.level==='number'
    const rule=passive ? {kind:'passive',maximum:null,summary:'Tratto passivo: escluso dalle azioni.'} : combatTargeting({catalogId:entry.id},catalog,{kind:'PG',level:'1'})
    const edition=entry.data.edition ?? entry.data.ruleset ?? 'fonte legacy / edizione non verificata'
    const group=(spell?'Incantesimi':'Abilità e attacchi')+' · '+edition+' · '+rule.kind
    counts[group]=(counts[group]??0)+1
    const sources=entry.data.ruleSources ?? entry.sourceUrl
    rows.push([entry.id,entry.name,spell?'Incantesimo':'Creatura',edition,rule.kind,rule.maximum??'—',rule.summary,typeof sources==='string'?sources:JSON.stringify(sources)].map(escape).join(' | '))
}
const fingerprint=['public/data/database.json','public/data/rules2014/verified-reference.json'].map(file=>file+': '+createHash('sha256').update(readFileSync(file)).digest('hex')).join('\n')
const report='# Controllo dei bersagli di incantesimi e attacchi\n\nGenerato con `node scripts/audit_combat_targets.mjs`; verifica riproducibile con `--check`.\n\n'+
    'I limiti numerici riguardano i bersagli distinti di un singolo utilizzo. Raggi e dardi si ripartiscono; non si moltiplica il danno completo per ciascun bersaglio. Lo slot effettivo e il livello del personaggio aggiornano i limiti in combattimento. Per Multiattacco restano da rispettare sequenza e alternative.\n\n'+
    'L’inventario riporta il livello base e, per i trucchetti, il primo livello del personaggio. Area non significa bersagli illimitati: il Master verifica geometria, distanze e condizioni. `review` segnala dati insufficienti o usi complessi, senza inventare un limite. Le edizioni rimangono separate.\n\n'+
    'Fonti delle regole generali: D&D_5_Player_Original_Handbook.pdf (2014), pagina PDF 205, Targets / Areas of Effect; D&D_5_Monster_Original_Handbook.pdf (2014), pagina PDF 342, Worg. Le singole voci conservano le proprie fonti nel catalogo.\n\n'+
    '```text\n'+fingerprint+'\n```\n\n'+Object.entries(counts).sort().map(([group,n])=>'- '+group+': **'+n+'**').join('\n')+
    '\n\n| ID | Nome | Tipo | Edizione | Esito | Massimo base | Sintesi | Fonte |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n'+rows.sort().map(row=>'| '+row+' |').join('\n')+'\n'
const output=resolve('reports/combat-targets.md')
if(process.argv.includes('--check')) assert.equal(readFileSync(output,'utf8'),report,'Riesegui node scripts/audit_combat_targets.mjs dopo le modifiche ai dati o alle regole.')
else writeFileSync(output,report)
console.log(JSON.stringify({entries:rows.length,counts},null,2))
