"""PHB appendices B/C: factual tables checked on renders, Italian paraphrases.

Pantheons are setting options, not automatic class/domain or alignment constraints.
The same name in different pantheons retains its setting-specific identity.
"""
from curated import record


# name|alignment|suggested domains|Italian portfolio|Italian symbol description
PANTHEONS = {
 'forgotten-realms': (295, 'Forgotten Realms', '''Auril|NE|nature tempest|inverno|fiocco di neve a sei punte
Azuth|LN|knowledge|maghi|mano sinistra alzata tra fiamme
Bane|LE|war|tirannia|mano destra nera verticale
Beshaba|CE|trickery|sfortuna|palchi neri
Bhaal|NE|death|assassinio|teschio circondato da gocce di sangue
Chauntea|NG|life|agricoltura|fascio di grano o rosa sul grano
Cyric|CE|trickery|menzogne|teschio senza mandibola su sole nero o viola
Deneir|NG|knowledge|scrittura|candela accesa sopra un occhio aperto
Eldath|NG|life nature|pace|cascata in una pozza tranquilla
Gond|N|knowledge|artigianato|ingranaggio a quattro raggi
Helm|LN|life light|protezione|occhio su guanto sinistro verticale
Ilmater|LG|life|resistenza alla sofferenza|mani legate ai polsi da corda rossa
Kelemvor|LN|death|morti|braccio scheletrico con bilancia
Lathander|NG|life light|nascita e rinnovamento|strada verso l'alba
Leira|CN|trickery|illusione|triangolo rovesciato con nebbia
Lliira|CG|life|gioia|tre stelle a sei punte disposte a triangolo
Loviatar|LE|death|dolore|flagello uncinato a nove code
Malar|CE|nature|caccia|zampa artigliata
Mask|CN|trickery|ladri|maschera nera
Mielikki|NG|nature|foreste|testa di unicorno
Milil|NG|light|poesia e canto|arpa di foglie a cinque corde
Myrkul|NE|death|morte|teschio umano bianco
Mystra|NG|knowledge|magia|sette stelle in cerchio; oppure nove con nebbia rossa; oppure stella singola
Oghma|N|knowledge|conoscenza|pergamena nera
Savras|LN|knowledge|divinazione e destino|sfera di cristallo con molti occhi
Selûne|CG|knowledge life|luna|due occhi tra sette stelle
Shar|NE|death trickery|oscurità e perdita|disco nero con bordo
Silvanus|N|nature|natura selvaggia|foglia di quercia
Sune|CG|life light|amore e bellezza|volto femminile dai capelli rossi
Talona|CE|death|malattie e veleno|tre gocce su un triangolo
Talos|CE|tempest|tempeste|tre fulmini da un punto centrale
Tempus|N|war|guerra|spada verticale in fiamme
Torm|LG|war|coraggio e sacrificio|guanto destro bianco
Tymora|CG|trickery|fortuna|moneta con volto rivolto in alto
Tyr|LG|war|giustizia|bilancia sopra un martello da guerra
Umberlee|CE|tempest|mare|onda ricurva nelle due direzioni
Waukeen|N|knowledge trickery|commercio|moneta verticale con profilo di Waukeen'''),
 'greyhawk': (296, 'Greyhawk', '''Beory|N|nature|natura|disco verde
Boccob|N|knowledge|magia|occhio in un pentagramma
Celestian|N|knowledge|stelle e viandanti|sette stelle ad arco in un cerchio
Ehlonna|NG|life nature|boschi|corno di unicorno
Erythnul|CE|war|invidia e stragi|goccia di sangue
Fharlanghn|NG|knowledge trickery|orizzonti e viaggio|cerchio attraversato da orizzonte curvo
Heironeous|LG|war|cavalleria e valore|fulmine
Hextor|LE|war|guerra e discordia|ventaglio di sei frecce verso il basso
Kord|CG|tempest war|atletica e sport|quattro lance e quattro mazze da un centro
Incabulos|NE|death|peste e carestia|occhio rettiliano con rombo orizzontale
Istus|N|knowledge|fato e destino|fuso con tre fili
Iuz|CE|death|dolore e oppressione|teschio umano sorridente
Nerull|NE|death|morte|teschio con falce
Obad-Hai|N|nature|natura|foglia e ghianda di quercia
Olidammara|CN|trickery|baldoria|maschera ridente
Pelor|NG|life light|sole e guarigione|sole
Pholtus|LG|light|luce e legge|sole argenteo o luna piena dietro una falce lunare
Ralishaz|CN|trickery|sfortuna e follia|tre bastoncini divinatori di osso
Rao|LG|knowledge|pace e ragione|cuore bianco
St. Cuthbert|LN|knowledge|buonsenso e zelo|cerchio al centro di raggi
Tharizdun|CE|trickery|oscurità eterna|spirale scura o ziggurat invertita
Trithereon|CG|war|libertà e vendetta|triscele
Ulaa|LG|life war|colline e montagne|montagna con cerchio centrale
Vecna|NE|knowledge|segreti malvagi|mano con occhio nel palmo
Wee Jas|LN|death knowledge|magia e morte|teschio rosso davanti a palla di fuoco'''),
 'dragonlance': (296, 'Dragonlance', '''Paladine|LG|war|sovrani e guardiani|triangolo argenteo
Branchala|NG|light|musica|arpa del bardo
Habbakuk|NG|nature tempest|animali e mare|uccello blu
Kiri-Jolith|LG|war|onore e guerra|corna di bisonte
Majere|LG|knowledge|meditazione e ordine|ragno di rame
Mishakal|LG|knowledge life|guarigione|segno blu dell'infinito
Solinari|LG|none|magia buona|cerchio o sfera bianchi
Gilean|N|knowledge|conoscenza|libro aperto
Chislev|N|nature|natura|piuma
Reorx|N|knowledge|artigianato|martello da fabbro
Shinare|N|knowledge trickery|ricchezza e commercio|ala di grifone
Sirrion|N|nature|fuoco e cambiamento|fuoco multicolore
Zivilyn|N|knowledge|saggezza|grande albero verde o dorato
Lunitari|N|none|magia neutrale|cerchio o sfera rossi
Takhisis|LE|death|notte e odio|falce nera
Chemosh|LE|death|non morti|teschio giallo
Hiddukel|CE|trickery|menzogne e avidità|bilancia commerciale spezzata
Morgion|NE|death|malattia e segretezza|cappuccio con due occhi rossi
Sargonnas|LE|war|vendetta e fuoco|condor rosso stilizzato
Zeboim|CE|tempest|mare e tempeste|guscio di tartaruga
Nuitari|LE|none|magia malvagia|cerchio o sfera neri'''),
 'eberron': (297, 'Eberron', '''Arawai|NG|life nature|fertilità|grano legato da nastro verde
Aureon|LN|knowledge|legge e conoscenza|tomo aperto
Balinor|N|life nature|bestie e caccia|due palchi
Boldrei|LG|life|comunità e casa|fuoco in focolare di pietra
Dol Arrah|LG|light war|sole e onore|sole nascente
Dol Dorn|CG|war|forza delle armi|spada lunga sopra scudo
Kol Korran|N|trickery|commercio e ricchezza|moneta d'oro a nove lati
Olladra|NG|life trickery|fortuna|domino
Onatar|NG|knowledge|artigianato|martello e tenaglie incrociati
The Devourer|NE|tempest|furia della natura|cinque ossa affilate legate insieme
The Fury|NE|war|ira e follia|draco alato con testa e busto femminili
The Keeper|NE|death|avidità e morte|cristallo draconico a forma di zanna
The Mockery|NE|war|violenza e tradimento|cinque strumenti insanguinati
The Shadow|CE|knowledge|magia oscura|torre di ossidiana
The Traveler|CN|knowledge trickery|caos e cambiamento|quattro ossa incrociate con rune
The Silver Flame|LG|life light war|protezione e bene|fiamma disegnata o modellata in argento
The Blood of Vol|LN|death life|immortalità e non morte|teschio di drago su gemma a goccia rossa
Cults of the Dragon Below|NE|trickery|follia|variabile
The Path of Light|LN|life light|luce e perfezionamento personale|cristallo splendente
The Undying Court|NG|knowledge life|antenati elfi|variabile
The Spirits of the Past|CG|war|antenati elfi|variabile'''),
 'nonhuman': (297, 'Nonhuman deities', '''Bahamut|LG|life war|draghi buoni|testa di drago di profilo
Blibdoolpoolp|NE|death|kuo-toa|testa di aragosta o perla nera
Corellon Larethian|CG|light|arte e magia degli elfi|quarto di luna o raggi di stella
Deep Sashelas|CG|nature tempest|mare degli elfi|delfino
Eadro|N|nature tempest|mare di merfolk e locathah|spirale
Garl Glittergold|LG|trickery|inganno e astuzia degli gnomi|pepita d'oro
Grolantor|CE|war|guerra dei giganti delle colline|randello di legno
Gruumsh|CE|tempest war|tempeste e guerra degli orchi|occhio aperto
Hruggek|CE|war|violenza dei bugbear|morningstar
Kurtulmak|LE|war|guerra ed estrazione dei coboldi|teschio di gnomo
Laogzed|CE|death|fame dei trogloditi|immagine del dio lucertola-rospo
Lolth|CE|trickery|ragni dei drow|ragno
Maglubiyet|LE|war|guerra dei goblinoidi|ascia insanguinata
Moradin|LG|knowledge|creazione dei nani|martello e incudine
Rillifane Rallathil|CG|nature|natura degli elfi dei boschi|quercia
Sehanine Moonbow|CG|knowledge|luna degli elfi|falce lunare
Sekolah|LE|nature tempest|caccia dei sahuagin|squalo
Semuanya|N|life|sopravvivenza dei lizardfolk|uovo
Skerrit|N|nature|natura di centauri e satiri|quercia che nasce da ghianda
Skoraeus Stonebones|N|knowledge|arte dei giganti di pietra|stalattite
Surtur|LE|knowledge war|arte dei giganti del fuoco|spada in fiamme
Thrym|CE|war|forza dei giganti del gelo|ascia bianca a doppia lama
Tiamat|LE|trickery|draghi malvagi|testa di drago con cinque segni d'artiglio
Yondalla|LG|life|fertilità e protezione degli halfling|scudo'''),
 'celtic': (299, 'Celtic deities', '''The Daghdha|CG|nature trickery|tempo atmosferico e raccolti|calderone gorgogliante o scudo
Arawn|NE|life death|vita e morte|stella nera su fondo grigio
Belenus|NG|light|sole, luce e calore|disco solare e pietre verticali
Brigantia|NG|life|fiumi e bestiame|passerella
Diancecht|LG|life|medicina e guarigione|rami incrociati di quercia e vischio
Dunatis|N|nature|montagne e vette|vetta con sole rosso
Goibhniu|NG|knowledge life|fabbri e guarigione|grande maglio sopra spada
Lugh|CN|knowledge life|arti, viaggio e commercio|due lunghe mani
Manannan mac Lir|LN|nature tempest|oceani e creature marine|onda bianca su verde
Math Mathonwy|NE|knowledge|magia|bastone
Morrigan|CE|war|battaglia|due lance incrociate
Nuada|N|war|guerra e guerrieri|mano argentea su nero
Oghma|NG|knowledge|parola e scrittura|pergamena aperta
Silvanus|N|nature|natura e foreste|quercia estiva'''),
 'greek': (299, 'Greek deities', '''Zeus|N|tempest|cielo e sovranità divina|pugno con fulmini
Aphrodite|CG|light|amore e bellezza|conchiglia
Apollo|CG|knowledge life light|luce, musica e guarigione|lira
Ares|CE|war|guerra e conflitto|lancia
Artemis|NG|life nature|caccia e parto|arco e freccia su disco lunare
Athena|LG|knowledge war|saggezza e civiltà|gufo
Demeter|NG|life|agricoltura|testa di giumenta
Dionysus|CN|life|gioia e vino|tirso con pigna
Hades|LE|death|oltretomba|ariete nero
Hecate|CE|knowledge trickery|magia e luna|luna calante
Hephaestus|NG|knowledge|fabbri e artigianato|martello e incudine
Hera|CN|trickery|matrimonio e intrighi|ventaglio di piume di pavone
Hercules|CG|tempest war|forza e avventura|testa di leone
Hermes|CG|trickery|viaggio e commercio|caduceo alato con serpenti
Hestia|NG|life|casa e famiglia|focolare
Nike|LN|war|vittoria|donna alata
Pan|CN|nature|natura|flauto di Pan
Poseidon|CN|tempest|mare e terremoti|tridente
Tyche|N|trickery|fortuna|pentagramma rosso'''),
 'egyptian': (300, 'Egyptian deities', '''Re-Horakhty|LG|life light|sole e sovranità divina|disco solare circondato da serpente
Anubis|LN|death|giudizio e morte|sciacallo nero
Apep|NE|trickery|male, fuoco e serpenti|serpente fiammeggiante
Bast|CG|war|gatti e vendetta|gatto
Bes|CN|trickery|fortuna e musica|immagine della divinità deforme
Hathor|NG|life light|amore, musica e maternità|testa di vacca con corna e disco lunare
Imhotep|NG|knowledge|artigianato e medicina|piramide a gradoni
Isis|NG|knowledge life|fertilità e magia|ankh e stella
Nephthys|CG|death|morte e lutto|corna intorno a disco lunare
Osiris|LG|life nature|natura e oltretomba|bastone pastorale e flagello
Ptah|LN|knowledge|artigianato, conoscenza e segreti|toro
Set|CE|death tempest trickery|oscurità e tempeste del deserto|cobra arrotolato
Sobek|LE|nature tempest|acqua e coccodrilli|testa di coccodrillo con corna e piume
Thoth|N|knowledge|conoscenza e saggezza|ibis'''),
 'norse': (300, 'Norse deities', '''Odin|NG|knowledge war|conoscenza e guerra|occhio blu vigile
Aegir|NE|tempest|mare e tempeste|onde agitate
Balder|NG|life light|bellezza e poesia|calice argenteo con gemme
Forseti|N|light|giustizia e legge|testa di uomo barbuto
Frey|NG|life light|fertilità e sole|spadone azzurro ghiaccio
Freya|NG|life|fertilità e amore|falco
Frigga|N|life light|nascita e fertilità|gatto
Heimdall|LG|light war|vigilanza e lealtà|corno musicale ricurvo
Hel|NE|death|oltretomba|volto femminile per metà in decomposizione
Hermod|CN|trickery|fortuna|pergamena alata
Loki|CE|trickery|ladri e inganno|fiamma
Njord|NG|nature tempest|mare e vento|moneta d'oro
Odur|CG|light|luce e sole|disco solare
Sif|CG|war|guerra|spada alzata
Skadi|N|nature|terra e montagne|vetta
Surtur|LE|war|giganti del fuoco e guerra|spada in fiamme
Thor|CG|tempest war|tempeste e tuono|martello
Thrym|CE|war|giganti e freddo|ascia bianca a doppia lama
Tyr|LN|knowledge war|coraggio e strategia|spada
Uller|CN|nature|caccia e inverno|arco lungo'''),
}


