import * as rules from './VerifiedDatabase.ts'
import type { CreationData, Ref, Choice, ClassFeature } from '../../utils/PlayerCreation.ts'
import { abilityModifier, characterFields, characterLevel, integerValue, type CharacterSheet } from '../../utils/CharacterSheets.ts'
import { classId, spellEdition, spellRowState } from '../../utils/Spellcasting.ts'
import { parseCatalog, type Catalog, type CatalogEntry } from '../../utils/Catalog.ts'

export const runtimeDirectory = 'data/rules2014'
const keys = ['strength','dexterity','constitution','intelligence','wisdom','charisma'] as const
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const normalized = (name: string) => name.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'')
const backgroundToolChoiceCategories: Record<string,{ category: string; label: string }> = {
    'artisan-tools-choice': {category:'artisans-tools',label:'attrezzi da artigiano'},
    'gaming-set-choice': {category:'gaming-sets',label:'set da gioco'},
    'musical-instrument-choice': {category:'musical-instruments',label:'strumenti musicali'},
}
const backgroundVehicleProficiencies: Record<string,string> = {'vehicles-land':'Veicoli terrestri','vehicles-water':'Veicoli acquatici'}
export const ruleName = (entity: Pick<rules.ReviewedEntity,'name'|'nameIt'>) => entity.nameIt ?? entity.name
export const ruleDescription = (entity: Pick<rules.ReviewedEntity,'summaryIt'|'verification'>) => `${entity.summaryIt ?? ''}${entity.verification.complete ? '' : '\nParziale: decisione del DM richiesta. ' + entity.verification.missingFields.join(', ')}`
export const ruleSourceText = (entity: Pick<rules.ReviewedEntity,'sources'>) => entity.sources.map((s) => `${s.filename} · PDF ${s.pdfPages.join(', ')} · ${s.section}`).join('\n')
const metadata = (entity: rules.ReviewedEntity) => ({ referenceId: entity.id, ruleStatus: entity.verification.complete ? 'verified' as const : 'partial' as const, ruleSources: ruleSourceText(entity) })

function backgroundToolGrants(data: rules.CandidateCreationData, toolIds: string[]) {
    const proficiencies: Ref[] = []
    const choices: Choice[] = []
    const withVerifiedName = (item: Ref): Ref => {
        const verified = data.verifiedEquipment.find((equipment) => equipment.index === item.index)
        return verified?.nameIt ? {...item,nameIt:verified.nameIt} : item
    }
    for (const index of toolIds) {
        const definition = backgroundToolChoiceCategories[index]
        if (definition) {
            const category = data.equipmentCategories.find((x) => x.index === definition.category)
            const options = category?.equipment.filter((item) => data.equipment.some((equipment) => equipment.index === item.index)) ?? []
            if (!options.length) throw new Error(`Opzioni mancanti per la competenza del background: ${index}.`)
            choices.push({choose:1,type:'proficiencies',desc:`Scegli una competenza: ${definition.label}`,from:{option_set_type:'options_array',options:options.map((item) => ({option_type:'reference',item:withVerifiedName(item)}))}})
            continue
        }
        const equipment = data.equipment.find((item) => item.index === index)
        const name = backgroundVehicleProficiencies[index]
        proficiencies.push(equipment ? withVerifiedName(equipment) : {index,name:name ?? index.replaceAll('-',' ')})
    }
    return {proficiencies,choices}
}

export function referenceFor(data: rules.CandidateCreationData, array: string, index: string) {
    const mapped = data.idMap.find((row) => row.array === array && row.currentId === index)
    const canonical=array==='subclasses'&&index==='evocation' ? 'wizard-evocation' : index
    return data.reviewedEntities.find((entity) => entity.id === mapped?.referenceId || (!mapped && entity.index === canonical && entity.kind === ({ classes:'class',subclasses:'subclass',races:'race',subraces:'subrace',backgrounds:'background',spells:'spell' } as Record<string,string>)[array]))
}

/** Keep legacy identities and choice paths, replacing PHB descriptions and structured fields with reviewed data. */
// ponytail: bounded inventories use linear matching at load time; index by ID/name if catalogs grow beyond a few thousand records.
export function activateCreationData(data: rules.CandidateCreationData, legacy: CreationData): CreationData {
    const origins = (array: 'classes'|'subclasses'|'races'|'subraces'|'backgrounds') => data[array].map((origin) => {
        const entity = referenceFor(data,array,origin.index)
        if (!entity) return { ...origin, ruleStatus:'legacy' as const }
        const m = entity.mechanics
        const backgroundTools = array === 'backgrounds' && Array.isArray(m.toolProficiencies)
            ? backgroundToolGrants(data,m.toolProficiencies.filter((index): index is string => typeof index === 'string'))
            : undefined
        const existingChoices = Array.isArray(origin.proficiency_choices) ? origin.proficiency_choices : origin.proficiency_choices ? [origin.proficiency_choices] : []
        return { ...origin, ...metadata(entity), nameIt:entity.nameIt ?? origin.nameIt,
            desc:[ruleDescription(entity)], editions:['2014'] as ('2014'|'2024')[],
            ...(typeof m.hitDie === 'number' ? { hit_die:m.hitDie } : {}),
            ...(Array.isArray(m.savingThrowAbilities) ? { savingThrowAbilities:m.savingThrowAbilities as typeof keys[number][] } : {}),
            ...(typeof m.castingAbility === 'string' ? { castingAbility:m.castingAbility as typeof keys[number] } : {}),
            ...(Array.isArray(m.abilityScoreImprovementLevels) ? { abilityScoreImprovementLevels:m.abilityScoreImprovementLevels as number[] } : {}),
            ...(typeof m.minimumLevel === 'number' ? { minimumLevel:m.minimumLevel } : {}),
            ...(object(m.fixedAbilityBonuses) ? { fixedAbilityBonuses:m.fixedAbilityBonuses } : {}),
            ...(object(m.speed) && typeof m.speed.value === 'number' ? { speed:m.speed.value } : {}),
            ...(backgroundTools ? {
                proficiencies:[...(origin.proficiencies ?? []),...backgroundTools.proficiencies],
                proficiency_choices:[...existingChoices,...backgroundTools.choices],
            } : {}),
            ...(array === 'backgrounds' && object(m.feature) ? { feature:{ name:String(m.feature.name),desc:[String(m.feature.summaryIt)] } } : {}),
        }
    })
    const reviewedFeatures = data.reviewedEntities.filter((entity) => ['class-feature','subclass-feature'].includes(entity.kind))
    const features: ClassFeature[] = reviewedFeatures.map((entity) => {
        const oldIndex = data.idMap.find((row) => row.array === 'features' && row.referenceId === entity.id)?.currentId
        const cls = String(entity.relations.classId).split(':').at(-1)!
        const subclass = entity.relations.subclassId ? data.subclasses.find((origin) => referenceFor(data,'subclasses',origin.index)?.id === entity.relations.subclassId) : undefined
        const old = data.features.find((feature) => feature.index === oldIndex)
            ?? data.features.find((feature) => feature.class.index === cls && normalized(feature.name) === normalized(entity.name) && feature.level === entity.mechanics.level)
        const effect = object(entity.mechanics.effect) ? entity.mechanics.effect : {}
        const minutes = typeof effect.durationMinutes === 'number' ? effect.durationMinutes : undefined
        const activation = ['action','bonus-action','reaction'].includes(String(effect.activation)) ? 'active' as const : 'passive' as const
        return { ...old, ...metadata(entity), index:old?.index ?? entity.id, name:entity.name, nameIt:entity.nameIt ?? undefined,
            class:{index:cls,name:cls}, ...(subclass ? {subclass:{index:subclass.index,name:subclass.name}} : {}),
            level:Number(entity.mechanics.level), desc:[ruleDescription(entity),ruleSourceText(entity)], editions:['2014'], activation,
            ...(minutes !== undefined ? {rounds:minutes*10} : {}),
        }
    })
    const additional = data.features.filter((feature) => !reviewedFeatures.some((entity) =>
        entity.relations.classId === 'phb2014:class:'+feature.class.index && normalized(entity.name) === normalized(feature.name)))
    return { ...data, verified:data, legacy,legacyCatalogs:legacy.legacyCatalogs, classes:origins('classes'),subclasses:origins('subclasses'),
        races:origins('races'),subraces:origins('subraces'),backgrounds:origins('backgrounds'),features:[...additional,...features],
        spells:data.spells.map((spell) => {
            const entity = referenceFor(data,'spells',spell.index)
            return entity ? { ...spell,...metadata(entity),nameIt:entity.nameIt ?? undefined,desc:[ruleDescription(entity)],
                aliases:[spell.name,entity.name,entity.nameIt ?? '',...(spell.aliases ?? [])],
                classes:(entity.mechanics.classes as string[]).map((index) => ({index,name:index})) } : {...spell,ruleStatus:'legacy' as const}
        }),
        equipment:data.equipment.map((item) => { const entity=referenceFor(data,'equipment',item.index);return entity ? {...item,...metadata(entity),nameIt:entity.nameIt ?? undefined} : {...item,ruleStatus:'legacy' as const} }),
    }
}

