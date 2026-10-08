import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { newTutorial, tutorialIssues, parseTutorialDraft, changeTutorialOrigin, pointCost, rollScores, rolledTotal, standardScores } from '../src/utils/CharacterTutorial.ts'
import { abilityKeys, applyCreation, optionsFor, creationChoices, withWizardCatalog, spellRules, updateCharacterField } from '../src/utils/PlayerCreation.ts'
import { parseCharacterSheets } from '../src/utils/CharacterSheets.ts'
import { parseCatalog, sheetWithCombatSpells } from '../src/utils/Catalog.ts'
import { playerTemplate } from '../src/utils/PlayerTemplates.ts'
import { featureResourceKey } from '../src/utils/Wizard.ts'

const json = (file) => JSON.parse(readFileSync(new URL(`../public/data/${file}.json`, import.meta.url), 'utf8'))
const data = withWizardCatalog({ ...json('character-options'), ...json('character-equipment'), skills:json('character-rules').skills }, json('wizard-catalog'))
assert.deepEqual([8,9,10,11,12,13,14,15].map((n) => pointCost(String(n))), [0,1,2,3,4,5,7,9])
assert.equal(pointCost('7'), undefined); assert.equal(pointCost('9.5'), undefined); assert.equal(pointCost(''), undefined)
assert.equal(rolledTotal([6,2,6,1]),14); assert.equal(rolledTotal([1,1,1,1]),3)
assert.deepEqual(rollScores(() => 0), Array.from({length:6},() => [1,1,1,1]))
assert.deepEqual(rollScores(() => .999), Array.from({length:6},() => [6,6,6,6]))
let sheet = newTutorial()
assert.ok(tutorialIssues(sheet,data,0).length)
assert.deepEqual(parseTutorialDraft(JSON.stringify(sheet)), sheet, 'Blank drafts survive reopening')
assert.throws(() => parseTutorialDraft('{bad'))
assert.throws(() => parseTutorialDraft(JSON.stringify({...sheet,strength:14})))
assert.deepEqual(parseTutorialDraft(JSON.stringify({...sheet,strength:'9.5'})).strength,'9.5','Unfinished numeric input must survive without corrupting saved characters')
sheet = {...sheet,name:'Tutorial test'}
for (const [kind,value] of [['edition','2014'],['class','wizard'],['race','human'],['background','acolyte']]) sheet = changeTutorialOrigin(sheet,data,kind,value)
sheet = applyCreation({...sheet,playerDetails:{...sheet.playerDetails,...Object.fromEntries(abilityKeys.map((key,i) => [`creation.base.${key}`,String(standardScores[i])]))}},data)
assert.equal(sheet.intelligence,'13')
assert.equal(tutorialIssues(sheet,data,3).length,0)
assert.ok(tutorialIssues({...sheet,playerDetails:{...sheet.playerDetails,'creation.base.charisma':'15'}},data,3).length,'Array values cannot be reused')
assert.ok(tutorialIssues({...sheet,playerDetails:{...sheet.playerDetails,'tutorial.method':'invalid'}},data,3).length)
function fillChoices(current) {
    const d = {...current.playerDetails}
    const usedLanguages = new Set(['common'])
    function fill(choice,path) {
        const options = optionsFor(choice,data), used = new Set()
        for(let i=0;i<choice.choose;i++) {
            const index = options.findIndex((o,j) => !used.has(j) && (choice.type!=='languages' || !usedLanguages.has(o.item?.index)))
            assert.ok(index>=0); used.add(index)
            const key = `${path}.${i}`; d[key]=String(index)
            const option=options[index]
            if(choice.type==='languages') usedLanguages.add(option.item.index)
            function nested(o,p) { if(o.choice)fill(o.choice,`${p}.nested`); o.items?.forEach((item,j) => nested(item,`${p}.item.${j}`)) }
            nested(option,`${key}.option.${index}`)
        }
    }
    creationChoices(current,data).forEach(({choice,path}) => fill(choice,path))
    return applyCreation({...current,playerDetails:d},data)
}
sheet = fillChoices(sheet)
assert.equal(tutorialIssues(sheet,data,4).length,0)
const wizardSkills = creationChoices(sheet,data).find((x) => x.path === 'choice.class.wizard.proficiency.0')
const wizardSkillIndex = (index) => String(optionsFor(wizardSkills.choice,data).findIndex((x) => x.item?.index === `skill-${index}`))
let diviner = changeTutorialOrigin(changeTutorialOrigin(sheet,data,'level','2'),data,'subclass','wizard-divination')
const portentResource = featureResourceKey(data.features.find((x) => x.name === 'Portent' && x.subclass?.index === 'wizard-divination'))
const usedDraft = {...diviner,playerDetails:{...diviner.playerDetails,
    [`${wizardSkills.path}.0`]:wizardSkillIndex('insight'),[`${wizardSkills.path}.1`]:wizardSkillIndex('medicine'),
    'wizard.portent.0':'14','wizard.portent.1':'14','wizard.portent.0.used':'true','wizard.portent.1.used':'true',[portentResource]:'0',
}}
diviner = applyCreation(parseTutorialDraft(JSON.stringify(usedDraft)),data)
assert.equal(diviner.playerDetails['wizard.portent.0'],'14')
assert.equal(diviner.playerDetails['wizard.portent.1'],'14','Equal Portent results are valid and must survive recovery')
assert.equal(diviner.playerDetails['wizard.portent.0.used'],undefined,'Consumed Portent flags from the old tutorial are recovered')
assert.equal(diviner.playerDetails[portentResource],undefined,'Creation must not consume Portent resources')
assert.ok(tutorialIssues(diviner,data,4).some((x) => x.startsWith('Intuizione:')),'Name the duplicate skill instead of blaming dice')
diviner = applyCreation({...diviner,playerDetails:{...diviner.playerDetails,[`${wizardSkills.path}.0`]:wizardSkillIndex('arcana')}},data)
assert.deepEqual(tutorialIssues(diviner,data,4),[],'Changing the duplicate competency unblocks step five with two equal Portent rolls')
const playing = applyCreation({...usedDraft,playerDetails:{...usedDraft.playerDetails,'tutorial.active':'false'}},data)
assert.equal(playing.playerDetails['wizard.portent.0.used'],'true','Spent rolls in completed characters stay spent')
assert.equal(tutorialIssues(sheet,data,5).length,0)
const equipmentChoice = creationChoices(sheet,data).find((x) => x.choice.type === 'equipment')
assert.ok(tutorialIssues({...sheet,playerDetails:{...sheet.playerDetails,[`${equipmentChoice.path}.0`]:''}},data,5).length,'Required equipment cannot be omitted')
assert.ok(tutorialIssues(sheet,data,6).length,'Caster creation needs actual spell choices')
const magic = spellRules(sheet,data)
const d={...sheet.playerDetails}
for(const level of [0,1]) magic.spells.filter((x) => x.level===level).slice(0,level===0 ? magic.cantrips : magic.known).forEach((s,i) => {
    const root=`spell.${level}.${i}`
    Object.assign(d,{[`${root}.name`]:s.nameIt ?? s.name,[`${root}.index`]:s.index,[`${root}.source`]:'class',[`${root}.prepared`]:String(level>0 && i<magic.preparedLimit)})
})
sheet=applyCreation({...sheet,playerDetails:d},data)
assert.deepEqual(tutorialIssues(sheet,data,8),[], 'Complete wizard can finish')
const before=JSON.stringify(sheet)
let switched=changeTutorialOrigin(sheet,data,'class','fighter')
assert.ok(!Object.keys(switched.playerDetails).some((k) => /^spell\..*\.name$/.test(k)), 'Noncasters must not keep old wizard class spells active')
assert.ok(switched.playerDetails['tutorial.spells.2014.wizard.1'])
switched=changeTutorialOrigin(switched,data,'class','wizard')
assert.equal(switched.playerDetails['spell.1.0.name'],sheet.playerDetails['spell.1.0.name'],'Returning restores archived spells')
assert.equal(switched.intelligence,sheet.intelligence)
assert.equal(JSON.stringify(sheet),before,'Changing choices never mutates the previous sheet')
switched=changeTutorialOrigin(sheet,data,'edition','2024')
assert.equal(switched.intelligence,sheet.playerDetails['creation.base.intelligence'],'Ignore legacy racial bonuses in 2024')
assert.ok(tutorialIssues(switched,data,3).some((x) => x.includes('+2/+1')))
switched=applyCreation({...switched,playerDetails:{...switched.playerDetails,'creation.backgroundBonus.intelligence':'2','creation.backgroundBonus.constitution':'1'}},data)
assert.equal(switched.intelligence,String(Number(sheet.playerDetails['creation.base.intelligence'])+2))
assert.equal(tutorialIssues(switched,data,3).length,0)
assert.ok(tutorialIssues(switched,data,4).some((x) => x.includes('Origine')))
assert.ok(tutorialIssues(switched,data,4).some((x) => x.includes('lingue')))
const valid2024 = {...switched,playerDetails:{...switched.playerDetails,'tutorial.rules2024':'true',additionalTraits:'Talento concordato','tutorial.language.0':'orc','tutorial.language.1':'draconic'}}
assert.deepEqual(tutorialIssues(valid2024,data,4),[])
assert.ok(tutorialIssues({...valid2024,playerDetails:{...valid2024.playerDetails,'tutorial.language.0':'abyssal'}},data,4).some((x) => x.includes('lingue')),'2024 initial languages must be standard catalog entries')
switched=changeTutorialOrigin(sheet,data,'class','cleric')
assert.ok(tutorialIssues(switched,data,1).some((x) => x.includes('sottoclasse')),'2014 cleric chooses subclass at level one')
switched=changeTutorialOrigin(switched,data,'edition','2024')
assert.ok(!tutorialIssues(switched,data,1).some((x) => x.includes('sottoclasse')),'2024 subclass waits for level three')
let manual=applyCreation(updateCharacterField(sheet,'armorClass','25'),data)
manual=changeTutorialOrigin(manual,data,'class','fighter')
assert.equal(manual.armorClass,'25','Changing class preserves explicit manual AC')
let fighter = fillChoices(changeTutorialOrigin(sheet,data,'class','fighter'))
const style = creationChoices(fighter,data).find((x) => x.path === 'choice.feature.fighter-fighting-style')
const defense = optionsFor(style.choice,data).findIndex((x) => x.item.index.endsWith('fighting-style-defense'))
const archery = optionsFor(style.choice,data).findIndex((x) => x.item.index.endsWith('fighting-style-archery'))
fighter = applyCreation({...fighter,playerDetails:{...fighter.playerDetails,[`${style.path}.0`]:String(defense),'creation.armor':'chain-mail'}},data)
assert.equal(fighter.armorClass,'17','Defense adds one only when wearing armor')
fighter = applyCreation({...fighter,playerDetails:{...fighter.playerDetails,'creation.armor':''}},data)
assert.equal(fighter.armorClass,'12')
fighter = applyCreation(updateCharacterField({...fighter,playerDetails:{...fighter.playerDetails,[`${style.path}.0`]:String(archery)}},'attacks.0.0','Longbow'),data)
assert.equal(fighter.playerDetails['attacks.0.1'],'6','Archery adds two to ranged weapon attacks')
assert.ok(!fighter.playerDetails.classFeatures.includes('While you are wearing armor'),'Unselected styles must not appear as active features')
let rogue = fillChoices(changeTutorialOrigin(sheet,data,'class','rogue'))
const expertiseChoice = creationChoices(rogue,data).find((x) => x.choice.type === 'expertise')
const expertiseRoot = `${expertiseChoice.path}.0.option.0.nested`
const nestedExpertise = optionsFor(expertiseChoice.choice,data)[0].choice
const expertiseOptions = optionsFor(nestedExpertise,data)
const trained = expertiseOptions.map((o,i) => ({o,i})).filter(({o}) => data.skills.some((s) => `skill-${s.index}` === o.item.index && rogue.playerDetails[s.playerDetailsKeys.proficient] === 'true')).slice(0,2)
rogue = applyCreation({...rogue,playerDetails:{...rogue.playerDetails,[`${expertiseRoot}.0`]:String(trained[0].i),[`${expertiseRoot}.1`]:String(trained[1].i)}},data)
assert.ok(!tutorialIssues(rogue,data,4).some((x) => x.includes('Maestria')))
for (const {o} of trained) assert.equal(rogue.playerDetails[data.skills.find((s) => `skill-${s.index}` === o.item.index).playerDetailsKeys.expertise],'true','Nested rogue expertise grants double proficiency')
let druid = changeTutorialOrigin(changeTutorialOrigin(changeTutorialOrigin(sheet,data,'class','druid'),data,'level','3'),data,'subclass','land')
druid = applyCreation({...druid,playerDetails:{...druid.playerDetails,'choice.feature.circle-of-the-land.0':'0'}},data)
assert.equal(druid.playerDetails['creation.land'],'arctic')
assert.ok(JSON.parse(druid.playerDetails.spellGrants).some((x) => x.index === 'hold-person'),'Land choice grants the relevant circle spells')
for (const template of ['generic','wizard','wizard-pdf']) {
 const complete={...sheet,playerDetails:{...sheet.playerDetails,'tutorial.active':'false','tutorial.completed':'true','sheet.template':template}}
 const reopened=parseCharacterSheets(JSON.stringify([complete]))[0]
 assert.equal(playerTemplate(reopened),template)
 assert.deepEqual(applyCreation(reopened,data),reopened)
 assert.deepEqual(tutorialIssues(reopened,data,8),[])
 assert.ok(sheetWithCombatSpells(reopened,parseCatalog(json('database'))).abilities.length>=9,'Saved spells reach combat cards')
}
console.log('Character tutorial checks passed: full creation, dependent choices, editions, validation, draft resume, overrides, templates and combat spells.')
