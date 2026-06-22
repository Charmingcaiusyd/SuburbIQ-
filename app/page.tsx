const phases = [
  "Architecture scaffold",
  "Database schema",
  "Auth and profile",
  "Suburb search and map API",
  "Commerce state machines",
  "Report queue and LLM fallback",
  "Admin portal",
  "Data release and rollback"
];

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="panel">
        <span className="pill">Phase 6 implemented</span>
        <h1>SuburbIQ</h1>
        <p className="muted">
          Sydney Property Data & Buyer Decision Platform. The current
          implementation includes architecture, database, auth/profile,
          suburb search, map layer APIs, commerce state-machine services and
          mock report generation with fallback.
        </p>
      </section>
      <section className="grid" style={{ marginTop: 16 }}>
        {phases.map((phase, index) => (
          <article className="panel" key={phase}>
            <strong>Phase {index + 1}</strong>
            <p className="muted">{phase}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
