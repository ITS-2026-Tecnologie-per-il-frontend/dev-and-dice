import { advancementCreationReview, newTutorial, rangerCreationReview, standardScores, tutorialIssues } from './CharacterTutorial.ts'
import type { CharacterSheet } from './CharacterSheets.ts'
import { abilityKeys, applyCreation, creationChoices, labelOf, optionsFor, selectedOrigins, spellRules, spellSelection, spellSelectionBlock, subclassMinimumLevel, subclassOptions, type Choice, type CreationData, type Option, type Origin } from './PlayerCreation.ts'
import { savedSpellGrants, spellRowState, type SpellSource } from './Spellcasting.ts'
import { wizardRules } from './Wizard.ts'
import { inventoryEquipment, ownedInventoryItems, setInventoryReference } from './Inventory.ts'

// Suggested adult appearances for the SRD origins; these are editable narrative choices.
const appearanceRanges: Record<string, readonly [number, number, number, number, number, number]> = {
    dragonborn: [18, 70, 175, 215, 90, 145], dwarf: [50, 250, 120, 150, 55, 95],
    elf: [100, 500, 150, 195, 45, 80], gnome: [40, 250, 90, 120, 16, 28],
    'half-elf': [20, 140, 150, 195, 45, 95], 'half-orc': [18, 60, 170, 215, 70, 125],
    halfling: [20, 100, 80, 110, 16, 27], human: [18, 70, 150, 195, 50, 105],
    tiefling: [18, 85, 150, 195, 50, 100],
}

