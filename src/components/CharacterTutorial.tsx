import { InventoryEditor } from './InventoryEditor'
import { appearanceFields } from '../utils/CharacterAppearance'
import { useEffect, useId, useMemo, useRef, type ReactNode } from 'react'
import { characterFields, type CharacterSheet } from '../utils/CharacterSheets'
import { abilityKeys, characterFieldValue, labelOf, selectedOrigins, spellRules, spellSelection, spellSelectionBlock, subclassOptions, subclassMinimumLevel, updateCharacterField, type CreationData, type Origin } from '../utils/PlayerCreation'
import { spellEdition, spellRowState } from '../utils/Spellcasting'
import { changeTutorialOrigin, pointCost, rollScores, rolledTotal, standardScores, standardLanguageIds, tutorialChoices, tutorialStep, tutorialSteps } from '../utils/CharacterTutorial'
import { CreationChoices } from './PlayerCreation'
import { WizardSubclassFeatures } from './WizardSubclassFeatures'
import { WizardSpellcasting } from './WizardSpellcasting'
import { tutorialFieldFeedback, tutorialIssueFields, tutorialReview } from '../utils/TutorialReview'
import { TutorialFieldErrors, TutorialFieldLabel, TutorialPanel } from './TutorialLayout'
import '../CharacterTutorial.css'

const classHints: Record<string,string> = {
 barbarian: 'Combatti da vicino e resisti ai colpi grazie all’Ira. Forza e Costituzione sono importanti.',
 bard: 'Musica, parole e magia aiutano il gruppo. Carisma sostiene gli incantesimi e molte interazioni.',
 cleric: 'La magia divina ti permette di proteggere, curare o combattere. La tua caratteristica da incantatore è Saggezza.',
 druid: 'Usi la magia della natura e, ai livelli previsti, ti trasformi in animali. Dai attenzione a Saggezza.',
 fighter: 'Sei esperto di armi e combattimento. Scegli Forza per molte armi da mischia o Destrezza per distanza e armi accurate.',
 monk: 'Combatti con agilità e disciplina, anche senza armatura. Destrezza e Saggezza sostengono molte capacità.',
 paladin: 'Unisci armi, protezione e magia. Forza e Carisma sono spesso utili; Costituzione sostiene la resistenza.',
 ranger: 'Esplori, segui tracce e combatti con armi e magia. Destrezza e Saggezza sono spesso importanti.',
 rogue: 'Furtività, abilità e attacchi precisi sono il tuo punto di forza. Destrezza è spesso la scelta principale.',
 sorcerer: 'La magia è parte di te e puoi modificarla con la Metamagia ai livelli previsti. Usi Carisma.',
 warlock: 'Un patto ti dà magia e capacità particolari. Usi Carisma; gli slot del patto hanno un recupero diverso.',
 wizard: 'Studi la magia e costruisci un libro di incantesimi. Intelligenza sostiene le tue magie; conosciuti nel libro e preparati sono due conteggi diversi.',
}
const abilityHints = ['Potenza fisica, Atletica e molte armi da mischia.', 'Agilità, iniziativa, furtività e molte armi a distanza.', 'Resistenza e punti ferita; aiuta a mantenere la concentrazione.', 'Studio, memoria e magia del mago.', 'Percezione, intuito e magia di chierico e druido.', 'Presenza, persuasione e magia di bardo, stregone e warlock.']
const guideUrl = 'https://dungeonsanddragons.fandom.com/it/wiki/Guida_alla_Creazione_del_Personaggio'
const official2014 = 'https://www.dndbeyond.com/sources/dnd/basic-rules-2014/step-by-step-characters'
const official2024 = 'https://www.dndbeyond.com/sources/dnd/br-2024/creating-a-character'

