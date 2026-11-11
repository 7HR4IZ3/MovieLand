import { Link } from "react-router-dom"
import { ArrowLeftIcon } from "@phosphor-icons/react"
import { buttonVariants } from "../components/ui/button"

export function PrivacyPolicyPage() {
  return <div className="page legal">
    <Link className={buttonVariants({ variant: "soft", size: "icon" })} to="/" aria-label="Back" title="Back"><ArrowLeftIcon /></Link>
    <h1>Privacy policy</h1>
    <p className="muted-note">Last updated October 5, 2026</p>
    <p>MovieLand helps you discover movies and series. This policy explains what information the app stores, why it is used, and the choices available to you.</p>
    <section>
      <h2>Information we handle</h2>
      <p>MovieLand does not require an account for catalog browsing. The web and mobile app may store your saved titles, watch progress, download queue, preferred video server, temporary Watchparty identity, and room preferences on your device using local storage.</p>
      <p>When you create or join a Watchparty, the temporary user ID, username, room activity, chat messages, presence heartbeat, and playback state are sent to Convex so the room can work in real time. This is temporary application identity, not production authentication.</p>
    </section>
    <section>
      <h2>How information is used</h2>
      <p>We use this information to provide catalog search and discovery, remember local preferences, synchronize Watchparty rooms, display chat messages, and operate playback and download features that you request.</p>
      <p>We do not sell personal information, use Watchparty usernames for advertising profiles, or scrape IMDb. Movie metadata, artwork, credits, and external IDs are supplied by TMDB.</p>
    </section>
    <section>
      <h2>Third-party services</h2>
      <p>MovieLand connects to services that have their own privacy policies and terms:</p>
      <ul>
        <li><a href="https://www.themoviedb.org/privacy-policy" target="_blank" rel="noreferrer">TMDB</a> for catalog metadata and artwork.</li>
        <li>Convex for Watchparty room state, chat, and realtime presence.</li>
        <li>Google AdMob for ads in supported native builds. Ad requests and consent choices are handled according to Google's policies.</li>
        <li>Video providers opened through an iframe or external link. Their pages may collect information directly under their own policies.</li>
      </ul>
    </section>
    <section>
      <h2>Storage and retention</h2>
      <p>When you request an available download, Convex stores the title, episode, file name, and browser handoff history with a seven-day expiry and hourly cleanup. A random device credential in local storage protects access to that history. Clearing site data removes the credential. Your browser or the iOS app transfers supported files directly. MovieLand does not capture or assemble player streams on a server.</p>
      <p>Local data remains on your device until you clear it, uninstall the app, or remove it through an available app control. Watchparty rooms, messages, playback, and presence records are designed to expire and be cleaned up after the room's inactive lifetime. Provider logs and ad data are controlled by the relevant third party.</p>
    </section>
    <section>
      <h2>Your choices</h2>
      <p>You can remove saved titles and downloads from MovieLand, clear the app's site data in your browser, leave a Watchparty, or uninstall the native app. You can also manage advertising and privacy choices through the consent controls shown by the supported native build.</p>
    </section>
    <section>
      <h2>Children's privacy</h2>
      <p>MovieLand is not directed to children under 13, and we do not knowingly collect personal information from children under 13. If you believe a child has provided information, contact the app publisher through the distribution channel where MovieLand was installed.</p>
    </section>
    <section>
      <h2>Changes and contact</h2>
      <p>We may update this policy when MovieLand's data practices change. The current version will remain available at this URL. For privacy questions or requests, contact the app publisher through the Google Play listing or the channel where you received the app.</p>
    </section>
  </div>
}
