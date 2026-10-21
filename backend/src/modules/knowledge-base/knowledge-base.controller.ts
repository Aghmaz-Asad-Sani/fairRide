import { Controller, Get, Header } from '@nestjs/common';

const knowledgeBasePage = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="FairRide product, operations and technical knowledge base">
  <title>FairRide | Project knowledge base</title>
  <style>
    :root{color-scheme:light;--ink:#17261f;--muted:#53635b;--paper:#f5f7f4;--card:#fff;--line:#dce5de;--green:#08784f;--mint:#e5f5ec;--amber:#fff2d8;--red:#ffebe8}
    *{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
    header{background:#103d2e;color:#fff;padding:42px max(24px,calc((100vw - 1120px)/2)) 32px}header p{max-width:760px;color:#d8eee2;margin:8px 0 0}
    h1{font-size:clamp(2rem,5vw,3.4rem);line-height:1.1;margin:0}h2{margin-top:0;font-size:1.6rem}h3{margin-bottom:4px}a{color:var(--green)}button{font:inherit;cursor:pointer}
    .toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-top:24px}.toolbar button{border:1px solid #5d8973;background:transparent;color:white;border-radius:999px;padding:8px 15px}.toolbar button[aria-pressed=true]{background:white;color:#103d2e}
    nav{position:sticky;top:0;z-index:2;background:#fff;border-bottom:1px solid var(--line);padding:8px max(16px,calc((100vw - 1120px)/2));display:flex;gap:8px;overflow:auto;white-space:nowrap}
    nav a{padding:8px 10px;text-decoration:none;color:var(--muted);border-radius:8px}nav a:hover{background:var(--mint);color:var(--green)}
    main{max-width:1120px;margin:28px auto;padding:0 20px 60px}.intro{font-size:1.12rem;color:var(--muted);max-width:850px}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}.card,section{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;margin:18px 0;box-shadow:0 3px 12px #1935230a}
    .card p,section p{margin:6px 0;color:var(--muted)}.badge{display:inline-block;border-radius:99px;padding:3px 10px;font-size:.82rem;font-weight:700;background:var(--mint);color:#075c3d}
    .badge.partial{background:var(--amber);color:#79520a}.badge.planned{background:#eef0f2;color:#56616b}.badge.blocked{background:var(--red);color:#8b2f25}
    .callout{padding:14px 16px;border-left:4px solid #bc7c0a;background:var(--amber);border-radius:8px;margin:14px 0}
    .steps{counter-reset:step;display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px}.step{border:1px solid var(--line);padding:15px;border-radius:12px;background:#fbfcfb}.step:before{counter-increment:step;content:counter(step);display:inline-grid;place-items:center;width:28px;height:28px;border-radius:50%;background:var(--green);color:white;font-weight:700;margin-right:8px}
    table{width:100%;border-collapse:collapse;margin:10px 0 18px}th,td{text-align:left;vertical-align:top;padding:10px;border-bottom:1px solid var(--line)}th{background:#f2f7f3}td:first-child{font-weight:650}
    code{background:#edf2ee;padding:2px 5px;border-radius:5px;overflow-wrap:anywhere}.muted{color:var(--muted)}.audience[hidden],.language[hidden]{display:none!important}
    footer{background:#eaf0eb;padding:22px max(20px,calc((100vw - 1120px)/2));color:var(--muted)}
    @media(max-width:640px){header{padding:32px 20px 24px}main{padding:0 14px 40px}section{padding:16px;overflow-wrap:anywhere}table{font-size:.9rem}th,td{padding:7px}}
  </style>
</head>
<body>
<header>
  <span class="badge">FAIRRIDE · PROJECT HANDBOOK</span>
  <h1>Ride-hailing, explained clearly.</h1>
  <p class="language lang-en">A shared guide for passengers, drivers, operations, product stakeholders and engineers. It explains what works today, what is being built, and what must be true before launch.</p>
  <p class="language lang-ur" hidden>Passengers, drivers, operations, product stakeholders aur engineers ke liye shared guide. Yahan current features, aglay kaam, aur launch se pehle zaroori cheezen seedhi zaban mein hain.</p>
  <div class="toolbar" aria-label="Page preferences">
    <button type="button" data-language="en" aria-pressed="true">English</button>
    <button type="button" data-language="ur" aria-pressed="false">Roman Urdu</button>
    <button type="button" data-audience="all" aria-pressed="true">Everyone</button>
    <button type="button" data-audience="business" aria-pressed="false">Business &amp; operations</button>
    <button type="button" data-audience="technical" aria-pressed="false">Technical</button>
  </div>
</header>
<nav aria-label="Knowledge base sections">
  <a href="#overview">Overview</a><a href="#journeys">User journeys</a><a href="#features">Features</a><a href="#operations">Operations</a><a href="#architecture">Architecture</a><a href="#apis">API</a><a href="#data">Data</a><a href="#integrations">Integrations</a><a href="#roadmap">Roadmap</a><a href="#glossary">Glossary</a>
</nav>
<main>
  <section id="overview">
    <h2>Project overview</h2>
    <div class="language lang-en">
      <p class="intro">FairRide is an original Pakistan-focused ride-hailing platform. The aim is to connect passengers with verified drivers, show a server-calculated fare, and manage each trip with clear, auditable states. It is inspired by common ride-hailing needs; it does not copy another company's private software or branding.</p>
      <div class="callout"><strong>Current status:</strong> Core backend flows and single-instance authenticated Socket.IO are implemented. This is an active development project—not a production-ready or fully equivalent commercial service. Real provider credentials, distributed socket scaling, operational teams, security review and real-database testing are still required.</div>
    </div>
    <div class="language lang-ur" hidden>
      <p class="intro">FairRide Pakistan ke liye ek original ride-hailing platform hai. Maqsad passenger ko verified driver se milana, server par fare calculate karna, aur trip ke har status ko record karna hai. Yeh aam ride-hailing zarooriyat se inspired hai, kisi company ka private software ya branding copy nahi karta.</p>
      <div class="callout"><strong>Abhi ki halat:</strong> Backend ke bunyadi flows aur single-server authenticated Socket.IO ban chuke hain. Yeh abhi development project hai—production-ready commercial service nahi. Asal provider credentials, multiple servers par socket scaling, operations team, security review aur real database tests abhi darkaar hain.</div>
    </div>
    <div class="grid">
      <article class="card"><h3>Who it serves</h3><p>Passengers who need rides; drivers who want eligible trip offers; and staff who verify documents and oversee operations.</p></article>
      <article class="card"><h3>Operating focus</h3><p>Pakistan pilot; the first launch city is not selected yet. Local payment, privacy, transport and consumer requirements need review.</p></article>
      <article class="card"><h3>Guiding principles</h3><p>Account safety, clear fares, minimum necessary location exposure, reliable trip state, and honest communication about unfinished features.</p></article>
    </div>
    <div class="language lang-ur" hidden>
      <div class="grid">
        <article class="card"><h3>Yeh kis ke liye hai?</h3><p>Ride chahne walay passengers, kaam ke offers chahne walay drivers, aur documents/operations dekhne wali team.</p></article>
        <article class="card"><h3>Shuru kahan se?</h3><p>Pakistan pilot; pehla shehar abhi tay nahi. Payment, privacy, transport aur customer rules ka jaiza zaroori hai.</p></article>
        <article class="card"><h3>Bunyadi usool</h3><p>Account safety, wazeh fare, location ki hifazat, bharosemand trip status, aur adhooray features ke bare mein sach batana.</p></article>
      </div>
    </div>
  </section>
  <section id="journeys">
    <h2>How the service works</h2>
    <h3 class="language lang-en">Passenger journey</h3><h3 class="language lang-ur" hidden>Passenger ka safar</h3>
    <div class="steps">
      <div class="step">Create passenger account and sign in.</div><div class="step">Verify phone with a one-time code.</div><div class="step">Enter pickup, destination and vehicle category; review estimate.</div><div class="step">Request ride; nearby eligible drivers receive expiring offers.</div><div class="step">Driver accepts; passenger shares pickup PIN at pickup.</div><div class="step">Track trip status, complete or cancel within allowed states, and pay cash today.</div>
    </div>
    <h3 class="language lang-en">Driver journey</h3><h3 class="language lang-ur" hidden>Driver ka safar</h3>
    <div class="steps">
      <div class="step">Register as a driver and submit license details.</div><div class="step">Add vehicle details and expiry dates.</div><div class="step">An authorized administrator reviews the submissions.</div><div class="step">After approval, share fresh location and go online.</div><div class="step">Review, accept or reject an eligible ride offer.</div><div class="step">Mark arrival, verify the passenger PIN, complete the ride.</div>
    </div>
    <p class="muted language lang-en">Phone verification and document metadata checks exist in the backend. Real SMS delivery, protected document uploads, and external identity checks are not yet connected.</p>
    <p class="muted language lang-ur" hidden>Phone verification aur documents ki basic maloomat backend mein hai. Asal SMS, mehfooz document upload aur bahari identity check abhi connected nahi.</p>
  </section>
  <section id="features">
    <h2>Feature inventory</h2>
    <p class="language lang-en">“Implemented” means code exists; it does not by itself mean the feature is connected to a production vendor or ready for public launch.</p>
    <p class="language lang-ur" hidden>“Implemented” ka matlab code maujood hai; iska matlab yeh nahi ke production provider laga hua hai ya public launch tayyar hai.</p>
    <table><thead><tr><th>Area / Feature</th><th>Status / Halat</th><th>What works and what is missing / Kya hai aur kya baqi hai</th></tr></thead><tbody>
      <tr><td>Passenger &amp; driver accounts</td><td><span class="badge">Implemented</span></td><td>Signup, password login, access/refresh sessions, logout, role controls and account profile.</td></tr>
      <tr><td>Phone verification</td><td><span class="badge partial">Partial</span></td><td>OTP challenge and verification logic exists. A development-only mode can return the code. A real SMS vendor is not configured.</td></tr>
      <tr><td>Driver onboarding</td><td><span class="badge partial">Partial</span></td><td>Profile and vehicle metadata, admin review, location and online eligibility exist. Document image storage and independent verification do not.</td></tr>
      <tr><td>Pricing &amp; maps</td><td><span class="badge partial">Partial</span></td><td>Integer-paisa fare calculation and OSRM-compatible route boundary exist. Development can use a marked approximation; production routing host is required.</td></tr>
      <tr><td>Dispatch &amp; trips</td><td><span class="badge partial">Partial</span></td><td>Bounded nearby matching, expiring offers, transactional acceptance, pickup PIN and HTTP lifecycle exist. Continuous rematching and live socket events are in progress.</td></tr>
      <tr><td>Payments</td><td><span class="badge partial">Partial</span></td><td>Cash only. No Safepay checkout, verified payment webhooks, refunds, ledger, settlement or driver payouts yet.</td></tr>
      <tr><td>Ratings, safety &amp; support</td><td><span class="badge planned">Planned</span></td><td>No ratings, emergency operations, support case management or incident response console yet.</td></tr>
      <tr><td>Admin &amp; analytics</td><td><span class="badge partial">Partial</span></td><td>Initial super-admin bootstrap and document review routes exist. No full admin console, analytics or workforce workflows.</td></tr>
      <tr><td>Notifications &amp; realtime</td><td><span class="badge partial">Partial</span></td><td>Authenticated Socket.IO rooms, offer/status events and active-trip location work on one server. Multi-server scaling, mobile push and SMS are not connected.</td></tr>
    </tbody></table>
  </section>
  <section id="operations" class="audience audience-business">
    <h2>What stakeholders and operations should know</h2>
    <div class="language lang-en">
      <ul><li><strong>Before pilot:</strong> choose a city and service categories; approve driver/document policy; configure routing, SMS and payment vendors; define support coverage and escalation.</li><li><strong>Money:</strong> current bookings are cash-only. The fare displayed is a server-generated estimate; present fare rules and dispute policy before launch.</li><li><strong>Safety:</strong> a pickup PIN helps confirm passenger pickup; it is not an emergency-response service. SOS, incident handling and support staffing are not implemented.</li><li><strong>Privacy:</strong> precise driver location is operationally sensitive. Define retention, access, deletion and consent before real users are onboarded.</li><li><strong>Fairness:</strong> proximity matching is implemented; fairness of driver opportunity is not established. Measure distribution and cancellation outcomes during a controlled pilot.</li></ul>
    </div>
    <div class="language lang-ur" hidden>
      <ul><li><strong>Pilot se pehle:</strong> shehar aur service categories chunain; driver/document policy approve karein; routing, SMS aur payment providers set karein; support aur emergency escalation tay karein.</li><li><strong>Paisa:</strong> abhi ride cash-only hai. Fare server ka estimate hai; launch se pehle fare aur dispute policy wazeh honi chahiye.</li><li><strong>Safety:</strong> pickup PIN passenger ki pickup confirm karta hai, emergency response nahi. SOS, incidents aur support staff ka system abhi nahi bana.</li><li><strong>Privacy:</strong> driver ki exact location sensitive hai. Asal users se pehle retention, access, deletion aur consent rules banayein.</li><li><strong>Fairness:</strong> qareebi drivers dhoondhne ka code hai, lekin driver opportunities ki fairness prove nahi hui. Pilot mein mauqon aur cancellations ko measure karein.</li></ul>
    </div>
  </section>
  <section id="architecture" class="audience audience-technical">
    <h2>Technical architecture</h2>
    <table><tbody>
      <tr><td>Backend</td><td>NestJS 11, TypeScript, Node.js 22+, REST API at <code>/api/v1</code>.</td></tr>
      <tr><td>Database</td><td>PostgreSQL with PostGIS, TypeORM entities and versioned migrations; schema synchronization is disabled.</td></tr>
      <tr><td>Cache / rate limits</td><td>Redis with password authentication; Redis-backed authentication rate limits.</td></tr>
      <tr><td>Security</td><td>Argon2id password hashes, JWT access tokens tied to server-side sessions, hashed rotating refresh tokens, DTO validation, role/ownership checks, Helmet and redacted structured logs.</td></tr>
      <tr><td>Spatial matching</td><td>Bounded PostGIS distance query, freshness checks, eligibility filters and expiring offers.</td></tr>
      <tr><td>Fare</td><td>PKR is represented as integer paisa. Routing-derived distance/time are trusted server-side inputs.</td></tr>
      <tr><td>API docs &amp; health</td><td><a href="/api/docs">Swagger UI</a>; liveness and dependency readiness endpoints.</td></tr>
      <tr><td>Realtime</td><td>Socket.IO namespace <code>/realtime</code>; authenticated sessions, participant-only rooms, offer/status events and active-trip location are implemented. Multi-server adapter, event replay and mobile reconnect/resync remain.</td></tr>
    </tbody></table>
    <h3>Trip state</h3><p><code>SEARCHING → ACCEPTED → DRIVER_ARRIVING → IN_PROGRESS → COMPLETED</code>; pre-trip states can be cancelled; requests/offers can expire. Server/database state is authoritative, not client socket messages.</p>
    <h3>Engineering guardrails</h3><ul><li>Never trust client fares, payment success, driver identity or ride status.</li><li>Authorize every ride room and private record by participant/role.</li><li>Do not broadcast precise driver coordinates to unrelated users.</li><li>Use idempotency, unique constraints and transactional transitions for retries/concurrency.</li><li>Never put secrets, OTP values, PINs or payment data in logs.</li></ul>
  </section>
  <section id="apis" class="audience audience-technical">
    <h2>Current API groups</h2>
    <p><a href="/api/docs">Open interactive Swagger API reference</a>. All listed APIs are under <code>/api/v1</code> unless stated otherwise.</p>
    <table><tbody>
      <tr><td>Health</td><td><code>GET /health/live</code>, <code>GET /health/ready</code></td></tr>
      <tr><td>Auth</td><td><code>POST /auth/register</code>, <code>/auth/login</code>, <code>/auth/refresh</code>, <code>/auth/phone/otp/request</code>, <code>/auth/phone/otp/verify</code>; <code>GET /auth/me</code>; logout endpoints.</td></tr>
      <tr><td>Drivers</td><td><code>/drivers/profile</code>, <code>/drivers/vehicles</code>, <code>/drivers/location</code>, <code>/drivers/availability</code>; admin verification routes.</td></tr>
      <tr><td>Pricing &amp; rides</td><td><code>POST /pricing/estimate</code>, <code>POST /rides</code> (Idempotency-Key required), history/detail, driver offer actions, arrival, PIN start, completion and cancellation.</td></tr>
    </tbody></table>
  </section>
  <section id="data" class="audience audience-technical">
    <h2>Data model at a glance</h2>
    <table><thead><tr><th>Tables</th><th>Purpose</th><th>Important rules</th></tr></thead><tbody>
      <tr><td><code>users</code>, <code>auth_sessions</code></td><td>Account identity, role/status, phone verification and revocable sessions.</td><td>Unique normalized identity; public roles cannot self-elevate.</td></tr>
      <tr><td><code>audit_logs</code>, <code>phone_otp_challenges</code></td><td>Security/admin audit trail and one-time challenge lifecycle.</td><td>Challenge hashes expire and count failed attempts; never log the secret code.</td></tr>
      <tr><td><code>driver_profiles</code>, <code>vehicles</code></td><td>Driver eligibility, document metadata, vehicle category and latest location.</td><td>Review/expiry/freshness gates; no document file storage currently.</td></tr>
      <tr><td><code>rides</code>, <code>ride_offers</code></td><td>Ride snapshots, status/fare/PIN material and expiring candidate offers.</td><td>Ownership, active-ride and assignment constraints; PIN hash is not API output.</td></tr>
    </tbody></table>
    <p>Schema definitions are in versioned migrations. Production data retention, account deletion and precise-location deletion rules still need a policy.</p>
  </section>
  <section id="integrations" class="audience audience-technical">
    <h2>External integrations and launch dependencies</h2>
    <table><thead><tr><th>Integration</th><th>Chosen direction</th><th>Launch dependency</th></tr></thead><tbody>
      <tr><td>Maps/routing</td><td>Self-hosted OSRM-compatible routing</td><td>Provision and monitor a licensed, production-grade routing host; configure base URL. No public routing endpoint is assumed.</td></tr>
      <tr><td>Payments</td><td>Cash + Safepay gateway</td><td>Cash works as the current method. Safepay merchant account, sandbox/live credentials, signed webhook verification, idempotency and reconciliation are not integrated yet.</td></tr>
      <tr><td>OTP/SMS</td><td>Provider boundary; vendor to be selected</td><td>Choose a Pakistan-capable SMS vendor, obtain credentials, implement delivery/status handling and test abuse limits.</td></tr>
      <tr><td>Realtime</td><td>Socket.IO</td><td>Implement authenticated rooms, ride/driver event authorization, Redis scaling adapter, reconnect/resync and load tests.</td></tr>
      <tr><td>Documents</td><td>Protected object storage to be selected</td><td>Private upload/download, malware/content checks, access audit, retention and administrator review.</td></tr>
      <tr><td>Push</td><td>Not selected</td><td>Choose mobile push services and define delivery/retry behavior; push is not authoritative state.</td></tr>
    </tbody></table>
  </section>
  <section id="roadmap" class="audience audience-business">
    <h2>Roadmap and acceptance gates</h2>
    <ol><li><strong>Realtime dispatch:</strong> finish Redis multi-server scaling, event replay, reconnect/resync and load tests for existing authenticated Socket.IO events.</li><li><strong>Payments:</strong> Safepay sandbox flow, signed webhook, idempotent payment records/ledger, refunds and reconciliation; cash remains available.</li><li><strong>Maps &amp; OTP:</strong> provision production OSRM-compatible routing and select/connect an SMS provider.</li><li><strong>Operations &amp; safety:</strong> support/admin console, incident and emergency procedures, document storage, account deletion and privacy controls.</li><li><strong>Reliability &amp; pilot:</strong> PostgreSQL/PostGIS integration and concurrent assignment tests, security review, backups/restore, monitoring, load tests and controlled city pilot.</li></ol>
    <p><strong>Acceptance definition:</strong> features require automated tests, failure-mode handling, docs, production configuration and operational owner—not just a route or button.</p>
  </section>
  <section id="glossary">
    <h2>Glossary</h2>
    <table><tbody>
      <tr><td>OTP</td><td>One-time code to confirm control of a phone number.</td></tr><tr><td>Idempotency key</td><td>A client request identifier so a retry does not create a duplicate ride/payment.</td></tr><tr><td>Offer</td><td>A time-limited invitation for an eligible driver to accept a ride.</td></tr><tr><td>PostGIS</td><td>PostgreSQL extension for geographic data and nearby-place queries.</td></tr><tr><td>Webhook</td><td>Provider-to-server event callback; must be authenticated and safely replayed.</td></tr><tr><td>Ledger</td><td>Append-only financial record used to reconcile charges, refunds and payouts.</td></tr><tr><td>Readiness</td><td>Whether the service's required dependencies are available to serve work.</td></tr>
    </tbody></table>
    <p class="muted">Source of truth: this page summarizes the current repository and <a href="/api/docs">generated API schema</a>. Update it when feature status or provider decisions change. This page intentionally contains no credentials or private customer data.</p>
  </section>
</main>
<footer>FairRide project knowledge base · Pakistan pilot scope · Not a production-readiness or legal certification.</footer>
<script>
  const languageButtons = document.querySelectorAll('[data-language]');
  languageButtons.forEach(button => button.addEventListener('click', () => {
    const language = button.dataset.language;
    document.querySelectorAll('.language').forEach(node => { node.hidden = !node.classList.contains('lang-' + language); });
    languageButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  }));
  const audienceButtons = document.querySelectorAll('[data-audience]');
  audienceButtons.forEach(button => button.addEventListener('click', () => {
    const audience = button.dataset.audience;
    document.querySelectorAll('.audience').forEach(node => { node.hidden = audience !== 'all' && !node.classList.contains('audience-' + audience); });
    audienceButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  }));
</script>
</body>
</html>`;

@Controller()
export class KnowledgeBaseController {
  @Get('knowledge-base')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-cache')
  getPage(): string {
    return knowledgeBasePage;
  }
}
