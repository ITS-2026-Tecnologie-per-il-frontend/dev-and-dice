import { abilityModifier, characterLevel, integerValue, type CharacterSheet } from './CharacterSheets.ts'
import type { CreationData } from './PlayerCreation.ts'
import { classId, spellEdition, spellProfile, spellRowState, spellLimitIssue, type SpellSelectionLimit } from './Spellcasting.ts'

// Regole 2014: SRD 5.1; regole 2024: SRD 5.2.1 (CC BY 4.0), https://www.dndbeyond.com/srd.
export function wizardRules(sheet: CharacterSheet) {
    const edition = spellEdition(sheet), level = characterLevel(sheet) ?? 0
    const wizard = classId(sheet) === 'wizard'
    const subclass = sheet.playerDetails?.['creation.subclass']
    const evocation = wizard && subclass === 'evocation'
    const school = subclass === 'evocation' ? 'evocation' : subclass?.replace(/^wizard-/, '')
    const savantSchool = wizard && edition === '2014' && level >= 2 && ['abjuration','conjuration','divination','enchantment','evocation','illusion','necromancy','transmutation'].includes(school ?? '') ? school : undefined
    return { wizard, edition, level, bookMinimum: level ? 6 + 2 * (level - 1) : 0, recoveryBudget: Math.ceil(level / 2),
        savantSchool, savantDiscount: !!savantSchool,
        savantChoices: evocation && edition === '2024' && level >= 3 ? 2 + Math.max(0, Math.min(9, Math.ceil(level / 2)) - 2) : 0,
        sculpt: evocation && level >= (edition === '2014' ? 2 : 6),
        potent: evocation && level >= (edition === '2014' ? 6 : 3),
        empowered: evocation && level >= 10, overchannel: evocation && level >= 14,
        mastery: wizard && level >= 18, signature: wizard && level >= 20 }
}

export function wizardWardMaximum(sheet: CharacterSheet): number | undefined {
    const level = characterLevel(sheet), intelligence = abilityModifier(sheet.intelligence)
    return level === undefined || intelligence === undefined ? undefined : Math.max(0, 2 * level + intelligence)
}

export function wizardBook(sheet: CharacterSheet, data: CreationData) {
    const d = sheet.playerDetails ?? {}
    const pool = wizardSpellPool(sheet, data)
    return Object.entries(d).filter(([key, value]) => /^spell\.\d+\.\d+\.name$/.test(key) && value.trim()).flatMap(([key, name]) => {
        const root = key.slice(0, -5), level = Number(root.split('.')[1]), index = Number(root.split('.')[2])
        const state = spellRowState(sheet, level, index)
        if (state.source !== 'class') return []
        const spell = pool.find((x) => x.index === d[`${root}.index`] || [x.name, x.nameIt, ...(x.aliases ?? [])].some((n) => n?.toLowerCase() === name.trim().toLowerCase()))
        return [{ root, name: spell?.nameIt ?? name, level, state, spell }]
    })
}

function integer(value: string | undefined, label: string) {
    const n = Number(value ?? '0')
    if (!Number.isSafeInteger(n) || n < 0 || n > 1000000) throw new Error(`${label}: inserisci un intero non negativo valido.`)
    return n
}

export function copyCost(sheet: CharacterSheet, spell: CreationData['spells'][number]) {
    const r = wizardRules(sheet), d = sheet.playerDetails ?? {}, subclass = d['creation.subclass']
    const discount = r.savantDiscount && spell.school?.index === r.savantSchool
    const quill = r.wizard && r.edition === '2014' && r.level >= 2 && d['wizard.quill'] === 'true'
    const ua = quill && subclass === 'wizard-order-of-scribes-ua'
    const scribes = quill && subclass === 'wizard-order-of-scribes'
    const tech = r.wizard && r.edition === '2014' && r.level >= 2 && subclass === 'wizard-technomancy-ua'
    return { gold: spell.level * (discount || ua || tech ? 25 : 50), hours: spell.level * (scribes ? 1 / 30 : discount || ua ? 1 : 2) }
}

export function recoverWizardSlots(sheet: CharacterSheet, counts: Record<number, string>) {
    const rules = wizardRules(sheet), d = { ...sheet.playerDetails }
    if (!rules.wizard || d['wizard.recovery.used'] === 'true') throw new Error('Recupero Arcano non disponibile. Inizia una nuova giornata dopo il riposo lungo.')
    let cost = 0
    for (const [key, value] of Object.entries(counts)) {
        const level = Number(key), count = integer(value, 'Slot da recuperare')
        if (!Number.isInteger(level) || level < 1 || level > 5) throw new Error('Recupero Arcano consente solo slot dal livello 1 al 5.')
        const used = integer(d[`slots.${level}.used`], 'Slot spesi'), total = integer(d[`slots.${level}.total`], 'Slot totali')
        if (count > used || used > total) throw new Error('Puoi recuperare solo slot effettivamente spesi.')
        cost += level * count
        d[`slots.${level}.used`] = String(used - count)
    }
    if (!cost || cost > rules.recoveryBudget) throw new Error(`Scegli slot per un totale di livelli tra 1 e ${rules.recoveryBudget}.`)
    const rune = savedWizardFeatures(sheet).find((x) => x.name === 'Runic Empowerment')
    if (rune && savedWizardFeatures(sheet).some((x) => x.name === 'Rune Maven')) {
        const gain = Math.max(1, Math.ceil((abilityModifier(sheet.intelligence) ?? 0) / 2))
        d[featureResourceKey(rune)] = String(Math.min(featureResourceMax(sheet,rune), featureResourceRemaining(sheet,rune) + gain))
    }
    d['wizard.recovery.used'] = 'true'
    return { ...sheet, playerDetails: d }
}

