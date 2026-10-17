export const themes = [
    { value: 'minimal', label: 'Minimal', description: 'L’interfaccia essenziale di sempre.' },
    { value: 'fantasy', label: 'Fantasy', description: 'Legno, pergamena e l’atmosfera di una locanda.' },
    { value: 'dragons', label: 'Fantasy/draghi', description: 'Ossidiana, brace e sigilli di drago su una base minimal.' },
] as const

export type AppTheme = typeof themes[number]['value']

export function parseTheme(value: unknown): AppTheme {
    return value === 'fantasy' || value === 'dragons' ? value : 'minimal'
}

export const themeColors: Record<AppTheme, string> = { minimal: '#15120f', fantasy: '#281c14', dragons: '#151619' }
