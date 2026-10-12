import copy
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
import hashlib
from contextlib import closing

from build import build_entities, load_reviews, sqlite_export
from compare import compare, match, snapshot
from curated import source, record, weapons
from core_rules import conditions, progressions
from pdf_sources import ROOT, WORK, load_pages
from reference_math import ability_modifier, concentration_dc, multiclass_slots
from spell_extract import extract_spells
from validate import validate


class RulesMathTests(unittest.TestCase):
    def test_dungeon_hazards_and_optional_consumables_remain_distinct(self):
        from hazard_reviews import dungeon_hazards
        from adjudication_reviews import consumable_variants,encounter_rules
        hazards={e['index']:e['mechanics'] for e in dungeon_hazards()}
        self.assertTrue(hazards['brown-mold']['fireImmune'])
        self.assertEqual(hazards['green-slime']['woodMetalDamagePerRound']['dice'],'2d10')
        self.assertEqual(hazards['green-slime']['avoidDrop']['dc'],10)
        self.assertEqual(hazards['dungeon-webs']['per10FtCube']['HP'],15)
        for e,sides in zip(consumable_variants(),[100,6],strict=True):
            self.assertEqual([i for r in e['mechanics']['rows'] for i in range(r['low'],r['high']+1)],list(range(1,sides+1)))
            self.assertTrue(e['optional']);self.assertTrue(e['mechanics']['requiresDMApproval'])
        encounters=encounter_rules()
        self.assertEqual(encounters[0]['mechanics']['thresholds'][2],{'level':3,'easy':75,'medium':150,'hard':225,'deadly':400})
        self.assertFalse(encounters[0]['mechanics']['adjustedXPIsAwardedXP'])
        self.assertEqual(encounters[1]['mechanics']['dailyAdjustedXP'][-1]['adjustedXP'],40000)

    def test_spell_points_and_campaign_boundaries(self):
        from adjudication_reviews import campaign_rules
        rules={e['index']:e for e in campaign_rules()}
        m=rules['spell-points']['mechanics']
        self.assertEqual(m['slotCosts'],[2,3,5,6,7,9,10,11,13])
        self.assertEqual(len(m['levels']),20)
        self.assertEqual(m['levels'][16],{'level':17,'points':107,'maximumSlotLevel':9})
        self.assertFalse(m['pactMagicReplaced'])
        self.assertEqual(rules['renown']['mechanics']['sampleRankThresholds'],[1,3,10,25,50])
        self.assertEqual(rules['npc-loyalty']['mechanics']['tenuousRangeAsPrinted'],[1,10])
        self.assertEqual(rules['automatic-check-success']['mechanics']['excluded'],['contests','saving-throws','attack-rolls'])

    def test_planar_tables_and_specific_exceptions(self):
        from planar_reviews import planar_rules
        rules={e['index']:e for e in planar_rules()}
        for index,key,sides in [('astral-color-pools','rows',20),('ether-cyclone','rows',20),('feywild-time','rows',20),('shadowfell-despair','rows',6),('abyss-corruption','rows',10)]:
            self.assertEqual([i for r in rules[index]['mechanics'][key] for i in range(r['low'],r['high']+1)],list(range(1,sides+1)))
        self.assertEqual(rules['ether-cyclone']['mechanics']['rows'][0]['eachCheck'],{'ability':'charisma','dc':15})
        self.assertNotIn('eachSave',rules['ether-cyclone']['mechanics']['rows'][0])
        self.assertEqual(rules['beastlands-transformation']['mechanics']['retains'],['intelligence','ability-to-speak'])
        self.assertEqual(rules['mechanus-order']['mechanics']['deadlineStatus'],'not-stated')
        self.assertEqual(rules['ysgard-wrath']['mechanics']['trigger'],'killed-by-attack-or-spell-on-plane')
        self.assertFalse(rules['psychic-wind']['verification']['complete'])
        self.assertEqual(len(rules['outlands-gate-towns']['mechanics']['towns']),16)
        self.assertEqual(rules['larva']['mechanics']['hitPoints']['dice'],'2d8')

    def test_dmg_adjudication_tables_and_object_threshold_semantics(self):
        from adjudication_reviews import adjudication_rules
        rules={e['index']:e for e in adjudication_rules()}
        self.assertEqual(rules['chases']['id'],'dmg2014:rule:chases')
        self.assertEqual(rules['chases']['sources'][0]['book'],'dmg')
        self.assertTrue(rules['chases']['optional'])
        chase=rules['chases']['mechanics']
        self.assertEqual(chase['additionalDash']['checkAbility'],'constitution')
        for rows in chase['complications']['tables'].values():
            self.assertEqual([i for r in rows for i in range(r['low'],r['high']+1)],list(range(1,21)))
        self.assertEqual(chase['complications']['affects'],'next-participant-in-initiative')
        obj=rules['object-statistics']['mechanics']
        self.assertEqual(obj['suggestedACByMaterial']['adamantine'],23)
        self.assertEqual(obj['suggestedHPBySize']['Large']['resilient'],{'average':27,'dice':'5d10'})
        self.assertEqual(obj['damageThreshold']['atOrAboveThreshold'],'normal-damage-not-minus-threshold')
        self.assertEqual(len([r for r in rules.values() if r['mechanics'].get('ruleType')=='siege-equipment']),7)
        self.assertEqual(rules['siege-trebuchet']['mechanics']['effect']['cannotTargetWithinFt'],60)
        self.assertEqual(rules['siege-ram']['mechanics']['effect']['target'],'one-object')
        self.assertEqual(rules['siege-suspended-cauldron']['mechanics']['effect']['successDamage'],'half')
        self.assertFalse(rules['combining-game-effects']['optional'])

    def test_appendix_tables_preserve_settings_and_printing_differences(self):
        from appendix_reviews import appendices
        rows={e['index']:e for e in appendices()}
        pantheons=[e for e in rows.values() if e['mechanics']['ruleType']=='pantheon-catalog']
        self.assertEqual([len(e['mechanics']['entries']) for e in pantheons],[37,25,21,21,24,14,19,14,20])
        for e in pantheons:
            self.assertTrue(e['mechanics']['domainsAreSuggestions'])
            self.assertEqual(len({r['index'] for r in e['mechanics']['entries']}),len(e['mechanics']['entries']))
        fr={e['name']:e for e in rows['pantheon-forgotten-realms']['mechanics']['entries']}
        self.assertEqual(fr['Kelemvor']['alignment'],'LN')
        dl={e['name']:e for e in rows['pantheon-dragonlance']['mechanics']['entries']}
        self.assertFalse(dl['Solinari']['clericsSupportedInTable']);self.assertEqual(dl['Solinari']['suggestedDomains'],[])
        self.assertEqual(len(rows['planes-of-existence']['mechanics']['outerPlanes']),16)
        appendix=rows['phb-creature-appendix']['mechanics']
        self.assertEqual(len(appendix['entries']),31);self.assertFalse(appendix['automaticallyOverridesMM'])
        owl=next(r for r in appendix['entries'] if r['creatureId'].endswith(':owl'))
        self.assertEqual(owl['phbSpecificDifferences']['trait']['usingSenses'],['sight'])

    def test_dependency_completion_propagates_independently_of_record_order(self):
        from relations import progression_status
        a=record('rule','a','A','A',1);b=record('rule','b','B','B',1);c=record('rule','c','C','C',1,missing=['unread-field'])
        a['relations']={'dependencyIds':[b['id']]};b['relations']={'dependencyIds':[c['id']]}
        progression_status([a,b,c])
        self.assertFalse(a['verification']['complete']);self.assertFalse(b['verification']['complete'])
        c['verification'].update(complete=True,missingFields=[])
        progression_status([b,a,c])
        self.assertTrue(a['verification']['complete']);self.assertTrue(b['verification']['complete'])
        b['verification']['mechanics']='ocr-candidate'
        progression_status([a,b,c])
        self.assertFalse(a['verification']['complete']);self.assertFalse(b['verification']['complete'])

    def test_treasure_tables_partition_variants_and_coin_rounding(self):
        from treasure_reviews import treasure_rules
        tables=treasure_rules();by={e['index']:e for e in tables}
        self.assertEqual(len(tables),29)
        for e in tables:
            if e['mechanics']['ruleType']!='treasure-table':continue
            rows=e['mechanics']['rows'];die=e['mechanics']['die']
            self.assertEqual([r for row in rows for r in range(row['low'],row['high']+1)],list(range(1,die+1)))
        individual=by['individual-treasure-5-10']['mechanics']['rows'][0]['effect']['coins']
        self.assertEqual(individual['ep'],{'dice':'1d6','multiplier':10,'average':35})
        hoard=by['treasure-hoard-11-16']['mechanics']['rows']
        self.assertEqual([(r['low'],r['high']) for r in hoard[:5]],[(1,3),(4,6),(7,9),(10,12),(13,15)])
        self.assertEqual([r['tableId'] for r in hoard[5]['effect']['magicItemRolls']],['dmg2014:rule:magic-item-table-a','dmg2014:rule:magic-item-table-b'])
        g=by['magic-item-table-g']['mechanics']['rows'][1]['effect']['furtherRoll']
        self.assertEqual(g['die'],8);self.assertEqual((g['rows'][5]['low'],g['rows'][5]['high']),(6,7))
        i=by['magic-item-table-i']['mechanics']['rows']
        self.assertEqual(next(r for r in i if r['low']==66)['effect']['variantIndex'],'armor-1')
        self.assertEqual(next(r for r in i if r['low']==76)['effect']['furtherRoll']['die'],12)
        # Full-reference validation tests cover all dependencies, including armor.
        self.assertIn('dmg2014:magic-item:wand-of-magic-missiles',by['magic-item-table-f']['relations']['dependencyIds'])

    def test_mephit_death_breath_and_optional_summoning_differences(self):
        from creature_reviews import mephit_records
        forms={e['index']:e for e in mephit_records()}
        self.assertEqual(len(forms),6)
        def burst(index):return next(t['effect'] for t in forms[index]['mechanics']['traits'] if t['index']=='death-burst')
        self.assertEqual(burst('steam-mephit')['successDamage'],'none')
        self.assertEqual(burst('ice-mephit')['successDamage'],'half')
        self.assertEqual(burst('dust-mephit')['repeatSaveWhen'],'on-each-own-turn-not-specified-as-start-or-end')
        self.assertEqual(forms['dust-mephit']['mechanics']['actions'][1]['effect']['repeatSaveWhen'],'end-of-each-own-turn')
        self.assertEqual(burst('mud-mephit')['maximumTargetSize'],'Medium')
        self.assertEqual(burst('smoke-mephit')['area'],'heavily-obscured')
        for e in forms.values():
            self.assertTrue(e['verification']['complete'])
            v=e['mechanics']['optionalVariants'][0]
            self.assertTrue(v['requiresDMApproval']);self.assertEqual(v['effect']['addsAction']['successChancePercent'],25)
            self.assertTrue(v['effect']['addsAction']['summonedByThisActionCannotSummon'])
            self.assertNotIn('air',e['mechanics']['traits'][0]['effect']['doesNotRequire'])

    def test_minor_elemental_shield_adamantine_and_burning(self):
        from creature_reviews import minor_elemental_records
        forms={e['index']:e for e in minor_elemental_records()}
        self.assertEqual(len(forms),3)
        self.assertEqual(forms['azer']['mechanics']['armorClass'],{'value':17,'source':'natural-armor','shieldIncluded':True})
        self.assertEqual(forms['gargoyle']['mechanics']['conditionalDamageResistances'][0]['condition'],'nonmagical-weapons-not-adamantine')
        magmin=forms['magmin']['mechanics']['actions'][0]['effect']['ongoingBurn']
        self.assertEqual(magmin['damageSubjectInLocalPrinting'],'creature')
        self.assertEqual(magmin['when'],'end-of-each-target-turn')
        self.assertEqual(magmin['ends'],'any-creature-action-douse-fire')

    def test_couatl_shape_components_and_pegasus_speech(self):
        from creature_reviews import celestial_records
        forms={e['index']:e for e in celestial_records()}
        m=forms['couatl']['mechanics']
        innate=m['traits'][0]['effect']
        self.assertTrue(innate['verbalComponentsRequired']);self.assertFalse(innate['somaticComponentsRequired']);self.assertFalse(innate['materialComponentsRequired'])
        self.assertEqual((len(innate['atWillSpellIds']),len(innate['threePerDayEachSpellIds']),len(innate['oncePerDayEachSpellIds'])),(3,7,3))
        self.assertEqual(m['actions'][0]['attackBonus'],8)
        self.assertEqual(m['actions'][1]['reachFt'],10)
        shape=m['actions'][2]['effect']
        self.assertNotIn('hit-points',shape['replacedStatistics'])
        self.assertIn('class-features',shape['excludedNewFormCapabilities'])
        self.assertTrue(forms['pegasus']['mechanics']['cannotSpeak'])
        self.assertEqual(forms['pegasus']['mechanics']['languages'],['celestial','common','elvish','sylvan'])

    def test_woodland_movement_dust_and_pipes_are_distinct(self):
        from creature_reviews import woodland_records
        forms={e['index']:e for e in woodland_records()}
        blink=forms['blink-dog']['mechanics']
        self.assertEqual(blink['languages'],['blink-dog']);self.assertEqual(blink['understandsAdditionalLanguages'],['sylvan'])
        self.assertEqual(blink['actions'][1]['effect']['optionalAdditionalAttack']['count'],1)
        tree=next(t['effect'] for t in forms['dryad']['mechanics']['traits'] if t['index']=='tree-stride')
        self.assertEqual(tree['movementCostFt'],10);self.assertEqual(tree['activation'],'part-of-movement-not-action-or-bonus-action')
        pixie=next(t['effect'] for t in forms['pixie']['mechanics']['traits'] if t['index']=='innate-spellcasting')
        self.assertTrue(pixie['materialComponentsRequired']);self.assertFalse(pixie['verbalComponentsRequired'])
        self.assertEqual(forms['pixie']['mechanics']['actions'][0]['activation'],'action')
        pipes=forms['satyr']['mechanics']['optionalVariants'][0]['effect']['addsAction']
        self.assertEqual(pipes['unaffected'],['other-satyrs','creatures-that-cannot-be-charmed'])
        self.assertEqual(len(pipes['choice']),3)

    def test_faerie_age_types_and_hag_coven_shared_pool(self):
        from creature_reviews import faerie_dragon_records,hag_records,hag_rules
        dragons=faerie_dragon_records()
        self.assertEqual(len(dragons),7)
        self.assertEqual([e['mechanics']['challengeRating'] for e in dragons],[1,1,1,2,2,2,2])
        self.assertTrue(all(e['mechanics']['type']=='dragon' for e in dragons))
        self.assertEqual([len(e['mechanics']['traits'][3]['effect']['oncePerDayEachSpellIds']) for e in dragons],[3,4,5,6,7,8,9])
        hags={e['index']:e for e in hag_records()}
        self.assertEqual(hags['night-hag']['mechanics']['type'],'fiend')
        self.assertEqual(hags['night-hag']['mechanics']['traits'][0]['effect']['spellSaveDC'],13)
        self.assertEqual(hags['night-hag']['mechanics']['actions'][0]['attackBonus'],6)
        self.assertIn('phb2014:spell:magic-missile',hags['night-hag']['relations']['dependencyIds'])
        sea=hags['sea-hag']['mechanics']['actions'][2]['effect']
        self.assertEqual(sea['target'],'one-frightened-creature-not-necessarily-by-this-hag')
        coven,items=hag_rules()
        self.assertFalse(coven['verification']['complete'])
        self.assertEqual(coven['mechanics']['sharedSpellcasting']['sharedSlots'],[4,3,3,3,2,1,0,0,0])
        self.assertEqual(sum(len(r['spellIds']) for r in coven['mechanics']['sharedSpellcasting']['spellLevels']),12)
        self.assertEqual(items['mechanics']['items'][1]['capacityEvilSouls'],1)

    def test_higher_elementals_rolling_boulders_water_and_salamander_tail(self):
        from creature_reviews import higher_elemental_records
        forms={e['index']:e for e in higher_elemental_records()}
        self.assertEqual(len(forms),5)
        galeb=forms['galeb-duhr']['mechanics']
        animate=galeb['actions'][1]['effect']
        self.assertTrue(animate['concentrationRequired']);self.assertEqual(animate['maximumDurationMinutes'],1)
        self.assertEqual(animate['overrides']['removeActionIndices'],['animate-boulders'])
        self.assertEqual(galeb['traits'][1]['effect']['downhillSpeedFt'],60)
        stalker=forms['invisible-stalker']['mechanics']
        self.assertEqual(stalker['understandsAdditionalLanguages'],['common'])
        self.assertFalse(stalker['traits'][0]['effect']['endsOnAttack'])
        self.assertEqual(forms['fire-snake']['mechanics']['actions'][2]['effect']['extraDamage']['dice'],'1d6')
        salamander=forms['salamander']['mechanics']
        self.assertEqual(salamander['actions'][2]['reachFt'],10)
        self.assertIn('tail-automatically-hits-this-target',salamander['actions'][2]['effect']['grapple']['whileGrappled'])
        water=forms['water-weird']['mechanics']
        self.assertEqual(water['speedFt'],{'walk':0,'swim':60})
        self.assertEqual(water['traits'][1]['effect']['diesWhenAny'],['leaves-bound-water','bound-water-destroyed'])
        self.assertEqual(water['actions'][0]['effect']['ifTargetMediumOrSmaller']['grapple']['pullFt'],5)

    def test_flask_fiends_have_distinct_spells_charm_wounds_and_genie_checks(self):
        from creature_reviews import flask_fiend_records,remaining_genie_records
        forms={e['index']:e for e in flask_fiend_records()}
        self.assertEqual(len(forms),5)
        cambion=forms['cambion']['mechanics'];self.assertEqual(cambion['alignment'],'any-evil')
        self.assertEqual(cambion['armorClass'],{'value':19,'source':'scale-mail'})
        self.assertEqual(cambion['actions'][3]['effect']['repeatSaveOptionalWhenAny'],['any-harm-by-any-creature','cambion-suicidal-command'])
        arca=forms['arcanaloth']['mechanics']
        innate=arca['traits'][0]['effect'];prepared=arca['traits'][4]['effect']
        self.assertEqual(innate['castingAbility'],'charisma');self.assertEqual(innate['spellSaveDC'],15)
        self.assertEqual(prepared['castingAbility'],'intelligence');self.assertEqual(prepared['spellSaveDC'],17)
        self.assertEqual(prepared['casterLevelInLocalPrinting'],16)
        nyca=forms['nycaloth']['mechanics']
        self.assertNotIn('spellSaveDC',nyca['traits'][0]['effect'])
        self.assertEqual(nyca['actions'][1]['effect']['ifTargetCreature']['failureOngoingWound']['when'],'start-of-each-target-turn')
        self.assertEqual(nyca['optionalVariants'][0]['effect']['addsAction']['attitude'],'acts-as-it-pleases')
        self.assertEqual(forms['ultroloth']['mechanics']['optionalVariants'][0]['effect']['addsAction']['attitude'],'ally-of-summoner')
        self.assertFalse(forms['ultroloth']['mechanics']['actions'][2]['effect']['effectEndsAloneGrantsImmunity'])
        genies={e['index']:e for e in remaining_genie_records()}
        dao=genies['dao']['mechanics']['actions'][2]['effect']['ifTargetCreatureHugeOrSmaller']
        self.assertFalse(dao['isSavingThrow']);self.assertEqual(dao['strengthCheckDC'],18)
        self.assertEqual(genies['marid']['mechanics']['actions'][2]['effect']['successDamage'],'half')
        self.assertFalse(genies['marid']['mechanics']['actions'][2]['effect']['successPushOrProne'])

    def test_angels_render_anomalies_gith_and_other_flask_creatures(self):
        from creature_reviews import angel_records,other_flask_records
        angels={e['index']:e for e in angel_records()}
        deva=angels['deva']['mechanics'];self.assertEqual(deva['skillBonuses']['insight'],7)
        self.assertFalse(deva['traits'][1]['effect']['somaticComponentsRequired'])
        shape=deva['actions'][3]['effect'];self.assertIn('special-senses',shape['replacedStatistics'])
        self.assertNotIn('hit-points',shape['replacedStatistics'])
        self.assertTrue(any(t['index']=='divine-awareness' for t in angels['planetar']['mechanics']['traits']))
        solar=angels['solar']['mechanics'];self.assertEqual(solar['actions'][2]['effect']['ifTargetCreatureHPAtMost']['hitPoints'],100)
        self.assertEqual(solar['actions'][2]['rangeFt'],{'normal':120,'long':600})
        self.assertEqual(solar['actions'][3]['effect']['command']['activation'],'bonus-action')
        self.assertEqual([a['effect']['legendaryActionCost'] for a in solar['legendaryActions']],[1,2,3])
        other={e['index']:e for e in other_flask_records()}
        knight=other['githyanki-knight']['mechanics'];self.assertEqual(knight['traits'][0]['effect']['componentsRequired'],[])
        self.assertEqual(knight['actions'][1]['effect']['criticalAlternative']['chooseInsteadOfDamage'],'cut-silver-cord')
        succ=other['succubus-incubus']['mechanics'];self.assertEqual(succ['actions'][1]['effect']['maximumTargets'],1)
        self.assertEqual(succ['actions'][2]['effect']['reducesHitPointMaximumBy'],'actual-damage-taken')
        self.assertTrue(succ['traits'][0]['effect']['worksAcrossPlanes'])
        self.assertEqual(other['xorn']['mechanics']['conditionalDamageResistances'][0]['types'],['piercing','slashing'])

    def test_slaad_diseases_maturation_and_gems_do_not_merge(self):
        from creature_reviews import remaining_slaad_records
        forms={e['index']:e for e in remaining_slaad_records()}
        self.assertEqual(len(forms),5)
        tad=forms['slaad-tadpole']['mechanics'];self.assertNotIn('telepathyFt',tad)
        self.assertEqual(tad['traits'][1]['effect']['maturesAfterHoursDice'],'2d12')
        egg=forms['red-slaad']['mechanics']['actions'][2]['effect']['ifTargetHumanoid']['failureDisease']
        self.assertEqual(egg['gestationMonths'],3);self.assertEqual(egg['maximumEggsCarriedToTerm'],1)
        self.assertEqual(egg['finalTwentyFourHours']['speedMultiplier'],.5)
        phage=forms['blue-slaad']['mechanics']['actions'][2]['effect']['ifTargetHumanoid']['failureDisease']
        self.assertTrue(phage['cannotRegainHP']);self.assertEqual(phage['reducesHitPointMaximum']['dice'],'3d6')
        self.assertEqual(phage['onlyReversesTransformation'],'phb2014:spell:wish')
        self.assertEqual(forms['gray-slaad']['mechanics']['skillBonuses']['perception'],6)
        self.assertEqual(forms['gray-slaad']['mechanics']['passivePerception'],16)
        green=forms['green-slaad']['mechanics']
        self.assertEqual(green['actions'][4]['attackBonus'],4)
        self.assertFalse(any(t['index']=='magic-weapons' for t in green['traits']))
        self.assertEqual(green['optionalVariants'][0]['effect']['bornElsewhereWithoutContact'],'no-control-gem')

    def test_demon_and_devil_specific_exceptions_and_original_values(self):
        from creature_reviews import demon_records, devil_records
        demons={e['index']:e for e in demon_records()}; devils={e['index']:e for e in devil_records()}
        self.assertEqual(len(demons),12);self.assertEqual(len(devils),10)
        self.assertEqual(demons['barlgura']['mechanics']['speedFt'],{'walk':30,'climb':30})
        self.assertFalse(any(t['index']=='magic-resistance' for t in demons['barlgura']['mechanics']['traits']))
        self.assertEqual(demons['glabrezu']['mechanics']['actions'][2]['damage']['dice'],'2d4+2')
        self.assertEqual(demons['goristro']['mechanics']['actions'][2]['effect']['save']['dc'],21)
        self.assertNotIn('telepathyFt',demons['goristro']['mechanics'])
        self.assertFalse(demons['yochlol']['verification']['complete'])
        self.assertEqual(devils['bone-devil']['mechanics']['devilRank'],'lesser')
        self.assertEqual(devils['erinyes']['mechanics']['devilRank'],'greater')
        self.assertEqual(devils['horned-devil']['mechanics']['hitPoints']['dice'],'17d10+55')
        self.assertEqual(devils['chain-devil']['mechanics']['actions'][0]['effect']['attacks'],[{'actionIndex':'chain','count':2}])
        self.assertFalse(devils['bearded-devil']['mechanics']['actions'][2]['effect']['repeatSave'])
        self.assertEqual(devils['spined-devil']['mechanics']['traits'][-1]['effect']['maximumSpines'],12)
        self.assertEqual(devils['pit-fiend']['mechanics']['optionalVariants'][0]['effect']['successPercent'],100)

    def test_illusion_cards_reference_appearances_without_combat_dependencies(self):
        from magic_item_reviews import magic_items
        deck=next(e for e in magic_items() if e['index']=='deck-of-illusions')
        self.assertTrue(deck['verification']['complete']);effect=deck['mechanics']['effect']
        self.assertEqual(len(effect['cards']),34);self.assertEqual(len({c['index'] for c in effect['cards']}),34)
        self.assertFalse(effect['grantsCreatureStatistics']);self.assertTrue(effect['harmless'])
        knight=next(c for c in effect['cards'] if c['index']=='king-hearts')
        self.assertEqual([f['quantity'] for f in knight['figures']],[1,4])
        self.assertFalse(effect['cards'][0]['figures'][0]['appearance']['ageSpecifiedByItem'])
        flask=next(e for e in magic_items() if e['index']=='iron-flask')['mechanics']['effect']
        self.assertEqual([i for r in flask['contentsRows'] for i in range(r['low'],r['high']+1)],list(range(1,101)))
        lesser=next(r for r in flask['contentsRows'] if r['result']=='lesser-devil')
        self.assertIn('mm2014:creature:bone-devil',lesser['creatureIds']);self.assertNotIn('mm2014:creature:lemure',lesser['creatureIds'])

    def test_environment_and_trap_boundaries_are_distinct(self):
        from hazard_reviews import environment_hazards,trap_rules
        env={e['index']:e['mechanics']['effect'] for e in environment_hazards()}
        self.assertEqual(len(env),15)
        self.assertIn('no-access-to-drinkable-water',env['extreme-heat']['requires'])
        self.assertNotIn('cold-weather-gear',env['frigid-water']['automaticSuccessIf'])
        self.assertEqual(env['slippery-ice']['firstMoveOntoEachTurn']['checkSkill'],'acrobatics')
        self.assertEqual(env['creature-food-water']['foodLbAndWaterGallonsPerDay']['Gargantuan'],64)
        for rows in env['weather']['tables'].values():
            self.assertEqual([i for r in rows for i in range(r['low'],r['high']+1)],list(range(1,21)))
        traps={e['index']:e for e in trap_rules()}
        self.assertEqual(len(traps),13)
        effect=lambda i:traps['trap-'+i]['mechanics']['effect']
        self.assertEqual(effect('poison-darts')['triggerWeightLb']['comparison'],'greater-than')
        self.assertEqual(effect('rolling-sphere')['triggerWeightLb']['comparison'],'at-least')
        self.assertFalse(effect('poison-needle')['effect']['successfulSavePreventsDamage'])
        self.assertEqual(effect('falling-net')['effect']['allTargetsCondition'],'restrained')
        self.assertTrue(traps['trap-annihilation-sphere']['verification']['complete'])
        self.assertFalse(traps['trap-annihilation-sympathy']['verification']['complete'])

    def test_downtime_uses_total_costs_parallel_searches_and_source_table_limits(self):
        from adjudication_reviews import downtime_rules
        rules={e['index']:e['mechanics'] for e in downtime_rules()}
        self.assertEqual(len(rules),9)
        upkeep={r['property']:r for r in rules['property-maintenance']['table']}
        self.assertEqual(upkeep['farm']['GPPerDay'],0.5);self.assertEqual(upkeep['farm']['skilledHirelings'],1)
        self.assertEqual(upkeep['urban-inn']['skilledHirelings'],1)
        self.assertTrue(rules['property-maintenance']['costIncludesHirelingWages'])
        self.assertEqual(rules['build-stronghold']['eachDayAwayAddsConstructionDays'],3)
        sale=rules['sell-magic-items']
        self.assertEqual(sale['buyerSearch']['parallelSearchDuration'],'maximum-not-sum')
        self.assertEqual(sale['table'][0]['low'],None);self.assertEqual(sale['table'][-1]['high'],None)
        self.assertTrue(rules['train-to-gain-levels']['costIsPerEntireTrainingNotPerDay'])
        self.assertFalse(rules['sow-rumors']['individualOpinionsAutomaticallyChanged'])
        self.assertIn('not-covered-by-table',rules['run-business']['modifiedTotalBelowOne'])

    def test_ship_table_missing_threshold_and_swimming_depths(self):
        from adjudication_reviews import unusual_travel_rules
        rules={e['index']:e['mechanics'] for e in unusual_travel_rules()}
        ships={r['index']:r for r in rules['ship-statistics']['vehicles']}
        self.assertEqual(len(ships),7)
        self.assertIsNone(ships['airship']['damageThreshold'])
        self.assertIsNone(ships['rowboat']['damageThreshold'])
        self.assertEqual(ships['keelboat']['cargoTonsAsPrinted'],0.5)
        self.assertEqual(ships['warship']['speedMilesPerHour'],2.5)
        self.assertEqual(rules['ship-statistics']['repair']['GPPerHP'],20)
        self.assertEqual(rules['swimming-travel']['withoutMagicOrSwimmingSpeed']['depthHourMultiplier'],[{'depthGreaterThanFt':100,'multiplier':2},{'depthGreaterThanFt':200,'multiplier':4}])
        self.assertTrue(rules['swimming-travel']['withoutMagicOrSwimmingSpeed']['multipliersDoNotStack'])
        self.assertTrue(rules['sea-travel']['shipwreck']['assumedPCSurvival'])

    def test_negative_modifier_rounds_down(self):
        self.assertEqual(ability_modifier(9),-1)
        self.assertEqual(ability_modifier(1),-5)
        self.assertEqual(ability_modifier(30),10)
        with self.assertRaises(ValueError):ability_modifier(True)

    def test_multiclass_example_from_phb(self):
        self.assertEqual(multiclass_slots({'ranger':4,'wizard':3})[:4],[4,3,2,0])

    def test_single_half_caster_not_rounded_as_multiclass(self):
        self.assertEqual(multiclass_slots({'paladin':3})[:3],[3,0,0])
        self.assertEqual(multiclass_slots({'paladin':3,'wizard':1})[:3],[3,0,0])
        self.assertEqual(multiclass_slots({'paladin':3,'fighter':2})[:3],[3,0,0])

    def test_pact_pool_is_not_added_to_multiclass(self):
        self.assertEqual(multiclass_slots({'wizard':1,'warlock':5}),multiclass_slots({'wizard':1}))
        self.assertEqual(multiclass_slots({'warlock':5}),[0]*9)

    def test_third_caster_and_invalid_level(self):
        self.assertEqual(multiclass_slots({'fighter':4},['fighter'])[:3],[3,0,0])
        with self.assertRaises(ValueError):multiclass_slots({'wizard':20,'cleric':1})

    def test_concentration_damage_odd_and_minimum(self):
        self.assertEqual(concentration_dc(21),10)
        self.assertEqual(concentration_dc(23),11)
        self.assertEqual(concentration_dc(0),10)


