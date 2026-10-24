import { createContext } from 'react'

import type { AppTheme } from './themePreferences'
export const ThemeContext = createContext<{
    theme: AppTheme; changeTheme: (theme: AppTheme) => void; error: string
    notificationBlur: boolean; changeNotificationBlur: (enabled: boolean) => void; notificationBlurError: string
} | null>(null)
