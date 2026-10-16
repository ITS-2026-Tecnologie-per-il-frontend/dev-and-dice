import type { CharacterSheet } from './CharacterSheets.ts'
import { classId, spellEdition } from './Spellcasting.ts'

const wizardPages = ['Statistiche e tradizione arcana', 'Personaggio e inventario', 'Incantesimi', 'Equipaggiamento indossato'] as const

export const sheetTemplates = {
    generic: { name: 'Scheda generale', pages: ['Statistiche e combattimento', 'Personaggio e inventario', 'Incantesimi'] },
    wizard: { name: 'Mago', pages: wizardPages },
    'wizard-pdf': { name: 'Mago · stile PDF', pages: wizardPages },
    barbarian: { name: 'Barbaro', pages: ['Statistiche e cammino primordiale', 'Personaggio e inventario', 'Equipaggiamento indossato'] },
    'barbarian-pdf': { name: 'Barbaro · stile PDF', pages: ['Statistiche e cammino primordiale', 'Personaggio e inventario', 'Equipaggiamento indossato'] },
} as const

export function playerTemplate(sheet: CharacterSheet): keyof typeof sheetTemplates {
    const explicit = sheet.playerDetails?.['sheet.template']
    if (explicit === 'generic' || explicit === 'wizard' || explicit === 'wizard-pdf') return explicit
    if (explicit === 'barbarian' && sheet.kind === 'PG' && spellEdition(sheet) === '2014') return 'barbarian'
    if (sheet.kind === 'PG' && classId(sheet) === 'barbarian') {
        if (explicit === 'barbarian-pdf' || spellEdition(sheet) === '2024') return 'barbarian-pdf'
        return 'barbarian'
    }
    return sheet.playerDetails?.['creation.class'] === 'wizard' || /^(mago|wizard)$/i.test(sheet.characterClass.trim()) ? 'wizard' : 'generic'
}

export const wizardPrivilegeLevels = [2, 6, 10, 14, 18, 20] as const
export function featuresAtLevel(text: string, level: number) {
    return text.split(/\n\s*\n/).filter((block) => new RegExp(`\\(livello ${level}\\)\\s*$`, 'i').test(block.split('\n')[0])).join('\n\n')
}
export function updateFeaturesAtLevel(text: string, level: number, value: string) {
    const rest = text.split(/\n\s*\n/).filter((block) => block.trim() && !new RegExp(`\\(livello ${level}\\)\\s*$`, 'i').test(block.split('\n')[0]))
    // ponytail: il testo libero senza intestazione usa un unico privilegio; per più capacità si mantengono le intestazioni con il livello.
    const blocks = value.split(/\n\s*\n/).filter((block) => block.trim()).map((block) => /\(livello \d+\)\s*$/i.test(block.split('\n')[0]) ? block : `Privilegio di classe (livello ${level})\n${block}`)
    return [...rest, ...blocks].join('\n\n')
}

export const proseField=(key:string,base=false)=>key==='name'||key==='notes'||key==='creation.override.classFeatures'||!base&&['playerName','backgroundStory','appearanceDescription','faction','factionName','factionSymbol','additionalTraits','racialTraits','classFeatures','feats'].includes(key)||!base&&key.startsWith('personality.')

export function playerSheetLayoutKey(sheet:CharacterSheet) {
    // ponytail: only prose skips the full layout; every mechanical field still refreshes all derived values.
    return JSON.stringify(sheet.playerDetails?.['tutorial.active']==='true'||playerTemplate(sheet)==='barbarian-pdf' ? sheet : {...sheet,name:'',notes:'',playerDetails:Object.fromEntries(Object.entries(sheet.playerDetails??{}).filter(([key])=>!proseField(key)))})
}
