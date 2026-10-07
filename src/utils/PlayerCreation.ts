import { type CharacterSheet } from './CharacterSheets.ts'
import { classId, spellEdition, spellProfile, spellRowState, grantedSpells, type RulesEdition } from './Spellcasting.ts'
import { wizardFeatures2024, wizardBookIssues, wizardFeatureSelected, selectedWizardFeatures, addWizardFeatureSpells, wizardSpellPool } from './Wizard.ts'

export const abilityKeys = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const
export type AbilityKey = typeof abilityKeys[number]
export type Ref = { index: string; name: string; nameIt?: string; aliases?: string[] }
export type Option = { option_type: string; item?: Ref; of?: Ref; count?: number; items?: Option[]; choice?: Choice; ability_score?: Ref; bonus?: number; desc?: string }
export type Choice = { choose: number; desc?: string; type: string; from: { option_set_type: string; options?: Option[]; equipment_category?: Ref } }
export type Equipment = Ref & { armor_class?: { base: number; dex_bonus: boolean; max_bonus?: number }; armor_category?: string; str_minimum?: number; stealth_disadvantage?: boolean; weapon_category?: string; weapon_range?: string; properties?: Ref[]; damage?: { damage_dice: string; damage_type: Ref } }
export type Origin = Ref & {
    aliases?: string[]; fixedAbilityBonuses?: Partial<Record<AbilityKey, number>>; abilityBonusChoices?: Choice; race?: Ref;
    speed?: number; subraces?: Ref[]; traits?: Ref[]; racial_traits?: Ref[]; languages?: Ref[]; language_options?: Choice;
    starting_proficiencies?: Ref[]; proficiency_choices?: Choice[] | Choice; proficiencies?: Ref[];
    starting_equipment?: { equipment: Ref; quantity: number }[]; starting_equipment_options?: Choice[];
    hit_die?: number; savingThrowAbilities?: AbilityKey[]; castingAbility?: AbilityKey; abilityScoreImprovementLevels?: number[];
    desc?: string[]; localizations?: { it?: { description?: string } };
    class?: Ref; feature?: { name: string; desc: string[] }; starting_gold?: { quantity: number; unit: string };
    trait_specific?: { spell_options?: Omit<Choice, 'type'> };
    minimumLevel?: number; editions?: RulesEdition[]; status?: 'published' | 'ua' | 'archived-ua'; sources?: string[]; sourceUrl?: string; automationStatus?: string;
    features?: ClassFeature[];
}
export type ClassFeature = Ref & { class: Ref; subclass?: Ref; level: number; desc: string[]; editions?: RulesEdition[]; sourceUrl?: string; activation?: 'active' | 'passive'; rounds?: number; choice?: boolean;
    resource?: { max: number | 'proficiency' | 'intelligence' | 'half-level' | 'channel-arcana'; reset: 'short' | 'long'; key?: string; initial?: number; shortMinimum?: number };
    grants?: { index: string; name: string; level: number; minimum?: number; always?: boolean; free?: boolean }[]; grantOptions?: string[];
}
export type CreationData = {
    classes: Origin[]; subclasses: Origin[]; races: Origin[]; subraces: Origin[]; backgrounds: Origin[]; alignments: Ref[]; languages: Ref[]; traits: Origin[];
    features: ClassFeature[];
    levels: { index: string; level: number; class: Ref; subclass?: Ref; spellcasting?: Record<string, number>; class_specific?: { unarmored_movement?: number } }[];
    spells: (Ref & { level: number; classes: Ref[]; desc: string[]; school?: Ref; ritual?: boolean; casting_time?: string; attack_type?: string; dc?: { dc_type: Ref }; damage?: unknown })[];
    skills: (Ref & { abilityField: AbilityKey; playerDetailsKeys: { bonus: string; proficient: string; expertise: string } })[];
    equipment: Equipment[]; equipmentCategories: (Ref & { equipment: Ref[] })[];
}

