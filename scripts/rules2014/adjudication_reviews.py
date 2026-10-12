"""DMG chapter 8 tables read in full and checked on local renders.

Advice and optional resolution methods require DM adoption; they never replace
the PHB rules merely because a candidate database has been loaded.
"""
from curated import record


def adjudication_rules():
    rows = [
      ('outdoor-visibility','Outdoor visibility','Visibilità esterna',[244],
       {'clearMiles':2,'rainMiles':1,'fogRangeFt':[100,300],'clearElevatedMiles':40,'obstructionsLimitSight':True,
        'notStealthy':'notice-each-other-in-sight-or-hearing-range','stealthOpposedBy':'passive-wisdom-perception'},
       'Indicazioni per il DM: due miglia con cielo sereno, una sotto la pioggia, cento–trecento piedi nella nebbia e quaranta miglia da un’altura; terreno e ostacoli possono ridurre la vista. Rumore e furtività restano distinti.'),
      ('tracking','Tracking','Seguire tracce',[245],
       {'checkAbility':'wisdom','checkSkill':'survival','suggestedDC':{'soft-ground':10,'dirt-or-grass':15,'bare-stone':20},
        'DCPerDaySincePassage':5,'distinctTrailDCModifier':-5,'obviousTracks':'no-check','noTrail':'DM-may-rule-impossible',
        'possibleNewCheckAfter':['short-or-long-rest','trackless-obstacle','more-difficult-terrain-or-weather'],
        'manyTracks':'DM-may-grant-advantage','well-traveledArea':'DM-may-grant-disadvantage',
        'failure':'loses-trail','retrySearchMinutes':{'confined-area':10,'outdoors':60}},
       'Saggezza (Sopravvivenza) con CD indicative dieci, quindici o venti; ogni giorno aggiunge cinque, una scia evidente sottrae cinque. Fallire perde la pista; cercarla nuovamente richiede dieci minuti al chiuso o un’ora all’aperto.'),
      ('social-interaction','Social interaction','Interazione sociale',[245,246],
       {'checkAbility':'charisma','possibleSkills':['persuasion','deception','intimidation'],
        'attitudes':['friendly','indifferent','hostile'],'attitudeSetByDM':True,'usualMaximumAttitudeShiftSteps':1,
        'reactionsByDC':{'friendly':{'0':'helps-without-risk-or-sacrifice','10':'accepts-minor-risk-or-sacrifice','20':'accepts-significant-risk-or-sacrifice'},
            'indifferent':{'0':'no-help-no-harm','10':'helps-without-risk-or-sacrifice','20':'accepts-minor-risk-or-sacrifice'},
            'hostile':{'0':'opposes-may-accept-risks','10':'no-help-no-harm','20':'helps-without-risk-or-sacrifice'}},
        'hostileUnpersuadableTarget':'DM-may-rule-automatic-failure','helpfulContribution':'advantage','offensiveContribution':'disadvantage',
        'discoverCharacteristic':{'ability':'wisdom','skill':'insight','dc':'DM','failByAtLeast10':'may-receive-false-characteristic'},
        'repeatChecks':'DM-may-rule-fruitless-or-worsen-attitude'},
       'Il DM sceglie atteggiamento e possibilità di trattativa; la conversazione può cambiarlo di solito di un passo. Le CD zero, dieci e venti producono reazioni differenti. Il risultato non equivale a controllo mentale e ulteriori richieste possono richiedere altri tiri.'),
      ('object-statistics','Statistics for objects','Statistiche degli oggetti',[247,248],
       {'ruleType':'object-statistics','objectDefinition':'discrete-inanimate-item-not-whole-composite-building-or-vehicle',
        'suggestedACByMaterial':{'cloth-paper-rope':11,'crystal-glass-ice':13,'wood-bone':15,'stone':17,'iron-steel':19,'mithral':21,'adamantine':23},
        'suggestedHPBySize':{'Tiny':{'fragile':{'average':2,'dice':'1d4'},'resilient':{'average':5,'dice':'2d4'}},
            'Small':{'fragile':{'average':3,'dice':'1d6'},'resilient':{'average':10,'dice':'3d6'}},
            'Medium':{'fragile':{'average':4,'dice':'1d8'},'resilient':{'average':18,'dice':'4d8'}},
            'Large':{'fragile':{'average':5,'dice':'1d10'},'resilient':{'average':27,'dice':'5d10'}}},
        'damageImmunities':['poison','psychic'],'damageThreshold':{'value':'DM-assigned-when-applicable','per':'single-attack-or-effect','belowThreshold':'no-damage','atOrAboveThreshold':'normal-damage-not-minus-threshold'},
        'hugeGargantuan':'DM-time-adjudication-or-large-and-smaller-sections','suitableToolsAndDamageRequired':True,
        'resistanceVulnerabilityAdditionalImmunity':'DM-assigned-not-universal'},
       'CA e PF indicativi dipendono da materiale, taglia e robustezza. Oggetti immuni a veleno e psichico; strumenti e danni devono poterli danneggiare. La soglia annulla un singolo danno inferiore, mentre un danno che la raggiunge si applica normalmente, senza sottrarre la soglia.'),
      ('monster-average-critical','Monster critical hits','Critici con danno medio',[249],
       {'normalCriticalRule':'same-as-player-character','usingAverageDamage':'average-normal-damage-plus-roll-all-hit-damage-dice','flatModifiersDoubled':False},
       'Se usa il danno medio del blocco, il DM aggiunge un tiro di tutti i dadi del colpo per il critico; i modificatori fissi non raddoppiano.'),
      ('improvised-damage','Improvising damage','Danno improvvisato',[250],
       {'ruleType':'DM-damage-guidelines','diceByExampleSeverity':['1d10','2d10','4d10','10d10','18d10','24d10'],
        'byCharacterLevel':[{'minimum':1,'maximum':4,'setback':'1d10','dangerous':'2d10','deadly':'4d10'},
            {'minimum':5,'maximum':10,'setback':'2d10','dangerous':'4d10','deadly':'10d10'},
            {'minimum':11,'maximum':16,'setback':'4d10','dangerous':'10d10','deadly':'18d10'},
            {'minimum':17,'maximum':20,'setback':'10d10','dangerous':'18d10','deadly':'24d10'}],
        'examplesNotUniversalHazardStatistics':True},
       'Il DM sceglie un danno per effetti privi di statistiche: da un d10 a ventiquattro d10. Quattro fasce di livello indicano gravità moderata, pericolosa o letale, senza garantire sopravvivenza né sostituire danni già specificati.'),
      ('theater-area-targets','Targets in areas of effect','Bersagli stimati nelle aree',[250,251],
       {'ruleType':'approximate-area-target-count','round':'up','divisors':{'cone-size':10,'cube-or-square-size':5,'cylinder-radius':5,'line-length':30,'sphere-or-circle-radius':5},
        'unit':'ft','DMAdjustsForDensity':True,'optionalAdjustmentDie':'1d3','requiresDMSignChoice':True,'preciseGridReplacement':False},
       'Senza mappa, stima suggerita arrotondata per eccesso: cono diviso dieci, cubo diviso cinque, raggio diviso cinque e linea divisa trenta. Il DM adatta il numero alla densità dei presenti; non è la geometria effettiva dell’incantesimo.'),
      ('mob-attacks','Handling mobs','Attacchi di gruppi numerosi',[251],
       {'ruleType':'mob-attack-resolution','minimumD20':'target-AC-minus-attack-bonus',
        'table':[{'low':a,'high':b,'attackersPerHit':n} for a,b,n in [(1,5,1),(6,12,2),(13,14,3),(15,16,4),(17,18,5),(19,19,10),(20,20,20)]],
        'incompleteGroup':'no-hit','criticalHitsIgnored':True,'differentDamage':'highest-damage-creature-hits',
        'multipleEqualBonusAttacks':'hitting-creature-hits-once-with-each','differentAttackBonuses':'resolve-separately','lowCount':'return-to-individual-rolls',
        'outsideListedMinimumD20Range':'use-individual-rolls-no-invented-table-row'},
       'Metodo facoltativo senza tiri d’attacco: la differenza CA meno bonus individua quanti attaccanti producono un colpo. Resti insufficienti non colpiscono; niente critici. Bonus diversi si risolvono separatamente e con pochi avversari si ritorna ai tiri ordinari.'),
      ('tactical-grid','Tactical grids','Griglie tattiche',[252],
       {'spaceBySize':{'Tiny':{'perSquare':4,'perHex':4},'Small':{'squares':1,'hexes':1},'Medium':{'squares':1,'hexes':1},'Large':{'squares':4,'hexes':3},'Huge':{'squares':9,'hexes':7},'Gargantuan':{'minimumSquares':16,'minimumHexes':12}},
        'miniatureBaseChangesRuleSize':False,'areaOrigin':'grid-intersection','circularAreaSquareMinimumFraction':0.5,
        'lineOfSight':'any-unblocked-line-from-one-source-corner-to-any-target-part; touching-obstruction-blocks',
        'squareCoverBlockedCornerLines':{'half':[1,2],'three-quarters':[3,4]},
        'hexCoverBlockedCornerLines':{'half':[1,2,3],'three-quarters':[4,5,6]},'threeQuartersRequiresAttackCanStillReach':True},
       'Caselle e esagoni rappresentano spazi differenti per taglia. Aree circolari includono una casella coperta almeno a metà; linee dai vertici determinano vista e copertura. Una miniatura di misura diversa non cambia la taglia della creatura.'),
      ('flanking','Flanking','Fiancheggiamento',[252],
       {'requiresDMApproval':True,'requires':['can-see-enemy','not-incapacitated','adjacent-allies-on-opposite-sides'],
        'squareAttackAdvantage':'melee-only','hexAttackAdvantage':'attacks-as-written-no-melee-qualifier',
        'hexesBetweenAlliesByEnemySize':{'Medium-or-smaller':2,'Large':4,'Huge':5,'Gargantuan':6},
        'gargantuanHexDistanceIsMinimum':True,'largeFlanker':'any-occupied-space-qualifies'},
       'Opzione con miniature: alleati adiacenti su lati opposti, capaci di vedere e non incapacitati. Il testo delle caselle limita il vantaggio agli attacchi in mischia; quello degli esagoni non ripete il limite, mantenuto come differenza della fonte.'),
      ('alternating-diagonals','Diagonals','Diagonali alternate',[253],
       {'requiresDMApproval':True,'alternatingCostsFt':[5,10],'orthogonalMovementResetsAlternation':False},
       'Variante: la prima diagonale costa cinque piedi, la successiva dieci, alternando anche se tra le diagonali si percorrono caselle dritte.'),
      ('facing','Facing','Orientamento',[253],
       {'requiresDMApproval':True,'arcs':['front','left','right','rear'],'changeFacing':['end-own-movement','reaction-to-other-creature-movement'],
        'normalTargetableArcs':['front','left','right'],'cannotSeeRear':True,'rearAttackerAdvantage':True,
        'shieldAppliesArcs':['front','shield-side'],'halfSplitPriority':['front','side','rear'],'DMMayAssignOtherAnatomy':True},
       'Variante: fronte, lati e retro. Il retro non è visibile; attaccare da lì dà vantaggio. Lo scudo protegge fronte e proprio lato. Ci si orienta a fine movimento o reagendo al movimento altrui; anatomie particolari richiedono DM.'),
      ('reaction-timing','Reaction timing','Tempi delle reazioni',[253],
       {'specifiedTimingTakesPrecedence':True,'unspecifiedOrUnclearTiming':'after-trigger-completes','interruptingExamples':['opportunity-attack','shield-spell']},
       'Prevale il tempo dichiarato dalla capacità. Se manca o è poco chiaro, la reazione avviene dopo il completamento dell’evento; gli attacchi di opportunità e Scudo hanno tempi specifici.'),
      ('combining-game-effects','Combining game effects','Effetti omonimi',[253],
       {'sameNamedFeatureOverlappingDuration':'most-potent-only','types':['spell','class-feature','feat','racial-trait','monster-ability','magic-item'],'duplicateOngoingFireFormDamageStacks':False},
       'Finché le durate si sovrappongono, effetti con lo stesso nome non si sommano: si applica il più potente. Vale anche per tratti dei mostri, oggetti e privilegi, oltre agli incantesimi.'),
    ]
    result=[]
    for index,name,it,pages,mechanics,summary in rows:
        optional=index in ['social-interaction','improvised-damage','theater-area-targets','mob-attacks','flanking','alternating-diagonals','facing']
        mechanics={'requiresDMAdjudication':True,**({'requiresDMApproval':True} if optional else {}),**mechanics}
        e=record('rule',index,name,it,pages,mechanics,summary,book='dmg',optional=optional)
        if index in ['tracking','social-interaction','object-statistics','improvised-damage','theater-area-targets','mob-attacks','tactical-grid']:
            e['sources'][0]['verification']='read-local-render'
        result.append(e)
    result.extend(chase_rules());result.extend(siege_rules());result.extend(downtime_rules());result.extend(unusual_travel_rules());result.extend(campaign_rules());result.extend(encounter_rules());result.extend(consumable_variants())
    return result


