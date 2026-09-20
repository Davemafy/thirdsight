import { Eye, Globe2, ShieldCheck } from "lucide-react";
import "./RealWorldValidation.css";

const publicBenchmark = {
  attempted: 40,
  loaded: 30,
  loadedWithEvidence: 30,
  observations: 203,
  uniqueOrigins: 118,
  runId: "ng40-1789852996559",
  workflowRun: "35470223205",
} as const;

const repeatedOrigins = [
  ["googletagmanager.com", 20],
  ["fonts.googleapis.com", 10],
  ["static.cloudflareinsights.com", 9],
  ["connect.facebook.net", 8],
] as const;

export function RealWorldValidation(){
  return <section className="real-validation" id="real-world-validation">
    <div className="real-validation-head">
      <div>
        <span className="eyebrow">Real-world validation · two evidence environments</span>
        <h2>Prove correctness where ground truth exists. Test discovery breadth where it does not.</h2>
        <p>Commerce Lab and public-site discovery answer different questions. Keeping them separate lets ThirdSight show real-world breadth without turning browser-visible metadata into claims about merchant intent or backend access.</p>
      </div>
      <span className="validation-badge"><ShieldCheck size={13}/> claim-bounded</span>
    </div>

    <div className="validation-compare">
      <article className="validation-lane controlled">
        <div className="validation-lane-title">
          <span className="validation-icon"><ShieldCheck size={16}/></span>
          <div><small>CONTROLLED · COMMERCE LAB</small><strong>Ground-truth proof</strong></div>
        </div>
        <p>Purpose Contracts, capabilities, runtime activity and first-party business context are known, so deterministic findings and enforcement can be verified.</p>
        <div className="validation-proof-lines">
          <span><b>10× legitimate sale</b><em>ALLOW · no false alarm</em></span>
          <span><b>Proportional abuse</b><em>PURPOSE_MISMATCH · caught</em></span>
          <span><b>Scope violation</b><em>CONSTRAIN · phone removed · PREVENTED</em></span>
        </div>
      </article>

      <article className="validation-lane public">
        <div className="validation-lane-title">
          <span className="validation-icon"><Globe2 size={16}/></span>
          <div><small>PUBLIC · NIGERIA-FACING SITES</small><strong>Discovery breadth</strong></div>
        </div>
        <p>Logged-out homepage observation only. No accounts, clicks, forms, fuzzing, bypasses, request mutation, payload inspection or private/customer data.</p>
        <div className="validation-metrics">
          <Metric value={publicBenchmark.attempted} label="sites attempted"/>
          <Metric value={publicBenchmark.loaded} label="loaded normally"/>
          <Metric value={publicBenchmark.observations} label="observations persisted"/>
          <Metric value={publicBenchmark.uniqueOrigins} label="unique destination origins"/>
        </div>
        <div className="validation-loaded"><Eye size={13}/><span><b>{publicBenchmark.loadedWithEvidence}/{publicBenchmark.loaded}</b> loaded sites produced browser-visible cross-origin evidence.</span></div>
      </article>
    </div>

    <div className="validation-semantics">
      <div><span>SHOULD</span><b>UNKNOWN</b><small>merchant Purpose Contract not provided</small></div>
      <div><span>COULD</span><b>PARTIAL</b><small>browser-visible lower bound only</small></div>
      <div><span>DID</span><b>KNOWN</b><small>observed request metadata</small></div>
      <div><span>WHY</span><b>UNKNOWN</b><small>business justification unavailable</small></div>
      <div><span>COVERAGE</span><b>BROWSER ONLY</b><small>not backend or server-to-server visibility</small></div>
    </div>

    <div className="validation-footer">
      <div className="validation-destinations">
        <span>Repeated observed origins</span>
        <div>{repeatedOrigins.map(([origin,sites])=><small key={origin}><b>{sites}</b> sites · {origin}</small>)}</div>
        <p>Origins are browser-visible destinations, not automatically asserted to be independent third-party companies.</p>
      </div>
      <div className="validation-boundary">
        <b>What this public benchmark does not prove</b>
        <p>ThirdSight does not infer maliciousness, necessity, over-permission, merchant intent, backend permissions, database access, server-to-server activity or downstream vendor behavior from browser-only evidence.</p>
        <small>Corrected workflow {publicBenchmark.workflowRun} · benchmark {publicBenchmark.runId} · 0 rows labelled PREVENTED or DETECTED</small>
      </div>
    </div>
  </section>;
}

function Metric({value,label}:{value:number;label:string}){
  return <div><strong>{value}</strong><span>{label}</span></div>;
}
