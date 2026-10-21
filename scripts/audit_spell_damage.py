#!/usr/bin/env python3
"""Regenerate the spell damage index: python scripts/audit_spell_damage.py [--check]."""
import argparse
import hashlib
import json
from pathlib import Path

from json_utils import write_json
from sync_spells import spell_key

ROOT = Path(__file__).resolve().parents[1]
REFERENCE = ROOT / 'public/data/rules2014/verified-reference.json'
CATALOG = ROOT / 'public/data/database.json'
OUTPUT = ROOT / 'src/domain/dnd/spell-damage.json'
REPORT = ROOT / 'reports/spell-damage.md'
REVIEWED_REFERENCE_SHA256 = '851f63389168ffa9caa84b32650beaa996ac19b7a823fb2c63b55aa96143b88d'

# Reviewed against the existing descriptions, mechanics.effect and mechanics.upcast.
# These are display summaries, not executable damage or combat automation.
BASE = {
    'acid-splash': '1d6 acido per bersaglio; TS Destrezza: nessun danno con successo.',
    'alter-self': 'Solo armi naturali: dado base 1d6 e bonus +1 ai danni; aggiungi il normale modificatore del colpo.',
    'animate-objects': 'Per colpo di un oggetto: Minuscolo 1d4 + 4; Piccolo 1d8 + 2; Medio 2d6 + 1; Grande 2d10 + 2; Enorme 2d12 + 4. Contundente, oppure tipo stabilito dal DM per la forma dell’oggetto.',
    'armor-of-agathys': '5 freddo a chi ti colpisce con un attacco in mischia, finché conservi i PF temporanei di questa magia; nessun TS.',
    'arms-of-hadar': '2d6 necrotico per creatura nell’area; TS Forza: metà con successo.',
    'banishing-smite': '+5d10 forza al prossimo colpo con arma contro una creatura, prima che termini la magia.',
    'bestow-curse': 'Solo opzione danno della maledizione: +1d8 necrotico quando un tuo attacco o incantesimo infligge danni al bersaglio maledetto; la maledizione richiede prima un TS Saggezza fallito.',
    'bigby-s-hand': 'Pugno: 4d8 forza per colpo, al lancio o con successive azioni bonus. Stritolamento: 2d6 + modificatore da incantatore contundente alla creatura afferrata, usando un’azione bonus.',
    'blade-barrier': '6d10 tagliente per creatura al primo ingresso in un turno o all’inizio del proprio turno nel muro; TS Destrezza: metà con successo.',
    'blight': '8d8 necrotico per bersaglio; TS Costituzione: metà con successo. Nessun effetto su non morti e costrutti; piante magiche e creature vegetali subiscono il massimo dei dadi e hanno svantaggio al TS.',
    'blinding-smite': '+3d8 radioso al prossimo colpo con arma in mischia; il TS Costituzione riguarda la cecità, non riduce questi danni.',
    'branding-smite': '+2d6 radioso al prossimo colpo con arma contro una creatura, prima che termini la magia.',
    'burning-hands': '3d6 fuoco per creatura nel cono; TS Destrezza: metà con successo.',
    'call-lightning': '3d10 fulmine per creatura entro 1,5 m dal punto colpito; TS Destrezza: metà con successo. Un fulmine al lancio e altri con la tua azione nei turni successivi. +1d10 se controlli una tempesta già presente all’aperto.',
    'chain-lightning': '10d8 fulmine per bersaglio, fino a 4 bersagli distinti; TS Destrezza: metà con successo. Ogni bersaglio è colpito una sola volta.',
    'chill-touch': '1d8 necrotico per colpo con attacco magico a distanza.',
    'chromatic-orb': '3d8 per colpo con attacco magico a distanza; scegli acido, freddo, fuoco, fulmine, veleno o tuono.',
    'circle-of-death': '8d6 necrotico per creatura nell’area; TS Costituzione: metà con successo.',
    'cloud-of-daggers': '4d4 tagliente per creatura al primo ingresso in un turno o all’inizio del proprio turno nell’area; nessun TS.',
    'cloudkill': '5d8 veleno per creatura al primo ingresso in un turno o all’inizio del proprio turno nella nube; TS Costituzione: metà con successo, anche se non respira.',
    'cone-of-cold': '8d8 freddo per creatura nel cono; TS Costituzione: metà con successo.',
    'conjure-barrage': '3d8 per creatura nel cono, dello stesso tipo dell’arma o munizione usata; TS Destrezza: metà con successo.',
    'conjure-volley': '8d8 per creatura nell’area, dello stesso tipo dell’arma o munizione usata; TS Destrezza: metà con successo.',
    'contact-other-plane': '6d6 psichico all’incantatore soltanto se fallisce il TS Intelligenza CD 15 del contatto.',
    'control-water': 'Solo Vortice: 2d8 contundente al primo ingresso di una creatura nel vortice in un turno e all’inizio dei suoi turni al suo interno; TS Forza: metà con successo. Gli oggetti subiscono 2d8 al primo ingresso nel turno e a ogni round nel vortice.',
    'cordon-of-arrows': '1d6 perforante per proiettile attivato dal primo ingresso di una creatura in un turno o dal suo fine turno nell’area; TS Destrezza: nessun danno con successo. 4 proiettili al livello base.',
    'crusader-s-mantle': '+1d4 radioso per colpo con arma delle creature non ostili nell’aura, incluso l’incantatore.',
    'delayed-blast-fireball': 'Esplosione: 12d6 fuoco per creatura; TS Destrezza: metà con successo. Accumulo: +1d6 a ogni fine del tuo turno prima dell’esplosione.',
    'destructive-wave': '5d6 tuono + 5d6 radioso oppure necrotico per creatura scelta nell’area; TS Costituzione: metà con successo.',
    'dimension-door': '4d6 forza a ciascun viaggiatore solo se la destinazione è occupata; in quel caso il teletrasporto fallisce.',
    'disintegrate': '10d6 + 40 forza al bersaglio creatura; TS Destrezza: nessun danno con successo. La distruzione di oggetti e forza magica segue l’effetto descritto, senza usare questa formula.',
    'dissonant-whispers': '3d6 psichico per bersaglio; TS Saggezza: metà con successo.',
    'divine-favor': '+1d4 radioso per ogni tuo colpo con arma durante la durata.',
    'dream': 'Solo variante incubo: 3d6 psichico al risveglio se il bersaglio fallisce il TS Saggezza. Nessun danno nella comunicazione normale.',
    'earthquake': 'Strutture: 50 contundente al lancio e a fine di ogni tuo turno. Crolli: 5d6 contundente alle creature vicine; TS Destrezza: metà con successo. Eventuali cadute nelle fenditure dipendono dalla profondità.',
    'eldritch-blast': '1d10 forza per raggio che colpisce, con un attacco magico a distanza separato per ciascun raggio.',
    'elemental-weapon': '+1d4 elementale e bonus +1 ai danni dell’arma per colpo; scegli acido, freddo, fuoco, fulmine o tuono.',
    'enlarge-reduce': 'Ingrandire: +1d4 ai danni dell’arma per colpo. Ridurre: −1d4 ai danni dell’arma per colpo, senza scendere sotto 1 danno totale.',
    'ensnaring-strike': 'Continuato: 1d6 perforante all’inizio di ogni turno del bersaglio trattenuto. Per essere trattenuto deve prima subire il colpo con arma e fallire il TS Forza.',
    'etherealness': 'Al ritorno nel piano di origine, solo se lo spazio è occupato: 2 danni da forza per ogni piede di spostamento forzato fino al più vicino spazio libero. Nessun danno durante il normale transito.',
    'evard-s-black-tentacles': '3d6 contundente al primo ingresso nel turno o all’inizio del proprio turno, se fallisce il TS Destrezza. Se già trattenuto dai tentacoli: 3d6 a inizio turno senza nuovo TS.',
    'feeblemind': '4d6 psichico al bersaglio; il TS Intelligenza riguarda gli altri effetti e non evita o dimezza questi danni.',
    'finger-of-death': '7d8 + 30 necrotico per bersaglio; TS Costituzione: metà con successo.',
    'fireball': '8d6 fuoco per creatura nell’area; TS Destrezza: metà con successo.',
    'fire-bolt': '1d10 fuoco per colpo con attacco magico a distanza.',
    'fire-shield': '2d8 fuoco (scudo caldo) oppure freddo (scudo freddo) a chi ti colpisce in mischia entro 1,5 m; nessun TS e nessuna reazione richiesta.',
    'fire-storm': '7d10 fuoco per creatura nell’area; TS Destrezza: metà con successo.',
    'flame-blade': '3d6 fuoco per colpo con attacco magico in mischia, usando la tua azione mentre la lama è attiva.',
    'flame-strike': '4d6 fuoco + 4d6 radioso per creatura nell’area; TS Destrezza: metà con successo.',
    'flaming-sphere': '2d6 fuoco quando la sfera urta una creatura oppure quando una creatura termina il turno entro 1,5 m; TS Destrezza: metà con successo. L’urto usa l’azione bonus di movimento della sfera.',
    'forbiddance': '5d10 radioso o necrotico, a scelta al lancio, alle creature dei tipi designati al primo ingresso in un turno o a inizio turno nell’area; nessun TS. La parola d’ordine evita il danno.',
    'geas': '5d10 psichico quando il bersaglio agisce direttamente contro l’ordine, al massimo una volta al giorno. Il TS Saggezza iniziale determina se la magia si applica.',
    'glyph-of-warding': 'Rune esplosive: 5d8 acido, freddo, fuoco, fulmine o tuono per creatura all’attivazione; TS Destrezza: metà con successo. Glifo con incantesimo: usa invece i danni della magia immagazzinata.',
    'guardian-of-faith': '20 radioso alla creatura ostile che per la prima volta in un turno si muove entro 3 m dal guardiano; TS Destrezza: 10 con successo. Il guardiano svanisce dopo 60 danni complessivi.',
    'guiding-bolt': '4d6 radioso per colpo con attacco magico a distanza.',
    'hail-of-thorns': '1d10 perforante aggiuntivo al bersaglio colpito con arma a distanza e alle creature entro 1,5 m; TS Destrezza: metà con successo.',
    'harm': '14d6 necrotico per bersaglio; TS Costituzione: metà con successo. Non può ridurre il bersaglio sotto 1 PF.',
    'heat-metal': '2d8 fuoco a chi è a contatto fisico con l’oggetto al lancio; ripetibile con azione bonus nei tuoi turni. Il TS Costituzione per lasciare l’oggetto non riduce i danni.',
    'hellish-rebuke': '2d10 fuoco alla creatura bersaglio, reagendo al danno che ti ha inflitto; TS Destrezza: metà con successo.',
    'hex': '+1d6 necrotico per ogni tuo attacco che colpisce il bersaglio maledetto.',
    'hunger-of-hadar': 'Inizio turno nella sfera: 2d6 freddo senza TS. Fine turno nella sfera: 2d6 acido se fallisce il TS Destrezza, nessuno con successo.',
    'hunter-s-mark': '+1d6 per ogni tuo colpo con arma contro il bersaglio marchiato.',
    'ice-storm': '2d8 contundente + 4d6 freddo per creatura nell’area; TS Destrezza: metà con successo.',
    'incendiary-cloud': '10d8 fuoco per creatura alla comparsa della nube, al primo ingresso in un turno o a fine turno al suo interno; TS Destrezza: metà con successo.',
    'inflict-wounds': '3d10 necrotico per colpo con attacco magico in mischia.',
    'insect-plague': '4d10 perforante per creatura alla comparsa dell’area, al primo ingresso in un turno o a fine turno al suo interno; TS Costituzione: metà con successo.',
    'lightning-arrow': 'Prossimo attacco con arma a distanza: 4d8 fulmine al posto dei normali danni, metà se manca. Esplosione entro 3 m dal bersaglio: 2d8 fulmine per creatura, TS Destrezza: metà con successo, anche se l’attacco manca.',
    'lightning-bolt': '8d6 fulmine per creatura nella linea; TS Destrezza: metà con successo.',
    'magic-missile': '1d4 + 1 forza per dardo, 3 dardi al livello base; colpiscono automaticamente. Da verificare con il DM: tiro del danno comune o separato per i dardi.',
    'magic-weapon': '+1 ai danni dell’arma per colpo, oltre ai suoi normali danni.',
    'meld-into-stone': 'All’incantatore espulso: 6d6 contundente se la pietra è parzialmente distrutta o non lo contiene più; 50 contundente se è totalmente distrutta o trasformata.',
    'melf-s-acid-arrow': 'Colpo: 4d4 acido iniziali e 2d4 alla fine del prossimo turno del bersaglio. Attacco mancato: metà del danno iniziale, senza danno successivo.',
    'meteor-swarm': '20d6 fuoco + 20d6 contundente per creatura; TS Destrezza: metà con successo. Aree sovrapposte non colpiscono più volte la stessa creatura.',
    'moonbeam': '2d10 radioso per creatura al primo ingresso in un turno o all’inizio del proprio turno nell’area; TS Costituzione: metà con successo. I mutaforma hanno svantaggio.',
    'mordenkainen-s-faithful-hound': '4d8 perforante per morso che colpisce una creatura ostile entro 1,5 m dal segugio; tenta il morso all’inizio di ogni tuo turno.',
    'mordenkainen-s-sword': '3d10 forza per colpo con attacco magico in mischia; un attacco alla comparsa della spada e altri con azione bonus nei tuoi turni.',
    'otiluke-s-freezing-sphere': '10d6 freddo per creatura nell’area all’esplosione; TS Costituzione: metà con successo. Puoi rimandare l’esplosione secondo la descrizione.',
    'phantasmal-force': 'Fino a 1d6 psichico per round nel tuo turno, solo se il fantasma è plausibilmente dannoso e il bersaglio è nella sua area o entro 1,5 m. Il TS Intelligenza iniziale permette di evitare l’illusione.',
    'phantasmal-killer': 'Nessun danno iniziale. Continuato: 4d10 psichico a fine turno del bersaglio se fallisce il nuovo TS Saggezza; un successo termina la magia.',
    'poison-spray': '1d12 veleno per bersaglio; TS Costituzione: nessun danno con successo.',
    'prismatic-spray': 'Raggi 1–5: 10d6 per raggio, di tipo fuoco, acido, fulmine, veleno o freddo secondo il colore; TS Destrezza: metà con successo. I raggi 6–7 non infliggono danni diretti; il risultato 8 applica due raggi.',
    'prismatic-wall': '10d6 per ciascuno dei primi cinque strati attraversati: fuoco, acido, fulmine, veleno e freddo; un TS Destrezza per strato dimezza il relativo danno. Gli ultimi due strati hanno effetti diversi dai danni.',
    'produce-flame': '1d8 fuoco per colpo con attacco magico a distanza, scagliando la fiamma.',
    'ray-of-frost': '1d8 freddo per colpo con attacco magico a distanza.',
    'ray-of-sickness': '2d8 veleno per colpo con attacco magico a distanza; il TS Costituzione riguarda la condizione avvelenato, non i danni.',
    'sacred-flame': '1d8 radioso per bersaglio; TS Destrezza: nessun danno con successo.',
    'scorching-ray': '2d6 fuoco per raggio che colpisce; 3 raggi al livello base, ciascuno con un attacco magico a distanza separato.',
    'searing-smite': 'Iniziale: +1d6 fuoco al prossimo colpo con arma in mischia. Continuato: 1d6 fuoco a inizio turno del bersaglio se fallisce il TS Costituzione; un successo o lo spegnimento delle fiamme terminano la magia.',
    'shatter': '3d8 tuono per creatura nell’area; TS Costituzione: metà con successo. Danneggia anche gli oggetti non magici non indossati o trasportati nell’area.',
    'shillelagh': '1d8 + modificatore da incantatore per colpo con l’arma; puoi mantenere il normale modificatore dell’arma. Il d8 sostituisce il suo dado, non è un danno aggiuntivo.',
    'shocking-grasp': '1d8 fulmine per colpo con attacco magico in mischia.',
    'spike-growth': '2d4 perforante ogni 1,5 m percorsi entrando o muovendosi nell’area; nessun TS contro questi danni.',
    'spirit-guardians': '3d8 per creatura al primo ingresso in un turno o all’inizio del proprio turno nell’area; TS Saggezza: metà con successo. Radioso per incantatore buono/neutrale, necrotico per malvagio; escluse le creature designate al lancio.',
    'spiritual-weapon': '1d8 + modificatore da incantatore forza per colpo con attacco magico in mischia; un attacco al lancio e altri con azione bonus nei tuoi turni.',
    'staggering-smite': '+4d6 psichico al prossimo colpo con arma in mischia; il TS Saggezza riguarda gli altri effetti, non riduce i danni.',
    'storm-of-vengeance': 'Comparsa: 2d6 tuono per creatura, TS Costituzione: nessun danno con successo. Nel tuo turno: round 2, 1d6 acido; round 3, 10d6 fulmine a ciascuno di 6 bersagli distinti (TS Destrezza: metà); round 4, 2d6 contundente; round 5–10, 1d6 freddo per round.',
    'sunbeam': '6d8 radioso per creatura nella linea; TS Costituzione: metà con successo. Un raggio al lancio e altri usando la tua azione nei turni successivi.',
    'sunburst': '12d6 radioso per creatura nell’area; TS Costituzione: metà con successo.',
    'symbol': 'Solo simbolo di Morte: 10d10 necrotico per creatura, TS Costituzione: metà con successo. Quando attivo, colpisce all’attivazione, al primo ingresso in un turno o a fine turno nell’area; gli altri simboli hanno effetti diversi dai danni.',
    'teleport': '3d10 forza a ciascuna creatura od oggetto trasportato solo con risultato Imprevisto; un nuovo Imprevisto può infliggerli di nuovo.',
    'thorn-whip': '1d6 perforante per colpo con attacco magico in mischia.',
    'thunderous-smite': '+2d6 tuono al primo colpo con arma in mischia durante la durata; il TS Forza riguarda la spinta e la caduta, non i danni.',
    'thunderwave': '2d8 tuono per creatura nell’area; TS Costituzione: metà con successo.',
    'tsunami': 'Comparsa: 6d10 contundente, TS Forza: metà con successo. Turni successivi: 5d10 contundente alle creature Enormi o minori investite dal muro, TS Forza: nessun danno con successo, massimo una volta per round; il danno successivo cala di 1d10 a ogni fine del tuo turno.',
    'vampiric-touch': '3d6 necrotico per colpo con attacco magico in mischia; ripetibile con la tua azione nei tuoi turni. La guarigione è un effetto separato, non un danno aggiuntivo.',
    'vicious-mockery': '1d4 psichico per bersaglio; TS Saggezza: nessun danno con successo.',
    'wall-of-fire': 'Comparsa del muro: 5d8 fuoco, TS Destrezza: metà con successo. Continuato: 5d8 senza TS al primo ingresso in un turno o a fine turno nel muro, oppure a fine turno entro 3 m dal lato caldo.',
    'wall-of-ice': 'Comparsa: 10d6 freddo, TS Destrezza: metà con successo. Aria gelida lasciata da una sezione distrutta: 5d6 freddo al primo attraversamento in un turno, TS Costituzione: metà con successo.',
    'wall-of-thorns': 'Comparsa: 7d8 perforante. Primo ingresso in un turno o fine turno nell’area: 7d8 tagliente. TS Destrezza: metà con successo in entrambi i casi.',
    'warding-bond': 'L’incantatore subisce la stessa quantità di danni effettivamente subita dal bersaglio collegato, ogni volta che il bersaglio subisce danni; nessuna formula fissa.',
    'web': 'Solo ragnatela incendiata: 2d4 fuoco a chi inizia il turno nel fuoco. La ragnatela non incendiata non infligge danni.',
    'weird': 'Nessun danno iniziale. Continuato: 4d10 psichico a fine turno di ciascun bersaglio ancora soggetto, se fallisce il nuovo TS Saggezza; un successo termina l’effetto per quella creatura.',
    'wind-wall': '3d8 contundente alle creature nello spazio del muro quando compare; TS Forza: metà con successo. Non applicare nuovamente questo danno a ogni turno.',
    'wish': 'Variabile: danni dell’incantesimo duplicato o dell’effetto concesso dal DM. Stress per usi diversi dalla duplicazione: nei lanci successivi fino al riposo lungo, l’incantatore subisce 1d10 necrotico per livello della magia lanciata, non prevenibile né riducibile.',
    'witch-bolt': 'Iniziale: 1d12 fulmine per colpo con attacco magico a distanza. Continuato: 1d12 fulmine automatico usando la tua azione nei turni successivi, finché restano validi collegamento, gittata e copertura.',
    'wrathful-smite': '+1d6 psichico al prossimo colpo con arma in mischia; il TS Saggezza riguarda la paura, non riduce i danni.',
}

