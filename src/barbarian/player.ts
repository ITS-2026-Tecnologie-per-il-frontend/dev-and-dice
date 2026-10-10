import { characterFieldValue, updateCharacterField, characterFieldMode, creationEnabled } from '../utils/PlayerCreation.ts'
import { normalizeHitPoints, type CharacterSheet } from '../utils/CharacterSheets.ts'
import { inventoryItems, referencedInventoryItem } from '../utils/Inventory.ts'
import { featuresAtLevel, updateFeaturesAtLevel } from '../utils/PlayerTemplates.ts'
import { emptyCharacter, type Field, type PageLayout } from './model.ts'

const aliases: Record<string, string> = {
  'identity.name':'name', 'identity.race':'race', 'identity.level':'level', 'identity.player':'playerName', 'identity.path':'subclass',
  'combat.proficiency':'proficiencyBonus', 'combat.passive':'passivePerception', 'combat.inspiration':'inspiration',
  'combat.maxHP':'maxHitPoints', 'combat.currentHP':'hitPoints', 'combat.temporaryHP':'temporaryHitPoints',
  'combat.unarmored':'unarmoredAC', 'combat.shield':'unshieldedAC',
  'notes.languages':'languages', 'notes.combatFeatures':'classFeatures', 'notes.appearance':'appearanceDescription',
  'notes.talents':'additionalTraits', 'notes.background':'backgroundStory', 'notes.allies':'faction',
  'notes.enemies':'personality.Nemici', 'notes.traits':'personality.Tratti caratteriali',
  'notes.ideals':'personality.Ideali', 'notes.bonds':'personality.Legami', 'notes.flaws':'personality.Difetti',
}
export function barbarianFieldKey(field: Field, sheet: CharacterSheet): string {
  const id = `${field.group}.${field.key}`
  if (aliases[id]) return aliases[id]
  if (field.group === 'identity' || field.group === 'appearance') return field.key
  const ability = /^(strength|dexterity|constitution|intelligence|wisdom|charisma)(Modifier|Base|Save)?$/.exec(field.key)
  if (field.group === 'abilities' && ability) return !ability[2] ? ability[1] : ability[2] === 'Modifier' ? `modifier.${ability[1]}` : ability[2] === 'Base' ? `creation.base.${ability[1]}` : `save.${ability[1]}`
  if (field.group === 'abilities' && field.key.startsWith('skill.')) return field.key
  if (field.group === 'checks' && field.key.startsWith('save.')) return `${field.key}.proficient`
  if (field.group === 'checks' && /^(skill|expert)\./.test(field.key)) return `skill.${field.key.slice(field.key.indexOf('.')+1)}.${field.key.startsWith('expert.') ? 'expertise' : 'proficient'}`
  if (field.group === 'checks' && field.key.startsWith('training.')) return `proficiency.${field.key.slice(9).replace(/^Armature /,'').replace(/^(leggere|medie|pesanti)$/,value=>value[0].toUpperCase()+value.slice(1))}`
  const death = /^death\.(success|failure)\.(\d)$/.exec(field.key)
  if (death) return `death.${death[1] === 'success' ? 'Successi' : 'Fallimenti'}.${death[2]}`
  const attack = /^(\d)\.(name|bonus|damage|type)$/.exec(field.key)
  if (field.group === 'attacks' && attack) return `attacks.${attack[1]}.${['name','bonus','damage','type'].indexOf(attack[2])}`
  const bag = /^bag\.(\d+)\.(name|quantity)$/.exec(field.key)
  if (bag) {
    const occupied = inventoryItems(sheet).map(item=>item.row), rows = [...occupied]
    for (let row=0;rows.length<32;row++) if (!occupied.includes(row)) rows.push(row)
    return `inventory.${rows[Number(bag[1])]}.${bag[2] === 'name' ? 0 : 2}`
  }
  const magic = /^magic\.(\d+)\.(name|description|equipped|requires|attuned)$/.exec(field.key)
  if (magic) return `magicItem.${magic[1]}.${({description:'notes',requires:'requiresAttunement'} as Record<string,string>)[magic[2]] ?? magic[2]}`
  if (field.key.startsWith('coins.')) return field.key
  const slot = /^slot\.(.+)\.(name|description|active)$/.exec(field.key)
  if (slot) {
    const worn = `worn.${slot[1].replace(/^Anello (\d)$/,(_,n)=>`ring.${Number(n)-1}`).replace(/^Arma (\d)$/,(_,n)=>`weapon.${Number(n)-1}`).replace(/^Altro (\d)$/,(_,n)=>`other.${Number(n)-1}`)}`
    if (slot[2] === 'name') return worn
    const item = referencedInventoryItem(sheet,worn)
    if (item) return `inventory.${item.row}.${slot[2] === 'description' ? 'notes' : 'equipped'}`
  }
  if (field.group === 'combat' && ['armorClass','initiative','speed','hitDice','hitDiceTotal','hitDiceUsed'].includes(field.key)) return field.key
  // ponytail: PDF-only fields remain in playerDetails; template changes never discard them.
  return `barbarian.${id}`
}
export function playerBarbarianCharacter(sheet: CharacterSheet, pages: PageLayout[]) {
  const result = emptyCharacter(pages)
  for (const field of pages.flatMap(page=>page.fields)) {
    let value = characterFieldValue(sheet, barbarianFieldKey(field,sheet))
    if (field.group === 'abilities' && field.key.endsWith('Base') && !creationEnabled(sheet)) value = characterFieldValue(sheet,field.key.slice(0,-4))
    if (field.group === 'features') value = featuresAtLevel(sheet.playerDetails?.classFeatures ?? '', [3,6,10,14][Number(field.key.split('.')[1])])
    if (field.key.startsWith('exhaustion.')) value = String(Number(sheet.playerDetails?.exhaustion ?? 0) >= Number(field.key.split('.')[1]))
    if (field.key === 'hitDice') value = value.replace(/^1(?=d\d+$)/,'') || 'd12'
    result[field.group][field.key] = field.kind === 'checkbox' ? value === 'true' : value
  }
  return result
}
export function updatePlayerBarbarian(sheet: CharacterSheet, field: Field, value: string | boolean) {
  if (field.key.startsWith('exhaustion.')) return updateCharacterField(sheet,'exhaustion',String(Number(field.key.split('.')[1]) - (value ? 0 : 1)))
  if (field.group === 'features') return updateCharacterField(sheet,'classFeatures',updateFeaturesAtLevel(sheet.playerDetails?.classFeatures ?? '',[3,6,10,14][Number(field.key.split('.')[1])],String(value)))
  let key = barbarianFieldKey(field,sheet)
  if (field.group === 'abilities' && field.key.endsWith('Base') && !creationEnabled(sheet)) key = field.key.slice(0,-4)
  return updateCharacterField(sheet,key,['hitPoints','maxHitPoints','temporaryHitPoints'].includes(key) ? normalizeHitPoints(String(value)) : String(value))
}
export const barbarianFieldReadOnly = (sheet: CharacterSheet, field: Field) => characterFieldMode(sheet,barbarianFieldKey(field,sheet)) === 'automatic'
