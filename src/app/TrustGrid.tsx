import { useEffect, useMemo, useState } from "react";
import type { ChallengeProof, ExposureRow } from "./IntegrationExposureMap";
import "./TrustGrid.css";

type Props={
  exposure:readonly ExposureRow[];
  proof:ChallengeProof|null;
};

type ScenarioId="normal"|"flash"|"drift"|"purpose"|"shadow";
type Phase=0|1|2|3;

type Scenario={
  id:ScenarioId;
  number:string;
  label:string;
  eyebrow:string;
  headline:string;
  subline:string;
  integration:string;
  response:"ALLOW"|"CONSTRAIN"|"OBSERVE";
  tone:"clear"|"signal"|"hold";
  finding:string;
  mandate:string;
  capability:string;
  runtime:string;
  context:string;
  request:string;
  receiver:string;
};

export function TrustGrid({exposure,proof}:Props){
  const [scenarioId,setScenarioId]=useState<ScenarioId>("drift");
  const [phase,setPhase]=useState<Phase>(3);
  const [running,setRunning]=useState(false);

  const shadow=exposure.find(row=>
    row.label.toLowerCase().includes("shadow")||
    row.destinations.some(value=>value.toLowerCase().includes("shadow"))
  );

  const removed=proof?.scopePrevention.removedFields??[];
  const received=proof?.scopePrevention.receivedFields??[];
  const blockedField=removed[0]??"customer.phone";
  const receivedLabel=received.length?received.join(" · "):"approved fields";

  const scenarios=useMemo<Scenario[]>(()=>[
    {
      id:"normal",
      number:"01",
      label:"Normal operation",
      eyebrow:"GROUND TRUTH / BASELINE",
      headline:"Legitimate access passes without friction.",
      subline:"Approved purpose, expected context and observed behaviour agree.",
      integration:"Commerce integration",
      response:"ALLOW",
      tone:"clear",
      finding:"NO FINDING",
      mandate:"Approved job",
      capability:"Declared integration scope",
      runtime:"Expected access",
      context:"Known commerce event",
      request:"Approved request",
      receiver:"Request delivered",
    },
    {
      id:"flash",
      number:"02",
      label:"10× sales spike",
      eyebrow:"GROUND TRUTH / FALSE-POSITIVE CONTROL",
      headline:proof?.busySale.passed
        ? "Traffic rises 10×. Authority does not."
        : "Flash-sale proof is unavailable.",
      subline:proof?.busySale.passed
        ? `${proof.busySale.allowed}/${proof.busySale.observed} legitimate events allowed with ${proof.busySale.falseAlarms} false alarms.`
        :"No persisted flash-sale proof is available in the current evidence feed.",
      integration:"Commerce integrations",
      response:"ALLOW",
      tone:"clear",
      finding:"NO FALSE ALARM",
      mandate:"Same approved job",
      capability:"Same integration capability",
      runtime:"10× legitimate volume",
      context:"Flash-sale business event",
      request:"High-volume legitimate traffic",
      receiver:"Traffic continues",
    },
    {
      id:"drift",
      number:"03",
      label:"Scope overreach",
      eyebrow:"GROUND TRUTH / FIELD-LEVEL ENFORCEMENT",
      headline:proof?.scopePrevention.proven
        ? `${blockedField} crosses the approved boundary.`
        :"Pre-send prevention proof is unavailable.",
      subline:proof?.scopePrevention.proven
        ? "ThirdSight removes only the unjustified field before transmission; legitimate data continues."
        :"No persisted managed-prevention record is available in the current evidence feed.",
      integration:"CRM integration",
      response:"CONSTRAIN",
      tone:"signal",
      finding:proof?.scopePrevention.proven?"SCOPE DRIFT":"AWAITING PROOF",
      mandate:"Approved customer sync",
      capability:"Can reach wider customer scope",
      runtime:proof?.scopePrevention.proven?`${blockedField} attempted`:"Attempt observed",
      context:"Known customer-sync event",
      request:proof?.scopePrevention.proven?`${receivedLabel} + ${blockedField}`:"Observed request",
      receiver:proof?.scopePrevention.proven?receivedLabel:"Receiver state unavailable",
    },
    {
      id:"purpose",
      number:"04",
      label:"Purpose mismatch",
      eyebrow:"GROUND TRUTH / NORMAL-LOOKING ABUSE",
      headline:proof?.abnormalBehavior.observed
        ?"The volume looks normal. The business purpose does not."
        :"Purpose-mismatch proof is unavailable.",
      subline:proof?.abnormalBehavior.observed
        ? `${proof.abnormalBehavior.persistedFindings} persisted finding${proof.abnormalBehavior.persistedFindings===1?"":"s"} prove that volume alone is not the decision boundary.`
        :"No persisted abnormal-behaviour finding is available in the current evidence feed.",
      integration:"Partner API",
      response:"CONSTRAIN",
      tone:"signal",
      finding:proof?.abnormalBehavior.findingTypes.includes("PURPOSE_MISMATCH")?"PURPOSE MISMATCH":"ABNORMAL BEHAVIOUR",
      mandate:"Expected business purpose",
      capability:"Authorized partner access",
      runtime:"Plausible aggregate volume",
      context:"Business-object correlation fails",
      request:"Normal-looking request pattern",
      receiver:"Only justified access continues",
    },
    {
      id:"shadow",
      number:"05",
      label:"Unresolved partner",
      eyebrow:"EVIDENCE BOUNDARY / DO NOT OVERREACH",
      headline:"ThirdSight sees the request. It cannot prove the purpose.",
      subline:shadow
        ? `${shadow.label} is browser-visible, but merchant-authoritative purpose remains unresolved.`
        :"Browser-visible activity lacks enough authoritative context for stronger enforcement.",
      integration:shadow?.label??"Unresolved third party",
      response:"OBSERVE",
      tone:"hold",
      finding:"INSUFFICIENT EVIDENCE",
      mandate:"Unknown",
      capability:"Partial lower bound",
      runtime:"Request observed",
      context:"Unknown",
      request:"Browser-visible request",
      receiver:"Observed — not blocked",
    },
  ],[blockedField,proof,receivedLabel,shadow]);

  const active=scenarios.find(item=>item.id===scenarioId)??scenarios[0]!;

  useEffect(()=>{
    if(!running)return;
    setPhase(0);
    const timers=[
      window.setTimeout(()=>setPhase(1),380),
      window.setTimeout(()=>setPhase(2),820),
      window.setTimeout(()=>setPhase(3),1280),
      window.setTimeout(()=>setRunning(false),1450),
    ];
    return()=>timers.forEach(timer=>window.clearTimeout(timer));
  },[running,scenarioId]);

  function runScenario(id:ScenarioId){
    setScenarioId(id);
    setRunning(false);
    window.requestAnimationFrame(()=>setRunning(true));
  }

  return <div className="tg-shell">
    <header className="tg-masthead">
      <div className="tg-wordmark">
        <strong>THIRDSIGHT</strong>
        <span>THIRD-PARTY DIGITAL TRUST INFRASTRUCTURE</span>
      </div>
      <div className="tg-mast-meta">
        <span>COMMERCE + CONSUMER PROTECTION</span>
        <b>CONTROLLED COMMERCE LAB</b>
      </div>
      <div className="tg-live"><i/> LIVE EVIDENCE</div>
    </header>

    <div className="tg-layout">
      <aside className="tg-scenario-rail">
        <div className="tg-rail-title">
          <span>PROOF SEQUENCE</span>
          <b>05 CASES</b>
        </div>
        <div className="tg-rail-list">
          {scenarios.map(item=><button
            key={item.id}
            className={(item.id===scenarioId?"active ":"")+item.tone}
            onClick={()=>runScenario(item.id)}
          >
            <span>{item.number}</span>
            <div><strong>{item.label}</strong><small>{item.eyebrow.split(" / ")[1]??item.eyebrow}</small></div>
            <em>{item.id===scenarioId?"●":"○"}</em>
          </button>)}
        </div>
        <div className="tg-rail-foot">
          <span>POSITION</span>
          <strong>Built for businesses.<br/>Legible to regulators.</strong>
        </div>
      </aside>

      <main className="tg-stage">
        <section className="tg-stage-title">
          <div className="tg-stage-index">{active.number}</div>
          <div>
            <span>{active.eyebrow}</span>
            <h1>{active.headline}</h1>
            <p>{active.subline}</p>
          </div>
          <button className="tg-run" onClick={()=>runScenario(active.id)} disabled={running}>
            <span>{running?"RUNNING":"RUN PROOF"}</span>
            <b>{running?"■":"▶"}</b>
          </button>
        </section>

        <section className="tg-evidence-grid">
          <EvidenceColumn index="A" title="MANDATE" value={active.mandate} source={active.id==="shadow"?"merchant purpose missing":"authoritative purpose"} active={phase>=0}/>
          <EvidenceColumn index="B" title="CAPABILITY" value={active.capability} source={active.id==="shadow"?"browser-visible lower bound":"declared / known reach"} active={phase>=1}/>
          <EvidenceColumn index="C" title="RUNTIME" value={active.runtime} source="persisted observation" active={phase>=2}/>
          <EvidenceColumn index="D" title="CONTEXT" value={active.context} source={active.id==="shadow"?"not authoritative":"first-party context"} active={phase>=2}/>
        </section>

        <section className={"tg-transmission "+active.tone+" phase-"+phase}>
          <div className="tg-flow-label">
            <span>LIVE ACCESS PATH</span>
            <b>{active.integration}</b>
          </div>

          <div className="tg-path">
            <div className="tg-endpoint source">
              <span>01</span>
              <strong>BUSINESS</strong>
              <small>{active.request}</small>
            </div>

            <div className="tg-wire left"><i/></div>

            <div className={"tg-gate "+active.tone}>
              <span>THIRDSIGHT GATE</span>
              <strong>{phase<3?"VERIFYING":active.response}</strong>
              <small>{phase<3?"purpose × reach × runtime × context":active.finding}</small>
            </div>

            <div className={"tg-wire right "+(active.response==="CONSTRAIN"?"cut":"")}><i/></div>

            <div className="tg-endpoint receiver">
              <span>02</span>
              <strong>RECEIVER</strong>
              <small>{phase<3?"awaiting decision":active.receiver}</small>
            </div>
          </div>

          {active.id==="drift"?<ScopeLedger proof={proof} blockedField={blockedField}/>:null}
          {active.id==="purpose"?<PurposeLedger proof={proof}/>:null}
          {active.id==="shadow"?<UncertaintyLedger/>:null}
        </section>

        <section className="tg-verdict">
          <div>
            <span>DETERMINISTIC RESPONSE</span>
            <strong className={active.tone}>{phase<3?"—":active.response}</strong>
          </div>
          <div>
            <span>FINDING</span>
            <strong>{phase<3?"VERIFYING":active.finding}</strong>
          </div>
          <div>
            <span>AUTHORITY</span>
            <strong>{authority(active)}</strong>
          </div>
          <div className="tg-verdict-proof">
            <span>CLAIM</span>
            <strong>{claim(active,proof)}</strong>
          </div>
        </section>

        <section className="tg-breadth">
          <div className="tg-breadth-head">
            <span>EXTERNAL VALIDATION / PASSIVE PUBLIC-WEB DISCOVERY</span>
            <strong>GROUND TRUTH IN THE LAB. BREADTH OUTSIDE IT.</strong>
          </div>
          <div className="tg-breadth-stats">
            <Metric value="1,000" label="sites attempted"/>
            <Metric value="522" label="loaded normally"/>
            <Metric value="32,083" label="cross-origin requests"/>
            <Metric value="3,354" label="unique destination origins"/>
          </div>
          <p>Browser-only validation proves discovery breadth. It does not claim merchant approval, complete backend reach, business justification, PREVENTED or DETECTED outcomes.</p>
        </section>
      </main>
    </div>

    <footer className="tg-footer">
      <span>THIRDSIGHT / TRACK G PROTOTYPE</span>
      <b>PROVE WHAT CAN BE PROVEN. KEEP UNCERTAINTY VISIBLE.</b>
      <span>ALLOW · OBSERVE · CONSTRAIN · ISOLATE</span>
    </footer>
  </div>;
}

