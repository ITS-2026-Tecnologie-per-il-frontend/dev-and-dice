import type { CharacterSheet } from './CharacterSheets.ts'
import { characterCalculationIssues, type CreationData } from './PlayerCreation.ts'
import { tutorialChoices, tutorialIssues, tutorialSteps } from './CharacterTutorial.ts'

/** Presentation only: reuse the existing validation without marking a step as visited. */
export function tutorialReview(sheet: CharacterSheet, data: CreationData) {
    const steps=Array.from({length:tutorialSteps.length-1},(_,step)=>tutorialIssues(sheet,data,step))
    const final=[...new Set([...steps.flat(),...characterCalculationIssues(sheet)])]
    return [...steps,final]
}

export function tutorialIssueFields(issue: string, sheet: CharacterSheet, data: CreationData, step: number): string[] {
    if (step===4 && issue===sheet.playerDetails?.['tutorial.randomReview']) return ['additionalTraits','tutorial.randomReviewConfirmed']
    const rules: [RegExp,string[]][] = [
        [/^Scegli l.edizione/,['rules.edition']], [/^Dai un nome/,['name']],
        [/^Scegli una classe/,['creation.class']], [/^Il livello/,['level']],
        [/richiesta una sottoclasse/,['creation.subclass']], [/^Conferma.*avanzamenti/,['tutorial.advancement']],
        [/^Scegli una razza/,['creation.race']], [/scelta della sottorazza/,['creation.subrace']],
        [/^Scegli un background/,['creation.background']], [/^Scegli un metodo/,['tutorial.method']],
        [/^(Assegna sei|Usa ciascun|Acquisto punti|Tira sei|I tiri salvati)/,['scores']],
        [/^(Background storico nel 2024|I bonus del background)/,['background-bonuses']],
        [/^Ranger:/,['additionalTraits','tutorial.randomReviewConfirmed']],
        [/^Conferma le opzioni storiche/,['additionalTraits','tutorial.rules2024']],
        [/^Scegli due lingue standard/,['tutorial.language.0','tutorial.language.1']],
    ]
    for (const [pattern,keys] of rules) if (pattern.test(issue)) return keys
    const choices=tutorialChoices(sheet,data,step)
    const matching=choices.filter(({label})=>issue.startsWith(`Completa: ${label} (`))
    if (matching.length) return matching.map(({path})=>path)
    if (/lingua scelta/.test(issue)) return choices.filter(({choice})=>choice.type==='languages').map(({path})=>path)
    if (/competenza scelta|Maestria|privilegio/.test(issue) && step===4) return ['choices']
    if (step===6) return ['spells']
    return []
}

export function tutorialFieldFeedback(issues: string[], sheet: CharacterSheet, data: CreationData, step: number) {
    const feedback: Record<string,string[]>={}
    for (const issue of issues) for (const key of tutorialIssueFields(issue,sheet,data,step)) (feedback[key] ??= []).push(issue)
    return feedback
}
