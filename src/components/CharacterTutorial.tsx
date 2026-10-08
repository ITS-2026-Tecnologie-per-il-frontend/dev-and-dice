import { useEffect, useRef, type ReactNode } from 'react'
import { characterFields, type CharacterSheet } from '../utils/CharacterSheets'
import { abilityKeys, characterFieldValue, labelOf, selectedOrigins, spellRules, spellSelection, subclassOptions, subclassMinimumLevel, updateCharacterField, type CreationData, type Origin } from '../utils/PlayerCreation'
import { spellEdition, spellRowState } from '../utils/Spellcasting'
import { changeTutorialOrigin, pointCost, rollScores, rolledTotal, standardScores, standardLanguageIds, tutorialChoices, tutorialIssues, tutorialStep, tutorialSteps } from '../utils/CharacterTutorial'
import { CreationChoices } from './PlayerCreation'
import { WizardSubclassFeatures } from './WizardSubclassFeatures'
import { WizardSpellcasting } from './WizardSpellcasting'

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

export function CharacterTutorial({ sheet, data, onChange }: { sheet: CharacterSheet; data: CreationData; onChange: (sheet: CharacterSheet) => void }) {
    const d = sheet.playerDetails ?? {}, step = tutorialStep(sheet), edition = spellEdition(sheet)
    const origins = selectedOrigins(sheet,data), magic = spellRules(sheet,data), selected = spellSelection(sheet,data)
    const issues = tutorialIssues(sheet,data,step), heading = useRef<HTMLHeadingElement>(null)
    useEffect(() => { heading.current?.focus() }, [step])
    function detail(key: string, value: string) { onChange(updateCharacterField(sheet,key,value)) }
    function many(values: Record<string,string>) { onChange({ ...sheet, playerDetails: { ...d, ...values } }) }
    function field(key: string, label: string, multiline = false, base = false) {
        const value = base ? sheet[key as keyof typeof characterFields] : d[key] ?? ''
        return <label className="player-field"><span>{label}</span>{multiline ? <textarea rows={3} value={value} onChange={(e) => detail(key,e.target.value)} /> : <input value={value} onChange={(e) => detail(key,e.target.value)} />}</label>
    }
    function check(key: string, label: string) {
        return <label className="player-check"><input type="checkbox" checked={d[key] === 'true'} onChange={(e) => detail(key,String(e.target.checked))} /><span>{label}</span></label>
    }
    function origin(kind: 'class'|'race'|'subrace'|'subclass'|'background', label: string, options: Origin[]) {
        return <label className="player-field"><span>{label}</span><select value={d[`creation.${kind}`] ?? ''} onChange={(e) => onChange(changeTutorialOrigin(sheet,data,kind,e.target.value))}>
            <option value="">Scegli…</option>{options.map((x) => <option key={x.index} value={x.index}>{labelOf(x)}{x.status === 'ua' || x.status === 'archived-ua' ? ' · Playtest UA, richiede il consenso del DM' : ''}</option>)}
        </select></label>
    }
    function preview(label: string, children: ReactNode) { return <section className="tutorial-preview"><h4>{label}</h4>{children}</section> }
    const rows = Object.entries(d).filter(([k,v]) => /^spell\.\d+\.\d+\.name$/.test(k) && v.trim()).map(([key,name]) => ({ root:key.slice(0,-5), name, level:Number(key.split('.')[1]), index:Number(key.split('.')[2]) }))
    function toggleSpell(spell: CreationData['spells'][number]) {
        const existing = rows.find((r) => d[`${r.root}.index`] === spell.index && spellRowState(sheet,r.level,r.index).source === 'class')
        const next = { ...d }
        if (existing) for (const key of Object.keys(next).filter((k) => k.startsWith(existing.root + '.'))) delete next[key]
        else {
            let index = 0
            while (next[`spell.${spell.level}.${index}.name`]?.trim()) index++
            const root = `spell.${spell.level}.${index}`
            Object.assign(next,{ [`${root}.name`]:labelOf(spell), [`${root}.index`]:spell.index, [`${root}.source`]:'class', [`${root}.prepared`]:'false' })
        }
        onChange({ ...sheet, playerDetails:next })
    }
    return <section className="character-tutorial" aria-label="Tutorial di creazione del personaggio">
        <p className="tutorial-progress">Passaggio {step + 1} di {tutorialSteps.length} · {d['rules.edition'] ? edition : 'edizione da scegliere'}</p>
        <nav aria-label="Passaggi della creazione"><ol>{tutorialSteps.map((title,i) => <li key={title}><button type="button" aria-current={step === i ? 'step' : undefined} onClick={() => detail('tutorial.step',String(i))}>{i + 1}. {title}</button></li>)}</ol></nav>
        <h3 tabIndex={-1} ref={heading}>{tutorialSteps[step]}</h3>
        {d['tutorial.notice'] && <p role="status" className="player-hint">{d['tutorial.notice']} <button type="button" onClick={() => detail('tutorial.notice','')}>Ho capito</button></p>}
        {step === 0 && <>
            <p>Prima immagina chi vorresti interpretare e chiedi al Dungeon Master (DM), chi conduce la partita, quali regole e opzioni usa la campagna. Puoi cambiare idea lungo il percorso.</p>
            <label className="player-field"><span>Edizione delle regole · obbligatoria</span><select value={d['rules.edition'] ?? ''} onChange={(e) => onChange(changeTutorialOrigin(sheet,data,'edition',e.target.value))}><option value="">Scegli con il DM…</option><option value="2014">D&D 5e 2014</option><option value="2024">D&D 5e 2024 · anche opzioni storiche compatibili</option></select></label>
            {field('name','Nome del personaggio · obbligatorio',false,true)}{field('playerName','Nome del giocatore · facoltativo')}{field('tutorial.concept','La tua idea · facoltativa (esempio: una studiosa che cerca un libro perduto)',true)}
            <p className="player-hint">La guida Fandom segue le regole 2014. Nel 2024 i bonus alle caratteristiche vengono dal background e la sottoclasse si sceglie dal livello 3. Questo catalogo comprende soprattutto opzioni storiche: il percorso distingue gli adattamenti e ti chiede di verificare con il DM ciò che manca.</p>
        </>}
        {step === 1 && <>
            <p>La classe descrive come affronti le avventure: armi, magia, esplorazione e capacità speciali. Ogni classe può contribuire al gruppo; le caratteristiche suggerite non sono obblighi.</p>
            {origin('class','Classe · obbligatoria',data.classes)}
            {origins.characterClass && preview(labelOf(origins.characterClass),<><p>{classHints[origins.characterClass.index]}</p><p>Dado Vita: d{origins.characterClass.hit_die}. Competenze nei tiri salvezza: {origins.characterClass.savingThrowAbilities?.map((x) => characterFields[x]).join(', ')}.</p>{edition === '2014' && origins.characterClass.localizations?.it?.description && <details><summary>Leggi capacità e scelte della classe</summary><p className="tutorial-prose">{origins.characterClass.localizations.it.description}</p></details>}</>)}
            <label className="player-field"><span>Livello iniziale · obbligatorio</span><select value={sheet.level} onChange={(e) => onChange(changeTutorialOrigin(sheet,data,'level',e.target.value))}>{Array.from({length:20},(_,i) => <option key={i} value={i+1}>{i+1}</option>)}</select></label>
            <p>Di solito inizi al livello 1. La sottoclasse specializza il tuo ruolo e compare quando il tuo livello la sblocca. Al livello 1 i PF massimi partono dal massimo del Dado Vita, più il modificatore di Costituzione.</p>
            {(() => { const options = subclassOptions(sheet,data).filter((x) => Number(sheet.level) >= subclassMinimumLevel(sheet,x,data)); return options.length ? origin('subclass','Sottoclasse · obbligatoria al tuo livello',options) : <p className="player-hint">Nessuna scelta di sottoclasse richiesta a questo livello.</p> })()}
            {Number(sheet.level) > 1 && <>{field('tutorial.advancementNotes','Scelte e incrementi concordati con il DM',true)}{check('tutorial.advancement','Ho verificato avanzamenti, aumenti di caratteristica/talenti e PF dei livelli superiori. Qui i PF usano il valore fisso; potrò correggerli nella scheda.')}</>}
        </>}
        {step === 2 && <>
            <p>{edition === '2014' ? 'La razza e l’eventuale sottorazza danno tratti, velocità, lingue e bonus alle caratteristiche.' : 'La specie dà i tratti. Per una specie storica compatibile si ignorano i vecchi bonus alle caratteristiche: li assegnerai dal background.'} Il background racconta cosa facevi prima di diventare avventuriero e aggiunge competenze ed equipaggiamento.</p>
            {origin('race',edition === '2014' ? 'Razza · obbligatoria' : 'Specie storica compatibile · obbligatoria',data.races)}
            {origins.race && data.subraces.some((x) => x.race?.index === origins.race!.index) && origin('subrace','Sottorazza · obbligatoria',data.subraces.filter((x) => x.race?.index === origins.race!.index))}
            {origins.race && preview('Cosa ottieni dall’origine',<><p>Velocità: {sheet.speed || '—'} · taglia: {origins.race.size}. Lingue di origine: {origins.race.languages?.map(labelOf).join(', ')}.</p><p>Tratti: {[...(origins.race.traits ?? []),...(origins.subrace?.racial_traits ?? [])].map(labelOf).join(', ')}.</p>{edition === '2014' && <p>Bonus: {abilityKeys.filter((k) => Number(d[`creation.bonus.${k}`]) > 0).map((k) => `${characterFields[k]} +${d[`creation.bonus.${k}`]}`).join(', ') || 'nessun bonus fisso; completa le scelte previste'}</p>}{edition === '2014' && origins.race.localizations?.it?.description && <details><summary>Leggi i tratti di questa origine</summary><p className="tutorial-prose">{origins.race.localizations.it.description}</p></details>}</>)}
            {origin('background',edition === '2014' ? 'Background · obbligatorio' : 'Background storico compatibile · obbligatorio',data.backgrounds)}
            {origins.background && preview('Competenze del background',<><p>{origins.background.index === 'acolyte' && 'Un Accolito ha vissuto o lavorato presso un tempio: conosce le pratiche religiose e sa comprendere le intenzioni delle persone. Questo passato non impone la classe del chierico. ' }Competenze: {origins.background.starting_proficiencies?.map(labelOf).join(', ')}. Completerai le scelte di lingue e oggetti nei passaggi successivi.</p></>)}
            <p className="player-hint">Il catalogo offre attualmente {data.backgrounds.length} background. Le opzioni della tua campagna non presenti si possono annotare nella scheda dopo il tutorial con il DM.</p>
        </>}
        {step === 3 && <>
            <p>Assegna i sei punteggi prima dei bonus di origine. Un punteggio 14 dà modificatore +2: questo bonus entra in molti tiri. Costituzione influisce sui PF; aumentarla ricalcola anche quelli dei livelli precedenti.</p>
            <label className="player-field"><span>Metodo concordato con il DM</span><select value={d['tutorial.method'] ?? 'standard'} onChange={(e) => detail('tutorial.method',e.target.value)}><option value="standard">Array standard: 15, 14, 13, 12, 10, 8</option><option value="points">Acquisto con 27 punti (con consenso del DM)</option><option value="rolls">4d6: scarta il dado più basso</option><option value="manual">Punteggi concordati con il DM</option></select></label>
            {d['tutorial.method'] === 'rolls' && <><button type="button" onClick={() => { const rolls = rollScores(); many({'tutorial.rolls':JSON.stringify(rolls)}) }}>Tira sei gruppi di 4d6</button><p>{(() => { try { return (JSON.parse(d['tutorial.rolls'] ?? '[]') as number[][]).map((r) => `${r.join('+')} → ${rolledTotal(r)}`).join(' · ') } catch { return 'Tiri da effettuare.' } })()}</p><small>Assegna i sei risultati alle caratteristiche; i tiri rimangono salvati.</small></>}
            {d['tutorial.method'] === 'points' && <p>Punti spesi: {abilityKeys.reduce((n,k) => n + (pointCost(d[`creation.base.${k}`] ?? '') ?? 0),0)}/27. Da 8 a 13 ogni aumento costa un punto; 14 costa 7 e 15 costa 9.</p>}
            <div className="tutorial-grid">{abilityKeys.map((key,i) => <label className="player-field" key={key}><span>{characterFields[key]} base</span>{d['tutorial.method'] === 'standard' ? <select value={d[`creation.base.${key}`] ?? ''} onChange={(e) => detail(`creation.base.${key}`,e.target.value)}><option value="">Assegna…</option>{standardScores.map((n) => <option key={n}>{n}</option>)}</select> : <input type="number" step="1" min={d['tutorial.method'] === 'points' ? 8 : 1} max={d['tutorial.method'] === 'points' ? 15 : 20} value={d[`creation.base.${key}`] ?? ''} onChange={(e) => detail(`creation.base.${key}`,e.target.value)} />}<small>{abilityHints[i]} Totale {sheet[key] || '—'}, modificatore {characterFieldValue(sheet,`modifier.${key}`) || '—'}.</small></label>)}</div>
            {edition === '2024' && <><p>Per questo background storico scegli +2 e +1 su due caratteristiche diverse, oppure +1 su tre. Nessun punteggio può superare 20 grazie a questi bonus.</p><div className="tutorial-grid">{abilityKeys.map((key) => <label className="player-field" key={key}><span>Bonus background: {characterFields[key]}</span><select value={d[`creation.backgroundBonus.${key}`] ?? '0'} onChange={(e) => detail(`creation.backgroundBonus.${key}`,e.target.value)}>{[0,1,2].map((n) => <option key={n}>{n}</option>)}</select></label>)}</div></>}
            <CreationChoices sheet={sheet} data={data} change={detail} choices={tutorialChoices(sheet,data,3)} section="scores" />
        </>}
        {step === 4 && <>
            <p>Essere competente significa aggiungere il bonus di competenza ai tiri appropriati (+2 al livello 1). Non si somma due volte se due origini danno la stessa abilità. La Maestria, quando concessa, raddoppia quel bonus: non è una seconda competenza.</p>
            <CreationChoices sheet={sheet} data={data} change={detail} choices={tutorialChoices(sheet,data,4)} section="choices" />
            <WizardSubclassFeatures sheet={sheet} data={data} onChange={onChange} />
            <p>Competenze nelle abilità: {data.skills.filter((x) => d[x.playerDetailsKeys.proficient] === 'true').map(labelOf).join(', ') || 'completa le scelte'}.</p><p>Lingue: {d.languages || 'completa le scelte'}.</p>
            {edition === '2024' && <><p>Nel 2024 conosci Comune e altre due lingue standard. Il catalogo non contiene ancora tutti i talenti di Origine e i privilegi 2024: annota il talento scelto con il DM e verifica classe, eventuali maestrie delle armi e magie delle versioni aggiornate.</p><div className="tutorial-grid">{[0,1].map((i) => <label key={i} className="player-field"><span>Lingua standard {i+1}</span><select value={d[`tutorial.language.${i}`] ?? ''} onChange={(e) => detail(`tutorial.language.${i}`,e.target.value)}><option value="">Scegli…</option>{data.languages.filter((x) => standardLanguageIds.includes(x.index)).map((x) => <option key={x.index} value={x.index} disabled={d[`tutorial.language.${1-i}`] === x.index}>{labelOf(x)}</option>)}</select></label>)}</div>{field('additionalTraits','Talento di Origine concordato con il DM · obbligatorio')}{field('tutorial.rulesNotes','Privilegi 2024 e applicazioni manuali concordate',true)}{check('tutorial.rules2024','Ho verificato con il DM l’adattamento di specie/background storici, il talento di Origine e i privilegi della classe 2024. Gli effetti non presenti nel catalogo saranno applicati manualmente nella scheda.')}</>}
        </>}
        {step === 5 && <>
            <p>Classe e background forniscono oggetti fissi e alternative. Scegli le dotazioni, poi indica cosa indossi: portare un’armatura nello zaino non aumenta la CA. Senza armatura, di solito la CA è 10 + Destrezza; alcuni privilegi usano una formula diversa.</p>
            <CreationChoices sheet={sheet} data={data} change={detail} choices={tutorialChoices(sheet,data,5)} section="equipment" />
            {preview('Equipaggiamento iniziale',<p className="tutorial-prose">{d.equipment || 'Completa prima le scelte.'}</p>)}
            <p>CA attuale: {sheet.armorClass || '—'}. Gli attacchi con le armi iniziali vengono compilati usando caratteristica e competenza appropriate.</p>
            <p className="player-hint">Questo percorso usa le dotazioni del catalogo. L’alternativa di acquistare oggetti con oro iniziale si concorda con il DM e si compila nella scheda. Pesi mancanti, contenuto delle dotazioni ed effetti speciali richiedono verifica.</p>
        </>}
        {step === 6 && <>
            <p>I trucchetti sono magie di livello 0 e non consumano slot. Gli slot limitano i lanci delle magie di livello superiore; conoscere una magia non significa averla preparata oggi.</p>
            {!magic.maxLevel && !magic.cantrips ? <p>La tua classe non richiede incantesimi a questo livello. Eventuali magie dell’origine sono registrate separatamente.</p> : <><p>Trucchetti {selected.cantrips}/{magic.cantrips}; incantesimi {selected.spells}/{magic.known ?? 'lista di classe'}{magic.prepared && `; preparati ${selected.prepared}/${magic.preparedLimit}`}. CD {d.spellDC || '—'} · attacco {d.spellAttackBonus || '—'}.</p>
                {d['creation.class'] === 'wizard' && <p>Il libro parte con sei incantesimi di livello 1 e cresce di due per livello. Metti nel libro le magie scelte, poi spunta quelle preparate. Le copie aggiuntive e le scelte avanzate hanno controlli dedicati qui sotto.</p>}
                {Array.from({length:magic.maxLevel+1},(_,level) => <details key={level} open={level < 2}><summary>{level === 0 ? 'Trucchetti' : `Incantesimi di livello ${level}`}</summary><div className="tutorial-spells">{magic.spells.filter((x) => x.level === level).map((spell) => { const row = rows.find((r) => d[`${r.root}.index`] === spell.index && spellRowState(sheet,r.level,r.index).source === 'class'); return <div key={spell.index} className="tutorial-spell"><label className="player-check"><input type="checkbox" checked={!!row} onChange={() => toggleSpell(spell)} /><span>{labelOf(spell)}</span></label>{row && level > 0 && magic.prepared && check(`${row.root}.prepared`,`Prepara ${labelOf(spell)}`)}<details><summary>Come funziona</summary><p>{spell.desc[0]}</p></details></div> })}</div></details>)}
                <WizardSpellcasting sheet={sheet} data={data} onChange={onChange} />
            </>}
            {d.racialSpells && preview('Magie dell’origine',<p>{d.racialSpells}</p>)}
            {edition === '2024' && <p className="player-hint">I limiti di classe seguono il 2024; molte descrizioni nel catalogo sono 2014. Controlla la versione della magia con il DM prima di usarla.</p>}
        </>}
        {step === 7 && <>
            <p>Queste scelte sono facoltative e danno vita al personaggio. Un ideale è ciò in cui crede, un legame è qualcuno o qualcosa a cui tiene, un difetto crea occasioni di gioco. L’allineamento descrive una tendenza, senza imporre ogni decisione.</p>
            <label className="player-field"><span>Allineamento · facoltativo</span><select value={d.alignment ?? ''} onChange={(e) => detail('alignment',e.target.value)}><option value="">Da decidere</option>{data.alignments.map((x) => <option key={x.index}>{labelOf(x)}</option>)}</select></label>
            <div className="tutorial-grid">{['age','height','weight','eyes','hair'].map((key,i) => field(key,['Età','Altezza','Peso corporeo','Occhi','Capelli'][i]+' · facoltativo'))}</div>
            {field('appearance','Aspetto · facoltativo',true)}{['Tratti caratteriali','Ideali','Legami','Difetti'].map((label) => <div key={label}>{field(`personality.${label}`,label+' · facoltativo',true)}</div>)}{field('backgroundStory','Storia e motivo per partire all’avventura · facoltativo',true)}{field('faction','Come conosci il gruppo e perché collaborate · facoltativo',true)}
            <p>Parla con gli altri giocatori: chi conosci già? Che obiettivo condividete? Per esempio, potreste cercare una persona scomparsa per motivi diversi.</p>
        </>}
        {step === 8 && <>
            <p>Controlla le scelte e i valori derivati. Puoi tornare a qualsiasi passaggio; salvando otterrai una scheda utilizzabile anche nelle card del combattimento.</p>
            <dl className="tutorial-summary">{[['Nome',sheet.name],['Edizione',edition],['Classe',`${sheet.characterClass} · livello ${sheet.level}`],['Origine',`${sheet.race} ${d.subrace ?? ''}`],['Background',d.background],['PF massimi',d.maxHitPoints],['CA',sheet.armorClass],['Competenza',d.proficiencyBonus],['Iniziativa',d.initiativeBonus],['Percezione passiva',d.passivePerception],['CD incantesimi',d.spellDC],['Attacco incantesimi',d.spellAttackBonus],['Lingue',d.languages],['Equipaggiamento',d.equipment]].map(([name,value]) => <div key={name}><dt>{name}</dt><dd>{value || '—'}</dd></div>)}</dl>
            {preview('Caratteristiche',<p>{abilityKeys.map((key) => `${characterFields[key]} ${sheet[key]} (${characterFieldValue(sheet,`modifier.${key}`)})`).join(' · ')}</p>)}
            {preview('Privilegi di classe',<p className="tutorial-prose">{d.classFeatures || 'Privilegi da verificare e annotare con il DM, secondo l’edizione.'}</p>)}
            <label className="player-field"><span>Modello grafico della scheda</span><select value={d['sheet.template'] ?? 'auto'} onChange={(e) => detail('sheet.template',e.target.value)}><option value="auto">Automatico per classe</option><option value="generic">Scheda generale</option>{d['creation.class'] === 'wizard' && <><option value="wizard">Mago</option><option value="wizard-pdf">Mago · stile PDF</option></>}</select></label>
            {edition === '2024' && <p className="player-hint">Talento di Origine: {d.additionalTraits}. Le applicazioni concordate con il DM restano da controllare nella scheda; il tutorial non applica effetti di talenti assenti dal catalogo.</p>}
        </>}
        {issues.length > 0 && <div role="status" className="tutorial-issues"><strong>Da completare{step === 8 ? ' prima del salvataggio finale' : ' in questo passaggio'}:</strong><ul>{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul></div>}
        <div className="tutorial-actions"><button type="button" disabled={step === 0} onClick={() => detail('tutorial.step',String(step-1))}>Indietro</button>{step < tutorialSteps.length-1 ? <button type="button" disabled={issues.length > 0} onClick={() => detail('tutorial.step',String(step+1))}>Continua</button> : <button type="submit" disabled={issues.length > 0}>Salva personaggio</button>}</div>
        <p className="player-hint">I progressi si salvano in questo browser. Usa «Salva e riprendi più tardi» per chiudere conservando la bozza.</p>
        <details className="tutorial-sources"><summary>Fonti e differenze tra edizioni</summary><p>La guida Fandom descrive il percorso 2014: razza, classe, caratteristiche, descrizione/background, equipaggiamento e incontro con il gruppo. Qui le scelte sono suddivise in passaggi più brevi; i controlli 2024 seguono le regole ufficiali. Catalogo SRD, con sottoclassi aggiuntive del mago; le opzioni UA sono playtest.</p><a href={guideUrl} target="_blank" rel="noreferrer">Guida Fandom (2014)</a> · <a href={official2014} target="_blank" rel="noreferrer">Regole ufficiali 2014</a> · <a href={official2024} target="_blank" rel="noreferrer">Regole ufficiali 2024</a></details>
    </section>
}
