// Run: node --experimental-strip-types tests/combat-actions.mjs
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { loadCandidateCreationData } from '../src/domain/dnd/VerifiedDatabase.ts'
import { activateCreationData, activeCatalog } from '../src/domain/dnd/ActiveRules.ts'
import { combatAbilityInfo, combatAbilityStatus, combatUseOptions, selectedUseOption, spendCombatUse, resolvedAbility, resolveCombatDamage } from '../src/domain/dnd/CombatActions.ts'
import { newCharacterSheet } from '../src/utils/CharacterSheets.ts'
import { templateFromCatalog } from '../src/utils/Catalog.ts'
import { applyCreation, enableCreation, withWizardCatalog } from '../src/utils/PlayerCreation.ts'
import { pdfCombatAbilities } from '../src/utils/PlayerAbilities.ts'
import { validateState } from '../server/games.mjs'

const directory=resolve('public/data/rules2014')
const verified=await loadCandidateCreationData('runtime',async url=>{const file=join(directory,url.replace('runtime/',''));return {ok:existsSync(file),text:async()=>readFileSync(file,'utf8')}})
const old=file=>JSON.parse(readFileSync(`public/data/${file}.json`,'utf8'))
const legacy=withWizardCatalog({...old('character-options'),...old('character-equipment'),skills:old('character-rules').skills,experienceThresholds:old('character-rules').experienceThresholds},old('wizard-catalog'))
const data=activateCreationData(verified,legacy),catalog=activeCatalog(verified,'it')
const entry=id=>catalog.abilities.find(entry=>entry.data.referenceId==='phb2014:spell:'+id)
const ability=id=>({...templateFromCatalog(entry(id)),id:0,ownerId:0,active:false})
const character=enableCreation({...newCharacterSheet(),name:'Mago',level:'5',strength:'10',dexterity:'14',constitution:'14',intelligence:'16',wisdom:'12',charisma:'10',playerDetails:{'creation.class':'wizard','creation.race':'human'}},data)
const wizard={...character,playerDetails:{...character.playerDetails,'spell.2.0.name':'Raggio Rovente','spell.2.0.index':'scorching-ray','spell.2.0.source':'class','spell.2.0.prepared':'true','spell.1.0.name':'Identificare','spell.1.0.index':'identify','spell.1.0.source':'class','spell.0.0.name':'Dardo di Fuoco','spell.0.0.index':'fire-bolt','spell.0.0.source':'class','slots.2.used':'2','slots.3.used':'2'}}
const acid=ability('scorching-ray')
assert.equal(combatAbilityInfo(acid,catalog).instantaneous,true)
assert.equal(combatAbilityInfo(acid,catalog).damage,true)
assert.equal(combatAbilityStatus(wizard,acid,catalog,data),'Usa')
const spent=spendCombatUse(wizard,acid,catalog,data,'slot:2')
assert.equal(spent.playerDetails['slots.2.used'],'3')
assert.equal(wizard.playerDetails['slots.2.used'],'2','Spending never mutates the previous sheet')
assert.equal(combatAbilityStatus(spent,acid,catalog,data),'Esauriti utilizzi')
assert.throws(()=>spendCombatUse(spent,acid,catalog,data,'slot:2'),/disponib|esaurit/i)
const upcast={...wizard,playerDetails:{...wizard.playerDetails,'slots.2.used':'3','slots.3.used':'1'}}
assert.equal(selectedUseOption(upcast,acid,catalog,data).id,'slot:3')
assert.equal(selectedUseOption(upcast,{...acid,useOption:'slot:2'},catalog,data).id,'slot:3','An exhausted selection falls back to an available higher slot')
const higher=spendCombatUse(upcast,acid,catalog,data,'slot:3')
assert.equal(higher.playerDetails['slots.2.used'],'3');assert.equal(higher.playerDetails['slots.3.used'],'2')
assert.equal(spendCombatUse(wizard,ability('fire-bolt'),catalog,data,'cantrip').playerDetails['slots.1.used'],wizard.playerDetails['slots.1.used'] ?? '0')
assert.equal(spendCombatUse(wizard,ability('identify'),catalog,data,'ritual').playerDetails['slots.1.used'],wizard.playerDetails['slots.1.used'] ?? '0')
assert(combatUseOptions(wizard,ability('identify'),catalog,data).some(option=>option.id==='ritual'))
assert(!combatUseOptions(wizard,acid,catalog,data).some(option=>option.id==='ritual'))