export const creationDataForEdition = (data: CreationData, edition: '2014'|'2024') => edition === '2024' && data.legacy ? data.legacy : data
export const catalogForSheet=(data:CreationData|undefined,catalog:Catalog|undefined,sheet:CharacterSheet) => spellEdition(sheet)==='2024' ? data?.legacyCatalogs?.[catalog?.language ?? 'it'] ?? catalog : catalog

/** Unknown source material stays labelled; a matching name never certifies a different edition. */
export function activeCatalog(data: rules.CandidateCreationData, language:'it'|'en'): Catalog {
    const catalog = parseCatalog(data.rawCatalog,language)
    const spells = data.reviewedEntities.filter((entity) => entity.kind === 'spell')
    const matchSpell = (entry: CatalogEntry) => {
        if (entry.data.ruleset==='dnd5e-2024' || entry.data.edition==='2024' || String(entry.data.sourceUrl ?? '').includes('2024')) return undefined
        const srd=object(entry.data.srdData) ? entry.data.srdData : {},names=[entry.name,entry.data.englishName,srd.name,...(Array.isArray(entry.data.aliases) ? entry.data.aliases : [])]
        const previous=data.spells.find(spell=>spell.index===srd.index || names.some(name=>typeof name==='string' && normalized(name)===normalized(spell.name)))
        return (previous ? referenceFor(data,'spells',previous.index) : undefined) ?? spells.find(entity=>[entity.index,entity.name,entity.nameIt].some(name=>name && names.some(candidate=>typeof candidate==='string' && normalized(candidate)===normalized(name))))
    }
    const abilities:CatalogEntry[] = catalog.abilities.map((entry) => {
        const entity = typeof entry.data.level === 'number' ? matchSpell(entry) : undefined
        if (!entity) return {...entry,label:entry.label+' · fonte aggiuntiva / legacy',data:{...entry.data,ruleStatus:'legacy'}}
        const effect=object(entity.mechanics.effect) ? entity.mechanics.effect : {},expiry=String(effect.expires ?? effect.portalExpires ?? '')
        const expiresAt=['start-of-next-turn'].includes(expiry) && entity.mechanics.range==='Self' ? 'start'
            : ['end-of-own-next-turn','end-caster-next-turn'].includes(expiry) ? 'end' : undefined
        const duration=/^(?:Concentration,?\s*(?:up to\s*)?|Up to\s*)?(\d+)\s+(round|minute|hour|day)s?$/i.exec(String(entity.mechanics.duration))
        const durationVerified=entity.verification.mechanics==='verified-fields' && !entity.verification.missingFields.some(field=>field==='duration'||field.startsWith('duration.')||field==='concentration')
        const rounds=durationVerified ? expiresAt ? 1 : entity.mechanics.duration==='Instantaneous' ? 0 : duration ? Number(duration[1])*({round:1,minute:10,hour:600,day:14400}[duration[2].toLowerCase()] ?? 0) : null : null
        return {...entry,name:language === 'it' ? ruleName(entity) : entity.name,description:ruleDescription(entity),
            rounds,
            label:entity.verification.complete ? 'Incantesimo · manuali 2014' : 'Incantesimo · 2014 · parziale, DM',
            data:{...entry.data,...metadata(entity),edition:'2014',mechanics:entity.mechanics,verification:entity.verification,
                aliases:[entity.name,entity.nameIt,entry.name,...(Array.isArray(entry.data.aliases) ? entry.data.aliases : [])],expiresAt,
                repeatSave:effect.repeatSave ? typeof effect.repeatSave==='string' ? effect.repeatSave : JSON.stringify(effect.repeatSave) : undefined}}
    })
    const creatures:CatalogEntry[] = catalog.creatures.map((entry) => ({...entry,label:entry.label+' · fonte aggiuntiva / legacy',data:{...entry.data,ruleStatus:'legacy'}}))
    for (const entity of data.reviewedEntities.filter((entity) => entity.kind === 'creature')) {
        const match = creatures.findIndex((entry) => [entity.name,entity.nameIt,entity.index].some((name) => name && normalized(name) === normalized(entry.name)))
        const old = creatures[match], m = entity.mechanics
        const entry:CatalogEntry = {id:old?.id ?? entity.id,name:language === 'it' ? ruleName(entity) : entity.name,type:'creature',
            label:entity.verification.complete ? 'Creatura · manuali 2014' : 'Creatura · 2014 · parziale, DM',
            description:ruleDescription(entity),sourceUrl:old?.sourceUrl ?? 'https://dnd.wizards.com',rounds:null,
            data:{...old?.data,...metadata(entity),edition:'2014',mechanics:m,verification:entity.verification,
                hitPoints:object(m.hitPoints) ? m.hitPoints.average : undefined,armorClass:object(m.armorClass) ? m.armorClass.value : undefined,
                challengeRating:String(m.challengeRating),abilityScores:object(m.abilities) ? Object.fromEntries(Object.entries(m.abilities).map(([key,value]) => [key,{score:value,modifier:Math.floor((Number(value)-10)/2)}])) : {},
                stats:{type:m.type,size:m.size,speed:object(m.speedFt) ? Object.entries(m.speedFt).map(([key,value]) => `${key} ${Number(value)*0.3} m`).join(', ') : ''}}}
        if (match >= 0) creatures[match] = entry
        else creatures.push(entry)
        // Keep saved IDs for matching actions; retire unverified actions from the active stat block.
        const oldActions = abilities.filter((ability) => ability.data.creatureId === entry.id)
        for (let i=abilities.length-1;i>=0;i--) if (abilities[i].data.creatureId === entry.id) abilities.splice(i,1)
        for (const group of ['actions','traits','reactions','legendaryActions'] as const) {
            const actions = Array.isArray(m[group]) ? m[group] : []
            actions.forEach((action,index) => {
                if (!object(action)) return
                const oldAction = oldActions.find((ability) => normalized(ability.name) === normalized(String(action.name)))
                abilities.push({id:oldAction?.id ?? `${entry.id}:${group}:${index}`,name:String(action.nameIt ?? action.name ?? action.index),type:'ability',
                    label:'Creatura · '+(group === 'legendaryActions' ? 'azione leggendaria' : group),description:entity.verification.complete ? String(action.summaryIt ?? entity.summaryIt ?? '') : ruleDescription(entity),
                    sourceUrl:entry.sourceUrl,rounds:null,data:{creatureId:entry.id,category:({traits:'trait',actions:'action',reactions:'reaction',legendaryActions:'legendary'} as const)[group],edition:'2014',...metadata(entity),mechanics:action}})
            })
        }
    }
    return {creatures,abilities,language}
}