def appendices():
    records = []
    for index, (page, name, rows) in PANTHEONS.items():
        entries = []
        for row in rows.splitlines():
            deity, alignment, domains, portfolio, symbol = row.split('|')
            entries.append({'index': deity.casefold().replace(' ', '-'), 'name': deity,
                'alignment': alignment, 'suggestedDomains': [] if domains == 'none' else domains.split(),
                'clericsSupportedInTable': domains != 'none', 'portfolioIt': portfolio, 'symbolIt': symbol})
        e = record('rule', 'pantheon-'+index, name, 'Pantheon: '+name, page,
            {'ruleType': 'pantheon-catalog', 'setting': index, 'entries': entries,
             'requiresDMCampaignAvailability': True, 'domainsAreSuggestions': True,
             'characterAlignmentEnforced': False, 'automaticClassFeaturesGranted': False},
            'Opzione di ambientazione autorizzata dal DM. Ogni voce conserva nome, allineamento, ambito, simbolo e domini suggeriti; non conferisce privilegi automaticamente. I pantheon storici sono adattamenti fantastici del gioco, non descrizioni delle religioni reali.')
        e['sources'][0]['verification'] = 'read-local-render'
        records.append(e)
    records.append(record('rule', 'deity-selection', 'Choosing deities', 'Divinità e domini', [294,298,299],
        {'ruleType': 'deity-selection', 'requiresDMCampaignAvailability': True,
         'worshipChoices': ['one', 'multiple', 'none'], 'listedDomainsBinding': False,
         'lifeDomainMayServeAnyNonEvilDeity': True, 'deathDomainRequiresDMApproval': True,
         'deathDomainClericNecessarilyEvil': False},
        'Il DM stabilisce le fedi presenti. È possibile venerare più divinità o nessuna; chierici e accoliti scelgono un riferimento coerente con la campagna. I domini elencati sono suggerimenti. Vita può appartenere a ogni divinità non malvagia; Morte è opzionale e non rende obbligatoriamente malvagio il chierico.'))
    planes = [('Mount Celestia',['LG']),('Bytopia',['NG','LG']),('Elysium',['NG']),
        ('Beastlands',['NG','CG']),('Arborea',['CG']),('Ysgard',['CN','CG']),('Limbo',['CN']),
        ('Pandemonium',['CN','CE']),('Abyss',['CE']),('Carceri',['NE','CE']),('Hades',['NE']),
        ('Gehenna',['NE','LE']),('Nine Hells',['LE']),('Acheron',['LN','LE']),('Mechanus',['LN']),('Arcadia',['LN','LG'])]
    records.append(record('rule', 'planes-of-existence', 'Planes of Existence', 'Piani di esistenza', [301,302,303],
        {'ruleType': 'planar-cosmology', 'requiresDMCosmology': True,
         'materialWorlds': ['Greyhawk','Blackmoor','Dragonlance','Forgotten Realms','Mystara','Birthright','Dark Sun','Eberron'],
         'materialEchoes': ['Feywild','Shadowfell'], 'transitivePlanes': ['Ethereal','Astral'],
         'innerElementalPlanes': ['Air','Earth','Fire','Water'], 'elementalChaosSurroundsInnerPlanes': True,
         'outerPlanes': [{'name': n, 'alignments': a} for n,a in planes],
         'outerDistanceRequiresDM': True, 'alignmentDissonanceAutomaticPenalty': None,
         'outlands': {'alignment':'N','gateTowns':16,'sigil':'ring-city-above-spire','portalKeysRequireDM':True},
         'travelSpellIds':['phb2014:spell:plane-shift','phb2014:spell:gate','phb2014:spell:etherealness','phb2014:spell:astral-projection'],
         'portals': {'fixedLocations':True,'permanenceAndKeys':'DM-dependent'},
         'demiplanes': {'uniqueRules':True,'planeShiftRequiresCorrectTuningFork':True,'gateRequiresKnowledgeOfDestination':True},
         'farRealm': {'beyondKnownCosmology':True,'knownViablePortals':False,'automaticMadnessRuleSpecified':False}},
        'Cosmologia proposta: mondi materiali, loro riflessi, piani di transito, quattro elementi e sedici piani esterni. I viaggi richiedono magie o portali e decisioni del DM; la dissonanza morale non impone qui una penalità numerica. Terre Esterne, Sigil, semipiani e Reame Remoto mantengono regole e accessi distinti.'))
    records[-1]['sources'][0]['verification'] = 'read-local-render'
    # The PHB table calls Thrym a fire giant; the adjacent explanation and MM
    # identify frost giants. Preserve this printing discrepancy, not a guessed fix.
    records[-3]['interpretations'].append({'kind':'printing-discrepancy','field':'entries.Thrym.portfolioIt',
        'originalTable':'fire giants and cold','adjacentText':'giant gods; nonhuman table frost giants',
        'resolution':'neutral Italian wording; original wording retained here, no silent erratum'})
    pages = {305:'bat black-bear boar brown-bear',306:'cat constrictor-snake crocodile dire-wolf frog',
        307:'giant-eagle giant-spider hawk imp',308:'lion mastiff mule',309:'owl panther poisonous-snake pseudodragon',
        310:'quasit rat raven reef-shark',311:'riding-horse skeleton sprite',312:'tiger warhorse wolf zombie'}
    differences = {
        'owl': {'trait': {'index':'keen-sight','usingSenses':['sight']},'MM':'keen-hearing-and-sight'},
        'mule': {'trait': {'index':'sure-footed','when':'would-be-knocked-prone','saveAbility':'dexterity','saveDC':10,'success':'remains-standing'},'MM':'advantage-on-strength-and-dexterity-saves-against-prone-effects'},
        'sprite': {'stealthDisadvantageWhileFlying':True,'MM':'no-flight-disadvantage-listed'},
        'constrictor-snake': {'grappleEscapeDCInPHB':None,'status':'not-stated-in-PHB-block; MM-escape-DC-14-separate'},
        'crocodile': {'grappleEscapeDCInPHB':None,'status':'not-stated-in-PHB-block; MM-escape-DC-12-separate'},
    }
    entries=[{'creatureId':'mm2014:creature:'+i,'phbPdfPages':[p,308] if i=='imp' else [p],
        'identityStatus':'same-creature-separate-local-printing','phbSpecificDifferences':differences.get(i,{})}
        for p, names in pages.items() for i in names.split()]
    e=record('rule','phb-creature-appendix','Creature Statistics Appendix','Creature nell’appendice PHB',list(range(305,313)),
        {'ruleType':'creature-source-crosswalk','entries':entries,'automaticallyOverridesMM':False,
         'phbErrataPdfPage':5,'confirmedEditorialChanges':[
             {'creatureId':'mm2014:creature:black-bear','actionIndexes':['bite','claws'],'field':'attackBonus','before':3,'after':4},
             {'creatureId':'mm2014:creature:brown-bear','actionIndexes':['bite','claws'],'field':'attackBonus','before':5,'after':6},
             {'creatureId':'mm2014:creature:riding-horse','actionIndexes':['hooves'],'field':'attackBonus','before':2,'after':5},
             {'creatureId':'mm2014:creature:warhorse','actionIndexes':['hooves'],'field':'attackBonus','before':4,'after':6},
             {'creatureId':'mm2014:creature:imp','field':'conditionalDamageResistances','before':'nonmagical-weapons-not-silvered','after':'nonmagical-attacks-not-made-with-silvered-weapons'},
             {'creatureId':'mm2014:creature:quasit','field':'conditionalDamageResistances','before':'nonmagical-weapons','after':'nonmagical-attacks'}],
         'warhorseBardingAC':{'leather':12,'studded-leather':13,'ring-mail':14,'scale-mail':15,'chain-mail':16,'splint':17,'plate':18},
         'lionPrintedIntelligenceModifier':{'abilityScore':3,'printedModifier':-3,'arithmeticModifier':-4,'status':'printing-arithmetic-inconsistency'}},
        'Trentuno creature già censite nel MM, senza duplicare le identità. Le differenze della copia PHB restano esplicite: vista del gufo, stabilità del mulo, furtività in volo dello spiritello e CD mancanti per liberarsi da serpente/coccodrillo. Le sei correzioni PHB conservano prima e dopo; la bardatura resta una variante. Non si sostituisce automaticamente un manuale con l’altro.')
    e['sources'][0]['verification']='read-local-render'
    e['sources'].append({'edition':'2014','book':'phb-errata','filename':'PH-Errata.pdf','pdfPages':[5],
        'printedPages':None,'section':'Appendix D: Creature Statistics','verification':'read-local-text'})
    e['fieldSources']['confirmedEditorialChanges']=[0,1]
    records.append(e)
    return records
