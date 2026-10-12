"""PHB PDF 124–126, 128–142 read; all background tables checked on renders.

Italian entries paraphrase the suggestions. They never enforce alignment or
replace player-written characteristics. Original IDs and equipment are kept.
"""
from curated import source

# Traits (d8), ideals (d6), bonds (d6), flaws (d6), in original roll order.
# Ideal alignment labels are suggestions; '-' means absent in this printing.
TABLES = {
 'acolyte': [
  'Prendo a modello un eroe della fede|Cerco intesa fra nemici|Leggo presagi in ogni evento|Conservo un ottimismo incrollabile|Cito proverbi sacri anche imprecisamente|Accolgo o condanno altre religioni|Rimpiango gli agi del tempio|Sono inesperto dei rapporti fuori dal tempio',
  'lawful:Preservare i riti antichi|good:Aiutare chi ha bisogno|chaotic:Favorire i cambiamenti divini|lawful:Raggiungere il vertice religioso|lawful:Affidarsi alla guida della divinità|any:Meritare il favore divino attraverso le azioni',
  'Recuperare una reliquia perduta|Vendicarmi dei religiosi che mi dichiararono eretico|Ripagare il sacerdote che mi accolse orfano|Agire per la gente comune|Proteggere il mio tempio|Salvare un testo sacro ritenuto eretico',
  'Giudico duramente tutti, soprattutto me|Mi fido troppo della gerarchia|La devozione mi rende ingenuo verso i correligionari|Il mio pensiero è rigido|Diffido degli estranei|Una meta assorbe ogni altra preoccupazione'],
 'charlatan': [
  'Mi innamoro continuamente|Scherzo anche fuori luogo|Ottengo ciò che voglio con l’adulazione|Non resisto alle scommesse rischiose|Mento anche senza motivo|Uso sarcasmo e insulti|Invoco la divinità più utile al momento|Intasco oggetti potenzialmente preziosi',
  'chaotic:Nessuno decide per me|lawful:Non truffare chi non può perdere denaro|good:Distribuire il ricavato ai bisognosi|chaotic:Inventare sempre truffe nuove|good:Preferire le amicizie ai beni|any:Diventare qualcuno',
  'Tenere lontana una vittima pericolosa|Devo tutto a un pessimo mentore|Migliorare il mondo per un figlio ignaro di me|Riprendere terre e titolo sottratti|Vendicare una persona amata|Espiare una truffa contro un innocente',
  'La bellezza mi abbaglia|Spendo in lusso più di quanto guadagno|Mi ritengo impossibile da ingannare|Il denaro mi spinge a rischiare troppo|Voglio truffare chi è più potente|Scappo per salvarmi quando tutto peggiora'],
 'criminal': [
  'Preparo sempre un piano per gli imprevisti|Rimango calmo e controllato|Individuo subito oggetti preziosi e nascondigli|Preferisco un amico a un nemico|Concedo fiducia lentamente|Ignoro rischi e probabilità|Una sfida al mio orgoglio mi convince|Reagisco furiosamente agli insulti',
  'lawful:Non derubare altri criminali|chaotic:Spezzare catene e oppressori|good:Rubare ai ricchi per i bisognosi|evil:Arricchirsi a qualunque costo|neutral:Fedeltà agli amici|good:Trovare possibilità di redenzione in tutti',
  'Ripagare un benefattore|Mantenere la famiglia con i proventi|Riprendere qualcosa che mi è stato sottratto|Diventare il ladro più famoso|Redimere un grave crimine|Evitare un altro errore che uccida una persona amata',
  'Il valore mi ossessiona finché non lo rubo|Preferisco il denaro agli amici|Dimentico o ignoro i piani|Un gesto tradisce le mie bugie|Fuggo davanti al pericolo|Accetto che un innocente sconti il mio crimine'],
 'entertainer': [
  'Conosco storie adatte a ogni occasione|Raccolgo e diffondo pettegolezzi|Cerco sempre l’amore ideale|Sciolgo la tensione e la rabbia|Apprezzo gli insulti arguti anche contro me|Soffro senza essere al centro dell’attenzione|Pretendo la perfezione|Cambio umore con grande rapidità',
  'good:Rendere migliore il mondo con la bellezza|lawful:Conservare storie e canti antichi|chaotic:Creare idee e azioni nuove|evil:Cercare denaro e fama|neutral:Far sorridere il pubblico|any:Esprimere nell’arte la propria verità',
  'Custodire lo strumento legato a qualcuno che amo|Recuperare uno strumento rubato|Diventare famoso comunque|Eguagliare un eroe delle storie|Superare un rivale odiato|Proteggere la mia vecchia compagnia',
  'Sacrifico tutto alla notorietà|Cedo al fascino di un bel volto|Uno scandalo mi impedisce di tornare|Ho offeso un nobile e potrei rifarlo|La sincerità tagliente mi danneggia|Deludo gli amici nonostante le intenzioni'],
 'folk-hero': [
  'Giudico dai fatti|Aiuto chi è in difficoltà|Persevero fino alla meta|Cerco soluzioni eque|Trasmetto fiducia nelle capacità|Preferisco agire a riflettere|Uso male parole difficili|Aspetto impaziente il mio destino',
  'good:Trattare tutti con dignità|lawful:Uguale giustizia per tutti|chaotic:Contrastare i tiranni|evil:Usare la forza per prendere ciò che voglio|neutral:Essere sinceri con se stessi|any:Seguire la propria vocazione',
  'Ritrovare la famiglia dispersa|Proteggere la terra che coltivavo|Punire i prepotenti dopo un abuso nobiliare|Conservare gli attrezzi come memoria|Difendere chi è indifeso|Riunirmi all’amore lasciato a casa',
  'Un tiranno vuole uccidermi|Il destino mi rende cieco ai limiti|Nascondo una vergogna ai vecchi conoscenti|Cedo ai vizi cittadini e all’alcol|Desidero segretamente governare da tiranno|Diffido degli alleati'],
 'guild-artisan': [
  'Sono perfezionista|Disprezzo chi non capisce l’arte|Voglio capire oggetti e persone|Cito massime e proverbi|Sono scortese con pigri e sleali|Parlo a lungo del mestiere|Contratto ostinatamente|Mi stupisco se non conoscono il mio lavoro',
  'lawful:Rafforzare comunità e civiltà|good:Usare il talento a beneficio di tutti|chaotic:Lasciare libertà di mestiere|evil:Cercare solo guadagno|neutral:Dedizione alle persone care|-:Diventare il migliore nel proprio lavoro',
  'Proteggere la bottega dell’apprendistato|Trovare chi merita la mia opera|Ripagare la gilda|Ottenere amore attraverso la ricchezza|Tornare come migliore artigiano|Vendicare la distruzione della bottega',
  'Farei tutto per un pezzo raro|Sospetto subito una truffa|Nascondo un furto alla gilda|Desidero sempre di più|Ucciderei per un titolo nobiliare|Invidio chi mi supera'],
 'hermit': [
  'Parlo poco e uso gesti|Conservo serenità nelle crisi|Ripeto la saggezza del capo della comunità|Sento il dolore degli altri|Ignoro etichetta e aspettative|Vedo un piano cosmico ovunque|La contemplazione mi distrae dal presente|Espongo una grande teoria filosofica',
  'good:Condividere i propri doni|lawful:Usare la logica senza distorsioni emotive|chaotic:Favorire curiosità e ricerca libera|evil:Ottenere potere attraverso l’isolamento|neutral:Non interferire nella vita altrui|any:Conoscere se stessi',
  'Proteggere i membri dell’eremo|Affrontare chi mi costrinse a nascondermi|Raggiungere l’illuminazione|Ricordare un amore impossibile|Custodire una scoperta che potrebbe rovinare il mondo|Distruggere il male compreso durante l’isolamento',
  'Esagero con i piaceri ritrovati|Conservo impulsi sanguinari|Sono dogmatico|Voglio vincere le discussioni più che salvare amicizie|Rischio troppo per conoscenze perdute|Non condivido i segreti'],
 'noble': [
  'Adulo con grande eloquenza|Sono amato per la generosità|Esibisco una dignità superiore|Seguo moda e cura dell’aspetto|Rifiuto sporcizia e alloggi indegni|Non mi considero superiore per nascita|La mia benevolenza non torna se perduta|Distruggo chi mi danneggia',
  'good:Esigere rispetto ma concederlo a tutti|lawful:Rispettare la gerarchia|chaotic:Dimostrare autonomia dalla famiglia|evil:Raggiungere potere senza padroni|any:Anteporre la famiglia|good:Proteggere chi dipende da me',
  'Meritare l’approvazione familiare|Mantenere un’alleanza tra casate|Proteggere ogni familiare|Amare l’erede di una famiglia nemica|Essere fedele al sovrano|Apparire un eroe alla gente comune',
  'Mi ritengo superiore a tutti|Nascondo uno scandalo rovinoso|Leggo insulti in ogni parola|Sono insaziabile nei piaceri|Credo di essere il centro del mondo|Disonoro spesso la famiglia'],
 'outlander': [
  'Il desiderio di viaggiare mi guida|Proteggo gli amici come piccoli animali|Ho corso venticinque miglia per avvertire il clan|Imparo lezioni dalla natura|Disprezzo ricchezza e buone maniere|Giocherello con oggetti fino a romperli|Preferisco animali a persone|Sono cresciuto tra i lupi',
  'chaotic:Cambiare insieme alle stagioni|good:Cercare la felicità della tribù|lawful:Preservare l’onore del clan|evil:Lasciare il dominio ai più forti|neutral:Anteporre la natura alla civiltà|any:Guadagnare gloria in battaglia',
  'Anteporre famiglia e clan|Difendere la natura della mia patria|Vendicare la terra distrutta|Preservare la memoria della tribù estinta|Impedire una catastrofe prevista|Garantire discendenza alla tribù',
  'Cedo troppo agli intossicanti|Rifiuto ogni prudenza|Conservo rancore per gli insulti|Diffido di altri popoli|Rispondo quasi sempre con violenza|Abbandono chi non sa salvarsi'],
 'sage': [
  'Uso parole elaborate|Vanto letture sterminate|Spiego pazientemente ai meno istruiti|Amo i misteri|Ascolto tutte le opinioni prima di giudicare|Parlo lentamente a chi reputo stolto|Sono socialmente impacciato|Temo furti dei miei segreti',
  'neutral:Raggiungere potere e crescita attraverso sapere|good:Cercare verità attraverso bellezza|lawful:Anteporre logica a emozioni|chaotic:Non limitare le possibilità dell’esistenza|evil:Usare conoscenza per dominare|any:Migliorare se stessi studiando',
  'Proteggere gli studenti|Custodire un testo pericoloso|Conservare un luogo di studio|Completare una raccolta di trattati|Rispondere alla domanda di una vita|Riscattare l’anima venduta per sapere',
  'La promessa di informazioni mi distrae|Studio mostri pericolosi invece di fuggire|Sacrificherei una civiltà a un mistero|Ignoro soluzioni semplici|Insulto parlando senza riflettere|Non so mantenere segreti'],
 'sailor': [
  'Gli amici possono contare su di me|Lavoro molto per divertirmi molto|Cerco amici nei nuovi porti|Abbellisco le storie|Apprezzo le risse di taverna|Accetto ogni scommessa amichevole|Parlo in modo osceno|Preferisco un lavoro ben fatto da altri',
  'good:Rispetto reciproco tra capitano ed equipaggio|lawful:Condividere equamente i risultati|chaotic:Trovare libertà sul mare|evil:Predare altre navi|neutral:Fedeltà ai compagni|any:Possedere una nave e scegliere il destino',
  'Servire prima il capitano|Proteggere la nave più dei suoi uomini|Ricordare la prima nave|Ritrovare un amore in porto|Recuperare proventi sottratti|Vendicare equipaggio e capitano uccisi dai pirati',
  'Obbedisco anche agli ordini sbagliati|Mento per evitare lavoro|Non indietreggio se sfidano il coraggio|Non riesco a smettere di bere|Intasco piccoli oggetti|L’orgoglio potrebbe rovinarmi'],
 'soldier': [
  'Sono educato e rispettoso|La guerra mi perseguita nei ricordi|Fatico a legarmi dopo tante perdite|Racconto episodi militari istruttivi|Non mi lascio intimorire facilmente|Amo forza e distruzione|Ho umorismo rozzo|Affronto direttamente i problemi',
  'good:Sacrificarsi per proteggere gli altri|lawful:Obbedire all’autorità giusta|chaotic:Rifiutare obbedienza cieca|evil:Il più forte prevale|neutral:Non uccidere per ideali|any:Anteporre città, popolo o nazione',
  'Sacrificarmi per i vecchi compagni|Non abbandonare amici dopo essere stato salvato|Preservare l’onore|Ricordare la sconfitta e i responsabili|Difendere chi combatte al mio fianco|Proteggere chi non può combattere',
  'Temo ancora il nemico della guerra|Disprezzo chi non è guerriero|Nascondo un errore costato molte vite|Odio ciecamente i nemici|Obbedisco alla legge anche se fa soffrire|Non ammetto mai un errore'],
 'urchin': [
  'Nascondo cibo e piccoli tesori|Faccio molte domande|Cerco spazi stretti sicuri|Dormo protetto da una parete con i miei averi|Mangio senza buone maniere|Diffido della gentilezza|Evito di lavarmi|Dico apertamente ciò che altri nascondono',
  'good:Rispettare ricchi e poveri|lawful:Prendersi cura della comunità|chaotic:Rovesciare le gerarchie|evil:Far conoscere ai ricchi la vita dei poveri|neutral:Aiutare chi mi aiuta|-:Dimostrare di meritare una vita migliore',
  'Difendere la città natale|Sostenere un orfanotrofio|Ripagare un monello che mi insegnò a sopravvivere|Onorare un debito di gratitudine enorme|Sfuggire al potente che ho derubato|Evitare ad altri le mie privazioni',
  'Fuggo se sono in minoranza|Faccio quasi tutto per denaro|Mi fido solo di me|Preferisco uccidere nel sonno|Giustifico il furto con il bisogno|Disprezzo chi non sa badare a sé']
}