def chase_rules():
    urban=[
        (1,{'checkChoices':['dexterity-acrobatics'],'dc':15,'failure':{'difficultTerrainFt':10}},'Ostacolo voluminoso.'),
        (2,{'checkChoices':['strength-athletics','dexterity-acrobatics'],'dc':10,'failure':{'difficultTerrainFt':10}},'Folla.'),
        (3,{'saveAbility':'strength','dc':10,'failure':{'condition':'prone','cannotPassBarrier':True}},'Barriera fragile da sfondare.'),
        (4,{'checkChoices':['dexterity-acrobatics','intelligence'],'dc':10,'failure':{'difficultTerrainFt':10}},'Labirinto di casse e barili.'),
        (5,{'saveAbility':'dexterity','dc':10,'failure':{'condition':'prone'}},'Terreno scivoloso.'),
        (6,{'checkChoices':['dexterity-acrobatics'],'dc':10,'failure':{'damage':{'dice':'1d4','type':'piercing'},'difficultTerrainFt':5}},'Cani che si contendono cibo.'),
        (7,{'checkChoices':['strength-athletics','dexterity-acrobatics','charisma-intimidation'],'dc':15,'failure':{'damage':{'dice':'2d4','type':'bludgeoning'},'difficultTerrainFt':10}},'Rissa.'),
        (8,{'checkChoices':['strength-athletics','dexterity-acrobatics','charisma-intimidation'],'dc':10,'automaticSuccess':'give-beggar-a-coin','failure':{'difficultTerrainFt':5}},'Mendicante.'),
        (9,{'ifMovesAtLeastFt':20,'guardOpportunityAttack':{'attackBonus':3,'damage':{'dice':'1d6+1','type':'piercing'}}},'Guardia che scambia il fuggitivo per un altro.'),
        (10,{'saveAbility':'dexterity','dc':10,'failure':{'damage':{'dice':'1d4','type':'bludgeoning'}}},'Curva improvvisa.')]
    wilderness=[
        (1,{'checkChoices':['strength-athletics','dexterity-acrobatics'],'dc':10,'failure':{'difficultTerrainFt':5}},'Vegetazione fitta.'),
        (2,{'checkChoices':['dexterity-acrobatics'],'dc':10,'failure':{'difficultTerrainFt':10}},'Suolo irregolare.'),
        (3,{'swarmOpportunityAttack':{'attackBonus':3,'damage':{'dice':'4d4','type':'piercing'}},'insectKind':'DM'},'Sciame di insetti.'),
        (4,{'checkChoices':['strength-athletics','dexterity-acrobatics'],'dc':10,'failure':{'difficultTerrainFt':10}},'Corso d’acqua o terreno roccioso.'),
        (5,{'saveAbility':'constitution','dc':10,'failure':{'condition':'blinded','speedMultiplier':0.5,'until':'end-own-turn'}},'Detriti negli occhi.'),
        (6,{'saveAbility':'dexterity','dc':10,'failure':{'fallDistance':{'dice':'1d4','multiplierFt':5},'fallDamagePer10Ft':'1d6','damageType':'bludgeoning','condition':'prone'}},'Dislivello improvviso.'),
        (7,{'saveAbility':'dexterity','dc':15,'failure':{'condition':'restrained','escapeRule':'phb-net'}},'Rete di un cacciatore.'),
        (8,{'saveAbility':'dexterity','dc':10,'failure':{'damage':[{'dice':'1d4','type':'bludgeoning'},{'dice':'1d4','type':'piercing'}]}},'Animali in fuga.'),
        (9,{'saveAbility':'dexterity','dc':15,'alternativeMovementCostFt':10,'failure':{'damage':{'dice':'1d10','type':'slashing'}}},'Vegetazione tagliente.'),
        (10,{'additionalPursuerChosenByDM':True},'Creatura locale che si unisce all’inseguimento.')]
    tables={name:[*[{'low':n,'high':n,'effect':effect,'summaryIt':summary} for n,effect,summary in rows],
        {'low':11,'high':20,'effect':{'complication':None},'summaryIt':'Nessuna complicazione.'}]
        for name,rows in [('urban',urban),('wilderness',wilderness)]}
    e=record('rule','chases','Chases','Inseguimenti',[253,254,255,256],
        {'ruleType':'chase','requiresDMApproval':True,'initiativeRequired':True,'distanceAndLeadTracked':True,
         'freeDashUses':'3+constitutionModifier','additionalDash':{'checkAbility':'constitution','checkDC':10,'timing':'end-own-turn','eachAdditionalDashRequiresCheck':True,'failureExhaustionLevels':1},
         'exhaustion5':'drops-out-speed-zero','chaseOnlyExhaustionRecovery':['short-rest','long-rest'],
         'participantOpportunityAttacks':'normally-none-against-other-participants','nonParticipantsOpportunityAttacks':'normal',
         'escape':{'checkAbility':'dexterity','checkSkill':'stealth','timing':'end-round-after-all-participants','requiresOutOfLeadPursuerSight':True,'mustExceedHighestPursuerPassivePerception':True,'multipleQuarry':'each-checks'},
         'escapeAdvantageFactors':['many-hiding-places','crowded-or-noisy'],'escapeDisadvantageFactors':['few-hiding-places','uncrowded-or-quiet','lead-pursuer-ranger-or-survival-proficient'],
         'complications':{'die':20,'timing':'end-each-participant-turn','affects':'next-participant-in-initiative','inspirationMayNegateBy':['roller','affected-participant'],'tables':tables},
         'splitChases':'resolve-separately-round-by-round','normalAttackSpellRulesStillApply':True},
        'Inseguimento con iniziativa e distanze. Dopo tre più modificatore di Costituzione Scatti, ogni uso ulteriore richiede prova Costituzione CD dieci a fine turno; fallire aggiunge indebolimento, recuperabile con riposo solo per i livelli così acquisiti. Furtività a fine round supera la migliore percezione passiva solo uscendo dalla vista del primo inseguitore. Le complicazioni d20 colpiscono il partecipante successivo.',book='dmg',optional=True)
    e['sources'][0]['verification']='read-local-render'
    return [e]


