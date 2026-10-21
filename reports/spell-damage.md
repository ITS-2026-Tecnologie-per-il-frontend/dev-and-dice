# Audit del danno degli incantesimi

Rigenerazione: `python scripts/audit_spell_damage.py`. Controllo: `python scripts/audit_spell_damage.py --check`.

Il campo Danno è una sintesi informativa: non determina automaticamente bersagli, tiri, danni o consumo di risorse.

Le chiavi `2014:phb2014:spell:*` rimandano allo stesso identificativo in `public/data/rules2014/verified-reference.json`, dove sono conservate fonti PDF, pagine e verifiche. Le altre chiavi mantengono l’edizione esplicita oppure `unclassified`; non certificano regole 2024.

Il catalogo attuale non contiene record confermati 2024. Le 319 traduzioni italiane condividono la stessa sintesi dell’identità inglese, senza duplicare i risultati. Il payload verificato e RELEASE.json non sono modificati.

Discrepanza rilevata: la vecchia descrizione italiana di Muro di Ghiaccio indica +1d8 per entrambi i danni; il record verificato riporta +2d6 alla comparsa e +1d6 all’aria gelida. La sintesi segue il record verificato.

Controlli sulle fonti locali: D&D_5_Player_Original_Handbook.pdf, pagine PDF 242–243 (Fireball), 258 (Magic Missile), 271 (Protection from Evil and Good), 286 (Wall of Ice).

| Stato | Incantesimi distinti |
| --- | ---: |
| Danno noto o dipendente da una scelta esplicita | 141 |
| Nessun danno | 217 |
| Da verificare | 216 |

## Da verificare

