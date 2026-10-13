"""Publish the application payload of a verified release; keep private work local."""
import argparse
import hashlib
import json
import os
from pathlib import Path

from backup import verify_backup
from pdf_sources import ROOT

FILES = [f'data/{name}.json' for name in (
    'character-options', 'character-equipment', 'character-rules', 'wizard-catalog',
    'database', 'verified-options-2014', 'verified-creatures-2014',
    'verified-equipment-2014', 'verified-magic-items-2014', 'verified-creation-options-2014',
)] + ['verified-reference.json', 'id-map.json', 'coverage.json',
     'data/ogl-1.0a.txt', 'data/srd-database-license.txt']
DESTINATION = ROOT / 'public/data/rules2014'


def publish(source, backup, check=False):
    verify_backup(backup)
    source = Path(source).resolve()
    manifest_bytes = (source / 'RELEASE.json').read_bytes()
    manifest = json.loads(manifest_bytes)
    if manifest.get('runtimeActivated') is not False or manifest.get('status') != 'partial-candidate-not-active':
        raise ValueError('Expected an immutable candidate release')
    payload = {name: (source / name).read_bytes() for name in FILES}
    hashes = {name: hashlib.sha256(raw).hexdigest() for name, raw in payload.items()}
    if any(manifest['files'].get(name) != digest for name, digest in hashes.items()):
        raise ValueError('Source release integrity failure')
    runtime = dict(schemaVersion=1, releaseId=manifest['releaseId'],
                   status='active-2014-with-explicit-partial-records', runtimeActivated=True,
                   editionPolicy=manifest['editionPolicy'], files=hashes,
                   sourceManifestSHA256=hashlib.sha256(manifest_bytes).hexdigest())
    payload['RELEASE.json'] = (json.dumps(runtime, ensure_ascii=False, indent=2) + '\n').encode()
    if check:
        if any(not (DESTINATION / name).is_file() or (DESTINATION / name).read_bytes() != raw
               for name, raw in payload.items()):
            raise ValueError('Published payload differs from the source release')
    else:
        # ponytail: atomic files and manifest last; interrupted copies fail hashes, rerun to recover.
        for name, raw in payload.items():
            target = DESTINATION / name
            target.parent.mkdir(parents=True, exist_ok=True)
            temporary = target.with_suffix(target.suffix + '.tmp')
            temporary.write_bytes(raw)
            os.replace(temporary, target)
    print('Verified runtime payload:', manifest['releaseId'], len(payload), 'files')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--backup', type=Path, required=True)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    publish(args.source, args.backup, args.check)
