"""python3 tests/spell-timing-audit.py — checks estrazione, annotazioni ed export."""
import hashlib
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from audit_spell_timing import analyze

# ponytail: piccoli input sintetici, senza copie di descrizioni o fixture esterne.
def spell(spell_id, duration, text):
    return analyze({'id':spell_id, 'name':spell_id, 'level':0, 'playtest':False,
                    'sourceUrl':'https://dnd5e.wikidot.com/spell:' + spell_id},
                   f'Source: Test\nDuration: {duration}\n{text}')

row = spell('test-duration', '1 minute', 'No special timing.')
assert row['scadenza']['fase'] == 'inizio' and row['scadenza']['turnoDi'] == 'incantatore'
assert row['scadenza']['faseOrigine'] == 'default_utente'
row = spell('test-explicit', '1 round', 'The effect lasts until the end of its next turn.')
assert row['scadenza']['fase'] == 'fine' and row['scadenza']['turnoDi'] == 'bersaglio'
assert row['scadenza']['faseOrigine'] == 'testo'
row = spell('test-instant', 'Instantaneous', 'A target makes a Dexterity saving throw.')
assert not row['scadenza']['applicabileContatore'] and row['caratteristicheTS'] == ['DES']
assert row['tiriSalvezza'][0]['faseTurno'] is None
row = spell('test-summon', 'Concentration, up to 1 hour',
            'Spell Lists. Test\nSpirit\nA creature must make a Wisdom saving throw.')
assert row['caratteristicheTS'] == ['SAG'], 'Stat blocks after Spell Lists must not disappear'
row = spell('test-summon-expiry', '1 minute', 'No healing until the start of the aberration’s next turn.')
assert row['scadenzeEffetti'][0]['turnoDi'] == 'evocato'

reference = json.loads((ROOT / 'reports/incantesimi-wikidot.json').read_text())
records = reference['incantesimi']
assert len(records) == reference['conteggio'] == 574
assert len({s['id'] for s in records}) == len(records)
by_id = {s['id']:s for s in records}
for row in records:
    assert row['nome'] and row['fonte'].startswith('https://dnd5e.wikidot.com/spell:')
    assert row['scadenza']['fase'] in ('inizio','fine')
    assert row['scadenza']['turnoDi'] in ('incantatore','bersaglio','evocato')
    assert row['tiroSalvezzaRichiesto'] == bool(row['tiriSalvezza'])
    assert set(row['caratteristicheTS']) == {a for e in row['tiriSalvezza'] for a in e['caratteristiche']}
    for e in row['tiriSalvezza']:
        assert e['condizione'] and e['caratteristiche']
        assert set(e['caratteristiche']) <= {'FOR','DES','COS','INT','SAG','CAR'}
        if e['ripetutoOgniTurno']:
            assert e['faseTurno'] in ('inizio','fine') and e['turnoDi']

assert by_id['blade-ward']['scadenza']['fase'] == 'fine'
assert by_id['shield']['scadenza']['fase'] == 'inizio'
assert len(by_id['chill-touch']['scadenzeEffetti']) == 2
assert not by_id['chill-touch']['scadenza']['scadenzaUnica']
assert by_id['hold-person']['tiriSalvezza'][1]['quando'] == 'fine_bersaglio'
assert by_id['searing-smite']['tiriSalvezza'][0]['quando'] == 'inizio_bersaglio'
assert all(e['quando'] != 'lancio' for e in by_id['ray-of-enfeeblement']['tiriSalvezza'])
assert {e['quando'] for e in by_id['moonbeam']['tiriSalvezza']} == {'inizio_bersaglio','condizione'}
assert by_id['ottos-irresistible-dance']['caratteristicheTS'] == ['SAG']
assert by_id['contagion']['caratteristicheTS'] == ['COS']
assert by_id['enlarge-reduce']['caratteristicheTS'] == ['COS']
assert by_id['contact-other-plane']['tiriSalvezza'][0]['chiEffettua'] == 'incantatore'
assert by_id['summon-greater-demon']['tiriSalvezza'][0]['turnoDi'] == 'evocato'
assert by_id['summon-aberration']['scadenzeEffetti'][0]['turnoDi'] == 'evocato'
assert by_id['summon-fey']['scadenzeEffetti'][0]['turnoDi'] == 'evocato'
assert by_id['temporal-shunt']['scadenza']['turnoDi'] == 'bersaglio'
assert not by_id['prismatic-spray']['tiriSalvezza'][-1]['ripetutoOgniTurno']
assert by_id['symbol']['tiriSalvezza'][1]['quando'] == 'fine_bersaglio'
assert not by_id['bless']['tiroSalvezzaRichiesto']
assert not by_id['fizbans-platinum-shield']['tiroSalvezzaRichiesto']
assert by_id['harm']['durataInfo']['kind'] == 'instantaneous'
assert by_id['ceremony']['durataInfo']['kind'] == 'instantaneous'
assert by_id['transmute-rock']['durataInfo']['kind'] == 'conditional'
assert by_id['wish']['gestioneManuale'] and by_id['true-strike']['gestioneManuale']

report = (ROOT / 'reports/differenze-incantesimi-wikidot.md').read_text()
assert hashlib.sha256((ROOT / 'public/data/database.json').read_bytes()).hexdigest() in report
assert 'Transmute Rock | en | durationInfo.kind' in report
assert 'italiano **255**' in report and 'inglese **0**' in report
print('Spell timing audit checks passed (574 spells).')
