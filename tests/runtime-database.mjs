import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { loadCandidateCreationData, spellCastPlan } from '../src/domain/dnd/VerifiedDatabase.ts'
import { activateCreationData, activeCatalog, creationDataForEdition, catalogForSheet, preserveSavedSheets, loadActiveDatabase, restSheet, spendSheetHitDie, castSheetSpell, convertSorcery, concentrationSave, sheetRuleResources, sheetClassLevels, ruleOptionGroups, ruleOptionIssues } from '../src/domain/dnd/ActiveRules.ts'
import { applyCreation, enableCreation, creationChoices, optionsFor, optionLabel, spellRules, withWizardCatalog, labelOf, creationLabelOf } from '../src/utils/PlayerCreation.ts'
import { newCharacterSheet, parseCharacterSheets } from '../src/utils/CharacterSheets.ts'
import { spellProfile } from '../src/utils/Spellcasting.ts'
import { activateAbility, advanceCombatAbilities } from '../src/utils/Combat.ts'
import { templateFromCatalog, sheetFromCatalog } from '../src/utils/Catalog.ts'

const directory=resolve('public/data/rules2014')
const fetcher=async(url)=>{const path=join(directory,url.replace('runtime/',''));return {ok:existsSync(path),text:async()=>readFileSync(path,'utf8')}}
const candidate=await loadCandidateCreationData('runtime',fetcher)
const old=(file)=>JSON.parse(readFileSync(`public/data/${file}.json`,'utf8'))
const legacy=withWizardCatalog({...old('character-options'),...old('character-equipment'),skills:old('character-rules').skills,experienceThresholds:old('character-rules').experienceThresholds},old('wizard-catalog'))
const data=activateCreationData(candidate,legacy)
assert.equal(data.verified.candidateReleaseId,'0d0d275e18ee23737904')
assert.equal(data.verified.reviewedEntities.length,2504)
assert.equal(creationDataForEdition(data,'2024'),legacy)
assert.equal(creationDataForEdition(data,'2014'),data)
const criminal=data.backgrounds.find((origin)=>origin.index==='criminal')
assert.ok(criminal.proficiencies.some((ref)=>ref.index==='thieves-tools'),'Fixed background tool proficiency is activated')
const charlatan=data.backgrounds.find((origin)=>origin.index==='charlatan')
assert.equal(charlatan.proficiencies.find((ref)=>ref.index==='disguise-kit')?.nameIt,'Trucchi per il Camuffamento','Verified Italian name is linked to the disguise kit')
assert.equal(charlatan.proficiencies.find((ref)=>ref.index==='forgery-kit')?.nameIt,'Arnesi da Falsario','Verified Italian name is linked to the forgery kit')
assert.deepEqual(charlatan.proficiencies.filter((ref)=>['disguise-kit','forgery-kit'].includes(ref.index)).map(labelOf),['Trucchi per il Camuffamento','Arnesi da Falsario'],'Charlatan tool proficiencies render with their Italian names')
assert.equal(optionLabel({option_type:'reference',item:{index:'disguise-kit',name:'Disguise Kit'}},data),'1 × Trucchi per il Camuffamento','The choice label can recover an Italian name from an English-only ref')
const expectedFightingStyles=new Map([
    ['archery','Tiro con l’Arco'],['defense','Difesa'],['dueling','Duellare'],['great-weapon-fighting','Combattere con Armi Possenti'],
    ['protection','Protezione'],['two-weapon-fighting','Combattere con Due Armi'],
])
for (const [slug,name] of expectedFightingStyles) assert.equal(optionLabel({option_type:'reference',item:{index:`fighter-fighting-style-${slug}`,name:`Fighting Style: ${slug}`}},data),`1 × Stile di combattimento: ${name}`,`Fighter fighting style ${slug} has an Italian label`)
const monkDraft={...newCharacterSheet(),playerDetails:{'rules.edition':'2014','creation.class':'monk'}}
const monkToolChoice=creationChoices(monkDraft,data).find(({path})=>path==='choice.class.monk.proficiency.1')
assert.ok(monkToolChoice,'Monk artisan tools/instrument choice is present')
assert.deepEqual(optionsFor(monkToolChoice.choice,data).map((option)=>optionLabel(option,data)),['Attrezzi da artigiano','Strumento musicale'],'Monk tool categories are displayed in Italian')
const rawArtisanChoice={choose:1,type:'proficiencies',from:{option_set_type:'options_array',options:[{option_type:'reference',item:{index:'carpenters-tools',name:"Carpenter's Tools"}}]}}
assert.equal(optionsFor(rawArtisanChoice,data)[0].item.nameIt,'Strumenti da Falegname','English-only multiple-choice refs are localized before rendering')
const expectedLanguageNames=new Map([
    ['common','Comune'],['dwarvish','Nanico'],['elvish','Elfico'],['giant','Gigante'],['gnomish','Gnomesco'],['goblin','Goblin'],['halfling','Halfling'],['orc','Orchesco'],
    ['abyssal','Abissale'],['celestial','Celestiale'],['draconic','Draconico'],['deep-speech','Gergo delle Profondità'],['infernal','Infernale'],
    ['primordial','Primordiale'],['sylvan','Silvano'],['undercommon','Sottocomune'],
])
for (const [index,name] of expectedLanguageNames) assert.equal(creationLabelOf({index,name:index},data),name,`Language ${index} has an Italian display name`)
const languageChoice={choose:1,type:'languages',from:{option_set_type:'resource_list'}}
assert.equal(optionLabel(optionsFor(languageChoice,data).find((option)=>option.item?.index==='dwarvish'),data),'1 × Nanico','Multiple-choice language labels use Italian')
const criminalDraft={...newCharacterSheet(),playerDetails:{'rules.edition':'2014','creation.enabled':'true','creation.class':'wizard','creation.race':'human','creation.background':'criminal'}}
const criminalChoices=creationChoices(criminalDraft,data)
const gamingChoice=criminalChoices.find(({path})=>path==='choice.background.criminal.proficiency.0')
assert.ok(gamingChoice,'Background tool-choice is exposed in Origins')
const gamingOptions=optionsFor(gamingChoice.choice,data)
const diceOption=gamingOptions.findIndex((option)=>(option.item??option.of)?.index==='dice-set')
assert.ok(diceOption>=0,'Gaming-set choice offers equipment from the correct category')
const trainedCriminal=applyCreation({...criminalDraft,playerDetails:{...criminalDraft.playerDetails,[`${gamingChoice.path}.0`]:String(diceOption)}},data)
assert.ok(trainedCriminal.playerDetails.tools.includes(labelOf(criminal.proficiencies.find((ref)=>ref.index==='thieves-tools'))),'Fixed tool proficiency is marked on the character sheet')
assert.ok(trainedCriminal.playerDetails.tools.includes(labelOf(gamingOptions[diceOption].item??gamingOptions[diceOption].of)),'Chosen gaming-set proficiency is marked on the character sheet')
assert.ok(creationChoices({...criminalDraft,playerDetails:{...criminalDraft.playerDetails,'creation.background':'guild-artisan'}},data)
    .some(({choice})=>choice.from.options?.some((option)=>(option.item??option.of)?.index==='carpenters-tools' && (option.item??option.of)?.nameIt==='Strumenti da Falegname')),'Artisan choices link verified Italian equipment names')
