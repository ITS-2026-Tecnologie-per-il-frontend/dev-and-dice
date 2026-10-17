import { useContext } from 'react'
import { ThemeContext } from './themeContext'

export function useTheme() {
    const context = useContext(ThemeContext)
    if (!context) throw new Error('ThemeProvider non disponibile')
    return context
}
