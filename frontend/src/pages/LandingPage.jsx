import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDown, ArrowRight, BookOpen, BrainCircuit, Check, FileText,
  GraduationCap, Layers3, Menu, MessageSquare, Network, NotebookText,
  Quote, Sparkles, X,
} from 'lucide-react'
import { useAuth } from '../context/authContextValue'
import './LandingPage.css'

const tools = [
  { icon: MessageSquare, title: 'AI Chat', text: 'Ask questions from your lecture materials and follow source references.', className: 'landing-tool-chat' },
  { icon: NotebookText, title: 'Smart Summaries', text: 'Turn long lecture content into structured key points, important terms, and relationships.' },
  { icon: BrainCircuit, title: 'Practice Quizzes', text: 'Generate grounded MCQs and review explanations after answering.' },
  { icon: Layers3, title: 'Flashcards + Review', text: 'Generate, save, and revisit flashcards with basic spaced-repetition scheduling.', className: 'landing-tool-flashcards' },
]

function useReveal() {
  useEffect(() => {
    const nodes = document.querySelectorAll('[data-reveal]')
    if (!('IntersectionObserver' in window)) {
      nodes.forEach((node) => node.classList.add('is-visible'))
      return undefined
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: 0.14, rootMargin: '0px 0px -5% 0px' })
    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [])
}

function LandingNavbar() {
  const { isAuthenticated } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 24)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])

  return (
    <header className={`landing-nav ${scrolled ? 'landing-nav-scrolled' : ''}`}>
      <a className="landing-brand" href="#top" aria-label="AI StudyMate home">
        <span className="landing-brand-mark"><GraduationCap size={21} /></span>
        <span>AI StudyMate</span>
      </a>
      <button className="landing-menu-button" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="landing-navigation" aria-label="Toggle navigation">
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>
      <nav id="landing-navigation" className={`landing-nav-links ${open ? 'is-open' : ''}`} aria-label="Main navigation">
        <a href="#features" onClick={() => setOpen(false)}>Features</a>
        <a href="#how-it-works" onClick={() => setOpen(false)}>How It Works</a>
        <a href="#study-tools" onClick={() => setOpen(false)}>Study Tools</a>
        <span className="landing-nav-divider" />
        <Link to="/login">Log In</Link>
        <Link className="landing-nav-cta" to={isAuthenticated ? '/dashboard' : '/register'}>{isAuthenticated ? 'Go to Dashboard' : 'Get Started'} <ArrowRight size={15} /></Link>
      </nav>
    </header>
  )
}

