import { abilityModifier, integerValue, type CharacterSheet } from '../../utils/CharacterSheets.ts'
import { spellEdition, castingAbilityKey, classId } from '../../utils/Spellcasting.ts'
import type { Ability } from '../../utils/Combat.ts'
import type { CreationData } from '../../utils/PlayerCreation.ts'
import { inventoryEquipment, inventoryFieldValue, inventoryReferenceKey, referencedInventoryItem } from '../../utils/Inventory.ts'
import type { Catalog } from '../../utils/Catalog.ts'
import { assessAttack } from './CombatActions.ts'

// Sources (PDF pages): D&D_5_Player_Original_Handbook.pdf 180, 195, 197–198, 205;
// D&D_5.5_manuale_compatto_italiano.pdf (SRD 5.2.1) 7–8, 18–19.
// Conditions: PHB 2014 PDF 292–293; SRD 5.2.1 PDF 210, 218.
// Edition-specific catalog mechanics supply spell details; prose is never executed as a rule.
export const damageNames={acid:'Acido',bludgeoning:'Contundente',cold:'Freddo',fire:'Fuoco',force:'Forza',lightning:'Fulmine',necrotic:'Necrotico',piercing:'Perforante',poison:'Veleno',psychic:'Psichico',radiant:'Radioso',slashing:'Tagliente',thunder:'Tuono',untyped:'Tipo da verificare'} as const
export type DamageType=keyof typeof damageNames
export const saveNames={strength:'Forza',dexterity:'Destrezza',constitution:'Costituzione',intelligence:'Intelligenza',wisdom:'Saggezza',charisma:'Carisma'} as const
export const conditionNames={paralyzed:'Paralizzato',restrained:'Trattenuto',frightened:'Spaventato',blinded:'Accecato',poisoned:'Avvelenato',prone:'Prono'} as const
export type SaveAbility=keyof typeof saveNames
const classCastingAbilities:Record<string,SaveAbility>={druid:'wisdom',ranger:'wisdom',cleric:'wisdom',wizard:'intelligence',sorcerer:'charisma',bard:'charisma',warlock:'charisma',paladin:'charisma'}
export function spellAttackAbility(sheet:CharacterSheet|undefined,data?:CreationData):SaveAbility|undefined {
    return sheet?castingAbilityKey(sheet,data?.classes.find(c=>c.index===classId(sheet))?.castingAbility??classCastingAbilities[classId(sheet)]):undefined
}
const object=(v:unknown):Record<string,unknown> => v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{}
const normalized=(s:string)=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().trim()
const aliases:Record<string,DamageType>={acido:'acid',contundente:'bludgeoning',contundenti:'bludgeoning',freddo:'cold',fuoco:'fire',forza:'force',fulmine:'lightning',fulmini:'lightning',necrotico:'necrotic',necrotici:'necrotic',perforante:'piercing',perforanti:'piercing',veleno:'poison',psichico:'psychic',psichici:'psychic',radioso:'radiant',radiosi:'radiant',tagliente:'slashing',taglienti:'slashing',tuono:'thunder'}
const damageType=(v:unknown):DamageType|undefined=>typeof v==='string'?(Object.hasOwn(damageNames,normalized(v))?normalized(v) as DamageType:aliases[normalized(v)]):undefined
export type DamageRoll={type:DamageType;amount:number}
export type RollPacket={targetId:number;die?:number;damage:DamageRoll[]}
export type EffectSpec={kind:'resistance'|'nonmagical-resistance'|'ac'|'condition'|'speed'|'spell-immunity'|'roll-bonus';types?:DamageType[];amount?:number;condition?:string;ruleId?:string;rolls?:('attack'|'save')[];sides?:number;sign?:1|-1;consume?:boolean;trigger:'always'|'hit'|'failed-save';repeatSave?:boolean}
export function validEffectSpecs(value:unknown):value is EffectSpec[] {
    return Array.isArray(value)&&value.length<=30&&value.every(v=>{
        const e=object(v)
        return Object.keys(e).every(k=>['kind','types','amount','condition','ruleId','rolls','sides','sign','consume','trigger','repeatSave'].includes(k))&&['resistance','nonmagical-resistance','ac','condition','speed','spell-immunity','roll-bonus'].includes(String(e.kind))&&['always','hit','failed-save'].includes(String(e.trigger))
            &&(e.amount===undefined||Number.isSafeInteger(e.amount))&&(e.repeatSave===undefined||typeof e.repeatSave==='boolean')
            &&(e.ruleId===undefined||typeof e.ruleId==='string'&&e.ruleId.length<=250)&&(e.sides===undefined||Number.isInteger(e.sides)&&Number(e.sides)>=2&&Number(e.sides)<=100)
            &&(e.sign===undefined||e.sign===1||e.sign===-1)&&(e.consume===undefined||typeof e.consume==='boolean')
            &&(e.rolls===undefined||Array.isArray(e.rolls)&&e.rolls.length<=2&&e.rolls.every(r=>r==='attack'||r==='save'))
            &&(e.condition===undefined||typeof e.condition==='string'&&e.condition.length<=60)
            &&(e.types===undefined||Array.isArray(e.types)&&e.types.length<=14&&e.types.every(t=>typeof t==='string'&&t!=='untyped'&&Object.hasOwn(damageNames,t)))
    })
}
export type WeaponEffect={magical:boolean;attackBonus:number;damageBonus:number;extraDamage?:{dice:string;choices:DamageType[]};damageDice?:string;castingModifier?:number;allowedWeapons?:string[];requiresNonmagical:boolean;selfOnly?:boolean}
export type WeaponEnchantment={characterId:string;itemId:string;magical:boolean;attackBonus:number;damageBonus:number;extraDamage?:{dice:string;type:DamageType};damageDice?:string;castingModifier?:number}
export function validWeaponEnchantments(value:unknown):value is WeaponEnchantment[] {
    return Array.isArray(value)&&value.length<=1000&&value.every(v=>{const w=object(v);return Object.keys(w).every(k=>['characterId','itemId','magical','attackBonus','damageBonus','extraDamage','damageDice','castingModifier'].includes(k))&&typeof w.characterId==='string'&&w.characterId.length<=100&&typeof w.itemId==='string'&&w.itemId.length>0&&w.itemId.length<=250&&typeof w.magical==='boolean'&&['attackBonus','damageBonus'].every(k=>Number.isSafeInteger(w[k]))&&(w.castingModifier===undefined||Number.isSafeInteger(w.castingModifier))&&(w.damageDice===undefined||typeof w.damageDice==='string'&&/^\d+d\d+$/.test(w.damageDice))&&(w.extraDamage===undefined||typeof object(w.extraDamage).dice==='string'&&/^\d+d\d+$/.test(String(object(w.extraDamage).dice))&&!!damageType(object(w.extraDamage).type)&&object(w.extraDamage).type!=='untyped')})
}
export type WeaponContext={data:CreationData;active:Ability[]}
export function validWeaponEffect(value:unknown):value is WeaponEffect {
    const w=object(value),extra=object(w.extraDamage)
    return typeof w.magical==='boolean'&&typeof w.requiresNonmagical==='boolean'&&['attackBonus','damageBonus'].every(k=>Number.isSafeInteger(w[k]))
        &&(w.selfOnly===undefined||typeof w.selfOnly==='boolean')&&(w.castingModifier===undefined||Number.isSafeInteger(w.castingModifier))
        &&(w.damageDice===undefined||typeof w.damageDice==='string'&&/^\d+d\d+$/.test(w.damageDice))
        &&(w.allowedWeapons===undefined||Array.isArray(w.allowedWeapons)&&w.allowedWeapons.length<=100&&w.allowedWeapons.every(v=>typeof v==='string'&&v.length<=250))
        &&(w.extraDamage===undefined||typeof extra.dice==='string'&&/^\d+d\d+$/.test(extra.dice)&&Array.isArray(extra.choices)&&extra.choices.length>0&&extra.choices.length<=13&&extra.choices.every(t=>!!damageType(t)&&t!=='untyped'))
}
export type ResolutionPlan={attackAbility?:SaveAbility;deferredSave?:{ability:SaveAbility;dc?:number;trigger:'start-own-turn-in-line';pushFt:number};weaponEffect?:WeaponEffect;damageBonuses?:Partial<Record<DamageType,number>>;damageDice?:Partial<Record<DamageType,string>>;weaponName?:string;edition:'2014'|'2024';ruleId?:string;kind:'attack'|'save'|'automatic'|'none';damageTypes:DamageType[];damageHint:string;attackBonus?:number;save?:{ability:SaveAbility;dc?:number;onSuccess:'half'|'none'|'review'};maximumPackets:number|null;requiredPackets?:number;sharedDamage:boolean;magical:boolean|null;damageTypeOverride?:DamageType;effects:EffectSpec[];effectChoices?:DamageType[];notes:string[]}
export type DefenseRule={type:DamageType;when:'always'|'nonmagical';source:string}
export type BonusDie={id:number;label:string;sides:number;sign:1|-1;consume:boolean}
export type DefenseProfile={reviewDamage?:boolean;reviewAttack?:boolean;armorClass?:number;saveBonus?:number;attackMode?:'normal'|'advantage'|'disadvantage';saveMode?:'normal'|'advantage'|'disadvantage';attackDisadvantage?:boolean;grantsAttackAdvantage?:boolean;automaticSaveFailure?:boolean;attackDice?:BonusDie[];saveDice?:BonusDie[];spellImmunities?:string[];resistances:DefenseRule[];immunities:DefenseRule[];vulnerabilities:DefenseRule[];conditionImmunities:string[];notes:string[]}
export type ResolutionRolls={saveOutcome?:boolean;save?:number;saveSecond?:number;attacks?:Record<string,number>;saveBonuses?:Record<string,number>;attackBonuses?:Record<string,number>;critical?:Record<string,number>}
export type PacketResult={hit?:boolean;critical:boolean;total?:number;needsSecondDie?:boolean;needsBonusDice?:BonusDie[];damage:number|null;steps:string[];effects:EffectSpec[];needsCritical:DamageType[]}
export type TargetResolution={damage:number|null;packets:PacketResult[];armorClass?:number;save?:{ability:SaveAbility;die?:number;secondDie?:number;needsSecondDie?:boolean;needsBonusDice?:BonusDie[];automaticFailure?:boolean;bonus?:number;dc?:number;total?:number;success?:boolean};notes:string[]}