SCALING = {
    'animate-objects': '+2 unità di oggetti per livello di slot oltre il 5°; i danni del singolo oggetto non aumentano.',
    'armor-of-agathys': '+5 danni di rappresaglia per livello di slot oltre il 1°; i PF temporanei aumentano separatamente.',
    'bigby-s-hand': 'Per livello di slot oltre il 5°: pugno +2d8; stritolamento +2d6.',
    'chain-lightning': '+1 bersaglio secondario per livello di slot oltre il 6°; il danno per bersaglio resta 10d8.',
    'cordon-of-arrows': '+2 proiettili per livello di slot oltre il 2°; il danno per proiettile resta 1d6.',
    'delayed-blast-fireball': '+1d6 al danno base per livello di slot oltre il 7°; l’accumulo per turno resta +1d6.',
    'eldritch-blast': 'Livello del personaggio: 1 raggio al 1°, 2 al 5°, 3 all’11°, 4 al 17°; ogni raggio resta 1d10.',
    'elemental-weapon': 'Slot 5°–6°: +2d4 e bonus +2 ai danni; slot dal 7°: +3d4 e bonus +3.',
    'flame-blade': '+1d6 ogni 2 livelli di slot oltre il 2°: 4d6 con slot 4°, 5d6 con slot 6°, 6d6 con slot 8°.',
    'flame-strike': '+1d6 a uno dei due tipi di danno, a scelta, per livello di slot oltre il 5°.',
    'glyph-of-warding': 'Rune esplosive: +1d8 per livello di slot oltre il 3°. Il livello massimo della magia immagazzinata è quello dello slot usato per il glifo.',
    'hail-of-thorns': '+1d10 per livello di slot oltre il 1°, fino al massimo di 6d10.',
    'ice-storm': '+1d8 al solo danno contundente per livello di slot oltre il 4°; il freddo resta 4d6.',
    'lightning-arrow': 'Per livello di slot oltre il 3°: +1d8 al danno primario e +1d8 all’esplosione.',
    'magic-missile': '+1 dardo per livello di slot oltre il 1°; ogni dardo resta 1d4 + 1.',
    'magic-weapon': 'Slot 4°–5°: bonus +2 ai danni; slot dal 6°: bonus +3.',
    'melf-s-acid-arrow': 'Per livello di slot oltre il 2°: +1d4 iniziale e +1d4 successivo.',
    'scorching-ray': '+1 raggio per livello di slot oltre il 2°; ogni raggio resta 2d6.',
    'searing-smite': '+1d6 al solo danno iniziale per livello di slot oltre il 1°; il danno continuato resta 1d6.',
    'spiritual-weapon': '+1d8 ogni 2 livelli di slot oltre il 2°: 2d8 con slot 4°, 3d8 con slot 6°, 4d8 con slot 8°, sempre più il modificatore da incantatore.',
    'wall-of-ice': 'Per livello di slot oltre il 6°: +2d6 alla comparsa e +1d6 all’aria gelida.',
    'wall-of-thorns': '+1d8 a entrambi i danni per livello di slot oltre il 6°.',
    'witch-bolt': '+1d12 al solo danno iniziale per livello di slot oltre il 1°; il danno continuato resta 1d12.',
}

