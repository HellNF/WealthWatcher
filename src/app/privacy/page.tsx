import PublicPageShell, { Section, List } from '@/components/PublicPageShell'

export const metadata = { title: 'Privacy Policy — WealthWatcher' }

export default function PrivacyPage() {
  return (
    <PublicPageShell title="Privacy Policy" updated="13 luglio 2026">

      <p className="text-sm text-zinc-500 leading-relaxed border border-zinc-800 rounded-lg px-4 py-3 bg-zinc-900/40">
        WealthWatcher è un&apos;applicazione self-hosted: chi la installa e la gestisce (il
        &quot;titolare&quot;) è responsabile dell&apos;istanza e dei dati che vi transitano. Questo testo
        descrive come l&apos;applicazione stessa tratta i dati per funzionare; se stai usando
        un&apos;istanza gestita da qualcun altro, verifica anche con chi te l&apos;ha fornita.
      </p>

      <Section title="1. Titolare del trattamento">
        <p>
          Il titolare è la persona o il nucleo familiare che ha installato e gestisce questa
          istanza di WealthWatcher. Contatto: <strong>[inserisci qui la tua email]</strong>.
        </p>
      </Section>

      <Section title="2. Quali dati raccogliamo">
        <p>WealthWatcher tratta i dati che inserisci volontariamente per tracciare il tuo patrimonio:</p>
        <List items={[
          <>Dati di accesso: email e nome, tramite Google Sign-In o login con email in whitelist.</>,
          <>Dati bancari: istituzioni, conti correnti, saldi e movimenti — inseriti manualmente, importati da estratto conto (Intesa Sanpaolo, BBVA, Revolut) o, se attivi il collegamento Open Banking, sincronizzati automaticamente tramite Enable Banking. L&apos;IBAN completo non viene salvato: se la banca non fornisce un nome conto viene usato un IBAN mascherato (es. <code>IT••••••••3456</code>).</>,
          <>Dati di investimento: portafogli, strumenti finanziari, operazioni di acquisto/vendita, ISIN.</>,
          <>Profilo fiscale: residenza fiscale, data di nascita, tipo di impiego, reddito lordo — usati esclusivamente per calcolare stime IRPEF e imposte patrimoniali <em>in locale</em>, mai inviati a terzi.</>,
          <>Documenti KID (PDF) caricati per l&apos;estrazione automatica dei dati del prodotto finanziario, se usi questa funzione.</>,
          <>Altri beni: veicoli, immobili e relativi dati identificativi, se li aggiungi al patrimonio.</>,
          <>Chiavi API personali (OpenAI, Enable Banking): cifrate (AES-256-GCM) nel database, mai in chiaro.</>,
        ]} />
      </Section>

      <Section title="3. Dove sono conservati i dati">
        <p>
          Tutti i dati sono conservati in un database SQLite locale, sul server dove è
          installata questa istanza — non su un&apos;infrastruttura centralizzata gestita da terzi,
          salvo che il titolare abbia scelto di ospitare l&apos;istanza su un proprio server cloud.
        </p>
      </Section>

      <Section title="4. Servizi di terze parti">
        <p>
          Alcune funzionalità, solo se le attivi esplicitamente, comportano l&apos;invio di dati
          limitati a servizi esterni:
        </p>
        <List items={[
          <><strong>Google</strong> — solo per l&apos;accesso (Sign-In), se scegli questo metodo di login.</>,
          <><strong>Enable Banking</strong> — solo se colleghi una banca via Open Banking: autorizzi Enable Banking (in qualità di AISP tecnico) ad accedere in sola lettura ai conti che scegli tu, tramite un&apos;app che registri e gestisci personalmente. Puoi revocare l&apos;accesso in ogni momento (vedi §7).</>,
          <><strong>OpenAI</strong> — solo se carichi un documento KID e hai configurato la tua chiave: il testo del PDF viene inviato per l&apos;estrazione automatica dei dati.</>,
          <><strong>Yahoo Finance, CoinGecko, CoinMarketCap, Alpha Vantage, Frankfurter</strong> — per quotazioni di mercato e tassi di cambio: vengono inviati solo i ticker/simboli richiesti, nessun dato personale.</>,
          <><strong>AutoScout24</strong> — per la stima del valore dei veicoli: vengono inviati solo marca/modello/anno, nessun dato personale.</>,
        ]} />
        <p>
          Nessuno di questi servizi riceve dati oltre a quanto strettamente necessario alla
          singola funzione. WealthWatcher non vende né condivide i tuoi dati per finalità
          pubblicitarie e non integra strumenti di tracciamento/analytics di terze parti.
        </p>
      </Section>

      <Section title="5. Sicurezza">
        <p>
          Le chiavi API e altri segreti (chiave privata Enable Banking, chiave OpenAI, session
          ID delle connessioni bancarie) sono cifrati at-rest con AES-256-GCM; anche i backup del
          database sono cifrati, mai salvati in chiaro. L&apos;accesso all&apos;app richiede
          autenticazione; le sessioni durano al massimo 7 giorni e vengono ri-verificate contro
          la whitelist a ogni richiesta (rimuovere un accesso ha effetto immediato, non solo al
          prossimo login). Tentativi di accesso ripetuti e altre azioni sensibili sono soggetti a
          un limite di frequenza. Nessun sistema è invulnerabile: valuta tu il livello di
          esposizione accettabile per l&apos;ambiente dove ospiti l&apos;istanza. Dettagli tecnici
          in <code>docs/security-privacy.md</code> nel repository.
        </p>
      </Section>

      <Section title="6. Conservazione dei dati">
        <p>
          I dati restano finché il tuo account esiste. Eliminando un&apos;istituzione, un conto o
          un portafoglio, tutti i movimenti collegati vengono eliminati a cascata. Puoi
          rimuovere le tue chiavi API in qualsiasi momento dalle Impostazioni. I backup del
          database, se configurati dal titolare, seguono la politica di conservazione che il
          titolare stesso ha impostato per l&apos;istanza.
        </p>
      </Section>

      <Section title="7. I tuoi diritti">
        <p>
          Trattandosi di un&apos;applicazione self-hosted, hai (o chi amministra l&apos;istanza ha)
          accesso diretto al database: puoi correggere, esportare o cancellare i tuoi dati in
          qualsiasi momento. Per le connessioni Open Banking, puoi revocare il consenso
          direttamente da WealthWatcher (pagina dell&apos;istituzione → &quot;Scollega&quot;), operazione
          che invalida anche la sessione lato Enable Banking.
        </p>
      </Section>

      <Section title="8. Minori">
        <p>WealthWatcher non è pensato per l&apos;uso autonomo da parte di minori.</p>
      </Section>

      <Section title="9. Modifiche">
        <p>
          Questa pagina può essere aggiornata quando cambiano le funzionalità dell&apos;app o le
          integrazioni con servizi di terze parti. La data in alto riflette l&apos;ultimo
          aggiornamento.
        </p>
      </Section>

    </PublicPageShell>
  )
}