export function resolutionPlan(sheet:CharacterSheet,ability:Ability,catalog:Catalog,optionId?:string,weaponContext?:WeaponContext):ResolutionPlan|undefined {
    const entry=catalog.abilities.find(e=>e.id===ability.catalogId),m=object(entry?.data.mechanics),e=object(m.effect),edition=spellEdition(sheet),d=sheet.playerDetails??{}
    const row=/^sheet-attack:([0-5])$/.exec(ability.ruleId??'')
    if (!row&&(!entry||entry.data.edition!==edition||!Object.keys(e).length)) return undefined
    const notes:string[]=[],effects:EffectSpec[]=[]
    const weapon=row?weaponProfile(sheet,Number(row[1]),weaponContext?.data,weaponContext?.active):undefined
    let types:DamageType[]=[]
    let hint=String(e.damage??e.failureDamage??e.damagePerHit??e.damagePerDart??'')
    if(row) {
        hint=weapon!.hint
        types=weapon!.types
    } else if (damageType(e.damageType)) types=[damageType(e.damageType)!]
    else if (hint) {types=['untyped'];notes.push('Tipo di danno non strutturato: conferma del Master necessaria.')}
    const rawSave=e.save??m.save??m.savingThrow,saveAbility=typeof rawSave==='string'&&Object.hasOwn(saveNames,rawSave)?rawSave as SaveAbility:undefined
    if(rawSave&&!saveAbility)return undefined // delayed saves and escape checks need their own timing.
    // PHB 2014, D&D_5_Player_Original_Handbook.pdf, PDF 249: Gust of Wind saves
    // happen at the affected creature’s turn start, never as part of casting.
    const deferredSave=edition==='2014'&&ability.ruleId==='phb2014:spell:gust-of-wind'&&e.saveTrigger==='start-own-turn-in-line'&&saveAbility?{ability:saveAbility,dc:integerValue(d.spellDC),trigger:'start-own-turn-in-line' as const,pushFt:15}:undefined
    const immediateSave=deferredSave?undefined:saveAbility
    const kind=row||e.attack?'attack':immediateSave?'save':e.automaticHit||types.length?'automatic':'none'
    if(e.attack&&typeof e.attack==='object')return undefined
    const level=Number(sheet.level),slot=optionId?.startsWith('slot:')?Number(optionId.slice(5)):Number(m.level??0),upcast=object(m.upcast)
    const extra=Math.max(0,slot-Number(upcast.base??m.level??0))
    const split=Number(e.rays??e.darts)
    let maximumPackets:number|null=kind==='attack'?1:null
    if(Number.isSafeInteger(split)&&split>0)maximumPackets=split+extra*Number(upcast.additionalRays??upcast.additionalDarts??0)
    if(e.beamsByCharacterLevel) {
        const beam=Object.entries(object(e.beamsByCharacterLevel)).filter(([n])=>Number(n)<=level).sort((a,b)=>Number(b[0])-Number(a[0]))[0]?.[1]
        if(!Number.isSafeInteger(beam))return undefined
        maximumPackets=Number(beam)
    }
    if (typeof object(m.upcast).damageDiceByLevel==='object'||typeof e.damageDiceByCharacterLevel==='object') {
        hint=String(Object.entries(object(upcast.damageDiceByLevel??e.damageDiceByCharacterLevel)).filter(([n])=>Number(n)<=level).sort((a,b)=>Number(b[0])-Number(a[0]))[0]?.[1]??hint)
    } else if(extra&&typeof (upcast.damageAdditionalDice??upcast.additionalDamageDice)==='string') {
        const additional=String(upcast.damageAdditionalDice??upcast.additionalDamageDice),dice=/^(\d+)d(\d+)$/i.exec(additional)
        hint+=` + ${dice?`${extra*Number(dice[1])}d${dice[2]}`:`${extra} × ${additional}`}`
    }
    // Verified 2014 examples: D&D_5_Player_Original_Handbook.pdf, PDF 217 (Bane),
    // 220 (Bless), 252 (Hold Person), 271 (Protection from Energy), 272 (Ray of Frost),
    // 273 (Resistance), 276 (Shield / Shield of Faith), 279–280 (Stoneskin).
    const weaponEffect=weaponSpellEffect(sheet,ability.ruleId,e,object(m.upcast),slot,weaponContext?.data)
    if(weaponEffect)maximumPackets=1
    const condition=e.failedSave
    if(typeof condition==='string'&&['paralyzed','restrained','frightened','blinded','poisoned','prone'].includes(condition))effects.push({kind:'condition',condition,trigger:'failed-save',repeatSave:!!e.repeatSave})
    if(e.onHit==='speed-minus-ten-ft-until-start-caster-next-turn')effects.push({kind:'speed',amount:-10,trigger:'hit'})
    if(typeof e.armorClassBonus==='number')effects.push({kind:'ac',amount:e.armorClassBonus,trigger:'always'})
    if(e.preventsDamageFrom==='magic-missile'&&edition==='2014')effects.push({kind:'spell-immunity',ruleId:'phb2014:spell:magic-missile',trigger:'always'})
    if(e.bonusDie==='1d4'&&Array.isArray(e.rollTypes))effects.push({kind:'roll-bonus',sides:4,sign:1,rolls:e.rollTypes.flatMap(t=>t==='attack-roll'?['attack' as const]:t==='saving-throw'?['save' as const]:[]),trigger:'always'})
    if(e.bonus==='1d4-to-one-saving-throw')effects.push({kind:'roll-bonus',sides:4,sign:1,rolls:['save'],consume:true,trigger:'always'})
    if(e.failure==='subtract-one-d4-from-each-attack-roll-and-saving-throw-during-spell')effects.push({kind:'roll-bonus',sides:4,sign:-1,rolls:['attack','save'],trigger:'failed-save'})
    if(Array.isArray(e.resistanceToNonmagicalDamageTypes))effects.push({kind:'nonmagical-resistance',types:e.resistanceToNonmagicalDamageTypes.map(damageType).filter((v):v is DamageType=>!!v),trigger:'always'})
    const choices=Array.isArray(e.resistanceChooseOne)?e.resistanceChooseOne.map(damageType).filter((v):v is DamageType=>!!v):undefined
    if(choices?.length)effects.push({kind:'resistance',types:[],trigger:'always'})
    // ponytail: only explicit, verified immediate effects are automated. New mechanics are
    // added here with a rules citation and a check; conditional prose stays visible to the Master.
    const known=new Set(['attack','target','targets','area','damage','failureDamage','damagePerHit','damagePerDart','damageType','save','successfulSave','successDamage','automaticHit','rays','darts','simultaneous','canSplitTargets','damageRollInterpretation','beamsByCharacterLevel','armorClassBonus','resistanceChooseOne','resistanceToNonmagicalDamageTypes','failedSave','repeatSave','successfulRepeatSave','onHit','bonusDie','rollTypes','bonus','decision','ends','failure','affectsAbilityChecks','preventsDamageFrom','damageDiceByCharacterLevel'])
    if(Object.keys(e).some(key=>!known.has(key)))notes.push('La descrizione contiene effetti o vincoli aggiuntivi da verificare con il Master.')
    const onSuccess=e.successfulSave==='half'||e.successDamage==='half'?'half':['no-damage','none'].includes(String(e.successfulSave))||e.successDamage===0||e.successDamage==='none'||!types.length?'none':'review'
    if(kind==='none'&&!effects.length&&!choices?.length&&!weaponEffect&&!deferredSave)return undefined
    const attackBonus=weapon?.attackBonus??(row?integerValue(d[`attacks.${row[1]}.1`]):integerValue(d.spellAttackBonus))
    // PHB 2014, D&D_5_Player_Original_Handbook.pdf, PDF 258, Magic Missile:
    // each dart adds a fixed +1 to its d4; the Strength modifier does not apply.
    const missile=edition==='2014'&&ability.ruleId==='phb2014:spell:magic-missile'
    return {edition,attackAbility:row?weapon?.attackAbility:spellAttackAbility(sheet,weaponContext?.data),deferredSave,weaponEffect,...(weapon?{damageBonuses:weapon.bonuses,damageDice:weapon.dice,weaponName:weapon.name}:missile?{damageBonuses:{force:1},damageDice:{force:'1d4'}}:{}),ruleId:ability.ruleId,kind,damageTypes:types,damageHint:hint,attackBonus,save:immediateSave?{ability:immediateSave,dc:integerValue(d.spellDC),onSuccess}:undefined,maximumPackets,requiredPackets:Number.isSafeInteger(split)&&split>0?maximumPackets??undefined:undefined,sharedDamage:kind==='save'&&types.length>0,magical:weapon?weapon.magical:true,effects,effectChoices:choices,notes}
}

