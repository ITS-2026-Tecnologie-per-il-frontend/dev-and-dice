# Prove manuali di Sonno 2014

Usare una partita di prova, con due finestre separate: Master e giocatore. L’incantatore deve conoscere Sonno e avere slot disponibili. Per risultati prevedibili, aggiungere due creature senza immunità, Baldur e Noryn, con 13 PF attuali ciascuna. Eseguire le prove separatamente, ripristinando effetti e risorse nella partita di prova; iniziare con creature sveglie, salvo dove indicato diversamente. Il Master deve verificare posizione, portata e circostanza percepibile: non c’è un riconoscimento automatico degli eventi scritti a parole.

## Due lanci indipendenti

1. Nel turno dell’incantatore, lanciare Sonno con slot di 1°: selezionare Baldur nell’area e inserire 20 come totale dei 5d8.
2. Dal giocatore inviare e far approvare la richiesta. Dal Master usare **Calcola**, verificare l’esito e premere **Usa**.
3. **Lancia di nuovo** apre il form anche fuori turno, per consultarlo o compilarlo; l’invio resta bloccato fino al turno dell’incantatore. Attendere quel turno e ripetere selezionando soltanto Noryn.
4. Entrambi devono avere la pillola **Addormentato**. Il secondo lancio non deve rimuovere il primo, rinnovarne la durata o richiedere concentrazione. Ogni lancio consuma uno slot.
5. Infliggere 1 danno a Baldur: si sveglia e resta prono; Noryn continua a dormire. I PF temporanei che assorbono il danno non impediscono il risveglio.

## Preparare Sonno e rilasciarlo fuori turno

1. Nel turno dell’incantatore aprire **Azioni preparate → Prepara Sonno o un risveglio**. Il collegamento **Prepara Sonno come reazione** nel form normale porta a questa sezione.
2. Scegliere Sonno, uno slot di 2° e un evento percepibile, ad esempio «quando il goblin attraversa la porta». Il Master può scegliere il personaggio per cui agisce; il giocatore usa il proprio.
3. Se il pulsante è disabilitato, il messaggio indica chi sta agendo: attendere il turno dell’incantatore (o rimuovere un eventuale stato che gli impedisce di agire). Il giocatore preme **Invia preparazione al Master** e il Master approva la notifica. Se agisce direttamente il Master, preme **Prepara**.
4. Verificare: si consuma uno slot di 2°, inizia la concentrazione, nessuno si addormenta. Non si tirano ancora i d8.
5. Passare al turno di un’altra creatura. Quando l’evento avviene, aprire **Rilascia Sonno** nella card dell’azione preparata.
6. Inserire il totale dei 7d8 e le creature ora nell’area. Il giocatore invia la reazione; il Master può correggere l’area e confermare chi si addormenta. Se agisce direttamente il Master usa **Calcola → Usa reazione**.
7. Verificare: gli effetti iniziano soltanto alla conferma, la concentrazione per trattenere Sonno termina, si usa la reazione e non viene consumato un altro slot. La durata del sonno parte dal rilascio.
8. La reazione resta occupata fino all’inizio del prossimo turno del personaggio. Il testo dell’evento e la portata vanno verificati dal Master: il comando di rilascio è esplicito, non si attiva da solo.

## Immunità dichiarata dal Master

1. Inserire Baldur e Noryn nell’area con riserva 20 PF: può addormentarsi una sola delle due creature.
2. Nella notifica, oppure dopo **Calcola** nel form del Master, attivare **Immune a Sonno: Baldur**.
3. Baldur deve restare nell’area, ma non deve consumare riserva né addormentarsi. Il conteggio deve aggiornarsi e considerare Noryn.
4. Se i PF di una creatura non sono disponibili, **Calcola** permette comunque di aprire la revisione. Dichiarandola immune non servono PF inventati; senza immunità occorre completare la scheda prima di applicare.
5. Disattivare la dichiarazione per ricalcolare. Le immunità già note alla scheda continuano ad applicarsi: questa opzione aggiunge una dichiarazione del Master per quel lancio, non modifica permanentemente la scheda.

## Svegliare tramite un’azione preparata

1. Lasciare Noryn addormentato. Nel turno di un alleato sveglio, aprire **Azioni preparate** e scegliere **Svegliare una creatura**.
2. Selezionare Noryn e scrivere un evento, ad esempio «quando inizia il turno di Noryn». È possibile prepararsi anche prima che il bersaglio si addormenti.
3. Preparare e, per il giocatore, ottenere l’approvazione: viene impegnata l’azione dell’alleato, senza slot e senza concentrazione.
4. Quando l’evento si verifica, anche durante il turno di Noryn, premere **Evento avvenuto · Sveglia**. Il giocatore invia la reazione al Master; il Master può eseguirla direttamente.
5. Noryn si sveglia e resta prono. Si consuma la reazione dell’alleato, non l’azione o la reazione di Noryn. Il Master verifica che l’alleato sia a portata.

## Scadenza, interruzione e annullamento

- Preparare Sonno e premere **Abbandona**: la magia trattenuta e la sua concentrazione terminano; lo slot non viene restituito.
- Prepararlo e arrivare all’inizio del turno successivo dell’incantatore senza rilasciarlo: l’azione preparata scade. Anche in questo caso lo slot resta consumato.
- Prepararlo, subire danni e fallire il TS di concentrazione: il rilascio non deve più essere disponibile. Non si applicano effetti ai bersagli e lo slot resta consumato.
- Preparare di nuovo Sonno o lanciare un altro effetto che richiede concentrazione interrompe Sonno trattenuto; i precedenti lanci ordinari di Sonno continuano normalmente.
- Abbandonare mentre una richiesta di rilascio è in attesa annulla anche quella richiesta, impedendone l’approvazione successiva.
- Ricaricare entrambe le finestre: preparazione, effetti attivi e risorse devono restare coerenti. Ripetere un invio già registrato non deve consumare un altro slot o applicare di nuovo gli effetti.

## Verifiche automatiche

```sh
node tests/readied-sleep.mjs
node tests/sleep.mjs
node tests/sleep-state.mjs
node tests/sleep-advanced-ui.mjs
node tests/sleep-delivery-ui.mjs
```

Le prove nel browser usano account e archivi temporanei, senza modificare la partita reale. Le schermate desktop/mobile vengono salvate in `.test-runtime.local/sleep-ready-*.png` e `.test-runtime.local/sleep-recast-master-*.png`.

Fonti 2014: `MANUALI/D&D_5_Player_Original_Handbook.pdf`, pagine PDF 194 (Preparare), 204 (Concentrazione), 277 (Sonno), 293 (Privo di sensi); `MANUALI/D&D_5e_manuale_compatto_italiano.pdf`, SRD 5.1, pagina PDF 106 (Prepararsi, fino all’inizio del turno successivo).