type LoadedDatabase = { creationData: CreationData; catalogs: Record<'it'|'en',Catalog> }
const loads = new Map<string,Promise<LoadedDatabase>>()
export function loadActiveDatabase(baseUrl = import.meta.env?.BASE_URL ?? '/',mode:'verified'|'legacy'=import.meta.env?.VITE_RULES_DATABASE==='legacy' ? 'legacy' : 'verified'): Promise<LoadedDatabase> {
    const base=baseUrl.endsWith('/') ? baseUrl : baseUrl+'/'
    const cacheKey=base+mode
    if (!loads.has(cacheKey)) {
        const legacy = Promise.all(['character-options','character-equipment','character-rules','wizard-catalog','database'].map(async (name) => {
            const response = await fetch(`${base}data/${name}.json`)
            if (!response.ok) throw new Error('Catalogo precedente non disponibile.')
            return response.json()
        })).then(([options,equipment,r,wizard,raw]) => ({...options,...equipment,skills:r.skills,experienceThresholds:r.experienceThresholds,
            legacyCatalogs:{it:{...parseCatalog(raw,'it'),language:'it'},en:{...parseCatalog(raw,'en'),language:'en'}},
            subclasses:[...options.subclasses.map((x:Ref) => ({...x,...wizard.subclasses.find((s:Ref) => s.index === x.index)})),...wizard.subclasses.filter((s:Ref) => !options.subclasses.some((x:Ref) => s.index === x.index))],
            features:[...options.features,...wizard.subclasses.flatMap((s:{features?:ClassFeature[]}) => s.features ?? []).filter((f:Ref) => !options.features.some((x:Ref) => x.index === f.index))]} as CreationData))
        const loaded=mode==='legacy' ? legacy.then((creationData)=>({creationData,catalogs:creationData.legacyCatalogs!}))
            : Promise.all([rules.loadCandidateCreationData(`${base}${runtimeDirectory}`),legacy]).then(([data,old]) => ({
            creationData:activateCreationData(data,old),catalogs:{it:activeCatalog(data,'it'),en:activeCatalog(data,'en')},
        }))
        loads.set(cacheKey,loaded.catch((error:unknown) => {loads.delete(cacheKey);throw error}))
    }
    return loads.get(cacheKey)!
}

/** Backup exact browser bytes before any automatic write; storage failure blocks migration. */
export function preserveSavedSheets(storage:Pick<Storage,'getItem'|'setItem'>,releaseId:string) {
    const key='dev-and-dice.before-rules2014.'+releaseId
    const existing=storage.getItem(key)
    if (existing) {const saved:unknown=JSON.parse(existing);if (!object(saved) || saved.schemaVersion!==1 || saved.releaseId!==releaseId || !['sheets','tutorial'].every((k)=>saved[k]===null||typeof saved[k]==='string')) throw new Error('Backup delle schede non valido: migrazione interrotta senza sovrascrivere i dati.');return key}
    storage.setItem(key,JSON.stringify({schemaVersion:1,releaseId,
        sheets:storage.getItem('dev-and-dice.character-sheets.v1'),tutorial:storage.getItem('dev-and-dice.character-tutorial.v1')}))
    return key
}

export function concentrationSave(data:rules.CandidateCreationData,damage:number) {
    const rule=data.reviewedEntities.find((e)=>e.id==='phb2014:rule:concentration'),dc=rule?.mechanics.damageSaveDC
    if (!rule?.verification.complete || !object(dc) || dc.rounding!=='down' || typeof dc.baseMinimum!=='number' || typeof dc.damageFraction!=='number' || !Number.isSafeInteger(damage)||damage<1) throw new Error('Danno o regola di concentrazione non validi.')
    return {ability:rule.mechanics.damageSaveAbility,dc:Math.max(dc.baseMinimum,Math.floor(damage*dc.damageFraction)),sources:rule.sources}
}