export function activeEffects(abilities:Ability[]):Ability[] {
    const byId=new Map(abilities.map(a=>[a.id,a]))
    function active(a:Ability,seen=new Set<number>()):boolean {
        if(!a.active||a.timed!==false&&a.remainingTurns<=0||seen.has(a.id))return false
        seen.add(a.id)
        return a.sourceEffectId===undefined||!!byId.get(a.sourceEffectId)&&active(byId.get(a.sourceEffectId)!,seen)
    }
    return abilities.filter(a=>active(a))
}

// PHB 2014 PDF 150 (weapons), 238 (Elemental Weapon), 258 (Magic Weapon),
// 276 (Shillelagh). SRD 5.2.1 PDF 125 (Magic Weapon) has separate duration/upcasting.
function weaponSpellEffect(sheet:CharacterSheet,ruleId:string|undefined,e:Record<string,unknown>,upcast:Record<string,unknown>,slot:number,data?:CreationData):WeaponEffect|undefined {
    if(spellEdition(sheet)!=='2014'||!ruleId?.startsWith('phb2014:spell:'))return undefined
    if(!['phb2014:spell:magic-weapon','phb2014:spell:elemental-weapon','phb2014:spell:shillelagh'].includes(ruleId))return undefined
    const row=Array.isArray(upcast.rows)?upcast.rows.map(object).filter(r=>Number(r.minimumSlot)<=slot).sort((a,b)=>Number(b.minimumSlot)-Number(a.minimumSlot))[0]:undefined
    if(e.becomesMagicWeapon===true)return {magical:true,attackBonus:Number(row?.bonus??row?.attackBonus??e.attackAndDamageBonus??e.attackBonus??0),damageBonus:Number(row?.bonus??e.attackAndDamageBonus??0),requiresNonmagical:true,
        ...(typeof e.extraDamage==='string'?{extraDamage:{dice:String(row?.extraDamage??e.extraDamage),choices:Array.isArray(e.damageTypeChoice)?e.damageTypeChoice.map(damageType).filter((t):t is DamageType=>!!t):[]}}:{})}
    if(e.weaponMagical===true&&e.weaponDamageDie==='1d8') {
        const score=spellAttackAbility(sheet,data)
        return {magical:true,attackBonus:0,damageBonus:0,requiresNonmagical:false,selfOnly:true,allowedWeapons:['club','quarterstaff'],damageDice:'1d8',castingModifier:score?abilityModifier(sheet[score]):undefined}
    }
}

