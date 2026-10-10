"""Retrieve the PHB's multi-column class lists independently of application data."""
from __future__ import annotations

from difflib import SequenceMatcher
import json
from pathlib import Path
import re
import sys

from pdf_sources import ROOT, WORK, BOOKS, write_json
from spell_extract import normalized


def extract_lists(spells):
    # Optional renderer is deliberately installed locally, outside the app bundle.
    local=ROOT / 'rules-reference.local' / 'python'
    if local.is_dir():
        sys.path.insert(0,str(local))
    try:
        import pymupdf
    except ImportError as error:
        raise RuntimeError('For column extraction install pymupdf locally; see README.') from error
    pdf=pymupdf.open(ROOT / 'MANUALI' / BOOKS['phb'])
    names={normalized(s['name']):s for s in spells}
    result=[]
    unresolved=[]
    columns=[]
    cls=None
    level=None
    aliases={'Fino Steeo':'Find Steed','Destructive Smite':'Destructive Wave','Loeale Crealure':'Locate Creature',
             'Animale Objeels':'Animate Objects','Conlael Olher Plane':'Contact Other Plane',
             "0110'5 Irresislible Dance":"Otto's Irresistible Dance",'Wall oflee':'Wall of Ice','Foreeeage':'Forcecage','Gale':'Gate'}
    for number in range(208,213):
        page=pdf[number-1]
        for col in range(2 if number==212 else 4):
            # These scanned pages have outer margins and alternating gutters;
            # dividing the entire page into equal quarters cuts off headings.
            boundaries=[40,169,297,419,563] if number%2==0 else [38,162,290,412,552]
            clip=pymupdf.Rect(boundaries[col],0,boundaries[col+1],page.rect.height-24)
            text=page.get_text('text',clip=clip,sort=True)
            columns.append({'pdfPage':number,'column':col+1,'text':text})
            lines=[re.sub(r'\s+',' ',s).strip() for s in text.splitlines() if s.strip()]
            if number==208 and col==1:
                # Intro paragraph spans the first two columns above the lists.
                start=next((i for i,line in enumerate(lines) if line=='Hold Person'),len(lines))
                lines=lines[start:]
            pos=0
            while pos<len(lines):
                line=lines[pos]
                pos+=1
                heading=re.match(r'^(BARD|CLERIC|DRUID|PALADIN|RANGER|SORCERER|WARLOCK|WIZARD) SPELLS',line,re.I)
                if heading:
                    cls=heading[1].casefold(); level=None; continue
                if re.match(r'^CANTRIPS',line,re.I):
                    level=0; continue
                h=re.match(r'^([1-9])(?:ST|ND|RD|TH)\s+[LlIi]EVEL',line,re.I)
                if h:
                    level=int(h[1]); continue
                if cls is None or level is None:
                    continue
                if line.startswith(('PART ', 'CHAPTER ')) or re.fullmatch(r'[\W\d]+',line):
                    continue
                # Wrapped proper names and Protection from Evil and Good.
                candidates=[(aliases.get(line,line),1)]
                if pos<len(lines):
                    candidates.append((line+' '+lines[pos],2))
                scored=[]
                for value,count in candidates:
                    n=normalized(value)
                    for normalized_name,spell in names.items():
                        score=SequenceMatcher(None,n,normalized_name).ratio()
                        scored.append((score,count,spell,value))
                best=max(scored,key=lambda x:x[0])
                score,count,spell,value=best
                if score<0.8:
                    unresolved.append({'class':cls,'level':level,'pdfPage':number,'column':col+1,'headingOCR':line,'suggested':spell['name'],'score':round(score,4)})
                    continue
                if count==2:
                    pos+=1
                result.append({'class':cls,'spellId':spell['id'],'level':level,'pdfPage':number,'column':col+1,
                               'headingOCR':line if count==1 else line+' '+lines[pos-1],
                               'matchedName':spell['name'],'matchingScore':round(score,4),
                               'matchingMethod':'curated-candidate-alias' if line in aliases else 'exact' if score==1 else 'fuzzy',
                               'verification':'automated-column-extraction'})
    pdf.close()
    write_json(WORK / 'cache' / 'spell-list-columns.json',columns)
    return {'entries':result,'unresolved':unresolved}


if __name__=='__main__':
    candidates=json.loads((WORK/'spell-candidates.json').read_text(encoding='utf-8'))
    result=extract_lists(candidates)
    write_json(WORK/'spell-list-candidates.json',result)
    print('Entries',len(result['entries']),'unresolved',len(result['unresolved']))
    print(json.dumps(result['unresolved'],ensure_ascii=False))
    from collections import Counter
    print(Counter(x['class'] for x in result['entries']))