export function wizardRest(sheet: CharacterSheet, long: boolean) {
    if (!wizardRules(sheet).wizard) throw new Error('Questi riposi gestiscono le risorse del mago.')
    const d = { ...sheet.playerDetails }
    for (const key of Object.keys(d)) if (/^wizard\.signature\.used\./.test(key)) d[key] = 'false'
    if (long) {
        for (let level = 1; level <= 9; level++) d[`slots.${level}.used`] = '0'
        d['wizard.recovery.used'] = 'false'
        d['wizard.overchannel.used'] = '0'
        d['wizard.longRest.completed'] = 'true'
        d['wizard.cantripReplacement.used'] = 'false'
        d['wizard.fastRitual.used'] = 'false'
        d['wizard.ward.created'] = 'false'
        d['wizard.ward.current'] = '0'
        for (let i = 0; i < 3; i++) { delete d[`wizard.portent.${i}`]; delete d[`wizard.portent.${i}.used`] }
    }
    for (const feature of savedWizardFeatures(sheet)) {
        if (!feature.resource) continue
        const current = featureResourceRemaining(sheet, feature)
        if (long || feature.resource.reset === 'short') d[featureResourceKey(feature)] = String(feature.resource.initial ?? featureResourceMax(sheet, feature))
        else if (feature.resource.shortMinimum) d[featureResourceKey(feature)] = String(Math.max(current, feature.resource.shortMinimum))
    }
    return { ...sheet, playerDetails: d }
}

export function copyWizardSpell(sheet: CharacterSheet, data: CreationData, index: string) {
    const spell = data.spells.find((x) => x.index === index)
    const rules = wizardRules(sheet), d = { ...sheet.playerDetails }
    if (!rules.wizard || !spell || spell.level < 1 || !spell.classes.some((x) => x.index === 'wizard') || spell.level > spellProfile(sheet,data).maxLevel) throw new Error('Scegli un incantesimo da mago di un livello disponibile.')
    const lost = wizardBook(sheet, data).find((row) => row.spell?.index === index && d[`${row.root}.lost`] === 'true')
    if (!lost && wizardBook(sheet, data).some((row) => row.spell?.index === index)) throw new Error('Questo incantesimo è già nel libro.')
    const cost = copyCost(sheet, spell), gold = integer(d['coins.MO'], 'Monete d’oro')
    if (gold < cost.gold) throw new Error(`Servono ${cost.gold} MO per copiare questo incantesimo.`)
    let row = lost ? Number(lost.root.split('.')[2]) : 0
    if (!lost) while (d[`spell.${spell.level}.${row}.name`]?.trim()) row++
    if (row >= 500) throw new Error('Il libro ha raggiunto il limite di righe per questo livello.')
    const root = `spell.${spell.level}.${row}`
    Object.assign(d, { [`${root}.name`]: spell.nameIt ?? spell.name, [`${root}.index`]: index, [`${root}.source`]: 'class', [`${root}.prepared`]: 'false', [`${root}.learned`]: 'copied',
        [`${root}.lost`]: 'false', [`${root}.note`]: `Copiato: ${cost.gold} MO, ${cost.hours} ore`, [`spell.rows.${spell.level}`]: String(Math.max(row + 1, Number(d[`spell.rows.${spell.level}`]) || 8)), 'coins.MO': String(gold - cost.gold) })
    return { ...sheet, playerDetails: d }
}