class ExtractionTests(unittest.TestCase):
    def test_ocr_metadata_is_never_verified_by_exact_name(self):
        pages=['']*322
        pages[211]='FIREBALL\n3rd-level evocation\nCasting Time: 1 action\nRange: 150 feet\nComponents: V, S, M\nDuration: Instantaneous\nDamaging description omitted.\n'
        spell=extract_spells(pages,['Fireball'])[0]
        self.assertEqual(spell['name'],'Fireball')
        self.assertEqual(spell['mechanics']['components'],['V','S','M'])
        self.assertFalse(spell['verification']['complete'])
        self.assertEqual(spell['verification']['mechanics'],'ocr-candidate')
        self.assertIsNone(spell['mechanics']['effect'])
        self.assertNotIn('description',spell)

    def test_eponym_alias_avoids_false_missing(self):
        e=record('spell','melf-s-acid-arrow',"Melf's Acid Arrow",None,257)
        self.assertEqual(match(e,[{'index':'acid-arrow','name':'Acid Arrow'}])['index'],'acid-arrow')

    def test_conditions_preserve_2014_exhaustion(self):
        e=next(x for x in conditions() if x['index']=='exhaustion')
        effects=e['mechanics']['effectsByLevel']
        self.assertEqual(effects[1]['speedMultiplier'],0.5)
        self.assertEqual(effects[3]['hitPointMaximumMultiplier'],0.5)
        self.assertEqual(effects[5],{'level':6,'death':True})