SPECIALTIES = {
 'charlatan': (6,129,1,1,'Truffe al gioco|Monete alterate o documenti falsi|Manipolazione personale per ottenere patrimoni|Identità sempre nuove|Trucchi manuali nelle strade|Vendita di cianfrusaglie come preziosi'),
 'criminal': (8,130,1,1,'Ricattatore|Scassinatore|Intimidatore|Ricettatore|Rapinatore di strada|Sicario|Borseggiatore|Contrabbandiere'),
 'entertainer': (10,131,1,3,'Attore|Danzatore|Mangiafuoco|Giullare|Giocoliere|Strumentista|Poeta|Cantante|Narratore|Acrobata'),
 'folk-hero': (10,132,1,1,'Opposizione agli agenti di un tiranno|Salvataggio durante un disastro naturale|Scontro solitario con un mostro|Furto a un mercante corrotto per i poveri|Guida di milizia contro invasori|Armi sottratte al tiranno per il popolo|Contadini addestrati con attrezzi agricoli|Decreto revocato dopo una protesta simbolica|Benedizione o origine rivelata da una creatura soprannaturale|Comando e riconoscimento nell’esercito'),
 'guild-artisan': (20,133,1,1,'Alchimia e farmacia|Armature, serrature e metalli fini|Birra, distillati e vino|Calligrafia e scrittura|Carpenteria, tetti e intonaci|Mappe e misurazioni|Calzature|Cucina e panificazione|Vetro|Gioielli e gemme|Pelli e concia|Muratura e pietra|Pittura e insegne|Ceramiche e piastrelle|Navi e vele|Fabbri e forgiatori|Riparazioni e fusioni|Carri e ruote|Tessitura e tintura|Intaglio, botti e archi'),
 'hermit': (8,135,1,1,'Ricerca di illuminazione|Comunità religiosa|Esilio per un crimine non commesso|Ritiro dopo una svolta personale|Creazione artistica o letteraria|Contatto con la natura|Custodia di rovine o reliquie|Pellegrinaggio spirituale'),
 'outlander': (10,137,1,1,'Boscaiolo o guardaboschi|Cacciatore con trappole|Colono|Guida|Esule|Cacciatore di taglie|Pellegrino|Nomade tribale|Cacciatore-raccoglitore|Predone tribale'),
 'sage': (8,138,1,1,'Alchimista|Astronomo|Accademico screditato|Bibliotecario|Professore|Ricercatore|Apprendista mago|Scriba'),
 'soldier': (8,141,1,1,'Ufficiale|Esploratore|Fante|Cavaliere|Guaritore|Quartiermastro|Portabandiera|Personale di supporto')
}

