"""Official editorial corrections as a separate view; originals stay intact."""
from __future__ import annotations

import argparse
import copy
import hashlib
from relations import progression_status
from pathlib import Path
import re
from urllib.request import Request, urlopen

from pdf_sources import WORK, sha256, write_json

SOURCES = {
    'phb-errata': ('PH-Errata.pdf', 'https://media.wizards.com/2021/dnd/downloads/PH-Errata.pdf',
                   '0c49e2c9c90c9dede38346874c8fda9ff39ce8a715d71aedc5bd1d1e4321014e', '3.0', 5),
    'dmg-errata': ('DMG-Errata.pdf', 'https://media.wizards.com/2021/dnd/downloads/DMG-Errata.pdf',
                   '257679dba5ab5f1d6656b9bc508ad82a5a053ea49d57dbeee6e88a5fe01d6afb', '3.0', 2),
    'mm-errata': ('MM-Errata.pdf', 'https://media.wizards.com/2018/dnd/downloads/MM-Errata.pdf',
                  '94b0049fb762872fba6510f1d6c234de946d962a5ce3f1c15e18e050266410fb', '2.0', 2),
}

RULING_URL='https://media.wizards.com/2020/dnd/downloads/SA-Compendium.pdf'
RULING_SHA256='6f2d092682e627a92dff0412df1c88739669a1b55d4f5aef8daaa53ccc2b4736'
SRD51_URL='https://media.wizards.com/2016/downloads/DND/SRD-OGL_V5.1.pdf'
SRD51_SHA256='d3f94417d2532f42a5abaec07e71a59007bf6cc46992c6458be6667f7a9f1e34'


def load_supporting_srd(download=False):
    """Official later printing of 2014 rules; preserve its distinction from PHB errata."""
    import pymupdf
    path=WORK/'rulings'/'SRD-OGL_V5.1.pdf'
    if not path.exists() and download:
        raw=urlopen(Request(SRD51_URL,headers={'User-Agent':'DevAndDice-rules-verification'}),timeout=30).read()
        if hashlib.sha256(raw).hexdigest()!=SRD51_SHA256:raise ValueError('Official SRD 5.1 changed; review before saving')
        path.parent.mkdir(exist_ok=True);path.write_bytes(raw)
    if not path.exists() or sha256(path)!=SRD51_SHA256:raise ValueError('Missing/changed SRD-OGL_V5.1.pdf; acquire pinned official source with errata.py --download')
    reader=pymupdf.open(path)
    if len(reader)!=403 or 'SystemReferenceDocument5.1' not in re.sub(r'\s','',reader[0].get_text()):raise ValueError('Unexpected SRD version/pages')
    text=' '.join(reader[26].get_text().split())
    if 'normal range of 20 feet' not in text or 'long range of 60 feet' not in text:raise ValueError('SRD Deflect Missiles passage changed')
    return {'filename':path.name,'url':SRD51_URL,'sha256':SRD51_SHA256,'pageCount':403,'status':'verified-official-copy',
        'review':{'edition':'2014','version':'5.1','role':'later-official-2014-printing-not-editorial-erratum','status':'read-indicated-passages',
            'evidence':[{'pdfPage':1,'section':'Legal Information and SRD 5.1 identity'},{'pdfPage':26,'section':'Monk: Ki progression'},{'pdfPage':27,'section':'Deflect Missiles'}],
            'notesIt':'SRD ufficiale inglese 5.1 acquisito dall’URL Wizards del 2016; regole 2014, non SRD 5.2/2024. Il dato esplicito integra la lacuna della prima stampa, conservata separatamente. Supporto italiano PDF 35–36 concordante.'}}


def load_rulings(download=False):
    """Pinned official interpretation; not an editorial replacement or a 2024 source."""
    from pypdf import PdfReader
    path=WORK/'rulings'/'SA-Compendium.pdf'
    if not path.exists() and download:
        with urlopen(Request(RULING_URL,headers={'User-Agent':'DevAndDice-rules-verification'}),timeout=30) as response:raw=response.read()
        if hashlib.sha256(raw).hexdigest()!=RULING_SHA256:raise ValueError('Official ruling PDF changed; review before saving')
        path.parent.mkdir(exist_ok=True);path.write_bytes(raw)
    if not path.exists() or sha256(path)!=RULING_SHA256:raise ValueError('Missing/changed SA-Compendium.pdf; run errata.py --download and review the official copy')
    reader=PdfReader(path)
    if len(reader.pages)!=23 or 'Version 2.7' not in reader.pages[0].extract_text():raise ValueError('Unexpected Sage Advice version')
    return {'filename':'SA-Compendium.pdf','url':RULING_URL,'sha256':RULING_SHA256,'pageCount':23,'status':'verified-official-copy',
        'review':{'edition':'2014','version':'2.7','role':'official-rulings-distinct-from-errata','status':'read-indicated-passages',
        'evidence':[{'pdfPage':1,'section':'Rules References and Official Rulings'},{'pdfPage':2,'section':'Racial Traits: Trance'}],
        'notesIt':'Fonte ufficiale 2021 delle regole pubblicate nel 2014, non la revisione 2024. Il chiarimento sulla Trance resta distinto dal PHB e dalle errata; il DM decide l’adozione dei chiarimenti ufficiali.'}}


def load_errata(download=False):
    from pypdf import PdfReader
    manifest, inventory = {}, []
    folder = WORK / 'errata'
    folder.mkdir(parents=True, exist_ok=True)
    for book, (filename, url, expected, version, count) in SOURCES.items():
        path = folder / filename
        if not path.is_file() and download:
            with urlopen(Request(url, headers={'User-Agent': 'DevAndDice-rules-verification'}), timeout=30) as response:
                raw = response.read()
            if not raw.startswith(b'%PDF'):
                raise ValueError('Not a PDF: ' + url)
            path.write_bytes(raw)
        if not path.is_file() or sha256(path) != expected:
            raise ValueError('Missing or changed official errata: ' + filename + '; run errata.py --download or review the changed copy')
        reader = PdfReader(path)
        pages = [p.extract_text() or '' for p in reader.pages]
        if len(pages) != count or 'Version ' + version not in pages[0]:
            raise ValueError('Unexpected errata version/pages: ' + filename)
        manifest[book] = {'filename': filename, 'url': url, 'sha256': expected, 'pageCount': count,
                         'status': 'text-extracted', 'review': {'edition': '2014', 'version': version,
                         'role': 'official-editorial-corrections', 'status': 'verified-official-copy',
                         'evidence': [{'pdfPage': 1, 'section': 'Version and document introduction'}],
                         'notesIt': 'Errata della quinta edizione originale; non sono regole 2024. Le singole correzioni hanno stati di revisione separati.'}}
        for page, text in enumerate(pages, 1):
            # Heading inventory only. No copyrighted paragraphs enter artifacts.
            for match in re.finditer(r'(?:\[New\]\s*)?([^\n]+?)\s*\(p(?:g)?\.?\s*(\d+)\)', text):
                inventory.append({'book': book, 'section': match[1].strip(), 'pdfPage': page,
                                  'originalPrintedPage': int(match[2]), 'status': 'heading-candidate-not-encoded'})
    return manifest, inventory


def editorial_source(page, section, book='phb-errata'):
    return {'edition': '2014', 'book': book, 'filename': SOURCES[book][0],
            'pdfPages': [page], 'printedPages': None, 'section': section,
            'url': SOURCES[book][1], 'verification': 'read-local-text'}