/** Generates the same validated choices for a review draft or a directly saved sheet. */
export function randomCharacter(data: CreationData, fixed: { characterClass?: string; race?: string; level?: number; skipReview?: boolean } = {}, random = Math.random) {
    const level=fixed.level ?? 1
    if (!Number.isInteger(level) || level<1 || level>20) throw new Error('Scegli un livello intero da 1 a 20.')
    function draw(length: number) {
        const value=random()
        if (!Number.isFinite(value) || value<0 || value>=1) throw new Error('Il generatore casuale deve restituire valori fra zero incluso e uno escluso.')
        return Math.floor(value*length)
    }
    function shuffle<T>(values: readonly T[]): T[] {
        const result=[...values]
        for (let i=result.length-1;i>0;i--) {const j=draw(i+1);[result[i],result[j]]=[result[j],result[i]]}
        return result
    }
    function pick<T>(values: readonly T[], label: string): T {
        if (!values.length) throw new Error(`${label}: nessuna opzione disponibile nel catalogo.`)
        return values[draw(values.length)]
    }
    function origin(options: Origin[], id: string | undefined, label: string) {
        const available=options.filter((x) => (!x.editions || x.editions.includes('2014')) && !['ua','archived-ua'].includes(x.status ?? ''))
        if (id) {
            const item=available.find((x) => x.index===id)
            if (!item) throw new Error(`${label}: la scelta non è disponibile con le regole 2014.`)
            return item
        }
        return pick(available,label)
    }
    const characterClass=origin(data.classes,fixed.characterClass,'Classe'),race=origin(data.races,fixed.race,'Razza'),background=origin(data.backgrounds,undefined,'Background')
    const name=pick(['Ar','Bel','Cor','El','Fen','Lir','Nor','Tal'],'Nome')+pick(['a','en','in','is','on','ra','riel','yn'],'Nome')
    const scores=shuffle(standardScores)
    let sheet: CharacterSheet={...newTutorial(),name,level:String(level),characterClass:labelOf(characterClass),race:labelOf(race)}
    const experience=data.experienceThresholds?.levels.find((x) => x.level===level)?.minimumXP
    let d: Record<string,string>={...sheet.playerDetails,'rules.edition':'2014','creation.class':characterClass.index,'creation.race':race.index,'creation.background':background.index,'tutorial.random':'true','tutorial.step':level>1 ? '1' : '8','experience':experience!==undefined ? String(experience) : level===1 ? '0' : '',...Object.fromEntries(abilityKeys.map((key,i) => [`creation.base.${key}`,String(scores[i])]))}
    sheet={...sheet,playerDetails:d}
    const subraces=data.subraces.filter((x) => x.race?.index===race.index)
    if (subraces.length) d['creation.subrace']=pick(subraces,'Sottorazza').index
    const subclasses=subclassOptions(sheet,data).filter((x) => !['ua','archived-ua'].includes(x.status ?? '') && subclassMinimumLevel(sheet,x,data)<=level)
    if (subclasses.length) d['creation.subclass']=pick(subclasses,'Sottoclasse').index
    const origins=selectedOrigins(sheet,data)
    const traits=[...(race.traits ?? []),...(origins.subrace?.racial_traits ?? [])].flatMap((x) => data.traits.find((trait) => trait.index===x.index) ?? [])
    const trained=new Set([characterClass,race,origins.subrace,background,...traits].flatMap((x) => [...(x?.starting_proficiencies ?? []),...(x?.proficiencies ?? [])]).map((x) => x.index))
    const languages=new Set((race.languages ?? []).map((x) => x.index)),expertise=new Set<string>(),features=new Set<string>()
    function fill(choice: Choice,path: string, inherited=choice.type) {
        const type=inherited==='expertise' ? inherited : choice.type
        const used=new Set<number>()
        // ponytail: greedy choices suffice for the current SRD catalog;
        // overlapping mandatory choices in future catalogs need backtracking, not random retries.
        for (let slot=0;slot<choice.choose;slot++) {
            const options=optionsFor(choice,data)
            const candidates=shuffle(options.map((option,index) => ({option,index}))).filter(({option,index}) => {
                if (type!=='equipment' && used.has(index)) return false
                const ref=option.item ?? option.of ?? option.ability_score
                if (!ref) return !!option.choice || !!option.items?.length
                if (type==='languages') return !languages.has(ref.index)
                if (type==='expertise') return trained.has(ref.index) && !expertise.has(ref.index)
                if (['proficiencies','proficiency'].includes(type)) return !ref.index.startsWith('skill-') || !trained.has(ref.index)
                if (type==='feature') return !features.has(ref.index)
                return true
            })
            const selected=candidates[0]
            if (!selected) throw new Error(`Impossibile completare ${choice.desc ?? path} con scelte compatibili. Completa questa combinazione nel tutorial.`)
            used.add(selected.index)
            const key=`${path}.${slot}`;d[key]=String(selected.index)
            function nested(option: Option,root: string) {
                if (option.choice) fill(option.choice,`${root}.nested`,type==='expertise' ? type : option.choice.type)
                option.items?.forEach((item,i) => nested(item,`${root}.item.${i}`))
                const ref=option.item ?? option.of ?? option.ability_score
                if (ref) {
                    if (type==='languages') languages.add(ref.index)
                    if (type==='expertise') expertise.add(ref.index)
                    if (['proficiencies','proficiency'].includes(type)) trained.add(ref.index)
                    if (type==='feature') features.add(ref.index)
                }
            }
            nested(selected.option,`${key}.option.${selected.index}`)
        }
    }
    const choices=creationChoices(sheet,data)
    for (const {choice,path} of [...choices.filter((x) => x.choice.type!=='expertise'),...choices.filter((x) => x.choice.type==='expertise')]) fill(choice,path)
    sheet=applyCreation({...sheet,playerDetails:d},data)
    d={...sheet.playerDetails}
    const rules=spellRules(sheet,data),selected=spellSelection(sheet,data),grants=new Set([...savedSpellGrants(sheet).map((x) => x.index),...Object.entries(d).filter(([key]) => /^spell\.\d+\.\d+\.index$/.test(key)).map(([,value]) => value)])
    const wizard=wizardRules(sheet)
    function addSpells(pool: CreationData['spells'], count: number, source: SpellSource='class') {
        const spells=shuffle(pool.filter((x) => !grants.has(x.index)))
        for (let i=0;i<count;i++) {
            const selection=spellSelection({...sheet,playerDetails:d},data)
            const spell=spells.find((x) => !grants.has(x.index) && !spellSelectionBlock(selection,{level:x.level,source,spell:x}))
            if (!spell) throw new Error(`Il catalogo non contiene abbastanza incantesimi compatibili per ${labelOf(characterClass)} al livello ${level}.`)
            let row=0
            while (d[`spell.${spell.level}.${row}.name`]?.trim()) row++
            const root=`spell.${spell.level}.${row}`
            Object.assign(d,{[`${root}.name`]:labelOf(spell),[`${root}.index`]:spell.index,[`${root}.source`]:source,[`${root}.learned`]:'level',[`${root}.prepared`]:'false'})
            grants.add(spell.index)
        }
    }
    addSpells(rules.spells.filter((x) => x.level===0),rules.cantrips-selected.cantrips)
    const secrets=selected.limits.find((x) => x.id==='secrets')?.maximum ?? 0
    const ordinary=characterClass.index==='wizard' ? rules.known ?? 0 : rules.prepared ? rules.preparedLimit : (rules.known ?? 0)-secrets
    const alreadyLearned=characterClass.index==='wizard' ? selected.limits.find((x) => x.id==='wizard-book')?.roots.length ?? 0 : selected.spells
    let reserved=0
    if (wizard.mastery) for (const spellLevel of [1,2]) {addSpells(rules.spells.filter((x) => x.level===spellLevel),1);reserved++}
    if (wizard.signature) {addSpells(rules.spells.filter((x) => x.level===3),2);reserved+=2}
    addSpells(rules.spells.filter((x) => x.level>0),ordinary-alreadyLearned-reserved)
    // Special acquisitions use the limits at their acquisition level, not the final slots.
    if (characterClass.index==='bard') for (let gained=1;gained<=level;gained++) {
        const atLevel={...sheet,level:String(gained),playerDetails:d},limits=spellSelection(atLevel,data).limits,maxLevel=spellRules(atLevel,data).maxLevel
        for (const source of ['secrets','lore'] as const) {
            const limit=limits.find((x) => x.id===source)
            addSpells(data.spells.filter((x) => x.level<=maxLevel),(limit?.maximum ?? 0)-(limit?.roots.length ?? 0),source)
        }
    }
    for (const spellLevel of rules.arcanumLevels) addSpells(data.spells.filter((x) => x.level===spellLevel && x.classes.some((x) => x.index===characterClass.index)),1,'arcanum')
    const book=Object.entries(d).filter(([key,value]) => /^spell\.[1-9]\.\d+\.index$/.test(key) && value).map(([key]) => ({root:key.slice(0,-6),level:Number(key.split('.')[1])})).filter((x) => spellRowState({...sheet,playerDetails:d},x.level,Number(x.root.split('.')[2])).source==='class')
    if (wizard.mastery) for (const spellLevel of [1,2]) {
        const options=book.filter((x) => x.level===spellLevel)
        if (options.length) d[`wizard.mastery.${spellLevel}`]=pick(options,'Spell Mastery').root
    }
    if (wizard.signature) shuffle(book.filter((x) => x.level===3)).slice(0,2).forEach((x,i) => {d[`wizard.signature.${i}`]=x.root})
    const prepared=shuffle(book.filter((x) => spellRowState({...sheet,playerDetails:d},x.level,Number(x.root.split('.')[2])).needsPreparation && !spellRowState({...sheet,playerDetails:d},x.level,Number(x.root.split('.')[2])).alwaysPrepared))
    const mastery=new Set([d['wizard.mastery.1'],d['wizard.mastery.2']])
    prepared.sort((a,b) => Number(mastery.has(b.root))-Number(mastery.has(a.root)))
    prepared.slice(0,rules.preparedLimit).forEach((x) => {d[`${x.root}.prepared`]='true'})
    if (data.alignments.length) d.alignment=labelOf(pick(data.alignments,'Allineamento'))
    for (const [field,values] of Object.entries({
        'Tratti caratteriali':['Cerco una soluzione pacifica prima di ricorrere alla forza.','Sono curioso e faccio domande anche nei momenti meno opportuni.','Mantengo la calma e ascolto prima di decidere.'],
        Ideali:['Libertà: ognuno deve poter scegliere il proprio destino.','Conoscenza: ogni viaggio è una possibilità di imparare.','Lealtà: non abbandono chi si affida a me.'],
        Legami:['Devo ritrovare una persona scomparsa.','Voglio proteggere il luogo in cui sono cresciuto.','Conservo un ricordo di chi mi ha insegnato il mestiere.'],
        Difetti:['Fatico ad ammettere quando mi sbaglio.','La curiosità mi porta a sottovalutare i pericoli.','Mi fido troppo delle promesse.'],
    })) d[`personality.${field}`]=pick(values,field)
    d.backgroundStory=`Dopo un periodo come ${labelOf(background)}, ${name} ha scelto di partire all’avventura. ${d['personality.Legami']}`
    const [minAge,maxAge,minHeight,maxHeight,minWeight,maxWeight]=appearanceRanges[race.index] ?? (race.size==='Small' ? appearanceRanges.gnome : appearanceRanges.human)
    d['appearance.Età']=String(minAge+draw(maxAge-minAge+1))
    d['appearance.Altezza']=`${minHeight+draw(maxHeight-minHeight+1)} cm`
    d['appearance.Peso']=`${minWeight+draw(maxWeight-minWeight+1)} kg`
    d['appearance.Occhi']=pick(['Castani','Verdi','Azzurri','Grigi','Neri','Ambrati'],'Occhi')
    d['appearance.Capelli']=race.index==='dragonborn' ? 'Senza capelli' : pick(['Neri, corti','Castani, ondulati','Biondi, lunghi','Rossi, ricci','Grigi, raccolti','Bianchi, intrecciati'],'Capelli')
    d['appearance.Carnagione']=pick(race.index==='dragonborn' ? ['Scaglie bronzee','Scaglie ramate','Scaglie dorate','Scaglie argentate'] : race.index==='tiefling' ? ['Chiara','Bruna','Ramata','Rosso scuro','Violacea'] : ['Chiara','Olivastra','Bruna','Scura','Ramata'],'Carnagione')
    d.scars=pick(['Nessuna','Sopracciglio','Dorso della mano'],'Cicatrici')
    d.distinctiveMarks=pick(race.index==='dragonborn' ? ['Corna ricurve','Una cresta pronunciata','Scaglie chiare intorno agli occhi'] : race.index==='tiefling' ? ['Corna ricurve','Corna asimmetriche','Una coda con la punta chiara'] : ['Lentiggini sul viso','Un piccolo tatuaggio sul polso','Un neo sulla guancia'],'Segni di riconoscimento')
    d.appearanceDescription=`Altezza ${d['appearance.Altezza']}, peso ${d['appearance.Peso']}. Carnagione: ${d['appearance.Carnagione']}. Occhi: ${d['appearance.Occhi']}. Capelli: ${d['appearance.Capelli']}. Cicatrici: ${d.scars}. ${d.distinctiveMarks}.`
    if (characterClass.index==='ranger') {
        d['tutorial.randomReview']=rangerCreationReview
        if (level===1) d['tutorial.step']='4'
    }
    if (level>1) d['tutorial.advancementNotes']=`Bozza casuale di livello ${level}. PF calcolati con i valori fissi. Verifica gli aumenti di caratteristica/talenti ai livelli ${(characterClass.abilityScoreImprovementLevels ?? []).filter((x) => x<=level).join(', ') || 'non ancora previsti'}, i privilegi non strutturati e l’equipaggiamento aggiuntivo concordato per iniziare a questo livello.`
    d['tutorial.notice']='Personaggio generato casualmente: puoi modificare ogni scelta nei passaggi del tutorial prima di salvarlo. Le caratteristiche usano l’array standard assegnato casualmente.'
    sheet=applyCreation({...sheet,playerDetails:d},data)
    const owned=ownedInventoryItems(sheet),armor=owned.filter((x) => {
        const item=inventoryEquipment(x,sheet,data),category=({Light:'Leggere',Medium:'Medie',Heavy:'Pesanti'} as Record<string,string>)[item?.armor_category ?? '']
        return !!category && sheet.playerDetails?.[`proficiency.${category}`]==='true'
    })
    if (armor.length) sheet=setInventoryReference(sheet,'armor',pick(armor,'Armatura').id)
    const shield=owned.filter((x) => inventoryEquipment(x,sheet,data)?.armor_category==='Shield')
    if (shield.length && sheet.playerDetails?.['proficiency.Scudi']==='true') sheet=setInventoryReference(sheet,'shield',pick(shield,'Scudo').id)
    sheet=applyCreation(sheet,data)
    sheet={...sheet,hitPoints:sheet.playerDetails?.maxHitPoints ?? ''}
    const issues=tutorialIssues(sheet,data,8).filter((issue) => issue!==sheet.playerDetails?.['tutorial.randomReview'] && issue!==advancementCreationReview)
    if (issues.length) throw new Error(`Generazione incompleta: ${issues.join(' ')}`)
    return fixed.skipReview ? { ...sheet, playerDetails: { ...sheet.playerDetails, 'tutorial.active': 'false', 'tutorial.completed': 'true' } } : sheet
}
