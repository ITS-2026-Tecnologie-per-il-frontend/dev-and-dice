import { useState } from 'react'
import { Link } from 'react-router-dom'
import { newCharacterSheet, parseCharacterSheets, type CharacterSheet } from '../utils/CharacterSheets'
import { classId, spellEdition } from '../utils/Spellcasting'
import { PlayerSheet } from '../components/PlayerSheet'

export default function BarbarianCharacterSheet() {
    const storageKey = 'dev-and-dice.barbarian.character.v1'
    const [loaded] = useState(() => {
        const blank = { ...newCharacterSheet(), name: 'Barbaro', characterClass: 'Barbaro', level: '1', playerDetails: { 'creation.class': 'barbarian', 'rules.edition': '2014' } }
        try {
            const raw = localStorage.getItem(storageKey)
            const sheets = raw === null ? [blank] : parseCharacterSheets(raw)
            const saved = sheets[0]
            if (sheets.length !== 1 || !saved || saved.kind !== 'PG' || classId(saved) !== 'barbarian' || spellEdition(saved) !== '2014') throw new Error('Il salvataggio non contiene una scheda del Barbaro 2014.')
            return { sheet: saved, error: '' }
        } catch (error) { return { sheet: blank, error: `Salvataggio non caricato; l’originale è conservato. ${error instanceof Error ? error.message : ''}` } }
    })
    const [sheet, setSheet] = useState<CharacterSheet>(loaded.sheet)
    const [message, setMessage] = useState(loaded.error)
    function save() {
        try {
            if (sheet.kind !== 'PG' || classId(sheet) !== 'barbarian' || spellEdition(sheet) !== '2014') throw new Error('Questa pagina salva personaggi Barbaro dell’edizione 2014. Per le altre classi usa le schede in Dev & Dice.')
            const raw = JSON.stringify([sheet]); parseCharacterSheets(raw); localStorage.setItem(storageKey, raw); setMessage('Scheda salvata nel browser.') }
        catch (error) { setMessage(error instanceof Error ? error.message : 'Salvataggio non riuscito; le modifiche restano aperte.') }
    }
    return <main className="barbarian-character-sheet">
        <nav className="player-barbarian-navigation" aria-label="Controlli della scheda Barbaro"><Link to="/trackers">Dev & Dice</Link><h1>Scheda Barbaro · 2014</h1><Link to="/schede/barbaro/pdf">Modello PDF precedente</Link><button type="button" disabled={!!loaded.error} onClick={save}>Salva scheda</button></nav>
        <p role="status">{message || 'Compila la scheda e salva per conservarla nel browser.'}</p>
        <PlayerSheet sheet={sheet} onChange={setSheet} />
    </main>
}