@unittest.skipUnless((WORK/'reference.json').exists(),'Build local reference first for integration checks.')
class ArtifactTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.database=json.loads((WORK/'reference.json').read_text(encoding='utf-8'))

    def test_integrity_and_all_twenty_levels(self):
        self.assertEqual(validate(self.database),[])
        levels=[x for x in self.database['entities'] if x['kind']=='class-level']
        self.assertEqual(len(levels),240)

    def test_inventory_audit_does_not_certify_missing_identity_or_translation(self):
        from build import coverage
        category=lambda db:next(c for c in coverage(db)['categories'] if c['kind']=='weapon')
        self.assertTrue(category(self.database)['categoryComplete'])
        db=copy.deepcopy(self.database);e=next(e for e in db['entities'] if e['kind']=='weapon')
        e['nameIt']='';self.assertFalse(category(db)['categoryComplete'])
        db['entities'].remove(e)
        self.assertFalse(category(db)['inventoryAudited']);self.assertFalse(category(db)['categoryComplete'])

    def test_verified_fields_require_provenance_and_correct_source_namespace(self):
        db=copy.deepcopy(self.database);e=db['entities'][0]
        field=next(iter(e['mechanics']));e['fieldSources'].pop(field)
        self.assertIn('Missing field provenance: '+e['id']+':'+field,validate(db))
        e['fieldSources'][field]=[]
        self.assertIn('Invalid field provenance: '+e['id']+':'+field,validate(db))
        e['sources'][0]['book']='dmg'
        self.assertIn('Source namespace mismatch: '+e['id'],validate(db))

    def test_spell_geometry_help_and_dmg_example_origins(self):
        by={e['id']:e for e in self.database['entities']}
        area=by['phb2014:rule:spell-area-geometry']['mechanics']
        self.assertEqual(area['originIncludedByDefault'],{'cone':False,'cube':False,'cylinder':True,'line':False,'sphere':True})
        self.assertTrue(by['phb2014:rule:working-together']['mechanics']['helperMustBeAbleToAttemptAlone'])
        self.assertFalse(by['phb2014:rule:saving-throws']['mechanics']['successfulSaveAlwaysHalfDamage'])
        a=by['dmg2014:race:aasimar-dmg-example'];el=by['dmg2014:subrace:eladrin-dmg-example']
        self.assertTrue(a['optional']);self.assertTrue(el['optional'])
        self.assertEqual(el['relations']['raceId'],'phb2014:race:elf')
        self.assertTrue(a['relations']['grantedSpellIds']);self.assertTrue(el['relations']['grantedSpellIds'])

    def test_revised_source_cannot_enter_2014_entities(self):
        db=copy.deepcopy(self.database)
        db['entities'][0]['sources'][0]['book']='srd521-it'
        self.assertTrue(any('revised source' in e for e in validate(db)))

    def test_incomplete_rule_cannot_be_declared_complete(self):
        db=copy.deepcopy(self.database)
        spell=next(x for x in db['entities'] if x['kind']=='spell' and not x['verification']['complete'])
        spell['verification']['complete']=True
        self.assertTrue(any('False completion' in e for e in validate(db)))

    def test_changed_pdf_requires_review(self):
        manifest=copy.deepcopy(self.database['sources']);manifest['phb']['sha256']='changed'
        with self.assertRaises(ValueError):load_reviews(manifest)

    def test_entities_regenerate_deterministically(self):
        digest=lambda value: hashlib.sha256(json.dumps(value,ensure_ascii=False,sort_keys=True).encode()).hexdigest()
        self.assertEqual(digest(build_entities(load_pages('phb'))),digest(self.database['entities']))

    def test_ammunition_quantity_is_not_twenty_purchase_packs(self):
        ranger=next(e for e in self.database['entities'] if e['id']=='phb2014:class:ranger')
        arrows=next(i for i in ranger['mechanics']['startingEquipment']['fixed'] if i['index']=='arrow')
        self.assertEqual(arrows['quantity'],20)
        self.assertEqual(arrows['quantityUnit'],'piece')
        self.assertEqual(arrows['entityId'],'phb2014:gear:arrows-20')

    def test_spell_material_consumption_and_no_supplement_class_grants(self):
        revive=next(e for e in self.database['entities'] if e['id']=='phb2014:spell:revivify')
        self.assertTrue(revive['mechanics']['materialConsumed'])
        self.assertEqual(revive['mechanics']['materialCostGP'],300)
        self.assertEqual(revive['mechanics']['classes'],['cleric','paladin'])

    def test_comparison_is_repeatable_and_read_only(self):
        data_dir=ROOT/'public'/'data';before=snapshot(data_dir)
        first=compare(self.database);second=compare(self.database)
        self.assertEqual(first,second);self.assertEqual(before,snapshot(data_dir))

    def test_throw_range_does_not_compare_with_melee_reach(self):
        result=compare(self.database)
        self.assertFalse(any(x['entityId']=='phb2014:weapon:dagger' and x['field'].startswith(('range.','throw_range.')) for x in result['discrepancies']))

    def test_warlock_invocation_error_verified_against_table(self):
        result=compare(self.database)
        issues=[x for x in result['discrepancies'] if x['entityId']=='phb2014:class-level:warlock-4' and x['field']=='invocationsKnown']
        self.assertEqual(len(issues),1);self.assertEqual(issues[0]['verifiedValue'],2)
        self.assertEqual(issues[0]['sources'][0]['pdfPages'],[107])

    def test_wizard_overlay_not_duplicate(self):
        result=compare(self.database)
        self.assertFalse(any(x['type']=='duplicate-within-array' and 'evocation' in x['entityId'] for x in result['discrepancies']))

    def test_unnamed_level_records_are_not_name_discrepancies(self):
        result=compare(self.database)
        self.assertFalse(any(x['kind']=='class-level' and x['type']=='denomination-difference' for x in result['discrepancies']))

    def test_sqlite_has_relations_and_integrity(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'reference.sqlite';sqlite_export(path,self.database)
            with closing(sqlite3.connect(path)) as db:
                self.assertEqual(db.execute('PRAGMA integrity_check').fetchone()[0],'ok')
                self.assertEqual(db.execute('PRAGMA foreign_key_check').fetchall(),[])
                self.assertEqual(db.execute('SELECT COUNT(*) FROM entities').fetchone()[0],len(self.database['entities']))


if __name__=='__main__':unittest.main()
