export const appearanceFields = [
    { key: 'appearance.Età', label: 'Età', legacy: 'age' },
    { key: 'appearance.Altezza', label: 'Altezza', legacy: 'height' },
    { key: 'appearance.Peso', label: 'Peso corporeo', legacy: 'weight' },
    { key: 'appearance.Carnagione', label: 'Carnagione', legacy: 'skin' },
    { key: 'appearance.Occhi', label: 'Occhi', legacy: 'eyes' },
    { key: 'appearance.Capelli', label: 'Capelli', legacy: 'hair' },
] as const

const aliases: Record<string, string> = Object.fromEntries([
    ...appearanceFields.map(({ key, legacy }) => [legacy, key]),
    ['appearance', 'appearanceDescription'],
])

export const appearanceFieldKey = (key: string) => aliases[key] ?? key

export function appearanceLegacyKey(key: string) {
    return Object.keys(aliases).find((legacy) => aliases[legacy] === key)
}