function EvidenceColumn({index,title,value,source,active}:{index:string;title:string;value:string;source:string;active:boolean}){
  return <div className={"tg-evidence-col "+(active?"active":"")}>
    <div><span>{index}</span><b>{title}</b></div>
    <strong>{value}</strong>
    <small>{source}</small>
  </div>;
}

function ScopeLedger({proof,blockedField}:{proof:ChallengeProof|null;blockedField:string}){
  const received=proof?.scopePrevention.receivedFields??[];
  return <div className="tg-ledger">
    <div className="tg-ledger-title"><span>FIELD-LEVEL TRANSMISSION LEDGER</span><b>APPROVED → ATTEMPTED → DELIVERED</b></div>
    {(received.length?received:["legitimate fields"]).map(field=><div className="tg-ledger-row pass" key={field}>
      <span>{field}</span><b>APPROVED</b><b>ATTEMPTED</b><b>DELIVERED</b>
    </div>)}
    <div className="tg-ledger-row stop">
      <span>{blockedField}</span><b>OUTSIDE SCOPE</b><b>ATTEMPTED</b><b>STOPPED</b>
    </div>
    <div className="tg-ledger-result"><span>PRE-SEND RESULT</span><strong>{proof?.scopePrevention.proven?"PREVENTED":"AWAITING PROOF"}</strong><small>forbidden field received: {proof?.scopePrevention.forbiddenFieldReceived===false?"NO":"UNKNOWN"}</small></div>
  </div>;
}

