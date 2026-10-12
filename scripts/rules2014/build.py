"""Build an isolated, auditable 2014 reference without changing public/data."""
from __future__ import annotations
import argparse
from collections import Counter
import json
import hashlib
from pathlib import Path
import sqlite3
from contextlib import closing

from pdf_sources import ROOT, WORK, extract, load_pages, write_json
import curated
import core_rules
import combat
import gear
from hazard_reviews import hazards
from class_details import apply_equipment, class_features, dmg_options, supplemental_rules, apply_dmg_class_reviews
from feature_reviews import apply_feature_reviews
from spell_extract import extract_spells
from spell_reviews import apply_reviews
from spell_lists import extract_lists
from compare import compare
from validate import validate
from relations import link_entities
from warlock_reviews import apply_warlock_reviews
from spell_list_reviews import apply_spell_list_reviews
from fighter_reviews import apply_fighter_reviews
from rogue_reviews import apply_rogue_reviews
from barbarian_reviews import apply_barbarian_reviews
from creature_reviews import apply_creature_reviews, FAMILIAR_FORMS, CHAIN_FORMS, ROWS as BEAST_ROWS
from druid_reviews import apply_druid_reviews
from race_reviews import apply_race_reviews
from background_reviews import apply_background_reviews
from bard_reviews import apply_bard_reviews
from paladin_reviews import apply_paladin_reviews
from ranger_reviews import apply_ranger_reviews
from monk_reviews import apply_monk_reviews
from wizard_reviews import apply_wizard_reviews
from cleric_reviews import apply_cleric_reviews
from sorcerer_reviews import apply_sorcerer_reviews
from magic_item_reviews import magic_items, magic_item_rules, supernatural_rewards
from treasure_reviews import treasure_rules
from appendix_reviews import appendices
from adjudication_reviews import adjudication_rules
from planar_reviews import planar_rules


def load_reviews(manifest):
    from errata import load_errata
    editorial, _ = load_errata()
    reviews=json.loads(Path(__file__).with_name('source_reviews.json').read_text(encoding='utf-8'))
    for book,entry in manifest.items():
        if book in editorial:
            continue
        review=reviews[book]
        entry['review']={**review,'status':'verified-local-copy' if entry.get('sha256')==review['sha256'] else 'source-changed-requires-review'}
        if entry['review']['status']!='verified-local-copy' and book!='srd521-it':
            raise ValueError('Missing, unreadable or changed source: '+entry['filename']+'. Review edition and page references before rebuilding.')
    # Pinned local PDFs are verified even when an original-view record cites an
    # erratum as a distinct comparison, without applying it to original values.
    manifest.update(editorial)
    return manifest


def build_entities(pages):
    classes=curated.classes();apply_equipment(classes)
    features=apply_feature_reviews(class_features(classes))
    levels=core_rules.progressions()
    for level in levels:
        level['relations']['featureIds']=[f['id'] for f in features if f['relations']['classId']==level['relations']['classId'] and f['mechanics']['level']==level['mechanics']['level']]
        level['verification']['missingFields'].remove('featureLinks')
        # Events are linked, but subclass tables and all effect semantics are not.
        level['verification']['missingFields'].append('subclassProgressionAndFeatureEffects')
    entities=[*classes,*curated.subclasses(),*curated.races(),*curated.subraces(),*curated.race_variants(),
              *curated.backgrounds(),*curated.background_variants(),*curated.weapons(),*curated.armor(),*curated.tools(),
              *curated.feats(),*core_rules.skills(),*core_rules.conditions(),*core_rules.rules(),*levels,*features,
              *core_rules.advancement(),*combat.actions(),*combat.properties(),*combat.additional_rules(),
              *gear.gear(),*gear.packs(),*dmg_options(),*supplemental_rules(),*combat.optional_combat_rules(),*hazards()]
    for e in entities:
        # Nulls that reflect ambiguity cannot be advertised as a complete rule.
        if e['index']=='long-rest':
            e['verification'].update(complete=False,missingFields=['hitDiceRecovery.minimum-in-this-printing'])
    inventory=json.loads(Path(__file__).with_name('spell_names.json').read_text(encoding='utf-8'))
    spells=extract_spells(pages,inventory['names'],{'FINO STEEO':'Find Steed'})
    if len(spells)!=361 or len({s['id'] for s in spells})!=361:
        raise ValueError('Spell inventory changed: review extraction and headings; do not silently declare coverage.')
    for spell in spells:
        # Each expected spelling was reconciled against the PHB heading inventory,
        # but the mechanical headers remain candidates until individually reviewed.
        spell['verification']['identity']='heading-inventory-matched'
    apply_reviews(spells)
    apply_spell_list_reviews(spells)
    entities.extend(spells)
    apply_warlock_reviews(entities)
    apply_fighter_reviews(entities)
    apply_rogue_reviews(entities)
    apply_barbarian_reviews(entities)
    apply_creature_reviews(entities)
    apply_druid_reviews(entities)
    apply_race_reviews(entities)
    apply_background_reviews(entities)
    apply_bard_reviews(entities)
    apply_paladin_reviews(entities)
    apply_ranger_reviews(entities)
    apply_monk_reviews(entities)
    apply_wizard_reviews(entities)
    apply_cleric_reviews(entities)
    apply_sorcerer_reviews(entities)
    apply_dmg_class_reviews(entities)
    entities.extend(gear.market())
    entities.extend(magic_item_rules())
    entities.extend(supernatural_rewards())
    entities.extend(treasure_rules())
    entities.extend(appendices())
    entities.extend(planar_rules())
    entities.extend(adjudication_rules())
    entities.extend(magic_items())
    entities.append(gear.trinkets())
    return link_entities(entities)


