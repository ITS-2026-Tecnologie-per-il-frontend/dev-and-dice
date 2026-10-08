import { integerValue, newCharacterSheet, numericCharacterFields, parseCharacterSheets, type CharacterSheet } from './CharacterSheets.ts'
import { abilityKeys, applyCreation, characterCalculationIssues, creationChoices, labelOf, optionsFor, resolveChoice, selectedOrigins, spellRules, spellSelection, subclassMinimumLevel, subclassOptions, type Choice, type CreationData, type Option } from './PlayerCreation.ts'
import { spellEdition, spellRowState } from './Spellcasting.ts'

export const tutorialSteps = ['Iniziamo', 'Classe e livello', 'Origini', 'Caratteristiche', 'Competenze e lingue', 'Equipaggiamento', 'Incantesimi', 'Personalità e gruppo', 'Riepilogo'] as const
export const tutorialDraftKey = 'dev-and-dice.character-tutorial.v1'
export const standardScores = [15, 14, 13, 12, 10, 8]
export const standardLanguageIds = ['draconic','dwarvish','elvish','giant','gnomish','goblin','halfling','orc']
const pointCosts = [0, 1, 2, 3, 4, 5, 7, 9]
export const pointCost = (score: string) => { const n = integerValue(score); return n !== undefined && n >= 8 && n <= 15 ? pointCosts[n - 8] : undefined }
export function rollScores(random = Math.random) {
    return Array.from({ length: 6 }, () => Array.from({ length: 4 }, () => 1 + Math.floor(random() * 6)))
}
export const rolledTotal = (dice: number[]) => [...dice].sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0)
export function newTutorial() {
    const sheet = newCharacterSheet()
    return { ...sheet, level: '1', playerDetails: { 'creation.enabled': 'true', 'tutorial.active': 'true', 'tutorial.step': '0', 'tutorial.method': 'standard' } }
}
export function parseTutorialDraft(raw: string | null): CharacterSheet | null {
    if (!raw) return null
    const value = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Bozza del tutorial non valida; dati originali conservati.')
    // ponytail: riuso della validazione delle schede; una bozza può avere nome vuoto
    // e statistiche ancora non valide. Si validano i tipi e si conservano i valori originali.
    const normalized = { ...value, name: typeof value.name === 'string' ? value.name.trim() || 'Bozza' : value.name }
    for (const key of numericCharacterFields) if (typeof value[key] === 'string') normalized[key] = ''
    const valid = parseCharacterSheets(JSON.stringify([normalized]))[0]
    if (valid.kind !== 'PG' || valid.playerDetails?.['tutorial.active'] !== 'true') throw new Error('Bozza del tutorial non valida; dati originali conservati.')
    return { ...valid, name: value.name, ...Object.fromEntries(numericCharacterFields.map((key) => [key, value[key]])) }
}
export function tutorialStep(sheet: CharacterSheet) {
    const n = integerValue(sheet.playerDetails?.['tutorial.step'])
    return n !== undefined && n >= 0 && n < tutorialSteps.length ? n : 0
}
export function tutorialChoices(sheet: CharacterSheet, data: CreationData, step: number) {
    return creationChoices(sheet, data).filter(({ choice }) => step === 3 ? choice.type === 'ability_bonuses' : step === 5 ? choice.type === 'equipment' : step === 4 && !['equipment', 'ability_bonuses'].includes(choice.type))
}
function incomplete(choice: Choice, path: string, sheet: CharacterSheet, data: CreationData): boolean {
    const d = sheet.playerDetails ?? {}, options = optionsFor(choice, data), selected = new Set<string>()
    function nested(option: Option, root: string): boolean {
        return !!option.choice && incomplete(option.choice, `${root}.nested`, sheet, data) || !!option.items?.some((item, i) => nested(item, `${root}.item.${i}`))
    }
    return Array.from({ length: choice.choose }, (_, i) => {
        const key = `${path}.${i}`, value = d[key], n = integerValue(value), option = n !== undefined ? options[n] : undefined
        const duplicate = choice.type !== 'equipment' && selected.has(value)
        selected.add(value)
        return !option || duplicate || nested(option, `${key}.option.${value}`)
    }).some(Boolean)
}
export function tutorialIssues(sheet: CharacterSheet, data: CreationData, step: number): string[] {
    const d = sheet.playerDetails ?? {}, origins = selectedOrigins(sheet, data), issues: string[] = []
    const edition = spellEdition(sheet), level = integerValue(sheet.level)
    if (step === 0) {
        if (!['2014','2024'].includes(d['rules.edition'])) issues.push('Scegli l’edizione usata dalla campagna.')
        if (!sheet.name.trim()) issues.push('Dai un nome al personaggio; potrai cambiarlo anche più avanti.')
    }
    if (step === 1) {
        if (!origins.characterClass) issues.push('Scegli una classe dal catalogo.')
        if (level === undefined || level < 1 || level > 20) issues.push('Il livello deve essere un intero da 1 a 20.')
        const unlocked = subclassOptions(sheet, data).filter((x) => level !== undefined && level >= subclassMinimumLevel(sheet, x, data))
        if (unlocked.length && !unlocked.some((x) => x.index === d['creation.subclass'])) issues.push('Al tuo livello è richiesta una sottoclasse: scegline una disponibile.')
        if (level && level > 1 && d['tutorial.advancement'] !== 'true') issues.push('Conferma di aver verificato con il DM avanzamenti, PF e scelte dei livelli superiori.')
    }
    if (step === 2) {
        if (!origins.race) issues.push('Scegli una razza/specie dal catalogo.')
        if (origins.race && data.subraces.some((x) => x.race?.index === origins.race!.index) && !origins.subrace) issues.push('Completa la scelta della sottorazza.')
        if (!origins.background) issues.push('Scegli un background dal catalogo.')
    }
    if (step === 3) {
        if (!['standard','points','rolls','manual'].includes(d['tutorial.method'])) issues.push('Scegli un metodo valido per assegnare le caratteristiche.')
        const scores = abilityKeys.map((key) => integerValue(d[`creation.base.${key}`]))
        if (scores.some((n) => n === undefined || n < 1 || n > 20)) issues.push('Assegna sei punteggi base interi da 1 a 20.')
        const sameScores = (expected: number[]) => scores.every((x) => x !== undefined) && JSON.stringify([...scores].sort((a,b) => Number(b) - Number(a))) === JSON.stringify([...expected].sort((a,b) => b-a))
        if (d['tutorial.method'] === 'standard' && !sameScores(standardScores)) issues.push('Usa ciascun valore dell’array 15, 14, 13, 12, 10, 8 una sola volta.')
        if (d['tutorial.method'] === 'points') {
            const costs = abilityKeys.map((key) => pointCost(d[`creation.base.${key}`] ?? ''))
            if (costs.some((x) => x === undefined) || costs.reduce<number>((sum, x) => sum + (x ?? 0), 0) > 27) issues.push('Acquisto punti: punteggi da 8 a 15 e spesa massima di 27 punti.')
        }
        if (d['tutorial.method'] === 'rolls') {
            try {
                const dice = JSON.parse(d['tutorial.rolls'] ?? 'null')
                if (!Array.isArray(dice) || dice.length !== 6 || dice.some((r) => !Array.isArray(r) || r.length !== 4 || r.some((n) => !Number.isInteger(n) || n < 1 || n > 6)) || !sameScores(dice.map(rolledTotal))) issues.push('Tira sei gruppi di 4d6 e assegna ciascun totale una volta.')
            } catch { issues.push('I tiri salvati non sono validi: effettua di nuovo i tiri.') }
        }
        if (edition === '2024') {
            const bonuses = abilityKeys.map((key) => integerValue(d[`creation.backgroundBonus.${key}`]) ?? 0).sort((a,b) => b-a)
            if (![JSON.stringify([2,1,0,0,0,0]), JSON.stringify([1,1,1,0,0,0])].includes(JSON.stringify(bonuses))) issues.push('Background storico nel 2024: distribuisci +2/+1 su due caratteristiche diverse oppure +1/+1/+1 su tre.')
            if (abilityKeys.some((key) => Number(sheet[key]) > 20)) issues.push('I bonus del background non possono portare una caratteristica oltre 20.')
        }
    }
    for (const c of tutorialChoices(sheet, data, step)) if (incomplete(c.choice, c.path, sheet, data)) issues.push(`Completa: ${c.label} (scegli ${c.choice.choose}).`)
    if (step === 4) {
        const profs = [origins.characterClass, origins.race, origins.subrace, origins.background].flatMap((x) => [...(x?.starting_proficiencies ?? []), ...(x?.proficiencies ?? [])]).map((x) => x.index)
        for (const ref of [...(origins.race?.traits ?? []), ...(origins.subrace?.racial_traits ?? [])]) profs.push(...(data.traits.find((x) => x.index === ref.index)?.proficiencies ?? []).map((x) => x.index))
        for (const c of creationChoices(sheet, data).filter((x) => ['proficiencies','proficiency'].includes(x.choice.type))) profs.push(...resolveChoice(c.choice,c.path,d,data).map((x) => x.ref.index))
        for (const index of new Set(profs.filter((p,i) => p.startsWith('skill-') && profs.indexOf(p) !== i))) {
            const skill = data.skills.find((x) => `skill-${x.index}` === index)
            issues.push(`${skill ? labelOf(skill) : index}: competenza scelta più volte. Cambia una delle selezioni nei riquadri Competenze qui sopra.`)
        }
        const languages = (origins.race?.languages ?? []).map((x) => x.index)
        for (const c of creationChoices(sheet,data).filter((x) => x.choice.type === 'languages')) languages.push(...resolveChoice(c.choice,c.path,d,data).map((x) => x.ref.index))
        if (languages.some((p,i) => languages.indexOf(p) !== i)) issues.push('Una lingua scelta è già conosciuta: scegli una lingua diversa con il DM.')
        if (edition === '2024' && (d['tutorial.rules2024'] !== 'true' || !d.additionalTraits?.trim())) issues.push('Conferma le opzioni storiche compatibili e annota il talento di Origine verificato con il DM.')
        if (edition === '2024' && ([0,1].some((i) => !standardLanguageIds.includes(d[`tutorial.language.${i}`]) || !data.languages.some((x) => x.index === d[`tutorial.language.${i}`])) || d['tutorial.language.0'] === d['tutorial.language.1'])) issues.push('Scegli due lingue standard diverse oltre al Comune.')
        for (const type of ['feature','expertise']) {
            const selected = creationChoices(sheet,data).filter((x) => x.choice.type === type).flatMap((c) => resolveChoice(c.choice,c.path,d,data).map((x) => x.ref.index))
            if (selected.some((p,i) => selected.indexOf(p) !== i)) issues.push('Un privilegio o una Maestria è stato scelto più volte: scegli alternative diverse.')
        }
        for (const c of creationChoices(sheet,data).filter((x) => x.choice.type === 'expertise')) for (const selected of resolveChoice(c.choice,c.path,d,data)) {
            const skill = data.skills.find((x) => `skill-${x.index}` === selected.ref.index)
            if (skill && d[skill.playerDetailsKeys.proficient] !== 'true') issues.push('La Maestria va scelta in un’abilità in cui hai già competenza.')
        }
    }
    if (step === 6) {
        const rules = spellRules(sheet, data), selection = spellSelection(sheet, data)
        issues.push(...selection.issues)
        if (selection.cantrips < rules.cantrips) issues.push(`Scegli ${rules.cantrips} trucchetti di classe (ora ${selection.cantrips}).`)
        if (rules.known !== undefined && selection.spells < rules.known) issues.push(`Scegli ${rules.known} incantesimi ${d['creation.class'] === 'wizard' ? 'per il libro' : 'di classe'} (ora ${selection.spells}).`)
        if (rules.prepared && selection.prepared < rules.preparedLimit) issues.push(`Prepara ${rules.preparedLimit} incantesimi (ora ${selection.prepared}).`)
    }
    if (step === 8) {
        for (let i = 0; i < 8; i++) issues.push(...tutorialIssues(sheet, data, i))
        issues.push(...characterCalculationIssues(sheet))
    }
    return [...new Set(issues)]
}

