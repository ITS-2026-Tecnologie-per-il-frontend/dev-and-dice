import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { newCharacterSheet, parseCharacterSheets } from '../src/utils/CharacterSheets.ts'
import { enableCreation, spellRules, spellSelection, spellSelectionBlock, withWizardCatalog } from '../src/utils/PlayerCreation.ts'
import { changeTutorialOrigin, parseTutorialDraft } from '../src/utils/CharacterTutorial.ts'
import { copyWizardSpell } from '../src/utils/Wizard.ts'
const json = (name) => JSON.parse(readFileSync(new URL(`../public/data/${name}.json`, import.meta.url),'utf8'))
const data = withWizardCatalog({...json('character-options'),...json('character-equipment'),skills:json('character-rules').skills},json('wizard-catalog'))
const create = (level=3,edition='2014',extra={},cls='wizard') => enableCreation({...newCharacterSheet(),kind:'PG',name:'Limiti',level:String(level),intelligence:'16',wisdom:'16',charisma:'16',playerDetails:{'creation.class':cls,'rules.edition':edition,...extra}},data)
function add(sheet,id,learned='level',prepared=false,source='class') {
    const spell = data.spells.find((s) => s.index === id); assert.ok(spell,id)
    const d = {...sheet.playerDetails}; let index=0
    while(d[`spell.${spell.level}.${index}.name`]) index++
    const root=`spell.${spell.level}.${index}`
    Object.assign(d,{[`${root}.name`]:spell.name,[`${root}.index`]:id,[`${root}.source`]:source,[`${root}.learned`]:learned,[`${root}.prepared`]:String(prepared)})
    return {...sheet,playerDetails:d}
}
const selection = (sheet) => spellSelection(sheet,data)
const blocked = (sheet,choice) => spellSelectionBlock(selection(sheet),choice)
const limit = (sheet,id) => selection(sheet).limits.find((x) => x.id===id)
let sheet=add(add(create(),'acid-arrow'),'blur')
assert.match(blocked(sheet,{level:2}),/2\/2/)
assert.equal(blocked(sheet,{level:1}),'','Other tiers remain selectable')
assert.equal(blocked(sheet,{level:2,root:'spell.2.0'}),'','Selected rows stay replaceable')
const freed={...sheet,playerDetails:{...sheet.playerDetails,'spell.2.0.name':''}}
assert.equal(blocked(freed,{level:2}),'','Deselecting immediately restores capacity')
sheet=add(sheet,'blindness-deafness')
assert.ok(selection(sheet).issues.some((s) => /3\/2, 1 in eccesso/.test(s)))
const serialized=JSON.stringify(sheet)
assert.deepEqual(parseCharacterSheets(JSON.stringify([sheet]))[0],sheet)
assert.deepEqual(parseTutorialDraft(JSON.stringify({...sheet,playerDetails:{...sheet.playerDetails,'tutorial.active':'true','tutorial.step':'6'}})).playerDetails['spell.2.2.name'],'Blindness/Deafness')
assert.equal(JSON.stringify(sheet),serialized,'Validation never deletes excess selections')
for (const template of ['generic','wizard','wizard-pdf']) {
    const switched={...sheet,playerDetails:{...sheet.playerDetails,'sheet.template':template}}
    assert.deepEqual(selection(parseCharacterSheets(JSON.stringify([switched]))[0]).limits,selection(sheet).limits,'Template changes and reopening preserve the same limits')
}
assert.equal(blocked(sheet,{level:2,root:'spell.2.2'}),'','Legacy excess remains editable')
const higher=changeTutorialOrigin(sheet,data,'level','5')
assert.equal(blocked(higher,{level:2}),'')
assert.equal(higher.playerDetails['spell.2.2.name'],sheet.playerDetails['spell.2.2.name'])
const lower=changeTutorialOrigin(higher,data,'level','1')
assert.equal(lower.playerDetails['spell.2.2.name'],sheet.playerDetails['spell.2.2.name'],'Lowering level preserves invalid spells for correction')
assert.ok(selection(lower).issues.length)
let cumulative=create(5)
for (const id of ['acid-arrow','blur','blindness-deafness','darkness']) cumulative=add(cumulative,id)
for (const id of ['fireball','fly']) cumulative=add(cumulative,id)
assert.match(blocked(cumulative,{level:2}),/6\/6/)
assert.match(blocked(cumulative,{level:3}),/6\/6|2\/2/)
let total=create(1)
for (const s of spellRules(total,data).spells.filter((s) => s.level===1).slice(0,6)) total=add(total,s.index)
assert.match(blocked(total,{level:1}),/6\/6/)
assert.equal(blocked(total,{level:1,learned:'copied'}),'')
assert.equal(blocked(total,{level:1,learned:'feature'}),'')
for(const s of spellRules(total,data).spells.filter((s) => s.level===0).slice(0,3)) total=add(total,s.index)
assert.match(blocked(total,{level:0}),/3\/3/)
assert.equal(blocked(total,{level:0,source:'racial'}),'')
assert.equal(blocked(total,{level:0,learned:'feature'}),'')
const copied=copyWizardSpell({...total,playerDetails:{...total.playerDetails,'coins.MO':'200'}},data,'magic-missile')
assert.equal(limit(copied,'wizard-book').roots.length,6)
assert.equal(copied.playerDetails['coins.MO'],'150')
const slots={...copied,playerDetails:{...copied.playerDetails,'slots.3.total':'5','creation.override.slots.3.total':'true'}}
assert.throws(() => copyWizardSpell(slots,data,'fireball'),/livello disponibile/)
assert.equal(spellRules(slots,data).maxLevel,1,'Slot overrides cannot unlock acquisition tiers')
let prep=create(3)
for(const s of spellRules(prep,data).spells.filter((s) => s.level===1).slice(0,6)) prep=add(prep,s.index,'copied',true)
prep=add(prep,'acid-arrow','copied')
assert.equal(limit(prep,'wizard-book').roots.length,0)
assert.match(blocked(prep,{level:2,root:'spell.2.0',prepare:true}),/6\/6/)
assert.equal(blocked(prep,{level:1,root:'spell.1.0',prepare:true}),'')
assert.equal(blocked({...prep,playerDetails:{...prep.playerDetails,'spell.1.0.prepared':'false'}},{level:2,root:'spell.2.0',prepare:true}),'')
const lowInt={...prep,intelligence:'10'}
assert.equal(limit(lowInt,'prepared').maximum,3)
const revised=changeTutorialOrigin(lowInt,data,'edition','2024')
assert.equal(limit(revised,'prepared').maximum,6)
assert.equal(revised.playerDetails['spell.2.0.name'],lowInt.playerDetails['spell.2.0.name'])
assert.equal(blocked(prep,{level:2,prepare:true,alwaysPrepared:true}),'')
let savant=create(5,'2024',{'creation.subclass':'evocation'})
for(const id of ['burning-hands','magic-missile','fireball']) savant=add(savant,id,'savant')
assert.equal(limit(savant,'wizard-book').roots.length,0)
assert.equal(limit(savant,'wizard-savant').maximum,3)
assert.match(blocked(savant,{level:2,learned:'savant'}),/3\/3/)
assert.equal(blocked(savant,{level:2}),'')
assert.match(blocked(create(5,'2024',{'creation.subclass':'evocation'}),{level:2,learned:'savant',spell:data.spells.find((s) => s.index==='blur')}),/scuola/)
assert.match(blocked(create(3,'2014',{'creation.subclass':'evocation'}),{level:1,learned:'savant'}),/0\/0/)
let advanced=add(add(add(create(20,'2024'),'magic-missile','level',true),'blur','level',true),'fireball','level',true)
advanced.playerDetails={...advanced.playerDetails,'wizard.mastery.1':'spell.1.0','wizard.mastery.2':'spell.2.0','wizard.signature.0':'spell.3.0'}
assert.equal(limit(advanced,'prepared').roots.length,0,'Mastery 2024 and signature spells are always prepared outside the cap')
const classic={...advanced,playerDetails:{...advanced.playerDetails,'rules.edition':'2014'}}
assert.equal(limit(classic,'prepared').roots.length,2,'Mastery 2014 does count against preparation')
let bard=create(1,'2014',{},'bard')
for(const s of spellRules(bard,data).spells.filter((s) => s.level===1).slice(0,4)) bard=add(bard,s.index)
assert.match(blocked(bard,{level:1}),/4\/4/)
assert.equal(blocked(bard,{level:0}),'','Known spells and cantrips use separate limits')
const cleric=create(1,'2024',{},'cleric')
assert.ok(!limit(cleric,'known'),'Daily preparation does not cap the number of annotated spells')
console.log('Spell selection limits passed: cumulative advancement, total/cantrip/preparation caps, deselection, editions, copies, grants, slot overrides, legacy excess and other classes.')