const entertainerChoices=creationChoices({...criminalDraft,playerDetails:{...criminalDraft.playerDetails,'creation.background':'entertainer'}},data)
assert.ok(entertainerChoices.some(({choice})=>choice.from.options?.some((option)=>(option.item??option.of)?.index==='bagpipes' && (option.item??option.of)?.nameIt==='Cornamusa')),'Instrument choices link verified Italian equipment names')
const folkHero=data.backgrounds.find((origin)=>origin.index==='folk-hero')
assert.ok(folkHero.proficiencies.some((ref)=>ref.index==='vehicles-land'),'Vehicle proficiency is also marked as a fixed background proficiency')

// The actual app loader shares one in-flight load, checks hashes and retries a failed load.
const originalFetch=globalThis.fetch,requests=new Map()
let corrupt=false
globalThis.fetch=async(url)=>{
    const name=String(url).replace(/^\/(retry\/)?/,'')
    requests.set(name,(requests.get(name)??0)+1)
    const path=resolve('public',name)
    const text=()=>corrupt&&name.endsWith('verified-reference.json') ? '{}' : readFileSync(path,'utf8')
    return {ok:existsSync(path),text:async()=>text(),json:async()=>JSON.parse(text())}
}
try {
    const [a,b]=await Promise.all([loadActiveDatabase('/'),loadActiveDatabase('/')])
    assert.equal(a,b)
    assert.equal(requests.get('data/rules2014/RELEASE.json'),1)
    assert.equal(catalogForSheet(a.creationData,a.catalogs.en,{...newCharacterSheet(),playerDetails:{'rules.edition':'2024'}}),a.creationData.legacyCatalogs.en)
    assert.equal(catalogForSheet(a.creationData,a.catalogs.it,{...newCharacterSheet(),playerDetails:{'rules.edition':'2014'}}),a.catalogs.it)
    corrupt=true
    await assert.rejects(loadActiveDatabase('/retry/'),/Impronta/)
    corrupt=false
    assert.equal((await loadActiveDatabase('/retry/')).creationData.verified.candidateReleaseId,candidate.candidateReleaseId)
    const fallback=await loadActiveDatabase('/','legacy')
    assert.equal(fallback.creationData.verified,undefined)
    assert.equal(fallback.catalogs.it.creatures.length,old('database').creatures.length)
} finally {globalThis.fetch=originalFetch}
await assert.rejects(loadCandidateCreationData('runtime',async(url)=>({...await fetcher(url),text:async()=>url.endsWith('data/database.json') ? '{}' : readFileSync(join(directory,url.replace('runtime/','')),'utf8')})),/Impronta/)