export function changeTutorialOrigin(sheet: CharacterSheet, data: CreationData, kind: 'class' | 'race' | 'subrace' | 'subclass' | 'background' | 'edition' | 'level', value: string) {
    const d = { ...sheet.playerDetails }, next = { ...sheet, playerDetails: d }
    const oldClass = d['creation.class'] ?? '', oldEdition = spellEdition(sheet)
    const config = (s: CharacterSheet) => `${spellEdition(s)}.${s.playerDetails?.['creation.class'] ?? ''}.${s.level}`
    const saveSpells = ['class','edition','level'].includes(kind)
    if (saveSpells) d[`tutorial.spells.${config(sheet)}`] = JSON.stringify(Object.fromEntries(Object.entries(d).filter(([k]) => k.startsWith('spell.'))))
    if (kind === 'edition') d['rules.edition'] = value
    else if (kind === 'level') next.level = value
    else d[`creation.${kind}`] = value
    const origins = selectedOrigins(next,data)
    if (kind === 'class') next.characterClass = origins.characterClass ? labelOf(origins.characterClass) : ''
    if (kind === 'race') next.race = origins.race ? labelOf(origins.race) : ''
    if (kind === 'background') d.background = origins.background ? labelOf(origins.background) : ''
    if (kind === 'class' || kind === 'edition') {
        d[`tutorial.subclass.${oldEdition}.${oldClass}`] = sheet.playerDetails?.['creation.subclass'] ?? ''
        d['creation.subclass'] = d[`tutorial.subclass.${spellEdition(next)}.${d['creation.class'] ?? ''}`] ?? ''
    }
    if (kind === 'race') {
        d[`tutorial.subrace.${sheet.playerDetails?.['creation.race'] ?? ''}`] = d['creation.subrace'] ?? ''
        d['creation.subrace'] = d[`tutorial.subrace.${value}`] ?? ''
    }
    if (saveSpells) {
        const archive = d[`tutorial.spells.${config(next)}`]
        if (archive) {
            try { const saved = JSON.parse(archive); if (saved && typeof saved === 'object' && !Array.isArray(saved) && Object.entries(saved).every(([k,v]) => k.startsWith('spell.') && typeof v === 'string')) {
                for (const k of Object.keys(d).filter((k) => k.startsWith('spell.'))) delete d[k]
                Object.assign(d,saved)
            } } catch { /* Una vecchia annotazione non valida non deve cancellare le scelte attuali. */ }
        }
        const pool = spellRules(next,data).spells
        for (const [key,name] of Object.entries(d).filter(([k,v]) => /^spell\.\d+\.\d+\.name$/.test(k) && v.trim())) {
            const root = key.slice(0,-5), parts = root.split('.')
            if (spellRowState(next, Number(parts[1]), Number(parts[2])).source !== 'class') continue
            if (!pool.some((s) => s.index === d[`${root}.index`] || [s.name,s.nameIt,...(s.aliases ?? [])].some((n) => n?.toLowerCase() === name.toLowerCase()))) {
                for (const k of Object.keys(d).filter((k) => k.startsWith(root + '.'))) delete d[k]
            }
        }
        d['tutorial.advancement'] = 'false'
    }
    if (!subclassOptions(next,data).some((x) => x.index === d['creation.subclass'] && Number(next.level) >= subclassMinimumLevel(next,x,data))) d['creation.subclass'] = ''
    d.subclass = subclassOptions(next,data).find((x) => x.index === d['creation.subclass'])?.nameIt ?? subclassOptions(next,data).find((x) => x.index === d['creation.subclass'])?.name ?? ''
    d.subrace = selectedOrigins(next,data).subrace ? labelOf(selectedOrigins(next,data).subrace!) : ''
    d['tutorial.notice'] = 'Scelta aggiornata: controlla competenze, equipaggiamento, sottoclasse e magie. Le scelte precedenti restano conservate per origine; le magie non compatibili sono archiviate e tornano ripristinando classe, livello ed edizione.'
    if (kind === 'edition') d['tutorial.rules2024'] = 'false'
    return applyCreation(next,data)
}