export type WizardCast = { root: string; slot: number; mode: 'slot' | 'ritual' | 'mastery' | 'signature' | 'feature'; overchannel: boolean; selfDamage: string; empowered: boolean; dice: string; damage: string; outcome: 'hit' | 'save' | 'miss'; targets: string[]; confirmFeatureConditions?: boolean; fastRitual?: boolean; recoverSlot?: number; createWard?: boolean }
export function castWizardSpell(sheet: CharacterSheet, data: CreationData, cast: WizardCast) {
    const rules = wizardRules(sheet), row = wizardBook(sheet, data).find((x) => x.root === cast.root), d = { ...sheet.playerDetails }
    if (!rules.wizard || !row?.spell) throw new Error('Scegli un incantesimo del libro riconosciuto nel database.')
    if (d[`${row.root}.lost`] === 'true') throw new Error('Questo incantesimo è nel libro perduto: ritrovalo e copialo prima del lancio.')
    const { spell, level, state } = row
    if (!['slot', 'ritual', 'mastery', 'signature', 'feature'].includes(cast.mode) || !['hit', 'save', 'miss'].includes(cast.outcome)) throw new Error('Modalità o esito del lancio non valido.')
    if (spell.level !== level || !spell.classes.some((x) => x.index === 'wizard') || (level > 0 && !Number(d[`slots.${level}.total`]))) throw new Error('Incantesimo non valido per il libro o il livello del mago.')
    if (!Number.isInteger(cast.slot) || cast.slot < level || cast.slot > 9 || (!level && cast.slot !== 0)) throw new Error('Livello dello slot non valido.')
    const base = cast.slot === level
    if (cast.mode === 'ritual') {
        if (!spell.ritual || !level || !base || cast.overchannel || cast.empowered) throw new Error('Questo lancio non può essere un rituale: usa il livello base senza privilegi di danno.')
    } else {
        if (cast.mode === 'feature') {
            const grant = wizardFeatureGrants(sheet, data).find((x) => x.index === spell.index && x.free)
            if (!grant || !base || !cast.confirmFeatureConditions) throw new Error('Lancio del privilegio: usa il livello base e conferma le condizioni indicate nella descrizione.')
            if (grant.feature.resource) {
                const spent = spendWizardFeature(sheet, grant.feature)
                Object.assign(d, spent.playerDetails)
            }
        } else if (!state.available) throw new Error('Prepara questo incantesimo prima di lanciarlo.')
        if (cast.mode === 'mastery' && (!rules.mastery || !base || d[`wizard.mastery.${level}`] !== row.root || (rules.edition === '2024' && spell.casting_time !== '1 action'))) throw new Error('Spell Mastery richiede una scelta valida, preparata, al suo livello base.')
        if (cast.mode === 'signature' && (!rules.signature || !base || level !== 3 || ![d['wizard.signature.0'], d['wizard.signature.1']].includes(row.root) || d[`wizard.signature.used.${row.root}`] === 'true')) throw new Error('Incantesimo caratteristico non disponibile: scegli un altro lancio o completa un riposo.')
        if (cast.mode === 'signature') d[`wizard.signature.used.${row.root}`] = 'true'
        if (level && cast.mode === 'slot') {
            const used = integer(d[`slots.${cast.slot}.used`], 'Slot spesi'), total = integer(d[`slots.${cast.slot}.total`], 'Slot totali')
            if (used >= total) throw new Error('Non hai slot disponibili di questo livello.')
            d[`slots.${cast.slot}.used`] = String(used + 1)
        }
    }
    const evocation = spell.school?.index === 'evocation'
    const targets = cast.targets.map((x) => x.trim()).filter(Boolean)
    if (targets.length && (!rules.sculpt || !evocation || cast.mode === 'ritual' || new Set(targets.map((x) => x.toLowerCase())).size !== targets.length || targets.length > 1 + cast.slot)) throw new Error('Sculpt Spells: scegli creature visibili distinte, al massimo 1 + livello dell’incantesimo, per una magia di evocazione.')
    if (cast.empowered && (!rules.empowered || !evocation || !spell.damage || cast.mode === 'ritual')) throw new Error('Empowered Evocation richiede un incantesimo di evocazione che infligge danni.')
    const messages: string[] = []
    const subclass = d['creation.subclass']
    if (cast.fastRitual) {
        if (rules.edition !== '2014' || rules.level < 2 || !['wizard-order-of-scribes','wizard-order-of-scribes-ua'].includes(subclass) || cast.mode !== 'ritual' || d['wizard.fastRitual.used'] === 'true') throw new Error('Il rituale rapido richiede Awakened Spellbook ed è utilizzabile una volta per riposo lungo.')
        d['wizard.fastRitual.used'] = 'true'
    }
    if (cast.recoverSlot) {
        const level = cast.recoverSlot
        if (rules.edition !== '2014' || subclass !== 'wizard-divination' || rules.level < 6 || spell.school?.index !== 'divination' || cast.mode !== 'slot' || cast.slot < 2 || !Number.isInteger(level) || level < 1 || level >= cast.slot || level > 5 || integer(d[`slots.${level}.used`], 'Slot spesi') < 1) throw new Error('Expert Divination: scegli uno slot speso inferiore al lancio, massimo livello 5.')
        d[`slots.${level}.used`] = String(integer(d[`slots.${level}.used`], 'Slot spesi') - 1)
        messages.push(`Expert Divination: recuperato uno slot di livello ${level}.`)
    }
    if (rules.edition === '2014' && subclass === 'wizard-conjuration' && rules.level >= 6 && spell.school?.index === 'conjuration' && spell.level >= 1) {
        const transport = selectedWizardFeatures(sheet, data).find((x) => x.name === 'Benign Transportation')
        if (transport) d[featureResourceKey(transport)] = '1'
    }
    const wardEligible = rules.edition === '2014' && subclass === 'wizard-abjuration' && rules.level >= 2 && spell.school?.index === 'abjuration' && cast.slot >= 1
    if (cast.createWard && (!wardEligible || d['wizard.ward.created'] === 'true')) throw new Error('Arcane Ward si crea con abiurazione di livello 1+ una sola volta per riposo lungo.')
    if (wardEligible && (cast.createWard || d['wizard.ward.created'] === 'true')) {
        const max = wizardWardMaximum(sheet)
        if (max === undefined) throw new Error('Inserisci livello e Intelligenza validi per calcolare i PF della barriera.')
        d['wizard.ward.current'] = String(cast.createWard ? max : Math.min(max, integer(d['wizard.ward.current'], 'PF barriera') + 2 * cast.slot))
        d['wizard.ward.created'] = 'true'
        messages.push(`Arcane Ward: ${d['wizard.ward.current']}/${max} PF.`)
    }
    let damage = cast.damage === '' ? undefined : integer(cast.damage, 'Danno del tiro')
    if (damage !== undefined && !spell.damage) throw new Error('Questa magia non ha danni strutturati nel database: lascia vuoto il campo del danno.')
    if (cast.overchannel) {
        if (!rules.overchannel || !spell.damage || cast.slot < 1 || cast.slot > 5 || cast.mode === 'ritual' || (rules.edition === '2024' && cast.mode !== 'slot')) throw new Error('Overchannel richiede una magia da mago che infligge danni, di livello 1–5; nel 2024 deve consumare uno slot.')
        // ponytail: un tiro ndm ± bonus; per formule con più tipi di dado serve un parser di espressioni.
        const dice = /^(\d{1,3})d(\d{1,3})(?:\s*([+-])\s*(\d{1,5}))?$/.exec(cast.dice.trim())
        if (!dice || Number(dice[1]) < 1 || Number(dice[2]) < 2) throw new Error('Inserisci i dadi del tiro da massimizzare, per esempio 8d6 o 2d8+3.')
        damage = Number(dice[1]) * Number(dice[2]) + (dice[3] === '-' ? -1 : 1) * Number(dice[4] || 0)
        const used = integer(d['wizard.overchannel.used'], 'Usi di Overchannel'), diceCount = used ? (used + 1) * cast.slot : 0
        if (diceCount) {
            const self = integer(cast.selfDamage, 'Danno necrotico subito')
            if (self < diceCount || self > 12 * diceCount) throw new Error(`Tira ${diceCount}d12 e inserisci il danno subito (${diceCount}–${12 * diceCount}).`)
            if (!sheet.hitPoints.trim()) throw new Error('Inserisci i PF attuali prima di applicare il danno necrotico.')
            const hp = integer(sheet.hitPoints, 'PF attuali'), temp = integer(d.temporaryHitPoints, 'PF temporanei')
            d.temporaryHitPoints = String(Math.max(0, temp - self))
            sheet = { ...sheet, hitPoints: String(Math.max(0, hp - Math.max(0, self - temp))) }
            messages.push(`Overchannel: ${self} danni necrotici subiti (${diceCount}d12), ignorando resistenze e immunità.`)
        }
        d['wizard.overchannel.used'] = String(used + 1)
        messages.push(`Overchannel: danno massimo${rules.edition === '2024' ? ' nel turno del lancio' : ''}.`)
    }
    if (cast.empowered) {
        const intelligence = sheet.intelligence.trim() ? Number(sheet.intelligence) : NaN
        if (!Number.isSafeInteger(intelligence)) throw new Error('Inserisci Intelligenza per calcolare Empowered Evocation.')
        const bonus = Math.floor((intelligence - 10) / 2)
        if (damage !== undefined) damage += bonus
        messages.push(`Empowered Evocation: ${bonus >= 0 ? '+' : ''}${bonus} a un solo tiro di danno.`)
    }
    const potent = rules.potent && level === 0 && !!spell.damage && (cast.outcome === 'save' && !!spell.dc || rules.edition === '2024' && cast.outcome === 'miss' && !!spell.attack_type)
    if (potent) {
        if (damage !== undefined) damage = Math.floor(Math.max(0, damage) / 2)
        messages.push('Potent Cantrip: metà danno, senza effetti aggiuntivi.')
    } else if (cast.outcome !== 'hit') messages.push('Esito del bersaglio: applica le indicazioni dell’incantesimo per tiro salvezza riuscito o attacco mancato.')
    if (damage !== undefined) messages.push(`Danno del tiro: ${Math.max(0, damage)}${cast.outcome !== 'hit' && !potent ? ' prima delle riduzioni del bersaglio' : ''}.`)
    if (targets.length) messages.push(`Sculpt Spells: ${targets.join(', ')} superano il TS; nessun danno quando il TS normalmente lo dimezza.`)
    if (cast.mode === 'ritual') messages.push(cast.fastRitual ? 'Rituale rapido: nessuno slot consumato, tempo di lancio normale.' : 'Rituale: nessuno slot consumato, aggiungi 10 minuti al tempo di lancio.')
    d['wizard.lastCast'] = `${row.name} (${cast.mode === 'ritual' ? 'rituale' : `livello ${cast.slot}`}). ${messages.join(' ')}`
    return { ...sheet, playerDetails: d }
}