def coverage(database):
    entities=database['entities']
    reviewed_spells=sum(e['kind']=='spell' and e['verification']['mechanics']=='verified-fields' for e in entities)
    pending_spells=sum(e['kind']=='spell' and e['verification']['mechanics']!='verified-fields' for e in entities)
    list_review=json.loads(Path(__file__).with_name('spell_list_reviews.json').read_text(encoding='utf-8'))
    corrected='editorialChangeLog' in database
    audit=json.loads(Path(__file__).with_name('inventory_audit.json').read_text(encoding='utf-8'))
    audited={c['kind']:c for c in audit['categories']}
    expected={k:c['expectedIdentities'] for k,c in audited.items()}
    categories=[]
    for kind in sorted({e['kind'] for e in entities}):
        entries=[e for e in entities if e['kind']==kind and (e['sources'][0]['book']=='phb' or kind in ['creature','magic-item'])]
        count=len(entries)
        identity_hash=hashlib.sha256('\n'.join(sorted(e['id'] for e in entries)).encode()).hexdigest()
        inventory_checked=kind in audited and count==expected[kind] and identity_hash==audited[kind]['identitySHA256']
        records_checked=all(e['verification']['complete'] and e['verification']['mechanics']=='verified-fields'
                            and e.get('nameIt') and e.get('summaryIt') for e in entries)
        categories.append({'kind':kind,'expectedIdentities':expected.get(kind),'extractedIdentities':count,
          'scope':'PHB inventory' if kind not in ['creature','magic-item','rule'] else 'selected manual records; see reviewed scopes',
          'verifiedMechanicalRecords':sum(e['verification']['mechanics']=='verified-fields' for e in entries),
          'completeRecords':sum(e['verification']['complete'] for e in entries),
          'inventoryAudited':inventory_checked,'categoryComplete':bool(inventory_checked and records_checked),
          'inventoryAudit':audited.get(kind),
          'missingFields':dict(sorted(Counter(f for e in entries for f in e['verification']['missingFields']).items())),
          'status':'verified-scoped-category' if inventory_checked and records_checked else 'reviewed-with-open-records' if inventory_checked else 'see-reviewed-scopes',
          'expectedIds':[e['id'] for e in entries]})
    return {'edition':'2014','overallComplete':False,'categories':categories,
      'inventoryAuditDate':audit['auditDate'],'inventoryAuditChecks':audit['checks'],
      'recordCounts':{'total':len(entities),'complete':sum(e['verification']['complete'] for e in entities),
                      'open':sum(not e['verification']['complete'] for e in entities)},
      'additionalExtracted':{'DMG-subclasses':sum(e['kind']=='subclass' and e['sources'][0]['book']=='dmg' for e in entities),
                            'DMG-rules':sum(e['kind']=='rule' and e['sources'][0]['book']=='dmg' for e in entities),
                            'MM-rules':sum(e['kind']=='rule' and e['sources'][0]['book']=='mm' for e in entities),
                            'DMG-magic-items':sum(e['kind']=='magic-item' and e['sources'][0]['book']=='dmg' for e in entities),
                            'MM-creatures':sum(e['kind']=='creature' and e['sources'][0]['book']=='mm' for e in entities)},
      'individuallyReviewedSpells':reviewed_spells,
      'reviewedWarlockOptions':{'invocations':32,'pactBoons':3,'patronFeatures':12,'patronExpandedSpellChoices':30},
      'reviewedFighterOptions':{'fightingStyles':6,'maneuvers':16,'subclassFeatures':17,
          'eldritchKnightProgressionLevels':18,'fourthLevelSlotsReviewedOnRender':True,
          'originalPrintingFeintingExpiryUnspecified':not corrected,'martialAdeptSelectionSeparateFromBattleMaster':True},
      'reviewedRogueFeatures':{'subclassFeatures':15,'archetypes':3,'arcaneTricksterProgressionLevels':18,
          'fourthLevelSlotsReviewedOnRender':True,'mageHandDescriptionReviewed':True},
      'reviewedBarbarianFeatures':{'subclassFeatures':9,'totemChoices':9,'ritualGrants':3,'paths':2},
      'reviewedDruidFeatures':{'subclassFeatures':sum(e['kind']=='subclass-feature' and e['relations']['classId']=='phb2014:class:druid' for e in entities),
         'landTerrains':8,'circleSpellGrantLinks':64,'spellEffectsVerifiedByGrantTable':False,
         'moonElementalStatisticsOriginalPrintingHasOpenReleaseRoll':not corrected},
      'reviewedRaceScope':{'baseRaceAgePassages':9,'subracePassages':9,'dragonbornAncestryChoices':10,
         'rockGnomeDeviceChoices':3,'alignmentSuggestionsBindCharacters':False,
         'alignmentPassagesRemovedInReviewed2021Errata':corrected,'elfTranceLongRestInterpretationResolved':any(e.get('entityId')=='phb2014:race:elf' for e in database.get('officialRulingLog',[]))},
      'reviewedBackgroundScope':{'backgrounds':13,'variants':5,'personalitySuggestions':338,'specialtySuggestions':88,
         'tablesCheckedOnRender':True,'alignmentLabelsEnforced':False,'baseNobleAndSailorAlternativeFeatures':True},
      'reviewedBardScope':{'colleges':2,'subclassFeatures':8,'classProgressionLevelsCheckedOnRender':20,
         'magicalSecretsUseBardTableNotMulticlassSlots':True,'loreAdditionalSecretsCountAgainstKnownLimit':False,
         'songOfRestRequiresSpentHitDiceInErrata':corrected},
      'reviewedPaladinScope':{'oaths':3,'subclassFeatures':18,'oathSpellGrantLinks':30,'oathListsAndProgressionCheckedOnRender':True,
         'smiteMayUseOtherClassesSlotsInErrata':corrected,'spellEffectsVerifiedByGrantTables':False},
      'reviewedRangerScope':{'archetypes':2,'subclassFeatures':8,'hunterChoices':11,'progressionLevelsCheckedOnRender':20,
         'companionPrintingSeparateFromErrata':True,'companionDefaultsToDodgeInErrata':corrected,
         'companionBestiaryComplete':True,'companionBestiaryScope':'89 individual MM beasts; seen-form and class restrictions remain character-dependent'},
      'reviewedMonkScope':{'traditions':3,'subclassFeatures':12,'elementalDisciplines':17,'progressionAndKiTableCheckedOnRender':True,
         'waterWhipUsesActionInErrata':corrected,'eternalMountainDefenseMinimumMonkLevel':17 if corrected else 11,
         'deflectMissilesReturnRangeResolved':any(e.get('entityId')=='phb2014:class-feature:monk-3-deflect-missiles' for e in database.get('supportingPrintingLog',[])),'kiSpellCapAppliesToNonspellDisciplines':False},
      'reviewedWizardScope':{'schools':8,'subclassFeatures':40,'perceptionAndStoneChoices':12,'progressionCheckedOnRender':True,
         'transmutationComplete':False,'restoreLifeCastingTimeResolved':False,'copyingAndSpellcastingErrataSeparate':True},
      'reviewedClericScope':{'domains':7,'subclassFeatures':47,'domainSpellGrantLinks':70,'progressionCheckedOnRender':True,
         'domainListsCertifySpellDescriptions':False,'channelDivinityUsesOwnClassLevels':True,'domainCantripAndAvatarErrataSeparate':True},
      'reviewedSorcererScope':{'origins':2,'subclassFeatures':10,'metamagicOptions':8,'dragonAncestorChoices':10,
         'surgeTableRowsCheckedOnRender':50,'surgeDependenciesComplete':False,'progressionAndFlexibleCastingCheckedOnRender':True,
         'createdSlotExpiryAndSurgeErrataSeparate':True},
      'reviewedEquipmentScope':{'baseAdventuringGearRows':len(gear.ROWS.splitlines()),'mountRows':8,'tackRows':13,'waterVehicleRows':6,'tradeGoodRows':23,'serviceRows':7,'lifestyleRows':7,'packs':7,'trinketRows':100,'weightNotStatedKeptNull':True,'marketPricesDoNotCertifyCreatureStatistics':True},
      'reviewedSupernaturalRewardScope':{'readPdfPages':[228,233],'blessings':7,'charms':7,'epicBoons2014':26,'requiresDMGrant':True,'boonMinimumTotalLevel':20,'isAttunableObject':False},
      'reviewedTreasureScope':{'readPdfPages':[134,140,145,150],'individualTables':4,'hoardTables':4,'gemTables':6,'artTables':5,'magicItemTables':9,'inventoryRowsVerified':True,'itemDependenciesCertifiedSeparately':True,'DMChoiceNotAutomaticGrant':True},
      'reviewedMagicItemScope':{'readPdfPages':[151,228],'additionalPropertyTablePdfPages':[143,144],'ordinaryFamilies':264,'namedSentientItems':4,'artifactRecords':8,'vecnaUsesTwoIndependentAttunements':True,'individualRecords':sum(e['kind']=='magic-item' for e in entities),'completeRecords':sum(e['kind']=='magic-item' and e['verification']['complete'] for e in entities),'inventoryComplete':True,'inventoryScope':'DMG PDF 151–228: 264 ordinary families, four named sentient items, eight artifact records','pendingDependencyIds':[e['id'] for e in entities if e['kind']=='magic-item' and not e['verification']['complete']]},
      'reviewedDMGClassScope':{'optionalSubclasses':2,'subclassFeatures':13,'spellGrantLinks':20,'tablesCheckedOnRender':True,'requiresDMApproval':True,'oathbreakerRequiresEvil':True,'auraOfHateAlsoBenefitsEnemyFiendsAndUndead':True,'spellDescriptionsCertifiedByTables':False},
      'reviewedDMGHazardScope':{'readPdfPages':[258,261],'poisons':sum(e['mechanics'].get('ruleType')=='poison' for e in entities),'diseases':sum(e['mechanics'].get('ruleType')=='disease' for e in entities),'madnessD100Tables':3,'madnessOpenInterpretation':'long-table-antipathy-repeated-save-scope','localPoisonDeliveryAlreadyMatchesErrata':True,'inventoryComplete':True},
      'reviewedDMGOptionalCombatScope':{'readPdfPages':[265,274],'records':len(combat.optional_combat_rules()),'firearms':10,'requiresDMApproval':True,'replacesPHBDefaultsAutomatically':False,'inventoryComplete':True},
      'reviewedCreatureScope':{'completeStatBlocks':sum(e['kind']=='creature' and e['verification']['complete'] for e in entities),
         'normalFamiliarForms':sum(e['id']=='mm2014:creature:'+i for i in FAMILIAR_FORMS for e in entities),
         'normalFamiliarFormInventoryComplete':all(any(e['id']=='mm2014:creature:'+i and e['verification']['complete'] for e in entities) for i in FAMILIAR_FORMS),
         'pactOfTheChainSpecialFormsComplete':all(any(e['id']=='mm2014:creature:'+i and e['verification']['complete'] for e in entities) for i in CHAIN_FORMS),'wildShapeBestiaryComplete':True,'wildShapeBestiaryScope':'89 individual MM beasts, excluding swarms; encounter/seen-form prerequisites are not automatically granted','individualBeastStatBlocks':len(BEAST_ROWS),'individualBeastIds':['mm2014:creature:'+r[0] for r in BEAST_ROWS],'individualBeastInventoryScope':'MM dinosaurs PDF 80–81, Stirge PDF 285 and individual beasts appendix A PDF 318–342; swarms and optional variants separate',
         'demonFormsRead':12,'demonTypeTableReadPdfPage':53,'devilFormsRead':10,'devilHierarchyReadPdfPage':68,'yochlolMistRevertInterpretationPending':True,'remainingSlaadForms':5,'remainingSlaadReadPdfPages':[275,277,278],'slaadControlGemAutomatic':False,'additionalFlaskAngels':3,'additionalFlaskAngelReadPdfPages':[16,19],'additionalOtherFlaskForms':4,'additionalOtherFlaskReadPdfPages':[161,162,286,305],'additionalFlaskFiendForms':5,'additionalFlaskFiendReadPdfPages':[37,312,315],'remainingGenieForms':2,'remainingGenieReadPdfPages':[144,147],'arcanalothMagicMissileDependencyPending':True,'additionalHigherElementalForms':5,'additionalHigherElementalReadPdfPages':[140,193,266,267,300],'additionalWoodlandFeyForms':6,'relatedNightHagIsFiend':True,'faerieDragonAgeColorForms':7,'faerieDragonType':'dragon','hagCovenSlotsShared':True,'hagCovenRecoveryAuthorityPending':True,'additionalCelestialForms':2,'additionalCelestialReadPdfPages':[44,251],'additionalMinorElementalForms':3,'additionalMinorElementalReadPdfPages':[23,141,213],'additionalMephitForms':6,'additionalMephitReadPdfPages':[216,218],'summoningVariantRequiresDMApproval':True,
         'moonElementalForms':sum(e['id']=='mm2014:creature:'+kind+'-elemental' for kind in ['air','earth','fire','water'] for e in entities),
         'swarmStatBlocks':sum(e['kind']=='creature' and e['mechanics'].get('isSwarm',False) for e in entities),'swarmSelectionAutomatic':False,'firstPrintingStatBlocksDistinctFromErrata':True},
      'spellDescriptionsPending':pending_spells,
      'spellInterpretationsPending':[{'id':e['id'],'missingFields':e['verification']['missingFields']} for e in entities if e['kind']=='spell' and e['verification']['mechanics']=='verified-fields' and not e['verification']['complete']],
      'reviewedSpellLists':{'verification':'read-local-render','originalPrintingLinks':len(list_review['entries']),
                           'effectiveLinks':len(list_review['entries'])+1 if corrected else None,
                           'printingAnomalies':list_review['printingCandidates'],'spellEffectsVerifiedByListReview':False},
      'reviewedAdditionalScopes':{
        'phbAppendices':{'pdfPages':[294,312],'pantheons':9,'deityEntries':195,'outerPlanes':16,'creatureCrossReferences':31,'inventoryRead':True},
        'dmgExampleOrigins':{'pdfPages':[286,288],'aasimar':1,'eladrin':1,'optionalRequiresDM':True,'distinctFromSupplementsAnd2024':True},
        'dmgPlanes':{'pdfPages':[44,69],'records':33,'tablesRendered':True,'cordSeveringProcedureNotSpecified':True},
        'dmgAdjudication':{'pdfPages':[22,24,83,85,93,94,104,107,128,131,140,141,236,256,261,262,289,290],'records':len(adjudication_rules()),'objectThresholdIsNotSubtracted':True,'chasesSourceBook':'dmg'},
        'dmgEnvironmentalHazards':{'pdfPages':[104,107,109,121,122,124],'records':len(hazards()),'trapsDoNotCertifyDependentSpells':True}},
      'pendingScopes':[
        {'book':'phb','category':'class-and-spell-interpretations','status':'source-passages-reviewed-open-interpretations',
         'remaining':'Quattro incantesimi e tempo di Ripristinare Vita: questioni esplicite nei record e nelle dipendenze. Deviare Proiettili resta omesso nella prima stampa ma è esplicito nell’SRD ufficiale inglese 5.1 PDF 27 della vista verificata. Non sono descrizioni ancora da leggere.'},
        {'book':'dmg','category':'dependent-items-treasure-madness-and-planar-hazards','status':'inventory-reviewed-open-dependencies',
         'remaining':'Nove oggetti parziali: tre dipendono da Dardo Incantato, quattro dalla follia lunga, Bottiglia di Ferro da tre creature parziali, Occhio di Vecna senza gittata dichiarata. Le tabelle di tesoro propagano queste lacune. Il vento psichico non specifica una procedura di recisione del cordone.'},
        {'book':'mm','category':'specific-abilities-and-hag-coven','status':'relevant-inventory-reviewed-open-interpretations',
         'remaining':'Arcanaloth e megera notturna dipendono da Dardo Incantato; la yochlol non risolve l’azione di ritorno mentre incapacitata; il recupero degli slot condivisi della congrega non specifica chi debba riposare.'},
        {'book':'legacy','category':'unknown-or-additional-content','status':'retained-with-unverified-provenance',
         'remaining':'Record del catalogo preesistente senza fonte riconosciuta conservati separatamente. Supplementi e UA mancanti non sono attribuiti al PHB né eliminati.'}],
      'sourceLimitations':{book:{'status':entry['status'],'textEmptyPdfPages':entry.get('emptyPdfPages',[]),
        'noteIt':'Pagina priva di testo estraibile non equivale a pagina assente: può contenere un’illustrazione o richiedere ispezione visiva.'} for book,entry in database['sources'].items()},
      'missingSources':([] if all(book in database['sources'] for book in ['phb-errata','dmg-errata','mm-errata']) else ['Questa vista conserva la stampa originale; le errata acquisite sono applicate separatamente da merge.py'])+['Supplementi citati dal catalogo maghi e fonti UA non presenti in MANUALI'],
      'errataApplicationComplete':False,
      'cautionIt':'Le categorie complete sono limitate allo scope PHB dichiarato e all’inventario firmato nell’audit. Gli stati dei record e i rimandi incompleti restano espliciti; overallComplete è falso finché persistono questioni aperte. Il bestiario non pretende di censire tutti i mostri del MM.'}


