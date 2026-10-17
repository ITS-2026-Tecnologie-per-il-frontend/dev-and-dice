import { useId } from 'react'
import { useTheme } from '../theme/useTheme'
import { parseTheme, themes } from '../theme/themePreferences'

export function ThemeSettings({ compact = false }: { compact?: boolean }) {
    const { theme, changeTheme, error } = useTheme()
    const id = useId()
    if (compact) return <div className="theme-quick-control">
        <label className="theme-quick-label">Stile
            <select value={theme} onChange={event => changeTheme(parseTheme(event.target.value))}>
                {themes.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
        </label>
        {error && <small role="status">{error}</small>}
    </div>

    return <fieldset className="theme-settings">
        <legend>Stile dell’interfaccia</legend>
        <div className="theme-options">
            {themes.map(option => <label className="theme-option" key={option.value}>
                <input type="radio" name={`${id}-theme`} value={option.value} checked={theme === option.value} onChange={() => changeTheme(option.value)}/>
                <span className={`theme-swatch theme-swatch-${option.value}`} aria-hidden="true"><i/><i/><i/></span>
                <strong>{option.label}</strong><span>{option.description}</span>
            </label>)}
        </div>
        <p className="theme-settings-note">Si applica subito a tutta l’interfaccia. La scelta è ricordata in questo browser.</p>
        {error && <p role="status">{error}</p>}
    </fieldset>
}