def siege_rules():
    rows=[('ballista','Ballista','Balista',256,'Large',15,50,{'load':1,'aim':1,'fire':1},
           {'kind':'ranged-weapon-attack','attackBonus':6,'rangeFt':{'normal':120,'long':480},'target':'one-target','damage':{'average':16,'dice':'3d10','type':'piercing'}}),
          ('cannon','Cannon','Cannone',256,'Large',19,75,{'load':1,'aim':1,'fire':1},
           {'kind':'ranged-weapon-attack','attackBonus':6,'rangeFt':{'normal':600,'long':2400},'target':'one-target','damage':{'average':44,'dice':'8d10','type':'bludgeoning'}}),
          ('suspended-cauldron','Suspended Cauldron','Calderone sospeso',256,'Large',19,20,{'fill':3,'tip':1},
           {'kind':'area-save','area':{'squareSideFt':10,'position':'directly-below'},'saveAbility':'dexterity','saveDC':15,'failureDamage':{'average':10,'dice':'3d6','type':'fire'},'successDamage':'half','otherContentsRequireDM':True,'refillAndUsuallyReheatBeforeReuse':True}),
          ('mangonel','Mangonel','Mangano',256,'Large',15,100,{'load':2,'aim':2,'fire':1},
           {'kind':'ranged-weapon-attack','attackBonus':5,'rangeFt':{'normal':200,'long':800},'cannotTargetWithinFt':60,'target':'one-target','damage':{'average':27,'dice':'5d10','type':'bludgeoning'},'highArcCanHitBehindCover':True,'alternativeProjectilesRequireDM':True}),
          ('ram','Ram','Ariete',256,'Large',15,100,{},
           {'kind':'melee-weapon-attack','attackBonus':8,'reachFt':5,'target':'one-object','damage':{'average':16,'dice':'3d10','type':'bludgeoning'},'minimumMediumOperators':4,'operatorCoverFromAbove':'total'}),
          ('siege-tower','Siege Tower','Torre d’assedio',257,'Gargantuan',15,200,{},
           {'kind':'access','maximumWallHeightFt':40,'usersMaximumSize':'Medium','occupantCoverFromOutside':'total','requiresPushOrPull':True}),
          ('trebuchet','Trebuchet','Trabucco',257,'Huge',15,150,{'load':2,'aim':2,'fire':1},
           {'kind':'ranged-weapon-attack','attackBonus':5,'rangeFt':{'normal':300,'long':1200},'cannotTargetWithinFt':60,'target':'one-target','damage':{'average':44,'dice':'8d10','type':'bludgeoning'},'highArcCanHitBehindCover':True,'alternativeProjectilesRequireDM':True})]
    result=[]
    for index,name,it,page,size,ac,hp,steps,effect in rows:
        e=record('rule','siege-'+index,name,it,page,{'ruleType':'siege-equipment','requiresDMCampaignAvailability':True,'requiresDMApproval':True,
            'objectSize':size,'armorClass':ac,'hitPoints':hp,'damageImmunities':['poison','psychic'],'actionsPerPreparationStep':steps,'effect':effect,
            'purchaseCostGP':None,'purchaseCostStatus':'not-stated','movementSpeedFt':None,'movementStatus':'operators-or-DM-no-universal-speed'},
            'Oggetto da assedio, non creatura né arma automaticamente disponibile. Conserva CA, PF, azioni di preparazione ed effetto. Costo e velocità non sono dichiarati: il DM decide disponibilità, movimento, personale e munizioni alternative.',book='dmg',optional=True)
        e['sources'][0]['verification']='read-local-render';result.append(e)
    return result