export function sheetClassLevels(sheet:CharacterSheet):Record<string,number> {
    const d=sheet.playerDetails ?? {},explicit=Object.entries(d).filter(([key]) => key.startsWith('rules2014.level.'))
    if (!explicit.length) return {[classId(sheet)]:characterLevel(sheet) ?? 0}
    const levels=Object.fromEntries(explicit.map(([key,value]) => [key.slice('rules2014.level.'.length),Number(value)]).filter(([,value]) => value !== 0)) as Record<string,number>
    if (Object.values(levels).some((level) => !Number.isSafeInteger(level) || level<1 || level>20)
        || Object.values(levels).reduce((a,b) => a+b,0) !== characterLevel(sheet) || !(classId(sheet) in levels)) throw new Error('La somma dei livelli di classe deve corrispondere al livello totale e includere la classe iniziale.')
    return levels
}
export function sheetSubclassIds(sheet:CharacterSheet,data:rules.CandidateCreationData):string[] {
    return Object.keys(sheetClassLevels(sheet)).flatMap((cls) => {
        const index=sheet.playerDetails?.[`rules2014.subclass.${cls}`] ?? (cls === classId(sheet) ? sheet.playerDetails?.['creation.subclass'] : undefined)
        const entity=index ? referenceFor(data,'subclasses',index) : undefined
        return entity ? [entity.id] : []
    })
}
export function sheetSelectedOptions(sheet:CharacterSheet):string[] {
    return Object.entries(sheet.playerDetails ?? {}).filter(([key]) => key.startsWith('rules2014.option.')).flatMap(([,value]) => value.split(',').filter(Boolean))
}

export function ruleOptionGroups(sheet:CharacterSheet,data:rules.CandidateCreationData) {
    const levels=sheetClassLevels(sheet),subclasses=sheetSubclassIds(sheet,data),groups=new Map<string,rules.VerifiedOption[]>()
    for (const option of data.verifiedOptions) {
        const m=option.mechanics
        const origins='selectionOrigins' in m ? m.selectionOrigins.filter((origin) => (levels[String(origin.classId).split(':').at(-1)!] ?? 0)>=(origin.minimumClassLevel ?? 1)
            && (!origin.subclassId || subclasses.includes(origin.subclassId)) && (!origin.featId || sheetSelectedOptions(sheet).includes(origin.featId))).map((origin) => origin.originId)
            : (levels.warlock ?? 0)>=m.prerequisites.minimumWarlockLevelForSelection ? [String(option.relations.parentFeatureId)] : []
        for (const origin of origins) groups.set(origin,[...(groups.get(origin) ?? []),option])
    }
    return [...groups].map(([id,options]) => ({id,name:ruleName(data.reviewedEntities.find((e) => e.id===id)!),options}))
}

export function ruleOptionIssues(sheet:CharacterSheet,data:rules.CandidateCreationData,origin:string,selected:string[]):string[] {
    const options=selected.map((id) => data.verifiedOptions.find((option) => option.id===id))
    if (options.some((option) => !option)) return ['Opzione non riconosciuta.']
    const all=sheetSelectedOptions(sheet),ctx:rules.ChoiceContext={edition:spellEdition(sheet),classLevels:sheetClassLevels(sheet),
        subclassIds:sheetSubclassIds(sheet,data),featIds:all,knownCantripIds:knownSpellIds(sheet,data).filter((id) => data.reviewedEntities.find((e) => e.id===id)?.mechanics.level===0),
        pactOptionId:all.find((id) => data.verifiedOptions.find((o) => o.id===id)?.mechanics.optionType==='pact-boon'),selectionOriginId:origin,
        knownStyleIds:all.filter((id) => !selected.includes(id) && data.verifiedOptions.find((o) => o.id===id)?.mechanics.optionType==='fighting-style')}
    const type=options[0]?.mechanics.optionType
    if (type==='eldritch-invocation') return rules.invocationSelectionIssues(data,selected,ctx)
    if (type==='fighting-style' || type==='fighter-maneuver') return rules.fighterSelectionIssues(data,selected,ctx)
    if (type==='totem-choice') return rules.totemSelectionIssues(data,selected,ctx)
    if (type==='hunter-choice') return rules.hunterSelectionIssues(data,selected,ctx)
    if (type==='monk-discipline') return rules.monkDisciplineSelectionIssues(data,selected,ctx)
    if (type==='metamagic') return rules.metamagicSelectionIssues(data,selected,ctx)
    if (type==='wizard-choice') return rules.wizardChoiceIssues(data,selected,ctx)
    return [...(selected.length>1 ? ['Questa origine permette una sola scelta.'] : []),...options.flatMap((o) => rules.optionIssues(o!,ctx))]
}

export function multiclassIssues(sheet:CharacterSheet,data:CreationData):string[] {
    const levels=sheetClassLevels(sheet)
    if (Object.keys(levels).length<2) return []
    const issues=sheet.playerDetails?.['rules2014.multiclassApproved']==='true' ? [] : ['Il multiclassamento richiede l’approvazione del DM.']
    for (const cls of Object.keys(levels)) {
        const m=data.classes.find((c) => c.index===cls)?.multi_classing
        if (!m) {issues.push(`Prerequisiti di ${cls} non disponibili.`);continue}
        const meets=(requirement:{ability_score:Ref;minimum_score:number}) => {
            const ability=keys.find((key) => key.startsWith(requirement.ability_score.index))
            return !!ability && (integerValue(sheet[ability]) ?? 0)>=requirement.minimum_score
        }
        if (m.prerequisites?.some((p) => !meets(p)) || m.prerequisite_options && m.prerequisite_options.from.options.filter(meets).length<m.prerequisite_options.choose)
            issues.push(`Prerequisiti di ${cls} non soddisfatti (PHB PDF 164).`)
    }
    return issues
}