VARIABLE = set('''animal-shapes animate-dead awaken conjure-animals conjure-celestial
conjure-elemental conjure-fey conjure-minor-elementals conjure-woodland-beings
confusion create-undead crown-of-madness dominate-beast dominate-monster dominate-person find-steed gate haste
giant-insect planar-ally planar-binding polymorph shapechange simulacrum
swift-quiver true-polymorph'''.split())
NO_DAMAGE = set('''aid alarm animal-friendship animal-messenger antilife-shell antimagic-field
antipathy-sympathy arcane-eye arcane-gate arcane-lock astral-projection augury aura-of-life
aura-of-purity aura-of-vitality bane beast-sense barkskin beacon-of-hope banishment blade-ward
bless blindness-deafness blink blur calm-emotions charm-person circle-of-power clairvoyance
clone color-spray command commune commune-with-nature compelled-duel comprehend-languages
compulsion contagion contingency continual-flame control-weather counterspell create-food-and-water
creation create-or-destroy-water cure-wounds dancing-lights darkness darkvision daylight death-ward
demiplane detect-evil-and-good detect-magic detect-poison-and-disease detect-thoughts disguise-self
dispel-evil-and-good dispel-magic divination divine-word drawmij-s-instant-summons druidcraft
enhance-ability entangle enthrall expeditious-retreat eyebite fabricate faerie-fire
false-life fear feather-fall feign-death find-familiar find-the-path find-traps flesh-to-stone fly
fog-cloud forcecage foresight freedom-of-movement friends gaseous-form gentle-repose glibness
globe-of-invulnerability goodberry grasping-vine grease greater-invisibility greater-restoration
guards-and-wards guidance gust-of-wind hallow hallucinatory-terrain heal healing-word heroes-feast
heroism hold-monster hold-person holy-aura hypnotic-pattern identify illusory-script imprisonment
invisibility jump knock legend-lore leomund-s-secret-chest leomund-s-tiny-hut lesser-restoration
levitate light locate-animals-or-plants locate-creature locate-object longstrider mage-armor
mage-hand magic-circle magic-jar magic-mouth major-image mass-cure-wounds mass-heal mass-healing-word
mass-suggestion maze mending message mind-blank minor-illusion mirror-image mislead misty-step
modify-memory mordenkainen-s-magnificent-mansion mordenkainen-s-private-sanctum move-earth
nondetection nystul-s-magic-aura otiluke-s-resilient-sphere otto-s-irresistible-dance pass-without-trace
passwall phantom-steed plane-shift plant-growth power-word-heal power-word-kill power-word-stun
prayer-of-healing prestidigitation programmed-illusion project-image protection-from-energy
protection-from-evil-and-good protection-from-poison purify-food-and-drink raise-dead
rary-s-telepathic-bond remove-curse reincarnate ray-of-enfeeblement regenerate resistance
resurrection revivify rope-trick sanctuary scrying see-invisibility seeming sending sequester
shield shield-of-faith silence silent-image sleep sleet-storm slow spare-the-dying speak-with-animals
speak-with-dead speak-with-plants spider-climb stinking-cloud stone-shape stoneskin suggestion
tasha-s-hideous-laughter telekinesis telepathy teleportation-circle tenser-s-floating-disk thaumaturgy
time-stop tongues transport-via-plants tree-stride true-resurrection true-seeing true-strike
unseen-servant wall-of-force wall-of-stone water-breathing water-walk wind-walk word-of-recall
zone-of-truth'''.split())
REVIEW = {
    'magic-missile': 'La formula per dardo è verificata; resta aperta l’interpretazione sul numero di tiri del danno.',
    'mirage-arcane': 'Da verificare: eventuali danni dipendono dal terreno e dall’interazione con l’illusione; nessuna formula fissa nel record.',
    'reverse-gravity': 'Da verificare: possibili danni da caduta dipendono da altezza e ostacoli; nessuna formula di danno specifica nel record.',
}


