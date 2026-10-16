import { useMemo, useState } from 'react'
import * as rules from '../domain/dnd/VerifiedDatabase'
import { availableRuleFeatures, castSheetSpell, convertSorcery, knownSpellIds, restSheet, spendSheetHitDie, ruleDescription, ruleName, ruleSourceText, ruleOptionGroups, ruleOptionIssues, sheetClassLevels, sheetRuleResources, sheetSubclassIds, referenceFor } from '../domain/dnd/ActiveRules'
import { classId, spellEdition } from '../utils/Spellcasting'
import { integerValue, type CharacterSheet } from '../utils/CharacterSheets'
import { inventoryItems, addInventoryItem } from '../utils/Inventory'
import { type CreationData } from '../utils/PlayerCreation'
import { InfoButton } from './InfoButton'

const names:Record<string,string>={class:'Classi',subclass:'Sottoclassi','class-feature':'Privilegi di classe','subclass-feature':'Privilegi di sottoclasse','class-option':'Opzioni di classe',race:'Razze',subrace:'Sottorazze',background:'Background',spell:'Incantesimi',creature:'Creature','magic-item':'Oggetti magici',feat:'Talenti',rule:'Regole',action:'Azioni',weapon:'Armi',armor:'Armature',gear:'Equipaggiamento',tool:'Strumenti','equipment-pack':'Dotazioni'}
const message=(error:unknown) => error instanceof Error ? error.message : 'Operazione non disponibile: verifica con il DM.'
const listIds=(value:string) => value.split(',').map((v) => v.trim()).filter(Boolean)

