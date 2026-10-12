import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import logo from '@/assets/beepa-logo.png.asset.json';
import specialist from '@/assets/beepa-specialist.jpg';
import team from '@/assets/beepa-team.jpg';
import collaboration from '@/assets/beepa-collaboration.jpg';

export const Route = createFileRoute('/')({
  head: () => ({ meta: [
    { title: 'Beepa BPO | Filipino talent. Built around your business.' },
    { name: 'description', content: 'Build a dedicated Filipino team with Beepa BPO. Customer support, virtual assistants, back office, sales, IT, marketing and more—with web and mobile visibility into your people, payroll and performance.' },
    { property: 'og:title', content: 'Beepa BPO | Your people. Your advantage.' },
    { property: 'og:description', content: 'Exceptional Filipino talent, a dedicated team, and full transparency. Discover outsourcing with Beepa BPO and explore careers.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: Index,
});
const services = ['Customer Support','Back Office Support','Virtual Assistants','Sales Support','IT Support','Marketing','eLearning Course Development','Slide Creator','Data Entry','Customer Relations'];
const faqs = [
  ['What can I outsource to Beepa?', 'From customer support and back-office operations to virtual assistance, sales, IT, marketing, data entry, presentations and eLearning development, we help you shape a team around the work you need done.'],
  ['Will my team work in my time zone?', 'Your team’s schedule is planned around your business and customers. Discuss the hours and coverage you need during your consultation.'],
  ['How do I track my team’s performance?', 'Client access on web and mobile brings employee activity, attendance, payroll and overall performance together. Agree on the measures that matter to your business so reporting stays useful.'],
  ['Can I start with just one person?', 'Yes. Your team plan can start with one dedicated role and grow as your needs develop. Scope, coverage and pricing are confirmed before you move forward.'],
  ['How does pricing work?', 'Your proposal is tailored to the roles, team size, working hours and support you need. We do not publish a one-size-fits-all rate; the scope and costs are agreed before onboarding.'],
  ['How can I apply to work with Beepa?', 'Explore the career areas below and prepare your application brief. Current vacancies and the official application destination must be confirmed with Beepa before an application can be submitted.'],
];
function Arrow() { return <span className="arrow" aria-hidden="true">↗</span>; }
function downloadBrief(text: string, filename: string) { const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); }
function Index() {
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState<'team'|'career'|null>(null);
  const [role, setRole] = useState('Customer Support');
  const [size, setSize] = useState(3);
  const [coverage, setCoverage] = useState('Your business hours');
  const [device, setDevice] = useState<'web'|'mobile'>('web');
  const [faq, setFaq] = useState<number|null>(0);
  const [saved, setSaved] = useState(false);
  const [career, setCareer] = useState('Customer Support');
  const openTeam = (service?: string) => { if (service) setRole(service); setSaved(false); setModal('team'); };
  const openCareer = (value: string) => { setCareer(value); setSaved(false); setModal('career'); };
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const values = new FormData(event.currentTarget);
    const content = modal === 'team' ? `BEEPA BPO — TEAM CONSULTATION BRIEF\n\nName: ${values.get('name')}\nEmail: ${values.get('email')}\nCompany: ${values.get('company')}\nRole: ${role}\nTeam size: ${size}\nCoverage: ${coverage}\nBusiness needs: ${values.get('message')}\n\nDraft only — not submitted to Beepa.` : `BEEPA BPO — CAREER APPLICATION BRIEF\n\nName: ${values.get('name')}\nEmail: ${values.get('email')}\nCareer area: ${career}\nExperience: ${values.get('message')}\n\nDraft only — not submitted to Beepa. Confirm current vacancies and official application channel.`;
    downloadBrief(content, modal === 'team' ? 'beepa-team-brief.txt' : 'beepa-career-brief.txt'); setSaved(true);
  };
  return <>
    <div className="container">
      <header className="header">
        <a href="#" aria-label="Beepa BPO home"><img className="logo" src={logo.url} alt="Beepa Business Process Outsourcing" /></a>
        <nav className={`nav ${menu ? 'open' : ''}`} aria-label="Main navigation">
          {[['Services','services'],['Why Beepa','why-beepa'],['How it works','how-it-works'],['Transparency','transparency'],['Careers','careers']].map(([label,id]) => <a key={id} href={`#${id}`} className={id === 'careers' ? 'career-link' : ''} onClick={() => setMenu(false)}>{label}</a>)}
        </nav>
        <div className="header-actions"><Button variant="brand" className="header-cta" onClick={() => openTeam()}>Let’s talk <Arrow /></Button><Button variant="ghost" className="mobile-menu" aria-label={menu ? 'Close navigation' : 'Open navigation'} aria-expanded={menu} onClick={() => setMenu(!menu)}>{menu ? '✕' : '☰'}</Button></div>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">Filipino talent. Global ambition.</div>
            <h1>Your people.<br />Your advantage.<br /><span>Your Beepa.</span></h1>
            <p className="hero-description">Great businesses are built by great people.<br />We find, train, and manage your dedicated Filipino team. You focus on what comes next.</p>
            <div className="hero-buttons"><Button variant="brand" onClick={() => openTeam()}>Build my team <Arrow /></Button><Button variant="editorial" asChild><a href="#services">Explore our services <span className="arrow">↓</span></a></Button></div>
            <div className="hero-foot"><img className="mini-portrait" src={specialist} alt="Filipina support specialist" /><div><strong>Real people. Fully in your corner.</strong>Dedicated to your business, not just your tasks.</div></div>
          </div>
          <div className="hero-media"><img src={specialist} alt="Filipina support specialist wearing a Beepa uniform in a bright office" fetchPriority="high" /><div className="photo-top">THE PEOPLE BEHIND YOUR PROGRESS</div><div className="photo-caption"><div><strong>A little closer to your team.</strong><span>Even from a world away.</span></div><div className="caption-location"><span>BASED IN THE PHILIPPINES</span><br /><span>Connected to your business.</span></div></div></div>
        </section>
        <div className="assurance">{['Dedicated Filipino talent','Your hours. Your workflows.','Web & mobile visibility','Transparent payroll & performance'].map(text => <div key={text}><span className="check">✓</span>{text}</div>)}</div>
        <section className="section" id="why-beepa">
          <span className="section-number">01 / MORE THAN OUTSOURCING</span>
          <h2 className="intro-headline">Beepa finds <img className="inline-face" src={specialist} alt="" /> trains <img className="inline-face" src={collaboration} alt="" /> and looks after<br className="hidden lg:block" /> the people who move your business forward.<br /><span className="muted">Your team. Your standards. A shared ambition.</span></h2>
          <div className="section-bottom"><p>From the first customer conversation to the work behind the scenes, we bring capable Filipino talent into your business—and make sure you never lose sight of the bigger picture.</p><a className="text-link" href="#how-it-works">Meet your next advantage <Arrow /></a></div>
          <img className="team-panorama" src={team} alt="A Filipino Beepa team collaborating and supporting customers in a modern office" loading="lazy" />
          <div className="values">{[
            ['People, not placements','A dedicated team that gets to know your brand, your customers, and how you work.'],
            ['Built around your business','The right roles, the right working hours, and a setup shaped around your needs.'],
            ['Supported from day one','Recruitment, onboarding, and ongoing team support. We stay in the picture.'],
            ['Nothing behind the curtain','Clear visibility into your people, payroll, attendance, and performance.'],
          ].map(([title,desc]) => <article key={title}><h3>{title}</h3><p>{desc}</p></article>)}</div>
        </section>
        <div className="greeting" aria-label="Hello from the Philippines"><span>Hello.</span><span>Kumusta.</span><span>Your team is here.</span><span>Let’s grow.</span></div>
        <section className="section" id="services">
          <div className="section-heading"><div><span className="section-number">02 / THE WORK WE TAKE OFF YOUR DESK</span><h2>More room for<br />what you do best.</h2></div><p>Ten specialisms. One committed partner. Start with the support you need today, and build the team your next chapter needs.</p></div>
          <div className="service-grid">{[
            [specialist,'01','Customer Support','Every conversation matters. Give your customers a person who listens, understands, and follows through.'],
            [team,'02','Back Office Support','The work behind the work. Organized, accurate, and taken care of.'],
            [collaboration,'03','Virtual Assistants','Your trusted extra pair of hands. More focus, fewer loose ends.'],
          ].map(([image,num,title,desc]) => <article className="service-card" key={title}><img src={image} alt={`${title} with Filipino Beepa professionals`} loading="lazy" /><div className="service-card-content"><span className="service-counter">{num} /</span><h3>{title}</h3><p>{desc}</p></div></article>)}</div>
          <div className="service-list">{services.map((service,i) => <div className="service-list-item" key={service}><Button variant="ghost" onClick={() => openTeam(service)}><div><span>{String(i+1).padStart(2,'0')}</span>{service}</div><span aria-hidden="true">↗</span></Button></div>)}</div>
        </section>
        <section className="section time-section">
          <div><span className="section-number">03 / A WORLD AWAY. RIGHT ON TIME.</span><h2>Your business hours.<br />Our people, ready.</h2><p>Across time zones and across your workflows, your Filipino team is built to show up when your business needs them.</p><div className="time-list">{[['Philippines','08:00','Where your dedicated team calls home'],['London','01:00','Connected across borders'],['New York','20:00','The previous evening'],['Sydney','11:00','The same working day']].map(([city,time,caption]) => <div className="time-row" key={city}><div><span>{city}</span><small>{caption}</small></div><strong>{time}</strong></div>)}</div><p className="!text-[10px]">Illustrative time-zone comparison · October, daylight saving observed.</p></div>
          <img className="time-photo" src={team} alt="Beepa professionals working by a window overlooking the Philippines" loading="lazy" />
        </section>
        <section className="section" id="how-it-works">
          <div className="section-heading"><div><span className="section-number">04 / A CLEAR PATH TO YOUR TEAM</span><h2>From a first conversation<br />to a team that clicks.</h2></div><p>No handoffs into the unknown. We work with you at every step, so your people are ready for your business—not just the job description.</p></div>
          <div className="process-grid">{[
            ['01 / ALIGN','Let’s get to know your business.','We map your goals, roles, workflows, and coverage. The starting point is always you.',collaboration],
            ['02 / FIND','The right people. Not just a résumé.','We identify Filipino talent suited to the skills, working style, and standards you need.',specialist],
            ['03 / PREPARE','Your brand becomes second nature.','Onboarding and training connect your team to your tools, processes, and customers.',team],
            ['04 / GROW','Go live. Stay connected.','Ongoing support, performance reviews, and clear reporting keep your team moving forward.',collaboration],
          ].map(([step,title,desc,image]) => <article className="process-step" key={step}><div className="process-step-copy"><span>{step}</span><h3>{title}</h3><p>{desc}</p></div><img src={image} alt={title} loading="lazy" /></article>)}</div>
        </section>
      </main>
    </div>
    <section className="transparency-band" id="transparency"><div className="container section transparency">
      <div className="section-heading"><div><span className="section-number">05 / FULL TRANSPARENCY. NO GUESSWORK.</span><h2>Your team, in view.<br />Wherever you are.</h2></div><p>Outsourcing shouldn’t mean being out of the loop. With access on web and mobile, your people, payroll, and progress stay within reach.</p></div>
      <div className="platform-stage"><div className="platform-copy"><h3>A closer connection.<br />A clearer picture.</h3><p>See the work. Understand the costs. Follow the progress. One shared view gives you more confidence in the team behind your business.</p><div className="platform-items">{['Employee tracking & attendance','Payroll visibility & oversight','Overall team performance','Access on web & mobile'].map(text => <div className="platform-item" key={text}>{text}<span>✓</span></div>)}</div><div className="device-switch" aria-label="Platform preview"><Button variant="ghost" aria-pressed={device==='web'} onClick={() => setDevice('web')}>Web view</Button><Button variant="ghost" aria-pressed={device==='mobile'} onClick={() => setDevice('mobile')}>Mobile view</Button></div></div>
        <div className={`dashboard ${device==='mobile' ? 'mobile' : ''}`} aria-label={`${device} illustrative employee dashboard`}><div className="dashboard-top"><img src={logo.url} alt="Beepa" /><span className="demo-label">ILLUSTRATIVE PREVIEW</span></div><h4>Your team, at a glance.</h4><p className="dashboard-sub">Operations overview · This week</p><div className="dashboard-stats"><div><small>Team members</small><strong>12</strong></div><div><small>Attendance</small><strong>98<em>%</em></strong></div><div><small>Payroll</small><strong className="!text-primary !text-base">Up to date</strong></div></div><table className="dashboard-table"><thead><tr><th>Team member</th><th>Status</th><th>Hours</th><th>Performance</th></tr></thead><tbody>{[['A. Santos','40h','On track'],['M. Reyes','40h','On track'],['J. Garcia','38h','On track'],['R. Cruz','40h','On track']].map(([name,hours,performance]) => <tr key={name}><td>{name}</td><td><span className="status">Active</span></td><td>{hours}</td><td>{performance}</td></tr>)}</tbody></table></div>
      </div>
    </div></section>
    <div className="container">
      <section className="section report-layout"><img className="report-photo" src={collaboration} alt="Filipino team leaders reviewing work together" loading="lazy" /><div className="report-copy"><span className="section-number">06 / PROGRESS YOU CAN SEE</span><h2>Less chasing updates.<br />More moving forward.</h2><p>Know what’s happening, what’s working, and where your team needs support. Clear reporting turns day-to-day activity into meaningful conversations.</p><div className="report-list"><div><span>Employee attendance</span><span>Visible</span></div><div><span>Payroll & team costs</span><span>Transparent</span></div><div><span>Goals & performance</span><span>Trackable</span></div><div><span>Your next decision</span><span>Better informed</span></div></div></div></section>
      <section className="promise">{[['Dedicated.','A team that feels like yours.','People who learn your business, represent your brand, and become part of your everyday.'],['Connected.','Distance without disconnect.','Shared workflows and web and mobile access keep you close to the work and the people.'],['Accountable.','A partnership with visibility.','Clear expectations, transparent costs, and performance conversations grounded in the work.']].map(([word,title,desc]) => <article key={word}><strong>{word}</strong><h3>{title}</h3><p>{desc}</p></article>)}</section>
      <section className="section planner" id="team-plan"><div><span className="section-number">07 / YOUR NEXT CHAPTER STARTS HERE</span><h2>A team built for you.<br />Not one size fits all.</h2><p className="planner-description">Tell us where you need a little more capacity. Shape your starting team, and we’ll help you plan the right next step.</p><label className="field"><span>Where do you need support?</span><select value={role} onChange={e => setRole(e.target.value)}>{services.map(service => <option key={service}>{service}</option>)}</select></label><label className="field"><div className="range-label"><span>How many people?</span><strong>{size} {size===1 ? 'person' : 'people'}</strong></div><input aria-label="Team size" type="range" min="1" max="20" value={size} onChange={e => setSize(Number(e.target.value))} /></label><label className="field"><span>When do you need your team?</span><select value={coverage} onChange={e => setCoverage(e.target.value)}><option>Your business hours</option><option>Extended hours</option><option>Round-the-clock coverage</option></select></label></div><div className="planner-summary"><span className="summary-title">YOUR STARTING TEAM</span><h3><span>{size} dedicated {size===1?'person':'people'}.</span><br />A world of possibility.</h3><div className="summary-details"><div><span>Specialism</span><strong>{role}</strong></div><div><span>Coverage</span><strong>{coverage}</strong></div><div><span>Location</span><strong>Philippines</strong></div><div><span>Client access</span><strong>Web & mobile</strong></div><div><span>Pricing</span><strong>Tailored to your team</strong></div></div><Button variant="brand" onClick={() => openTeam()}>Let’s plan my team <Arrow /></Button><p>No commitment. Just a conversation about the people, scope, and support your business needs.</p></div></section>
    </div>
    <section className="careers-band" id="careers"><div className="container careers"><div><span className="section-number">08 / GREAT PEOPLE. MEANINGFUL WORK.</span><h2>Your talent deserves<br />a bigger stage.</h2><p>Bring your skills, your curiosity, and your ambition. Discover a career connecting Filipino talent with businesses around the world.</p><Button variant="inverse" onClick={() => openCareer('General interest')}>Explore a career with Beepa <Arrow /></Button></div><div>{['Customer Support','Operations & Virtual Assistance','Sales, IT & Creative'].map(area => <div className="career-row" key={area}><div><h3>{area}</h3><small>Philippines · Explore this career area</small></div><Button variant="ghost" aria-label={`Prepare application for ${area}`} onClick={() => openCareer(area)}><Arrow /></Button></div>)}<div className="career-note">Career areas shown, not a live vacancy list. Availability to be confirmed.</div></div></div></section>
    <div className="container"><section className="section faq-layout" id="questions"><div><span className="section-number">09 / BEFORE WE SAY HELLO</span><h2>Good questions.<br />Straight answers.</h2><p>A little clarity goes a long way. Here’s what you might want to know before building your team.</p></div><div>{faqs.map(([q,a],i) => <div className="faq-item" key={q}><Button variant="ghost" aria-expanded={faq===i} aria-controls={`answer-${i}`} onClick={() => setFaq(faq===i ? null : i)}><span>{q}</span><span>{faq===i ? '−' : '+'}</span></Button>{faq===i && <p id={`answer-${i}`}>{a}</p>}</div>)}</div></section>
      <section className="final-cta"><img src={team} alt="Your next Filipino team at Beepa" loading="lazy" /><div className="final-copy"><h2>Your next great hire.<br />Your next big move.</h2><p>Let’s build the team that takes you there.</p><Button variant="inverse" onClick={() => openTeam()}>Build my team <Arrow /></Button></div></section>
      <footer className="footer"><div className="footer-top"><div><img className="logo" src={logo.url} alt="Beepa Business Process Outsourcing" /><p className="footer-tagline">Filipino talent. A shared ambition.</p></div><div className="footer-links"><div><strong>YOUR BUSINESS</strong><a href="#services">Our services</a><a href="#how-it-works">How it works</a><a href="#transparency">Full transparency</a><a href="#team-plan">Build your team</a></div><div><strong>OUR PEOPLE</strong><a href="#why-beepa">Why Beepa</a><a href="#careers">Careers</a><a href="#questions">Questions & answers</a></div></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Beepa BPO. All rights reserved.</span><span>Based in the Philippines. Built for your world.</span></div><div className="footer-brand" aria-hidden="true"><span />BEEPA.</div></footer>
    </div>
    <Dialog open={modal!==null} onOpenChange={open => {if(!open)setModal(null);}}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogTitle>{modal==='career' ? 'Your next chapter with Beepa.' : 'Let’s shape your team.'}</DialogTitle><DialogDescription>{modal==='career' ? `Prepare your application brief for ${career}.` : `${size} ${size===1?'person':'people'} · ${role} · ${coverage}`}</DialogDescription><form className="dialog-form" onSubmit={submit}><div className="form-grid"><label className="field"><span>Your name</span><input name="name" autoComplete="name" required placeholder="Full name" /></label><label className="field"><span>Email address</span><input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label></div>{modal==='team' && <label className="field"><span>Company</span><input name="company" autoComplete="organization" required placeholder="Your business name" /></label>}<label className="field"><span>{modal==='career' ? 'Your experience & interests' : 'What would you like your team to take care of?'}</span><textarea name="message" rows={3} required placeholder={modal==='career' ? 'Tell us about your skills and experience.' : 'A few words about your needs and goals.'} /></label><Button variant="brand" type="submit">Download my {modal==='career' ? 'application' : 'team'} brief <span className="arrow">↓</span></Button><p className="dialog-disclaimer">This saves a private draft to your device. Nothing is sent to Beepa. The official {modal==='career' ? 'application' : 'consultation'} contact channel has not been provided yet.</p>{saved && <p className="dialog-success" role="status">Your brief is ready and downloaded. Keep it for your conversation with Beepa.</p>}</form></DialogContent></Dialog>
  </>;
}
