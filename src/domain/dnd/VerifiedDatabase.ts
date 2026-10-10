/** Isolated candidate loader. The running application's loader does not import this module. */
import type { CreationData, Origin } from '../../utils/PlayerCreation.ts'

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
export type RuleSource = { edition: '2014'; filename: string; pdfPages: number[]; printedPages: number[] | null; section: string; book: string; url?: string }
export type ReviewedEntity = {
    id: string; index: string; edition: '2014'; kind: string; name: string; nameIt: string | null
    mechanics: { [key: string]: Json }; relations: Record<string, string | string[]>; sources: RuleSource[]
    verification: { mechanics: string; complete: boolean; missingFields: string[] }
}
export type VerifiedOption = ReviewedEntity & {
    kind: 'class-option'
    mechanics: {
        optionType: 'eldritch-invocation' | 'pact-boon'
        prerequisites: { minimumWarlockLevelForSelection: number; pactOptionId?: string; knownCantripId?: string }
        effect: { [key: string]: Json }
    }
}
export type CandidateCreationData = CreationData & {
    edition: '2014'; candidateReleaseId: string; reviewedEntities: ReviewedEntity[]; verifiedOptions: VerifiedOption[]
    /** Legacy records remain available, but are not automatically certified by this adapter. */
    legacyVerification: 'preserved-not-fully-reverified'
}
type Manifest = { schemaVersion: number; releaseId: string; runtimeActivated: boolean; status: string; editionPolicy: string; files: Record<string, string> }
type Fetcher = (url: string) => Promise<Pick<Response, 'ok' | 'text'>>
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const list = (value: unknown): value is Record<string, unknown>[] => Array.isArray(value) && value.every(object)
function classLevels(levels: Record<string, number>): number {
    const values = Object.values(levels)
    if (values.some((x) => !Number.isInteger(x) || x < 0 || x > 20) || values.reduce((sum, x) => sum + x, 0) > 20) throw new Error('Livelli di classe non validi.')
    return values.reduce((sum, x) => sum + x, 0)
}

/** Verify the exact bytes consumed by the adapter against the immutable release manifest. */
export async function loadCandidateCreationData(baseUrl: string, fetcher: Fetcher = fetch): Promise<CandidateCreationData> {
    if (!baseUrl.trim()) throw new Error('Specificare la directory della release candidata.')
    const base = baseUrl.replace(/\/$/, '')
    const getText = async (file: string) => {
        const response = await fetcher(`${base}/${file}`)
        if (!response.ok) throw new Error(`Impossibile caricare ${file}.`)
        return response.text()
    }
    const manifest: unknown = JSON.parse(await getText('RELEASE.json'))
    if (!object(manifest) || manifest.schemaVersion !== 1 || typeof manifest.releaseId !== 'string'
        || manifest.runtimeActivated !== false || manifest.status !== 'partial-candidate-not-active'
        || manifest.editionPolicy !== '2014-reference-with-separate-unverified-legacy-content' || !object(manifest.files)) throw new Error('Manifesto candidato non valido.')
    const release = manifest as Manifest
    const read = async (file: string): Promise<unknown> => {
        const text = await getText(file)
        const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map((n) => n.toString(16).padStart(2, '0')).join('')
        if (release.files[file] !== hash) throw new Error(`Impronta non valida: ${file}.`)
        return JSON.parse(text)
    }
    const [options, equipment, rules, wizard, choices, reference] = await Promise.all([
        'data/character-options.json', 'data/character-equipment.json', 'data/character-rules.json',
        'data/wizard-catalog.json', 'data/verified-options-2014.json', 'verified-reference.json',
    ].map(read))
    if (![options, equipment, rules, wizard, choices, reference].every(object)) throw new Error('Cataloghi candidati non validi.')
    const catalogs = [options, equipment, rules, wizard, choices, reference] as Record<string, unknown>[]
    const [o, e, r, w, c, ref] = catalogs
    for (const key of ['classes', 'subclasses', 'races', 'subraces', 'backgrounds', 'alignments', 'languages', 'traits', 'features', 'levels', 'spells']) {
        if (!list(o[key])) throw new Error(`Collezione non valida: ${key}.`)
    }
    if (!list(w.subclasses) || !list(e.equipment) || !list(e.equipmentCategories) || !list(r.skills)
        || c.edition !== '2014' || !list(c.options) || ref.edition !== '2014' || !list(ref.entities)) throw new Error('Edizione o collezioni non valide.')
    const entities = ref.entities as unknown as ReviewedEntity[]
    if (entities.some((x) => x.edition !== '2014') || new Set(entities.map((x) => x.id)).size !== entities.length) throw new Error('Entità di riferimento non valide.')
    const verifiedOptions = c.options as unknown as VerifiedOption[]
    if (verifiedOptions.some((x) => x.edition !== '2014' || x.kind !== 'class-option' || !x.verification.complete
        || x.verification.mechanics !== 'verified-fields' || !['pact-boon', 'eldritch-invocation'].includes(x.mechanics.optionType)
        || !Number.isInteger(x.mechanics.prerequisites.minimumWarlockLevelForSelection))) throw new Error('Opzioni non verificate o non supportate.')
    const data = { ...o, ...e, skills: r.skills, experienceThresholds: r.experienceThresholds } as unknown as CreationData
    // Preserve the existing wizard overlay's identity rules without invoking the
    // active loader or certifying the supplement/UA payloads.
    const wizardSubclasses = w.subclasses as unknown as Origin[]
    const subclasses = [...data.subclasses.map((x) => ({ ...x, ...wizardSubclasses.find((s) => s.index === x.index && s.class?.index === x.class?.index) })),
        ...wizardSubclasses.filter((x) => !data.subclasses.some((s) => s.index === x.index))]
    const features = [...data.features, ...wizardSubclasses.flatMap((x) => x.features ?? []).filter((x) => !data.features.some((f) => f.index === x.index))]
    return { ...data, subclasses, features, edition: '2014', candidateReleaseId: release.releaseId, reviewedEntities: entities,
        verifiedOptions, legacyVerification: 'preserved-not-fully-reverified' }
}

