import {
  Activity,
  ArrowRight,
  Check,
  CircleCheck,
  Eye,
  Globe2,
  Network,
  Radio,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import "./ThirdSightLanding.css";

const navItems=[
  ["Product","#product"],
  ["Evidence","#evidence"],
  ["Validation","#validation"],
  ["Demo","#demo"],
] as const;

export default function ThirdSightLanding(){
  return <div className="tmk-page">
    <header className="tmk-header">
      <a className="tmk-brand" href="/">
        <span><ShieldCheck size={18}/></span>
        <b>ThirdSight</b>
      </a>
      <nav className="tmk-nav">
        {navItems.map(([label,href])=><a key={label} href={href}>{label}</a>)}
      </nav>
      <a className="tmk-nav-cta" href="/app">Open console <ArrowRight size={14}/></a>
    </header>

    <main className="tmk-main">
      <section className="tmk-hero">
        <div className="tmk-hero-copy">
          <span className="tmk-kicker">Continuous third-party access verification</span>
          <h1>See what third-party integrations actually do.</h1>
          <p>ThirdSight connects approved purpose, technical reach, runtime behaviour and business context — then applies only the response the evidence can justify.</p>
          <div className="tmk-hero-actions">
            <a className="tmk-primary" href="/app">Open live console <ArrowRight size={15}/></a>
            <a className="tmk-secondary" href="/commerce-lab">Explore Commerce Lab</a>
          </div>
          <small>Synthetic demo environment · no real customer data</small>
        </div>

        <div className="tmk-product-stage">
          <div className="tmk-product-window">
            <div className="tmk-window-top">
              <div><i/><i/><i/></div>
              <span>Commerce Lab</span>
              <b><i/> Evidence live</b>
            </div>
            <div className="tmk-console-preview">
              <aside>
                <div className="tmk-preview-brand"><span><ShieldCheck size={15}/></span><strong>ThirdSight</strong></div>
                <div className="tmk-preview-nav">
                  <span className="active"><Eye size={13}/> Overview</span>
                  <span><Network size={13}/> Integrations</span>
                  <span><Activity size={13}/> Activity</span>
                  <span><ShieldCheck size={13}/> Incidents</span>
                </div>
                <small>Persisted evidence only.<br/>Unknown stays unknown.</small>
              </aside>
              <section className="tmk-preview-workspace">
                <div className="tmk-preview-head">
                  <div><small>CURRENT THIRD-PARTY POSTURE</small><h2>One integration exceeded its approved scope.</h2><p>ThirdSight removed the unjustified field before transmission and allowed the rest of the analytics event to continue.</p></div>
                  <span className="tmk-live"><i/> Live</span>
                </div>

                <div className="tmk-preview-strip">
                  <PreviewStat label="Observed" value="39" />
                  <PreviewStat label="Purpose-aware" value="26" />
                  <PreviewStat label="Findings" value="1" warn/>
                  <PreviewStat label="Pre-send" value="Proven" />
                </div>

                <div className="tmk-preview-card">
                  <div className="tmk-preview-card-head"><div><small>LATEST EVIDENCE</small><strong>Analytics Partner · product.viewed</strong></div><b>CONSTRAIN</b></div>
                  <div className="tmk-field-grid">
                    <FieldLine label="product.id" state="allowed"/>
                    <FieldLine label="product.category" state="allowed"/>
                    <FieldLine label="product.price" state="allowed"/>
                    <FieldLine label="customer.phone" state="blocked"/>
                  </div>
                  <div className="tmk-proof-line"><ShieldCheck size={14}/><span><b>PREVENTED</b> before transmission · receiver confirmed forbidden field absent</span></div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </section>

      <section className="tmk-intro" id="product">
        <span className="tmk-section-tag">Product</span>
        <h2>A better way to watch<br/>third-party access.</h2>
        <p>Most systems can tell you that an integration exists. ThirdSight is built to show whether what happened still matches what was approved — with enough evidence to explain the decision.</p>
      </section>

      <section className="tmk-story-grid">
        <article className="tmk-story-card visual">
          <BoundaryPreview/>
        </article>
        <article className="tmk-story-card copy">
          <span>Managed boundary</span>
          <h3>Stop only what the policy actually forbids.</h3>
          <p>When ThirdSight sits on a managed request path, it can remove an unjustified field before send without breaking the legitimate integration request around it.</p>
          <a href="/commerce-lab">Run the Commerce Lab proof <ArrowRight size={14}/></a>
        </article>

        <article className="tmk-story-card copy">
          <span>Browser visibility</span>
          <h3>Observe without pretending you know more than you do.</h3>
          <p>Browser-only evidence stays browser-only. ThirdSight records destination, timing and request metadata while leaving merchant intent and opaque payload semantics unresolved when they are not actually known.</p>
          <a href="/app">Open integration exposure <ArrowRight size={14}/></a>
        </article>
        <article className="tmk-story-card visual dark">
          <ObservationPreview/>
        </article>
      </section>

      <section className="tmk-feature-section" id="evidence">
        <div className="tmk-feature-heading">
          <span className="tmk-section-tag">Evidence</span>
          <h2>Four questions before every response.</h2>
          <p>ThirdSight does not flatten policy, capability, runtime behaviour and business context into one score.</p>
        </div>
        <div className="tmk-evidence-grid">
          <EvidenceCard letter="S" title="Should" copy="What the merchant explicitly approved for this integration." />
          <EvidenceCard letter="C" title="Could" copy="What permissions, documented capabilities or visible reach make possible." />
          <EvidenceCard letter="D" title="Did" copy="What runtime sensors actually observed at the boundary." />
          <EvidenceCard letter="W" title="Why" copy="The first-party business event or object that explains the access." />
        </div>
      </section>

      <section className="tmk-wide-proof">
        <div>
          <span>Response ladder</span>
          <h2>Escalate only as far as the evidence supports.</h2>
        </div>
        <div className="tmk-response-ladder">
          <ResponseStep index="01" label="ALLOW" copy="Consistent evidence"/>
          <ResponseStep index="02" label="OBSERVE" copy="Unresolved evidence"/>
          <ResponseStep index="03" label="CONSTRAIN" copy="Narrow the request"/>
          <ResponseStep index="04" label="ISOLATE" copy="Contain future access"/>
        </div>
      </section>

      <section className="tmk-validation" id="validation">
        <div className="tmk-validation-copy">
          <span className="tmk-section-tag">Validation</span>
          <h2>Ground truth first.<br/>Then real-world breadth.</h2>
          <p>Controlled Commerce Lab scenarios prove correctness. Separate public-site runs measure discovery breadth without pretending browser-visible evidence is merchant authorization.</p>
          <a href="/app">See validation evidence <ArrowRight size={14}/></a>
        </div>
        <div className="tmk-validation-panel">
          <div className="tmk-validation-row"><span>Controlled scope violation</span><strong><Check size={15}/> PREVENTED</strong></div>
          <div className="tmk-validation-row"><span>10× legitimate flash sale</span><strong><Check size={15}/> 0 false alarms</strong></div>
          <div className="tmk-validation-row"><span>Nigeria-facing benchmark</span><strong>40 sites · 203 observations</strong></div>
          <div className="tmk-validation-row"><span>Scale benchmark</span><strong>1,000 sites · 3,354 origins</strong></div>
        </div>
      </section>

      <section className="tmk-feature-list">
        <div><Radio size={18}/><h3>Live evidence</h3><p>Representative persisted events instead of dashboard fixtures.</p></div>
        <div><Globe2 size={18}/><h3>Vendor intelligence</h3><p>First-party vendor docs add expected behaviour without becoming merchant approval.</p></div>
        <div><SlidersHorizontal size={18}/><h3>Graded response</h3><p>Allow, observe, constrain or isolate depending on what can actually be proven.</p></div>
        <div><Sparkles size={18}/><h3>Advisory learning</h3><p>Human-verified feedback can prioritize review without gaining enforcement authority.</p></div>
      </section>

      <section className="tmk-final" id="demo">
        <span className="tmk-section-tag">Live demo</span>
        <h2>Watch the merchant experience.<br/>Then inspect what happened underneath.</h2>
        <p>Commerce Lab behaves like a normal synthetic store. ThirdSight shows what each third party touched, why it mattered, and whether the response happened before or after access.</p>
        <div>
          <a className="tmk-primary" href="/commerce-lab">Open Commerce Lab <ArrowRight size={15}/></a>
          <a className="tmk-secondary" href="/app">Open ThirdSight</a>
        </div>
      </section>
    </main>

    <footer className="tmk-footer">
      <div><a className="tmk-brand" href="/"><span><ShieldCheck size={17}/></span><b>ThirdSight</b></a><p>Continuous third-party access verification for commerce systems.</p></div>
      <div><a href="/app">Console</a><a href="/commerce-lab">Commerce Lab</a><a href="#validation">Validation</a></div>
      <span>Built for NITDA / ICSC 2026 Track G</span>
    </footer>
  </div>;
}

function PreviewStat({label,value,warn=false}:{label:string;value:string;warn?:boolean}){
  return <div className={warn?"warn":""}><span>{label}</span><strong>{value}</strong></div>;
}

function FieldLine({label,state}:{label:string;state:"allowed"|"blocked"}){
  return <div className={"tmk-field-line "+state}><code>{label}</code><span/><b>{state==="allowed"?"Passed":"Stopped"}</b></div>;
}

function BoundaryPreview(){
  return <div className="tmk-boundary-preview">
    <div className="tmk-boundary-top"><span>Analytics Partner</span><b>Managed request boundary</b></div>
    <div className="tmk-boundary-axis"><span>Merchant</span><span>ThirdSight</span><span>Partner</span></div>
    <FieldLine label="product.id" state="allowed"/>
    <FieldLine label="product.category" state="allowed"/>
    <FieldLine label="product.price" state="allowed"/>
    <FieldLine label="customer.phone" state="blocked"/>
    <div className="tmk-boundary-foot"><CircleCheck size={15}/><span>Legitimate analytics continued.</span></div>
  </div>;
}

function ObservationPreview(){
  return <div className="tmk-observation-preview">
    <div className="tmk-observation-head"><span>Browser evidence</span><b>analytics.tiktok.com</b></div>
    <div className="tmk-observation-route"><span>cedar.shop</span><i/><i/><i/><span>third party</span></div>
    <div className="tmk-observation-facts">
      <div><small>Observed</small><strong>Cross-origin request</strong></div>
      <div><small>Payload</small><strong>Not inspected</strong></div>
      <div><small>Merchant approval</small><strong>Not supplied</strong></div>
    </div>
    <div className="tmk-observation-note">ThirdSight keeps missing evidence unresolved instead of guessing.</div>
  </div>;
}

function EvidenceCard({letter,title,copy}:{letter:string;title:string;copy:string}){
  return <article><span>{letter}</span><h3>{title}</h3><p>{copy}</p></article>;
}

function ResponseStep({index,label,copy}:{index:string;label:string;copy:string}){
  return <div><span>{index}</span><strong>{label}</strong><small>{copy}</small></div>;
}
