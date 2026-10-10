"""Local PDF retrieval. Raw text is a disposable, ignored cache, never application data."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / 'rules-reference.local' / '2014'
BOOKS = {
    'phb': 'D&D_5_Player_Original_Handbook.pdf',
    'dmg': 'D&D_5_Master_Original_Handbook.pdf',
    'mm': 'D&D_5_Monster_Original_Handbook.pdf',
    'srd51-it': 'D&D_5e_manuale_compatto_italiano.pdf',
    'srd521-it': 'D&D_5.5_manuale_compatto_italiano.pdf',
}


def sha256(path: Path) -> str:
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def extract(manuals: Path = ROOT / 'MANUALI', work: Path = WORK) -> dict:
    from pypdf import PdfReader
    manifest = {}
    for key, filename in BOOKS.items():
        path = manuals / filename
        cache = work / 'cache' / (key + '.json')
        if not path.is_file():
            manifest[key] = {'filename': filename, 'status': 'missing'}
            continue
        digest = sha256(path)
        try:
            prior = json.loads(cache.read_text(encoding='utf-8')) if cache.exists() else None
        except (ValueError, OSError):
            prior = None  # Disposable cache: rebuild it, not the source review.
        if prior and prior.get('sha256') == digest:
            manifest[key] = {k: v for k, v in prior.items() if k != 'pages'}
            continue
        print('Extracting', filename, flush=True)
        try:
            reader = PdfReader(path)
            if reader.is_encrypted and not reader.decrypt(''):
                raise ValueError('Encrypted PDF: no available text access')
            pages = [page.extract_text() or '' for page in reader.pages]
            info = {
                'filename': filename, 'sha256': digest, 'pageCount': len(pages),
                'metadata': {str(k): str(v) for k, v in (reader.metadata or {}).items()},
                'emptyPdfPages': [i for i, page in enumerate(pages, 1) if not page.strip()],
                'status': 'text-extracted', 'pages': pages,
            }
            write_json(cache, info)
            manifest[key] = {k: v for k, v in info.items() if k != 'pages'}
        except Exception as error:
            manifest[key] = {'filename': filename, 'sha256': digest, 'status': 'unreadable', 'error': str(error)}
    write_json(work / 'source-manifest.json', manifest)
    return manifest


def load_pages(book: str, work: Path = WORK) -> list[str]:
    return json.loads((work / 'cache' / (book + '.json')).read_text(encoding='utf-8'))['pages']


if __name__ == '__main__':
    extract()