def downtime_rules():
    upkeep=[('abbey',20,5,25),('farm',0.5,1,2),('guildhall',5,5,3),('rural-inn',10,5,10),('urban-inn',5,1,5),
        ('keep-or-small-castle',100,50,50),('hunting-lodge',0.5,1,0),('noble-estate',10,3,15),('outpost-or-fort',50,20,40),
        ('palace-or-large-castle',400,200,100),('shop',2,1,0),('large-temple',25,10,10),('small-temple',1,2,0),
        ('fortified-tower',25,10,0),('trading-post',10,4,2)]
    build=[('abbey',50000,400),('guildhall',5000,60),('keep-or-small-castle',50000,400),('noble-estate-with-manor',25000,150),
        ('outpost-or-fort',15000,100),('palace-or-large-castle',500000,1200),('temple',50000,400),('fortified-tower',15000,100),('trading-post',5000,60)]
    carousing=[(1,10,{'jailDaysDice':'1d4','alternativeFineGP':10,'mayResistArrest':True},'Arresto per disordini.'),
        (11,20,{'lostGP':{'dice':'3d6','multiplier':5},'memoryGap':True},'Risveglio in luogo sconosciuto dopo furto.'),
        (21,30,{'newHostileEnemy':'DM-chosen','cause':'player-chosen'},'Nuovo nemico.'),
        (31,40,{'romanceD20':[{'low':1,'high':5,'ends':'badly','mayGainFlaw':True},{'low':6,'high':10,'ends':'amicably','mayGainBond':True},{'low':11,'high':20,'ends':'ongoing','mayGainBond':True}],'loveInterestRequiresDMApproval':True},'Relazione sentimentale.'),
        (41,80,{'refundCarousingLifestyleCost':True},'Vincite recuperano le spese.'),
        (81,90,{'refundCarousingLifestyleCost':True,'profitGP':{'dice':'1d20','multiplier':4}},'Vincite e modesto guadagno.'),
        (91,None,{'refundCarousingLifestyleCost':True,'profitGP':{'dice':'4d6','multiplier':10},'localRenownNarrative':'legendary-carousing-no-numeric-renown-granted'},'Grosse vincite e notorietà locale.')]
    business=[(1,20,{'maintenanceMultiplier':1.5}),(21,30,{'maintenanceMultiplier':1}),(31,40,{'maintenanceMultiplier':0.5}),
        (41,60,{'maintenanceMultiplier':0}),(61,80,{'maintenanceMultiplier':0,'profitGP':{'dice':'1d6','multiplier':5}}),
        (81,90,{'maintenanceMultiplier':0,'profitGP':{'dice':'2d8','multiplier':5}}),(91,None,{'maintenanceMultiplier':0,'profitGP':{'dice':'3d10','multiplier':5}})]
    sales=[(None,20,[{'buyer':'ordinary','priceFraction':0.1}]),(21,40,[{'buyer':'ordinary','priceFraction':0.25},{'buyer':'shady','priceFraction':0.5}]),
        (41,80,[{'buyer':'ordinary','priceFraction':0.5},{'buyer':'shady','priceFraction':1}]),(81,90,[{'buyer':'ordinary','priceFraction':1}]),
        (91,None,[{'buyer':'shady','priceFraction':1.5}])]
    rows=[
      ('property-maintenance','Maintenance Costs','Manutenzione delle proprietà',[128],
       {'ruleType':'property-maintenance','paymentIntervalDays':30,'costIncludesHirelingWages':True,'typicalIncomeAlreadyOffset':True,
        'table':[{'property':i,'GPPerDay':gp,'skilledHirelings':s,'untrainedHirelings':u} for i,gp,s,u in upkeep],
        'ordinaryResidence':'PHB-lifestyle-expenses','guardStatisticsSource':'MM guard; keep/castle may also use veteran; identities do not certify combat blocks'},
       'Quindici tipi di proprietà: costi giornalieri comprensivi di personale e dei ricavi tipici, pagabili ogni trenta giorni. Gli stipendi non vanno aggiunti di nuovo; le abitazioni normali seguono lo stile di vita PHB.'),
      ('build-stronghold','Building a Stronghold','Costruire una fortezza',[129],
       {'ruleType':'downtime','requires':['land-ownership-or-grant','materials','labor'],
        'suggestedLandGP':{'smallEstate':[100,1000],'largeEstateMinimum':5000,'availability':'DM'},
        'table':[{'property':i,'constructionGP':gp,'supervisedDays':d} for i,gp,d in build],'eachDayAwayAddsConstructionDays':3,'constructionIncludesMaterialsAndLabor':True},
       'Prima terreno e permessi, poi materiali e manodopera. Nove progetti con costo e durata sotto supervisione; ogni giorno d’assenza aggiunge tre giorni alla costruzione. La manutenzione successiva rimane separata.'),
      ('carousing','Carousing','Baldoria',[129],
       {'ruleType':'downtime','lifestyle':'wealthy','roll':'d100+total-character-level','DMCanChooseOutcome':True,
        'table':[{'low':lo,'high':hi,'effect':e,'summaryIt':s} for lo,hi,e,s in carousing]},
       'Spese come stile di vita ricco; a fine periodo d100 più livello totale o scelta del DM. Esiti distinti: carcere evitabile con dieci mo, furto, nemico, relazione, rimborso delle spese e guadagni casuali. Legami e difetti possibili, senza imporli automaticamente.'),
      ('downtime-renown','Gaining Renown','Accrescere la fama',[130],
       {'ruleType':'downtime','requires':'organization-tasks-and-socializing','daysPerRenownIncrease':'current-renown-times-ten','increase':1,'daysMayBeCombined':True},
       'Attività e relazioni nell’organizzazione per giorni cumulativi pari alla fama corrente moltiplicata dieci aumentano la fama di uno. La formula non viene usata per creare ripetizioni gratuite a fama zero; il DM gestisce l’ingresso e il contesto.'),
      ('sacred-rites','Performing Sacred Rites','Riti sacri',[130],
       {'ruleType':'downtime','requires':'temple-of-revered-deity','minimumDays':10,'benefit':'inspiration-at-start-each-day','benefitDurationDaysDice':'2d6','inspirationMaximumHeld':1,'laypersonMayParticipate':True},
       'Almeno dieci giorni di riti presso un tempio della propria fede danno ispirazione a inizio giornata per i successivi 2d6 giorni; anche i laici possono partecipare e non si accumulano più ispirazioni.'),
      ('run-business','Running a Business','Gestire un’attività',[130],
       {'ruleType':'downtime','roll':'d100+days-spent-minus-ten-per-unpaid-debt','maximumDaysModifier':30,'unpaidDebtPenaltyPerDebt':-10,
        'costMultiplierAppliesToEachActualDay':True,'table':[{'low':lo,'high':hi,'effect':e} for lo,hi,e in business],
        'modifiedTotalBelowOne':'not-covered-by-table; DM-required-no-invented-clamp'},
       'D100 più giorni dedicati, bonus massimo trenta; dieci in meno per ciascun debito non pagato. La riga determina spese per ciascun giorno e guadagno del periodo, non guadagno ogni giorno. Totali sotto uno non hanno riga esplicita e richiedono DM.'),
      ('sell-magic-items','Selling Magic Items','Vendere oggetti magici',[130,131],
       {'ruleType':'downtime','requires':'location-with-wealthy-interested-buyers','excludedRarities':['legendary','artifact'],
        'buyerSearch':{'ability':'intelligence','skill':'investigation','dc':20,'helperDowntime':'advantage','failureDays':10,'parallelSearchDuration':'maximum-not-sum'},
        'rarities':{'common':{'basePriceGP':100,'buyerDaysDice':'1d4','saleModifier':10},'uncommon':{'basePriceGP':500,'buyerDaysDice':'1d6','saleModifier':0},
            'rare':{'basePriceGP':5000,'buyerDaysDice':'1d8','saleModifier':-10},'very-rare':{'basePriceGP':50000,'buyerDaysDice':'1d10','saleModifier':-20}},
        'offerRoll':'d100+rarity-modifier+charisma-persuasion-check-total','table':[{'low':lo,'high':hi,'offers':e} for lo,hi,e in sales],
        'buyerAndLegalComplications':'DM','consumableBasePriceHalvedInThisPassage':False},
       'Ricerca per oggetto: Indagare venti, dieci giorni se fallita o dado secondo rarità se riuscita. Ricerche parallele durano il massimo dei tempi. Offerta d100 più modificatore e prova Persuasione: dal dieci al centocinquanta per cento, con acquirenti ordinari o sospetti. Leggendari e artefatti richiedono altri accordi o avventure.'),
      ('sow-rumors','Sowing Rumors','Diffondere voci',[132],
       {'ruleType':'downtime','GPPerDay':1,'daysDiceBySettlement':{'village':'2d6','town':'4d6','city':'6d6'},'townAndCityDaysMustBeContinuous':True,
        'check':{'ability':'charisma','skillsChoice':['deception','persuasion'],'dc':15},'success':'community-prevailing-attitude-one-step-toward-friendly-or-hostile','failure':'rumor-no-traction-further-propagation-attempts-fail','individualOpinionsAutomaticallyChanged':False},
       'Una mo al giorno e 2d6/4d6/6d6 giorni secondo insediamento; in paese o città consecutivi. Inganno o Persuasione quindici spostano l’atteggiamento prevalente di un passo, senza cambiare ogni individuo. Fallimento impedisce ulteriori tentativi di propagare quella voce.'),
      ('train-to-gain-levels','Training to Gain Levels','Addestramento per salire di livello',[132],
       {'ruleType':'downtime-variant','requiresEarnedXPForLevel':True,'delaysNewClassFeaturesUntilTraining':True,
        'table':[{'minimumLevel':lo,'maximumLevel':hi,'days':d,'totalCostGP':gp} for lo,hi,d,gp in [(2,4,10,20),(5,10,20,40),(11,16,30,60),(17,20,40,80)]],
        'costIsPerEntireTrainingNotPerDay':True,'replacesPHBLevelUpAutomatically':False},
       'Variante del DM: dopo gli XP richiesti, benefici del nuovo livello solo dopo addestramento. Quattro fasce con dieci–quaranta giorni e venti–ottanta mo complessive; il costo non è giornaliero e la variante non si attiva automaticamente.')]
    result=[]
    for i,name,it,pages,effect,summary in rows:
        e=record('rule',i,name,it,pages,{'requiresDMApproval':True,**effect},summary,book='dmg',optional=True)
        e['sources'][0]['verification']='read-local-render' if i not in ['downtime-renown','sacred-rites'] else 'read-local-text'
        result.append(e)
    return result


