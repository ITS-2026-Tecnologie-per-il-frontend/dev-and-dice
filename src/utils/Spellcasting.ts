import { abilityModifier, characterFields, characterLevel, type CharacterSheet } from './CharacterSheets.ts'
import type { CreationData } from './PlayerCreation.ts'
import { spellcasting2024 } from '../data/Spellcasting2024.ts'

export type RulesEdition = '2014' | '2024'
export const spellEdition = (sheet: CharacterSheet): RulesEdition => sheet.playerDetails?.['rules.edition'] === '2024' ? '2024' : '2014'
export const classId = (sheet: CharacterSheet) => sheet.playerDetails?.['creation.class'] || ({ barbaro: 'barbarian', bardo: 'bard', chierico: 'cleric', druido: 'druid', guerriero: 'fighter', monaco: 'monk', ladro: 'rogue', paladino: 'paladin', ranger: 'ranger', stregone: 'sorcerer', warlock: 'warlock', mago: 'wizard' } as Record<string, string>)[sheet.characterClass.trim().toLowerCase()] || sheet.characterClass.trim().toLowerCase()

export function castingAbilityKey(sheet: CharacterSheet, fallback?: import('./PlayerCreation.ts').AbilityKey) {
    const custom = sheet.playerDetails?.castingAbility?.trim().toLowerCase().replace(/\.$/, '')
    return custom ? (['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const).find((key) => [key, characterFields[key], key.slice(0, 3), characterFields[key].slice(0, 3)].some((name) => name.toLowerCase() === custom)) : fallback
}

export function spellProfile(sheet: CharacterSheet, data: CreationData, edition = spellEdition(sheet)) {
    const id = classId(sheet)
    const level = characterLevel(sheet) ?? 0
    const characterClass = data.classes.find((item) => item.index === id)
    const progression = { ...(data.levels.find((item) => item.index === `${id}-${level}`)?.spellcasting ?? {}) }
    const revised = edition === '2024' ? spellcasting2024[id]?.[level - 1] : undefined
    if (revised) {
        progression.cantrips_known = revised[0]
        for (let i = 1; i <= 9; i++) progression[`spell_slots_level_${i}`] = revised[i + 1]
    }
    const maxLevel = Math.max(0, ...Array.from({ length: 9 }, (_, i) => progression[`spell_slots_level_${i + 1}`] ? i + 1 : 0))
    const daily = (edition === '2014' ? ['cleric', 'druid', 'paladin', 'wizard'] : ['cleric', 'druid', 'paladin', 'ranger', 'wizard']).includes(id)
    const key = castingAbilityKey(sheet, characterClass?.castingAbility)
    const modifier = key ? abilityModifier(sheet[key]) : undefined
    const preparedLimit = !maxLevel ? 0 : revised ? revised[1] : modifier === undefined ? 0 : Math.max(1, modifier + (id === 'paladin' ? Math.floor(level / 2) : level))
    return {
        edition, progression, maxLevel, cantrips: progression.cantrips_known ?? 0,
        prepared: daily, preparedLimit: daily ? preparedLimit : 0,
        known: id === 'wizard' ? level ? 6 + (level - 1) * 2 : 0 : revised ? revised[1] : progression.spells_known,
        changePolicy: daily ? (edition === '2024' && ['paladin', 'ranger'].includes(id) ? 'one-per-long-rest' : 'long-rest') : 'level-up',
        arcanumLevels: id === 'warlock' ? [6, 7, 8, 9].filter((spellLevel) => level >= spellLevel * 2 - 1) : [],
    }
}

export const spellSources = { class: 'Classe', always: 'Sempre preparato', racial: 'Razza / specie', item: 'Oggetto', feature: 'Privilegio / talento', lore: 'Segreti aggiuntivi (Sapienza)', secrets: 'Segreti Magici', arcanum: 'Arcanum Mistico' } as const
export type SpellSource = keyof typeof spellSources
export type SpellSelectionLimit = { id: string; label: string; maximum: number; roots: string[]; reason: string; kind: 'cantrips' | 'known' | 'prepared' | 'level' | 'savant' | 'secrets' | 'lore' | 'arcanum'; minimumLevel?: number; exactLevel?: number }
export function spellLimitIssue(limit: SpellSelectionLimit) {
    const excess = limit.roots.length - limit.maximum
    const correction = limit.kind === 'prepared' ? `Rimuovi la spunta Preparato da ${excess} magie: resteranno annotate.` : limit.kind === 'level' || limit.kind === 'savant' ? `Rimuovi ${excess} selezioni da questa categoria oppure correggine l’acquisizione se sono copie o privilegi.` : `Rimuovi ${excess} selezioni da questa categoria oppure verifica le fonti dei privilegi con il DM.`
    return `${limit.label}: ${limit.roots.length}/${limit.maximum}, ${excess} in eccesso. ${limit.reason} ${correction}`
}

export function spellRowState(sheet: CharacterSheet, level: number, index: number) {
    const d = sheet.playerDetails ?? {}, root = `spell.${level}.${index}`
    const id = classId(sheet), edition = spellEdition(sheet)
    const rawSource = d[`${root}.source`]
    let source: SpellSource = Object.hasOwn(spellSources, rawSource ?? '') ? rawSource as SpellSource : id === 'warlock' && level >= 6 ? 'arcanum' : 'class'
    const granted = savedSpellGrants(sheet).find((grant) => grant.index === d[`${root}.index`] || [grant.name, ...(grant.aliases ?? [])].some((name) => name.toLowerCase() === d[`${root}.name`]?.trim().toLowerCase()))
    if (source === 'class' && granted?.source === 'always') source = 'always'
    const preparedClass = (edition === '2014' ? ['cleric', 'druid', 'paladin', 'wizard'] : ['cleric', 'druid', 'paladin', 'ranger', 'wizard']).includes(id)
    const knownClass = ['bard', 'sorcerer', 'warlock', ...(edition === '2014' ? ['ranger'] : [])].includes(id)
    const classSpell = source === 'class'
    const signature = classSpell && id === 'wizard' && Number(sheet.level) >= 20 && level === 3 && [d['wizard.signature.0'], d['wizard.signature.1']].includes(root)
    const mastery = classSpell && id === 'wizard' && edition === '2024' && Number(sheet.level) >= 18 && [1, 2].includes(level) && d[`wizard.mastery.${level}`] === root
    const alwaysPrepared = signature || mastery || classSpell && id === 'wizard' && d[`${root}.always`] === 'true' && !!d[`${root}.grant`]
    const needsPreparation = classSpell && level > 0 && (preparedClass || !knownClass)
    const selected = !!d[`${root}.name`]?.trim()
    const canToggle = !alwaysPrepared && (needsPreparation || !['class', 'always', 'secrets', 'lore'].includes(source))
    const checked = alwaysPrepared || (needsPreparation ? d[`${root}.prepared`] === 'true' : !canToggle || d[`${root}.available`] !== 'false')
    const maxLevel = Math.max(0, ...Array.from({ length: 9 }, (_, i) => {
        const key = `slots.${i + 1}.total`
        const capacity = d['creation.enabled'] === 'true' ? d[`creation.auto.${key}`] ?? d[key] : d[key]
        return Number(capacity) > 0 ? i + 1 : 0
    }))
    const allowed = source === 'arcanum' ? id === 'warlock' && level >= 6 && level <= 9 && Number(sheet.level) >= level * 2 - 1
        : source === 'secrets' ? id === 'bard' && (Number(sheet.level) >= 10 || (d['creation.subclass'] === 'lore' && Number(sheet.level) >= 6)) && (d['creation.enabled'] !== 'true' || level <= maxLevel)
        : source === 'lore' ? id === 'bard' && d['creation.subclass'] === 'lore' && Number(sheet.level) >= 6 && (d['creation.enabled'] !== 'true' || level <= maxLevel)
        : classSpell && d['creation.enabled'] === 'true' ? level === 0 || level <= maxLevel : true
    const lost = classSpell && id === 'wizard' && d[`${root}.lost`] === 'true'
    return { source, needsPreparation, checked, canToggle, alwaysPrepared, lost, available: selected && checked && allowed && !lost,
        countsCantrip: classSpell && level === 0 && d[`${root}.learned`] !== 'feature', countsKnown: (classSpell && level > 0) || source === 'secrets',
        countsPrepared: needsPreparation && preparedClass && checked && !alwaysPrepared,
        checkboxKey: `${root}.${needsPreparation ? 'prepared' : 'available'}` }
}

export function spellCounts(sheet: CharacterSheet) {
    const entries = Object.entries(sheet.playerDetails ?? {}).filter(([key, value]) => /^spell\.\d+\.\d+\.name$/.test(key) && value.trim()).map(([key, name]) => {
        const [, level, index] = key.split('.')
        return { root: key.slice(0,-5), name, level: Number(level), ...spellRowState(sheet, Number(level), Number(index)) }
    })
    return { entries, cantrips: entries.filter((entry) => entry.countsCantrip).length,
        spells: entries.filter((entry) => entry.countsKnown).length, prepared: entries.filter((entry) => entry.countsPrepared).length,
        extra: entries.filter((entry) => !entry.countsKnown && !entry.countsCantrip).length,
        secrets: entries.filter((entry) => entry.source === 'secrets').length, loreSpells: entries.filter((entry) => entry.source === 'lore').length }
}

export type SpellGrant = { index: string; name: string; aliases?: string[]; level: number; source: 'racial' | 'always'; note: string }
const life2014: [number, string[]][] = [[1, ['bless', 'cure-wounds']], [3, ['lesser-restoration', 'spiritual-weapon']], [5, ['beacon-of-hope', 'revivify']], [7, ['death-ward', 'guardian-of-faith']], [9, ['mass-cure-wounds', 'raise-dead']]]
const devotion2014: [number, string[]][] = [[3, ['protection-from-evil-and-good', 'sanctuary']], [5, ['lesser-restoration', 'zone-of-truth']], [9, ['beacon-of-hope', 'dispel-magic']], [13, ['freedom-of-movement', 'guardian-of-faith']], [17, ['commune', 'flame-strike']]]
const life2024: [number, string[]][] = [[3, ['aid', 'bless', 'cure-wounds', 'lesser-restoration']], [5, ['mass-healing-word', 'revivify']], [7, ['aura-of-life', 'death-ward']], [9, ['greater-restoration', 'mass-cure-wounds']]]
const devotion2024: [number, string[]][] = [[3, ['protection-from-evil-and-good', 'shield-of-faith']], [5, ['aid', 'zone-of-truth']], [9, ['beacon-of-hope', 'dispel-magic']], [13, ['freedom-of-movement', 'guardian-of-faith']], [17, ['commune', 'flame-strike']]]
const fiend2024: [number, string[]][] = [[3, ['burning-hands', 'command', 'scorching-ray', 'suggestion']], [5, ['fireball', 'stinking-cloud']], [7, ['fire-shield', 'wall-of-fire']], [9, ['geas', 'insect-plague']]]

export const landNames2014 = { arctic: 'Artico', coast: 'Costa', desert: 'Deserto', forest: 'Foresta', grassland: 'Prateria', mountain: 'Montagna', swamp: 'Palude', underdark: 'Sottosuolo' }
export const landNames2024 = { arid: 'Arido', polar: 'Polare', temperate: 'Temperato', tropical: 'Tropicale' }
const land2014: Record<string, string[][]> = {
    arctic: [['hold-person', 'spike-growth'], ['sleet-storm', 'slow'], ['freedom-of-movement', 'ice-storm'], ['commune-with-nature', 'cone-of-cold']],
    coast: [['mirror-image', 'misty-step'], ['water-breathing', 'water-walk'], ['control-water', 'freedom-of-movement'], ['conjure-elemental', 'scrying']],
    desert: [['blur', 'silence'], ['create-food-and-water', 'protection-from-energy'], ['blight', 'hallucinatory-terrain'], ['insect-plague', 'wall-of-stone']],
    forest: [['barkskin', 'spider-climb'], ['call-lightning', 'plant-growth'], ['divination', 'freedom-of-movement'], ['commune-with-nature', 'tree-stride']],
    grassland: [['invisibility', 'pass-without-trace'], ['daylight', 'haste'], ['divination', 'freedom-of-movement'], ['dream', 'insect-plague']],
    mountain: [['spider-climb', 'spike-growth'], ['lightning-bolt', 'meld-into-stone'], ['stone-shape', 'stoneskin'], ['passwall', 'wall-of-stone']],
    swamp: [['darkness', 'acid-arrow'], ['water-walk', 'stinking-cloud'], ['freedom-of-movement', 'locate-creature'], ['insect-plague', 'scrying']],
    underdark: [['spider-climb', 'web'], ['gaseous-form', 'stinking-cloud'], ['greater-invisibility', 'stone-shape'], ['cloudkill', 'insect-plague']],
}
const land2024: Record<string, string[][]> = {
    arid: [['blur', 'burning-hands', 'fire-bolt'], ['fireball'], ['blight'], ['wall-of-stone']],
    polar: [['fog-cloud', 'hold-person', 'ray-of-frost'], ['sleet-storm'], ['ice-storm'], ['cone-of-cold']],
    temperate: [['misty-step', 'shocking-grasp', 'sleep'], ['lightning-bolt'], ['freedom-of-movement'], ['tree-stride']],
    tropical: [['acid-splash', 'ray-of-sickness', 'web'], ['stinking-cloud'], ['polymorph'], ['insect-plague']],
}
const draconic2024: [number, string[]][] = [[3, ['alter-self', 'chromatic-orb', 'command', 'dragons-breath']], [5, ['fear', 'fly']], [7, ['arcane-eye', 'charm-monster']], [9, ['legend-lore', 'summon-dragon']]]
const additionalSpells: Record<string, { name: string; level: number }> = {
    'ray-of-sickness': { name: 'Ray of Sickness', level: 1 },
    'divine-smite': { name: 'Divine Smite', level: 1 }, 'aura-of-life': { name: 'Aura of Life', level: 4 },
    'chromatic-orb': { name: 'Chromatic Orb', level: 1 }, 'dragons-breath': { name: "Dragon's Breath", level: 2 },
    'charm-monster': { name: 'Charm Monster', level: 4 }, 'summon-dragon': { name: 'Summon Dragon', level: 5 },
}

export function grantedSpells(sheet: CharacterSheet, data: CreationData, racialCantrips: string[] = [], edition = spellEdition(sheet)): SpellGrant[] {
    const d = sheet.playerDetails ?? {}, level = Number(sheet.level) || 1, result: SpellGrant[] = []
    function add(index: string, source: SpellGrant['source'], note: string) {
        const spell = data.spells.find((item) => item.index === index) ?? additionalSpells[index]
        if (spell) result.push({ index, name: ('nameIt' in spell && typeof spell.nameIt === 'string' ? spell.nameIt : spell.name), aliases: [spell.name, ...('aliases' in spell && Array.isArray(spell.aliases) ? spell.aliases.filter((name: unknown): name is string => typeof name === 'string') : [])], level: spell.level, source, note })
    }
    const id = classId(sheet), subclass = d['creation.subclass']
    const table = id === 'cleric' && subclass === 'life' ? (edition === '2014' ? life2014 : life2024)
        : id === 'paladin' && subclass === 'devotion' ? (edition === '2014' ? devotion2014 : devotion2024)
        : edition === '2024' && id === 'warlock' && subclass === 'fiend' ? fiend2024 : edition === '2024' && id === 'sorcerer' && subclass === 'draconic' ? draconic2024 : []
    for (const [minimum, spells] of table) if (level >= minimum) for (const index of spells) add(index, 'always', 'Sempre preparato; non conta nel limite di classe')
    if (id === 'druid' && subclass === 'land') {
        const land = (edition === '2014' ? land2014 : land2024)[d['creation.land']] ?? []
        land.forEach((spells, tier) => { if (level >= 3 + tier * 2) spells.forEach((index) => add(index, 'always', 'Incantesimo del Circolo: sempre preparato, fuori dal limite di classe')) })
    }
    if (edition === '2024' && id === 'paladin') {
        if (level >= 2) add('divine-smite', 'always', 'Sempre preparato; 1/riposo lungo senza slot, oppure con slot')
        if (level >= 5) add('find-steed', 'always', 'Sempre preparato; 1/riposo lungo senza slot, oppure con slot')
    }
    if (edition === '2024' && id === 'ranger') add('hunters-mark', 'always', 'Sempre preparato; usi gratuiti del privilegio separati dagli slot')
    if (d['creation.race'] === 'tiefling') {
        add('thaumaturgy', 'racial', 'Trucchetto razziale')
        const legacy = edition === '2024' ? d['creation.legacy'] || 'infernal' : 'infernal'
        const spells = legacy === 'abyssal' ? ['poison-spray', 'ray-of-sickness', 'hold-person'] : legacy === 'chthonic' ? ['chill-touch', 'false-life', 'ray-of-enfeeblement'] : [edition === '2024' ? 'fire-bolt' : '', 'hellish-rebuke', 'darkness']
        if (spells[0]) add(spells[0], 'racial', 'Trucchetto razziale')
        if (level >= 3) add(spells[1], 'racial', edition === '2014' ? '1/riposo lungo; Hellish Rebuke al 2° livello; senza slot' : '1/riposo lungo senza slot; utilizzabile anche con slot')
        if (level >= 5) add(spells[2], 'racial', edition === '2014' ? '1/riposo lungo; senza slot' : '1/riposo lungo senza slot; utilizzabile anche con slot')
    }
    for (const index of racialCantrips) add(index, 'racial', 'Trucchetto razziale; non conta nei trucchetti di classe')
    if (edition === '2024' && d['creation.race'] === 'elf') {
        const lineage = d['creation.subrace'] || 'high-elf'
        const spells = lineage === 'wood-elf' ? ['druidcraft', 'longstrider', 'pass-without-trace'] : lineage === 'drow' ? ['dancing-lights', 'faerie-fire', 'darkness'] : ['prestidigitation', 'detect-magic', 'misty-step']
        if (!racialCantrips.length) add(spells[0], 'racial', 'Trucchetto di lignaggio')
        if (level >= 3) add(spells[1], 'racial', '1/riposo lungo senza slot; utilizzabile anche con slot')
        if (level >= 5) add(spells[2], 'racial', '1/riposo lungo senza slot; utilizzabile anche con slot')
    }
    if (edition === '2024' && d['creation.race'] === 'gnome') {
        const forest = d['creation.subrace'] === 'forest-gnome'
        for (const index of forest ? ['minor-illusion', 'speak-with-animals'] : ['mending', 'prestidigitation']) add(index, 'racial', index === 'speak-with-animals' ? 'Usi senza slot pari alla competenza/riposo lungo; utilizzabile anche con slot' : 'Trucchetto di lignaggio')
    }
    return result
}

export function savedSpellGrants(sheet: CharacterSheet): SpellGrant[] {
    try {
        const value: unknown = JSON.parse(sheet.playerDetails?.spellGrants || '[]')
        return Array.isArray(value) ? value.filter((x): x is SpellGrant => x && typeof x.index === 'string' && typeof x.name === 'string' && (x.aliases === undefined || Array.isArray(x.aliases) && x.aliases.every((name: unknown) => typeof name === 'string')) && Number.isInteger(x.level) && x.level >= 0 && x.level <= 9 && ['racial', 'always'].includes(x.source) && typeof x.note === 'string') : []
    } catch { return [] }
}