export function wizardBookLimits(sheet: CharacterSheet, data: CreationData): SpellSelectionLimit[] {
    const rules = wizardRules(sheet)
    if (!rules.wizard) return []
    const book = wizardBook(sheet,data).filter((x) => x.level > 0), d = sheet.playerDetails ?? {}
    const learned = book.filter((x) => !['copied','savant','feature'].includes(d[`${x.root}.learned`]))
    const limits: SpellSelectionLimit[] = [{ id:'wizard-book', kind:'level', label:'Libro · scelte iniziali e di avanzamento', maximum:rules.bookMinimum, roots:learned.map((x) => x.root), reason:'Sei magie di livello 1 iniziali, poi due per ogni livello da mago. Le copie e le magie concesse non consumano queste scelte.' }]
    for (let level = 2; level <= 9; level++) {
        const eligible = Math.max(0, 2 * (rules.level - (2 * level - 1) + 1))
        limits.push({ id:`wizard-level-${level}`, kind:'level', minimumLevel:level, label:`Avanzamenti · livello ${level} o superiore`, maximum:eligible, roots:learned.filter((x) => x.level >= level).map((x) => x.root), reason:`Le magie di livello ${level} si sbloccano al livello ${2 * level - 1} da mago. Da allora ottieni due nuove scelte per livello: quelle di livello superiore condividono questo limite. Le copie sono escluse.` })
    }
    const savant = book.filter((x) => d[`${x.root}.learned`] === 'savant')
    limits.push({ id:'wizard-savant', kind:'savant', label:'Evocation Savant · scelte gratuite', maximum:rules.savantChoices, roots:savant.map((x) => x.root), reason:'Nel 2024: due magie della scuola Evocation di livello 1–2 dal livello 3, poi una per ogni nuovo livello di slot.' })
    // Una scelta gratuita per ogni nuovo livello di slot, oltre alle due iniziali di livello 1–2.
    for (let max = 2; max <= 9; max++) limits.push({ id:`wizard-savant-${max+1}`, kind:'savant', minimumLevel:max+1, label:`Evocation Savant · livello ${max+1} o superiore`, maximum:Math.max(0,rules.savantChoices-max), roots:savant.filter((x) => x.level > max).map((x) => x.root), reason:'Le scelte di Evocation Savant devono includere le due magie iniziali di livello 1–2; poi una scelta per ogni nuovo livello di slot.' })
    return limits
}