export function verifiedSpellGrants(sheet:CharacterSheet,data:rules.CandidateCreationData) {
    const levels=sheetClassLevels(sheet),subclasses=sheetSubclassIds(sheet,data),grants:{spellId:string;classIndex:string}[]=[]
    for (const id of subclasses) {
        const entity=data.reviewedEntities.find((e) => e.id===id)!,cls=String(entity.relations.classId).split(':').at(-1)!
        const permission={dmApproved:sheet.playerDetails?.['rules2014.dmApproved']==='true',alignment:sheet.playerDetails?.['rules2014.alignment']}
        if (cls==='cleric') grants.push(...rules.clericDomainSpellGrants(data,id,levels,permission).map((g) => ({spellId:g.spellId,classIndex:cls})))
        if (cls==='paladin') grants.push(...rules.paladinOathSpellGrants(data,levels,id,permission).map((g) => ({spellId:g.spellId,classIndex:cls})))
        const terrain=sheet.playerDetails?.['creation.land']
        if (cls==='druid' && terrain && id==='phb2014:subclass:land') grants.push(...rules.druidCircleSpellGrants(data,levels,terrain as rules.LandTerrain).map((g) => ({spellId:g.spellId,classIndex:cls})))
    }
    return grants
}
export function knownSpellIds(sheet:CharacterSheet,data:rules.CandidateCreationData,cls=classId(sheet),preparedOnly=false):string[] {
    const selected=Object.entries(sheet.playerDetails ?? {}).flatMap(([key,value]) => {
        const row=/^spell\.(\d+)\.(\d+)\.name$/.exec(key)
        if (!row || !value.trim()) return []
        const root=key.slice(0,-5),owner=sheet.playerDetails?.[root+'.class'] ?? classId(sheet)
        const source=spellRowState(sheet,Number(row[1]),Number(row[2])).source
        if (!['class','always','secrets','lore','arcanum'].includes(source)) return []
        if (owner !== cls || preparedOnly && !spellRowState(sheet,Number(row[1]),Number(row[2])).available) return []
        const index=sheet.playerDetails?.[root+'.index']
        const entity=(index ? referenceFor(data,'spells',index) : undefined) ?? data.reviewedEntities.find((e) => e.kind === 'spell' && [e.name,e.nameIt].some((name) => name && normalized(name) === normalized(value)))
        return entity ? [entity.id] : []
    })
    return [...new Set([...selected,...verifiedSpellGrants(sheet,data).filter((grant) => grant.classIndex===cls).map((grant) => grant.spellId)])]
}

export function verifiedSpellProfile(sheet:CharacterSheet,data:CreationData) {
    const v=data.verified
    if (!v || spellEdition(sheet) !== '2014') return undefined
    const levels=sheetClassLevels(sheet),id=sheet.playerDetails?.['rules2014.castingClass'] || classId(sheet),level=levels[id] ?? 0
    const row=v.reviewedEntities.find((e) => e.id===`phb2014:class-level:${id}-${level}`)
    if (!row) return undefined
    const pools=rules.multiclassSpellPools(v,levels,sheetSubclassIds(sheet,v)),m=row.mechanics
    let slots=Array.isArray(m.spellSlots) ? m.spellSlots as number[] : Array<number>(9).fill(0)
    let cantrips=Number(m.cantripsKnown ?? 0),known=typeof m.spellsKnown === 'number' ? m.spellsKnown : undefined
    if (id === 'warlock') { const pact=rules.warlockProgression(v,levels);slots=slots.map((_,i) => i+1 === pact.pactSlotLevel ? pact.pactSlots.maximum : 0);cantrips=pact.cantripsKnown;known=pact.spellsKnown }
    if (['fighter','rogue'].includes(id)) {
        const subclass=sheetSubclassIds(sheet,v).find((x) => x.endsWith(id === 'fighter' ? ':eldritch-knight' : ':arcane-trickster'))
        const feature=subclass ? v.reviewedEntities.find((e) => e.kind==='subclass-feature' && e.relations.subclassId===subclass && e.name==='Spellcasting') : undefined
        const effect=feature?.mechanics.effect
        if (object(effect) && Array.isArray(effect.progression)) { const r=effect.progression.find((r) => object(r) && r[id+'Level']===level);if (object(r)) {slots=r.spellSlots as number[];cantrips=Number(r.cantripsKnown);known=Number(r.spellsKnown)} }
    }
    return {id,level,slots,cantrips,known,maximum:pools.ownClassMaximumSpellLevel[id] ?? (id==='warlock' ? pools.pactSlots?.level ?? 0 : 0)}
}

export type SheetResource=rules.ResourcePool & {id:string;name:string;note?:string}
export function sheetHitDice(sheet:CharacterSheet,data:rules.CandidateCreationData) {
    const levels=sheetClassLevels(sheet),d=sheet.playerDetails ?? {},totalUsed=integerValue(d.hitDiceUsed) ?? 0
    const explicit=Object.keys(d).some((key)=>key.startsWith('rules2014.hitDiceUsed.'))
    const pools=Object.entries(levels).map(([id,maximum])=>({id,maximum,die:data.classes.find((cls)=>cls.index===id)?.hit_die,
        used:explicit ? integerValue(d['rules2014.hitDiceUsed.'+id]) ?? 0 : id===classId(sheet) ? totalUsed : 0}))
    if (pools.some((pool)=>!pool.die || ![6,8,10,12].includes(pool.die) || pool.used<0 || pool.used>pool.maximum)
        || pools.reduce((sum,pool)=>sum+pool.used,0)!==totalUsed) throw new Error('Ripartisci i dadi vita usati tra le classi mantenendo il totale salvato.')
    return pools as (typeof pools[number] & {die:6|8|10|12})[]
}

export function spendSheetHitDie(sheet:CharacterSheet,data:rules.CandidateCreationData,cls:string,roll:number) {
    const pools=sheetHitDice(sheet,data),pool=pools.find((pool)=>pool.id===cls)
    const maximum=integerValue(sheet.playerDetails?.maxHitPoints),current=integerValue(sheet.hitPoints)
    if (!pool || pool.used>=pool.maximum || maximum===undefined || current===undefined || current<0 || maximum<0) throw new Error('Dadi vita esauriti o PF non validi.')
    const plan=rules.shortRestHitDieHealing(data,pool.die,roll,Number(sheet.constitution))
    const d:Record<string,string>={...sheet.playerDetails,hitDiceUsed:String(pools.reduce((sum,pool)=>sum+pool.used,0)+1)}
    for (const p of pools) d['rules2014.hitDiceUsed.'+p.id]=String(p.used+(p.id===cls ? 1 : 0))
    return {sheet:{...sheet,hitPoints:String(Math.min(maximum,current+plan.healing)),playerDetails:d},plan}
}
export function availableRuleFeatures(sheet:CharacterSheet,data:rules.CandidateCreationData) {
    const levels=sheetClassLevels(sheet),subclasses=sheetSubclassIds(sheet,data)
    const features=data.reviewedEntities.filter((e) => ['class-feature','subclass-feature'].includes(e.kind)
        && Number(e.mechanics.level)<=(levels[String(e.relations.classId).split(':').at(-1)!] ?? 0)
        && (!e.relations.subclassId || subclasses.includes(String(e.relations.subclassId))))
    const chosen=sheetSelectedOptions(sheet)
    return [...features,...data.reviewedEntities.filter((e) => chosen.includes(e.id))]
}

