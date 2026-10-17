import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react'
import { ThemeContext } from './themeContext'
import { parseTheme, themeColors, type AppTheme } from './themePreferences'
const storageKey = 'dev-and-dice.theme.v1'

function savedTheme(): AppTheme {
    try { return parseTheme(localStorage.getItem(storageKey)) }
    catch { return 'minimal' }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setTheme] = useState<AppTheme>(savedTheme)
    const [error, setError] = useState('')

    useLayoutEffect(() => {
        document.documentElement.dataset.theme = theme
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColors[theme])
    }, [theme])

    useEffect(() => {
        function sync(event: StorageEvent) {
            if (event.storageArea === localStorage && (event.key === storageKey || event.key === null)) {
                setTheme(parseTheme(event.newValue))
                setError('')
            }
        }
        window.addEventListener('storage', sync)
        return () => window.removeEventListener('storage', sync)
    }, [])

    function changeTheme(next: AppTheme) {
        setTheme(next)
        try { localStorage.setItem(storageKey, next); setError('') }
        catch { setError('Lo stile è cambiato, ma la preferenza non è stata salvata nel browser.') }
    }

    return <ThemeContext value={{ theme, changeTheme, error }}>{children}</ThemeContext>
}
