export type Group = 'identity' | 'abilities' | 'combat' | 'checks' | 'attacks' | 'notes' | 'features' | 'appearance' | 'equipment'
export type Box = number[]
export type Field = { group: Group; key: string; label: string; box: Box; kind: string; min?: number; max?: number; options?: string[]; initial?: string }
export type PageLayout = { width: number; height: number; ornaments: { name: string; box: Box; viewBox: number[]; src: string }[]; texts: { text: string; box: Box; kind?: string }[]; fields: Field[] }
export type Character = { version: 1 } & Record<Group, Record<string, string | boolean>>
export const groups: Group[] = ['identity', 'abilities', 'combat', 'checks', 'attacks', 'notes', 'features', 'appearance', 'equipment']
export function emptyCharacter(pages: PageLayout[]): Character {
  const character = { version: 1, ...Object.fromEntries(groups.map(group => [group, {}])) } as Character
  for (const page of pages) for (const field of page.fields) character[field.group][field.key] = field.kind === 'checkbox' ? false : field.initial ?? ''
  return character
}
export function parseCharacter(raw: string, pages: PageLayout[]): Character {
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1) throw new Error('Formato JSON non valido: serve una scheda Barbaro, versione 1.')
  const result = emptyCharacter(pages)
  for (const group of groups) {
    const section = (value as Record<string, unknown>)[group]
    if (!section || typeof section !== 'object' || Array.isArray(section)) throw new Error(`Sezione ${group} non valida.`)
    for (const field of pages.flatMap(page => page.fields).filter(field => field.group === group)) {
      const item = (section as Record<string, unknown>)[field.key]
      if (item === undefined) continue
      if (field.kind === 'checkbox' ? typeof item !== 'boolean' : typeof item !== 'string' || item.length > 20000) throw new Error(`Valore non valido: ${field.label}.`)
      if (field.kind === 'number' && item !== '' && (!/^[+-]?\d+(?:\.\d+)?$/.test(String(item)) || !Number.isFinite(Number(item)) || (field.min !== undefined && Number(item) < field.min) || (field.max !== undefined && Number(item) > field.max))) throw new Error(`Numero non valido: ${field.label}.`)
      if (field.kind === 'select' && !field.options?.includes(String(item))) throw new Error(`Scelta non valida: ${field.label}.`)
      result[group][field.key] = item as string | boolean
    }
  }
  return result
}
