"""Independent PHB spell header extraction; OCR candidates cannot become verified facts."""
from __future__ import annotations

from difflib import SequenceMatcher
import hashlib
import re
import unicodedata

from curated import record, source


def normalized(value: str) -> str:
    return re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFKD', value).casefold())


def slug(value: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', unicodedata.normalize('NFKD', value).casefold()).strip('-')


def ocr_words(value: str) -> str:
    # Repairs only known header tokens, never the spell's prose or rules.
    value = value.strip().replace('\n', ' ')
    value = re.sub(r'^([Il])(?=\s|action|bonus|minute|hour|round)', '1', value)
    value = re.sub(r'\b[Il](?=\s*(?:minute|hour|round))', '1', value)
    value = re.sub(r'(?<=\d)[lI](?=\d|\b)', '1', value)
    value = re.sub(r'(?<=\d)O(?=\d|\b)', '0', value)
    replacements = {'aclion':'action','aetion':'action','actian':'action','aelion':'action','banus':'bonus',
                    'minule':'minute','minules':'minutes','feel':'feet','fee!':'feet','Toueh':'Touch',
                    'SeIf':'Self','Seif':'Self','Sei f':'Self','5elf':'Self','Inslanlaneous':'Instantaneous',
                    'Inslantaneous':'Instantaneous','1nstantaneous':'Instantaneous','Concenlralion':'Concentration',
                    'Concenlration':'Concentration','Coneentration':'Concentration','Canccntration':'Concentration',
                    'Concentralion':'Concentration','uplO':'up to','upto':'up to','up lo':'up to'}
    replacements.update({'Cancentration':'Concentration','COllcentration':'Concentration','ISO feet':'150 feet',
                         'lnstantaneous':'Instantaneous','!nstantaneous':'Instantaneous','lO':'10','IO-foot':'10-foot','Se]f':'Self'})
    for key,replacement in replacements.items():
        value = value.replace(key,replacement)
    value = re.sub(r'(\d)(action|bonus|minute|hour|round|feet)',r'\1 \2',value,flags=re.I)
    return re.sub(r'\s+', ' ', value).strip()


def headers(pages: list[str]) -> list[dict]:
    found=[]
    for pdf_page in range(212,291):
        text=pages[pdf_page-1]
        for match in re.finditer(r'(?im)^Cas(?:ting|ling|tiog)\s*Time\s*:',text):
            prior=text[:match.start()].splitlines()
            prior=[(len(''.join(prior[:i])),line.strip()) for i,line in enumerate(prior) if line.strip()]
            # School is immediately before casting time; header may occupy two lines.
            school=prior[-1][1] if prior else ''
            previous=[line for _,line in prior[:-1]]
            name=previous[-1] if previous else ''
            if len(previous)>1 and re.fullmatch(r"[A-Z0-9'’ /-]+",previous[-2]) and not previous[-2].startswith(('PART ', 'SPELL ', 'CANTRIPS')):
                # Wrapped possessive names and headings, but not unrelated uppercase headings.
                if previous[-2].endswith(('S',"'",'OF','THE')) or name.startswith(('FAITHFUL','PRIVATE','SECRET','MAGNIFICENT','RESILIENT','FREEZING','IRRESISTIBLE','HIDEOUS')):
                    name=previous[-2]+' '+name
            start=text.rfind(previous[-1],0,match.start()) if previous else match.start()
            found.append({'page':pdf_page,'start':start,'castingStart':match.end(),'nameOCR':name,'schoolOCR':school})
    # Each spell runs to the next header, including continuation on subsequent pages.
    for i,entry in enumerate(found):
        nxt=found[i+1] if i+1<len(found) else {'page':291,'start':0}
        page=entry['page']
        if nxt['page']==page:
            block=pages[page-1][entry['castingStart']:nxt['start']]
        else:
            block=pages[page-1][entry['castingStart']:]
            for number in range(page+1,nxt['page']):
                block+='\n'+pages[number-1]
            block+='\n'+pages[nxt['page']-1][:nxt['start']]
        entry['block']=block
        entry['endPage']=nxt['page'] if nxt['start'] else nxt['page']-1
    return found


def extract_spells(pages, names, corrections=None):
    corrections=corrections or {}
    candidates=[]
    for header in headers(pages):
        raw_name=header['nameOCR']
        n=normalized(raw_name)
        matches=sorted([(SequenceMatcher(None,n,normalized(name)).ratio(),name) for name in names],reverse=True)
        score,best=matches[0] if matches else (0,raw_name)
        identity=corrections.get(raw_name)
        name=identity or (best if score>=0.84 else raw_name.title())
        exact=normalized(name)==n
        block=header['block']
        labels=list(re.finditer(r'(?im)^(Range|Components?|Componenls|Durat[;i]on|Duralion|Duratioo)\s*:',block))
        values={'castingTime':block[:labels[0].start()].strip() if labels else None}
        for pos,match in enumerate(labels):
            end=labels[pos+1].start() if pos+1<len(labels) else block.find('\n',match.end())
            if end<0:
                end=len(block)
            key='range' if match[1]=='Range' else 'components' if match[1].startswith('Comp') else 'duration'
            if key in values:
                continue  # A later table in the description may repeat a label.
            values[key]=block[match.end():end].strip()
        school=header['schoolOCR']
        level=0 if re.search(r'cantrip|calltrip|eantrip',school,re.I) else None
        if level is None:
            m=re.match(r'([1-9Il/])',school)
            if m:
                level=int(m[1]) if m[1].isdigit() else 1
        school_options=['abjuration','conjuration','divination','enchantment','evocation','illusion','necromancy','transmutation']
        clean_school=re.sub(r'\([^)]*\)','',school.casefold())
        clean_school=re.sub(r'^[^a-z]*[a-z]{0,2}[-./~]?[^ ]*(?:level|levei|evej|evel)?\s*','',clean_school) if level else clean_school
        school_tokens=normalized(school)
        school_best=max(school_options,key=lambda x: max((SequenceMatcher(None,x,school_tokens[i:i+len(x)]).ratio() for i in range(max(1,len(school_tokens)-len(x)+1))),default=0))
        parsed={key:ocr_words(value) if value else None for key,value in values.items() if key!='components'}
        comp=values.get('components')
        component_flags=re.findall(r'[VS5M]',comp.split('(')[0]) if comp else []
        component_flags=['S' if c=='5' else c for c in component_flags]
        mechanics={'level':level,'school':school_best,'castingTime':parsed.get('castingTime'),'range':parsed.get('range'),
                   'components':component_flags or None,'duration':parsed.get('duration'),'ritual':bool(re.search(r'rit[ua1l]+',school,re.I)),
                   'concentration':bool(re.search(r'conc',parsed.get('duration') or '',re.I)) if parsed.get('duration') else None,
                   'materialCostGP':None,'materialConsumed':None,'effect':None,'upcast':None,'classes':None}
        item=record('spell',slug(name),name,None,list(range(header['page'],header['endPage']+1)),mechanics,
                    'Metadati estratti dal testo OCR del PHB. Effetti, potenziamento e lista di classe richiedono verifica del passaggio completo.',
                    missing=['effect','upcast','classes','materialCostGP','materialConsumed','italianName'])
        item['verification'].update(identity='verified' if identity else 'exact-heading' if exact else 'ocr-candidate',mechanics='ocr-candidate',complete=False)
        item['sources'][0]['verification']='automated-text-extraction'
        item['translation']={'status':'missing','language':'it'}
        item['extraction']={'headingOCR':raw_name,'schoolOCR':school,'matchingScore':round(score,4),
                            'exactHeading':exact,'blockSHA256':hashlib.sha256(block.encode()).hexdigest(),
                            'requiresReview':True,'fieldStatus':{key:'ocr-candidate' if value is not None else 'missing' for key,value in mechanics.items()}}
        # Only short header values are retained, not descriptions or whole pages.
        item['extraction']['headerOCR']={key:value for key,value in values.items() if value and len(value)<=250}
        candidates.append(item)
    return candidates
