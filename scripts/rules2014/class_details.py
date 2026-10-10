"""Class equipment and progression events; incomplete feature effects are explicit."""
from curated import record, source


def item(index,quantity=1,**kwargs):
    return {'index':index,'quantity':quantity,**kwargs}


def category(name,quantity=1):
    return {'category':name,'quantity':quantity}


def choice(*options):
    return {'choose':1,'options':[o if isinstance(o,list) else [o] for o in options]}


def starting_equipment():
    i,c,ch=item,category,choice
    return {
      'barbarian':(49,{'fixed':[i('explorers-pack'),i('javelin',4)],'choices':[ch(i('greataxe'),c('martial-melee-weapons')),ch(i('handaxe',2),c('simple-weapons'))]}),
      'bard':(53,{'fixed':[i('leather-armor'),i('dagger')],'choices':[ch(i('rapier'),i('longsword'),c('simple-weapons')),ch(i('diplomats-pack'),i('entertainers-pack')),ch(i('lute'),c('musical-instrument'))]}),
      'cleric':(58,{'fixed':[i('shield'),c('holy-symbol')],'choices':[ch(i('mace'),i('warhammer',requiresProficiency=True)),ch(i('scale-mail'),i('leather-armor'),i('chain-mail',requiresProficiency=True)),ch([i('crossbow-light'),i('crossbow-bolt',20)],c('simple-weapons')),ch(i('priests-pack'),i('explorers-pack'))]}),
      'druid':(67,{'fixed':[i('leather-armor'),i('explorers-pack'),c('druidic-focus')],'choices':[ch(i('shield',material='wood'),c('simple-weapons')),ch(i('scimitar'),c('simple-melee-weapons'))]}),
      'fighter':(73,{'fixed':[],'choices':[ch(i('chain-mail'),[i('leather-armor'),i('longbow'),i('arrow',20)]),ch([c('martial-weapons'),i('shield')],c('martial-weapons',2)),ch([i('crossbow-light'),i('crossbow-bolt',20)],i('handaxe',2)),ch(i('dungeoneers-pack'),i('explorers-pack'))]}),
      'monk':(78,{'fixed':[i('dart',10)],'choices':[ch(i('shortsword'),c('simple-weapons')),ch(i('dungeoneers-pack'),i('explorers-pack'))]}),
      'paladin':(85,{'fixed':[i('chain-mail'),c('holy-symbol')],'choices':[ch([c('martial-weapons'),i('shield')],c('martial-weapons',2)),ch(i('javelin',5),c('simple-melee-weapons')),ch(i('priests-pack'),i('explorers-pack'))]}),
      'ranger':(92,{'fixed':[i('longbow'),i('quiver'),i('arrow',20)],'choices':[ch(i('scale-mail'),i('leather-armor')),ch(i('shortsword',2),c('simple-melee-weapons',2)),ch(i('dungeoneers-pack'),i('explorers-pack'))]}),
      'rogue':(97,{'fixed':[i('leather-armor'),i('dagger',2),i('thieves-tools')],'choices':[ch(i('rapier'),i('shortsword')),ch([i('shortbow'),i('quiver'),i('arrow',20)],i('shortsword')),ch(i('burglars-pack'),i('dungeoneers-pack'),i('explorers-pack'))]}),
      'sorcerer':(102,{'fixed':[i('dagger',2)],'choices':[ch([i('crossbow-light'),i('crossbow-bolt',20)],c('simple-weapons')),ch(i('component-pouch'),c('arcane-focus')),ch(i('dungeoneers-pack'),i('explorers-pack'))]}),
      'warlock':(108,{'fixed':[i('leather-armor'),i('dagger',2)],'choices':[ch([i('crossbow-light'),i('crossbow-bolt',20)],c('simple-weapons')),ch(i('component-pouch'),c('arcane-focus')),ch(i('scholars-pack'),i('dungeoneers-pack')),ch(c('simple-weapons'))]}),
      'wizard':(115,{'fixed':[i('spellbook')],'choices':[ch(i('quarterstaff'),i('dagger')),ch(i('component-pouch'),c('arcane-focus')),ch(i('scholars-pack'),i('explorers-pack'))]}),
    }