const memory=new Map([['dev-and-dice.character-sheets.v1','[original bytes]'],['dev-and-dice.character-tutorial.v1','draft bytes']])
const storage={getItem:(key)=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value)}
const backup=preserveSavedSheets(storage,candidate.candidateReleaseId)
memory.set('dev-and-dice.character-sheets.v1','updated')
preserveSavedSheets(storage,candidate.candidateReleaseId)
assert.equal(JSON.parse(memory.get(backup)).sheets,'[original bytes]')
assert.equal(JSON.parse(memory.get(backup)).tutorial,'draft bytes')
assert.throws(()=>preserveSavedSheets({getItem:()=>null,setItem:()=>{throw new Error('quota')}},'test'),/quota/)
assert.throws(()=>preserveSavedSheets({getItem:()=>'{bad json',setItem:()=>assert.fail('Must preserve damaged backup')},'test'))

const character=(cls,level=1,subclass='',extra={})=>enableCreation({...newCharacterSheet(),name:'Verifica '+cls,level:String(level),
    strength:'14',dexterity:'14',constitution:'14',intelligence:'16',wisdom:'16',charisma:'16',
    playerDetails:{'creation.class':cls,'creation.race':'human','creation.subclass':subclass,...extra}},data)
for (const cls of data.classes) for (const level of [1,5,20]) {
    const sheet=character(cls.index,level)
    assert.equal(sheet.playerDetails['rules2014.issues'],'',`${cls.index} ${level}: ${sheet.playerDetails['rules2014.issues']}`)
    assert.equal(sheet.playerDetails.proficiencyBonus,String(2+Math.floor((level-1)/4)))
    assert.ok(sheet.playerDetails.classFeatures.includes('.pdf'))
    assert.deepEqual(applyCreation(sheet,data),sheet,`Idempotent ${cls.index} ${level}`)
    assert.ok(Number.isSafeInteger(Number(sheet.playerDetails.maxHitPoints)))
    assert.doesNotThrow(()=>sheetRuleResources(sheet,candidate),cls.index+' '+level)
    assert.doesNotThrow(()=>ruleOptionGroups(sheet,candidate),cls.index+' '+level)
}
const manual={...newCharacterSheet(),name:'Scheda personale',race:'Razza personale',characterClass:'Classe personale',hitPoints:'9',notes:'Storia personale'}
assert.deepEqual(applyCreation(manual,data),manual)
const previous=character('wizard',3,'evocation')
const custom={...previous,id:'keep-id',hitPoints:'7',notes:'Conserva queste note',abilities:[{name:'Abilità personale',duration:'Senza conteggio'}],
    playerDetails:{...previous.playerDetails,maxHitPoints:'99','creation.override.maxHitPoints':'true',inventedField:'keep'}}
