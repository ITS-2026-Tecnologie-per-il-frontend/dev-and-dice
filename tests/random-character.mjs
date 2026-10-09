import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomCharacter } from '../src/utils/RandomCharacter.ts'
import { advancementCreationReview, changeTutorialOrigin, parseTutorialDraft, standardScores, tutorialIssues } from '../src/utils/CharacterTutorial.ts'
import { abilityKeys, applyCreation, creationChoices, resolveChoice, spellRules, spellSelection, withWizardCatalog } from '../src/utils/PlayerCreation.ts'
import { parseCharacterSheets } from '../src/utils/CharacterSheets.ts'
import { parseCatalog, sheetWithCombatSpells } from '../src/utils/Catalog.ts'
import { inventoryItems, inventoryIssues } from '../src/utils/Inventory.ts'
import { wizardRules } from '../src/utils/Wizard.ts'

const json=(file) => JSON.parse(readFileSync(new URL(`../public/data/${file}.json`,import.meta.url),'utf8'))
const data=withWizardCatalog({...json('character-options'),...json('character-equipment'),skills:json('character-rules').skills,experienceThresholds:json('character-rules').experienceThresholds},json('wizard-catalog'))
function seeded(seed) {return () => {seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32}}
const original=JSON.stringify(data)
for (const characterClass of data.classes) for (const race of data.races) {
    const sheet=randomCharacter(data,{characterClass:characterClass.index,race:race.index},seeded(1+data.classes.indexOf(characterClass)*31+data.races.indexOf(race)))
    const d=sheet.playerDetails
    assert.equal(d['creation.class'],characterClass.index)
    assert.equal(d['creation.race'],race.index)
    assert.equal(d['rules.edition'],'2014');assert.equal(sheet.level,'1')
    assert.deepEqual(abilityKeys.map((key)=>Number(d[`creation.base.${key}`])).sort((a,b)=>b-a),standardScores)
    assert.equal(sheet.hitPoints,d.maxHitPoints)
    assert.ok(Number(sheet.hitPoints)>0 && Number(sheet.armorClass)>0)
    assert.deepEqual(spellSelection(sheet,data).issues,[])
    const rules=spellRules(sheet,data),selection=spellSelection(sheet,data)
    assert.equal(selection.cantrips,rules.cantrips)
    if (rules.prepared) assert.equal(selection.prepared,rules.preparedLimit)
    if (rules.known!==undefined && (!rules.prepared || characterClass.index==='wizard')) assert.equal(selection.spells,rules.known)
    const issues=tutorialIssues(sheet,data,8)
    assert.deepEqual(issues,characterClass.index==='ranger' ? [d['tutorial.randomReview']] : [],`${characterClass.index}/${race.index}: ${issues}`)
    assert.ok(inventoryItems(sheet).length>0)
    assert.deepEqual(inventoryIssues(sheet),[])
    assert.equal(new Set(inventoryItems(sheet).map(x=>x.id)).size,inventoryItems(sheet).length)
    assert.deepEqual(parseTutorialDraft(JSON.stringify(sheet)),sheet)
    assert.deepEqual(applyCreation(sheet,data),sheet,'Reconciliation cannot add equipment or alter a generated draft')
    if (race.index==='dragonborn') {
        const choice=creationChoices(sheet,data).find(x=>x.choice.type==='trait')
        const ancestry=resolveChoice(choice.choice,choice.path,d,data)[0]
        assert.ok(d.racialTraits.includes(data.traits.find(x=>x.index===ancestry.ref.index).name))
    }
}
assert.equal(JSON.stringify(data),original,'Generation must not mutate the catalog')
const classes=new Set(),races=new Set(),names=new Set()
for (let i=0;i<24;i++) {
    const sheet=randomCharacter(data,{},seeded(i*173+57))
    classes.add(sheet.playerDetails['creation.class']);races.add(sheet.playerDetails['creation.race']);names.add(sheet.name)
}
assert.ok(classes.size>6 && races.size>4 && names.size>6,'Fully random mode must vary its choices')
for (const random of [()=>0,()=>.999999]) {
    const sheet=randomCharacter(data,{characterClass:'rogue',race:'half-elf'},random)
    assert.deepEqual(tutorialIssues(sheet,data,8),[],'Boundary random values cannot create duplicates or untrained expertise')
}
const a=randomCharacter(data,{characterClass:'wizard'},seeded(42)),b=randomCharacter(data,{characterClass:'wizard'},seeded(42))
assert.deepEqual(abilityKeys.map(k=>a[k]),abilityKeys.map(k=>b[k]))
assert.equal(a.name,b.name);assert.equal(a.playerDetails['creation.race'],b.playerDetails['creation.race'])
assert.throws(()=>randomCharacter(data,{characterClass:'missing'}),/Classe/)
assert.throws(()=>randomCharacter(data,{race:'missing'}),/Razza/)
assert.throws(()=>randomCharacter({...data,backgrounds:[]}),/Background/)
assert.throws(()=>randomCharacter({...data,spells:[]},{characterClass:'wizard',race:'human'}),/incantesimi/)
assert.throws(()=>randomCharacter(data,{},()=>1),/generatore casuale/)
assert.throws(()=>randomCharacter(data,{},()=>NaN),/generatore casuale/)
for (const level of [0,21,1.5,NaN,Infinity,'3']) assert.throws(()=>randomCharacter(data,{level}),/livello intero/)
for (const characterClass of data.classes) for (let level=2;level<=20;level++) {
    const race=data.races[(level+data.classes.indexOf(characterClass))%data.races.length]
    const sheet=randomCharacter(data,{characterClass:characterClass.index,race:race.index,level},seeded(level*379+data.classes.indexOf(characterClass)))
    const d=sheet.playerDetails,selection=spellSelection(sheet,data),rules=spellRules(sheet,data)
    assert.equal(sheet.level,String(level));assert.equal(d['tutorial.step'],'1')
    assert.equal(d.experience,String(data.experienceThresholds.levels.find(x=>x.level===level).minimumXP))
    assert.equal(d.hitDiceTotal,String(level));assert.equal(sheet.hitPoints,d.maxHitPoints)
    assert.equal(d['tutorial.advancement'],undefined,'Do not claim that the user confirmed advanced choices')
    assert.deepEqual(selection.issues,[],`${characterClass.index}/${level}: ${selection.issues}`)
    assert.equal(selection.cantrips,rules.cantrips)
    if (rules.prepared) assert.equal(selection.prepared,rules.preparedLimit)
    const book=selection.limits.find(x=>x.id==='wizard-book')
    if (book) assert.equal(book.roots.length,book.maximum)
    else if (rules.known!==undefined && !rules.prepared) assert.equal(selection.spells,rules.known)
    for (const limit of selection.limits.filter(x=>['secrets','lore','arcanum'].includes(x.kind))) assert.equal(limit.roots.length,limit.maximum)
    const wizard=wizardRules(sheet)
    if (wizard.mastery) for (const spellLevel of [1,2]) {assert.ok(d[`wizard.mastery.${spellLevel}`]);assert.equal(d[`${d[`wizard.mastery.${spellLevel}`]}.prepared`],'true')}
    if (wizard.signature) {assert.ok(d['wizard.signature.0'] && d['wizard.signature.1']);assert.notEqual(d['wizard.signature.0'],d['wizard.signature.1'])}
    const issues=tutorialIssues(sheet,data,8)
    assert.deepEqual(issues.filter(x=>x!==advancementCreationReview && x!==d['tutorial.randomReview']),[],`${characterClass.index}/${level}: ${issues}`)
    assert.ok(issues.includes(advancementCreationReview))
    assert.deepEqual(parseTutorialDraft(JSON.stringify(sheet)),sheet)
    assert.deepEqual(applyCreation(sheet,data),sheet)
}
let ranger=randomCharacter(data,{characterClass:'ranger',race:'human'},seeded(10))
assert.equal(ranger.playerDetails['tutorial.step'],'4')
ranger={...ranger,playerDetails:{...ranger.playerDetails,'tutorial.randomReviewConfirmed':'true'}}
assert.ok(tutorialIssues(ranger,data,8).length,'Confirmation alone cannot replace missing manual choices')
ranger={...ranger,playerDetails:{...ranger.playerDetails,additionalTraits:'Nemico prescelto: bestie. Esploratore naturale: foresta.'}}
assert.deepEqual(tutorialIssues(ranger,data,8),[])
const changed=changeTutorialOrigin(ranger,data,'class','fighter')
assert.equal(changed.playerDetails['tutorial.randomReview'],'','Changing class must clear an irrelevant manual review')
const returned=changeTutorialOrigin(changed,data,'class','ranger')
assert.ok(tutorialIssues(returned,data,4).includes(returned.playerDetails['tutorial.randomReview']),'Returning to Ranger must not reuse a previous confirmation')
const catalog=parseCatalog(json('database'))
for (const template of ['generic','wizard','wizard-pdf']) {
    const saved={...a,playerDetails:{...a.playerDetails,'sheet.template':template,'tutorial.active':'false','tutorial.completed':'true'}}
    const reopened=parseCharacterSheets(JSON.stringify([saved]))[0]
    assert.deepEqual(applyCreation(reopened,data),reopened)
    assert.deepEqual(tutorialIssues(reopened,data,8),[])
    assert.ok(sheetWithCombatSpells(reopened,catalog).abilities.length>=9)
}
console.log('Random character checks passed: all 108 class/race combinations, legal choices, spells and equipment, partial/full randomness, boundaries, catalog failures, manual review, drafts, templates and combat.')
console.log('Random level checks passed: all 12 classes at levels 2–20, subclass gates, cumulative spellbook limits, secrets/arcanum, preparation, XP, HP and required advancement review.')
