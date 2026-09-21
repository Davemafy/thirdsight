import { useEffect, useMemo, useState } from "react";
import { BookOpenCheck, Eye, Globe2, ShieldCheck } from "lucide-react";
import { resolveVendorOrigin } from "../vendor-intelligence/vendor-intelligence";
import {
  summarizeOriginCoverage,
  type BenchmarkOriginInventory,
} from "../vendor-intelligence/origin-coverage";
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
  const [originInventory,setOriginInventory]=useState<BenchmarkOriginInventory|null>(null);

  useEffect(()=>{
    let live=true;
    fetch("/vendor-intelligence/global1000-origins.json",{cache:"no-store"})
      .then(response=>{if(!response.ok) throw new Error("origin inventory unavailable");return response.json()})
      .then(value=>{if(live)setOriginInventory(value as BenchmarkOriginInventory)})
      .catch(()=>{if(live)setOriginInventory(null)});
    return()=>{live=false};
  },[]);

  const originCoverage=useMemo(
    ()=>originInventory?summarizeOriginCoverage(originInventory.entries):null,
    [originInventory],
  );

  return <section className="real-validation" id="real-world-validation">
    <div className="real-validation-head">
      <div>
        <span className="eyebrow">Real-world validation</span>
        <h2>Test what ThirdSight can prove — and show where its visibility stops.</h2>
        <p>Commerce Lab gives us known ground truth. Public sites test browser visibility. Vendor documentation adds context without being treated as merchant approval.</p>
      </div>
      <span className="validation-badge"><ShieldCheck size={13}/> Claims verified</span>
    </div>

    <div className="validation-compare">
      <article className="validation-lane controlled">
        <div className="validation-lane-title">
          <span className="validation-icon"><ShieldCheck size={16}/></span>
          <div><small>Commerce Lab</small><strong>Ground-truth proof</strong></div>
        </div>
        <p>Purpose Contracts, capabilities, runtime activity and first-party business context are known, so deterministic findings and enforcement can be verified.</p>
        <div className="validation-proof-lines">
          <span><b>10× legitimate sale</b><em>Allowed · no false alarm</em></span>
          <span><b>Proportional abuse</b><em>Purpose mismatch · caught</em></span>
          <span><b>Scope violation</b><em>Phone removed before send</em></span>
        </div>
      </article>

      <article className="validation-lane public">
        <div className="validation-lane-title">
          <span className="validation-icon"><Globe2 size={16}/></span>
          <div><small>Public web</small><strong>External discovery breadth</strong></div>
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
          <span><BookOpenCheck size={14}/> Vendor context</span>
          <strong>Known destinations can be matched to documented products.</strong>
          <p>The original browser evidence stays unchanged; documentation only adds context.</p>
        </div>
        <small>Documentation is not approval</small>
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

    <div className="validation-origin-coverage">
      <div className="validation-origin-coverage-head">
        <div>
          <span>Origin coverage</span>
          <strong>{originCoverage?`${originCoverage.indexed.toLocaleString()} / ${globalBenchmark.uniqueOrigins.toLocaleString()}`:"3,354 / 3,354"} indexed</strong>
          <p>Every origin from the scale run is indexed. Unknown vendors stay unknown instead of being guessed.</p>
        </div>
        <b>{originCoverage?"100% indexed":"Loading manifest"}</b>
      </div>
      <div className="validation-origin-coverage-grid">
        <CoverageMetric
          value={originCoverage?.documentedProductFamily}
          fallback="—"
          label="documented product family"
          detail={originCoverage?`${originCoverage.weightedDocumentationCoveragePct}% of site-origin appearances`:"calculated after manifest loads"}
        />
        <CoverageMetric
          value={originCoverage?.byDisposition.INDEXED_SOURCE_NAMESPACE}
          fallback="—"
          label="source-domain namespace"
          detail="namespace relation only · not ownership"
        />
        <CoverageMetric
          value={originCoverage
            ?originCoverage.byDisposition.INDEXED_SHARED_EXTERNAL+originCoverage.byDisposition.INDEXED_MIXED_RELATIONSHIP
            :undefined}
          fallback="—"
          label="shared / mixed external"
          detail="prioritized for documentation resolution"
        />
        <CoverageMetric
          value={originCoverage?.byDisposition.INDEXED_SINGLE_EXTERNAL}
          fallback="—"
          label="single-site external"
          detail="indexed even when vendor remains unresolved"
        />
      </div>
      <small className="validation-origin-coverage-note">An unresolved origin is still indexed; ThirdSight simply does not invent a product identity for it.</small>
    </div>

    <div className="validation-semantics">
      <div><span>Expected</span><b>Vendor documentation</b><small>what the product says it is for</small></div>
      <div><span>Allowed</span><b>Your policy</b><small>what this integration may do here</small></div>
      <div><span>Can access</span><b>Docs + local setup</b><small>the reachable surface we can support</small></div>
      <div><span>Observed</span><b>Runtime evidence</b><small>what ThirdSight actually saw</small></div>
      <div><span>Context</span><b>Business activity</b><small>what was happening at the time</small></div>
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
        <b>What this still cannot prove</b>
        <p>Vendor docs do not prove merchant approval, merchant-specific configuration, maliciousness, necessity, backend permissions, database access, server-to-server activity or what data actually reached a downstream vendor. Those require stronger evidence.</p>
        <small>Nigeria run {publicBenchmark.workflowRun} · {publicBenchmark.runId} · scale run {globalBenchmark.workflowRun} · {globalBenchmark.runId}</small>
      </div>
    </div>
  </section>;
}

function Metric({value,label}:{value:number;label:string}){
  return <div><strong>{value.toLocaleString()}</strong><span>{label}</span></div>;
}

function CoverageMetric({
  value,
  fallback,
  label,
  detail,
}:{
  value:number|undefined;
  fallback:string;
  label:string;
  detail:string;
}){
  return <div><strong>{typeof value==="number"?value.toLocaleString():fallback}</strong><span>{label}</span><small>{detail}</small></div>;
}