export function wizardBookIssues(sheet: CharacterSheet, data: CreationData, limits = wizardBookLimits(sheet,data)) {
    const rules = wizardRules(sheet)
    if (!rules.wizard) return []
    const book = wizardBook(sheet,data).filter((x) => x.level > 0), d = sheet.playerDetails ?? {}
    const issues = limits.filter((x) => x.roots.length > x.maximum).map(spellLimitIssue)
    if (book.some((x) => d[`${x.root}.learned`] === 'savant' && x.spell?.school?.index !== 'evocation')) issues.push('Evocation Savant: scegli solo incantesimi della scuola Evocation oppure correggi il tipo di acquisizione.')
    if (book.some((x) => x.level > Math.ceil(rules.level / 2) || !x.spell?.classes.some((c) => c.index === 'wizard'))) issues.push('Il libro contiene magie non riconosciute o di un livello non disponibile: verifica con il DM.')
    return issues
}

export function wizardFeatures2024(sheet: CharacterSheet) {
    const r = wizardRules(sheet)
    const features: [number, string, string][] = [
        [1, 'Spellcasting', 'Intelligenza per CD e attacchi magici. Il numero di preparati segue la tabella 2024. Libro: sei magie iniziali e due nuove scelte a ogni livello; copie aggiuntive possibili.'],
        [1, 'Ritual Adept', 'Puoi lanciare come rituali gli incantesimi rituali nel libro senza prepararli.'],
        [1, 'Arcane Recovery', `Dopo un riposo breve recupera al massimo ${r.recoveryBudget} livelli di slot spesi, ciascuno di livello 1–5. Una volta per riposo lungo.`],
        [2, 'Scholar', 'Scegli una competenza tra Arcano, Storia, Indagare, Medicina, Natura e Religione: ottieni maestria.'],
        [3, 'Wizard Subclass', 'Scegli la sottoclasse al livello 3.'],
        [5, 'Memorize Spell', 'Dopo un riposo breve puoi sostituire un incantesimo preparato di livello 1 o superiore con uno del libro.'],
        [18, 'Spell Mastery', 'Scegli una magia di livello 1 e una di livello 2 con tempo di lancio di un’azione: sempre preparate e gratuite al livello base. Puoi cambiarne una dopo un riposo lungo.'],
        [19, 'Epic Boon', 'Scegli un talento Dono Epico o un altro talento per cui soddisfi i requisiti.'],
        [20, 'Signature Spells', 'Scegli due magie di livello 3 dal libro: sempre preparate, fuori dal limite; un lancio gratuito ciascuna al livello 3 per riposo breve o lungo.'],
    ]
    for (const level of [4, 8, 12, 16]) features.push([level, 'Ability Score Improvement', 'Scegli il talento Ability Score Improvement o un altro talento per cui soddisfi i requisiti.'])
    if (sheet.playerDetails?.['creation.subclass'] === 'evocation') features.push(
        [3, 'Evocation Savant', 'Due scelte gratuite di evocazione di livello 1–2 nel libro; una scelta gratuita aggiuntiva a ogni nuovo livello di slot. Nessuno sconto sulla copia.'],
        [3, 'Potent Cantrip', 'I trucchetti che infliggono danni causano metà danno su TS riuscito o attacco mancato, senza effetti aggiuntivi.'],
        [6, 'Sculpt Spells', 'Quando lanci una magia di evocazione, scegli al massimo 1 + livello della magia creature visibili: superano il TS e non subiscono danni se normalmente il TS li dimezza.'],
        [10, 'Empowered Evocation', 'Aggiungi il modificatore di Intelligenza a un solo tiro di danno di una magia da mago di evocazione.'],
        [14, 'Overchannel', 'Quando lanci una magia da mago con uno slot di livello 1–5 puoi massimizzarne i danni nel turno del lancio. Primo uso gratuito; riutilizzi: 2d12 per livello di slot, poi +1d12 per livello a ogni uso. Il danno necrotico ignora resistenze e immunità. Recupero al riposo lungo.'],
    )
    return features.filter(([level]) => level <= r.level).sort((a, b) => a[0] - b[0]).map(([level, name, text]) => `${name} (livello ${level})\n${text}`).join('\n\n')
}

