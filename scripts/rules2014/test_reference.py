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

    def test_revised_source_cannot_enter_2014_entities(self):
        db=copy.deepcopy(self.database)
        db['entities'][0]['sources'][0]['book']='srd521-it'
        self.assertTrue(any('revised source' in e for e in validate(db)))

    def test_incomplete_rule_cannot_be_declared_complete(self):
        db=copy.deepcopy(self.database)
        spell=next(x for x in db['entities'] if x['kind']=='spell')
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