// Changing a generated PG into a custom creature must stop rewriting its scores.
const monster={...character,kind:'Mostro',strength:'18',constitution:'17'}
assert.equal(applyCreation(monster,data).strength,'18')
assert.equal(applyCreation(monster,data).constitution,'17')
assert.equal(applyCreation({...monster,strength:'',constitution:'8'},data).strength,'')

const execution={id:crypto.randomUUID(),phase:'resolving',option:'slot:2',cost:1}
const using={...acid,execution,targets:[{id:1,damage:'11',resolved:true},{id:2,damage:'0',resolved:true}]}
const turns=[{id:0,description:'Mago',initiative:'10',hitPoints:'20',armorClass:'13',temporaryHitPoints:''},{id:1,description:'Orco',initiative:'8',hitPoints:'30',armorClass:'13',temporaryHitPoints:'5'},{id:2,description:'Goblin',initiative:'7',hitPoints:'10',armorClass:'13',temporaryHitPoints:''}]
const hit=resolveCombatDamage(using,turns)
assert.equal(hit[1].hitPoints,'24');assert.equal(hit[1].temporaryHitPoints,'0')
assert.equal(hit[2].hitPoints,'10','A confirmed miss or immunity (0 damage) leaves HP unchanged')
assert.equal(turns[1].hitPoints,'30')
assert.equal(combatAbilityStatus(spent,using,catalog,data),'In esecuzione','The last slot can still be resolving')
const finished=resolvedAbility(using,catalog,null,turns)
assert.equal(finished.active,false);assert.equal(finished.execution,undefined)
assert.equal(combatAbilityStatus(spent,finished,catalog,data),'Esauriti utilizzi')
assert.throws(()=>resolveCombatDamage(finished,turns),/Nessun utilizzo/,'A completed use cannot apply damage again')
for(const targets of [[{id:1,damage:'3',resolved:false}],[{id:1,damage:'-1',resolved:true}],[{id:9,damage:'3',resolved:true}],[{id:1,damage:'',resolved:true}],[{id:1,damage:'3',resolved:true},{id:1,damage:'3',resolved:true}]]) assert.throws(()=>resolveCombatDamage({...using,targets},turns))
assert.equal(validateState({turns,abilities:[using],combat:null}).abilities[0].execution.id,execution.id)
for(const patch of [{targets:[{id:9,damage:'3',resolved:true}]},{execution:{...execution,cost:-1}},{targets:[{id:1,damage:'2.5',resolved:true}]},{execution:{...execution,phase:'broken'}},{damageEnabled:'yes'}]) assert.throws(()=>validateState({turns,abilities:[{...using,...patch}],combat:null}))
assert.equal(validateState({turns,abilities:[{...using,execution:{...execution,phase:'casting'},targets:[{id:1,damage:'',resolved:false}]}],combat:null}).abilities.length,1,'A pending cast survives server validation and reload')

// The SRD 5.2.1 slot-per-turn rule stays separate from the PHB 2014 bonus-action rule.
const manual={...newCharacterSheet(),name:'Manuale',playerDetails:{'slots.2.total':'2','slots.2.used':'0','rules.edition':'2024'}}
const revisedCatalog={creatures:[],abilities:[{...entry('scorching-ray'),id:'test:2024:level2',data:{level:2,edition:'2024',castingTime:'1 azione'}},{...entry('fire-bolt'),id:'test:2024:cantrip',data:{level:0,edition:'2024',castingTime:'1 azione'}}]}
const revisedSpell={...acid,catalogId:'test:2024:level2',ruleId:undefined},revisedCantrip={...ability('fire-bolt'),catalogId:'test:2024:cantrip',ruleId:undefined}
assert.throws(()=>spendCombatUse(manual,acid,catalog,undefined,'slot:2'),/edizione/)
const once=spendCombatUse(manual,revisedSpell,revisedCatalog,undefined,'slot:2')
assert.equal(once.playerDetails['slots.2.used'],'1')
assert.throws(()=>spendCombatUse(once,revisedSpell,revisedCatalog,undefined,'slot:2'),/solo slot|solo uno|un solo slot/)
const cantrip=spendCombatUse(once,revisedCantrip,revisedCatalog,undefined,'cantrip')
assert.equal(cantrip.playerDetails['slots.2.used'],'1')
const nextTurn={...once,playerDetails:{...once.playerDetails,'combat.spellsThisTurn':'[]'}}
assert.equal(spendCombatUse(nextTurn,revisedSpell,revisedCatalog,undefined,'slot:2').playerDetails['slots.2.used'],'2')