export function replaceWizardCantrip(sheet: CharacterSheet, data: CreationData, root: string, index: string) {
    const r = wizardRules(sheet), d = { ...sheet.playerDetails }, old = wizardBook(sheet, data).find((x) => x.root === root && x.level === 0)
    const next = data.spells.find((x) => x.index === index && x.level === 0 && x.classes.some((c) => c.index === 'wizard'))
    if (!r.wizard || (r.edition === '2014' && (r.level < 3 || d['wizard.cantripFormulas'] !== 'true'))) throw new Error('Cantrip Formulas richiede livello 3 e attivazione della regola opzionale 2014.')
    if (d['wizard.longRest.completed'] !== 'true' || d['wizard.cantripReplacement.used'] === 'true') throw new Error('Puoi sostituire un solo trucchetto dopo aver confermato un riposo lungo.')
    if (!old || !next || wizardBook(sheet, data).some((x) => x.level === 0 && x.spell?.index === index)) throw new Error('Scegli un trucchetto conosciuto e uno nuovo dalla lista del mago.')
    Object.assign(d, { [`${root}.name`]: next.nameIt ?? next.name, [`${root}.index`]: index, 'wizard.cantripReplacement.used': 'true' })
    return { ...sheet, playerDetails: d }
}

const wizardScores = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const
export function improveWizard(sheet: CharacterSheet, level: number, first: string, second: string, feat = '', recorded = false) {
    const r = wizardRules(sheet), d = { ...sheet.playerDetails }, key = `wizard.improvement.${level}`
    if (!r.wizard || !(r.edition === '2014' ? [4,8,12,16,19] : [4,8,12,16]).includes(level) || r.level < level || d[key]) throw new Error('Questo aumento non è disponibile o è già stato registrato.')
    const next = { ...sheet, playerDetails: d }
    if (recorded) d[key] = 'Già incluso nei punteggi / talenti'
    else if (feat.trim()) {
        d.feats = [d.feats?.trim(), feat.trim()].filter(Boolean).join('\n')
        d[key] = `Talento: ${feat.trim()}`
    } else {
        if (!wizardScores.includes(first as typeof wizardScores[number]) || !wizardScores.includes(second as typeof wizardScores[number])) throw new Error('Scegli due incrementi da +1; la stessa caratteristica riceve +2.')
        for (const score of wizardScores) {
            const increase = Number(score === first) + Number(score === second)
            if (!increase) continue
            const value = sheet[score].trim() ? Number(sheet[score]) : NaN
            if (!Number.isSafeInteger(value) || value < 1 || value + increase > 20) throw new Error('Gli aumenti richiedono punteggi validi e non possono superarli oltre 20.')
            next[score] = String(value + increase)
            if (d['creation.enabled'] === 'true') {
                const base = d[`creation.base.${score}`]?.trim() ? Number(d[`creation.base.${score}`]) : NaN
                if (!Number.isSafeInteger(base)) throw new Error('Inserisci i punteggi base prima di applicare gli aumenti.')
                d[`creation.base.${score}`] = String(base + increase)
            }
        }
        d[key] = `${first} +1, ${second} +1`
    }
    return next
}

export function copyWizardBook(sheet: CharacterSheet, data: CreationData, restore: boolean) {
    if (!wizardRules(sheet).wizard) throw new Error('Questa funzione richiede un mago.')
    const rows = wizardBook(sheet, data).filter((x) => x.level > 0 && !x.state.lost && (!restore || x.state.checked))
    if (!rows.length) throw new Error('Non ci sono incantesimi da trascrivere.')
    const levels = rows.reduce((total, x) => total + x.level, 0), d = { ...sheet.playerDetails }
    const gold = integer(d['coins.MO'], 'Monete d’oro')
    if (gold < levels * 10) throw new Error(`Servono ${levels * 10} MO per questa trascrizione.`)
    d['coins.MO'] = String(gold - levels * 10)
    d['wizard.bookCopy'] = JSON.stringify(rows.map(({ root, name, level, spell }) => ({ root, name, level, index: spell?.index })))
    d['wizard.bookCopy.note'] = `${restore ? 'Libro ricostruito dai preparati' : 'Copia di sicurezza'}: ${rows.length} incantesimi, ${levels * 10} MO, ${levels} ore. ${restore ? 'Le altre magie del vecchio libro devono essere ritrovate.' : ''}`
    if (!restore) d['wizard.bookBackup'] = d['wizard.bookCopy']
    if (restore) {
        const restored = new Set(rows.map((x) => x.root))
        for (const row of wizardBook(sheet, data)) if (row.level > 0 && !restored.has(row.root)) d[`${row.root}.lost`] = 'true'
        for (const row of rows) d[`${row.root}.lost`] = 'false'
    }
    return { ...sheet, playerDetails: d }
}