FEATURES = {
 'acolyte': {'healingAndCare':{'beneficiaries':'self-and-adventuring-companions','location':'established-presence-of-own-faith','costGP':0,'materialComponentsProvidedBy':'character'},'modestLifestyleSupportFor':'self-only','templeAssistanceRequires':['near-associated-temple','good-standing','request-not-hazardous'],'canPerformReligiousCeremonies':True},
 'charlatan': {'secondIdentityIncludes':['documents','established-acquaintances','disguises'],'documentForgeryRequires':'seen-example-of-document-type-or-handwriting'},
 'criminal': {'reliableContact':True,'messageNetwork':['local-messengers','corrupt-caravan-masters','seedy-sailors'],'longDistanceMessages':True},
 'entertainer': {'performanceVenueFound':True,'freeFoodAndLodging':{'standardChoices':['modest','comfortable'],'condition':'perform-each-night','qualityDeterminedBy':'establishment'},'localRecognition':'usually-friendly'},
 'folk-hero': {'hideRestRecuperateAmong':'common-folk','protectionFrom':['law','other-pursuers'],'excludedIf':'character-dangerous-to-hosts','hostsRiskTheirLives':False},
 'guild-artisan': {'support':['food-and-lodging-if-needed','funeral-costs','professional-contacts'],'legalSupportIf':['case-for-innocence','justifiable-crime'],'politicalAccessRequires':'good-standing-may-require-donation','monthlyDuesGP':5,'missedDuesMustBePaid':True},
 'hermit': {'discovery':{'scope':'unique-and-powerful-campaign-revelation','detailsDeterminedWith':'DM','fixedMechanicalBonus':None}},
 'noble': {'access':['high-society','audience-with-local-noble'],'socialTreatment':'commoners-accommodate-and-nobles-recognize-peer'},
 'outlander': {'recallGeneralGeography':True,'findFoodAndFreshWater':{'peopleIncludingSelf':6,'period':'day','requires':'land-offers-food-and-water'}},
 'sage': {'ifLoreUnknown':'often-know-location-or-person-to-consult','DMMayRule':['nearly-inaccessible','unavailable'],'researchMayRequireAdventure':True,'automaticKnowledge':False},
 'sailor': {'freePassageFor':'self-and-adventuring-companions','requires':'prior-ship-or-good-relations','scheduleAndRouteGuaranteed':False,'travelTimeDeterminedBy':'DM','reciprocalService':'assist-crew-during-voyage'},
 'soldier': {'rankRecognizedBy':'former-military-organization','authorityOver':'loyal-lower-ranked-soldiers','temporaryRequisitions':['simple-equipment','horses'],'usualAccess':'friendly-military-sites-recognizing-rank'},
 'urchin': {'urbanTravelSpeedMultiplier':2,'beneficiaries':'self-and-led-companions','requires':'not-in-combat'}
}


