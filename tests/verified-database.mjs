import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { loadCandidateCreationData, warlockProgression, optionIssues, invocationSelectionIssues, recoverResource, patronExpandedSpellChoices } from '../src/domain/dnd/VerifiedDatabase.ts'
import { enableCreation, abilityKeys, spellRules } from '../src/utils/PlayerCreation.ts'
import { newCharacterSheet } from '../src/utils/CharacterSheets.ts'

const root=resolve('rules-database.local/2014')
const releases=readdirSync(root).filter((x)=>x.startsWith('candidate-')).map((x)=>join(root,x)).filter((p)=>readdirSync(p).includes('RELEASE.json')).sort((a,b)=>statSync(a).mtimeMs-statSync(b).mtimeMs)
const directory=process.argv[2] ? resolve(process.argv[2]) : releases.at(-1)
assert.ok(directory,'Build a candidate database first.')
const fetcher=async (url)=>({ok:true,text:async()=>readFileSync(join(directory,url.replace('candidate/','')),'utf8')})
const data=await loadCandidateCreationData('candidate',fetcher)
assert.equal(data.edition,'2014')
assert.equal(data.verifiedOptions.length,35)
assert.equal(data.legacyVerification,'preserved-not-fully-reverified')

const expected=[0,2,2,2,3,3,4,4,5,5,5,6,6,6,7,7,7,8,8,8]
for(let level=1;level<=20;level++) {
    const progression=warlockProgression(data,{warlock:level})
    assert.equal(progression.invocationsKnown,expected[level-1])
    const sheet=enableCreation({...newCharacterSheet(),level:String(level),...Object.fromEntries(abilityKeys.map((key)=>[key,'10'])),playerDetails:{'creation.class':'warlock','creation.race':'human'}},data)
    assert.equal(spellRules(sheet,data).maxLevel,progression.pactSlotLevel,'Compatible with the current creation engine')
    assert.equal(Number(sheet.playerDetails[`slots.${progression.pactSlotLevel}.total`]),progression.pactSlots.maximum)
}
const mixed=warlockProgression(data,{warlock:2,wizard:18})
assert.equal(mixed.proficiencyBonus,6,'Total character level affects proficiency')
assert.equal(mixed.pactSlotLevel,1,'Pact slots use warlock class levels')
assert.equal(mixed.invocationsKnown,2)
assert.throws(()=>warlockProgression(data,{warlock:4,wizard:18}),/Livelli/)
const context={edition:'2014',classLevels:{warlock:2,wizard:18},knownCantripIds:[]}
const option=(name)=>data.verifiedOptions.find((x)=>x.id===`phb2014:class-option:${name}`)
assert.ok(optionIssues(option('witch-sight'),context).some((x)=>x.includes('15')),'Character level 20 does not satisfy warlock level 15')
assert.ok(optionIssues(option('agonizing-blast'),context).length)
assert.deepEqual(optionIssues(option('agonizing-blast'),{...context,knownCantripIds:['phb2014:spell:eldritch-blast']}),[])
assert.ok(optionIssues(option('armor-of-shadows'),{...context,edition:'2024'}).length)
assert.ok(optionIssues(option('book-of-ancient-secrets'),{...context,classLevels:{warlock:3}}).length)
assert.deepEqual(optionIssues(option('book-of-ancient-secrets'),{...context,classLevels:{warlock:3},pactOptionId:'phb2014:class-option:pact-of-the-tome'}),[])
assert.ok(invocationSelectionIssues(data,['phb2014:class-option:armor-of-shadows','phb2014:class-option:armor-of-shadows'],context).some((x)=>x.includes('duplicate')))
assert.ok(invocationSelectionIssues(data,['a','b','c'],context).some((x)=>x.includes('limite')))
assert.deepEqual(invocationSelectionIssues(data,['phb2014:class-option:armor-of-shadows','phb2014:class-option:beast-speech'],context),[])
const pact={...warlockProgression(data,{warlock:6}).pactSlots,used:2}
assert.equal(recoverResource(pact,'short-rest').used,0)
assert.equal(pact.used,2,'Resource updates do not mutate the input')
const arcanum={maximum:1,used:1,recovery:['long-rest']}
assert.equal(recoverResource(arcanum,'short-rest').used,1)
assert.equal(recoverResource(arcanum,'long-rest').used,0)
assert.throws(()=>recoverResource({...arcanum,used:2},'long-rest'),/Risorsa/)
const expanded=patronExpandedSpellChoices(data,'phb2014:subclass:archfey',1)
assert.deepEqual(expanded,['phb2014:spell:faerie-fire','phb2014:spell:sleep'])
const chain=option('pact-of-the-chain')
assert.equal(chain.mechanics.effect.familiarAttackUsesReaction,true)
assert.equal(option('pact-of-the-tome').mechanics.effect.cantripsCountAsWarlockSpells,true)
assert.equal(data.spells.find((x)=>x.index==='revivify').school.index,'necromancy')
assert.equal(data.spells.find((x)=>x.index==='mass-heal').school.index,'evocation')
const corrupted=async(url)=>({ok:true,text:async()=>await (await fetcher(url)).text()+(url.endsWith('character-options.json')?' ':'')})
await assert.rejects(loadCandidateCreationData('candidate',corrupted),/Impronta/)
console.log('Verified candidate: 20 levels, application compatibility, multiclass prerequisites, choices, recovery, errata and hash checks passed.')
