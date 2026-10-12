"""Regression checks for immutable backup, field-level corrections and merging."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from backup import create_backup, safe_member, verify_backup, digest
from errata import corrected_reference, load_errata
from merge import merge_catalogs, audit_records, verify_release
from pdf_sources import ROOT, WORK
from validate import validate
from fighter_reviews import apply_fighter_reviews


class BackupTests(unittest.TestCase):
    def test_changed_supporting_srd_is_rejected_before_rule_application(self):
        from errata import load_supporting_srd
        with tempfile.TemporaryDirectory() as tmp:
            folder=Path(tmp);(folder/'rulings').mkdir()
            (folder/'rulings/SRD-OGL_V5.1.pdf').write_bytes(b'%PDF-changed')
            with patch('errata.WORK',folder):
                with self.assertRaisesRegex(ValueError,'changed'):load_supporting_srd()
    def test_identical_readable_snapshot_and_no_overwrite(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)/'project'; (root/'public/data').mkdir(parents=True)
            raw=b'{"schemaVersion":2,"records":[{"index":"original"}]}\n'
            (root/'public/data/catalog.json').write_bytes(raw)
            folder,manifest=create_backup(root,Path(tmp)/'backup')
            self.assertTrue(manifest['copyIdentical'])
            self.assertEqual(manifest['files'][0]['declaredSchemaVersion'],2)
            self.assertEqual((folder/'files/public/data/catalog.json').read_bytes(),raw)
            self.assertEqual((root/'public/data/catalog.json').read_bytes(),raw)
            with self.assertRaisesRegex(ValueError,'overwrite'): create_backup(root,folder)
            (folder/'files/public/data/catalog.json').write_bytes(raw+b' ')
            with self.assertRaisesRegex(ValueError,'integrity'): verify_backup(folder)

    def test_path_escape_rejected(self):
        for relative in ['../catalog.json','x/../../outside','C:/private.json']:
            with self.assertRaises(ValueError): safe_member(ROOT,relative)

    def test_unreadable_live_catalog_never_certified(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)/'project'; (root/'public/data').mkdir(parents=True)
            (root/'public/data/catalog.json').write_text('{bad json')
            with self.assertRaisesRegex(ValueError,'Unreadable'): create_backup(root,Path(tmp)/'backup')
            self.assertFalse((Path(tmp)/'backup/BACKUP.json').exists())


@unittest.skipUnless((WORK/'reference.json').exists(),'Build the local reference first.')
class MergeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.original=json.loads((WORK/'reference.json').read_text(encoding='utf-8'))
        cls.manifest,_=load_errata()
        cls.reference=corrected_reference(cls.original,cls.manifest)
        cls.catalogs={p.name:json.loads(p.read_text(encoding='utf-8-sig')) for p in (ROOT/'public/data').glob('*.json')}

    def test_general_and_spell_errata_preserve_original_view(self):
        old={e['id']:e for e in self.original['entities']};new={e['id']:e for e in self.reference['entities']}
        for e in self.original['entities']:
            if e['kind']=='class':
                self.assertNotIn('minimum',e['mechanics']['hitPointsHigherLevels'])
                self.assertEqual(new[e['id']]['mechanics']['hitPointsHigherLevels']['minimum'],1)
        self.assertNotIn('requiresSight',old['phb2014:spell:acid-splash']['mechanics']['effect']['targetChoice'])
        self.assertTrue(new['phb2014:spell:acid-splash']['mechanics']['effect']['targetChoice']['requiresSight'])
        self.assertEqual(new['phb2014:spell:find-steed']['mechanics']['effect']['telepathicCommunication'],'both-directions')
        self.assertIn('each',new['phb2014:spell:slow']['mechanics']['effect']['repeatSave'])
        self.assertEqual(old['phb2014:rule:hiding']['mechanics']['cannotHideFrom'],'creature-that-can-see-you')
        self.assertEqual(new['phb2014:rule:hiding']['mechanics']['cannotHideFrom'],'creature-that-can-see-you-clearly')
        self.assertIn('alignmentSuggestionIt',old['dmg2014:race:aasimar-dmg-example']['mechanics'])
        self.assertNotIn('alignmentSuggestionIt',new['dmg2014:race:aasimar-dmg-example']['mechanics'])

    def test_rods_scrolls_lifetime_recovery_and_confirmed_local_erratum(self):
        old={e['id']:e for e in self.original['entities']};new={e['id']:e for e in self.reference['entities']}
        m=lambda index:new['dmg2014:magic-item:'+index]['mechanics']['effect']
        self.assertEqual(m('rod-of-resurrection')['recoveryAmountUses'],1)
        self.assertEqual(m('rod-of-resurrection')['castChoices'][1]['activation'],'action')
        self.assertEqual(m('rod-of-absorption')['absorb']['lifetimeMaximumLevels'],50)
        self.assertFalse(old['dmg2014:magic-item:rod-of-lordly-might']['mechanics']['effect']['buttons'][0]['swordTypeChoiceInLocalPrinting'])
        self.assertTrue(m('rod-of-lordly-might')['buttons'][0]['swordTypeChoiceInLocalPrinting'])
        self.assertEqual(m('spell-scroll'),old['dmg2014:magic-item:spell-scroll']['mechanics']['effect'])
        self.assertTrue(any(c['entityId']=='dmg2014:magic-item:spell-scroll' for c in self.reference['editorialConfirmationLog']))
        self.assertFalse(any(c['entityId']=='dmg2014:magic-item:spell-scroll' for c in self.reference['editorialChangeLog']))
        self.assertEqual(len(m('spell-scroll')['variants']),10)
        self.assertTrue(new['dmg2014:magic-item:robe-of-useful-items']['verification']['complete'])
        self.assertFalse(new['dmg2014:magic-item:robe-of-stars']['verification']['complete'])
        self.assertEqual(m('robe-of-stars')['recovery'],'dusk')

    def test_staves_wands_tables_and_independent_resource_pools(self):
        new={e['id']:e for e in self.reference['entities']}
        m=lambda index:new['dmg2014:magic-item:'+index]['mechanics']['effect']
        combined=m('staff-of-thunder-and-lightning')['thunderAndLightning']
        self.assertTrue(combined['doesNotSpendTheirDailyUses'])
        self.assertEqual(m('staff-of-the-magi')['uses'],50)
        self.assertIn('no-destruction-on-one',m('staff-of-the-magi')['lastCharge'])
        self.assertEqual(m('staff-of-healing')['castChoices'][3]['castSpellLevel'],4)
        self.assertEqual(m('staff-of-the-woodlands')['castChoices'][1]['activation'],'action')
        self.assertEqual([n for r in m('wand-of-wonder')['d100Effects'] for n in range(r['range'][0],r['range'][1]+1)],list(range(1,101)))
        self.assertEqual(m('wand-of-fireballs')['castChoices'][-1]['castSpellLevel'],9)
        self.assertFalse(new['dmg2014:magic-item:staff-of-power']['verification']['complete'])
        self.assertFalse(new['dmg2014:magic-item:wand-of-magic-missiles']['verification']['complete'])
        self.assertEqual(m('winged-boots')['minimumActivationSeconds'],60)
        self.assertNotIn('durationAccountingMinutes',m('winged-boots'))

    def test_bean_creatures_lair_and_legendary_original_errata(self):
        old={e['id']:e for e in self.original['entities']};new={e['id']:e for e in self.reference['entities']}
        self.assertTrue(new['dmg2014:magic-item:bag-of-beans']['verification']['complete'])
        self.assertEqual(len(new['dmg2014:magic-item:bag-of-beans']['relations']['dependencyIds']),4)
        lord=new['mm2014:creature:mummy-lord']['mechanics']
        self.assertEqual(lord['lair']['challengeRating'],16)
        self.assertEqual(lord['challengeRating'],15)
        self.assertEqual(lord['legendaryActionEconomy']['maximum'],3)
        spellcasting=next(t['effect'] for t in lord['traits'] if t['index']=='spellcasting')
        self.assertEqual(spellcasting['casterLevelInLocalPrinting'],10)
        self.assertEqual(spellcasting['preparedSpellLevels'][-1]['level'],6)
        self.assertEqual(old['mm2014:rule:legendary-creatures']['mechanics']['assumedLegendaryFormInheritanceInLocalPrinting'],'not-addressed')
        self.assertEqual(new['mm2014:rule:legendary-creatures']['mechanics']['assumedLegendaryFormInheritanceInLocalPrinting'],'no-legendary-actions-lair-actions-or-regional-effects')
        self.assertTrue(new['mm2014:rule:monster-actions-and-spells']['mechanics']['classMembershipForMagicItemsInLocalPrinting'])
        self.assertEqual(new['mm2014:creature:shrieker']['mechanics']['reactions'][0]['activation'],'reaction')

    def test_remaining_feat_errata_keep_originals_and_distinct_scopes(self):
        old={e['id']:e for e in self.original['entities']};new={e['id']:e for e in self.reference['entities']}
        def feat(index):return old['phb2014:feat:'+index]['mechanics'],new['phb2014:feat:'+index]['mechanics']
        a,b=feat('alert');self.assertIn('hiddenAttackersGainAdvantage',a);self.assertNotIn('hiddenAttackersGainAdvantage',b);self.assertFalse(b['unseenAttackersGainAdvantage'])
        a,b=feat('athlete');self.assertFalse(a['climbingHalvesSpeed']);self.assertEqual(b['climbingExtraMovementCost'],0)
        a,b=feat('sentinel');self.assertEqual(a['disengageDoesNotPreventOpportunityWithinFt'],5);self.assertTrue(b['disengageDoesNotPreventOpportunity']);self.assertEqual(a['reactionAttack'],b['reactionAttack'])
        a,b=feat('heavy-armor-master');self.assertEqual(a['damageReduction']['from'],'nonmagical-weapons');self.assertEqual(b['damageReduction']['from'],'nonmagical-attacks')
        a,b=feat('tavern-brawler');self.assertIn('unarmed-strikes',a['proficiencies']);self.assertNotIn('unarmed-strikes',b['proficiencies'])
        a,b=feat('weapon-master');self.assertEqual(b['weaponProficiencyChoice']['categories'],['simple','martial'])
        a,b=feat('dungeon-delver');self.assertEqual(a['trapSearchAllowedTravelPace'],'normal');self.assertEqual(b['fastTravelPassivePerceptionPenalty'],0)

    def test_dmg_hazards_optional_rules_and_existing_erratum_wording(self):
        old={e['id']:e for e in self.original['entities']};new={e['id']:e for e in self.reference['entities']}
        poisons=[e for e in old.values() if e['mechanics'].get('ruleType')=='poison']
        self.assertEqual(len(poisons),14)
        self.assertEqual(len([e for e in old.values() if e['mechanics'].get('ruleType')=='disease']),3)
        self.assertEqual(new['dmg2014:rule:poison-delivery']['mechanics'],old['dmg2014:rule:poison-delivery']['mechanics'])
        self.assertEqual(self.reference['editorialConfirmationLog'][0]['operation'],'confirm-existing-local-wording')
        self.assertFalse(any(c['entityId']=='dmg2014:rule:poison-delivery' for c in self.reference['editorialChangeLog']))
        self.assertTrue(any(c['entityId']=='dmg2014:rule:combining-game-effects' for c in self.reference['editorialConfirmationLog']))
        self.assertEqual(old['dmg2014:rule:poison-oil-of-taggit']['mechanics']['effect']['wakesOn'],['damage'])
        self.assertEqual(old['dmg2014:rule:poison-drow-poison']['mechanics']['effect']['failureByAtLeast']['margin'],5)
        tables=old['dmg2014:rule:madness']['mechanics']['tables']
        for table in tables.values():
            self.assertEqual([n for r in table['rows'] for n in range(r['minimum'],r['maximum']+1)],list(range(1,101)))
            self.assertTrue(all(r['summaryIt'] for r in table['rows']))
        self.assertFalse(old['dmg2014:rule:madness']['verification']['complete'])
        guns=old['dmg2014:rule:firearms']
        self.assertTrue(guns['optional']);self.assertTrue(guns['mechanics']['requiresDMApproval'])
        self.assertEqual(len(guns['mechanics']['weapons']),10)
        self.assertTrue(all(w['costGP'] is None for w in guns['mechanics']['weapons'] if w['period']!='renaissance'))
        explosives={e['index']:e for e in old['dmg2014:rule:explosives']['mechanics']['entries']}
        self.assertEqual(explosives['bomb']['successDamage'],'none')
        self.assertEqual(explosives['fragmentation-grenade']['successDamage'],'half')
        self.assertFalse(old['dmg2014:rule:slow-natural-healing']['mechanics']['longRestAutomaticHPRecovery'])

    def test_magic_variants_golem_dependencies_and_repeatable_inventory(self):
        from magic_item_reviews import magic_items
        self.assertEqual(magic_items(),magic_items(),'Variant expansion must not mutate the curated inventory.')
        old={e['id']:e for e in self.original['entities']};new={e['id']:e for e in self.reference['entities']}
        instrument='dmg2014:magic-item:instrument-of-the-bards'
        self.assertEqual(len(old[instrument]['mechanics']['effect']['variants']),7)
        self.assertEqual(len(old[instrument]['mechanics']['effect']['variants'][0]['castChoices']),7)
        self.assertIn('somatic-or-material-component',new[instrument]['mechanics']['effect']['charmSaveDisadvantageInLocalPrinting'])
        self.assertNotIn('somatic-or-material-component',old[instrument]['mechanics']['effect']['charmSaveDisadvantageInLocalPrinting'])
        for name in ['clay','flesh','iron','stone']:
            eid='mm2014:creature:'+name+'-golem'
            self.assertEqual(old[eid]['mechanics']['conditionalDamageImmunities'][0]['condition'],'nonmagical-weapons-not-adamantine')
            self.assertEqual(new[eid]['mechanics']['conditionalDamageImmunities'][0]['condition'],'nonmagical-attacks-not-adamantine')
        self.assertTrue(new['dmg2014:magic-item:manual-of-golems']['verification']['complete'])
        self.assertEqual(len(new['dmg2014:magic-item:manual-of-golems']['relations']['dependencyIds']),4)
        self.assertTrue(new['dmg2014:magic-item:quaals-feather-token']['verification']['complete'])
        self.assertEqual(new['mm2014:creature:roc']['mechanics']['damageImmunities'],[])
        self.assertFalse(new['dmg2014:magic-item:iron-flask']['verification']['complete'])

    def test_sentient_artifacts_property_tables_and_stat_block_exceptions(self):
        old={e['id']:e for e in self.original['entities']};new={e['id']:e for e in self.reference['entities']}
        from magic_item_reviews import magic_item_rules
        tables=[e for e in magic_item_rules() if e['mechanics'].get('ruleType') in ['magic-item-property-table','artifact-property-table']]
        self.assertEqual(len(tables),8)
        for e in tables:
            m=e['mechanics'];outcomes=[n for r in m['rows'] for n in range(r['minimum'],r['maximum']+1)]
            self.assertEqual(outcomes,list(range(1,int(m['die'][1:])+1)),e['id'])
            self.assertTrue(all(r['summaryIt'] for r in m['rows']))
        m=lambda i:new['dmg2014:magic-item:'+i]['mechanics']['effect']
        self.assertEqual(m('blackrazor')['haste']['concentrationMaintainedBy'],'item')
        self.assertEqual(m('whelm')['castChoices'][0]['uses'],1)
        self.assertEqual(m('whelm')['castChoices'][1]['uses'],1)
        self.assertFalse(m('moonblade')['runes']['rows'][-2]['canCreateNewShadows'])
        self.assertEqual(new['mm2014:creature:shadow']['mechanics']['actions'][0]['effect']['ifNonEvilHumanoidSlain'],'new-shadow-after-one-d-four-hours')
        self.assertFalse(new['dmg2014:magic-item:eye-of-vecna']['verification']['complete'])
        for i in ['book-of-vile-darkness','orb-of-dragonkind','sword-of-kas','wand-of-orcus']:
            self.assertIn('dependencyIncomplete:dmg2014:rule:artifact-major-detrimental',new['dmg2014:magic-item:'+i]['verification']['missingFields'])
        self.assertEqual(m('sword-of-kas')['afterDrawnOneMinuteWithoutBlood']['successDamage'],'3d6-psychic')
        self.assertIn('impact-point',m('whelm')['shockWave']['targets'])
        self.assertEqual(m('wand-of-orcus')['callUndead']['maximumTotalAverageHP'],500)
        self.assertEqual(m('axe-of-the-dwarvish-lords')['curseNonDwarfAttuned']['racialTraits'],'unchanged')
        for i in ['shadow','wight','empyrean']:
            field='conditionalDamageImmunities' if i=='empyrean' else 'conditionalDamageResistances'
            self.assertTrue(old['mm2014:creature:'+i]['mechanics'][field][0]['condition'].startswith('nonmagical-weapons'))
            self.assertTrue(new['mm2014:creature:'+i]['mechanics'][field][0]['condition'].startswith('nonmagical-attacks'))

    def test_supernatural_rewards_are_2014_not_objects_or_automatic_advancement(self):
        new={e['id']:e for e in self.reference['entities']}
        gifts=[e for e in new.values() if e['mechanics'].get('ruleType')=='supernatural-gift']
        self.assertEqual(len(gifts),40)
        self.assertEqual([sum(e['mechanics']['giftType']==t for e in gifts) for t in ['blessing','charm','epic-boon']],[7,7,26])
        self.assertTrue(all(e['verification']['complete'] and not e['mechanics']['requiresAttunement'] and not e['mechanics']['isObject'] for e in gifts))
        frame=new['dmg2014:rule:supernatural-gifts']['mechanics']
        self.assertFalse(frame['blessing']['suppressedByAntimagic']);self.assertTrue(frame['charm']['suppressedByAntimagic'])
        self.assertEqual(frame['charm']['spellComponentsRequired'],[])
        self.assertEqual(new['dmg2014:rule:charm-restoration']['mechanics']['effect']['uses'],6)
        self.assertEqual(new['dmg2014:rule:epic-boon-dimensional-travel']['mechanics']['effect']['activation'],'action')
        self.assertTrue(all(e['mechanics']['minimumTotalLevel']==20 and not e['mechanics']['repeatable'] for e in gifts if e['mechanics']['giftType']=='epic-boon'))
        self.assertEqual(new['dmg2014:rule:epic-boon-resilience']['mechanics']['effect']['conditionalDamageResistances'][0]['condition'],'nonmagical-weapons')
        self.assertTrue(new['dmg2014:rule:epic-boons']['mechanics']['optionalXPAdvancement']['DMConsiderationNotAutomatic'])

    def test_full_spell_inventory_materials_timing_and_editorial_views(self):
        old={e['id']:e for e in self.original['entities']};new={e['id']:e for e in self.reference['entities']}
        spells=[e for e in old.values() if e['kind']=='spell']
        self.assertEqual(len(spells),361)
        self.assertTrue(all(e['verification']['mechanics']=='verified-fields' and e['nameIt'] and e['summaryIt'] for e in spells))
        self.assertEqual({e['name'] for e in spells if not e['verification']['complete']},{'Magic Missile','Antipathy/Sympathy',"Leomund's Tiny Hut","Nystul's Magic Aura"})
        m=lambda name:new['phb2014:spell:'+name]['mechanics']
        self.assertEqual(m('clone')['materialConsumptionStatus'],'partially-consumed')
        self.assertEqual(m('clone')['materialCostGP'],3000)
        self.assertEqual([r['consumed'] for r in m('clone')['effect']['materialRequirements']],[True,True,False])
        self.assertEqual(m('forbiddance')['materialConsumptionStatus'],'conditionally-consumed')
        self.assertEqual(m('plant-growth')['castingAlternatives'][1]['quantity'],8)
        self.assertFalse(m('spiritual-weapon')['concentration'])
        self.assertFalse(m('witch-bolt')['upcast']['ongoingDamageScales'])
        self.assertIn('Wisdom-ability-check',m('wrathful-smite')['effect']['endFear'])
        for name in ['phantasmal-killer','weird']:
            self.assertEqual(old['phb2014:spell:'+name]['mechanics']['effect']['subsequentSaveTiming'],'start-of-target-turn-in-local-printing')
            self.assertEqual(m(name)['effect']['subsequentSaveTiming'],'end-of-each-target-turn')
        self.assertEqual(m('simulacrum')['effect']['typeInLocalPrinting'],'construct')
        self.assertEqual(old['phb2014:spell:simulacrum']['mechanics']['effect']['typeInLocalPrinting'],'copied-creature-type')
        self.assertEqual(m('sleet-storm')['effect']['concentrationSave']['timingInLocalPrinting'],'start-target-turn-in-area-while-concentrating')
        self.assertTrue(m('true-polymorph')['effect']['cannotAffectZeroHP'])
        for row in m('teleport')['effect']['table'].values():
            rolls=[roll for low,high in row.values() for roll in range(low,high+1)]
            self.assertEqual(sorted(rolls),list(range(1,101)))
        for name in ['conjure-animals','conjure-celestial','conjure-minor-elementals','conjure-woodland-beings']:
            self.assertEqual(m(name)['effect']['summonedCreatureSelection']['specificCreaturesChosenBy'],'DM-within-chosen-option')
            self.assertNotIn('summonedCreatureSelection',old['phb2014:spell:'+name]['mechanics']['effect'])
        self.assertEqual(validate(self.reference),[])

    def test_mm_beasts_swallow_poison_variants_and_editorial_accuracy(self):
        from creature_reviews import ROWS
        self.assertEqual(len(ROWS),89)
        self.assertEqual(len({r[0] for r in ROWS}),89)
        old={e['id']:e for e in self.original['entities']};new={e['id']:e for e in self.reference['entities']}
        m=lambda index:new['mm2014:creature:'+index]['mechanics']
        self.assertTrue(all(old['mm2014:creature:'+r[0]]['verification']['complete'] for r in ROWS))
        self.assertEqual(m('giant-toad')['traits'][1]['effect']['longJumpFt'],20)
        self.assertEqual(m('giant-toad')['actions'][1]['effect']['damageAtStartToadTurn']['dice'],'3d6')
        self.assertEqual(m('giant-frog')['actions'][1]['effect']['damageAtStartFrogTurn']['dice'],'2d4')
        self.assertEqual(m('giant-centipede')['actions'][0]['effect']['additionalDamageSave']['successDamage'],'none')
        self.assertEqual(m('giant-wasp')['actions'][0]['effect']['additionalDamageSave']['successDamage'],'half')
        self.assertEqual(m('flying-snake')['actions'][0]['effect']['save'],'none')
        self.assertEqual([t['index'] for t in m('giant-bat')['traits']],['echolocation','keen-hearing'])
        self.assertEqual(m('giant-poisonous-snake')['actions'][0]['reachFt'],10)
        self.assertEqual(m('giant-owl')['alignment'],'neutral')
        self.assertEqual(m('giant-vulture')['languages'],[])
        self.assertEqual(m('giant-vulture')['understandsAdditionalLanguages'],['common'])
        self.assertFalse(any(t['index']=='spider-climb' for t in m('giant-lizard')['traits']))
        self.assertNotIn('darkvision',m('polar-bear')['sensesFt'])
        self.assertEqual(m('polar-bear')['optionalVariants'][0]['effect']['sensesFt']['darkvision'],60)
        self.assertEqual(m('giant-rat')['actions'][0]['effect'],{})
        self.assertEqual(old['mm2014:creature:giant-rat']['mechanics']['optionalVariants'][0]['effect']['action']['attackBonus'],3)
        self.assertEqual(m('giant-rat')['optionalVariants'][0]['effect']['action']['attackBonus'],4)
        self.assertEqual(old['mm2014:creature:elephant']['mechanics']['actions'][0]['damage']['dice'],'3d8+5')
        self.assertEqual(m('elephant')['actions'][0]['damage']['dice'],'3d8+6')
        self.assertEqual(m('riding-horse')['actions'][0]['attackBonus'],5)
        self.assertEqual(m('warhorse')['actions'][0]['attackBonus'],6)
        self.assertFalse(m('tyrannosaurus-rex')['actions'][0]['effect']['sameTargetAllowed'])
        self.assertEqual(m('stirge')['actions'][0]['effect']['bloodLossAtStartOwnTurn']['kind'],'HP-loss-not-damage')
        self.assertEqual(validate(self.reference),[])

    def test_swarm_identity_damage_and_editorial_grapple_immunity(self):
        old={e['id']:e for e in self.original['entities']};new={e['id']:e for e in self.reference['entities']}
        swarms=[e for e in old.values() if e['kind']=='creature' and e['mechanics'].get('isSwarm')]
        self.assertEqual(len(swarms),6)
        for e in swarms:
            self.assertNotIn('grappled',e['mechanics']['conditionImmunities'])
            self.assertIn('grappled',new[e['id']]['mechanics']['conditionImmunities'])
            self.assertEqual(e['mechanics']['actions'][0]['reachFt'],0)
            self.assertFalse(e['mechanics']['traits'][-1]['effect']['canRegainHP'])
        snakes=new['mm2014:creature:swarm-of-poisonous-snakes']['mechanics']['actions'][0]['effect']
        self.assertEqual(snakes['atHalfHPOrFewerDamage']['dice'],'1d6')
        self.assertEqual(snakes['additionalDamageSave']['failedDamage']['dice'],'4d6')
        self.assertTrue(snakes['additionalDamageSave']['unchangedWhenSwarmAtHalfHP'])
        self.assertEqual(validate(self.reference),[])

    def test_magic_item_catalogs_gap_integration_and_editorial_views(self):
        from merge import creation_gap_audit
        old={e['id']:e for e in self.original['entities']};new={e['id']:e for e in self.reference['entities']}
        self.assertEqual(old['dmg2014:rule:magic-item-use']['mechanics']['scrollActivationInLocalPrinting'],'action-to-read')
        self.assertEqual(new['dmg2014:rule:magic-item-use']['mechanics']['scrollActivationInLocalPrinting'],'user-reads; casting-time-from-scroll-description')
        merged,log,mapping,pending=merge_catalogs(self.catalogs,self.reference)
        self.assertEqual(len(merged['verified-magic-items-2014.json']['magicItems']),267)
        self.assertEqual(new['dmg2014:magic-item:cube-of-force']['mechanics']['effect']['recoveryDice'],'1d20')
        self.assertEqual(new['dmg2014:magic-item:cloak-of-arachnida']['mechanics']['effect']['moveThroughWebs'],'as-difficult-terrain')
        self.assertEqual(new['dmg2014:magic-item:cloak-of-invisibility']['mechanics']['effect']['recoveryAmountMinutes'],60)
        self.assertEqual(new['dmg2014:magic-item:candle-of-invocation']['mechanics']['effect']['recovery'],'none')
        self.assertEqual(len(merged['verified-creation-options-2014.json']['creationOptions']),59)
        for array,kind in [('spells','spell'),('feats','feat'),('backgrounds','background'),('subraces','subrace')]:
            for e in [e for e in new.values() if e['kind']==kind and e['verification']['complete']]:
                from compare import match
                self.assertIsNotNone(match(e,merged['character-options.json'][array]))
        self.assertTrue(any(e['index']=='hex' and e['level']==1 for e in merged['character-options.json']['spells']))
        original=self.catalogs['character-equipment.json']['magicItems'][0]
        enriched=merged['character-equipment.json']['magicItems'][0]
        self.assertEqual(enriched['id'],original['id'])
        self.assertEqual(enriched['desc'],original['desc'])
        self.assertIn('verifiedRules2014',enriched)
        baseline=ROOT/'rules-database.local/2014/candidate-5234848b05f3a8cca0e2/comparison-before.json'
        if baseline.exists():
            audit=creation_gap_audit(json.loads(baseline.read_text()),self.reference,mapping)
            self.assertEqual(audit['initialGapCount'],132)
            self.assertEqual(audit['decisions'],{'integrated-isolated-candidate':131,'confirmed-identity-incomplete-no-automatic-addition':1})
            self.assertEqual([r['referenceId'] for r in audit['entries'] if r['decision']!='integrated-isolated-candidate'],['phb2014:subclass:wild-magic'])
        self.assertEqual(validate(self.reference),[])

    def test_combat_context_originals_and_confirmed_errata(self):
        old={e['id']:e for e in self.original['entities']};new={e['id']:e for e in self.reference['entities']}
        self.assertEqual(old['phb2014:action:ready']['mechanics']['expiresInLocalPrinting'],'later-in-the-round')
        self.assertEqual(new['phb2014:action:ready']['mechanics']['expiresInLocalPrinting'],'before-start-of-own-next-turn')
        for index in ['grapple','shove']:
            self.assertNotIn('automaticSuccessAgainstIncapacitated',old['phb2014:rule:'+index]['mechanics'])
            self.assertTrue(new['phb2014:rule:'+index]['mechanics']['automaticSuccessAgainstIncapacitated'])
        self.assertEqual(old['phb2014:rule:creature-space']['mechanics']['surroundingMediumExamples']['LargeAroundOneMediumInLocalPrinting'],5)
        self.assertEqual(new['phb2014:rule:creature-space']['mechanics']['surroundingMediumExamples']['LargeAroundOneMediumInLocalPrinting'],4)
        self.assertTrue(old['phb2014:rule:unarmed-strikes']['mechanics']['listedAsWeaponInLocalPrinting'])
        self.assertFalse(new['phb2014:rule:unarmed-strikes']['mechanics']['listedAsWeaponInLocalPrinting'])
        self.assertEqual(new['phb2014:rule:unarmed-strikes']['mechanics']['proficiencyInLocalPrinting'],'all-characters-proficient')
        self.assertFalse(old['mm2014:creature:efreeti']['verification']['complete'])
        self.assertTrue(new['mm2014:creature:efreeti']['mechanics']['traits'][1]['effect']['threePerDayEachInLocalPrinting'])
        self.assertTrue(new['mm2014:creature:efreeti']['verification']['complete'])
        self.assertFalse(old['dmg2014:magic-item:efreeti-bottle']['verification']['complete'])
        self.assertTrue(new['dmg2014:magic-item:efreeti-bottle']['verification']['complete'])
        self.assertTrue(new['dmg2014:magic-item:bag-of-beans']['verification']['complete'])
        self.assertEqual(validate(self.reference),[])

    def test_dmg_evil_options_source_approval_and_spell_tables(self):
        rows={e['id']:e for e in self.reference['entities']}
        fs=[e for e in rows.values() if e['kind']=='subclass-feature' and e['sources'][0]['book']=='dmg']
        self.assertEqual(len(fs),13)
        for sub in ['death','oathbreaker']:
            e=rows['dmg2014:subclass:'+sub]
            self.assertTrue(e['optional'] and e['mechanics']['requiresDMApproval'] and e['verification']['complete'])
            self.assertTrue(all(rows[i]['verification']['complete'] for i in e['relations']['featureIds']))
        grants=rows['dmg2014:subclass-feature:death-1-domain-spells']['mechanics']['effect']['grants']
        self.assertEqual([g['clericLevel'] for g in grants],[1,1,3,3,5,5,7,7,9,9])
        self.assertEqual(grants[-1]['spellId'],'phb2014:spell:cloudkill')
        oath=rows['dmg2014:subclass:oathbreaker']
        self.assertEqual(oath['mechanics']['requiresAlignment'],'evil')
        self.assertEqual(oath['mechanics']['atonement']['secondOathBreach'],'may-become-Oathbreaker-again-but-cannot-atone')
        aura=rows['dmg2014:subclass-feature:oathbreaker-7-aura-of-hate']['mechanics']['effect']
        self.assertFalse(aura['requiresFriendlyTarget'])
        control=rows['dmg2014:subclass-feature:oathbreaker-3-control-undead']['mechanics']['effect']
        self.assertEqual(control['immuneIf'],'challenge-rating>=own-paladin-level')
        result,_,mapping,_=merge_catalogs(self.catalogs,self.reference)
        for e in fs:
            match=next(m for m in mapping if m['referenceId']==e['id'])
            self.assertTrue(match['currentId'].startswith('dmg2014-'))
        self.assertEqual(validate(self.reference),[])

    def test_cleric_domains_grants_recovery_and_distinct_errata(self):
        old={e['id']:e for e in self.original['entities']};new={e['id']:e for e in self.reference['entities']}
        fs=[e for e in new.values() if e['kind']=='subclass-feature' and e['relations']['classId']=='phb2014:class:cleric' and e['sources'][0]['book']=='phb']
        self.assertEqual(len(fs),47);self.assertTrue(all(e['verification']['complete'] for e in fs))
        self.assertEqual(sum(len(e['mechanics']['effect']['grants']) for e in fs if e['name']=='Domain Spells'),70)
        self.assertEqual(new['phb2014:subclass-feature:life-8-divine-strike']['mechanics']['effect']['maximumUses'],'once-per-own-turn')
        self.assertEqual(new['phb2014:class-feature:cleric-10-divine-intervention']['mechanics']['effect']['recoveryIfSuccessDays'],7)
        self.assertEqual(old['phb2014:subclass-feature:war-17-avatar-of-battle']['mechanics']['effect']['condition'],'nonmagical-weapons')
        self.assertEqual(new['phb2014:subclass-feature:war-17-avatar-of-battle']['mechanics']['effect']['condition'],'nonmagical-attacks')
        self.assertFalse(new['phb2014:subclass-feature:light-1-bonus-cantrip']['mechanics']['effect']['countsAgainstKnownCantripLimit'])
        self.assertTrue(new['phb2014:subclass-feature:nature-1-acolyte-of-nature']['mechanics']['effect']['countsAsClericCantrip'])
        self.assertEqual(new['phb2014:spell:suggestion']['mechanics']['components'],['V','M'])
        merged,_,mapping,pending=merge_catalogs(self.catalogs,self.reference)
        self.assertEqual(sum(m['referenceId'] in {e['id'] for e in fs} for m in mapping),47)
        self.assertEqual(validate(self.reference),[])

    def test_sorcerer_metamagic_surge_table_and_errata(self):
        old={e['id']:e for e in self.original['entities']};new={e['id']:e for e in self.reference['entities']}
        choices=[e for e in new.values() if e['kind']=='class-option' and e['relations'].get('classId')=='phb2014:class:sorcerer']
        self.assertEqual(len(choices),18);self.assertEqual(sum(e['mechanics']['optionType']=='metamagic' for e in choices),8)
        font='phb2014:class-feature:sorcerer-2-font-of-magic'
        self.assertEqual(old[font]['mechanics']['effect']['flexibleCasting']['createdSlotsExpire'],'not-stated-in-local-printing')
        self.assertEqual(new[font]['mechanics']['effect']['flexibleCasting']['createdSlotsExpire'],'finish-long-rest')
        self.assertEqual(new[font]['mechanics']['effect']['flexibleCasting']['createSlotPointCostBySlotLevel'],{'1':2,'2':3,'3':5,'4':6,'5':7})
        self.assertTrue(new['phb2014:class-option:sorcerer-twinned-spell']['mechanics']['effect']['incapableOfMultipleCreatureTargetsAtCurrentLevel'])
        self.assertEqual(new['phb2014:subclass-feature:draconic-6-elemental-affinity']['mechanics']['effect']['numberOfDamageRolls'],1)
        surge=new['phb2014:subclass-feature:wild-magic-1-wild-magic-surge'];table=surge['mechanics']['effect']['table']
        self.assertEqual(len(table),50);self.assertEqual([r['minimumRoll'] for r in table],list(range(1,100,2)))
        self.assertEqual(table[3]['effect'],{'spellId':'phb2014:spell:fireball','castLevel':3,'center':'self'})
        self.assertEqual(table[49]['effect'],{'recover':'all-expended-sorcery-points'})
        self.assertFalse(surge['verification']['complete']);self.assertFalse(new['phb2014:subclass:wild-magic']['verification']['complete'])
        self.assertFalse(surge['mechanics']['effect']['surgeSpellConcentrationRequired'])
        self.assertFalse(surge['mechanics']['effect']['surgeSpellMetamagicEligible'])
        self.assertEqual(surge['mechanics']['effect']['maximumTriggerRollsPerTurn'],1)
        merged,_,_,pending=merge_catalogs(self.catalogs,self.reference)
        self.assertEqual(len(merged['verified-options-2014.json']['options']),124)
        self.assertTrue(any(e['referenceId']==surge['id'] and not e['completeReferenceRecord'] for e in pending))
        self.assertEqual(validate(self.reference),[])

    def test_equipment_chapter_capacities_checks_prices_and_null_weights(self):
        by_id={e['id']:e for e in self.reference['entities']}
        self.assertEqual(by_id['phb2014:gear:alchemist-s-fire-flask']['mechanics']['effect']['extinguish']['rollKind'],'ability-check')
        self.assertEqual(by_id['phb2014:gear:oil-flask']['mechanics']['effect']['ground']['maximumInstancesPerCreaturePerTurn'],1)
        self.assertEqual(by_id['phb2014:gear:waterskin']['mechanics']['capacity']['liquidPints'],4)
        self.assertEqual(by_id['phb2014:gear:clothes-fine']['mechanics']['weightLb'],6)
        self.assertEqual(by_id['phb2014:gear:backpack']['mechanics']['capacity']['maximumContentsLb'],30)
        self.assertEqual(by_id['phb2014:gear:mount-mastiff']['mechanics']['effect']['baseCarryingCapacityLb'],195)
        self.assertEqual(by_id['phb2014:gear:vehicle-rowboat']['mechanics']['weightLb'],100)
        self.assertEqual(by_id['phb2014:gear:service-coach-between-towns']['mechanics']['cost'],{'quantity':3,'unit':'cp'})
        self.assertTrue(by_id['phb2014:gear:lifestyle-aristocratic']['mechanics']['effect']['minimumPrice'])
        self.assertIsNone(by_id['phb2014:equipment-pack:priests-pack']['mechanics']['weightLb'])
        self.assertTrue(by_id['phb2014:equipment-pack:priests-pack']['verification']['complete'])
        merged,_,_,_=merge_catalogs(self.catalogs,self.reference)
        equipment=merged['verified-equipment-2014.json']['equipment']
        self.assertTrue(all(e['verification']['complete'] for e in equipment));self.assertEqual(sum(e['kind']=='equipment-pack' for e in equipment),7)
        self.assertEqual(validate(self.reference),[])

    def test_wizard_school_choices_spellbook_and_real_verification(self):
        old={e['id']:e for e in self.original['entities']};new={e['id']:e for e in self.reference['entities']}
        features=[e for e in new.values() if e['kind']=='subclass-feature' and e['relations']['classId']=='phb2014:class:wizard']
        self.assertEqual(len(features),40)
        self.assertEqual(sum(e['verification']['complete'] for e in features),39)
        self.assertFalse(new['phb2014:subclass:wizard-transmutation']['verification']['complete'])
        self.assertTrue(new['phb2014:subclass:evocation']['verification']['complete'])
        self.assertEqual(new['phb2014:class-feature:wizard-1-spellcasting']['mechanics']['effect']['copySpell']['eligibility'],'spell-level-you-can-prepare')
        self.assertEqual(old['phb2014:class-feature:wizard-1-spellcasting']['mechanics']['effect']['copySpell']['eligibility'],'level-for-which-you-have-spell-slots')
        self.assertEqual(old['phb2014:subclass-feature:evocation-14-overchannel']['mechanics']['effect']['minimumSpellLevel'],0)
        self.assertEqual(new['phb2014:subclass-feature:evocation-14-overchannel']['mechanics']['effect']['minimumSpellLevel'],1)
        self.assertEqual(new['phb2014:subclass-feature:evocation-10-empowered-evocation']['mechanics']['effect']['numberOfDamageRolls'],1)
        self.assertEqual(len(old['phb2014:subclass-feature:wizard-conjuration-2-minor-conjuration']['mechanics']['effect']['endsEarlyWhen']),2)
        self.assertEqual(len(new['phb2014:subclass-feature:wizard-conjuration-2-minor-conjuration']['mechanics']['effect']['endsEarlyWhen']),3)
        choices=[e for e in new.values() if e['kind']=='class-option' and e['mechanics']['optionType']=='wizard-choice']
        self.assertEqual(len(choices),12)
        self.assertEqual(sum(e['mechanics']['selectionOrigins'][0]['minimumClassLevel']==6 for e in choices),8)
        self.assertFalse(new['phb2014:spell:polymorph']['mechanics']['effect']['targetAtZeroHPAllowed'])
        self.assertFalse(new['phb2014:spell:raise-dead']['mechanics']['effect']['restoresMissingParts'])
        self.assertEqual(new['phb2014:spell:animate-dead']['sources'][0]['pdfPages'],[213,214])
        merged,_,mapping,pending=merge_catalogs(self.catalogs,self.reference)
        self.assertEqual(sum(e['mechanics']['optionType']=='wizard-choice' for e in merged['verified-options-2014.json']['options']),12)
        self.assertEqual(len([m for m in mapping if m['referenceId'] in {e['id'] for e in features}]),35)
        self.assertTrue(any(e['referenceId']=='phb2014:subclass-feature:wizard-transmutation-14-master-transmuter' for e in pending))
        self.assertEqual(validate(self.reference),[])

    def test_monk_disciplines_spell_dependencies_and_editorial_changes(self):
        old={e['id']:e for e in self.original['entities']};new={e['id']:e for e in self.reference['entities']}
        options=[e for e in new.values() if e['kind']=='class-option' and e['mechanics']['optionType']=='monk-discipline']
        self.assertEqual(len(options),17)
        self.assertTrue(all(e['verification']['complete'] for e in options))
        self.assertEqual(sum('spellId' in e['mechanics']['effect'] for e in options),12)
        mountain='phb2014:class-option:monk-eternal-mountain-defense'
        self.assertEqual(old[mountain]['mechanics']['minimumMonkLevel'],11)
        self.assertEqual(new[mountain]['mechanics']['minimumMonkLevel'],17)
        self.assertEqual(new[mountain]['mechanics']['selectionOrigins'][0]['minimumClassLevel'],17)
        whip='phb2014:class-option:monk-water-whip'
        self.assertEqual(old[whip]['mechanics']['effect']['activation'],'bonus-action')
        self.assertEqual(new[whip]['mechanics']['effect']['activation'],'action')
        self.assertFalse(new[whip]['mechanics']['effect']['isSpell'])
        self.assertEqual(new['phb2014:class-option:monk-elemental-attunement']['mechanics']['effect']['rangeFt'],30)
        deflect=new['phb2014:class-feature:monk-3-deflect-missiles']
        self.assertTrue(deflect['verification']['complete'])
        self.assertIsNone(old[deflect['id']]['mechanics']['effect']['returnAttack']['explicitRangeFt'])
        self.assertEqual(deflect['mechanics']['effect']['returnAttack']['explicitRangeFt'],{'normal':20,'long':60})
        self.assertTrue(any(c['entityId']==deflect['id'] for c in self.reference['supportingPrintingLog']))
        self.assertFalse(any(c['entityId']==deflect['id'] and c['field'].endswith('explicitRangeFt') for c in self.reference['editorialChangeLog']))
        self.assertTrue(deflect['mechanics']['effect']['returnAttack']['countsAsMonkWeapon'])
        self.assertEqual(len(old['phb2014:spell:sanctuary']['mechanics']['effect']['endsEarlyWhen']),2)
        self.assertEqual(len(new['phb2014:spell:sanctuary']['mechanics']['effect']['endsEarlyWhen']),3)
        astral=new['phb2014:spell:astral-projection']['mechanics']
        self.assertEqual(astral['casting'],{'quantity':1,'unit':'hour'})
        self.assertTrue(astral['effect']['materialCostPerCreature'])
        self.assertEqual(astral['effect']['maximumWillingCompanions'],8)
        self.assertTrue(new['phb2014:spell:stoneskin']['mechanics']['materialConsumed'])
        features=[e for e in new.values() if e['kind']=='subclass-feature' and e['relations']['classId']=='phb2014:class:monk']
        self.assertEqual(len(features),12)
        merged,_,mapping,_=merge_catalogs(self.catalogs,self.reference)
        self.assertEqual(sum(e['mechanics']['optionType']=='monk-discipline' for e in merged['verified-options-2014.json']['options']),17)
        self.assertEqual(len([m for m in mapping if m['referenceId'] in {e['id'] for e in features}]),12)
        self.assertEqual(validate(self.reference),[])

    def test_ranger_choices_progression_and_companion_errata(self):
        old={e['id']:e for e in self.original['entities']};new={e['id']:e for e in self.reference['entities']}
        options=[e for e in new.values() if e['kind']=='class-option' and e['mechanics']['optionType']=='hunter-choice']
        self.assertEqual(len(options),11)
        self.assertEqual([sum(e['mechanics']['tier']==n for e in options) for n in [3,7,11,15]],[3,3,2,3])
        for e in options:
            self.assertTrue(e['verification']['complete']);self.assertEqual(e['mechanics']['prerequisites'],{})
            self.assertTrue(new[e['mechanics']['selectionOrigins'][0]['originId']]['verification']['complete'])
        self.assertEqual(new['phb2014:class-option:hunter-colossus-slayer']['mechanics']['effect']['maximumUses'],'once-per-turn')
        self.assertEqual(new['phb2014:class-option:hunter-horde-breaker']['mechanics']['effect']['maximumUses'],'once-per-own-turn')
        companion='phb2014:subclass-feature:beast-master-3-ranger-s-companion'
        self.assertEqual(old[companion]['mechanics']['effect']['uncommandedAction'],'none')
        self.assertEqual(new[companion]['mechanics']['effect']['uncommandedAction'],'Dodge')
        self.assertIn('Dodge',old[companion]['mechanics']['effect']['actionCommand'])
        self.assertNotIn('Dodge',new[companion]['mechanics']['effect']['actionCommand'])
        self.assertFalse(new[companion]['mechanics']['effect']['reactionNeedsCommand'])
        training='phb2014:subclass-feature:beast-master-7-exceptional-training'
        self.assertFalse(old[training]['mechanics']['effect']['attacksMagicalForNonmagicalResistanceOrImmunity'])
        self.assertTrue(new[training]['mechanics']['effect']['attacksMagicalForNonmagicalResistanceOrImmunity'])
        self.assertTrue(new['phb2014:subclass-feature:beast-master-11-bestial-fury']['mechanics']['effect']['mayChoosePrintedMultiattackInstead'])
        rows=new['phb2014:class-feature:ranger-2-spellcasting']['mechanics']['effect']['progression']
        self.assertEqual([r['spellsKnown'] for r in rows],[0,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11])
        self.assertEqual(rows[18]['spellSlots'],[4,3,3,3,2,0,0,0,0])
        features=[e for e in new.values() if e['kind']=='subclass-feature' and e['relations']['classId']=='phb2014:class:ranger']
        self.assertEqual(len(features),8)
        merged,_,mapping,_=merge_catalogs(self.catalogs,self.reference)
        self.assertEqual(sum(e['mechanics']['optionType']=='hunter-choice' for e in merged['verified-options-2014.json']['options']),11)
        self.assertEqual(len([m for m in mapping if m['referenceId'] in {e['id'] for e in features}]),8)
        self.assertEqual(validate(self.reference),[])
        self.assertTrue(old['phb2014:subrace:dark-elf']['mechanics']['requiresDMApprovalInWorld'])
        self.assertNotIn('requiresDMApprovalInWorld',new['phb2014:subrace:dark-elf']['mechanics'])

    def test_background_tables_racial_spells_and_verified_enrichment(self):
        by_id={e['id']:e for e in self.reference['entities']}
        backgrounds=[e for e in by_id.values() if e['kind']=='background']
        self.assertEqual(len(backgrounds),13)
        self.assertEqual(sum(len(t['entries']) for e in backgrounds for t in e['mechanics']['personalityTables'].values()),338)
        self.assertEqual(sum(len(e['mechanics'].get('specialtyChoice',{}).get('entries',[])) for e in backgrounds),88)
        for e in backgrounds:
            self.assertTrue(e['verification']['complete'])
            self.assertTrue(e['mechanics']['feature']['effect'])
            self.assertFalse(e['mechanics']['personalitySelection']['alignmentRestricted'])
            for table in e['mechanics']['personalityTables'].values():
                self.assertEqual([r['roll'] for r in table['entries']],list(range(1,int(table['die'][1:])+1)))
        for index in ['guild-artisan','urchin']:
            self.assertIsNone(by_id['phb2014:background:'+index]['mechanics']['personalityTables']['ideals']['entries'][5]['suggestedAlignmentAspect'])
        self.assertEqual(by_id['phb2014:background:noble']['mechanics']['alternateFeature']['effect']['retainers'],3)
        self.assertEqual(by_id['phb2014:background-variant:knight']['mechanics']['commonerRetainers'],2)
        self.assertEqual(by_id['phb2014:background:outlander']['mechanics']['feature']['effect']['findFoodAndFreshWater']['peopleIncludingSelf'],6)
        for index in ['dancing-lights','darkness','hellish-rebuke','minor-illusion','thaumaturgy']:
            self.assertTrue(by_id['phb2014:spell:'+index]['verification']['complete'])
        self.assertEqual(by_id['phb2014:spell:heroism']['sources'][0]['pdfPages'],[251,252])
        self.assertEqual(by_id['phb2014:spell:hellish-rebuke']['mechanics']['effect']['damage'],'2d10')
        self.assertFalse(by_id['phb2014:spell:daylight']['mechanics']['concentration'])
        merged,changes,_,_=merge_catalogs(self.catalogs,self.reference)
        for array,index in [('backgrounds','acolyte'),('spells','hellish-rebuke')]:
            row=next(e for e in merged['character-options.json'][array] if e['index']==index)
            self.assertIn('verifiedRules2014',row)
            before=next(e for e in self.catalogs['character-options.json'][array] if e['index']==index)
            self.assertEqual({k:v for k,v in row.items() if k!='verifiedRules2014'},before)
        self.assertFalse(any(c.get('referenceId')=='phb2014:spell:magic-missile' and c['operation']=='enrich' for c in changes))

    def test_bard_rendered_progression_choices_and_rest_erratum(self):
        old={e['id']:e for e in self.original['entities']};new={e['id']:e for e in self.reference['entities']}
        features=[e for e in new.values() if e['kind']=='subclass-feature' and e['relations']['classId']=='phb2014:class:bard']
        self.assertEqual(len(features),8)
        self.assertTrue(all(e['verification']['complete'] for e in features))
        p=new['phb2014:class-feature:bard-1-spellcasting']['mechanics']['effect']['progression']
        self.assertEqual(len(p),20)
        self.assertEqual([r['spellsKnown'] for r in p],[4,5,6,7,8,9,10,11,12,14,15,15,16,18,19,19,20,22,22,22])
        self.assertEqual(p[10]['spellSlots'],[4,3,3,3,2,1,0,0,0])
        self.assertEqual(p[19]['spellSlots'],[4,3,3,3,3,2,2,1,1])
        for level in [2,9,13,17]:
            eid=f'phb2014:class-feature:bard-{level}-song-of-rest'
            self.assertFalse(old[eid]['mechanics']['effect']['requiresSpendingHitDice'])
            self.assertTrue(new[eid]['mechanics']['effect']['requiresSpendingHitDice'])
            self.assertEqual(new[eid]['sources'][-1]['filename'],'PH-Errata.pdf')
        self.assertTrue(new['phb2014:class-feature:bard-10-magical-secrets']['mechanics']['effect']['countsAgainstBardSpellsKnown'])
        self.assertFalse(new['phb2014:subclass-feature:lore-6-additional-magical-secrets']['mechanics']['effect']['countsAgainstBardSpellsKnown'])
        self.assertEqual(old['phb2014:class-feature:bard-10-magical-secrets']['mechanics']['effect']['spellListScope'],'any-class')
        self.assertEqual(new['phb2014:class-feature:bard-10-magical-secrets']['mechanics']['effect']['spellListScope'],'any-classes')
        blink=new['phb2014:spell:blink']
        self.assertEqual(blink['mechanics']['level'],3)
        self.assertEqual(blink['extraction']['fieldStatus']['level'],'verified')
        self.assertEqual(blink['verification']['mechanics'],'verified-fields')
        self.assertTrue(blink['verification']['complete'])
        merged,_,mapping,_=merge_catalogs(self.catalogs,self.reference)
        self.assertEqual(len([m for m in mapping if m['referenceId'] in {e['id'] for e in features}]),8)
        self.assertEqual(validate(self.reference),[])

    def test_paladin_oath_grants_style_origins_and_smite_errata(self):
        old={e['id']:e for e in self.original['entities']};new={e['id']:e for e in self.reference['entities']}
        features=[e for e in new.values() if e['kind']=='subclass-feature' and e['relations']['classId']=='phb2014:class:paladin' and e['sources'][0]['book']=='phb']
        self.assertEqual(len(features),18)
        self.assertTrue(all(e['verification']['complete'] for e in features))
        for sub in ['devotion','ancients','vengeance']:
            grants=new[f'phb2014:subclass-feature:{sub}-3-oath-spells']['mechanics']['effect']['grants']
            self.assertEqual([g['paladinLevel'] for g in grants],[3,3,5,5,9,9,13,13,17,17])
            self.assertTrue(all(g['alwaysPrepared'] and not g['countsAgainstPreparedLimit'] for g in grants))
        for index in ['defense','dueling','great-weapon-fighting','protection']:
            self.assertTrue(any(o['originId']=='phb2014:class-feature:paladin-2-fighting-style' for o in new['phb2014:class-option:fighter-'+index]['mechanics']['selectionOrigins']))
        for index in ['archery','two-weapon-fighting']:
            self.assertFalse(any(o['classId']=='phb2014:class:paladin' for o in new['phb2014:class-option:fighter-'+index]['mechanics']['selectionOrigins']))
        eid='phb2014:class-feature:paladin-2-divine-smite'
        self.assertEqual(old[eid]['mechanics']['effect']['cost'],'one-paladin-spell-slot')
        self.assertEqual(new[eid]['mechanics']['effect']['cost'],'one-spell-slot')
        self.assertEqual(new[eid]['mechanics']['effect']['maximumDiceWithTypeBonus'],6)
        eid='phb2014:class-feature:paladin-11-improved-divine-smite'
        self.assertIn('statedStacksWithDivineSmite',old[eid]['mechanics']['effect'])
        self.assertNotIn('statedStacksWithDivineSmite',new[eid]['mechanics']['effect'])
        self.assertEqual(new[eid]['mechanics']['effect']['additionalDamage'],'1d8')
        ward=new['phb2014:subclass-feature:ancients-7-aura-of-warding']['mechanics']['effect']
        self.assertEqual(ward['resistanceTo'],'damage-from-spells')
        self.assertEqual(ward['consciousnessRequirement'],'not-stated')
        self.assertTrue(new['phb2014:subclass-feature:devotion-20-holy-nimbus']['mechanics']['effect']['sunlight'])
        self.assertTrue(new['phb2014:spell:protection-from-evil-and-good']['mechanics']['materialConsumed'])
        _,_,mapping,_=merge_catalogs(self.catalogs,self.reference)
        self.assertEqual(len([m for m in mapping if m['referenceId'] in {e['id'] for e in features}]),18)

    def test_input_is_not_mutated_and_regeneration_is_repeatable(self):
        before=copy.deepcopy(self.catalogs)
        a=merge_catalogs(self.catalogs,self.reference)
        self.assertEqual(a,merge_catalogs(self.catalogs,self.reference))
        self.assertEqual(self.catalogs,before)

    def test_all_twenty_invocation_counts_and_only_reviewed_corrections(self):
        merged,changes,_,_=merge_catalogs(self.catalogs,self.reference)
        levels=sorted((x for x in merged['character-options.json']['levels'] if x['class']['index']=='warlock' and not x.get('subclass')),key=lambda x:x['level'])
        self.assertEqual([x['class_specific']['invocations_known'] for x in levels],
                         [0,2,2,2,3,3,4,4,5,5,5,6,6,6,7,7,7,8,8,8])
        corrections=[c for c in changes if c['operation']=='correct' and c['catalog']=='character-options.json']
        self.assertEqual(len(corrections),5)
        self.assertEqual({c['field'] for c in corrections},{'class_specific.invocations_known','school'})
        self.assertTrue(all(c['sources'] for c in corrections))
        equipment_corrections=[c for c in changes if c['operation']=='correct' and c['catalog']=='character-equipment.json']
        self.assertTrue(all(c['field']=='weight' and c['sources'] for c in equipment_corrections))
        saddle=next((c for c in equipment_corrections if c['referenceId']=='phb2014:gear:tack-saddle-exotic'),None)
        if 'phb2014:gear:tack-saddle-exotic' in {e['id'] for e in self.reference['entities']}:
            self.assertEqual((saddle['before'],saddle['after']),(50,40))

    def test_bad_field_provenance_does_not_authorize_merge(self):
        bad=copy.deepcopy(self.reference)
        next(e for e in bad['entities'] if e['id']=='phb2014:class-level:warlock-4')['fieldSources'].pop('invocationsKnown')
        with self.assertRaisesRegex(ValueError,'Unverified'): merge_catalogs(self.catalogs,bad)

    def test_errata_keep_original_and_do_not_promote_ocr_description(self):
        before=copy.deepcopy(self.original)
        effective=corrected_reference(self.original,self.manifest)
        self.assertEqual(self.original,before)
        original=next(e for e in self.original['entities'] if e['id']=='phb2014:spell:revivify')
        changed=next(e for e in effective['entities'] if e['id']==original['id'])
        self.assertEqual(original['mechanics']['school'],'conjuration')
        self.assertEqual(changed['mechanics']['school'],'necromancy')
        candidate=copy.deepcopy(self.original)
        mass=next(e for e in candidate['entities'] if e['id']=='phb2014:spell:mass-heal')
        mass['mechanics']['effect']=None
        mass['verification'].update(mechanics='ocr-candidate',complete=False,missingFields=['effect'])
        mass=next(e for e in corrected_reference(candidate,self.manifest)['entities'] if e['id']==mass['id'])
        self.assertEqual(mass['mechanics']['school'],'evocation')
        self.assertEqual(mass['verification']['mechanics'],'ocr-candidate')
        self.assertFalse(mass['verification']['complete'])
        self.assertEqual(validate(effective),[])

    def test_choices_not_granted_and_legacy_ids_preserved(self):
        merged,_,_,_=merge_catalogs(self.catalogs,self.reference)
        options=merged['verified-options-2014.json']['options']
        self.assertEqual(len(options),124 if any(e['id']=='phb2014:class-option:sorcerer-quickened-spell' for e in self.reference['entities']) else 106 if any(e['id']=='phb2014:class-option:wizard-stone-speed' for e in self.reference['entities']) else 94 if any(e['id']=='phb2014:class-option:monk-water-whip' for e in self.reference['entities']) else 77 if any(e['id']=='phb2014:class-option:hunter-colossus-slayer' for e in self.reference['entities']) else 66 if any(e['id']=='phb2014:class-option:totem-3-bear' for e in self.reference['entities']) else 57 if any(e['id']=='phb2014:class-option:trip-attack' for e in self.reference['entities']) else 35)
        self.assertEqual(sum(e['mechanics']['optionType']=='eldritch-invocation' for e in options),32)
        normal=merged['character-options.json']['features']
        invocations=[e['index'] for e in options if e['mechanics']['optionType']=='eldritch-invocation']
        self.assertFalse(any(f['index'] in invocations for f in normal))
        self.assertTrue(all(f.get('parent') for f in normal if f['index'] in ['pact-of-the-chain','pact-of-the-blade','pact-of-the-tome']))
        for array in ['classes','races','subraces','backgrounds','subclasses','features','spells','levels']:
            old={x['index'] for x in self.catalogs['character-options.json'][array]}
            new={x['index'] for x in merged['character-options.json'][array]}
            self.assertTrue(old.issubset(new))
        for e in self.reference['entities']:
            if e['kind']=='subclass' and e['relations']['classId']=='phb2014:class:warlock':
                self.assertTrue(all(row['automaticallyKnown'] is False for row in e['mechanics']['expandedSpellChoices']))

    def test_audit_distinguishes_verified_addition_and_unknown_legacy(self):
        merged,changes,mapping,_=merge_catalogs(self.catalogs,self.reference)
        audit=audit_records(merged,changes,mapping,{})
        added=[r for r in audit if r['catalog']=='verified-options-2014.json']
        self.assertEqual(len(added),124 if any(e['id']=='phb2014:class-option:sorcerer-quickened-spell' for e in self.reference['entities']) else 106 if any(e['id']=='phb2014:class-option:wizard-stone-speed' for e in self.reference['entities']) else 94 if any(e['id']=='phb2014:class-option:monk-water-whip' for e in self.reference['entities']) else 77 if any(e['id']=='phb2014:class-option:hunter-colossus-slayer' for e in self.reference['entities']) else 66 if any(e['id']=='phb2014:class-option:totem-3-bear' for e in self.reference['entities']) else 57 if any(e['id']=='phb2014:class-option:trip-attack' for e in self.reference['entities']) else 35)
        self.assertTrue(all(r['operation']=='add' and r['origin']['type']=='verified-manual-reference' for r in added))
        legacy=next(r for r in audit if r['catalog']=='character-options.json' and r['array']=='classes')
        self.assertEqual(legacy['edition']['status'],'not-verified')
        self.assertEqual(legacy['verification'],'retained-existing-not-fully-reverified')

    def test_duplicate_legacy_identity_is_rejected(self):
        catalogs=copy.deepcopy(self.catalogs)
        catalogs['character-options.json']['classes'].append(copy.deepcopy(catalogs['character-options.json']['classes'][0]))
        with self.assertRaisesRegex(ValueError,'Duplicate'): audit_records(catalogs,[],[],{})

    def test_fighter_original_errata_dependencies_and_selection_origins(self):
        original=copy.deepcopy(self.original)
        if not any(e['id']=='phb2014:class-option:trip-attack' for e in original['entities']): apply_fighter_reviews(original['entities'])
        original_before=copy.deepcopy(original)
        corrected=corrected_reference(original,self.manifest)
        self.assertEqual(original,original_before)
        old={e['id']:e for e in original['entities']}; new={e['id']:e for e in corrected['entities']}
        for eid in ['phb2014:class-option:feinting-attack','phb2014:subclass:battle-master','phb2014:feat:martial-adept']:
            self.assertFalse(old[eid]['verification']['complete'])
            self.assertTrue(new[eid]['verification']['complete'])
        feint='phb2014:class-option:feinting-attack'
        self.assertIsNone(old[feint]['mechanics']['effect']['advantageExpires'])
        self.assertEqual(new[feint]['mechanics']['effect']['advantageExpires'],'end-of-own-current-turn')
        for e in new.values():
            if e['kind']=='class-option' and e['mechanics']['optionType']=='fighter-maneuver':
                self.assertEqual(e['mechanics']['prerequisites'],{})
                self.assertEqual(len(e['mechanics']['selectionOrigins']),2)
        ek='phb2014:subclass-feature:eldritch-knight-3-spellcasting'
        self.assertEqual(old[ek]['mechanics']['effect']['unrestrictedReplacementForSpellLearnedAtLevels'],[8,14,20])
        self.assertEqual(new[ek]['mechanics']['effect']['unrestrictedReplacementForSpellLearnedAtLevels'],[3,8,14,20])
        self.assertEqual([r['spellSlots'][3] for r in new[ek]['mechanics']['effect']['progression']],[0]*16+[1,1])
        self.assertEqual(validate(corrected),[])
        merged,_,mapping,_=merge_catalogs(self.catalogs,corrected)
        self.assertEqual(len(merged['verified-options-2014.json']['options']),124 if 'phb2014:class-option:sorcerer-quickened-spell' in new else 106 if 'phb2014:class-option:wizard-stone-speed' in new else 94 if 'phb2014:class-option:monk-water-whip' in new else 77 if 'phb2014:class-option:hunter-colossus-slayer' in new else 66 if 'phb2014:class-option:totem-3-bear' in new else 57)
        self.assertEqual(len([m for m in mapping if m['referenceId'].startswith('phb2014:subclass-feature:') and new[m['referenceId']]['relations']['classId']=='phb2014:class:fighter']),17)

    def test_incomplete_and_unsupported_options_never_merged(self):
        bad=copy.deepcopy(self.reference)
        e=copy.deepcopy(next(e for e in bad['entities'] if e['id']=='phb2014:class-option:armor-of-shadows'))
        e['id']='phb2014:class-option:draft';e['index']='draft';e['verification'].update(complete=False,missingFields=['effect'])
        bad['entities'].append(e)
        merged,_,_,pending=merge_catalogs(self.catalogs,bad)
        self.assertFalse(any(x['id']==e['id'] for x in merged['verified-options-2014.json']['options']))
        self.assertTrue(any(x['referenceId']==e['id'] for x in pending))
        e['verification'].update(complete=True,missingFields=[]);e['mechanics']['optionType']='unreviewed-new-type'
        merged,_,_,pending=merge_catalogs(self.catalogs,bad)
        self.assertFalse(any(x['id']==e['id'] for x in merged['verified-options-2014.json']['options']))

    def test_rogue_progression_and_original_erratum_separate(self):
        by_id={e['id']:e for e in self.original['entities']}
        at='phb2014:subclass-feature:arcane-trickster-3-spellcasting'
        if at not in by_id: self.skipTest('Rogue group not built yet.')
        rows=by_id[at]['mechanics']['effect']['progression']
        self.assertEqual([r['rogueLevel'] for r in rows],list(range(3,21)))
        self.assertEqual([r['spellSlots'][3] for r in rows],[0]*16+[1,1])
        self.assertEqual(by_id[at]['mechanics']['effect']['unrestrictedReplacementForSpellLearnedAtLevels'],[8,14,20])
        effective={e['id']:e for e in self.reference['entities']}
        self.assertEqual(effective[at]['mechanics']['effect']['unrestrictedReplacementForSpellLearnedAtLevels'],[3,8,14,20])
        self.assertEqual(effective['phb2014:spell:mage-hand']['mechanics']['effect']['maximumCarriedWeightLb'],10)
        self.assertEqual(len([e for e in effective.values() if e['kind']=='subclass-feature' and e['relations']['classId']=='phb2014:class:rogue']),15)

    def test_complete_candidate_integrity_and_runtime_unchanged(self):
        candidates=sorted((ROOT/'rules-database.local/2014').glob('candidate-*'),key=lambda p:p.stat().st_mtime)
        complete=[p for p in candidates if (p/'RELEASE.json').exists()]
        if not complete: self.skipTest('Build a candidate first.')
        candidate=complete[-1]
        release=verify_release(candidate)
        self.assertFalse(release['runtimeActivated'])
        for rel,expected in release['sourceCatalogSHA256'].items():
            self.assertEqual(digest((ROOT/rel).read_bytes()),expected)
        after=json.loads((candidate/'comparison-after.json').read_text(encoding='utf-8'))
        self.assertEqual([d for d in after['discrepancies'] if d.get('severity')=='error'],[])

    def test_creatures_original_errata_and_source_differences(self):
        old={e['id']:e for e in self.original['entities']};new={e['id']:e for e in self.reference['entities']}
        if 'mm2014:creature:bat' not in old:self.skipTest('Creature group not built yet.')
        for index,original,corrected in [('black-bear',3,4),('brown-bear',5,6)]:
            eid='mm2014:creature:'+index
            self.assertEqual([a['attackBonus'] for a in old[eid]['mechanics']['actions'] if 'attackBonus' in a],[original]*2)
            self.assertEqual([a['attackBonus'] for a in new[eid]['mechanics']['actions'] if 'attackBonus' in a],[corrected]*2)
            self.assertEqual(new[eid]['editorialCorrections'][0]['sources'][0]['book'],'mm-errata')
        merged,_,mapping,pending=merge_catalogs(self.catalogs,self.reference)
        expected=sum(e['kind']=='creature' and e['verification']['complete'] for e in new.values())
        if 'mm2014:creature:night-hag' in new:
            self.assertFalse(new['mm2014:creature:night-hag']['verification']['complete'])
            self.assertTrue(any(e['referenceId']=='mm2014:creature:night-hag' for e in pending))
        self.assertEqual(len(merged['verified-creatures-2014.json']['creatures']),expected)
        self.assertEqual(len([m for m in mapping if m['catalog']=='verified-creatures-2014.json']),expected)
        self.assertEqual(new['mm2014:creature:cat']['mechanics']['sensesFt'],{})
        self.assertEqual(new['mm2014:creature:owl']['sourceDifferences'][0]['otherValue'],['sight'])
        self.assertEqual(len(new['phb2014:spell:find-familiar']['relations']['normalFormIds']),15)
        if 'mm2014:creature:imp' in new:
            self.assertEqual(new['mm2014:creature:imp']['mechanics']['conditionalDamageResistances'][0]['condition'],'nonmagical-attacks-not-silvered')
            self.assertEqual(old['mm2014:creature:imp']['mechanics']['conditionalDamageResistances'][0]['condition'],'nonmagical-weapons-not-silvered')
            self.assertEqual(new['mm2014:creature:quasit']['mechanics']['actions'][0]['attackBonus'],4)
            self.assertTrue(new['mm2014:creature:pseudodragon']['optionalVariant']['notGrantedByPactOfTheChain'])
            self.assertEqual(len(new['phb2014:class-option:pact-of-the-chain']['relations']['specialFormIds']),4)
        bad=copy.deepcopy(self.reference)
        next(e for e in bad['entities'] if e['id']=='mm2014:creature:cat')['verification'].update(complete=False,missingFields=['actions'])
        merged,_,_,pending=merge_catalogs(self.catalogs,bad)
        self.assertEqual(len(merged['verified-creatures-2014.json']['creatures']),expected-1)
        self.assertTrue(any(p['referenceId']=='mm2014:creature:cat' for p in pending))

    def test_surge_creatures_and_spell_dependencies(self):
        old={e['id']:e for e in self.original['entities']};new={e['id']:e for e in self.reference['entities']}
        mono='mm2014:creature:monodrone'
        if mono not in new:self.skipTest('Surge creature group not built yet.')
        self.assertEqual(old[mono]['mechanics']['actions'][1]['attackBonus'],3)
        self.assertEqual(new[mono]['mechanics']['actions'][1]['attackBonus'],2)
        self.assertEqual(new[mono]['mechanics']['actions'][1]['damage'],{'average':3,'dice':'1d6','type':'piercing'})
        self.assertEqual(new['mm2014:creature:quadrone']['mechanics']['actions'][2]['target'],'one-creature')
        u=new['mm2014:creature:unicorn']['mechanics']
        self.assertEqual([a['effect']['legendaryActionCost'] for a in u['legendaryActions']],[1,2,3])
        self.assertEqual(u['legendaryActionEconomy']['maximum'],3)
        self.assertEqual(len(u['regionalEffects']),4)
        for dep in new['mm2014:creature:unicorn']['relations']['spellIds']:self.assertTrue(new[dep]['verification']['complete'])
        self.assertEqual(new['phb2014:subclass-feature:wild-magic-1-wild-magic-surge']['verification']['missingFields'],['spellDescription:phb2014:spell:magic-missile'])
        table=new['phb2014:spell:reincarnate']['mechanics']['effect']['formTable']
        self.assertEqual([n for row in table for n in range(row['minimum'],row['maximum']+1)],list(range(1,101)))
        self.assertFalse(new['phb2014:spell:grease']['mechanics']['concentration'])

    def test_progression_events_keep_subclass_choices_and_pending_dependencies(self):
        by_id={e['id']:e for e in self.reference['entities']}
        event=by_id['phb2014:class-feature:wizard-14-subclass-feature']
        if not event.get('progressionEvent'):self.skipTest('Progression links not rebuilt yet.')
        self.assertFalse(event['verification']['complete'])
        self.assertEqual(event['verification']['missingFields'],['concreteAlternativeEffects:phb2014:subclass-feature:wizard-transmutation-14-master-transmuter'])
        bard=by_id['phb2014:class-feature:bard-6-subclass-feature']
        self.assertTrue(bard['verification']['complete'])
        self.assertEqual(len(bard['mechanics']['effect']['grantFromSelectedSubclassOnly']),2)
        self.assertFalse(by_id['phb2014:class:wizard']['verification']['complete'])
        self.assertTrue(by_id['phb2014:class:monk']['verification']['complete'])
        self.assertFalse(next(e for e in self.original['entities'] if e['id']=='phb2014:class:monk')['verification']['complete'])
        self.assertTrue(by_id['phb2014:class-level:monk-3']['verification']['complete'])
        self.assertTrue(by_id['phb2014:class:fighter']['verification']['complete'])
        self.assertTrue(by_id['phb2014:class-level:fighter-7']['verification']['complete'])
        self.assertFalse(by_id['phb2014:class-level:wizard-14']['verification']['complete'])
        table=by_id['phb2014:rule:trinkets']['mechanics']['rows']
        self.assertEqual([r['roll'] for r in table],list(range(1,101)))
        self.assertEqual(table[36]['weightLb'],0)
        self.assertIsNone(table[99]['weightLb'])
        lucky=by_id['phb2014:feat:lucky']
        if 'advantageInteraction' in lucky['mechanics']:
            self.assertTrue(lucky['mechanics']['advantageInteraction']['advantageDisadvantageStillPresent'])
            self.assertFalse(lucky['mechanics']['advantageInteraction']['alternativeDMRulingAutomatic'])
            self.assertEqual(by_id['phb2014:rule:short-rest']['mechanics']['minimumHealingPerDie'],0)
            self.assertTrue(any(r['entityId']==lucky['id'] for r in self.reference['officialRulingLog']))

    def test_druid_tables_water_erratum_and_dependency_resolution(self):
        old={e['id']:e for e in self.original['entities']};new={e['id']:e for e in self.reference['entities']}
        water='mm2014:creature:water-elemental';moon='phb2014:subclass:moon';feature='phb2014:subclass-feature:moon-10-elemental-wild-shape'
        if water not in old:self.skipTest('Druid group not built yet.')
        self.assertIsNone(old[water]['mechanics']['actions'][2]['effect']['releaseOther']['rollKind'])
        for eid in [water,moon,feature]:
            self.assertFalse(old[eid]['verification']['complete'])
            self.assertTrue(new[eid]['verification']['complete'])
        self.assertEqual(new[water]['mechanics']['actions'][2]['effect']['releaseOther']['rollKind'],'ability-check')
        self.assertEqual(old[water]['mechanics']['conditionalDamageResistances'][0]['condition'],'nonmagical-weapons')
        self.assertEqual(new[water]['mechanics']['conditionalDamageResistances'][0]['condition'],'nonmagical-attacks')
        choices=new['phb2014:subclass-feature:land-2-circle-spells']['mechanics']['effect']['landChoices']
        self.assertEqual(len(choices),8);self.assertEqual(sum(map(len,choices.values())),64)
        self.assertEqual(new['phb2014:subclass-feature:moon-2-circle-forms']['mechanics']['effect']['maximumBeastCRByDruidLevel']['20'],6)
        merged,_,mapping,_=merge_catalogs(self.catalogs,self.reference)
        self.assertEqual(len([m for m in mapping if m['referenceId'].startswith('phb2014:subclass-feature:') and new[m['referenceId']]['relations']['classId']=='phb2014:class:druid']),11)
        self.assertEqual(validate(self.reference),[])

    def test_race_printing_lore_choices_and_partial_trance(self):
        old={e['id']:e for e in self.original['entities']};new={e['id']:e for e in self.reference['entities']}
        if 'age' not in old['phb2014:race:dwarf']['mechanics']:self.skipTest('Race review not built yet.')
        races=[e for e in new.values() if e['kind']=='race' and e['sources'][0]['book']=='phb']
        self.assertEqual(len(races),9)
        self.assertTrue(all('alignmentDescription' not in e['mechanics'] for e in races))
        self.assertTrue(all('alignmentDescription' in e['mechanics'] for e in old.values() if e['kind']=='race' and e['sources'][0]['book']=='phb'))
        self.assertFalse(old['phb2014:race:elf']['verification']['complete'])
        self.assertTrue(new['phb2014:race:elf']['verification']['complete'])
        self.assertEqual(new['phb2014:race:elf']['mechanics']['traits'][2]['mechanics']['longRestDurationInterpretation']['hours'],4)
        self.assertEqual(self.reference['officialRulingLog'][0]['sources'][0]['book'],'sac-rulings')
        self.assertFalse(any(c['field']=='traits.trance.longRestDurationInterpretation' for c in self.reference['editorialChangeLog']))
        self.assertEqual(old['phb2014:race:dwarf']['mechanics']['traits'][1]['mechanics']['sourceWeaponNames'][2],'throwing hammer')
        self.assertEqual(new['phb2014:race:dwarf']['mechanics']['traits'][1]['mechanics']['sourceWeaponNames'][2],'light hammer')
        self.assertEqual(new['phb2014:race:dragonborn']['mechanics']['traits'][0]['mechanics']['choices'][6]['saveAbility'],'constitution')
        self.assertEqual(new['phb2014:subrace:rock-gnome']['mechanics']['tinker']['dismantleActivation'],'action')
        self.assertEqual(new['phb2014:race:tiefling']['relations']['grantedSpellIds'],[
            'phb2014:spell:thaumaturgy','phb2014:spell:hellish-rebuke','phb2014:spell:darkness'])
        merged,changes,mapping,_=merge_catalogs(self.catalogs,self.reference)
        self.assertTrue(any(c['referenceId']=='phb2014:race:dwarf' and c['operation']=='enrich' for c in changes))
        self.assertTrue(any(c['referenceId']=='phb2014:race:elf' and c['operation']=='enrich' for c in changes))
        for m in mapping:
            if m['referenceId']=='phb2014:race:dwarf':self.assertEqual(m['currentId'],'dwarf')


if __name__=='__main__': unittest.main()