def apply_background_reviews(entities):
    by_id={e['id']:e for e in entities}
    for index,strings in TABLES.items():
        e=by_id['phb2014:background:'+index]
        tables={}
        for category,sides,text in zip(['traits','ideals','bonds','flaws'],[8,6,6,6],strings):
            entries=[]
            for roll,summary in enumerate(text.split('|'),1):
                entry={'roll':roll,'summaryIt':summary}
                if category=='ideals':
                    label,entry['summaryIt']=summary.split(':',1)
                    entry['suggestedAlignmentAspect']=None if label=='-' else label
                entries.append(entry)
            if len(entries)!=sides:raise ValueError('Invalid reviewed table: '+index+'.'+category)
            tables[category]={'die':'d'+str(sides),'entries':entries}
        m=e['mechanics'];m['personalityTables']=tables
        m['personalitySelection']={'traits':2,'ideals':1,'bonds':1,'flaws':1,'methods':['choose','roll','write-own'],'suggestionsOnly':True,'alignmentRestricted':False}
        m['feature']['effect']=FEATURES[index]
        if index in SPECIALTIES:
            sides,page,minimum,maximum,text=SPECIALTIES[index]
            entries=[{'roll':i,'summaryIt':s} for i,s in enumerate(text.split('|'),1)]
            if len(entries)!=sides:raise ValueError('Invalid reviewed specialty: '+index)
            m['specialtyChoice']={'die':'d'+str(sides),'minimumChoices':minimum,'maximumChoices':maximum,'entries':entries,'suggestionsOnly':True}
        if index=='hermit':e['sources'][0]['pdfPages']=[135,136];e['sources'][0]['printedPages']=[134,135]
        for s in e['sources']:s['verification']='read-local-render'
        for field in ['personalityTables','personalitySelection','feature','specialtyChoice']:
            if field in m:e['fieldSources'][field]=[0]
        e['sources'].append(source([124,125,126,128],'Personal Characteristics; Suggested Characteristics; Customizing a Background'))
        e['fieldSources']['personalitySelection']=[len(e['sources'])-1]
        missing=[f for f in e['verification']['missingFields'] if f!='personalityTables']
        e['verification'].update(complete=not missing,missingFields=missing)
    # Separate optional replacement privilege and the knight's squire variant.
    knight=by_id['phb2014:background-variant:knight']
    knight['mechanics'].update(retainerTasks='mundane-noncombat',retainersLeaveIf=['frequently-endangered','abused'],
       commonerRetainers=2,nobleSquireRetainers=1,forbidsFollowingInto='obviously-dangerous-areas')
    knight['summaryIt']='Tre servitori leali svolgono mansioni ordinarie senza combattere o entrare in pericoli evidenti; lasciano il servizio se esposti spesso al pericolo o maltrattati. Nel cavaliere uno dei tre è uno scudiero nobile.'
    for field in knight['mechanics']:knight['fieldSources'][field]=[0]
    noble=by_id['phb2014:background:noble']
    noble['mechanics']['alternateFeature']={'name':'Retainers','nameIt':'Servitori','effect':{
       'retainers':3,'type':'commoner','tasks':'mundane-noncombat','fightForCharacter':False,
       'forbidsFollowingInto':'obviously-dangerous-areas','leaveIf':['frequently-endangered','abused']},
       'summaryIt':'In alternativa al privilegio sociale, tre popolani leali svolgono mansioni ordinarie senza combattere o seguirti nei pericoli evidenti; si allontanano se maltrattati o esposti spesso al rischio.'}
    sailor=by_id['phb2014:background:sailor']
    sailor['mechanics']['alternateFeature']={'name':'Bad Reputation','nameIt':'Cattiva Reputazione','effect':{
       'scope':'civilized-settlement','offenses':'minor-crimes','response':'most-people-do-not-report-to-authorities','blanketLegalImmunity':False},
       'summaryIt':'La reputazione intimidisce la maggior parte degli abitanti di un insediamento, che può non denunciare piccoli reati. Non concede immunità generale alla legge.'}
    for e in [noble,sailor]:e['fieldSources']['alternateFeature']=[0]
    for e in entities:
        if e['kind']=='background-variant':
            e['sources'][0]['verification']='read-local-render'
            e['optional']=True
    # These two options are offered to the base background, not only its variant.
    for e in entities:
        if e['kind']=='background':
            e.setdefault('relations',{})['variantIds']=[v['id'] for v in entities if v['kind']=='background-variant' and v['relations']['backgroundId']==e['id']]
    rule=by_id['phb2014:rule:background-customization']
    rule['mechanics'].update(duplicateProficiencyReplacement={'when':'same-proficiency-from-two-different-sources','mustMatchKind':['skill','tool']},
       buyingGearExcludes=['background-equipment-package','class-equipment-package'])
    for field in rule['mechanics']:rule['fieldSources'][field]=[0]
    return entities