export function weaponProfile(sheet:CharacterSheet,index:number,data?:CreationData,active:Ability[]=[]) {
    const d=sheet.playerDetails??{},root=`attacks.${index}`,item=referencedInventoryItem(sheet,root+'.0'),name=inventoryFieldValue(sheet,root+'.0')??d[root+'.0']??''
    const matches=data?.equipment.filter(w=>w.weapon_category&&[w.index,w.name,w.nameIt,...(w.aliases??[])].some(n=>n&&normalized(n)===normalized(name)))??[]
    const equipment=item&&data?inventoryEquipment(item,sheet,data):matches.length===1?matches[0]:undefined
    const hint=d[root+'.2']||equipment?.damage?.damage_dice||''
    const column=d[root+'.3']?.trim(),parsed=[...new Set(hint.split(/[^\p{L}]+/u).map(damageType).filter((v):v is DamageType=>!!v))]
    const baseType=column?damageType(column)??'untyped':parsed[0]??damageType(equipment?.damage?.damage_type.name)??damageType(equipment?.damage?.damage_type.index)??'untyped'
    const types=column?[baseType]:parsed.length?parsed:[baseType]
    const nature=(['true','false'].includes(d[root+'.magical'])?d[root+'.magical']:undefined)??(item?d[`inventory.${item.row}.magical`]:undefined)
    let magical:boolean|null=nature==='true'?true:nature==='false'?false:equipment?.weapon_category?false:null
    const match=/^\s*(\d+d\d+)(?:\s*([+-]\s*\d+))?/i.exec(hint)
    const finesse=equipment?.properties?.some(p=>p.index==='finesse'),str=abilityModifier(sheet.strength),dex=abilityModifier(sheet.dexterity)
    const ability=equipment?.weapon_range==='Ranged'?dex:finesse&&str!==undefined&&dex!==undefined?Math.max(str,dex):str
    // ponytail: equal finesse modifiers do not identify the chosen attribute;
    // keep it unknown until the sheet stores an explicit per-attack choice.
    let attackAbility:SaveAbility|undefined=!equipment?undefined:equipment.weapon_range==='Ranged'?'dexterity':!finesse?'strength':str!==undefined&&dex!==undefined&&str!==dex?dex>str?'dexterity':'strength':undefined
    const baseBonus=match?.[2]?Number(match[2].replace(/\s/g,'')):ability??0
    const bonuses:Partial<Record<DamageType,number>>={[baseType]:baseBonus},dice:Partial<Record<DamageType,string>>={[baseType]:match?.[1]??equipment?.damage?.damage_dice??''}
    let attackBonus=integerValue(d[root+'.1'])
    const seen=new Set<string>()
    for(const source of activeEffects(active).sort((a,b)=>Math.max(0,...(b.weaponEffects??[]).map(w=>w.attackBonus))-Math.max(0,...(a.weaponEffects??[]).map(w=>w.attackBonus))))for(const modifier of source.weaponEffects??[]) {
        if(modifier.characterId!==sheet.id||modifier.itemId!==(item?.id??d[inventoryReferenceKey(root+'.0')]))continue
        const spell=source.ruleId??source.catalogId??source.name
        if(seen.has(spell))continue
        seen.add(spell);magical=modifier.magical
        if(attackBonus!==undefined)attackBonus+=modifier.attackBonus
        bonuses[baseType]=(bonuses[baseType]??0)+modifier.damageBonus
        if(modifier.damageDice)dice[baseType]=modifier.damageDice
        if(modifier.castingModifier!==undefined&&ability!==undefined) {
            attackAbility=spellAttackAbility(sheet,data)
            if(attackBonus!==undefined)attackBonus+=modifier.castingModifier-ability
            bonuses[baseType]=(bonuses[baseType]??0)+modifier.castingModifier-ability
        }
        if(modifier.extraDamage) {
            const {type,dice:extra}=modifier.extraDamage
            if(!types.includes(type))types.push(type)
            dice[type]=dice[type]?dice[type]+' + '+extra:extra
        }
    }
    return {name,item,equipment,hint,types,magical,attackBonus,attackAbility,bonuses,dice}
}