const migrated=applyCreation(custom,data)
assert.equal(migrated.id,'keep-id');assert.equal(migrated.hitPoints,'7');assert.equal(migrated.notes,custom.notes)
assert.equal(migrated.playerDetails.maxHitPoints,'99');assert.equal(migrated.playerDetails.inventedField,'keep')
assert.deepEqual(migrated.abilities,custom.abilities)
assert.equal(parseCharacterSheets(JSON.stringify([migrated]))[0].id,'keep-id')
const revised={...custom,playerDetails:{...custom.playerDetails,'rules.edition':'2024'}}
assert.deepEqual(applyCreation(revised,data),applyCreation(revised,legacy))

const multi=character('wizard',7,'evocation',{'rules2014.level.wizard':'3','rules2014.level.warlock':'4','rules2014.subclass.warlock':'archfey','rules2014.multiclassApproved':'true'})
assert.deepEqual(sheetClassLevels(multi),{wizard:3,warlock:4})
assert.equal(multi.playerDetails.proficiencyBonus,'3')
assert.equal(multi.playerDetails['slots.2.total'],'2')
assert.equal(multi.playerDetails['slots.3.total'],'0')
assert.equal(multi.playerDetails['rules2014.pact.total'],'2')
assert.equal(multi.playerDetails['rules2014.pact.level'],'2')
assert.equal(spellProfile(multi,data).classLevel,3)
assert.equal(spellProfile(multi,data).maxLevel,2)
const unapproved=applyCreation({...multi,playerDetails:{...multi.playerDetails,'rules2014.multiclassApproved':'false'}},data)
assert.match(unapproved.playerDetails['rules2014.issues'],/approb|approv/i)
assert.throws(()=>sheetClassLevels({...multi,level:'8'}),/somma/)
const rogueWizard=character('wizard',4,'evocation',{'rules2014.level.wizard':'3','rules2014.level.rogue':'1','rules2014.multiclassApproved':'true'})
const expertiseEvent=creationChoices(rogueWizard,data).find((event)=>event.choice.type==='expertise')
assert.ok(expertiseEvent,'Secondary classes grant their choice events')
const expertiseOptions=optionsFor(optionsFor(expertiseEvent.choice,data)[0].choice,data),arcana=data.skills.find((skill)=>skill.index==='arcana'),history=data.skills.find((skill)=>skill.index==='history')
const expert=applyCreation({...rogueWizard,playerDetails:{...rogueWizard.playerDetails,[expertiseEvent.path+'.0']:'0',[expertiseEvent.path+'.0.option.0.nested.0']:String(expertiseOptions.findIndex((option)=>option.item?.index==='skill-arcana')),[expertiseEvent.path+'.0.option.0.nested.1']:String(expertiseOptions.findIndex((option)=>option.item?.index==='skill-history')),[arcana.playerDetailsKeys.proficient]:'true',[history.playerDetailsKeys.proficient]:'true'}},data)
assert.equal(expert.playerDetails[arcana.playerDetailsKeys.expertise],'true');assert.equal(expert.playerDetails[arcana.playerDetailsKeys.bonus],'7')
const used={...multi,hitPoints:'1',playerDetails:{...multi.playerDetails,'slots.1.used':'2','rules2014.used.pact':'2',hitDiceUsed:'7','rules2014.hitDiceUsed.wizard':'3','rules2014.hitDiceUsed.warlock':'4'}}
const brief=restSheet(used,candidate,'short-rest',30)
assert.equal(brief.playerDetails['rules2014.used.pact'],'0');assert.equal(brief.playerDetails['slots.1.used'],'2');assert.equal(brief.hitPoints,'1')
const long=restSheet(used,candidate,'long-rest',30)
assert.equal(long.playerDetails['slots.1.used'],'0');assert.equal(long.hitPoints,long.playerDetails.maxHitPoints);assert.equal(long.playerDetails.hitDiceUsed,'4')
assert.equal(long.playerDetails['rules2014.hitDiceUsed.warlock'],'1');assert.equal(long.playerDetails['rules2014.hitDiceUsed.wizard'],'3')
assert.throws(()=>spendSheetHitDie(long,candidate,'wizard',3),/esauriti/)
assert.equal(spendSheetHitDie({...long,hitPoints:'1'},candidate,'warlock',8).sheet.playerDetails['rules2014.hitDiceUsed.warlock'],'2')
const monk=character('monk',3,'open-hand',{'rules2014.used.ki':'2'})
assert.equal(restSheet(monk,candidate,'short-rest',0).playerDetails['rules2014.used.ki'],'2')
assert.equal(restSheet(monk,candidate,'short-rest',30).playerDetails['rules2014.used.ki'],'0')