export function restoreWizardBackup(sheet: CharacterSheet, data: CreationData) {
    if (!wizardRules(sheet).wizard) throw new Error('Questa funzione richiede un mago.')
    const d = { ...sheet.playerDetails }
    let saved: unknown
    try { saved = JSON.parse(d['wizard.bookBackup'] || 'null') } catch { throw new Error('La copia salvata non è valida. I dati originali restano intatti.') }
    if (!Array.isArray(saved) || !saved.length || saved.length > 4500 || !saved.every((x) => x && typeof x.name === 'string' && x.name.trim() && Number.isInteger(x.level) && x.level >= 1 && x.level <= 9 && (x.index === undefined || typeof x.index === 'string'))) throw new Error('La copia salvata non è valida. I dati originali restano intatti.')
    const book = wizardBook(sheet, data)
    for (const row of book) if (row.level > 0) d[`${row.root}.lost`] = 'true'
    for (const spell of saved) {
        const existing = book.find((x) => x.level === spell.level && (spell.index && x.spell?.index === spell.index || x.name === spell.name))
        let index = existing ? Number(existing.root.split('.')[2]) : 0
        if (!existing) while (d[`spell.${spell.level}.${index}.name`]?.trim()) index++
        if (index >= 500) throw new Error('Troppe righe nel livello del libro: non è stata applicata alcuna modifica.')
        const root = `spell.${spell.level}.${index}`
        Object.assign(d, { [`${root}.name`]: spell.name, [`${root}.index`]: spell.index ?? '', [`${root}.source`]: 'class', [`${root}.lost`]: 'false', [`spell.rows.${spell.level}`]: String(Math.max(index + 1, Number(d[`spell.rows.${spell.level}`]) || 8)) })
    }
    d['wizard.bookCopy.note'] = 'Copia di sicurezza recuperata: le magie presenti nella copia sono di nuovo nel libro; le aggiunte successive restano da ritrovare.'
    return { ...sheet, playerDetails: d }
}

export function wizardFeatureSelected(sheet: CharacterSheet, feature: import('./PlayerCreation.ts').ClassFeature, data: CreationData) {
    if (!feature.choice) return true
    const used = new Set<string>()
    for (const level of [6, 10, 14]) {
        if (Number(sheet.level) < level) break
        const id = sheet.playerDetails?.[`wizard.subclass.choice.${level}`]
        const chosen = data.features.find((x) => x.index === id && x.choice && x.subclass?.index === sheet.playerDetails?.['creation.subclass'] && x.level <= level)
        if (!chosen || used.has(chosen.index)) continue
        used.add(chosen.index)
        if (chosen.index === feature.index) return true
    }
    return false
}

export function selectedWizardFeatures(sheet: CharacterSheet, data: CreationData) {
    if (classId(sheet) !== 'wizard' || spellEdition(sheet) !== '2014' || Number(sheet.level) < 2) return []
    return data.features.filter((x) => x.class.index === 'wizard' && x.subclass?.index === sheet.playerDetails?.['creation.subclass'] && x.level <= Number(sheet.level) && x.activation && wizardFeatureSelected(sheet, x, data))
}

export function savedWizardFeatures(sheet: CharacterSheet): import('./PlayerCreation.ts').ClassFeature[] {
    if (classId(sheet) !== 'wizard' || spellEdition(sheet) !== '2014') return []
    try {
        const raw: unknown = JSON.parse(sheet.playerDetails?.['wizard.featureRules'] || '[]')
        return Array.isArray(raw) ? raw.filter((x) => x && typeof x.index === 'string' && typeof x.name === 'string' && ['active','passive'].includes(x.activation) && Number.isInteger(x.level) && x.level <= Number(sheet.level) && x.subclass?.index === sheet.playerDetails?.['creation.subclass'] && (x.rounds === undefined || Number.isSafeInteger(x.rounds) && x.rounds >= 0) && (x.resource === undefined || x.resource && ['short','long'].includes(x.resource.reset) && (typeof x.resource.max === 'number' && Number.isSafeInteger(x.resource.max) && x.resource.max >= 0 && x.resource.max <= 1000 || ['proficiency','intelligence','half-level','channel-arcana'].includes(x.resource.max)) && (x.resource.key === undefined || typeof x.resource.key === 'string') && [x.resource.initial,x.resource.shortMinimum].every((n: unknown) => n === undefined || typeof n === 'number' && Number.isSafeInteger(n) && n >= 0)) && Array.isArray(x.desc) && x.desc.every((v: unknown) => typeof v === 'string')) : []
    } catch { return [] }
}

export function featureResourceMax(sheet: CharacterSheet, feature: import('./PlayerCreation.ts').ClassFeature) {
    const value = feature.resource?.max, level = wizardRules(sheet).level
    if (feature.name === 'Portent' && level >= 14) return 3
    if (typeof value === 'number') return Math.max(0, Math.min(1000, Math.trunc(value)))
    if (value === 'proficiency') return Math.max(0, integerValue(sheet.playerDetails?.proficiencyBonus) ?? (level ? 2 + Math.floor((level - 1) / 4) : 0))
    if (value === 'intelligence') {
        const intelligence = abilityModifier(sheet.intelligence)
        return intelligence === undefined ? 0 : Math.max(1, intelligence)
    }
    if (value === 'half-level') return Math.floor(level / 2)
    if (value === 'channel-arcana') return level >= 18 ? 3 : level >= 6 ? 2 : 1
    return 0
}
export const featureResourceKey = (feature: import('./PlayerCreation.ts').ClassFeature) => `wizard.resource.${feature.resource?.key ?? feature.index}.remaining`
export function featureResourceRemaining(sheet: CharacterSheet, feature: import('./PlayerCreation.ts').ClassFeature) {
    const raw = sheet.playerDetails?.[featureResourceKey(feature)]
    return Math.min(featureResourceMax(sheet, feature), raw === undefined ? feature.resource?.initial ?? featureResourceMax(sheet, feature) : integer(raw, 'Usi rimanenti'))
}
export function spendWizardFeature(sheet: CharacterSheet, feature: import('./PlayerCreation.ts').ClassFeature) {
    if (!savedWizardFeatures(sheet).some((x) => x.index === feature.index) || !feature.resource) throw new Error('Privilegio non disponibile.')
    const remaining = featureResourceRemaining(sheet, feature)
    if (!remaining) throw new Error('Non rimangono usi di questo privilegio.')
    return { ...sheet, playerDetails: { ...sheet.playerDetails, [featureResourceKey(feature)]: String(remaining - 1) } }
}

