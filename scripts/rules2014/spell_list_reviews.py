"""Independent curated links checked against PHB PDF 208-212 renders.

The reviewed snapshot cannot be rewritten by running the OCR extractor. The
original printing's two editorial anomalies remain explicit until errata apply.
"""
from collections import Counter
import json
from pathlib import Path
from curated import source


def apply_spell_list_reviews(spells):
    review=json.loads(Path(__file__).with_suffix('.json').read_text(encoding='utf-8'))
    by_id={s['id']:s for s in spells}
    rows=review['entries']
    if len({(r['class'],r['spellId']) for r in rows})!=len(rows):
        raise ValueError('Duplicate reviewed spell list link')
    if dict(Counter(r['class'] for r in rows))!=review['expectedClassCounts']:
        raise ValueError('Reviewed spell lists changed; review counts against manual')
    for row in rows:
        if row['spellId'] not in by_id:
            raise ValueError('Unknown reviewed spell identity: '+row['spellId'])
    for spell in spells:
        found=[r for r in rows if r['spellId']==spell['id']]
        # Destructive Smite cannot be silently renamed in the original printing.
        if not found:
            spell.setdefault('interpretations',[]).append({'field':'classes','kind':'editorial-review-required',
                'method':'The original paladin list says Destructive Smite; the reviewed errata resolve it separately.'})
            continue
        spell['mechanics']['classes']=sorted(r['class'] for r in found)
        pages=sorted({r['pdfPage'] for r in found})
        spell['sources'].append({**source(pages,'Spell Lists'),'verification':'read-local-render'})
        spell['fieldSources']['classes']=[len(spell['sources'])-1]
        spell.setdefault('relations',{})['classIds']=['phb2014:class:'+c for c in spell['mechanics']['classes']]
        spell['extraction']['fieldStatus']['classes']='verified'
    return spells