export default function RulesPanel({data,sheet,onChange,expanded}:{data:CreationData;sheet?:CharacterSheet;onChange?:(sheet:CharacterSheet)=>void;expanded?:boolean}) {
    const verified=data.verified!
    const [open,setOpen]=useState(false)
    const [error,setError]=useState(''),[result,setResult]=useState<unknown>()
    const [query,setQuery]=useState(''),[kind,setKind]=useState(''),[count,setCount]=useState(60)
    const [values,setValues]=useState<Record<string,string>>({meditation:'30',slot:'1',quantity:'1',roll:'1',distance:'5',reach:'5',freeHands:'1',attackerSize:'Medium',targetSize:'Medium',mode:'spellcasting-slot',materialSource:'none',damageType:'slashing'})
    const [tool,setTool]=useState('trinket')
    const [chosenSpell,setChosenSpell]=useState(''),[chosenCreature,setChosenCreature]=useState(''),[chosenItem,setChosenItem]=useState('')
    const is2014=sheet && spellEdition(sheet)==='2014'
    const change=(key:string,value:string) => setValues((previous) => ({...previous,[key]:value}))
    const details=sheet?.playerDetails ?? {}
    const edit=(key:string,value:string) => {if (sheet && onChange) onChange({...sheet,playerDetails:{...details,[key]:value}})}
    const run=(operation:()=>unknown) => {try {setResult(operation());setError('')} catch (error) {setError(message(error));setResult(undefined)}}
    const number=(key:string) => {const value=Number(values[key]);if (!values[key]?.trim() || !Number.isFinite(value)) throw new Error('Inserisci un numero valido per '+key+'.');return value}
    const flag=(key:string) => values[key]==='true'
    const field=(key:string,label:string,initial='') => <label className="player-field" key={key}><span>{label}</span><input type="number" step={['distance','reach','meditation'].includes(key) ? 'any' : '1'} value={values[key] ?? initial} onChange={(event)=>change(key,event.target.value)} /></label>
    const check=(key:string,label:string) => <label className="player-check" key={key}><input type="checkbox" checked={flag(key)} onChange={(event)=>change(key,String(event.target.checked))}/>{label}</label>
    const select=(key:string,label:string,options:[string,string][]) => <label className="player-field" key={key}><span>{label}</span><select aria-label={label} value={values[key] ?? ''} onChange={(event)=>change(key,event.target.value)}><option value="">Seleziona…</option>{options.map(([value,name])=><option key={value} value={value}>{name}</option>)}</select></label>
    const source=(entity:Omit<rules.ReviewedEntity,'mechanics'> & {mechanics:unknown}) => <InfoButton name={ruleName(entity)} description={ruleDescription(entity)} fields={{edition:'2014',verification:entity.verification,mechanics:entity.mechanics,sources:ruleSourceText(entity)}}/>
    let levels:Record<string,number>={},resources:ReturnType<typeof sheetRuleResources>=[],groups:ReturnType<typeof ruleOptionGroups>=[],stateError=''
    if (is2014 && open) try {levels=sheetClassLevels(sheet);resources=sheetRuleResources(sheet,verified);groups=ruleOptionGroups(sheet,verified)} catch (error) {
        stateError=message(error)
        levels=Object.fromEntries(data.classes.map((cls)=>[cls.index,integerValue(details['rules2014.level.'+cls.index]) ?? (cls.index===classId(sheet) ? integerValue(sheet.level) ?? 0 : 0)]))
    }
    const filtered=useMemo(()=>verified.reviewedEntities.filter((entity)=>(!kind || entity.kind===kind)
        && `${entity.name} ${entity.nameIt ?? ''} ${entity.index} ${entity.summaryIt ?? ''}`.toLocaleLowerCase('it').includes(query.trim().toLocaleLowerCase('it'))),[verified,kind,query])
    const caster=details['rules2014.castingClass'] || (sheet ? classId(sheet) : '')
    let spells:rules.ReviewedEntity[]=[]
    if (is2014 && open && !stateError) {try {const ids=knownSpellIds(sheet,verified,caster);spells=verified.reviewedEntities.filter((e)=>e.kind==='spell' && ids.includes(e.id))} catch (error) {stateError=message(error)}}
    const optional={edition:'2014' as const,dmApproved:flag('dmApproved')}
    const creatures=verified.verifiedCreatures
    const selectedItem=verified.verifiedMagicItems.find((item)=>item.id===chosenItem)

    function updateLevels(cls:string,value:string) {
        if (!sheet || !onChange) return
        const level=integerValue(value)
        if (level===undefined || level<0 || level>20) {setError('Ogni livello di classe deve essere tra 0 e 20.');return}
        const next={...levels,[cls]:level},total=Object.values(next).reduce((a,b)=>a+b,0)
        if (!total || total>20 || !next[classId(sheet)]) {setError('Il livello totale deve essere tra 1 e 20 e includere la classe iniziale.');return}
        const d={...details}
        for (const [id,n] of Object.entries(next)) d['rules2014.level.'+id]=String(n)
        onChange({...sheet,level:String(total),playerDetails:d});setError('')
    }
    function chooseOption(origin:string,id:string,checked:boolean) {
        if (!sheet || !onChange) return
        run(()=>{
            const selected=listIds(details['rules2014.option.'+origin] ?? ''),next=checked ? [...selected,id] : selected.filter((x)=>x!==id)
            const issues=ruleOptionIssues(sheet,verified,origin,next)
            if (checked && issues.length) throw new Error(issues.join(' '))
            edit('rules2014.option.'+origin,next.join(','));return checked ? 'Scelta registrata.' : 'Scelta rimossa.'
        })
    }
    function chooseSubclass(cls:string,index:string) {
        if (!sheet||!onChange) return
        const origin=data.subclasses.find((sub)=>sub.index===index),d={...details,['rules2014.subclass.'+cls]:index}
        if (cls===classId(sheet)) {d['creation.subclass']=index;d.subclass=origin?.nameIt ?? origin?.name ?? ''}
        onChange({...sheet,playerDetails:d})
    }
    function cast() {
        if (!sheet || !onChange) return
        run(()=>{
            const mode=values.mode as rules.SpellCastContext['mode']
            const outcome=castSheetSpell(sheet,verified,chosenSpell,{mode,slotLevel:['cantrip','ritual','mystic-arcanum'].includes(mode) ? undefined : number('slot'),longCastingCompleted:flag('longCastingCompleted'),
                castingAlternative:values.castingAlternative ? number('castingAlternative') : undefined,
                armorProficient:flag('armorProficient'),components:{canSpeak:flag('canSpeak'),freeSomaticHand:flag('freeSomaticHand'),materialHand:flag('materialHand'),
                    materialSource:values.materialSource as rules.SpellCastContext['components']['materialSource'],focusClassIndex:caster,specificMaterialsConfirmed:flag('specificMaterials')},
                spellsThisTurn:flag('bonusSpell') ? [...JSON.parse(details['rules2014.spellsThisTurn'] ?? '[]'),{level:1,unit:'bonus-action'}] : undefined})
            if ((outcome.plan.concentration || outcome.plan.concentrationDuringCasting) && details['rules2014.concentration'] && !flag('replaceConcentration')) throw new Error('Conferma la fine della concentrazione precedente prima del nuovo lancio.')
            onChange(outcome.sheet);return outcome.plan
        })
    }
    function magicItem() {
        if (!sheet || !onChange || !selectedItem) return
        run(()=>{
            if (spellEdition(sheet)!=='2014') throw new Error('Oggetto delle regole 2014.')
            const instance=values.instance ?? '',owned=inventoryItems(sheet).find((item)=>item.id===instance)
            if (!owned || Number(owned.quantity)<1 || owned.catalog!==selectedItem.id) throw new Error('Seleziona una copia posseduta di questo oggetto nell’inventario.')
            const variant=values.variant || undefined
            const attuned=Object.entries(details).filter(([key,value])=>key.startsWith('rules2014.attuned.')&&value).map(([key,value])=>({instanceId:key.slice('rules2014.attuned.'.length),referenceId:value.split('|')[0],variantIndex:value.split('|')[1]||undefined}))
            if (values.itemMode==='attune') {const plan=rules.magicItemAttunementPlan(verified,selectedItem.id,attuned,instance,variant);if (!flag('itemRequirements')||!flag('itemRest')) throw new Error('Conferma requisiti e riposo breve in contatto dedicato alla sintonia.');edit('rules2014.attuned.'+instance,selectedItem.id+'|'+(variant ?? ''));return plan}
            const plan=rules.magicItemUsePlan(verified,selectedItem.id,{edition:'2014',attuned:attuned.some((copy)=>copy.instanceId===instance),usageRequirementMet:flag('itemRequirements'),commandWordAvailable:flag('commandWord'),variantIndex:variant,
                property:(values.property||'main') as rules.MagicItemProperty,castChoiceIndex:values.castChoice ? number('castChoice') : undefined,sentientPermission:flag('sentientPermission')?'allowed':undefined,
                inDimLightOrDarkness:flag('dimLight'),itemControlEstablished:flag('itemControl')})
            if (plan.chargeCost) {
                const used=integerValue(details['rules2014.itemUsed.'+instance]) ?? 0,resource=rules.magicItemResource(verified,selectedItem.id,used)
                if (resource.maximum===null || used+plan.chargeCost>resource.maximum) throw new Error('Cariche insufficienti o risorsa non quantificata.')
                edit('rules2014.itemUsed.'+instance,String(used+plan.chargeCost))
            }
            return plan
        })
    }

    return <details className="player-sheet-settings player-sheet-controls rules-panel" data-print="exclude" open={expanded || undefined} onToggle={(event)=>{if (event.target===event.currentTarget) setOpen(event.currentTarget.open)}}><summary>{sheet ? 'Regole, scelte e risorse · 2014' : 'Manuali e strumenti del DM · 2014'}</summary>{open && <>
        <p>{verified.reviewedEntities.length} voci con fonti e stato di verifica. Le interpretazioni aperte richiedono una decisione del DM.</p>
        {sheet && !is2014 && <p>Questa scheda usa le regole 2024. I calcoli 2014 qui sotto sono disponibili per consultazione separata.</p>}
        {stateError && <p role="alert">{stateError}</p>}{details['rules2014.issues'] && <p role="alert">{details['rules2014.issues']}</p>}
        {error && <p role="alert">{error}</p>}{result!==undefined && <div role="status">Operazione verificata. <InfoButton name="Risultato dell’operazione" fields={{result}}/></div>}
        {is2014 && onChange && <>
            <details><summary>Classi, sottoclassi e multiclassamento</summary>
                <label className="player-check"><input type="checkbox" checked={details['rules2014.multiclassApproved']==='true'} onChange={(event)=>edit('rules2014.multiclassApproved',String(event.target.checked))}/>Multiclassamento autorizzato dal DM</label>
                <label className="player-check"><input type="checkbox" checked={details['rules2014.dmApproved']==='true'} onChange={(event)=>edit('rules2014.dmApproved',String(event.target.checked))}/>Opzioni DMG di classe autorizzate dal DM</label>
                <label className="player-field"><span>Allineamento per i prerequisiti DMG</span><select aria-label="Allineamento per i prerequisiti DMG" value={details['rules2014.alignment'] ?? ''} onChange={(event)=>edit('rules2014.alignment',event.target.value)}><option value="">Seleziona…</option>{data.alignments.map((alignment)=><option key={alignment.index} value={alignment.index}>{alignment.nameIt ?? alignment.name}</option>)}</select></label>
                {!!levels.barbarian && !!levels.monk && !['barbarian','monk'].includes(classId(sheet)) && <label className="player-field"><span>Prima Difesa senza Armatura acquisita (ordine deciso con il DM)</span><select aria-label="Prima Difesa senza Armatura acquisita" value={details['rules2014.unarmoredClass'] ?? ''} onChange={(event)=>edit('rules2014.unarmoredClass',event.target.value)}><option value="">Compilazione manuale finché non confermata</option><option value="barbarian">Barbaro</option><option value="monk">Monaco</option></select></label>}
                <div className="player-grid">{data.classes.map((cls)=><div key={cls.index}><label className="player-field"><span>{cls.nameIt ?? cls.name} · livelli</span><input type="number" min="0" max="20" step="1" value={levels[cls.index] ?? 0} onChange={(event)=>updateLevels(cls.index,event.target.value)}/></label>
                    {!!levels[cls.index] && <label className="player-field"><span>Sottoclasse · {cls.nameIt ?? cls.name}</span><select aria-label={`Sottoclasse · ${cls.nameIt ?? cls.name}`} value={details['rules2014.subclass.'+cls.index] ?? (cls.index===classId(sheet) ? details['creation.subclass'] ?? '' : '')} onChange={(event)=>chooseSubclass(cls.index,event.target.value)}><option value="">Seleziona…</option>{data.subclasses.filter((sub)=>sub.class?.index===cls.index && sub.ruleStatus!=='legacy').map((sub)=><option key={sub.index} value={sub.index} disabled={(levels[cls.index] ?? 0)<(sub.minimumLevel ?? 1)}>{sub.nameIt ?? sub.name}{sub.ruleStatus==='partial' ? ' · parziale, DM' : ''}</option>)}</select></label>}</div>)}</div>
            </details>
            <details><summary>Scelte di classe</summary><p>Attacchi per azione Attaccare: {details['rules2014.attackActionAttacks'] ?? '1'}. I privilegi Attacco Extra non si sommano; rispetta i vincoli dell’arma indicati nelle fonti.</p>{groups.map((group)=><fieldset key={group.id}><legend>{group.name}</legend>{group.options.map((option)=><div key={option.id}><label><input type="checkbox" checked={listIds(details['rules2014.option.'+group.id] ?? '').includes(option.id)} onChange={(event)=>chooseOption(group.id,option.id,event.target.checked)}/>{ruleName(option)}</label>{source(option)}</div>)}</fieldset>)}{!groups.length && <p>Nessuna scelta concessa dalle classi e dai livelli selezionati.</p>}</details>
            <details><summary>Talenti opzionali</summary><label><input type="checkbox" checked={details['rules2014.featsEnabled']==='true'} onChange={(event)=>edit('rules2014.featsEnabled',String(event.target.checked))}/>Il DM permette i talenti al posto degli incrementi di caratteristica</label><p>Registra separatamente gli incrementi già applicati ai punteggi. I benefici condizionali e le scelte interne al talento sono riportati nelle fonti e richiedono risoluzione del DM.</p>
                {verified.verifiedCreationOptions.filter((e)=>e.kind==='feat').map((feat)=><div key={feat.id}><label><input type="checkbox" checked={listIds(details['rules2014.option.feats'] ?? '').includes(feat.id)} onChange={(event)=>run(()=>{
                    const selected=listIds(details['rules2014.option.feats'] ?? ''),next=event.target.checked ? [...selected,feat.id] : selected.filter((id)=>id!==feat.id)
                    if (event.target.checked) {
                        const abilities={strength:Number(sheet.strength),dexterity:Number(sheet.dexterity),constitution:Number(sheet.constitution),intelligence:Number(sheet.intelligence),wisdom:Number(sheet.wisdom),charisma:Number(sheet.charisma)}
                        const pools=rules.multiclassSpellPools(verified,levels,sheetSubclassIds(sheet,verified))
                        const issues=rules.featSelectionIssues(verified,feat.id,{edition:'2014',featsEnabled:details['rules2014.featsEnabled']==='true',abilities,armorProficiencies:['light','medium','heavy'].filter((kind)=>details['proficiency.'+({light:'Leggere',medium:'Medie',heavy:'Pesanti'}[kind])]==='true'),canCastSpell:Object.values(pools.ownClassMaximumSpellLevel).some((maximum)=>maximum>0)||!!pools.pactSlots,selected:selected.map((id)=>({id})),damageType:values.featDamageType})
                        const maximum=Object.entries(levels).reduce((count,[cls,level])=>count+(data.classes.find((c)=>c.index===cls)?.abilityScoreImprovementLevels?.filter((n)=>n<=level).length ?? 0),0)+(details['rules2014.variantHuman']==='true' ? 1 : 0)
                        if (next.length>maximum) issues.push('Talenti superiori agli incrementi concessi dai livelli di classe.')
                        if (issues.length) throw new Error(issues.join(' '))
                    }
                    onChange({...sheet,playerDetails:{...details,'rules2014.option.feats':next.join(','),'rules2014.originalAdditionalTraits':details['rules2014.originalAdditionalTraits'] ?? details.additionalTraits ?? ''}});return 'Scelta del talento registrata.'
                })}/>{ruleName(feat)}</label>{source(feat)}</div>)}
                {select('featDamageType','Tipo di danno scelto per Adepto Elementale',['acid','cold','fire','lightning','thunder'].map((kind)=>[kind,kind]))}
            </details>
            <details><summary>Risorse e riposi</summary>{resources.map((pool)=><div className="player-grid" key={pool.id}><label className="player-field"><span>{pool.name} · usi consumati / {pool.maximum}</span><input type="number" min="0" max={pool.maximum} step="1" value={details['rules2014.used.'+pool.id] ?? '0'} onChange={(event)=>{const n=integerValue(event.target.value);if (n!==undefined && n>=0 && n<=pool.maximum) edit('rules2014.used.'+pool.id,event.target.value)}}/></label><button type="button" disabled={pool.used>=pool.maximum} onClick={()=>edit('rules2014.used.'+pool.id,String(pool.used+1))}>Consuma un uso</button><small>{pool.recovery.includes('short-rest') ? 'Riposo breve o lungo' : 'Riposo lungo'}{pool.note && ' · '+pool.note}</small></div>)}
                {field('meditation','Minuti di meditazione durante il riposo')}
                <button type="button" onClick={()=>run(()=>{onChange(restSheet(sheet,verified,'short-rest',number('meditation')));return 'Riposo breve completato; i PF richiedono la spesa dei dadi vita.'})}>Completa riposo breve</button>
                <button type="button" onClick={()=>run(()=>{onChange(restSheet(sheet,verified,'long-rest',number('meditation')));return 'Riposo lungo completato.'})}>Completa riposo lungo</button>
                {select('hitDieClass','Classe del dado vita da spendere',Object.keys(levels).map((cls)=>[cls,`${data.classes.find((c)=>c.index===cls)?.nameIt ?? cls} · d${data.classes.find((c)=>c.index===cls)?.hit_die}`]))}{field('hitDieRoll','Risultato del dado vita speso nel riposo breve')}
                <button type="button" onClick={()=>run(()=>{const outcome=spendSheetHitDie(sheet,verified,values.hitDieClass || classId(sheet),number('hitDieRoll'));onChange(outcome.sheet);return outcome.plan})}>Spendi dado vita dopo il riposo</button>
                {Object.keys(levels).length>1 && <details><summary>Ripartisci i dadi vita di una scheda precedente</summary><p>Usati totali: {details.hitDiceUsed || '0'}. Il recupero del riposo lungo restituisce prima i dadi più grandi.</p>{Object.keys(levels).map((cls)=>field('diceUsed.'+cls,`Dadi usati · ${cls}`,details['rules2014.hitDiceUsed.'+cls] ?? (cls===classId(sheet) ? details.hitDiceUsed ?? '0' : '0')))}<button type="button" onClick={()=>run(()=>{
                    const d={...details};let total=0
                    for (const [cls,maximum] of Object.entries(levels)) {const n=values['diceUsed.'+cls]===undefined ? Number(details['rules2014.hitDiceUsed.'+cls] ?? (cls===classId(sheet) ? details.hitDiceUsed ?? '0' : '0')) : number('diceUsed.'+cls);if (!Number.isSafeInteger(n)||n<0||n>maximum) throw new Error('Dadi usati superiori ai livelli della classe.');total+=n;d['rules2014.hitDiceUsed.'+cls]=String(n)}
                    if (total!==Number(details.hitDiceUsed || 0)) throw new Error('La ripartizione deve conservare il totale precedente.');onChange({...sheet,playerDetails:d});return 'Dadi vita ripartiti senza cambiare il totale.'
                })}>Conferma ripartizione dei dadi vita</button></details>}
            </details>
            <details><summary>Lancio e concentrazione</summary><label className="player-field"><span>Classe che lancia</span><select value={caster} onChange={(event)=>edit('rules2014.castingClass',event.target.value)}>{Object.keys(levels).map((cls)=><option key={cls} value={cls}>{data.classes.find((c)=>c.index===cls)?.nameIt ?? cls}</option>)}</select></label>
                <label className="player-field"><span>Incantesimo conosciuto o concesso</span><select value={chosenSpell} onChange={(event)=>setChosenSpell(event.target.value)}><option value="">Seleziona…</option>{spells.map((spell)=><option key={spell.id} value={spell.id}>{ruleName(spell)}{!spell.verification.complete ? ' · parziale, DM' : ''}</option>)}</select></label>
                {select('mode','Modo di lancio',[['cantrip','Trucchetto'],['spellcasting-slot','Slot di Incantesimi'],['pact-slot','Slot del Patto'],['ritual','Rituale'],['mystic-arcanum','Arcanum Mistico scelto']])}{field('slot','Livello dello slot')}{field('castingAlternative','Modalità alternativa: indice da 0, se prevista')}
                {check('armorProficient','Competente nell’armatura indossata (o senza armatura)')}{check('canSpeak','Componente verbale disponibile')}{check('freeSomaticHand','Mano libera per la componente somatica')}{check('materialHand','Mano disponibile per la componente materiale')}
                {select('materialSource','Materiali',[['none','Nessuno'],['specific','Componenti specifici'],['pouch','Borsa dei componenti'],['focus','Focus della classe']])}{check('specificMaterials','Possiedo i materiali specifici costosi o consumabili')}{check('bonusSpell','Ho già lanciato una magia con azione bonus in questo turno')}{check('replaceConcentration','Confermo la fine della concentrazione precedente')}
                {check('longCastingCompleted','Lancio prolungato o rituale completato mantenendo la concentrazione durante il lancio')}
                <label><input type="checkbox" disabled={!levels.barbarian} checked={details['rules2014.raging']==='true'} onChange={(event)=>onChange({...sheet,playerDetails:{...details,'rules2014.raging':String(event.target.checked),...(event.target.checked ? {'rules2014.concentration':''} : {})}})}/>Ira attiva</label>
                <button type="button" disabled={!chosenSpell || !!stateError} onClick={cast}>Registra lancio completato</button>
                <button type="button" onClick={()=>edit('rules2014.spellsThisTurn','[]')}>Azzera cronologia a inizio turno</button>
                {details['rules2014.concentration'] && <p>Concentrazione: {verified.reviewedEntities.find((e)=>e.id===details['rules2014.concentration'])?.nameIt ?? details['rules2014.concentration']} <button type="button" onClick={()=>edit('rules2014.concentration','')}>Termina concentrazione</button></p>}
                {!!levels.sorcerer && <><button type="button" onClick={()=>run(()=>{const outcome=convertSorcery(sheet,verified,'create-slot',number('slot'));onChange(outcome.sheet);return outcome.plan})}>Crea slot con punti stregoneria</button><button type="button" onClick={()=>run(()=>{const outcome=convertSorcery(sheet,verified,'sacrifice-slot',number('slot'));onChange(outcome.sheet);return outcome.plan})}>Sacrifica slot per punti stregoneria</button></>}
            </details>
            <details><summary>Famigli, Forma Selvatica e compagno</summary><label className="player-field"><span>Creatura verificata</span><select value={chosenCreature} onChange={(event)=>setChosenCreature(event.target.value)}><option value="">Seleziona…</option>{creatures.map((creature)=><option key={creature.id} value={creature.id}>{ruleName(creature)}</option>)}</select></label>{check('previouslySeen','Il druido ha già visto questa bestia')}
                <button type="button" disabled={!chosenCreature} onClick={()=>run(()=>{const issues=rules.wildShapeIssues(verified,chosenCreature,{edition:'2014',classLevels:levels,previouslySeen:flag('previouslySeen'),subclassId:sheetSubclassIds(sheet,verified).find((s)=>['phb2014:subclass:moon','phb2014:subclass:land'].includes(s))});if (issues.length) throw new Error(issues.join(' '));const pool=resources.find((p)=>p.id==='wild-shape');if (pool&&pool.used>=pool.maximum) throw new Error('Forma Selvatica esaurita.');onChange({...sheet,playerDetails:{...details,'rules2014.used.wild-shape':String((pool?.used ?? 0)+1),'rules2014.wildShape':chosenCreature}});return rules.reviewedCreature(verified,chosenCreature)})}>Verifica forma e registra uso</button>
                <button type="button" disabled={!chosenCreature} onClick={()=>run(()=>rules.familiarStatistics(verified,chosenCreature,'fey',{edition:'2014',classLevels:levels,knownCantripIds:knownSpellIds(sheet,verified),subclassIds:sheetSubclassIds(sheet,verified),pactOptionId:listIds(Object.entries(details).filter(([k])=>k.startsWith('rules2014.option.')).map(([,v])=>v).join(',')).find((id)=>id.endsWith(':pact-of-the-chain'))}))}>Statistiche del famiglio (spirito folletto)</button>
                <button type="button" disabled={!chosenCreature} onClick={()=>run(()=>rules.rangerCompanionStatistics(verified,chosenCreature,levels,sheetSubclassIds(sheet,verified).find((id)=>verified.reviewedEntities.find((e)=>e.id===id)?.relations?.classId==='phb2014:class:ranger') ?? ''))}>Verifica compagno del ranger</button>
            </details>
            <details><summary>Oggetti magici posseduti, sintonia e cariche</summary><label className="player-field"><span>Oggetto verificato</span><select value={chosenItem} onChange={(event)=>setChosenItem(event.target.value)}><option value="">Seleziona…</option>{verified.verifiedMagicItems.map((item)=><option key={item.id} value={item.id}>{ruleName(item)}</option>)}</select></label>
                {selectedItem && <>{source(selectedItem)}<button type="button" onClick={()=>onChange(addInventoryItem(sheet,data,ruleName(selectedItem),selectedItem.id))}>Aggiungi copia all’inventario</button></>}
                {select('instance','Copia posseduta',inventoryItems(sheet).filter((item)=>item.catalog===chosenItem).map((item)=>[item.id,item.name+' · '+item.id]))}
                {select('itemMode','Operazione',[['attune','Completa sintonia'],['use','Usa proprietà']])}
                {selectedItem && Array.isArray(selectedItem.mechanics.effect.variants) && select('variant','Variante',selectedItem.mechanics.effect.variants.flatMap((v)=>v && typeof v==='object' && !Array.isArray(v) && typeof v.index==='string' ? [[v.index,String(v.nameIt ?? v.name ?? v.index)] as [string,string]] : []))}
                {select('property','Proprietà',[['main','Principale'],['action','Azione'],['castChoice','Lancio di incantesimo'],['reaction','Reazione'],['spellAbsorption','Assorbimento'],['lightning','Fulmine'],['thunder','Tuono'],['powerStrike','Colpo potente']])}{field('castChoice','Indice della scelta di lancio, da 0')}
                {check('itemRequirements','Ho verificato i requisiti d’uso e di sintonia')}{check('itemRest','Ho completato il riposo breve dedicato alla sintonia')}{check('commandWord','Parola di comando disponibile')}{check('sentientPermission','L’oggetto senziente autorizza l’uso tramite il DM')}{check('itemControl','Controllo dell’artefatto stabilito')}{check('dimLight','Luce fioca o oscurità')}
                <button type="button" disabled={!selectedItem} onClick={magicItem}>Verifica e registra operazione</button>
            </details>
        </>}
        <details><summary>Calcolatori del DM</summary>
            {check('dmApproved','Il DM autorizza questa regola opzionale')}
            <label className="player-field"><span>Operazione</span><select aria-label="Operazione" value={tool} onChange={(event)=>{setTool(event.target.value);setResult(undefined);setError('')}}>{Object.entries({trinket:'Cianfrusaglie',madness:'Follia',wildMagic:'Magia Selvaggia',treasure:'Tabella dei tesori',chase:'Scatto in inseguimento',object:'Danno a un oggetto',grapple:'Lotta',shove:'Spinta',points:'Punti incantesimo',smite:'Punizione divina',breath:'Soffio draconico'}).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
            {['trinket','madness','wildMagic','treasure'].includes(tool) && field('roll','Risultato del dado')}
            {tool==='madness' && select('madnessKind','Durata della follia',[['short','Breve'],['long','Lunga'],['indefinite','Indefinita']])}
            {tool==='treasure' && select('treasure','Tabella',verified.reviewedEntities.filter((e)=>e.mechanics.ruleType==='treasure-table').map((e)=>[e.id,ruleName(e)]))}
            {tool==='chase' && <>{field('constitution','Costituzione')}{field('dashUses','Scatti già usati')}</>}
            {tool==='object' && <>{field('currentHP','PF attuali dell’oggetto')}{field('damage','Danno dopo modificatori del DM')}{field('threshold','Soglia di danno')}{select('damageType','Tipo di danno',['acid','bludgeoning','cold','fire','force','lightning','necrotic','piercing','poison','psychic','radiant','slashing','thunder'].map((id)=>[id,id]))}{check('canDamageObject','Il DM conferma che questo attacco può danneggiare l’oggetto')}</>}
            {['grapple','shove'].includes(tool) && <>{check('hasAttackAction','Dispongo dell’azione Attaccare')}{select('attackerSize','Taglia attaccante',['Tiny','Small','Medium','Large','Huge','Gargantuan'].map((id)=>[id,id]))}{select('targetSize','Taglia bersaglio',['Tiny','Small','Medium','Large','Huge','Gargantuan'].map((id)=>[id,id]))}{field('distance','Distanza in piedi')}{field('reach','Portata in piedi')}{field('freeHands','Mani libere')}{check('incapacitated','Bersaglio incapacitato')}</>}
            {tool==='points' && <>{field('casterLevel','Livello effettivo da incantatore deciso dal DM')}{field('availablePoints','Punti disponibili')}{field('slot','Livello slot da creare')}<label className="player-field"><span>Slot superiori già creati dal riposo lungo (livelli separati da virgole)</span><input value={values.highSlots ?? ''} onChange={(event)=>change('highSlots',event.target.value)}/></label></>}
            {tool==='smite' && <>{field('paladinLevel','Livello da paladino')}{field('slot','Livello dello slot')}{select('targetType','Tipo bersaglio',[['undead','Non morto'],['fiend','Immondo'],['other','Altro']])}</>}
            {tool==='breath' && <>{field('characterLevel','Livello totale')}{field('constitution','Costituzione')}{select('ancestry','Ascendenza draconica',['black','blue','brass','bronze','copper','gold','green','red','silver','white'].map((id)=>[id,id]))}</>}
            <button type="button" onClick={()=>run(()=>{
                if (tool==='trinket') return rules.trinketTableEntry(verified,number('roll'))
                if (tool==='madness') return rules.madnessTableEntry(verified,values.madnessKind as 'short'|'long'|'indefinite',number('roll'),optional)
                if (tool==='wildMagic') return rules.wildMagicTableEntry(verified,number('roll'))
                if (tool==='treasure') return rules.treasureTableEntry(verified,values.treasure,number('roll'),optional)
                if (tool==='chase') return rules.chaseDashPlan(verified,{...optional,constitutionScore:number('constitution'),previousDashUses:number('dashUses')})
                if (tool==='object') return rules.objectDamagePlan(verified,{edition:'2014',currentHP:number('currentHP'),resolvedDamage:number('damage'),damageType:values.damageType,damageThreshold:number('threshold'),canDamageObject:flag('canDamageObject')})
                if (tool==='grapple'||tool==='shove') return rules.combatContestPlan(verified,tool,{edition:'2014',hasAttackAction:flag('hasAttackAction'),attackerSize:values.attackerSize,targetSize:values.targetSize,distanceFt:number('distance'),reachFt:number('reach'),freeHands:number('freeHands'),targetIncapacitated:flag('incapacitated')})
                if (tool==='points') return rules.spellPointSlotPlan(verified,{...optional,effectiveCasterLevel:number('casterLevel'),availablePoints:number('availablePoints'),slotLevel:number('slot'),highSlotsCreatedSinceLongRest:listIds(values.highSlots ?? '').map(Number)})
                if (tool==='smite') return rules.paladinSmiteDamage(verified,{paladin:number('paladinLevel')},number('slot'),values.targetType)
                return rules.draconicBreath(verified,{fighter:number('characterLevel')},values.ancestry,number('constitution'))
            })}>Verifica operazione</button>
        </details>
        <details><summary>Consulta tutte le regole e le fonti</summary><div className="player-grid"><label className="player-field"><span>Cerca nel riferimento 2014</span><input type="search" value={query} onChange={(event)=>{setQuery(event.target.value);setCount(60)}}/></label><label className="player-field"><span>Categoria</span><select value={kind} onChange={(event)=>{setKind(event.target.value);setCount(60)}}><option value="">Tutte</option>{[...new Set(verified.reviewedEntities.map((e)=>e.kind))].sort().map((k)=><option key={k} value={k}>{names[k] ?? k}</option>)}</select></label></div>
            <p>{filtered.length} risultati.</p><ul>{filtered.slice(0,count).map((entity)=><li key={entity.id}>{ruleName(entity)} · {entity.verification.complete ? 'Verificata' : 'Parziale, DM'}{entity.optional ? ' · opzionale' : ''} {source(entity)}</li>)}</ul>{filtered.length>count && <button type="button" onClick={()=>setCount(count+60)}>Mostra altre 60 voci</button>}
        </details>
        {is2014 && !stateError && <details><summary>Privilegi attuali e loro fonti</summary><ul>{availableRuleFeatures(sheet,verified).map((entity)=><li key={entity.id}>{ruleName(entity)} {source(entity)}</li>)}</ul>{Object.keys(levels).map((cls)=>{const entity=referenceFor(verified,'classes',cls);return entity ? <div key={cls}>{ruleName(entity)} {source(entity)}</div> : null})}</details>}
    </>}</details>
}
