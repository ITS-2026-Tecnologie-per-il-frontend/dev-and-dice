import { useState } from 'react'

export type MasterView = 'original' | 'renewed'

function savedView(key: string): MasterView {
    try { return localStorage.getItem(key) === 'renewed' ? 'renewed' : 'original' }
    catch { return 'original' }
}

export function useMasterView(accountId = 'local') {
    const storageKey = `dev-and-dice.master-view.v1.${accountId}`
    const [preference, setPreference] = useState(() => ({ key: storageKey, view: savedView(storageKey) }))
    const [error, setError] = useState('')
    // Auth can finish loading after the tracker mounts. Read the correct account's choice.
    if (preference.key !== storageKey) setPreference({ key: storageKey, view: savedView(storageKey) })
    function changeView(view: MasterView) {
        setPreference({ key: storageKey, view })
        try { localStorage.setItem(storageKey, view); setError('') }
        catch { setError('La vista è cambiata, ma la preferenza non è stata salvata nel browser.') }
    }
    return { view: preference.key === storageKey ? preference.view : savedView(storageKey), changeView, error }
}