export function wizardFeatureGrants(sheet: CharacterSheet, data: CreationData) {
    const d = sheet.playerDetails ?? {}
    return selectedWizardFeatures(sheet, data).flatMap((feature) => {
        const grants = [...(feature.grants ?? [])].filter((x) => !x.minimum || Number(sheet.level) >= x.minimum)
        const choice = d[`wizard.grantChoice.${feature.index}`]
        const spell = data.spells.find((x) => x.index === choice)
        const anyCantrip = feature.grantOptions?.includes('wizard-cantrip-if-known') && Object.entries(d).some(([key,value]) => key.endsWith('.index') && value === 'minor-illusion' && !d[key.slice(0,-6) + '.grant'])
        if (choice && (feature.grantOptions?.includes(choice) || anyCantrip && spell?.level === 0 && spell.classes.some((x) => x.index === 'wizard') && !Object.entries(d).some(([key,value]) => key.endsWith('.index') && value === choice && d[key.slice(0,-6) + '.grant'] !== feature.index))) {
            const fallback = { name: choice.split('-').map((s) => s[0].toUpperCase() + s.slice(1)).join(' '), level: feature.name === 'Mental Discipline' ? 5 : 0 }
            grants.push({ index: choice, name: spell?.name ?? fallback.name, level: spell?.level ?? fallback.level, free: feature.name === 'Mental Discipline' })
        }
        return grants.map((grant) => ({ ...grant, feature }))
    })
}

export function wizardSpellPool(sheet: CharacterSheet, data: CreationData): CreationData['spells'] {
    const grants = wizardFeatureGrants(sheet, data)
    return [...data.spells.map((x) => grants.some((g) => g.index === x.index) ? { ...x, classes: [...x.classes, { index: 'wizard', name: 'Wizard' }] } : x), ...grants.filter((g) => !data.spells.some((x) => x.index === g.index)).map((g) => ({ index: g.index, name: g.name, level: g.level, classes: [{ index: 'wizard', name: 'Wizard' }], desc: [g.feature.desc.join('\n')] }))]
}

export function addWizardFeatureSpells(sheet: CharacterSheet, data: CreationData) {
    const grants = wizardFeatureGrants(sheet, data), d = { ...sheet.playerDetails }
    for (const key of Object.keys(d)) if (/^spell\.\d+\.\d+\.grant$/.test(key) && d[key] && !grants.some((g) => g.feature.index === d[key] && g.index === d[key.replace(/\.grant$/, '.index')])) {
        const root = key.slice(0, -6)
        if (d[root + '.grantGenerated'] === 'true') {
            for (const k of Object.keys(d)) if (k.startsWith(root + '.')) delete d[k]
        } else for (const suffix of ['grant','always','freeFeature']) delete d[root + '.' + suffix]
    }
    for (const g of grants) {
        const existing = Object.entries(d).find(([key, name]) => /^spell\.\d+\.\d+\.name$/.test(key) && (d[key.slice(0, -5) + '.index'] === g.index || name.toLowerCase() === g.name.toLowerCase()))
        if (existing && !d[existing[0].slice(0,-5) + '.grant'] && !g.always && !g.free) continue
        let index = existing ? Number(existing[0].split('.')[2]) : 0
        if (!existing) while (d[`spell.${g.level}.${index}.name`]?.trim()) index++
        if (index >= 500) continue
        const root = `spell.${g.level}.${index}`, s = data.spells.find((x) => x.index === g.index)
        Object.assign(d, { [`${root}.name`]: s?.nameIt ?? g.name, [`${root}.index`]: g.index, [`${root}.source`]: 'class', [`${root}.learned`]: existing && d[`${root}.grantGenerated`] !== 'true' ? d[`${root}.learned`] || 'level' : 'feature', [`${root}.grantGenerated`]: String(!existing || d[`${root}.grantGenerated`] === 'true'), [`${root}.grant`]: g.feature.index, [`${root}.always`]: String(!!g.always), [`${root}.freeFeature`]: g.free ? g.feature.index : '', [`spell.rows.${g.level}`]: String(Math.max(index + 1, Number(d[`spell.rows.${g.level}`]) || 8)) })
    }
    return { ...sheet, playerDetails: d }
}

export function spendWizardPortent(sheet: CharacterSheet, index: number) {
    const feature = savedWizardFeatures(sheet).find((x) => x.name === 'Portent')
    if (!feature || !Number.isInteger(index) || index < 0 || index >= featureResourceMax(sheet, feature)) throw new Error('Portent non disponibile.')
    const d = sheet.playerDetails ?? {}, roll = Number(d[`wizard.portent.${index}`])
    if (!Number.isInteger(roll) || roll < 1 || roll > 20 || d[`wizard.portent.${index}.used`] === 'true') throw new Error('Scegli un d20 valido non ancora usato.')
    const next = spendWizardFeature(sheet, feature)
    return { ...next, playerDetails: { ...next.playerDetails, [`wizard.portent.${index}.used`]: 'true' } }
}