def unusual_travel_rules():
    ships=[('airship',20000,8,10,20,1,13,300,None),('galley',30000,4,80,0,150,15,500,20),
        ('keelboat',3000,1,1,6,0.5,15,100,10),('longship',10000,3,40,150,10,15,300,15),
        ('rowboat',50,1.5,1,3,0,11,50,None),('sailing-ship',10000,2,20,20,100,15,300,15),
        ('warship',25000,2.5,60,60,200,15,500,20)]
    result=[record('rule','swimming-travel','Swimming travel','Viaggio a nuoto',[117,118],
        {'requiresDMEnvironment':True,'withoutMagicOrSwimmingSpeed':{'saveAbility':'constitution','saveDC':10,'timing':'after-each-hour','failureExhaustionLevels':1,
            'depthHourMultiplier':[{'depthGreaterThanFt':100,'multiplier':2},{'depthGreaterThanFt':200,'multiplier':4}],'multipliersDoNotStack':True},
         'hasSwimmingSpeed':'normal-PHB-forced-march-no-hourly-swim-penalty','magicalSwimmingExamples':['dmg2014:magic-item:ring-of-swimming']},
        'Senza aiuto magico né velocità di nuoto, ogni ora richiede Costituzione dieci o indebolimento. Oltre cento piedi ogni ora conta doppia, oltre duecento quadrupla. Una velocità di nuoto usa invece la marcia forzata ordinaria.',book='dmg'),
        record('rule','underwater-visibility','Underwater visibility','Visibilità sott’acqua',[118],
        {'requiresDMEnvironment':True,'withoutPersonalLightSources':{'clear-bright-light':60,'clear-dim-light':30,'murky-or-no-light':10},'distanceUnit':'ft','personalLightSources':'DM-adjusts-encounter-distance; PHB-vision-rules-still-apply'},
        'Distanze indicative di incontro senza fonti personali: sessanta piedi in acqua limpida e luce intensa, trenta con luce fioca, dieci in acqua torbida o senza luce. Non concede vista al buio a chi ne è privo.',book='dmg'),
        record('rule','sea-travel','Travel at sea','Viaggio marittimo',[118,119,120],
        {'requiresDMEnvironment':True,'normalRowingHours':8,'longerRowing':'PHB-forced-march','fullyCrewedSailing':'all-day-in-shifts',
         'withinSightOfLand':'no-chance-of-navigation-lost','otherwiseNavigationRuleId':'dmg2014:rule:wilderness-navigation',
         'stormRequires':['strong-wind','heavy-rain'],'storm':'landmarks-unseen-except-lighthouse-or-bright-feature; navigation-check-disadvantage',
         'noWind':'cannot-move-under-sail-must-row','againstStrongWindSpeedMultiplier':0.5,
         'crowsNestClearVisibilityMiles':10,'overcastVisibilityMultiplier':0.5,'rainAndFogVisibility':'as-on-land',
         'shipwreck':{'trigger':'DM-story-no-fixed-event-roll','assumedPCSurvival':True,'wornAndCarriedEquipmentKept':True,'NPCAndCargoFate':'DM'}},
        'Otto ore normali ai remi, oltre marcia forzata; una nave a turni completi può navigare tutto il giorno. Terra visibile evita smarrimento. Pioggia intensa e vento forte fanno tempesta, con svantaggio per navigare; controvento velocità dimezzata. Naufragio è decisione narrativa del DM con sopravvivenza dei personaggi e oggetti indossati o trasportati.',book='dmg'),
        record('rule','ship-statistics','Airborne and Waterborne Vehicles','Veicoli aerei e marittimi',[120],
        {'ruleType':'vehicle-statistics','requiresDMCampaignAvailability':True,
         'vehicles':[{'index':i,'costGP':gp,'speedMilesPerHour':speed,'minimumSkilledCrew':crew,'smallMediumPassengers':passengers,'cargoTonsAsPrinted':cargo,
             'armorClass':ac,'hitPoints':hp,'damageThreshold':threshold,'damageThresholdStatus':'not-listed' if threshold is None else 'stated'}
             for i,gp,speed,crew,passengers,cargo,ac,hp,threshold in ships],
         'skilledCrewMinimumGPPerDayEach':2,'privateAccommodationPassengerFraction':0.2,
         'usualPassengerGPPerDay':{'sharedHammock':0.5,'smallPrivateCabin':2},
         'repair':{'requires':'berthed','daysPerHP':1,'GPPerHP':20,'includesMaterialsAndLabor':True},
         'damageThresholdRuleId':'dmg2014:rule:object-statistics',
         'loyaltyTrackingOptional':True,'disloyalAtLeastHalfCrew':'mutiny-at-sea-or-leave-when-berthed'},
        'Sette veicoli con costo, velocità, equipaggio, passeggeri, carico, CA, PF e soglia se indicata. Dirigibile e barca a remi non hanno soglia elencata, conservata come dato assente. Personale minimo due mo al giorno ciascuno; riparare un PF in porto costa un giorno e venti mo. Alloggi privati riducono a un quinto la capacità passeggeri.',book='dmg'),
        record('rule','flying-mount-travel','Flying mount travel','Viaggio su cavalcature volanti',[120,121],
        {'requiresDMEnvironment':True,'restHoursPerFlightHours':{'rest':1,'flight':3},'maximumFlightHoursPerDay':9,
         'untiringMountsExempt':True,'spellAndMagicItemFlight':'PHB-travel-on-foot-rules','randomEncounterNonFlyingResults':'ignore-unless-flying-low-enough-for-ranged-attacks'},
        'Cavalcature volanti riposano un’ora ogni tre di volo e volano al massimo nove ore al giorno, salvo forme che non si stancano. Volo da magie o oggetti segue le regole di viaggio PHB; negli incontri casuali chi non vola rileva solo se può raggiungere i viaggiatori con attacchi a distanza.',book='dmg')]
    for e in result:
        if e['index'] in ['underwater-visibility','ship-statistics']:e['sources'][0]['verification']='read-local-render'
    return result


