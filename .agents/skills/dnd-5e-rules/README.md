# D&D 5e Rules — Codex project skill

Copy this `dnd-5e-rules` directory into `<PROJECT>/.agents/skills/`. Put your five PDF rulebooks in `<PROJECT>/MANUALI/` using the exact filenames listed in `SKILL.md`. The PDF books themselves are NOT included here.

On Arch Linux:

```bash
sudo pacman -S python-pypdf
cd /path/to/your/project
python .agents/skills/dnd-5e-rules/scripts/search_rules.py 'grapple' --edition 2014
python .agents/skills/dnd-5e-rules/scripts/search_rules.py 'vantaggio' --edition both
```

On Windows (PowerShell):

```powershell
py -m pip install pypdf
cd C:\path\to\your\project
py .agents\skills\dnd-5e-rules\scripts\search_rules.py 'grapple' --edition 2014
```

If you install the skill globally in `~/.agents/skills/dnd-5e-rules/` rather than inside a project, run the script from the project root or set `--manuals ./MANUALI` explicitly.

Ask Codex: `Use $dnd-5e-rules: compare grapple rules between 2014 and 2024 using the PDFs in MANUALI; cite filename and PDF page.`

Keep copyrighted manuals out of public Git repositories. If appropriate, add `/MANUALI/` to `.gitignore`.
