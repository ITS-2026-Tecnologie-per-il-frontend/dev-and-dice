#!/usr/bin/env python3
"""Esporta fatti sulle tempistiche Wikidot da una cache, senza modificare il database.

La cache contiene index.json e <id>.json con {spell, text}, ottenuti dalle pagine
pubbliche /spells e /spell:<id>. Eseguire: python3 scripts/audit_spell_timing.py --cache DIR
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
from scrape_wikidot import duration_metadata
from sync_spells import spell_key

ROOT = Path(__file__).resolve().parents[1]
ABILITIES = {'Strength': 'FOR', 'Dexterity': 'DES', 'Constitution': 'COS',
             'Intelligence': 'INT', 'Wisdom': 'SAG', 'Charisma': 'CAR'}
# Annotazioni dei soli eventi: niente riproduzione delle descrizioni degli incantesimi.
# Formato: caratteristica | evento | condizione; gli eventi senza turno non ricevono default.
SCHEDULES = {
 'light': 'DES|lancio|Solo oggetto indossato o tenuto da una creatura ostile.',
 'catapult': 'DES|condizione|Quando l’oggetto sta per colpire una creatura.',
 'compelled-duel': 'SAG|lancio|Bersaglio iniziale.;SAG|condizione|Ogni tentativo di allontanarsi oltre 9 m dall’incantatore; il successo permette il movimento per quel turno, senza terminare l’incantesimo.',
 'create-bonfire': 'DES|lancio|Creatura nello spazio del falò.;DES|fine_bersaglio|Se termina il turno nello spazio del falò.;DES|condizione|Primo ingresso nello spazio del falò in un turno.',
 'grease': 'DES|lancio|Creature presenti nell’area.;DES|fine_bersaglio|Se termina il turno nell’area.;DES|condizione|Ingresso nell’area.',
 'ensnaring-strike': 'FOR|condizione|Al successivo colpo con un’arma; per liberarsi si usa invece una prova di Forza con un’azione.',
 'hail-of-thorns': 'DES|condizione|Al successivo colpo con arma a distanza, bersaglio e creature entro 1,5 m.',
 'thunderous-smite': 'FOR|condizione|Al primo colpo con arma da mischia.',
 'searing-smite': 'COS|inizio_bersaglio|Dopo il colpo che incendia il bersaglio; il colpo iniziale non richiede TS. Successo: termina l’incantesimo.',
 'sanctuary': 'SAG|condizione|L’attaccante, prima di attaccare o lanciare una magia dannosa contro il protetto; non il protetto.',
 'ray-of-sickness': 'COS|condizione|Solo se l’attacco dell’incantesimo colpisce.',
 'snare': 'DES|condizione|Una creatura Piccola, Media o Grande attiva la trappola.;DES|fine_bersaglio|Se ancora trattenuta; successo termina l’effetto.',
 'tashas-hideous-laughter': 'SAG|lancio|Bersaglio iniziale.;SAG|fine_bersaglio|Successo termina l’incantesimo.;SAG|condizione|Ogni volta che subisce danni, con vantaggio; successo termina l’incantesimo.',
 'infallible-relay': 'CAR|lancio|Per resistere alla connessione.;CAR|condizione|Quando il bersaglio vuole terminare la conversazione.',
 'cordon-of-arrows': 'DES|fine_bersaglio|Creatura non esclusa entro 9 m dalle munizioni, se ne restano.;DES|condizione|Primo avvicinamento entro 9 m in un turno.',
 'detect-thoughts': 'SAG|condizione|Solo sondando più a fondo; i pensieri superficiali non richiedono TS. La successiva opposizione è una prova di Intelligenza, non un TS.',
 'dragons-breath': 'DES|azione_utilizzatore|A ogni soffio del beneficiario, creature nel cono; non al lancio sul beneficiario consenziente.',
 'dust-devil': 'FOR|fine_bersaglio|Se termina il turno entro 1,5 m dal vortice.',
 'enlarge-reduce': 'COS|lancio|Solo una creatura non consenziente; i modificatori ai TS di Forza non sono TS contro questa magia.',
 'flaming-sphere': 'DES|fine_bersaglio|Se termina il turno entro 1,5 m dalla sfera.;DES|condizione|Quando la sfera viene fatta urtare contro una creatura.',
 'gust-of-wind': 'FOR|inizio_bersaglio|Se inizia il turno nella linea di vento.',
 'heat-metal': 'COS|condizione|A ogni danno a una creatura che tiene o indossa l’oggetto; stabilisce se lo lascia cadere, non evita il danno.',
 'levitate': 'COS|lancio|Solo creatura non consenziente.',
 'maximillians-earthen-grasp': 'FOR|lancio|Prima presa.;FOR|azione_incantatore|Quando la mano stritola una creatura trattenuta.;FOR|condizione|Se si sposta la mano e afferra un nuovo bersaglio; per liberarsi si usa una prova di Forza, non un TS.',
 'moonbeam': 'COS|inizio_bersaglio|Se inizia il turno nell’area; svantaggio per mutaforma.;COS|condizione|Primo ingresso nell’area in un turno; non soltanto perché l’area viene creata o spostata sopra la creatura.',
 'nathairs-mischief': 'SAG/DES|lancio|Effetto casuale: SAG per charme/risata, DES per cecità, nessun TS per terreno difficile.;SAG/DES|inizio_incantatore|Nuovo effetto casuale nell’area; stessa distinzione per caratteristica.',
 'nathairs-mischief-ua': 'SAG/DES|lancio|Effetto casuale: SAG per charme/risata, DES per cecità, nessun TS per terreno difficile.;SAG/DES|inizio_incantatore|Nuovo effetto casuale nell’area; stessa distinzione per caratteristica.',
 'pyrotechnics': 'COS|lancio|Solo modalità fuochi d’artificio; fumo senza TS.',
 'ray-of-enfeeblement': 'COS|fine_bersaglio|Dopo un attacco andato a segno; nessun TS iniziale. Successo termina l’incantesimo.',
 'spray-of-cards-ua': 'SAG/DES|lancio|SAG per carte accecanti, DES per carte taglienti.',
 'web': 'DES|inizio_bersaglio|Se inizia il turno nelle ragnatele.;DES|condizione|Se entra nelle ragnatele durante il proprio turno; per liberarsi usa una prova di Forza.',
 'zone-of-truth': 'CAR|inizio_bersaglio|Se inizia il turno nell’area.;CAR|condizione|Primo ingresso nell’area in un turno; non un TS separato soltanto al lancio.',
 'bestow-curse': 'SAG|lancio|Per resistere alla maledizione.;SAG|inizio_bersaglio|Solo scegliendo la maledizione che può far perdere l’azione; successo evita tale perdita, senza rimuovere la maledizione.',
 'blinding-smite': 'COS|condizione|Al primo colpo con arma da mischia.;COS|fine_bersaglio|Se ancora accecato; successo termina la cecità.',
 'call-lightning': 'DES|lancio|Creature entro 1,5 m dal punto colpito.;DES|azione_incantatore|Ogni nuovo fulmine richiamato con un’azione.',
 'enemies-abound': 'INT|lancio|Bersaglio iniziale.;INT|condizione|Ogni volta che subisce danni; successo termina l’effetto.',
 'fast-friends': 'SAG|lancio|Bersaglio iniziale.;SAG|condizione|Richiesta potenzialmente dannosa o contraria ad abitudini/desideri; successo termina l’effetto.',
 'fear': 'SAG|lancio|Creature nel cono.;SAG|fine_bersaglio|Solo se termina il turno senza linea di vista sull’incantatore; successo termina l’effetto.',
 'glyph-of-warding': 'DES|condizione|Attivazione delle rune esplosive; per il glifo con incantesimo valgono i TS della magia immagazzinata.',
 'haywire': 'SAG|lancio|Creatura che tiene un dispositivo, per proteggerlo.;DES|inizio_incantatore|Solo risultato casuale di sovraccarico: utilizzatore e una creatura entro 1,5 m.',
 'hunger-of-hadar': 'DES|fine_bersaglio|Se termina il turno nell’area; il danno all’inizio del turno non richiede TS.',
 'lightning-arrow': 'DES|condizione|Creature entro 3 m dal bersaglio dopo il prossimo attacco a distanza, anche se manca.',
 'magic-circle': 'CAR|condizione|Creatura del tipo vincolato che tenta ingresso con teletrasporto/viaggio planare; cerchio invertito: uscita.',
 'melfs-minute-meteors': 'DES|condizione|A ogni esplosione di meteora: al lancio oppure quando l’incantatore spende meteore con un’azione bonus.',
}
NO_HOSTILE_SAVE = {'bless','ceremony','resistance','silvery-barbs','protection-from-evil-and-good',
 'fortunes-favor','mental-barrier','protection-from-poison','thought-shield','warding-bond',
 'beacon-of-hope','gaseous-form','haste','intellect-fortress','motivational-speech'}
END_REPEATS = {'cause-fear','blindness-deafness','crown-of-madness','hold-person','id-insinuation','incite-greed'}


SCHEDULES.update({
 'sleet-storm': 'DES|inizio_bersaglio|Se inizia il turno nell’area.;DES|condizione|Primo ingresso nell’area in un turno.;COS|inizio_bersaglio|Solo se sta mantenendo concentrazione nell’area; contro la CD dell’incantatore, non la normale CD da danni.',
 'slow': 'SAG|lancio|Bersagli iniziali.;SAG|fine_bersaglio|Successo termina l’effetto; il malus ai TS di Destrezza non richiede un ulteriore TS.',
 'spirit-guardians': 'SAG|inizio_bersaglio|Creatura non esclusa che inizia il turno nell’area.;SAG|condizione|Primo ingresso nell’area in un turno; la sola creazione o lo spostamento dell’area non basta.',
 'stinking-cloud': 'COS|inizio_bersaglio|Se completamente nella nube; successo automatico se non respira o immune al veleno.',
 'summon-fey': 'SAG|azione_evocato|Solo folletto Mirthful che usa Fey Step e sceglie una creatura entro 3 m; non al lancio dell’evocazione.',
 'summon-shadowspawn': 'SAG|azione_evocato|Dreadful Scream, una volta al giorno.;SAG|fine_bersaglio|Se ancora spaventato dall’urlo; successo termina la paura.',
 'summon-undead': 'COS|inizio_bersaglio|Festering Aura, forma Putrid: creatura entro 1,5 m diversa dall’incantatore.;SAG|condizione|Deathly Touch, forma Ghostly: quando colpisce.;COS|condizione|Rotting Claw, forma Putrid: quando colpisce una creatura già avvelenata.',
 'summon-warrior-spirit': 'FOR|condizione|Solo Unarmed Strike della forma Monk andato a segno; non al lancio.',
 'compulsion': 'SAG|lancio|Creature scelte che sentono.;SAG|condizione|Dopo aver eseguito il movimento imposto nel proprio turno; non automaticamente a inizio o fine turno.',
 'control-water': 'FOR|inizio_bersaglio|Solo modalità vortice: creatura nel vortice.;FOR|condizione|Primo ingresso nel vortice in un turno; tentare la fuga usa invece Atletica.',
 'evards-black-tentacles': 'DES|inizio_bersaglio|Nell’area e non già trattenuto dai tentacoli; se già trattenuto il danno è automatico.;DES|condizione|Primo ingresso nell’area in un turno.',
 'grasping-vine': 'DES|lancio|Se si ordina subito alla vite di colpire.;DES|condizione|Ogni successivo colpo ordinato con azione bonus nel turno dell’incantatore.',
 'guardian-of-faith': 'DES|condizione|Primo movimento entro 3 m dal guardiano in un turno, creatura ostile; non semplicemente iniziare il turno lì.',
 'otilukes-resilient-sphere': 'DES|lancio|Solo una creatura non consenziente.',
 'polymorph': 'SAG|lancio|Solo una creatura non consenziente; mutaforma riesce automaticamente.',
 'sickening-radiance': 'COS|inizio_bersaglio|Se inizia il turno nell’area.;COS|condizione|Primo movimento nell’area in un turno.',
 'spirit-of-death-ua': 'SAG|azione_evocato|Paralyzing Fear del reaper, una volta al giorno.;SAG|fine_bersaglio|Se ancora spaventato; successo termina l’effetto.;SAG|condizione|Dopo aver subito danni mentre spaventato; successo termina l’effetto.',
 'spirit-of-death': 'SAG|inizio_bersaglio|Solo creatura infestata che inizia il turno entro 3 m dallo spirito; non al lancio.',
 'staggering-smite': 'SAG|condizione|Primo colpo con arma da mischia durante la durata.',
 'storm-sphere': 'FOR|lancio|Creature nella sfera quando appare.;FOR|fine_bersaglio|Se termina il turno nella sfera; il fulmine usa un attacco, non un TS.',
 'summon-aberration': 'SAG|inizio_evocato|Whispering Aura, forma Star Spawn non incapacitata: creature entro 1,5 m; turno dell’aberrazione evocata.',
 'summon-construct': 'SAG|inizio_bersaglio|Forma Stone: creatura visibile al costrutto entro 3 m; a discrezione del costrutto.',
 'summon-greater-demon': 'CAR|fine_evocato|Il demone effettua il TS; successo termina il controllo, non l’evocazione. Svantaggio se si pronuncia il suo vero nome.',
 'wall-of-fire': 'DES|lancio|Solo creature nello spazio del muro quando appare; danni successivi di ingresso o fine turno non concedono TS.',
 'watery-sphere': 'FOR|lancio|Creature nello spazio iniziale della sfera.;FOR|fine_bersaglio|Se trattenuto nella sfera.;FOR|condizione|Quando la sfera urta una creatura, al massimo una volta per turno.',
 'contact-other-plane': 'INT|lancio|L’incantatore effettua il TS, CD 15; non l’entità contattata.',
 'contagion': 'COS|fine_bersaglio|Dopo un attacco che avvelena; nessun TS al colpo. Tre successi terminano la magia; tre fallimenti applicano la malattia. I malus ai TS delle malattie non sono ulteriori TS contro la magia.',
 'control-winds': 'FOR|inizio_bersaglio|Solo modalità corrente discendente, creatura in volo nell’area.;FOR|condizione|Primo ingresso in volo nell’area in un turno, corrente discendente.',
 'dawn': 'COS|lancio|Creature nel cilindro quando appare.;COS|fine_bersaglio|Se termina il turno nel cilindro; nessun TS per il solo ingresso.',
 'dispel-evil-and-good': 'CAR|condizione|Modalità Congedo: solo dopo un attacco in mischia a segno contro un tipo di creatura ammesso.',
 'dream': 'SAG|condizione|Solo versione incubo, al termine del messaggio; sogno normale senza TS.',
 'hallow': 'CAR|inizio_bersaglio|Solo creature a cui si applica l’effetto aggiuntivo; un successo lo ignora fino all’uscita dall’area.;CAR|condizione|Primo ingresso nell’area in un turno, se soggetta all’effetto aggiuntivo.',
 'holy-weapon': 'COS|condizione|Quando l’incantatore termina la magia con l’esplosione, usando azione bonus; non al lancio.;COS|fine_bersaglio|Solo se accecato dall’esplosione; successo termina la cecità.',
 'insect-plague': 'COS|lancio|Creature nell’area quando appare.;COS|fine_bersaglio|Se termina il turno nell’area.;COS|condizione|Primo ingresso nell’area in un turno.',
 'maelstrom': 'FOR|inizio_bersaglio|Se inizia il turno nell’area.',
 'negative-energy-flood': 'COS|lancio|Solo se il bersaglio non è un non morto.',
 'planar-binding': 'CAR|lancio|Alla conclusione del lancio, dopo l’ora necessaria; creatura rimasta a gittata per tutto il lancio.',
 'seeming': 'CAR|lancio|Solo creatura non consenziente.',
 'shutdown': 'COS|lancio|Solo creature che utilizzano un dispositivo nell’area; dispositivi non utilizzati senza TS.',
 'summon-draconic-spirit': 'DES|azione_evocato|Ogni Breath Weapon dello spirito draconico, creature nel cono; non al lancio dell’evocazione.',
 'summon-draconic-spirit-ua': 'DES|azione_evocato|Ogni Breath Weapon dello spirito draconico, creature nel cono; non al lancio dell’evocazione.',
 'synaptic-static': 'INT|lancio|Creature nell’area con Intelligenza superiore a 2.;INT|fine_bersaglio|Solo pensieri confusi persistenti; successo li termina. Il malus ai TS di concentrazione non è un altro TS contro questa magia.',
 'transmute-rock': 'FOR|lancio|Roccia in fango al suolo, creature presenti.;FOR|fine_bersaglio|Roccia in fango al suolo, creatura nell’area.;FOR|condizione|Primo ingresso in un turno, roccia in fango al suolo.;DES|lancio|Soffitto trasformato in fango, creature sotto; oppure fango trasformato in roccia, creature nel fango.',
 'wall-of-light': 'COS|lancio|Creature nello spazio del muro quando appare.;COS|fine_bersaglio|Solo se accecato; successo termina la cecità. Attraversare il muro causa danni senza TS.',
 'wall-of-stone': 'DES|lancio|Solo se la creatura sarebbe completamente circondata; successo consente movimento con reazione.',
 'wrath-of-nature': 'DES|inizio_incantatore|Nemici entro 3 m dagli alberi nell’area.;FOR|fine_incantatore|Una creatura a terra scelta nell’area, radici e rampicanti.;FOR|condizione|Dopo un attacco a segno con un sasso lanciato con azione bonus; per liberarsi dalle radici si usa Atletica.',
 'blade-barrier': 'DES|inizio_bersaglio|Se inizia il turno nell’area del muro.;DES|condizione|Primo ingresso nell’area del muro in un turno.',
 'bones-of-the-earth': 'DES|lancio|Se un pilastro viene creato sotto la creatura; può scegliere di fallire. Liberarsi dalla compressione richiede una prova, non un TS.',
 'eyebite': 'SAG|lancio|Bersaglio iniziale.;SAG|azione_incantatore|Nuovo bersaglio scelto con un’azione; non riprovare contro chi ha già superato il TS in questo lancio.;SAG|fine_bersaglio|Solo modalità Sickened; successo termina quell’effetto.',
 'flesh-to-stone': 'COS|lancio|Creatura di carne.;COS|fine_bersaglio|Se trattenuta: conteggiare tre successi o tre fallimenti, non necessariamente consecutivi; dopo pietrificazione nessun TS ricorrente.',
 'investiture-of-flame': 'DES|azione_incantatore|Solo quando crea la linea di fuoco con un’azione.',
 'investiture-of-ice': 'COS|azione_incantatore|Solo quando crea il cono di gelo con un’azione.',
 'investiture-of-stone': 'DES|azione_incantatore|Solo quando provoca il terremoto con un’azione.',
 'investiture-of-wind': 'COS|azione_incantatore|Solo quando crea il cubo di vento con un’azione.',
 'magic-jar': 'CAR|azione_incantatore|Il bersaglio umanoide resiste al tentativo di possessione.;CAR|condizione|Se il corpo ospite muore, l’incantatore effettua il TS contro la propria CD per tornare nel contenitore.',
 'otilukes-freezing-sphere': 'COS|condizione|All’esplosione: immediata al lancio, oppure differita quando il globo viene lanciato/rotto o dopo un minuto.',
 'ottos-irresistible-dance': 'SAG|azione_bersaglio|Usando un’azione per resistere; nessun TS iniziale, né automatico a inizio/fine turno.',
 'scatter': 'SAG|lancio|Solo creature non consenzienti.',
 'summon-fiend': 'DES|condizione|Solo forma Demon: quando l’evocato scende a 0 PF o l’incantesimo termina; creature entro 3 m.',
 'sunbeam': 'COS|lancio|Creature nella linea del primo raggio.;COS|azione_incantatore|Ogni nuovo raggio creato con un’azione.',
 'tensers-transformation': 'COS|condizione|L’incantatore, immediatamente dopo la fine della magia, CD 15; non al lancio. Le competenze concesse non sono TS contro l’incantesimo.',
 'wall-of-ice': 'DES|lancio|Creature il cui spazio è attraversato dal muro quando appare.;COS|condizione|Primo attraversamento in un turno dell’aria gelida rimasta dopo la distruzione di una sezione.',
 'wall-of-thorns': 'DES|lancio|Creature nello spazio del muro quando appare.;DES|fine_bersaglio|Se termina il turno nel muro.;DES|condizione|Primo ingresso nel muro in un turno.',
 'antipathy-sympathy': 'SAG|condizione|Creatura del tipo indicato che vede l’oggetto/area o si avvicina entro 18 m.;SAG|fine_bersaglio|Se non è entro 18 m e non vede l’oggetto/area.;SAG|condizione|Ogni 24 ore mentre influenzata; nella modalità Sympathy anche quando il bersaglio incantato la danneggia. Successo concede immunità per un minuto.',
 'dark-star': 'COS|inizio_bersaglio|Se inizia il turno nell’area.;COS|condizione|Primo ingresso nell’area in un turno.',
 'delayed-blast-fireball': 'DES|condizione|Quando esplode, tutte le creature nell’area; nessun TS al lancio.;DES|condizione|Creatura che tocca la perla prima dell’esplosione; fallimento la fa esplodere, successo permette di lanciarla.',
 'draconic-transformation': 'DES|lancio|Solo se l’incantatore usa subito il soffio, creature nel cono.;DES|condizione|Ogni soffio successivo con azione bonus nel turno dell’incantatore.',
 'draconic-transformation-ua': 'DES|lancio|Solo se l’incantatore usa subito il soffio, creature nel cono.;DES|condizione|Ogni soffio successivo con azione bonus nel turno dell’incantatore.',
 'earthquake': 'COS|condizione|Creature a terra nell’area che mantengono concentrazione, durante il tremore.;DES|lancio|Creature a terra nell’area.;DES|fine_incantatore|Creature a terra nell’area, finché mantiene concentrazione.;DES|condizione|Quando una fenditura si apre sotto la creatura all’inizio del turno successivo dell’incantatore, oppure quando crolla una struttura vicina.',
 'feeblemind': 'INT|lancio|Bersaglio iniziale.;INT|condizione|Ogni 30 giorni, non ogni turno; successo termina l’incantesimo.',
 'forcecage': 'CAR|condizione|Quando il prigioniero tenta uscita con teletrasporto/viaggio planare; nessun TS iniziale.',
 'holy-aura': 'COS|condizione|Un immondo o non morto colpisce con attacco in mischia una creatura protetta; tira l’attaccante.',
 'illusory-dragon': 'SAG|lancio|Nemici che vedono l’illusione.;SAG|fine_bersaglio|Solo creatura spaventata senza linea di vista sull’illusione.;INT|condizione|Ogni soffio dell’illusione comandato con azione bonus nel turno dell’incantatore; vantaggio se l’ha riconosciuta come illusione.',
 'incendiary-cloud': 'DES|lancio|Creature nell’area quando appare.;DES|fine_bersaglio|Se termina il turno nell’area.;DES|condizione|Primo ingresso nell’area in un turno.',
 'maddening-darkness': 'SAG|inizio_bersaglio|Se inizia il turno nella sfera.',
 'mass-polymorph': 'SAG|lancio|Solo creature non consenzienti; mutaforma non consenzienti riescono automaticamente.',
 'plane-shift': 'CAR|condizione|Solo versione offensiva e attacco in mischia a segno; trasporto consenziente senza TS.',
 'power-word-pain': 'COS|fine_bersaglio|Se ancora influenzato; successo termina il dolore.;COS|condizione|Ogni tentativo del bersaglio di lanciare un incantesimo; il successo consente il lancio senza terminare il dolore. Nessun TS iniziale.',
 'power-word-stun': 'COS|fine_bersaglio|Se stordito; nessun TS iniziale. Successo termina lo stordimento.',
 'prismatic-spray': 'DES|lancio|Ogni creatura nel cono, poi determinare il raggio.;COS|fine_bersaglio|Solo raggio indaco: conteggiare tre successi o tre fallimenti.;SAG|inizio_incantatore_una_volta|Solo raggio violetto, nel turno successivo dell’incantatore: successo termina cecità, fallimento trasporta su altro piano e termina cecità.',
 'prismatic-wall': 'COS|inizio_bersaglio|Creatura non esclusa che vede il muro entro 6 m.;COS|condizione|Creatura non esclusa che vede il muro e si avvicina entro 6 m.;DES|condizione|Ogni strato attraversato o raggiunto attraverso il muro.;COS|fine_bersaglio|Solo strato indaco: conteggiare tre successi o tre fallimenti.;SAG|inizio_incantatore_una_volta|Solo strato violetto, nel turno successivo dell’incantatore: successo termina cecità, fallimento trasporta su altro piano e termina cecità.',
 'psychic-scream': 'INT|lancio|Bersagli iniziali.;INT|fine_bersaglio|Se ancora stordito; successo termina lo stordimento.',
 'ravenous-void': 'FOR|inizio_bersaglio|Se entro 30 m dalla sfera; danni e trattenimento dentro la sfera non concedono TS, liberarsi richiede prova di Forza.',
 'reality-break': 'SAG|lancio|Bersaglio iniziale.;SAG|fine_bersaglio|Successo termina la magia sul bersaglio.;DES|inizio_bersaglio|Solo risultato casuale Rending Rift; altri risultati senza TS aggiuntivo.',
 'reverse-gravity': 'DES|lancio|Solo se può afferrare un oggetto fisso a portata per evitare la caduta.',
 'storm-of-vengeance': 'COS|lancio|Creature sotto la nube quando appare.;DES|condizione|Terzo round di concentrazione, creature colpite dai sei fulmini; non ogni turno.',
 'sunburst': 'COS|lancio|Creature nell’area.;COS|fine_bersaglio|Solo se ancora accecato; successo termina la cecità.',
 'symbol': 'COS/SAG/CAR/INT|condizione|Glifo attivato: ogni creatura nella sfera al momento dell’attivazione, al primo ingresso in un turno o a fine turno. COS per morte/discordia/dolore; SAG per paura/sonno/stordimento; CAR per disperazione; INT per follia.',
 'temple-of-the-gods': 'CAR|condizione|Creatura di un tipo escluso che tenta di entrare; fallimento impedisce ingresso per 24 ore.',
 'true-polymorph': 'SAG|lancio|Solo creatura non consenziente; mutaforma non influenzati.',
 'tsunami': 'FOR|lancio|Creature nell’area iniziale.;FOR|inizio_incantatore|Creature Enormi o più piccole dentro il muro o investite dal suo movimento; una volta per round.',
 'whirlwind': 'DES|condizione|Primo ingresso nel vortice o del vortice nello spazio della creatura in un turno, incluso quando appare.;FOR|condizione|Solo creatura Grande o più piccola che ha fallito quel TS di Destrezza; nessun TS a fine turno, per liberarsi usa una prova di Forza o Destrezza.',
})
NO_HOSTILE_SAVE.update({'guardian-of-nature','heroes-feast','fizbans-platinum-shield','fizban-s-platinum-shield-ua'})
END_REPEATS.update({'confusion','ego-whip','phantasmal-killer','hold-monster','immolation','psychic-crush','weird'})
for spell in ('dominate-beast','dominate-person','dominate-monster'):
 SCHEDULES[spell] = 'SAG|lancio|Bersaglio iniziale.;SAG|condizione|Ogni volta che subisce danni; successo termina la magia, nessun TS automatico a ogni turno.'


SCHEDULES.update({
 'cloudkill': 'COS|inizio_bersaglio|Se inizia il turno nell’area, anche se non respira.;COS|condizione|Primo ingresso nell’area in un turno.',
 'symbol': 'COS/SAG/CAR/INT|condizione|All’attivazione del glifo: creature nella sfera. COS per morte/discordia/dolore, SAG per paura/sonno/stordimento, CAR per disperazione, INT per follia.;COS/SAG/CAR/INT|fine_bersaglio|Se termina il turno nella sfera del glifo attivo, stessa caratteristica della modalità scelta.;COS/SAG/CAR/INT|condizione|Primo ingresso nella sfera del glifo attivo in un turno, stessa caratteristica della modalità scelta.',
 'enervation': 'DES|lancio|Unico TS iniziale; i danni delle azioni successive sono automatici e non concedono altri TS.',
 'acid-stream': 'DES|lancio|Unico TS iniziale; danni successivi a inizio turno senza TS. Un’azione può rimuovere l’acido.',
 'tashas-caustic-brew': 'DES|lancio|Unico TS iniziale; danni successivi a inizio turno senza TS. Un’azione può rimuovere l’acido.',
 'vortex-warp': 'COS|lancio|Il bersaglio può scegliere di fallire.',
 'ice-knife': 'DES|lancio|All’esplosione dopo l’attacco, sia che colpisca sia che manchi: bersaglio e creature entro 1,5 m.',
 'blight': 'COS|lancio|Creature valide; piante creature con svantaggio, piante non creature senza TS, non morti e costrutti immuni.',
})
NO_HOSTILE_SAVE.update({'aura-of-purity','circle-of-power','foresight','raise-dead','resurrection','shapechange','soul-cage'})
EXTRA_EXPIRIES = {
 'temporal-shunt': [('inizio','bersaglio','Ritorno della creatura nel suo turno successivo.')],
 'vitriolic-sphere': [('fine','bersaglio','Danno residuo nel turno successivo, solo se fallisce il TS iniziale; nessun nuovo TS.')],
 'melfs-acid-arrow': [('fine','bersaglio','Danno residuo nel turno successivo, solo se l’attacco iniziale colpisce; nessun TS.')],
 'haste': [('fine','bersaglio','Letargia dopo la fine della magia, fino alla conclusione del successivo turno del beneficiario.')],
 'reality-break': [('fine','bersaglio','Stordimento/cecità dei risultati casuali: fino alla fine del turno in cui sono prodotti, senza terminare l’intera magia.')],
 'primordial-ward': [('fine','incantatore','Dopo la reazione, l’immunità e la magia terminano alla fine del turno successivo dell’incantatore.')],
}
SPECIAL_NOTES = {
 'true-strike': 'Il vantaggio si usa sul primo attacco del turno successivo dell’incantatore. Il default di scadenza a inizio turno può eliminarlo prima dell’uso: serve gestire questo evento quando si importeranno i dati.',
 'command': 'L’ordine si esegue nel turno successivo del bersaglio. Il default inizio turno/incantatore non deve impedire l’esecuzione; alcune modalità impongono di terminare il turno del bersaglio.',
 'chill-touch': 'Divieto di recuperare PF fino a inizio del prossimo turno dell’incantatore; contro non morti lo svantaggio agli attacchi termina invece a fine di quel turno.',
 'banishment': 'Se il bersaglio è originario di un altro piano e si mantiene la magia per l’intero minuto, non ritorna alla scadenza.',
 'bestow-curse': 'Durata e concentrazione dipendono dallo slot: 3° un minuto, 4° dieci minuti, 5°/6° otto ore, 7°/8° ventiquattro ore, 9° fino a dissoluzione; dal 5° non richiede concentrazione.',
 'flesh-to-stone': 'Se si mantiene concentrazione per l’intero minuto, la pietrificazione persiste fino a rimozione.',
 'true-polymorph': 'Mantenere concentrazione per l’intera ora rende la trasformazione persistente fino a dissoluzione.',
 'synaptic-static': 'Il danno è istantaneo; la confusione residua dura fino a un minuto e ammette TS a fine turno.',
 'rimes-binding-ice': 'Il danno è istantaneo; il ghiaccio limita il movimento per un minuto oppure fino a rimozione con un’azione.',
 'icingdeath-s-frost': 'Il danno è istantaneo; il ghiaccio limita il movimento per un minuto oppure fino a rimozione con un’azione.',
 'harm': 'Refuso nella durata della pagina: Instantanous è interpretato come istantaneo. La riduzione dei PF massimi dura un’ora o fino alla rimozione della malattia.',
 'ceremony': 'Lancio istantaneo; i benefici dei diversi riti possono durare 24 ore o sette giorni. Nessun TS contro il rito; l’Espiazione richiede una prova di Intuizione.',
 'contagion': 'Il colpo applica avvelenamento temporaneo, poi i TS determinano se la malattia persiste per i sette giorni indicati. Non continuare i TS dopo aver raggiunto tre successi/fallimenti.',
 'power-word-stun': 'Nessun TS al lancio; stordimento senza durata fissa, fino a un TS riuscito.',
 'psychic-scream': 'Danno istantaneo; lo stordimento persiste senza limite indicato fino a TS riuscito.',
 'symbol': 'Glifo permanente fino ad attivazione/dissoluzione; dopo attivazione la sfera resta dieci minuti. Effetti sui singoli bersagli: un minuto, oppure dieci per sonno.',
 'glyph-of-warding': 'Il glifo termina quando viene attivato; un incantesimo immagazzinato può continuare con la propria durata e i propri TS.',
 'wish': 'I TS e la durata degli effetti dipendono dalla magia duplicata o dal desiderio; nessun TS autonomo indicato per il lancio base.',
 'contingency': 'Quando si verifica la condizione parte la magia immagazzinata, con la propria durata e i propri TS.',
 'invulnerability': 'Immunità ai danni non impedisce TS per effetti non dannosi; non richiede un TS contro questo lancio.',
 'geas': 'TS solo iniziale; violare l’ordine infligge danni senza altri TS, al massimo una volta al giorno. Durata: trenta giorni, un anno con slot 7°/8°, fino a rimozione con 9°.',
 'sleep': 'Nessun TS; i PF determinano i bersagli e danni o un’azione per svegliare possono terminare il sonno.',
 'prismatic-spray': 'Un risultato doppio può applicare due raggi e quindi due serie di eventi. La pietrificazione del raggio indaco è permanente dopo tre fallimenti.',
 'prismatic-wall': 'Gli effetti dei singoli strati possono persistere dopo l’attraversamento; il raggio indaco può causare pietrificazione permanente.',
}


SCHEDULES.update({
 'unearthly-chorus': 'CAR|condizione|Ogni volta che l’incantatore ammalia una creatura con azione bonus nel proprio turno; successo automatico se lui o i compagni la stanno attaccando.',
 'wrathful-smite': 'SAG|condizione|Primo colpo con arma da mischia; la successiva azione per liberarsi richiede una prova di Saggezza, non un TS.',
 'scrying': 'SAG|lancio|Solo versione che osserva una creatura; osservare un luogo già visto non richiede TS. Può fallire volontariamente; successo impedisce nuovi tentativi per 24 ore.',
})
SPECIAL_NOTES.update({
 'absorb-elements': 'La resistenza termina a inizio del turno successivo dell’incantatore; il danno aggiuntivo resta disponibile per il primo colpo in mischia in quel turno e quel colpo termina la magia. Non rimuovere entrambi gli effetti alla fine della resistenza.',
 'unearthly-chorus': 'L’atteggiamento amichevole dura finché sente la musica e per un’ora dopo; può quindi sopravvivere alla durata principale.',
 'summon-fey': 'Fey Step è un’azione bonus dell’evocato. Charme fino a un minuto o fino a danni; oscurità Tricksy fino a fine del prossimo turno dell’evocato.',
 'summon-shadowspawn': 'Paura dell’urlo fino a un minuto, con TS a fine turno; rallentamento Despair fino a inizio del prossimo turno del bersaglio.',
 'summon-undead': 'Avvelenamento dell’aura fino a inizio del prossimo turno del bersaglio; paura del tocco e paralisi degli artigli fino a fine del prossimo turno del bersaglio.',
 'summon-warrior-spirit': 'Il vantaggio contro il guerriero dopo Reckless Strike termina a inizio del prossimo turno del guerriero evocato, non del bersaglio del suo attacco.',
 'summon-aberration': 'L’impossibilità di recuperare PF dopo Claws termina a inizio del prossimo turno dell’aberrazione evocata.',
 'vitriolic-sphere': 'Il danno residuo si risolve a fine del prossimo turno del bersaglio, senza un altro TS.',
 'melfs-acid-arrow': 'Se l’attacco colpisce, il danno residuo si risolve a fine del prossimo turno del bersaglio; nessun TS.',
})


def event(abilities, timing, condition):
    phase, owner = None, None
    if timing.startswith(('inizio_', 'fine_')):
        phase, owner = timing.split('_', 1)
        owner = owner.removesuffix('_una_volta')
    elif timing.startswith('azione_'):
        owner = timing.split('_', 1)[1]
    return {'caratteristiche': abilities, 'quando': timing, 'faseTurno': phase,
            'turnoDi': owner, 'condizione': condition,
            'chiEffettua': 'bersaglio', 'ripetutoOgniTurno': timing.startswith(('inizio_', 'fine_')) and not timing.endswith('_una_volta')}


def analyze(spell, text):
    body = re.sub(r'^Spell Lists\..*$', '', text.split('Duration:', 1)[1].split('\n', 1)[1], flags=re.M)
    # ponytail: estrazione lessicale per i casi semplici; i casi condizionali hanno annotazioni
    # esplicite sopra. Nuove formulazioni richiedono revisione e una nuova annotazione.
    abilities = list(dict.fromkeys(ABILITIES[m] for m in re.findall(
        r'(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throws?', body)))
    events = []
    if spell['id'] not in NO_HOSTILE_SAVE:
        if spell['id'] in SCHEDULES:
            for rule in re.split(r';(?=[A-Z]{3}(?:/[A-Z]{3})*\|)', SCHEDULES[spell['id']]):
                stat, timing, condition = rule.split('|', 2)
                events.append(event(stat.split('/'), timing, condition.strip()))
        elif abilities:
            events.append(event(abilities, 'lancio', 'Bersagli validi dell’effetto iniziale.'))
            if spell['id'] in END_REPEATS:
                events.append(event(abilities, 'fine_bersaglio', 'Bersaglio ancora influenzato; successo termina l’effetto su di lui.'))
    duration = re.search(r'^Duration:\s*(.+)$', text, re.M).group(1).strip()
    info = duration_metadata(duration.replace('Instantanous', 'Instantaneous').replace(' (see below)', ''))
    expiries = []
    for m in re.finditer(r'(?:until|before|lasts? until|lasts? through) (?:the )?(?:(start|end) of )?(your|its|their|the target[’\x27]s|that creature[’\x27]s|the aberration[’\x27]s) (next )?turn', body, re.I):
        phase = (m[1] or 'start').lower()
        owner = 'incantatore' if m[2].lower() == 'your' else 'evocato' if 'aberration' in m[2].lower() or spell['id'] in ('summon-fey','summon-warrior-spirit') else 'bersaglio'
        item = {'fase': 'inizio' if phase == 'start' else 'fine', 'turnoDi': owner,
                'faseOrigine': 'testo' if m[1] else 'default_utente', 'turnoOrigine': 'testo',
                'turnoSuccessivo': bool(m[3]), 'ambito': 'effetto secondario o temporaneo descritto nella pagina'}
        if item not in expiries: expiries.append(item)
    expiry = {'fase': 'inizio', 'turnoDi': 'incantatore', 'faseOrigine': 'default_utente',
              'turnoOrigine': 'default_utente', 'applicabileContatore': info['kind'] in ('fixed','maximum')}
    expiry['scadenzaUnica'] = spell['id'] not in ('chill-touch','absorb-elements','magnify-gravity')
    if info['rounds'] == 1 and expiries:
        expiry.update({k: expiries[0][k] for k in ('fase','turnoDi','faseOrigine','turnoOrigine')})
    for phase, owner, scope in EXTRA_EXPIRIES.get(spell['id'], []):
        expiries.append({'fase': phase, 'turnoDi': owner, 'faseOrigine': 'testo', 'turnoOrigine': 'testo',
                         'turnoSuccessivo': spell['id'] != 'reality-break', 'ambito': scope})
    if spell['id'] == 'temporal-shunt':
        expiry.update({'fase': 'inizio', 'turnoDi': 'bersaglio', 'faseOrigine': 'testo', 'turnoOrigine': 'testo'})
    for e in events:
        if spell['id'] in ('contact-other-plane','tensers-transformation') or (spell['id'] == 'magic-jar' and e['quando'] == 'condizione'):
            e['chiEffettua'] = 'incantatore'
        elif spell['id'] == 'summon-greater-demon':
            e['chiEffettua'] = 'evocato'
    notes = [SPECIAL_NOTES[spell['id']]] if spell['id'] in SPECIAL_NOTES else []
    if info['kind'] == 'instantaneous': notes.append('Effetto principale istantaneo: nessuna scadenza differita del lancio; eventuali effetti successivi sono separati.')
    elif info['kind'] == 'conditional': notes.append('Durata speciale/alternativa: non convertibile in un unico contatore senza scegliere la modalità o la condizione.')
    if info['concentration']: notes.append('Termina anche se viene meno la concentrazione; la durata indicata è massima.')
    return {'id': spell['id'], 'nome': spell['name'], 'livello': spell['level'],
            'playtestUA': spell['playtest'], 'fonte': spell['sourceUrl'],
            'manualeFonte': re.search(r'^Source:\s*(.+)$', text, re.M).group(1) if re.search(r'^Source:\s*(.+)$', text, re.M) else None,
            'durata': duration, 'durataInfo': info, 'scadenza': expiry,
            'scadenzeEffetti': expiries, 'tiroSalvezzaRichiesto': bool(events),
            'caratteristicheTS': list(dict.fromkeys(a for e in events for a in e['caratteristiche'])),
            'tiriSalvezza': events,
            'gestioneManuale': ['Effetto dipendente da altra magia o da statistiche di creatura, non determinabile dal solo lancio base.'] if spell['id'] in ('wish','contingency','glyph-of-warding','shapechange','true-polymorph','polymorph','simulacrum') or spell['id'].startswith('conjure-') and not events else ['Separare uso dell’effetto e scadenza prima di applicare il default del contatore.'] if spell['id'] in ('true-strike','command','absorb-elements') else [],
            'note': notes}


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--cache', type=Path, required=True)
    args = cli.parse_args()
    index = json.loads((args.cache / 'index.json').read_text())
    records = []
    for spell in index:
        page = json.loads((args.cache / (spell['id'] + '.json')).read_text())
        if page['spell']['id'] != spell['id'] or 'Duration:' not in page['text']:
            raise ValueError(f'Pagina non valida: {spell["id"]}')
        records.append(analyze(spell, page['text']))
    database_path = ROOT / 'public/data/database.json'
    database = json.loads(database_path.read_text())
    italian = {spell_key(s['englishName']): s for s in database['spells'] if s.get('englishName')}
    english = {spell_key(s['name']): s for s in database['englishSpells']}
    missing, differences = [], []
    for record in records:
        key = spell_key(record['nome'])
        translated = italian.get(key)
        if translated: record['nomeItaliano'] = translated['name']
        for language, current in [('en', english.get(key)), ('it', translated)]:
            if not current:
                missing.append({'id': record['id'], 'nome': record['nome'], 'lingua': language})
                continue
            deltas = []
            for field in ('kind','rounds','concentration'):
                before, after = current.get('durationInfo', {}).get(field), record['durataInfo'][field]
                if before != after: deltas.append({'campo': 'durationInfo.' + field, 'database': before, 'wikidot': after})
            if language == 'en' and current.get('duration') != record['durata']:
                same_info = all(current.get('durationInfo',{}).get(k) == record['durataInfo'][k] for k in ('kind','rounds','concentration'))
                deltas.append({'campo': 'duration.testo' if same_info else 'duration', 'database': current.get('duration'), 'wikidot': record['durata']})
            dc = current.get('srdData', {}).get('dc', {}).get('dc_type', {}).get('index')
            ability = {'str':'FOR','dex':'DES','con':'COS','int':'INT','wis':'SAG','cha':'CAR'}.get(dc)
            if ability and ability not in record['caratteristicheTS']:
                deltas.append({'campo': 'srdData.dc.dc_type.index', 'database': ability, 'wikidot': record['caratteristicheTS']})
            if deltas: differences.append({'id': record['id'], 'nome': record['nome'], 'databaseId': current['id'], 'lingua': language, 'differenze': deltas})
    semantic = [d for d in differences if any(v['campo'] != 'duration.testo' for v in d['differenze'])]
    text_only = len(differences) - len(semantic)
    unknown_rounds = sum(d['lingua']=='it' and any(v['campo']=='durationInfo.rounds' and v['database'] is None and v['wikidot'] is not None for v in d['differenze']) for d in differences)
    now = datetime.now(timezone.utc).isoformat()
    report = {'generatoIl': now, 'fonteIndice': 'https://dnd5e.wikidot.com/spells',
              'ambito': 'Versioni delle pagine linkate dall’indice indicato, incluse UA; non un catalogo separato delle revisioni 2024.',
              'metodo': 'Lettura delle singole pagine, estrazione dei fatti e annotazione delle condizioni di tiro salvezza; nessuna descrizione integrale copiata.',
              'defaultUtente': {'faseScadenza': 'inizio', 'turnoScadenza': 'incantatore'},
              'convenzioni': ['I default sono convenzioni del progetto, non indicazioni esplicite delle regole.',
                  'Null nei tempi dei TS significa non applicabile: un evento può avvenire fuori dal turno del bersaglio.',
                  'Bersaglio nei TS è la creatura che effettua il tiro; può essere un attaccante o una creatura evocata.',
                  'TS superato non implica sempre termine dell’incantesimo: rispettare la condizione descritta.',
                  'Prove di caratteristica, attacchi e bonus a TS non sono TS contro l’incantesimo.',
                  'Non sono inclusi TS di concentrazione conseguenti ai danni o TS propri di condizioni/regole esterne.',
                  'ScadenzeEffetti riguarda effetti secondari: non sostituisce automaticamente la durata principale.',
                  'ScadenzaUnica=false segnala effetti che non terminano tutti insieme.',
                  'GestioneManuale evidenzia dipendenze da altre magie/statistiche o conflitti tra un default e l’uso descritto dell’effetto.'],
              'conteggio': len(records), 'incantesimiConTS': sum(r['tiroSalvezzaRichiesto'] for r in records),
              'incantesimiConGestioneManuale': sum(bool(r['gestioneManuale']) for r in records), 'incantesimi': records}
    lines = ['# Confronto incantesimi Wikidot / database', '', f'Generato: {now}.', '',
             'Fonte: [indice Wikidot](https://dnd5e.wikidot.com/spells), con lettura delle singole pagine.', '',
             f'Database: `public/data/database.json`, SHA-256 `{hashlib.sha256(database_path.read_bytes()).hexdigest()}`.', '',
             f'- Incantesimi Wikidot: **{len(records)}** (varianti UA separate).',
             f'- Voci inglesi database: **{len(english)}**; italiane: **{len(italian)}**.',
             f'- Voci mancanti: inglese **{sum(m["lingua"]=="en" for m in missing)}**, italiano **{sum(m["lingua"]=="it" for m in missing)}**.',
             f'- Voci con differenze nei dati già strutturati: **{len(differences)}**: **{len(semantic)}** con differenze nei valori e **{text_only}** soltanto nel testo della durata.',
             f'- Voci italiane con durata non convertita in round nel database: **{unknown_rounds}**.', '',
             '## Campi assenti e comportamento del programma', '',
             'Il database conserva durata, round e concentrazione. Alcune voci inglesi SRD hanno anche `srdData.dc.dc_type.index`: una sola caratteristica, senza gli eventi del TS.', '',
             'Per tutte le voci confrontate mancano campi strutturati equivalenti a `scadenza.fase`, `scadenza.turnoDi`, `scadenzeEffetti` e `tiriSalvezza` (condizioni, ripetizione, fase e proprietario del turno). Le descrizioni possono contenere queste informazioni: **assenza di struttura non significa assenza della regola nel testo**.', '',
             '`src/utils/Combat.ts` decrementa i contatori a fine round, senza distinguere il turno del lanciatore o del bersaglio. `src/utils/Catalog.ts` importa solo la durata. Questo comportamento non applica ancora le scadenze raccolte né i default inizio turno/incantatore richiesti.', '',
             'Nessuna modifica al database o al comportamento dell’app è stata eseguita con questa analisi. Il riferimento include convenzioni del progetto e condizioni specifiche: non importarlo alla cieca come un’unica scadenza per incantesimo.', '',
             '## Differenze nei campi esistenti', '',
             '`duration.testo` indica una differenza testuale a parità di tipo, round e concentrazione: punteggiatura, maiuscole, refusi o precisazioni. Le righe `durationInfo` confrontano invece i valori effettivamente memorizzati; un `null` italiano può indicare un limite del parser, anche se la descrizione della durata è corretta.', '', '| Incantesimo | Lingua | Campo | Database | Wikidot |', '|---|---|---|---|---|']
    for d in differences:
        for delta in d['differenze']:
            vals = [d['nome'], d['lingua'], delta['campo'], json.dumps(delta['database'],ensure_ascii=False), json.dumps(delta['wikidot'],ensure_ascii=False)]
            lines.append('| ' + ' | '.join(v.replace('|','\\|') for v in vals) + ' |')
    if not differences: lines.append('| Nessuna differenza | — | — | — | — |')
    lines += ['', '## Incantesimi senza corrispondenza', '', '| Incantesimo Wikidot | Lingua mancante | Fonte |', '|---|---|---|']
    urls = {r['id']: r['fonte'] for r in records}
    for m in missing: lines.append(f'| {m["nome"]} | {m["lingua"]} | [pagina]({urls[m["id"]]}) |')
    keys = {spell_key(r['nome']) for r in records}
    extra = [(lang, s) for lang, spells in [('en',database['englishSpells']),('it',database['spells'])] for s in spells if spell_key(s.get('englishName') or s['name']) not in keys]
    lines += ['', '## Voci database fuori dall’indice', '']
    lines += [f'- {lang}: {s["name"]} (`{s["id"]}`).' for lang,s in extra] or ['Nessuna.']
    lines += ['', '## Casi che richiedono gestione specifica', '',
              'Le voci seguenti dipendono da altre magie/statistiche oppure richiedono di separare l’uso dell’effetto dalla scadenza del contatore. Questa segnalazione non applica modifiche all’app.', '',
              *[f'- **{r["nome"]}**: {" ".join(r["gestioneManuale"])}' for r in records if r['gestioneManuale']], '',
              '## Criterio di confronto', '',
              'Corrispondenza per nome inglese normalizzato con gli alias SRD già verificati in `scripts/sync_spells.py`. Nessun abbinamento approssimativo; versioni UA distinte. Le durate italiane sono confrontate tramite round, tipo e concentrazione, senza segnalare la semplice differenza di lingua. La caratteristica SRD, se presente, è confrontata con le caratteristiche dei TS della pagina.', '']
    output = ROOT / 'reports'
    output.mkdir(exist_ok=True)
    (output / 'incantesimi-wikidot.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    (output / 'differenze-incantesimi-wikidot.md').write_text('\n'.join(lines))
    print(f'{len(records)} incantesimi; {len(differences)} voci differenti; {len(missing)} corrispondenze mancanti.')


if __name__ == '__main__':
    main()
