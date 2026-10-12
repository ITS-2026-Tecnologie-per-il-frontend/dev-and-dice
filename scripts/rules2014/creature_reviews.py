"""MM first-printing stat blocks read in text AND inspected on renders.

PDF pages = printed pages + 1. No PHB stat block is silently replaced by MM.
The full Wild Shape bestiary remains pending. Optional MM familiar contracts
are distinct from spirits summoned using the PHB Pact of the Chain.
"""
import copy
from curated import ABILITIES, record, source

FAMILIAR_FORMS = ['bat','cat','crab','frog','hawk','lizard','octopus','owl',
                  'poisonous-snake','quipper','rat','raven','sea-horse','spider','weasel']
CHAIN_FORMS = ['imp','pseudodragon','quasit','sprite']
# index, Italian, PDF, size, AC, natural armor, HP, HP dice, movement,
# six abilities, skill bonuses, senses, passive Perception, CR, XP
ROWS = [
 ('allosaurus','Allosauro',80,'Large',13,True,51,'6d10+18',{'walk':60},[19,13,17,2,12,5],{'perception':5},{},15,2,450),
 ('ankylosaurus','Anchilosauro',80,'Huge',15,True,68,'8d12+16',{'walk':30},[19,11,15,2,12,5],{},{},11,3,700),
 ('plesiosaurus','Plesiosauro',81,'Large',13,True,68,'8d10+24',{'walk':20,'swim':40},[18,15,16,2,12,5],{'perception':3,'stealth':4},{},13,2,450),
 ('pteranodon','Pteranodonte',81,'Medium',13,True,13,'3d8',{'walk':10,'fly':60},[12,15,10,2,9,5],{'perception':1},{},11,.25,50),
 ('triceratops','Triceratopo',81,'Huge',13,True,95,'10d12+30',{'walk':50},[22,9,17,2,11,5],{},{},10,5,1800),
 ('tyrannosaurus-rex','Tirannosauro Rex',81,'Huge',13,True,136,'13d12+52',{'walk':50},[25,10,19,2,12,9],{'perception':4},{},14,8,3900),
 ('stirge','Stirge',285,'Tiny',14,True,2,'1d4',{'walk':10,'fly':40},[4,16,11,2,8,6],{},{'darkvision':60},9,.125,25),
 ('reef-shark','Squalo di Scogliera',337,'Medium',12,True,22,'4d8+4',{'walk':0,'swim':40},[14,13,13,1,10,4],{'perception':2},{'blindsight':30},12,.5,100),
 ('rhinoceros','Rinoceronte',337,'Large',11,True,45,'6d10+12',{'walk':40},[21,8,15,2,12,6],{},{},11,2,450),
 ('riding-horse','Cavallo da Sella',337,'Large',10,False,13,'2d10+2',{'walk':60},[16,10,12,2,11,7],{},{},10,.25,50),
 ('saber-toothed-tiger','Tigre dai Denti a Sciabola',337,'Large',12,False,52,'7d10+14',{'walk':40},[18,14,15,3,12,8],{'perception':3,'stealth':6},{},13,2,450),
 ('scorpion','Scorpione',338,'Tiny',11,True,1,'1d4-1',{'walk':10},[2,11,8,1,8,2],{},{'blindsight':10},9,0,10),
 ('tiger','Tigre',340,'Large',12,False,37,'5d10+10',{'walk':40},[17,15,14,3,12,8],{'perception':3,'stealth':6},{'darkvision':60},13,1,200),
 ('vulture','Avvoltoio',340,'Medium',10,False,5,'1d8+1',{'walk':10,'fly':50},[7,10,13,2,12,4],{'perception':3},{},13,0,10),
 ('warhorse','Cavallo da Guerra',341,'Large',11,False,19,'3d10+3',{'walk':60},[18,12,13,2,12,7],{},{},11,.5,100),
 ('giant-owl','Gufo Gigante',328,'Large',12,False,19,'3d10+3',{'walk':5,'fly':60},[13,15,12,8,13,10],{'perception':5,'stealth':4},{'darkvision':120},15,.25,50),
 ('giant-poisonous-snake','Serpente Velenoso Gigante',328,'Medium',14,False,11,'2d8+2',{'walk':30,'swim':30},[10,18,13,2,10,3],{'perception':2},{'blindsight':10},12,.25,50),
 ('giant-rat','Topo Gigante',328,'Small',12,False,7,'2d6',{'walk':30},[7,15,11,2,10,4],{},{'darkvision':60},10,.125,25),
 ('giant-scorpion','Scorpione Gigante',328,'Large',15,True,52,'7d10+14',{'walk':40},[15,13,15,1,9,3],{},{'blindsight':60},9,3,700),
 ('giant-sea-horse','Cavalluccio Marino Gigante',329,'Large',13,True,16,'3d10',{'walk':0,'swim':40},[12,15,11,2,12,5],{},{},11,.5,100),
 ('giant-shark','Squalo Gigante',329,'Huge',13,True,126,'11d12+55',{'walk':0,'swim':50},[23,11,21,1,10,5],{'perception':3},{'blindsight':60},13,5,1800),
 ('giant-spider','Ragno Gigante',329,'Large',14,True,26,'4d10+4',{'walk':30,'climb':30},[14,16,12,2,11,4],{'stealth':7},{'blindsight':10,'darkvision':60},10,1,200),
 ('giant-toad','Rospo Gigante',330,'Large',11,False,39,'6d10+6',{'walk':20,'swim':40},[15,13,13,2,10,3],{},{'darkvision':30},10,1,200),
 ('giant-vulture','Avvoltoio Gigante',330,'Large',10,False,22,'3d10+6',{'walk':10,'fly':60},[15,10,15,6,12,7],{'perception':3},{},13,1,200),
 ('giant-wasp','Vespa Gigante',330,'Medium',12,False,13,'3d8',{'walk':10,'fly':50},[10,14,10,1,10,3],{},{},10,.5,100),
 ('giant-weasel','Donnola Gigante',330,'Medium',13,False,9,'2d8',{'walk':40},[11,16,10,4,12,5],{'perception':3,'stealth':5},{'darkvision':60},13,.125,25),
 ('giant-wolf-spider','Ragno Lupo Gigante',331,'Medium',13,False,11,'2d8+2',{'walk':40,'climb':40},[12,16,13,3,12,4],{'perception':3,'stealth':7},{'blindsight':10,'darkvision':60},13,.25,50),
 ('goat','Capra',331,'Medium',10,False,4,'1d8',{'walk':40},[12,10,11,2,10,5],{},{},10,0,10),
 ('hunter-shark','Squalo Cacciatore',331,'Large',12,True,45,'6d10+12',{'walk':0,'swim':40},[18,13,15,1,10,4],{'perception':2},{'blindsight':30},12,2,450),
 ('hyena','Iena',332,'Medium',11,False,5,'1d8+1',{'walk':50},[11,13,12,2,12,5],{'perception':3},{},13,0,10),
 ('jackal','Sciacallo',332,'Small',12,False,3,'1d6',{'walk':40},[8,15,11,3,12,6],{'perception':3},{},13,0,10),
 ('killer-whale','Orca',332,'Huge',12,True,90,'12d12+12',{'walk':0,'swim':60},[19,10,13,3,12,7],{'perception':3},{'blindsight':120},13,3,700),
 ('lion','Leone',332,'Large',12,False,26,'4d10+4',{'walk':50},[17,15,13,3,12,8],{'perception':3,'stealth':6},{},13,1,200),
 ('mammoth','Mammut',333,'Huge',13,True,126,'11d12+55',{'walk':40},[24,9,21,3,11,6],{},{},10,6,2300),
 ('mastiff','Mastino',333,'Medium',12,False,5,'1d8+1',{'walk':40},[13,14,12,3,12,7],{'perception':3},{},13,.125,25),
 ('mule','Mulo',334,'Medium',10,False,11,'2d8+2',{'walk':40},[14,10,13,2,10,5],{},{},10,.125,25),
 ('panther','Pantera',334,'Medium',12,False,13,'3d8',{'walk':50,'climb':40},[14,15,10,3,14,7],{'perception':4,'stealth':6},{},14,.25,50),
 ('polar-bear','Orso Polare',335,'Large',12,True,42,'5d10+15',{'walk':40,'swim':30},[20,10,16,2,13,7],{'perception':3},{},13,2,450),
 ('pony','Pony',336,'Medium',10,False,11,'2d8+2',{'walk':40},[15,10,13,2,11,7],{},{},10,.125,25),
 ('eagle','Aquila',323,'Small',12,False,3,'1d6',{'walk':10,'fly':60},[6,15,10,2,14,7],{'perception':4},{},14,0,10),
 ('elephant','Elefante',323,'Huge',12,True,76,'8d12+24',{'walk':40},[22,9,17,3,11,6],{},{},10,4,1100),
 ('elk','Alce',323,'Large',10,False,13,'2d10+2',{'walk':50},[16,10,12,2,10,6],{},{},10,.25,50),
 ('flying-snake','Serpente Volante',323,'Tiny',14,False,5,'2d4',{'walk':30,'fly':60,'swim':30},[4,18,11,2,12,5],{},{'blindsight':10},11,.125,25),
 ('giant-ape','Scimmia Gigante',324,'Huge',12,False,157,'15d12+60',{'walk':40,'climb':40},[23,14,18,7,12,7],{'athletics':9,'perception':4},{},14,7,2900),
 ('giant-badger','Tasso Gigante',324,'Medium',10,False,13,'2d8+4',{'walk':30,'burrow':10},[13,10,15,2,12,5],{},{'darkvision':30},11,.25,50),
 ('giant-bat','Pipistrello Gigante',324,'Large',13,False,22,'4d10',{'walk':10,'fly':60},[15,16,11,2,12,6],{},{'blindsight':60},11,.25,50),
 ('giant-boar','Cinghiale Gigante',324,'Large',12,True,42,'5d10+15',{'walk':40},[17,10,16,2,7,5],{},{},8,2,450),
 ('giant-centipede','Centopiedi Gigante',324,'Small',13,True,4,'1d6+1',{'walk':30,'climb':30},[5,14,12,1,7,3],{},{'blindsight':30},8,.25,50),
 ('giant-constrictor-snake','Serpente Costrittore Gigante',325,'Huge',12,False,60,'8d12+8',{'walk':30,'swim':30},[19,14,12,1,10,3],{'perception':2},{'blindsight':10},12,2,450),
 ('giant-crab','Granchio Gigante',325,'Medium',15,True,13,'3d8',{'walk':30,'swim':30},[13,15,11,1,9,3],{'stealth':4},{'blindsight':30},9,.125,25),
 ('giant-crocodile','Coccodrillo Gigante',325,'Huge',14,True,85,'9d12+27',{'walk':30,'swim':50},[21,9,17,2,10,7],{'stealth':5},{},10,5,1800),
 ('giant-eagle','Aquila Gigante',325,'Large',13,False,26,'4d10+4',{'walk':10,'fly':80},[16,17,13,8,14,10],{'perception':4},{},14,1,200),
 ('giant-elk','Alce Gigante',326,'Huge',14,True,42,'5d12+10',{'walk':60},[19,16,14,7,14,10],{'perception':4},{},14,2,450),
 ('giant-fire-beetle','Scarabeo di Fuoco Gigante',326,'Small',13,True,4,'1d6+1',{'walk':30},[8,10,12,1,7,3],{},{'blindsight':30},8,0,10),
 ('giant-frog','Rana Gigante',326,'Medium',11,False,18,'4d8',{'walk':30,'swim':30},[12,13,11,2,10,3],{'perception':2,'stealth':3},{'darkvision':30},12,.25,50),
 ('giant-goat','Capra Gigante',327,'Large',11,True,19,'3d10+3',{'walk':40},[17,11,12,3,12,6],{},{},11,.5,100),
 ('giant-hyena','Iena Gigante',327,'Large',12,False,45,'6d10+12',{'walk':50},[16,14,14,2,12,7],{'perception':3},{},13,1,200),
 ('giant-lizard','Lucertola Gigante',327,'Large',12,True,19,'3d10+3',{'walk':30,'climb':30},[15,12,13,2,10,5],{},{'darkvision':30},10,.25,50),
 ('giant-octopus','Polpo Gigante',327,'Large',11,False,52,'8d10+8',{'walk':10,'swim':60},[17,13,13,4,10,4],{'perception':4,'stealth':5},{'darkvision':60},14,1,200),
 ('ape','Scimmia',318,'Medium',12,False,19,'3d8+6',{'walk':30,'climb':30},[16,14,14,6,12,7],{'athletics':5,'perception':3},{},13,.5,100),
 ('axe-beak','Becco d’Ascia',318,'Large',11,False,19,'3d10+3',{'walk':50},[14,12,12,2,10,5],{},{},10,.25,50),
 ('baboon','Babbuino',319,'Small',12,False,3,'1d6',{'walk':30,'climb':30},[8,14,11,4,12,6],{},{},11,0,10),
 ('badger','Tasso',319,'Tiny',10,False,3,'1d4+1',{'walk':20,'burrow':5},[4,11,12,2,12,5],{},{'darkvision':30},11,0,10),
 ('blood-hawk','Falco Sanguinario',320,'Small',12,False,7,'2d6',{'walk':10,'fly':60},[6,14,10,3,14,5],{'perception':4},{},14,.125,25),
 ('boar','Cinghiale',320,'Medium',11,True,11,'2d8+2',{'walk':40},[13,11,12,2,9,5],{},{},9,.25,50),
 ('camel','Cammello',321,'Large',9,False,15,'2d10+4',{'walk':50},[16,8,14,2,8,5],{},{},9,.125,25),
 ('constrictor-snake','Serpente Costrittore',321,'Large',12,False,13,'2d10+2',{'walk':30,'swim':30},[15,14,12,1,10,3],{},{'blindsight':10},10,.25,50),
 ('crocodile','Coccodrillo',321,'Large',12,True,19,'3d10+3',{'walk':20,'swim':30},[15,10,13,2,10,5],{'stealth':2},{},10,.5,100),
 ('deer','Cervo',322,'Medium',13,False,4,'1d8',{'walk':50},[11,16,11,2,14,5],{},{},12,0,10),
 ('draft-horse','Cavallo da Tiro',322,'Large',10,False,19,'3d10+3',{'walk':40},[18,10,12,2,11,7],{},{},10,.25,50),
 ('bat','Pipistrello',319,'Tiny',12,False,1,'1d4-1',{'walk':5,'fly':30},[2,15,8,2,12,4],{},{'blindsight':60},11,0,10),
 ('cat','Gatto',321,'Tiny',12,False,2,'1d4',{'walk':40,'climb':30},[3,15,10,3,12,7],{'perception':3,'stealth':4},{},13,0,10),
 ('crab','Granchio',321,'Tiny',11,True,2,'1d4',{'walk':20,'swim':20},[2,11,10,1,8,2],{'stealth':2},{'blindsight':30},9,0,10),
 ('frog','Rana',323,'Tiny',11,False,1,'1d4-1',{'walk':20,'swim':20},[1,13,8,1,8,3],{'perception':1,'stealth':3},{'darkvision':30},11,0,0),
 ('hawk','Falco',331,'Tiny',13,False,1,'1d4-1',{'walk':10,'fly':60},[5,16,8,2,14,6],{'perception':4},{},14,0,10),
 ('lizard','Lucertola',333,'Tiny',10,False,2,'1d4',{'walk':20,'climb':20},[2,11,10,1,8,3],{},{'darkvision':30},9,0,10),
 ('octopus','Polpo',334,'Small',12,False,3,'1d6',{'walk':5,'swim':30},[4,15,11,3,10,4],{'perception':2,'stealth':4},{'darkvision':30},12,0,10),
 ('owl','Gufo',334,'Tiny',11,False,1,'1d4-1',{'walk':5,'fly':60},[3,13,8,2,12,7],{'perception':3,'stealth':3},{'darkvision':120},13,0,10),
 ('poisonous-snake','Serpente Velenoso',335,'Tiny',13,False,2,'1d4',{'walk':30,'swim':30},[2,16,11,1,10,3],{},{'blindsight':10},10,.125,25),
 ('quipper','Quipper',336,'Tiny',13,False,1,'1d4-1',{'walk':0,'swim':40},[2,16,9,1,7,2],{},{'darkvision':60},8,0,10),
 ('rat','Topo',336,'Tiny',10,False,1,'1d4-1',{'walk':20},[2,11,9,2,10,4],{},{'darkvision':30},10,0,10),
 ('raven','Corvo',336,'Tiny',12,False,1,'1d4-1',{'walk':10,'fly':50},[2,14,8,2,12,6],{'perception':3},{},13,0,10),
 ('sea-horse','Cavalluccio Marino',338,'Tiny',11,False,1,'1d4-1',{'walk':0,'swim':20},[1,12,8,1,10,2],{},{},10,0,0),
 ('spider','Ragno',338,'Tiny',12,False,1,'1d4-1',{'walk':20,'climb':20},[2,14,8,1,10,2],{'stealth':4},{'darkvision':30},10,0,10),
 ('weasel','Donnola',341,'Tiny',13,False,1,'1d4-1',{'walk':30},[3,16,8,2,12,3],{'perception':3,'stealth':5},{},13,0,10),
 ('black-bear','Orso Nero',319,'Medium',11,True,19,'3d8+6',{'walk':40,'climb':30},[15,10,14,2,12,7],{'perception':3},{},13,.5,100),
 ('brown-bear','Orso Bruno',320,'Large',11,True,34,'4d10+12',{'walk':40,'climb':30},[19,10,16,2,13,7],{'perception':3},{},13,1,200),
 ('wolf','Lupo',342,'Medium',13,True,11,'2d8+2',{'walk':40},[12,15,12,3,12,6],{'perception':3,'stealth':4},{},13,.25,50),
 ('dire-wolf','Lupo Feroce',322,'Large',14,True,37,'5d10+10',{'walk':50},[17,15,15,3,12,7],{'perception':3,'stealth':4},{},13,1,200),
]


def trait(index, italian, effect, summary):
    return {'index':index,'nameIt':italian,'effect':effect,'summaryIt':summary}


def keen(senses):
    return trait('keen-'+ '-and-'.join(senses),'Sensi Acuti',
                 {'advantageChecks':'wisdom-perception','usingSenses':senses},
                 'Vantaggio alle prove di Percezione basate su '+', '.join({'hearing':'udito','sight':'vista','smell':'olfatto'}[s] for s in senses)+'.')


WATER=trait('water-breathing','Respirazione Acquatica',{'breathes':['water']},'Può respirare esclusivamente sott’acqua.')
AMPHIBIOUS=trait('amphibious','Anfibio',{'breathes':['air','water']},'Può respirare aria e acqua.')
PACK=trait('pack-tactics','Tattiche del Branco',{'attackAdvantageIf':'ally-within-5-ft-of-target-and-not-incapacitated'},
           'Vantaggio agli attacchi se un alleato non incapacitato è entro cinque piedi dal bersaglio.')
TRAITS={
 'giant-owl':[trait('flyby','Sorvolare',{'noOpportunityAttacksWhen':'flies-out-of-enemy-reach'},'Volando fuori dalla portata non provoca attacchi di opportunità.'),keen(['hearing','sight'])],
 'giant-rat':[keen(['smell']),PACK],
 'giant-vulture':[keen(['sight','smell']),PACK],
 'giant-weasel':[keen(['hearing','smell'])],
 'hyena':[PACK],'jackal':[keen(['hearing','smell']),PACK],'mastiff':[keen(['hearing','smell'])],'polar-bear':[keen(['smell'])],
 'killer-whale':[trait('echolocation','Ecolocalizzazione',{'blindsightUnavailableIf':'deafened'},'Sordità impedisce vista cieca.'),trait('hold-breath','Trattenere il Fiato',{'minutes':30},'Trattiene il fiato trenta minuti.'),keen(['hearing'])],
 'mammoth':[trait('trampling-charge','Carica Travolgente',{'straightApproachFt':20,'thenHit':'gore-same-turn','creatureSave':{'ability':'strength','dc':18,'failure':'prone'},'ifTargetProne':'one-stomp-attack-as-bonus-action'},'Venti piedi diritti e zanne nello stesso turno, TS Forza diciotto o prono; se prono, bonus per calpestarlo.')],
 'lion':[keen(['smell']),PACK,trait('pounce','Balzo',{'straightApproachFt':20,'thenHit':'claw-same-turn','creatureSave':{'ability':'strength','dc':13,'failure':'prone'},'ifTargetProne':'one-bite-attack-as-bonus-action'},'Venti piedi diritti e artiglio nello stesso turno, TS Forza tredici o prono; se prono, bonus per morso.'),trait('running-leap','Salto con Rincorsa',{'approachFt':10,'maximumLongJumpFt':25},'Con dieci piedi di rincorsa salta fino a venticinque.')],
 'panther':[keen(['smell']),trait('pounce','Balzo',{'straightApproachFt':20,'thenHit':'claw-same-turn','creatureSave':{'ability':'strength','dc':12,'failure':'prone'},'ifTargetProne':'one-bite-attack-as-bonus-action'},'Venti piedi diritti e artiglio nello stesso turno, TS Forza dodici o prono; se prono, bonus per morso.')],
 'mule':[trait('beast-of-burden','Bestia da Soma',{'carryingCapacitySize':'Large'},'Considerato Grande per capacità di carico.'),trait('sure-footed','Passo Sicuro',{'saveAdvantage':['strength','dexterity'],'against':'effects-that-knock-prone'},'Vantaggio ai TS Forza e Destrezza contro caduta prona.')],
 'goat':[trait('charge','Carica',{'straightApproachFt':20,'thenHit':'ram-same-turn','extraDamage':{'average':2,'dice':'1d4','type':'bludgeoning'},'creatureSave':{'ability':'strength','dc':10,'failure':'prone'}},'Venti piedi diritti e incornata aggiungono d4 contundente, TS Forza dieci o prono.'),trait('sure-footed','Passo Sicuro',{'saveAdvantage':['strength','dexterity'],'against':'effects-that-knock-prone'},'Vantaggio ai TS Forza e Destrezza contro caduta prona.')],
 'giant-sea-horse':[WATER,trait('charge','Carica',{'straightApproachFt':20,'thenHit':'ram-same-turn','extraDamage':{'average':7,'dice':'2d6','type':'bludgeoning'},'creatureSave':{'ability':'strength','dc':11,'failure':'prone'}},'Venti piedi diritti e incornata aggiungono 2d6 contundenti, TS Forza undici o prono.')],
 'elephant':[trait('trampling-charge','Carica Travolgente',{'straightApproachFt':20,'thenHit':'gore-same-turn','creatureSave':{'ability':'strength','dc':12,'failure':'prone'},'ifTargetProne':'one-stomp-attack-as-bonus-action'},'Dopo venti piedi diritti e zanne nello stesso turno, TS Forza dodici o prono; se prono, può calpestarlo con bonus.')],
 'elk':[trait('charge','Carica',{'straightApproachFt':20,'thenHit':'ram-same-turn','extraDamage':{'average':7,'dice':'2d6','type':None,'typeStatus':'not-stated-in-trait'},'creatureSave':{'ability':'strength','dc':13,'failure':'prone'}},'Venti piedi diritti prima dell’incornata nello stesso turno aggiungono 2d6; creatura TS Forza tredici o prona.')],
 'giant-elk':[trait('charge','Carica',{'straightApproachFt':20,'thenHit':'ram-same-turn','extraDamage':{'average':7,'dice':'2d6','type':None,'typeStatus':'not-stated-in-trait'},'creatureSave':{'ability':'strength','dc':14,'failure':'prone'}},'Venti piedi diritti prima dell’incornata nello stesso turno aggiungono 2d6; creatura TS Forza quattordici o prona.')],
 'giant-goat':[trait('charge','Carica',{'straightApproachFt':20,'thenHit':'ram-same-turn','extraDamage':{'average':5,'dice':'2d4','type':'bludgeoning'},'creatureSave':{'ability':'strength','dc':13,'failure':'prone'}},'Venti piedi diritti prima dell’incornata aggiungono 2d4 contundenti; creatura TS Forza tredici o prona.'),trait('sure-footed','Passo Sicuro',{'saveAdvantage':['strength','dexterity'],'against':'effects-that-knock-prone'},'Vantaggio ai TS Forza e Destrezza contro effetti che rendono prono.')],
 'giant-boar':[trait('charge','Carica',{'straightApproachFt':20,'thenHit':'tusk-same-turn','extraDamage':{'average':7,'dice':'2d6','type':'slashing'},'creatureSave':{'ability':'strength','dc':13,'failure':'prone'}},'Venti piedi diritti prima della zannata aggiungono 2d6 taglienti e TS Forza tredici o prono.'),trait('relentless','Implacabile',{'uses':1,'recovery':['short-rest','long-rest'],'maximumTriggerDamage':10,'wouldReduceToZeroHP':'instead-one-HP'},'Una volta per riposo breve o lungo danni fino a dieci che porterebbero a zero lasciano un PF.')],
 'eagle':[keen(['sight'])],'giant-eagle':[keen(['sight'])],
 'giant-badger':[keen(['smell'])],
 'giant-bat':[trait('echolocation','Ecolocalizzazione',{'blindsightUnavailableIf':'deafened'},'Sordità impedisce vista cieca.'),keen(['hearing'])],
 'flying-snake':[trait('flyby','Sorvolare',{'noOpportunityAttacksWhen':'flies-out-of-enemy-reach'},'Volare fuori dalla portata nemica non provoca attacchi di opportunità.')],
 'giant-crab':[AMPHIBIOUS],
 'giant-crocodile':[trait('hold-breath','Trattenere il Fiato',{'minutes':30},'Trattiene fiato trenta minuti.')],
 'giant-fire-beetle':[trait('illumination','Illuminazione',{'brightRadiusFt':10,'additionalDimRadiusFt':10,'glandsAfterDeathDays':'1d6'},'Luce intensa dieci piedi e altri dieci fioca; le ghiandole continuano d6 giorni dopo la morte.')],
 'giant-frog':[AMPHIBIOUS,trait('standing-leap','Balzo da Fermo',{'longJumpFt':20,'highJumpFt':10,'runRequired':False},'Salta venti in lungo o dieci in alto anche da fermo.')],
 'giant-hyena':[trait('rampage','Furia',{'trigger':'reduces-creature-to-zero-HP-with-melee-attack-on-own-turn','activation':'bonus-action','effect':'move-up-to-half-speed-and-make-bite-attack'},'Dopo ridurre una creatura a zero con mischia nel proprio turno, bonus per metà velocità e morso.')],
 'giant-octopus':[trait('hold-breath','Trattenere il Fiato',{'outOfWaterMinutes':60},'Fuori acqua trattiene fiato un’ora.'),trait('underwater-camouflage','Mimetismo Acquatico',{'advantageChecks':'dexterity-stealth','requires':'underwater'},'Vantaggio a Furtività sott’acqua.'),WATER],
 'baboon':[PACK],'badger':[keen(['smell'])],'blood-hawk':[keen(['sight']),PACK],
 'boar':[trait('charge','Carica',{'straightApproachFt':20,'thenHit':'tusk-same-turn','extraDamage':{'average':3,'dice':'1d6','type':'slashing'},'creatureSave':{'ability':'strength','dc':11,'failure':'prone'}},'Dopo venti piedi diritti verso il bersaglio, zannata nello stesso turno aggiunge d6 tagliente e TS Forza undici alla creatura o prona.'),
         trait('relentless','Implacabile',{'uses':1,'recovery':['short-rest','long-rest'],'maximumTriggerDamage':7,'wouldReduceToZeroHP':'instead-one-HP'},'Una volta per riposo breve o lungo, danni fino a sette che porterebbero a zero PF lasciano un PF.')],
 'crocodile':[trait('hold-breath','Trattenere il Fiato',{'minutes':15},'Trattiene il fiato per quindici minuti.')],
 'bat':[trait('echolocation','Ecolocalizzazione',{'blindsightUnavailableIf':'deafened'},'La sordità impedisce di usare la vista cieca.'),keen(['hearing'])],
 'cat':[keen(['smell'])],'crab':[AMPHIBIOUS],
 'frog':[AMPHIBIOUS,trait('standing-leap','Balzo da Fermo',{'longJumpFt':10,'highJumpFt':5,'runRequired':False},'Può saltare dieci piedi in lungo o cinque in alto anche senza rincorsa.')],
 'hawk':[keen(['sight'])],
 'octopus':[trait('hold-breath','Trattenere il Fiato',{'outOfWaterMinutes':30},'Fuori dall’acqua trattiene il fiato per trenta minuti.'),
            trait('underwater-camouflage','Mimetismo Acquatico',{'advantageChecks':'dexterity-stealth','requires':'underwater'},'Sott’acqua ha vantaggio alle prove di Furtività.'),WATER],
 'owl':[trait('flyby','Sorvolare',{'noOpportunityAttacksWhen':'flies-out-of-enemy-reach'},'Volare fuori dalla portata di un nemico non provoca attacchi di opportunità.'),keen(['hearing','sight'])],
 'quipper':[trait('blood-frenzy','Frenesia del Sangue',{'meleeAttackAdvantageAgainst':'creature-with-any-hit-points-missing'},'Vantaggio agli attacchi da mischia contro creature che hanno perso almeno un punto ferita.'),WATER],
 'rat':[keen(['smell'])],
 'raven':[trait('mimicry','Imitazione',{'mayMimic':'simple-sounds-previously-heard','discernCheck':{'ability':'wisdom','skill':'insight','dc':10}},'Imita suoni semplici già sentiti; un ascoltatore può riconoscere l’imitazione con Intuizione CD 10.')],
 'sea-horse':[WATER],
 'spider':[trait('spider-climb','Movimento del Ragno',{'difficultClimbingIncludingCeilings':'no-ability-check'},'Scala superfici difficili e soffitti senza prova.'),
           trait('web-sense','Percezione della Ragnatela',{'requires':'contact-with-web','knowsExactLocation':'other-creatures-touching-same-web'},'Toccando una ragnatela localizza esattamente le altre creature che la toccano.'),
           trait('web-walker','Camminare nella Ragnatela',{'ignores':'movement-restrictions-from-webbing'},'Ignora le limitazioni al movimento causate dalle ragnatele.')],
 'weasel':[keen(['hearing','smell'])],
 'black-bear':[keen(['smell'])],'brown-bear':[keen(['smell'])],
 'wolf':[keen(['hearing','smell']),PACK],'dire-wolf':[keen(['hearing','smell']),PACK],
}
# Flat one-point damage has no damage die in these blocks; do not invent one.
# Identical traits verified separately on each cited creature page.
for child,parent in [('giant-toad','giant-frog'),('giant-shark','quipper'),('hunter-shark','quipper'),('giant-spider','spider'),('giant-wolf-spider','spider'),('vulture','giant-vulture')]:
    TRAITS[child]=copy.deepcopy(TRAITS[parent])
TRAITS['reef-shark']=[PACK,WATER]
TRAITS['pteranodon']=copy.deepcopy(TRAITS['flying-snake'])
TRAITS['plesiosaurus']=[trait('hold-breath','Trattenere il Fiato',{'minutes':60},'Trattiene il fiato un’ora.')]
TRAITS['allosaurus']=[trait('pounce','Balzo',{'straightApproachFt':30,'thenHit':'claw-same-turn','creatureSave':{'ability':'strength','dc':13,'failure':'prone'},'ifTargetProne':'one-bite-attack-as-bonus-action'},'Trenta piedi diritti e artiglio nello stesso turno, TS Forza tredici o prono; se prono, bonus per morso.')]
TRAITS['triceratops']=[trait('trampling-charge','Carica Travolgente',{'straightApproachFt':20,'thenHit':'gore-same-turn','creatureSave':{'ability':'strength','dc':13,'failure':'prone'},'ifTargetProne':'one-stomp-attack-as-bonus-action'},'Venti piedi diritti e corno nello stesso turno, TS Forza tredici o prono; se prono, bonus per calpestare.')]

TRAITS['rhinoceros']=[trait('charge','Carica',{'straightApproachFt':20,'thenHit':'gore-same-turn','extraDamage':{'average':9,'dice':'2d8','type':'bludgeoning'},'creatureSave':{'ability':'strength','dc':15,'failure':'prone'}},'Venti piedi diritti e incornata nello stesso turno aggiungono 2d8 contundenti, TS Forza quindici o prono.')]
for name,dc in [('tiger',13),('saber-toothed-tiger',14)]:
    TRAITS[name]=[keen(['smell']),trait('pounce','Balzo',{'straightApproachFt':20,'thenHit':'claw-same-turn','creatureSave':{'ability':'strength','dc':dc,'failure':'prone'},'ifTargetProne':'one-bite-attack-as-bonus-action'},f'Venti piedi diritti e artiglio nello stesso turno, TS Forza {dc} o prono; se prono, bonus per morso.')]
TRAITS['warhorse']=[trait('trampling-charge','Carica Travolgente',{'straightApproachFt':20,'thenHit':'hooves-same-turn','creatureSave':{'ability':'strength','dc':14,'failure':'prone'},'ifTargetProne':'one-hooves-attack-as-bonus-action'},'Venti piedi diritti e zoccoli nello stesso turno, TS Forza quattordici o prono; se prono, bonus per altri zoccoli.')]
ATTACKS={
 'ankylosaurus':('tail','Coda',7,'one-target',18,'4d6+4','bludgeoning'),
 'plesiosaurus':('bite','Morso',6,'one-target',14,'3d6+4','piercing'),
 'pteranodon':('bite','Morso',3,'one-target',6,'2d4+1','piercing'),
 'stirge':('blood-drain','Succhiare Sangue',5,'one-creature',5,'1d4+3','piercing'),
 'reef-shark':('bite','Morso',4,'one-target',6,'1d8+2','piercing'),
 'rhinoceros':('gore','Incornata',7,'one-target',14,'2d8+5','bludgeoning'),
 'riding-horse':('hooves','Zoccoli',2,'one-target',8,'2d4+3','bludgeoning'),
 'scorpion':('sting','Pungiglione',2,'one-creature',1,None,'piercing'),
 'vulture':('beak','Becco',2,'one-target',2,'1d4','piercing'),
 'warhorse':('hooves','Zoccoli',4,'one-target',11,'2d6+4','bludgeoning'),
 'giant-owl':('talons','Artigli',3,'one-target',8,'2d6+1','slashing'),
 'giant-poisonous-snake':('bite','Morso',6,'one-target',6,'1d4+4','piercing'),
 'giant-rat':('bite','Morso',4,'one-target',4,'1d4+2','piercing'),
 'giant-sea-horse':('ram','Incornata',3,'one-target',4,'1d6+1','bludgeoning'),
 'giant-shark':('bite','Morso',9,'one-target',22,'3d10+6','piercing'),
 'giant-spider':('bite','Morso',5,'one-creature',7,'1d8+3','piercing'),
 'giant-wolf-spider':('bite','Morso',3,'one-creature',4,'1d6+1','piercing'),
 'giant-wasp':('sting','Pungiglione',4,'one-creature',5,'1d6+2','piercing'),
 'giant-weasel':('bite','Morso',5,'one-target',5,'1d4+3','piercing'),
 'goat':('ram','Incornata',3,'one-target',3,'1d4+1','bludgeoning'),
 'hunter-shark':('bite','Morso',6,'one-target',13,'2d8+4','piercing'),
 'hyena':('bite','Morso',2,'one-target',3,'1d6','piercing'),
 'jackal':('bite','Morso',1,'one-target',1,'1d4-1','piercing'),
 'killer-whale':('bite','Morso',6,'one-target',21,'5d6+4','piercing'),
 'mastiff':('bite','Morso',3,'one-target',4,'1d6+1','piercing'),
 'mule':('hooves','Zoccoli',2,'one-target',4,'1d4+2','bludgeoning'),
 'pony':('hooves','Zoccoli',4,'one-target',7,'2d4+2','bludgeoning'),
 'eagle':('talons','Artigli',4,'one-target',4,'1d4+2','slashing'),
 'flying-snake':('bite','Morso',6,'one-target',1,None,'piercing'),
 'giant-bat':('bite','Morso',4,'one-creature',5,'1d6+2','piercing'),
 'giant-boar':('tusk','Zannata',5,'one-target',10,'2d6+3','slashing'),
 'giant-centipede':('bite','Morso',4,'one-creature',4,'1d4+2','piercing'),
 'giant-crab':('claw','Chela',3,'one-target',4,'1d6+1','bludgeoning'),
 'giant-fire-beetle':('bite','Morso',1,'one-target',2,'1d6-1','slashing'),
 'giant-frog':('bite','Morso',3,'one-target',4,'1d6+1','piercing'),
 'giant-goat':('ram','Incornata',5,'one-target',8,'2d4+3','bludgeoning'),
 'giant-hyena':('bite','Morso',5,'one-target',10,'2d6+3','piercing'),
 'giant-lizard':('bite','Morso',4,'one-target',6,'1d8+2','piercing'),
 'axe-beak':('beak','Becco',4,'one-target',6,'1d8+2','slashing'),
 'baboon':('bite','Morso',1,'one-target',1,'1d4-1','piercing'),
 'badger':('bite','Morso',2,'one-target',1,None,'piercing'),
 'blood-hawk':('beak','Becco',4,'one-target',4,'1d4+2','piercing'),
 'boar':('tusk','Zannata',3,'one-target',4,'1d6+1','slashing'),
 'camel':('bite','Morso',5,'one-target',2,'1d4','bludgeoning'),
 'constrictor-snake':('bite','Morso',4,'one-creature',5,'1d6+2','piercing'),
 'crocodile':('bite','Morso',4,'one-creature',7,'1d10+2','piercing'),
 'deer':('bite','Morso',2,'one-target',2,'1d4','piercing'),
 'draft-horse':('hooves','Zoccoli',6,'one-target',9,'2d4+4','bludgeoning'),
 'bat':('bite','Morso',0,'one-creature',1,None,'piercing'),
 'cat':('claws','Artigli',0,'one-target',1,None,'slashing'),
 'crab':('claw','Chela',0,'one-target',1,None,'bludgeoning'),
 'hawk':('talons','Artigli',5,'one-target',1,None,'slashing'),
 'lizard':('bite','Morso',0,'one-target',1,None,'piercing'),
 'octopus':('tentacles','Tentacoli',4,'one-target',1,None,'bludgeoning'),
 'owl':('talons','Artigli',3,'one-target',1,None,'slashing'),
 'poisonous-snake':('bite','Morso',5,'one-target',1,None,'piercing'),
 'quipper':('bite','Morso',5,'one-target',1,None,'piercing'),
 'rat':('bite','Morso',0,'one-target',1,None,'piercing'),
 'raven':('beak','Becco',4,'one-target',1,None,'piercing'),
 'spider':('bite','Morso',4,'one-creature',1,None,'piercing'),
 'weasel':('bite','Morso',5,'one-target',1,None,'piercing'),
 'wolf':('bite','Morso',4,'one-target',7,'2d4+2','piercing'),
 'dire-wolf':('bite','Morso',5,'one-target',10,'2d6+3','piercing'),
}


def attack(row, effect=None):
    index,it,bonus,target,average,dice,damage=row
    return {'index':index,'nameIt':it,'activation':'action','kind':'melee-weapon-attack',
            'attackBonus':bonus,'reachFt':5,'target':target,
            'damage':{'average':average,'dice':dice,'type':damage},'effect':effect or {},
            'summaryIt':f'Attacco da mischia con bonus {bonus:+}; portata cinque piedi. Danni '+{'piercing':'perforanti','bludgeoning':'contundenti','slashing':'taglienti','fire':'da fuoco','necrotic':'necrotici'}[damage]+f': {average}'+(f' ({dice}).' if dice else '.')}


def actions(index):
    if index=='giant-toad':
        result=actions('giant-frog');result[0].update(attackBonus=4,damage={'average':7,'dice':'1d10+2','type':'piercing'},effect={'additionalDamage':{'average':5,'dice':'1d10','type':'poison'},'grapple':{'escapeDC':13,'restrained':True,'cannotBiteOtherUntil':'grapple-ends'}},summaryIt='Morso più quattro, 7 (1d10 più 2) perforanti e 5 (1d10) veleno, afferra e trattiene, CD tredici; niente altri morsi finché dura.');result[1]['effect'].update(target='Medium-or-smaller-target-grappled-by-toad',damageAtStartToadTurn={'average':10,'dice':'3d6','type':'acid'});result[1]['effect'].pop('damageAtStartFrogTurn');result[1]['effect']['toadDies']=result[1]['effect'].pop('frogDies');result[1]['summaryIt']='Morso a Medio o minore afferrato: se colpito lo ingoia, massimo uno. Accecato, trattenuto, copertura totale da fuori e 3d6 acido a inizio turno rospo. Morto il rospo, cinque piedi per uscire prono.';return result
    groups={
      'allosaurus':[('bite','Morso',6,'one-target',15,'2d10+4','piercing'),('claw','Artiglio',6,'one-target',8,'1d8+4','slashing')],
      'triceratops':[('gore','Corno',9,'one-target',24,'4d8+6','piercing'),('stomp','Calpestare',9,'one-creature',22,'3d10+6','bludgeoning')],
      'tyrannosaurus-rex':[('bite','Morso',10,'one-target',33,'4d12+7','piercing'),('tail','Coda',10,'one-target',20,'3d8+7','bludgeoning')],
      'tiger':[('bite','Morso',5,'one-target',8,'1d10+3','piercing'),('claw','Artiglio',5,'one-target',7,'1d8+3','slashing')],
      'saber-toothed-tiger':[('bite','Morso',6,'one-target',10,'1d10+5','piercing'),('claw','Artiglio',6,'one-target',12,'2d6+5','slashing')],
      'mammoth':[('gore','Zanne',10,'one-target',25,'4d8+7','piercing'),('stomp','Calpestare',10,'one-creature',29,'4d10+7','bludgeoning')],
      'lion':[('bite','Morso',5,'one-target',7,'1d8+3','piercing'),('claw','Artiglio',5,'one-target',6,'1d6+3','slashing')],
      'panther':[('bite','Morso',4,'one-target',5,'1d6+2','piercing'),('claw','Artiglio',4,'one-target',4,'1d4+2','slashing')],
      'polar-bear':[('bite','Morso',7,'one-target',9,'1d8+5','piercing'),('claws','Artigli',7,'one-target',12,'2d6+5','slashing')],
      'giant-vulture':[('beak','Becco',4,'one-target',7,'2d4+2','piercing'),('talons','Artigli',4,'one-target',9,'2d6+2','slashing')],
      'giant-scorpion':[('claw','Chela',4,'one-target',6,'1d8+2','bludgeoning'),('sting','Pungiglione',4,'one-creature',7,'1d10+2','piercing')],
      'elephant':[('gore','Zanne',8,'one-target',18,'3d8+5','piercing'),('stomp','Calpestare',8,'one-creature',21,'3d10+5','bludgeoning')],
      'elk':[('ram','Incornata',5,'one-target',6,'1d6+3','bludgeoning'),('hooves','Zoccoli',5,'one-creature',8,'2d4+3','bludgeoning')],
      'giant-elk':[('ram','Incornata',6,'one-target',11,'2d6+4','bludgeoning'),('hooves','Zoccoli',6,'one-creature',22,'4d8+4','bludgeoning')],
      'giant-badger':[('bite','Morso',3,'one-target',4,'1d6+1','piercing'),('claws','Artigli',3,'one-target',6,'2d4+1','slashing')],
      'giant-eagle':[('beak','Becco',5,'one-target',6,'1d6+3','piercing'),('talons','Artigli',5,'one-target',10,'2d6+3','slashing')],
      'giant-constrictor-snake':[('bite','Morso',6,'one-creature',11,'2d6+4','piercing'),('constrict','Costrizione',6,'one-creature',13,'2d8+4','bludgeoning')],
      'giant-crocodile':[('bite','Morso',8,'one-target',21,'3d10+5','piercing'),('tail','Coda',8,'one-target',14,'2d8+5','bludgeoning')],
    }
    if index in groups:
        result=[attack(row) for row in groups[index]]
        if index in ['giant-badger','giant-eagle','giant-crocodile','polar-bear','giant-vulture','giant-scorpion','tyrannosaurus-rex']:
            result.insert(0,{'index':'multiattack','nameIt':'Multiattacco','activation':'action','kind':'multiattack','effect':{'attacks':[{'actionIndex':row[0],'count':2 if index=='giant-scorpion' and row[0]=='claw' else 1} for row in groups[index]]},'summaryIt':'Due attacchi con chele e uno con pungiglione.' if index=='giant-scorpion' else 'Un attacco con ciascuna delle due azioni indicate.'})
        attacks=[a for a in result if a['kind']!='multiattack']
        if index in ['elephant','elk','giant-elk','mammoth','triceratops']:
            attacks[1]['effect']={'requiresTarget':'prone-creature'};attacks[1]['summaryIt']+=' Richiede creatura prona.'
        if index=='tyrannosaurus-rex':
            result[0]['effect']['sameTargetAllowed']=False;result[0]['summaryIt']+=' Bersagli diversi obbligatori.'
            for a in attacks:a['reachFt']=10;a['summaryIt']=a['summaryIt'].replace('cinque piedi','dieci piedi')
            attacks[0]['effect']={'grapple':{'requires':'Medium-or-smaller-creature','escapeDC':17,'restrained':True,'cannotBiteOtherUntil':'grapple-ends'}};attacks[0]['summaryIt']+=' Creatura Media o minore afferrata e trattenuta, CD diciassette; non morde altri durante presa.'
        if index=='giant-elk':attacks[0]['reachFt']=10;attacks[0]['summaryIt']=attacks[0]['summaryIt'].replace('cinque piedi','dieci piedi')
        if index=='mammoth':attacks[0]['reachFt']=10;attacks[0]['summaryIt']=attacks[0]['summaryIt'].replace('cinque piedi','dieci piedi')
        if index=='giant-scorpion':
            attacks[0]['effect']={'grapple':{'escapeDC':12,'maximumTargets':2,'maximumTargetsPerClaw':1}};attacks[0]['summaryIt']+=' Due chele, ognuna afferra un bersaglio, CD dodici.'
            attacks[1]['effect']={'additionalDamageSave':{'ability':'constitution','dc':12,'failedDamage':{'average':22,'dice':'4d10','type':'poison'},'successDamage':'half'}};attacks[1]['summaryIt']+=' TS Costituzione dodici o 22 (4d10) veleno, metà se riuscito.'
        if index=='giant-constrictor-snake':
            attacks[0]['reachFt']=10;attacks[0]['summaryIt']=attacks[0]['summaryIt'].replace('cinque piedi','dieci piedi')
            attacks[1]['effect']={'grapple':{'escapeDC':16,'restrained':True,'cannotConstrictOtherUntil':'grapple-ends'}};attacks[1]['summaryIt']+=' Afferra e trattiene, CD sedici per liberarsi; non costringe altri durante presa.'
        if index=='giant-crocodile':
            attacks[0]['effect']={'grapple':{'escapeDC':16,'restrained':True,'cannotBiteOtherUntil':'grapple-ends'}};attacks[0]['summaryIt']+=' Afferra e trattiene, CD sedici per liberarsi; non morde altri durante presa.'
            attacks[1]['reachFt']=10;attacks[1]['effect']={'cannotTarget':'creature-grappled-by-this-crocodile','creatureSave':{'ability':'strength','dc':16,'failure':'prone'}};attacks[1]['summaryIt']='Coda più otto, portata dieci, 14 (2d8 più 5) contundenti. Bersaglio non afferrato dal coccodrillo; creatura TS Forza sedici o prona.'
        return result
    if index=='giant-ape':
        result=actions('ape');result[1].update(attackBonus=9,reachFt=10,damage={'average':22,'dice':'3d10+6','type':'bludgeoning'},summaryIt='Pugno più nove, portata dieci, 22 (3d10 più 6) contundenti.');result[2].update(attackBonus=9,rangeFt={'normal':50,'long':100},damage={'average':30,'dice':'7d6+6','type':'bludgeoning'},summaryIt='Pietra più nove, gittata cinquanta/cento, 30 (7d6 più 6) contundenti.');return result
    if index=='giant-octopus':
        result=actions('octopus');result[0].update(attackBonus=5,reachFt=15,damage={'average':10,'dice':'2d6+3','type':'bludgeoning'},effect={'grapple':{'escapeDC':16,'restrained':True,'requires':'creature','tentaclesUnavailableAgainstOtherTargetUntil':'grapple-ends'}},summaryIt='Tentacoli più cinque, portata quindici, 10 (2d6 più 3) contundenti. Creatura afferrata e trattenuta, CD sedici, nessun altro bersaglio mentre dura.');result[1]['effect']['radiusFt']=20;result[1]['summaryIt']=result[1]['summaryIt'].replace('cinque piedi','venti piedi');return result
    if index=='ape':
        fist=attack(('fist','Pugno',5,'one-target',6,'1d6+3','bludgeoning'))
        rock=copy.deepcopy(fist);rock.update(index='rock',nameIt='Pietra',kind='ranged-weapon-attack',rangeFt={'normal':25,'long':50},summaryIt='Pietra: attacco a distanza più cinque, gittata venticinque/cinquanta; 6 (1d6 più 3) contundenti.');rock.pop('reachFt')
        return [{'index':'multiattack','nameIt':'Multiattacco','activation':'action','kind':'multiattack','effect':{'attacks':[{'actionIndex':'fist','count':2}]},'summaryIt':'Due attacchi con il pugno.'},fist,rock]
    if index=='constrictor-snake':
        constrict=attack(('constrict','Costrizione',4,'one-creature',6,'1d8+2','bludgeoning'),{'grapple':{'escapeDC':14,'restrained':True,'cannotConstrictOtherUntil':'grapple-ends'}})
        constrict['summaryIt']+=' Afferra e trattiene, CD quattordici per liberarsi; non può costringere un altro bersaglio mentre dura.'
        return [attack(ATTACKS[index]),constrict]
    if index in ['black-bear','brown-bear']:
        rows=[('bite','Morso',3,'one-target',5,'1d6+2','piercing'),('claws','Artigli',3,'one-target',7,'2d4+2','slashing')] if index=='black-bear' else [
              ('bite','Morso',5,'one-target',8,'1d8+4','piercing'),('claws','Artigli',5,'one-target',11,'2d6+4','slashing')]
        return [{'index':'multiattack','nameIt':'Multiattacco','activation':'action','kind':'multiattack',
                 'effect':{'attacks':[{'actionIndex':'bite','count':1},{'actionIndex':'claws','count':1}]},
                 'summaryIt':'Effettua un morso e un attacco con gli artigli.'},*[attack(r) for r in rows]]
    if index not in ATTACKS:return []
    effects={
      'ankylosaurus':{'onHitCreatureSave':{'ability':'strength','dc':14,'failedCondition':'prone'}},
      'stirge':{'attachesOnHit':True,'whileAttached':'does-not-attack','bloodLossAtStartOwnTurn':{'average':5,'dice':'1d4+3','kind':'HP-loss-not-damage'},'detachSelfMovementFt':5,'detachesAfterDrainedHP':10,'detachesIfTarget':'dead','detachOther':'any-creature-action-including-target'},
      'scorpion':{'additionalDamageSave':{'ability':'constitution','dc':9,'failedDamage':{'average':4,'dice':'1d8','type':'poison'},'successDamage':'half'}},
      'giant-poisonous-snake':{'additionalDamageSave':{'ability':'constitution','dc':11,'failedDamage':{'average':10,'dice':'3d6','type':'poison'},'successDamage':'half'}},
      'giant-spider':{'additionalDamageSave':{'ability':'constitution','dc':11,'failedDamage':{'average':9,'dice':'2d8','type':'poison'},'successDamage':'half'},'poisonReducesToZeroHP':'stable-poisoned-one-hour-even-after-regaining-HP-and-paralyzed-while-poisoned-this-way'},
      'giant-wolf-spider':{'additionalDamageSave':{'ability':'constitution','dc':11,'failedDamage':{'average':7,'dice':'2d6','type':'poison'},'successDamage':'half'},'poisonReducesToZeroHP':'stable-poisoned-one-hour-even-after-regaining-HP-and-paralyzed-while-poisoned-this-way'},
      'giant-wasp':{'additionalDamageSave':{'ability':'constitution','dc':11,'failedDamage':{'average':10,'dice':'3d6','type':'poison'},'successDamage':'half'},'poisonReducesToZeroHP':'stable-poisoned-one-hour-even-after-regaining-HP-and-paralyzed-while-poisoned-this-way'},
      'mastiff':{'onHitCreatureSave':{'ability':'strength','dc':11,'failedCondition':'prone'}},
      'flying-snake':{'additionalDamage':{'average':7,'dice':'3d4','type':'poison'},'save':'none'},
      'giant-centipede':{'additionalDamageSave':{'ability':'constitution','dc':11,'failedDamage':{'average':10,'dice':'3d6','type':'poison'},'successDamage':'none'},'poisonReducesToZeroHP':'stable-poisoned-one-hour-even-after-regaining-HP-and-paralyzed-while-poisoned-this-way'},
      'giant-crab':{'grapple':{'escapeDC':11,'maximumTargets':2,'maximumTargetsPerClaw':1}},
      'giant-frog':{'grapple':{'escapeDC':11,'restrained':True,'cannotBiteOtherUntil':'grapple-ends'}},
      'crocodile':{'grapple':{'escapeDC':12,'restrained':True,'cannotBiteOtherUntil':'grapple-ends'}},
      'octopus':{'grapple':{'escapeDC':10,'tentaclesUnavailableAgainstOtherTargetUntil':'grapple-ends'}},
      'poisonous-snake':{'additionalDamageSave':{'ability':'constitution','dc':10,'failedDamage':{'average':5,'dice':'2d4','type':'poison'},'successDamage':'half'}},
      'spider':{'additionalDamageSave':{'ability':'constitution','dc':9,'failedDamage':{'average':2,'dice':'1d4','type':'poison'},'successDamage':'none'}},
      'wolf':{'onHitCreatureSave':{'ability':'strength','dc':11,'failedCondition':'prone'}},
      'dire-wolf':{'onHitCreatureSave':{'ability':'strength','dc':13,'failedCondition':'prone'}},
    }
    result=[attack(ATTACKS[index],effects.get(index))]
    summaries={
      'ankylosaurus':' Creatura TS Forza quattordici o prona.',
      'stirge':' Si attacca: mentre attaccata non attacca, ma ogni inizio suo turno il bersaglio perde 1d4 più tre PF, senza tipo di danno. Cinque piedi per staccarsi, lo fa dopo dieci PF succhiati o morte; chiunque può usare un’azione per staccarla.',
      'scorpion':' TS Costituzione nove, altri 4 (1d8) veleno se fallito, metà se riuscito.',
      'flying-snake':' Altri 7 (3d4) veleno senza TS.',
      'giant-centipede':' TS Costituzione undici o 10 (3d6) veleno. A zero da questo veleno resta stabile, avvelenato un’ora anche se curato, e paralizzato mentre così avvelenato.',
      'giant-crab':' Afferra, CD undici per liberarsi; due chele, un bersaglio per chela.',
      'giant-frog':' Afferra e trattiene, CD undici per liberarsi; non morde altri durante presa.',
      'crocodile':' Afferra e trattiene la creatura, CD dodici per liberarsi; finché dura non morde un altro bersaglio.',
      'octopus':' Afferra il bersaglio, CD 10 per liberarsi; finché dura la presa non usa i tentacoli contro un altro bersaglio.',
      'poisonous-snake':' TS Costituzione CD 10: altri 5 (2d4) danni da veleno se fallisce, metà se riesce.',
      'spider':' TS Costituzione CD 9: altri 2 (1d4) danni da veleno se fallisce, nessuno se riesce.',
      'wolf':' Una creatura colpita è prona se fallisce un TS Forza CD 11.',
      'dire-wolf':' Una creatura colpita è prona se fallisce un TS Forza CD 13.',
    }
    result[0]['summaryIt']+=summaries.get(index,'')
    if index in ['giant-spider','giant-wolf-spider','giant-wasp','giant-poisonous-snake']:
        result[0]['summaryIt']+=' TS Costituzione undici contro il veleno indicato, metà se riuscito.'
        if index!='giant-poisonous-snake':result[0]['summaryIt']+=' A zero da veleno resta stabile, avvelenato e paralizzato un’ora anche dopo cura dei PF.'
    if index in ['giant-poisonous-snake','ankylosaurus','plesiosaurus']:result[0]['reachFt']=10;result[0]['summaryIt']=result[0]['summaryIt'].replace('cinque piedi','dieci piedi')
    if index=='mastiff':result[0]['summaryIt']+=' Creatura TS Forza undici o prona.'
    if index=='giant-spider':
        result.append({'index':'web','nameIt':'Ragnatela','activation':'action','kind':'ranged-weapon-attack','attackBonus':5,'rangeFt':{'normal':30,'long':60},'target':'one-creature','effect':{'rechargeDie':'1d6','rechargeResults':[5,6],'onHit':'restrained-by-web','escape':'target-action-Strength-check-DC-twelve','web':{'armorClass':10,'hitPoints':5,'vulnerability':'fire','immunities':['bludgeoning','poison','psychic']}},'summaryIt':'Ragnatela più cinque, trenta/sessanta, ricarica cinque–sei: trattiene. Azione e Forza CD dodici per spezzarla, oppure distruggerla: CA dieci, cinque PF, vulnerabile fuoco e immune contundente veleno psichico.'})
    if index=='giant-frog':
        result.append({'index':'swallow','nameIt':'Ingoiare','activation':'action','kind':'special','effect':{'attack':'bite','target':'Small-or-smaller-target-grappled-by-frog','hit':'swallowed-grapple-ends','maximumSwallowedTargets':1,'conditions':['blinded','restrained'],'cover':'total-against-outside-attacks-and-effects','damageAtStartFrogTurn':{'average':5,'dice':'2d4','type':'acid'},'frogDies':'no-longer-restrained-escape-corpse-five-ft-movement-exit-prone'},'summaryIt':'Morso a Piccolo o minore afferrato; se colpito lo ingoia, massimo uno. Accecato, trattenuto e copertura totale da fuori, 2d4 acido a inizio turno rana. Morta la rana, cinque piedi per uscire prono.'})
    if index=='octopus':
        result.append({'index':'ink-cloud','nameIt':'Nube d’Inchiostro','activation':'action','kind':'special',
          'effect':{'uses':1,'recovery':['short-rest','long-rest'],'requires':'underwater','radiusFt':5,
                    'area':'heavily-obscured','durationMinutes':1,'dispersedBy':'significant-current',
                    'afterUseMayDashAs':'bonus-action'},
          'summaryIt':'Sott’acqua crea una nube oscurata entro cinque piedi per un minuto, dispersa da una corrente significativa; poi può Scattare con l’azione bonus. Recupera dopo riposo breve o lungo.'})
    return result


def elemental_records():
    rows=[
      ('air','Aria',125,15,False,90,24,{'walk':0,'fly':90},[14,20,14,6,10,6],['lightning','thunder'],[],['poison'],['auran']),
      ('earth','Terra',125,17,True,126,60,{'walk':30,'burrow':30},[20,8,20,5,10,5],[],['thunder'],['poison'],['terran']),
      ('fire','Fuoco',126,13,False,102,36,{'walk':50},[10,17,16,6,10,7],[],[],['fire','poison'],['ignan']),
      ('water','Acqua',126,14,True,114,48,{'walk':30,'swim':90},[18,14,18,5,10,8],['acid'],[],['poison'],['aquan']),
    ]
    burning={'damage':{'average':5,'dice':'1d10','type':'fire'},'when':'start-of-burning-target-turn','endsBy':'creature-action-to-douse'}
    space={'mayEnterAndStopIn':'hostile-creature-space','minimumPassageWidthInches':1,'requiresSqueezing':False}
    traits={
      'air':[trait('air-form','Forma d’Aria',space,'Può fermarsi nello spazio di un nemico e attraversare un passaggio largo un pollice senza stringersi.')],
      'earth':[trait('earth-glide','Scivolare nella Terra',{'burrowThrough':'nonmagical-unworked-earth-and-stone','disturbsMaterial':False},'Si muove attraverso terra e pietra non lavorate e non magiche senza disturbarle.'),
               trait('siege-monster','Mostro da Assedio',{'damageMultiplierAgainst':['objects','structures'],'multiplier':2},'Raddoppia i danni contro oggetti e strutture.')],
      'fire':[trait('fire-form','Forma di Fuoco',{**space,'touchOrMeleeHitWithin5FtDamage':{'average':5,'dice':'1d10','type':'fire'},
                'firstEntryIntoCreatureSpaceEachTurn':{'damage':{'average':5,'dice':'1d10','type':'fire'},'ignites':True,'burning':burning}},
                'Toccarlo o colpirlo in mischia entro cinque piedi infligge 1d10 fuoco. La prima entrata nello spazio di una creatura per turno infligge altrettanto e la incendia; un’azione spegne le fiamme. Attraversa passaggi di un pollice.'),
              trait('illumination','Illuminazione',{'brightRadiusFt':30,'additionalDimRadiusFt':30},'Emette luce intensa entro trenta piedi e fioca nei trenta successivi.'),
              trait('water-susceptibility','Vulnerabilità all’Acqua',{'coldDamage':1,'perWaterMovementFt':5,'perWaterSplashedGallons':1},'Subisce un danno da freddo ogni cinque piedi percorsi nell’acqua o ogni gallone d’acqua gettato su di lui.')],
      'water':[trait('water-form','Forma d’Acqua',space,'Può fermarsi nello spazio di un nemico e attraversare passaggi di un pollice senza stringersi.'),
               trait('freeze','Congelamento',{'trigger':'takes-cold-damage','speedReductionFt':20,'expires':'end-of-next-own-turn'},'Subire danni da freddo riduce la velocità di venti piedi fino alla fine del suo turno successivo.')],
    }
    result=[]
    for kind,it,page,ac,natural,hp,bonus,speed,abilities,resist,vulnerable,immune,languages in rows:
        name='touch' if kind=='fire' else 'slam'
        atk=attack((name,'Tocco' if name=='touch' else 'Schianto',{'air':8,'earth':8,'fire':6,'water':7}[kind],
                    'one-target',{'air':14,'earth':14,'fire':10,'water':13}[kind],
                    '2d6+3' if kind=='fire' else '2d8+4' if kind=='water' else '2d8+5',
                    'fire' if kind=='fire' else 'bludgeoning'))
        if kind=='earth':atk['reachFt']=10;atk['summaryIt']=atk['summaryIt'].replace('cinque piedi','dieci piedi')
        if kind=='fire':
            atk['effect']={'ignitesIfTarget':'creature-or-flammable-object','burning':copy.deepcopy(burning)}
            atk['summaryIt']+=' Incendia creature od oggetti infiammabili; infligge 1d10 fuoco all’inizio dei turni del bersaglio fino a un’azione per spegnere.'
        actions=[{'index':'multiattack','nameIt':'Multiattacco','activation':'action','kind':'multiattack',
                  'effect':{'attacks':[{'actionIndex':name,'count':2}]},'summaryIt':'Effettua due attacchi di '+('tocco.' if kind=='fire' else 'schianto.')},atk]
        if kind=='air':
            actions.append({'index':'whirlwind','nameIt':'Turbine','activation':'action','kind':'special',
              'effect':{'recharge':{'d6Minimum':4,'when':'start-of-own-turn','alsoRecovery':['short-rest','long-rest']},
                'maximumUses':1,'targets':'each-creature-in-own-space','save':{'ability':'strength','dc':13},
                'failure':{'damage':{'average':15,'dice':'3d8+2','type':'bludgeoning'},'flungMaximumFt':20,'flungDirection':'random','condition':'prone'},
                'success':'half-damage-no-fling-or-prone','objectCollisionDamagePer10FtThrown':{'average':3,'dice':'1d6','type':'bludgeoning'},
                'creatureCollision':{'save':'dexterity','dc':13,'failure':'same-collision-damage-and-prone'}},
              'summaryIt':'Turbine, ricarica 4–6: chi occupa il suo spazio fa TS Forza CD 13; fallire infligge 15 (3d8+2) danni contundenti, scaglia fino a venti piedi in direzione casuale e rende proni. Il successo dimezza i danni ed evita spinta e caduta. Collisioni infliggono 1d6 ogni dieci piedi di lancio; un’altra creatura evita danni e caduta con TS Destrezza CD 13.'})
        if kind=='water':
            actions.append({'index':'whelm','nameIt':'Sommergere','activation':'action','kind':'special',
              'effect':{'recharge':{'d6Minimum':4,'when':'start-of-own-turn','alsoRecovery':['short-rest','long-rest']},
                'maximumUses':1,'targets':'each-creature-in-own-space','save':{'ability':'strength','dc':15},
                'failureDamage':{'average':13,'dice':'2d8+4','type':'bludgeoning'},'success':'pushed-out-of-own-space',
                'grapple':{'requires':'failed-strength-save','maximumTargetSize':'Large','escapeDC':14,'condition':'restrained','cannotBreatheUnless':'water-breathing',
                           'capacityAlternatives':[{'size':'Large','count':1},{'size':'Medium-or-smaller','count':2}],
                           'damageWhen':'start-of-elemental-turn','damage':{'average':13,'dice':'2d8+4','type':'bludgeoning'}},
                'releaseOther':{'activation':'action','maximumDistanceFt':5,'target':'creature-or-object-in-elemental',
                                'ability':'strength','dc':14,'rollKind':None,'success':'pulls-target-out'}},
              'summaryIt':'Sommergere, ricarica 4–6: TS Forza CD 15 per chi occupa il suo spazio. Fallire infligge 13 (2d8+4) danni e può afferrare e trattenere una creatura Grande o fino a due Medie o minori; non respirano salvo respirazione acquatica e subiscono danni all’inizio dei turni dell’elementale. Il successo espelle il bersaglio. Liberarsi: CD 14; un’altra creatura entro cinque piedi può usare un’azione con Forza CD 14, di tipo non specificato nella prima stampa.'})
        m={'size':'Large','type':'elemental','alignment':'neutral','armorClass':{'value':ac,'source':'natural-armor' if natural else 'unspecified'},
           'hitPoints':{'average':hp,'dice':f'12d10+{bonus}'},'speedFt':speed,'abilities':dict(zip(ABILITIES,abilities,strict=True)),
           'savingThrowBonuses':{},'skillBonuses':{},'sensesFt':{'darkvision':60,**({'tremorsense':60} if kind=='earth' else {})},
           'passivePerception':10,'languages':languages,'challengeRating':5,'experiencePoints':1800,
           'damageVulnerabilities':vulnerable,'damageResistances':resist,
           'conditionalDamageResistances':[{'types':['bludgeoning','piercing','slashing'],'condition':'nonmagical-weapons'}],
           'damageImmunities':immune,'conditionImmunities':['exhaustion','paralyzed','petrified','poisoned','unconscious']+([] if kind=='earth' else ['grappled','prone','restrained']),
           'traits':copy.deepcopy(traits[kind])+[trait('elemental-nature','Natura Elementale',{'doesNotRequire':['air','food','drink','sleep']},'Non necessita di aria, cibo, bevande o sonno.')],
           'actions':actions,'reactions':[],'legendaryActions':[],**({'canHover':True} if kind=='air' else {})}
        italian={'air':'Elementale dell’Aria','earth':'Elementale della Terra','fire':'Elementale del Fuoco','water':'Elementale dell’Acqua'}[kind]
        e=record('creature',kind+'-elemental',kind.title()+' Elemental',italian,page,m,
                 'Elementale Grande di GS 5; '+ ' '.join(t['summaryIt'] for t in m['traits']),book='mm',
                 missing=['actions.2.effect.releaseOther.rollKind'] if kind=='water' else None)
        e['sources'][0].update(printedPages=[page-1],verification='read-local-render')
        e['sources'].append(source(124,'Elemental Nature','mm'));e['fieldSources']['traits']=[0,1]
        e['sources'].append(source(12,'Limited Usage and Recharge','mm'));e['fieldSources']['actions']=[0,2]
        e['reviewScope']='complete-stat-block; full-bestiary-inventory-pending'
        result.append(e)
    return result


def chain_records():
    rows=[
      ('quasit','Quasit',64,'fiend','chaotic-evil',13,7,'3d4',{'walk':40},[5,17,10,7,10,10],{'stealth':5},{'darkvision':120},10,1,200,['abyssal','common']),
      ('imp','Imp',77,'fiend','lawful-evil',13,10,'3d4+3',{'walk':20,'fly':40},[6,17,13,11,12,14],{'deception':4,'insight':3,'persuasion':4,'stealth':5},{'darkvision':120},11,1,200,['infernal','common']),
      ('pseudodragon','Pseudodrago',255,'dragon','neutral-good',13,7,'2d4+2',{'walk':15,'fly':60},[6,15,13,10,12,10],{'perception':3,'stealth':4},{'blindsight':10,'darkvision':60},13,.25,50,['common','draconic']),
      ('sprite','Sprite',284,'fey','neutral-good',15,2,'1d4',{'walk':10,'fly':40},[3,18,10,14,13,11],{'perception':3,'stealth':8},{},13,.25,50,['common','elvish','sylvan']),
    ]
    resistance=trait('magic-resistance','Resistenza alla Magia',{'advantageSavingThrowsAgainst':['spells','other-magical-effects']},'Vantaggio ai tiri salvezza contro incantesimi e altri effetti magici; il tratto appartiene alla creatura, non automaticamente al suo evocatore.')
    wake={'condition':'unconscious','endsBy':['takes-any-damage','another-creature-action-shakes-awake']}
    result=[]
    for index,it,page,ctype,alignment,ac,hp,dice,speed,abilities,skills,senses,passive,cr,xp,languages in rows:
        traits=[];actions=[]
        if index in ['imp','quasit']:
            forms={'bat':{'walk':10,'fly':40},'centipede':{'walk':40,'climb':40},'toad':{'walk':40,'swim':40}} if index=='quasit' else {
                'rat':{'walk':20},'raven':{'walk':20,'fly':60},'spider':{'walk':20,'climb':20}}
            traits.append(trait('shapechanger','Mutaforma',{'activation':'action','forms':forms,'mayReturnToTrueForm':True,'otherStatistics':'unchanged','equipmentTransforms':False,'death':'reverts-to-true-form'},
                'Con un’azione assume una delle tre forme indicate o torna alla forma autentica; cambiano le velocità elencate. L’equipaggiamento non si trasforma e la morte ripristina la forma autentica.'))
        if index=='imp':traits.append(trait('devils-sight','Vista del Diavolo',{'magicalDarknessImpedesDarkvision':False},'L’oscurità magica non ostacola la sua scurovisione.'))
        if index!='sprite':traits.append(copy.deepcopy(resistance))
        if index=='pseudodragon':
            traits.extend([keen(['sight','hearing','smell']),trait('limited-telepathy','Telepatia Limitata',{'rangeFt':100,'targetRequires':'understands-any-language','communicates':['simple-ideas','emotions','images']},'Comunica idee semplici, emozioni e immagini a creature entro cento piedi che comprendono almeno una lingua.')])
            actions.append(attack(('bite','Morso',4,'one-target',4,'1d4+2','piercing')))
            sting=attack(('sting','Pungiglione',4,'one-creature',4,'1d4+2','piercing'),{'onHitSave':{'ability':'constitution','dc':11,'failure':{'condition':'poisoned','durationHours':1},'failureByAtLeast':5,'additionalFailure':{**wake,'durationHours':1}}})
            sting['summaryIt']+=' TS Costituzione CD 11: avvelenato per un’ora; fallire di almeno cinque rende anche privo di sensi per la stessa durata, fino a danni o all’azione di un’altra creatura per svegliarlo.'
            actions.append(sting)
        if index=='quasit':
            claws=attack(('claws','Artigli (Morso in Forma Animale)',4,'one-target',5,'1d4+3','piercing'),{'onHitSave':{'ability':'constitution','dc':10,'failure':{'damage':{'average':5,'dice':'2d4','type':'poison'},'condition':'poisoned','durationMinutes':1},'successDamage':'none','repeatSave':'end-of-each-target-turn','repeatSuccess':'ends-condition'}})
            claws['summaryIt']+=' TS Costituzione CD 10: fallire infligge 2d4 veleno e avvelena per un minuto; ripetere il tiro alla fine dei turni termina l’effetto su un successo.'
            actions.extend([claws,{'index':'scare','nameIt':'Spaventare','activation':'action','kind':'special','effect':{'uses':1,'recovery':['daily'],'rangeFt':20,'target':'one-creature','save':{'ability':'wisdom','dc':10},'failure':{'condition':'frightened','durationMinutes':1},'repeatSave':'end-of-each-target-turn','repeatDisadvantageIf':'quasit-within-target-line-of-sight','repeatSuccess':'ends-condition'},'summaryIt':'Una volta al giorno spaventa una creatura entro venti piedi: TS Saggezza CD 10, fallire causa spaventato per un minuto. Ripete il tiro alla fine dei turni, con svantaggio se vede il quasit; un successo termina l’effetto.'}])
        if index=='imp':
            sting=attack(('sting','Pungiglione (Morso in Forma Animale)',5,'one-target',5,'1d4+3','piercing'),{'additionalDamageSave':{'ability':'constitution','dc':11,'failedDamage':{'average':10,'dice':'3d6','type':'poison'},'successDamage':'half'}})
            sting['summaryIt']+=' TS Costituzione CD 11 per 3d6 veleno aggiuntivi, dimezzati su un successo.'
            actions.append(sting)
        if index=='sprite':
            bow=attack(('shortbow','Arco Corto',6,'one-target',1,None,'piercing'),{'onHitSave':{'ability':'constitution','dc':10,'failure':{'condition':'poisoned','durationMinutes':1},'saveTotalAtMost':5,'additionalFailure':{**wake,'durationMinutes':1}}})
            bow.update(kind='ranged-weapon-attack',rangeFt={'normal':40,'long':160});bow.pop('reachFt')
            bow['summaryIt']='Attacco a distanza +6, gittata 40/160 piedi, un bersaglio, un danno perforante. TS Costituzione CD 10: avvelenato per un minuto; un risultato totale di cinque o meno causa anche perdita dei sensi, fino a danni o all’azione di un’altra creatura per svegliarlo.'
            actions=[attack(('longsword','Spada Lunga',2,'one-target',1,None,'slashing')),bow,{'index':'heart-sight','nameIt':'Vista del Cuore','activation':'action','kind':'special','effect':{'range':'touch','knowsCurrentEmotionalStateWithoutSave':True,'additionalAlignmentSave':{'ability':'charisma','dc':10,'failure':'knows-alignment','automaticFailureTypes':['celestial','fiend','undead']}},'summaryIt':'Toccando una creatura ne conosce l’emozione attuale. Un TS Carisma CD 10 fallito rivela anche l’allineamento; celestiali, immondi e non morti falliscono automaticamente.'}]
        if index!='pseudodragon':
            ends=['attacks']+(['uses-scare'] if index=='quasit' else ['casts-spell'] if index=='sprite' else [])+['concentration-ends-as-if-concentrating-on-spell']
            actions.append({'index':'invisibility','nameIt':'Invisibilità','activation':'action','kind':'special','effect':{'condition':'invisible','includesWornCarriedEquipment':True,'endsWhen':ends,'requiresConcentration':True,'maximumDurationNotStated':True},'summaryIt':'Diventa magicamente invisibile con l’equipaggiamento; termina attaccando'+(', usando Spaventare' if index=='quasit' else ', lanciando un incantesimo' if index=='sprite' else '')+' o perdendo la concentrazione.'})
        m={'size':'Tiny','type':ctype,'alignment':alignment,'armorClass':{'value':ac,'source':'natural-armor' if index=='pseudodragon' else 'leather-armor' if index=='sprite' else 'unspecified'},
           'hitPoints':{'average':hp,'dice':dice},'speedFt':speed,'abilities':dict(zip(ABILITIES,abilities,strict=True)),
           'savingThrowBonuses':{},'skillBonuses':skills,'sensesFt':senses,'passivePerception':passive,'languages':languages,'challengeRating':cr,'experiencePoints':xp,
           'damageVulnerabilities':[],'damageResistances':['cold','fire','lightning'] if index=='quasit' else ['cold'] if index=='imp' else [],
           'damageImmunities':['fire','poison'] if index=='imp' else ['poison'] if index=='quasit' else [],'conditionImmunities':['poisoned'] if index in ['imp','quasit'] else [],
           'traits':traits,'actions':actions,'reactions':[],'legendaryActions':[]}
        if index in ['imp','quasit']:
            m['creatureTags']=['devil' if index=='imp' else 'demon','shapechanger']
            m['conditionalDamageResistances']=[{'types':['bludgeoning','piercing','slashing'],'condition':'nonmagical-weapons-not-silvered' if index=='imp' else 'nonmagical-weapons'}]
        if index=='pseudodragon':m.update(understandsLanguagesOnly=True,cannotSpeak=True)
        e=record('creature',index,index.title(),it,page,m,f'{it}: creatura Minuscola di GS {cr:g}. '+' '.join(t['summaryIt'] for t in traits)+' '+' '.join(a['summaryIt'] for a in actions),book='mm')
        e['sources'][0].update(printedPages=[page-1],verification='read-local-render')
        e['reviewScope']='complete-stat-block; optional-MM-familiar-contract-distinct-from-PHB-summoned-spirit'
        if index!='sprite':
            vp=70 if index=='imp' else page
            e['sources'].append(source(vp,'Variant: '+index.title()+' Familiar','mm'))
            e['sources'][-1].update(printedPages=[vp-1],verification='read-local-text')
            e['optionalVariant']={'notGrantedByPactOfTheChain':True,'requires':'willing-creature-and-master-agreement','telepathicBond':True,'shareSensesRangeMiles':1,'sharedMagicResistanceRangeFt':10,'termination':'imp-may-quit-if-master-violates-contract' if index=='imp' else 'creature-may-quit-at-any-time-for-any-reason','sourceIndex':1,'summaryIt':'Variante opzionale di un famiglio consenziente: sensi condivisi entro un miglio e Resistenza alla Magia condivisa entro dieci piedi. Non è concessa automaticamente da Trova Famiglio o dal Patto della Catena.'}
        if index=='quasit':e['sourceDifferences']=[{'field':'actions.claws.attackBonus','printedValue':4,'abilityPlusProficiencyWouldBe':5,'status':'printed-stat-retained-no-reviewed-erratum-authorizes-change'}]
        result.append(e)
    return result


def surge_creatures(entities):
    by_id={e['id']:e for e in entities}
    rows=[
      ('monodrone','Monodrone',225,'Medium','construct',15,True,5,'1d8+1',{'walk':30,'fly':30},[10,13,12,4,10,5],{}, {'truesight':120},10,.125,25),
      ('duodrone','Duodrone',226,'Medium','construct',15,True,11,'2d8+2',{'walk':30},[11,13,12,6,10,7],{}, {'truesight':120},10,.25,50),
      ('tridrone','Tridrone',226,'Medium','construct',15,True,16,'3d8+3',{'walk':30},[12,13,12,9,10,9],{}, {'truesight':120},10,.5,100),
      ('quadrone','Quadrone',227,'Medium','construct',16,True,22,'4d8+4',{'walk':30,'fly':30},[12,14,12,10,10,11],{'perception':2}, {'truesight':120},12,1,200),
      ('pentadrone','Pentadrone',227,'Large','construct',16,True,32,'5d10+5',{'walk':40},[15,14,12,10,10,13],{'perception':4}, {'truesight':120},14,2,450),
      ('flumph','Flumph',136,'Small','aberration',12,False,7,'2d6',{'walk':5,'fly':30},[6,15,10,14,14,11],{'arcana':4,'history':4,'religion':4}, {'darkvision':60},12,.125,25),
      ('unicorn','Unicorno',295,'Large','celestial',12,False,67,'9d10+18',{'walk':50},[18,14,15,11,17,16],{}, {'darkvision':60},13,5,1800),
    ]
    result=[]
    for index,it,page,size,ctype,ac,natural,hp,dice,speed,abilities,skills,senses,passive,cr,xp in rows:
        traits=[];actions=[];legendary=[];dependencies=[]
        m={'size':size,'type':ctype,'alignment':'lawful-neutral' if ctype=='construct' else 'lawful-good','armorClass':{'value':ac,'source':'natural-armor' if natural else 'unspecified'},'hitPoints':{'average':hp,'dice':dice},'speedFt':speed,'abilities':dict(zip(ABILITIES,abilities,strict=True)),
           'savingThrowBonuses':{},'skillBonuses':skills,'sensesFt':senses,'passivePerception':passive,'languages':['modron'] if ctype=='construct' else ['undercommon'] if index=='flumph' else ['celestial','elvish','sylvan'],
           'challengeRating':cr,'experiencePoints':xp,'damageVulnerabilities':['psychic'] if index=='flumph' else [],'damageResistances':[],'damageImmunities':['poison'] if index=='unicorn' else [],'conditionImmunities':['charmed','paralyzed','poisoned'] if index=='unicorn' else [],'traits':traits,'actions':actions,'reactions':[],'legendaryActions':legendary}
        if ctype=='construct':
            m['creatureTags']=['modron']
            traits.extend([trait('axiomatic-mind','Mente Assiomatica',{'cannotBeCompelled':'act-against-own-nature-or-instructions'},'Non può essere costretto ad agire contro la propria natura o le istruzioni ricevute.'),trait('disintegration','Disintegrazione',{'when':'dies','body':'disintegrates-into-dust','weaponsAndOtherCarriedItems':'left-behind'},'Morendo il corpo diventa polvere, lasciando armi e oggetti trasportati.')])
            if index=='monodrone':actions.append(attack(('dagger','Pugnale',3,'one-target',3,'1d4+1','piercing')))
            elif index!='pentadrone':actions.append(attack(('fist','Pugno',2 if index=='duodrone' else 3,'one-target',2 if index=='duodrone' else 3,'1d4' if index=='duodrone' else '1d4+1','bludgeoning')))
            if index in ['monodrone','duodrone','tridrone']:
                javelin=attack(('javelin','Giavellotto',3,'one-target',4,'1d6+1','piercing'))
                javelin.update(kind='melee-or-ranged-weapon-attack',rangeFt={'normal':30,'long':120});javelin['summaryIt']='Attacco in mischia o a distanza +3, portata cinque piedi o gittata 30/120; un bersaglio, 4 (1d6+1) perforanti.';actions.append(javelin)
            if index=='quadrone':
                bow=attack(('shortbow','Arco Corto',4,'one-creature',5,'1d6+2','piercing'));bow.update(kind='ranged-weapon-attack',rangeFt={'normal':80,'long':320});bow.pop('reachFt');bow['summaryIt']='Attacco a distanza +4, gittata 80/320 piedi, una creatura, 5 (1d6+2) perforanti. Il bersaglio omesso nell’OCR è leggibile nel render.';actions.append(bow)
            if index=='pentadrone':
                actions.append(attack(('arm','Braccio',4,'one-target',5,'1d6+2','bludgeoning')))
                actions.append({'index':'paralysis-gas','nameIt':'Gas Paralizzante','activation':'action','kind':'special','effect':{'recharge':{'d6Minimum':5,'when':'start-of-own-turn','alsoRecovery':['short-rest','long-rest']},'maximumUses':1,'area':{'shape':'cone','lengthFt':30},'targets':'each-creature-in-area','save':{'ability':'constitution','dc':11},'failure':{'condition':'paralyzed','durationMinutes':1},'repeatSave':'end-of-each-target-turn','repeatSuccess':'ends-condition'},'summaryIt':'Gas in un cono di trenta piedi, ricarica 5–6: TS Costituzione CD 11 o paralizzato per un minuto. Un TS ripetuto a fine turno può terminare l’effetto.'})
            if index!='monodrone':
                choices=[[{'actionIndex':'arm','count':5}]] if index=='pentadrone' else [[{'actionIndex':'fist','count':2 if index in ['duodrone','quadrone'] else 3}],[{'actionIndex':'shortbow' if index=='quadrone' else 'javelin','count':4 if index=='quadrone' else 2 if index=='duodrone' else 3}]]
                actions.insert(0,{'index':'multiattack','nameIt':'Multiattacco','activation':'action','kind':'multiattack','effect':{'attackAlternatives':choices},'summaryIt':{'duodrone':'Due pugni oppure due giavellotti.','tridrone':'Tre pugni oppure tre giavellotti.','quadrone':'Due pugni oppure quattro attacchi con arco corto.','pentadrone':'Cinque attacchi di braccio.'}[index]})
        if index=='flumph':
            m.update(telepathyFt=60,understandsLanguagesOnly=True,cannotSpeak=True)
            traits.extend([trait('advanced-telepathy','Telepatia Avanzata',{'perceivesTelepathicCommunicationWithinFt':60,'cannotBeSurprisedBy':'creatures-with-any-telepathy'},'Percepisce comunicazioni telepatiche entro sessanta piedi e non è sorpreso da creature telepatiche.'),trait('prone-deficiency','Vulnerabilità alla Caduta',{'when':'knocked-prone','rollAnyDieOdd':'upside-down-and-incapacitated','rightSelfSave':{'when':'end-of-each-own-turn','ability':'dexterity','dc':10,'success':'rights-self-and-ends-incapacitated'}},'Se cade prono, un risultato dispari lo lascia capovolto e incapacitato; un TS Destrezza CD 10 a fine turno lo raddrizza.'),trait('telepathic-shroud','Schermo Telepatico',{'immuneTo':['emotion-sensing','thought-reading','all-divination-spells']},'È immune a lettura dei pensieri, percezione delle emozioni e magie di divinazione.')])
            tendril=attack(('tendrils','Tentacoli',4,'one-creature',4,'1d4+2','piercing'),{'additionalHitDamage':{'average':2,'dice':'1d4','type':'acid'},'recurringDamage':{'when':'end-of-each-target-turn','save':{'ability':'constitution','dc':10},'failureDamage':{'average':2,'dice':'1d4','type':'acid'},'success':'ends-recurring-damage','alsoEndsBySpellId':'phb2014:spell:lesser-restoration'}});tendril['summaryIt']+=' Inoltre 1d4 acido immediato; TS Costituzione CD 10 a fine turno o altri 1d4 acido, finché un successo o Ristorare Inferiore termina la ricorrenza.'
            actions.extend([tendril,{'index':'stench-spray','nameIt':'Spruzzo Fetido','activation':'action','kind':'special','effect':{'uses':1,'recovery':['daily'],'area':{'shape':'cone','lengthFt':15},'save':{'ability':'dexterity','dc':10},'failure':{'durationHours':'1d4','condition':'poisoned','otherCreaturesWithinFt':5,'othersConditionWhileWithin':'poisoned'},'removeFromSelf':'short-rest-bathing-in-water-alcohol-or-vinegar'},'summaryIt':'Una volta al giorno, cono di quindici piedi: TS Destrezza CD 10 o fetore per 1d4 ore e avvelenato, con lo stesso effetto sugli altri entro cinque piedi. Lavarsi durante un riposo breve in acqua, alcol o aceto lo rimuove.'}]);dependencies=['phb2014:spell:lesser-restoration']
        if index=='unicorn':
            m['telepathyFt']=60
            dependencies=['phb2014:spell:'+s for s in ['detect-evil-and-good','druidcraft','pass-without-trace','calm-emotions','dispel-evil-and-good','entangle']]
            traits.extend([trait('charge','Carica',{'requires':['moved-at-least-20-ft-straight-toward-target','hits-with-horn-in-same-turn'],'additionalDamage':{'average':9,'dice':'2d8','type':'piercing'},'creatureTargetSave':{'ability':'strength','dc':15,'failure':'prone'}},'Dopo venti piedi in linea retta, il corno infligge altri 2d8 perforanti; una creatura fa TS Forza CD 15 o cade prona.'),trait('innate-spellcasting','Incantesimi Innati',{'castingAbility':'charisma','spellSaveDC':14,'componentsRequired':[],'atWillSpellIds':dependencies[:3],'oncePerDayEachSpellIds':dependencies[3:]},'Lancia senza componenti con Carisma, CD 14; tre magie a volontà e tre una volta al giorno ciascuna.'),trait('magic-resistance','Resistenza alla Magia',{'advantageSavingThrowsAgainst':['spells','other-magical-effects']},'Vantaggio ai TS contro incantesimi e altri effetti magici.'),trait('magic-weapons','Armi Magiche',{'weaponAttacks':'magical'},'I suoi attacchi con armi sono magici.')])
            actions.extend([{'index':'multiattack','nameIt':'Multiattacco','activation':'action','kind':'multiattack','effect':{'attacks':[{'actionIndex':'hooves','count':1},{'actionIndex':'horn','count':1}]},'summaryIt':'Un attacco con gli zoccoli e uno col corno.'},attack(('hooves','Zoccoli',7,'one-target',11,'2d6+4','bludgeoning')),attack(('horn','Corno',7,'one-target',8,'1d8+4','piercing')),
                {'index':'healing-touch','nameIt':'Tocco Guaritore','activation':'action','kind':'special','effect':{'uses':3,'recovery':['daily'],'target':'another-creature-touched-with-horn','healing':{'average':11,'dice':'2d8+2'},'removes':'all-diseases','neutralizes':'all-poisons-afflicting-target'},'summaryIt':'Tre volte al giorno tocca un’altra creatura: recupera 2d8+2 PF, elimina tutte le malattie e neutralizza i veleni che la affliggono.'},
                {'index':'teleport','nameIt':'Teletrasporto','activation':'action','kind':'special','effect':{'uses':1,'recovery':['daily'],'targets':'self-and-up-to-three-visible-willing-creatures-within-five-ft','includesWornCarriedEquipment':True,'destination':'familiar-location-within-one-mile'},'summaryIt':'Una volta al giorno teletrasporta sé e fino a tre creature consenzienti visibili entro cinque piedi, con equipaggiamento, in un luogo familiare entro un miglio.'}])
            hoof=copy.deepcopy(actions[1]);hoof.update(index='legendary-hooves',activation='legendary-action');hoof['effect']={'legendaryActionCost':1};legendary.append(hoof)
            legendary.extend([{'index':'shimmering-shield','nameIt':'Scudo Scintillante','activation':'legendary-action','kind':'special','effect':{'legendaryActionCost':2,'target':'self-or-visible-creature-within-sixty-ft','armorClassBonus':2,'expires':'end-of-unicorn-next-turn'},'summaryIt':'Due azioni leggendarie danno CA +2 a sé o a una creatura visibile entro sessanta piedi, fino alla fine del turno successivo dell’unicorno.'},{'index':'heal-self','nameIt':'Curare Se Stesso','activation':'legendary-action','kind':'special','effect':{'legendaryActionCost':3,'healing':{'average':11,'dice':'2d8+2'},'target':'self'},'summaryIt':'Tre azioni leggendarie recuperano 2d8+2 PF propri.'}])
            m['legendaryActionEconomy']={'maximum':3,'recovery':'start-of-own-turn','timing':'end-of-another-creature-turn','maximumOptionsPerOpportunity':1}
            m['regionalEffects']=[{'effect':{'extinguishes':'open-nonmagical-flames','enclosedLanterns':'unaffected'},'summaryIt':'Nel dominio le fiamme aperte non magiche si spengono; le lanterne chiuse funzionano.','sourceIndex':1},{'effect':{'requires':'creature-native-to-domain','advantageChecks':'dexterity-stealth-to-hide'},'summaryIt':'I nativi del dominio hanno vantaggio a Furtività per nascondersi.','sourceIndex':1},{'effect':{'requires':'good-aligned-healer-magically-heals-good-aligned-target','healing':'maximum-possible'},'summaryIt':'Le cure magiche di creature buone a creature buone restituiscono il massimo possibile.','sourceIndex':1},{'effect':{'requires':'good-aligned-creature','curses':'suppressed','allRegionalEffectsEnd':'unicorn-dies'},'summaryIt':'Le maledizioni sulle creature buone sono soppresse; la morte dell’unicorno termina immediatamente gli effetti regionali.','sourceIndex':1}]
        missing=['spellDescription:'+dep for dep in dependencies if not by_id[dep]['verification']['complete']]
        e=record('creature',index,index.title(),it,page,m,f'{it}: {size}, CA {ac}, {hp} PF, GS {cr:g}. '+' '.join(t['summaryIt'] for t in traits)+' '+' '.join(a['summaryIt'] for a in actions),book='mm',missing=missing)
        e['sources'][0].update(printedPages=[page-1],verification='read-local-render');e['reviewScope']='complete-local-stat-block-fields; dependency-verification-explicit'
        if index=='unicorn':e['sources'].append(source(294,'Regional Effects','mm'));e['fieldSources']['regionalEffects']=[1]
        if index=='pentadrone':e['sources'].append(source(12,'Limited Usage and Recharge','mm'));e['fieldSources']['actions'].append(1)
        if dependencies:e['relations']={'spellIds':dependencies}
        if ctype=='construct':e['optionalVariant']={'nameIt':'Modron Rinnegato','source':source(225,'Variant: Rogue Modrons','mm'),'losesTraitIndex':'axiomatic-mind','alignment':'any-except-lawful-neutral','otherStatistics':'unchanged','notAutomaticWildSurgeChoice':True}
        result.append(e)
    return result


def apply_creature_reviews(entities):
    added=[]
    for index,it,page,size,ac,natural,hp,dice,speed,abilities,skills,senses,passive,cr,xp in ROWS:
        mechanics={'size':size,'type':'beast','alignment':'unaligned',
          'armorClass':{'value':ac,'source':'natural-armor' if natural else 'unspecified'},
          'hitPoints':{'average':hp,'dice':dice},'speedFt':speed,'abilities':dict(zip(ABILITIES,abilities,strict=True)),
          'savingThrowBonuses':{},'skillBonuses':skills,'sensesFt':senses,'passivePerception':passive,
          'languages':[],'challengeRating':cr,'experiencePoints':xp,'damageVulnerabilities':[],
          'damageResistances':[],'damageImmunities':[],'conditionImmunities':[],
          'traits':copy.deepcopy(TRAITS.get(index,[])),'actions':actions(index),
          'reactions':[],'legendaryActions':[]}
        summary=f'{it}: bestia {size}, CA {ac}, {hp} PF, grado di sfida {cr:g}. '
        if index in ['giant-eagle','giant-elk','giant-owl']:
            mechanics['languages']=[index]
            mechanics['understandsAdditionalLanguages']=['common','auran'] if index=='giant-eagle' else ['common','elvish','sylvan']
            mechanics['cannotSpeakAdditionalLanguages']=True
            if index=='giant-eagle':mechanics['alignment']='neutral-good'
            if index=='giant-owl':mechanics['alignment']='neutral'
        if index=='giant-vulture':
            mechanics.update(alignment='neutral-evil',understandsAdditionalLanguages=['common'],cannotSpeakAdditionalLanguages=True)
            summary+=' Comprende Comune ma non parla. '
        if index=='giant-rat':
            bite=attack(('bite','Morso',3,'one-target',3,'1d4+1','piercing'),{'onHitCreatureSave':{'ability':'constitution','dc':10,'failure':'disease'},'disease':{'healing':'magical-only-until-cured','maximumHPReductionEvery24Hours':{'average':3,'dice':'1d6'},'diesIfMaximumHP':0}})
            bite['summaryIt']+=' Creatura TS Costituzione dieci o malattia: solo cure magiche, massimo PF ridotto d6 ogni ventiquattro ore; zero massimo PF uccide.'
            mechanics['optionalVariants']=[{'requiresDMApproval':True,'nameIt':'Topo Gigante Malato','effect':{'replacesActionIndex':'bite','action':bite,'challengeRating':.125,'experiencePoints':25}}]
            summary+=' Variante malata facoltativa: il morso trasmette una malattia, distinta dal blocco base. '
        if index=='ankylosaurus':
            mechanics['optionalVariants']=[{'requiresDMApproval':True,'nameIt':'Coda Spinata','effect':{'replacesActionDamageType':{'actionIndex':'tail','damageType':'piercing'}}}]
            summary+=' Variante facoltativa con coda perforante, separata dal blocco base. '
        if index=='polar-bear':
            mechanics['optionalVariants']=[{'requiresDMApproval':True,'nameIt':'Orso delle Caverne','effect':{'sensesFt':{'darkvision':60},'otherStatistics':'unchanged'}}]
            summary+=' Variante orso delle caverne con scurovisione sessanta piedi; altre statistiche invariate. '
        if index=='warhorse':
            mechanics['optionalVariants']=[{'requiresDMApproval':True,'nameIt':'Bardatura','effect':{'armorClassByBarding':{'leather':12,'studded-leather':13,'ring-mail':14,'scale-mail':15,'chain-mail':16,'splint':17,'plate':18},'challengeRating':'unchanged'}}]
            summary+=' CA opzionale secondo bardatura, senza cambiare il grado di sfida. '
        if index=='giant-lizard':
            mechanics['optionalVariants']=[{'requiresDMApproval':True,'nameIt':'Trattenere il Fiato','effect':{'holdBreathMinutes':15,'swimSpeedFt':30}},{'requiresDMApproval':True,'nameIt':'Movimento del Ragno','effect':{'difficultClimbingIncludingCeilings':'no-ability-check'}}]
        summary+=' '.join(t['summaryIt'] for t in mechanics['traits'])
        if index in ['giant-eagle','giant-elk','giant-owl']:summary+=' Parla la propria lingua e comprende, senza parlarle, le altre lingue indicate.'
        if index=='giant-lizard':summary+=' Due varianti facoltative del DM, separate dal blocco base: fiato quindici minuti e nuoto trenta, oppure scalare anche soffitti senza prova.'
        if not mechanics['actions']:summary+=' Il blocco non presenta attacchi efficaci o azioni speciali.'
        e=record('creature',index,index.replace('-',' ').title(),it,page,mechanics,summary,book='mm')
        e['sources'][0].update(printedPages=[page-1],verification='read-local-render')
        e['reviewScope']='complete-stat-block; full-bestiary-inventory-pending'
        if index=='frog':e['aliases']=['toad']
        if index=='owl':
            # Two books disagree; this is not an official erratum to the PHB.
            e['sourceDifferences']=[{'field':'traits.keen-senses','otherBook':'phb',
              'filename':'D&D_5_Player_Original_Handbook.pdf','pdfPages':[309],
              'otherValue':['sight'],'thisValue':['hearing','sight'],
              'status':'distinct-first-printing-passages-not-normalized'}]
        added.append(e)
    entities.extend([*added,*swarm_records(),*elemental_records(),*chain_records(),*surge_creatures(entities),*item_creatures(),*npc_records(),*golem_records(),*bean_creatures(),*artifact_creatures(),*mephit_records(),*minor_elemental_records(),*higher_elemental_records(),*flask_fiend_records(),*remaining_genie_records(),*angel_records(),*other_flask_records(),*remaining_slaad_records(),*demon_records(),*devil_records(),*celestial_records(),*woodland_records(),*faerie_dragon_records(),*hag_records(),*hag_rules()])
    familiar=next(e for e in entities if e['id']=='phb2014:spell:find-familiar')
    familiar.setdefault('relations',{})['normalFormIds']=['mm2014:creature:'+i for i in FAMILIAR_FORMS]
    pact=next(e for e in entities if e['id']=='phb2014:class-option:pact-of-the-chain')
    pact.setdefault('relations',{})['specialFormIds']=['mm2014:creature:'+i for i in CHAIN_FORMS]
    entities.extend([
      record('rule','legendary-creatures','Legendary Creatures','Creature Leggendarie',12,{'legendaryTiming':'end-another-creature-turn','maximumOptionsPerOpportunity':1,'recovery':'start-own-turn','optionalToUse':True,'unavailableWhileIncapacitated':True,'otherActionPreventionInLocalPrinting':False,'surpriseRestrictionInLocalPrinting':False,'assumedLegendaryFormInheritanceInLocalPrinting':'not-addressed','lairInitiative':20,'lairLosesAllTies':True,'lairActionPreventionInLocalPrinting':False,'lairSurpriseRestrictionInLocalPrinting':False,'regionalEffectsEnd':'individual-creature-description'},'Azioni leggendarie una opzione alla fine del turno altrui, recupero a inizio proprio, facoltative e non disponibili da incapace. Tana iniziativa venti perdendo ogni parità. Originale ed errata distinti per sorpresa, altre incapacità di agire e forme assunte.',book='mm'),
      record('rule','monster-actions-and-spells','Monster Actions, Resources and Spellcasting','Azioni, Risorse e Incantesimi dei Mostri',[11,12],{'innateSpellLevel':'lowest-possible-no-upcast-unless-stated','innateCantripLevelIfNotGiven':'challenge-rating','innateSpellsMayBeSwapped':False,'spellcasting':'listed-class-known-or-prepared-spells-and-slots','spellcastingCantripLevel':'stated-caster-level','mayUpcast':'listed-available-slot','DMSpellReplacement':'same-class-list-same-level-threat-may-change','psionicsTagAlone':'no-extra-rules','classMembershipForMagicItemsInLocalPrinting':False,'multiattackOpportunityAttackAllowed':False,'dailyUsageRecovery':'long-rest','rechargeDice':'d6-start-own-turn-matching-numbers-or-short-long-rest','rechargeAfterRest':'short-or-long-rest','thrownAmmoAssumption':'2d4','projectileAmmoAssumption':'2d10','grappleOnHit':'automatic-unless-action-says-otherwise','escapeGrapple':'action-athletics-or-acrobatics-versus-listed-DC-or-ten-plus-monster-athletics-modifier','materialComponentsAssumption':'monster-has-materials-needed-for-listed-spells','equipmentRecoverability':'DM-decides'},'Statistiche mostri non diventano livelli PG. Innate livello minimo, trucchetti usano GS se livello assente; Incantesimi usa livello/slot dichiarati. Multiattacco non è attacco opportunità. Usi al giorno recuperano riposo lungo, ricarica d6 a inizio turno o riposi. Fuga da lotta prova Atletica/Acrobazia con azione; equipaggiamento recuperabile decide DM.',book='mm'),
    ])
    # Form selection comes from PHB; statistics come from separate MM entities.


def golem_records():
    rows=[('clay','Argilla',169,'Large','unaligned',14,133,'14d10+56',20,[20,9,18,3,8,1],60,9,9,5000,['acid','poison','psychic'],8,16,'2d10+5'),('flesh','Carne',170,'Medium','neutral',9,93,'11d8+44',30,[19,9,18,6,10,5],60,10,5,1800,['lightning','poison'],7,13,'2d8+4'),('iron','Ferro',171,'Large','unaligned',20,210,'20d10+100',30,[24,9,20,3,11,1],120,10,16,15000,['fire','poison','psychic'],13,20,'3d8+7'),('stone','Pietra',171,'Large','unaligned',17,178,'17d10+85',30,[22,9,20,3,11,1],120,10,10,5900,['poison','psychic'],10,19,'3d8+6')]
    result=[]
    for index,it,page,size,align,ac,hp,dice,speed,abilities,dark,passive,cr,xp,immunities,bonus,damage,damage_dice in rows:
        traits=[trait('constructed-nature','Natura Artificiale',{'needs':['no-air','no-food','no-drink','no-sleep']},'Non richiede aria, cibo, acqua o sonno.'),trait('immutable-form','Forma Immutabile',{'immuneTo':'spell-or-effect-altering-form'},'Immune a incantesimi o effetti che ne modificano la forma.'),trait('magic-resistance','Resistenza alla Magia',{'saveAdvantage':'spells-and-other-magical-effects'},'Vantaggio ai TS contro incantesimi e altri effetti magici.'),trait('magic-weapons','Armi Magiche',{'weaponAttacksAreMagical':True},'Attacchi con armi magici.')]
        m={'size':size,'type':'construct','alignment':align,'armorClass':{'value':ac,'source':'unspecified' if index=='flesh' else 'natural-armor'},'hitPoints':{'average':hp,'dice':dice},'speedFt':{'walk':speed},'abilities':dict(zip(ABILITIES,abilities,strict=True)),'savingThrowBonuses':{},'skillBonuses':{},'sensesFt':{'darkvision':dark},'passivePerception':passive,'languages':[],'understandsLanguages':'creator-languages','cannotSpeak':True,'challengeRating':cr,'experiencePoints':xp,'damageVulnerabilities':[],'damageResistances':[],'damageImmunities':immunities,'conditionalDamageImmunities':[{'types':['bludgeoning','piercing','slashing'],'condition':'nonmagical-weapons-not-adamantine'}],'conditionImmunities':['charmed','exhaustion','frightened','paralyzed','petrified','poisoned'],'traits':traits,'actions':[],'reactions':[],'legendaryActions':[]}
        slam=attack(('slam','Schianto',bonus,'one-target',damage,damage_dice,'bludgeoning'))
        m['actions']=[{'index':'multiattack','nameIt':'Multiattacco','kind':'multiattack','activation':'action','effect':{'attacks':[{'actionIndex':'slam','count':2}]},'summaryIt':'Due Schianti.'},slam]
        if index!='stone':
            dtype={'clay':'acid','flesh':'lightning','iron':'fire'}[index]
            traits.append(trait('absorption','Assorbimento',{'damageType':dtype,'insteadOfDamage':'regain-HP-equal-to-damage'},'Invece del danno di '+{'acid':'acido','lightning':'fulmine','fire':'fuoco'}[dtype]+' recupera PF pari al danno.'))
        if index in ['clay','flesh']:
            threshold=60 if index=='clay' else 40
            effect={'trigger':'start-own-turn-at-or-below-HP-threshold','maximumHPForTrigger':threshold,'roll':'1d6','onRoll':6,'eachTurn':'attack-nearest-visible-creature-or-if-none-reachable-object-prefer-smaller-than-self','ends':['destroyed','full-HP-restored']}
            if index=='flesh':effect['creatorCanCalm']={'withinFt':60,'mustHearCreator':True,'activation':'action','ability':'charisma','skill':'persuasion','checkDC':15,'success':'ends-berserk','damageWhileStillAtLowHP':'may-go-berserk-again'}
            traits.append(trait('berserk','Furia',effect,f'Inizio turno con al massimo {threshold} PF tira d6; sei entra in furia attaccando il più vicino visibile o un oggetto. Termina distrutto o a PF pieni.'+(' Creatore entro sessanta può calmarlo con azione Persuasione quindici se udito.' if index=='flesh' else '')))
        if index=='clay':
            slam['effect']={'onCreatureHitSave':{'ability':'constitution','DC':15,'failure':'HP-maximum-reduced-by-damage-taken','atZeroMaximum':'dies','lastsUntil':'greater-restoration-or-other-magic','cureSpellId':'phb2014:spell:greater-restoration'}};slam['summaryIt']+=' Creatura TS Costituzione quindici o massimo PF ridotto del danno subito, zero uccide; dura fino a Ristorare Superiore o altra magia.'
            m['actions'].append({'index':'haste','nameIt':'Velocità','kind':'special','activation':'action','rechargeD6':[5,6],'effect':{'magical':True,'until':'end-own-next-turn','armorClassBonus':2,'dexteritySavesAdvantage':True,'bonusActionAttackIndex':'slam','isHasteSpell':False},'summaryIt':'Ricarica cinque–sei: fino a fine prossimo turno CA più due, vantaggio TS Destrezza e Schianto come azione bonus. Non è incantesimo Velocità.'})
        if index=='flesh':traits.append(trait('aversion-of-fire','Avversione al Fuoco',{'trigger':'takes-fire-damage','disadvantage':['attack-rolls','ability-checks'],'until':'end-own-next-turn'},'Dopo danno fuoco svantaggio a tiri attacco e prove fino a fine prossimo turno.'))
        if index=='iron':
            sword=attack(('sword','Spada',13,'one-target',23,'3d10+7','slashing'));sword['reachFt']=10;sword['summaryIt']='Spada più tredici, portata dieci, 23 (3d10 più sette) taglienti.'
            m['actions'][0]['effect']={'attackAlternatives':[[{'actionIndex':'slam','count':2}],[{'actionIndex':'sword','count':2}],[{'actionIndex':'slam','count':1},{'actionIndex':'sword','count':1}]]};m['actions'][0]['summaryIt']='Due attacchi in mischia, Schianto o Spada.'
            m['actions'] += [sword,{'index':'poison-breath','nameIt':'Soffio Velenoso','kind':'special','activation':'action','rechargeD6':[6],'effect':{'coneFt':15,'saveAbility':'constitution','saveDC':19,'failureDamage':{'average':45,'dice':'10d8','type':'poison'},'successDamage':'half'},'summaryIt':'Ricarica sei, cono quindici: TS Costituzione diciannove, 45 (10d8) veleno dimezzati con successo.'}]
        if index=='stone':m['actions'].append({'index':'slow','nameIt':'Rallentare','kind':'special','activation':'action','rechargeD6':[5,6],'effect':{'targets':'one-or-more-visible-creatures-within-ten-ft','saveAbility':'wisdom','saveDC':17,'magical':True,'failure':{'reactions':False,'speedMultiplier':0.5,'maximumAttacksOnOwnTurn':1,'actionChoice':'action-or-bonus-not-both'},'durationMinutes':1,'repeat':'end-own-turn-success-ends','isSlowSpell':False},'summaryIt':'Ricarica cinque–sei, uno o più visibili entro dieci: TS Saggezza diciassette o per un minuto niente reazioni, velocità dimezzata, massimo un attacco e azione oppure bonus. Ripete a fine turno. Non è l’incantesimo Lentezza.'})
        e=record('creature',index+'-golem',index.title()+' Golem','Golem di '+it,[168,page],m,'Golem, blocco separato dai tempi/costi di creazione del DMG. '+' '.join(t['summaryIt'] for t in traits),book='mm');e['sources'][0].update(printedPages=[167,page-1],verification='read-local-render')
        if index=='clay':e['relations']={'cureSpellIds':['phb2014:spell:greater-restoration']}
        result.append(e)
    return result


def bean_creatures():
    rows=[
      ('bulette','Bulette',[35],'Large','monstrosity','unaligned',17,94,'9d10+45',{'walk':40,'burrow':40},[19,11,21,2,10,5],{}, {'perception':6},{'darkvision':60,'tremorsense':60},16,[],5,1800),
      ('shrieker','Fungo Stridente',[138,139],'Medium','plant','unaligned',5,13,'3d8',{'walk':0},[1,1,10,1,3,1],{},{},{'blindsight':30},6,[],0,10),
      ('treant','Treant',[290],'Huge','plant','chaotic-good',16,138,'12d12+60',{'walk':30},[23,8,21,12,16,12],{},{},{},13,['common','druidic','elvish','sylvan'],9,5000),
      ('mummy','Mummia',[228,229],'Medium','undead','lawful-evil',11,58,'9d8+18',{'walk':20},[16,8,15,6,10,12],{'wisdom':2},{},{'darkvision':60},10,[],3,700),
      ('mummy-lord','Signore delle Mummie',[228,229,230],'Medium','undead','lawful-evil',17,97,'13d8+39',{'walk':20},[18,10,17,11,18,16],{'constitution':8,'intelligence':5,'wisdom':9,'charisma':8},{'history':5,'religion':5},{'darkvision':60},14,[],15,13000),
    ]
    result=[]
    for index,it,pages,size,ctype,alignment,ac,hp,dice,speed,abilities,saves,skills,senses,passive,languages,cr,xp in rows:
        m={'size':size,'type':ctype,'alignment':alignment,'armorClass':{'value':ac,'source':'unspecified' if index=='shrieker' else 'natural-armor'},'hitPoints':{'average':hp,'dice':dice},'speedFt':speed,'abilities':dict(zip(ABILITIES,abilities,strict=True)),'savingThrowBonuses':saves,'skillBonuses':skills,'sensesFt':senses,'passivePerception':passive,'languages':languages,'challengeRating':cr,'experiencePoints':xp,'damageVulnerabilities':[],'damageResistances':[],'damageImmunities':[],'conditionImmunities':[],'traits':[],'actions':[],'reactions':[],'legendaryActions':[]}
        deps=[]
        if index=='bulette':
            m['traits']=[trait('standing-leap','Salto da Fermo',{'longJumpFt':30,'highJumpFt':15,'runningStartRequired':False},'Salta trenta in lungo e quindici in alto con o senza rincorsa.')]
            m['actions']=[attack(('bite','Morso',7,'one-target',30,'4d12+4','piercing')),{'index':'deadly-leap','nameIt':'Balzo Mortale','activation':'action','kind':'special','effect':{'requires':'jump-at-least-fifteen-ft-as-part-of-movement','land':'on-feet-in-space-with-one-or-more-other-creatures','eachCreatureSave':{'abilityChoice':['strength','dexterity'],'dc':16,'chosenBy':'target'},'failure':{'prone':True,'damage':[{'average':14,'dice':'3d6+4','type':'bludgeoning'},{'average':14,'dice':'3d6+4','type':'slashing'}]},'success':'half-damage-not-prone-pushed-five-ft-to-target-chosen-unoccupied-space','ifNoAvailableSpaceOnSuccess':'instead-prone-in-bulette-space'},'summaryIt':'Dopo salto almeno quindici piedi nel movimento, azione atterra nello spazio altrui. Ogni creatura TS Forza o Destrezza sedici a scelta: prono e 3d6 più quattro contundenti e taglienti; successo metà e spinta cinque in libero scelto, se non esiste prono nello spazio.'}]
        if index=='shrieker':
            m['conditionImmunities']=['blinded','deafened','frightened'];m['blindBeyondBlindsight']=True
            m['traits']=[trait('false-appearance','Falso Aspetto',{'whileMotionless':'indistinguishable-from-ordinary-fungus'},'Immobile sembra indistinguibile da fungo ordinario.')]
            m['reactions']=[{'index':'shriek','nameIt':'Stridio','kind':'special','activation':'reaction','effect':{'trigger':'bright-light-or-creature-within-thirty-ft','audibleFt':300,'lasts':'while-disturbance-in-range-then-one-d-four-own-turns'},'summaryIt':'Luce intensa o creatura trenta piedi provoca stridio udibile trecento. Continua finché disturbo non esce, poi d4 propri turni.'}]
        if index=='treant':
            m['damageResistances']=['bludgeoning','piercing'];m['damageVulnerabilities']=['fire']
            m['traits']=[trait('false-appearance','Falso Aspetto',{'whileMotionless':'indistinguishable-from-normal-tree'},'Fermo indistinguibile da albero normale.'),trait('siege-monster','Mostro d’Assedio',{'doubleDamageAgainst':['objects','structures']},'Danni doppi a oggetti e strutture.')]
            rock=attack(('rock','Roccia',10,'one-target',28,'4d10+6','bludgeoning'));rock.update(kind='ranged-weapon-attack',rangeFt={'normal':60,'long':180});rock.pop('reachFt');rock['summaryIt']='Roccia a distanza più dieci, sessanta/centottanta, 4d10 più sei contundenti.'
            m['actions']=[{'index':'multiattack','nameIt':'Multiattacco','activation':'action','kind':'multiattack','effect':{'attacks':[{'actionIndex':'slam','count':2}]},'summaryIt':'Due Schianti.'},attack(('slam','Schianto',10,'one-target',16,'3d6+6','bludgeoning')),rock,{'index':'animate-trees','nameIt':'Animare Alberi','activation':'action','kind':'special','effect':{'uses':1,'recovery':['daily'],'targets':'one-or-two-visible-trees-within-sixty-ft','statistics':'same-as-treant-except-Intelligence-and-Charisma-one-no-speech-only-Slam-action','friendlyTo':'treant','durationDays':1,'ends':['tree-dies','treant-dies','treant-more-than-one-hundred-twenty-ft','treant-bonus-action-dismiss'],'onEnd':'takes-root-if-possible'},'summaryIt':'Una volta al giorno anima uno/due alberi visibili sessanta: statistiche treant salvo Int/Car uno, nessuna parola e soltanto Schianto. Alleati fino giorno, morte albero/treant, oltre centoventi dal treant o bonus termine. Radicano se possibile.'}]
        if index in ['mummy','mummy-lord']:
            lord=index=='mummy-lord';dc=16 if lord else 12;glare_dc=16 if lord else 11
            m.update(languageOrigin='languages-known-in-life',damageVulnerabilities=['fire'],damageImmunities=['necrotic','poison'],conditionImmunities=['charmed','exhaustion','frightened','paralyzed','poisoned'])
            m['conditionalDamageImmunities' if lord else 'conditionalDamageResistances']=[{'types':['bludgeoning','piercing','slashing'],'condition':'nonmagical-weapons'}]
            m['traits']=[trait('undead-nature','Natura Non Morta',{'doesNotRequire':['air','food','drink','sleep']},'Non richiede aria, cibo, bevande o sonno.')]
            fist=attack(('rotting-fist','Pugno Putrefacente',9 if lord else 5,'one-target',14 if lord else 10,'3d6+4' if lord else '2d6+3','bludgeoning'),{'extraDamage':{'average':21 if lord else 10,'dice':'6d6' if lord else '3d6','type':'necrotic'},'creatureSave':{'ability':'constitution','dc':dc,'failure':'cursed-mummy-rot'},'mummyRot':{'cannotRegainHP':True,'maximumHPDecreaseEvery24Hours':'3d6','zeroMaximum':'dies-body-dust','ends':'remove-curse-or-other-magic','spellId':'phb2014:spell:remove-curse'}})
            fist['summaryIt']+=f' Inoltre {"6d6" if lord else "3d6"} necrotici; creatura TS Costituzione {dc} o maledizione: non recupera PF, massimo meno 3d6 ogni ventiquattro ore, zero muore in polvere; Rimuovi Maledizione/altra magia termina.'
            glare={'index':'dreadful-glare','nameIt':'Sguardo Terrificante','activation':'action','kind':'special','effect':{'target':'one-visible-creature-within-sixty-ft-that-can-see-mummy','magical':True,'saveAbility':'wisdom','saveDC':glare_dc,'failure':'frightened-until-end-mummy-next-turn','failureByFive':'also-paralyzed-same-duration','successImmunityHours':24,'successImmunityTo':'all-mummies-and-mummy-lords' if lord else 'all-mummies-not-mummy-lords'},'summaryIt':f'Visibile sessanta che può vederla, TS Saggezza {glare_dc}: paura fino fine prossimo turno della mummia, margine almeno cinque anche paralisi. Successo immune ventiquattro ore '+('a mummie e signori.' if lord else 'a tutte mummie, non signori.')}
            m['actions']=[{'index':'multiattack','nameIt':'Multiattacco','activation':'action','kind':'multiattack','effect':{'mayUseActionIndex':'dreadful-glare','attacks':[{'actionIndex':'rotting-fist','count':1}]},'summaryIt':'Può usare Sguardo e fa un Pugno Putrefacente.'},fist,glare];deps=['phb2014:spell:remove-curse']
            if lord:
                groups=[(0,0,'sacred-flame thaumaturgy'),(1,4,'command guiding-bolt shield-of-faith'),(2,3,'hold-person silence spiritual-weapon'),(3,3,'animate-dead dispel-magic'),(4,3,'divination guardian-of-faith'),(5,2,'contagion insect-plague'),(6,1,'harm')]
                spells=[{'level':lv,'slots':slots,'spellIds':['phb2014:spell:'+i for i in names.split()]} for lv,slots,names in groups];deps += [i for row in spells for i in row['spellIds']]
                m['traits'] += [trait('magic-resistance','Resistenza alla Magia',{'advantageSavesAgainst':['spells','other-magical-effects']},'Vantaggio TS magie ed effetti magici.'),trait('rejuvenation','Ringiovanimento',{'regainsBodyHours':24,'requires':'heart-intact','regainsAllHP':True,'newBodyWithinHeartFt':5,'heart':{'armorClass':5,'hitPoints':25,'immuneTo':'all-damage-except-fire'},'permanentDestruction':'burn-heart-to-ashes'},'Cuore intatto nuovo corpo entro cinque piedi dopo ventiquattro ore con tutti PF. Cuore CA cinque PF venticinque immune salvo fuoco; bruciarlo impedisce ritorno.'),trait('spellcasting','Incantesimi',{'class':'cleric','casterLevelInLocalPrinting':10,'castingAbility':'wisdom','spellSaveDC':17,'spellAttackBonus':9,'preparedSpellLevels':spells,'slotPolicy':'use-listed-stat-block-slots-not-regenerated-from-caster-level'},'Incantatore dieci dichiarato nella copia, Saggezza CD diciassette attacco nove. Slot effettivamente elencati quattro/tre/tre/tre/due/uno fino sesto conservati; non rigenerati dalla progressione PG.')]
                effects=[('attack','Attacco',1,{'chooseActionIndex':['rotting-fist','dreadful-glare']},'Un Pugno oppure Sguardo.'),('blinding-dust','Polvere Accecante',1,{'radiusFt':5,'saveAbility':'constitution','saveDC':16,'failure':'blinded-until-end-target-next-turn'},'Ogni creatura entro cinque TS Costituzione sedici o cieca fino fine suo prossimo turno.'),('blasphemous-word','Parola Blasfema',2,{'target':'non-undead-within-ten-ft-that-can-hear','saveAbility':'constitution','saveDC':16,'failure':'stunned-until-end-mummy-lord-next-turn'},'Non morti esclusi, chi sente entro dieci TS Costituzione sedici o stordito fino fine prossimo turno del signore.'),('channel-negative-energy','Canalizzare Energia Negativa',2,{'radiusFt':60,'includes':'behind-barriers-and-around-corners','effect':'cannot-regain-HP-until-end-mummy-lord-next-turn'},'Creature sessanta anche dietro barriere/angoli non recuperano PF fino fine prossimo turno del signore.'),('whirlwind-of-sand','Turbine di Sabbia',2,{'transform':'magical-sand-whirlwind-move-sixty-ft-then-revert','duringFormDamageImmunity':'all','duringFormConditionImmunities':['grappled','petrified','prone','restrained','stunned'],'equipment':'retained'},'Turbine magico muove sessanta e ritorna, beni conservati; durante forma immune danni e afferrato/pietrificato/prono/trattenuto/stordito.')]
                m['legendaryActions']=[{'index':i,'nameIt':name,'kind':'special','activation':'legendary-action','effect':{'legendaryActionCost':cost,**effect},'summaryIt':summary} for i,name,cost,effect,summary in effects]
                m['legendaryActionEconomy']={'maximum':3,'recovery':'start-of-own-turn','timing':'end-of-another-creature-turn','maximumOptionsPerOpportunity':1}
                m['lair']={'challengeRating':16,'experiencePoints':15000,'initiativeCount':20,'losesInitiativeTies':True,'cannotRepeatConsecutiveRounds':True,'actions':[
                  {'effect':{'targets':'each-undead-in-lair','until':'initiative-twenty-next-round','sense':'pinpoint-each-living-creature-within-one-hundred-twenty-ft'},'summaryIt':'Non morti nella tana localizzano viventi entro centoventi fino iniziativa venti prossimo round.'},
                  {'effect':{'targets':'each-undead-in-lair','until':'initiative-twenty-next-round','advantageSaves':'turn-undead-effects'},'summaryIt':'Non morti tana vantaggio TS contro scacciare fino venti prossimo round.'},
                  {'effect':{'until':'initiative-twenty-next-round','trigger':'non-undead-casts-spell-level-at-most-four-in-lair','mayChooseOtherAction':True,'saveAbility':'constitution','saveDC':16,'failure':'one-d-six-necrotic-per-spell-level-spell-wasted-no-effect'},'summaryIt':'Chi non è non morto tenta magia fino quarto in tana può cambiare azione, altrimenti TS Costituzione sedici o d6 necrotici per livello e magia sprecata senza effetto.'}]}
                m['regionalEffects']=[{'effect':{'food':'instantly-molders-in-lair','water':'instantly-evaporates','otherNonmagicalDrink':'spoils'},'summaryIt':'Cibo ammuffisce e acqua evapora subito nella tana, altre bevande non magiche guaste.','sourceIndex':0},{'effect':{'otherCreaturesDivinationInLair':'twenty-five-percent-misleading-DM','existingRepeatFailureChance':'plus-twenty-five-percent'},'summaryIt':'Divinazioni altrui in tana venticinque percento ingannevoli; probabilità già prevista di insuccesso ripetuto aumenta venticinque.','sourceIndex':0},{'effect':{'takesTreasure':'curse-disadvantage-all-saves-until-returned-or-remove-curse-other-magic'},'summaryIt':'Sottrarre tesoro maledice svantaggio ogni TS fino restituzione o Rimuovi Maledizione/altra magia.','sourceIndex':0}]
                m['regionalEffectsEnd']='immediately-on-mummy-lord-destruction'
        e=record('creature',index,index.replace('-',' ').title(),it,pages,m,it+': blocco MM distinto dagli effetti dell’oggetto che lo evoca. '+' '.join(t['summaryIt'] for t in m['traits']),book='mm')
        e['sources'][0].update(printedPages=[p-1 for p in pages],verification='read-local-render')
        if deps:e['relations']={'dependencyIds':deps}
        result.append(e)
    return result


def npc_records():
    rows=[('berserker','Berserker','any-chaotic',13,'hide-armor',67,'9d8+27',[16,12,17,9,11,9],{},{}),('bandit-captain','Capitano dei Banditi','any-nonlawful',15,'studded-leather',65,'10d8+20',[15,16,14,14,11,14],{'strength':4,'dexterity':5,'wisdom':2},{'athletics':4,'deception':4})]
    result=[]
    for index,it,alignment,ac,armor,hp,dice,abilities,saves,skills in rows:
        m={'size':'Medium','type':'humanoid','race':'any','alignment':alignment,'armorClass':{'value':ac,'source':armor},'hitPoints':{'average':hp,'dice':dice},'speedFt':{'walk':30},'abilities':dict(zip(ABILITIES,abilities,strict=True)),'savingThrowBonuses':saves,'skillBonuses':skills,'sensesFt':{},'passivePerception':10,'languages':[],'languageChoice':{'choose':1 if index=='berserker' else 2,'from':'any','usual':'common' if index=='berserker' else None},'challengeRating':2,'experiencePoints':450,'damageVulnerabilities':[],'damageResistances':[],'damageImmunities':[],'conditionImmunities':[],'traits':[],'actions':[],'reactions':[],'legendaryActions':[]}
        if index=='berserker':
            m['traits']=[trait('reckless','Avventato',{'choiceTiming':'start-own-turn','benefit':'advantage-all-melee-weapon-attacks-this-turn','cost':'attacks-against-it-advantage-until-start-own-next-turn'},'A inizio turno può scegliere vantaggio a tutti attacchi con armi da mischia del turno; attacchi contro di lui hanno vantaggio fino a inizio prossimo proprio turno.')]
            m['actions']=[attack(('greataxe','Ascia Bipenne',5,'one-target',9,'1d12+3','slashing'))]
        else:
            dagger=attack(('dagger','Pugnale',5,'one-target',5,'1d4+3','piercing'));dagger.update(kind='melee-or-ranged-weapon-attack',rangeFt={'normal':20,'long':60});dagger['summaryIt']+=' Anche a distanza gittata venti/sessanta.'
            m['actions']=[{'index':'multiattack','nameIt':'Multiattacco','kind':'multiattack','activation':'action','effect':{'attackAlternatives':[[{'actionIndex':'scimitar','count':2,'mode':'melee'},{'actionIndex':'dagger','count':1,'mode':'melee'}],[{'actionIndex':'dagger','count':2,'mode':'ranged'}]]},'summaryIt':'Due scimitarre e un pugnale in mischia oppure due pugnali a distanza.'},attack(('scimitar','Scimitarra',5,'one-target',6,'1d6+3','slashing')),dagger]
            m['reactions']=[{'index':'parry','nameIt':'Parata','kind':'special','activation':'reaction','effect':{'armorClassBonus':2,'against':'one-melee-attack-that-would-hit','requires':['see-attacker','wield-melee-weapon']},'summaryIt':'Reazione più due CA contro un attacco in mischia che colpirebbe, vedendo attaccante e impugnando arma da mischia.'}]
        e=record('creature',index,index.replace('-',' ').title(),it,345,m,'PNG umanoide di qualsiasi razza. '+('Tattica avventata distinta dai privilegi di classe del personaggio.' if index=='berserker' else 'Multiattacco e Parata propri, non livelli da guerriero.'),book='mm')
        e['sources'][0].update(printedPages=[344],verification='read-local-render');result.append(e)
    return result


def item_creatures():
    rows=[
      ('efreeti','Efreeti',146,'elemental','lawful-evil',17,True,200,'16d10+112',{'walk':40,'fly':60},[22,12,24,16,15,16],{'intelligence':7,'wisdom':6,'charisma':7},{},{'darkvision':120},12,['ignan'],11,7200),
      ('griffon','Grifone',175,'monstrosity','unaligned',12,False,59,'7d10+21',{'walk':30,'fly':80},[18,15,16,2,13,8],{},{'perception':5},{'darkvision':60},15,[],2,450),
      ('nightmare','Incubo',236,'fiend','neutral-evil',13,True,68,'8d10+24',{'walk':60,'fly':90},[18,15,16,10,13,15],{},{},{},11,[],3,700),
      ('roc','Roc',261,'monstrosity','unaligned',15,True,248,'16d20+80',{'walk':20,'fly':120},[28,10,20,3,10,9],{'dexterity':4,'constitution':9,'wisdom':4,'charisma':3},{'perception':4},{},14,[],11,7200),
      ('djinni','Djinni',145,'elemental','chaotic-good',17,True,161,'14d10+84',{'walk':30,'fly':90},[21,15,22,15,16,20],{'dexterity':6,'wisdom':7,'charisma':9},{},{'darkvision':120},13,['auran'],11,7200),
    ]
    result=[]
    for index,it,page,ctype,alignment,ac,natural,hp,dice,speed,abilities,saves,skills,senses,passive,languages,cr,xp in rows:
        m={'size':'Large','type':ctype,'alignment':alignment,'armorClass':{'value':ac,'source':'natural-armor' if natural else 'unspecified'},'hitPoints':{'average':hp,'dice':dice},'speedFt':speed,'abilities':dict(zip(ABILITIES,abilities,strict=True)),'savingThrowBonuses':saves,'skillBonuses':skills,'sensesFt':senses,'passivePerception':passive,'languages':languages,'challengeRating':cr,'experiencePoints':xp,'damageVulnerabilities':[],'damageResistances':[],'damageImmunities':['fire'] if index!='griffon' else [],'conditionImmunities':[],'traits':[],'actions':[],'reactions':[],'legendaryActions':[]}
        missing=[];deps=[]
        if index=='djinni':
            m['damageImmunities']=['lightning','thunder']
            ids=lambda names:['phb2014:spell:'+i for i in names.split()]
            at_will=ids('detect-evil-and-good detect-magic thunderwave');three=ids('create-food-and-water tongues wind-walk');one=ids('conjure-elemental creation gaseous-form invisibility major-image plane-shift');deps=at_will+three+one
            m['traits']=[trait('elemental-demise','Morte Elementale',{'onDeath':'body-disintegrates-warm-breeze-only-worn-carried-equipment-remains'},'Alla morte diventa brezza calda, lasciando beni indossati o portati.'),trait('innate-spellcasting','Incantesimi Innati',{'castingAbility':'charisma','spellSaveDC':17,'spellAttackBonus':9,'materialComponentsRequired':False,'atWillSpellIds':at_will,'threePerDayEachSpellIds':three,'oncePerDayEachSpellIds':one,'createFoodAndWaterMayMake':'wine-instead-of-water','conjureElementalRestriction':'air-only'},'Carisma, CD diciassette e attacco più nove, senza materiali. Tre magie a volontà, tre ciascuna tre al giorno e sei ciascuna una al giorno. Crea vino invece acqua, evoca solo aria.')]
            sword=attack(('scimitar','Scimitarra',9,'one-target',12,'2d6+5','slashing'),{'additionalDamage':{'average':3,'dice':'1d6','typeChoice':['lightning','thunder'],'chosenBy':'djinni'}});sword['summaryIt']+=' Inoltre d6 fulmine o tuono scelto dal djinni.'
            m['actions']=[{'index':'multiattack','nameIt':'Multiattacco','kind':'multiattack','activation':'action','effect':{'attacks':[{'actionIndex':'scimitar','count':3}]},'summaryIt':'Tre attacchi di Scimitarra.'},sword,{'index':'create-whirlwind','nameIt':'Creare Turbine','kind':'special','activation':'action','effect':{'magical':True,'radiusFt':5,'heightFt':30,'point':'visible-within-one-hundred-twenty-ft','concentrationRequired':True,'duration':'while-concentrating-and-visible-no-maximum-stated','entersExceptDjinni':{'saveAbility':'strength','saveDC':18,'failure':'restrained'},'move':'action-up-to-sixty-ft-carries-restrained-creatures','freeCreature':{'activation':'action','target':'self-or-other-restrained-creature','ability':'strength','checkDC':18,'success':'no-longer-restrained-moves-nearest-outside-space'},'ends':'djinni-loses-sight-or-concentration'},'summaryIt':'Azione turbine magico raggio cinque alto trenta su punto visibile entro centoventi. Concentrazione e vista necessarie; chi entra salvo djinni TS Forza diciotto o trattenuto. Azione muove sessanta trascinando trattenuti; azione prova Forza diciotto libera sé o altro nel più vicino spazio esterno.'}]
            m['optionalVariants']=[{'nameIt':'Poteri dei Geni','requiresDMApproval':True,'effect':{'automaticFromRing':False,'disguises':'DM-may-grant-Disguise-Self-at-will-or-True-Polymorph-one-to-three-times-per-day-self-usually-longer-duration','wishes':{'only':'most-potent-genies-DM-specific','numberChoice':[1,2,3],'target':'nongenie-within-sixty-ft','spellId':'phb2014:spell:wish','recovery':'DM-time-usually-one-year','limitPerTargetLifetime':'same-genie-can-expend-limit-on-same-creature-once-ever','genieMayPervertWording':True}}}]
        if index=='roc':
            m['size']='Gargantuan';m['damageImmunities']=[]
            m['traits']=[trait('keen-sight','Vista Acuta',{'advantageChecks':'wisdom-perception-relying-on-sight'},'Vantaggio a Percezione basata sulla vista.')]
            beak=attack(('beak','Becco',13,'one-target',27,'4d8+9','piercing'));beak['reachFt']=10;beak['summaryIt']='Becco più tredici, portata dieci, 27 (4d8 più nove) perforanti.'
            talons=attack(('talons','Artigli',13,'one-target',23,'4d6+9','slashing'),{'onHit':'grappled','escapeDC':19,'whileGrappled':'restrained','untilEnds':'cannot-use-talons-against-another-target'});talons['summaryIt']+=' Colpito afferrato, fuga diciannove e trattenuto; non può usare artigli contro altro bersaglio finché non termina.'
            m['actions']=[{'index':'multiattack','nameIt':'Multiattacco','kind':'multiattack','activation':'action','effect':{'attacks':[{'actionIndex':'beak','count':1},{'actionIndex':'talons','count':1}]},'summaryIt':'Un Becco e un attacco Artigli.'},beak,talons]
        if index=='griffon':
            m['traits']=[trait('keen-sight','Vista Acuta',{'advantageChecks':'wisdom-perception-relying-on-sight'},'Vantaggio a Percezione che dipende dalla vista.')]
            m['actions']=[{'index':'multiattack','nameIt':'Multiattacco','kind':'multiattack','activation':'action','effect':{'attacks':[{'actionIndex':'beak','count':1},{'actionIndex':'claws','count':1}]},'summaryIt':'Un attacco col becco e uno con gli artigli.'},attack(('beak','Becco',6,'one-target',8,'1d8+4','piercing')),attack(('claws','Artigli',6,'one-target',11,'2d6+4','slashing'))]
        if index=='nightmare':
            m.update(understandsAdditionalLanguages=['abyssal','common','infernal'],cannotSpeakAdditionalLanguages=True)
            m['traits']=[trait('confer-fire-resistance','Conferire Resistenza al Fuoco',{'canGrantResistanceTo':'anyone-riding-it','damageType':'fire'},'Può concedere resistenza al fuoco a chi lo cavalca.'),trait('illumination','Illuminazione',{'brightRadiusFt':10,'additionalDimFt':10},'Luce intensa dieci piedi e fioca per altri dieci.')]
            hoof=attack(('hooves','Zoccoli',6,'one-target',13,'2d8+4','bludgeoning'),{'extraDamage':{'average':7,'dice':'2d6','type':'fire'}});hoof['summaryIt']+=' Inoltre 2d6 fuoco.'
            m['actions']=[hoof,{'index':'ethereal-stride','nameIt':'Passo Etereo','kind':'special','activation':'action','effect':{'targets':'self-and-up-to-three-willing-creatures-within-five-ft','travel':'Material-to-Ethereal-or-vice-versa'},'summaryIt':'Azione: sé e fino a tre consenzienti entro cinque piedi passano dal Materiale all’Etereo o viceversa.'}]
        if index=='efreeti':
            ids=lambda names:['phb2014:spell:'+i for i in names.split()]
            at_will=ids('detect-magic');three=ids('enlarge-reduce tongues');one=ids('conjure-elemental gaseous-form invisibility major-image plane-shift wall-of-fire');deps=at_will+three+one
            m['traits']=[trait('elemental-demise','Morte Elementale',{'onDeath':'body-fire-and-smoke-disintegration-only-worn-carried-equipment-remains'},'Morendo corpo si disperde in fuoco e fumo, lasciando soltanto equipaggiamento portato.'),trait('innate-spellcasting','Incantesimi Innati',{'castingAbility':'charisma','spellSaveDC':15,'spellAttackBonus':7,'materialComponentsRequired':False,'atWillSpellIds':at_will,'threePerDaySpellIds':three,'threePerDayEachInLocalPrinting':False,'oncePerDayEachSpellIds':one,'conjureElementalRestriction':'fire-elemental-only'},'Carisma, CD quindici e attacco più sette, nessun materiale. Individuazione del Magico a volontà; Ingrandire/Ridurre e Linguaggi tre volte al giorno, senza «ciascuno» nella copia locale; altre sei magie una al giorno ciascuna, evocazione solo fuoco.')]
            missing=['innateSpellcasting.threePerDayUsageScope']
            sword=attack(('scimitar','Scimitarra',10,'one-target',13,'2d6+6','slashing'),{'extraDamage':{'average':7,'dice':'2d6','type':'fire'}});sword['summaryIt']+=' Inoltre 2d6 fuoco.'
            flame={'index':'hurl-flame','nameIt':'Lanciare Fiamma','kind':'ranged-spell-attack','activation':'action','attackBonus':7,'rangeFt':{'normal':120,'long':120},'target':'one-target','damage':{'average':17,'dice':'5d6','type':'fire'},'effect':{},'summaryIt':'Attacco magico a distanza più sette, centoventi piedi, 5d6 fuoco.'}
            m['actions']=[{'index':'multiattack','nameIt':'Multiattacco','kind':'multiattack','activation':'action','effect':{'attackAlternatives':[[{'actionIndex':'scimitar','count':2}],[{'actionIndex':'hurl-flame','count':2}]]},'summaryIt':'Due attacchi di scimitarra oppure due Lanciare Fiamma.'},sword,flame]
        e=record('creature',index,index.title(),it,page,m,f'{it}: Grande, CA {ac}, {hp} PF, GS {cr}. '+' '.join(t['summaryIt'] for t in m['traits'])+' '+' '.join(a['summaryIt'] for a in m['actions']),book='mm',missing=missing)
        e['sources'][0].update(printedPages=[page-1],verification='read-local-render')
        if deps:e['relations']={'spellIds':deps}
        e['reviewScope']='individual-stat-block; summoned-by-reviewed-item'
        result.append(e)
    return result


def swarm_records():
    rows=[
      ('bats','Pipistrelli',338,12,False,22,'5d8',{'walk':0,'fly':30},[5,15,10,2,12,4],{},{'blindsight':60},11,.25,50,4,5,'2d4',2,'1d4','one-creature-in-swarm-space'),
      ('insects','Insetti',339,12,True,22,'5d8',{'walk':20,'climb':20},[3,13,10,1,7,1],{},{'blindsight':10},8,.5,100,3,10,'4d4',5,'2d4','one-target-in-swarm-space'),
      ('poisonous-snakes','Serpenti Velenosi',339,14,False,36,'8d8',{'walk':30,'swim':30},[8,18,11,1,10,3],{},{'blindsight':10},10,2,450,6,7,'2d6',3,'1d6','one-creature-in-swarm-space'),
      ('quippers','Quipper',339,13,False,28,'8d8-8',{'walk':0,'swim':40},[13,16,9,1,7,2],{},{'darkvision':60},8,1,200,5,14,'4d6',7,'2d6','one-creature-in-swarm-space'),
      ('rats','Topi',340,10,False,24,'7d8-7',{'walk':30},[9,11,9,2,10,3],{},{'darkvision':30},10,.25,50,2,7,'2d6',3,'1d6','one-target-in-swarm-space'),
      ('ravens','Corvi',340,12,False,24,'7d8-7',{'walk':10,'fly':50},[6,14,8,3,12,6],{'perception':5},{},15,.25,50,4,7,'2d6',3,'1d6','one-target-in-swarm-space'),
    ]
    result=[]
    for index,it,page,ac,natural,hp,dice,speed,abilities,skills,senses,passive,cr,xp,bonus,avg,damage,lowavg,lowdice,target in rows:
        a=attack(('beaks' if index=='ravens' else 'bites','Becchi' if index=='ravens' else 'Morsi',bonus,'one-creature' if target.startswith('one-creature') else 'one-target',avg,damage,'piercing'))
        a['reachFt']=0;a['effect']={'requiresTarget':target,'atHalfHPOrFewerDamage':{'average':lowavg,'dice':lowdice,'type':'piercing'}}
        a['summaryIt']=f'Attacco più {bonus}, portata zero: bersaglio nello spazio dello sciame; {damage} perforanti, {lowdice} se PF non superiori alla metà.'
        if index=='poisonous-snakes':
            a['effect']['additionalDamageSave']={'ability':'constitution','dc':10,'failedDamage':{'average':14,'dice':'4d6','type':'poison'},'successDamage':'half','unchangedWhenSwarmAtHalfHP':True}
            a['summaryIt']+=' Anche TS Costituzione dieci contro 4d6 veleno, metà se riuscito, senza riduzione quando lo sciame è ferito.'
        parent={'bats':'bat','quippers':'quipper','rats':'rat'}.get(index)
        traits=copy.deepcopy(TRAITS[parent]) if parent else []
        traits.append(trait('swarm','Sciame',{'mayOccupyOtherCreatureSpaceAndViceVersa':True,'mayPassOpeningsFor':'Tiny-member-creature','canRegainHP':False,'canGainTemporaryHP':False},'Occupa lo spazio di altre creature e viceversa, passa aperture per un suo membro Minuscolo, non recupera PF né riceve PF temporanei.'))
        m={'size':'Medium','type':'beast','isSwarm':True,'swarmMemberSize':'Tiny','alignment':'unaligned','armorClass':{'value':ac,'source':'natural-armor' if natural else 'unspecified'},'hitPoints':{'average':hp,'dice':dice},'speedFt':speed,'abilities':dict(zip(ABILITIES,abilities,strict=True)),'savingThrowBonuses':{},'skillBonuses':skills,'sensesFt':senses,'passivePerception':passive,'languages':[],'challengeRating':cr,'experiencePoints':xp,'damageVulnerabilities':[],'damageResistances':['bludgeoning','piercing','slashing'],'damageImmunities':[],'conditionImmunities':['charmed','frightened','paralyzed','petrified','prone','restrained','stunned'],'traits':traits,'actions':[a],'reactions':[],'legendaryActions':[]}
        if index=='insects':
            m['optionalVariants']=[{'requiresDMApproval':True,'nameIt':'Scarabei','effect':{'burrowSpeedFt':5}},{'requiresDMApproval':True,'nameIt':'Centopiedi','effect':{'targetReducedToZeroHP':'stable-poisoned-one-hour-even-after-regaining-HP; paralyzed-while-poisoned-this-way'}},{'requiresDMApproval':True,'nameIt':'Ragni','effect':{'additionalTraits':copy.deepcopy(TRAITS['spider'])}},{'requiresDMApproval':True,'nameIt':'Vespe','effect':{'walkSpeedFt':5,'flySpeedFt':30,'removeClimbSpeed':True}}]
        e=record('creature','swarm-of-'+index,'Swarm of '+index.replace('-',' ').title(),'Sciame di '+it,page,m,'Sciame, distinto da una singola bestia. '+' '.join(t['summaryIt'] for t in traits)+(' Quattro varianti facoltative di insetti conservate separatamente.' if index=='insects' else ''),book='mm')
        e['sources'][0].update(printedPages=[page-1],verification='read-local-render')
        e['interpretations'].append({'field':'wildShapeSelection','kind':'unsupported-automatic-group-form','method':'A swarm of Tiny beasts is not represented as one individual beast; automatic Wild Shape selection remains unsupported rather than inventing a general transformation ruling.'})
        result.append(e)
    return result
    return entities


def artifact_creatures():
    """Six explicit dependencies of sentient items/artifacts; MM text and renders checked."""
    rows=[
      ('shadow','Ombra',270,'Medium','undead','chaotic-evil',12,16,'3d8+3',{'walk':40},[6,14,13,6,10,8],{}, {'stealth':4},{'darkvision':60},10,[],.5,100),
      ('skeleton','Scheletro',273,'Medium','undead','lawful-evil',13,13,'2d8+4',{'walk':30},[10,14,15,6,8,5],{},{},{'darkvision':60},9,[],.25,50),
      ('zombie','Zombi',317,'Medium','undead','neutral-evil',8,22,'3d8+9',{'walk':20},[13,6,16,3,6,5],{'wisdom':0},{},{'darkvision':60},8,[],.25,50),
      ('wight','Wight',301,'Medium','undead','neutral-evil',14,45,'6d8+18',{'walk':30},[15,14,16,10,13,15],{}, {'perception':3,'stealth':4},{'darkvision':60},13,[],3,700),
      ('death-slaad','Slaad della Morte',279,'Medium','aberration','chaotic-evil',18,170,'20d8+80',{'walk':30},[20,15,19,15,10,16],{}, {'arcana':6,'perception':8},{'blindsight':60,'darkvision':60},18,['slaad'],10,5900),
      ('empyrean','Empireo',131,'Huge','celestial','chaotic-good',22,313,'19d12+190',{'walk':50,'fly':50,'swim':50},[30,21,30,21,22,27],{'strength':17,'intelligence':12,'wisdom':13,'charisma':15},{'insight':13,'persuasion':15},{'truesight':120},16,['all'],23,32500),
    ]
    result=[]
    for index,it,page,size,ctype,alignment,ac,hp,dice,speed,abilities,saves,skills,senses,passive,languages,cr,xp in rows:
        m={'size':size,'type':ctype,'alignment':alignment,'armorClass':{'value':ac,'source':'natural-armor' if index in ['death-slaad','empyrean'] else 'studded-leather' if index=='wight' else 'armor-scraps' if index=='skeleton' else 'unspecified'},'hitPoints':{'average':hp,'dice':dice},'speedFt':speed,'abilities':dict(zip(ABILITIES,abilities,strict=True)),'savingThrowBonuses':saves,'skillBonuses':skills,'sensesFt':senses,'passivePerception':passive,'languages':languages,'challengeRating':cr,'experiencePoints':xp,'damageVulnerabilities':[],'damageResistances':[],'damageImmunities':[],'conditionImmunities':[],'traits':[],'actions':[],'reactions':[],'legendaryActions':[]}
        deps=[];pages=[page]
        if ctype=='undead':
            m['traits']=[trait('undead-nature','Natura Non Morta',{'doesNotRequire':['air','food','drink','sleep']},'Non richiede aria, cibo, bevande o sonno.')]
            m['damageImmunities']=['poison'];m['conditionImmunities']=['exhaustion','poisoned'];m['languageOrigin']='languages-known-in-life'
        if index=='shadow':
            m.update(damageVulnerabilities=['radiant'],damageResistances=['acid','cold','fire','lightning','thunder'],damageImmunities=['necrotic','poison'],conditionImmunities=['exhaustion','frightened','grappled','paralyzed','petrified','poisoned','prone','restrained']);m.pop('languageOrigin')
            m['conditionalDamageResistances']=[{'types':['bludgeoning','piercing','slashing'],'condition':'nonmagical-weapons'}]
            m['traits'] += [trait('amorphous','Amorfo',{'minimumSpaceWidthInches':1,'requiresSqueezing':False},'Passa in un pollice senza stringersi.'),trait('shadow-stealth','Furtività d’Ombra',{'hideActivation':'bonus-action','requires':'dim-light-or-darkness','stealthBonusInTheseConditions':6},'In luce fioca o buio Nascondersi è bonus e Furtività più sei.'),trait('sunlight-weakness','Debolezza alla Luce Solare',{'while':'sunlight','disadvantage':['attack-rolls','ability-checks','saving-throws']},'Sole dà svantaggio a tiri di attacco, prove e TS.')]
            m['actions']=[attack(('strength-drain','Risucchio di Forza',4,'one-creature',9,'2d6+2','necrotic'),{'strengthReduction':'1d4','diesAtStrength':0,'otherwiseEnds':'short-or-long-rest','ifNonEvilHumanoidSlain':'new-shadow-after-one-d-four-hours'})]
            m['actions'][0]['summaryIt']+=' Forza meno d4, zero muore; riposo breve/lungo termina. Umanoide non malvagio ucciso genera ombra dopo d4 ore.'
        if index=='skeleton':
            m.update(damageVulnerabilities=['bludgeoning'],cannotSpeak=True,understandsLanguagesOnly=True)
            bow=attack(('shortbow','Arco Corto',4,'one-target',5,'1d6+2','piercing'));bow.update(kind='ranged-weapon-attack',rangeFt={'normal':80,'long':320});bow.pop('reachFt')
            m['actions']=[attack(('shortsword','Spada Corta',4,'one-target',5,'1d6+2','piercing')),bow]
        if index=='zombie':
            pages=[316,317];m.update(conditionImmunities=['poisoned'],cannotSpeak=True,understandsLanguagesOnly=True)
            m['traits'].append(trait('undead-fortitude','Tenacia Non Morta',{'trigger':'damage-reduces-to-zero-HP','exceptions':['radiant-damage','critical-hit'],'saveAbility':'constitution','saveDC':'5+damage-taken','successHP':1},'Ridotto a zero, salvo radiante o critico, TS Costituzione cinque più danno subito lascia un PF.'))
            m['actions']=[attack(('slam','Schianto',3,'one-target',4,'1d6+1','bludgeoning'))]
        if index=='wight':
            m['damageResistances']=['necrotic'];m['conditionalDamageResistances']=[{'types':['bludgeoning','piercing','slashing'],'condition':'nonmagical-weapons-not-silvered'}]
            m['traits'].append(trait('sunlight-sensitivity','Sensibilità alla Luce Solare',{'while':'sunlight','disadvantage':['attack-rolls','wisdom-perception-sight-checks']},'Sole: svantaggio attacchi e Percezione basata sulla vista.'))
            drain=attack(('life-drain','Risucchio di Vita',4,'one-creature',5,'1d6+2','necrotic'),{'saveAbility':'constitution','saveDC':13,'failure':'maximum-HP-reduced-by-damage-taken','ends':'long-rest','diesAtMaximumHP':0,'slainHumanoid':{'creatureId':'mm2014:creature:zombie','delayHours':24,'unless':['restored-to-life','body-destroyed'],'controller':'wight','maximumControlled':12}});drain['summaryIt']+=' TS Costituzione tredici o massimo PF ridotto del danno fino a riposo lungo; zero massimo uccide. Umanoide ucciso risorge zombi dopo ventiquattro ore salvo corpo distrutto/resurrezione, massimo dodici controllati.'
            sword=attack(('longsword','Spada Lunga',4,'one-target',6,'1d8+2','slashing'),{'twoHandedDamage':{'average':7,'dice':'1d10+2','type':'slashing'}})
            bow=attack(('longbow','Arco Lungo',4,'one-target',6,'1d8+2','piercing'));bow.update(kind='ranged-weapon-attack',rangeFt={'normal':150,'long':600});bow.pop('reachFt')
            m['actions']=[{'index':'multiattack','nameIt':'Multiattacco','activation':'action','kind':'multiattack','effect':{'attackAlternatives':[[{'actionIndex':'longsword','count':2}],[{'actionIndex':'longbow','count':2}]],'mayReplaceOneLongsword':'life-drain'},'summaryIt':'Due spade lunghe o due archi lunghi; solo una spada sostituibile da Risucchio.'},drain,sword,bow];deps=['mm2014:creature:zombie']
        if index in ['death-slaad','empyrean']:
            m['traits'] += [trait('magic-resistance','Resistenza alla Magia',{'advantageSavingThrowsAgainst':['spells','other-magical-effects']},'Vantaggio TS contro magie ed effetti magici.'),trait('magic-weapons','Armi Magiche',{'weaponAttacks':'magical'},'Attacchi con armi magici.')]
            at_will=['detect-magic','detect-thoughts','invisibility','mage-hand','major-image'] if index=='death-slaad' else ['greater-restoration','pass-without-trace','water-breathing','water-walk']
            two=['fear','fireball','fly','tongues'] if index=='death-slaad' else []
            one=['cloudkill','plane-shift'] if index=='death-slaad' else ['commune','dispel-evil-and-good','earthquake','fire-storm','plane-shift']
            spells=lambda names:['phb2014:spell:'+s for s in names]
            deps=spells(at_will+two+one)
            m['traits'].append(trait('innate-spellcasting','Incantesimi Innati',{'castingAbility':'charisma','spellSaveDC':15 if index=='death-slaad' else 23,'spellAttackBonus':7 if index=='death-slaad' else 15,'componentsNotRequired':['M'],'atWillSpellIds':spells(at_will),'twicePerDayEachSpellIds':spells(two),'oncePerDayEachSpellIds':spells(one),'selfOnlySpellIds':spells(['invisibility'] if index=='death-slaad' else ['plane-shift'])},'Incantesimi innati con Carisma, senza materiali; gruppi a volontà e giornalieri indipendenti, bersagli personali dove indicato.'))
        if index=='death-slaad':
            pages=[275,279];m.update(creatureTags=['shapechanger'],damageResistances=['acid','cold','fire','lightning','thunder'],telepathyFt=60)
            m['traits'] += [trait('shapechanger','Mutaforma',{'activation':'action','forms':['Small-humanoid','Medium-humanoid','true-form'],'onlyStatisticChanged':'size','equipment':'unchanged','onDeath':'revert'},'Azione cambia in umanoide Piccolo/Medio o torna; solo taglia muta, equipaggiamento no, morte torna.'),trait('regeneration','Rigenerazione',{'startOwnTurnRegainsHP':10,'requiresHPAtLeast':1},'Inizio turno recupera dieci PF se ne ha almeno uno.')]
            m['actions']=[{'index':'multiattack','nameIt':'Multiattacco','activation':'action','kind':'multiattack','effect':{'attacks':[{'actionIndex':'bite','count':1}],'remainingAttacks':{'count':2,'eachActionIndexChoice':['claws','greatsword']}},'summaryIt':'Un morso e due attacchi a scelta tra artigli e spadone.'}]
            for i,itn,avg,dmg,typ in [('bite','Morso',9,'1d8+5','piercing'),('claws','Artigli',10,'1d10+5','slashing'),('greatsword','Spadone',12,'2d6+5','slashing')]:
                action=attack((i,itn,9,'one-target',avg,dmg,typ),{'extraDamage':{'average':7,'dice':'2d6','type':'necrotic'},**({'requires':'slaad-form'} if i!='greatsword' else {})});action['summaryIt']+=' Inoltre 2d6 necrotici; morso/artigli solo forma slaad.';m['actions'].append(action)
            gem={'requiresDMApproval':True,'gemPresentIfAny':['born-from-spawning-stone','later-contacts-spawning-stone'],'bornElsewhereWithoutContact':'no-control-gem','requires':'control-gem-implanted-in-brain','control':'obeys-gem-possessor-and-immune-charmed-while-controlled','gemDestroyed':'no-longer-controlled-this-way','acquisition':{'failedImprisonmentSave':'gem-transfers-to-casters-open-hand-instead-of-imprisoning','wishInPresence':'can-request-gem','greaterRestoration':'destroys-gem-without-harming-slaad','medicine':{'requires':['wisdom-medicine-proficiency','incapacitated-slaad'],'uninterruptedMinutes':1,'DC':20,'failureDamage':{'average':22,'dice':'4d10','type':'psychic'}}},'summaryIt':'Variante: gemma in cervello impone obbedienza e immunità charme mentre controllato. Imprigionamento fallito trasferisce invece gemma, Desiderio presente può ottenerla, Ristorare Superiore distrugge senza danno. Medico competente su incapacitato: minuto, Medicina venti; fallire 4d10 psichici.'}
            m['optionalVariants']=[{'requiresDMApproval':True,'nameIt':'Gemma di Controllo','effect':gem}];deps+=spells(['imprisonment','wish','greater-restoration'])
        if index=='empyrean':
            m.update(creatureTags=['titan'],alignmentAlternatives=[{'alignment':'chaotic-good','percent':75},{'alignment':'neutral-evil','percent':25}]);m['conditionalDamageImmunities']=[{'types':['bludgeoning','piercing','slashing'],'condition':'nonmagical-weapons'}]
            m['traits'].append(trait('legendary-resistance','Resistenza Leggendaria',{'uses':3,'recovery':'long-rest','trigger':'failed-saving-throw','effect':'choose-success'},'Tre volte per riposo lungo può scegliere successo al posto di TS fallito.'))
            maul=attack(('maul','Maglio',17,'one-target',31,'6d6+10','bludgeoning'),{'creatureSave':{'ability':'constitution','dc':15,'failure':'stunned-until-end-empyrean-next-turn'}});maul['reachFt']=10;maul['summaryIt']+=' Portata dieci, creatura TS Costituzione quindici o stordita fino fine prossimo turno empireo.'
            m['actions']=[maul,{'index':'bolt','nameIt':'Dardo','activation':'action','kind':'ranged-spell-attack','attackBonus':15,'rangeFt':{'normal':600,'long':600},'target':'one-target','damage':{'average':24,'dice':'7d6','typeChoice':['acid','cold','fire','force','lightning','radiant','thunder']},'effect':{'damageTypeChosenBy':'empyrean'},'summaryIt':'Dardo magico più quindici entro seicento; 7d6 del tipo scelto fra sette.'}]
            m['legendaryActionEconomy']={'maximum':3,'recovery':'start-of-own-turn','timing':'end-of-another-creature-turn','maximumOptionsPerOpportunity':1}
            m['legendaryActions']=[{'index':'attack','nameIt':'Attacco','activation':'legendary-action','kind':'special','effect':{'legendaryActionCost':1,'makesAttacks':1},'summaryIt':'Un attacco, anche Dardo.'},{'index':'bolster','nameIt':'Incoraggiare','activation':'legendary-action','kind':'special','effect':{'legendaryActionCost':1,'targets':'all-nonhostile-creatures-within-one-hundred-twenty-ft','duration':'until-end-empyrean-next-turn','cannotBe':['charmed','frightened'],'advantage':['ability-checks','saving-throws']},'summaryIt':'Non ostili centoventi: niente charme/paura, vantaggio prove e TS fino fine prossimo turno empireo.'},{'index':'trembling-strike','nameIt':'Colpo Tremante','activation':'legendary-action','kind':'special','effect':{'legendaryActionCost':2,'targets':'all-other-creatures-on-ground-within-sixty-ft','saveAbility':'strength','saveDC':25,'failure':'prone'},'summaryIt':'Due azioni, altre creature a terra sessanta TS Forza venticinque o prone.'}]
        e=record('creature',index,index.replace('-',' ').title(),it,pages,m,it+': statistiche originali distinte dalle eccezioni del singolo artefatto. '+' '.join(t['summaryIt'] for t in m['traits']),book='mm');e['sources'][0].update(printedPages=[p-1 for p in pages],verification='read-local-render');e['reviewScope']='individual-stat-block-complete; full-MM-inventory-pending'
        if deps:e['relations']={'dependencyIds':sorted(set(deps))}
        result.append(e)
    return result


def mephit_records():
    """Six minor elementals, MM PDF 216–218; base and optional summons separate."""
    rows=[
      ('dust','Polvere',216,12,17,'5d6',30,[5,14,10,9,11,10],{'perception':2,'stealth':4},12,['auran','terran'],.5,100,['fire'],['poison'],'sleep'),
      ('ice','Ghiaccio',216,11,21,'6d6',30,[7,13,10,9,11,12],{'perception':2,'stealth':3},12,['aquan','auran'],.5,100,['bludgeoning','fire'],['cold','poison'],'fog-cloud'),
      ('magma','Magma',217,11,22,'5d6+5',30,[8,12,12,7,10,10],{'stealth':3},10,['ignan','terran'],.5,100,['cold'],['fire','poison'],'heat-metal'),
      ('mud','Fango',217,11,27,'6d6+6',20,[8,12,12,9,11,7],{'stealth':3},10,['aquan','terran'],.25,50,[],['poison'],None),
      ('smoke','Fumo',218,12,22,'5d6+5',30,[6,14,12,10,10,11],{'perception':2,'stealth':4},12,['auran','ignan'],.25,50,[],['fire','poison'],'dancing-lights'),
      ('steam','Vapore',218,10,21,'6d6',30,[5,11,10,11,10,12],{},10,['aquan','ignan'],.25,50,[],['fire','poison'],'blur'),
    ]
    result=[]
    for kind,it,page,ac,hp,hpdice,speed,abilities,skills,passive,languages,cr,xp,vul,imm,spell in rows:
        traits=[trait('elemental-nature','Natura Elementale',{'doesNotRequire':['food','drink','sleep']},'Non necessita di cibo, bevande o sonno; il passaggio non esenta dall’aria.')]
        burst={'trigger':'death','targets':'each-creature-within-five-ft','radiusFt':5}
        if kind=='dust':
            burst.update(save={'ability':'constitution','dc':10},failureCondition='blinded',durationMinutes=1,
                         repeatSaveWhen='on-each-own-turn-not-specified-as-start-or-end',successfulRepeatEnds=True)
            burst_it='Morendo entro cinque piedi TS Costituzione dieci o accecato un minuto; ripete in ciascun proprio turno, senza imporre fine turno.'
        elif kind in ['ice','magma','steam']:
            dice,average,damage,dc={'ice':('1d8',4,'slashing',10),'magma':('2d6',7,'fire',11),'steam':('1d8',4,'fire',10)}[kind]
            burst.update(save={'ability':'dexterity','dc':dc},failureDamage={'dice':dice,'average':average,'type':damage},successDamage='none' if kind=='steam' else 'half')
            burst_it=f'Morendo entro cinque piedi TS Destrezza {dc}, {dice} '+('taglienti' if kind=='ice' else 'fuoco')+('; successo nessun danno.' if kind=='steam' else '; successo metà danni.')
        elif kind=='mud':
            burst.update(maximumTargetSize='Medium',save={'ability':'dexterity','dc':11},failureCondition='restrained',expires='end-of-target-next-turn')
            burst_it='Morendo, creature Medie o minori entro cinque piedi TS Destrezza undici o trattenute fino fine loro turno successivo.'
        else:
            burst={'trigger':'death','center':'own-space','shape':'sphere','radiusFt':5,'area':'heavily-obscured','durationMinutes':1,'endsEarlier':'dispersed-by-wind'}
            burst_it='Morendo crea sfera di fumo raggio cinque piedi pesantemente oscurata per un minuto, dispersa prima dal vento.'
        traits.append(trait('death-burst','Esplosione alla Morte',burst,burst_it))
        if kind in ['ice','magma','mud']:
            appearance={'ice':'ordinary-shard-of-ice','magma':'ordinary-mound-of-magma','mud':'ordinary-mound-of-mud'}[kind]
            traits.append(trait('false-appearance','Falso Aspetto',{'while':'motionless','indistinguishableFrom':appearance},'Immobile indistinguibile da '+{'ice':'un comune frammento di ghiaccio.','magma':'un comune ammasso di magma.','mud':'un comune ammasso di fango.'}[kind]))
        if spell:
            innate={'castingAbility':'charisma','materialComponentsRequired':False,'oncePerDayEachSpellIds':['phb2014:spell:'+spell]}
            if kind=='magma':innate['spellSaveDC']=10
            traits.append(trait('innate-spellcasting','Incantesimi Innati',innate,'Una magia innata al giorno, Carisma e senza materiali: '+{'sleep':'Sonno','fog-cloud':'Nube di Nebbia','heat-metal':'Riscaldare il Metallo, CD dieci','dancing-lights':'Luci Danzanti','blur':'Sfocatura'}[spell]+'.'))
        bonus,average,damage_dice,damage_type={'dust':(4,4,'1d4+2','slashing'),'ice':(3,3,'1d4+1','slashing'),'magma':(3,3,'1d4+1','slashing'),'mud':(3,4,'1d6+1','bludgeoning'),'smoke':(4,4,'1d4+2','slashing'),'steam':(2,2,'1d4','slashing')}[kind]
        a=attack(('fists' if kind=='mud' else 'claws','Pugni' if kind=='mud' else 'Artigli',bonus,'one-creature',average,damage_dice,damage_type))
        if kind in ['ice','magma','steam']:
            a['effect']={'extraDamage':{'dice':'1d4','average':2,'type':'cold' if kind=='ice' else 'fire'}}
            a['summaryIt']+=' Anche d4 freddo.' if kind=='ice' else ' Anche d4 fuoco.'
        breath={'recharge':{'d6Minimum':6,'when':'start-of-own-turn','alsoRecovery':['short-rest','long-rest']},'maximumUses':1,'save':{'ability':'dexterity','dc':11 if kind in ['magma','mud'] else 10}}
        if kind=='mud':
            breath.update(target='one-creature-within-five-ft',rangeFt=5,maximumTargetSize='Medium',failureCondition='restrained',durationMinutes=1,repeatSaveWhen='end-of-each-own-turn',successfulRepeatEnds=True)
            summary='Un bersaglio entro cinque piedi, se Medio o minore TS Destrezza undici o trattenuto un minuto; ripete a fine ciascun turno.'
        else:
            breath.update(shape='cone',lengthFt=15,targets='each-creature-in-area')
            if kind in ['dust','smoke']:
                breath['failureCondition']='blinded'
                if kind=='dust':breath.update(durationMinutes=1,repeatSaveWhen='end-of-each-own-turn',successfulRepeatEnds=True)
                else:breath['expires']='end-of-mephit-next-turn'
                summary='Cono quindici piedi, TS Destrezza dieci o accecato '+('un minuto, ripete a fine ciascun turno.' if kind=='dust' else 'fino fine turno successivo del mephit, nessuna ripetizione indicata.')
            else:
                dice,avg,typ={'ice':('2d4',5,'cold'),'magma':('2d6',7,'fire'),'steam':('1d8',4,'fire')}[kind]
                breath.update(failureDamage={'dice':dice,'average':avg,'type':typ},successDamage='half')
                summary=f'Cono quindici piedi, TS Destrezza {breath["save"]["dc"]}, {dice} '+('freddo' if typ=='cold' else 'fuoco')+', metà se riuscito.'
        b={'index':'breath','nameIt':'Soffio','activation':'action','kind':'special','effect':breath,'summaryIt':summary+' Ricarica sei.'}
        m={'size':'Small','type':'elemental','alignment':'neutral-evil','armorClass':{'value':ac,'source':'unspecified'},'hitPoints':{'average':hp,'dice':hpdice},
           'speedFt':{'walk':speed,'fly':speed,**({'swim':20} if kind=='mud' else {})},'abilities':dict(zip(ABILITIES,abilities,strict=True)),
           'savingThrowBonuses':{},'skillBonuses':skills,'sensesFt':{'darkvision':60},'passivePerception':passive,'languages':languages,
           'challengeRating':cr,'experiencePoints':xp,'damageVulnerabilities':vul,'damageResistances':[],'damageImmunities':imm,'conditionImmunities':['poisoned'],
           'traits':traits,'actions':[a,b],'reactions':[],'legendaryActions':[],
           'optionalVariants':[{'requiresDMApproval':True,'nameIt':'Evocazione di Mephit','effect':{'addsAction':{'activation':'action','uses':1,'recovery':'long-rest','successChancePercent':25,
              'quantityDice':'1d4','creatureId':'mm2014:creature:'+kind+'-mephit','appearIn':'unoccupied-space-within-sixty-ft','rangeFt':60,'attitude':'summoner-ally',
              'summonedByThisActionCannotSummon':True,'durationMinutes':1,'endsEarlier':['summoned-creature-dies','summoner-dies','summoner-action-dismiss']}}}]}
        e=record('creature',kind+'-mephit',kind.title()+' Mephit','Mephit del '+it,[page,216,218] if page!=216 else [216,218],m,
                 'Piccolo elementale: '+burst_it+' '+summary+' Evocazione aggiuntiva solo variante del DM; probabilità venticinque per cento, d4 dello stesso tipo, niente catena di ulteriori evocazioni.',book='mm')
        e['sources'][0].update(printedPages=[p-1 for p in e['sources'][0]['pdfPages']],verification='read-local-render')
        e['sources'].append(source(12,'Limited Usage and Recharge',book='mm'))
        e['sources'][-1]['printedPages']=[11]
        e['fieldSources']['optionalVariants']=[0,1];e['fieldSources']['traits']=[0,1]
        e['reviewScope']='individual-stat-block-complete; full-MM-inventory-pending'
        if spell:e['relations']={'spellIds':['phb2014:spell:'+spell],'dependencyIds':['phb2014:spell:'+spell]}
        result.append(e)
    return result


def minor_elemental_records():
    """Azer, gargoyle and magmin: remaining standard MM minor-elemental forms."""
    rows=[
      ('azer','Azer',23,'Medium','lawful-neutral',17,39,'6d8+12',{'walk':30},[17,12,15,12,13,10],{'constitution':4},{},11,['ignan'],2,450),
      ('gargoyle','Gargoyle',141,'Medium','chaotic-evil',15,52,'7d8+21',{'walk':30,'fly':60},[15,11,16,6,11,7],{},{'darkvision':60},10,['terran'],2,450),
      ('magmin','Magmin',213,'Small','chaotic-neutral',14,9,'2d6+2',{'walk':30},[7,15,12,8,11,10],{},{'darkvision':60},10,['ignan'],.5,100),
    ]
    result=[]
    for index,it,page,size,alignment,ac,hp,hpdice,speed,abilities,saves,senses,passive,languages,cr,xp in rows:
        m={'size':size,'type':'elemental','alignment':alignment,'armorClass':{'value':ac,'source':'natural-armor'},'hitPoints':{'average':hp,'dice':hpdice},
           'speedFt':speed,'abilities':dict(zip(ABILITIES,abilities,strict=True)),'savingThrowBonuses':saves,'skillBonuses':{},'sensesFt':senses,'passivePerception':passive,'languages':languages,
           'challengeRating':cr,'experiencePoints':xp,'damageVulnerabilities':[],'damageResistances':[],'damageImmunities':[],'conditionImmunities':[],
           'traits':[],'actions':[],'reactions':[],'legendaryActions':[]}
        if index=='azer':
            m['armorClass']['shieldIncluded']=True
            m['damageImmunities']=['fire','poison'];m['conditionImmunities']=['poisoned']
            m['traits']=[
              trait('heated-body','Corpo Arroventato',{'triggerAny':['creature-touches-azer','creature-hits-azer-with-melee-attack-while-within-five-ft'],'damage':{'average':5,'dice':'1d10','type':'fire'}},'Tocco o attacco da mischia che colpisce da entro cinque piedi infligge d10 fuoco alla creatura.'),
              trait('heated-weapons','Armi Arroventate',{'when':'hits-with-metal-melee-weapon','extraDamage':{'average':3,'dice':'1d6','type':'fire'},'includedInListedAttack':True},'Colpire con arma metallica da mischia aggiunge d6 fuoco, già compreso nel martello.'),
              trait('illumination','Illuminazione',{'brightRadiusFt':10,'additionalDimFt':10},'Luce intensa dieci piedi e altri dieci fioca.'),
              trait('living-fire','Fuoco Vivente',{'doesNotRequire':['food','drink','sleep']},'Non necessita cibo, bevande o sonno.')]
            m['actions']=[attack(('warhammer','Martello da Guerra',5,'one-target',7,'1d8+3','bludgeoning'),{'twoHandedDamage':{'average':8,'dice':'1d10+3','type':'bludgeoning'},'extraDamage':{'average':3,'dice':'1d6','type':'fire'}})]
            m['actions'][0]['summaryIt']+=' A due mani d10 più tre, sempre altri d6 fuoco. La CA indicata include lo scudo.'
        elif index=='gargoyle':
            m['conditionalDamageResistances']=[{'types':['bludgeoning','piercing','slashing'],'condition':'nonmagical-weapons-not-adamantine'}]
            m['damageImmunities']=['poison'];m['conditionImmunities']=['exhaustion','petrified','poisoned']
            m['traits']=[trait('false-appearance','Falso Aspetto',{'while':'motionless','indistinguishableFrom':'inanimate-statue'},'Immobile indistinguibile da statua inanimata.'),trait('elemental-nature','Natura Elementale',{'doesNotRequire':['air','food','drink','sleep']},'Non necessita aria, cibo, bevande o sonno.')]
            m['actions']=[{'index':'multiattack','nameIt':'Multiattacco','activation':'action','kind':'multiattack','effect':{'attacks':[{'actionIndex':'bite','count':1},{'actionIndex':'claws','count':1}]},'summaryIt':'Un morso e un attacco artigli.'},attack(('bite','Morso',4,'one-target',5,'1d6+2','piercing')),attack(('claws','Artigli',4,'one-target',5,'1d6+2','slashing'))]
        else:
            m['conditionalDamageResistances']=[{'types':['bludgeoning','piercing','slashing'],'condition':'nonmagical-weapons'}]
            m['damageImmunities']=['fire']
            m['traits']=[trait('death-burst','Esplosione alla Morte',{'trigger':'death','radiusFt':10,'targets':'each-creature-in-area','save':{'ability':'dexterity','dc':11},'failureDamage':{'average':7,'dice':'2d6','type':'fire'},'successDamage':'half','ignites':'flammable-objects-not-worn-or-carried-in-area'},'Morendo entro dieci piedi TS Destrezza undici, 2d6 fuoco metà se riuscito; incendia oggetti infiammabili non portati/indossati.'),trait('ignited-illumination','Illuminazione Incendiata',{'activation':'bonus-action','choose':['ignite-own-flames','extinguish-own-flames'],'whileAblaze':{'brightRadiusFt':10,'additionalDimFt':10}},'Bonus accende o spegne proprie fiamme; se acceso luce intensa dieci piedi più dieci fioca.')]
            m['actions']=[attack(('touch','Tocco',4,'one-target',7,'2d6','fire'),{'ignites':'target-creature-or-flammable-object','ongoingBurn':{'when':'end-of-each-target-turn','damageSubjectInLocalPrinting':'creature','damage':{'average':3,'dice':'1d6','type':'fire'},'ends':'any-creature-action-douse-fire','objectTurnResolution':'not-defined-by-this-stat-block-DM-adjudication'}})]
            m['actions'][0]['summaryIt']+=' Incendia creatura od oggetto infiammabile; creatura subisce d6 fuoco a fine ciascun turno finché una creatura usa azione per spegnere.'
        e=record('creature',index,index.title(),it,page,m,it+': '+ ' '.join(t['summaryIt'] for t in m['traits'])+' '+ ' '.join(a['summaryIt'] for a in m['actions']),book='mm')
        e['sources'][0].update(printedPages=[page-1],verification='read-local-render');e['reviewScope']='individual-stat-block-complete; full-MM-inventory-pending'
        result.append(e)
    return result


def celestial_records():
    """Couatl/Pegasus, MM PDF 44/251; unicorn is already reviewed separately."""
    rows=[
      ('couatl','Couatl',44,'Medium','lawful-good',19,True,97,'13d8+39',{'walk':30,'fly':90},[16,20,17,18,20,18],{'constitution':5,'wisdom':7,'charisma':6},{},{'truesight':120},15,['all'],4,1100),
      ('pegasus','Pegaso',251,'Large','chaotic-good',12,False,59,'7d10+21',{'walk':60,'fly':90},[18,15,16,10,15,13],{'dexterity':4,'wisdom':4,'charisma':3},{'perception':6},{},16,['celestial','common','elvish','sylvan'],2,450),
    ]
    result=[]
    for index,it,page,size,alignment,ac,natural,hp,hpdice,speed,abilities,saves,skills,senses,passive,languages,cr,xp in rows:
        m={'size':size,'type':'celestial','alignment':alignment,'armorClass':{'value':ac,'source':'natural-armor' if natural else 'unspecified'},
           'hitPoints':{'average':hp,'dice':hpdice},'speedFt':speed,'abilities':dict(zip(ABILITIES,abilities,strict=True)),'savingThrowBonuses':saves,'skillBonuses':skills,
           'sensesFt':senses,'passivePerception':passive,'languages':languages,'challengeRating':cr,'experiencePoints':xp,'damageVulnerabilities':[],'damageResistances':[],
           'damageImmunities':[],'conditionImmunities':[],'traits':[],'actions':[],'reactions':[],'legendaryActions':[]}
        if index=='pegasus':
            m.update(understandsLanguagesOnly=True,cannotSpeak=True)
            m['traits']=[trait('natural-mount-bond','Legame Volontario della Cavalcatura',{'naturalMountBond':{'requires':'persuaded-to-serve-good-aligned-creature','taming':'cannot-be-traditionally-broken-and-tamed','duration':'lifelong-bond'},'notAutomaticSpellGrantedMount':True},'Intelligente, non addomesticato con metodi ordinari; può essere persuaso a servire creatura buona, formando legame duraturo. Non aggiunge una forma automatica a Trova Cavalcatura.')]
            m['actions']=[attack(('hooves','Zoccoli',6,'one-target',11,'2d6+4','bludgeoning'))]
            deps=[]
        else:
            def ids(text):return ['phb2014:spell:'+i for i in text.split()]
            at=ids('detect-evil-and-good detect-magic detect-thoughts')
            three=ids('bless create-food-and-water cure-wounds lesser-restoration protection-from-poison sanctuary shield')
            once=ids('dream greater-restoration scrying');deps=at+three+once
            m.update(telepathyFt=120,damageResistances=['radiant'],damageImmunities=['psychic'],conditionalDamageImmunities=[{'types':['bludgeoning','piercing','slashing'],'condition':'nonmagical-weapons'}])
            m['traits']=[
              trait('innate-spellcasting','Incantesimi Innati',{'castingAbility':'charisma','spellSaveDC':14,'verbalComponentsRequired':True,'somaticComponentsRequired':False,'materialComponentsRequired':False,'atWillSpellIds':at,'threePerDayEachSpellIds':three,'oncePerDayEachSpellIds':once},'Carisma CD quattordici, solo componenti verbali. Tre magie a volontà, sette ciascuna tre al giorno, tre ciascuna una al giorno.'),
              trait('magic-weapons','Armi Magiche',{'weaponAttacksMagical':True},'Gli attacchi con arma sono magici.'),
              trait('shielded-mind','Mente Protetta',{'immuneTo':['scrying','effects-sensing-emotions','effects-reading-thoughts','effects-detecting-location']},'Immune scrutamento ed effetti che percepiscono emozioni, leggono pensieri o individuano posizione.'),
              trait('truth-teller','Portatore di Verità',{'canLie':False,'may':['withhold-information','answer-vaguely','allow-others-wrong-conclusions'],'purpose':'protect-something-keep-promises-or-hide-existence'},'Non può mentire; può tacere, essere vago o lasciare conclusioni errate per protezione, promesse o segretezza.'),
              trait('ancient-and-few','Antico e Raro',{'canSurviveWithoutAir':True,'canLiveForAgesWithoutSustenance':True,'canDieFrom':['disease','passage-of-time'],'canSenseItsEndUpToYearsBefore':100,'cannotSense':'manner-of-demise'},'Sopravvive senza aria o nutrimento; può morire di malattia o tempo e percepire avvicinarsi della fine fino a un secolo prima, senza conoscerne il modo.'),
            ]
            bite=attack(('bite','Morso',8,'one-creature',8,'1d6+5','piercing'),{'save':{'ability':'constitution','dc':13},'failedCondition':'poisoned','poisonDurationHours':24,'unconsciousUntil':'poison-ends-or-another-creature-action-shakes-target-awake','damageAutomaticallyWakes':False})
            bite['summaryIt']+=' TS Costituzione tredici o avvelenato ventiquattro ore; privo di sensi finché veleno finisce oppure un’altra creatura usa azione per scuoterlo e svegliarlo. Il danno non è indicato come risveglio.'
            constrict=attack(('constrict','Stritolare',6,'one-Medium-or-smaller-creature',10,'2d6+3','bludgeoning'),{'grapple':{'escapeDC':15,'condition':'restrained'},'cannotConstrictAnotherUntil':'grapple-ends'})
            constrict['reachFt']=10;constrict['summaryIt']='Attacco più sei, portata dieci piedi, solo Medio o minore: 2d6 più tre contundenti, afferrato CD quindici e trattenuto; nessun altro stritolamento finché dura.'
            shape={'index':'change-shape','nameIt':'Cambiare Forma','activation':'action','kind':'special','effect':{
              'magical':True,'forms':{'types':['humanoid','beast'],'maximumCR':'own-CR'},'canReturnToTrueForm':True,'death':'revert-to-true-form',
              'equipment':'absorbed-or-borne-by-new-form-couatl-choice','retains':'own-statistics-and-speech-except-explicit-replacements',
              'replacedStatistics':['armor-class','movement-modes','strength','dexterity','other-actions'],
              'gainsNewFormStatisticsAndCapabilities':'only-those-it-lacks','excludedNewFormCapabilities':['class-features','legendary-actions','lair-actions'],
              'mayUseOwnBiteInNewFormIf':'new-form-has-bite-attack'},'summaryIt':'Azione forma umanoide o bestia GS non superiore al proprio, o ritorna; morte ripristina. Equipaggiamento assorbito o portato a scelta. Mantiene statistiche e parola salvo CA, movimenti, Forza, Destrezza e altre azioni della nuova forma; acquisisce capacità mancanti escluse classi, leggendarie e tana. Se nuova forma ha morso può usare proprio morso.'}
            m['actions']=[bite,constrict,shape]
        e=record('creature',index,index.title(),it,page,m,it+': '+ ' '.join(t['summaryIt'] for t in m['traits'])+' '+ ' '.join(a['summaryIt'] for a in m['actions']),book='mm')
        e['sources'][0].update(printedPages=[page-1],verification='read-local-render');e['reviewScope']='individual-stat-block-complete; full-MM-inventory-pending'
        if deps:e['relations']={'spellIds':deps,'dependencyIds':deps}
        result.append(e)
    return result


def woodland_records():
    """Four fey forms; sprite is already present. MM PDF 122/254/268/319."""
    rows=[
      ('blink-dog','Cane Intermittente',319,'Medium','lawful-good',13,22,'4d8+4',{'walk':40},[12,17,12,10,13,11],{'perception':3,'stealth':5},{},13,['blink-dog'],.25,50),
      ('dryad','Driade',122,'Medium','neutral',11,22,'5d8',{'walk':30},[10,12,11,14,15,18],{'perception':4,'stealth':5},{'darkvision':60},14,['elvish','sylvan'],1,200),
      ('pixie','Pixie',254,'Tiny','neutral-good',15,1,'1d4-1',{'walk':10,'fly':30},[2,20,8,10,14,15],{'perception':4,'stealth':7},{},14,['sylvan'],.25,50),
      ('satyr','Satiro',268,'Medium','chaotic-neutral',14,31,'7d8',{'walk':40},[12,16,11,12,10,14],{'perception':2,'performance':6,'stealth':5},{},12,['common','elvish','sylvan'],.5,100),
    ]
    result=[]
    for index,it,page,size,alignment,ac,hp,hpdice,speed,abilities,skills,senses,passive,languages,cr,xp in rows:
        m={'size':size,'type':'fey','alignment':alignment,'armorClass':{'value':ac,'source':'leather-armor' if index=='satyr' else 'unspecified'},'hitPoints':{'average':hp,'dice':hpdice},
           'speedFt':speed,'abilities':dict(zip(ABILITIES,abilities,strict=True)),'savingThrowBonuses':{},'skillBonuses':skills,'sensesFt':senses,'passivePerception':passive,'languages':languages,
           'challengeRating':cr,'experiencePoints':xp,'damageVulnerabilities':[],'damageResistances':[],'damageImmunities':[],'conditionImmunities':[],'traits':[],'actions':[],'reactions':[],'legendaryActions':[]}
        deps=[]
        if index!='blink-dog':m['traits'].append(trait('magic-resistance','Resistenza alla Magia',{'savingThrowAdvantageAgainst':['spells','other-magical-effects']},'Vantaggio TS contro incantesimi ed effetti magici.'))
        if index=='blink-dog':
            m.update(understandsAdditionalLanguages=['sylvan'],cannotSpeakAdditionalLanguages=True)
            m['traits']=[trait('keen-hearing-and-smell','Udito e Olfatto Acuti',{'advantageSkill':'perception','reliesOnAny':['hearing','smell']},'Vantaggio Percezione che dipende da udito od olfatto.')]
            m['actions']=[attack(('bite','Morso',3,'one-target',4,'1d6+1','piercing')),
              {'index':'teleport','nameIt':'Teletrasporto','activation':'action','kind':'special','effect':{'magical':True,'recharge':{'d6Minimum':4,'when':'start-of-own-turn','alsoRecovery':['short-rest','long-rest']},'rangeFt':40,'destination':'visible-unoccupied-space','includes':'worn-and-carried-equipment','optionalAdditionalAttack':{'actionIndex':'bite','count':1,'whenChoice':['before-teleport','after-teleport'],'noAdditionalActionCost':True}},'summaryIt':'Azione, ricarica quattro–sei: teletrasporto fino quaranta piedi in spazio libero visibile con equipaggiamento; può effettuare un solo morso prima oppure dopo come parte della stessa azione.'}]
        elif index=='dryad':
            at=['phb2014:spell:druidcraft'];three=['phb2014:spell:entangle','phb2014:spell:goodberry'];once=['phb2014:spell:barkskin','phb2014:spell:pass-without-trace','phb2014:spell:shillelagh'];deps=at+three+once
            m['traits'] += [trait('innate-spellcasting','Incantesimi Innati',{'castingAbility':'charisma','spellSaveDC':14,'materialComponentsRequired':False,'atWillSpellIds':at,'threePerDayEachSpellIds':three,'oncePerDayEachSpellIds':once},'Carisma CD quattordici, senza materiali: Arte Druidica a volontà, Intralciare e Bacche Benefiche ciascuna tre al giorno; altre tre ciascuna una al giorno.'),
              trait('speak-with-beasts-and-plants','Parlare con Bestie e Piante',{'communicatesWithTypes':['beast','plant'],'asIf':'shared-language'},'Comunica con bestie e piante come avessero linguaggio comune.'),
              trait('tree-stride','Passo degli Alberi',{'usesPerOwnTurn':1,'movementCostFt':10,'entryTree':'living-within-reach','exitTree':'living-within-sixty-ft-of-first-tree','minimumBothTreeSize':'Large','destination':'unoccupied-space-within-five-ft-of-second-tree','activation':'part-of-movement-not-action-or-bonus-action'},'Una volta nel proprio turno spende dieci piedi di movimento: albero vivente a portata, altro vivente entro sessanta, entrambi Grandi o maggiori; esce libero entro cinque piedi.'),
              trait('barkskin-armor','Pelle Coriacea',{'whileSpellActiveId':'phb2014:spell:barkskin','armorClass':16},'CA undici, sedici con Pelle Coriacea attiva.'),
              trait('treebound','Legata all’Albero',{'healthyUnharmedHomeTree':'remains-youthful','homeTreeHarmed':'suffers','homeTreeDestroyed':'madness-type-not-stated'},'Albero sano conserva giovinezza; danneggiarlo la fa soffrire, distruggerlo provoca follia senza tabella specificata.')]
            m['actions']=[attack(('club','Randello',2,'one-target',2,'1d4','bludgeoning'),{'whileSpellActive':{'spellId':'phb2014:spell:shillelagh','attackBonus':6,'damage':{'average':8,'dice':'1d8+4','type':'bludgeoning'}}}),
              {'index':'fey-charm','nameIt':'Fascino Fatato','activation':'action','kind':'special','effect':{'targetTypes':['humanoid','beast'],'rangeFt':30,'requires':'dryad-sees-target-and-target-sees-dryad','save':{'ability':'wisdom','dc':14},'failureCondition':'charmed','magical':True,'behavior':'trusted-friend-to-heed-and-protect-most-favorable-reading-of-requests-actions','controlled':False,'repeatSaveOptionalWhen':'dryad-or-allies-do-anything-harmful-to-target','successfulSaveImmunityHours':24,'durationHours':24,'endsEarlier':['dryad-dies','dryad-and-target-on-different-planes','dryad-bonus-action-end','successful-repeat-save'],'maximumSimultaneously':{'humanoids':1,'beasts':3}},'summaryIt':'Azione un umanoide o bestia entro trenta, vista reciproca, TS Saggezza quattordici: ammaliato ventiquattro ore e amico fidato, senza controllo. Può ripetere se driade/alleati gli fanno qualcosa di nocivo; successo immunità ventiquattro ore. Finisce morte, piani diversi o bonus driade. Massimo un umanoide e tre bestie contemporaneamente.'}]
            m['actions'][0]['summaryIt']+=' Con Randello Incantato attivo attacco più sei, d8 più quattro contundenti.'
        elif index=='pixie':
            at=['phb2014:spell:druidcraft'];once=['phb2014:spell:'+s for s in 'confusion dancing-lights detect-evil-and-good detect-thoughts dispel-magic entangle fly phantasmal-force polymorph sleep'.split()];deps=at+once
            m['traits'].append(trait('innate-spellcasting','Incantesimi Innati',{'castingAbility':'charisma','spellSaveDC':12,'onlyRequiredComponent':'own-pixie-dust','verbalComponentsRequired':False,'somaticComponentsRequired':False,'materialComponent':'own-pixie-dust-not-a-generic-focus','materialComponentsRequired':True,'materialConsumptionStatus':'not-stated','atWillSpellIds':at,'oncePerDayEachSpellIds':once},'Carisma CD dodici, richiede solo propria polvere fatata, nessuna voce/gesto. Arte Druidica a volontà, dieci altre magie ciascuna una al giorno.'))
            m['actions']=[{'index':'superior-invisibility','nameIt':'Invisibilità Superiore','activation':'action','kind':'special','effect':{'magical':True,'condition':'invisible','ends':'concentration-ends-as-if-spell','includes':'worn-and-carried-equipment','attackOrCastingAutomaticallyEnds':False},'summaryIt':'Azione invisibile con equipaggiamento finché termina concentrazione come incantesimo; non usa bonus e non termina automaticamente attaccando o lanciando magie.'}]
        else:
            ram=attack(('ram','Incornata',3,'one-target',6,'2d4+1','bludgeoning'));sword=attack(('shortsword','Spada Corta',5,'one-target',6,'1d6+3','piercing'));bow=attack(('shortbow','Arco Corto',5,'one-target',6,'1d6+3','piercing'));bow.update(kind='ranged-weapon-attack',rangeFt={'normal':80,'long':320});bow.pop('reachFt');bow['summaryIt']='Attacco distanza più cinque, gittata ottanta/trecentoventi piedi, d6 più tre perforanti.'
            m['actions']=[ram,sword,bow]
            m['optionalVariants']=[{'requiresDMApproval':True,'nameIt':'Flauti del Satiro','effect':{'addsAction':{'activation':'action','magical':True,'requires':'possesses-special-panpipes','rangeFt':60,'targets':'each-creature-in-range-that-can-hear-pipes','unaffected':['other-satyrs','creatures-that-cannot-be-charmed'],'save':{'ability':'wisdom','dc':13},'repeatSaveWhen':'end-of-each-own-turn','successfulSaveOrEffectEndsImmunityHours':24,'durationMinutes':1,'choice':[
              {'type':'charming-melody','failureCondition':'charmed','endsEarlier':'satyr-or-companion-harms-target'},
              {'type':'frightening-strain','failureCondition':'frightened'},
              {'type':'gentle-lullaby','failureCondition':'unconscious','sleep':True,'endsEarlierAny':['target-takes-damage','anyone-action-shakes-awake']}]},'usuallyOneSatyrPerGroup':'advice-not-hard-limit'}}]
        e=record('creature',index,index.replace('-',' ').title(),it,page,m,it+': '+' '.join(t['summaryIt'] for t in m['traits'])+' '+' '.join(a['summaryIt'] for a in m['actions']),book='mm')
        if index=='satyr':e['summaryIt']+=' Flauti solo variante del DM: azione entro sessanta piedi e udito, TS Saggezza tredici, un minuto di fascino, paura o sonno. Altri satiri e immuni a fascino esclusi da tutti effetti. Ripete fine turno, successo o termine danno immunità ventiquattro ore. Fascino termina se satiro/compagni nuocciono; sonno termina danno o azione per svegliare.'
        e['sources'][0].update(printedPages=[page-1],verification='read-local-render');e['reviewScope']='individual-stat-block-complete; full-MM-inventory-pending'
        if deps:e['relations']={'spellIds':deps,'dependencyIds':deps}
        result.append(e)
    return result


def faerie_dragon_records():
    """Seven explicit age/color forms; dragons are not woodland-conjuration fey."""
    colors=[('red','Rosso',None,5,1,200,'dancing-lights mage-hand minor-illusion'),('orange','Arancione',6,10,1,200,'color-spray'),('yellow','Giallo',11,20,1,200,'mirror-image'),('green','Verde',21,30,2,450,'suggestion'),('blue','Blu',31,40,2,450,'major-image'),('indigo','Indaco',41,50,2,450,'hallucinatory-terrain'),('violet','Viola',51,None,2,450,'polymorph')]
    result=[];spells=[]
    for color,it,minimum,maximum,cr,xp,new_spells in colors:
        spells += ['phb2014:spell:'+i for i in new_spells.split()]
        m={'size':'Tiny','type':'dragon','alignment':'chaotic-good','armorClass':{'value':15,'source':'unspecified'},'hitPoints':{'average':14,'dice':'4d4+4'},
           'speedFt':{'walk':10,'fly':60},'abilities':dict(zip(ABILITIES,[3,20,13,14,12,16],strict=True)),'savingThrowBonuses':{},'skillBonuses':{'arcana':4,'perception':3,'stealth':7},
           'sensesFt':{'darkvision':60},'passivePerception':13,'languages':['draconic','sylvan'],'challengeRating':cr,'experiencePoints':xp,
           'damageVulnerabilities':[],'damageResistances':[],'damageImmunities':[],'conditionImmunities':[],
           'variantFamilyIndex':'faerie-dragon','ageColor':color,'ageRangeYears':{'minimum':minimum,'maximum':maximum},
           'traits':[
              trait('superior-invisibility','Invisibilità Superiore',{'activation':'bonus-action','magical':True,'condition':'invisible','ends':'concentration-ends-as-if-spell','includes':'worn-and-carried-equipment'},'Bonus invisibile con equipaggiamento finché termina concentrazione come incantesimo; nessun termine automatico per attacco.'),
              trait('limited-telepathy','Telepatia Limitata',{'rangeFt':60,'onlyTargets':'other-faerie-dragons','magical':True},'Telepatia sessanta piedi soltanto con altri draghi fatati.'),
              trait('magic-resistance','Resistenza alla Magia',{'savingThrowAdvantageAgainst':['spells','other-magical-effects']},'Vantaggio TS contro incantesimi ed effetti magici.'),
              trait('innate-spellcasting','Incantesimi Innati',{'castingAbility':'charisma','spellSaveDC':13,'materialComponentsRequired':False,'oncePerDayEachSpellIds':spells.copy(),'colorGainsCumulative':True},'Carisma CD tredici senza materiali; ciascuna magia una al giorno, quelle dei colori precedenti conservate.')],
           'actions':[attack(('bite','Morso',7,'one-creature',1,None,'piercing')),
              {'index':'euphoria-breath','nameIt':'Soffio di Euforia','activation':'action','kind':'special','effect':{'recharge':{'d6Minimum':5,'when':'start-of-own-turn','alsoRecovery':['short-rest','long-rest']},'rangeFt':5,'target':'one-creature','save':{'ability':'wisdom','dc':11},'durationMinutes':1,'failure':'no-reactions-and-roll-d6-start-of-each-own-turn','d6Rows':[
                {'low':1,'high':4,'actionAllowed':False,'bonusActionAllowed':False,'movement':'use-all-to-move-in-random-direction'},
                {'low':5,'high':6,'movementAllowed':False,'onlyPermittedTurnBehavior':'wisdom-save-DC-eleven-to-end-effect-on-success'}]},'summaryIt':'Ricarica cinque–sei, una creatura entro cinque piedi, TS Saggezza undici o un minuto senza reazioni. Inizio proprio turno d6: uno–quattro nessuna azione/bonus e tutto movimento casuale; cinque–sei immobile, unica attività TS Saggezza undici per terminarlo.'}],
           'reactions':[],'legendaryActions':[]}
        e=record('creature','faerie-dragon-'+color,'Faerie Dragon ('+color.title()+')','Drago Fatato '+it,134,m,'Drago, non folletto: variante per colore ed età. '+ ' '.join(t['summaryIt'] for t in m['traits'])+' '+m['actions'][1]['summaryIt'],book='mm')
        e['sources'][0].update(printedPages=[133],verification='read-local-render');e['relations']={'spellIds':spells.copy(),'dependencyIds':spells.copy()};e['reviewScope']='individual-age-color-stat-block-complete; full-MM-inventory-pending'
        result.append(e)
    return result


def hag_records():
    """Base hags are distinct from optional covens and their equipment, PDF 177–180."""
    rows=[
      ('green-hag','Megera Verde',178,'fey','neutral-evil',17,82,'11d8+33',{'walk':30},[18,12,16,13,14,14],{'arcana':3,'deception':4,'perception':4,'stealth':3},60,14,['common','draconic','sylvan'],3,700,5,1800),
      ('night-hag','Megera Notturna',179,'fiend','neutral-evil',17,112,'15d8+45',{'walk':30},[18,15,16,16,14,16],{'deception':7,'insight':6,'perception':6,'stealth':6},120,16,['abyssal','common','infernal','primordial'],5,1800,7,2900),
      ('sea-hag','Megera Marina',180,'fey','chaotic-evil',14,52,'7d8+21',{'walk':30,'swim':40},[16,13,16,12,12,13],{},60,11,['aquan','common','giant'],2,450,4,1100),
    ]
    result=[]
    def ids(text):return ['phb2014:spell:'+s for s in text.split()]
    for index,it,page,kind,alignment,ac,hp,hpdice,speed,abilities,skills,dark,passive,languages,cr,xp,coven_cr,coven_xp in rows:
        m={'size':'Medium','type':kind,'alignment':alignment,'armorClass':{'value':ac,'source':'natural-armor'},'hitPoints':{'average':hp,'dice':hpdice},
           'speedFt':speed,'abilities':dict(zip(ABILITIES,abilities,strict=True)),'savingThrowBonuses':{},'skillBonuses':skills,'sensesFt':{'darkvision':dark},'passivePerception':passive,'languages':languages,
           'challengeRating':cr,'experiencePoints':xp,'damageVulnerabilities':[],'damageResistances':[],'damageImmunities':[],'conditionImmunities':[],'traits':[],'actions':[],'reactions':[],'legendaryActions':[],
           'optionalVariants':[{'requiresDMApproval':True,'nameIt':'Congrega di Megere','effect':{'requiresMembershipIn':'mm2014:rule:hag-covens','challengeRating':coven_cr,'experiencePoints':coven_xp,'addsSharedSpellcasting':'only-while-all-three-members-within-thirty-ft','baseStatBonuses':'kept-as-listed-no-invented-proficiency-recalculation'}}]}
        deps=[]
        claw=attack(('claws','Artigli',5 if index=='sea-hag' else 6,'one-target',10 if index=='sea-hag' else 13,'2d6+3' if index=='sea-hag' else '2d8+4','slashing'))
        if index in ['green-hag','sea-hag']:
            m['traits'].append(trait('amphibious','Anfibia',{'breathe':['air','water']},'Respira aria e acqua.'))
            disguise={'index':'illusory-appearance','nameIt':'Aspetto Illusorio','activation':'action','kind':'special','effect':{'magical':True,'appearance':'another-creature-of-general-size-and-humanoid-shape','includes':'worn-and-carried-equipment','mustAppearUgly':index=='sea-hag','ends':['hag-bonus-action-end','hag-dies'],'physicalInspection':'illusion-fails','visualInspection':{'activation':'action','ability':'intelligence','skill':'investigation','dc':16 if index=='sea-hag' else 20}},'summaryIt':'Azione illusione di altra creatura della stessa taglia generale e forma umanoide, include equipaggiamento; megera marina resta brutta. Finisce bonus o morte, tocco smentisce, esame visivo azione Indagare '+('sedici.' if index=='sea-hag' else 'venti.')}
            m['actions']=[claw,disguise]
        if index=='green-hag':
            at=ids('dancing-lights minor-illusion vicious-mockery');deps=at
            m['traits'] += [trait('innate-spellcasting','Incantesimi Innati',{'castingAbility':'charisma','spellSaveDC':12,'materialComponentsRequired':False,'atWillSpellIds':at},'Carisma CD dodici, senza materiali; Luci Danzanti, Illusione Minore e Beffa Crudele a volontà.'),trait('mimicry','Imitazione',{'sounds':['animal-sounds','humanoid-voices'],'discernCheck':{'ability':'wisdom','skill':'insight','dc':14}},'Imita versi animali e voci umanoidi; Intuizione quattordici distingue imitazione.')]
            m['actions'].append({'index':'invisible-passage','nameIt':'Passaggio Invisibile','activation':'action','kind':'special','effect':{'magical':True,'condition':'invisible','ends':['attacks','casts-spell','concentration-ends-as-if-spell'],'includes':'worn-and-carried-equipment','leavesPhysicalEvidenceOfPassage':False,'trackingOnlyBy':'magic'},'summaryIt':'Azione invisibile con equipaggiamento fino attacco, lancio di magia o fine concentrazione; nessuna traccia fisica, tracciabile soltanto magicamente.'})
        elif index=='sea-hag':
            m['traits'].append(trait('horrific-appearance','Aspetto Orribile',{'trigger':'humanoid-starts-own-turn-within-thirty-ft-and-sees-true-form','rangeFt':30,'save':{'ability':'wisdom','dc':11},'failureCondition':'frightened','durationMinutes':1,'repeatSaveWhen':'end-of-each-own-turn','repeatDisadvantageIf':'hag-within-line-of-sight','successfulSaveOrEffectEndsImmunityHours':24,'avoidInitialSave':{'requiresNot':['surprised','sudden-revelation-of-hag-true-form'],'choose':'avert-eyes','attackDisadvantageAgainst':'hag','expires':'start-of-target-next-turn'}},'Umanoide inizio turno entro trenta vede forma vera: TS Saggezza undici o spaventato un minuto; ripete fine turno con svantaggio se megera in vista. Successo o termine immunità ventiquattro ore. Può distogliere occhi salvo sorpresa/apparizione improvvisa, svantaggio attacchi alla megera fino inizio proprio turno successivo.'))
            m['actions'].append({'index':'death-glare','nameIt':'Sguardo Mortale','activation':'action','kind':'special','effect':{'magical':True,'rangeFt':30,'target':'one-frightened-creature-not-necessarily-by-this-hag','requires':'hag-sees-target-and-target-sees-hag','save':{'ability':'wisdom','dc':11},'failure':'drop-to-zero-hit-points'},'summaryIt':'Azione creatura già spaventata, anche da altra fonte, entro trenta e vista reciproca: TS Saggezza undici o zero PF.'})
        else:
            at=ids('detect-magic magic-missile');two=ids('plane-shift ray-of-enfeeblement sleep');deps=at+two
            m.update(damageResistances=['cold','fire'],conditionalDamageResistances=[{'types':['bludgeoning','piercing','slashing'],'condition':'nonmagical-weapons-not-silvered'}],conditionImmunities=['charmed'])
            m['traits']=[trait('innate-spellcasting','Incantesimi Innati',{'castingAbility':'charisma','spellSaveDC':13,'spellAttackBonus':5,'materialComponentsRequired':False,'atWillSpellIds':at,'twoPerDayEachSpellIds':two,'planeShiftRestriction':'self-only'},'Prima stampa Carisma CD tredici, attacco più cinque, senza materiali; Individuazione Magico e Dardo Incantato a volontà, altre tre ciascuna due al giorno, Spostamento Planare solo sé.'),trait('magic-resistance','Resistenza alla Magia',{'savingThrowAdvantageAgainst':['spells','other-magical-effects']},'Vantaggio TS contro incantesimi ed effetti magici.')]
            claw['effect']={'requiresForm':'hag-true-form'};claw['summaryIt']+=' Solo forma vera di megera.'
            m['actions']=[claw,
              {'index':'change-shape','nameIt':'Cambiare Forma','activation':'action','kind':'special','effect':{'magical':True,'chooseForms':['Small-female-humanoid','Medium-female-humanoid','true-form'],'statistics':'same-in-each-form','equipmentTransforms':False,'death':'reverts-to-true-form'},'summaryIt':'Azione forma umanoide femminile Piccola o Media, oppure vera; statistiche identiche, equipaggiamento non trasformato, morte ripristina.'},
              {'index':'etherealness','nameIt':'Forma Eterea','activation':'action','kind':'special','effect':{'magical':True,'requires':'heartstone-in-possession','equipmentRuleId':'mm2014:rule:night-hag-items','travelBetweenPlanes':['material','ethereal']},'summaryIt':'Azione passa Materiale–Etereo o viceversa, richiede pietra del cuore posseduta.'},
              {'index':'nightmare-haunting','nameIt':'Tormento degli Incubi','activation':'action','kind':'special','effect':{'uses':1,'recovery':'long-rest','requires':'hag-on-Ethereal-magically-touches-sleeping-humanoid-on-Material','preventedBySpellIds':ids('protection-from-evil-and-good magic-circle'),'visionsWhileContactPersists':True,'minimumContactHours':1,'afterMinimum':'no-benefit-from-rest','maximumHPReduction':{'average':5,'dice':'1d10'},'atMaximumHPZero':'dies','evilTargetDeath':'soul-in-hag-own-crafted-soul-bag-if-capacity-available','soulBagRuleId':'mm2014:rule:night-hag-items','maximumHPReductionEnds':'greater-restoration-or-similar-magic','cureSpellId':'phb2014:spell:greater-restoration'},'summaryIt':'Una volta per riposo lungo: contatto magico dall’Etereo su umanoide dormiente nel Materiale, protezione Male/Bene o Cerchio Magico lo impediscono. Almeno un’ora di contatto nega benefici riposo e riduce massimo PF di d10. A zero muore, anima malvagia catturata nel proprio sacco secondo limiti. Ripristino Superiore o simile rimuove riduzione.'}]
            deps += ids('protection-from-evil-and-good magic-circle greater-restoration')
        e=record('creature',index,index.replace('-',' ').title(),it,[page,177,180] if page!=180 else [180,177],m,it+': '+' '.join(t['summaryIt'] for t in m['traits'])+' '+' '.join(a['summaryIt'] for a in m['actions'])+' Congrega e nuovo GS solo variante del DM, slot condivisi e non duplicati per membro.',book='mm')
        e['sources'][0].update(printedPages=[p-1 for p in e['sources'][0]['pdfPages']],verification='read-local-render');e['reviewScope']='individual-base-stat-block; optional-coven-separate; full-MM-inventory-pending'
        if deps:e['relations']={'spellIds':sorted(set(deps)),'dependencyIds':sorted(set(deps))}
        if index=='night-hag':
            e['relations']['dependencyIds'].append('mm2014:rule:night-hag-items')
            e['sources'].append(source(12,'Limited Usage',book='mm'));e['sources'][-1]['printedPages']=[11];e['fieldSources']['actions']=[0,1]
        result.append(e)
    return result


def hag_rules():
    coven_spells=[['identify','ray-of-sickness'],['hold-person','locate-object'],['bestow-curse','counterspell','lightning-bolt'],['phantasmal-killer','polymorph'],['contact-other-plane','scrying'],['eyebite']]
    levels=[{'spellLevel':i+1,'spellIds':['phb2014:spell:'+s for s in spells]} for i,spells in enumerate(coven_spells)]
    c=record('rule','hag-covens','Hag Covens','Congreghe di Megere',177,{
      'ruleType':'monster-variant','requiresDMApproval':True,'membersRequired':3,'memberTypesMayDiffer':True,'membersEqual':True,
      'sharedSpellcasting':{'requires':'all-three-members-within-thirty-ft-of-one-another','casterLevel':12,'spellClass':'wizard','castingAbility':'intelligence','saveDC':'12+own-Intelligence-modifier','attackBonus':'4+own-Intelligence-modifier','sharedSlots':[4,3,3,3,2,1,0,0,0],'slotPoolOwner':'whole-coven-not-each-member','spellLevels':levels,'components':'ordinary-spell-rules-no-innate-exemption','slotRecoveryAuthority':'not-stated-for-shared-coven-pool'},
      'hagEye':{'maximumPerCoven':1,'armorClass':10,'hitPoints':1,'darkvisionFt':60,'anyCovenMemberView':{'activation':'action','requires':'eye-on-same-plane'},'destroyed':{'eachMemberDamage':'3d10-psychic','eachMemberCondition':'blinded','conditionDurationHours':24},'creation':{'allThreeMembers':True,'durationHours':1,'mustNotBeBlinded':True,'anyOtherAction':'restart-ritual'}}},
      'Variante tre megere anche diverse: entro trenta piedi reciproci ciascuna lancia dodici magie con slot di un’unica riserva, non tre copie. Incantatrice dodici, Intelligenza, CD dodici più modificatore e attacco quattro più modificatore. Fonte non specifica chi recupera riserva condivisa al riposo: resta aperto. Un occhio CA dieci e un PF, scurovisione sessanta, azione osserva stesso piano; distruzione 3d10 psichici e accecamento ventiquattro ore per ciascuna. Creazione rituale un’ora delle tre non accecate, altre azioni fanno ricominciare.',book='mm',optional=True,missing=['sharedSpellcasting.slotRecoveryAuthority'])
    c['relations']={'dependencyIds':[s for lv in levels for s in lv['spellIds']],'potentialMemberIds':['mm2014:creature:green-hag','mm2014:creature:night-hag','mm2014:creature:sea-hag']}
    c['interpretations']=[{'field':'sharedSpellcasting.slotRecoveryAuthority','kind':'unresolved','method':'Shared pool is explicit, but this passage does not say which member’s rest restores that pool. Ordinary caster recovery does not establish a single shared-pool owner. Do not duplicate slots or pick a recovery authority automatically.'}]
    items=record('rule','night-hag-items','Night Hag Items','Oggetti della Megera Notturna',180,{'ruleType':'monster-equipment','rarity':'very-rare','craftedBy':'night-hag-for-herself','items':[
      {'index':'heartstone','nameIt':'Pietra del Cuore','craftingDays':30,'allowsNightHagEtherealness':'while-in-possession','touch':'cures-any-disease','touchActionCost':'not-stated','curesPoisonOrCurses':False},
      {'index':'soul-bag','nameIt':'Sacco delle Anime','craftingDays':7,'material':'humanoid-sacrifice-flesh','capacityEvilSouls':1,'captureOnlyBy':'night-hag-who-crafted-this-bag','captureTrigger':'evil-humanoid-dies-from-hag-nightmare-haunting'}]},
      'Due oggetti rarissimi che la megera deve creare: pietra del cuore trenta giorni, possesso consente Forma Eterea alla megera e tocco cura qualsiasi malattia senza estendere a veleni/maledizioni; costo d’azione non dichiarato. Sacco sette giorni e sacrificio umanoide, un’anima malvagia, solo creatrice cattura chi muore dal Tormento degli Incubi. Non sono ricette ordinarie DMG per personaggi.',book='mm')
    for e in [c,items]:e['sources'][0].update(printedPages=[p-1 for p in e['sources'][0]['pdfPages']],verification='read-local-render')
    return [c,items]


def higher_elemental_records():
    """MM PDF 140/193/266–267/300: inspected renders, ordinary forms only."""
    rows=[
      ('galeb-duhr','Galeb Duhr',140,'Medium','neutral',16,85,'9d8+45',15,[20,14,20,11,12,11],{}, {'darkvision':60,'tremorsense':60},11,6,2300),
      ('invisible-stalker','Cacciatore Invisibile',193,'Medium','neutral',14,104,'16d8+32',50,[16,19,14,10,15,11],{'perception':8,'stealth':10},{'darkvision':60},18,6,2300),
      ('fire-snake','Serpente di Fuoco',266,'Medium','neutral-evil',14,22,'5d8',30,[12,14,11,7,10,8],{},{'darkvision':60},10,1,200),
      ('salamander','Salamandra',267,'Large','neutral-evil',15,90,'12d10+24',30,[18,14,15,11,10,12],{},{'darkvision':60},10,5,1800),
      ('water-weird','Anomalia d’Acqua',300,'Large','neutral',13,58,'9d10+9',0,[17,16,13,11,10,10],{},{'blindsight':30},10,3,700),
    ]
    result=[]
    for index,it,page,size,alignment,ac,hp,hpdice,speed,abilities,skills,senses,passive,cr,xp in rows:
        fire=index in ['fire-snake','salamander']
        m={'size':size,'type':'elemental','alignment':alignment,'armorClass':{'value':ac,'source':'natural-armor' if index in ['galeb-duhr','fire-snake','salamander'] else 'unspecified'},
           'hitPoints':{'average':hp,'dice':hpdice},'speedFt':{'walk':speed},'abilities':dict(zip(ABILITIES,abilities,strict=True)),
           'savingThrowBonuses':{},'skillBonuses':skills,'sensesFt':senses,'passivePerception':passive,'languages':['ignan' if fire else 'terran' if index=='galeb-duhr' else 'auran' if index=='invisible-stalker' else 'aquan'],
           'challengeRating':cr,'experiencePoints':xp,'damageVulnerabilities':['cold'] if fire else [],'damageResistances':['fire'] if index=='water-weird' else [],
           'conditionalDamageResistances':[{'types':['bludgeoning','piercing','slashing'],'condition':'nonmagical-weapons'}],
           'damageImmunities':['fire'] if fire else ['poison'],'conditionImmunities':[],'traits':[],'actions':[],'reactions':[],'legendaryActions':[]}
        if index=='galeb-duhr':
            m['conditionImmunities']=['exhaustion','paralyzed','poisoned','petrified']
            m['traits']=[trait('false-appearance','Falso Aspetto',{'while':'motionless','indistinguishableFrom':'ordinary-boulder'},'Immobile indistinguibile da un masso.'),
              trait('rolling-movement','Rotolamento',{'speedFt':30,'downhillSpeedFt':60,'ordinarySpeedFt':15},'Velocità quindici piedi, trenta rotolando, sessanta rotolando in discesa.'),
              trait('rolling-charge','Carica Rotolante',{'requires':'roll-at-least-twenty-ft-straight-toward-target-and-hit-slam-same-turn','minimumDistanceFt':20,
                'extraDamage':{'average':7,'dice':'2d6','type':'bludgeoning'},'ifTargetCreature':{'save':{'ability':'strength','dc':16},'failureCondition':'prone'}},'Rotolando venti piedi in linea e colpendo schianto stesso turno aggiunge 2d6 contundenti; se creatura TS Forza sedici o prona.'),
              trait('stone-guardian','Guardiano di Pietra',{'doesNotAge':True,'requiresSustenance':False,'permanentlyBoundTo':'material-plane','returnsToEarthPlaneOnDeath':False},'Non invecchia né richiede sostentamento; resta legato al Materiale anche alla morte.')]
            m['actions']=[attack(('slam','Schianto',8,'one-target',12,'2d6+5','bludgeoning')),
              {'index':'animate-boulders','nameIt':'Animare Massi','activation':'action','kind':'special','effect':{'uses':1,'recovery':'long-rest','maximumBoulders':2,'requires':'visible-boulders-within-sixty-ft','rangeFt':60,
                'statisticsTemplateId':'mm2014:creature:galeb-duhr','overrides':{'abilities':{'intelligence':1,'charisma':1},'additionalConditionImmunities':['charmed','frightened'],'removeActionIndices':['animate-boulders']},
                'concentrationRequired':True,'maximumDurationMinutes':1},'summaryIt':'Una volta per riposo lungo anima fino due massi visibili sessanta piedi, concentrazione massimo un minuto. Stesse statistiche salvo Intelligenza/Carisma uno, immunità affascinato/spaventato, senza animare altri massi.'}]
        elif index=='invisible-stalker':
            m['speedFt'].update(fly=50);m['canHover']=True;m['understandsAdditionalLanguages']=['common'];m['cannotSpeakAdditionalLanguages']=True
            m['conditionImmunities']=['exhaustion','grappled','paralyzed','petrified','poisoned','prone','restrained','unconscious']
            m['traits']=[trait('invisibility','Invisibilità',{'condition':'invisible','endsOnAttack':False},'Sempre invisibile anche attaccando.'),
              trait('faultless-tracker','Segugio Infallibile',{'quarryAssignedBy':'summoner','samePlaneQuarryKnowledge':['direction','distance'],'summonerLocationKnown':True},'Conosce direzione e distanza della preda sullo stesso piano e la posizione dell’evocatore.'),
              trait('elemental-nature','Natura Elementale',{'doesNotRequire':['air','food','drink','sleep']},'Non necessita aria, cibo, bevande o sonno.'),
              trait('directed-hunter','Cacciatore Vincolato',{'taskMustBe':'hunt-and-slay-specific-creature-or-recover-object','otherAssignmentEndsBinding':True,'afterTask':'return-to-summoner-for-orders','ifSummonerDies':'vanish-after-current-task','longMissionRisk':'may-pervert-command-intent'},'Il vincolo descritto serve caccia o recupero di oggetti; altri incarichi lo liberano. Completa l’incarico prima di sparire se muore l’evocatore; ordini prolungati possono essere distorti.')]
            m['actions']=[{'index':'multiattack','nameIt':'Multiattacco','activation':'action','kind':'multiattack','effect':{'attacks':[{'actionIndex':'slam','count':2}]},'summaryIt':'Due schianti.'},attack(('slam','Schianto',6,'one-target',10,'2d6+3','bludgeoning'))]
        elif fire:
            dice,average=('1d6',3) if index=='fire-snake' else ('2d6',7)
            m['traits']=[trait('heated-body','Corpo Arroventato',{'triggerAny':['creature-touches-self','creature-hits-self-with-melee-attack-while-within-five-ft'],'damage':{'average':average,'dice':dice,'type':'fire'}},'Chi lo tocca o colpisce in mischia da entro cinque piedi subisce '+dice+' fuoco.')]
            if index=='fire-snake':
                m['cannotSpeak']=True
                m['traits'].append(trait('juvenile-salamander','Giovane Salamandra',{'maturesWithinYears':1},'Giovane della salamandra, diventa adulto entro un anno.'))
                first=attack(('bite','Morso',3,'one-target',3,'1d4+1','piercing'),{'extraDamage':{'average':3,'dice':'1d6','type':'fire'}})
                tail=attack(('tail','Coda',3,'one-target',3,'1d4+1','bludgeoning'),{'extraDamage':{'average':3,'dice':'1d6','type':'fire'}})
            else:
                m['traits'].append(trait('heated-weapons','Armi Arroventate',{'when':'hits-with-metal-melee-weapon','extraDamage':{'average':3,'dice':'1d6','type':'fire'},'includedInListedAttack':True},'Armi metalliche aggiungono d6 fuoco al colpo, già incluso nella lancia.'))
                first=attack(('spear','Lancia',7,'one-target',11,'2d6+4','piercing'),{'twoHandedMeleeDamage':{'average':13,'dice':'2d8+4','type':'piercing'},'extraDamage':{'average':3,'dice':'1d6','type':'fire'}})
                first.update(kind='melee-or-ranged-weapon-attack',rangeFt={'normal':20,'long':60})
                first['summaryIt']+=' A due mani solo in mischia 2d8 più quattro; altro d6 fuoco. Gittata venti/sessanta.'
                tail=attack(('tail','Coda',7,'one-target',11,'2d6+4','bludgeoning'),{'extraDamage':{'average':7,'dice':'2d6','type':'fire'},'grapple':{'escapeDC':14,'whileGrappled':['restrained','tail-automatically-hits-this-target','cannot-tail-attack-other-targets']}})
                tail['reachFt']=10;tail['summaryIt']+=' Portata dieci, anche 2d6 fuoco e afferrato fuga quattordici; trattenuto, coda può colpirlo automaticamente e non altri bersagli finché afferrato.'
            if index=='fire-snake':
                first['summaryIt']+=' Anche d6 fuoco.';tail['summaryIt']+=' Anche d6 fuoco.'
            m['actions']=[{'index':'multiattack','nameIt':'Multiattacco','activation':'action','kind':'multiattack','effect':{'attacks':[{'actionIndex':first['index'],'count':1},{'actionIndex':'tail','count':1}]},'summaryIt':'Un '+('morso' if index=='fire-snake' else 'attacco di lancia')+' e una coda.'},first,tail]
        else:
            m['speedFt']['swim']=60;m['cannotSpeak']=True
            m['conditionImmunities']=['exhaustion','grappled','paralyzed','poisoned','restrained','prone','unconscious']
            m['traits']=[trait('invisible-in-water','Invisibile nell’Acqua',{'when':'fully-immersed-in-water','condition':'invisible'},'Invisibile solo interamente immersa.'),
              trait('water-bound','Vincolo Acquatico',{'diesWhenAny':['leaves-bound-water','bound-water-destroyed']},'Muore abbandonando l’acqua vincolata o se quell’acqua è distrutta.'),
              trait('elemental-nature','Natura Elementale',{'doesNotRequire':['air','food','drink','sleep']},'Non necessita aria, cibo, bevande o sonno.'),
              trait('water-alignment','Natura dell’Acqua',{'sacredWaterAlignment':'neutral-good','befouledWaterAlignment':'neutral-evil','evilAlignmentEndsIf':'bound-water-cleansed-with-purify-food-and-drink'},'Acqua sacra o contaminata può renderla buona o malvagia; Purificare Cibo e Bevande elimina l’allineamento malvagio ripulendo l’acqua.')]
            m['actions']=[attack(('constrict','Costrizione',5,'one-creature',13,'3d6+3','bludgeoning'),{'ifTargetMediumOrSmaller':{'grapple':{'escapeDC':13,'pullFt':5,'pullToward':'self','whileGrappled':['restrained','tries-to-drown-target','cannot-constrict-another-target']}}})]
            m['actions'][0]['reachFt']=10;m['actions'][0]['summaryIt']+=' Portata dieci; se Medio o minore afferrato fuga tredici e trascinato cinque piedi; trattenuto, tenta annegamento e nessun altro bersaglio costretto finché afferrato.'
        e=record('creature',index,index.title().replace('-',' '),it,page,m,it+': '+' '.join(t['summaryIt'] for t in m['traits'])+' '+' '.join(a['summaryIt'] for a in m['actions']),book='mm')
        e['sources'][0].update(printedPages=[page-1],verification='read-local-render');e['reviewScope']='individual-stat-block-complete; full-MM-inventory-pending'
        if index=='galeb-duhr':
            e['sources'].append(source(12,'Limited Usage',book='mm'));e['sources'][-1]['printedPages']=[11];e['fieldSources']['actions']=[0,1]
        if index=='water-weird':e['relations']={'spellIds':['phb2014:spell:purify-food-and-drink'],'dependencyIds':['phb2014:spell:purify-food-and-drink']}
        result.append(e)
    return result


def flask_fiend_records():
    """Cambion and four yugoloths, MM PDF 37/312–315; no invented innate DC."""
    spells=lambda names:['phb2014:spell:'+x for x in names.split()]
    rows=[
      ('cambion','Cambion',37,'Medium','any-evil',19,82,'11d8+33',30,60,[18,18,16,14,12,16],{'strength':7,'constitution':6,'intelligence':5,'charisma':6},{'deception':6,'intimidation':6,'perception':4,'stealth':7},14,5,1800),
      ('arcanaloth','Arcanaloth',314,'Medium','neutral-evil',17,104,'16d8+32',30,30,[17,12,14,20,16,17],{'dexterity':5,'intelligence':9,'wisdom':7,'charisma':7},{'arcana':13,'deception':9,'insight':9,'perception':7},17,12,8400),
      ('mezzoloth','Mezzoloth',314,'Medium','neutral-evil',18,75,'10d8+30',40,0,[18,11,16,7,10,11],{},{'perception':3},13,5,1800),
      ('nycaloth','Nycaloth',315,'Large','neutral-evil',18,123,'13d10+52',40,60,[20,11,19,12,10,15],{},{'intimidation':6,'perception':4,'stealth':4},14,9,5000),
      ('ultroloth','Ultroloth',315,'Medium','neutral-evil',19,153,'18d8+72',30,60,[16,16,18,18,15,19],{},{'intimidation':9,'perception':7,'stealth':8},17,13,10000),
    ]
    result=[]
    for index,it,page,size,alignment,ac,hp,hpdice,speed,fly,abilities,saves,skills,passive,cr,xp in rows:
        yugoloth=index!='cambion'
        innate={'castingAbility':'charisma','materialComponentsRequired':False}
        if index=='cambion':innate.update(spellSaveDC=14,threePerDayEachSpellIds=spells('alter-self command detect-magic'),oncePerDayEachSpellIds=spells('plane-shift'),selfOnlySpellIds=spells('plane-shift'))
        elif index=='arcanaloth':innate.update(spellSaveDC=15,atWillSpellIds=spells('alter-self darkness heat-metal invisibility magic-missile'),selfOnlySpellIds=spells('invisibility'))
        elif index=='mezzoloth':innate.update(spellSaveDC=11,twicePerDayEachSpellIds=spells('darkness dispel-magic'),oncePerDayEachSpellIds=spells('cloudkill'))
        elif index=='nycaloth':innate.update(atWillSpellIds=spells('darkness detect-magic dispel-magic invisibility mirror-image'),selfOnlySpellIds=spells('invisibility'),spellSaveDCStatus='not-stated-no-assumed-DC')
        else:innate.update(spellSaveDC=17,atWillSpellIds=spells('alter-self clairvoyance darkness detect-magic detect-thoughts dispel-magic invisibility suggestion'),threePerDayEachSpellIds=spells('dimension-door fear wall-of-fire'),oncePerDayEachSpellIds=spells('fire-storm mass-suggestion'),selfOnlySpellIds=spells('invisibility'))
        m={'size':size,'type':'fiend','alignment':alignment,'armorClass':{'value':ac,'source':'scale-mail' if not yugoloth else 'natural-armor'},'hitPoints':{'average':hp,'dice':hpdice},
           'speedFt':{'walk':speed,**({'fly':fly} if fly else {})},'abilities':dict(zip(ABILITIES,abilities,strict=True)),'savingThrowBonuses':saves,'skillBonuses':skills,
           'sensesFt':{'truesight':120} if index in ['arcanaloth','ultroloth'] else {'darkvision':60,**({'blindsight':60} if yugoloth else {})},
           'passivePerception':passive,'languages':['all'] if index=='arcanaloth' else ['abyssal','common','infernal'] if not yugoloth else ['abyssal','infernal'],
           'challengeRating':cr,'experiencePoints':xp,'damageVulnerabilities':[],'damageResistances':['cold','fire','lightning']+([] if yugoloth else ['poison']),
           'conditionalDamageResistances':[{'types':['bludgeoning','piercing','slashing'],'condition':'nonmagical-weapons'}],
           'damageImmunities':['acid','poison'] if yugoloth else [],'conditionImmunities':(['charmed','poisoned'] if index=='arcanaloth' else ['charmed','frightened','poisoned'] if index=='ultroloth' else ['poisoned']) if yugoloth else [],
           'traits':[trait('innate-spellcasting','Incantesimi Innati',innate,'Incantesimi innati con Carisma e senza materiali; liste e frequenze indipendenti. Invisibilità limitata a sé dove indicato.')],'actions':[],'reactions':[],'legendaryActions':[]}
        deps=[sid for k,ids in innate.items() if k.endswith('SpellIds') for sid in ids]
        if yugoloth:
            m['creatureTags']=['yugoloth'];m['telepathyFt']=120 if index in ['arcanaloth','ultroloth'] else 60
            m['traits'] += [trait('magic-resistance','Resistenza alla Magia',{'advantageSavingThrowsAgainst':['spells','other-magical-effects']},'Vantaggio TS contro magie e altri effetti magici.'),
              trait('magic-weapons','Armi Magiche',{'weaponAttacks':'magical'},'Attacchi con armi magici.'),
              trait('return-to-gehenna','Ritorno nella Gehenna',{'deathOutsideNativePlane':'reforms-at-full-strength-in-gehenna','permanentDestructionRequires':'death-on-native-plane','reformationTime':'not-stated'},'Morendo fuori dal piano natale si ricostituisce nella Gehenna; solo sul proprio piano la distruzione è definitiva, nessun tempo dichiarato.')]
            teleport={'index':'teleport','nameIt':'Teletrasporto','activation':'action','kind':'special','effect':{'distanceFt':60,'destination':'visible-unoccupied-space','includes':'worn-or-carried-equipment'},'summaryIt':'Azione: teletrasporto sessanta piedi in spazio libero visibile, con equipaggiamento.'}
            chance,options={'arcanaloth':(40,[('arcanaloth','1')]),'mezzoloth':(30,[('mezzoloth','1')]),'nycaloth':(50,[('mezzoloth','1d4'),('nycaloth','1')]),'ultroloth':(50,[('mezzoloth','1d6'),('nycaloth','1d4'),('ultroloth','1')])}[index]
            m['optionalVariants']=[{'requiresDMApproval':True,'nameIt':'Evocazione di Yugoloth','effect':{'addsAction':{'activation':'action','uses':1,'recovery':'long-rest','successChancePercent':chance,
              'chooseOne':[{'creatureId':'mm2014:creature:'+name,'quantityDice':dice} for name,dice in options],'selectionRequiresVerifiedStatBlock':True,
              'rangeFt':60,'destination':'unoccupied-space','attitude':'ally-of-summoner' if index=='ultroloth' else 'acts-as-it-pleases',
              'cannotSummonFurtherYugoloths':True,'durationMinutes':1,'endsEarlier':['own-death','summoner-death','summoner-bonus-action-dismiss']}}}]
        else:
            m['traits'].append(trait('fiendish-blessing','Benedizione Immonda',{'charismaBonusIncludedInListedAC':True},'La CA diciannove include già Carisma; non aggiungerlo nuovamente.'))
        if index=='cambion':
            spear=attack(('spear','Lancia',7,'one-target',7,'1d6+4','piercing'),{'twoHandedMeleeDamage':{'average':8,'dice':'1d8+4','type':'piercing'},'extraDamage':{'average':3,'dice':'1d6','type':'fire'}})
            spear.update(kind='melee-or-ranged-weapon-attack',rangeFt={'normal':20,'long':60});spear['summaryIt']+=' Anche d6 fuoco, due mani in mischia d8 più quattro, gittata venti/sessanta.'
            ray=attack(('fire-ray','Raggio di Fuoco',7,'one-target',10,'3d6','fire'));ray.update(kind='ranged-spell-attack',rangeFt={'normal':120,'long':120});ray.pop('reachFt');ray['summaryIt']='Raggio magico più sette, gittata centoventi, 3d6 fuoco.'
            m['actions']=[{'index':'multiattack','nameIt':'Multiattacco','activation':'action','kind':'multiattack','effect':{'choice':[{'meleeAttacks':2},{'actionIndex':'fire-ray','count':2}]},'summaryIt':'Due attacchi in mischia oppure due Raggi di Fuoco.'},spear,ray,
              {'index':'fiendish-charm','nameIt':'Fascino Immondo','activation':'action','kind':'special','effect':{'target':'one-visible-humanoid','rangeFt':30,'save':{'ability':'wisdom','dc':14},'failureCondition':'charmed','durationHours':24,
                'obeys':'spoken-commands','repeatSaveOptionalWhenAny':['any-harm-by-any-creature','cambion-suicidal-command'],'successfulSaveOrEffectEndsImmunityHours':24},'summaryIt':'Un umanoide visibile trenta piedi, TS Saggezza quattordici o affascinato un giorno, obbedisce agli ordini parlati. Danno o altra azione nociva di qualunque creatura e ordine suicida consentono ripetizione. Successo o fine effetto dà immunità ventiquattro ore.'}]
        elif index=='arcanaloth':
            prepared=[(0,None,'fire-bolt mage-hand minor-illusion prestidigitation'),(1,4,'detect-magic identify shield tenser-s-floating-disk'),(2,3,'detect-thoughts mirror-image phantasmal-force suggestion'),(3,3,'counterspell fear fireball'),(4,3,'banishment dimension-door'),(5,2,'contact-other-plane hold-monster'),(6,1,'chain-lightning'),(7,1,'finger-of-death'),(8,1,'mind-blank')]
            levels=[{'level':lv,'slots':slots,'spellIds':spells(names)} for lv,slots,names in prepared]
            m['traits'].append(trait('spellcasting','Incantesimi',{'class':'wizard','casterLevelInLocalPrinting':16,'castingAbility':'intelligence','spellSaveDC':17,'spellAttackBonus':9,'preparedSpellLevels':levels,'components':'ordinary-spell-components','slotPolicy':'use-listed-stat-block-slots'},'Mago incantatore sedici, Intelligenza CD diciassette attacco più nove, componenti ordinarie. Slot quattro/tre/tre/tre/due/uno/uno/uno; liste preparate distinte dalle magie innate Carisma.'))
            deps += [sid for r in levels for sid in r['spellIds']]
            claws=attack(('claws','Artigli',7,'one-target',8,'2d4+3','slashing'),{'additionalDamageSave':{'ability':'constitution','dc':14,'failedDamage':{'average':10,'dice':'3d6','type':'poison'},'successDamage':'half'}});claws['summaryIt']+=' TS Costituzione quattordici, 3d6 veleno metà se riuscito.'
            m['actions']=[claws,teleport]
        elif index=='mezzoloth':
            claws=attack(('claws','Artigli',7,'one-target',9,'2d4+4','slashing'))
            trident=attack(('trident','Tridente',7,'one-target',7,'1d6+4','piercing'),{'twoHandedMeleeDamage':{'average':8,'dice':'1d8+4','type':'piercing'}})
            trident.update(kind='melee-or-ranged-weapon-attack',rangeFt={'normal':20,'long':60});trident['summaryIt']+=' Due chele solo mischia d8 più quattro, gittata venti/sessanta.'
            m['actions']=[{'index':'multiattack','nameIt':'Multiattacco','activation':'action','kind':'multiattack','effect':{'attacks':[{'actionIndex':'claws','count':1},{'actionIndex':'trident','count':1}]},'summaryIt':'Un attacco artigli e un tridente.'},claws,trident,teleport]
        elif index=='nycaloth':
            claws=attack(('claw','Artiglio',9,'one-target',12,'2d6+5','slashing'),{'ifTargetCreature':{'save':{'ability':'constitution','dc':16},'failureOngoingWound':{'damage':{'average':5,'dice':'2d4','type':'slashing'},'when':'start-of-each-target-turn',
              'eachFurtherHitOnAlreadyWoundedAdds':{'average':5,'dice':'2d4','type':'slashing'},'noRepeatSaveStated':True,'endsAny':['any-creature-action-wisdom-medicine-DC13','target-receives-magical-healing']}}})
            claws['summaryIt']+=' Se creatura TS Costituzione sedici o ferita: 2d4 taglienti a inizio turno; ogni ulteriore colpo su ferito aggiunge 2d4. Azione Medicina tredici o guarigione magica chiude la ferita, nessuna ripetizione TS dichiarata.'
            m['actions']=[{'index':'multiattack','nameIt':'Multiattacco','activation':'action','kind':'multiattack','effect':{'choice':[{'meleeAttacks':2},{'meleeAttacks':1,'teleport':'before-or-after-attack'}]},'summaryIt':'Due attacchi mischia oppure uno e teletrasporto prima o dopo.'},claws,attack(('greataxe','Ascia Bipenne',9,'one-target',18,'2d12+5','slashing')),teleport]
        else:
            sword=attack(('longsword','Spada Lunga',8,'one-target',7,'1d8+3','slashing'),{'twoHandedDamage':{'average':8,'dice':'1d10+3','type':'slashing'}});sword['summaryIt']+=' Due mani d10 più tre.'
            gaze={'index':'hypnotic-gaze','nameIt':'Sguardo Ipnotico','activation':'action','kind':'special','effect':{'target':'one-mutually-visible-creature','rangeFt':30,'save':{'ability':'wisdom','dc':17},'failureCondition':'charmed','whileCharmed':'stunned','expires':'end-of-ultroloth-next-turn','successfulSaveImmunityHours':24,'effectEndsAloneGrantsImmunity':False},'summaryIt':'Una creatura che vede e può vederlo trenta piedi, TS Saggezza diciassette o affascinata e stordita fino fine turno successivo dell’ultroloth. Solo TS riuscito dà immunità ventiquattro ore.'}
            m['actions']=[{'index':'multiattack','nameIt':'Multiattacco','activation':'action','kind':'multiattack','effect':{'optionalActionIndex':'hypnotic-gaze','meleeAttacks':3},'summaryIt':'Può usare Sguardo Ipnotico e fa tre attacchi in mischia.'},sword,gaze,teleport]
        pages=[page,312] if yugoloth else [page]
        e=record('creature',index,index.title(),it,pages,m,it+': '+' '.join(t['summaryIt'] for t in m['traits'])+' '+' '.join(a['summaryIt'] for a in m['actions']),book='mm')
        e['sources'][0].update(printedPages=[n-1 for n in pages],verification='read-local-render');e['sources'].append(source(12,'Spellcasting and Limited Usage',book='mm'));e['sources'][-1]['printedPages']=[11]
        e['fieldSources']['traits']=[0,1]
        if yugoloth:e['fieldSources']['optionalVariants']=[0,1]
        e['relations']={'dependencyIds':sorted(set(deps))};e['reviewScope']='individual-stat-block-read; completeness-propagates-spell-dependencies; full-MM-inventory-pending'
        result.append(e)
    return result


def remaining_genie_records():
    """Dao and marid, MM PDF 144/147 with optional powers from PDF 145."""
    spells=lambda names:['phb2014:spell:'+x for x in names.split()]
    powers=next(e for e in item_creatures() if e['index']=='djinni')['mechanics']['optionalVariants']
    rows=[('dao','Dao',144,18,187,'15d10+105',{'walk':30,'burrow':30,'fly':30},[23,12,24,12,13,14],{'intelligence':5,'wisdom':5,'charisma':6},11,'neutral-evil','terran',14,6),
          ('marid','Marid',147,17,229,'17d10+136',{'walk':30,'fly':60,'swim':90},[22,12,26,18,17,18],{'dexterity':5,'wisdom':7,'charisma':8},13,'chaotic-neutral','aquan',16,8)]
    result=[]
    for index,it,page,ac,hp,hpdice,speed,abilities,saves,passive,alignment,language,dc,spell_attack in rows:
        dao=index=='dao'
        at=spells('detect-evil-and-good detect-magic stone-shape' if dao else 'create-or-destroy-water detect-evil-and-good detect-magic fog-cloud purify-food-and-drink')
        three=spells('passwall move-earth tongues' if dao else 'tongues water-breathing water-walk')
        one=spells('conjure-elemental gaseous-form invisibility phantasmal-killer plane-shift wall-of-stone' if dao else 'conjure-elemental control-water gaseous-form invisibility plane-shift')
        m={'size':'Large','type':'elemental','alignment':alignment,'armorClass':{'value':ac,'source':'natural-armor'},'hitPoints':{'average':hp,'dice':hpdice},'speedFt':speed,
           'abilities':dict(zip(ABILITIES,abilities,strict=True)),'savingThrowBonuses':saves,'skillBonuses':{},'sensesFt':{'darkvision':120,**({} if dao else {'blindsight':30})},
           'passivePerception':passive,'languages':[language],'challengeRating':11,'experiencePoints':7200,'damageVulnerabilities':[],'damageResistances':[] if dao else ['acid','cold','lightning'],
           'damageImmunities':[],'conditionImmunities':['petrified'] if dao else [],'traits':[], 'actions':[],'reactions':[],'legendaryActions':[],'optionalVariants':copy.deepcopy(powers)}
        innate={'castingAbility':'charisma','spellSaveDC':dc,'spellAttackBonus':spell_attack,'materialComponentsRequired':False,'atWillSpellIds':at,'threePerDayEachSpellIds':three,'oncePerDayEachSpellIds':one,'conjureElementalRestriction':'earth-elemental-only' if dao else 'water-elemental-only'}
        m['traits']=[trait('elemental-demise','Morte Elementale',{'onDeath':'crystalline-powder' if dao else 'water-and-foam','remains':'only-worn-or-carried-equipment'},'Morendo si disgrega in '+('polvere cristallina' if dao else 'acqua e schiuma')+', conservando solo equipaggiamento.'),
          trait('innate-spellcasting','Incantesimi Innati',innate,'Carisma CD '+str(dc)+', attacco più '+str(spell_attack)+', senza materiali. Frequenze per ciascuna magia; Evoca Elementale soltanto '+('terra.' if dao else 'acqua.'))]
        if dao:
            m['traits'] += [trait('earth-glide','Scivolare nella Terra',{'burrowThrough':'nonmagical-unworked-earth-and-stone','disturbsMaterial':False},'Attraversa terra e pietra non magiche e non lavorate senza perturbarle.'),trait('sure-footed','Piede Sicuro',{'advantageSavesAbilities':['strength','dexterity'],'against':'effects-that-would-knock-prone'},'Vantaggio TS Forza e Destrezza contro cadere prono.')]
            fist=attack(('fist','Pugno',10,'one-target',15,'2d8+6','bludgeoning'))
            maul=attack(('maul','Maglio',10,'one-target',20,'4d6+6','bludgeoning'),{'ifTargetCreatureHugeOrSmaller':{'strengthCheckDC':18,'isSavingThrow':False,'failureCondition':'prone'}});maul['summaryIt']+=' Se creatura Enorme o minore prova Forza diciotto, non TS, o prona.'
            m['actions']=[{'index':'multiattack','nameIt':'Multiattacco','activation':'action','kind':'multiattack','effect':{'choice':[{'actionIndex':'fist','count':2},{'actionIndex':'maul','count':2}]},'summaryIt':'Due pugni oppure due magli.'},fist,maul]
        else:
            m['traits'].append(trait('amphibious','Anfibio',{'breathe':['air','water']},'Respira aria e acqua.'))
            trident=attack(('trident','Tridente',10,'one-target',13,'2d6+6','piercing'),{'twoHandedMeleeDamage':{'average':15,'dice':'2d8+6','type':'piercing'}});trident.update(kind='melee-or-ranged-weapon-attack',rangeFt={'normal':20,'long':60});trident['summaryIt']+=' Due mani solo mischia 2d8 più sei; gittata venti/sessanta.'
            m['actions']=[{'index':'multiattack','nameIt':'Multiattacco','activation':'action','kind':'multiattack','effect':{'attacks':[{'actionIndex':'trident','count':2}]},'summaryIt':'Due tridenti.'},trident,
              {'index':'water-jet','nameIt':'Getto d’Acqua','activation':'action','kind':'special','effect':{'magical':True,'area':{'shape':'line','lengthFt':60,'widthFt':5},'targets':'each-creature-in-line','save':{'ability':'dexterity','dc':16},'failureDamage':{'average':21,'dice':'6d6','type':'bludgeoning'},'successDamage':'half','failureIfHugeOrSmaller':{'pushAwayUpToFt':20,'condition':'prone'},'successPushOrProne':False},'summaryIt':'Linea sessanta per cinque, TS Destrezza sedici, 6d6 contundenti. Fallimento se Enorme o minore spinto fino venti piedi e prono; successo metà e nessuna spinta o caduta.'}]
        e=record('creature',index,index.title(),it,[page,142,145],m,it+': '+' '.join(t['summaryIt'] for t in m['traits'])+' '+' '.join(a['summaryIt'] for a in m['actions']),book='mm')
        e['sources'][0].update(printedPages=[page-1,141,144],verification='read-local-render');e['sources'].append(source(12,'Limited Usage',book='mm'));e['sources'][-1]['printedPages']=[11]
        e['fieldSources']['traits']=[0,1];e['fieldSources']['optionalVariants']=[0]
        e['relations']={'dependencyIds':sorted(set([*at,*three,*one,'phb2014:spell:wish','phb2014:spell:disguise-self','phb2014:spell:true-polymorph']))}
        e['reviewScope']='individual-stat-block-read; optional-genie-powers-DM-only; full-MM-inventory-pending';result.append(e)
    return result


def angel_records():
    """MM PDF 16–19 renders resolve missing Planetar trait and Solar OCR 190→100."""
    spells=lambda names:['phb2014:spell:'+x for x in names.split()]
    rows=[('deva','Deva',17,'Medium',17,136,'16d8+64',30,90,[18,18,18,17,20,20],{'wisdom':9,'charisma':9},{'insight':7,'perception':9},19,10,5900,17,'4d8',18,3,'4d8+2',20),
          ('planetar','Planetar',18,'Large',19,200,'16d10+112',40,120,[24,20,24,19,22,25],{'constitution':12,'wisdom':11,'charisma':12},{'perception':11},21,16,15000,20,'5d8',22,4,'6d8+3',30),
          ('solar','Solar',19,'Large',21,243,'18d10+144',50,150,[26,22,26,25,25,30],{'intelligence':14,'wisdom':14,'charisma':17},{'perception':14},24,21,33000,25,'6d8',27,4,'8d8+4',40)]
    result=[]
    for index,it,page,size,ac,hp,hpdice,walk,fly,abilities,saves,skills,passive,cr,xp,dc,radiantdice,radiantavg,healinguses,healingdice,healingavg in rows:
        deva=index=='deva';solar=index=='solar'
        at=spells('detect-evil-and-good'+('' if deva else ' invisibility'))
        three=[] if deva else spells('blade-barrier dispel-evil-and-good resurrection' if solar else 'blade-barrier dispel-evil-and-good flame-strike raise-dead')
        one=spells('commune raise-dead' if deva else 'commune control-weather'+('' if solar else ' insect-plague'))
        innate={'castingAbility':'charisma','spellSaveDC':dc,'materialComponentsRequired':False,'verbalComponentsRequired':True,'somaticComponentsRequired':not deva,
          'atWillSpellIds':at,'threePerDayEachSpellIds':three,'oncePerDayEachSpellIds':one,'selfOnlySpellIds':[] if deva else spells('invisibility')}
        m={'size':size,'type':'celestial','alignment':'lawful-good','armorClass':{'value':ac,'source':'natural-armor'},'hitPoints':{'average':hp,'dice':hpdice},'speedFt':{'walk':walk,'fly':fly},
          'abilities':dict(zip(ABILITIES,abilities,strict=True)),'savingThrowBonuses':saves,'skillBonuses':skills,'sensesFt':{'darkvision':120} if deva else {'truesight':120},'passivePerception':passive,
          'languages':['all'],'telepathyFt':120,'challengeRating':cr,'experiencePoints':xp,'damageVulnerabilities':[],'damageResistances':['radiant'],
          'conditionalDamageResistances':[{'types':['bludgeoning','piercing','slashing'],'condition':'nonmagical-weapons'}],'damageImmunities':['necrotic','poison'] if solar else [],
          'conditionImmunities':['charmed','exhaustion','frightened']+(['poisoned'] if solar else []),'traits':[], 'actions':[],'reactions':[],'legendaryActions':[]}
        m['traits']=[trait('angelic-weapons','Armi Angeliche',{'weaponAttacks':'magical','extraDamageOnAnyWeaponHit':{'dice':radiantdice,'average':radiantavg,'type':'radiant'},'includedInListedAttacks':True},'Attacchi con armi magici, qualsiasi colpo con arma aggiunge '+radiantdice+' radiosi già inclusi negli attacchi elencati.'),
          trait('innate-spellcasting','Incantesimi Innati',innate,'Carisma CD '+str(dc)+', '+('sole componenti verbali.' if deva else 'senza materiali; componenti verbali e somatiche ordinarie delle magie.')),
          trait('magic-resistance','Resistenza alla Magia',{'advantageSavingThrowsAgainst':['spells','other-magical-effects']},'Vantaggio TS contro magie e altri effetti magici.'),
          trait('immortal-nature','Natura Immortale',{'doesNotRequire':['food','drink','sleep']},'Non necessita cibo, bevande o sonno; il passaggio non esenta dall’aria.')]
        if not deva:m['traits'].append(trait('divine-awareness','Consapevolezza Divina',{'knowsWhen':'hears-a-lie'},'Sa quando ode una menzogna.'))
        weapon=attack(('mace' if deva else 'greatsword','Mazza' if deva else 'Spadone',8 if deva else 15 if solar else 12,'one-target',7 if deva else 22 if solar else 21,'1d6+4' if deva else '4d6+8' if solar else '4d6+7','bludgeoning' if deva else 'slashing'),{'extraDamage':{'dice':radiantdice,'average':radiantavg,'type':'radiant'}})
        weapon['summaryIt']+=' Anche '+radiantdice+' radiosi, non aggiunti due volte.'
        healing={'index':'healing-touch','nameIt':'Tocco Guaritore','activation':'action','kind':'special','effect':{'uses':healinguses,'recovery':'long-rest','target':'another-creature-touched','magical':True,
          'healing':{'dice':healingdice,'average':healingavg},'freesFromAny':['curse','disease','poison','blindness','deafness']},'summaryIt':str(healinguses)+' usi per riposo lungo, tocco su un’altra creatura: '+healingdice+' PF e libera da maledizioni, malattie, veleno, cecità e sordità.'}
        m['actions']=[{'index':'multiattack','nameIt':'Multiattacco','activation':'action','kind':'multiattack','effect':{'meleeAttacks':2} if not solar else {'attacks':[{'actionIndex':'greatsword','count':2}]},'summaryIt':'Due attacchi in mischia.' if not solar else 'Due spadoni.'},weapon,healing]
        deps=[*at,*three,*one]
        if deva:
            m['actions'].append({'index':'change-shape','nameIt':'Cambiare Forma','activation':'action','kind':'special','effect':{'forms':['humanoid','beast','own-true-form'],'maximumFormCR':'own-challenge-rating',
              'deathReverts':True,'equipmentChoice':['absorbed','borne-by-new-form'],'retains':'game-statistics-and-speech-except-listed-overrides','replacedStatistics':['armor-class','movement-modes','strength','dexterity','special-senses'],
              'gains':'new-form-statistics-and-capabilities-that-deva-lacks','excludedNewFormCapabilities':['class-features','legendary-actions','lair-actions']},'summaryIt':'Umanoide o bestia con GS fino proprio, o vera forma; morte ripristina. Equipaggiamento assorbito o portato a scelta. Mantiene statistiche e parola salvo CA, movimenti, Forza, Destrezza e sensi speciali; guadagna ciò che manca eccetto privilegi classe, azioni leggendarie e tana.'})
        elif solar:
            bow=attack(('slaying-longbow','Arco Lungo Assassino',13,'one-target',15,'2d8+6','piercing'),{'extraDamage':{'dice':'6d8','average':27,'type':'radiant'},'ifTargetCreatureHPAtMost':{'hitPoints':100,'save':{'ability':'constitution','dc':15},'failure':'dies'}})
            bow.update(kind='ranged-weapon-attack',rangeFt={'normal':120,'long':600});bow.pop('reachFt');bow['summaryIt']='Arco più tredici, gittata originale centoventi/seicento, 2d8 più sei perforanti e 6d8 radiosi. Creatura con cento PF o meno TS Costituzione quindici o muore; cento verificato sul render, non centonovanta OCR.'
            flying={'index':'flying-sword','nameIt':'Spada Volante','activation':'action','kind':'special','effect':{'releaseTo':'unoccupied-space-within-five-ft','hover':True,'command':{'activation':'bonus-action','requires':'see-sword','flyUpToFt':50,'chooseOne':['one-attack-against-target','return-to-solar-hands']},
              'ifSwordTargetedByAnyEffect':'solar-considered-holding-it','solarDeath':'sword-falls'},'summaryIt':'Azione libera spadone in spazio libero entro cinque piedi. Vedendolo bonus lo fa volare fino cinquanta piedi e attaccare una volta o tornare in mano. Effetti sulla spada considerano il solar impugnarla; alla sua morte cade.'}
            m['actions']=[m['actions'][0],weapon,bow,flying,healing]
            m['legendaryActionEconomy']={'maximum':3,'recovery':'start-of-own-turn','timing':'end-of-another-creature-turn','maximumOptionsPerOpportunity':1}
            m['legendaryActions']=[{'index':'teleport','nameIt':'Teletrasporto','activation':'legendary-action','kind':'special','effect':{'legendaryActionCost':1,'distanceFt':120,'destination':'visible-unoccupied-space','includes':'worn-or-carried-equipment'},'summaryIt':'Una azione: teletrasporto centoventi piedi libero visibile con equipaggiamento.'},
              {'index':'searing-burst','nameIt':'Esplosione Ardente','activation':'legendary-action','kind':'special','effect':{'legendaryActionCost':2,'magical':True,'radiusFt':10,'targets':'each-creature-of-own-choice-in-area','save':{'ability':'dexterity','dc':23},'failureDamage':[{'dice':'4d6','average':14,'type':'fire'},{'dice':'4d6','average':14,'type':'radiant'}],'successDamage':'half'},'summaryIt':'Due azioni: creature scelte entro dieci piedi TS Destrezza ventitré, 4d6 fuoco e 4d6 radiosi, metà se riuscito.'},
              {'index':'blinding-gaze','nameIt':'Sguardo Accecante','activation':'legendary-action','kind':'special','effect':{'legendaryActionCost':3,'target':'one-mutually-visible-creature','rangeFt':30,'save':{'ability':'constitution','dc':15},'failureCondition':'blinded','ends':'magic-such-as-lesser-restoration','repeatSaveStated':False},'summaryIt':'Tre azioni: un bersaglio che vede e può vederlo trenta piedi, TS Costituzione quindici o cieco finché magia come Ristorare Inferiore cura; nessun TS ripetuto dichiarato.'}]
            deps+=spells('lesser-restoration')
        e=record('creature',index,index.title(),it,[page,16],m,it+': '+' '.join(t['summaryIt'] for t in m['traits'])+' '+' '.join(a['summaryIt'] for a in m['actions']),book='mm')
        e['sources'][0].update(printedPages=[page-1,15],verification='read-local-render');e['sources'].append(source(12,'Limited Usage and Legendary Actions',book='mm'));e['sources'][-1]['printedPages']=[11]
        e['fieldSources']['traits']=[0,1];e['fieldSources']['actions']=[0,1]
        if solar:e['fieldSources']['legendaryActionEconomy']=[0,1];e['fieldSources']['legendaryActions']=[0,1];e['extractionAnomalies']=[{'field':'slaying-longbow.hit-point-threshold','ocrCandidate':190,'renderConfirmed':100,'resolution':'read-local-render'}]
        if not deva:e['extractionAnomalies']=e.get('extractionAnomalies',[])+[{'field':'divine-awareness','textExtraction':'omitted-for-planetar' if index=='planetar' else 'present','resolution':'read-local-render'}]
        e['relations']={'dependencyIds':sorted(set(deps))};e['reviewScope']='individual-stat-block-read; full-MM-inventory-pending';result.append(e)
    return result


def other_flask_records():
    """Gith knight/zerth, succubus-incubus and xorn, inspected MM renders."""
    spells=lambda names:['phb2014:spell:'+x for x in names.split()]
    rows=[('githyanki-knight','Cavaliere Githyanki',161,'humanoid','lawful-evil',18,'plate',91,'14d8+28',30,[16,14,15,14,14,15],{'constitution':5,'intelligence':5,'wisdom':5},{},{},12,8,3900),
          ('githzerai-zerth','Zerth Githzerai',162,'humanoid','lawful-neutral',17,'unspecified',84,'13d8+26',30,[13,18,15,16,17,12],{'strength':4,'dexterity':7,'intelligence':6,'wisdom':6},{'arcana':6,'insight':6,'perception':6},{},16,6,2300),
          ('succubus-incubus','Succubo/Incubo',286,'fiend','neutral-evil',15,'natural-armor',66,'12d8+12',30,[8,17,13,15,12,20],{},{'deception':9,'insight':5,'perception':5,'persuasion':9,'stealth':7},{'darkvision':60},15,4,1100),
          ('xorn','Xorn',305,'elemental','neutral',19,'natural-armor',73,'7d8+42',20,[17,10,22,11,10,11],{},{'perception':6,'stealth':3},{'darkvision':60,'tremorsense':60},16,5,1800)]
    result=[]
    for index,it,page,kind,alignment,ac,armor,hp,hpdice,speed,abilities,saves,skills,senses,passive,cr,xp in rows:
        gith=index.startswith('gith');knight=index=='githyanki-knight';succ=index=='succubus-incubus';deps=[]
        m={'size':'Medium','type':kind,'alignment':alignment,'armorClass':{'value':ac,'source':armor},'hitPoints':{'average':hp,'dice':hpdice},'speedFt':{'walk':speed},'abilities':dict(zip(ABILITIES,abilities,strict=True)),
          'savingThrowBonuses':saves,'skillBonuses':skills,'sensesFt':senses,'passivePerception':passive,'languages':['gith'] if gith else ['abyssal','common','infernal'] if succ else ['terran'],
          'challengeRating':cr,'experiencePoints':xp,'damageVulnerabilities':[],'damageResistances':['cold','fire','lightning','poison'] if succ else [],'damageImmunities':[],'conditionImmunities':[],
          'traits':[],'actions':[],'reactions':[],'legendaryActions':[]}
        if gith:
            m['creatureTags']=['gith'];at=spells('mage-hand');three=spells('jump misty-step nondetection tongues' if knight else 'feather-fall jump see-invisibility shield');one=spells('plane-shift telekinesis' if knight else 'phantasmal-killer plane-shift');deps=at+three+one
            m['traits']=[trait('innate-spellcasting','Incantesimi Innati Psionici',{'castingAbility':'intelligence' if knight else 'wisdom','spellSaveDC':13 if knight else 14,'spellAttackBonus':5 if knight else 6,
              'componentsRequired':[],'atWillSpellIds':at,'threePerDayEachSpellIds':three,'oncePerDayEachSpellIds':one,'mageHand':'invisible','selfOnlySpellIds':spells('nondetection') if knight else []},'Innate senza alcun componente; Mano Magica invisibile. '+('Intelligenza CD tredici attacco cinque, Anti-individuazione solo sé.' if knight else 'Saggezza CD quattordici attacco sei.'))]
            if not knight:m['traits'].append(trait('psychic-defense','Difesa Psichica',{'requires':['no-armor','no-shield'],'wisdomModifierIncludedInListedAC':True},'Senza armatura né scudo CA diciassette include già Saggezza.'))
            a=attack(('silver-greatsword' if knight else 'unarmed-strike','Spadone d’Argento' if knight else 'Colpo Senz’Armi',9 if knight else 7,'one-target',13 if knight else 11,'2d6+6' if knight else '2d6+4','slashing' if knight else 'bludgeoning'),{'magicalWeaponAttack':True,'extraDamage':{'dice':'3d6' if knight else '3d8','average':10 if knight else 13,'type':'psychic'}})
            a['summaryIt']+=' Magico, anche '+('3d6' if knight else '3d8')+' psichici.'
            if knight:
                a['effect']['criticalAlternative']={'requires':'target-in-astral-body','chooseInsteadOfDamage':'cut-silver-cord'};a['summaryIt']+=' Critico contro corpo astrale può tagliare cordone d’argento al posto dei danni.';deps+=spells('astral-projection')
            m['actions']=[{'index':'multiattack','nameIt':'Multiattacco','activation':'action','kind':'multiattack','effect':{'attacks':[{'actionIndex':a['index'],'count':2}]},'summaryIt':'Due '+('spadoni d’argento.' if knight else 'colpi senz’armi.')},a]
        elif succ:
            m['creatureTags']=['shapechanger'];m['speedFt']['fly']=60;m['telepathyFt']=60
            m['conditionalDamageResistances']=[{'types':['bludgeoning','piercing','slashing'],'condition':'nonmagical-weapons'}]
            m['traits']=[trait('telepathic-bond','Legame Telepatico',{'with':'creature-charmed-by-self','ignoresTelepathyRange':True,'worksAcrossPlanes':True},'Con chi ha affascinato telepatia senza limite anche tra piani diversi.'),
              trait('shapechanger','Mutaforma',{'activation':'action','forms':['Small-humanoid','Medium-humanoid','own-true-form'],'withoutWings':'loses-fly-speed','retainsStatisticsExcept':['size','speed'],'equipmentTransformed':False,'deathReverts':True},'Azione umanoide Piccolo o Medio o vera forma. Senza ali perde volo; salvo taglia e velocità statistiche identiche, beni non trasformati, morte ripristina.')]
            claws=attack(('claw','Artiglio',5,'one-target',6,'1d6+3','slashing'),{'requiresForm':'fiend-true-form'});claws['summaryIt']+=' Solo vera forma immonda.'
            m['actions']=[claws,{'index':'charm','nameIt':'Fascino','activation':'action','kind':'special','effect':{'target':'one-visible-humanoid','rangeFt':30,'save':{'ability':'wisdom','dc':15},'failureCondition':'charmed','durationHours':24,
              'obeys':['verbal-commands','telepathic-commands'],'repeatSaveOptionalWhenAny':['any-harm','suicidal-command'],'successfulSaveOrEffectEndsImmunityHours':24,'maximumTargets':1,'charmingNewTarget':'ends-previous-charm'},'summaryIt':'Un umanoide visibile trenta piedi, TS Saggezza quindici o affascinato un giorno. Obbedisce anche telepaticamente; qualsiasi fatto nocivo o ordine suicida consente nuovo TS. Successo o fine dà immunità ventiquattro ore; massimo uno, nuovo libera precedente.'},
              {'index':'draining-kiss','nameIt':'Bacio Risucchiante','activation':'action','kind':'special','effect':{'target':'willing-creature-or-creature-charmed-by-self','requires':'kiss-target','magical':True,'save':{'ability':'constitution','dc':15},'failureDamage':{'average':32,'dice':'5d10+5','type':'psychic'},'successDamage':'half','reducesHitPointMaximumBy':'actual-damage-taken','reductionEnds':'target-finishes-long-rest','maximumReducedToZero':'dies'},'summaryIt':'Bacia creatura consenziente o affascinata da sé, TS Costituzione quindici: 5d10 più cinque psichici metà se riuscito; massimo PF ridotto del danno subito fino riposo lungo, zero massimo uccide.'},
              {'index':'etherealness','nameIt':'Forma Eterea','activation':'action','kind':'special','effect':{'travelBetween':['material-plane','ethereal-plane']},'summaryIt':'Azione passa Materiale/Etereo o viceversa.'}]
        else:
            m['speedFt']['burrow']=20;m['conditionalDamageResistances']=[{'types':['piercing','slashing'],'condition':'nonmagical-weapons-not-adamantine'}]
            m['traits']=[trait('earth-glide','Scivolare nella Terra',{'burrowThrough':'nonmagical-unworked-earth-and-stone','disturbsMaterial':False},'Attraversa terra e pietra non magiche non lavorate senza perturbarle.'),
              trait('stone-camouflage','Mimetismo di Pietra',{'advantageChecks':'dexterity-stealth-to-hide-in-rocky-terrain'},'Vantaggio Furtività per nascondersi tra rocce.'),
              trait('treasure-sense','Senso del Tesoro',{'sense':'smell','pinpoints':'precious-metals-and-stones','rangeFt':60},'Fiuta e localizza con precisione metalli e pietre preziose entro sessanta piedi.')]
            m['actions']=[{'index':'multiattack','nameIt':'Multiattacco','activation':'action','kind':'multiattack','effect':{'attacks':[{'actionIndex':'claw','count':3},{'actionIndex':'bite','count':1}]},'summaryIt':'Tre artigli e un morso.'},attack(('claw','Artiglio',6,'one-target',6,'1d6+3','slashing')),attack(('bite','Morso',6,'one-target',13,'3d6+3','piercing'))]
        e=record('creature',index,'Succubus/Incubus' if succ else index.replace('-',' ').title(),it,page,m,it+': '+' '.join(t['summaryIt'] for t in m['traits'])+' '+' '.join(a['summaryIt'] for a in m['actions']),book='mm')
        e['sources'][0].update(printedPages=[page-1],verification='read-local-render')
        if gith:e['sources'].append(source(12,'Psionics and Limited Usage',book='mm'));e['sources'][-1]['printedPages']=[11];e['fieldSources']['traits']=[0,1]
        if deps:e['relations']={'dependencyIds':sorted(set(deps))}
        e['reviewScope']='individual-stat-block-read; full-MM-inventory-pending';result.append(e)
    return result


def remaining_slaad_records():
    """Other five slaad blocks, MM PDF 275/277–278; control gem is optional."""
    spells=lambda names:['phb2014:spell:'+x for x in names.split()]
    control=next(e for e in artifact_creatures() if e['index']=='death-slaad')['mechanics']['optionalVariants']
    rows=[('slaad-tadpole','Girino Slaad',277,'Tiny',12,False,10,'4d4',[7,15,10,3,5,3],{'stealth':4},7,.125,25),
          ('red-slaad','Slaad Rosso',277,'Large',14,True,93,'11d10+33',[16,12,16,6,6,7],{'perception':1},11,5,1800),
          ('blue-slaad','Slaad Blu',277,'Large',15,True,123,'13d10+52',[20,15,18,7,7,9],{'perception':1},11,7,2900),
          ('green-slaad','Slaad Verde',278,'Large',16,True,127,'15d10+45',[18,15,16,11,8,12],{'arcana':3,'perception':2},12,8,3900),
          ('gray-slaad','Slaad Grigio',278,'Medium',18,True,127,'17d8+51',[17,17,16,13,8,14],{'arcana':5,'perception':6},16,9,5000)]
    result=[]
    for index,it,page,size,ac,natural,hp,hpdice,abilities,skills,passive,cr,xp in rows:
        tadpole=index=='slaad-tadpole';green=index=='green-slaad';gray=index=='gray-slaad';shifter=green or gray;deps=[]
        m={'size':size,'type':'aberration','alignment':'chaotic-neutral','armorClass':{'value':ac,'source':'natural-armor' if natural else 'unspecified'},'hitPoints':{'average':hp,'dice':hpdice},'speedFt':{'walk':30},
           'abilities':dict(zip(ABILITIES,abilities,strict=True)),'savingThrowBonuses':{},'skillBonuses':skills,'sensesFt':{'darkvision':60,**({'blindsight':60 if gray else 30} if shifter else {})},'passivePerception':passive,
           'languages':['slaad'],'challengeRating':cr,'experiencePoints':xp,'damageVulnerabilities':[],'damageResistances':['acid','cold','fire','lightning','thunder'],'damageImmunities':[],'conditionImmunities':[],
           'traits':[trait('magic-resistance','Resistenza alla Magia',{'advantageSavingThrowsAgainst':['spells','other-magical-effects']},'Vantaggio TS contro magie e altri effetti magici.')],'actions':[],'reactions':[],'legendaryActions':[]}
        if tadpole:
            m['cannotSpeak']=True;m['understandsLanguagesOnly']=True;m['creatureTags']=['slaad','juvenile']
            m['actions']=[attack(('bite','Morso',4,'one-target',4,'1d4+2','piercing'))]
            m['traits'].append(trait('maturation','Maturazione',{'maturesAfterHoursDice':'2d12','adultFormIds':['mm2014:creature:blue-slaad','mm2014:creature:green-slaad'],
              'greenIfHostCouldCastSpellLevelAtLeast':3,'otherwise':'blue-slaad'},'Dopo nascita matura entro 2d12 ore in blu o verde se l’ospite poteva lanciare magie almeno terzo livello.'))
        else:
            m['telepathyFt']=60;m['creatureTags']=['slaad']+(['shapechanger'] if shifter else [])
            m['traits'].append(trait('regeneration','Rigenerazione',{'startOwnTurnRegainsHP':10,'requiresHPAtLeast':1},'Recupera dieci PF a inizio turno soltanto se ne ha almeno uno.'))
            m['optionalVariants']=copy.deepcopy(control);deps+=spells('imprisonment wish greater-restoration')
            if shifter:
                m['traits'].append(trait('shapechanger','Mutaforma',{'activation':'action','forms':['Small-humanoid','Medium-humanoid','true-form'],'onlyStatisticChanged':'size','equipment':'unchanged','onDeath':'revert'},'Azione umanoide Piccolo/Medio o vera forma; cambia solo taglia, non equipaggiamento, morte ripristina.'))
                at=spells('detect-magic detect-thoughts mage-hand' if green else 'detect-magic detect-thoughts invisibility mage-hand major-image')
                two=spells('fear invisibility' if green else 'fear fly fireball tongues');one=spells('fireball' if green else 'plane-shift');deps+=at+two+one
                m['traits'].append(trait('innate-spellcasting','Incantesimi Innati',{'castingAbility':'charisma','spellSaveDC':12 if green else 14,'materialComponentsRequired':False,'atWillSpellIds':at,'twicePerDayEachSpellIds':two,'oncePerDayEachSpellIds':one,'selfOnlySpellIds':spells('invisibility'+('' if green else ' plane-shift'))},'Innate Carisma CD '+('dodici' if green else 'quattordici')+' senza materiali. Invisibilità solo sé; '+('Palla di Fuoco una al giorno.' if green else 'Spostamento Planare una al giorno solo sé.')))
                if gray:
                    m['traits'].append(trait('magic-weapons','Armi Magiche',{'weaponAttacks':'magical'},'Attacchi con armi magici.'))
                    m['traits'].append(trait('death-transformation','Trasformazione della Morte',{'requires':'eat-entire-corpse-of-dead-death-slaad','transformsInstantlyInto':'mm2014:creature:death-slaad'},'Mangiare interamente il cadavere di slaad della morte lo trasforma immediatamente in uno della morte.'))
                else:m['traits'].append(trait('gray-transformation','Trasformazione Grigia',{'requires':'unlock-magical-knowledge','transformsInto':'mm2014:creature:gray-slaad','instantaneousWhenUnlocked':True,'permanent':True,'timeToLearn':'unpredictable-years-or-decades-not-fixed-progression'},'Conoscenza magica acquisita in un tempo imprevedibile consente trasformazione immediata permanente in grigio; nessun avanzamento a tempo fisso.'))
            bonus={'red-slaad':6,'blue-slaad':8,'green-slaad':7,'gray-slaad':7}[index]
            bite=attack(('bite','Morso',bonus,'one-target',{'red-slaad':8,'blue-slaad':12,'green-slaad':11,'gray-slaad':6}[index],{'red-slaad':'2d4+3','blue-slaad':'2d6+5','green-slaad':'2d6+4','gray-slaad':'1d6+3'}[index],'piercing'))
            claw=attack(('claw','Artiglio',bonus,'one-target',{'red-slaad':7,'blue-slaad':12,'green-slaad':7,'gray-slaad':8}[index],{'red-slaad':'1d8+3','blue-slaad':'2d6+5','green-slaad':'1d6+4','gray-slaad':'1d10+3'}[index],'piercing' if index=='red-slaad' else 'slashing'))
            if index=='red-slaad':
                claw['effect']={'ifTargetHumanoid':{'save':{'ability':'constitution','dc':14},'failureDisease':{'index':'slaad-egg','maximumEggsCarriedToTerm':1,'gestationMonths':3,
                  'finalTwentyFourHours':{'speedMultiplier':.5,'disadvantage':['attack-rolls','ability-checks','saving-throws']},'birthRounds':1,'birth':'tadpole-emerges-killing-host','cureBeforeEmergence':'unborn-slaad-disintegrates'}}}
                claw['summaryIt']+=' Umanoide TS Costituzione quattordici o uovo-malattia; un uovo a termine, tre mesi, ultime ventiquattro ore metà velocità e svantaggio attacchi/prove/TS. Nascita in un round uccide ospite; curare prima disintegra il girino.'
            elif index=='blue-slaad':
                claw['effect']={'ifTargetHumanoid':{'save':{'ability':'constitution','dc':15},'failureDisease':{'index':'chaos-phage','cannotRegainHP':True,'everyHours':24,'reducesHitPointMaximum':{'average':10,'dice':'3d6'},
                  'maximumReducedToZero':'instantly-transforms-red-slaad-or-green-if-can-cast-third-level-spells','minimumSpellLevelForGreen':3,'onlyReversesTransformation':'phb2014:spell:wish'}}}
                claw['summaryIt']+=' Umanoide TS Costituzione quindici o Fago del Caos: niente guarigione, massimo PF meno 3d6 ogni ventiquattro ore. Zero trasforma rosso o verde se può lanciare almeno terzo livello; solo Desiderio inverte trasformazione.';deps+=spells('wish')
            elif shifter:
                for a in [bite,claw]:a['effect']={'requires':'slaad-form'};a['summaryIt']+=' Solo forma slaad.'
            multi={'index':'multiattack','nameIt':'Multiattacco','activation':'action','kind':'multiattack','effect':{'attacks':[{'actionIndex':'bite','count':1},{'actionIndex':'claw','count':2}]},'summaryIt':'Un morso e due artigli.'}
            m['actions']=[multi,bite,claw]
            if shifter:
                weapon=attack(('staff' if green else 'greatsword','Bastone' if green else 'Spadone',7,'one-target',11 if green else 10,'2d6+4' if green else '2d6+3','bludgeoning' if green else 'slashing'))
                multi['effect']={'attacks':[{'actionIndex':'bite','count':1}],'remainingAttacks':{'count':2,'eachActionIndexChoice':['claw',weapon['index']]}};multi['summaryIt']='Un morso e due attacchi a scelta tra artigli e '+('bastone.' if green else 'spadone.')
                m['actions'].append(weapon)
                if green:
                    multi['effect']['alternative']={'actionIndex':'hurl-flame','count':2};multi['summaryIt']+=' In alternativa due Lanciare Fiamma.'
                    flame=attack(('hurl-flame','Lanciare Fiamma',4,'one-target',10,'3d6','fire'),{'ignites':'flammable-objects-not-worn-or-carried'});flame.update(kind='ranged-spell-attack',rangeFt={'normal':60,'long':60});flame.pop('reachFt');flame['summaryIt']='Attacco magico più quattro, gittata sessanta, 3d6 fuoco, incendia oggetti infiammabili non indossati o portati.';m['actions'].append(flame)
        e=record('creature',index,'Slaad Tadpole' if tadpole else index.replace('-',' ').title(),it,[page,275],m,it+': '+' '.join(t['summaryIt'] for t in m['traits'])+' '+' '.join(a['summaryIt'] for a in m['actions']),book='mm')
        e['sources'][0].update(printedPages=[page-1,274],verification='read-local-render');e['sources'].append(source(12,'Innate Spellcasting and Limited Usage',book='mm'));e['sources'][-1]['printedPages']=[11]
        e['fieldSources']['traits']=[0,1]
        if not tadpole:e['fieldSources']['optionalVariants']=[0]
        if deps:e['relations']={'dependencyIds':sorted(set(deps))}
        e['reviewScope']='individual-stat-block-read; control-gem-optional; full-MM-inventory-pending';result.append(e)
    return result


def normalize_outsider_multiattack(mechanics):
    """Use the existing action schema; no Attack-action or opportunity equivalence."""
    from collections import Counter
    multi=next((t for t in mechanics['traits'] if t['index']=='multiattack'),None)
    if not multi:return
    mechanics['traits'].remove(multi)
    effect=multi['effect'];effect.pop('activation')
    names=effect.pop('attacks')
    if names[0] in ['melee','any-attack']:
        effect['remainingAttacks']={'count':len(names),'eachActionIndexChoice':[a['index'] for a in mechanics['actions'] if a['kind'].endswith('-attack') and (names[0]=='any-attack' or a['kind'].startswith('melee'))]}
    else:effect['attacks']=[{'actionIndex':name,'count':count} for name,count in Counter(names).items()]
    if 'alternative' in effect:
        alt=effect.pop('alternative');effect['attackAlternatives']=[effect.pop('attacks'),[{'actionIndex':name,'count':count} for name,count in Counter(alt['attacks']).items()]]
        if alt.get('castSpells'):effect['alternativeAdditionalCastSpells']={'alternativeIndex':1,'count':alt['castSpells'],'from':'listed-innate-spells'}
    mechanics['actions'].insert(0,{'index':'multiattack','nameIt':'Multiattacco','activation':'action','kind':'multiattack','effect':effect,'summaryIt':'Sequenza propria di Multiattacco; componenti, alternative e sostituzioni indicate separatamente.'})
    for reaction in mechanics['reactions']:reaction.setdefault('kind','special')


def demon_records():
    """MM PDF 53/55–66: first printing, optional summons and typed families."""
    rows=[
      ('balor','Balor',56,'Huge',19,262,'21d12+126',{'walk':40,'fly':80},[26,15,22,20,16,22],{'strength':14,'constitution':12,'wisdom':9,'charisma':12},{},'truesight',13,19,22000,6),
      ('barlgura','Barlgura',57,'Large',15,68,'8d10+24',{'walk':30,'climb':30},[18,15,16,7,14,9],{'dexterity':5,'constitution':6},{'perception':5,'stealth':5},'darkvision',15,5,1800,1),
      ('chasme','Chasme',58,'Large',15,84,'13d10+13',{'walk':20,'fly':60},[15,15,12,11,14,10],{'dexterity':5,'wisdom':5},{'perception':5},'darkvision',15,6,2300,2),
      ('dretch','Dretch',58,'Small',11,18,'4d6+4',{'walk':20},[11,11,12,5,8,3],{}, {},'darkvision',9,.25,50,None),
      ('glabrezu','Glabrezu',59,'Large',17,157,'15d10+75',{'walk':40},[20,15,21,19,17,16],{'strength':9,'constitution':9,'wisdom':7,'charisma':7},{},'truesight',13,9,5000,3),
      ('goristro','Goristro',60,'Huge',19,310,'23d12+161',{'walk':40},[25,11,25,6,13,14],{'strength':13,'dexterity':6,'constitution':13,'wisdom':7},{'perception':7},'darkvision',17,17,18000,6),
      ('hezrou','Hezrou',61,'Large',16,136,'13d10+65',{'walk':30},[19,17,20,5,12,13],{'strength':7,'constitution':8,'wisdom':4},{},'darkvision',11,8,3900,2),
      ('marilith','Marilith',62,'Large',18,189,'18d10+90',{'walk':40},[18,20,20,18,16,20],{'strength':9,'constitution':10,'wisdom':8,'charisma':10},{},'truesight',13,16,15000,5),
      ('nalfeshnee','Nalfeshnee',63,'Large',18,184,'16d10+96',{'walk':20,'fly':30},[21,10,22,19,12,15],{'constitution':11,'intelligence':9,'wisdom':6,'charisma':7},{},'truesight',11,13,10000,4),
      ('shadow-demon','Demone d’Ombra',65,'Medium',13,66,'12d8+12',{'walk':30,'fly':30},[1,17,12,14,13,14],{'dexterity':5,'charisma':4},{'stealth':7},'darkvision',11,4,1100,1),
      ('vrock','Vrock',65,'Large',15,104,'11d10+44',{'walk':40,'fly':60},[17,15,18,8,13,8],{'dexterity':5,'wisdom':4,'charisma':2},{},'darkvision',11,6,2300,1),
      ('yochlol','Yochlol',66,'Medium',15,136,'16d8+64',{'walk':30,'climb':30},[15,14,18,13,15,15],{'dexterity':6,'intelligence':5,'wisdom':6,'charisma':6},{'deception':10,'insight':6},'darkvision',12,10,5900,3),
    ]
    # Table PDF 53 supplies examples, not an exhaustive taxonomy of all supplements.
    summon={
      'balor':(50,[('vrock','1d8'),('hezrou','1d6'),('glabrezu','1d4'),('nalfeshnee','1d3'),('marilith','1d2'),('goristro',1)]),
      'barlgura':(30,[('barlgura',1)]),'chasme':(30,[('chasme',1)]),
      'glabrezu':(30,[('vrock','1d3'),('hezrou','1d2'),('glabrezu',1)]),'hezrou':(30,[('dretch','2d6'),('hezrou',1)]),
      'marilith':(50,[('vrock','1d6'),('hezrou','1d4'),('glabrezu','1d3'),('nalfeshnee','1d2'),('marilith',1)]),
      'nalfeshnee':(50,[('vrock','1d4'),('hezrou','1d3'),('glabrezu','1d2'),('nalfeshnee',1)]),
      'vrock':(30,[('dretch','2d4'),('vrock',1)]),'yochlol':(50,[('yochlol',1)])}
    out=[]
    for index,it,page,size,ac,hp,dice,speed,abilities,saves,skills,sense,passive,cr,xp,demon_type in rows:
        shadow=index=='shadow-demon'
        m={'size':size,'type':'fiend','creatureTags':['demon']+(['shapechanger'] if index=='yochlol' else []),'alignment':'chaotic-evil','armorClass':{'value':ac,'source':'unspecified' if shadow else 'natural-armor'},'hitPoints':{'average':hp,'dice':dice},'speedFt':speed,'abilities':dict(zip(ABILITIES,abilities,strict=True)),
           'savingThrowBonuses':saves,'skillBonuses':skills,'sensesFt':{sense:60 if index=='dretch' else 120},'passivePerception':passive,'languages':['abyssal','elvish','undercommon'] if index=='yochlol' else ['abyssal'],'challengeRating':cr,'experiencePoints':xp,
           'damageVulnerabilities':['radiant'] if shadow else [],'damageResistances':['acid','fire','necrotic','thunder'] if shadow else ['cold','lightning']+([] if index=='balor' else ['fire']),
           'damageImmunities':['cold','lightning','poison'] if shadow else ['fire','poison'] if index=='balor' else ['poison'],'conditionImmunities':['exhaustion','grappled','paralyzed','petrified','poisoned','prone','restrained'] if shadow else ['poisoned'],
           'traits':[],'actions':[],'reactions':[],'legendaryActions':[],'demonType':demon_type}
        if index not in ['barlgura','chasme','dretch']:m['conditionalDamageResistances']=[{'types':['bludgeoning','piercing','slashing'],'condition':'nonmagical-weapons'}]
        if index not in ['goristro','yochlol']:m['telepathyFt']=60 if index=='dretch' else 120
        if index=='dretch':m['telepathyRestriction']='only-creatures-understanding-abyssal'
        if index=='barlgura':m['sensesFt']['blindsight']=30
        if index=='chasme':m['sensesFt']['blindsight']=10
        if index not in ['barlgura','dretch','shadow-demon']:m['traits'].append(trait('magic-resistance','Resistenza alla Magia',{'advantageSavingThrowsAgainst':['spells','other-magical-effects']},'Vantaggio TS contro incantesimi e altri effetti magici.'))
        if index in ['balor','marilith']:m['traits'].append(trait('magic-weapons','Armi Magiche',{'weaponAttacks':'magical'},'Attacchi con armi magici.'))
        deps=[]
        def a(key,name,bonus,avg,damage_dice,kind,reach=5,**effect):
            act=attack((key,name,bonus,'one-target',avg,damage_dice,'slashing' if kind=='psychic' else kind),effect)
            act.update(reachFt=reach,damage={'average':avg,'dice':damage_dice,'type':kind});act['summaryIt']=f'{name}: attacco {bonus:+}, portata {reach} piedi; {damage_dice} danni ({kind}).'
            m['actions'].append(act);return act
        def special(key,name,effect,summary):m['actions'].append({'index':key,'nameIt':name,'activation':'action','kind':'special','effect':effect,'summaryIt':summary})
        def multi(attack_list,**extra):m['traits'].append(trait('multiattack','Multiattacco',{'activation':'action','attacks':attack_list,**extra},'Sequenza di attacchi distinta da Attaccare; alternative strutturate.'))
        def t(key,name,effect,summary):m['traits'].append(trait(key,name,effect,summary))
        def innate(ability,dc,at='',one='',two='',selfonly=''):
            ids=lambda names:['phb2014:spell:'+n for n in names.split()]
            e={'castingAbility':ability,'spellSaveDC':dc,'materialComponentsRequired':False,'atWillSpellIds':ids(at),'oncePerDayEachSpellIds':ids(one),'twicePerDayEachSpellIds':ids(two),'selfOnlySpellIds':ids(selfonly)}
            deps.extend(ids(at+' '+one+' '+two));t('innate-spellcasting','Incantesimi Innati',e,'Incantesimi innati senza materiali; caratteristica, CD, liste e frequenze riportate separatamente.')
        if index=='balor':
            multi(['longsword','whip']);a('longsword','Spada Lunga',14,21,'3d8+8','slashing',10,additionalDamage={'average':13,'dice':'3d8','type':'lightning'},criticalDamageDiceMultiplier=3)
            a('whip','Frusta',14,15,'2d6+8','slashing',30,additionalDamage={'average':10,'dice':'3d6','type':'fire'},save={'ability':'strength','dc':20,'failurePushTowardBalorUpToFt':25})
            t('death-throes','Spasmi Mortali',{'when':'dies','radiusFt':30,'save':{'ability':'dexterity','dc':20},'failureDamage':'20d6-fire','successDamage':'half','ignites':'flammable-objects-not-worn-or-carried','destroysOwnWeapons':True},'Morte: entro trenta TS Destrezza venti, 20d6 fuoco dimezzati; incendia oggetti liberi e distrugge le proprie armi.')
            t('fire-aura','Aura di Fuoco',{'startOwnTurnRadiusFt':5,'damage':'3d6-fire','ignitesUnwornUncarriedObjects':True,'touchOrHitByMeleeWithinFiveFt':'attacker-takes-3d6-fire'},'Inizio turno, creature entro cinque subiscono 3d6 fuoco; tocco o colpo in mischia entro cinque infligge altrettanto all’attaccante.')
        elif index=='barlgura':
            innate('wisdom',13,one='entangle phantasmal-force',two='disguise-self invisibility',selfonly='invisibility');multi(['bite','fist','fist']);a('bite','Morso',7,11,'2d6+4','piercing');a('fist','Pugno',7,9,'1d10+4','bludgeoning')
            t('reckless','Avventato',{'chooseAt':'start-own-turn','ownMeleeWeaponAttacks':'advantage-this-turn','attacksAgainstSelf':'advantage-until-start-own-next-turn'},'Può ottenere vantaggio in mischia nel turno, concedendolo agli attacchi contro sé fino al prossimo.')
            t('running-leap','Salto con Rincorsa',{'requiresRunningStart':True,'longJumpFt':40,'highJumpFt':20},'Con rincorsa salta quaranta in lungo o venti in alto.')
        elif index=='chasme':
            t('drone','Ronzio',{'trigger':'non-demon-starts-own-turn-within-thirty-ft','save':{'ability':'constitution','dc':12},'cannotHear':'automatically-succeeds','failure':'unconscious-ten-minutes','ends':['takes-damage','another-creature-action-splashes-holy-water'],'successfulSaveOrEndImmunityHours':24},'Non demone inizio turno entro trenta: TS Costituzione dodici; sordo supera automaticamente. Incosciente dieci minuti, danno o acqua benedetta azione altrui termina; successo o termine immunità ventiquattro ore.')
            a('proboscis','Proboscide',5,16,'4d6+2','piercing',additionalDamage={'average':24,'dice':'7d6','type':'necrotic'},maximumHPReduction='actual-necrotic-damage',atMaximumZero='dies',reductionEnds=['long-rest','greater-restoration-or-equivalent'])['target']='one-creature';deps+=['phb2014:spell:greater-restoration']
        elif index=='dretch':
            multi(['bite','claws']);a('bite','Morso',2,3,'1d6','piercing');a('claws','Artigli',2,5,'2d4','slashing')
            special('fetid-cloud','Nube Fetida',{'uses':1,'recovery':'long-rest','radiusFt':10,'obscurity':'light','spreadsAroundCorners':True,'durationMinutes':1,'endsAlso':'strong-wind','trigger':'creature-starts-own-turn-in-area','save':{'ability':'constitution','dc':11},'failure':'poisoned-until-start-own-next-turn','whilePoisoned':{'actionOrBonusOnlyOne':True,'reactionsAllowed':False}},'Nube dieci, poco oscurata, aggira angoli; un minuto o vento forte. Inizio turno TS Costituzione undici o avvelenato fino al prossimo, azione oppure bonus e nessuna reazione.')
        elif index=='glabrezu':
            innate('intelligence',16,at='darkness detect-magic dispel-magic',one='confusion fly power-word-stun');multi(['pincer','pincer','fist','fist'],alternative={'attacks':['pincer','pincer'],'castSpells':1})
            a('pincer','Chela',9,16,'2d10+5','bludgeoning',10,grapple={'targetMaximumSize':'Medium','escapeDC':15,'pincers':2,'maximumTargetsEach':1});a('fist','Pugno',9,7,'2d4+2','bludgeoning')
        elif index=='goristro':
            multi(['fist','fist','hoof']);a('fist','Pugno',13,20,'3d8+7','bludgeoning',10);a('hoof','Zoccolo',13,23,'3d10+7','bludgeoning',save={'ifCreature':True,'ability':'strength','dc':21,'failure':'prone'});a('gore','Incornata',13,45,'7d10+7','piercing',10)
            t('charge','Carica',{'straightApproachFt':15,'thenHit':'gore-same-turn','extraDamage':'7d10-piercing','creatureSave':{'ability':'strength','dc':21,'failurePushAwayUpToFt':20,'failureCondition':'prone'}},'Quindici piedi diritti e incornata nello stesso turno: extra 7d10; creatura TS Forza ventuno o spinta fino venti e prona.')
            t('labyrinthine-recall','Memoria del Labirinto',{'perfectlyRecalls':'any-path-travelled'},'Ricorda perfettamente qualsiasi percorso compiuto.');t('siege-monster','Mostro d’Assedio',{'damageMultiplierAgainst':['objects','structures'],'multiplier':2},'Danni doppi a oggetti e strutture.')
        elif index=='hezrou':
            multi(['bite','claws','claws']);a('bite','Morso',7,15,'2d10+4','piercing');a('claws','Artigli',7,11,'2d6+4','slashing')
            t('stench','Fetore',{'trigger':'creature-starts-own-turn-within-ten-ft','save':{'ability':'constitution','dc':14},'failure':'poisoned-until-start-own-next-turn','successfulSaveImmunityHours':24,'effectEndAloneGrantsImmunity':False},'Inizio turno entro dieci TS Costituzione quattordici o avvelenato fino al prossimo; soltanto TS riuscito concede immunità ventiquattro ore.')
        elif index=='marilith':
            multi(['longsword']*6+['tail']);a('longsword','Spada Lunga',9,13,'2d8+4','slashing');a('tail','Coda',9,15,'2d10+4','bludgeoning',10,grapple={'targetMaximumSize':'Medium','escapeDC':19,'restrained':True,'tailHitsGrappledTargetAutomatically':True,'cannotTailAttackOthersUntilEnds':True})['target']='one-creature'
            t('reactive','Reattiva',{'maximumReactionsEachCombatTurn':1,'notLimitedToOwnTurn':True},'Una reazione in ciascun turno di combattimento.')
            m['reactions']=[{'index':'parry','nameIt':'Parata','activation':'reaction','effect':{'trigger':'one-melee-attack-would-hit','requires':['see-attacker','wield-melee-weapon'],'armorClassBonusAgainstTrigger':5},'summaryIt':'Parata più cinque CA contro un colpo in mischia, vedendo attaccante e impugnando arma da mischia.'}]
        elif index=='nalfeshnee':
            multi(['bite','claws','claws'],beforeAttacksUseIfAvailable='horror-nimbus');a('bite','Morso',10,32,'5d10+5','piercing');a('claws','Artigli',10,15,'3d6+5','slashing',10)
            special('horror-nimbus','Aura d’Orrore',{'magical':True,'recharge':{'d6Minimum':5,'when':'start-of-own-turn','alsoRecovery':['short-rest','long-rest']},'rangeFt':15,'targets':'creatures-that-see-nalfeshnee','save':{'ability':'wisdom','dc':15},'failure':'frightened-one-minute','repeatSave':'end-own-turn-success-ends','successfulSaveOrEndImmunityHours':24},'Luce magica, ricarica cinque–sei: entro quindici e in vista TS Saggezza quindici, spaventato un minuto, ripete fine turno; successo o termine immunità ventiquattro ore.')
        elif shadow:
            t('incorporeal-movement','Movimento Incorporeo',{'movesThrough':['creatures','objects'],'asTerrain':'difficult','endsOwnTurnInsideObjectDamage':'1d10-force'},'Attraversa creature e oggetti come terreno difficile; termina dentro oggetto subisce d10 forza.')
            t('light-sensitivity','Sensibilità alla Luce',{'inBrightLightDisadvantage':['attack-rolls','wisdom-perception-using-sight']},'In luce intensa svantaggio attacchi e Percezione visiva.')
            t('shadow-stealth','Furtività nell’Ombra',{'activation':'bonus-action','action':'Hide','requiresLightAny':['dim','darkness']},'Nascondersi bonus in luce fioca o oscurità.')
            t('shadow-nature','Natura d’Ombra',{'needs':{'air':False,'food':False,'drink':False,'sleep':False}},'Non necessita aria, cibo, bevande o sonno.')
            a('claws','Artigli',5,10,'2d6+3','psychic',damageIfAttackAdvantage={'average':17,'dice':'4d6+3','type':'psychic'})['target']='one-creature'
        elif index=='vrock':
            multi(['beak','talons']);a('beak','Becco',6,10,'2d6+3','piercing');a('talons','Artigli',6,14,'2d10+3','slashing')
            special('spores','Spore',{'recharge':{'d6Minimum':6,'when':'start-of-own-turn','alsoRecovery':['short-rest','long-rest']},'radiusFt':15,'spreadsAroundCorners':True,'save':{'ability':'constitution','dc':14},'failure':'poisoned','startPoisonedTargetTurnDamage':'1d10-poison','repeatSave':'end-own-turn-success-ends','endsAlso':'empty-vial-holy-water-on-target','holyWaterActionCost':'not-stated','maximumDuration':'not-stated'},'Ricarica sei; raggio quindici, aggira angoli. TS Costituzione quattordici o avvelenato, d10 veleno a inizio turno, ripete fine turno. Versare una fiala benedetta termina; durata massima e costo dell’acqua non specificati.')
            special('stunning-screech','Stridio Stordente',{'uses':1,'recovery':'long-rest','radiusFt':20,'targets':'non-demons-that-hear','save':{'ability':'constitution','dc':14},'failure':'stunned-until-end-vrock-next-turn'},'Una per riposo lungo, non demoni che sentono entro venti: TS Costituzione quattordici o storditi fino fine prossimo turno vrock.')
        else:
            innate('charisma',14,at='detect-thoughts web',one='dominate-person');multi(['melee','melee'])
            t('shapechanger','Mutaforma',{'activation':'action','forms':['resembles-female-drow','giant-spider','true-form'],'statistics':'same-in-each-form','equipmentTransforms':False,'death':'reverts-true-form'},'Azione aspetto drow femminile o ragno gigante o vera forma; statistiche identiche, equipaggiamento invariato, morte ripristina.')
            t('web-walker','Camminare sulle Ragnatele',{'ignoresMovementRestrictionsFrom':'webbing'},'Ignora restrizioni di movimento delle ragnatele.')
            a('slam','Schianto / Morso',6,5,'1d6+2','bludgeoning',additionalDamage={'average':21,'dice':'6d6','type':'poison'},reachFtInDemonForm=10,damageTypeInSpiderForm='piercing')
            special('mist-form','Forma di Nebbia',{'activation':'action','choose':['toxic-mist','true-form'],'equipmentTransforms':True,'death':'reverts-true-form','whileMist':{'condition':'incapacitated','canSpeak':False,'flySpeedFt':30,'canHover':True,'passesThrough':'any-non-airtight-space','savingThrowAdvantage':['strength','dexterity','constitution'],'damageImmunity':'nonmagical-damage','canEnterAndEndInCreatureSpace':True},'creatureStartsOwnTurnSharingSpace':{'save':{'ability':'constitution','dc':14},'failure':'poisoned-until-start-own-next-turn','whilePoisoned':'incapacitated'},'revertWhileIncapacitated':'interpretation-pending-no-automatic-exception'},'Azione nebbia tossica o ritorno, trasforma anche equipaggiamento. Nebbia incapacitata e muta, volo trenta fluttuante, passa varchi non ermetici, vantaggio TS fisici e immunità danni non magici. Cooccupante inizio turno TS Costituzione quattordici o avvelenato e incapacitato fino al prossimo; ritorno mentre incapacitato resta questione aperta.')
        if index in ['chasme','yochlol']:t('spider-climb','Scalare come Ragno',{'climbsDifficultSurfacesAndCeilingsWithoutCheck':True},'Scala superfici difficili e soffitti senza prove.')
        if index in ['balor','marilith','nalfeshnee']:special('teleport','Teletrasporto',{'magical':True,'rangeFt':120,'destination':'visible-unoccupied-space','includes':'worn-and-carried-equipment'},'Azione teletrasporta sé ed equipaggiamento fino centoventi in spazio libero visibile.')
        if index in summon:
            chance,choices=summon[index];m['optionalVariants']=[{'requiresDMApproval':True,'nameIt':'Evocazione Demoniaca','effect':{'activation':'action','uses':1,'recovery':'long-rest','successPercent':chance,'choices':[{'creatureId':'mm2014:creature:'+cid,'quantityDice':qty} if isinstance(qty,str) else {'creatureId':'mm2014:creature:'+cid,'quantity':qty} for cid,qty in choices],'destination':{'unoccupied':True,'withinFt':60},'attitude':'ally','maySummonFurtherDemons':False,'durationMinutes':1,'endsAlso':['summoned-dies','summoner-dies','summoner-action-dismisses'],'selectedCreatureRequiresVerifiedStatBlock':True}}]
        normalize_outsider_multiattack(m)
        e=record('creature',index,index.replace('-',' ').title(),it,[page,53]+([55] if index in summon or shadow else []),m,'Demone del MM 2014; famiglia distinta dal grado di sfida. '+ ' '.join(x['summaryIt'] for x in m['traits']+m['actions']),book='mm')
        e['sources'][0].update(printedPages=[p-1 for p in e['sources'][0]['pdfPages']],verification='read-local-render')
        if deps:e['relations']={'spellIds':sorted(set(deps)),'dependencyIds':sorted(set(deps))}
        if index=='yochlol':e['verification'].update(complete=False,missingFields=['mist-form.revert-action-while-incapacitated'])
        e['reviewScope']='individual-stat-block-reviewed; optional-summon-selection-requires-verified-choice; full-MM-inventory-pending';out.append(e)
    return out


def devil_records():
    """MM 68/69/71–79. Infernal rank comes from the hierarchy, not CR."""
    rows=[
      ('barbed-devil','Diavolo Uncinato',71,'Medium',15,110,'13d8+52',{'walk':30},[16,17,18,12,14,14],{'strength':6,'constitution':7,'wisdom':5,'charisma':5},{'deception':5,'insight':5,'perception':8},18,5,1800,'lesser'),
      ('bearded-devil','Diavolo Barbuto',71,'Medium',13,52,'8d8+16',{'walk':30},[16,15,15,9,11,11],{'strength':5,'constitution':4,'wisdom':2},{},10,3,700,'lesser'),
      ('bone-devil','Diavolo d’Ossa',72,'Large',19,142,'15d10+60',{'walk':40,'fly':40},[18,16,18,13,14,16],{'intelligence':5,'wisdom':6,'charisma':7},{'deception':7,'insight':6},12,9,5000,'lesser'),
      ('chain-devil','Diavolo delle Catene',73,'Medium',16,85,'10d8+40',{'walk':30},[18,15,18,11,12,14],{'constitution':7,'wisdom':4,'charisma':5},{},11,8,3900,'lesser'),
      ('erinyes','Erinni',74,'Medium',18,153,'18d8+72',{'walk':30,'fly':60},[18,16,18,14,14,18],{'dexterity':7,'constitution':8,'wisdom':6,'charisma':8},{},12,12,8400,'greater'),
      ('horned-devil','Diavolo Cornuto',75,'Large',18,178,'17d10+55',{'walk':20,'fly':60},[22,17,21,12,16,17],{'strength':10,'dexterity':7,'wisdom':7,'charisma':7},{},13,11,7200,'greater'),
      ('ice-devil','Diavolo del Ghiaccio',76,'Large',18,180,'19d10+76',{'walk':40},[21,14,18,18,15,18],{'dexterity':7,'constitution':9,'wisdom':7,'charisma':9},{},12,14,11500,'greater'),
      ('lemure','Lemure',77,'Medium',7,13,'3d8',{'walk':15},[10,5,11,1,11,3],{},{},10,0,10,'lemure'),
      ('pit-fiend','Diavolo della Fossa',78,'Large',19,300,'24d10+168',{'walk':30,'fly':60},[26,14,24,22,18,24],{'dexterity':8,'constitution':13,'wisdom':10},{},14,20,25000,'greater'),
      ('spined-devil','Diavolo Spinato',79,'Small',13,22,'5d6+5',{'walk':20,'fly':40},[10,15,12,11,14,8],{},{},12,2,450,'lesser'),
    ]
    summons={'barbed-devil':(30,[('barbed-devil',1)]),'bearded-devil':(30,[('bearded-devil',1)]),'bone-devil':(40,[('spined-devil','2d6'),('bone-devil',1)]),
       'erinyes':(50,[('spined-devil','3d6'),('bearded-devil','1d6'),('erinyes',1)]),'horned-devil':(30,[('horned-devil',1)]),'ice-devil':(60,[('ice-devil',1)]),'pit-fiend':(100,[('bearded-devil','2d4'),('barbed-devil','1d4'),('erinyes',1)])}
    out=[]
    for index,it,page,size,ac,hp,dice,speed,abilities,saves,skills,passive,cr,xp,rank in rows:
        lemure=index=='lemure';true=index in ['erinyes','pit-fiend']
        m={'size':size,'type':'fiend','creatureTags':['devil'],'devilRank':rank,'alignment':'lawful-evil','armorClass':{'value':ac,'source':'plate' if index=='erinyes' else 'unspecified' if lemure else 'natural-armor'},'hitPoints':{'average':hp,'dice':dice},'speedFt':speed,'abilities':dict(zip(ABILITIES,abilities,strict=True)),
           'savingThrowBonuses':saves,'skillBonuses':skills,'sensesFt':{'truesight' if true else 'darkvision':120},'passivePerception':passive,'languages':['infernal'],'challengeRating':cr,'experiencePoints':xp,'damageVulnerabilities':[],'damageResistances':[] if index=='ice-devil' else ['cold'],'damageImmunities':['fire','poison']+(['cold'] if index=='ice-devil' else []),'conditionImmunities':['charmed','frightened','poisoned'] if lemure else ['poisoned'],
           'traits':[],'actions':[],'reactions':[],'legendaryActions':[]}
        if not lemure:
            m['telepathyFt']=120;m['conditionalDamageResistances']=[{'types':['bludgeoning','piercing','slashing'],'condition':'nonmagical-weapons-not-silvered'}]
            m['traits'].append(trait('magic-resistance','Resistenza alla Magia',{'advantageSavingThrowsAgainst':['spells','other-magical-effects']},'Vantaggio TS contro incantesimi e altri effetti magici.'))
        else:m.update(cannotSpeak=True,understandsLanguagesOnly=True)
        if not true:m['traits'].append(trait('devils-sight','Vista del Diavolo',{'magicalDarknessImpedesDarkvision':False},'Oscurità magica non ostacola scurovisione.'))
        deps=[]
        def t(key,name,effect,summary):m['traits'].append(trait(key,name,effect,summary))
        def a(key,name,bonus,avg,dice,kind,reach=5,**effect):
            act=attack((key,name,bonus,'one-target',avg,dice,kind),effect);act['reachFt']=reach;act['summaryIt']=f'{name}: attacco {bonus:+}, portata {reach}; {dice} danni ({kind}).';m['actions'].append(act);return act
        def multi(attack_list,**extra):t('multiattack','Multiattacco',{'activation':'action','attacks':attack_list,**extra},'Sequenza di Multiattacco; alternative e sostituzioni distinte.')
        def wound(dc,dice):return {'ifTargetCreatureExcept':['undead','construct'],'save':{'ability':'constitution','dc':dc},'failure':'infernal-wound','startTargetTurnHitPointLossDice':dice,'furtherHitsIncreaseWoundDice':dice,'repeatSave':False,'ends':['any-creature-action-wisdom-medicine-DC-twelve-success','receives-magical-healing']}
        if index=='barbed-devil':
            multi(['tail','claw','claw'],alternative={'attacks':['hurl-flame','hurl-flame']});a('claw','Artiglio',6,6,'1d6+3','piercing');a('tail','Coda',6,10,'2d6+3','piercing')
            t('barbed-hide','Pelle Uncinata',{'startOwnTurn':'any-creature-grappling-devil-takes-1d10-piercing'},'A inizio turno chi sta afferrando il diavolo subisce d10 perforanti.')
        elif index=='bearded-devil':
            multi(['beard','glaive']);a('beard','Barba',5,6,'1d8+2','piercing',save={'ability':'constitution','dc':12},failure='poisoned-one-minute',whilePoisoned='cannot-regain-hit-points',repeatSave='end-own-turn-success-ends')['target']='one-creature'
            a('glaive','Falcione',5,8,'1d10+3','slashing',10,**wound(12,'1d10'))
            t('steadfast','Risoluto',{'cannotBeFrightenedIf':'sees-allied-creature-within-thirty-ft'},'Non può essere spaventato se vede un alleato entro trenta.')
        elif index=='bone-devil':
            multi(['claw','claw','sting']);a('claw','Artiglio',8,8,'1d8+4','slashing',10);a('sting','Pungiglione',8,13,'2d8+4','piercing',10,additionalDamage={'average':17,'dice':'5d6','type':'poison'},save={'ability':'constitution','dc':14},failure='poisoned-one-minute',repeatSave='end-own-turn-success-ends')
            m['optionalVariants']=[{'requiresDMApproval':True,'nameIt':'Arma ad Asta Uncinata','effect':{'replacesMultiattack':['hooked-polearm','sting'],'action':{'index':'hooked-polearm','attackBonus':8,'reachFt':10,'damage':{'average':17,'dice':'2d12+4','type':'piercing'},'grapple':{'targetMaximumSize':'Huge','escapeDC':14,'cannotPolearmOtherUntilEnds':True}}}}]
        elif index=='chain-devil':
            multi(['chain','chain']);a('chain','Catena',8,11,'2d6+4','slashing',10,grapple={'onlyIfDevilNotAlreadyGrapplingCreature':True,'escapeDC':14,'restrained':True,'startTargetTurnDamage':'2d6-piercing'})
            m['actions'].append({'index':'animate-chains','nameIt':'Animare Catene','activation':'action','kind':'special','effect':{'uses':1,'recovery':'short-or-long-rest','maximumChains':4,'rangeFt':60,'requires':['visible','not-worn-or-carried'],'chainsAre':'objects','chainStatistics':{'armorClass':20,'hitPoints':20,'damageResistances':['piercing'],'damageImmunities':['psychic','thunder']},'onOwnTurnMultiattack':'one-additional-chain-attack-per-animated-chain','eachChain':'can-grapple-one-creature-but-cannot-attack-while-grappling','ends':['chain-zero-hp','devil-incapacitated','devil-dies']},'summaryIt':'Azione anima fino quattro catene visibili libere entro sessanta, recupero breve/lungo. Oggetti CA venti PF venti, resistono perforanti, immuni psichici e tuono; un attacco ciascuna col Multiattacco, massimo un afferrato e non attaccano trattenendo. Termina a zero PF o incapacità/morte del diavolo.'})
            m['reactions']=[{'index':'unnerving-mask','nameIt':'Maschera Inquietante','activation':'reaction','effect':{'trigger':'visible-creature-starts-own-turn-within-thirty-ft','requires':'target-sees-devil','save':{'ability':'wisdom','dc':14},'failure':'frightened-until-end-target-current-turn'},'summaryIt':'Reazione all’inizio turno di creatura visibile entro trenta, vista reciproca: TS Saggezza quattordici o spaventata fino fine turno corrente.'}]
        elif index=='erinyes':
            multi(['any-attack']*3);a('longsword','Spada Lunga',8,8,'1d8+4','slashing',twoHandedDamage={'average':9,'dice':'1d10+4','type':'slashing'},additionalDamage={'average':13,'dice':'3d8','type':'poison'})
            bow=a('longbow','Arco Lungo',7,7,'1d8+3','piercing',additionalDamage={'average':13,'dice':'3d8','type':'poison'},save={'ability':'constitution','dc':14},failure='poisoned-until-lesser-restoration-or-equivalent-magic');bow.pop('reachFt');bow.update(kind='ranged-weapon-attack',rangeFt={'normal':150,'long':600})
            t('hellish-weapons','Armi Infernali',{'weaponAttacks':'magical','extraDamageOnWeaponHit':'3d8-poison','alreadyIncludedInListedAttacks':True},'Armi magiche aggiungono 3d8 veleno già inclusi negli attacchi.')
            m['reactions']=[{'index':'parry','nameIt':'Parata','activation':'reaction','effect':{'trigger':'one-melee-attack-would-hit','requires':['see-attacker','wield-melee-weapon'],'armorClassBonusAgainstTrigger':4},'summaryIt':'Parata più quattro CA contro un colpo in mischia, richiede vista e arma da mischia.'}]
            deps+=['phb2014:spell:lesser-restoration','dmg2014:magic-item:rope-of-entanglement'];m['optionalVariants']=[{'requiresDMApproval':True,'nameIt':'Corda dell’Intrappolamento','effect':{'itemId':'dmg2014:magic-item:rope-of-entanglement','multiattackReplaceAttacksCount':2,'with':'use-rope'}}]
        elif index=='horned-devil':
            multi(['fork','fork','tail'],mayReplaceAnyMeleeAttackWith='hurl-flame');a('fork','Forcone',10,15,'2d8+6','piercing',10);a('tail','Coda',10,10,'1d8+6','piercing',10,**wound(17,'3d6'))
        elif index=='ice-devil':
            m['sensesFt']['blindsight']=60;multi(['bite','claws','tail'])
            cold={'average':10,'dice':'3d6','type':'cold'}
            a('bite','Morso',10,12,'2d6+5','piercing',additionalDamage=cold);a('claws','Artigli',10,10,'2d4+5','slashing',additionalDamage=cold);a('tail','Coda',10,12,'2d6+5','bludgeoning',10,additionalDamage=cold)
            m['actions'].append({'index':'wall-of-ice','nameIt':'Muro di Ghiaccio','activation':'action','kind':'special','effect':{'magical':True,'recharge':{'d6Minimum':6,'when':'start-of-own-turn','alsoRecovery':['short-rest','long-rest']},'rangeFt':60,'requires':'visible-solid-surface','opaque':True,'thicknessFt':1,'forms':[{'lengthMaximumFt':30,'heightMaximumFt':10},{'hemisphereMaximumDiameterFt':20}],
               'appearsOnCreature':{'push':'shortest-route-out','creatureChoosesSideUnless':'incapacitated','thenSave':{'ability':'dexterity','dc':17},'failureDamage':'10d6-cold','successDamage':'half'},'durationMinutes':1,'endsAlso':['devil-incapacitated','devil-dies'],'tenFootSection':{'armorClass':5,'hitPoints':30,'damageVulnerabilities':['fire'],'damageImmunities':['acid','cold','necrotic','poison','psychic']},'destroyedSection':'frigid-air-until-rest-of-wall-vanishes','finishesMovingThroughFrigidAirOnAnyTurn':{'willingOrForced':True,'save':{'ability':'constitution','dc':17},'failureDamage':'5d6-cold','successDamage':'half'}},'summaryIt':'Ricarica sei; superficie solida visibile sessanta: muro opaco uno spesso, trenta per dieci o cupola venti. Spinge via occupanti con lato scelto salvo incapacitati, TS Destrezza diciassette 10d6 freddo dimezzati. Un minuto o incapacità/morte; sezioni dieci CA cinque PF trenta vulnerabili fuoco, immunità elencate. Sezione rotta lascia aria gelida, passaggio anche forzato TS Costituzione diciassette 5d6 freddo dimezzati.'})
            m['optionalVariants']=[{'requiresDMApproval':True,'nameIt':'Lancia di Ghiaccio','effect':{'replacesMultiattack':['ice-spear','tail'],'action':{'index':'ice-spear','attackBonus':10,'reachFt':10,'damage':{'average':14,'dice':'2d8+5','type':'piercing'},'additionalDamage':cold,'creatureSave':{'ability':'constitution','dc':15,'failureDurationMinutes':1,'speedReductionFt':10,'eitherActionOrBonusNotBoth':True,'reactionsAllowed':False,'repeatSave':'end-own-turn-success-ends'}}}}]
        elif lemure:
            a('fist','Pugno',3,2,'1d4','bludgeoning');deps+=['phb2014:spell:bless']
            t('hellish-rejuvenation','Ringiovanimento Infernale',{'when':'dies-in-Nine-Hells','returnsAfterDaysDice':'1d10','returnsFullHP':True,'preventedByAny':['killed-by-good-aligned-creature-with-bless-on-killer','remains-sprinkled-with-holy-water']},'Muore nei Nove Inferi: ritorna a pieni PF in d10 giorni salvo ucciso da creatura buona sotto Benedizione o resti aspersi d’acqua benedetta.')
        elif index=='pit-fiend':
            multi(['bite','claw','mace','tail']);a('bite','Morso',14,22,'4d6+8','piercing',save={'ability':'constitution','dc':21},failure='poisoned',whilePoisoned={'cannotRegainHP':True,'startOwnTurnDamage':'6d6-poison'},repeatSave='end-own-turn-success-ends');a('claw','Artiglio',14,17,'2d8+8','slashing',10);a('mace','Mazza',14,15,'2d6+8','bludgeoning',10,additionalDamage={'average':21,'dice':'6d6','type':'fire'});a('tail','Coda',14,24,'3d10+8','bludgeoning',10)
            t('fear-aura','Aura di Paura',{'trigger':'hostile-creature-starts-own-turn-within-twenty-ft','requires':'pit-fiend-not-incapacitated','save':{'ability':'wisdom','dc':21},'failure':'frightened-until-start-target-next-turn','successfulSaveImmunityHours':24,'effectEndAloneGrantsImmunity':False},'Ostile inizio turno entro venti se diavolo non incapacitato: TS Saggezza ventuno o spaventato fino al prossimo; TS riuscito immunità ventiquattro ore.')
            t('magic-weapons','Armi Magiche',{'weaponAttacks':'magical'},'Attacchi con armi magici.')
            ids=lambda names:['phb2014:spell:'+n for n in names.split()];deps+=ids('detect-magic fireball hold-monster wall-of-fire')
            t('innate-spellcasting','Incantesimi Innati',{'castingAbility':'charisma','spellSaveDC':21,'materialComponentsRequired':False,'atWillSpellIds':ids('detect-magic fireball'),'threePerDayEachSpellIds':ids('hold-monster wall-of-fire')},'Innate Carisma CD ventuno senza materiali: Individuazione del Magico e Palla di Fuoco a volontà; Blocca Mostri e Muro di Fuoco ciascuna tre al giorno.')
        else:
            multi(['bite','fork'],alternative={'attacks':['tail-spine','tail-spine']});a('bite','Morso',2,5,'2d4','slashing');a('fork','Forcone',2,3,'1d6','piercing')
            spine=a('tail-spine','Spina della Coda',4,4,'1d4+2','piercing',additionalDamage={'average':3,'dice':'1d6','type':'fire'},resourceCost=1);spine.pop('reachFt');spine.update(kind='ranged-weapon-attack',rangeFt={'normal':20,'long':80})
            t('flyby','Sorvolare',{'noOpportunityAttacksWhen':'flies-out-of-enemy-reach'},'Uscendo in volo dalla portata non provoca opportunità.');t('limited-spines','Spine Limitate',{'maximumSpines':12,'usedSpinesRegrowWhen':'finishes-long-rest'},'Dodici spine, ricrescono dopo riposo lungo.')
        if index in ['barbed-devil','horned-devil']:
            flame=a('hurl-flame','Scagliare Fiamma',5 if index=='barbed-devil' else 7,10 if index=='barbed-devil' else 14,'3d6' if index=='barbed-devil' else '4d6','fire',ignites='flammable-object-not-worn-or-carried');flame.pop('reachFt');flame.update(kind='ranged-spell-attack',rangeFt={'normal':150,'long':150})
        if index in summons:
            chance,choices=summons[index];m.setdefault('optionalVariants',[]).append({'requiresDMApproval':True,'nameIt':'Evocazione Infernale','effect':{'activation':'action','uses':1,'recovery':'long-rest','successPercent':chance,'choices':[{'creatureId':'mm2014:creature:'+cid,('quantityDice' if isinstance(q,str) else 'quantity'):q} for cid,q in choices],'destination':{'unoccupied':True,'withinFt':60},'attitude':'ally','maySummonFurtherDevils':False,'durationMinutes':1,'endsAlso':['summoned-dies','summoner-dies','summoner-action-dismisses'],'selectedCreatureRequiresVerifiedStatBlock':True}})
        normalize_outsider_multiattack(m)
        e=record('creature',index,index.replace('-',' ').title(),it,[page,68]+([69] if index in summons else []),m,'Diavolo del MM 2014; grado gerarchico distinto da GS. '+ ' '.join(x['summaryIt'] for x in m['traits']+m['actions']+m['reactions']),book='mm');e['sources'][0].update(printedPages=[p-1 for p in e['sources'][0]['pdfPages']],verification='read-local-render')
        if deps:e['relations']={'dependencyIds':deps,'spellIds':[d for d in deps if ':spell:' in d]}
        if index=='horned-devil':e['sourceAnomalies']=[{'field':'hitPoints','renderConfirmedValue':{'average':178,'dice':'17d10+55'},'correctionSource':'MM-Errata.pdf PDF 2','status':'confirmed-first-printing-arithmetic-inconsistency'}]
        if index=='chain-devil':e['extractionAnomalies']=[{'field':'traits.multiattack','observed':'omitted-from-extracted-text','verifiedOnRender':'two-chain-attacks','sourcePdfPage':73}]
        e['reviewScope']='individual-stat-block-and-optional-variants-reviewed; full-MM-inventory-pending';out.append(e)
    return out
