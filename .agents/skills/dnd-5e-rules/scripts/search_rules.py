#!/usr/bin/env python3
"""Search D&D PDFs stored under a project's MANUALI directory; prints PDF page numbers."""
import argparse
import re
import sys
from pathlib import Path

BOOKS = {
    "D&D_5_Player_Original_Handbook.pdf": ("2014", "player"),
    "D&D_5_Master_Original_Handbook.pdf": ("2014", "master"),
    "D&D_5_Monster_Original_Handbook.pdf": ("2014", "monster"),
    "D&D_5e_manuale_compatto_italiano.pdf": ("2014", "compact-2014"),
    "D&D_5.5_manuale_compatto_italiano.pdf": ("2024", "compact-2024"),
}

def discover_manuals(explicit: str | None) -> Path | None:
    if explicit:
        return Path(explicit).expanduser().resolve()
    # Search up from CWD (recommended), then from script folder (project-local skill).
    for origin in (Path.cwd(), Path(__file__).resolve().parent):
        for folder in (origin, *origin.parents):
            candidate = folder / "MANUALI"
            if candidate.is_dir():
                return candidate
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("query", help="Literal case-insensitive phrase to find")
    parser.add_argument("--edition", choices=["2014", "2024", "both"], default="both")
    parser.add_argument("--book", choices=["all", "player", "master", "monster", "compact-2014", "compact-2024"], default="all")
    parser.add_argument("--manuals", help="Path to your project's MANUALI directory")
    parser.add_argument("--max-results", type=int, default=30)
    args = parser.parse_args()
    try:
        from pypdf import PdfReader
    except ImportError:
        print("Missing dependency: install with 'python -m pip install pypdf' (or Arch: sudo pacman -S python-pypdf).", file=sys.stderr)
        return 2
    directory = discover_manuals(args.manuals)
    if not directory or not directory.is_dir():
        print("MANUALI directory not found. Run from project root or pass --manuals /path/to/project/MANUALI", file=sys.stderr)
        return 2
    found = 0
    searched = 0
    needle = args.query.casefold()
    for name, (edition, book) in BOOKS.items():
        if args.edition != "both" and edition != args.edition:
            continue
        if args.book != "all" and book != args.book:
            continue
        path = directory / name
        if not path.is_file():
            print(f"[missing] {path.name}", file=sys.stderr)
            continue
        try:
            reader = PdfReader(str(path))
            if reader.is_encrypted:
                print(f"[encrypted] {name}: cannot search without access", file=sys.stderr)
                continue
            searched += 1
            for number, page in enumerate(reader.pages, 1):
                content = page.extract_text() or ""
                match = content.casefold().find(needle)
                if match < 0:
                    continue
                snippet = re.sub(r"\s+", " ", content[max(0, match-140):match + len(needle)+190]).strip()
                print(f"[{edition} | {book}] {name} — PDF page {number}/{len(reader.pages)}\n  {snippet}\n")
                found += 1
                if found >= args.max_results:
                    print(f"Maximum results reached ({args.max_results}); narrow the search or use --book.")
                    return 0
        except Exception as error:
            print(f"[error] {name}: {error}", file=sys.stderr)
    print(f"Search complete. {found} matching pages in {searched} searchable PDFs.")
    if not searched:
        return 2
    if not found:
        print("No text matches. If PDFs are scanned/image-only, text extraction may be unavailable (OCR required).")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
