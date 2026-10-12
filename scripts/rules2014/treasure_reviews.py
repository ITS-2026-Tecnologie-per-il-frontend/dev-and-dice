"""DMG PDF 134–140 and 145–150, individually read against page renders.

Tables keep explicit variants and nested rolls; they never create an item by
guessing a similar name. A verified probability row does not certify its item.
"""
from curated import record
from magic_item_reviews import magic_items


def treasure_rules():
    items = {e['index']: e for e in magic_items()}
    result = []

    def table(index, name, italian, page, die, entries, **extra):
        rows = []
        low = 1
        for high, effect, summary in entries:
            rows.append({'low': low, 'high': high, 'effect': effect, 'summaryIt': summary})
            low = high + 1
        assert low == die + 1, index
        e = record('rule', index, name, italian, page,
                   {'ruleType': 'treasure-table', 'requiresDMApproval': True,
                    'die': die, 'rows': rows, **extra},
                   italian + ': fasce e quantità controllate sul render. Il DM può scegliere invece di tirare; le dipendenze mantengono la loro verifica.', book='dmg', optional=True)
        e['sources'][0]['verification'] = 'read-local-render'
        result.append(e)
        return e

    gems = [
      (10, 'Azurite|Banded agate|Blue quartz|Eye agate|Hematite|Lapis lazuli|Malachite|Moss agate|Obsidian|Rhodochrosite|Tiger eye|Turquoise', 'Azzurrite|Agata a bande|Quarzo blu|Agata occhio|Ematite|Lapislazzuli|Malachite|Agata muschiata|Ossidiana|Rodocrosite|Occhio di tigre|Turchese'),
      (50, 'Bloodstone|Carnelian|Chalcedony|Chrysoprase|Citrine|Jasper|Moonstone|Onyx|Quartz|Sardonyx|Star rose quartz|Zircon', 'Eliotropio|Corniola|Calcedonio|Crisoprasio|Citrino|Diaspro|Pietra di luna|Onice|Quarzo|Sardonice|Quarzo rosa stellato|Zircone'),
      (100, 'Amber|Amethyst|Chrysoberyl|Coral|Garnet|Jade|Jet|Pearl|Spinel|Tourmaline', 'Ambra|Ametista|Crisoberillo|Corallo|Granato|Giada|Giaietto|Perla|Spinello|Tormalina'),
      (500, 'Alexandrite|Aquamarine|Black pearl|Blue spinel|Peridot|Topaz', 'Alessandrite|Acquamarina|Perla nera|Spinello blu|Peridoto|Topazio'),
      (1000, 'Black opal|Blue sapphire|Emerald|Fire opal|Opal|Star ruby|Star sapphire|Yellow sapphire', 'Opale nero|Zaffiro blu|Smeraldo|Opale di fuoco|Opale|Rubino stellato|Zaffiro stellato|Zaffiro giallo'),
      (5000, 'Black sapphire|Diamond|Jacinth|Ruby', 'Zaffiro nero|Diamante|Giacinto|Rubino'),
    ]
    for value, english, italian in gems:
        en, it = english.split('|'), italian.split('|')
        assert len(en) == len(it)
        table('gems-'+str(value), f'{value} gp Gemstones', f'Gemme da {value} mo', 135, len(en),
              [(i+1, {'name': n, 'nameIt': it[i], 'valueGP': value}, it[i]) for i, n in enumerate(en)],
              treasureType='gem', unitValueGP=value, selection='DM-may-use-one-type-for-all-or-mixed-types')
    art = [
      (25,135,'Silver ewer|Carved bone statuette|Small gold bracelet|Cloth-of-gold vestments|Black velvet mask with silver embroidery|Copper chalice with silver filigree|Pair of engraved bone dice|Small mirror in painted wooden frame|Embroidered silk handkerchief|Gold locket with painted portrait', 'Brocca d’argento|Statuetta d’osso|Braccialetto d’oro piccolo|Vesti in tessuto dorato|Maschera di velluto nero ricamata in argento|Calice di rame con filigrana d’argento|Due dadi d’osso incisi|Specchio con cornice lignea dipinta|Fazzoletto di seta ricamato|Medaglione d’oro con ritratto'),
      (250,135,'Gold ring set with bloodstones|Carved ivory statuette|Large gold bracelet|Silver necklace with gemstone pendant|Bronze crown|Silk robe with gold embroidery|Large well-made tapestry|Brass mug with jade inlay|Box of turquoise animal figurines|Gold birdcage with electrum filigree', 'Anello d’oro con eliotropi|Statuetta d’avorio|Braccialetto d’oro grande|Collana d’argento con gemma|Corona di bronzo|Veste di seta ricamata in oro|Arazzo grande di buona fattura|Boccale d’ottone intarsiato in giada|Scatola con animali in turchese|Gabbia d’oro con filigrana d’elettro'),
      (750,136,'Silver chalice with moonstones|Silver-plated steel longsword with jet hilt|Carved harp of exotic wood with ivory and zircon gems|Small gold idol|Gold dragon comb with red garnet eyes|Bottle stopper cork with gold leaf and amethysts|Ceremonial electrum dagger with black pearl pommel|Silver and gold brooch|Obsidian statuette with gold fittings and inlay|Painted gold war mask', 'Calice d’argento con pietre di luna|Spada lunga d’acciaio argentata con elsa di giaietto|Arpa di legno esotico con avorio e zirconi|Idolo d’oro piccolo|Pettine drago d’oro con occhi di granato|Tappo con foglia d’oro e ametiste|Pugnale cerimoniale d’elettro con perla nera|Spilla d’argento e oro|Statuetta d’ossidiana con oro|Maschera da guerra d’oro dipinta'),
      (2500,136,'Gold chain set with a fire opal|Old masterpiece painting|Embroidered silk and velvet mantle with numerous moonstones|Platinum bracelet set with a sapphire|Embroidered glove set with jewel chips|Jeweled anklet|Gold music box|Gold circlet set with four aquamarines|Eye patch with mock eye in blue sapphire and moonstone|A necklace string of small pink pearls', 'Catena d’oro con opale di fuoco|Dipinto antico di grande pregio|Mantello di seta e velluto con pietre di luna|Bracciale di platino con zaffiro|Guanto ricamato con frammenti di gemme|Cavigliera con gioielli|Carillon d’oro|Diadema d’oro con quattro acquamarine|Benda con occhio di zaffiro e pietra di luna|Collana di piccole perle rosa'),
      (7500,136,'Jeweled gold crown|Jeweled platinum ring|Small gold statuette set with rubies|Gold cup set with emeralds|Gold jewelry box with platinum filigree|Painted gold child’s sarcophagus|Jade game board with solid gold playing pieces|Bejeweled ivory drinking horn with gold filigree', 'Corona d’oro con gioielli|Anello di platino con gioielli|Statuetta d’oro con rubini|Coppa d’oro con smeraldi|Portagioie d’oro con filigrana di platino|Sarcofago infantile d’oro dipinto|Tavoliere di giada con pedine d’oro|Corno potorio d’avorio con gemme e filigrana d’oro'),
    ]
    for value, page, english, italian in art:
        en, it = english.split('|'), italian.split('|')
        assert len(en) == len(it)
        table('art-'+str(value), f'{value} gp Art Objects', f'Oggetti d’arte da {value} mo', page, len(en),
              [(i+1, {'name': n, 'nameIt': it[i], 'valueGP': value}, it[i]) for i,n in enumerate(en)],
              treasureType='art', unitValueGP=value, selection='roll-once-per-object-duplicates-allowed')

    # Explicit, reviewed item indexes; @ selects an existing variant, / an armor type.
    # Braces below represent a further die roll, not a free choice of rarity.
    magic = {
      'A': (145, [(50,'potion-of-healing@healing'),(60,'spell-scroll@0'),(70,'potion-of-climbing'),(90,'spell-scroll@1'),(94,'spell-scroll@2'),(98,'potion-of-healing@greater'),(99,'bag-of-holding'),(100,'driftglobe')]),
      'B': (145, [(15,'potion-of-healing@greater'),(22,'potion-of-fire-breath'),(29,'potion-of-resistance'),(34,'ammunition@ammunition-1'),(39,'potion-of-animal-friendship'),(44,'potion-of-giant-strength@hill'),(49,'potion-of-growth'),(54,'potion-of-water-breathing'),(59,'spell-scroll@2'),(64,'spell-scroll@3'),(67,'bag-of-holding'),(70,'keoghtoms-ointment'),(73,'oil-of-slipperiness'),(75,'dust-of-disappearance'),(77,'dust-of-dryness'),(79,'dust-of-sneezing-and-choking'),(81,'elemental-gem'),(83,'philter-of-love'),(84,'alchemy-jug'),(85,'cap-of-water-breathing'),(86,'cloak-of-the-manta-ray'),(87,'driftglobe'),(88,'goggles-of-night'),(89,'helm-of-comprehending-languages'),(90,'immovable-rod'),(91,'lantern-of-revealing'),(92,'mariners-armor'),(93,'mithral-armor'),(94,'potion-of-poison'),(95,'ring-of-swimming'),(96,'robe-of-useful-items'),(97,'rope-of-climbing'),(98,'saddle-of-the-cavalier'),(99,'wand-of-magic-detection'),(100,'wand-of-secrets')]),
      'C': (146, [(15,'potion-of-healing@superior'),(22,'spell-scroll@4'),(27,'ammunition@ammunition-2'),(32,'potion-of-clairvoyance'),(37,'potion-of-diminution'),(42,'potion-of-gaseous-form'),(47,'potion-of-giant-strength@frost'),(52,'potion-of-giant-strength@stone'),(57,'potion-of-heroism'),(62,'potion-of-invulnerability'),(67,'potion-of-mind-reading'),(72,'spell-scroll@5'),(75,'elixir-of-health'),(78,'oil-of-etherealness'),(81,'potion-of-giant-strength@fire'),(84,'quaals-feather-token'),(87,'scroll-of-protection'),(89,'bag-of-beans'),(91,'bead-of-force'),(92,'chime-of-opening'),(93,'decanter-of-endless-water'),(94,'eyes-of-minute-seeing'),(95,'folding-boat'),(96,'hewards-handy-haversack'),(97,'horseshoes-of-speed'),(98,'necklace-of-fireballs'),(99,'periapt-of-health'),(100,'sending-stones')]),
      'D': (146, [(20,'potion-of-healing@supreme'),(30,'potion-of-invisibility'),(40,'potion-of-speed'),(50,'spell-scroll@6'),(57,'spell-scroll@7'),(62,'ammunition@ammunition-3'),(67,'oil-of-sharpness'),(72,'potion-of-flying'),(77,'potion-of-giant-strength@cloud'),(82,'potion-of-longevity'),(87,'potion-of-vitality'),(92,'spell-scroll@8'),(95,'horseshoes-of-a-zephyr'),(98,'nolzurs-marvelous-pigments'),(99,'bag-of-devouring'),(100,'portable-hole')]),
      'E': (146, [(30,'spell-scroll@8'),(55,'potion-of-giant-strength@storm'),(70,'potion-of-healing@supreme'),(85,'spell-scroll@9'),(93,'universal-solvent'),(98,'arrow-of-slaying'),(100,'sovereign-glue')]),
      'F': (147, [(15,'weapon@1'),(18,'shield@1'),(21,'sentinel-shield'),(23,'amulet-of-proof-against-detection-and-location'),(25,'boots-of-elvenkind'),(27,'boots-of-striding-and-springing'),(29,'bracers-of-archery'),(31,'brooch-of-shielding'),(33,'broom-of-flying'),(35,'cloak-of-elvenkind'),(37,'cloak-of-protection'),(39,'gauntlets-of-ogre-power'),(41,'hat-of-disguise'),(43,'javelin-of-lightning'),(45,'pearl-of-power'),(47,'rod-of-the-pact-keeper@1'),(49,'slippers-of-spider-climbing'),(51,'staff-of-the-adder'),(53,'staff-of-the-python'),(55,'sword-of-vengeance'),(57,'trident-of-fish-command'),(59,'wand-of-magic-missiles'),(61,'wand-of-the-war-mage@1'),(63,'wand-of-web'),(65,'weapon-of-warning'),(66,'adamantine-armor/chain-mail'),(67,'adamantine-armor/chain-shirt'),(68,'adamantine-armor/scale-mail'),(69,'bag-of-tricks@gray-bag-of-tricks'),(70,'bag-of-tricks@rust-bag-of-tricks'),(71,'bag-of-tricks@tan-bag-of-tricks'),(72,'boots-of-the-winterlands'),(73,'circlet-of-blasting'),(74,'deck-of-illusions'),(75,'eversmoking-bottle'),(76,'eyes-of-charming'),(77,'eyes-of-the-eagle'),(78,'figurine-of-wondrous-power@silver-raven'),(79,'gem-of-brightness'),(80,'gloves-of-missile-snaring'),(81,'gloves-of-swimming-and-climbing'),(82,'gloves-of-thievery'),(83,'headband-of-intellect'),(84,'helm-of-telepathy'),(85,'instrument-of-the-bards@doss-lute'),(86,'instrument-of-the-bards@fochlucan-bandore'),(87,'instrument-of-the-bards@mac-fuirmidh-cittern'),(88,'medallion-of-thoughts'),(89,'necklace-of-adaptation'),(90,'periapt-of-wound-closure'),(91,'pipes-of-haunting'),(92,'pipes-of-the-sewers'),(93,'ring-of-jumping'),(94,'ring-of-mind-shielding'),(95,'ring-of-warmth'),(96,'ring-of-water-walking'),(97,'quiver-of-ehlonna'),(98,'stone-of-good-luck'),(99,'wind-fan'),(100,'winged-boots')]),
      'G': (148, [(11,'weapon@2'),(14,{'die':8,'entries':[(1,'figurine-of-wondrous-power@bronze-griffon'),(2,'figurine-of-wondrous-power@ebony-fly'),(3,'figurine-of-wondrous-power@golden-lions'),(4,'figurine-of-wondrous-power@ivory-goats'),(5,'figurine-of-wondrous-power@marble-elephant'),(7,'figurine-of-wondrous-power@onyx-dog'),(8,'figurine-of-wondrous-power@serpentine-owl')]}),
        *[(i+15,v) for i,v in enumerate(['adamantine-armor/breastplate','adamantine-armor/splint','amulet-of-health','armor-of-vulnerability','arrow-catching-shield','belt-of-dwarvenkind','belt-of-giant-strength@belt-of-hill-giant-strength','berserker-axe','boots-of-levitation','boots-of-speed','bowl-of-commanding-water-elementals','bracers-of-defense','brazier-of-commanding-fire-elementals','cape-of-the-mountebank','censer-of-controlling-air-elementals','armor@armor-1/chain-mail','armor-of-resistance/chain-mail','armor@armor-1/chain-shirt','armor-of-resistance/chain-shirt','cloak-of-displacement','cloak-of-the-bat','cube-of-force','daerns-instant-fortress','dagger-of-venom','dimensional-shackles','dragon-slayer','elven-chain','flame-tongue','gem-of-seeing','giant-slayer','glamoured-studded-leather','helm-of-teleportation','horn-of-blasting',{'item':'horn-of-valhalla','variantChoices':['silver','brass'],'choiceBy':'DM-unspecified-probability'},'instrument-of-the-bards@canaith-mandolin','instrument-of-the-bards@cli-lyre','ioun-stone@awareness','ioun-stone@protection','ioun-stone@reserve','ioun-stone@sustenance','iron-bands-of-bilarro','armor@armor-1/leather','armor-of-resistance/leather','mace-of-disruption','mace-of-smiting','mace-of-terror','mantle-of-spell-resistance','necklace-of-prayer-beads','periapt-of-proof-against-poison','ring-of-animal-influence','ring-of-evasion','ring-of-feather-falling','ring-of-free-action','ring-of-protection','ring-of-resistance','ring-of-spell-storing','ring-of-the-ram','ring-of-x-ray-vision','robe-of-eyes','rod-of-rulership','rod-of-the-pact-keeper@2','rope-of-entanglement','armor@armor-1/scale-mail','armor-of-resistance/scale-mail','shield@2','shield-of-missile-attraction','staff-of-charming','staff-of-healing','staff-of-swarming-insects','staff-of-the-woodlands','staff-of-withering','stone-of-controlling-earth-elementals','sun-blade','sword-of-life-stealing','sword-of-wounding','tentacle-rod','vicious-weapon','wand-of-binding','wand-of-enemy-detection','wand-of-fear','wand-of-fireballs','wand-of-lightning-bolts','wand-of-paralysis','wand-of-the-war-mage@2','wand-of-wonder','wings-of-flying'])]]),
      'H': (149, [(10,'weapon@3'),*[(12+i*2,v) for i,v in enumerate(['amulet-of-the-planes','carpet-of-flying','crystal-ball@crystal-ball','ring-of-regeneration','ring-of-shooting-stars','ring-of-telekinesis','robe-of-scintillating-colors','robe-of-stars','rod-of-absorption','rod-of-alertness','rod-of-security','rod-of-the-pact-keeper@3','scimitar-of-speed','shield@3','staff-of-fire','staff-of-frost','staff-of-power','staff-of-striking','staff-of-thunder-and-lightning','sword-of-sharpness','wand-of-polymorph','wand-of-the-war-mage@3'])],
        *[(55+i,v) for i,v in enumerate(['adamantine-armor/half-plate','adamantine-armor/plate','animated-shield','belt-of-giant-strength@belt-of-fire-giant-strength',{'item':'belt-of-giant-strength','variantChoices':['belt-of-frost-giant-strength','belt-of-stone-giant-strength'],'choiceBy':'DM-unspecified-probability'},'armor@armor-1/breastplate','armor-of-resistance/breastplate','candle-of-invocation','armor@armor-2/chain-mail','armor@armor-2/chain-shirt','cloak-of-arachnida','dancing-sword','demon-armor','dragon-scale-mail','dwarven-plate','dwarven-thrower','efreeti-bottle','figurine-of-wondrous-power@obsidian-steed','frost-brand','helm-of-brilliance','horn-of-valhalla@bronze','instrument-of-the-bards@anstruth-harp','ioun-stone@absorption','ioun-stone@agility','ioun-stone@fortitude','ioun-stone@insight','ioun-stone@intellect','ioun-stone@leadership','ioun-stone@strength','armor@armor-2/leather','manual-of-bodily-health','manual-of-gainful-exercise','manual-of-golems','manual-of-quickness-of-action','mirror-of-life-trapping','nine-lives-stealer','oathbow','armor@armor-2/scale-mail','spellguard-shield','armor@armor-1/splint','armor-of-resistance/splint','armor@armor-1/studded-leather','armor-of-resistance/studded-leather','tome-of-clear-thought','tome-of-leadership-and-influence','tome-of-understanding'])]]),
      'I': (150, [(5,'defender'),(10,'hammer-of-thunderbolts'),(15,'luck-blade'),(20,'sword-of-answering'),*[(23+i*3,v) for i,v in enumerate(['holy-avenger','ring-of-djinni-summoning','ring-of-invisibility','ring-of-spell-turning','rod-of-lordly-might','staff-of-the-magi','vorpal-sword'])],
        *[(43+i*2,v) for i,v in enumerate(['belt-of-giant-strength@belt-of-cloud-giant-strength','armor@armor-2/breastplate','armor@armor-3/chain-mail','armor@armor-3/chain-shirt','cloak-of-invisibility',{'item':'crystal-ball','variantChoices':['crystal-ball-of-mind-reading','crystal-ball-of-telepathy','crystal-ball-of-true-seeing'],'choiceBy':'DM-unspecified-probability'},'armor@armor-1/half-plate','iron-flask','armor@armor-3/leather','armor@armor-1/plate','robe-of-the-archmagi','rod-of-resurrection','armor@armor-1/scale-mail','scarab-of-protection','armor@armor-2/splint','armor@armor-2/studded-leather','well-of-many-worlds'])],
        (76,{'die':12,'entries':[(2,'armor@armor-2/half-plate'),(4,'armor@armor-2/plate'),(6,'armor@armor-3/studded-leather'),(8,'armor@armor-3/breastplate'),(10,'armor@armor-3/splint'),(11,'armor@armor-3/half-plate'),(12,'armor@armor-3/plate')]}),
        *[(77+i,v) for i,v in enumerate(['apparatus-of-kwalish','armor-of-invulnerability','belt-of-giant-strength@belt-of-storm-giant-strength','cubic-gate','deck-of-many-things','efreeti-chain','armor-of-resistance/half-plate','horn-of-valhalla@iron','instrument-of-the-bards@ollamh-harp','ioun-stone@greater-absorption','ioun-stone@mastery','ioun-stone@regeneration','plate-armor-of-etherealness','armor-of-resistance/plate','ring-of-elemental-command@air','ring-of-elemental-command@earth','ring-of-elemental-command@fire','ring-of-three-wishes','ring-of-elemental-command@water','sphere-of-annihilation','talisman-of-pure-good','talisman-of-the-sphere','talisman-of-ultimate-evil','tome-of-the-stilled-tongue'])]]),
    }

    def item_effect(spec):
        if isinstance(spec, dict) and 'die' in spec:
            low = 1
            rows = []
            for high, child in spec['entries']:
                effect, summary, deps = item_effect(child)
                rows.append({'low':low,'high':high,'effect':effect,'summaryIt':summary})
                low = high+1
            assert low == spec['die']+1
            deps = sorted({eid for r in rows for eid in r['effect']['dependencyIds']})
            return {'furtherRoll':{'die':spec['die'],'rows':rows},'dependencyIds':deps}, 'Ulteriore tiro sulla sottotabella indicata.', deps
        if isinstance(spec, dict):
            item = items[spec['item']]
            indices = {v['index'] for v in item['mechanics']['effect'].get('variants',[])}
            assert set(spec['variantChoices']) <= indices
            effect = {'itemId':item['id'],'variantChoices':spec['variantChoices'],'choiceBy':spec['choiceBy']}
            summary = item['nameIt'] + ': variante scelta dal DM, nessuna probabilità aggiunta.'
        else:
            family, _, armor = spec.partition('/')
            index, _, variant = family.partition('@')
            item = items[index]
            effect = {'itemId':item['id']}
            summary = item['nameIt']
            if variant:
                variants = {v['index']:v for v in item['mechanics']['effect'].get('variants',[])}
                assert variant in variants, spec
                effect['variantIndex'] = variant
                variant_it={'bronze-griffon':'Grifone di bronzo','ebony-fly':'Mosca d’ebano','golden-lions':'Leoni dorati','ivory-goats':'Capre d’avorio','marble-elephant':'Elefante di marmo','onyx-dog':'Cane d’onice','serpentine-owl':'Gufo di serpentino','silver-raven':'Corvo d’argento','obsidian-steed':'Destriero d’ossidiana','gray-bag-of-tricks':'Grigia','rust-bag-of-tricks':'Ruggine','tan-bag-of-tricks':'Marrone','crystal-ball':'Sfera base','doss-lute':'Liuto di Doss','fochlucan-bandore':'Bandora di Fochlucan','mac-fuirmidh-cittern':'Cetera di Mac-Fuirmidh','canaith-mandolin':'Mandolino di Canaith','cli-lyre':'Lira di Cli','anstruth-harp':'Arpa di Anstruth','ollamh-harp':'Arpa di Ollamh','belt-of-hill-giant-strength':'Gigante delle colline','belt-of-fire-giant-strength':'Gigante del fuoco','belt-of-cloud-giant-strength':'Gigante delle nuvole','belt-of-storm-giant-strength':'Gigante della tempesta','armor-1':'Bonus 1','armor-2':'Bonus 2','armor-3':'Bonus 3','ammunition-1':'Bonus 1','ammunition-2':'Bonus 2','ammunition-3':'Bonus 3'}
                summary += ' — ' + variants[variant].get('nameIt',variant_it.get(variant,variant))
            if armor:
                effect['armorIndex'] = armor
                effect['armorId'] = 'phb2014:armor:'+{'leather':'leather-armor','studded-leather':'studded-leather-armor','half-plate':'half-plate-armor','splint':'splint-armor','plate':'plate-armor'}.get(armor,armor)
                summary += ' — ' + {'chain-mail':'cotta di maglia','chain-shirt':'camicia di maglia','scale-mail':'scaglie','breastplate':'corazza','splint':'a strisce','leather':'cuoio','studded-leather':'cuoio borchiato','half-plate':'mezza armatura','plate':'completa'}[armor]
        deps = [item['id'], *([effect['armorId']] if 'armorId' in effect else [])]
        effect['dependencyIds'] = deps
        return effect, summary, deps

    for letter, (page, entries) in magic.items():
        rows, deps = [], set()
        for high, spec in entries:
            effect, summary, child_ids = item_effect(spec)
            rows.append((high,effect,summary));deps.update(child_ids)
        e = table('magic-item-table-'+letter.lower(), 'Magic Item Table '+letter, 'Tabella Oggetti Magici '+letter, page, 100, rows, treasureType='magic-item')
        e['relations'] = {'dependencyIds':sorted(deps)}
        e['interpretations'].append({'field':'rows','kind':'derived','method':'Explicit reviewed family and variant references; no fuzzy matching. Additional die probabilities preserved. Unspecified variant distributions remain DM choices.'})
        if letter=='I':
            e['interpretations'].append({'field':'rows.66-67','kind':'source-confirmation','method':'Local PDF render says Armor +1 scale mail; kept as printed, no inferred upgrade to +3.'})

    # Coin specifications store the dice separately from their multiplier so
    # 1d6 × 10 averages 35, never floor(3.5) × 10 = 30.
    def coins(**specs):
        out = {}
        for denomination, (count, multiplier) in specs.items():
            out[denomination] = {'dice':str(count)+'d6','multiplier':multiplier,'average':count*7*multiplier//2}
        return out

    individual = [
      ('0-4',0,4,[(30,coins(cp=(5,1))),(60,coins(sp=(4,1))),(70,coins(ep=(3,1))),(95,coins(gp=(3,1))),(100,coins(pp=(1,1)))]),
      ('5-10',5,10,[(30,coins(cp=(4,100),ep=(1,10))),(60,coins(sp=(6,10),gp=(2,10))),(70,coins(ep=(3,10),gp=(2,10))),(95,coins(gp=(4,10))),(100,coins(gp=(2,10),pp=(3,1)))]),
      ('11-16',11,16,[(20,coins(sp=(4,100),gp=(1,100))),(35,coins(ep=(1,100),gp=(1,100))),(75,coins(gp=(2,100),pp=(1,10))),(100,coins(gp=(2,100),pp=(2,10)))]),
      ('17-plus',17,None,[(15,coins(ep=(2,1000),gp=(8,100))),(55,coins(gp=(1,1000),pp=(1,100))),(100,coins(gp=(1,1000),pp=(2,100)))])]
    for index, minimum, maximum, entries in individual:
        table('individual-treasure-'+index, 'Individual Treasure: '+index, 'Tesoro Individuale: '+index, 137, 100,
              [(high,{'coins':c},'Monete del tipo indicato: tiro e moltiplicatore oppure media.') for high,c in entries],
              treasureType='individual', minimumCR=minimum, maximumCR=maximum)

    # Rows: upper boundary, gem/art value, quantity dice, magic table rolls.
    hoards = [
      ('0-4',138,0,4,coins(cp=(6,100),sp=(3,100),gp=(2,10)),[
        (6,None,None,[]),(16,'gem-10','2d6',[]),(26,'art-25','2d4',[]),(36,'gem-50','2d6',[]),
        (44,'gem-10','2d6',[('a','1d6')]),(52,'art-25','2d4',[('a','1d6')]),(60,'gem-50','2d6',[('a','1d6')]),
        (65,'gem-10','2d6',[('b','1d4')]),(70,'art-25','2d4',[('b','1d4')]),(75,'gem-50','2d6',[('b','1d4')]),
        (78,'gem-10','2d6',[('c','1d4')]),(80,'art-25','2d4',[('c','1d4')]),(85,'gem-50','2d6',[('c','1d4')]),
        (92,'art-25','2d4',[('f','1d4')]),(97,'gem-50','2d6',[('f','1d4')]),(99,'art-25','2d4',[('g','1')]),(100,'gem-50','2d6',[('g','1')])]),
      ('5-10',138,5,10,coins(cp=(2,100),sp=(2,1000),gp=(6,100),pp=(3,10)),[
        (4,None,None,[]),*[(h,k,d,[]) for h,k,d in [(10,'art-25','2d4'),(16,'gem-50','3d6'),(22,'gem-100','3d6'),(28,'art-250','2d4')]],
        *[(h,k,d,[(t,q)]) for h,k,d,t,q in [
          (32,'art-25','2d4','a','1d6'),(36,'gem-50','3d6','a','1d6'),(40,'gem-100','3d6','a','1d6'),(44,'art-250','2d4','a','1d6'),
          (49,'art-25','2d4','b','1d4'),(54,'gem-50','3d6','b','1d4'),(59,'gem-100','3d6','b','1d4'),(63,'art-250','2d4','b','1d4'),
          (66,'art-25','2d4','c','1d4'),(69,'gem-50','3d6','c','1d4'),(72,'gem-100','3d6','c','1d4'),(74,'art-250','2d4','c','1d4'),
          (76,'art-25','2d4','d','1'),(78,'gem-50','3d6','d','1'),(79,'gem-100','3d6','d','1'),(80,'art-250','2d4','d','1'),
          (84,'art-25','2d4','f','1d4'),(88,'gem-50','3d6','f','1d4'),(91,'gem-100','3d6','f','1d4'),(94,'art-250','2d4','f','1d4'),
          (96,'gem-100','3d6','g','1d4'),(98,'art-250','2d4','g','1d4'),(99,'gem-100','3d6','h','1'),(100,'art-250','2d4','h','1')]]]),
      ('11-16',139,11,16,coins(gp=(4,1000),pp=(5,100)),[
        (3,None,None,[]),*[(h,k,d,[]) for h,k,d in [(6,'art-250','2d4'),(9,'art-750','2d4'),(12,'gem-500','3d6'),(15,'gem-1000','3d6')]],
        *[(h,k,d,[('a','1d4'),('b','1d6')]) for h,k,d in [(19,'art-250','2d4'),(23,'art-750','2d4'),(26,'gem-500','3d6'),(29,'gem-1000','3d6')]],
        *[(h,k,d,[(t,q)]) for h,k,d,t,q in [
          (35,'art-250','2d4','c','1d6'),(40,'art-750','2d4','c','1d6'),(45,'gem-500','3d6','c','1d6'),(50,'gem-1000','3d6','c','1d6'),
          (54,'art-250','2d4','d','1d4'),(58,'art-750','2d4','d','1d4'),(62,'gem-500','3d6','d','1d4'),(66,'gem-1000','3d6','d','1d4'),
          (68,'art-250','2d4','e','1'),(70,'art-750','2d4','e','1'),(72,'gem-500','3d6','e','1'),(74,'gem-1000','3d6','e','1')]],
        *[(h,k,d,[('f','1'),('g','1d4')]) for h,k,d in [(76,'art-250','2d4'),(78,'art-750','2d4'),(80,'gem-500','3d6'),(82,'gem-1000','3d6')]],
        *[(h,k,d,[(t,q)]) for h,k,d,t,q in [
          (85,'art-250','2d4','h','1d4'),(88,'art-750','2d4','h','1d4'),(90,'gem-500','3d6','h','1d4'),(92,'gem-1000','3d6','h','1d4'),
          (94,'art-250','2d4','i','1'),(96,'art-750','2d4','i','1'),(98,'gem-500','3d6','i','1'),(100,'gem-1000','3d6','i','1')]]]),
      ('17-plus',140,17,None,coins(gp=(12,1000),pp=(8,1000)),[
        (2,None,None,[]),*[(h,k,d,[(t,q)]) for h,k,d,t,q in [
          (5,'gem-1000','3d6','c','1d8'),(8,'art-2500','1d10','c','1d8'),(11,'art-7500','1d4','c','1d8'),(14,'gem-5000','1d8','c','1d8'),
          (22,'gem-1000','3d6','d','1d6'),(30,'art-2500','1d10','d','1d6'),(38,'art-7500','1d4','d','1d6'),(46,'gem-5000','1d8','d','1d6'),
          (52,'gem-1000','3d6','e','1d6'),(58,'art-2500','1d10','e','1d6'),(63,'art-7500','1d4','e','1d6'),(68,'gem-5000','1d8','e','1d6'),
          (69,'gem-1000','3d6','g','1d4'),(70,'art-2500','1d10','g','1d4'),(71,'art-7500','1d4','g','1d4'),(72,'gem-5000','1d8','g','1d4'),
          (74,'gem-1000','3d6','h','1d4'),(76,'art-2500','1d10','h','1d4'),(78,'art-7500','1d4','h','1d4'),(80,'gem-5000','1d8','h','1d4'),
          (85,'gem-1000','3d6','i','1d4'),(90,'art-2500','1d10','i','1d4'),(95,'art-7500','1d4','i','1d4'),(100,'gem-5000','1d8','i','1d4')]]]),
    ]
    for index,page,minimum,maximum,c,entries in hoards:
        rows, deps = [], set()
        for high, kind, dice, rolls in entries:
            effect = {'magicItemRolls':[{'tableId':'dmg2014:rule:magic-item-table-'+t,'quantityDice':q} for t,q in rolls]}
            if kind:
                category, value = kind.split('-')
                effect['valuables'] = {'type':category,'unitValueGP':int(value),'quantityDice':dice,
                    'tableId':'dmg2014:rule:'+('gems-' if category=='gem' else 'art-')+value}
                deps.add(effect['valuables']['tableId'])
            deps.update(x['tableId'] for x in effect['magicItemRolls'])
            rows.append((high,effect,'Gemme o arte e tiri separati sulle tabelle magiche; le monete si aggiungono sempre.'))
        e = table('treasure-hoard-'+index, 'Treasure Hoard: '+index, 'Tesoro Accumulato: '+index, page, 100, rows,
                  treasureType='hoard', minimumCR=minimum, maximumCR=maximum, coins=c)
        e['relations'] = {'dependencyIds':sorted(deps)}
        if index=='11-16':
            e['interpretations'].append({'field':'rows.10-12','kind':'source-confirmation','method':'Local PDF already reads 10–12, agreeing with DMG Errata PDF 1; no differing first-print wording asserted.'})

    result.append(record('rule','random-treasure','Random Treasure','Tesori Casuali',134,{
      'ruleType':'treasure-framework','requiresDMApproval':True,'coinsPerPound':50,'coinTypes':['cp','sp','ep','gp','pp'],
      'individualGroup':'roll-once-for-similar-creatures-then-multiply-by-count','convertCoinsToValuables':'same-total-value-DM-choice',
      'hoardChallengeSource':{'single':'creature-CR','group':'leader-CR','unowned':'dungeon-presiding-monster-CR','benefactorGift':'party-average-level'},
      'hoardComponents':'coins-plus-one-d100-for-both-valuables-and-magic','legendaryHoardAccumulatorMinimumRolls':2,
      'smallHoardMayUseMultipleRolls':True,'DMMayChooseAmount':True,
      'typicalCampaignAdviceNotRequirement':{'0-4':7,'5-10':18,'11-16':12,'17-plus':8},
      'gemTypeSelection':'one-type-for-all-or-mixed-DM-choice','artSelection':'once-per-object-duplicates-allowed'},
      'Cinquanta monete di qualunque tipo pesano una libbra. Tesoro individuale di creature simili: un tiro moltiplicato per numero. Accumulato: monete più un d100 per preziosi e magia; grado del capo, mostro principale o livello medio per dono del benefattore. Accumulatori leggendari almeno due tiri sommati. Le quantità di campagna sono consigli al DM.',book='dmg',optional=True))
    result[-1]['sources'][0]['verification']='read-local-render'
    return result
