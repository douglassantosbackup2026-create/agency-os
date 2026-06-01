import {
  authorSection,
  socialProofSection,
} from "@/content/diagnosis-landing";

export function DiagnosisAuthoritySection() {
  return (
    <section className="card authority-card" id="sec-authority">
      <h2>{authorSection.title}</h2>
      <p className="authority-name">{authorSection.name}</p>
      <p className="muted" style={{ marginTop: 0 }}>
        {authorSection.role}
      </p>
      <ul className="authority-credentials">
        {authorSection.credentials.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      {authorSection.paragraphs.slice(0, 2).map((p) => (
        <p key={p.slice(0, 40)} className="authority-para">
          {p}
        </p>
      ))}
      <div className="social-proof-mini">
        <h3>{socialProofSection.title}</h3>
        <p className="section-hint social-proof-disclaimer">
          Depoimentos ilustrativos de formato — resultados variam por operação.
        </p>
        {socialProofSection.cases.slice(0, 2).map((c) => (
          <blockquote key={c.author} className="proof-quote">
            <p>&ldquo;{c.quote}&rdquo;</p>
            <footer>
              <strong>{c.author}</strong> · {c.niche}
            </footer>
          </blockquote>
        ))}
      </div>
    </section>
  );
}
