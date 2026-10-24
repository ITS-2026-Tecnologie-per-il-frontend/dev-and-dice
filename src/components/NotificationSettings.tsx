import { useTheme } from '../theme/useTheme'

export function NotificationSettings() {
    const { notificationBlur, changeNotificationBlur, notificationBlurError } = useTheme()
    return <fieldset className="theme-settings">
        <legend>Notifiche</legend>
        <label className="master-view-option">
            <input type="checkbox" checked={notificationBlur} onChange={event => changeNotificationBlur(event.target.checked)}/>
            <span><strong>Sfocatura dello sfondo</strong><span>Sfoca il tavolo dietro le finestre delle notifiche.</span></span>
        </label>
        <p className="theme-settings-note">La scelta si applica subito ed è ricordata in questo browser.</p>
        {notificationBlurError && <p role="status">{notificationBlurError}</p>}
    </fieldset>
}