def corrected_reference(original, manifest):
    result = copy.deepcopy(original)
    result['sources'].update(manifest)
    result['rulesVersion'] = '2014-with-reviewed-2021-errata'
    result['status'] = 'partial-corrected-reference-not-runtime-database'
    by_id = {e['id']: e for e in result['entities']}
    changes = []
    if 'dmg2014:rule:encounter-difficulty' in by_id:
        e=by_id['dmg2014:rule:encounter-difficulty'];src=editorial_source(1,'Evaluating Encounter Difficulty',book='dmg-errata')
        e['sources'].append(src);e['fieldSources']['difficulty'].append(len(e['sources'])-1)
        result.setdefault('editorialConfirmationLog',[]).append({'entityId':e['id'],'field':'difficulty','operation':'confirm-existing-local-wording','sources':[src],'verification':'verified-official-erratum-already-in-local-copy'})
    if 'dmg2014:rule:combining-game-effects' in by_id:
        e=by_id['dmg2014:rule:combining-game-effects'];src=editorial_source(2,'Combining Game Effects',book='dmg-errata')
        e['sources'].append(src)
        for field in e['mechanics']:e['fieldSources'][field].append(len(e['sources'])-1)
        result.setdefault('editorialConfirmationLog',[]).append({'entityId':e['id'],'field':'mechanics','operation':'confirm-existing-local-wording','sources':[src],'verification':'verified-official-erratum-already-in-local-copy'})
    if 'dmg2014:rule:poison-delivery' in by_id:
        e=by_id['dmg2014:rule:poison-delivery'];src=editorial_source(2,'Poison',book='dmg-errata')
        e['sources'].append(src);e['fieldSources']['types'].append(len(e['sources'])-1)
        result.setdefault('editorialConfirmationLog',[]).append({'entityId':e['id'],'field':'types','operation':'confirm-existing-local-wording','sources':[src],'verification':'verified-official-erratum-already-in-local-copy'})
    if 'dmg2014:rule:treasure-hoard-11-16' in by_id:
        e=by_id['dmg2014:rule:treasure-hoard-11-16'];src=editorial_source(1,'Treasure Hoard: Challenge 11–16',book='dmg-errata')
        e['sources'].append(src);e['fieldSources']['rows'].append(len(e['sources'])-1)
        result.setdefault('editorialConfirmationLog',[]).append({'entityId':e['id'],'field':'rows.10-12','operation':'confirm-existing-local-wording','sources':[src],'verification':'verified-official-erratum-already-in-local-copy'})

    def apply(entity_id, field, value, page, section, *, remove=False, book='phb-errata'):
        e = by_id[entity_id]
        parts = field.split('.')
        parent = e['mechanics']
        for key in parts[:-1]:
            parent = parent[int(key)] if isinstance(parent, list) else parent[key]
        key = int(parts[-1]) if isinstance(parent, list) else parts[-1]
        old = copy.deepcopy(parent.get(key)) if isinstance(parent, dict) else copy.deepcopy(parent[key])
        existed = key in parent if isinstance(parent, dict) else True
        if remove:
            parent.pop(key)
        else:
            parent[key] = copy.deepcopy(value)
        src = editorial_source(page, section, book)
        e['sources'].append(src)
        top = parts[0]
        if top in e['mechanics']:
            e['fieldSources'].setdefault(top, []).append(len(e['sources']) - 1)
        else:
            e['fieldSources'].pop(top, None)
        change = {'entityId': entity_id, 'field': field, 'operation': 'remove' if remove else 'replace' if existed else 'add',
                  'originalValue': old, 'correctedValue': None if remove else value, 'sources': [src],
                  'verification': 'verified-official-erratum'}
        changes.append(change)
        e.setdefault('editorialCorrections', []).append(change)
        if field in e.get('extraction',{}).get('fieldStatus',{}):
            e['extraction']['fieldStatus'][field]='verified-official-erratum'

    def confirm(entity_id,field,value,page,section,book):
        e=by_id[entity_id];actual=e['mechanics']
        for part in field.split('.'):
            actual=actual[int(part)] if isinstance(actual,list) else actual[part]
        if actual!=value:raise ValueError('Local wording confirmation changed: '+entity_id+':'+field)
        src=editorial_source(page,section,book);e['sources'].append(src)
        e['fieldSources'][field.split('.')[0]].append(len(e['sources'])-1)
        result.setdefault('editorialConfirmationLog',[]).append({'entityId':entity_id,'field':field,'operation':'confirm-existing-local-wording','sources':[src],'verification':'verified-official-erratum-already-in-local-copy'})

    for entity_id,field,value,section in [
        ('dmg2014:rule:crafting-magic-items','consumableCostMultiplier',0.5,'Crafting a Magic Item'),
        ('dmg2014:rule:attunement','spellcasterPrerequisite','casts-one-spell-by-traits-or-features-not-item','Attunement'),
        ('dmg2014:rule:magic-item-use','magicWeaponAmmunition','magical-to-overcome-nonmagical-attack-and-damage-resistance-immunity','Magic Weapons'),
        ('dmg2014:magic-item:amulet-of-health','effect.abilityScore.noEffectIfWithoutItemAtLeast',19,'Amulet of Health'),
        ('dmg2014:magic-item:gauntlets-of-ogre-power','effect.abilityScore.noEffectIfWithoutItemAtLeast',19,'Gauntlets of Ogre Power'),
        ('dmg2014:magic-item:headband-of-intellect','effect.abilityScore.noEffectIfWithoutItemAtLeast',19,'Headband of Intellect'),
        ('dmg2014:magic-item:belt-of-giant-strength','effect.noEffectIfWithoutItem','equal-or-higher','Belt of Giant Strength'),
        ('dmg2014:magic-item:bag-of-tricks','effect.creatureDuration','until-next-dawn-or-zero-HP-already-present-in-local-copy','Bag of Tricks')]:
        confirm(entity_id,field,value,1,section,'dmg-errata')
    confirm('phb2014:class-feature:monk-3-deflect-missiles','effect.returnAttack.countsAsMonkWeapon',True,1,'Deflect Missiles','phb-errata')
    confirm('phb2014:rule:spell-components','somaticMaterialMayShareHand',True,4,'Material (M)','phb-errata')
    apply('dmg2014:rule:abyss-corruption','rows.2.headingInLocalPrinting','Overwhelming Ambition',1,'Abyssal Corruption Table',book='dmg-errata')
    apply('phb2014:rule:multiclassing','newClassStartingEquipmentGranted',False,3,'Class Features')
    apply('phb2014:rule:multiclassing','scalingCantripLevelBasis','total-character-level',3,'Spells Known and Prepared')
    apply('phb2014:feat:grappler', 'printingOnlyClause', None, 3, 'Grappler', remove=True)
    apply('phb2014:rule:spellcasting-basics','equalPotencyPriorityInLocalPrinting','most-recent-when-overlapping',4,'Combining Magical Effects')
    by_id['phb2014:rule:spellcasting-basics']['summaryIt']+=' L’erratum dà priorità all’effetto più recente se le potenze sono uguali e le durate si sovrappongono.'
    for cls in [e for e in result['entities'] if e['kind']=='class']:
        apply(cls['id'],'hitPointsHigherLevels.minimum',1,1,'Beyond 1st Level')
        cls['summaryIt']+=' Nella vista corretta l’aumento di PF per nuovo livello ha minimo uno dopo il modificatore di Costituzione.'
    if 'dmg2014:race:aasimar-dmg-example' in by_id:
        apply('dmg2014:race:aasimar-dmg-example','alignmentSuggestionIt',None,2,'Example Race: Aasimar',remove=True,book='dmg-errata')
    apply('phb2014:feat:alert','unseenAttackersGainAdvantage',False,3,'Alert')
    apply('phb2014:feat:alert','hiddenAttackersGainAdvantage',None,3,'Alert',remove=True)
    apply('phb2014:feat:athlete','climbingHalvesSpeed',None,3,'Athlete',remove=True)
    apply('phb2014:feat:athlete','climbingExtraMovementCost',0,3,'Athlete')
    apply('phb2014:feat:crossbow-expert','bonusAttack.weapon','hand-crossbow-held',3,'Crossbow Expert')
    apply('phb2014:feat:dungeon-delver','trapSearchAllowedTravelPace',None,3,'Dungeon Delver',remove=True)
    apply('phb2014:feat:dungeon-delver','fastTravelPassivePerceptionPenalty',0,3,'Dungeon Delver')
    apply('phb2014:feat:heavy-armor-master','damageReduction.from','nonmagical-attacks',3,'Heavy Armor Master')
    apply('phb2014:feat:magic-initiate','freeCast.scope','using-this-feat-at-lowest-level',3,'Magic Initiate')
    apply('phb2014:feat:sentinel','disengageDoesNotPreventOpportunityWithinFt',None,3,'Sentinel',remove=True)
    apply('phb2014:feat:sentinel','disengageDoesNotPreventOpportunity',True,3,'Sentinel')
    apply('phb2014:feat:tavern-brawler','proficiencies',['improvised-weapons'],3,'Tavern Brawler')
    apply('phb2014:feat:weapon-master','weaponProficiencyChoice.categories',['simple','martial'],3,'Weapon Master')
    for index,text in {
        'alert':'Cinque all’iniziativa, niente sorpresa da cosciente, e nessun vantaggio altrui dovuto a non essere visti da te.',
        'athlete':'Incremento fisico; rialzarsi costa cinque piedi, arrampicarsi non costa movimento extra e rincorsa di cinque piedi per i salti.',
        'crossbow-expert':'Ignora Caricamento con balestre competenti e svantaggio a distanza da ostili vicini. Attacco bonus con balestra a mano impugnata dopo Attaccare con arma a una mano; munizioni e mano libera restano richieste.',
        'dungeon-delver':'Vantaggio a individuare porte segrete e TS contro trappole, resistenza al loro danno. Passo veloce non impone la normale penalità meno cinque a Percezione passiva.',
        'heavy-armor-master':'Forza aumenta di uno fino a venti; con armatura pesante riduce di tre i danni contundenti, perforanti e taglienti da attacchi non magici.',
        'sentinel':'Colpire con attacco di opportunità azzera velocità per il turno. Disimpegno non evita le tue opportunità; il distinto attacco di reazione contro chi attacca altri mantiene il limite di cinque piedi.',
        'tavern-brawler':'Incremento Forza o Costituzione; competenza nelle armi improvvisate e danno senz’armi d4. Dopo colpo senz’armi o improvvisato nel tuo turno puoi afferrare con azione bonus. La competenza senz’armi viene dalla regola generale corretta.',
        'weapon-master':'Incremento Forza o Destrezza e quattro competenze in armi, ciascuna semplice o da guerra.',
    }.items():
        e=by_id['phb2014:feat:'+index];e['originalPrintingSummaryIt']=e['summaryIt'];e['summaryIt']=text
    apply('phb2014:rule:long-rest', 'hitDiceRecovery.minimum', 1, 4, 'Long Rest')
    apply('phb2014:rule:long-rest', 'minimumSleepHours', 6, 4, 'Long Rest')
    apply('phb2014:rule:short-rest', 'minimumHealingPerDie', 0, 4, 'Short Rest')
    if 'phb2014:rule:jumping' in by_id:
        apply('phb2014:rule:jumping','minimumHighJumpFtInLocalPrinting',0,4,'High Jump')
        apply('phb2014:rule:suffocating','chokingExplicitInLocalPrinting',True,4,'Suffocating')
        apply('phb2014:rule:suffocating','healingAndStabilizationRestrictionInLocalPrinting','cannot-regain-HP-or-be-stabilized-until-can-breathe',4,'Suffocating')
        apply('phb2014:rule:vision-light','heavyObscurementInLocalPrinting','effectively-blinded-when-trying-to-see-something-in-area',4,'Vision and Light')
        apply('phb2014:rule:vision-light','darkvisionInLocalPrinting','dim-light-as-bright-darkness-as-dim-only-gray-in-darkness',4,'Darkvision')
    if 'mm2014:creature:elephant' in by_id:
        apply('mm2014:creature:elephant','actions.0.damage',{'average':19,'dice':'3d8+6','type':'piercing'},1,'Elephant',book='mm-errata')
        apply('mm2014:creature:elephant','actions.1.damage',{'average':22,'dice':'3d10+6','type':'bludgeoning'},1,'Elephant',book='mm-errata')
        by_id['mm2014:creature:elephant']['mechanics']['actions'][0]['summaryIt']='Zanne più otto, portata cinque, 19 (3d8 più 6) perforanti, corretti dalle errata.'
        by_id['mm2014:creature:elephant']['mechanics']['actions'][1]['summaryIt']='Calpestare più otto, portata cinque, 22 (3d10 più 6) contundenti contro creatura prona, corretti dalle errata.'
    if 'mm2014:creature:efreeti' in by_id:
        apply('mm2014:creature:efreeti','traits.1.effect.threePerDayEachInLocalPrinting',True,1,'Efreeti',book='mm-errata')
        e=by_id['mm2014:creature:efreeti']
        missing=[f for f in e['verification']['missingFields'] if f!='innateSpellcasting.threePerDayUsageScope']
        e['verification'].update(complete=not missing,missingFields=missing)
        e['mechanics']['traits'][1]['summaryIt']='Carisma, CD quindici, attacco più sette, senza materiali. Individuazione del Magico a volontà; Ingrandire/Ridurre e Linguaggi tre al giorno ciascuno secondo errata; altre sei magie una al giorno ciascuna, Evocare Elementale solo fuoco.'
    if 'mm2014:rule:legendary-creatures' in by_id:
        for field in ['otherActionPreventionInLocalPrinting','surpriseRestrictionInLocalPrinting','lairActionPreventionInLocalPrinting','lairSurpriseRestrictionInLocalPrinting']:
            apply('mm2014:rule:legendary-creatures',field,True,1,'Legendary Creatures',book='mm-errata')
        apply('mm2014:rule:legendary-creatures','assumedLegendaryFormInheritanceInLocalPrinting','no-legendary-actions-lair-actions-or-regional-effects',1,'Legendary Creatures',book='mm-errata')
        apply('mm2014:rule:monster-actions-and-spells','classMembershipForMagicItemsInLocalPrinting',True,1,'Spellcasting',book='mm-errata')
    if 'mm2014:creature:giant-rat' in by_id:
        apply('mm2014:creature:giant-rat','optionalVariants.0.effect.action.attackBonus',4,1,'Diseased Giant Rat',book='mm-errata')
        apply('mm2014:creature:giant-rat','optionalVariants.0.effect.action.damage',{'average':4,'dice':'1d4+2','type':'piercing'},1,'Diseased Giant Rat',book='mm-errata')
        by_id['mm2014:creature:giant-rat']['mechanics']['optionalVariants'][0]['effect']['action']['summaryIt']='Morso variante corretto: più quattro, cinque piedi, 4 (1d4 più 2) perforanti. Creatura TS Costituzione dieci o malattia: solo cure magiche, massimo PF meno d6 ogni ventiquattro ore; massimo zero uccide.'
    for horse,bonus in [('riding-horse',5),('warhorse',6)]:
        entity_id='mm2014:creature:'+horse
        if entity_id in by_id:
            apply(entity_id,'actions.0.attackBonus',bonus,2,horse.replace('-',' ').title(),book='mm-errata')
            by_id[entity_id]['mechanics']['actions'][0]['summaryIt']=by_id[entity_id]['mechanics']['actions'][0]['summaryIt'].replace('bonus +2','bonus +5').replace('bonus +4','bonus +6')
    if 'dmg2014:rule:magic-item-use' in by_id:
        apply('dmg2014:rule:magic-item-use','scrollActivationInLocalPrinting','user-reads; casting-time-from-scroll-description',1,'Scrolls',book='dmg-errata')
        apply('dmg2014:rule:magic-item-spellcasting','defaultSpellLevelInLocalPrinting','lowest-possible-spell-and-caster-level',1,'Spells',book='dmg-errata')
    if 'dmg2014:magic-item:instrument-of-the-bards' in by_id:
        apply('dmg2014:magic-item:instrument-of-the-bards','effect.charmSaveDisadvantageInLocalPrinting','play-while-casting-spell-that-charms-on-failed-save-and-has-somatic-or-material-component',1,'Instrument of the Bards',book='dmg-errata')
    if 'dmg2014:magic-item:ring-of-the-ram' in by_id:
        apply('dmg2014:magic-item:ring-of-the-ram','effect.attackKindInLocalPrinting','ranged-spell-attack',1,'Ring of the Ram',book='dmg-errata')
    if 'dmg2014:magic-item:rod-of-lordly-might' in by_id:
        apply('dmg2014:magic-item:rod-of-lordly-might','effect.buttons.0.swordTypeChoiceInLocalPrinting',True,1,'Rod of Lordly Might',book='dmg-errata')
    for item,section in [('pearl-of-power','Pearl of Power'),('spell-scroll','Spell Scroll'),('wand-of-paralysis','Wand of Paralysis')]:
        if 'dmg2014:magic-item:'+item in by_id:
            e=by_id['dmg2014:magic-item:'+item];src=editorial_source(1,section,book='dmg-errata')
            e['sources'].append(src)
            result.setdefault('editorialConfirmationLog',[]).append({'entityId':e['id'],'field':'effect','operation':'confirm-existing-local-wording','sources':[src],'verification':'verified-official-erratum-already-in-local-copy'})
    for e in result['entities']:
        if e['kind']=='creature':
            for field in ['conditionalDamageResistances','conditionalDamageImmunities']:
                for i,entry in enumerate(e['mechanics'].get(field,[])):
                    condition=entry.get('condition','')
                    if condition.startswith('nonmagical-weapons'):
                        apply(e['id'],f'{field}.{i}.condition',condition.replace('nonmagical-weapons','nonmagical-attacks',1),1,'Global Damage Resistances/Immunities',book='mm-errata')
        if e['kind']=='creature' and e['mechanics'].get('isSwarm'):
            apply(e['id'],'conditionImmunities',e['mechanics']['conditionImmunities']+['grappled'],2,'Swarm of X',book='mm-errata')
    if 'mm2014:creature:magmin' in by_id:
        apply('mm2014:creature:magmin','actions.0.effect.ongoingBurn.damageSubjectInLocalPrinting','target',2,'Magmin: Touch',book='mm-errata')
        by_id['mm2014:creature:magmin']['mechanics']['actions'][0]['summaryIt']='Tocco più quattro, portata cinque piedi, 2d6 fuoco. Incendia creatura od oggetto infiammabile; il bersaglio subisce d6 fuoco a fine ciascun proprio turno finché una creatura usa azione per spegnere. Erratum distinto dalla stampa che indicava creatura; la gestione del turno di un oggetto non è definita dal blocco.'
    if 'mm2014:creature:deva' in by_id:
        apply('mm2014:creature:deva','skillBonuses.insight',9,1,'Deva',book='mm-errata')
    if 'mm2014:creature:horned-devil' in by_id:
        apply('mm2014:creature:horned-devil','hitPoints.dice','17d10+85',2,'Horned Devil',book='mm-errata')
    if 'mm2014:creature:barlgura' in by_id:
        apply('mm2014:creature:barlgura','speedFt.walk',40,1,'Barlgura',book='mm-errata')
        apply('mm2014:creature:barlgura','speedFt.climb',40,1,'Barlgura',book='mm-errata')
    if 'mm2014:creature:gray-slaad' in by_id:
        apply('mm2014:creature:gray-slaad','skillBonuses.perception',7,1,'Gray Slaad',book='mm-errata')
        apply('mm2014:creature:gray-slaad','passivePerception',17,1,'Gray Slaad',book='mm-errata')
    if 'mm2014:creature:solar' in by_id:
        e=by_id['mm2014:creature:solar']
        bow=next(i for i,a in enumerate(e['mechanics']['actions']) if a['index']=='slaying-longbow')
        apply(e['id'],f'actions.{bow}.rangeFt.normal',150,2,'Solar: Slaying Longbow',book='mm-errata')
        e['mechanics']['actions'][bow]['summaryIt']=e['mechanics']['actions'][bow]['summaryIt'].replace('gittata originale centoventi/seicento','gittata corretta centocinquanta/seicento')
    if 'mm2014:creature:night-hag' in by_id:
        e=by_id['mm2014:creature:night-hag']
        innate=next(i for i,t in enumerate(e['mechanics']['traits']) if t['index']=='innate-spellcasting')
        apply(e['id'],f'traits.{innate}.effect.spellSaveDC',14,2,'Night Hag',book='mm-errata')
        apply(e['id'],f'traits.{innate}.effect.spellAttackBonus',6,2,'Night Hag',book='mm-errata')
        apply(e['id'],'actions.0.attackBonus',7,2,'Night Hag',book='mm-errata')
        e['mechanics']['actions'][0]['summaryIt']='Artigli solo forma di megera: attacco più sette, portata cinque piedi, 2d8 più quattro taglienti; erratum distinto dal più sei originale.'
        e['summaryIt']+=' Erratum MM PDF 2: incantesimi innati CD quattordici e attacco più sei, artigli più sette. La congenita dipendenza da Dardo Incantato rimane aperta.'
    apply('phb2014:weapon-property:ammunition', 'freeHandToLoadOneHandedWeapon', True, 3, 'Ammunition')
    apply('phb2014:weapon-property:heavy', 'attackDisadvantageSizes', ['Small', 'Tiny'], 3, 'Heavy')
    apply('phb2014:weapon-property:reach', 'opportunityReach', 'normal-reach-plus-5-ft-with-this-weapon', 3, 'Reach')
    apply('phb2014:weapon-property:two-handed', 'handsRequiredWhen', 'attacking', 3, 'Two-Handed')
    apply('phb2014:condition:exhaustion', 'raisedFromDeadReductionLevels', 1, 5, 'Exhaustion')
    apply('phb2014:rule:advantage','rerollOrReplaceOneDieOnly',True,3,'Advantage and Disadvantage')
    if 'phb2014:rule:hiding' in by_id:
        apply('phb2014:rule:hiding','circumstancesDecidedByDM',True,3,'Hiding')
        apply('phb2014:rule:hiding','cannotHideFrom','creature-that-can-see-you-clearly',3,'Hiding')
    apply('phb2014:spell:acid-splash','effect.targetChoice.requiresSight',True,4,'Acid Splash')
    apply('phb2014:spell:find-steed','effect.telepathicCommunication','both-directions',5,'Find Steed')
    apply('phb2014:spell:slow','effect.repeatSave','wisdom-end-of-each-target-turn-success-ends-on-target',5,'Slow')
    for entity_id,text in [
        ('phb2014:spell:acid-splash','L’erratum richiede di vedere ciascun bersaglio.'),
        ('phb2014:spell:find-steed','L’erratum rende esplicita la comunicazione telepatica in entrambe le direzioni.'),
        ('phb2014:spell:slow','L’erratum specifica un nuovo TS alla fine di ciascun turno del bersaglio.'),
        ('phb2014:rule:hiding','L’erratum attribuisce al DM le circostanze adatte e vieta nascondersi da chi ti vede chiaramente.'),
        ('phb2014:rule:multiclassing','L’erratum esclude l’equipaggiamento iniziale della nuova classe e lega i trucchetti scalabili al livello totale del personaggio.')]:
        e=by_id[entity_id];e.setdefault('originalPrintingSummaryIt',e['summaryIt']);e['summaryIt']+=' '+text
    if 'phb2014:rule:creature-space' in by_id:
        apply('phb2014:rule:creature-space','surroundingMediumExamples.LargeAroundOneMediumInLocalPrinting',4,4,'Creature Size')
        apply('phb2014:action:ready','expiresInLocalPrinting','before-start-of-own-next-turn',4,'Ready')
        apply('phb2014:rule:grapple','automaticSuccessAgainstIncapacitated',True,4,'Grappling')
        apply('phb2014:rule:shove','automaticSuccessAgainstIncapacitated',True,4,'Shoving a Creature')
        apply('phb2014:rule:unarmed-strikes','listedAsWeaponInLocalPrinting',False,3,'Weapons')
        apply('phb2014:rule:unarmed-strikes','weaponCategoryInLocalPrinting',None,4,'Melee Attacks',remove=True)
        apply('phb2014:rule:unarmed-strikes','proficiencyInLocalPrinting','all-characters-proficient',4,'Melee Attacks')
        apply('phb2014:rule:unarmed-strikes','correctedRulePending',None,4,'Melee Attacks',remove=True)
        apply('phb2014:rule:unarmed-strikes','attackKind','melee-weapon-attack-without-being-a-weapon',4,'Melee Attacks')
    for i in [1, 2]:
        apply('phb2014:race:tiefling', f'traits.1.mechanics.grants.{i}.recovery', 'long-rest', 1, 'Infernal Legacy')
        apply('phb2014:subrace:dark-elf', f'spellGrants.grants.{i}.recovery', 'long-rest', 1, 'Drow Magic')
    apply('phb2014:race:tiefling', 'traits.1.mechanics.printingNote', None, 1, 'Infernal Legacy', remove=True)
    apply('phb2014:feat:polearm-master', 'bonusActionAttackWeapons', ['glaive', 'halberd', 'quarterstaff', 'spear'], 3, 'Polearm Master')
    apply('phb2014:feat:polearm-master', 'opportunityOnEnteringReachWeapons', ['glaive', 'halberd', 'pike', 'quarterstaff', 'spear'], 3, 'Polearm Master')
    apply('phb2014:feat:polearm-master', 'bonusAttackAbility', 'same-as-primary-attack', 3, 'Polearm Master')
    apply('phb2014:feat:martial-adept', 'superiorityDie', '1d6', 3, 'Martial Adept')
    apply('phb2014:feat:martial-adept', 'addedToExistingSuperiorityDice', True, 3, 'Martial Adept')
    apply('phb2014:spell:revivify', 'school', 'necromancy', 5, 'Revivify')
    apply('phb2014:spell:destructive-wave', 'classes', ['paladin'], 4, 'Paladin Spells')
    by_id['phb2014:spell:destructive-wave'].setdefault('relations',{})['classIds']=['phb2014:class:paladin']
    by_id['phb2014:spell:destructive-wave']['extraction']['fieldStatus']['classes']='verified-official-erratum'
    result['spellListEditorialResolutions']=[
        {'originalName':'Destructive Smite','correctedName':'Destructive Wave','operation':'rename',
         'class':'paladin','originalPdfPage':210,'sources':[editorial_source(4,'Paladin Spells')]},
        {'originalName':'Trap the Soul','operation':'remove','class':'wizard','originalPdfPage':212,
         'sources':[editorial_source(4,'Wizard Spells')]},
    ]
    # A verified correction to one field does not promote an OCR spell description.
    for index in ['mass-cure-wounds', 'mass-heal']:
        apply('phb2014:spell:' + index, 'school', 'evocation', 5, index.replace('-', ' ').title())
    for entity in result['entities']:
        if entity['id'] in ['phb2014:rule:long-rest', 'phb2014:weapon-property:reach']:
            entity['verification'].update(complete=True, missingFields=[])
        if entity['id'] == 'phb2014:rule:long-rest':
            entity['summaryIt'] = 'Otto ore di riposo, almeno sei di sonno salvo eccezioni specifiche; recuperi tutti i PF e meta dei dadi vita, con un minimo di uno.'
        if entity['id'] == 'phb2014:feat:grappler':
            entity['summaryIt'] = 'Vantaggio contro il bersaglio afferrato; un tentativo di immobilizzazione puo rendere trattenuti entrambi. Il terzo beneficio della prima stampa e rimosso dalle errata.'
        if entity['id'] == 'phb2014:weapon-property:reach':
            entity['summaryIt'] = 'La portata aumenta di cinque piedi per gli attacchi e per determinare gli attacchi di opportunita con questa arma.'
    # Concrete warlock records may be added after the original reference expands.
    extra = [
        ('phb2014:class-option:pact-of-the-chain', 'effect.familiarAttackUsesReaction', True, 2, 'Pact of the Chain'),
        ('phb2014:class-option:pact-of-the-tome', 'effect.cantripsCountAsWarlockSpells', True, 2, 'Pact of the Tome'),
        ('phb2014:class-feature:warlock-2-eldritch-invocations', 'effect.levelPrerequisiteUses', 'warlock-level', 2, 'Eldritch Invocations'),
        ('phb2014:class-option:book-of-ancient-secrets', 'effect.initialRitualListsMayDiffer', True, 2, 'Book of Ancient Secrets'),
    ]
    for entity_id, field, value, page, section in extra:
        if entity_id in by_id:
            apply(entity_id, field, value, page, section)
    if 'phb2014:class-option:feinting-attack' in by_id:
        apply('phb2014:class-option:feinting-attack','effect.advantageExpires','end-of-own-current-turn',1,'Feinting Attack')
        feint=by_id['phb2014:class-option:feinting-attack']
        feint['verification'].update(complete=True,missingFields=[])
        feint['summaryIt']='Un’azione bonus nel tuo turno concede vantaggio al prossimo attacco effettuato nello stesso turno contro una creatura entro cinque piedi; se colpisci aggiungi il dado ai danni. Consuma un dado di superiorità; massimo una manovra per attacco.'
        for eid in ['phb2014:subclass-feature:battle-master-3-combat-superiority','phb2014:subclass:battle-master','phb2014:feat:martial-adept']:
            e=by_id[eid]
            # Only the individually reviewed dependency is resolved, never an unrelated gap.
            missing=[f for f in e['verification']['missingFields'] if f not in [
                'choiceEffects:phb2014:class-option:feinting-attack',
                'featureEffects:phb2014:subclass-feature:battle-master-3-combat-superiority']]
            e['verification'].update(complete=not missing,missingFields=missing)
    ek='phb2014:subclass-feature:eldritch-knight-3-spellcasting'
    if ek in by_id:
        apply(ek,'effect.unrestrictedReplacementForSpellLearnedAtLevels',[3,8,14,20],1,'Spells Known of 1st-Level and Higher')
        apply(ek,'effect.unrestrictedReplacementRequiresOriginalUnrestrictedChoice',True,1,'Spells Known of 1st-Level and Higher')
        apply(ek,'effect.slotSpells','known-wizard-spells',1,'Spell Slots')
    at='phb2014:subclass-feature:arcane-trickster-3-spellcasting'
    if at in by_id:
        apply(at,'effect.unrestrictedReplacementForSpellLearnedAtLevels',[3,8,14,20],2,'Spells Known of 1st-Level and Higher')
        apply(at,'effect.unrestrictedReplacementRequiresOriginalUnrestrictedChoice',True,2,'Spells Known of 1st-Level and Higher')
        apply(at,'effect.slotSpells','known-wizard-spells',2,'Spell Slots')
    bonus_cantrip='phb2014:subclass-feature:land-2-bonus-cantrip'
    if bonus_cantrip in by_id:
        apply(bonus_cantrip,'effect.countsAgainstCantripsKnownLimit',False,1,'Bonus Cantrip')
    bard_casting='phb2014:class-feature:bard-1-spellcasting'
    if 'effect' in by_id[bard_casting]['mechanics']:
        apply(bard_casting,'effect.spellSlotScope','bard-spells',1,'Spell Slots')
        for e in result['entities']:
            if e['kind']=='class-feature' and e['relations']['classId']=='phb2014:class:bard' and e['name']=='Song of Rest':
                apply(e['id'],'effect.requiresSpendingHitDice',True,1,'Song of Rest')
                e['originalPrintingSummaryIt']=e['summaryIt']
                e['summaryIt']='Durante il riposo breve te e gli amici che sentono la performance recuperate PF aggiuntivi soltanto se spendete almeno un dado vita al termine; il dado del canto cresce con i livelli da bardo.'
            if e['name']=='Magical Secrets' and e.get('relations',{}).get('classId')=='phb2014:class:bard':
                apply(e['id'],'effect.spellListScope','any-classes',1,'Magical Secrets')
                e['interpretations'].append({'field':'sources','kind':'source-pagination-conflict',
                   'method':'PH-Errata PDF 1 prints p. 50 for Magical Secrets; the actual feature is PHB PDF 55, printed p. 54. Header and target passage are retained separately.'})
    paladin_casting='phb2014:class-feature:paladin-2-spellcasting'
    if 'effect' in by_id[paladin_casting]['mechanics']:
        apply(paladin_casting,'effect.spellSlotScope','paladin-spells',2,'Preparing and Casting Spells')
        apply('phb2014:class-feature:paladin-2-divine-smite','effect.cost','one-spell-slot',2,'Divine Smite')
        apply('phb2014:class-feature:paladin-2-divine-smite','effect.maximumDiceWithTypeBonus',6,2,'Divine Smite')
        apply('phb2014:class-feature:paladin-11-improved-divine-smite','effect.statedStacksWithDivineSmite',None,2,'Improved Divine Smite',remove=True)
    ranger_casting='phb2014:class-feature:ranger-2-spellcasting'
    if 'effect' in by_id[ranger_casting]['mechanics']:
        apply(ranger_casting,'effect.spellSlotScope','ranger-spells',2,'Spell Slots')
        companion='phb2014:subclass-feature:beast-master-3-ranger-s-companion'
        apply(companion,'effect.hitDiceShortRestExplicit',True,2,'Ranger’s Companion')
        apply(companion,'effect.actionCommand',['Attack','Dash','Disengage','Help'],2,'Ranger’s Companion')
        apply(companion,'effect.uncommandedAction','Dodge',2,'Ranger’s Companion')
        apply(companion,'effect.reactionNeedsCommand',False,2,'Ranger’s Companion')
        apply(companion,'effect.independentWhenIncapacitatedOrAbsent','protect-self-and-ranger',2,'Ranger’s Companion')
        e=by_id[companion];e['originalPrintingSummaryIt']=e['summaryIt']
        e['summaryIt']='Bestia Media o più piccola con GS fino a un quarto, bonus di competenza del personaggio e PF almeno quattro per livello da ranger. L’azione del ranger comanda Attaccare, Scatto, Disimpegno o Aiuto; senza comando la bestia Schiva. Le reazioni sono autonome; se il ranger è assente o incapacitato si protegge da sola. Può spendere dadi vita durante riposo breve.'
        training='phb2014:subclass-feature:beast-master-7-exceptional-training'
        apply(training,'effect.commandActions',['Dash','Disengage','Help'],2,'Exceptional Training')
        apply(training,'effect.attacksMagicalForNonmagicalResistanceOrImmunity',True,2,'Exceptional Training')
        e=by_id[training];e['originalPrintingSummaryIt']=e['summaryIt']
        e['summaryIt']='Nel tuo turno, se la bestia non attacca, comandi Scatto, Disimpegno o Aiuto con azione bonus. I suoi attacchi contano come magici per superare resistenza e immunità ad attacchi e danni non magici.'
        fury='phb2014:subclass-feature:beast-master-11-bestial-fury'
        apply(fury,'effect.mayChoosePrintedMultiattackInstead',True,2,'Bestial Fury')
        e=by_id[fury];e['originalPrintingSummaryIt']=e['summaryIt']
        e['summaryIt']='Comandando Attaccare, la bestia può fare due attacchi oppure usare Multiattacco se presente nel proprio blocco di statistiche.'
    attunement='phb2014:class-option:monk-elemental-attunement'
    if attunement in by_id:
        apply(attunement,'effect.rangeFt',30,1,'Elemental Attunement')
        apply(attunement,'effect.rangePrinting','within-30-feet',1,'Elemental Attunement')
        mountain='phb2014:class-option:monk-eternal-mountain-defense'
        apply(mountain,'minimumMonkLevel',17,1,'Eternal Mountain Defense')
        apply(mountain,'selectionOrigins.0.minimumClassLevel',17,1,'Eternal Mountain Defense')
        whip='phb2014:class-option:monk-water-whip'
        apply(whip,'effect.activation','action',1,'Water Whip')
        e=by_id[whip];e['originalPrintingSummaryIt']=e['summaryIt']
        e['summaryIt']='Con un’azione e due ki una creatura visibile entro trenta piedi tenta TS Destrezza: 3d10 contundenti più 1d10 per ki extra, e scelta fra prono o trascinare fino a venticinque piedi. Successo dimezza senza gli altri effetti; non è un incantesimo.'
        e=by_id['phb2014:class-feature:monk-3-deflect-missiles']
        e['sources'].append(editorial_source(1,'Deflect Missiles'))
        e['interpretations'].append({'field':'effect.returnAttack','kind':'already-in-local-printing','method':'The PHB PDF 79 already prints the same proficiency/monk-weapon final clause as PH-Errata PDF 1. No contradictory earlier text is fabricated.'})
    sanctuary='phb2014:spell:sanctuary'
    if by_id[sanctuary]['verification']['mechanics']=='verified-fields':
        apply(sanctuary,'effect.endsEarlyWhen',['warded-creature-makes-attack','warded-creature-casts-spell-affecting-enemy','warded-creature-deals-damage-to-another-creature'],5,'Sanctuary')
        e=by_id[sanctuary];e['originalPrintingSummaryIt']=e['summaryIt']
        e['summaryIt']='Chi bersaglia il protetto con attacco o magia dannosa deve superare TS Saggezza o scegliere un altro bersaglio, altrimenti perdere l’attacco. Effetti d’area non bloccati. Termina se il protetto attacca, lancia una magia che influenza un nemico o infligge danno a un’altra creatura.'
    wizard_casting='phb2014:class-feature:wizard-1-spellcasting'
    if 'copySpell' in by_id[wizard_casting]['mechanics'].get('effect',{}):
        apply(wizard_casting,'effect.spellSlotScope','wizard-spells',2,'Preparing and Casting Spells')
        apply(wizard_casting,'effect.copySpell.eligibility','spell-level-you-can-prepare',2,'Your Spellbook')
        apply(wizard_casting,'effect.cantripsStoredInSpellbookExplicit',False,2,'Spellbook')
        apply('phb2014:subclass-feature:wizard-conjuration-2-minor-conjuration','effect.endsEarlyWhen',['use-feature-again','object-takes-any-damage','object-deals-any-damage'],2,'Minor Conjuration')
        apply('phb2014:subclass-feature:evocation-10-empowered-evocation','effect.numberOfDamageRolls',1,2,'Empowered Evocation')
        apply('phb2014:subclass-feature:evocation-14-overchannel','effect.minimumSpellLevel',1,2,'Overchannel')
        conj=by_id['phb2014:subclass-feature:wizard-conjuration-2-minor-conjuration']
        conj['originalPrintingSummaryIt']=conj['summaryIt'];conj['summaryIt']+=' Nella vista corretta scompare anche quando infligge danno.'
    polymorph='phb2014:spell:polymorph'
    if by_id[polymorph]['verification']['mechanics']=='verified-fields':
        apply(polymorph,'effect.targetAtZeroHPAllowed',False,5,'Polymorph')
        e=by_id[polymorph];e['originalPrintingSummaryIt']=e['summaryIt'];e['summaryIt']+=' Il bersaglio deve avere più di zero PF nella vista con errata.'
    cleric='phb2014:class-feature:cleric-1-spellcasting'
    if by_id[cleric]['mechanics'].get('effect',{}).get('spellSlotScope')=='your-spells':
        apply(cleric,'effect.spellSlotScope','cleric-spells',1,'Preparing and Casting Spells')
        apply('phb2014:subclass-feature:light-1-bonus-cantrip','effect.countsAgainstKnownCantripLimit',False,1,'Bonus Cantrip')
        apply('phb2014:subclass-feature:nature-1-acolyte-of-nature','effect.countsAsClericCantrip',True,1,'Acolyte of Nature')
        apply('phb2014:subclass-feature:nature-1-acolyte-of-nature','effect.countsAgainstKnownCantripLimit',False,1,'Acolyte of Nature')
        apply('phb2014:subclass-feature:war-17-avatar-of-battle','effect.condition','nonmagical-attacks',1,'Avatar of Battle')
    sorcerer='phb2014:class-feature:sorcerer-1-spellcasting'
    if by_id[sorcerer]['mechanics'].get('effect',{}).get('spellSlotScope')=='your-spells':
        apply(sorcerer,'effect.spellSlotScope','sorcerer-spells',2,'Spell Slots')
        apply('phb2014:class-feature:sorcerer-2-font-of-magic','effect.flexibleCasting.createdSlotsExpire','finish-long-rest',2,'Flexible Casting')
        apply('phb2014:class-option:sorcerer-twinned-spell','effect.incapableOfMultipleCreatureTargetsAtCurrentLevel',True,2,'Twinned Spell')
        apply('phb2014:subclass-feature:draconic-6-elemental-affinity','effect.numberOfDamageRolls',1,2,'Elemental Affinity')
        surge='phb2014:subclass-feature:wild-magic-1-wild-magic-surge'
        apply(surge,'effect.maximumTriggerRollsPerTurn',1,2,'Wild Magic Surge')
        apply(surge,'effect.surgeSpellMetamagicEligible',False,2,'Wild Magic Surge')
        apply(surge,'effect.surgeSpellConcentrationRequired',False,2,'Wild Magic Surge')
        apply(surge,'effect.surgeSpellDuration','full-normal-duration',2,'Wild Magic Surge')
    racial_age_summaries={
        'dwarf':'La cultura nanica considera giovani fino a cinquant’anni; maturazione fisica simile a quella umana e vita media di circa 350 anni.',
        'elf':'Maturazione fisica simile a quella umana, età adulta culturale intorno ai cento anni e vita fino a 750 anni. La relazione fra Trance e durata del riposo lungo resta un’interpretazione aperta.',
        'halfling':'Età adulta intorno ai vent’anni e vita generalmente di circa un secolo e mezzo.',
        'human':'Età adulta alla fine dell’adolescenza; vita generalmente inferiore a un secolo.',
        'dragonborn':'Sviluppo rapido: a tre anni è paragonabile a un umano di dieci, maturità a quindici e vita di circa ottanta anni.',
        'gnome':'Maturazione fisica simile a quella umana, vita adulta attesa intorno ai quarant’anni e durata da 350 a quasi 500 anni.',
        'half-elf':'Maturità intorno ai vent’anni; vita spesso superiore a 180 anni.',
        'half-orc':'Maturità intorno ai quattordici anni; vita raramente superiore a 75 anni.',
        'tiefling':'Maturazione simile a quella umana e vita di qualche anno più lunga.',
    }
    for index,summary in racial_age_summaries.items():
        e=by_id['phb2014:race:'+index]
        if 'alignmentDescription' in e['mechanics']:
            e['originalPrintingSummaryIt']=e['summaryIt']
            apply(e['id'],'alignmentDescription',None,1,e['name']+' Traits',remove=True)
            e['summaryIt']=summary+' L’indicazione di allineamento della prima stampa è rimossa dall’erratum 2021; l’età non impone limiti alla creazione.'
    dwarf=by_id['phb2014:race:dwarf']
    if 'sourceWeaponNames' in dwarf['mechanics']['traits'][1]['mechanics']:
        apply(dwarf['id'],'traits.1.mechanics.sourceWeaponNames',['battleaxe','handaxe','light hammer','warhammer'],1,'Dwarven Combat Training')
    drow=by_id['phb2014:subrace:dark-elf']
    if 'appearanceAndCulturePrinting' in drow['mechanics']:
        drow['originalPrintingSummaryIt']=drow['summaryIt']
        apply(drow['id'],'appearanceAndCulturePrinting','reviewed-2021-Underdark-description',1,'Dark Elf (Drow)')
        apply(drow['id'],'requiresDMApprovalInWorld',None,1,'Dark Elf (Drow)',remove=True)
        drow['summaryIt']='Gli elfi drow sono legati alla magia dell’Underdark e alle ombre, con capelli chiari e carnagioni grigie. L’erratum descrive l’influenza di Lolth su alcune città e gli eroi che la contrastano. Carisma +1, scurovisione di 120 piedi, sensibilità al sole, armi e magie basate su Carisma.'
    if by_id['phb2014:spell:find-familiar']['verification']['mechanics']=='verified-fields':
        apply('phb2014:spell:find-familiar', 'effect.carriedItemsLeftBehindWhen', ['zero-hit-points','dismissed-to-pocket-dimension'], 4, 'Find Familiar')
    if by_id['phb2014:spell:call-lightning']['verification']['mechanics']=='verified-fields':
        apply('phb2014:spell:call-lightning','effect.cloud.center','visible-point-within-range',4,'Call Lightning')
        apply('phb2014:spell:call-lightning','effect.strikePoint','visible-point-under-cloud',4,'Call Lightning')
    if by_id['phb2014:spell:color-spray']['verification']['mechanics']=='verified-fields':
        apply('phb2014:spell:color-spray','effect.blindnessExpires','end-of-caster-next-turn',4,'Color Spray')
    if by_id['phb2014:spell:clone']['verification']['mechanics']=='verified-fields':
        apply('phb2014:spell:clone','effect.vessel.capacity','creature-being-cloned',4,'Clone')
        apply('phb2014:spell:clone','effect.cloneFormsIn','vessel-used-in-casting',4,'Clone')
        apply('phb2014:spell:clone','materialIt','Diamante da almeno mille mo e un pollice cubo di carne consumati, più recipiente sigillabile da almeno duemila mo capace di contenere la creatura clonata',4,'Clone')
    if by_id['phb2014:spell:contagion']['verification']['mechanics']=='verified-fields':
        apply('phb2014:spell:contagion','effect.onHit','poisoned-before-disease-applies',4,'Contagion')
        apply('phb2014:spell:contagion','effect.threeSuccesses','no-longer-poisoned-and-spell-ends',4,'Contagion')
        apply('phb2014:spell:contagion','effect.threeFailures','no-longer-poisoned-then-choose-disease-for-full-duration',4,'Contagion')
    if by_id['phb2014:spell:disintegrate']['verification']['mechanics']=='verified-fields':
        apply('phb2014:spell:disintegrate','effect.creature.disintegratedIf','this-damage-leaves-target-with-zero-hit-points',4,'Disintegrate')
    if by_id['phb2014:spell:glyph-of-warding']['verification']['mechanics']=='verified-fields':
        apply('phb2014:spell:glyph-of-warding','effect.purposeInLocalPrinting','magical-effect-need-not-be-harmful',5,'Glyph of Warding')
        apply('phb2014:spell:glyph-of-warding','effect.diameterAppliesTo','surface-and-object',5,'Glyph of Warding')
        apply('phb2014:spell:glyph-of-warding','effect.movementRestriction.subjects',['surface','object'],5,'Glyph of Warding')
    if by_id['phb2014:spell:heroes-feast']['verification']['mechanics']=='verified-fields':
        apply('phb2014:spell:heroes-feast','effect.maximumOtherParticipantsInLocalPrinting',None,5,"Heroes' Feast",remove=True)
        apply('phb2014:spell:heroes-feast','effect.maximumParticipantsIncludingCaster',12,5,"Heroes' Feast")
    if by_id['phb2014:spell:levitate']['verification']['mechanics']=='verified-fields':
        apply('phb2014:spell:levitate','effect.target','one-visible-creature-or-loose-object',5,'Levitate')
    if by_id['phb2014:spell:moonbeam']['verification']['mechanics']=='verified-fields':
        apply('phb2014:spell:moonbeam','effect.move.distanceMode','up-to',5,'Moonbeam')
    if by_id['phb2014:spell:mordenkainen-s-magnificent-mansion']['verification']['mechanics']=='verified-fields':
        apply('phb2014:spell:mordenkainen-s-magnificent-mansion','effect.spellEndExpelledInLocalPrinting','creatures-and-objects-to-open-spaces-nearest-entrance',5,"Mordenkainen's Magnificent Mansion")
    if by_id['phb2014:spell:phantasmal-killer']['verification']['mechanics']=='verified-fields':
        apply('phb2014:spell:phantasmal-killer','effect.subsequentSaveTiming','end-of-each-target-turn',5,'Phantasmal Killer')
    if by_id['phb2014:spell:prismatic-wall']['verification']['mechanics']=='verified-fields':
        apply('phb2014:spell:prismatic-wall','effect.rodOfCancellationDestroysInLocalPrinting',None,5,'Prismatic Wall',remove=True)
        apply('phb2014:spell:prismatic-wall','effect.dispelMagicLayerScopeInLocalPrinting','violet-only',5,'Prismatic Wall')
    if by_id['phb2014:spell:simulacrum']['verification']['mechanics']=='verified-fields':
        apply('phb2014:spell:simulacrum','effect.typeInLocalPrinting','construct',5,'Simulacrum')
    if by_id['phb2014:spell:sleet-storm']['verification']['mechanics']=='verified-fields':
        apply('phb2014:spell:sleet-storm','effect.concentrationSave.timingInLocalPrinting','start-target-turn-in-area-while-concentrating',5,'Sleet Storm')
    if by_id['phb2014:spell:true-polymorph']['verification']['mechanics']=='verified-fields':
        apply('phb2014:spell:true-polymorph','effect.cannotAffectZeroHP',True,5,'True Polymorph')
        apply('phb2014:spell:true-polymorph','effect.creatureToObject.objectMagicalRestrictionInLocalPrinting','nonmagical-only',5,'True Polymorph')
        apply('phb2014:spell:true-polymorph','effect.creatureToObject.objectMaximumSizeInLocalPrinting','original-creature-size',5,'True Polymorph')
    if by_id['phb2014:spell:true-resurrection']['verification']['mechanics']=='verified-fields':
        apply('phb2014:spell:true-resurrection','effect.undeadRestoredFormInLocalPrinting','restored-to-non-undead-form',5,'True Resurrection')
    if by_id['phb2014:spell:unseen-servant']['verification']['mechanics']=='verified-fields':
        apply('phb2014:spell:unseen-servant','effect.sizeInLocalPrinting','Medium',5,'Unseen Servant')
    if by_id['phb2014:spell:weird']['verification']['mechanics']=='verified-fields':
        apply('phb2014:spell:weird','effect.subsequentSaveTiming','end-of-each-target-turn',5,'Weird')
    if by_id['phb2014:spell:storm-of-vengeance']['verification']['mechanics']=='verified-fields':
        apply('phb2014:spell:storm-of-vengeance','effect.roundEffectsRelationship','different-effects',5,'Storm of Vengeance')
    for index, bonus in [('black-bear',4),('brown-bear',6)]:
        eid='mm2014:creature:'+index
        if eid in by_id:
            for i,action in enumerate(by_id[eid]['mechanics']['actions']):
                if action['kind']=='melee-weapon-attack':
                    original_bonus=action['attackBonus']
                    apply(eid,f'actions.{i}.attackBonus',bonus,1,index.replace('-',' ').title(),book='mm-errata')
                    action['summaryIt']=action['summaryIt'].replace(f'{original_bonus:+}',f'{bonus:+}',1)
    water='mm2014:creature:water-elemental'
    mono='mm2014:creature:monodrone'
    if mono in by_id:
        apply(mono,'actions.1.attackBonus',2,2,'Monodrone',book='mm-errata')
        apply(mono,'actions.1.damage.average',3,2,'Monodrone',book='mm-errata')
        apply(mono,'actions.1.damage.dice','1d6',2,'Monodrone',book='mm-errata')
        by_id[mono]['mechanics']['actions'][1]['summaryIt']='Attacco in mischia o a distanza +2, portata cinque piedi o gittata 30/120; un bersaglio, 3 (1d6) perforanti, secondo le errata.'
    if water in by_id:
        apply(water,'actions.2.effect.releaseOther.rollKind','ability-check',2,'Water Elemental',book='mm-errata')
        e=by_id[water];e['verification'].update(complete=True,missingFields=[])
        e['mechanics']['actions'][2]['summaryIt']=e['mechanics']['actions'][2]['summaryIt'].replace('di tipo non specificato nella prima stampa','come prova di caratteristica secondo l’erratum')
        elemental='phb2014:subclass-feature:moon-10-elemental-wild-shape'
        if elemental in by_id:
            e=by_id[elemental]
            missing=[f for f in e['verification']['missingFields'] if f!='formStatistics:water-elemental-releaseOther-rollKind']
            e['verification'].update(complete=not missing,missingFields=missing)
            parent=by_id['phb2014:subclass:moon']
            missing=[f for f in parent['verification']['missingFields'] if f!='featureEffects:'+elemental or not e['verification']['complete']]
            parent['verification'].update(complete=not missing,missingFields=missing)
    monk='phb2014:class-feature:monk-3-deflect-missiles'
    if monk in by_id:
        result['sources']['srd51-en']=load_supporting_srd()
        e=by_id[monk];effect=e['mechanics']['effect']['returnAttack'];prior=copy.deepcopy(effect['explicitRangeFt'])
        value={'normal':20,'long':60};effect['explicitRangeFt']=value
        src={'edition':'2014','book':'srd51-en','filename':'SRD-OGL_V5.1.pdf','pdfPages':[27],'printedPages':[27],
            'section':'Monk: Deflect Missiles','url':SRD51_URL,'verification':'read-local-text','role':'later-official-printing-not-editorial-erratum'}
        e['sources'].append(src);e['fieldSources']['effect'].append(len(e['sources'])-1)
        missing=[f for f in e['verification']['missingFields'] if f!='returnAttackRangeInterpretation']
        e['verification'].update(complete=not missing,missingFields=missing)
        e.setdefault('originalPrintingSummaryIt',e['summaryIt'])
        e['summaryIt']+=' SRD ufficiale inglese 5.1 PDF 27: contrattacco a gittata normale venti piedi e lunga sessanta, distinto dall’omissione della prima stampa e dalle errata PHB.'
        for note in e['interpretations']:
            if note['field']=='effect.returnAttack.explicitRangeFt':note['view']='original-printing'
        e['interpretations'].append({'field':'effect.returnAttack.explicitRangeFt','kind':'verified-later-official-2014-printing','method':'Explicit English SRD 5.1 PDF 27; verified Italian SRD PDF 36 corroborates. No substitution in original-reference.json.'})
        result['supportingPrintingLog']=[{'entityId':monk,'field':'effect.returnAttack.explicitRangeFt','originalValue':prior,'confirmedValue':value,'sources':[src],'verification':'verified-later-official-2014-printing-not-erratum'}]
        result['rulesVersion']+='-with-reviewed-srd51-printing'
    result['editorialChangeLog'] = changes
    if 'phb2014:race:elf' in by_id:
        result['sources']['sac-rulings']=load_rulings()
        e=by_id['phb2014:race:elf'];trance=next(t for t in e['mechanics']['traits'] if t['index']=='trance')['mechanics']
        prior=copy.deepcopy(trance['longRestDurationInterpretation'])
        trance['longRestDurationInterpretation']={'hours':4,'requires':'meditate-during-long-rest','otherLongRestRules':'unchanged','authority':'official-ruling-adjudicated-by-DM'}
        src={'edition':'2014','book':'sac-rulings','filename':'SA-Compendium.pdf','pdfPages':[2],'printedPages':[2],
             'section':'Racial Traits: Trance and long rest','url':RULING_URL,'verification':'read-local-text','role':'official-ruling-not-editorial-erratum'}
        e['sources'].append(src);e['fieldSources']['traits'].append(len(e['sources'])-1)
        missing=[f for f in e['verification']['missingFields'] if f!='traits.trance.longRestDurationInterpretation']
        e['verification'].update(complete=not missing,missingFields=missing)
        e['summaryIt']+=' Il chiarimento ufficiale SAC 2.7 consente quattro ore di meditazione per completare il riposo lungo, mantenendo le altre regole del riposo; è distinto dalla stampa del PHB.'
        e['interpretations'].append({'field':'traits.trance.longRestDurationInterpretation','kind':'verified-official-ruling','method':'Sage Advice Compendium 2.7 PDF 2; primary passage read. Original local printing retained in original-reference.json; DM adjudicates official rulings.'})
        result['officialRulingLog']=[{'entityId':e['id'],'field':'traits.trance.longRestDurationInterpretation','originalValue':prior,'rulingValue':trance['longRestDurationInterpretation'],'sources':[src],'verification':'verified-official-ruling-not-erratum'}]
    lucky='phb2014:feat:lucky'
    if lucky in by_id:
        if 'sac-rulings' not in result['sources']:result['sources']['sac-rulings']=load_rulings()
        e=by_id[lucky];prior=copy.deepcopy(e['mechanics'].get('advantageInteraction'))
        e['mechanics']['advantageInteraction']={'ownRollSelection':'choose-any-d20-in-mix-including-extra','advantageDisadvantageStillPresent':True,'disadvantageStillPreventsSneakAttack':True,'alternativeDMRuling':'eliminate-one-die-then-apply-normal-advantage-disadvantage-to-remaining-two','alternativeDMRulingAutomatic':False}
        src={'edition':'2014','book':'sac-rulings','filename':'SA-Compendium.pdf','pdfPages':[9],'printedPages':[9],'section':'Feats: Lucky and advantage/disadvantage','url':RULING_URL,'verification':'read-local-text','role':'official-ruling-not-editorial-erratum'}
        e['sources'].append(src);e['fieldSources']['advantageInteraction']=[len(e['sources'])-1]
        missing=[f for f in e['verification']['missingFields'] if f!='advantageInteraction'];e['verification'].update(complete=not missing,missingFields=missing)
        e['summaryIt']+=' Il SAC consente di scegliere fra tutti i d20, incluso quello aggiuntivo, conservando però vantaggio o svantaggio: svantaggio continua a impedire Attacco Furtivo. L’alternativa proposta al DM resta una decisione separata.'
        e['interpretations'].append({'field':'advantageInteraction','kind':'verified-official-ruling','method':'Sage Advice Compendium 2.7 PDF 9, distinct from the original PHB PDF 168 and from its optional alternative DM ruling.'})
        result.setdefault('officialRulingLog',[]).append({'entityId':lucky,'field':'advantageInteraction','originalValue':prior,'rulingValue':copy.deepcopy(e['mechanics']['advantageInteraction']),'sources':[src],'verification':'verified-official-ruling-not-erratum'})
    for index in ['conjure-animals','conjure-celestial','conjure-minor-elementals','conjure-woodland-beings']:
        e=by_id['phb2014:spell:'+index]
        if e['verification']['mechanics']!='verified-fields':continue
        prior=copy.deepcopy(e['mechanics']['effect'].get('summonedCreatureSelection'))
        ruling={'casterChooses':'listed-broad-option-if-any','specificCreaturesChosenBy':'DM-within-chosen-option','casterPreference':'may-request-not-binding'}
        if index=='conjure-animals':ruling.update(swarmsAllowed=False,damageMagical='only-if-stat-block-or-spell-says-so')
        e['mechanics']['effect']['summonedCreatureSelection']=ruling
        src={'edition':'2014','book':'sac-rulings','filename':'SA-Compendium.pdf','pdfPages':[17],'printedPages':[17],'section':'Specific Spells: conjured creatures and selection','url':RULING_URL,'verification':'read-local-text','role':'official-ruling-not-editorial-erratum'}
        e['sources'].append(src);e['fieldSources']['effect'].append(len(e['sources'])-1)
        e['summaryIt']+=' Il SAC assegna al DM la scelta delle creature concrete entro l’opzione scelta dall’incantatore; le preferenze del giocatore non sono vincolanti.'
        e['interpretations'].append({'field':'effect.summonedCreatureSelection','kind':'verified-official-ruling','method':'Sage Advice Compendium 2.7 PDF 17; explicit named spells, not an automatic extension to every summoning spell.'})
        result.setdefault('officialRulingLog',[]).append({'entityId':e['id'],'field':'effect.summonedCreatureSelection','originalValue':prior,'rulingValue':copy.deepcopy(ruling),'sources':[src],'verification':'verified-official-ruling-not-erratum'})
    progression_status(result['entities'])
    return result