def summary(entity):
    index, mechanics = entity['index'], entity['mechanics']
    if index in VARIABLE:
        return {'status': 'known', 'summary': 'Variabile: usa i normali danni dell’azione o dell’attacco dell’arma o della creatura coinvolta, secondo la scelta e le sue statistiche. Non è un danno automatico al lancio.'}
    if index in REVIEW and index not in BASE:
        return {'status': 'review', 'summary': REVIEW[index]}
    if index in NO_DAMAGE:
        return {'status': 'none', 'summary': 'Nessuno'}
    # ponytail: editorial lists cover this reference release; new spells stay unresolved.
    # Extend these lists after reviewing the new description, rather than guessing from dice.
    if index not in BASE:
        return {'status': 'review', 'summary': 'Da verificare: danno non ancora revisionato per questo incantesimo.'}
    text = BASE[index]
    upcast, effect = mechanics.get('upcast', {}), mechanics.get('effect', {})
    if index in SCALING:
        text += '\nAumenti: ' + SCALING[index]
    elif levels := effect.get('damageDiceByCharacterLevel', upcast.get('damageDiceByLevel')):
        text += '\nLivello del personaggio: ' + '; '.join(f'{level}°: {dice}' for level, dice in sorted(levels.items(), key=lambda row: int(row[0])) if int(level) > 1) + '.'
    elif increment := upcast.get('damageAdditionalDice', upcast.get('additionalDamageDice')):
        if upcast.get('kind') != 'per-slot-above-base' or not isinstance(upcast.get('base'), int):
            raise ValueError('Incremento del danno non revisionato: ' + index)
        text += f'\nSlot superiori: +{increment} per livello di slot oltre il {upcast["base"]}°.'
    return {'status': 'review' if index in REVIEW else 'known', 'summary': text}