export function sheetRuleResources(sheet:CharacterSheet,data:rules.CandidateCreationData):SheetResource[] {
    const levels=sheetClassLevels(sheet),pools:SheetResource[]=[],d=sheet.playerDetails ?? {}
    const add=(id:string,name:string,pool:rules.ResourcePool,note?:string) => {
        const used=integerValue(d['rules2014.used.'+id]) ?? 0
        if (used<0 || used>pool.maximum) throw new Error(`Consumo di ${name} fuori dal limite; correggere senza perdere gli usi salvati.`)
        if (!pools.some((p) => p.id===id)) pools.push({...pool,id,name,used,note})
    }
    const stats=Object.fromEntries(keys.map((key) => [key,integerValue(sheet[key])]))
    if (levels.warlock) add('pact','Magia del Patto',rules.warlockProgression(data,levels).pactSlots)
    if (levels.warlock>=11) for (const id of knownSpellIds(sheet,data,'warlock')) {
        const spell=data.reviewedEntities.find((e)=>e.id===id)
        if (spell && rules.warlockProgression(data,levels).mysticArcanumLevels.includes(Number(spell.mechanics.level))) add('arcanum:'+id,'Arcanum · '+ruleName(spell),{maximum:1,used:0,recovery:['long-rest']})
    }
    if (levels.bard && stats.charisma) add('inspiration','Ispirazione bardica',rules.bardInspirationResource(data,levels,stats.charisma) as rules.ResourcePool)
    if (levels.monk && stats.wisdom) add('ki','Ki',rules.monkResources(data,levels,stats.wisdom).ki,'Il recupero richiede almeno 30 minuti di meditazione nel riposo.')
    if (levels.druid>=2) { const result=rules.wildShapeResources(data,levels,sheetSubclassIds(sheet,data).find((id) => id.includes('moon')));if (result.maximum!=='unlimited') add('wild-shape','Forma Selvatica',{...result,maximum:result.maximum,used:0}) }
    if (levels.sorcerer>=2) add('sorcery','Punti stregoneria',{maximum:rules.sorcererProgression(data,levels).sorceryPoints,used:0,recovery:['long-rest']})
    if (levels.paladin && stats.charisma) {
        const pools=rules.paladinResourcePools(data,levels,stats.charisma)
        add('phb2014:class-feature:paladin-1-divine-sense','Percezione del Divino',pools.divineSense as rules.ResourcePool)
        add('phb2014:class-feature:paladin-1-lay-on-hands','Imposizione delle Mani',pools.layOnHands as rules.ResourcePool)
    }
    if (levels.cleric>=2 || levels.paladin>=3) {
        const feature=data.reviewedEntities.find((e)=>e.id==='phb2014:class-feature:cleric-2-channel-divinity'),effect=feature?.mechanics.effect
        const count=object(effect) && object(effect.maximumUsesByClericLevel) ? Number(Object.entries(effect.maximumUsesByClericLevel).filter(([n])=>Number(n)<=(levels.cleric ?? 0)).at(-1)?.[1] ?? 0) : 0
        add('channel-divinity','Incanalare Divinità',{maximum:Math.max(count,levels.paladin>=3 ? 1 : 0),used:0,recovery:['short-rest','long-rest']})
    }
    const seen=new Set<string>()
    for (const e of availableRuleFeatures(sheet,data).sort((a,b) => Number(b.mechanics.level)-Number(a.mechanics.level))) {
        if (!e.verification.complete || !object(e.mechanics.effect) || seen.has(e.name)) continue
        seen.add(e.name)
        const resource=e.mechanics.effect.resource
        if (!object(resource) || !Array.isArray(resource.recovery)) continue
        const cls=String(e.relations.classId).split(':').at(-1)!,level=levels[cls] ?? 0
        let maximum:unknown=resource.uses ?? resource.maximumUses ?? resource.maximum
        if (object(resource.usesByClassLevel)) maximum=Object.entries(resource.usesByClassLevel).filter(([n]) => Number(n)<=level).at(-1)?.[1]
        if (maximum==='class-table') maximum=data.reviewedEntities.find((r) => r.id===`phb2014:class-level:${cls}-${level}`)?.mechanics.rages
        if (maximum==='5*paladinLevel') maximum=5*level
        if (maximum==='1+charismaModifier' && stats.charisma) maximum=1+abilityModifier(String(stats.charisma))!
        const modifier=/^max\(1,(wisdom|charisma)Modifier\)$/.exec(String(maximum))
        if (modifier && stats[modifier[1]]) maximum=Math.max(1,abilityModifier(String(stats[modifier[1]]))!)
        const first=data.reviewedEntities.filter((prior)=>prior.kind===e.kind && prior.name===e.name && prior.relations?.classId===e.relations.classId && prior.relations?.subclassId===e.relations.subclassId).sort((a,b)=>Number(a.mechanics.level)-Number(b.mechanics.level))[0]
        if (typeof maximum==='number' && Number.isSafeInteger(maximum) && maximum>=0) add(first?.id ?? e.id,ruleName(e),{maximum,used:0,recovery:resource.recovery.filter((s):s is 'short-rest'|'long-rest' => s==='short-rest'||s==='long-rest')})
    }
    const context:rules.ChoiceContext={edition:'2014',classLevels:levels,knownCantripIds:knownSpellIds(sheet,data),subclassIds:sheetSubclassIds(sheet,data),featIds:sheetSelectedOptions(sheet)}
    for (const pool of rules.maneuverResources(data,context)) add(pool.originId,'Dadi di superiorità · '+pool.die,pool)
    return pools
}