const components={canSpeak:true,freeSomaticHand:true,materialHand:true,materialSource:'pouch',specificMaterialsConfirmed:false}
const caster=character('wizard',5,'evocation',{'spell.3.0.name':'Fireball','spell.3.0.index':'fireball','spell.3.0.prepared':'true','spell.3.0.class':'wizard'})
const cast=castSheetSpell(caster,candidate,'phb2014:spell:fireball',{mode:'spellcasting-slot',slotLevel:3,components,armorProficient:true})
assert.equal(cast.sheet.playerDetails['slots.3.used'],'1');assert.equal(caster.playerDetails['slots.3.used'],undefined)
assert.throws(()=>castSheetSpell(caster,candidate,'phb2014:spell:magic-missile',{mode:'spellcasting-slot',slotLevel:1,components,armorProficient:true}),/verificat/i)
assert.throws(()=>castSheetSpell({...caster,playerDetails:{...caster.playerDetails,'rules2014.raging':'true'}},candidate,'phb2014:spell:fireball',{mode:'spellcasting-slot',slotLevel:3,components,armorProficient:true}),/ira/i)
assert.throws(()=>castSheetSpell(caster,candidate,'phb2014:spell:fireball',{mode:'spellcasting-slot',slotLevel:3,components,armorProficient:true,spellsThisTurn:[{level:1,unit:'bonus-action'}]}),/bonus/)
const loreCaster=character('bard',6,'lore',{'spell.3.0.name':'Fireball','spell.3.0.index':'fireball','spell.3.0.source':'lore','spell.3.1.name':'Counterspell','spell.3.1.index':'counterspell','spell.3.1.source':'lore'})
assert.equal(castSheetSpell(loreCaster,candidate,'phb2014:spell:fireball',{mode:'spellcasting-slot',slotLevel:3,components,armorProficient:true}).sheet.playerDetails['slots.3.used'],'1')
const warlock=character('warlock',5,'archfey')
assert.ok(spellRules(warlock,data).spells.some((spell)=>spell.index==='plant-growth'),'All patrons have expanded choices')
assert.ok(!JSON.parse(warlock.playerDetails.spellGrants).some((spell)=>spell.index==='plant-growth'),'Expanded choices are not automatic grants')
assert.ok(ruleOptionIssues(warlock,candidate,'phb2014:class-feature:warlock-2-eldritch-invocations',['phb2014:class-option:agonizing-blast']).length,'Cantrip prerequisite must hold')
const cleric=character('cleric',5,'light')
assert.ok(JSON.parse(cleric.playerDetails.spellGrants).some((spell)=>spell.index==='fireball'),'All domains grant their spells')
assert.ok(sheetRuleResources(cleric,candidate).some((pool)=>pool.name.includes('Lampo')||pool.name.includes('Luce')||pool.name.includes('Flare')))
assert.equal(castSheetSpell(cleric,candidate,'phb2014:spell:fireball',{mode:'spellcasting-slot',slotLevel:3,components,armorProficient:true}).sheet.playerDetails['slots.3.used'],'1','Domain access includes spells outside normal class list')
const oldWarlock=enableCreation({...newCharacterSheet(),name:'Warlock precedente',level:'5',charisma:'16',playerDetails:{'creation.class':'warlock','creation.race':'human'}},legacy)
const migratedWarlock=applyCreation({...oldWarlock,playerDetails:{...oldWarlock.playerDetails,'slots.3.used':'2'}},data)
assert.equal(migratedWarlock.playerDetails['rules2014.used.pact'],'2');assert.equal(migratedWarlock.playerDetails['slots.3.used'],'0')
assert.equal(migratedWarlock.playerDetails['rules2014.legacySlotUsed.3'],'2')
const arcanum=character('warlock',11,'archfey',{'spell.6.0.name':'Eyebite','spell.6.0.index':'eyebite','spell.6.0.source':'arcanum'})
const arcanumCast=castSheetSpell(arcanum,candidate,'phb2014:spell:eyebite',{mode:'mystic-arcanum',components,armorProficient:true})
assert.equal(arcanumCast.sheet.playerDetails['rules2014.used.arcanum:phb2014:spell:eyebite'],'1')
assert.equal(arcanumCast.sheet.playerDetails['rules2014.used.pact'],'0')
assert.throws(()=>castSheetSpell(arcanumCast.sheet,candidate,'phb2014:spell:eyebite',{mode:'mystic-arcanum',components,armorProficient:true}),/Arcanum/)
const sorcerer=character('sorcerer',3,'draconic',{'spell.1.0.name':'Burning Hands','spell.1.0.index':'burning-hands'})
const converted=convertSorcery(sorcerer,candidate,'create-slot',1)
assert.equal(converted.sheet.playerDetails['rules2014.createdSlot.1'],'1')
assert.equal(converted.sheet.playerDetails['rules2014.used.sorcery'],'2')
const createdCast=castSheetSpell(converted.sheet,candidate,'phb2014:spell:burning-hands',{mode:'spellcasting-slot',slotLevel:1,components,armorProficient:true})
assert.equal(createdCast.sheet.playerDetails['rules2014.createdSlot.1'],'0')
assert.equal(createdCast.sheet.playerDetails['slots.1.used'],'0')
assert.equal(restSheet(converted.sheet,candidate,'long-rest',30).playerDetails['rules2014.createdSlot.1'],'0')
const champion=character('barbarian',20)
assert.equal(champion.strength,'19','Reviewed Primal Champion applies after racial bonuses')
assert.equal(champion.constitution,'19')
const feats=character('fighter',12,'champion',{'rules2014.featsEnabled':'true','rules2014.option.feats':'phb2014:feat:alert,phb2014:feat:tough,phb2014:feat:mobile','rules2014.originalAdditionalTraits':'Note originali'})
assert.equal(feats.speed,'12 m');assert.equal(feats.playerDetails.initiativeBonus,'7')
assert.match(feats.playerDetails.additionalTraits,/Note originali/)
assert.deepEqual(applyCreation(feats,data),feats)
assert.equal(concentrationSave(candidate,21).dc,10);assert.equal(concentrationSave(candidate,35).dc,17)
assert.throws(()=>concentrationSave(candidate,-1))

