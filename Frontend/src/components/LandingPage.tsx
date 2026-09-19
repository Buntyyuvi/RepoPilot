import "./LandingPage.css"

interface LandingPageProps {
  onGithubLogin: () => void
}

export function LandingPage({ onGithubLogin }: LandingPageProps) {
  return (
    <div className="repo-landing">
      <header className="repo-landing-header">
        <div className="repo-landing-brand">
          <span className="repo-landing-logo">✦</span>
          <span className="repo-landing-brand-name">RepoMind AI</span>
        </div>

        <nav className="repo-landing-nav">
          <a className="repo-landing-nav-link" href="#product">Product</a>
          <a className="repo-landing-nav-link" href="#how-it-works">How it works</a>
          <a className="repo-landing-nav-link" href="#pricing">Pricing</a>
          <a className="repo-landing-nav-link" href="#contact">Contact</a>
        </nav>

        <div className="repo-landing-header-actions">
          <a className="repo-landing-signin" href="#signin">Sign in</a>
          <button className="repo-landing-cta-small" onClick={onGithubLogin}>
            Continue with GitHub
          </button>
        </div>
      </header>

      <main className="repo-landing-main">
        <section className="repo-landing-hero">
          <div className="hero-chip">Now supporting private repositories</div>

          <h1 className="hero-title">
            The fastest way to<br />
            actually <span className="hero-title-underline">understand</span><br />
            a codebase.
          </h1>

          <p className="hero-copy">
            Connect GitHub, and RepoMind indexes every repository into a living
            knowledge base — then gives you an AI agent that answers questions
            with real file references.
          </p>

          <div className="hero-actions">
            <button className="primary-action" onClick={onGithubLogin}>
              Continue with GitHub
            </button>
            <button className="secondary-action" onClick={() => window.location.hash = "how-it-works"}>
              See how it works
            </button>
          </div>

          <div className="hero-note">Free for public repositories — No credit card required</div>

          <section className="repo-screens">
            <div className="repo-list-panel">
              <div className="repo-list-title">
                <span>Your repositories</span>
                <span className="repo-list-count">3 repositories indexed</span>
              </div>

              <div className="repo-list-content">
                <div className="repo-list-row">
                  <span className="repo-list-icon">●</span>
                  <span className="repo-name">atlas-ui</span>
                  <span className="repo-name-extra">TypeScript</span>
                  <span className="repo-index-badge">Indexed</span>
                </div>
                <div className="repo-list-row">
                  <span className="repo-list-icon">●</span>
                  <span className="repo-name">cloud-sync</span>
                  <span className="repo-name-extra">Go</span>
                  <span className="repo-index-badge">Indexed</span>
                </div>
                <div className="repo-list-row">
                  <span className="repo-list-icon">●</span>
                  <span className="repo-name">mobile-dashboard</span>
                  <span className="repo-name-extra">React</span>
                  <span className="repo-index-badge">Indexed</span>
                </div>
              </div>
            </div>

            <div className="repo-chat-panel">
              <div className="repo-chat-title">
                <span className="chat-icon">◌</span>
                Repository chat
              </div>
              <div className="repo-chat-content">
                <p className="chat-label">Where are the API routes defined?</p>
                <p className="chat-answer">
                  They are defined in <span>src/routes/api.ts</span>, where the
                  routes register the public and authenticated groups.
                </p>
              </div>
            </div>
          </section>
        </section>

        <section id="product" className="repo-landing-features">
          <div className="section-title-center">
            <h2>Built for engineers who read code all day</h2>
            <p>
              A clearer way to explore unfamiliar repositories, answer questions,
              and move from context to contribution.
            </p>
          </div>

          <div className="feature-grid">
            <article className="feature-card">
              <span className="feature-icon">✧</span>
              <h3>Deep repository indexing</h3>
              <p>Every file and function is parsed and embedded, so answers are grounded in your real code.</p>
            </article>

            <article className="feature-card">
              <span className="feature-icon">▣</span>
              <h3>Ask instead of search</h3>
              <p>Skip the grep. Ask a direct question and get an answer with the exact file and line.</p>
            </article>

            <article className="feature-card">
              <span className="feature-icon">☼</span>
              <h3>Any open-source project</h3>
              <p>Paste a public GitHub URL and explore a new codebase with an AI agent in minutes.</p>
            </article>
          </div>
        </section>

        <section id="how-it-works" className="repo-landing-steps">
          <div className="section-title-center">
            <h2>Three steps to a codebase that talks back</h2>
          </div>
          <div className="steps-grid">
            <article className="step-card">
              <span className="step-number">01</span>
              <h3>Sign in with GitHub</h3>
              <p>Grant read-only access to the repositories you want indexed.</p>
            </article>

            <article className="step-card">
              <span className="step-number">02</span>
              <h3>Automatic indexing</h3>
              <p>We parse structure, dependencies and history into a searchable knowledge graph.</p>
            </article>

            <article className="step-card">
              <span className="step-number">03</span>
              <h3>Chat with your code</h3>
              <p>Ask your AI agent anything — it already knows the repo.</p>
            </article>
          </div>
        </section>

        <section className="repo-landing-quote">
          <span className="quote-mark">“</span>
          <blockquote>
            “It feels like onboarding a senior engineer who already read the entire repo.”
          </blockquote>
          <div className="quote-author-avatar">JT</div>
          <div className="quote-author">
            <span>Marcus Webb</span>
            <small>Engineering Manager, Northlake</small>
          </div>
        </section>

        <section id="pricing" className="repo-landing-pricing">
          <div className="section-title-center pricing-title">
            <h2>Simple pricing, no surprises</h2>
            <p>Free for public repositories. Paid plans for private codebases and teams.</p>
          </div>

          <div className="pricing-grid">
            <article className="pricing-card free-plan">
              <h3>Free</h3>
              <div className="pricing-price"><span className="money">$0</span><span className="unit">/mo</span></div>
              <ul className="pricing-list">
                <li><span className="checkmark">✓</span>Unlimited public repos</li>
                <li><span className="checkmark">✓</span>AI chat included</li>
                <li><span className="checkmark">✓</span>Community support</li>
              </ul>
              <button className="plan-button">Get started</button>
            </article>

            <article className="pricing-card pro-plan">
              <div className="pro-plan-heading">
                <h3>Pro</h3>
                <span className="popular-tag">Popular</span>
              </div>
              <div className="pricing-price"><span className="money">$29</span><span className="unit">/mo per seat</span></div>
              <ul className="pricing-list">
                <li><span className="checkmark">✓</span>Private repositories</li>
                <li><span className="checkmark">✓</span>Priority indexing</li>
                <li><span className="checkmark">✓</span>Team workspaces</li>
              </ul>
              <button className="plan-button pro-plan-button">Start free trial</button>
            </article>
          </div>
        </section>

        <section id="contact" className="repo-landing-contact">
          <div className="contact-panel">
            <div className="contact-copy">
              <span className="hero-chip contact-chip">Contact</span>
              <h2>Tell us about your repository workflow.</h2>
              <p>
                Whether you are exploring a new codebase, evaluating private repo support,
                or looking for a better way to onboard engineering teams, we would love to hear from you.
              </p>

              <div className="contact-meta">
                <div>
                  <label>Email</label>
                  <a href="mailto:hello@repopilot.ai">hello@repopilot.ai</a>
                </div>
                <div>
                  <label>Location</label>
                  <span>Remote-first, worldwide</span>
                </div>
              </div>
            </div>

            <form className="contact-form">
              <div className="form-row">
                <label>
                  Name
                  <input type="text" placeholder="Your name" />
                </label>
              </div>

              <div className="form-row">
                <label>
                  Work email
                  <input type="email" placeholder="name@company.com" />
                </label>
              </div>

              <div className="form-row">
                <label>
                  Message
                  <textarea rows={4} placeholder="Tell us what you are building or what you need help with." />
                </label>
              </div>

              <button type="button" className="primary-connect contact-button">Send message</button>
            </form>
          </div>
        </section>

        <section className="repo-landing-connect">
          <h2>Your codebase is waiting to be understood.</h2>
          <p>Connect your first repository in under two minutes.</p>
          <button className="primary-connect" onClick={onGithubLogin}>Continue with GitHub</button>
        </section>
      </main>

      <footer className="repo-landing-footer">
        <div className="repo-landing-footer-grid">
          <div className="footer-brand">
            <span className="footer-logo">✦</span>
            <span className="footer-title">RepoMind AI</span>
            <p>All that reads your repos so you don’t have to.</p>
          </div>

          <div className="footer-links">
            <div className="footer-link-column">
              <h4>Product</h4>
              <a href="#">Dashboard</a>
              <a href="#">Repositories</a>
              <a href="#">Chat</a>
              <a href="#">Pricing</a>
            </div>

            <div className="footer-link-column">
              <h4>Resources</h4>
              <a href="#">Docs</a>
              <a href="#">Changelog</a>
              <a href="#">Status</a>
            </div>

            <div className="footer-link-column">
              <h4>Company</h4>
              <a href="#">About</a>
              <a href="#">Careers</a>
              <a href="#contact">Contact</a>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© 2024 RepoMind AI. All rights reserved.</span>
          <span className="footer-privacy">
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
          </span>
        </div>
      </footer>
    </div>
  )
}
