import PublicPageShell, { Section, List } from '@/components/PublicPageShell'

export const metadata = { title: 'Termini di servizio — WealthWatcher' }

export default function TermsPage() {
  return (
    <PublicPageShell title="Termini di servizio" updated="10 luglio 2026">

      <p className="text-sm text-zinc-500 leading-relaxed border border-zinc-800 rounded-lg px-4 py-3 bg-zinc-900/40">
        WealthWatcher è uno strumento software self-hosted per il tracciamento del patrimonio
        personale, non un istituto finanziario, una banca, un consulente fiscale o un
        intermediario regolamentato.
      </p>

      <Section title="1. Cos'è il servizio">
        <p>
          WealthWatcher consolida conti correnti, portafogli di investimento e altri beni in
          un&apos;unica vista, e fornisce stime informative su imposte italiane (capital gain,
          bollo, IVAFE, IRPEF). È distribuito come software da installare ed eseguire in
          autonomia (self-hosted); l&apos;uso previsto è personale o familiare.
        </p>
      </Section>

      <Section title="2. Nessuna consulenza professionale">
        <p>
          Le stime fiscali, di rendimento e di valore prodotte dall&apos;app sono calcoli
          informativi automatizzati, basati su regole generali e dati che tu stesso inserisci
          o importi. <strong>Non costituiscono consulenza fiscale, legale o finanziaria</strong>.
          Per decisioni con impatto reale, verifica sempre con un professionista abilitato.
        </p>
      </Section>

      <Section title="3. Nessuna garanzia">
        <p>
          Il servizio è fornito &quot;così com&apos;è&quot;, senza garanzie di alcun tipo. In particolare
          non garantiamo:
        </p>
        <List items={[
          <>l&apos;accuratezza dei prezzi/quotazioni recuperati da provider esterni (Yahoo Finance, CoinGecko, ecc.);</>,
          <>la continuità o affidabilità del collegamento Open Banking con Enable Banking o con le singole banche;</>,
          <>la correttezza delle stime fiscali rispetto alla normativa vigente, che può cambiare;</>,
          <>l&apos;assenza di errori di importazione, categorizzazione o calcolo.</>,
        ]} />
      </Section>

      <Section title="4. Limitazione di responsabilità">
        <p>
          Nei limiti consentiti dalla legge applicabile, l&apos;uso dell&apos;app è a tuo rischio: chi
          sviluppa e chi gestisce l&apos;istanza non risponde di perdite, danni o decisioni prese
          sulla base dei dati o delle stime mostrate dall&apos;applicazione.
        </p>
      </Section>

      <Section title="5. Responsabilità dell'utente">
        <List items={[
          <>Sei responsabile della riservatezza delle tue credenziali di accesso e delle tue chiavi API (OpenAI, Enable Banking).</>,
          <>Puoi collegare tramite Open Banking solo conti bancari di cui sei titolare o che sei autorizzato ad autorizzare.</>,
          <>L&apos;accesso all&apos;app è riservato agli indirizzi email in whitelist, gestita da chi amministra l&apos;istanza.</>,
        ]} />
      </Section>

      <Section title="6. Consenso Open Banking (PSD2)">
        <p>
          Collegando una banca tramite Enable Banking, autorizzi esplicitamente l&apos;accesso in
          sola lettura (saldi e movimenti) tramite un&apos;applicazione Enable Banking registrata e
          gestita da te stesso, secondo le regole PSD2 sui servizi di informazione sui conti
          (AIS). Il consenso ha una durata limitata nel tempo e puoi revocarlo in qualsiasi
          momento dalla pagina dell&apos;istituzione collegata (&quot;Scollega&quot;), il che invalida anche
          la sessione presso Enable Banking. WealthWatcher non effettua mai pagamenti né
          movimenta denaro: l&apos;accesso è esclusivamente in lettura.
        </p>
      </Section>

      <Section title="7. Modifiche e cessazione">
        <p>
          Chi amministra l&apos;istanza può modificare, sospendere l&apos;accesso (rimuovendo un&apos;email
          dalla whitelist) o interrompere il servizio in qualsiasi momento. Questi termini
          possono essere aggiornati quando cambiano le funzionalità dell&apos;app.
        </p>
      </Section>

      <Section title="8. Legge applicabile">
        <p>
          Questi termini sono regolati dalla legge italiana, coerentemente con il fatto che le
          funzionalità fiscali dell&apos;app sono calibrate sulla normativa tributaria italiana.
        </p>
      </Section>

    </PublicPageShell>
  )
}
