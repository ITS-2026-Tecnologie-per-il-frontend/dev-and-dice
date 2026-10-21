import type { Ability } from '../../utils/Combat.ts'
import type { CharacterSheet } from '../../utils/CharacterSheets.ts'
import type { Catalog } from '../../utils/Catalog.ts'

export type CombatTargetRule = { kind:'single'|'multiple'|'area'|'review'; maximum:number|null; summary:string }
const object=(value:unknown):Record<string,unknown> => value && typeof value==='object' && !Array.isArray(value) ? value as Record<string,unknown> : {}
const count=(value:unknown):number|undefined => typeof value==='number' && Number.isSafeInteger(value) && value>0 ? value : undefined
const limited=(maximum:number,note=''):CombatTargetRule => ({kind:maximum===1?'single':'multiple',maximum,summary:(maximum===1?'Un solo bersaglio per utilizzo.':`Fino a ${maximum} bersagli distinti per utilizzo.`)+(note?' '+note:'')})
const area=():CombatTargetRule => ({kind:'area',maximum:null,summary:'Bersagli nell’area d’effetto: verifica posizione, gittata e condizioni nella descrizione.'})
const multiple=():CombatTargetRule => ({kind:'multiple',maximum:null,summary:'Più bersagli: verifica gittata, destinatari consentiti e condizioni nella descrizione.'})
const review=(note='Numero di bersagli non determinato dai dati disponibili.'):CombatTargetRule => ({kind:'review',maximum:null,summary:'Da verificare: '+note})