const catalog=activeCatalog(candidate,'it')
const fireball=catalog.abilities.find((entry)=>entry.data.referenceId==='phb2014:spell:fireball')
assert.ok(fireball);assert.equal(fireball.data.edition,'2014');assert.match(fireball.label,/manuali 2014/)
assert.ok(catalog.creatures.some((entry)=>entry.data.referenceId==='mm2014:creature:couatl'))
assert.ok(catalog.abilities.some((entry)=>entry.data.ruleStatus==='legacy'))
assert.ok(catalog.abilities.some((entry)=>entry.data.ruleStatus==='partial'))
assert.equal(new Set(catalog.creatures.map((e)=>e.id)).size,catalog.creatures.length)
assert.equal(new Set(catalog.abilities.map((e)=>e.id)).size,catalog.abilities.length)
for (const entity of candidate.verifiedCreatures) {
    const entry=catalog.creatures.find((e)=>e.data.referenceId===entity.id)
    assert.ok(entry,entity.id)
    const sheet=sheetFromCatalog(entry,catalog)
    assert.equal(sheet.armorClass,String(entity.mechanics.armorClass.value),entity.id+' AC')
    assert.equal(sheet.hitPoints,String(entity.mechanics.hitPoints.average),entity.id+' HP')
}
assert.equal(typeof spellCastPlan,'function')
const shield=catalog.abilities.find((entry)=>entry.data.referenceId==='phb2014:spell:shield')
assert.equal(shield.data.expiresAt,'start');assert.equal(shield.rounds,1)
const bladeWard=catalog.abilities.find((entry)=>entry.data.referenceId==='phb2014:spell:blade-ward')
assert.equal(bladeWard.data.expiresAt,'end')
const participants=[{id:1},{id:2}]
const shieldAbility=activateAbility({...templateFromCatalog(shield),id:1,ownerId:1,active:false},{activeId:1,round:1},participants)
assert.equal(shieldAbility.expiryRound,2)
const between=advanceCombatAbilities([shieldAbility],{activeId:1,round:1},{activeId:2,round:1})
assert.equal(between[0].remainingTurns,1)
assert.equal(advanceCombatAbilities(between,{activeId:2,round:1},{activeId:1,round:2})[0].remainingTurns,0)
const end=activateAbility({...templateFromCatalog(bladeWard),id:2,ownerId:1,active:false},{activeId:1,round:1},participants)
const nextStart=advanceCombatAbilities([end],{activeId:2,round:1},{activeId:1,round:2})
assert.equal(nextStart[0].remainingTurns,1)
assert.equal(advanceCombatAbilities(nextStart,{activeId:1,round:2},{activeId:2,round:2})[0].remainingTurns,0)
console.log('Runtime database checks passed: integrity, caching/retry, browser backup, all classes, editions, saved fields, multiclass, rests, cast validation, grants, choices and catalog provenance.')