export type ChoiceContext = { edition: '2014' | '2024'; classLevels: Record<string, number>; knownCantripIds: string[]; pactOptionId?: string }
export function optionIssues(option: VerifiedOption, context: ChoiceContext): string[] {
    classLevels(context.classLevels)
    const issues: string[] = []
    if (context.edition !== '2014' || option.edition !== '2014') issues.push('Questa opzione richiede le regole 2014.')
    if (!option.verification.complete || option.verification.mechanics !== 'verified-fields') issues.push('Opzione non verificata.')
    const p = option.mechanics.prerequisites
    if ((context.classLevels.warlock ?? 0) < p.minimumWarlockLevelForSelection) issues.push(`Richiede il livello ${p.minimumWarlockLevelForSelection} da warlock.`)
    if (p.pactOptionId && p.pactOptionId !== context.pactOptionId) issues.push('Richiede il dono del patto indicato.')
    if (p.knownCantripId && !context.knownCantripIds.includes(p.knownCantripId)) issues.push('Richiede il trucchetto indicato.')
    return issues
}

export type ResourcePool = { maximum: number; used: number; recovery: ('short-rest' | 'long-rest')[] }
export function recoverResource(pool: ResourcePool, rest: 'short-rest' | 'long-rest'): ResourcePool {
    if (!Number.isInteger(pool.maximum) || !Number.isInteger(pool.used) || pool.maximum < 0 || pool.used < 0 || pool.used > pool.maximum) throw new Error('Risorsa non valida.')
    return { ...pool, recovery: [...pool.recovery], used: pool.recovery.includes(rest) ? 0 : pool.used }
}

/** Class levels determine Pact Magic; total levels determine proficiency. */
export function warlockProgression(data: CandidateCreationData, levels: Record<string, number>) {
    const total = classLevels(levels), level = levels.warlock ?? 0
    if (data.edition !== '2014' || level < 1) throw new Error('Richiede un livello da warlock 2014.')
    const record = data.reviewedEntities.find((x) => x.id === `phb2014:class-level:warlock-${level}`)
    if (!record || record.verification.mechanics !== 'verified-fields') throw new Error('Progressione non verificata.')
    const m = record.mechanics
    const slots = m.pactSlots as { count: number; level: number; recovery: ('short-rest' | 'long-rest')[] }
    return { level, proficiencyBonus: 2 + Math.floor((total - 1) / 4), invocationsKnown: m.invocationsKnown as number,
        spellsKnown: m.spellsKnown as number, cantripsKnown: m.cantripsKnown as number, pactSlotLevel: slots.level,
        pactSlots: { maximum: slots.count, used: 0, recovery: [...slots.recovery] } satisfies ResourcePool,
        mysticArcanumLevels: m.mysticArcanumLevels as number[] }
}

export function invocationSelectionIssues(data: CandidateCreationData, selectedIds: string[], context: ChoiceContext): string[] {
    const issues: string[] = []
    if (new Set(selectedIds).size !== selectedIds.length) issues.push('Invocazioni duplicate.')
    if (selectedIds.length > warlockProgression(data, context.classLevels).invocationsKnown) issues.push('Numero di invocazioni superiore al limite verificato.')
    for (const id of selectedIds) {
        const option = data.verifiedOptions.find((x) => x.id === id && x.mechanics.optionType === 'eldritch-invocation')
        if (!option) issues.push(`Invocazione non riconosciuta: ${id}.`)
        else issues.push(...optionIssues(option, context))
    }
    return issues
}

/** Expanded patron spells are eligible choices, never automatic grants. */
export function patronExpandedSpellChoices(data: CandidateCreationData, patronId: string, maximumSpellLevel: number): string[] {
    const patron = data.reviewedEntities.find((x) => x.id === patronId && x.kind === 'subclass' && x.relations.classId === 'phb2014:class:warlock')
    if (!patron?.verification.complete) throw new Error('Patrono non verificato.')
    const rows = patron.mechanics.expandedSpellChoices as { spellLevel: number; spellIds: string[]; automaticallyKnown: boolean }[]
    return rows.filter((x) => x.spellLevel <= maximumSpellLevel && x.automaticallyKnown === false).flatMap((x) => x.spellIds)
}