const monk=enableCreation({...newCharacterSheet(),name:'Monaco',level:'5',strength:'12',dexterity:'16',constitution:'14',intelligence:'10',wisdom:'16',charisma:'10',playerDetails:{'creation.class':'monk','creation.race':'human'}},data)
const stun={id:0,ownerId:0,name:'Colpo Stordente',duration:'Personalizzata',remainingTurns:1,active:false,ruleId:'phb2014:class-feature:monk-5-stunning-strike'}
assert.equal(selectedUseOption(monk,stun,catalog,data).id,'resource:ki')
assert.equal(spendCombatUse(monk,stun,catalog,data,'resource:ki').playerDetails['rules2014.used.ki'],'1')
const lastKi={...monk,playerDetails:{...monk.playerDetails,'rules2014.used.ki':'5'}}
assert.equal(combatAbilityStatus(lastKi,stun,catalog,data),'Esauriti utilizzi')
const moon=enableCreation({...monk,level:'10',playerDetails:{'creation.class':'druid','creation.subclass':'moon','creation.race':'human'}},data)
const elemental={...stun,name:'Forma Selvatica Elementale',ruleId:'phb2014:subclass-feature:moon-10-elemental-wild-shape'}
assert.equal(selectedUseOption(moon,elemental,catalog,data).cost,2)
assert.throws(()=>spendCombatUse(moon,elemental,catalog,data,'resource:wild-shape',1),/costo/)
assert.equal(spendCombatUse(moon,elemental,catalog,data,'resource:wild-shape',2).playerDetails['rules2014.used.wild-shape'],'2')
const archdruid=applyCreation({...moon,level:'20'},data)
assert.equal(selectedUseOption(archdruid,elemental,catalog,data).id,'free','Unlimited Wild Shape must not look exhausted when its finite counter disappears')
assert.equal(selectedUseOption(archdruid,elemental,catalog,data).remaining,null)
assert.equal(spendCombatUse(archdruid,elemental,catalog,data,'free',2).playerDetails['rules2014.used.wild-shape'],archdruid.playerDetails['rules2014.used.wild-shape'],'Unlimited uses do not change a finite counter')
const legacyCaster={...manual,playerDetails:{...manual.playerDetails,'rules.edition':'2014'}}
const bonus=spendCombatUse(legacyCaster,ability('misty-step'),catalog,undefined,'slot:2')
assert.throws(()=>spendCombatUse(bonus,acid,catalog,undefined,'slot:2'),/azione bonus/)
assert.doesNotThrow(()=>spendCombatUse(bonus,ability('fire-bolt'),catalog,undefined,'cantrip'))
const innate={...acid,castingSource:'resource',resourceCost:2,useOption:'resource:ki'}
assert.equal(spendCombatUse(monk,innate,catalog,data,'resource:ki',2).playerDetails['rules2014.used.ki'],'2','Exceptional casts bind their own pool after DM confirmation')
const free={...acid,castingSource:'free'}
assert.equal(spendCombatUse(wizard,free,catalog,data,'free').playerDetails['slots.2.used'],'2')
assert.throws(()=>spendCombatUse(wizard,acid,catalog,data,'free'),/disponibile/,'Class casting cannot silently bypass its slots')
assert.throws(()=>combatUseOptions({...wizard,playerDetails:{...wizard.playerDetails,'slots.2.used':'invalid'}},acid,catalog,data),/Contatore/)
assert.equal(selectedUseOption(upcast,{...using,execution:{...execution,option:'slot:2'}},catalog,data).id,'slot:2','In-progress uses retain the pool they actually spent')
const unknown={...acid,catalogId:undefined,ruleId:undefined,spellLevel:2}
assert.equal(spendCombatUse(manual,unknown,{abilities:[],creatures:[]},undefined,'slot:2').playerDetails['slots.2.used'],'1','Manual spell names retain their recorded spell level and cost')
assert.deepEqual(combatUseOptions(undefined,acid,catalog),[],'A participant without a sheet cannot silently cast a leveled spell for free')
assert.equal(combatAbilityInfo({...ability('plant-growth'),castingAlternative:0},catalog).prolonged,false)
assert.equal(combatAbilityInfo({...ability('plant-growth'),castingAlternative:1},catalog).prolonged,true)

