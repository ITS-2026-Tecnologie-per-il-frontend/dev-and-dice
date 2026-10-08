# Confronto incantesimi Wikidot / database

Generato: 2026-10-08T18:08:13.335247+00:00.

Fonte: [indice Wikidot](https://dnd5e.wikidot.com/spells), con lettura delle singole pagine.

Database: `public/data/database.json`, SHA-256 `5a15825d7c99480cda9b2a30bb78c211d586674063b76c1e6eb3edbb7210e1db`.

- Incantesimi Wikidot: **574** (varianti UA separate).
- Voci inglesi database: **574**; italiane: **319**.
- Voci mancanti: inglese **0**, italiano **255**.
- Voci con differenze nei dati già strutturati: **141**: **130** con differenze nei valori e **11** soltanto nel testo della durata.
- Voci italiane con durata non convertita in round nel database: **129**.

## Campi assenti e comportamento del programma

Il database conserva durata, round e concentrazione. Alcune voci inglesi SRD hanno anche `srdData.dc.dc_type.index`: una sola caratteristica, senza gli eventi del TS.

Per tutte le voci confrontate mancano campi strutturati equivalenti a `scadenza.fase`, `scadenza.turnoDi`, `scadenzeEffetti` e `tiriSalvezza` (condizioni, ripetizione, fase e proprietario del turno). Le descrizioni possono contenere queste informazioni: **assenza di struttura non significa assenza della regola nel testo**.

`src/utils/Combat.ts` decrementa i contatori a fine round, senza distinguere il turno del lanciatore o del bersaglio. `src/utils/Catalog.ts` importa solo la durata. Questo comportamento non applica ancora le scadenze raccolte né i default inizio turno/incantatore richiesti.

Nessuna modifica al database o al comportamento dell’app è stata eseguita con questa analisi. Il riferimento include convenzioni del progetto e condizioni specifiche: non importarlo alla cieca come un’unica scadenza per incantesimo.

## Differenze nei campi esistenti

`duration.testo` indica una differenza testuale a parità di tipo, round e concentrazione: punteggiatura, maiuscole, refusi o precisazioni. Le righe `durationInfo` confrontano invece i valori effettivamente memorizzati; un `null` italiano può indicare un limite del parser, anche se la descrizione della durata è corretta.

| Incantesimo | Lingua | Campo | Database | Wikidot |
|---|---|---|---|---|
| Dancing Lights | en | duration.testo | "Concentration up to 1 minute" | "Concentration, up to 1 minute" |
| Dancing Lights | it | durationInfo.kind | "conditional" | "maximum" |
| Dancing Lights | it | durationInfo.rounds | null | 10 |
| Guidance | en | duration.testo | "Concentration up to 1 minute" | "Concentration, up to 1 minute" |
| Guidance | it | durationInfo.kind | "conditional" | "maximum" |
| Guidance | it | durationInfo.rounds | null | 10 |
| Prestidigitation | it | durationInfo.kind | "conditional" | "maximum" |
| Prestidigitation | it | durationInfo.rounds | null | 600 |
| Resistance | en | duration.testo | "Concentration up to 1 minute" | "Concentration, up to 1 minute" |
| Resistance | it | durationInfo.kind | "conditional" | "maximum" |
| Resistance | it | durationInfo.rounds | null | 10 |
| Thaumaturgy | it | durationInfo.kind | "conditional" | "maximum" |
| Thaumaturgy | it | durationInfo.rounds | null | 10 |
| True Strike | en | duration.testo | "Concentration up to 1 round" | "Concentration, up to 1 round" |
| True Strike | it | durationInfo.kind | "conditional" | "maximum" |
| True Strike | it | durationInfo.rounds | null | 1 |
| Alarm | en | duration.testo | "8 Hours" | "8 hours" |
| Bane | it | durationInfo.kind | "conditional" | "maximum" |
| Bane | it | durationInfo.rounds | null | 10 |
| Bless | it | durationInfo.kind | "conditional" | "maximum" |
| Bless | it | durationInfo.rounds | null | 10 |
| Ceremony | en | duration.testo | "Instantaneous" | "Instantaneous (see below)" |
| Detect Evil and Good | it | durationInfo.kind | "conditional" | "maximum" |
| Detect Evil and Good | it | durationInfo.rounds | null | 100 |
| Detect Magic | it | durationInfo.kind | "conditional" | "maximum" |
| Detect Magic | it | durationInfo.rounds | null | 100 |
| Detect Poison and Disease | it | durationInfo.kind | "conditional" | "maximum" |
| Detect Poison and Disease | it | durationInfo.rounds | null | 100 |
| Divine Favor | it | durationInfo.kind | "conditional" | "maximum" |
| Divine Favor | it | durationInfo.rounds | null | 10 |
| Entangle | it | durationInfo.kind | "conditional" | "maximum" |
| Entangle | it | durationInfo.rounds | null | 10 |
| Expeditious Retreat | it | durationInfo.kind | "conditional" | "maximum" |
| Expeditious Retreat | it | durationInfo.rounds | null | 100 |
| Faerie Fire | it | durationInfo.kind | "conditional" | "maximum" |
| Faerie Fire | it | durationInfo.rounds | null | 10 |
| Fog Cloud | it | durationInfo.kind | "conditional" | "maximum" |
| Fog Cloud | it | durationInfo.rounds | null | 600 |
| Heroism | it | durationInfo.kind | "conditional" | "maximum" |
| Heroism | it | durationInfo.rounds | null | 10 |
| Hunter's Mark | it | durationInfo.kind | "conditional" | "maximum" |
| Hunter's Mark | it | durationInfo.rounds | null | 600 |
| Protection from Evil and Good | it | durationInfo.kind | "conditional" | "maximum" |
| Protection from Evil and Good | it | durationInfo.rounds | null | 100 |
| Shield of Faith | it | durationInfo.kind | "conditional" | "maximum" |
| Shield of Faith | it | durationInfo.rounds | null | 100 |
| Silent Image | it | durationInfo.kind | "conditional" | "maximum" |
| Silent Image | it | durationInfo.rounds | null | 100 |
| Tasha's Hideous Laughter | it | durationInfo.kind | "conditional" | "maximum" |
| Tasha's Hideous Laughter | it | durationInfo.rounds | null | 10 |
| Alter Self | it | durationInfo.kind | "conditional" | "maximum" |
| Alter Self | it | durationInfo.rounds | null | 600 |
| Barkskin | it | durationInfo.kind | "conditional" | "maximum" |
| Barkskin | it | durationInfo.rounds | null | 600 |
| Blur | it | durationInfo.kind | "conditional" | "maximum" |
| Blur | it | durationInfo.rounds | null | 10 |
| Branding Smite | it | durationInfo.kind | "conditional" | "maximum" |
| Branding Smite | it | durationInfo.rounds | null | 10 |
| Calm Emotions | it | durationInfo.kind | "conditional" | "maximum" |
| Calm Emotions | it | durationInfo.rounds | null | 10 |
| Darkness | it | durationInfo.kind | "conditional" | "maximum" |
| Darkness | it | durationInfo.rounds | null | 100 |
| Detect Thoughts | it | durationInfo.kind | "conditional" | "maximum" |
| Detect Thoughts | it | durationInfo.rounds | null | 10 |
| Enhance Ability | it | durationInfo.kind | "conditional" | "maximum" |
| Enhance Ability | it | durationInfo.rounds | null | 600 |
| Enlarge/Reduce | it | durationInfo.kind | "conditional" | "maximum" |
| Enlarge/Reduce | it | durationInfo.rounds | null | 10 |
| Flame Blade | it | durationInfo.kind | "conditional" | "maximum" |
| Flame Blade | it | durationInfo.rounds | null | 100 |
| Flaming Sphere | it | durationInfo.kind | "conditional" | "maximum" |
| Flaming Sphere | it | durationInfo.rounds | null | 10 |
| Gust of Wind | it | durationInfo.kind | "conditional" | "maximum" |
| Gust of Wind | it | durationInfo.rounds | null | 10 |
| Heat Metal | it | durationInfo.kind | "conditional" | "maximum" |
| Heat Metal | it | durationInfo.rounds | null | 10 |
| Hold Person | it | durationInfo.kind | "conditional" | "maximum" |
| Hold Person | it | durationInfo.rounds | null | 10 |
| Invisibility | it | durationInfo.kind | "conditional" | "maximum" |
| Invisibility | it | durationInfo.rounds | null | 600 |
| Levitate | it | durationInfo.kind | "conditional" | "maximum" |
| Levitate | it | durationInfo.rounds | null | 100 |
| Locate Object | it | durationInfo.kind | "conditional" | "maximum" |
| Locate Object | it | durationInfo.rounds | null | 100 |
| Magic Weapon | it | durationInfo.kind | "conditional" | "maximum" |
| Magic Weapon | it | durationInfo.rounds | null | 600 |
| Moonbeam | it | durationInfo.kind | "conditional" | "maximum" |
| Moonbeam | it | durationInfo.rounds | null | 10 |
| Pass Without Trace | it | durationInfo.kind | "conditional" | "maximum" |
| Pass Without Trace | it | durationInfo.rounds | null | 600 |
| Ray of Enfeeblement | it | durationInfo.kind | "conditional" | "maximum" |
| Ray of Enfeeblement | it | durationInfo.rounds | null | 10 |
| Silence | it | durationInfo.kind | "conditional" | "maximum" |
| Silence | it | durationInfo.rounds | null | 100 |
| Spider Climb | it | durationInfo.kind | "conditional" | "maximum" |
| Spider Climb | it | durationInfo.rounds | null | 600 |
| Spike Growth | it | durationInfo.kind | "conditional" | "maximum" |
| Spike Growth | it | durationInfo.rounds | null | 100 |
| Suggestion | it | durationInfo.kind | "conditional" | "maximum" |
| Suggestion | it | durationInfo.rounds | null | 4800 |
| Web | it | durationInfo.kind | "conditional" | "maximum" |
| Web | it | durationInfo.rounds | null | 600 |
| Beacon of Hope | it | durationInfo.kind | "conditional" | "maximum" |
| Beacon of Hope | it | durationInfo.rounds | null | 10 |
| Bestow Curse | it | durationInfo.kind | "conditional" | "maximum" |
| Bestow Curse | it | durationInfo.rounds | null | 10 |
| Call Lightning | it | durationInfo.kind | "conditional" | "maximum" |
| Call Lightning | it | durationInfo.rounds | null | 100 |
| Clairvoyance | it | durationInfo.kind | "conditional" | "maximum" |
| Clairvoyance | it | durationInfo.rounds | null | 100 |
| Conjure Animals | it | durationInfo.kind | "conditional" | "maximum" |
| Conjure Animals | it | durationInfo.rounds | null | 600 |
| Fear | it | durationInfo.kind | "conditional" | "maximum" |
| Fear | it | durationInfo.rounds | null | 10 |
| Fly | it | durationInfo.kind | "conditional" | "maximum" |
| Fly | it | durationInfo.rounds | null | 100 |
| Gaseous Form | it | durationInfo.kind | "conditional" | "maximum" |
| Gaseous Form | it | durationInfo.rounds | null | 600 |
| Haste | it | durationInfo.kind | "conditional" | "maximum" |
| Haste | it | durationInfo.rounds | null | 10 |
| Hypnotic Pattern | it | durationInfo.kind | "conditional" | "maximum" |
| Hypnotic Pattern | it | durationInfo.rounds | null | 10 |
| Major Image | it | durationInfo.kind | "conditional" | "maximum" |
| Major Image | it | durationInfo.rounds | null | 100 |
| Protection from Energy | it | durationInfo.kind | "conditional" | "maximum" |
| Protection from Energy | it | durationInfo.rounds | null | 600 |
| Sleet Storm | it | durationInfo.kind | "conditional" | "maximum" |
| Sleet Storm | it | durationInfo.rounds | null | 10 |
| Slow | it | durationInfo.kind | "conditional" | "maximum" |
| Slow | it | durationInfo.rounds | null | 10 |
| Spirit Guardians | it | durationInfo.kind | "conditional" | "maximum" |
| Spirit Guardians | it | durationInfo.rounds | null | 100 |
| Stinking Cloud | it | durationInfo.kind | "conditional" | "maximum" |
| Stinking Cloud | it | durationInfo.rounds | null | 10 |
| Vampiric Touch | it | durationInfo.kind | "conditional" | "maximum" |
| Vampiric Touch | it | durationInfo.rounds | null | 10 |
| Wind Wall | it | durationInfo.kind | "conditional" | "maximum" |
| Wind Wall | it | durationInfo.rounds | null | 10 |
| Arcane Eye | it | durationInfo.kind | "conditional" | "maximum" |
| Arcane Eye | it | durationInfo.rounds | null | 600 |
| Banishment | en | duration.testo | "Concentration, up to 1 minutes" | "Concentration, up to 1 minute" |
| Banishment | it | durationInfo.kind | "conditional" | "maximum" |
| Banishment | it | durationInfo.rounds | null | 10 |
| Compulsion | it | durationInfo.kind | "conditional" | "maximum" |
| Compulsion | it | durationInfo.rounds | null | 10 |
| Confusion | it | durationInfo.kind | "conditional" | "maximum" |
| Confusion | it | durationInfo.rounds | null | 10 |
| Conjure Minor Elementals | it | durationInfo.kind | "conditional" | "maximum" |
| Conjure Minor Elementals | it | durationInfo.rounds | null | 600 |
| Conjure Woodland Beings | it | durationInfo.kind | "conditional" | "maximum" |
| Conjure Woodland Beings | it | durationInfo.rounds | null | 600 |
| Control Water | it | durationInfo.kind | "conditional" | "maximum" |
| Control Water | it | durationInfo.rounds | null | 100 |
| Dominate Beast | it | durationInfo.kind | "conditional" | "maximum" |
| Dominate Beast | it | durationInfo.rounds | null | 10 |
| Evard's Black Tentacles | it | durationInfo.kind | "conditional" | "maximum" |
| Evard's Black Tentacles | it | durationInfo.rounds | null | 10 |
| Gate Seal | en | duration.testo | "24 hours" | "24 Hours" |
| Giant Insect | it | durationInfo.kind | "conditional" | "maximum" |
| Giant Insect | it | durationInfo.rounds | null | 100 |
| Greater Invisibility | it | durationInfo.kind | "conditional" | "maximum" |
| Greater Invisibility | it | durationInfo.rounds | null | 10 |
| Locate Creature | it | durationInfo.kind | "conditional" | "maximum" |
| Locate Creature | it | durationInfo.rounds | null | 600 |
| Otiluke's Resilient Sphere | it | durationInfo.kind | "conditional" | "maximum" |
| Otiluke's Resilient Sphere | it | durationInfo.rounds | null | 10 |
| Phantasmal Killer | it | durationInfo.kind | "conditional" | "maximum" |
| Phantasmal Killer | it | durationInfo.rounds | null | 10 |
| Polymorph | it | durationInfo.kind | "conditional" | "maximum" |
| Polymorph | it | durationInfo.rounds | null | 600 |
| Stoneskin | it | durationInfo.kind | "conditional" | "maximum" |
| Stoneskin | it | durationInfo.rounds | null | 600 |
| Wall of Fire | it | durationInfo.kind | "conditional" | "maximum" |
| Wall of Fire | it | durationInfo.rounds | null | 10 |
| Animate Objects | it | durationInfo.kind | "conditional" | "maximum" |
| Animate Objects | it | durationInfo.rounds | null | 10 |
| Antilife Shell | it | durationInfo.kind | "conditional" | "maximum" |
| Antilife Shell | it | durationInfo.rounds | null | 600 |
| Bigby's Hand | it | durationInfo.kind | "conditional" | "maximum" |
| Bigby's Hand | it | durationInfo.rounds | null | 10 |
| Cloudkill | it | durationInfo.kind | "conditional" | "maximum" |
| Cloudkill | it | durationInfo.rounds | null | 100 |
| Conjure Elemental | it | durationInfo.kind | "conditional" | "maximum" |
| Conjure Elemental | it | durationInfo.rounds | null | 600 |
| Dispel Evil and Good | it | durationInfo.kind | "conditional" | "maximum" |
| Dispel Evil and Good | it | durationInfo.rounds | null | 10 |
| Dominate Person | it | durationInfo.kind | "conditional" | "maximum" |
| Dominate Person | it | durationInfo.rounds | null | 10 |
| Hold Monster | it | durationInfo.kind | "conditional" | "maximum" |
| Hold Monster | it | durationInfo.rounds | null | 10 |
| Insect Plague | it | durationInfo.kind | "conditional" | "maximum" |
| Insect Plague | it | durationInfo.rounds | null | 100 |
| Mislead | it | durationInfo.kind | "conditional" | "maximum" |
| Mislead | it | durationInfo.rounds | null | 600 |
| Modify Memory | it | durationInfo.kind | "conditional" | "maximum" |
| Modify Memory | it | durationInfo.rounds | null | 10 |
| Scrying | it | durationInfo.kind | "conditional" | "maximum" |
| Scrying | it | durationInfo.rounds | null | 100 |
| Telekinesis | it | durationInfo.kind | "conditional" | "maximum" |
| Telekinesis | it | durationInfo.rounds | null | 100 |
| Transmute Rock | en | durationInfo.kind | "instantaneous" | "conditional" |
| Transmute Rock | en | durationInfo.rounds | 0 | null |
| Transmute Rock | en | duration | "Instantaneous" | "Until dispelled" |
| Tree Stride | it | durationInfo.kind | "conditional" | "maximum" |
| Tree Stride | it | durationInfo.rounds | null | 10 |
| Wall of Force | it | durationInfo.kind | "conditional" | "maximum" |
| Wall of Force | it | durationInfo.rounds | null | 100 |
| Wall of Stone | it | durationInfo.kind | "conditional" | "maximum" |
| Wall of Stone | it | durationInfo.rounds | null | 100 |
| Blade Barrier | it | durationInfo.kind | "conditional" | "maximum" |
| Blade Barrier | it | durationInfo.rounds | null | 100 |
| Conjure Fey | it | durationInfo.kind | "conditional" | "maximum" |
| Conjure Fey | it | durationInfo.rounds | null | 600 |
| Eyebite | it | durationInfo.kind | "conditional" | "maximum" |
| Eyebite | it | durationInfo.rounds | null | 10 |
| Find the Path | it | durationInfo.kind | "conditional" | "maximum" |
| Find the Path | it | durationInfo.rounds | null | 14400 |
| Flesh to Stone | it | durationInfo.kind | "conditional" | "maximum" |
| Flesh to Stone | it | durationInfo.rounds | null | 10 |
| Globe of Invulnerability | it | durationInfo.kind | "conditional" | "maximum" |
| Globe of Invulnerability | it | durationInfo.rounds | null | 10 |
| Harm | en | duration.testo | "Instantaneous" | "Instantanous" |
| Move Earth | it | durationInfo.kind | "conditional" | "maximum" |
| Move Earth | it | durationInfo.rounds | null | 1200 |
| Otto's Irresistible Dance | it | durationInfo.kind | "conditional" | "maximum" |
| Otto's Irresistible Dance | it | durationInfo.rounds | null | 10 |
| Sunbeam | it | durationInfo.kind | "conditional" | "maximum" |
| Sunbeam | it | durationInfo.rounds | null | 10 |
| Wall of Ice | it | durationInfo.kind | "conditional" | "maximum" |
| Wall of Ice | it | durationInfo.rounds | null | 100 |
| Wall of Thorns | it | durationInfo.kind | "conditional" | "maximum" |
| Wall of Thorns | it | durationInfo.rounds | null | 100 |
| Conjure Celestial | it | durationInfo.kind | "conditional" | "maximum" |
| Conjure Celestial | it | durationInfo.rounds | null | 600 |
| Delayed Blast Fireball | it | durationInfo.kind | "conditional" | "maximum" |
| Delayed Blast Fireball | it | durationInfo.rounds | null | 10 |
| Etherealness | it | durationInfo.kind | "conditional" | "maximum" |
| Etherealness | it | durationInfo.rounds | null | 4800 |
| Mordenkainen's Sword | it | durationInfo.kind | "conditional" | "maximum" |
| Mordenkainen's Sword | it | durationInfo.rounds | null | 10 |
| Project Image | it | durationInfo.kind | "conditional" | "maximum" |
| Project Image | it | durationInfo.rounds | null | 14400 |
| Reverse Gravity | it | durationInfo.kind | "conditional" | "maximum" |
| Reverse Gravity | it | durationInfo.rounds | null | 10 |
| Animal Shapes | it | durationInfo.kind | "conditional" | "maximum" |
| Animal Shapes | it | durationInfo.rounds | null | 14400 |
| Antimagic Field | it | durationInfo.kind | "conditional" | "maximum" |
| Antimagic Field | it | durationInfo.rounds | null | 600 |
| Antipathy/Sympathy | en | duration.testo | "10 Days" | "10 days" |
| Control Weather | it | durationInfo.kind | "conditional" | "maximum" |
| Control Weather | it | durationInfo.rounds | null | 4800 |
| Dominate Monster | it | durationInfo.kind | "conditional" | "maximum" |
| Dominate Monster | it | durationInfo.rounds | null | 600 |
| Earthquake | it | durationInfo.kind | "conditional" | "maximum" |
| Earthquake | it | durationInfo.rounds | null | 10 |
| Holy Aura | it | durationInfo.kind | "conditional" | "maximum" |
| Holy Aura | it | durationInfo.rounds | null | 10 |
| Incendiary Cloud | it | durationInfo.kind | "conditional" | "maximum" |
| Incendiary Cloud | it | durationInfo.rounds | null | 10 |
| Maze | it | durationInfo.kind | "conditional" | "maximum" |
| Maze | it | durationInfo.rounds | null | 100 |
| Gate | it | durationInfo.kind | "conditional" | "maximum" |
| Gate | it | durationInfo.rounds | null | 10 |
| Shapechange | it | durationInfo.kind | "conditional" | "maximum" |
| Shapechange | it | durationInfo.rounds | null | 600 |
| Storm of Vengeance | en | duration.testo | "Concentration up to 1 minute" | "Concentration, up to 1 minute" |
| Storm of Vengeance | it | durationInfo.kind | "conditional" | "maximum" |
| Storm of Vengeance | it | durationInfo.rounds | null | 10 |
| True Polymorph | it | durationInfo.kind | "conditional" | "maximum" |
| True Polymorph | it | durationInfo.rounds | null | 600 |
| Weird | it | durationInfo.kind | "conditional" | "maximum" |
| Weird | it | durationInfo.rounds | null | 10 |

## Incantesimi senza corrispondenza

| Incantesimo Wikidot | Lingua mancante | Fonte |
|---|---|---|
| Blade Ward | it | [pagina](https://dnd5e.wikidot.com/spell:blade-ward) |
| Booming Blade | it | [pagina](https://dnd5e.wikidot.com/spell:booming-blade) |
| Control Flames | it | [pagina](https://dnd5e.wikidot.com/spell:control-flames) |
| Create Bonfire | it | [pagina](https://dnd5e.wikidot.com/spell:create-bonfire) |
| Encode Thoughts | it | [pagina](https://dnd5e.wikidot.com/spell:encode-thoughts) |
| Friends | it | [pagina](https://dnd5e.wikidot.com/spell:friends) |
| Frostbite | it | [pagina](https://dnd5e.wikidot.com/spell:frostbite) |
| Green-Flame Blade | it | [pagina](https://dnd5e.wikidot.com/spell:green-flame-blade) |
| Gust | it | [pagina](https://dnd5e.wikidot.com/spell:gust) |
| Hand of Radiance (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:hand-of-radiance) |
| Infestation | it | [pagina](https://dnd5e.wikidot.com/spell:infestation) |
| Lightning Lure | it | [pagina](https://dnd5e.wikidot.com/spell:lightning-lure) |
| Magic Stone | it | [pagina](https://dnd5e.wikidot.com/spell:magic-stone) |
| Mind Sliver | it | [pagina](https://dnd5e.wikidot.com/spell:mind-sliver) |
| Mold Earth | it | [pagina](https://dnd5e.wikidot.com/spell:mold-earth) |
| On/Off (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:on-off) |
| Primal Savagery | it | [pagina](https://dnd5e.wikidot.com/spell:primal-savagery) |
| Sapping Sting | it | [pagina](https://dnd5e.wikidot.com/spell:sapping-sting) |
| Shape Water | it | [pagina](https://dnd5e.wikidot.com/spell:shape-water) |
| Sword Burst | it | [pagina](https://dnd5e.wikidot.com/spell:sword-burst) |
| Thorn Whip | it | [pagina](https://dnd5e.wikidot.com/spell:thorn-whip) |
| Thunderclap | it | [pagina](https://dnd5e.wikidot.com/spell:thunderclap) |
| Toll the Dead | it | [pagina](https://dnd5e.wikidot.com/spell:toll-the-dead) |
| Virtue (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:virtue) |
| Word of Radiance | it | [pagina](https://dnd5e.wikidot.com/spell:word-of-radiance) |
| Absorb Elements | it | [pagina](https://dnd5e.wikidot.com/spell:absorb-elements) |
| Acid Stream (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:acid-stream) |
| Arcane Weapon (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:arcane-weapon) |
| Armor of Agathys | it | [pagina](https://dnd5e.wikidot.com/spell:armor-of-agathys) |
| Arms of Hadar | it | [pagina](https://dnd5e.wikidot.com/spell:arms-of-hadar) |
| Beast Bond | it | [pagina](https://dnd5e.wikidot.com/spell:beast-bond) |
| Catapult | it | [pagina](https://dnd5e.wikidot.com/spell:catapult) |
| Cause Fear | it | [pagina](https://dnd5e.wikidot.com/spell:cause-fear) |
| Ceremony | it | [pagina](https://dnd5e.wikidot.com/spell:ceremony) |
| Chaos Bolt | it | [pagina](https://dnd5e.wikidot.com/spell:chaos-bolt) |
| Chromatic Orb | it | [pagina](https://dnd5e.wikidot.com/spell:chromatic-orb) |
| Compelled Duel | it | [pagina](https://dnd5e.wikidot.com/spell:compelled-duel) |
| Dissonant Whispers | it | [pagina](https://dnd5e.wikidot.com/spell:dissonant-whispers) |
| Distort Value | it | [pagina](https://dnd5e.wikidot.com/spell:distort-value) |
| Earth Tremor | it | [pagina](https://dnd5e.wikidot.com/spell:earth-tremor) |
| Ensnaring Strike | it | [pagina](https://dnd5e.wikidot.com/spell:ensnaring-strike) |
| Frost Fingers | it | [pagina](https://dnd5e.wikidot.com/spell:frost-fingers) |
| Gift of Alacrity | it | [pagina](https://dnd5e.wikidot.com/spell:gift-of-alacrity) |
| Guiding Hand (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:guiding-hand-ua) |
| Hail of Thorns | it | [pagina](https://dnd5e.wikidot.com/spell:hail-of-thorns) |
| Healing Elixir (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:healing-elixir-ua) |
| Hex | it | [pagina](https://dnd5e.wikidot.com/spell:hex) |
| Ice Knife | it | [pagina](https://dnd5e.wikidot.com/spell:ice-knife) |
| Id Insinuation (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:id-insinuation) |
| Infallible Relay (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:infallible-relay) |
| Jim's Magic Missile | it | [pagina](https://dnd5e.wikidot.com/spell:jims-magic-missile) |
| Magnify Gravity | it | [pagina](https://dnd5e.wikidot.com/spell:magnify-gravity) |
| Puppet (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:puppet) |
| Ray of Sickness | it | [pagina](https://dnd5e.wikidot.com/spell:ray-of-sickness) |
| Remote Access (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:remote-access) |
| Searing Smite | it | [pagina](https://dnd5e.wikidot.com/spell:searing-smite) |
| Sense Emotion (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:sense-emotion) |
| Silvery Barbs | it | [pagina](https://dnd5e.wikidot.com/spell:silvery-barbs) |
| Snare | it | [pagina](https://dnd5e.wikidot.com/spell:snare) |
| Sudden Awakening (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:sudden-awakening) |
| Tasha's Caustic Brew | it | [pagina](https://dnd5e.wikidot.com/spell:tashas-caustic-brew) |
| Thunderous Smite | it | [pagina](https://dnd5e.wikidot.com/spell:thunderous-smite) |
| Unearthly Chorus (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:unearthly-chorus) |
| Wild Cunning (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:wild-cunning) |
| Witch Bolt | it | [pagina](https://dnd5e.wikidot.com/spell:witch-bolt) |
| Wrathful Smite | it | [pagina](https://dnd5e.wikidot.com/spell:wrathful-smite) |
| Zephyr Strike | it | [pagina](https://dnd5e.wikidot.com/spell:zephyr-strike) |
| Aganazzar's Scorcher | it | [pagina](https://dnd5e.wikidot.com/spell:aganazzars-scorcher) |
| Air Bubble | it | [pagina](https://dnd5e.wikidot.com/spell:air-bubble) |
| Arcane Hacking (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:arcane-hacking) |
| Beast Sense | it | [pagina](https://dnd5e.wikidot.com/spell:beast-sense) |
| Borrowed Knowledge | it | [pagina](https://dnd5e.wikidot.com/spell:borrowed-knowledge) |
| Cloud of Daggers | it | [pagina](https://dnd5e.wikidot.com/spell:cloud-of-daggers) |
| Cordon of Arrows | it | [pagina](https://dnd5e.wikidot.com/spell:cordon-of-arrows) |
| Crown of Madness | it | [pagina](https://dnd5e.wikidot.com/spell:crown-of-madness) |
| Digital Phantom (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:digital-phantom) |
| Dragon's Breath | it | [pagina](https://dnd5e.wikidot.com/spell:dragons-breath) |
| Dust Devil | it | [pagina](https://dnd5e.wikidot.com/spell:dust-devil) |
| Earthbind | it | [pagina](https://dnd5e.wikidot.com/spell:earthbind) |
| Find Vehicle (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:find-vehicle) |
| Flock of Familiars | it | [pagina](https://dnd5e.wikidot.com/spell:flock-of-familiars) |
| Fortune's Favor | it | [pagina](https://dnd5e.wikidot.com/spell:fortunes-favor) |
| Gift of Gab | it | [pagina](https://dnd5e.wikidot.com/spell:gift-of-gab) |
| Healing Spirit | it | [pagina](https://dnd5e.wikidot.com/spell:healing-spirit) |
| Icingdeath's Frost (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:icingdeath-s-frost) |
| Immovable Object | it | [pagina](https://dnd5e.wikidot.com/spell:immovable-object) |
| Jim's Glowing Coin | it | [pagina](https://dnd5e.wikidot.com/spell:jims-glowing-coin) |
| Kinetic Jaunt | it | [pagina](https://dnd5e.wikidot.com/spell:kinetic-jaunt) |
| Maximillian's Earthen Grasp | it | [pagina](https://dnd5e.wikidot.com/spell:maximillians-earthen-grasp) |
| Mental Barrier (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:mental-barrier) |
| Mind Spike | it | [pagina](https://dnd5e.wikidot.com/spell:mind-spike) |
| Mind Thrust (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:mind-thrust) |
| Nathair's Mischief | it | [pagina](https://dnd5e.wikidot.com/spell:nathairs-mischief) |
| Nathair's Mischief (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:nathairs-mischief-ua) |
| Phantasmal Force | it | [pagina](https://dnd5e.wikidot.com/spell:phantasmal-force) |
| Pyrotechnics | it | [pagina](https://dnd5e.wikidot.com/spell:pyrotechnics) |
| Rime's Binding Ice | it | [pagina](https://dnd5e.wikidot.com/spell:rimes-binding-ice) |
| Shadow Blade | it | [pagina](https://dnd5e.wikidot.com/spell:shadow-blade) |
| Skywrite | it | [pagina](https://dnd5e.wikidot.com/spell:skywrite) |
| Snilloc's Snowball Swarm | it | [pagina](https://dnd5e.wikidot.com/spell:snillocs-snowball-swarm) |
| Spray Of Cards | it | [pagina](https://dnd5e.wikidot.com/spell:spray-of-cards) |
| Spray of Cards (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:spray-of-cards-ua) |
| Summon Beast | it | [pagina](https://dnd5e.wikidot.com/spell:summon-beast) |
| Tasha's Mind Whip | it | [pagina](https://dnd5e.wikidot.com/spell:tashas-mind-whip) |
| Thought Shield (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:thought-shield) |
| Vortex Warp | it | [pagina](https://dnd5e.wikidot.com/spell:vortex-warp) |
| Warding Wind | it | [pagina](https://dnd5e.wikidot.com/spell:warding-wind) |
| Warp Sense | it | [pagina](https://dnd5e.wikidot.com/spell:warp-sense) |
| Wither and Bloom | it | [pagina](https://dnd5e.wikidot.com/spell:wither-and-bloom) |
| Wristpocket | it | [pagina](https://dnd5e.wikidot.com/spell:wristpocket) |
| Antagonize | it | [pagina](https://dnd5e.wikidot.com/spell:antagonize) |
| Antagonize (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:antagonize-ua) |
| Ashardalon's Stride | it | [pagina](https://dnd5e.wikidot.com/spell:ashardalons-stride) |
| Aura of Vitality | it | [pagina](https://dnd5e.wikidot.com/spell:aura-of-vitality) |
| Blinding Smite | it | [pagina](https://dnd5e.wikidot.com/spell:blinding-smite) |
| Catnap | it | [pagina](https://dnd5e.wikidot.com/spell:catnap) |
| Conjure Barrage | it | [pagina](https://dnd5e.wikidot.com/spell:conjure-barrage) |
| Conjure Lesser Demon (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:conjure-lesser-demon) |
| Crusader's Mantle | it | [pagina](https://dnd5e.wikidot.com/spell:crusaders-mantle) |
| Elemental Weapon | it | [pagina](https://dnd5e.wikidot.com/spell:elemental-weapon) |
| Enemies Abound | it | [pagina](https://dnd5e.wikidot.com/spell:enemies-abound) |
| Erupting Earth | it | [pagina](https://dnd5e.wikidot.com/spell:erupting-earth) |
| Fast Friends | it | [pagina](https://dnd5e.wikidot.com/spell:fast-friends) |
| Feign Death | it | [pagina](https://dnd5e.wikidot.com/spell:feign-death) |
| Flame Arrows | it | [pagina](https://dnd5e.wikidot.com/spell:flame-arrows) |
| Flame Stride (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:flame-stride) |
| Galder's Tower | it | [pagina](https://dnd5e.wikidot.com/spell:galders-tower) |
| Haywire (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:haywire) |
| House of Cards (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:house-of-cards-ua) |
| Hunger Of Hadar | it | [pagina](https://dnd5e.wikidot.com/spell:hunger-of-hadar) |
| Incite Greed | it | [pagina](https://dnd5e.wikidot.com/spell:incite-greed) |
| Intellect Fortress | it | [pagina](https://dnd5e.wikidot.com/spell:intellect-fortress) |
| Invisibility To Cameras (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:invisibility-to-cameras) |
| Life Transference | it | [pagina](https://dnd5e.wikidot.com/spell:life-transference) |
| Lightning Arrow | it | [pagina](https://dnd5e.wikidot.com/spell:lightning-arrow) |
| Melf's Minute Meteors | it | [pagina](https://dnd5e.wikidot.com/spell:melfs-minute-meteors) |
| Motivational Speech | it | [pagina](https://dnd5e.wikidot.com/spell:motivational-speech) |
| Protection from Ballistics (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:protection-from-ballistics) |
| Psionic Blast (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:psionic-blast) |
| Pulse Wave | it | [pagina](https://dnd5e.wikidot.com/spell:pulse-wave) |
| Spirit Shroud | it | [pagina](https://dnd5e.wikidot.com/spell:spirit-shroud) |
| Summon Fey | it | [pagina](https://dnd5e.wikidot.com/spell:summon-fey) |
| Summon Lesser Demons | it | [pagina](https://dnd5e.wikidot.com/spell:summon-lesser-demons) |
| Summon Shadowspawn | it | [pagina](https://dnd5e.wikidot.com/spell:summon-shadowspawn) |
| Summon Undead | it | [pagina](https://dnd5e.wikidot.com/spell:summon-undead) |
| Summon Warrior Spirit (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:summon-warrior-spirit) |
| Thunder Step | it | [pagina](https://dnd5e.wikidot.com/spell:thunder-step) |
| Tidal Wave | it | [pagina](https://dnd5e.wikidot.com/spell:tidal-wave) |
| Tiny Servant | it | [pagina](https://dnd5e.wikidot.com/spell:tiny-servant) |
| Wall of Sand | it | [pagina](https://dnd5e.wikidot.com/spell:wall-of-sand) |
| Wall of Water | it | [pagina](https://dnd5e.wikidot.com/spell:wall-of-water) |
| Aura of Life | it | [pagina](https://dnd5e.wikidot.com/spell:aura-of-life) |
| Aura of Purity | it | [pagina](https://dnd5e.wikidot.com/spell:aura-of-purity) |
| Charm Monster | it | [pagina](https://dnd5e.wikidot.com/spell:charm-monster) |
| Conjure Barlgura (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:conjure-barlgura) |
| Conjure Knowbot (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:conjure-knowbot) |
| Conjure Shadow Demon (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:conjure-shadow-demon) |
| Ego Whip (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:ego-whip) |
| Elemental Bane | it | [pagina](https://dnd5e.wikidot.com/spell:elemental-bane) |
| Find Greater Steed | it | [pagina](https://dnd5e.wikidot.com/spell:find-greater-steed) |
| Galder's Speedy Courier | it | [pagina](https://dnd5e.wikidot.com/spell:galders-speedy-courier) |
| Gate Seal | it | [pagina](https://dnd5e.wikidot.com/spell:gate-seal) |
| Grasping Vine | it | [pagina](https://dnd5e.wikidot.com/spell:grasping-vine) |
| Gravity Sinkhole | it | [pagina](https://dnd5e.wikidot.com/spell:gravity-sinkhole) |
| Guardian of Nature | it | [pagina](https://dnd5e.wikidot.com/spell:guardian-of-nature) |
| Raulothim's Psychic Lance | it | [pagina](https://dnd5e.wikidot.com/spell:raulothims-psychic-lance) |
| Raulothim's Psychic Lance (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:raulothims-psychic-lance-ua) |
| Shadow Of Moil | it | [pagina](https://dnd5e.wikidot.com/spell:shadow-of-moil) |
| Sickening Radiance | it | [pagina](https://dnd5e.wikidot.com/spell:sickening-radiance) |
| Spirit Of Death | it | [pagina](https://dnd5e.wikidot.com/spell:spirit-of-death) |
| Spirit of Death (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:spirit-of-death-ua) |
| Staggering Smite | it | [pagina](https://dnd5e.wikidot.com/spell:staggering-smite) |
| Storm Sphere | it | [pagina](https://dnd5e.wikidot.com/spell:storm-sphere) |
| Summon Aberration | it | [pagina](https://dnd5e.wikidot.com/spell:summon-aberration) |
| Summon Construct | it | [pagina](https://dnd5e.wikidot.com/spell:summon-construct) |
| Summon Elemental | it | [pagina](https://dnd5e.wikidot.com/spell:summon-elemental) |
| Summon Greater Demon | it | [pagina](https://dnd5e.wikidot.com/spell:summon-greater-demon) |
| Synchronicity (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:synchronicity) |
| System Backdoor (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:system-backdoor) |
| Vitriolic Sphere | it | [pagina](https://dnd5e.wikidot.com/spell:vitriolic-sphere) |
| Watery Sphere | it | [pagina](https://dnd5e.wikidot.com/spell:watery-sphere) |
| Banishing Smite | it | [pagina](https://dnd5e.wikidot.com/spell:banishing-smite) |
| Circle of Power | it | [pagina](https://dnd5e.wikidot.com/spell:circle-of-power) |
| Commune with City (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:commune-with-city) |
| Conjure Volley | it | [pagina](https://dnd5e.wikidot.com/spell:conjure-volley) |
| Conjure Vrock (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:conjure-vrock) |
| Control Winds | it | [pagina](https://dnd5e.wikidot.com/spell:control-winds) |
| Create Spelljamming Helm | it | [pagina](https://dnd5e.wikidot.com/spell:create-spelljamming-helm) |
| Danse Macabre | it | [pagina](https://dnd5e.wikidot.com/spell:danse-macabre) |
| Dawn | it | [pagina](https://dnd5e.wikidot.com/spell:dawn) |
| Destructive Wave | it | [pagina](https://dnd5e.wikidot.com/spell:destructive-wave) |
| Enervation | it | [pagina](https://dnd5e.wikidot.com/spell:enervation) |
| Far Step | it | [pagina](https://dnd5e.wikidot.com/spell:far-step) |
| Holy Weapon | it | [pagina](https://dnd5e.wikidot.com/spell:holy-weapon) |
| Immolation | it | [pagina](https://dnd5e.wikidot.com/spell:immolation) |
| Infernal Calling | it | [pagina](https://dnd5e.wikidot.com/spell:infernal-calling) |
| Maelstrom | it | [pagina](https://dnd5e.wikidot.com/spell:maelstrom) |
| Negative Energy Flood | it | [pagina](https://dnd5e.wikidot.com/spell:negative-energy-flood) |
| Shutdown (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:shutdown) |
| Skill Empowerment | it | [pagina](https://dnd5e.wikidot.com/spell:skill-empowerment) |
| Steel Wind Strike | it | [pagina](https://dnd5e.wikidot.com/spell:steel-wind-strike) |
| Summon Celestial | it | [pagina](https://dnd5e.wikidot.com/spell:summon-celestial) |
| Summon Draconic Spirit | it | [pagina](https://dnd5e.wikidot.com/spell:summon-draconic-spirit) |
| Summon Draconic Spirit (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:summon-draconic-spirit-ua) |
| Swift Quiver | it | [pagina](https://dnd5e.wikidot.com/spell:swift-quiver) |
| Synaptic Static | it | [pagina](https://dnd5e.wikidot.com/spell:synaptic-static) |
| Temporal Shunt | it | [pagina](https://dnd5e.wikidot.com/spell:temporal-shunt) |
| Transmute Rock | it | [pagina](https://dnd5e.wikidot.com/spell:transmute-rock) |
| Wall of Light | it | [pagina](https://dnd5e.wikidot.com/spell:wall-of-light) |
| Wrath Of Nature | it | [pagina](https://dnd5e.wikidot.com/spell:wrath-of-nature) |
| Arcane Gate | it | [pagina](https://dnd5e.wikidot.com/spell:arcane-gate) |
| Bones of the Earth | it | [pagina](https://dnd5e.wikidot.com/spell:bones-of-the-earth) |
| Create Homunculus | it | [pagina](https://dnd5e.wikidot.com/spell:create-homunculus) |
| Druid Grove | it | [pagina](https://dnd5e.wikidot.com/spell:druid-grove) |
| Fizban's Platinum Shield | it | [pagina](https://dnd5e.wikidot.com/spell:fizbans-platinum-shield) |
| Fizban's Platinum Shield (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:fizban-s-platinum-shield-ua) |
| Gravity Fissure | it | [pagina](https://dnd5e.wikidot.com/spell:gravity-fissure) |
| Investiture of Flame | it | [pagina](https://dnd5e.wikidot.com/spell:investiture-of-flame) |
| Investiture of Ice | it | [pagina](https://dnd5e.wikidot.com/spell:investiture-of-ice) |
| Investiture of Stone | it | [pagina](https://dnd5e.wikidot.com/spell:investiture-of-stone) |
| Investiture of Wind | it | [pagina](https://dnd5e.wikidot.com/spell:investiture-of-wind) |
| Mental Prison | it | [pagina](https://dnd5e.wikidot.com/spell:mental-prison) |
| Otherworldly Form (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:otherworldly-form) |
| Primordial Ward | it | [pagina](https://dnd5e.wikidot.com/spell:primordial-ward) |
| Psychic Crush (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:psychic-crush) |
| Scatter | it | [pagina](https://dnd5e.wikidot.com/spell:scatter) |
| Soul Cage | it | [pagina](https://dnd5e.wikidot.com/spell:soul-cage) |
| Summon Fiend | it | [pagina](https://dnd5e.wikidot.com/spell:summon-fiend) |
| Tasha's Otherworldly Guise | it | [pagina](https://dnd5e.wikidot.com/spell:tashas-otherworldly-guise) |
| Tenser's Transformation | it | [pagina](https://dnd5e.wikidot.com/spell:tensers-transformation) |
| Conjure Hezrou (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:conjure-hezrou) |
| Create Magen | it | [pagina](https://dnd5e.wikidot.com/spell:create-magen) |
| Crown of Stars | it | [pagina](https://dnd5e.wikidot.com/spell:crown-of-stars) |
| Draconic Transformation | it | [pagina](https://dnd5e.wikidot.com/spell:draconic-transformation) |
| Draconic Transformation (UA) | it | [pagina](https://dnd5e.wikidot.com/spell:draconic-transformation-ua) |
| Dream of the Blue Veil | it | [pagina](https://dnd5e.wikidot.com/spell:dream-of-the-blue-veil) |
| Power Word: Pain | it | [pagina](https://dnd5e.wikidot.com/spell:power-word-pain) |
| Temple of the Gods | it | [pagina](https://dnd5e.wikidot.com/spell:temple-of-the-gods) |
| Tether Essence | it | [pagina](https://dnd5e.wikidot.com/spell:tether-essence) |
| Whirlwind | it | [pagina](https://dnd5e.wikidot.com/spell:whirlwind) |
| Abi-Dalzim's Horrid Wilting | it | [pagina](https://dnd5e.wikidot.com/spell:abi-dalzims-horrid-wilting) |
| Dark Star | it | [pagina](https://dnd5e.wikidot.com/spell:dark-star) |
| Illusory Dragon | it | [pagina](https://dnd5e.wikidot.com/spell:illusory-dragon) |
| Maddening Darkness | it | [pagina](https://dnd5e.wikidot.com/spell:maddening-darkness) |
| Mighty Fortress | it | [pagina](https://dnd5e.wikidot.com/spell:mighty-fortress) |
| Reality Break | it | [pagina](https://dnd5e.wikidot.com/spell:reality-break) |
| Telepathy | it | [pagina](https://dnd5e.wikidot.com/spell:telepathy) |
| Tsunami | it | [pagina](https://dnd5e.wikidot.com/spell:tsunami) |
| Blade of Disaster | it | [pagina](https://dnd5e.wikidot.com/spell:blade-of-disaster) |
| Invulnerability | it | [pagina](https://dnd5e.wikidot.com/spell:invulnerability) |
| Mass Polymorph | it | [pagina](https://dnd5e.wikidot.com/spell:mass-polymorph) |
| Power Word: Heal | it | [pagina](https://dnd5e.wikidot.com/spell:power-word-heal) |
| Psychic Scream | it | [pagina](https://dnd5e.wikidot.com/spell:psychic-scream) |
| Ravenous Void | it | [pagina](https://dnd5e.wikidot.com/spell:ravenous-void) |
| Time Ravage | it | [pagina](https://dnd5e.wikidot.com/spell:time-ravage) |

## Voci database fuori dall’indice

Nessuna.

## Casi che richiedono gestione specifica

Le voci seguenti dipendono da altre magie/statistiche oppure richiedono di separare l’uso dell’effetto dalla scadenza del contatore. Questa segnalazione non applica modifiche all’app.

- **True Strike**: Separare uso dell’effetto e scadenza prima di applicare il default del contatore.
- **Absorb Elements**: Separare uso dell’effetto e scadenza prima di applicare il default del contatore.
- **Command**: Separare uso dell’effetto e scadenza prima di applicare il default del contatore.
- **Conjure Animals**: Effetto dipendente da altra magia o da statistiche di creatura, non determinabile dal solo lancio base.
- **Conjure Lesser Demon (UA)**: Effetto dipendente da altra magia o da statistiche di creatura, non determinabile dal solo lancio base.
- **Glyph of Warding**: Effetto dipendente da altra magia o da statistiche di creatura, non determinabile dal solo lancio base.
- **Conjure Barlgura (UA)**: Effetto dipendente da altra magia o da statistiche di creatura, non determinabile dal solo lancio base.
- **Conjure Knowbot (UA)**: Effetto dipendente da altra magia o da statistiche di creatura, non determinabile dal solo lancio base.
- **Conjure Minor Elementals**: Effetto dipendente da altra magia o da statistiche di creatura, non determinabile dal solo lancio base.
- **Conjure Shadow Demon (UA)**: Effetto dipendente da altra magia o da statistiche di creatura, non determinabile dal solo lancio base.
- **Conjure Woodland Beings**: Effetto dipendente da altra magia o da statistiche di creatura, non determinabile dal solo lancio base.
- **Polymorph**: Effetto dipendente da altra magia o da statistiche di creatura, non determinabile dal solo lancio base.
- **Conjure Elemental**: Effetto dipendente da altra magia o da statistiche di creatura, non determinabile dal solo lancio base.
- **Conjure Vrock (UA)**: Effetto dipendente da altra magia o da statistiche di creatura, non determinabile dal solo lancio base.
- **Conjure Fey**: Effetto dipendente da altra magia o da statistiche di creatura, non determinabile dal solo lancio base.
- **Contingency**: Effetto dipendente da altra magia o da statistiche di creatura, non determinabile dal solo lancio base.
- **Conjure Celestial**: Effetto dipendente da altra magia o da statistiche di creatura, non determinabile dal solo lancio base.
- **Conjure Hezrou (UA)**: Effetto dipendente da altra magia o da statistiche di creatura, non determinabile dal solo lancio base.
- **Simulacrum**: Effetto dipendente da altra magia o da statistiche di creatura, non determinabile dal solo lancio base.
- **Shapechange**: Effetto dipendente da altra magia o da statistiche di creatura, non determinabile dal solo lancio base.
- **True Polymorph**: Effetto dipendente da altra magia o da statistiche di creatura, non determinabile dal solo lancio base.
- **Wish**: Effetto dipendente da altra magia o da statistiche di creatura, non determinabile dal solo lancio base.

## Criterio di confronto

Corrispondenza per nome inglese normalizzato con gli alias SRD già verificati in `scripts/sync_spells.py`. Nessun abbinamento approssimativo; versioni UA distinte. Le durate italiane sono confrontate tramite round, tipo e concentrazione, senza segnalare la semplice differenza di lingua. La caratteristica SRD, se presente, è confrontata con le caratteristiche dei TS della pagina.