let cached: Promise<CreationData> | undefined
export function loadCreationData(): Promise<CreationData> {
    cached ??= Promise.all(['character-options', 'character-equipment', 'character-rules', 'wizard-catalog'].map(async (file) => {
        const response = await fetch(`${import.meta.env.BASE_URL}data/${file}.json`)
        if (!response.ok) throw new Error('Impossibile caricare le opzioni del personaggio.')
        return response.json()
    })).then(([options, equipment, rules, wizard]) => withWizardCatalog({ ...options, ...equipment, skills: rules.skills }, wizard))
        .catch((error: unknown) => { cached = undefined; throw error })
    return cached
}
export function withWizardCatalog(data: CreationData, wizard: { subclasses: Origin[] }): CreationData {
    return { ...data, subclasses: [...data.subclasses.map((x) => ({ ...x, ...wizard.subclasses.find((s) => s.index === x.index && s.class?.index === x.class?.index) })), ...wizard.subclasses.filter((x) => !data.subclasses.some((s) => s.index === x.index))], features: [...data.features, ...wizard.subclasses.flatMap((x) => x.features ?? []).filter((x) => !data.features.some((f) => f.index === x.index))] }
}
export function subclassMinimumLevel(sheet: CharacterSheet, subclass: Origin, data: CreationData) {
    return subclass.class?.index === 'wizard' && spellEdition(sheet) === '2024' ? 3 : subclass.minimumLevel ?? Math.min(...data.features.filter((x) => x.subclass?.index === subclass.index).map((x) => x.level))
}
export const subclassOptions = (sheet: CharacterSheet, data: CreationData) => data.subclasses.filter((x) => x.class?.index === classId(sheet) && (!x.editions || x.editions.includes(spellEdition(sheet))))
export const labelOf = (item: Ref) => item.nameIt ?? item.name
export const abilityFromShort = (short: string) => abilityKeys.find((key) => key.startsWith(short))
export const modifier = (score: string) => Math.floor((Number(score) - 10) / 2)
export const creationEnabled = (sheet: CharacterSheet) => sheet.playerDetails?.['creation.enabled'] === 'true'

export function selectedOrigins(sheet: CharacterSheet, data: CreationData) {
    const d = sheet.playerDetails ?? {}
    const race = data.races.find((x) => x.index === d['creation.race'])
    const characterClass = data.classes.find((x) => x.index === d['creation.class'])
    const subclass = subclassOptions(sheet, data).find((x) => x.index === d['creation.subclass'] && x.class?.index === characterClass?.index)
    const minimumLevel = subclass ? subclassMinimumLevel(sheet, subclass, data) : Infinity
    return {
        race, subrace: data.subraces.find((x) => x.index === d['creation.subrace'] && x.race?.index === race?.index),
        characterClass, subclass: Number(sheet.level) >= minimumLevel ? subclass : undefined,
        background: data.backgrounds.find((x) => x.index === d['creation.background']),
    }
}

export function optionsFor(choice: Choice, data: CreationData): Option[] {
    if (choice.from.options) return choice.from.options
    if (choice.type === 'languages') return data.languages.map((item) => ({ option_type: 'reference', item }))
    const category = data.equipmentCategories.find((x) => x.index === choice.from.equipment_category?.index)
    // Categories also contain magic items: those are never starting equipment.
    return (category?.equipment ?? []).filter((ref) => data.equipment.some((x) => x.index === ref.index))
        .map((item) => ({ option_type: 'counted_reference', count: 1, of: item }))
}
export function optionLabel(option: Option): string {
    if (option.items) return option.items.map(optionLabel).join(' + ')
    if (option.choice) return option.choice.desc ?? `${option.choice.choose} × ${option.choice.from.equipment_category?.name ?? 'a scelta'}`
    const ref = option.item ?? option.of ?? option.ability_score
    return ref ? `${option.count ?? option.bonus ?? 1} × ${labelOf(ref).replace('Skill: ', '')}` : option.desc ?? 'Scelta'
}
export function resolveChoice(choice: Choice, path: string, details: Record<string, string>, data: CreationData): { ref: Ref; count: number }[] {
    const options = optionsFor(choice, data)
    const used = new Set<string>()
    function resolve(option: Option, key: string): { ref: Ref; count: number }[] {
        if (option.items) return option.items.flatMap((item, i) => resolve(item, `${key}.item.${i}`))
        if (option.choice) return resolveChoice(option.choice, `${key}.nested`, details, data)
        const ref = option.item ?? option.of ?? option.ability_score
        return ref ? [{ ref, count: option.count ?? option.bonus ?? 1 }] : []
    }
    return Array.from({ length: choice.choose }, (_, slot) => {
        const key = `${path}.${slot}`
        const value = details[key]
        if (value === undefined || value === '' || (choice.type !== 'equipment' && used.has(value))) return []
        used.add(value)
        const option = options[Number(value)]
        return option ? resolve(option, `${key}.option.${value}`) : []
    }).flat()
}