def build(reference, catalog):
    spells = [entity for entity in reference['entities'] if entity['kind'] == 'spell']
    if any(entity.get('edition') != '2014' for entity in spells):
        raise ValueError('La fonte verificata deve contenere solo incantesimi 2014.')
    by_name = {spell_key(entity['name']): entity for entity in spells}
    if len(by_name) != len(spells):
        raise ValueError('Identità degli incantesimi ambigue.')
    records = {'2014:' + entity['id']: {**summary(entity), 'name': entity.get('nameIt') or entity['name']} for entity in spells}
    bindings = {}
    for spell in catalog['spells'] + catalog['englishSpells']:
        explicit = '2024' if spell.get('ruleset') == 'dnd5e-2024' else spell.get('edition')
        entity = by_name.get(spell_key(spell.get('englishName') or spell['name'])) if explicit != '2024' else None
        key = '2014:' + entity['id'] if entity else f'{explicit or "unclassified"}:{spell["id"]}'
        if spell['id'] in bindings and bindings[spell['id']] != key:
            raise ValueError('Binding duplicato: ' + spell['id'])
        bindings[spell['id']] = key
        if not entity:
            records[key] = {'name': spell['name'], 'status': 'review', 'summary': 'Da verificare: descrizione completa e dati del danno non disponibili nel database per questa edizione.'}
    return {'schemaVersion': 1, 'inputs': {
        'rules2014/verified-reference.json': hashlib.sha256(REFERENCE.read_bytes()).hexdigest(),
        'database.json': hashlib.sha256(CATALOG.read_bytes()).hexdigest(),
    }, 'method': 'Sintesi editoriali dei record 2014 verificati e confronto con le descrizioni del catalogo. Nessuna formula dedotta dai soli dadi citati nel testo. Edizioni esplicite isolate; fonti senza descrizione segnalate.',
        'records': dict(sorted(records.items())), 'bindings': dict(sorted(bindings.items()))}


