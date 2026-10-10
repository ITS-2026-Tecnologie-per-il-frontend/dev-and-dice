"""Regression checks for immutable backup, field-level corrections and merging."""
import copy
import json
from pathlib import Path
import tempfile
import unittest

from backup import create_backup, safe_member, verify_backup, digest
from errata import corrected_reference, load_errata
from merge import merge_catalogs, audit_records, verify_release
from pdf_sources import ROOT, WORK
from validate import validate


class BackupTests(unittest.TestCase):
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
        corrections=[c for c in changes if c['operation']=='correct']
        self.assertEqual(len(corrections),5)
        self.assertEqual({c['field'] for c in corrections},{'class_specific.invocations_known','school'})
        self.assertTrue(all(c['sources'] for c in corrections))

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
        mass=next(e for e in effective['entities'] if e['id']=='phb2014:spell:mass-heal')
        self.assertEqual(mass['mechanics']['school'],'evocation')
        self.assertEqual(mass['verification']['mechanics'],'ocr-candidate')
        self.assertFalse(mass['verification']['complete'])
        self.assertEqual(validate(effective),[])

    def test_choices_not_granted_and_legacy_ids_preserved(self):
        merged,_,_,_=merge_catalogs(self.catalogs,self.reference)
        options=merged['verified-options-2014.json']['options']
        self.assertEqual(len(options),35)
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
        self.assertEqual(len(added),35)
        self.assertTrue(all(r['operation']=='add' and r['origin']['type']=='verified-manual-reference' for r in added))
        legacy=next(r for r in audit if r['catalog']=='character-options.json' and r['array']=='classes')
        self.assertEqual(legacy['edition']['status'],'not-verified')
        self.assertEqual(legacy['verification'],'retained-existing-not-fully-reverified')

    def test_duplicate_legacy_identity_is_rejected(self):
        catalogs=copy.deepcopy(self.catalogs)
        catalogs['character-options.json']['classes'].append(copy.deepcopy(catalogs['character-options.json']['classes'][0]))
        with self.assertRaisesRegex(ValueError,'Duplicate'): audit_records(catalogs,[],[],{})

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


if __name__=='__main__': unittest.main()