export function creationChoices(sheet: CharacterSheet, data: CreationData): { choice: Choice; path: string; label: string }[] {
    const { race, subrace, characterClass, background } = selectedOrigins(sheet, data)
    const result: { choice: Choice; path: string; label: string }[] = []
    for (const [kind, origin] of [['class', characterClass], ['race', race], ['subrace', subrace], ['background', background]] as const) {
        if (!origin) continue
        const root = `choice.${kind}.${origin.index}`
        const profs = origin.proficiency_choices
        ;(Array.isArray(profs) ? profs : profs ? [profs] : []).forEach((choice, i) => result.push({ choice, path: `${root}.proficiency.${i}`, label: `Competenze: ${labelOf(origin)}` }))
        if (origin.abilityBonusChoices) result.push({ choice: origin.abilityBonusChoices, path: `${root}.ability`, label: 'Bonus alle caratteristiche' })
        if (origin.language_options) result.push({ choice: origin.language_options, path: `${root}.language`, label: 'Linguaggi aggiuntivi' })
        origin.starting_equipment_options?.forEach((choice, i) => result.push({ choice, path: `${root}.equipment.${i}`, label: `Equipaggiamento iniziale ${i + 1}: ${labelOf(origin)}` }))
    }
    const traits = [...(race?.traits ?? []), ...(subrace?.racial_traits ?? [])]
    for (const ref of traits) {
        const trait = data.traits.find((x) => x.index === ref.index)
        const choices = trait?.proficiency_choices
        ;(Array.isArray(choices) ? choices : choices ? [choices] : []).forEach((choice, i) => result.push({ choice, path: `choice.trait.${ref.index}.${i}`, label: labelOf(ref) }))
        if (trait?.language_options) result.push({ choice: trait.language_options, path: `choice.trait.${ref.index}.language`, label: 'Linguaggio aggiuntivo' })
        if (trait?.trait_specific?.spell_options) result.push({ choice: { ...trait.trait_specific.spell_options, type: 'racial-spells' }, path: `choice.trait.${ref.index}.spell`, label: 'Trucchetto razziale (Intelligenza)' })
    }
    return result
}

export function sheetWithSpellGrants(sheet: CharacterSheet, data: CreationData): CharacterSheet {
    if (!creationEnabled(sheet)) return sheet
    const chosen = creationChoices(sheet, data).filter((x) => x.choice.type === 'racial-spells').flatMap(({ choice, path }) => resolveChoice(choice, path, sheet.playerDetails ?? {}, data)).map((x) => x.ref.index)
    return { ...sheet, playerDetails: { ...sheet.playerDetails, spellGrants: JSON.stringify(grantedSpells(sheet, data, chosen)) } }
}

export function spellRules(sheet: CharacterSheet, data: CreationData, edition?: RulesEdition) {
    const profile = spellProfile(sheet, data, edition)
    const { characterClass, subclass } = selectedOrigins(sheet, data)
    const fiend = profile.edition === '2014' && subclass?.index === 'fiend' ? ['burning-hands', 'command', 'blindness-deafness', 'scorching-ray', 'fireball', 'stinking-cloud', 'fire-shield', 'wall-of-fire', 'flame-strike', 'hallow'] : []
    return { ...profile, spells: (characterClass?.index === 'wizard' ? wizardSpellPool(sheet, data) : data.spells).filter((x) => x.level <= profile.maxLevel && (x.classes.some((c) => c.index === characterClass?.index) || fiend.includes(x.index)) && (x.level > 0 || profile.cantrips > 0)) }
}

