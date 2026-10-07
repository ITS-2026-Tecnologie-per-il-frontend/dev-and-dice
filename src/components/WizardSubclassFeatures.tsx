import { useState } from 'react'
import type { CharacterSheet } from '../utils/CharacterSheets'
import { labelOf, type CreationData } from '../utils/PlayerCreation'
import { featureResourceKey, featureResourceMax, featureResourceRemaining, selectedWizardFeatures, spendWizardFeature, spendWizardPortent, wizardRules } from '../utils/Wizard'

export function WizardSubclassFeatures({ sheet, data, onChange }: { sheet: CharacterSheet; data: CreationData; onChange: (sheet: CharacterSheet) => void }) {
    const [error, setError] = useState('')
    const r = wizardRules(sheet), d = sheet.playerDetails ?? {}
    const subclass = data.subclasses.find((x) => x.index === d['creation.subclass'])
    if (!r.wizard || r.edition !== '2014' || r.level < 2 || !subclass?.features?.length) return null
    const features = selectedWizardFeatures(sheet, data)
    const names = new Set(features.map((x) => x.name))
    function detail(key: string, value: string) { onChange({ ...sheet, playerDetails: { ...d, [key]: value } }); setError('') }
    function select(key: string, title: string, options: { index: string; name: string; nameIt?: string }[], excluded: string[] = []) {
        return <label className="player-field" key={key}><span>{title}</span><select value={options.some((x) => x.index === d[key]) ? d[key] : ''} onChange={(e) => detail(key, e.target.value)}><option value="">Scegli…</option>{options.map((x) => <option key={x.index} value={x.index} disabled={excluded.includes(x.index) && d[key] !== x.index}>{labelOf(x)}</option>)}</select></label>
    }
    const skillOptions = names.has('Creative Skills') ? ['acrobatics','athletics','nature','performance'] : names.has('Eloquent Apprentice') ? ['deception','intimidation','performance','persuasion','insight'] : []
    const tools = data.equipmentCategories.find((x) => x.index === 'tools')?.equipment ?? []
    const intelligence = Math.floor((Number(sheet.intelligence || 10) - 10) / 2)
    const resources = new Set<string>()
    return <section className="player-box wizard-rules">
        <h3>Privilegi · {labelOf(subclass)}</h3>
        <p className="player-hint">Privilegi sbloccati al livello {r.level}. Le capacità attivabili compaiono nella lista della scheda e si importano nel combattimento quando le selezioni. I contatori registrano gli usi; bersagli, dadi e condizioni si verificano durante il gioco.</p>
        {subclass.features.some((x) => x.choice) && <div className="player-three-fields">{[6,10,14].filter((tier) => tier <= r.level).map((tier) => select(`wizard.subclass.choice.${tier}`, `Privilegio scelto al livello ${tier}`, subclass.features!.filter((x) => x.choice && x.level <= tier), [6,10,14].filter((x) => x !== tier).map((x) => d[`wizard.subclass.choice.${x}`])))}</div>}
        <div className="player-two-fields">
            {names.has('Training in War and Song') && select('wizard.weapon', 'Competenza · arma da mischia a una mano', data.equipment.filter((x) => x.weapon_range === 'Melee' && !x.properties?.some((p) => p.index === 'two-handed')))}
            {names.has('Tools of the Inventor') && [0,1].map((i) => select(`wizard.tool.${i}`, `Strumento ${i + 1}`, tools, [d[`wizard.tool.${1 - i}`]]))}
            {skillOptions.length > 0 && [0,1].map((i) => select(`wizard.skill.${i}`, `Competenza aggiuntiva ${i + 1}`, data.skills.filter((x) => skillOptions.includes(x.index)), [d[`wizard.skill.${1 - i}`]]))}
            {names.has("Transmuter's Stone") && select('wizard.stone', 'Pietra del trasmutatore · effetto scelto', ['Scurovisione 18 m','Velocità +3 m senza ingombro','Competenza nei TS di Costituzione','Resistenza acido','Resistenza freddo','Resistenza fuoco','Resistenza fulmine','Resistenza tuono'].map((name) => ({ index:name,name })))}
            {names.has('The Third Eye') && select('wizard.thirdEye', 'The Third Eye · effetto scelto', ['Scurovisione 18 m','Vista eterea 18 m','Lettura di ogni lingua','Vedere invisibilità 3 m'].map((name) => ({ index:name,name })))}
            {names.has('Favored Medium') && select('wizard.medium', 'Favored Medium · scelta dopo riposo lungo', ['Freddo','Fuoco','Fulmine'].map((name) => ({ index:name,name })))}
            {names.has('Ancient Companion') && select('wizard.companion', 'Ancient Companion · tipo evocato', ['Guaritore','Saggio','Guerriero'].map((name) => ({ index:name,name })))}
            {names.has('Divine Inspiration') && <label className="player-field"><span>Divine Inspiration · dominio clericale consentito dalla divinità</span><input value={d['wizard.domain'] || ''} onChange={(e) => detail('wizard.domain',e.target.value)} placeholder="Dominio scelto con il DM" /></label>}
            {names.has('Resonant Utterance') && Array.from({ length:names.has('Inexorable Pronouncement') ? 4 : 2 }, (_,i) => select(`wizard.resonance.${i}`, `Risonanza ${i + 1}`, ['Absorption','Devastation','Dissolution','Nullification','Puppetry','Sympathy'].map((name) => ({ index:name,name })), [0,1,2,3].filter((j) => j !== i).map((j) => d[`wizard.resonance.${j}`])))}
            {names.has('Extract Name') && select('wizard.language', 'Lingua aggiuntiva · Onomancy', data.languages)}
            {names.has('Lore Mastery') && select('wizard.initiativeAbility', 'Caratteristica per l’iniziativa', [{ index: 'dexterity', name: 'Destrezza' }, { index: 'intelligence', name: 'Intelligenza' }])}
            {features.filter((x) => x.grantOptions).map((feature) => {
                const anyCantrip = feature.grantOptions!.includes('wizard-cantrip-if-known')
                const alreadyKnown = Object.entries(d).some(([key, value]) => key.endsWith('.index') && value === 'minor-illusion' && !d[key.slice(0,-6) + '.grant'])
                if (anyCantrip && !alreadyKnown) return null
                const options = anyCantrip ? data.spells.filter((x) => x.level === 0 && x.classes.some((c) => c.index === 'wizard') && !Object.entries(d).some(([key,value]) => key.endsWith('.index') && value === x.index && d[key.slice(0,-6) + '.grant'] !== feature.index)) : feature.grantOptions!.map((id) => data.spells.find((x) => x.index === id) ?? { index: id, name: id.split('-').join(' ') })
                return select(`wizard.grantChoice.${feature.index}`, `${feature.name} · incantesimo concesso`, options)
            })}
        </div>
        {names.has('Bladesong') && <p className="player-hint">Bladesong: CA e TS di Costituzione per concentrazione +{Math.max(1, intelligence)}, velocità +10 piedi (circa 3 m), vantaggio ad Acrobazia, per 10 turni. Applica questi bonus solo mentre la capacità è attiva e sono rispettate le restrizioni sull’equipaggiamento.</p>}
        {names.has('Portent') && <section className="player-box"><h3>Portent · d20 dopo riposo lungo</h3><p className="player-hint">Sostituisci un tiro prima che venga effettuato, al massimo una volta per turno. Ogni risultato si usa una sola volta; il riposo lungo cancella i risultati precedenti.</p><div className="player-three-fields">{Array.from({ length:r.level >= 14 ? 3 : 2 },(_,i) => <div key={i}><label className="player-field"><span>d20 {i + 1}{d[`wizard.portent.${i}.used`] === 'true' ? ' · usato' : ''}</span><input type="number" min="1" max="20" step="1" disabled={d[`wizard.portent.${i}.used`] === 'true'} value={d[`wizard.portent.${i}`] || ''} onChange={(e) => { const n = Number(e.target.value); if (e.target.value === '' || Number.isInteger(n) && n >= 1 && n <= 20) detail(`wizard.portent.${i}`, e.target.value) }} /></label><button type="button" disabled={!d[`wizard.portent.${i}`] || d[`wizard.portent.${i}.used`] === 'true'} onClick={() => { try { onChange(spendWizardPortent(sheet,i)); setError('') } catch (e) { setError(e instanceof Error ? e.message : 'Uso non riuscito.') } }}>Usa questo risultato</button></div>)}</div></section>}
        {names.has('Arcane Ward') && <label className="player-field"><span>Arcane Ward · PF della protezione / {Math.max(0, 2 * r.level + intelligence)} (separati dai PF del personaggio)</span><input type="number" min="0" max={Math.max(0, 2 * r.level + intelligence)} step="1" value={d['wizard.ward.current'] || '0'} onChange={(e) => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 0 && n <= Math.max(0,2 * r.level + intelligence)) detail('wizard.ward.current', String(n)) }} /></label>}
        <div className="player-two-fields">{features.map((feature) => {
            const resourceKey = featureResourceKey(feature)
            const showResource = feature.resource && feature.name !== 'Portent' && !resources.has(resourceKey)
            resources.add(resourceKey)
            let remaining = 0
            try { remaining = featureResourceRemaining(sheet, feature) } catch { /* Valore salvato non valido: il controllo mostra zero e permette di correggerlo. */ }
            const maximum = featureResourceMax(sheet, feature)
            return <details className="player-box" key={feature.index}><summary>{feature.name} · livello {feature.level} · {feature.activation === 'active' ? 'Attivabile' : 'Passivo'}</summary>
                {feature.desc.map((text,i) => <p className="player-hint" key={i}>{text}</p>)}
                {showResource && <><label className="player-field"><span>{feature.name === 'Manifest Mind' ? 'Lanci attraverso la mente' : feature.name === 'Spell Secrets' ? 'Modifiche al tipo di TS rimanenti' : 'Usi rimanenti'} / {maximum} · recupero con riposo {feature.resource!.reset === 'short' ? 'breve o lungo' : 'lungo'}</span><input type="number" min="0" max={maximum} step="1" value={remaining} onChange={(e) => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 0 && n <= maximum) detail(resourceKey, String(n)) }} /></label><button type="button" disabled={!remaining} onClick={() => { try { onChange(spendWizardFeature(sheet,feature)); setError('') } catch (e) { setError(e instanceof Error ? e.message : 'Uso non riuscito.') } }}>Consuma un uso</button></>}
                {feature.sourceUrl && <a href={feature.sourceUrl} target="_blank" rel="noreferrer">Regole della sottoclasse</a>}
            </details>
        })}</div>
        {error && <p role="alert" className="creation-warning">{error}</p>}
    </section>
}
