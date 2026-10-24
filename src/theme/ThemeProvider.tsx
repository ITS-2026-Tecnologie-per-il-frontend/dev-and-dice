import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react'
import { ThemeContext } from './themeContext'
import { parseTheme, themeColors, type AppTheme } from './themePreferences'
const storageKey = 'dev-and-dice.theme.v1'
const blurStorageKey = 'dev-and-dice.notification-blur.v1'

function savedNotificationBlur(): boolean {
    try { return localStorage.getItem(blurStorageKey) !== 'off' }
    catch { return true }
}

function savedTheme(): AppTheme {
    try { return parseTheme(localStorage.getItem(storageKey)) }
    catch { return 'minimal' }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setTheme] = useState<AppTheme>(savedTheme)
    const [error, setError] = useState('')
    const [notificationBlur, setNotificationBlur] = useState(savedNotificationBlur)
    const [notificationBlurError, setNotificationBlurError] = useState('')

    useLayoutEffect(() => {
        document.documentElement.dataset.theme = theme
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColors[theme])
    }, [theme])

    useLayoutEffect(() => {
        document.documentElement.dataset.notificationBlur = notificationBlur ? 'on' : 'off'
    }, [notificationBlur])

    useEffect(() => {
        function sync(event: StorageEvent) {
            if (event.storageArea === localStorage && (event.key === storageKey || event.key === null)) {
                setTheme(parseTheme(event.newValue))
                setError('')
            }
            if (event.storageArea === localStorage && (event.key === blurStorageKey || event.key === null)) {
                setNotificationBlur(event.newValue !== 'off')
                setNotificationBlurError('')
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

    function changeNotificationBlur(enabled: boolean) {
        setNotificationBlur(enabled)
        try { localStorage.setItem(blurStorageKey, enabled ? 'on' : 'off'); setNotificationBlurError('') }
        catch { setNotificationBlurError('La sfocatura è cambiata, ma la preferenza non è stata salvata nel browser.') }
    }

    return <ThemeContext value={{ theme, changeTheme, error, notificationBlur, changeNotificationBlur, notificationBlurError }}>{children}</ThemeContext>
}