export function defenseProfile(sheet:CharacterSheet,ability:SaveAbility|undefined,active:Ability[],targetId:number,heavyArmor?:boolean,data?:CreationData):DefenseProfile {
    const d=sheet.playerDetails??{},notes:string[]=[],profile:DefenseProfile={armorClass:integerValue(sheet.armorClass),resistances:[],immunities:[],vulnerabilities:[],conditionImmunities:[],notes}
    if(data&&spellEdition(sheet)==='2014'&&d['creation.enabled']==='true') {
        const race=data.verified?.reviewedEntities.find(e=>e.id==='phb2014:race:'+d['creation.race'])
        for(const trait of Array.isArray(race?.mechanics.traits)?race.mechanics.traits:[]) {
            const types=object(object(trait).mechanics).damageResistance
            for(const type of Array.isArray(types)?types:[])if(typeof type==='string'&&type!=='untyped'&&Object.hasOwn(damageNames,type))profile.resistances.push({type:type as DamageType,when:'always',source:race!.nameIt??race!.name})
        }
    }
    if(ability) {
        const saved=integerValue(d[`save.${ability}`]),base=abilityModifier(sheet[ability])
        const pb=integerValue(d.proficiencyBonus)
        profile.saveBonus=saved??(base===undefined?undefined:d[`save.${ability}.proficient`]==='true'?(pb===undefined?undefined:base+pb):base)
        if(sheet.kind!=='PG') {
            const aliases=[ability,ability.slice(0,3),saveNames[ability],saveNames[ability].slice(0,3)].map(normalized)
            const overrides=(d['monster.savingThrows']??'').split(/[,;]/).map(s=>/^\s*([\p{L}]+)\s*([+-]\s*\d+)\s*$/u.exec(s)).find(m=>m&&aliases.includes(normalized(m[1])))
            if(overrides)profile.saveBonus=integerValue(overrides[2].replace(/\s/g,''))
        }
    }
    for(const key of ['resistances','immunities','vulnerabilities'] as const) {
        const raw=d[`combat.${key}`]??d[`monster.${key}`]??''
        for(const group of raw.split(';').map(s=>s.trim()).filter(Boolean)) {
            let text=normalized(group).replace(/\bdanni (?:da |di )?/g,'').replace(/\bdamage\b/g,'').trim(),when:'always'|'nonmagical'='always'
            const conditional=/\s+(?:from nonmagical attacks|da attacchi non magici)$/
            if(conditional.test(text)){when='nonmagical';text=text.replace(conditional,'')}
            const tokens=text.replace(/\b(?:and|e)\b/g,',').split(',').map(s=>s.trim()).filter(Boolean),types=tokens.map(damageType)
            if(!tokens.length||types.some(t=>!t)){notes.push(`Difesa da verificare: ${group}`);profile.reviewDamage=true;continue}
            for(const type of types)profile[key].push({type:type!,when,source:'Scheda'})
        }
    }
    profile.conditionImmunities=(d['combat.conditionImmunities']??d['monster.conditionImmunities']??'').split(/[,;]/).map(normalized).filter(Boolean)
    const acBonuses=new Map<string,number>()
    for(const effect of activeEffects(active)) {
        const applies=effect.targets?.length?effect.targets.some(t=>t.id===targetId):effect.ownerId===targetId
        if(!applies)continue
        for(const modifier of effect.resolutionEffects??[]) {
            if(modifier.kind==='spell-immunity'&&modifier.ruleId)(profile.spellImmunities??=[]).push(modifier.ruleId)
            if(modifier.kind==='roll-bonus'&&modifier.sides) {
                const value={id:effect.id,label:effect.name,sides:modifier.sides,sign:modifier.sign??1,consume:!!modifier.consume}
                // Effects of the same spell do not stack; keep one die from each spell.
                for(const roll of modifier.rolls??[]) {
                    const key=roll==='attack'?'attackDice':'saveDice',list=profile[key]??=[]
                    if(!list.some(v=>v.label===effect.name))list.push(value)
                }
            }
            if(modifier.kind==='condition') {
                const condition=modifier.condition
                if(['poisoned','blinded','restrained','prone'].includes(condition??''))profile.attackDisadvantage=true
                if(['blinded','restrained','paralyzed'].includes(condition??''))profile.grantsAttackAdvantage=true
                if(condition==='paralyzed'&&['strength','dexterity'].includes(ability??''))profile.automaticSaveFailure=true
                if(condition==='paralyzed'){notes.push('Paralisi: verifica distanza e critico degli attacchi entro 1,5 m.');profile.reviewAttack=true}
                if(condition==='prone'||condition==='frightened'){notes.push('Condizione '+condition+': verifica distanza e visibilità prima di risolvere.');profile.reviewAttack=true}
                if(condition==='restrained'&&ability==='dexterity')profile.saveMode='disadvantage'
            }
            if(modifier.kind==='ac') {
                const key=effect.ruleId??effect.catalogId??effect.name
                acBonuses.set(key,Math.max(acBonuses.get(key)??0,modifier.amount??0))
            }
            if(modifier.kind==='resistance'||modifier.kind==='nonmagical-resistance')for(const type of modifier.types??[])profile.resistances.push({type,when:modifier.kind==='resistance'?'always':'nonmagical',source:effect.name})
        }
        if(effect.ruleId==='phb2014:class-feature:barbarian-1-rage'&&spellEdition(sheet)==='2014') {
            // D&D_5_Player_Original_Handbook.pdf, PDF 49, Rage: no resistance benefit in heavy armor.
            if(heavyArmor===undefined){notes.push('Ira: verifica armatura pesante prima di applicare le resistenze.');profile.reviewDamage=true}
            if(heavyArmor===false) {
                for(const type of ['bludgeoning','piercing','slashing'] as const)profile.resistances.push({type,when:'always',source:effect.name})
                if(ability==='strength')profile.saveMode='advantage'
            }
        }
    }
    if(profile.armorClass!==undefined)profile.armorClass+=[...acBonuses.values()].reduce((a,b)=>a+b,0)
    return profile
}