export function verifiedSheetFields(sheet:CharacterSheet,data:rules.CandidateCreationData):Record<string,string> {
    const levels=sheetClassLevels(sheet),subclasses=sheetSubclassIds(sheet,data),fields:Record<string,string>={}
    const pools=rules.multiclassSpellPools(data,levels,subclasses)
    pools.spellcastingSlots.forEach((maximum,i) => {fields[`slots.${i+1}.total`]=String(maximum+(integerValue(sheet.playerDetails?.[`rules2014.createdSlot.${i+1}`]) ?? 0))})
    fields['rules2014.release']=data.candidateReleaseId
    fields['rules2014.pact.level']=String(pools.pactSlots?.level ?? 0)
    fields['rules2014.pact.total']=String(pools.pactSlots?.count ?? 0)
    const casting=verifiedSpellProfile(sheet,{...data,verified:data})
    const cls=casting ? data.reviewedEntities.find((e) => e.id==='phb2014:class:'+casting.id) : undefined
    const ability=cls?.mechanics.castingAbility ?? (casting && ['fighter','rogue'].includes(casting.id) ? 'intelligence' : null)
    if (casting && casting.maximum && typeof ability==='string' && keys.includes(ability as typeof keys[number])) {
        const mod=abilityModifier(sheet[ability as typeof keys[number]]),pb=2+Math.floor(((characterLevel(sheet) ?? 1)-1)/4)
        fields.castingClass=ruleName(cls!);fields.castingAbility=characterFields[ability as typeof keys[number]]
        fields.spellDC=mod===undefined ? '' : String(8+pb+mod);fields.spellAttackBonus=mod===undefined ? '' : String(pb+mod)
    }
    const features=availableRuleFeatures(sheet,data)
    fields.classFeatures=features.filter((e) => ['class-feature','subclass-feature'].includes(e.kind)).map((e) => `${ruleName(e)} (livello ${e.mechanics.level})\n${ruleDescription(e)}\n${ruleSourceText(e)}`).join('\n\n')
    fields['rules2014.featureIds']=features.map((e) => e.id).join(',')
    fields['rules2014.abilityRules']=JSON.stringify(features.map((e)=>{
        const effect=object(e.mechanics.effect) ? e.mechanics.effect : {},activation=String(effect.activation ?? '')
        return {id:e.id,name:ruleName(e),complete:e.verification.complete,activation:/^(action|bonus-action|reaction)(-|$)/.test(activation) ? 'active' : activation==='passive' ? 'passive' : 'review',
            rounds:typeof effect.durationMinutes==='number' ? effect.durationMinutes*10 : undefined}
    }))
    fields['rules2014.attackActionAttacks']=String(features.reduce((max,e)=>{
        if (!e.verification.complete || !object(e.mechanics.effect)) return max
        const effect=e.mechanics.effect,level=levels[String(e.relations.classId).split(':').at(-1)!] ?? 0
        const count=typeof effect.attackActionAttacks==='number' ? effect.attackActionAttacks : object(effect.attackActionAttacksByClassLevel) ? Number(Object.entries(effect.attackActionAttacksByClassLevel).filter(([n])=>Number(n)<=level).at(-1)?.[1] ?? 1) : 1
        return Math.max(max,count)
    },1))
    const feats=sheet.playerDetails?.['rules2014.featsEnabled']==='true' ? sheetSelectedOptions(sheet).map((id)=>data.verifiedCreationOptions.find((e)=>e.id===id&&e.kind==='feat')).filter((e)=>!!e) : []
    if (feats.length || sheet.playerDetails?.['rules2014.originalAdditionalTraits']!==undefined) {
        fields.additionalTraits=[sheet.playerDetails?.['rules2014.originalAdditionalTraits'] ?? sheet.playerDetails?.additionalTraits ?? '',...feats.map((e)=>`${ruleName(e)}\n${ruleDescription(e)}\n${ruleSourceText(e)}`)].filter(Boolean).join('\n\n')
        const initiativeBonus=feats.reduce((total,e)=>total+(typeof e.mechanics.initiativeBonus==='number' ? e.mechanics.initiativeBonus : 0),0)
        if (initiativeBonus) fields.initiativeBonus=String((integerValue(sheet.playerDetails?.initiativeBonus) ?? 0)+initiativeBonus)
    }
    const grants=verifiedSpellGrants(sheet,data)
    fields.spellGrants=JSON.stringify(grants.flatMap((grant) => {const e=data.reviewedEntities.find((e) => e.id===grant.spellId);return e ? [{index:e.index,name:ruleName(e),aliases:[e.name],level:e.mechanics.level,source:'always',note:'Sempre preparato, fuori dal limite di classe · '+grant.classIndex}] : []}))
    const constitution=integerValue(sheet.constitution)
    if (constitution!==undefined) {
        const primary=classId(sheet)
        let hp=0
        for (const [id,level] of Object.entries(levels)) for (let i=1;i<=level;i++) hp+=rules.levelHitPointGain(data,{edition:'2014',classId:'phb2014:class:'+id,firstCharacterLevel:id===primary&&i===1,constitutionScore:constitution}).hitPoints
        hp+=feats.reduce((total,e)=>total+(typeof e.mechanics.hitPointsPerCharacterLevel==='number' ? e.mechanics.hitPointsPerCharacterLevel*(characterLevel(sheet) ?? 0) : 0),0)
        hp+=(sheet.playerDetails?.['creation.subrace']==='hill-dwarf' ? characterLevel(sheet) ?? 0 : 0)
            +(subclasses.includes('phb2014:subclass:draconic') ? levels.sorcerer ?? 0 : 0)
        fields.maxHitPoints=String(Number(sheet.playerDetails?.exhaustion)>=4 ? Math.floor(hp/2) : hp)
    }
    return fields
}

export function restSheet(sheet:CharacterSheet,data:rules.CandidateCreationData,rest:'short-rest'|'long-rest',meditationMinutes:number):CharacterSheet {
    if (spellEdition(sheet)!=='2014') throw new Error('Il riposo verificato richiede un personaggio 2014.')
    const next={...sheet,playerDetails:{...sheet.playerDetails}},levels=sheetClassLevels(sheet)
    next.playerDetails['rules2014.raging']='false'
    next.playerDetails['rules2014.spellsThisTurn']='[]'
    for (const pool of sheetRuleResources(sheet,data)) {
        const recovered=pool.id==='ki' ? rules.recoverMonkKi(data,levels,pool.used,rest,meditationMinutes) : rules.recoverResource(pool,rest)
        next.playerDetails['rules2014.used.'+pool.id]=String(recovered.used)
    }
    if (rest==='short-rest' && levels.sorcerer>=20) next.playerDetails['rules2014.used.sorcery']=String(Math.max(0,(integerValue(next.playerDetails['rules2014.used.sorcery']) ?? 0)-4))
    if (rest==='long-rest') {
        for (let i=1;i<=9;i++) {next.playerDetails[`slots.${i}.used`]='0';next.playerDetails[`rules2014.createdSlot.${i}`]='0'}
        const maximum=integerValue(sheet.playerDetails?.maxHitPoints)
        if (maximum!==undefined && maximum>=0) next.hitPoints=String(maximum)
        let recover=Math.max(1,Math.floor((characterLevel(sheet) ?? 0)/2))
        // ponytail: recover larger dice first; add an explicit allocation picker if the table wants another legal order.
        const dice=sheetHitDice(sheet,data).sort((a,b)=>b.die-a.die)
        for (const pool of dice) {const recovered=Math.min(recover,pool.used);pool.used-=recovered;recover-=recovered;next.playerDetails['rules2014.hitDiceUsed.'+pool.id]=String(pool.used)}
        next.playerDetails.hitDiceUsed=String(dice.reduce((sum,pool)=>sum+pool.used,0))
    }
    return next
}