export function CharacterTutorial({ sheet, data, onChange, children }: { sheet: CharacterSheet; data: CreationData; onChange: (sheet: CharacterSheet) => void; children?: ReactNode }) {
    const d = sheet.playerDetails ?? {}, step = tutorialStep(sheet), edition = spellEdition(sheet)
    const origins = useMemo(()=>selectedOrigins(sheet,data),[sheet,data])
    const magic = useMemo(()=>step===6 ? spellRules(sheet,data) : undefined,[sheet,data,step])
    const selected = useMemo(()=>step===6 ? spellSelection(sheet,data) : undefined,[sheet,data,step])
    const review=useMemo(()=>tutorialReview(sheet,data),[sheet,data])
    const issues=review[step],feedback=useMemo(()=>tutorialFieldFeedback(issues,sheet,data,step),[issues,sheet,data,step])
    const heading = useRef<HTMLHeadingElement>(null), scope=useRef<HTMLElement>(null), navigation=useRef<HTMLElement>(null), prefix=useId()
    useEffect(() => {
        navigation.current?.querySelector('[aria-current="step"]')?.scrollIntoView({block:'nearest',inline:'center'})
        heading.current?.focus({preventScroll:true})
        heading.current?.scrollIntoView({block:'nearest'})
    }, [step])
    function goToStep(next: number) { detail('tutorial.step',String(next)) }
    function focusIssue(issue: string) {
        if (step===8) {
            const targetStep=review.slice(0,8).findIndex((list)=>list.includes(issue))
            if (targetStep>=0) { goToStep(targetStep);return }
        }
        const keys=tutorialIssueFields(issue,sheet,data,step)
        const target=Array.from(scope.current?.querySelectorAll<HTMLElement>('[data-tutorial-field]') ?? []).find((element)=>keys.includes(element.dataset.tutorialField ?? ''))
        if (target) { target.focus();target.scrollIntoView({block:'nearest'}) } else heading.current?.focus()
    }
    function control(key: string) {
        return {name:key,autoComplete:'off', 'data-tutorial-field':key,'aria-invalid':feedback[key]?.length ? true : undefined,'aria-describedby':feedback[key]?.length ? `${prefix}-${key}-error` : undefined}
    }
    function errors(key: string) { return <TutorialFieldErrors id={`${prefix}-${key}-error`} errors={feedback[key]} /> }
    function detail(key: string, value: string) { onChange(updateCharacterField(sheet,key,value)) }
    function many(values: Record<string,string>) { onChange({ ...sheet, playerDetails: { ...d, ...values } }) }
    function field(key: string, label: string, multiline = false, base = false) {
        const value = base ? sheet[key as keyof typeof characterFields] : characterFieldValue(sheet,key)
        return <label className="player-field"><TutorialFieldLabel label={label} />{multiline ? <textarea {...control(key)} aria-required={/obbligatori[oa]/.test(label) || undefined} rows={3} value={value} onChange={(e) => detail(key,e.target.value)} /> : <input {...control(key)} aria-required={/obbligatori[oa]/.test(label) || undefined} value={value} onChange={(e) => detail(key,e.target.value)} />}{errors(key)}</label>
    }
    function check(key: string, label: string, blocked = '') {
        return <div className="tutorial-check"><label className="player-check"><input {...control(key)} type="checkbox" title={blocked || undefined} disabled={d[key] !== 'true' && !!blocked} checked={d[key] === 'true'} onChange={(e) => { if (!e.target.checked || !blocked) detail(key,String(e.target.checked)) }} /><span>{label}</span></label>{errors(key)}</div>
    }
    function origin(kind: 'class'|'race'|'subrace'|'subclass'|'background', label: string, options: Origin[]) {
        const key=`creation.${kind}`
        return <label className="player-field"><TutorialFieldLabel label={label} /><select {...control(key)} aria-required={/obbligatori[oa]/.test(label) || undefined} value={d[key] ?? ''} onChange={(e) => onChange(changeTutorialOrigin(sheet,data,kind,e.target.value))}>
            <option value="">Scegli…</option>{options.map((x) => <option key={x.index} value={x.index}>{labelOf(x)}{x.status === 'ua' || x.status === 'archived-ua' ? ' · Playtest UA, richiede il consenso del DM' : ''}</option>)}
        </select>{errors(key)}</label>
    }
    function preview(label: string, children: ReactNode) { return <section className="tutorial-preview"><h4>{label}</h4>{children}</section> }
    function summary(title: string, target: number, entries: [string,string | undefined][]) {
        return <section className="tutorial-summary-section"><div className="tutorial-summary-heading"><h4>{title}</h4><button type="button" aria-label={`Modifica ${title.toLowerCase()}`} onClick={()=>goToStep(target)}>Modifica</button></div><dl className="tutorial-summary">{entries.map(([name,value])=><div key={name}><dt>{name}</dt><dd>{value?.trim() || 'Non indicato'}</dd></div>)}</dl>{review[target].length>0 && <p className="tutorial-summary-pending">{review[target].length} verifiche da completare in questo passaggio</p>}</section>
    }
    const rows = useMemo(()=>Object.entries(sheet.playerDetails ?? {}).filter(([k,v]) => /^spell\.\d+\.\d+\.name$/.test(k) && v.trim()).map(([key,name]) => {
        const level=Number(key.split('.')[1]),index=Number(key.split('.')[2])
        return {root:key.slice(0,-5),name,level,index,state:step===6 ? spellRowState(sheet,level,index) : undefined}
    }),[sheet,step])
    const selectedRow = (spell: CreationData['spells'][number]) => rows.find((r) => r.level === spell.level && r.state?.source === 'class' && (d[`${r.root}.index`] === spell.index || [spell.name,spell.nameIt,...(spell.aliases ?? [])].some((name) => name?.toLowerCase() === r.name.trim().toLowerCase())))
    const acquisition = d['tutorial.spellAcquisition'] === 'savant' && selected?.limits.some((x) => x.id === 'wizard-savant' && x.maximum > 0) ? 'savant' : 'level'
    const unavailable = magic ? rows.filter((r) => r.state?.source === 'class' && !magic.spells.some((s) => s.index === d[`${r.root}.index`] || [s.name,s.nameIt,...(s.aliases ?? [])].some((n) => n?.toLowerCase() === r.name.toLowerCase()))) : []
    function removeSpell(root: string) {
        const next = { ...d }
        for (const key of Object.keys(next).filter((k) => k.startsWith(root + '.'))) delete next[key]
        for (const key of ['wizard.mastery.1','wizard.mastery.2','wizard.signature.0','wizard.signature.1']) if (next[key] === root) next[key] = ''
        onChange({ ...sheet, playerDetails:next })
    }
    function toggleSpell(spell: CreationData['spells'][number]) {
        if (!selected) return
        const existing = selectedRow(spell)
        if (existing) { removeSpell(existing.root); return }
        const blocked = spellSelectionBlock(selected,{level:spell.level,learned:spell.level > 0 ? acquisition : 'level',spell})
        if (blocked) return
        const next = { ...d }
        let index = 0
        while (next[`spell.${spell.level}.${index}.name`]?.trim()) index++
        if (index >= 500) return
        const root = `spell.${spell.level}.${index}`
        Object.assign(next,{ [`${root}.name`]:labelOf(spell), [`${root}.index`]:spell.index, [`${root}.source`]:'class', [`${root}.learned`]:spell.level > 0 ? acquisition : 'level', [`${root}.prepared`]:'false' })
        onChange({ ...sheet, playerDetails:next })
    }
    return <section ref={scope} className="character-tutorial" aria-label="Tutorial di creazione del personaggio">
        <a className="tutorial-skip" href={`#${prefix}-step`} onClick={(event)=>{event.preventDefault();heading.current?.focus()}}>Vai ai campi del passaggio</a>
        <header className="tutorial-header">
            <div><p className="tutorial-character-name">{sheet.name || 'Il tuo prossimo personaggio'}</p><p className="tutorial-character-context">{[sheet.characterClass,sheet.race,d['rules.edition'] ? `D&D 5e ${edition}` : 'Scegli l’edizione della campagna'].filter(Boolean).join(' · ')}</p></div>
            <div className="tutorial-progress"><span id={`${prefix}-progress`}>Passaggio <strong>{step+1}</strong> di {tutorialSteps.length}</span><progress aria-labelledby={`${prefix}-progress`} max={tutorialSteps.length} value={step+1} /></div>
        </header>
        <div className="tutorial-layout">
        <nav ref={navigation} className="tutorial-navigation" aria-label="Passaggi della creazione"><ol>{tutorialSteps.map((title,i) => {
            const pending=review[i].length,status=i===7 ? 'Facoltativo' : pending ? `${pending} da completare` : i>2 && !origins.characterClass ? 'Da definire' : 'Pronto'
            return <li key={title}><button type="button" aria-current={step === i ? 'step' : undefined} onClick={() => goToStep(i)}><span className="tutorial-step-number" aria-hidden="true">{i+1}</span><span><span className="tutorial-step-title">{title}</span><small>{step===i ? 'In corso' : status}</small></span>{!pending && i<step && <span className="tutorial-step-check" aria-label="Nessuna verifica pendente">✓</span>}</button></li>
        })}</ol></nav>
        <div className="tutorial-step-content">
        <div className="tutorial-step-heading"><h3 id={`${prefix}-step`} tabIndex={-1} ref={heading}>{tutorialSteps[step]}</h3><span className={`tutorial-step-state${issues.length ? ' is-pending' : ''}`}>{issues.length ? `${issues.length} ${issues.length===1 ? 'verifica da completare' : 'verifiche da completare'}` : step===7 ? 'Racconta chi sei' : 'Pronto per proseguire'}</span></div>
        {d['tutorial.notice'] && <p role="status" className="player-hint">{d['tutorial.notice']} <button type="button" onClick={() => detail('tutorial.notice','')}>Ho capito</button></p>}
        {step === 4 && d['tutorial.randomReview'] && <section className="tutorial-preview"><h4>Scelte da completare</h4><p>{d['tutorial.randomReview']}</p>{field('additionalTraits','Tratti aggiuntivi · obbligatorio per questa revisione',true)}{check('tutorial.randomReviewConfirmed','Ho verificato queste scelte con il DM e annotato le eventuali competenze e lingue nella scheda.')}</section>}
        {step === 0 && <>
            <p>Prima immagina chi vorresti interpretare e chiedi al Dungeon Master (DM), chi conduce la partita, quali regole e opzioni usa la campagna. Puoi cambiare idea lungo il percorso.</p>
            <TutorialPanel title="Le regole della campagna"><label className="player-field"><TutorialFieldLabel label="Edizione delle regole · obbligatoria" /><select {...control('rules.edition')} aria-required="true" value={d['rules.edition'] ?? ''} onChange={(e) => onChange(changeTutorialOrigin(sheet,data,'edition',e.target.value))}><option value="">Scegli con il DM…</option><option value="2014">D&D 5e 2014</option><option value="2024">D&D 5e 2024 · anche opzioni storiche compatibili</option></select>{errors('rules.edition')}</label>
            <details className="tutorial-help"><summary>Quale edizione scegliere?</summary><p className="player-hint">La guida Fandom segue le regole 2014. Nel 2024 i bonus alle caratteristiche vengono dal background e la sottoclasse si sceglie dal livello 3. Questo catalogo comprende soprattutto opzioni storiche: il percorso distingue gli adattamenti e ti chiede di verificare con il DM ciò che manca.</p></details></TutorialPanel>
            <TutorialPanel title="Identità del personaggio"><div className="tutorial-grid">{field('name','Nome del personaggio · obbligatorio',false,true)}{field('playerName','Nome del giocatore · facoltativo')}</div>{field('tutorial.concept','La tua idea · facoltativa (esempio: una studiosa che cerca un libro perduto)',true)}</TutorialPanel>
        </>}
        {step === 1 && <>
            <p>La classe descrive come affronti le avventure: armi, magia, esplorazione e capacità speciali. Ogni classe può contribuire al gruppo; le caratteristiche suggerite non sono obblighi.</p>
            <TutorialPanel title="Scegli la classe">{origin('class','Classe · obbligatoria',data.classes)}
            {origins.characterClass && preview(labelOf(origins.characterClass),<><p>{classHints[origins.characterClass.index]}</p><p>Dado Vita: d{origins.characterClass.hit_die}. Competenze nei tiri salvezza: {origins.characterClass.savingThrowAbilities?.map((x) => characterFields[x]).join(', ')}.</p>{edition === '2014' && origins.characterClass.localizations?.it?.description && <details><summary>Leggi capacità e scelte della classe</summary><p className="tutorial-prose">{origins.characterClass.localizations.it.description}</p></details>}</>)}
            </TutorialPanel><TutorialPanel title="Livello e specializzazione"><label className="player-field"><TutorialFieldLabel label="Livello iniziale · obbligatorio" /><select {...control('level')} aria-required="true" value={sheet.level} onChange={(e) => onChange(changeTutorialOrigin(sheet,data,'level',e.target.value))}>{Array.from({length:20},(_,i) => <option key={i} value={i+1}>{i+1}</option>)}</select>{errors('level')}</label>
            <p>Di solito inizi al livello 1. La sottoclasse specializza il tuo ruolo e compare quando il tuo livello la sblocca. Al livello 1 i PF massimi partono dal massimo del Dado Vita, più il modificatore di Costituzione.</p>
            {(() => { const options = subclassOptions(sheet,data).filter((x) => Number(sheet.level) >= subclassMinimumLevel(sheet,x,data)); return options.length ? origin('subclass','Sottoclasse · obbligatoria al tuo livello',options) : <p className="player-hint">Nessuna scelta di sottoclasse richiesta a questo livello.</p> })()}
            {Number(sheet.level) > 1 && <>{field('tutorial.advancementNotes','Scelte e incrementi concordati con il DM · facoltativo',true)}{check('tutorial.advancement','Ho verificato avanzamenti, aumenti di caratteristica/talenti e PF dei livelli superiori. Qui i PF usano il valore fisso; potrò correggerli nella scheda.')}</>}
            </TutorialPanel>
        </>}
        {step === 2 && <>
            <p>{edition === '2014' ? 'La razza e l’eventuale sottorazza danno tratti, velocità, lingue e bonus alle caratteristiche.' : 'La specie dà i tratti. Per una specie storica compatibile si ignorano i vecchi bonus alle caratteristiche: li assegnerai dal background.'} Il background racconta cosa facevi prima di diventare avventuriero e aggiunge competenze ed equipaggiamento.</p>
            <TutorialPanel title="Origine del personaggio">{origin('race',edition === '2014' ? 'Razza · obbligatoria' : 'Specie storica compatibile · obbligatoria',data.races)}
            {origins.race && data.subraces.some((x) => x.race?.index === origins.race!.index) && origin('subrace','Sottorazza · obbligatoria',data.subraces.filter((x) => x.race?.index === origins.race!.index))}
            {origins.race && preview('Cosa ottieni dall’origine',<><p>Velocità: {sheet.speed || '—'} · taglia: {origins.race.size}. Lingue di origine: {origins.race.languages?.map(labelOf).join(', ')}.</p><p>Tratti: {[...(origins.race.traits ?? []),...(origins.subrace?.racial_traits ?? [])].map(labelOf).join(', ')}.</p>{edition === '2014' && <p>Bonus: {abilityKeys.filter((k) => Number(d[`creation.bonus.${k}`]) > 0).map((k) => `${characterFields[k]} +${d[`creation.bonus.${k}`]}`).join(', ') || 'nessun bonus fisso; completa le scelte previste'}</p>}{edition === '2014' && origins.race.localizations?.it?.description && <details><summary>Leggi i tratti di questa origine</summary><p className="tutorial-prose">{origins.race.localizations.it.description}</p></details>}</>)}
            </TutorialPanel><TutorialPanel title="Il tuo passato">{origin('background',edition === '2014' ? 'Background · obbligatorio' : 'Background storico compatibile · obbligatorio',data.backgrounds)}
            {origins.background && preview('Competenze del background',<><p>{origins.background.index === 'acolyte' && 'Un Accolito ha vissuto o lavorato presso un tempio: conosce le pratiche religiose e sa comprendere le intenzioni delle persone. Questo passato non impone la classe del chierico. ' }Competenze: {origins.background.starting_proficiencies?.map(labelOf).join(', ')}. Completerai le scelte di lingue e oggetti nei passaggi successivi.</p></>)}
            <p className="player-hint">Il catalogo offre attualmente {data.backgrounds.length} background. Le opzioni della tua campagna non presenti si possono annotare nella scheda dopo il tutorial con il DM.</p>
            </TutorialPanel>
        </>}
        {step === 3 && <>
            <p>Assegna i sei punteggi prima dei bonus di origine. Un punteggio 14 dà modificatore +2: questo bonus entra in molti tiri. Costituzione influisce sui PF; aumentarla ricalcola anche quelli dei livelli precedenti.</p>
            <TutorialPanel title="Punteggi di partenza"><label className="player-field"><TutorialFieldLabel label="Metodo concordato con il DM · obbligatorio" /><select {...control('tutorial.method')} aria-required="true" value={d['tutorial.method'] ?? 'standard'} onChange={(e) => detail('tutorial.method',e.target.value)}><option value="standard">Array standard: 15, 14, 13, 12, 10, 8</option><option value="points">Acquisto con 27 punti (con consenso del DM)</option><option value="rolls">4d6: scarta il dado più basso</option><option value="manual">Punteggi concordati con il DM</option></select>{errors('tutorial.method')}</label>
            {d['tutorial.method'] === 'rolls' && <><button type="button" onClick={() => { const rolls = rollScores(); many({'tutorial.rolls':JSON.stringify(rolls)}) }}>Tira sei gruppi di 4d6</button><p>{(() => { try { return (JSON.parse(d['tutorial.rolls'] ?? '[]') as number[][]).map((r) => `${r.join('+')} → ${rolledTotal(r)}`).join(' · ') } catch { return 'Tiri da effettuare.' } })()}</p><small>Assegna i sei risultati alle caratteristiche; i tiri rimangono salvati.</small></>}
            {d['tutorial.method'] === 'points' && <p>Punti spesi: {abilityKeys.reduce((n,k) => n + (pointCost(d[`creation.base.${k}`] ?? '') ?? 0),0)}/27. Da 8 a 13 ogni aumento costa un punto; 14 costa 7 e 15 costa 9.</p>}
            <div className="tutorial-grid tutorial-scores" data-tutorial-field="scores" tabIndex={-1} aria-describedby={feedback.scores?.length ? `${prefix}-scores-error` : undefined}>{abilityKeys.map((key,i) => <label className="player-field" key={key}><TutorialFieldLabel label={`${characterFields[key]} base · obbligatorio`} />{d['tutorial.method'] === 'standard' ? <select {...control(`creation.base.${key}`)} aria-required="true" aria-describedby={`${prefix}-score-${key}-hint${feedback.scores?.length ? ` ${prefix}-scores-error` : ''}`} aria-invalid={feedback.scores?.length ? true : undefined} value={d[`creation.base.${key}`] ?? ''} onChange={(e) => detail(`creation.base.${key}`,e.target.value)}><option value="">Assegna…</option>{standardScores.map((n) => <option key={n}>{n}</option>)}</select> : <input {...control(`creation.base.${key}`)} type="number" inputMode="numeric" aria-required="true" aria-describedby={`${prefix}-score-${key}-hint${feedback.scores?.length ? ` ${prefix}-scores-error` : ''}`} aria-invalid={feedback.scores?.length ? true : undefined} step="1" min={d['tutorial.method'] === 'points' ? 8 : 1} max={d['tutorial.method'] === 'points' ? 15 : 20} value={d[`creation.base.${key}`] ?? ''} onChange={(e) => detail(`creation.base.${key}`,e.target.value)} />}<span className="tutorial-score-total">Totale <strong>{sheet[key] || '—'}</strong><span>Modificatore {characterFieldValue(sheet,`modifier.${key}`) || '—'}</span></span><small id={`${prefix}-score-${key}-hint`}>{abilityHints[i]}</small></label>)}</div>{errors('scores')}</TutorialPanel>
            {edition === '2024' && <TutorialPanel title="Bonus del background"><div data-tutorial-field="background-bonuses" tabIndex={-1} aria-describedby={feedback['background-bonuses']?.length ? `${prefix}-background-bonuses-error` : undefined}><p>Per questo background storico scegli +2 e +1 su due caratteristiche diverse, oppure +1 su tre. Nessun punteggio può superare 20 grazie a questi bonus.</p><div className="tutorial-grid">{abilityKeys.map((key) => <label className="player-field" key={key}><span>Bonus background: {characterFields[key]}</span><select {...control(`creation.backgroundBonus.${key}`)} value={d[`creation.backgroundBonus.${key}`] ?? '0'} onChange={(e) => detail(`creation.backgroundBonus.${key}`,e.target.value)}>{[0,1,2].map((n) => <option key={n}>{n}</option>)}</select></label>)}</div>{errors('background-bonuses')}</div></TutorialPanel>}
            <CreationChoices sheet={sheet} data={data} change={detail} feedback={feedback} choices={tutorialChoices(sheet,data,3)} section="scores" />
        </>}
        {step === 4 && <>
            <p>Essere competente significa aggiungere il bonus di competenza ai tiri appropriati (+2 al livello 1). Non si somma due volte se due origini danno la stessa abilità. La Maestria, quando concessa, raddoppia quel bonus: non è una seconda competenza.</p>
            <TutorialPanel title="Scelte di competenza"><div data-tutorial-field="choices" tabIndex={-1} aria-describedby={feedback.choices?.length ? `${prefix}-choices-error` : undefined}><CreationChoices sheet={sheet} data={data} change={detail} feedback={feedback} choices={tutorialChoices(sheet,data,4)} section="choices" /><WizardSubclassFeatures sheet={sheet} data={data} onChange={onChange} />{errors('choices')}</div></TutorialPanel>
            <p>Competenze nelle abilità: {data.skills.filter((x) => d[x.playerDetailsKeys.proficient] === 'true').map(labelOf).join(', ') || 'completa le scelte'}.</p><p>Lingue: {d.languages || 'completa le scelte'}.</p>
            {edition === '2024' && <TutorialPanel title="Lingue e adattamenti delle regole 2024"><p>Nel 2024 conosci Comune e altre due lingue standard. Il catalogo non contiene ancora tutti i talenti di Origine e i privilegi 2024: annota il talento scelto con il DM e verifica classe, eventuali maestrie delle armi e magie delle versioni aggiornate.</p><div className="tutorial-grid">{[0,1].map((i) => <label key={i} className="player-field"><TutorialFieldLabel label={`Lingua standard ${i+1} · obbligatoria`} /><select {...control(`tutorial.language.${i}`)} aria-required="true" value={d[`tutorial.language.${i}`] ?? ''} onChange={(e) => detail(`tutorial.language.${i}`,e.target.value)}><option value="">Scegli…</option>{data.languages.filter((x) => standardLanguageIds.includes(x.index)).map((x) => <option key={x.index} value={x.index} disabled={d[`tutorial.language.${1-i}`] === x.index}>{labelOf(x)}</option>)}</select>{errors(`tutorial.language.${i}`)}</label>)}</div>{field('additionalTraits','Talento di Origine concordato con il DM · obbligatorio')}{field('tutorial.rulesNotes','Privilegi 2024 e applicazioni manuali concordate · facoltativo',true)}{check('tutorial.rules2024','Ho verificato con il DM l’adattamento di specie/background storici, il talento di Origine e i privilegi della classe 2024. Gli effetti non presenti nel catalogo saranno applicati manualmente nella scheda.')}</TutorialPanel>}
        </>}
        {step === 5 && <>
            <p>Classe e background forniscono oggetti fissi e alternative. Scegli le dotazioni, poi indica cosa indossi: portare un’armatura nello zaino non aumenta la CA. Senza armatura, di solito la CA è 10 + Destrezza; alcuni privilegi usano una formula diversa.</p>
            <TutorialPanel title="Dotazione iniziale"><CreationChoices sheet={sheet} data={data} change={detail} feedback={feedback} choices={tutorialChoices(sheet,data,5)} section="equipment" />
            {preview('Equipaggiamento iniziale',<p className="tutorial-prose">{d.equipment || 'Completa prima le scelte.'}</p>)}
            <p>CA attuale: {sheet.armorClass || '—'}. Gli attacchi con le armi iniziali vengono compilati usando caratteristica e competenza appropriate.</p>
            <p className="player-hint">Questo percorso usa le dotazioni del catalogo. L’alternativa di acquistare oggetti con oro iniziale si concorda con il DM e si compila nella scheda. Le dotazioni vengono registrate nell’inventario, compreso il contenuto dei pacchetti disponibile nel catalogo. I pesi mancanti e gli effetti speciali richiedono verifica.</p>
            </TutorialPanel>
        </>}
        {step === 5 && <InventoryEditor sheet={sheet} data={data} onChange={onChange} />}
        {step === 6 && magic && selected && <>
            <p>I trucchetti sono magie di livello 0 e non consumano slot. Gli slot limitano i lanci delle magie di livello superiore; conoscere una magia non significa averla preparata oggi.</p>
            <TutorialPanel title="Incantesimi di classe"><div data-tutorial-field="spells" tabIndex={-1} aria-describedby={feedback.spells?.length ? `${prefix}-spells-error` : undefined}>{errors('spells')}
            {!magic.maxLevel && !magic.cantrips ? <p>La tua classe non richiede incantesimi a questo livello. Eventuali magie dell’origine sono registrate separatamente.</p> : <><p>Magie di classe annotate: {selected.spells}. CD {d.spellDC || '—'} · attacco {d.spellAttackBonus || '—'}.</p>
                {d['creation.class'] === 'wizard' && <p>Il libro parte con sei incantesimi di livello 1 e cresce di due per livello. Metti nel libro le magie scelte, poi spunta quelle preparate. Le copie aggiuntive e le scelte avanzate hanno controlli dedicati qui sotto.</p>}
                <ul>{selected.limits.filter((x) => !x.minimumLevel && !x.exactLevel && (['cantrips','known','prepared','level'].includes(x.kind) || x.kind === 'savant' && (x.maximum > 0 || x.roots.length > 0))).map((limit) => <li key={limit.id}><strong>{limit.label}: {limit.roots.length}/{limit.maximum}</strong> · {limit.reason}</li>)}</ul>
                {selected.limits.some((x) => x.id === 'wizard-savant' && x.maximum > 0) && <label className="player-field"><span>Acquisizione delle nuove magie</span><select value={acquisition} onChange={(e) => detail('tutorial.spellAcquisition',e.target.value)}><option value="level">Scelta iniziale / avanzamento</option><option value="savant">Scelta gratuita · Evocation Savant</option></select></label>}
                {Array.from({length:magic.maxLevel+1},(_,level) => {
                    const quota = selected.limits.find((x) => x.id === `wizard-level-${level}`)
                    const blocked = spellSelectionBlock(selected,{level,learned:level > 0 ? acquisition : 'level'})
                    return <details key={level} open={level < 2}><summary>{level === 0 ? 'Trucchetti' : `Incantesimi di livello ${level}`}</summary>
                        {quota && <p className="player-hint">{quota.label}: {quota.roots.length}/{quota.maximum}. {quota.reason}</p>}
                        {blocked && <p className="player-hint" role="status">{blocked}</p>}
                        <div className="tutorial-spells">{magic.spells.filter((x) => x.level === level).map((spell) => {
                            const row = selectedRow(spell)
                            const learnBlock = row ? '' : spellSelectionBlock(selected,{level,learned:level > 0 ? acquisition : 'level',spell})
                            const state = row?.state
                            const prepareBlock = row ? spellSelectionBlock(selected,{level,root:row.root,prepare:true,alwaysPrepared:state?.alwaysPrepared}) : ''
                            return <div key={spell.index} className="tutorial-spell"><label className="player-check"><input type="checkbox" checked={!!row} disabled={!!learnBlock} title={learnBlock || undefined} onChange={() => toggleSpell(spell)} /><span>{labelOf(spell)}</span></label>
                                {row && level > 0 && magic.prepared && (state?.alwaysPrepared ? <small>Sempre preparato · fuori dal limite</small> : check(`${row.root}.prepared`,`Prepara ${labelOf(spell)}`,prepareBlock))}
                                {row && level > 0 && <small>Acquisizione: {d[`${row.root}.learned`] === 'copied' ? 'copia nel libro' : d[`${row.root}.learned`] === 'savant' ? 'Evocation Savant' : d[`${row.root}.learned`] === 'feature' ? 'privilegio' : 'iniziale / avanzamento'}</small>}
                                <details><summary>Come funziona</summary><p>{spell.desc[0]}</p></details></div>
                        })}</div></details>
                })}
                <WizardSpellcasting sheet={sheet} data={data} onChange={onChange} />
            </>}
            {unavailable.length > 0 && preview('Magie annotate da verificare',<><p>Queste selezioni sono conservate, ma non sono disponibili per la classe o il livello attuali. Puoi rimuoverle oppure tornare a correggere livello ed edizione.</p>{unavailable.map((r) => <label className="player-check" key={r.root}><input type="checkbox" checked onChange={() => removeSpell(r.root)} /><span>{r.name} · livello {r.level}</span></label>)}</>)}
            {d.racialSpells && preview('Magie dell’origine',<p>{d.racialSpells}</p>)}
            {edition === '2024' && <p className="player-hint">I limiti di classe seguono il 2024; molte descrizioni nel catalogo sono 2014. Controlla la versione della magia con il DM prima di usarla.</p>}
            </div></TutorialPanel>
        </>}
        {step === 7 && <>
            <p>Queste scelte sono facoltative e danno vita al personaggio. Un ideale è ciò in cui crede, un legame è qualcuno o qualcosa a cui tiene, un difetto crea occasioni di gioco. L’allineamento descrive una tendenza, senza imporre ogni decisione.</p>
            <TutorialPanel title="Aspetto del personaggio"><p className="player-hint">Questi dettagli sono facoltativi. Puoi lasciare i campi vuoti o modificare quelli generati casualmente.</p>
            <div className="tutorial-grid">{appearanceFields.map(({key,label}) => <div key={key}>{field(key,label+' · facoltativo')}</div>)}</div>
            {field('appearanceDescription','Aspetto · facoltativo',true)}<div className="tutorial-grid">{field('scars','Cicatrici · facoltativo')}{field('distinctiveMarks','Segni di riconoscimento · facoltativo')}</div></TutorialPanel>
            <TutorialPanel title="Personalità"><label className="player-field"><TutorialFieldLabel label="Allineamento · facoltativo" /><select {...control('alignment')} value={d.alignment ?? ''} onChange={(e) => detail('alignment',e.target.value)}><option value="">Da decidere</option>{data.alignments.map((x) => <option key={x.index}>{labelOf(x)}</option>)}</select></label><div className="tutorial-grid">{['Tratti caratteriali','Ideali','Legami','Difetti'].map((label) => <div key={label}>{field(`personality.${label}`,label+' · facoltativo',true)}</div>)}</div></TutorialPanel>
            <TutorialPanel title="Storia e legami con il gruppo">{field('backgroundStory','Storia e motivo per partire all’avventura · facoltativo',true)}{field('faction','Come conosci il gruppo e perché collaborate · facoltativo',true)}</TutorialPanel>
            <p>Parla con gli altri giocatori: chi conosci già? Che obiettivo condividete? Per esempio, potreste cercare una persona scomparsa per motivi diversi.</p>
        </>}
        {step === 8 && <>
            <p>Controlla le scelte e i valori derivati. Puoi tornare a qualsiasi passaggio; salvando otterrai una scheda utilizzabile anche nelle card del combattimento.</p>
            {summary('Identità e campagna',0,[['Nome',sheet.name],['Giocatore',d.playerName],['Edizione',d['rules.edition']],['Idea del personaggio',d['tutorial.concept']]])}
            {summary('Classe e livello',1,[['Classe',sheet.characterClass],['Livello',sheet.level],['Sottoclasse',origins.subclass && labelOf(origins.subclass)],['Avanzamenti concordati',d['tutorial.advancementNotes']]])}
            {summary('Origine e background',2,[['Origine',`${sheet.race} ${d.subrace ?? ''}`.trim()],['Background',d.background]])}
            {summary('Caratteristiche',3,abilityKeys.map((key)=>[characterFields[key],`${sheet[key] || '—'} · modificatore ${characterFieldValue(sheet,`modifier.${key}`) || '—'}`]))}
            {summary('Competenze e privilegi',4,[['Competenze nelle abilità',data.skills.filter((x)=>d[x.playerDetailsKeys.proficient]==='true').map(labelOf).join(', ')],['Lingue',d.languages],['Tratti aggiuntivi',d.additionalTraits]])}
            <details className="tutorial-help"><summary>Leggi tutti i privilegi di classe</summary><p className="tutorial-prose">{d.classFeatures || 'Privilegi da verificare e annotare con il DM, secondo l’edizione.'}</p></details>
            {summary('Equipaggiamento',5,[['Dotazione',d.equipment],['Classe armatura',sheet.armorClass]])}
            {summary('Incantesimi',6,[['Magie annotate',rows.map((row)=>`${row.name} (${row.level===0 ? 'trucchetto' : `liv. ${row.level}`}${d[`${row.root}.prepared`]==='true' ? ', preparato' : ''})`).join('\n')],['CD incantesimi',d.spellDC],['Attacco incantesimi',d.spellAttackBonus]])}
            {summary('Aspetto e personalità',7,[...appearanceFields.map(({key,label}): [string,string]=>[label,characterFieldValue(sheet,key)]),['Aspetto',d.appearanceDescription],['Cicatrici',d.scars],['Segni di riconoscimento',d.distinctiveMarks],['Allineamento',d.alignment],...['Tratti caratteriali','Ideali','Legami','Difetti'].map((label): [string,string | undefined]=>[label,d[`personality.${label}`]]),['Storia',d.backgroundStory],['Legami con il gruppo',d.faction]])}
            <TutorialPanel title="Valori calcolati"><p className="player-hint">Derivano dalle scelte precedenti. Per correggerli, modifica classe, caratteristiche o dotazione.</p><dl className="tutorial-summary tutorial-calculated">{[['PF massimi',d.maxHitPoints],['Competenza',d.proficiencyBonus],['Iniziativa',d.initiativeBonus],['Percezione passiva',d.passivePerception]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}</dl></TutorialPanel>
            <TutorialPanel title="La tua scheda"><label className="player-field"><TutorialFieldLabel label="Modello grafico della scheda · facoltativo" /><select {...control('sheet.template')} value={d['sheet.template'] ?? 'auto'} onChange={(e) => detail('sheet.template',e.target.value)}><option value="auto">Automatico per classe</option><option value="generic">Scheda generale</option>{d['creation.class'] === 'wizard' && <><option value="wizard">Mago</option><option value="wizard-pdf">Mago · stile PDF</option></>}</select></label></TutorialPanel>
            {edition === '2024' && <p className="player-hint">Talento di Origine: {d.additionalTraits}. Le applicazioni concordate con il DM restano da controllare nella scheda; il tutorial non applica effetti di talenti assenti dal catalogo.</p>}
        </>}
        {issues.length > 0 && <aside className="tutorial-issues" aria-labelledby={`${prefix}-issues-title`}><strong id={`${prefix}-issues-title`}>Da completare{step === 8 ? ' prima del salvataggio finale' : ' in questo passaggio'}</strong><p className="player-hint">Seleziona una verifica per raggiungere il campo o il passaggio interessato.</p><ul>{issues.map((issue) => <li key={issue}><button type="button" onClick={()=>focusIssue(issue)}>{issue}</button></li>)}</ul></aside>}
        <details className="tutorial-sources"><summary>Fonti e differenze tra edizioni</summary><p>La guida Fandom descrive il percorso 2014: razza, classe, caratteristiche, descrizione/background, equipaggiamento e incontro con il gruppo. Qui le scelte sono suddivise in passaggi più brevi; i controlli 2024 seguono le regole ufficiali. Catalogo SRD, con sottoclassi aggiuntive del mago; le opzioni UA sono playtest.</p><a href={guideUrl} target="_blank" rel="noreferrer">Guida Fandom (2014)</a> · <a href={official2014} target="_blank" rel="noreferrer">Regole ufficiali 2014</a> · <a href={official2024} target="_blank" rel="noreferrer">Regole ufficiali 2024</a></details>
        </div></div>
        <footer className="tutorial-footer"><div className="tutorial-actions"><button type="button" disabled={step === 0} onClick={() => goToStep(step-1)}>Indietro</button>{step < tutorialSteps.length-1 ? <button className="tutorial-primary" type="button" disabled={issues.length > 0} aria-describedby={issues.length ? `${prefix}-issues-title` : undefined} onClick={() => goToStep(step+1)}>Continua</button> : <button className="tutorial-primary" type="submit" disabled={issues.length > 0} aria-describedby={issues.length ? `${prefix}-issues-title` : undefined}>Salva personaggio</button>}</div><div className="tutorial-draft-actions">{children}</div><p className="tutorial-save-hint">Puoi chiudere con “Salva e riprendi più tardi”: la bozza resta in questo browser.</p></footer>
    </section>
}