export function validPackets(value:unknown):value is RollPacket[] {
    return Array.isArray(value)&&value.length<=1000&&value.every(p=>{
        const v=object(p)
        return Object.keys(v).every(k=>['targetId','die','damage'].includes(k))&&Number.isSafeInteger(v.targetId)&&Number(v.targetId)>=0
            &&(v.die===undefined||Number.isInteger(v.die)&&Number(v.die)>=1&&Number(v.die)<=20)
            &&Array.isArray(v.damage)&&v.damage.length<=14&&new Set(v.damage.map(c=>object(c).type)).size===v.damage.length
            &&v.damage.every(c=>{const x=object(c);return Object.keys(x).every(k=>['type','amount'].includes(k))&&typeof x.type==='string'&&Object.hasOwn(damageNames,x.type)&&Number.isSafeInteger(x.amount)&&Number(x.amount)>=0})
            &&Number.isSafeInteger(v.damage.reduce((sum,c)=>sum+Number(object(c).amount),0))
    })
}

export function assertPacketPlan(plan:ResolutionPlan,packets:RollPacket[],targetMaximum:number|null) {
    if(!validPackets(packets)||!packets.length&&(plan.damageTypes.length>0||plan.kind==='attack'||plan.kind==='save'||plan.effects.length>0||!!plan.weaponEffect))throw new Error('Inserisci i tiri e scegli i bersagli.')
    if(targetMaximum!==null&&new Set(packets.map(p=>p.targetId)).size>targetMaximum)throw new Error('Troppi bersagli per questa azione.')
    if(plan.requiredPackets&&packets.length!==plan.requiredPackets)throw new Error(`Assegna tutti i ${plan.requiredPackets} colpi dell’incantesimo.`)
    if(plan.maximumPackets!==null&&packets.length>plan.maximumPackets)throw new Error('Troppi colpi per questa azione.')
    if(plan.kind!=='attack'&&plan.maximumPackets===null&&new Set(packets.map(p=>p.targetId)).size!==packets.length)throw new Error('Un solo pacchetto per bersaglio per questa azione.')
    for(const packet of packets) {
        if(plan.kind==='attack'?(packet.die===undefined):packet.die!==undefined)throw new Error('Inserisci soltanto i dadi richiesti dall’azione.')
        if(packet.damage.map(c=>c.type).sort().join()!==[...plan.damageTypes].sort().join())throw new Error('I tipi di danno devono corrispondere all’azione.')
    }
    if(plan.sharedDamage&&packets.some(p=>JSON.stringify(p.damage)!==JSON.stringify(packets[0].damage)))throw new Error('Un unico tiro dei danni si applica a tutti i bersagli dell’area.')
}

