import { BookOpenCheck, Eye, Globe2, ShieldCheck } from "lucide-react";
import {
  VENDOR_INTELLIGENCE_VERSION,
  resolveVendorOrigin,
} from "../vendor-intelligence/vendor-intelligence";
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

const globalBenchmark = {
  attempted: 1000,
  loaded: 522,
  crossOriginRequests: 32083,
  persisted: 980,
  uniqueOrigins: 3354,
  runId: "global1000-1789914020306",
  workflowRun: "35516116239",
  sourceVersion: "PY96J",
} as const;

const repeatedOrigins = [
  ["https://www.googletagmanager.com", 20],
  ["https://fonts.googleapis.com", 10],
  ["https://static.cloudflareinsights.com", 9],
  ["https://connect.facebook.net", 8],
] as const;

const documentedOrigins = repeatedOrigins.map(([origin,sites])=>({
  origin,
  sites,
  intelligence:resolveVendorOrigin(origin),
}));

export function RealWorldValidation(){
  return <section className="real-validation" id="real-world-validation">
    <div className="real-validation-head">
      <div>
        <span className="eyebrow">Real-world validation · ground truth + discovery + documentation</span>
        <h2>Prove correctness where ground truth exists. Add documented expectations where public evidence exists.</h2>
        <p>Commerce Lab proves abuse and enforcement with known ground truth. Public-site discovery proves browser-visible breadth. Vendor Intelligence then resolves known destinations against first-party vendor documentation without pretending those documents are merchant authorization.</p>
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
          <div><small>PUBLIC · PASSIVE BROWSER</small><strong>External discovery breadth</strong></div>
        </div>
        <p>Logged-out homepage observation only. No accounts, clicks, forms, fuzzing, bypasses, request mutation, payload inspection or private/customer data.</p>
        <div className="validation-metrics">
          <Metric value={publicBenchmark.attempted} label="Nigeria-facing sites"/>
          <Metric value={publicBenchmark.loaded} label="loaded normally"/>
          <Metric value={globalBenchmark.attempted} label="scaled sample"/>
          <Metric value={globalBenchmark.uniqueOrigins} label="origins in 1k run"/>
        </div>
        <div className="validation-loaded"><Eye size={13}/><span><b>{globalBenchmark.crossOriginRequests.toLocaleString()}</b> cross-origin requests observed in the 1,000-site scale run · {globalBenchmark.persisted} representative observations persisted.</span></div>
      </article>
    </div>

    <div className="validation-intelligence">
      <div className="validation-intelligence-head">
        <div>
          <span><BookOpenCheck size={14}/> Vendor Intelligence · {VENDOR_INTELLIGENCE_VERSION}</span>
          <strong>Known destinations no longer have to stay anonymous.</strong>
          <p>This is post-hoc documentation enrichment. Original benchmark records keep their frozen browser evidence semantics.</p>
        </div>
        <small>Vendor docs ≠ merchant approval</small>
      </div>
      <div className="validation-intelligence-rows">
        {documentedOrigins.map(({origin,sites,intelligence})=>{
          const profile=intelligence.profiles[0]??null;
          const host=new URL(origin).hostname;
          return <div className="validation-intelligence-row" key={origin}>
            <div><b>{host}</b><small>{sites} Nigeria-facing sites</small></div>
            <div><b>{profile?.family??"Unresolved"}</b><small>{profile?.vendor??"No documentation-backed identity"}</small></div>
            <div><b>{profile?.expectedPurposes[0]??"Documented purpose unavailable"}</b><small>{profile?"Vendor documented":"Unresolved"}</small></div>
            <div>{profile?.sources[0]?<a href={profile.sources[0].url} target="_blank" rel="noreferrer">Documentation ↗</a>:<span>No source</span>}</div>
          </div>;
        })}
      </div>
    </div>

    <div className="validation-semantics">
      <div><span>EXPECTED</span><b>DOC-BACKED WHEN RESOLVED</b><small>vendor's documented product purpose</small></div>
      <div><span>APPROVED / SHOULD</span><b>MERCHANT ONLY</b><small>Purpose Contract remains authoritative</small></div>
      <div><span>CAPABLE</span><b>DOCS + LOCAL CONFIG</b><small>documented surface, narrowed by local evidence</small></div>
      <div><span>OBSERVED / DID</span><b>RUNTIME</b><small>browser-visible request metadata</small></div>
      <div><span>CONTEXT / WHY</span><b>FIRST-PARTY STRONGEST</b><small>vendor use case supports but does not prove justification</small></div>
    </div>

    <div className="validation-footer">
      <div className="validation-destinations">
        <span>Scale result</span>
        <div>
          <small><b>{globalBenchmark.attempted}</b> sites attempted</small>
          <small><b>{globalBenchmark.loaded}</b> loaded normally</small>
          <small><b>{globalBenchmark.uniqueOrigins}</b> unique origins</small>
          <small><b>{globalBenchmark.persisted}</b> persisted representatives</small>
        </div>
        <p>Tranco snapshot {globalBenchmark.sourceVersion}. This is a reproducible 1,000-site high-traffic public-web sample, not “10% of the landscape.”</p>
      </div>
      <div className="validation-boundary">
        <b>What documentation enrichment still does not prove</b>
        <p>Vendor docs do not prove merchant approval, merchant-specific configuration, maliciousness, necessity, backend permissions, database access, server-to-server activity or what data actually reached a downstream vendor. Those require stronger evidence.</p>
        <small>Nigeria run {publicBenchmark.workflowRun} · {publicBenchmark.runId} · scale run {globalBenchmark.workflowRun} · {globalBenchmark.runId}</small>
      </div>
    </div>
  </section>;
}

function Metric({value,label}:{value:number;label:string}){
  return <div><strong>{value.toLocaleString()}</strong><span>{label}</span></div>;
}