export function castSheetSpell(sheet:CharacterSheet,data:rules.CandidateCreationData,id:string,context:Pick<rules.SpellCastContext,'mode'|'slotLevel'|'components'|'armorProficient'|'castingAlternative'|'spellsThisTurn'|'manualEffectResolution'> & {longCastingCompleted?:boolean}) {
    const levels=sheetClassLevels(sheet),cls=sheet.playerDetails?.['rules2014.castingClass'] || classId(sheet)
    const pools=rules.multiclassSpellPools(data,levels,sheetSubclassIds(sheet,data))
    if (sheet.playerDetails?.['rules2014.raging']==='true') throw new Error('Durante l’ira non puoi lanciare incantesimi o mantenere concentrazione.')
    const created=Array.from({length:9},(_,i)=>integerValue(sheet.playerDetails?.[`rules2014.createdSlot.${i+1}`]) ?? 0)
    const rows=Object.entries(sheet.playerDetails ?? {}).flatMap(([key,name])=>{
        if (!/^spell\.\d+\.\d+\.name$/.test(key)) return []
        const root=key.slice(0,-5),index=sheet.playerDetails?.[root+'.index'],entity=(index ? referenceFor(data,'spells',index) : undefined) ?? data.reviewedEntities.find(e=>e.kind==='spell'&&[e.name,e.nameIt].some(n=>n&&normalized(n)===normalized(name)))
        return entity ? [{id:entity.id,root,source:sheet.playerDetails?.[root+'.source'],origin:sheet.playerDetails?.[root+'.origin']}] : []
    })
    const secret=cls==='bard' ? rows.find((row)=>row.id===id&&['secrets','lore'].includes(row.source ?? '')) : undefined
    let additionalAccess:rules.SpellCastContext['additionalAccess']
    if (secret) {
        const origins=data.reviewedEntities.filter(e=>e.relations?.classId==='phb2014:class:bard'&&e.name===(secret.source==='lore' ? 'Additional Magical Secrets' : 'Magical Secrets')&&Number(e.mechanics.level)<=(levels.bard ?? 0))
        const origin=secret.origin || (origins.length===1 ? origins[0].id : '')
        if (!origin) throw new Error('Indica l’origine delle scelte di Segreti Magici nelle righe degli incantesimi.')
        additionalAccess={originId:origin,selectedSpellIds:rows.filter(row=>row.source===secret.source&&(row.origin===origin||!row.origin&&origins.length===1)).map(row=>row.id)}
    }
    const history=context.spellsThisTurn ?? JSON.parse(sheet.playerDetails?.['rules2014.spellsThisTurn'] ?? '[]') as rules.SpellCastContext['spellsThisTurn']
    if (!Array.isArray(history)) throw new Error('Cronologia del turno non valida: azzerala prima del lancio.')
    const arcanum=knownSpellIds(sheet,data,'warlock').filter((id)=>Number(data.reviewedEntities.find(e=>e.id===id)?.mechanics.level)>=6)
    const plan=rules.spellCastPlan(data,id,{...context,spellsThisTurn:history,additionalAccess,edition:spellEdition(sheet),classLevels:levels,classIndex:cls,subclassIds:sheetSubclassIds(sheet,data),
        landTerrain:sheet.playerDetails?.['creation.land'] as rules.LandTerrain,dmApproved:sheet.playerDetails?.['rules2014.dmApproved']==='true',alignment:sheet.playerDetails?.['rules2014.alignment'],
        arcanumSpellIds:arcanum,remainingArcanumUses:1-(integerValue(sheet.playerDetails?.['rules2014.used.arcanum:'+id]) ?? 0),createdSpellSlots:created,
        knownSpellIds:knownSpellIds(sheet,data,cls),preparedSpellIds:knownSpellIds(sheet,data,cls,true),spellbookIds:knownSpellIds(sheet,data,cls),
        remainingSpellSlots:pools.spellcastingSlots.map((total,i) => total+created[i]-(integerValue(sheet.playerDetails?.[`slots.${i+1}.used`]) ?? 0)),
        remainingPactSlots:(pools.pactSlots?.count ?? 0)-(integerValue(sheet.playerDetails?.['rules2014.used.pact']) ?? 0)})
    const next={...sheet,playerDetails:{...sheet.playerDetails}}
    if ((plan.casting.unit==='minute' || plan.casting.unit==='hour' || plan.ritualAdditionalMinutes) && context.longCastingCompleted!==true) throw new Error('Lancio prolungato: completalo con il DM prima di registrare il consumo. Le regole sono visibili nel riferimento.')
    if (context.mode==='spellcasting-slot' && context.slotLevel && created[context.slotLevel-1]>0) {created[context.slotLevel-1]--;next.playerDetails[`rules2014.createdSlot.${context.slotLevel}`]=String(created[context.slotLevel-1])}
    if (plan.resultingSlots.spellcasting) plan.resultingSlots.spellcasting.forEach((remaining,i) => {next.playerDetails[`slots.${i+1}.used`]=String(pools.spellcastingSlots[i]+created[i]-remaining)})
    if (plan.resultingSlots.pact!==null) next.playerDetails['rules2014.used.pact']=String((pools.pactSlots?.count ?? 0)-plan.resultingSlots.pact)
    if (plan.concentration) next.playerDetails['rules2014.concentration']=id
    else if (plan.concentrationDuringCasting) next.playerDetails['rules2014.concentration']=''
    if (plan.arcanumUseSpent) next.playerDetails['rules2014.used.arcanum:'+id]='1'
    next.playerDetails['rules2014.spellsThisTurn']=JSON.stringify([...history,{level:plan.castLevel,unit:plan.casting.unit}])
    return {sheet:next,plan}
}

export function convertSorcery(sheet:CharacterSheet,data:rules.CandidateCreationData,mode:'create-slot'|'sacrifice-slot',slotLevel:number) {
    const levels=sheetClassLevels(sheet),pools=rules.multiclassSpellPools(data,levels,sheetSubclassIds(sheet,data)),max=rules.sorcererProgression(data,levels).sorceryPoints
    const created=Array.from({length:9},(_,i)=>integerValue(sheet.playerDetails?.[`rules2014.createdSlot.${i+1}`]) ?? 0)
    const available=pools.spellcastingSlots.map((n,i)=>n+created[i]-(integerValue(sheet.playerDetails?.[`slots.${i+1}.used`]) ?? 0))
    const result=rules.sorcererFlexibleCasting(data,levels,{points:max-(integerValue(sheet.playerDetails?.['rules2014.used.sorcery']) ?? 0),availableSlots:available,createdSlots:created},mode,slotLevel)
    const next:CharacterSheet={...sheet,playerDetails:{...sheet.playerDetails,'rules2014.used.sorcery':String(max-result.points)}}
    result.createdSlots.forEach((n,i)=>{next.playerDetails![`rules2014.createdSlot.${i+1}`]=String(n);next.playerDetails![`slots.${i+1}.used`]=String(pools.spellcastingSlots[i]+n-result.availableSlots[i])})
    return {sheet:next,plan:result}
}