def sqlite_export(path,database):
    # No destructive deletion: replace only the dedicated generated tables.
    with closing(sqlite3.connect(path)) as db, db:
        db.execute('CREATE TABLE IF NOT EXISTS entities (id TEXT PRIMARY KEY, kind TEXT NOT NULL, edition TEXT NOT NULL CHECK(edition="2014"), name TEXT NOT NULL, name_it TEXT, complete INTEGER NOT NULL, payload_json TEXT NOT NULL)')
        db.execute('CREATE TABLE IF NOT EXISTS sources (book TEXT PRIMARY KEY, payload_json TEXT NOT NULL)')
        db.execute('CREATE TABLE IF NOT EXISTS relations (entity_id TEXT REFERENCES entities(id), role TEXT NOT NULL, target_id TEXT REFERENCES entities(id), PRIMARY KEY(entity_id,role,target_id))')
        db.execute('PRAGMA foreign_keys=ON')
        db.execute('DELETE FROM relations');db.execute('DELETE FROM entities');db.execute('DELETE FROM sources')
        db.executemany('INSERT INTO entities VALUES (?,?,?,?,?,?,?)',[(e['id'],e['kind'],e['edition'],e['name'],e['nameIt'],int(e['verification']['complete']),json.dumps(e,ensure_ascii=False,sort_keys=True)) for e in database['entities']])
        db.executemany('INSERT INTO sources VALUES (?,?)',[(k,json.dumps(v,ensure_ascii=False,sort_keys=True)) for k,v in database['sources'].items()])
        rows=[]
        for e in database['entities']:
            for role,value in e.get('relations',{}).items():
                rows.extend((e['id'],role,target) for target in value if isinstance(value,list)) if isinstance(value,list) else rows.append((e['id'],role,value))
        db.executemany('INSERT INTO relations VALUES (?,?,?)',rows)