def campaign_rules():
    rows=[
      ('renown','Renown and piety','Fama e pietà',[23,24],True,
       {'ruleType':'campaign-standing','initialRenown':0,'minimumRenown':0,'trackedSeparatelyPerOrganization':True,
        'DMGrantedMissionRenown':{'advancesInterests':1,'assignedMissionOrDirectBenefit':2},
        'sampleRankThresholds':[1,3,10,25,50],
        'sampleFactionRanks':{'harpers':['Watcher','Harpshadow','Brightcandle','Wise Owl','High Harper'],
            'order-of-the-gauntlet':['Chevall','Marcheon','Whitehawk','Vindicator','Righteous Hand'],
            'emerald-enclave':['Springwarden','Summerstrider','Autumnreaver','Winterstalker','Master of the Wild'],
            'lords-alliance':['Cloak','Redknife','Stingblade','Warduke','Lioncrown'],
            'zhentarim':['Fang','Wolf','Viper','Ardragon','Dread Lord']},
        'rankOtherPrerequisitesAndPerks':'DM-campaign-specific','memberAttitude':'default-not-guaranteed',
        'seriousOffenceRenownLoss':'DM','pietyVariant':{'trackedPerDeityOrPantheon':True,'divineFavourPrayerUsesPerDay':1,'effects':'DM-usually-cleric-spell-not-automatic-grant'}},
       'Fama separata per organizzazione, inizialmente zero e mai negativa. Missioni utili valgono di solito uno, assegnate o direttamente favorevoli due. Gradi e vantaggi dipendono dal DM; le soglie dei cinque gruppi sono esempi. Pietà usa il sistema per divinità, con favore divino deciso dal DM.'),
      ('npc-party-members','NPC party members','PNG nel gruppo',[93,94],False,
       {'countsAsPartyMemberForEncounterDifficulty':True,'XPShare':'full-equal-share','DMMayDelegateControl':True,
        'recommendedSupportingNPCLevel':'lowest-adventurer-level','classLevelsDoNotDetermineCR':'DM-monster-creation-guidelines'},
       'Un PNG che accompagna il gruppo conta per difficoltà degli incontri e quota piena dei PE. Il DM può delegarne il controllo, conservando la sua personalità. I livelli di classe non assegnano automaticamente un GS.'),
      ('npc-loyalty','Loyalty','Lealtà dei PNG',[94],True,
       {'ruleType':'NPC-loyalty','range':[0,20],'maximum':'highest-party-charisma-score','initial':'half-maximum-rounded-down',
        'secretTrackingByDM':True,'partyHighestCharismaChanges':'adjust-score-accordingly-DM-no-specific-formula',
        'increase':'1d4-if-bond-goal-helped-or-treated-well-or-rescued','decrease':'1d4-if-alignment-or-bond-opposed',
        'abusedMisledOrSelfishlyEndangeredDecrease':'2d4','cannotExceedMaximum':True,'cannotGoBelow':0,
        'zero':'disloyal-leaves-or-secretly-undermines','atLeast10':'risks-life-to-help',
        'tenuousRangeAsPrinted':[1,10],'score10Overlap':'source-descriptions-overlap-no-automatic-behavior-priority'},
       'Opzione: lealtà segreta, limite pari al Carisma più alto del gruppo e partenza a metà. Aiuto, doni o salvataggi aggiungono d4; violazioni sottraggono d4, abusi 2d4. Zero indica slealtà. Le descrizioni «almeno dieci» e «da uno a dieci» si sovrappongono: il comportamento resta al DM.'),
      ('ability-check-adjudication','Ability checks and retries','Prove e nuovi tentativi',[238,239,240],False,
       {'ruleType':'ability-check-adjudication','rollOnlyIf':'meaningful-failure-and-task-neither-trivial-nor-impossible',
        'unlimitedHarmlessRetry':'ten-times-normal-task-time-auto-success-if-success-possible',
        'failedAttemptMayPreventRetry':True,'DCGuidelines':{'very-easy':5,'easy':10,'moderate':15,'hard':20,'very-hard':25,'nearly-impossible':30},
        'skillDifferentAbility':'DM-justified','toolBonusRequiresToolUse':True,'sameProficiencyStacks':False},
       'Il DM richiede tiri quando fallire ha conseguenze e il compito è possibile. Con tentativi ripetibili senza rischio può bastare dieci volte il tempo, senza rendere possibile l’impossibile. CD indicative cinque–trenta; competenza negli strumenti richiede usarli e non somma duplicati.'),
      ('automatic-check-success','Automatic success','Successo automatico nelle prove',[240],True,
       {'ruleType':'optional-check-resolution','abilityScoreThresholdDC':'ability-score-minus-five',
        'proficientMaximumDC':10,'proficientAtTotalLevelAtLeast11MaximumDC':15,
        'excluded':['contests','saving-throws','attack-rolls']},
       'Variante: successo nelle prove con CD fino a caratteristica meno cinque; competenza dà successo fino a CD dieci, o quindici dal livello undici. Non si applica a contese, TS o attacchi.'),
      ('inspiration-variants','Inspiration variants','Varianti dell’Ispirazione',[241,242],True,
       {'ruleType':'optional-inspiration','normallyMaximumHeld':1,'heroicTimingOption':'may-spend-after-roll',
        'playersAwardVariant':{'firstAwardPerSession':'free','additionalAwards':'DM-gains-one-inspiration-per-extra-award','DMUses':'advantage-to-foe',
            'DMMaximumPool':None,'DMMaximumPoolStatus':'unlimited','DMUnspentCarriesAcrossSessions':True},
        'DMMayOmitInspiration':True,'frequencyOncePerSession':'guideline-not-entitlement'},
       'Il DM può omettere Ispirazione o adottare varianti: spesa dopo il tiro, oppure assegnazione fra giocatori. In quest’ultima, ulteriori assegnazioni dopo la prima danno Ispirazione al DM per gli avversari, conservabile fra sessioni e senza limite; il personaggio mantiene al massimo una.'),
      ('resolution-consequences','Resolution and consequences','Esiti delle prove',[243],True,
       {'successAtCostFailureMargin':[1,2],'mayComplicateExactDCSuccess':True,'costs':'DM-contextual',
        'failureDegrees':'DM-may-distinguish-margin-example-five-not-global-rule',
        'natural20Or1AbilityCheckOrSaveNormallySpecial':False,'exceptionalRollImpact':'DM-optional-not-automatic-success-or-failure',
        'specificRulesSuchAsDeathSavesTakePrecedence':True},
       'Il DM può concedere successo con complicazione per fallimenti di uno o due, o graduare gli esiti. Uno e venti naturali non danno normalmente effetti speciali in prove e TS; regole specifiche restano prioritarie.'),
      ('map-travel-pace','Map travel pace','Passo sulle mappe',[243],False,
       {'ruleType':'travel-table','rows':[{'scale':'dungeon','squareFt':10,'squaresPerMinute':[20,30,40]},
          {'scale':'city','squareFt':100,'squaresPerMinute':[2,3,4]},
          {'scale':'province','hexMiles':1,'hexesPerHour':[2,3,4],'hexesPerDay':[18,24,30]},
          {'scale':'kingdom','hexMiles':6,'hoursPerHex':[3,2,1.5],'hexesPerDay':[3,4,5]}],
        'columns':['slow','normal','fast'],'dailyDistanceUsesPrintedPHBTableNotHourTimesEight':True},
       'Tabella per mappe di dungeon, città, provincia e regno; conserva separatamente velocità orarie e percorrenze giornaliere stampate del PHB, senza ricalcolare queste ultime con otto ore.'),
      ('special-travel-pace','Special travel pace','Passo di viaggio speciale',[243,244],False,
       {'ruleType':'special-travel','eligible':['flying-speed','magical-speed','engine','natural-force'],
        'feetPerMinute':'speed-times-ten','milesPerHour':'speed-divided-by-ten','dailyMiles':'hourly-rate-times-hours-travelled',
        'typicalHours':8,'fastMultiplier':{'numerator':4,'denominator':3},'slowMultiplier':{'numerator':2,'denominator':3},
        'ordinaryWalkingGroupUsesPHBTravelTable':True},
       'Volo e movimento da magia, motore o forza naturale: piedi al minuto velocità per dieci, miglia all’ora velocità divisa dieci. Moltiplica per ore effettive, di solito otto; passo veloce quattro terzi, lento due terzi. Cammino ordinario usa la tabella PHB.'),
      ('experience-awards','Experience point awards','Assegnazione dei punti esperienza',[261,262],False,
       {'ruleType':'experience-awards','monsterDefeatIncludes':['kill','rout','capture'],'divideXP':'equal-shares-among-party',
        'substantiallyHelpfulNPC':'included-in-divisor','absentCharacterNormally':'no-XP','absentEqualXP':'DM-alternative',
        'noncombatAward':'DM-only-meaningful-risk-use-equivalent-encounter',
        'milestoneXP':{'major':'hard-encounter','minor':'easy-encounter'},'milestoneResourceRewards':'DM-discretion-not-universal-recovery'},
       'Dividi PE dei mostri sconfitti fra partecipanti, inclusi PNG che aiutano sostanzialmente. Assenti di solito esclusi, con alternativa del DM. Sfide senza combattimento devono avere rischio significativo. Traguardi maggiori e minori possono valere incontri difficili e facili, distinti dall’avanzamento senza PE.'),
      ('advancement-without-xp','Level advancement without XP','Avanzamento senza punti esperienza',[262],True,
       {'ruleType':'optional-advancement','methods':['sessions','story-goals'],'DMControlsLevelGain':True,
        'sessionGuideline':{'toLevel2':1,'toLevel3Additional':1,'toLevel4Additional':2,'subsequentLevelsAdditional':[2,3],'sessionHours':4}},
       'Opzione: il DM assegna livelli per sessioni o obiettivi narrativi. Indicativamente una sessione al secondo, un’altra al terzo, altre due al quarto e due–tre per livello successivo, considerando sessioni di quattro ore.'),
      ('spell-points','Spell points','Punti incantesimo',[289,290],True,
       {'ruleType':'spell-points','featureReplaced':'spellcasting-slots','pactMagicReplaced':False,
        'slotCosts':[2,3,5,6,7,9,10,11,13],'cantripsCost':0,'minimumPoints':0,'recovery':'all-on-long-rest',
        'oneSlotPerLevelAtLeast6PerLongRest':True,'cannotExceedMaximumSlotLevel':True,
        'fullCasterClasses':['bard','cleric','druid','sorcerer','wizard'],
        'halfClassLevel':['paladin','ranger'],'thirdClassLevel':['eldritch-knight','arcane-trickster'],'fractionalLevelRounding':'PHB-round-down',
        'multiclassAggregation':'not-explicitly-specified-DM-confirm-effective-level',
        'levels':[{'level':i,'points':p,'maximumSlotLevel':s} for i,(p,s) in enumerate([(4,1),(6,1),(14,2),(17,2),(27,3),(32,3),(38,4),(44,4),(57,5),(64,5),(73,6),(73,6),(83,7),(83,7),(94,8),(94,8),(107,9),(114,9),(123,9),(133,9)],1)]},
       'Variante per Incantesimi, distinta da Magia del Patto: punti creano slot al costo previsto, poi si lancia normalmente. Riposo lungo recupera tutti i punti. Slot di sesto–nono: uno per ciascun grado fra riposi lunghi; mai oltre il grado massimo. Paladino e ranger dimezzano il livello, Cavaliere Mistico e Mistificatore Arcano lo dividono per tre. L’aggregazione multiclassata richiede conferma del DM.'),
    ]
    result=[]
    for i,name,it,pages,optional,m,summary in rows:
        e=record('rule',i,name,it,pages,{'requiresDMAdjudication':True,**m},summary,book='dmg',optional=optional)
        if optional:e['mechanics']['requiresDMApproval']=True;e['fieldSources']['requiresDMApproval']=[0]
        if i=='npc-loyalty':
            e['interpretations'].append({'field':'score10Overlap','kind':'source-anomaly','method':'DMG PDF 94 states both at-least-ten and one-to-ten; no automatic threshold priority inferred.'})
        e['sources'][0]['verification']='read-local-render' if i in ['renown','npc-loyalty','ability-check-adjudication','map-travel-pace','spell-points'] else 'read-local-text'
        result.append(e)
    return result