export default function LandingPage() {
  const { isAuthenticated } = useAuth()
  const heroRef = useRef(null)
  useReveal()

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) return undefined
    const update = () => {
      if (heroRef.current && window.scrollY < window.innerHeight) {
        heroRef.current.style.setProperty('--landing-parallax', `${Math.min(window.scrollY * 0.08, 24)}px`)
      }
    }
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])

  return (
    <div className="landing-page" id="top">
      <LandingNavbar />
      <main>
        <section className="landing-hero" ref={heroRef} aria-labelledby="landing-title">
          <div className="landing-hero-image" aria-hidden="true" />
          <div className="landing-hero-content">
            <p className="landing-kicker landing-hero-step"><Sparkles size={15} /> Built for source-grounded learning</p>
            <h1 id="landing-title">
              <span className="landing-line-mask"><span className="landing-line landing-line-one">Study smarter.</span></span>
              <span className="landing-line-mask"><span className="landing-line landing-line-two">Learn deeper.</span></span>
              <span className="landing-line-mask"><span className="landing-line landing-line-three">Remember longer.</span></span>
            </h1>
            <p className="landing-hero-copy landing-hero-step">Upload your lecture materials and turn them into grounded AI explanations, quizzes, summaries, flashcards, and personalized review sessions.</p>
            <div className="landing-hero-actions landing-hero-step">
              <Link className="landing-button landing-button-primary" to={isAuthenticated ? '/dashboard' : '/register'}>{isAuthenticated ? 'Go to Dashboard' : 'Get Started'} <ArrowRight size={18} /></Link>
              <Link className="landing-button landing-button-secondary" to="/login">Log In</Link>
            </div>
          </div>
          <div className="landing-depth" aria-hidden="true">
            <div className="landing-float-card"><Quote size={17} /><span>Lecture-aware</span></div>
            <div className="landing-float-orb" />
          </div>
          <a className="landing-scroll" href="#message"><span>Scroll to explore</span><ArrowDown size={16} /></a>
        </section>

        <section className="landing-message landing-section" id="message">
          <div className="landing-section-label" data-reveal>01 / The idea</div>
          <div className="landing-message-copy" data-reveal="right">
            <h2>Your lectures already contain what you need.<br /><em>StudyMate helps you unlock it.</em></h2>
            <p>AI StudyMate transforms your own study materials into an interactive learning workspace—keeping answers and generated study tools grounded in your uploaded content.</p>
          </div>
        </section>

        <section className="landing-process landing-section" id="how-it-works" aria-labelledby="process-title">
          <div className="landing-section-intro" data-reveal>
            <span className="landing-eyebrow">How it works</span>
            <h2 id="process-title">From lecture file<br />to study session.</h2>
          </div>
          <div className="landing-process-grid">
            {[
              ['01', 'Upload your material', 'PDF, DOCX, or TXT lecture files are processed into searchable study content.'],
              ['02', 'Ask and understand', 'Ask questions and receive answers grounded in your uploaded material with source citations.'],
              ['03', 'Practice actively', 'Generate quizzes, summaries, and flashcards from the same study content.'],
              ['04', 'Review intelligently', 'Save flashcards and revisit them through scheduled review sessions.'],
            ].map(([number, title, text], index) => <article className="landing-process-step" data-reveal key={number} style={{ '--delay': `${index * 90}ms` }}><span>{number}</span><h3>{title}</h3><p>{text}</p></article>)}
          </div>
        </section>

        <section className="landing-feature landing-section" id="features">
          <div className="landing-answer-visual" data-reveal="left" aria-hidden="true">
            <div className="landing-answer-top"><span><BrainCircuit size={18} /> StudyMate</span><span className="landing-live-dot">Grounded</span></div>
            <div className="landing-answer-lines"><i /><i /><i /><i /></div>
            <div className="landing-citation-row"><span>[1] Lecture 04 · p. 12</span><span>[2] Lecture 04 · p. 18</span></div>
          </div>
          <div className="landing-feature-copy" data-reveal="right">
            <span className="landing-eyebrow">Ground your learning</span>
            <h2>Answers connected to your own lecture material.</h2>
            <p>StudyMate retrieves relevant content from your uploaded lectures before producing an answer, helping keep study responses connected to your sources.</p>
            <ul>{['Source-backed answers', 'Lecture-aware context', 'Clear citations'].map((item) => <li key={item}><Check size={16} />{item}</li>)}</ul>
          </div>
        </section>

        <section className="landing-tools landing-section" id="study-tools" aria-labelledby="tools-title">
          <div className="landing-section-intro" data-reveal><span className="landing-eyebrow">Study tools</span><h2 id="tools-title">One study space.<br />Multiple ways to learn.</h2></div>
          <div className="landing-tools-grid">
            {tools.map(({ icon: Icon, title, text, className = '' }, index) => <article className={`landing-tool ${className}`} data-reveal key={title} style={{ '--delay': `${index * 80}ms` }}><Icon size={26} /><div><h3>{title}</h3><p>{text}</p></div><ArrowRight size={20} aria-hidden="true" /></article>)}
          </div>
        </section>

        <section className="landing-flow landing-section" aria-labelledby="flow-title">
          <div className="landing-flow-copy" data-reveal="left"><span className="landing-eyebrow">At the center</span><h2 id="flow-title">Your material stays at the center.</h2><p>StudyMate finds the most relevant parts of your lectures and carries their source information into the answer—so you can keep learning in context.</p></div>
          <div className="landing-flow-track" data-reveal="right" aria-label="Lecture processing flow">
            {['Lecture', 'Chunks', 'Embeddings', 'Relevant Context', 'AI Answer', 'Citations'].map((item, index) => <div className="landing-flow-item" key={item}><span>{index + 1}</span><strong>{item}</strong>{index < 5 && <i aria-hidden="true" />}</div>)}
          </div>
        </section>

        <section className="landing-flashcards landing-section">
          <div className="landing-flashcard-copy" data-reveal="left"><span className="landing-eyebrow">Remember longer</span><h2>Review that adapts to what you know.</h2><p>Move each saved card forward with a simple decision, then return when it is due again.</p><div className="landing-review-chips"><span>Known</span><span>Review Again</span><span>Next Review</span></div></div>
          <div className="landing-card-stage" data-reveal="scale" aria-label="Example flashcard">
            <article className="landing-demo-card landing-demo-card-back"><span>Answer</span><p>When a model learns training data too closely...</p></article>
            <article className="landing-demo-card landing-demo-card-front"><span>Machine Learning</span><h3>What is overfitting?</h3><button type="button" tabIndex="-1">Show answer</button></article>
          </div>
        </section>

        <section className="landing-workspace landing-section">
          <div className="landing-section-intro" data-reveal><span className="landing-eyebrow">Your workspace</span><h2>Everything you need.<br />Nothing to distract you.</h2></div>
          <div className="landing-dashboard-preview" data-reveal="scale" aria-hidden="true">
            <aside><div className="preview-brand"><GraduationCap size={18} /></div>{[1,2,3,4,5].map((value) => <i key={value} />)}</aside>
            <div className="preview-main"><header><b>Study workspace</b><span /></header><div className="preview-panels"><div className="preview-wide"><BookOpen size={24} /><i /><i /><i /></div><div><FileText size={22} /><i /><i /></div><div><MessageSquare size={22} /><i /><i /></div><div className="preview-chart"><Network size={22} /><span /><span /><span /></div></div></div>
          </div>
        </section>

        <section className="landing-why landing-section">
          {[
            ['Grounded', 'Study tools are generated from the material you provide.'],
            ['Focused', 'Learning features live in one clean study workspace.'],
            ['Active', 'Move from reading to questioning, testing, summarizing, and reviewing.'],
          ].map(([title, text], index) => <article data-reveal key={title} style={{ '--delay': `${index * 100}ms` }}><span>0{index + 1}</span><h2>{title}</h2><p>{text}</p></article>)}
        </section>

        <section className="landing-final-cta">
          <div className="landing-cta-orbit" aria-hidden="true" />
          <div data-reveal><span className="landing-eyebrow">Begin your next study session</span><h2>Turn your lecture notes<br />into an active study system.</h2><p>Upload. Ask. Practice. Review.</p><div className="landing-hero-actions"><Link className="landing-button landing-button-light" to="/register">Start Studying <ArrowRight size={18} /></Link><Link className="landing-button landing-button-dark-ghost" to="/login">Log In</Link></div></div>
        </section>
      </main>
      <footer className="landing-footer"><div><a className="landing-brand" href="#top"><span className="landing-brand-mark"><GraduationCap size={20} /></span><span>AI StudyMate</span></a><p>AI-powered study tools grounded in your learning materials.</p></div><nav aria-label="Footer navigation"><a href="#features">Features</a><a href="#how-it-works">How It Works</a><Link to="/login">Login</Link><Link to="/register">Register</Link></nav><span>Practice &amp; portfolio project</span></footer>
    </div>
  )
}