/** Reconcile only fields still owned by automation; edits to generated fields become overrides. */
export function applyCreation(input: CharacterSheet, data: CreationData): CharacterSheet {
    if (!creationEnabled(input)) return input
    const sheet = { ...input, playerDetails: { ...input.playerDetails } }
    const d = sheet.playerDetails
    const { race, subrace, characterClass, background, subclass } = selectedOrigins(sheet, data)
    const level = Math.max(1, Math.min(20, Number(sheet.level) || 1))
    const pb = 2 + Math.floor((level - 1) / 4)
    const choices = creationChoices(sheet, data)
    const wizardFeatures = selectedWizardFeatures(sheet, data)
    const hasWizardFeature = (name: string) => wizardFeatures.some((x) => x.name === name)
    const bonuses = { ...race?.fixedAbilityBonuses }
    for (const key of abilityKeys) bonuses[key] = (bonuses[key] ?? 0) + (subrace?.fixedAbilityBonuses?.[key] ?? 0)
    for (const { choice, path } of choices.filter((x) => x.choice.type === 'ability_bonuses')) {
        for (const { ref, count } of resolveChoice(choice, path, d, data)) {
            const key = abilityFromShort(ref.index)
            if (key) bonuses[key] = (bonuses[key] ?? 0) + count
        }
    }
    for (const key of abilityKeys) {
        const base = d[`creation.base.${key}`] ?? ''
        sheet[key] = base === '' ? '' : String(Number(base) + (bonuses[key] ?? 0))
        d[`creation.bonus.${key}`] = String(bonuses[key] ?? 0)
    }
    const next: Record<string, string> = {}
    const put = (key: string, value: string | number | boolean) => { next[key] = String(value) }
    put('proficiencyBonus', pb)
    const traitRefs = [...(race?.traits ?? []), ...(subrace?.racial_traits ?? [])]
    const traits = traitRefs.flatMap((ref) => data.traits.filter((x) => x.index === ref.index))
    const profs = [...(characterClass?.proficiencies ?? []), ...(background?.starting_proficiencies ?? []), ...traits.flatMap((x) => x.proficiencies ?? [])]
    choices.filter((x) => x.choice.type === 'proficiencies').forEach(({ choice, path }) => profs.push(...resolveChoice(choice, path, d, data).map((x) => x.ref)))
    if (hasWizardFeature('Training in War and Song')) profs.push({ index: 'light-armor', name: 'Light Armor' }, { index: 'skill-performance', name: 'Intrattenere' })
    if (hasWizardFeature('Arcanomechanical Armor')) profs.push({ index: 'light-armor', name: 'Light Armor' })
    const subclassSkills = hasWizardFeature('Creative Skills') ? ['acrobatics','athletics','nature','performance'] : hasWizardFeature('Eloquent Apprentice') ? ['deception','intimidation','performance','persuasion','insight'] : []
    const selectedSkills = new Set([d['wizard.skill.0'], d['wizard.skill.1']].filter((x) => subclassSkills.includes(x)))
    for (const index of selectedSkills) profs.push({ index: `skill-${index}`, name: data.skills.find((x) => x.index === index)?.name ?? index })
    if (subclass?.index === 'wizard-onomancy-ua') profs.push({ index: 'calligraphers-supplies', name: 'Strumenti da calligrafo' })
    if (subclass?.index === 'wizard-technomancy-ua') profs.push({ index: 'hacking-tools', name: 'Strumenti di hacking' }, { index: 'sidearms', name: 'Armi corte' })
    const weapon = hasWizardFeature('Training in War and Song') && data.equipment.find((x) => x.index === d['wizard.weapon'] && x.weapon_range === 'Melee' && !x.properties?.some((p) => p.index === 'two-handed'))
    if (weapon) profs.push(weapon)
    if (hasWizardFeature('Tools of the Inventor')) {
        const tools = data.equipmentCategories.find((x) => x.index === 'tools')?.equipment ?? []
        for (const index of new Set([d['wizard.tool.0'], d['wizard.tool.1']])) {
            const tool = tools.find((x) => x.index === index)
            if (tool) profs.push(tool)
        }
    }
    const profSet = new Set(profs.map((x) => x.index))
    if (subclass?.index === 'life') profSet.add('heavy-armor')
    for (const key of abilityKeys) put(`save.${key}.proficient`, characterClass?.savingThrowAbilities?.includes(key) ?? false)
    if (hasWizardFeature('Impeccable Physicality')) put('save.dexterity.proficient', true)
    for (const skill of data.skills) put(skill.playerDetailsKeys.proficient, profSet.has(`skill-${skill.index}`))
    const categories: Record<string, string[]> = { Leggere: ['light-armor', 'all-armor'], Medie: ['medium-armor', 'all-armor'], Pesanti: ['heavy-armor', 'all-armor'], Scudi: ['shields'], 'Armi semplici': ['simple-weapons'], 'Armi da guerra': ['martial-weapons'] }
    Object.entries(categories).forEach(([name, refs]) => put(`proficiency.${name}`, refs.some((x) => profSet.has(x))))
    put('tools', profs.filter((x) => !x.index.startsWith('skill-') && !x.index.startsWith('saving-throw') && !Object.values(categories).flat().includes(x.index)).map(labelOf).join(', '))
    const languages = [...(race?.languages ?? [])]
    choices.filter((x) => x.choice.type === 'languages').forEach(({ choice, path }) => languages.push(...resolveChoice(choice, path, d, data).map((x) => x.ref)))
    const language = subclass?.index === 'wizard-onomancy-ua' && data.languages.find((x) => x.index === d['wizard.language'])
    if (language) languages.push(language)
    put('languages', [...new Set(languages.map(labelOf))].join(', '))
    put('darkvision', traitRefs.some((x) => x.index === 'darkvision'))
    const intBonus = sheet.intelligence.trim() ? modifier(sheet.intelligence) : 0
    put('wizard.initiativeExtra', hasWizardFeature('Temporal Awareness') || hasWizardFeature('Tactical Wit') ? intBonus : hasWizardFeature('Lore Mastery') && d['wizard.initiativeAbility'] === 'intelligence' && sheet.dexterity.trim() ? intBonus - modifier(sheet.dexterity) : 0)
    const racialSpells = choices.filter((x) => x.choice.type === 'racial-spells').flatMap(({ choice, path }) => resolveChoice(choice, path, d, data)).map((x) => `${labelOf(data.spells.find((s) => s.index === x.ref.index) ?? x.ref)} (Intelligenza, trucchetto)`)
    if (race?.index === 'tiefling') {
        for (const [index, minimum, usage] of [['thaumaturgy', 1, 'trucchetto'], ['hellish-rebuke', 3, '1/riposo lungo, al 2° livello'], ['darkness', 5, '1/riposo lungo']] as const) {
            if (level >= minimum) racialSpells.push(`${labelOf(data.spells.find((s) => s.index === index)!)} (Carisma, ${usage})`)
        }
    }
    put('racialSpells', racialSpells.join('\n'))
    put('spellGrants', sheetWithSpellGrants(sheet, data).playerDetails!.spellGrants)
    put('racialTraits', [...traits, ...(background ? [background] : [])].map((x) => `${labelOf(x)}\n${x.desc?.join('\n') ?? (x.feature ? `${x.feature.name}\n${x.feature.desc.join('\n')}` : '')}`).join('\n\n'))
    put('classFeatures', characterClass?.index === 'wizard' && sheet.playerDetails?.['rules.edition'] === '2024' ? wizardFeatures2024({ ...sheet, playerDetails: { ...d, 'creation.subclass': subclass?.index ?? '' } }) : data.features.filter((x) => x.class.index === characterClass?.index && (!x.subclass || x.subclass.index === subclass?.index) && x.level <= level && (!x.editions || x.editions.includes(spellEdition(sheet))) && (!x.choice || wizardFeatureSelected(sheet, x, data))).map((x) => `${labelOf(x)} (livello ${x.level})\n${x.desc.join('\n')}${x.activation && x.sourceUrl ? `\nFonte: ${x.sourceUrl}` : ''}`).join('\n\n'))
    put('wizard.featureRules', JSON.stringify(characterClass?.index === 'wizard' ? selectedWizardFeatures(sheet, data) : []))
    if (characterClass?.index === 'wizard' && spellEdition(sheet) === '2014' && level >= 3 && d['wizard.cantripFormulas'] === 'true') put('classFeatures', next.classFeatures + '\n\nCantrip Formulas (livello 3)\nRegola opzionale: dopo un riposo lungo puoi sostituire un trucchetto da mago consultando il libro.')
    put('hitDice', characterClass?.hit_die ? `${level}d${characterClass.hit_die}` : '')
    put('hitDiceTotal', characterClass ? level : '')
    if (characterClass?.hit_die && sheet.constitution !== '') {
        const con = modifier(sheet.constitution)
        put('maxHitPoints', characterClass.hit_die + con + (level - 1) * Math.max(1, Math.floor(characterClass.hit_die / 2) + 1 + con) + (subrace?.index === 'hill-dwarf' ? level : 0) + (subclass?.index === 'draconic' ? level : 0))
    } else put('maxHitPoints', '')
    if (background?.starting_gold?.unit === 'gp') put('coins.MO', background.starting_gold.quantity)
    const items = [...(characterClass?.starting_equipment ?? []), ...(background?.starting_equipment ?? [])].map((x) => ({ ref: x.equipment, count: x.quantity }))
    choices.filter((x) => x.choice.type === 'equipment').forEach(({ choice, path }) => items.push(...resolveChoice(choice, path, d, data)))
    const totals = new Map<string, { ref: Ref; count: number }>()
    for (const item of items) totals.set(item.ref.index, { ref: item.ref, count: (totals.get(item.ref.index)?.count ?? 0) + item.count })
    put('equipment', [...totals.values()].map((x) => `${x.count} × ${labelOf(x.ref)}`).join('\n'))
    const weapons = data.equipment.filter((x) => totals.has(x.index) && x.weapon_category).slice(0, 6)
    for (let i = 0; i < 6; i++) {
        const weapon = weapons[i]
        put(`attacks.${i}.0`, weapon ? labelOf(weapon) : '')
        if (!weapon) { put(`attacks.${i}.1`, ''); put(`attacks.${i}.2`, ''); continue }
        const finesse = weapon.properties?.some((x) => x.index === 'finesse')
        const score = weapon.weapon_range === 'Ranged' ? 'dexterity' : 'strength'
        const bonus = sheet[score] === '' ? undefined : finesse && sheet.strength !== '' && sheet.dexterity !== '' ? Math.max(modifier(sheet.strength), modifier(sheet.dexterity)) : modifier(sheet[score])
        const proficient = profSet.has(weapon.weapon_category === 'Simple' ? 'simple-weapons' : 'martial-weapons') || [...profSet].some((x) => x.replace(/s$/, '') === weapon.index)
        put(`attacks.${i}.1`, bonus === undefined ? '' : bonus + (proficient ? pb : 0))
        put(`attacks.${i}.2`, weapon.damage ? `${weapon.damage.damage_dice}${bonus === undefined || bonus === 0 ? '' : `${bonus > 0 ? '+' : ''}${bonus}`} ${labelOf(weapon.damage.damage_type)}` : '')
    }
    const armor = data.equipment.find((x) => x.index === d['creation.armor'] && totals.has(x.index) && x.armor_category !== 'Shield')
    const shield = d['creation.shield'] === 'true' && totals.has('shield')
    put('armor', armor ? labelOf(armor) : '')
    put('shield', shield ? 'Shield (+2 CA)' : '')
    put('armorDexMax', armor?.armor_class?.max_bonus ?? '')
    put('armorStrength', armor?.str_minimum || '')
    put('armorStealthDisadvantage', armor?.stealth_disadvantage ?? false)
    const baseUpdates: Record<string, string> = {}
    if (sheet.dexterity !== '') {
        const dex = modifier(sheet.dexterity)
        let ac = 10 + dex
        if (armor?.armor_class) ac = armor.armor_class.base + (armor.armor_class.dex_bonus ? Math.min(dex, armor.armor_class.max_bonus ?? Infinity) : 0)
        else if (characterClass?.index === 'barbarian' && sheet.constitution !== '') ac = Math.max(ac, ac + modifier(sheet.constitution))
        else if (characterClass?.index === 'monk' && !shield && sheet.wisdom !== '') ac = Math.max(ac, ac + modifier(sheet.wisdom))
        else if (subclass?.index === 'draconic') ac = 13 + dex
        baseUpdates.armorClass = String(ac + (shield ? 2 : 0))
    } else baseUpdates.armorClass = ''
    if (race) {
        let speed = race.speed ?? 30
        if (characterClass?.index === 'barbarian' && level >= 5 && armor?.armor_category !== 'Heavy') speed += 10
        if (characterClass?.index === 'monk' && !armor && !shield) speed += data.levels.find((x) => x.index === `monk-${level}`)?.class_specific?.unarmored_movement ?? 0
        if (armor?.armor_category === 'Heavy' && race.index !== 'dwarf' && sheet.strength !== '' && Number(sheet.strength) < (armor.str_minimum ?? 0)) speed -= 10
        baseUpdates.speed = `${speed * 0.3} m`
    }
    // Apply generated competence flags first, so totals include user overrides too.
    function updateDetail(key: string, value: string) {
        const marker = `creation.auto.${key}`
        if (d[key] !== undefined && d[key] !== '' && d[key] !== d[marker] && d[key] !== value) d[`creation.override.${key}`] = 'true'
        if (d[`creation.override.${key}`] !== 'true' && (d[key] === undefined || d[key] === '' || d[key] === d[marker])) d[key] = value
        d[marker] = value
    }
    for (const [key, value] of Object.entries(next)) updateDetail(key, value)
    for (const skill of data.skills) if (['arcana','history','nature','religion'].includes(skill.index) && (hasWizardFeature('Lore Mastery') || d[`creation.auto.${skill.playerDetailsKeys.expertise}`] !== undefined)) updateDetail(skill.playerDetailsKeys.expertise, String(hasWizardFeature('Lore Mastery') && d[skill.playerDetailsKeys.proficient] === 'true'))
    for (const key of abilityKeys) updateDetail(`save.${key}`, sheet[key] === '' ? '' : String(modifier(sheet[key]) + (d[`save.${key}.proficient`] === 'true' ? pb : 0)))
    for (const skill of data.skills) {
        if (sheet[skill.abilityField] === '') { updateDetail(skill.playerDetailsKeys.bonus, ''); continue }
        const trained = d[skill.playerDetailsKeys.proficient] === 'true'
        const multiplier = trained ? d[skill.playerDetailsKeys.expertise] === 'true' ? 2 : 1 : characterClass?.index === 'bard' && level >= 2 ? 0.5 : 0
        updateDetail(skill.playerDetailsKeys.bonus, String(modifier(sheet[skill.abilityField]) + Math.floor(pb * multiplier)))
    }
    const perception = data.skills.find((x) => x.index === 'perception')
    if (perception) updateDetail('passivePerception', d[perception.playerDetailsKeys.bonus] ? String(10 + Number(d[perception.playerDetailsKeys.bonus])) : '')
    const magic = spellRules(sheet, data)
    const casting = characterClass?.castingAbility
    updateDetail('castingClass', magic.maxLevel ? labelOf(characterClass!) : '')
    updateDetail('castingAbility', magic.maxLevel && casting ? ({ strength: 'Forza', dexterity: 'Destrezza', constitution: 'Costituzione', intelligence: 'Intelligenza', wisdom: 'Saggezza', charisma: 'Carisma' })[casting] : '')
    const castingBonus = casting && sheet[casting] !== '' ? modifier(sheet[casting]) + pb : undefined
    updateDetail('spellDC', magic.maxLevel && castingBonus !== undefined ? String(8 + castingBonus) : '')
    updateDetail('spellAttackBonus', magic.maxLevel && castingBonus !== undefined ? String(castingBonus) : '')
    for (let i = 1; i <= 9; i++) updateDetail(`slots.${i}.total`, String(magic.progression[`spell_slots_level_${i}`] ?? 0))
    for (const [key, value] of Object.entries(baseUpdates)) {
        const marker = `creation.auto.base.${key}`
        const field = key as 'armorClass' | 'speed'
        if (sheet[field] !== '' && sheet[field] !== d[marker] && sheet[field] !== value) d[`creation.override.base.${key}`] = 'true'
        if (d[`creation.override.base.${key}`] !== 'true' && (sheet[field] === '' || sheet[field] === d[marker])) sheet[field] = value
        d[marker] = value
    }
    const previousMax = input.playerDetails?.['creation.auto.maxHitPoints']
    if (sheet.hitPoints === '' || (previousMax !== undefined && sheet.hitPoints === previousMax)) sheet.hitPoints = d.maxHitPoints ?? ''
    return addWizardFeatureSpells(sheet, data)
}