# Level events from the class tables and headings. Repeated upgrades retain level.
EVENTS = {
 'barbarian':{1:'Rage|Unarmored Defense',2:'Reckless Attack|Danger Sense',3:'Primal Path',5:'Extra Attack|Fast Movement',7:'Feral Instinct',9:'Brutal Critical',11:'Relentless Rage',13:'Brutal Critical',15:'Persistent Rage',17:'Brutal Critical',18:'Indomitable Might',20:'Primal Champion'},
 'bard':{1:'Spellcasting|Bardic Inspiration',2:'Jack of All Trades|Song of Rest',3:'Bard College|Expertise',5:'Font of Inspiration|Bardic Inspiration',6:'Countercharm',9:'Song of Rest',10:'Bardic Inspiration|Expertise|Magical Secrets',13:'Song of Rest',14:'Magical Secrets',15:'Bardic Inspiration',17:'Song of Rest',18:'Magical Secrets',20:'Superior Inspiration'},
 'cleric':{1:'Spellcasting|Divine Domain',2:'Channel Divinity|Turn Undead',5:'Destroy Undead',6:'Channel Divinity',8:'Destroy Undead',10:'Divine Intervention',11:'Destroy Undead',14:'Destroy Undead',17:'Destroy Undead',18:'Channel Divinity',20:'Divine Intervention'},
 'druid':{1:'Druidic|Spellcasting',2:'Wild Shape|Druid Circle',4:'Wild Shape',8:'Wild Shape',18:'Timeless Body|Beast Spells',20:'Archdruid'},
 'fighter':{1:'Fighting Style|Second Wind',2:'Action Surge',3:'Martial Archetype',5:'Extra Attack',9:'Indomitable',11:'Extra Attack',13:'Indomitable',17:'Action Surge|Indomitable',20:'Extra Attack'},
 'monk':{1:'Unarmored Defense|Martial Arts',2:'Ki|Unarmored Movement',3:'Monastic Tradition|Deflect Missiles',4:'Slow Fall',5:'Extra Attack|Stunning Strike',6:'Ki-Empowered Strikes',7:'Evasion|Stillness of Mind',9:'Unarmored Movement',10:'Purity of Body',13:'Tongue of the Sun and Moon',14:'Diamond Soul',15:'Timeless Body',18:'Empty Body',20:'Perfect Self'},
 'paladin':{1:'Divine Sense|Lay on Hands',2:'Fighting Style|Spellcasting|Divine Smite',3:'Divine Health|Sacred Oath',5:'Extra Attack',6:'Aura of Protection',10:'Aura of Courage',11:'Improved Divine Smite',14:'Cleansing Touch',18:'Aura Improvements'},
 'ranger':{1:'Favored Enemy|Natural Explorer',2:'Fighting Style|Spellcasting',3:'Ranger Archetype|Primeval Awareness',5:'Extra Attack',6:'Favored Enemy|Natural Explorer',8:'Land’s Stride',10:'Natural Explorer|Hide in Plain Sight',14:'Favored Enemy|Vanish',18:'Feral Senses',20:'Foe Slayer'},
 'rogue':{1:'Expertise|Sneak Attack|Thieves’ Cant',2:'Cunning Action',3:'Roguish Archetype',5:'Uncanny Dodge',6:'Expertise',7:'Evasion',11:'Reliable Talent',14:'Blindsense',15:'Slippery Mind',18:'Elusive',20:'Stroke of Luck'},
 'sorcerer':{1:'Spellcasting|Sorcerous Origin',2:'Font of Magic',3:'Metamagic',10:'Metamagic',17:'Metamagic',20:'Sorcerous Restoration'},
 'warlock':{1:'Otherworldly Patron|Pact Magic',2:'Eldritch Invocations',3:'Pact Boon',11:'Mystic Arcanum',13:'Mystic Arcanum',15:'Mystic Arcanum',17:'Mystic Arcanum',20:'Eldritch Master'},
 'wizard':{1:'Spellcasting|Arcane Recovery',2:'Arcane Tradition',18:'Spell Mastery',20:'Signature Spells'},
}


def class_features(class_records):
    from spell_extract import slug
    features=[]
    table_page={'bard':54,'paladin':84}
    for cls in class_records:
        index=cls['index']
        page=table_page.get(index,cls['sources'][0]['pdfPages'][0])
        events={k:v.split('|') for k,v in EVENTS[index].items()}
        for level in cls['mechanics']['abilityScoreImprovementLevels']:
            events.setdefault(level,[]).append('Ability Score Improvement')
        from curated import SUBCLASS_LEVELS
        for level in SUBCLASS_LEVELS[index][1:]:
            events.setdefault(level,[]).append('Subclass Feature')
        for level,names in sorted(events.items()):
            for name in names:
                feature=record('class-feature',f'{index}-{level}-{slug(name)}',name,None,page,{'level':level},
                               'Evento della progressione di classe. Il nome e il livello non bastano a implementarne gli effetti.',missing=['effect','choices','resources','italianName'])
                feature['translation']['status']='missing'
                feature['relations']={'classId':cls['id']}
                if name=='Subclass Feature':
                    feature['verification']['identity']='derived-placeholder'
                    feature['interpretations'].append({'field':'name','kind':'derived','method':'Standardized event label for class-table subclass progression; not the literal name of a subclass privilege.'})
                features.append(feature)
    return features