| Identificativo | Incantesimo | Motivo |
| --- | --- | --- |
| `2014:phb2014:spell:magic-missile` | Dardo Incantato | La formula per dardo è verificata; resta aperta l’interpretazione sul numero di tiri del danno. |
| `2014:phb2014:spell:mirage-arcane` | Miraggio Arcano | Da verificare: eventuali danni dipendono dal terreno e dall’interazione con l’illusione; nessuna formula fissa nel record. |
| `2014:phb2014:spell:reverse-gravity` | Inversione della Gravità | Da verificare: possibili danni da caduta dipendono da altezza e ostacoli; nessuna formula di danno specifica nel record. |
| `unclassified:abi-dalzims-horrid-wilting` | Abi-Dalzim's Horrid Wilting | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:absorb-elements` | Absorb Elements | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:acid-stream` | Acid Stream (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:aganazzars-scorcher` | Aganazzar's Scorcher | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:air-bubble` | Air Bubble | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:antagonize` | Antagonize | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:antagonize-ua` | Antagonize (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:arcane-hacking` | Arcane Hacking (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:arcane-weapon` | Arcane Weapon (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:ashardalons-stride` | Ashardalon's Stride | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:beast-bond` | Beast Bond | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:blade-of-disaster` | Blade of Disaster | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:bones-of-the-earth` | Bones of the Earth | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:booming-blade` | Booming Blade | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:borrowed-knowledge` | Borrowed Knowledge | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:catapult` | Catapult | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:catnap` | Catnap | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:cause-fear` | Cause Fear | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:ceremony` | Ceremony | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:chaos-bolt` | Chaos Bolt | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:charm-monster` | Charm Monster | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:commune-with-city` | Commune with City (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:conjure-barlgura` | Conjure Barlgura (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:conjure-hezrou` | Conjure Hezrou (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:conjure-knowbot` | Conjure Knowbot (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:conjure-lesser-demon` | Conjure Lesser Demon (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:conjure-shadow-demon` | Conjure Shadow Demon (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:conjure-vrock` | Conjure Vrock (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:control-flames` | Control Flames | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:control-winds` | Control Winds | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:create-bonfire` | Create Bonfire | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:create-homunculus` | Create Homunculus | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:create-magen` | Create Magen | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:create-spelljamming-helm` | Create Spelljamming Helm | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:crown-of-stars` | Crown of Stars | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:danse-macabre` | Danse Macabre | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:dark-star` | Dark Star | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:dawn` | Dawn | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:digital-phantom` | Digital Phantom (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:distort-value` | Distort Value | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:draconic-transformation` | Draconic Transformation | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:draconic-transformation-ua` | Draconic Transformation (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:dragons-breath` | Dragon's Breath | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:dream-of-the-blue-veil` | Dream of the Blue Veil | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:druid-grove` | Druid Grove | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:dust-devil` | Dust Devil | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:earth-tremor` | Earth Tremor | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:earthbind` | Earthbind | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:ego-whip` | Ego Whip (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:elemental-bane` | Elemental Bane | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:encode-thoughts` | Encode Thoughts | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:enemies-abound` | Enemies Abound | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:enervation` | Enervation | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:erupting-earth` | Erupting Earth | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:far-step` | Far Step | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:fast-friends` | Fast Friends | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:find-greater-steed` | Find Greater Steed | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:find-vehicle` | Find Vehicle (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:fizban-s-platinum-shield-ua` | Fizban's Platinum Shield (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:fizbans-platinum-shield` | Fizban's Platinum Shield | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:flame-arrows` | Flame Arrows | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:flame-stride` | Flame Stride (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:flock-of-familiars` | Flock of Familiars | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:fortunes-favor` | Fortune's Favor | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:frost-fingers` | Frost Fingers | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:frostbite` | Frostbite | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:galders-speedy-courier` | Galder's Speedy Courier | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:galders-tower` | Galder's Tower | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:gate-seal` | Gate Seal | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:gift-of-alacrity` | Gift of Alacrity | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:gift-of-gab` | Gift of Gab | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:gravity-fissure` | Gravity Fissure | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:gravity-sinkhole` | Gravity Sinkhole | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:green-flame-blade` | Green-Flame Blade | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:guardian-of-nature` | Guardian of Nature | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:guiding-hand-ua` | Guiding Hand (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:gust` | Gust | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:hand-of-radiance` | Hand of Radiance (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:haywire` | Haywire (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:healing-elixir-ua` | Healing Elixir (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:healing-spirit` | Healing Spirit | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:holy-weapon` | Holy Weapon | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:house-of-cards-ua` | House of Cards (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:ice-knife` | Ice Knife | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:icingdeath-s-frost` | Icingdeath's Frost (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:id-insinuation` | Id Insinuation (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:illusory-dragon` | Illusory Dragon | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:immolation` | Immolation | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:immovable-object` | Immovable Object | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:incite-greed` | Incite Greed | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:infallible-relay` | Infallible Relay (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:infernal-calling` | Infernal Calling | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:infestation` | Infestation | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:intellect-fortress` | Intellect Fortress | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:investiture-of-flame` | Investiture of Flame | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:investiture-of-ice` | Investiture of Ice | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:investiture-of-stone` | Investiture of Stone | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:investiture-of-wind` | Investiture of Wind | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:invisibility-to-cameras` | Invisibility To Cameras (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:invulnerability` | Invulnerability | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:jims-glowing-coin` | Jim's Glowing Coin | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:jims-magic-missile` | Jim's Magic Missile | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:kinetic-jaunt` | Kinetic Jaunt | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:life-transference` | Life Transference | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:lightning-lure` | Lightning Lure | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:maddening-darkness` | Maddening Darkness | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:maelstrom` | Maelstrom | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:magic-stone` | Magic Stone | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:magnify-gravity` | Magnify Gravity | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:mass-polymorph` | Mass Polymorph | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:maximillians-earthen-grasp` | Maximillian's Earthen Grasp | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:melfs-minute-meteors` | Melf's Minute Meteors | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:mental-barrier` | Mental Barrier (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:mental-prison` | Mental Prison | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:mighty-fortress` | Mighty Fortress | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:mind-sliver` | Mind Sliver | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:mind-spike` | Mind Spike | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:mind-thrust` | Mind Thrust (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:mold-earth` | Mold Earth | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:motivational-speech` | Motivational Speech | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:nathairs-mischief` | Nathair's Mischief | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:nathairs-mischief-ua` | Nathair's Mischief (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:negative-energy-flood` | Negative Energy Flood | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:on-off` | On/Off (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:otherworldly-form` | Otherworldly Form (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:power-word-pain` | Power Word: Pain | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:primal-savagery` | Primal Savagery | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:primordial-ward` | Primordial Ward | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:protection-from-ballistics` | Protection from Ballistics (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:psionic-blast` | Psionic Blast (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:psychic-crush` | Psychic Crush (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:psychic-scream` | Psychic Scream | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:pulse-wave` | Pulse Wave | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:puppet` | Puppet (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:pyrotechnics` | Pyrotechnics | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:raulothims-psychic-lance` | Raulothim's Psychic Lance | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:raulothims-psychic-lance-ua` | Raulothim's Psychic Lance (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:ravenous-void` | Ravenous Void | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:reality-break` | Reality Break | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:remote-access` | Remote Access (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:rimes-binding-ice` | Rime's Binding Ice | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:sapping-sting` | Sapping Sting | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:scatter` | Scatter | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:sense-emotion` | Sense Emotion (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:shadow-blade` | Shadow Blade | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:shadow-of-moil` | Shadow Of Moil | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:shape-water` | Shape Water | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:shutdown` | Shutdown (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:sickening-radiance` | Sickening Radiance | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:silvery-barbs` | Silvery Barbs | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:skill-empowerment` | Skill Empowerment | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:skywrite` | Skywrite | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:snare` | Snare | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:snillocs-snowball-swarm` | Snilloc's Snowball Swarm | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:soul-cage` | Soul Cage | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:spirit-of-death` | Spirit Of Death | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:spirit-of-death-ua` | Spirit of Death (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:spirit-shroud` | Spirit Shroud | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:spray-of-cards` | Spray Of Cards | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:spray-of-cards-ua` | Spray of Cards (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:steel-wind-strike` | Steel Wind Strike | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:storm-sphere` | Storm Sphere | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:sudden-awakening` | Sudden Awakening (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:summon-aberration` | Summon Aberration | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:summon-beast` | Summon Beast | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:summon-celestial` | Summon Celestial | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:summon-construct` | Summon Construct | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:summon-draconic-spirit` | Summon Draconic Spirit | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:summon-draconic-spirit-ua` | Summon Draconic Spirit (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:summon-elemental` | Summon Elemental | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:summon-fey` | Summon Fey | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:summon-fiend` | Summon Fiend | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:summon-greater-demon` | Summon Greater Demon | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:summon-lesser-demons` | Summon Lesser Demons | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:summon-shadowspawn` | Summon Shadowspawn | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:summon-undead` | Summon Undead | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:summon-warrior-spirit` | Summon Warrior Spirit (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:sword-burst` | Sword Burst | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:synaptic-static` | Synaptic Static | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:synchronicity` | Synchronicity (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:system-backdoor` | System Backdoor (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:tashas-caustic-brew` | Tasha's Caustic Brew | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:tashas-mind-whip` | Tasha's Mind Whip | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:tashas-otherworldly-guise` | Tasha's Otherworldly Guise | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:temple-of-the-gods` | Temple of the Gods | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:temporal-shunt` | Temporal Shunt | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:tensers-transformation` | Tenser's Transformation | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:tether-essence` | Tether Essence | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:thought-shield` | Thought Shield (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:thunder-step` | Thunder Step | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:thunderclap` | Thunderclap | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:tidal-wave` | Tidal Wave | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:time-ravage` | Time Ravage | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:tiny-servant` | Tiny Servant | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:toll-the-dead` | Toll the Dead | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:transmute-rock` | Transmute Rock | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:unearthly-chorus` | Unearthly Chorus (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:virtue` | Virtue (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:vitriolic-sphere` | Vitriolic Sphere | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:vortex-warp` | Vortex Warp | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:wall-of-light` | Wall of Light | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:wall-of-sand` | Wall of Sand | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:wall-of-water` | Wall of Water | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:warding-wind` | Warding Wind | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:warp-sense` | Warp Sense | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:watery-sphere` | Watery Sphere | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:whirlwind` | Whirlwind | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:wild-cunning` | Wild Cunning (UA) | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:wither-and-bloom` | Wither and Bloom | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:word-of-radiance` | Word of Radiance | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:wrath-of-nature` | Wrath Of Nature | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:wristpocket` | Wristpocket | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
| `unclassified:zephyr-strike` | Zephyr Strike | Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione. |