export function packetTargets(packets:RollPacket[]) {
    return [...new Set(packets.map(p=>p.targetId))].map(id=>{
        const rows=packets.filter(p=>p.targetId===id),amount=rows.reduce((sum,p)=>sum+p.damage.reduce((n,c)=>n+c.amount,0),0)
        if(!Number.isSafeInteger(amount))throw new Error('Totale dei danni troppo grande.')
        return {id,roll:rows.map(p=>p.die===undefined?'':`d20 ${p.die}`).filter(Boolean).join(' · '),hit:false,damageRoll:rows.flatMap(p=>p.damage.map(c=>`${c.amount} ${damageNames[c.type]}`)).join(' + '),damage:String(amount)}
    })
}

export function resolveTarget(plan:ResolutionPlan,packets:RollPacket[],profile:DefenseProfile,rolls:ResolutionRolls={}):TargetResolution {
    if([rolls.save,rolls.saveSecond,...Object.values(rolls.attacks??{})].some(n=>n!==undefined&&(!Number.isInteger(n)||n<1||n>20))||Object.values(rolls.critical??{}).some(n=>!Number.isSafeInteger(n)||n<0))throw new Error('Risultati dei dadi non validi.')
    let success:boolean|undefined,total:number|undefined
    const bonusTotal=(dice:BonusDie[],values:Record<string,number>,prefix='')=>dice.reduce((sum,die)=>{
        const value=values[prefix+die.id]
        if(value!==undefined&&(!Number.isInteger(value)||value<(die.sign===-1?1:0)||value>die.sides))throw new Error('Dado bonus non valido.')
        return sum+(value??0)*die.sign
    },0)
    const forcedSave=rolls.saveOutcome!==undefined
    const saveDice=profile.saveDice??[],saveMissing=forcedSave||profile.automaticSaveFailure?[]:saveDice.filter(d=>rolls.saveBonuses?.[d.id]===undefined)
    const saveExtra=bonusTotal(saveDice,rolls.saveBonuses??{})
    const saveNeedsSecond=!forcedSave&&!profile.automaticSaveFailure&&!!profile.saveMode&&profile.saveMode!=='normal'&&rolls.saveSecond===undefined
    const saveDie=rolls.save===undefined?undefined:profile.saveMode==='advantage'?Math.max(rolls.save,rolls.saveSecond??rolls.save):profile.saveMode==='disadvantage'?Math.min(rolls.save,rolls.saveSecond??rolls.save):rolls.save
    if(forcedSave)success=rolls.saveOutcome
    else if(profile.automaticSaveFailure)success=false
    else if(plan.save&&!saveNeedsSecond&&!saveMissing.length&&saveDie!==undefined&&profile.saveBonus!==undefined&&plan.save.dc!==undefined) {
        // A saving throw has no universal automatic success/failure on natural 1/20.
        total=saveDie+profile.saveBonus+saveExtra;success=total>=plan.save.dc
    }
    const results=packets.map((packet,index):PacketResult=>{
        const needsSecondDie=plan.kind==='attack'&&!!profile.attackMode&&profile.attackMode!=='normal'&&rolls.attacks?.[index]===undefined
        const attackDice=profile.attackDice??[],attackMissing=plan.kind==='attack'?attackDice.filter(d=>rolls.attackBonuses?.[`${index}:${d.id}`]===undefined):[]
        const attackExtra=bonusTotal(attackDice,rolls.attackBonuses??{},`${index}:`)
        const second=rolls.attacks?.[index]??packet.die!
        const die=profile.attackMode==='advantage'?Math.max(packet.die!,second):profile.attackMode==='disadvantage'?Math.min(packet.die!,second):packet.die!
        const attack=plan.kind==='attack'&&!needsSecondDie&&!attackMissing.length?assessAttack(plan.edition,die,plan.attackBonus===undefined?undefined:plan.attackBonus+attackExtra,profile.armorClass):undefined
        const hit=needsSecondDie||attackMissing.length?undefined:attack?attack.hit:plan.save?success===undefined?undefined:!success:true
        const steps:string[]=[],needsCritical:DamageType[]=[],effects=plan.effects.filter(e=>e.trigger==='always'||e.trigger==='hit'&&hit===true||e.trigger==='failed-save'&&success===false).filter(e=>{
            const name=e.condition&&conditionNames[e.condition as keyof typeof conditionNames]
            if(e.condition&&profile.conditionImmunities.some(c=>c===e.condition||name&&c===normalized(name))) {steps.push(`Immunità alla condizione ${name??e.condition}`);return false}
            return true
        })
        if(hit===false&&plan.kind==='attack')return {hit:false,critical:false,total:attack?.total,damage:0,steps:['Attacco mancato: 0 danni.'],effects,needsCritical:[]}
        let ready=plan.kind==='attack'?hit!==undefined:plan.kind==='save'?success!==undefined:true
        let damage=0
        for(const component of packet.damage) {
            const modifier=plan.damageBonuses?.[component.type]??(plan.damageTypeOverride===component.type?plan.damageBonuses?.untyped:undefined)??0
            let amount=component.amount+modifier
            const spellImmune=!!plan.ruleId&&!!profile.spellImmunities?.includes(plan.ruleId)
            const criticalDice=attack?.critical?rolls.critical?.[`${index}:${component.type}`]:undefined
            if(attack?.critical) {
                if(criticalDice===undefined){needsCritical.push(component.type);ready=false}else amount+=criticalDice
            }
            amount=Math.max(0,amount)
            if(attack?.hit===false)amount=0
            if(plan.save&&success) {
                if(plan.save.onSuccess==='half')amount=Math.floor(amount/2)
                else if(plan.save.onSuccess==='none')amount=0
                else ready=false
            }
            const applies=(r:DefenseRule)=>r.type===component.type&&(r.when==='always'||plan.magical===false)
            if(plan.magical===null&&[...profile.resistances,...profile.immunities,...profile.vulnerabilities].some(r=>r.type===component.type&&r.when==='nonmagical'))ready=false
            const immune=profile.immunities.some(applies),resist=profile.resistances.some(applies),vulnerable=profile.vulnerabilities.some(applies)
            const before=amount
            if(immune||spellImmune)amount=0
            else {if(resist)amount=Math.floor(amount/2);if(vulnerable)amount*=2}
            steps.push(`Danni (${damageNames[component.type]}): ${component.amount}${modifier?' '+(modifier>=0?'+':'−')+' '+Math.abs(modifier):''}${attack?.critical?criticalDice===undefined?' + dadi critici da inserire':` + ${criticalDice} (critico)`:''}${attack?.critical&&criticalDice===undefined?'':`${plan.save&&success?' → TS riuscito: '+before:''}${spellImmune?' → protezione dall’incantesimo':immune?' → immunità':resist?' → resistenza':''}${vulnerable&&!immune&&!spellImmune?' → vulnerabilità':''} → ${amount}`}`)
            if(component.type==='untyped'||profile.reviewDamage||plan.kind==='attack'&&profile.reviewAttack)ready=false
            damage+=amount
        }
        if(!Number.isSafeInteger(damage))throw new Error('Totale dei danni troppo grande.')
        return {hit,critical:!!attack?.critical,total:attack?.total,needsSecondDie,needsBonusDice:attackMissing,damage:ready?damage:null,steps,effects,needsCritical}
    })
    const amount=results.reduce((sum,r)=>sum+(r.damage??0),0)
    if(!Number.isSafeInteger(amount))throw new Error('Totale dei danni troppo grande.')
    return {damage:results.some(r=>r.damage===null)?null:amount,packets:results,armorClass:plan.kind==='attack'?profile.armorClass:undefined,save:plan.save?{ability:plan.save.ability,die:rolls.save,secondDie:rolls.saveSecond,needsSecondDie:saveNeedsSecond,needsBonusDice:saveMissing,automaticFailure:profile.automaticSaveFailure,bonus:profile.saveBonus,dc:plan.save.dc,total,success}:undefined,notes:[...plan.notes,...profile.notes]}
}