def apply_equipment(class_records):
    for cls in class_records:
        page,value=starting_equipment()[cls['index']]
        cls['mechanics']['startingEquipment']=value
        cls['sources'].append(source(page,'Equipment'))
        cls['fieldSources']['startingEquipment']=[len(cls['sources'])-1]
        cls['verification']['missingFields'].remove('startingEquipment')
        casting_page={'bard':54,'cleric':59,'druid':67,'paladin':86,'ranger':93,'sorcerer':102,'warlock':108,'wizard':115}
        if cls['index'] in casting_page:
            cls['sources'].append(source(casting_page[cls['index']],'Spellcasting Ability'))
            cls['fieldSources']['castingAbility']=[len(cls['sources'])-1]
        table_page={'bard':54,'paladin':84}.get(cls['index'])
        if table_page:
            cls['sources'].append(source(table_page,'Class Progression Table'))
            cls['fieldSources']['abilityScoreImprovementLevels']=[len(cls['sources'])-1]
            cls['fieldSources']['subclassMinimumLevel']=[len(cls['sources'])-1]


def dmg_options():
    from curated import SUBCLASS_LEVELS
    rows=[('cleric','death','Death Domain','Dominio della Morte',[97,98]),('paladin','oathbreaker','Oathbreaker','Apostata',[98])]
    result=[]
    for cls,index,name,it,pages in rows:
        m={'minimumLevel':SUBCLASS_LEVELS[cls][0],'featureLevels':SUBCLASS_LEVELS[cls],'requiresDMApproval':True}
        if cls=='paladin':
            m['requiresAlignment']='evil'
            m['replaces']='previous-sacred-oath-features-and-spells'
        item=record('subclass',index,name,it,pages,m,'Opzione per personaggi malvagi e PNG; per i giocatori richiede il consenso del DM.',book='dmg',optional=True,missing=['fullFeatureEffects','spellGrants'])
        item['relations']={'classId':f'phb2014:class:{cls}'}
        result.append(item)
    return result


def supplemental_rules():
    return [
      record('rule','attunement','Attunement','Sintonia',[137,139],
             {'maxItemsPerCreature':3,'maxCreaturesPerItem':1,'duplicateCopiesAllowed':False,'requires':'separate-uninterrupted-short-rest-in-contact',
              'endsWhen':['prerequisites-lost','more-than-100-ft-for-24-hours','death','another-creature-attunes'],'voluntaryEnd':'short-rest-unless-cursed'},
             'La sintonia è distinta dall’identificazione. Non puoi sintonizzarti con un quarto oggetto o con più copie dello stesso oggetto.',book='dmg'),
      record('rule','monster-hit-dice','Hit Points','Dadi Vita dei Mostri',[8],
             {'bySize':{'Tiny':4,'Small':6,'Medium':8,'Large':10,'Huge':12,'Gargantuan':20},'constitutionAdded':'modifier-times-number-of-hit-dice','averageDice':'count-times-(die+1)/2'},
             'Il dado vita dei mostri dipende dalla taglia; il modificatore di Costituzione si applica per ogni dado.',book='mm'),
      record('rule','monster-proficiency','Saving Throws and Skills','Competenza dei Mostri',[9],
             {'proficiencyByChallenge':{'0-4':2,'5-8':3,'9-12':4,'13-16':5,'17-20':6,'21-24':7,'25-28':8,'29-30':9},'checkBonus':'ability-modifier-plus-proficiency-with-explicit-exceptions'},
             'La competenza deriva dal grado di sfida, non da un livello del personaggio; alcune statistiche prevedono eccezioni esplicite.',book='mm'),
      record('rule','monster-spellcasting','Innate Spellcasting and Spellcasting','Incantesimi dei Mostri',[11],
             {'innateDefaultCast':'lowest-level-no-upcast','innateCantripScalingWhenNoLevel':'challenge-rating','classSpellcastingCantripScaling':'spellcaster-level','classSpellcastingCanUpcastWithSlots':True},
             'Mantieni separate magia innata e capacità di classe; il livello che potenzia un trucchetto dipende dalla fonte.',book='mm'),
      record('rule','monster-senses','Senses','Sensi Speciali',[9,10],
             {'blindsight':'perception-without-sight-within-radius','tremorsenseRequires':'same-ground-or-substance','tremorsenseCannotDetect':['flying','incorporeal'],'truesight':['magical-darkness','invisible','visual-illusions','original-form','ethereal-plane']},
             'Ogni senso speciale ha limiti propri; percezione tellurica non rileva creature in volo o incorporee.',book='mm'),
    ]
