"""Verified, immutable input snapshot. Never writes to the running database."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess

from pdf_sources import ROOT, write_json

BACKUPS = ROOT / 'database-backups.local'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def input_files(root=ROOT):
    # Include all catalogs, generators, client types/logic and private server data.
    # Browser localStorage and external environment variables are not disk files.
    files = set()
    for directory in ['public/data', 'src', 'server', 'scripts']:
        folder = root / directory
        if folder.exists():
            files.update(p for p in folder.rglob('*') if p.is_file()
                         and not any(x in p.parts for x in ['__pycache__', 'node_modules'])
                         and p.suffix not in ['.pyc', '.zip'])
    for pattern in ['package*.json', 'tsconfig*.json', 'vite.config.*', '.env*']:
        files.update(p for p in root.glob(pattern) if p.is_file())
    for name in ['.gitignore', 'README.md']:
        if (root / name).is_file():
            files.add(root / name)
    return sorted(files)


def shape(data):
    if isinstance(data, dict):
        return {key: ('array' if isinstance(value, list) else type(value).__name__)
                for key, value in data.items()}
    return type(data).__name__


def safe_member(base, relative):
    rel = Path(relative)
    if rel.is_absolute() or '..' in rel.parts or ':' in relative:
        raise ValueError('Unsafe snapshot member')
    target = (base / rel).resolve()
    if not target.is_relative_to(base.resolve()):
        raise ValueError('Snapshot member escapes directory')
    return target


def verify_backup(directory):
    directory = Path(directory).resolve()
    manifest = json.loads((directory / 'BACKUP.json').read_text(encoding='utf-8'))
    if manifest.get('status') != 'verified-snapshot':
        raise ValueError('Backup is not a verified snapshot')
    errors = []
    for item in manifest['files']:
        file = safe_member(directory / 'files', item['path'])
        if not file.is_file() or digest(file.read_bytes()) != item['sha256']:
            errors.append(item['path'])
    if errors:
        raise ValueError('Backup integrity failure: ' + ', '.join(errors))
    return manifest


def create_backup(root=ROOT, destination=None):
    root = Path(root).resolve()
    now = datetime.now(timezone.utc)
    directory = Path(destination or (BACKUPS / now.strftime('%Y%m%dT%H%M%S%fZ'))).resolve()
    if directory.exists():
        raise ValueError('Never overwrite an existing backup')
    if directory == root or directory.is_relative_to(root / 'public') or directory.is_relative_to(root / 'server'):
        raise ValueError('Backup destination overlaps live data')
    files = input_files(root)
    # Freeze bytes first, before creating files; a changed live source invalidates
    # the snapshot rather than quietly mixing states from different moments.
    frozen = {p.relative_to(root).as_posix(): p.read_bytes() for p in files}
    directory.mkdir(parents=True)
    rows = []
    for rel, raw in frozen.items():
        target = safe_member(directory / 'files', rel)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(raw)
        row = {'path': rel, 'originalPath': (root / rel).as_posix(),
               'sha256': digest(raw), 'bytes': len(raw)}
        if rel.endswith('.json'):
            # JSON readability is checked without printing account/session data.
            try:
                parsed = json.loads(raw.decode('utf-8-sig'))
            except json.JSONDecodeError:
                if rel.startswith(('public/data/', 'server/data/')):
                    raise ValueError('Unreadable database JSON: ' + rel)
                # TypeScript configurations are JSONC, not strict JSON catalogs.
                row.update(jsonReadable=False, contentType='configuration-or-source', schemaVersionStatus='not-declared')
            else:
                row.update(jsonReadable=True, declaredSchemaVersion=parsed.get('schemaVersion') if isinstance(parsed, dict) else None,
                           schemaVersionStatus='declared' if isinstance(parsed, dict) and 'schemaVersion' in parsed else 'not-declared',
                           shapeSha256=digest(json.dumps(shape(parsed), sort_keys=True).encode()))
        rows.append(row)
    stable = input_files(root) == files and all((root / rel).read_bytes() == raw for rel, raw in frozen.items())
    copied = all(safe_member(directory / 'files', rel).read_bytes() == raw for rel, raw in frozen.items())
    result = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=root, capture_output=True, text=True)
    manifest = {'schemaVersion': 1, 'status': 'verified-snapshot' if stable and copied else 'invalid-source-changed',
                'createdAtUTC': now.isoformat(), 'originalRoot': root.as_posix(),
                'gitCommit': result.stdout.strip() if result.returncode == 0 else None,
                'files': rows, 'sourceUnchangedDuringCopy': stable, 'copyIdentical': copied,
                'limitations': ['Browser localStorage is outside the filesystem snapshot; export character sheets separately.',
                                'External environment variables are not captured; recreate the existing deployment configuration.',
                                'Live sessions may change after this snapshot; stop the server before restoring server/data.']}
    write_json(directory / 'BACKUP.json', manifest)
    (directory / 'RESTORE.md').write_text(
        '# Ripristino del backup\n\n'
        'Questo backup non viene modificato dai generatori. Non contiene i manuali.\n\n'
        '1. Eseguire `python -X utf8 scripts/rules2014/backup.py --verify "PERCORSO_BACKUP"`.\n'
        '2. Esportare dal browser le schede salvate; localStorage non fa parte di questa copia.\n'
        '3. Arrestare frontend e backend; creare un nuovo backup dello stato da sostituire.\n'
        '4. Ripristinare i file elencati in BACKUP.json da files/, mantenendo i percorsi relativi. '
        'Per il solo catalogo delle regole ripristinare public/data/. '
        'Ripristinare src/, scripts/ e configurazioni soltanto se serve tornare alla stessa versione del codice.\n'
        '5. Ripristinare server/data/ soltanto per ripristinare account e sessioni, a server fermo.\n'
        '6. Verificare gli SHA-256 dei file ripristinati, reinstallare con npm ci se necessario, '
        'quindi avviare npm run dev e verificare il caricamento dei cataloghi.\n\n'
        'I file privati server/data e .env restano locali e non devono essere pubblicati.\n', encoding='utf-8')
    if not stable or not copied:
        raise ValueError('Source changed while backing up; retain failed snapshot and create a fresh one')
    verify_backup(directory)
    return directory, manifest


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--verify', type=Path)
    args = parser.parse_args()
    if args.verify:
        manifest = verify_backup(args.verify)
        print('Verified backup:', len(manifest['files']), 'files')
    else:
        directory, manifest = create_backup()
        print('Verified backup:', len(manifest['files']), 'files;', directory)


if __name__ == '__main__':
    main()