if (process.argv.includes('--browser')) {
    const {chromium}=await import('playwright')
    const browser=await chromium.launch({headless:true})
    try {
        const context=await browser.newContext({viewport:{width:1440,height:1000}})
        await context.route('**/api/me',route=>route.fulfill({json:{user:{id:'rules-test',username:'Verifica locale'}}}))
        const seed={...oldWarlock,notes:'Nota da conservare',playerDetails:{...oldWarlock.playerDetails,'slots.3.used':'2'}}
        const rageSeed=character('barbarian',1)
        rageSeed.name='Ira nel tracker'
        const raw=JSON.stringify([seed,rageSeed])
        await context.addInitScript(({raw})=>localStorage.setItem('dev-and-dice.character-sheets.v1',raw),{raw})
        const page=await context.newPage(),errors=[]
        page.on('pageerror',error=>errors.push(error.message))
        page.on('console',entry=>{if (entry.type()==='error') errors.push(entry.text())})
        await page.goto('http://127.0.0.1:5173/trackers')
        await page.waitForFunction(()=>JSON.parse(localStorage.getItem('dev-and-dice.character-sheets.v1'))[0].playerDetails['rules2014.release'],null,{timeout:30000})
        assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).sheets,backup),raw)
        await page.getByRole('button',{name:'Apri scheda di '+seed.name,exact:true}).click()
        const panel=page.locator('dialog.character-dialog .rules-panel')
        await panel.locator(':scope > summary').click()
        await panel.getByText('Risorse e riposi',{exact:true}).click()
        assert.equal(await panel.getByLabel('Magia del Patto · usi consumati / 2',{exact:true}).inputValue(),'2')
        await panel.getByRole('button',{name:'Completa riposo breve',exact:true}).click()
        assert.equal(await panel.getByLabel('Magia del Patto · usi consumati / 2',{exact:true}).inputValue(),'0')
        await page.screenshot({path:'/tmp/dev-and-dice-rules-desktop.png'})
        await page.getByRole('button',{name:'Salva scheda',exact:true}).click()
        await page.waitForFunction(()=>JSON.parse(localStorage.getItem('dev-and-dice.character-sheets.v1'))[0].playerDetails['rules2014.used.pact']==='0')
        assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('dev-and-dice.character-sheets.v1'))[0].notes),seed.notes)
        const library=page.locator('.rules-panel').first()
        await library.locator(':scope > summary').click()
        await library.getByText('Consulta tutte le regole e le fonti',{exact:true}).click()
        await library.getByLabel('Cerca nel riferimento 2014',{exact:true}).fill('magic missile')
        assert.match(await library.locator('li').first().textContent(),/Parziale, DM/)
        await library.getByLabel('Cerca nel riferimento 2014',{exact:true}).fill('')
        await library.getByText('Calcolatori del DM',{exact:true}).click()
        await library.getByLabel('Operazione',{exact:true}).selectOption('madness')
        await library.getByRole('button',{name:'Verifica operazione',exact:true}).click()
        assert.match(await library.getByRole('alert').textContent(),/autorizz|verificat|valida/i)
        await library.getByLabel('Il DM autorizza questa regola opzionale',{exact:true}).check()
        await library.getByLabel('Durata della follia',{exact:true}).selectOption('short')
        await library.getByRole('button',{name:'Verifica operazione',exact:true}).click()
        assert.match(await library.getByRole('status').textContent(),/verificata/)
        const rageCard=page.locator('.character-card').filter({hasText:rageSeed.name})
        await rageCard.getByRole('button',{name:'+ In combattimento',exact:true}).click()
        await page.getByLabel('Iniziativa del turno 1',{exact:true}).fill('10')
        await page.getByRole('button',{name:'Inizia combattimento',exact:true}).click()
        await page.getByRole('button',{name:'Ira · Aggiungi',exact:true}).click()
        await page.getByRole('button',{name:'Attiva',exact:true}).click()
        await page.waitForFunction(()=>JSON.parse(localStorage.getItem('dev-and-dice.character-sheets.v1')).find(s=>s.name==='Ira nel tracker').playerDetails['rules2014.raging']==='true')
        assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('dev-and-dice.character-sheets.v1')).find(s=>s.name==='Ira nel tracker').playerDetails['rules2014.used.phb2014:class-feature:barbarian-1-rage']),'1')
        await page.getByRole('button',{name:'Termina effetto',exact:true}).click()
        await page.waitForFunction(()=>JSON.parse(localStorage.getItem('dev-and-dice.character-sheets.v1')).find(s=>s.name==='Ira nel tracker').playerDetails['rules2014.raging']==='false')
        await page.setViewportSize({width:390,height:844})
        await page.screenshot({path:'/tmp/dev-and-dice-rules-mobile.png'})
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile viewport must fit')
        assert.deepEqual(errors,[])
        console.log('Browser checks passed: active payload, saved-sheet backup/migration, Pact recovery, persistence, incomplete spell disclosure, DM permission and mobile layout.')
    } finally {await browser.close()}
}
