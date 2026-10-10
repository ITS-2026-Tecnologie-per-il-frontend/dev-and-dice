"""Structured PHB actions and weapon properties, independent of application labels."""
from curated import record


def actions():
    rows=[
      ('attack','Attack','Attaccare',193,{'activation':'action','attacks':1,'extraAttacks':'only-from-applicable-feature'},'Un attacco da mischia o a distanza; i privilegi possono aumentarne il numero.'),
      ('cast-a-spell','Cast a Spell','Lanciare un Incantesimo',193,{'activation':'spell-casting-time'},'Il tempo del singolo incantesimo determina quale risorsa del turno serve.'),
      ('dash','Dash','Scattare',193,{'activation':'action','additionalMovement':'current-speed','expires':'end-of-turn'},'Aggiungi movimento pari alla velocità attuale, dopo i modificatori.'),
      ('disengage','Disengage','Disimpegnarsi',193,{'activation':'action','movementProvokesOpportunity':False,'expires':'end-of-turn'},'Il movimento non provoca attacchi di opportunità per il resto del turno.'),
      ('dodge','Dodge','Schivare',193,{'activation':'action','expires':'start-of-next-turn','attackersDisadvantage':'if-you-see-attacker','dexteritySaveAdvantage':True,'lostWhen':['incapacitated','speed-zero']},'Ostacoli gli attacchi visibili e migliori i TS di Destrezza finché puoi agire e muoverti.'),
      ('help','Help','Aiutare',193,{'activation':'action','expires':'start-of-next-turn','check':'next-check-for-assisted-task','attack':'first-ally-attack-on-target-within-5-ft-of-helper','advantage':True},'Favorisci una prova del compagno o il suo primo attacco contro un bersaglio vicino a te.'),
      ('hide','Hide','Nascondersi',[178,193,195],{'activation':'action','check':{'ability':'dexterity','skill':'stealth'},'eligibility':'DM-determines-and-cannot-be-clearly-seen','comparison':'perception-or-passive-perception'},'Nascondersi richiede condizioni adatte e una prova, non una CD fissa.'),
      ('ready','Ready','Preparare',194,{'activation':'action','trigger':'perceivable','release':'reaction-after-trigger','responseChoice':['action','move-up-to-speed'],'spell':{'castingTimeRequired':'1-action','castImmediately':True,'concentrationRequired':True,'lostIfConcentrationBroken':True}},'Scegli un evento percepibile e una risposta; una magia preparata viene lanciata subito e trattenuta con concentrazione.'),
      ('search','Search','Cercare',194,{'activation':'action','DMChoosesCheck':[['wisdom','perception'],['intelligence','investigation']]},'Il tipo di ricerca determina se serve Percezione o Indagare.'),
      ('use-an-object','Use an Object','Usare un Oggetto',[190,194],{'activation':'action','requiredWhen':['item-requires-action','additional-object-interaction']},'Un uso che richiede azione o un’interazione ulteriore consuma questa azione.'),
    ]
    return [record('action',i,n,it,p,m,s) for i,n,it,p,m,s in rows]


def properties():
    rows=[
      ('ammunition','Ammunition','Munizioni',[147,148],{'expendedPerAttack':1,'recoverFraction':0.5,'searchMinutes':1,'meleeUse':'improvised'},'Servono munizioni; un minuto di ricerca dopo lo scontro ne recupera metà.'),
      ('finesse','Finesse','Accurata',148,{'abilityChoice':['strength','dexterity'],'sameAbilityForAttackAndDamage':True},'Puoi scegliere Forza o Destrezza, mantenendo la scelta per attacco e danni.'),
      ('heavy','Heavy','Pesante',148,{'smallCreaturesAttackDisadvantage':True},'Le creature Piccole hanno svantaggio; non applicare i requisiti di Forza del 2024.'),
      ('light','Light','Leggera',148,{'enables':'two-weapon-fighting-with-other-light-melee-weapon'},'La proprietà permette il combattimento con due armi secondo i relativi requisiti.'),
      ('loading','Loading','Ricarica',148,{'maxAmmunitionPerActivation':1,'activations':['action','bonus-action','reaction']},'Limita il numero di proiettili per singola azione, azione bonus o reazione.'),
      ('range','Range','Gittata',148,{'beyondNormal':'disadvantage','beyondLong':'cannot-attack','unit':'ft'},'Le due distanze rappresentano gittata normale e massima.'),
      ('reach','Reach','Portata',148,{'attackReachBonusFt':5,'opportunityReach':None},'Questa stampa menziona l’aumento per gli attacchi. L’applicazione agli attacchi di opportunità va documentata attraverso il rimando alle regole del combattimento.'),
      ('special','Special','Speciale',[148,149],{'weaponSpecific':True},'Consulta le regole proprie di lancia da cavaliere e rete.'),
      ('thrown','Thrown','Lancio',148,{'enables':'ranged-attack','meleeWeaponAbility':'same-as-melee-attack'},'Un’arma da mischia lanciata mantiene la caratteristica usata negli attacchi da mischia.'),
      ('two-handed','Two-Handed','A Due Mani',148,{'handsToUse':2},'L’uso dell’arma richiede entrambe le mani.'),
      ('versatile','Versatile','Versatile',148,{'handsChoice':[1,2],'twoHandMeleeDamage':'weapon-specific'},'Il dado indicato tra parentesi vale per l’attacco da mischia con due mani.'),
    ]
    return [record('weapon-property',i,n,it,p,m,s,missing=['opportunityReach'] if i=='reach' else None) for i,n,it,p,m,s in rows]


