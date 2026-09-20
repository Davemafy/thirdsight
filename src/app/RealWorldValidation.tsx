import { useEffect, useMemo, useState } from "react";
import {
  VENDOR_INTELLIGENCE_VERSION,
  resolveVendorOrigin,
} from "../vendor-intelligence/vendor-intelligence";
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
    <div className="validation-section-title">
      <h2>Real-world validation</h2>
      <span>Each claim stays tied to the evidence that supports it.</span>
    </div>

    <section className="validation-ledger-block">
      <div className="validation-block-heading"><h3>Commerce Lab</h3><span>Ground truth</span></div>
      <div className="validation-ledger-row">
        <span>Busy sales day</span>
        <strong>10× legitimate sale</strong>
        <b>No false alarm</b>
      </div>
      <div className="validation-ledger-row">
        <span>Abnormal behaviour</span>
        <strong>Proportional abuse</strong>
        <b>Purpose mismatch caught</b>
      </div>
      <div className="validation-ledger-row">
        <span>Scope violation</span>
        <strong>Phone field outside approved scope</strong>
        <b>Removed before send</b>
      </div>
    </section>

    <section className="validation-ledger-block">
      <div className="validation-block-heading"><h3>Public web</h3><span>Passive browser observation</span></div>
      <div className="validation-number-row">
        <div><strong>{publicBenchmark.attempted}</strong><span>Nigeria-facing sites attempted</span></div>
        <div><strong>{publicBenchmark.loaded}</strong><span>loaded normally</span></div>
        <div><strong>{globalBenchmark.attempted.toLocaleString()}</strong><span>sites in scale run</span></div>
        <div><strong>{globalBenchmark.uniqueOrigins.toLocaleString()}</strong><span>unique origins</span></div>
      </div>
      <p className="validation-evidence-line"><b>{globalBenchmark.crossOriginRequests.toLocaleString()}</b> cross-origin requests observed · <b>{globalBenchmark.persisted}</b> representative observations persisted.</p>
      <p className="validation-boundary-line">Logged-out homepages only. No accounts, clicks, forms, fuzzing, bypasses, request mutation, payload inspection, or private/customer data.</p>
    </section>

    <section className="validation-ledger-block">
      <div className="validation-block-heading">
        <h3>Origin coverage</h3>
        <span>{originCoverage?`${originCoverage.indexed.toLocaleString()} / ${globalBenchmark.uniqueOrigins.toLocaleString()} indexed`:"3,354 / 3,354 indexed"}</span>
      </div>
      <div className="validation-coverage-rows">
        <div><span>Documented product family</span><b>{originCoverage?.documentedProductFamily?.toLocaleString()??"—"}</b><small>{originCoverage?`${originCoverage.weightedDocumentationCoveragePct}% of site-origin appearances`:"Calculated after manifest loads"}</small></div>
        <div><span>Source-domain namespace</span><b>{originCoverage?.byDisposition.INDEXED_SOURCE_NAMESPACE?.toLocaleString()??"—"}</b><small>Namespace relation only, not ownership</small></div>
        <div><span>Shared or mixed external</span><b>{originCoverage?(originCoverage.byDisposition.INDEXED_SHARED_EXTERNAL+originCoverage.byDisposition.INDEXED_MIXED_RELATIONSHIP).toLocaleString():"—"}</b><small>Prioritized for documentation resolution</small></div>
        <div><span>Single-site external</span><b>{originCoverage?.byDisposition.INDEXED_SINGLE_EXTERNAL?.toLocaleString()??"—"}</b><small>Indexed even when vendor identity stays unresolved</small></div>
      </div>
      <p className="validation-boundary-line">Inventory coverage means every observed origin has a reproducible disposition. It does not mean every origin has a verified vendor identity or documented purpose.</p>
    </section>

    <section className="validation-ledger-block">
      <div className="validation-block-heading"><h3>Vendor context</h3><span>{VENDOR_INTELLIGENCE_VERSION}</span></div>
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
    </section>

    <div className="validation-evidence-model">
      <div><span>Expected</span><b>Vendor docs when resolved</b></div>
      <div><span>Approved / should</span><b>Merchant only</b></div>
      <div><span>Capable</span><b>Docs + local config</b></div>
      <div><span>Observed / did</span><b>Runtime evidence</b></div>
      <div><span>Context / why</span><b>First-party strongest</b></div>
    </div>

    <div className="validation-endnotes">
      <p>Tranco snapshot {globalBenchmark.sourceVersion}. This is a reproducible 1,000-site high-traffic public-web sample, not “10% of the landscape.”</p>
      <p><b>Boundary:</b> vendor documentation does not prove merchant approval, merchant-specific configuration, maliciousness, necessity, backend permissions, database access, server-to-server activity, or what data actually reached a downstream vendor.</p>
      <small>Nigeria run {publicBenchmark.workflowRun} · {publicBenchmark.runId} · scale run {globalBenchmark.workflowRun} · {globalBenchmark.runId}</small>
    </div>
  </section>;
}