export function enableCreation(sheet: CharacterSheet, data: CreationData): CharacterSheet {
    const details: Record<string, string> = { ...sheet.playerDetails, 'creation.enabled': 'true' }
    for (const key of abilityKeys) if (!creationEnabled(sheet)) details[`creation.base.${key}`] = sheet[key] === '' ? '' : String(Number(sheet[key]) - Number(details[`creation.bonus.${key}`] ?? 0))
    return applyCreation({ ...sheet, level: sheet.level || '1', playerDetails: details }, data)
}

export function resetCreationOverrides(sheet: CharacterSheet, data: CreationData) {
    const next = { ...sheet, playerDetails: { ...sheet.playerDetails } }
    for (const [key, value] of Object.entries(next.playerDetails)) {
        if (key.startsWith('creation.override.')) delete next.playerDetails[key]
        if (!key.startsWith('creation.auto.')) continue
        const field = key.slice('creation.auto.'.length)
        if (field.startsWith('base.')) next[field.slice(5) as 'armorClass' | 'speed'] = value
        else next.playerDetails[field] = value
    }
    return applyCreation(next, data)
}

export function spellSelection(sheet: CharacterSheet, data: CreationData) {
    const rules = spellRules(sheet, data)
    const d = sheet.playerDetails ?? {}
    const entries = Object.entries(d).filter(([key, value]) => /^spell\.\d+\.\d+\.name$/.test(key) && value.trim()).map(([key, name]) => {
        const [, level, index] = key.split('.')
        return { name, level: Number(level), ...spellRowState(sheet, Number(level), Number(index)) }
    })
    const cantrips = entries.filter((entry) => entry.countsCantrip).length
    const spells = entries.filter((entry) => entry.countsKnown).length
    const prepared = entries.filter((entry) => entry.countsPrepared).length
    const extra = entries.filter((entry) => !entry.countsKnown && !entry.countsCantrip).length
    const secrets = entries.filter((entry) => entry.source === 'secrets').length
    const loreSpells = entries.filter((entry) => entry.source === 'lore').length
    const lore = d['creation.class'] === 'bard' && d['creation.subclass'] === 'lore' && Number(sheet.level) >= 6
    const knownLimit = rules.known
    const issues: string[] = wizardBookIssues(sheet, data)
    if (cantrips > rules.cantrips) issues.push(`Troppi trucchetti di classe: ${cantrips}/${rules.cantrips}.`)
    if (knownLimit !== undefined && spells > knownLimit && d['creation.class'] !== 'wizard') issues.push(`Troppi incantesimi di classe: ${spells}/${knownLimit}.`)
    if (rules.prepared && prepared > rules.preparedLimit) issues.push(`Troppi incantesimi preparati: ${prepared}/${rules.preparedLimit}.`)
    if (entries.some((entry) => entry.source === 'class' && !rules.spells.some((x) => labelOf(x) === entry.name))) issues.push('Alcuni incantesimi non appartengono alla lista o al livello di classe: verifica con il DM.')
    const secretLimit = (Number(sheet.level) >= 10 ? 2 : 0) + (Number(sheet.level) >= 14 ? 2 : 0) + (Number(sheet.level) >= 18 ? 2 : 0)
    if (secrets && (d['creation.class'] !== 'bard' || (rules.edition === '2014' && secrets > secretLimit))) issues.push('Le scelte di Segreti Magici superano quelle concesse dal livello o dalla classe.')
    if (loreSpells && (!lore || loreSpells > 2)) issues.push('Segreti Magici aggiuntivi: massimo due, dal livello 6 del Collegio della Sapienza.')
    for (let level = 6; level <= 9; level++) {
        const arcanums = entries.filter((entry) => entry.source === 'arcanum' && entry.level === level)
        if (arcanums.length > 1 || (arcanums.length && !rules.arcanumLevels.includes(level))) issues.push(`Arcanum di livello ${level}: massimo uno, sbloccato al livello ${level * 2 - 1} da warlock.`)
    }
    return { cantrips, spells, prepared: rules.edition === '2024' && !rules.prepared ? spells : prepared, extra, secrets, knownLimit, issues }
}