def report(work,database,cov,comparison):
    counts=Counter(x['type'] for x in comparison['discrepancies'])
    lines=['# Riferimento locale D&D 2014 — estrazione e confronto','',
      '**Stato: fonte revisionata negli scope dichiarati; questioni aperte conservate.** Inventari PHB sottoposti ad audit, 361 descrizioni lette, contenuti pertinenti DMG/MM integrati. Quattro incantesimi e alcune capacità restano parziali per interpretazioni o informazioni non dichiarate. Le categorie complete sono indicate individualmente in coverage.json; il riferimento complessivo non è certificato completo.',
      '',f"Entità: {len(database['entities'])}. Campi meccanici confrontati: {comparison['comparedMechanicalFields']}. Database applicativo: invariato (SHA-256 registrati).",'',
      '## Copertura','', '| Categoria | Inventario atteso | Identità/eventi estratti | Record con alcuni campi verificati | Record completi nel modello |','|---|---:|---:|---:|---:|']
    for c in cov['categories']:
        lines.append(f"| {c['kind']} | {c['expectedIdentities'] if c['expectedIdentities'] is not None else 'da censire'} | {c['extractedIdentities']} | {c['verifiedMechanicalRecords']} | {c['completeRecords']} |")
    features=[e for e in database['entities'] if e['kind']=='class-feature']
    complete_features=sum(e['verification']['complete'] for e in features)
    lines+=['',f"Sono stati letti integralmente {cov['individuallyReviewedSpells']} incantesimi; altri {cov['spellDescriptionsPending']} conservano metadati OCR da verificare. Le liste di classe sono state controllate sui render PHB 208–212 e conservate in un inventario curato indipendente dall’OCR. Questo non verifica gli effetti degli incantesimi.",
      f'I {len(features)} eventi di progressione comprendono etichette generiche derivate per i privilegi di sottoclasse. Per {complete_features} eventi gli effetti sono strutturati; negli altri è verificato il livello, non il comportamento completo.',
      'Warlock: 32 invocazioni, tre doni del patto, dodici privilegi dei patroni e trenta scelte delle liste ampliate. Le liste ampliate non concedono automaticamente gli incantesimi.',
      'Guerriero: sei stili, sedici manovre, diciassette eventi di sottoclasse. PHB PDF 76 controllato sul render: uno slot di quarto livello ai livelli 19 e 20. Adepto Marziale è un’origine distinta senza requisito da guerriero. Attacco Finto e dipendenze restano incompleti nella prima stampa; le errata PDF 1 sono applicate separatamente nella release.',
      'Ladro: quindici eventi dei tre archetipi e privilegi base strutturati; tabella del Mistificatore Arcano verificata sul render PHB PDF 99. Mano Magica verificata in PHB PDF 257; Mani Veloci distingue Usare un Oggetto dall’attivazione magica secondo DMG PDF 142. L’erratum della sostituzione libera è distinto in PH-Errata.pdf PDF 2.',
      'Barbaro: nove eventi dei due cammini e nove scelte totemiche, PHB PDF 47–51. Le tre magie rituali collegate sono state lette integralmente; le scelte dei tre livelli possono usare animali diversi.',
      'Druido: undici eventi dei due circoli, otto territori e 64 concessioni di magie verificate sul render PHB PDF 69; descrizioni degli incantesimi verificate separatamente. La Luna cambia il GS, conserva i limiti di nuoto/volo e spende due usi per gli elementali. Elementale dell’acqua: lacuna di prima stampa e correzione MM-Errata.pdf PDF 2 distinte, comprese le dipendenze. Alterare Se Stesso letto in PHB PDF 212–213.',
      'Razze: nove passaggi d’età, nove sottorazze, dieci ascendenze draconiche e tre congegni dello gnomo delle rocce; PHB PDF 18–25 e 27–44. Allineamenti e descrizione drow della prima stampa sono distinti dalle rimozioni e riscritture di PH-Errata.pdf PDF 1. La copia locale lascia aperta la durata del riposo con Trance; la release conserva separatamente il chiarimento ufficiale del Sage Advice Compendium PDF 2, senza presentarlo come erratum.',
      'Background: tredici origini e cinque varianti, 338 suggerimenti di personalità e 88 di mestiere/origine, revisionati sul render PHB PDF 128–142. I suggerimenti non vincolano allineamenti o scrittura libera. Servitori e Cattiva Reputazione sono alternative delle origini base; lo scudiero nobile sostituisce uno dei tre popolani solo nel cavaliere.',
      'Bardo: otto privilegi dei due collegi, progressione controllata sul render PHB PDF 54. Segreti Magici segue il livello della tabella del bardo, non gli slot cumulativi; i due segreti della Sapienza non occupano il totale conosciuto. Canto di Riposo originale e requisito di dadi vita dell’erratum PDF 1 restano distinti. L’erratum stampa p. 50 per Segreti Magici, mentre il privilegio è a PDF 55, pagina stampata 54: la discordanza è registrata.',
      'Paladino: diciotto privilegi dei tre giuramenti, trenta concessioni di magie, quattro stili con origine distinta. Progressione e liste verificate sui render PHB PDF 84 e 87–89. Punizione Divina conserva slot da paladino nella prima stampa e qualsiasi slot nella vista con PH-Errata.pdf PDF 2; il danno aggiuntivo migliorato resta distinto. Purezza di Spirito usa Protezione dal Bene e dal Male revisionata integralmente in PHB PDF 271.',
      'Ranger: otto privilegi dei due archetipi e undici scelte del Cacciatore, progressione PHB PDF 91 e opzioni PDF 94 controllate sul render. Compagno originale senza azione autonoma e comandi con Schivata conservati separatamente da PH-Errata PDF 2: Schivata predefinita, reazioni autonome, protezione in assenza/incapacità, attacchi magici dal 7 e scelta di Multiattacco dall’11. Le statistiche del compagno usano competenza totale e PF da livello di ranger.',
      'Monaco: dodici privilegi delle tre tradizioni e diciassette discipline, PHB PDF 77–82 e render 78/79/81/82. Quindici descrizioni di magie collegate sono state lette integralmente. Difesa della Montagna Eterna originale al livello 11 ed erratum al 17; Frusta d’Acqua bonus originale e azione corretta; Sintonia nelle vicinanze contro trenta piedi. Il PDF contiene già la frase di competenza/arma da monaco di Deviare Proiettili riportata nelle errata, ma non la gittata del contrattacco. La vista verificata aggiunge 20/60 piedi da SRD ufficiale inglese 5.1 PDF 27, distinto dall’originale e dalle errata. Il limite ki per incantesimi non limita Pugno dell’Aria e Frusta d’Acqua, che non sono magie.',
      'Mago: quaranta privilegi delle otto scuole e dodici scelte di Terzo Occhio/Pietra, PHB PDF 113–120 e render 114/117–120. Copia nel libro, evocazione minore, Invocazione Potenziata e Sovraccaricare mantengono originali ed errata PDF 2. Metamorfosi, Animare Morti, Rianimare Morti e Dissolvi Magie revisionati integralmente. Il Maestro Trasmutatore resta parziale per il tempo di Ripristinare Vita: nessuna esenzione di materiali viene inventata e la scuola non viene certificata interamente.',
      f'Creature: {cov["reviewedCreatureScope"]["completeStatBlocks"]} blocchi del MM revisionati, comprese le quindici forme ordinarie di Trova Famiglio. Orsi nero e bruno conservano separati i bonus di attacco originali (+3/+5) e quelli corretti (+4/+6), MM-Errata.pdf PDF 1. Il gufo del MM PDF 334 ha udito e vista acuti; il PHB PDF 309 indica solo vista. Questo conflitto non è normalizzato come erratum.',
      '','## Fonti e stampa','']
    for s in database['sources'].values():
        review=s['review']; evidence=', '.join('PDF '+str(e['pdfPage'])+' '+e['section'] for e in review['evidence'])
        lines.append(f"- `{s['filename']}`: edizione {review['edition']}, {review['role']}; {evidence}. {review['notesIt']}")
    lines+=['','## Differenze dell’SRD italiano','',
      '- SRD italiano PDF 84, Lottatore: due benefici; PHB PDF 168 ne include un terzo. PH-Errata.pdf, PDF 3, rimuove quel terzo beneficio: originale ed erratum restano distinti nella release candidata.',
      '- SRD italiano PDF 99, Riposo lungo: almeno un dado vita recuperato; PHB PDF 187 non esplicita quel minimo. È una differenza di stampa.',
      '- SRD italiano PDF 7, Eredità infernale: recupero dopo riposo lungo; PHB PDF 44 usa una volta al giorno.',
      '- Il supporto italiano è SRD 5.1: non contiene il catalogo completo del PHB. Il compatto SRD 5.2.1 è escluso.',
      '', '## Risultati del confronto','']
    lines += [f'- {k}: {n}.' for k,n in sorted(counts.items())]
    lines+=['',f"Contenuti aggiuntivi nel catalogo sottoclassi: {len(comparison['additionalCatalogContent'])}; vedi `comparison.json`. UA e supplementi sono distinti dagli errori.",
      f"Record del catalogo generale/armi non riconosciuti dall’inventario PHB attuale: {len(comparison['unmatchedCatalogRecords'])}; provenienza da verificare. Gli oggetti e i mostri individualmente revisionati hanno cataloghi separati; il confronto semantico dell’intero catalogo legacy rimane parziale.",
      '', 'Ogni discrepanza riporta identificatore, campo, valore attuale, valore di riferimento o candidato, pagine, conseguenza e proposta. Le differenze di traduzione restano da verificare.',
      '', '## Questioni aperte e limiti dello scope','']
    lines+=['- Liste incantesimi: PH-Errata.pdf, PDF 4, elimina `Trap the Soul` (PHB PDF 212) e rinomina `Destructive Smite` in `Destructive Wave` (PHB PDF 210). Queste risoluzioni sono applicate nella vista corretta, senza riscrivere la prima stampa. Il confronto visivo ha inoltre recuperato `Jump` nella lista ranger, omesso dall’OCR.']
    lines += [f"- {x['book']} / {x['category']}: {x['status']}. {x.get('remaining','Inventario delle voci e verifica delle meccaniche da completare.')}" for x in cov['pendingScopes']]
    lines+=['','Pagine senza testo e fonti mancanti sono elencate in `coverage.json`; non sono state interpretate come assenza di regole.',
      '', '## Artefatti','',
      '- `reference.json`: entità, campi, relazioni e provenienza; `reference.sqlite`: copia interrogabile, non usata dall’app.',
      '- `comparison.json`: confronto ripetibile e hash dei cinque cataloghi di ingresso.',
      '- `coverage.json`: inventario e campi mancanti; `spell-list-candidates.json`: relazioni OCR e righe irrisolte.',
      '- `source-manifest.json`: impronte e revisione dei manuali; `validation.json`: controlli di integrità.',
      '', 'Vedi `scripts/rules2014/README.md` per rigenerazione, schema, limiti e verifiche. Cache e output restano locali e separati da `public/data`.']
    (work/'REPORT.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--skip-spell-lists',action='store_true');args=parser.parse_args()
    manifest=extract();manifest=load_reviews(manifest);write_json(WORK/'source-manifest.json',manifest)
    database={'schemaVersion':1,'edition':'2014','status':'partial-reference-not-runtime-database','sources':manifest,'entities':build_entities(load_pages('phb'))}
    errors=validate(database);write_json(WORK/'validation.json',{'errors':errors,'passed':not errors})
    if errors:raise ValueError('\n'.join(errors))
    write_json(WORK/'reference.json',database);sqlite_export(WORK/'reference.sqlite',database)
    spells=[e for e in database['entities'] if e['kind']=='spell']
    if not args.skip_spell_lists:
        lists=extract_lists(spells);write_json(WORK/'spell-list-candidates.json',lists)
    comparison=compare(database);cov=coverage(database)
    write_json(WORK/'inventory-audit.json',json.loads(Path(__file__).with_name('inventory_audit.json').read_text(encoding='utf-8')))
    write_json(WORK/'review-queue.json',[{'entityId':e['id'],'kind':e['kind'],'name':e['name'],'missingFields':e['verification']['missingFields'],
                                      'sources':e['sources'],'mechanicalStatus':e['verification']['mechanics']} for e in database['entities'] if not e['verification']['complete']])
    write_json(WORK/'comparison.json',comparison);write_json(WORK/'coverage.json',cov);report(WORK,database,cov,comparison)
    print('Reference:',len(database['entities']),'entities; compared fields:',comparison['comparedMechanicalFields'],'findings:',len(comparison['discrepancies']))
    print(WORK/'REPORT.md')


if __name__=='__main__':main()