// Magic Missile's damage-roll interpretation is partial; its verified casting requirements still apply.
const missile={...ability('magic-missile'),requirementsConfirmed:true}
const missileCaster={...wizard,playerDetails:{...wizard.playerDetails,'spell.1.1.name':'Dardo Incantato','spell.1.1.index':'magic-missile','spell.1.1.source':'class','spell.1.1.prepared':'true'}}
assert.equal(spendCombatUse(missileCaster,missile,catalog,data,'slot:1').playerDetails['slots.1.used'],'1')
assert.throws(()=>spendCombatUse(missileCaster,{...missile,requirementsConfirmed:false},catalog,data,'slot:1'),/verificato/)
assert.throws(()=>spendCombatUse({...missileCaster,playerDetails:{...missileCaster.playerDetails,'spell.1.1.prepared':'false'}},missile,catalog,data,'slot:1'),/preparata/)
assert.throws(()=>spendCombatUse({...missileCaster,playerDetails:{...missileCaster.playerDetails,'slots.1.used':'4'}},missile,catalog,data,'slot:1'),/esauriti/)
const unknownCasting=structuredClone(data)
unknownCasting.verified.reviewedEntities.find(entity=>entity.id===missile.ruleId).verification.missingFields.push('components')
assert.throws(()=>spendCombatUse(missileCaster,missile,catalog,unknownCasting,'slot:1'),/verificato/,'Manual damage resolution must not bypass missing casting metadata')