function PurposeLedger({proof}:{proof:ChallengeProof|null}){
  return <div className="tg-ledger compact">
    <div className="tg-ledger-title"><span>OBJECT-LEVEL PURPOSE CHECK</span><b>VOLUME ALONE IS NOT AUTHORITY</b></div>
    <div className="tg-purpose-line"><span>AGGREGATE TRAFFIC</span><strong>PLAUSIBLE</strong><i>→</i><span>BUSINESS-OBJECT CORRELATION</span><strong className="bad">FAILED</strong></div>
    <div className="tg-ledger-result"><span>DETERMINISTIC FINDING</span><strong>{proof?.abnormalBehavior.observed?"PURPOSE_MISMATCH":"AWAITING PROOF"}</strong><small>{proof?.abnormalBehavior.persistedFindings??0} persisted findings in current proof summary</small></div>
  </div>;
}

function UncertaintyLedger(){
  return <div className="tg-ledger compact hold">
    <div className="tg-ledger-title"><span>AUTHORITY BOUNDARY</span><b>UNKNOWN ≠ MALICIOUS</b></div>
    <div className="tg-purpose-line"><span>RUNTIME</span><strong>OBSERVED</strong><i>→</i><span>MERCHANT PURPOSE</span><strong className="hold">UNKNOWN</strong></div>
    <div className="tg-ledger-result"><span>DETERMINISTIC LIMIT</span><strong>OBSERVE</strong><small>Verified Learning may prioritize human review; it cannot change enforcement.</small></div>
  </div>;
}

function Metric({value,label}:{value:string;label:string}){
  return <div><strong>{value}</strong><span>{label}</span></div>;
}

function authority(scenario:Scenario){
  if(scenario.response==="ALLOW")return "NO INTERVENTION";
  if(scenario.response==="CONSTRAIN")return "FIELD / ACCESS BOUNDARY";
  return "EVIDENCE ONLY";
}

function claim(scenario:Scenario,proof:ChallengeProof|null){
  if(scenario.id==="flash")return proof?.busySale.passed?"NO FALSE ALARM":"NOT YET PROVEN";
  if(scenario.id==="drift")return proof?.scopePrevention.proven?"PREVENTED BEFORE SEND":"NOT YET PROVEN";
  if(scenario.id==="purpose")return proof?.abnormalBehavior.observed?"NORMAL-LOOKING ABUSE CAUGHT":"NOT YET PROVEN";
  if(scenario.id==="shadow")return "NO UNSUPPORTED ENFORCEMENT";
  return "LEGITIMATE ACCESS CONTINUES";
}