def application_queue(inventory, reference):
    """An encoded field does not mean the whole errata section was implemented."""
    changes=reference.get('editorialChangeLog',[])+reference.get('editorialConfirmationLog',[])
    normalize=lambda name: re.sub(r'[^a-z0-9]','',re.sub(r'^\[New\]\s*','',name,flags=re.I).lower())
    result=copy.deepcopy(inventory)
    for row in result:
        applied=[c for c in changes if any(s['book']==row['book'] and s['pdfPages']==[row['pdfPage']]
                                         and normalize(s['section'])==normalize(row['section']) for s in c['sources'])]
        row['encodedFields']=[{'entityId':c['entityId'],'field':c['field']} for c in applied]
        row['sectionComplete']=False
        if applied: row['status']='reviewed-fields-encoded; remainder-requires-review'
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--download', action='store_true')
    args = parser.parse_args()
    manifest, inventory = load_errata(args.download)
    write_json(WORK/'ruling-manifest.json',load_rulings(args.download))
    write_json(WORK/'supporting-printing-manifest.json',load_supporting_srd(args.download))
    write_json(WORK / 'errata-manifest.json', manifest)
    write_json(WORK / 'errata-review-queue.json', inventory)
    print('Verified official copies:', len(manifest), '; headings requiring individual application review:', len(inventory))


if __name__ == '__main__':
    main()