def encounter_rules():
    thresholds=[(25,50,75,100),(50,100,150,200),(75,150,225,400),(125,250,375,500),
        (250,500,750,1100),(300,600,900,1400),(350,750,1100,1700),(450,900,1400,2100),
        (550,1100,1600,2400),(600,1200,1900,2800),(800,1600,2400,3600),(1000,2000,3000,4500),
        (1100,2200,3400,5100),(1250,2500,3800,5700),(1400,2800,4300,6400),(1600,3200,4800,7200),
        (2000,3900,5900,8800),(2100,4200,6300,9500),(2400,4900,7300,10900),(2800,5700,8500,12700)]
    daily=[300,600,1200,1700,3500,4000,5000,6000,7500,9000,10500,11500,13500,15000,18000,20000,25000,27000,30000,40000]
    encounter=record('rule','encounter-difficulty','Encounter difficulty','Difficoltà degli incontri',[83,84,85],
        {'ruleType':'encounter-guidelines','requiresDMAdjudication':True,
         'thresholds':[{'level':i,**dict(zip(['easy','medium','hard','deadly'],r,strict=True))} for i,r in enumerate(thresholds,1)],
         'partyThresholds':'sum-per-difficulty-over-each-participant','multipliers':[{'minimum':a,'maximum':b,'multiplier':m} for a,b,m in [(1,1,1),(2,2,1.5),(3,6,2),(7,10,2.5),(11,14,3),(15,None,4)]],
         'smallParty':'fewer-than-three-use-next-higher-multiplier; above-four-use-five',
         'largeParty':'at-least-six-use-next-lower-multiplier; below-one-use-half',
         'weakMonstersForMultiplier':'DM-exclude-unless-significant-contribution',
         'difficulty':'highest-threshold-at-or-below-adjusted-XP-already-present-in-local-copy',
         'adjustedXPIsAwardedXP':False,'monsterSpecialAbilitiesMayIncreaseActualDanger':True,
         'multipartWaves':'evaluate-separately-no-short-rest-between','multipartWarning':'adjusted-XP-over-one-third-daily-party-budget',
         'budgetExampleAtExactHardThreshold':'printed-example-includes-hard-threshold-in-medium-range; general-comparison-rule-takes-precedence'},
        'Somma soglie dei partecipanti e PE reali dei mostri, poi applica il moltiplicatore per numerosità e taglia del gruppo. I PE modificati misurano difficoltà, non il premio. La copia locale usa già la soglia più alta non superiore al totale, conforme alle errata. L’esempio sul limite medio/difficile non sostituisce questo criterio; capacità e situazione richiedono giudizio del DM.',book='dmg')
    day=record('rule','adventuring-day','The adventuring day','Giornata di avventura',85,
        {'ruleType':'encounter-guidelines','requiresDMAdjudication':True,'dailyAdjustedXP':[{'level':i,'adjustedXP':p} for i,p in enumerate(daily,1)],
         'typicalEncounters':[6,8],'typicalDifficulties':['medium','hard'],'typicalShortRests':2,
         'shortRestSuggestedFractions':[{'numerator':1,'denominator':3},{'numerator':2,'denominator':3}],
         'guaranteedEncounterCount':False,'automaticResourceRecovery':False},
        'Budget giornalieri indicativi di PE modificati per venti livelli. In condizioni tipiche sei–otto incontri medi o difficili e due riposi brevi, circa a un terzo e due terzi; nessuna garanzia né recupero automatico delle risorse.',book='dmg')
    for e in [encounter,day]:e['sources'][0]['verification']='read-local-render'
    return [encounter,day]