def additional_rules():
    rows=[
      ('score-generation','Generating Ability Scores','Generare le Caratteristiche',[14],{'random':{'diceCount':4,'die':6,'keepHighest':3,'repeat':6},'standardArray':[15,14,13,12,10,8],'pointBuy':{'optional':True,'budget':27,'minimum':8,'maximum':15,'costs':{'8':0,'9':1,'10':2,'11':3,'12':4,'13':5,'14':7,'15':9}}},'Assegna liberamente i risultati; applica poi gli incrementi razziali. L’acquisto a punti è una variante.'),
      ('turn-economy','Your Turn, Bonus Actions, Reactions','Economia del Turno',[190,191],{'roundSeconds':6,'normalActions':1,'move':'up-to-speed','bonusActionMaximum':1,'bonusActionRequires':'explicit-feature','reactionMaximumUntilNextTurn':1,'reactionRecovers':'start-of-own-turn','freeObjectInteractions':1},'Azioni bonus e reazioni richiedono un evento o una capacità che le consenta.'),
      ('movement','Movement and Position','Movimento',[191,192,193],{'canSplitBeforeAfterAttacks':True,'difficultTerrainExtraFtPerFt':1,'difficultTerrainMultipleSourcesStack':False,'crawlExtraFtPerFt':1,'standCost':'half-current-speed','cannotStandAtSpeedZero':True,'switchSpeed':'subtract-movement-already-used','otherCreatureSpace':'difficult-terrain','cannotWillinglyEndInOtherSpace':True},'I costi extra di terreno difficile e strisciare si sommano; cambiare velocità non azzera il movimento già usato.'),
      ('special-weapons','Special Weapons','Armi Speciali',[149],{'lance':{'disadvantageWithinFt':5,'handsUnlessMounted':2},'net':{'maxTargetSize':'Large','noEffectOn':'formless','condition':'restrained','escape':{'activation':'action','strengthDC':10},'destroy':{'AC':10,'slashingDamage':5},'maxAttacksPerActivation':1}},'La rete limita a un attacco per attivazione e può essere rimossa con una prova o distrutta.'),
      ('improvised-weapons','Improvised Weapons','Armi Improvvisate',[148,149],{'defaultDamage':'1d4','damageType':'DM-choice','thrownRangeFt':{'normal':20,'long':60},'similarWeapon':'DM-may-treat-as-that-weapon'},'Il DM può riconoscere un’arma simile; altrimenti usa il danno base dell’arma improvvisata.'),
      ('silvering','Silvered Weapons','Argentare Armi',[149],{'costGP':100,'choice':['one-weapon','ten-ammunition']},'Il costo include materiali e lavorazione.'),
      ('carrying-capacity','Lifting and Carrying','Capacità di Carico',[177],{'carryingLbPerStrength':15,'pushDragLiftLbPerStrength':30,'tinyMultiplier':0.5,'multiplierPerSizeAboveMedium':2,'pushDragAboveCarryingSpeedFt':5},'La taglia modifica carico e sollevamento; il trascinamento oltre la capacità riduce la velocità.'),
    ]
    return [record('rule',i,n,it,p,m,s) for i,n,it,p,m,s in rows]