// PHB 2014, D&D_5_Player_Original_Handbook.pdf, PDF 205, Targets / Areas of Effect.
// MM 2014, D&D_5_Monster_Original_Handbook.pdf, PDF 342, Worg: one target per Bite.
export function combatTargeting(ability:Pick<Ability,'catalogId'|'spellLevel'|'execution'|'useOption'|'ruleId'>,catalog:Catalog,sheet?:CharacterSheet,optionId=ability.execution?.option ?? ability.useOption):CombatTargetRule {
    // One attack, not the entire Attack action: D&D_5_Player_Original_Handbook.pdf PDF 195;
    // D&D_5.5_manuale_compatto_italiano.pdf (SRD 5.2.1) PDF 16.
    if (!ability.catalogId && /^sheet-attack:[0-5]$/.test(ability.ruleId ?? '')) return limited(1)
    const entry=catalog.abilities.find(entry=>entry.id===ability.catalogId)
    if (!entry) return review()
    // A mismatched reference must never import the 2014 interpretation into a revised spell.
    if (entry.data.edition==='2024' || entry.data.ruleset==='dnd5e-2024') return review('La voce 2024 richiede una verifica separata.')
    const m=object(entry.data.mechanics),effect=object(m.effect),upcast=object(m.upcast)
    const base=count(m.level ?? entry.data.level ?? ability.spellLevel) ?? 0
    const slot=optionId?.startsWith('slot:') ? Number(optionId.slice(5)) : optionId==='pact' ? Number(sheet?.playerDetails?.['rules2014.pact.level']) : base
    const extra=Math.max(0,(Number.isSafeInteger(slot)?slot:base)-(count(upcast.base) ?? base))
    const target=m.target ?? effect.target,targets=effect.targets
    const split=count(effect.rays) ?? count(effect.darts)
    if (split) return limited(split+extra*(count(upcast.additionalRays) ?? count(upcast.additionalDarts) ?? 0),'Ripartisci i raggi o i dardi tra questi bersagli, senza duplicarli.')
    if (effect.beamsByCharacterLevel) {
        const level=Number(sheet?.level)
        if (!Number.isSafeInteger(level) || level<1 || sheet?.kind!=='PG') return review('Per contare i raggi serve il livello del personaggio; verifica la capacità della creatura.')
        const beams=Object.entries(object(effect.beamsByCharacterLevel)).filter(([threshold])=>Number(threshold)<=level).sort((a,b)=>Number(b[0])-Number(a[0]))[0]?.[1]
        return count(beams) ? limited(Number(beams),'Un attacco separato per raggio; ripartisci i raggi tra i bersagli.') : review()
    }
    if (count(effect.maximumSecondaryTargets)) return limited(1+Number(effect.maximumSecondaryTargets)+extra*(count(upcast.additionalSecondaryBolts) ?? 0),'Rispetta le distanze e i vincoli dei bersagli secondari.')
    const maximum=count(effect.maximumTargets) ?? count(effect.maximumChosenTargets) ?? count(object(effect.targetChoice).maximumCreatures) ?? count(effect.maximumFallingCreatures) ?? count(effect.maximumWillingTargets) ?? count(effect.maximumParticipantsIncludingCaster)
    if (maximum) return limited(maximum+extra*(count(upcast.additionalTargets) ?? 0),'Verifica gittata, distanze e condizioni nella descrizione.')
    if (count(effect.maximumWillingCompanions)) return limited(Number(effect.maximumWillingCompanions)+(effect.includesCaster===true?1:0))
    if (count(upcast.targetsPerExtraLevel)) return limited(1+extra*Number(upcast.targetsPerExtraLevel))
    if (typeof targets==='string') {
        const companions=/^caster-and-up-to-(eight|ten|five)-/.exec(targets)?.[1]
        if (companions) return limited(1+({eight:8,ten:10,five:5}[companions as 'eight'|'ten'|'five']),'Il conteggio include l’incantatore.')
    }
    // Multiattack is a sequence; count its attacks, not the singular target of each component.
    if (m.kind==='multiattack') {
        const sequences=Array.isArray(effect.attackAlternatives) ? effect.attackAlternatives : [effect.attacks]
        const totals=sequences.filter(Array.isArray).map(sequence=>sequence.every(action=>count(object(action).count)) ? sequence.reduce((sum,action)=>sum+Number(object(action).count),0) : 0)
        const total=Math.max(0,...totals,count(object(effect.remainingAttacks).count) ?? 0)
        return total ? limited(total,'Segui la sequenza e le eventuali alternative nella descrizione; ogni attacco conserva i propri bersagli e danni.') : review('Multiattacco: verifica numero e distribuzione degli attacchi nella descrizione.')
    }
    if (effect.damageLink || upcast.additionalCreaturesAnimatedOrControlled) return review('Effetti collegati o usi alternativi: verifica i destinatari nella descrizione.')
    if (effect.area || effect.areas || m.area || effect.radiusFt || effect.damageRadiusFt || effect.cloudRadiusFt || effect.sphereDiameterFt || effect.line || effect.sphere || effect.wall || effect.cloud || effect.activeSphere || effect.shapeChoices || object(effect.forms).wall || typeof effect.forms==='string' && /sphere-or-hemisphere/.test(effect.forms) || effect.splash || typeof targets==='string' && /hit-target-and-each/.test(targets)) return area()
    if (typeof targets==='string' && /creatures|humanoids|each-creature/.test(targets)) return multiple()
    if (typeof target==='string' && !/area|per-beam|per-dart|one-or-more|creatures|targets|two-|three-/.test(target) && !effect.extraAttacks) return limited(1+extra*(count(upcast.additionalTargets) ?? 0))
    if (typeof effect.attack==='string' && (/^(?:melee|ranged)-spell/.test(effect.attack) || /ranged-spell-attack-at-creature/.test(effect.attack)) || /^(?:melee|ranged)-spell-attack$/.test(String(object(effect.attack).kind)) || typeof effect.attackOnCast==='string' && /one-creature/.test(effect.attackOnCast)) return limited(1)
    if (typeof effect.trigger==='string' && /^(?:next|first)-(?:melee-)?(?:weapon-)?(?:attack-)?hit/.test(effect.trigger)) return limited(1,'Si applica al bersaglio dell’attacco che attiva l’effetto.')
    const description=entry.description.replace(/\s+/g,' ').trim()
    // ponytail: legacy text is accepted only for an explicit attack header, never a loose
    // occurrence of "one creature" in a spell. Extend verified mechanics for ambiguous entries.
    const header=/^((?:Attacco|Melee|Ranged).*?)(?:Colpisce:|Colpito:|Hit:)/i.exec(description)?.[1]
    if (header && /\b(?:un(?:a|o)? (?:solo )?(?:bersaglio|creatura)|one (?:target|creature))\b/i.test(header)) {
        // Splash / secondary victims must not be accidentally constrained to the attack target.
        if (/\b(?:ogni|ciascuna|tutte le|each|all) (?:altr[ao] |other )?(?:creatur[ae]|creatures?)\b|second[oa] (?:bersaglio|creatura)|another (?:target|creature)/i.test(description)) return review('L’attacco può avere effetti su altre creature: verifica la descrizione.')
        return limited(1)
    }
    if (/\b(?:ogni|ciascuna|tutte le|each|all) (?:creatur[ae]|creatures?)\b/i.test(description) && /\b(?:cono|cubo|sfera|cilindro|raggio|linea|cone|cube|sphere|cylinder|radius|line)\b/i.test(description)) return area()
    return review(description ? undefined : 'Descrizione e regole dei bersagli assenti nel catalogo.')
}

export function assertCombatTargets(ability:Ability,catalog:Catalog,sheet?:CharacterSheet,optionId?:string) {
    const rule=combatTargeting(ability,catalog,sheet,optionId)
    if (rule.maximum!==null && (ability.targets?.length ?? 0)>rule.maximum) throw new Error(`Troppi bersagli: massimo ${rule.maximum} per questo utilizzo. Correggi la selezione prima di procedere.`)
    return rule
}