def consumable_variants():
    mixing=record('rule','potion-miscibility','Mixing potions','Mescolare pozioni',141,
       {'ruleType':'potion-miscibility','requiresDMApproval':True,'trigger':['drink-potion-while-another-active','combine-in-container'],
        'twoPotions':'one-d100-roll','eachAdditionalPotion':'another-roll-combine-results','reveal':'when-effect-becomes-evident',
        'rows':[{'low':a,'high':b,'effect':v} for a,b,v in [
            (1,1,{'mixerDamage':{'dice':'6d10','type':'force'},'creaturesWithinFt':5,'nearbyDamage':{'dice':'1d10','type':'force'}}),
            (2,8,{'becomes':'DM-chosen-ingested-poison'}),(9,15,{'bothPotions':'lose-effects'}),(16,25,{'onePotion':'loses-effect-DM-adjudicates-which'}),
            (26,35,{'bothPotions':'half-numerical-effects-and-duration','cannotHalve':'no-effect'}),
            (36,90,{'bothPotions':'normal'}),(91,99,{'onePotion':'double-numerical-effects-and-duration','neitherCanDouble':'both-normal'}),
            (100,100,{'onlyOneWorks':True,'permanentEffect':'DM-choose-simplest-or-most-enjoyable','DMExamples':[{'potion':'healing','HPMaximumIncrease':4},{'oil':'etherealness','result':'permanently-trapped-in-ethereal'}],'DMRemovalExamples':['dispel-magic','remove-curse']})]]},
       'Variante: un d100 per due pozioni, un ulteriore tiro per ogni aggiunta. Otto righe possono provocare esplosione, veleno, perdita, dimezzamento, funzionamento normale, raddoppio o effetto permanente scelto dal DM. Gli esempi di permanenza non diventano ricette garantite.',book='dmg',optional=True)
    mishap=record('rule','scroll-mishaps','Scroll mishaps','Incidenti con pergamene',141,
       {'ruleType':'scroll-mishaps','requiresDMApproval':True,'trigger':'tries-and-fails-to-cast-from-spell-scroll',
        'save':{'ability':'intelligence','dc':10},'failureRoll':'1d6',
        'rows':[{'low':i,'high':i,'effect':v} for i,v in enumerate([
            {'damageDice':'one-d6-per-spell-level','damageType':'force','target':'caster'},
            {'target':'caster-or-random-ally-instead; if-caster-intended-random-nearby-target'},
            {'origin':'random-location-within-spell-range'},
            {'effect':'contrary-to-normal-neither-harmful-nor-beneficial'},
            {'casterEffect':'minor-bizarre-related-to-spell-DM','duration':'original-spell-duration; instantaneous-instead-1d10-minutes'},
            {'delayHours':'1d12','casterIntended':'normal-effect','otherTargetMoved':'general-original-direction-up-to-maximum-range'}],1)]},
       'Variante: fallire un lancio da pergamena richiede Intelligenza dieci; fallendo, d6 per incidente. Possibili danno da forza per grado, cambio bersaglio o luogo, effetto innocuo contrario, stranezza temporanea o attivazione ritardata. Non modifica da sola consumo e interruzione del lancio della pergamena.',book='dmg',optional=True)
    for e in [mixing,mishap]:e['sources'][0]['verification']='read-local-render'
    return [mixing,mishap]
