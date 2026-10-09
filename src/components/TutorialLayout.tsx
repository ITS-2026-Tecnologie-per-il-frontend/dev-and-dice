import { useId, type ReactNode } from 'react'

export function TutorialPanel({title,children}: {title:string;children:ReactNode}) {
    const id=useId()
    return <section className="tutorial-panel" aria-labelledby={id}><h4 id={id}>{title}</h4>{children}</section>
}

export function TutorialFieldLabel({label}: {label:string}) {
    const required=/obbligatori[oa]/.test(label),optional=/facoltativ[oa]/.test(label)
    const text=label.replace(/\s*·\s*(obbligatori[oa]|facoltativ[oa])/g,'')
    return <span className="tutorial-field-label">{text}{(required || optional) && <small className="tutorial-field-badge">{required ? 'Obbligatorio' : 'Facoltativo'}</small>}</span>
}

export function TutorialFieldErrors({id,errors}: {id:string;errors?:string[]}) {
    if (!errors?.length) return null
    return <span id={id} className="tutorial-field-error">{errors.join(' ')}</span>
}