// Check every PHB spell against real catalogs and generated class sheets, including old saved names/indices.
const owners=new Map(),englishCatalog=activeCatalog(verified,'en')
let checkedSpells=0,checkedLegacy=0,checkedRituals=0,checkedFeatures=0
for(const entity of verified.reviewedEntities.filter(entity=>entity.kind==='spell')) {
    const spellEntry=catalog.abilities.find(entry=>entry.data.referenceId===entity.id)
    assert(spellEntry,`${entity.index}: the Italian catalog must resolve the verified identity`)
    assert(englishCatalog.abilities.some(entry=>entry.data.referenceId===entity.id),`${entity.index}: English catalog identity`)
    const cls=entity.mechanics.classes.find(id=>id!=='warlock') ?? entity.mechanics.classes[0]
    if(!owners.has(cls)) owners.set(cls,enableCreation({...newCharacterSheet(),name:cls,level:'20',strength:'16',dexterity:'16',constitution:'16',intelligence:'18',wisdom:'18',charisma:'18',playerDetails:{'creation.class':cls,'creation.race':'human'}},data))
    const level=entity.mechanics.level,root=`spell.${level}.0`,base=owners.get(cls)
    const legacyIndex=verified.idMap.find(row=>row.array==='spells'&&row.referenceId===entity.id)?.currentId ?? entity.index
    const legacyName=verified.spells.find(spell=>spell.index===legacyIndex)?.name ?? spellEntry.name
    for(const previous of [false,true]) {
        const owner={...base,playerDetails:{...base.playerDetails,[root+'.name']:previous?legacyName:spellEntry.name,[root+'.index']:previous?legacyIndex:entity.index,[root+'.source']:cls==='warlock'&&level>=6?'arcanum':'class',[root+'.prepared']:'true'}}
        const template=templateFromCatalog(spellEntry)
        if(previous){delete template.spellLevel;delete template.ruleId;template.duration='Personalizzata';template.remainingTurns=0;template.timed=true}
        const action={...template,id:0,ownerId:0,active:false,requirementsConfirmed:true}
        const option=selectedUseOption(owner,action,catalog,data)
        assert(option,`${entity.index}: an eligible caster needs a usable casting mode`)
        const after=spendCombatUse(owner,action,catalog,data,option.id,option.cost??1)
        if(option.id.startsWith('slot:')) assert.equal(Number(after.playerDetails[`slots.${option.id.slice(5)}.used`]),1,entity.index+': exactly one slot')
        if(option.id==='pact') assert.equal(after.playerDetails['rules2014.used.pact'],'1')
        if(option.id.startsWith('resource:')) assert.equal(after.playerDetails['rules2014.used.'+option.id.slice(9)],'1')
        const info=combatAbilityInfo(action,catalog),pending={...action,execution:{id:crypto.randomUUID(),phase:'resolving',option:option.id,cost:1},targets:info.damage?[{id:1,damage:'3',resolved:true}]:[]}
        assert.equal(combatAbilityStatus(after,pending,catalog,data),'In esecuzione')
        const result=resolveCombatDamage(pending,[{id:0,hitPoints:'10',temporaryHitPoints:''},{id:1,hitPoints:'10',temporaryHitPoints:'2'}])
        assert.equal(result[1].hitPoints,info.damage?'9':'10',entity.index+': only confirmed final damage changes HP')
        const done=resolvedAbility(pending,catalog,null,turns)
        assert.equal(done.execution,undefined)
        assert.equal(done.active,!info.instantaneous)
        if(!info.instantaneous && spellEntry.rounds>0) assert.equal(done.remainingTurns,spellEntry.rounds,entity.index+': restore the verified duration on old templates')
        if(/^Until dispelled/.test(entity.mechanics.duration)) assert.equal(done.timed,false,entity.index+': persistent effects need no invented timer')
        if(previous)checkedLegacy++;else checkedSpells++
        if(!previous && combatUseOptions(owner,action,catalog,data).some(option=>option.id==='ritual')) {
            const ritual=spendCombatUse(owner,action,catalog,data,'ritual')
            for(let n=1;n<=9;n++)assert.equal(Number(ritual.playerDetails[`slots.${n}.used`]??0),Number(owner.playerDetails[`slots.${n}.used`]??0),entity.index+': a ritual consumes no slot')
            checkedRituals++
        }
    }
}
assert.equal(checkedSpells,361);assert.equal(checkedLegacy,361)
const manualCreature={...newCharacterSheet(),name:'Creatura di prova',kind:'Mostro',playerDetails:Object.fromEntries(Array.from({length:9},(_,i)=>[`slots.${i+1}.total`,'1']))}
let checkedCatalog=0,checkedAttacks=0
for(const entry of catalog.abilities) {
    const action={...templateFromCatalog(entry),id:0,ownerId:0,active:false,requirementsConfirmed:true}
    if(entry.data.edition==='2024'||entry.data.ruleset==='dnd5e-2024') {assert.throws(()=>combatUseOptions(manualCreature,action,catalog,data),/edizione/);continue}
    const option=selectedUseOption(manualCreature,action,catalog,data)
    assert(option,entry.name+': a manual creature can resolve the action with the DM')
    assert.doesNotThrow(()=>spendCombatUse(manualCreature,action,catalog,data,option.id,option.cost??1),entry.name)
    const info=combatAbilityInfo(action,catalog),kind=entry.data.mechanics?.kind
    if(typeof kind==='string' && kind.includes('attack')) {assert(info.instantaneous && info.damage,entry.name+': a verified attack is instantaneous and needs damage targets');checkedAttacks++}
    checkedCatalog++
}
for(const owner of owners.values()) for(const template of pdfCombatAbilities(owner)) {
    const action={...template,id:0,ownerId:0,active:false,requirementsConfirmed:true}
    const option=selectedUseOption(owner,action,catalog,data)
    if(!option || option.remaining!==null && option.remaining<(option.cost??1)) continue
    assert.doesNotThrow(()=>spendCombatUse(owner,action,catalog,data,option.id,option.cost??1),template.name)
    checkedFeatures++
}
assert(checkedAttacks>0 && checkedFeatures>0)
console.log(`Use audit: ${checkedSpells} PHB spells + ${checkedLegacy} legacy templates, ${checkedRituals} rituals, ${checkedCatalog} catalog entries, ${checkedAttacks} verified attacks and ${checkedFeatures} class abilities`)
console.log('Combat actions: slots, upcasting, cantrips, rituals, creature scores, damage resolution, persistence and edition checks passed')