def report(data):
    records = data['records']
    lines = ['# Audit del danno degli incantesimi', '',
             'Rigenerazione: `python scripts/audit_spell_damage.py`. Controllo: `python scripts/audit_spell_damage.py --check`.', '',
             'Il campo Danno è una sintesi informativa: non determina automaticamente bersagli, tiri, danni o consumo di risorse.', '',
             'Le chiavi `2014:phb2014:spell:*` rimandano allo stesso identificativo in `public/data/rules2014/verified-reference.json`, dove sono conservate fonti PDF, pagine e verifiche. Le altre chiavi mantengono l’edizione esplicita oppure `unclassified`; non certificano regole 2024.', '',
             'Il catalogo attuale non contiene record confermati 2024. Le 319 traduzioni italiane condividono la stessa sintesi dell’identità inglese, senza duplicare i risultati. Il payload verificato e RELEASE.json non sono modificati.', '',
             'Discrepanza rilevata: la vecchia descrizione italiana di Muro di Ghiaccio indica +1d8 per entrambi i danni; il record verificato riporta +2d6 alla comparsa e +1d6 all’aria gelida. La sintesi segue il record verificato.', '',
             'Controlli sulle fonti locali: D&D_5_Player_Original_Handbook.pdf, pagine PDF 242–243 (Fireball), 258 (Magic Missile), 271 (Protection from Evil and Good), 286 (Wall of Ice).', '',
             '| Stato | Incantesimi distinti |', '| --- | ---: |']
    for status, label in [('known', 'Danno noto o dipendente da una scelta esplicita'), ('none', 'Nessun danno'), ('review', 'Da verificare')]:
        lines.append(f'| {label} | {sum(record["status"] == status for record in records.values())} |')
    lines += ['', '## Da verificare', '', '| Identificativo | Incantesimo | Motivo |', '| --- | --- | --- |']
    for key, record in records.items():
        if record['status'] == 'review':
            reason = REVIEW.get(key.removeprefix('2014:phb2014:spell:'), record['summary'])
            lines.append(f'| `{key}` | {record["name"]} | {reason.replace(chr(10), " ")} |')
    return '\n'.join(lines) + '\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    if hashlib.sha256(REFERENCE.read_bytes()).hexdigest() != REVIEWED_REFERENCE_SHA256:
        raise SystemExit('Fonte verificata modificata: riesaminare le sintesi prima di aggiornare l’indice del danno.')
    data = build(json.loads(REFERENCE.read_text(encoding='utf-8')), json.loads(CATALOG.read_text(encoding='utf-8')))
    markdown = report(data)
    if args.check:
        if json.loads(OUTPUT.read_text(encoding='utf-8')) != data or REPORT.read_text(encoding='utf-8') != markdown:
            raise SystemExit('Indice del danno non aggiornato: rigenerare con audit_spell_damage.py.')
    else:
        write_json(OUTPUT, data)
        REPORT.parent.mkdir(exist_ok=True)
        REPORT.write_text(markdown, encoding='utf-8')
    print(f'{len(data["records"])} incantesimi distinti; ' + ', '.join(f'{status}: {sum(r["status"] == status for r in data["records"].values())}' for status in ['known', 'none', 'review']))


if __name__ == '__main__':
    main()
