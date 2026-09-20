import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronRight,
  CircleDot,
  Eye,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import type { ChallengeProof, ExposureRow } from "./IntegrationExposureMap";
import "./HackathonControlRoom.css";

type Props={
  exposure:readonly ExposureRow[];
  proof:ChallengeProof|null;
};

type ScenarioId="normal"|"flash"|"drift"|"proportional"|"shadow";
type Phase=0|1|2;

type Scenario={
  id:ScenarioId;
  label:string;
  kicker:string;
  title:string;
  subtitle:string;
  integration:string;
  response:"ALLOW"|"CONSTRAIN"|"OBSERVE";
  result:string;
  tone:"safe"|"warn"|"observe";
  context:string;
};

export function HackathonControlRoom({exposure,proof}:Props){
  const [scenarioId,setScenarioId]=useState<ScenarioId>("normal");
  const [phase,setPhase]=useState<Phase>(2);
  const [running,setRunning]=useState(false);

  const shadow=exposure.find(row=>row.label.toLowerCase().includes("shadow")||row.destinations.some(value=>value.includes("shadow")));
  const scenarios=useMemo<Scenario[]>(()=>[
    {
      id:"normal",
      label:"Normal",
      kicker:"Baseline",
      title:"Normal checkout stays out of the way.",
      subtitle:"Approved access, expected business context, no escalation.",
      integration:"Checkout analytics",
      response:"ALLOW",
      result:"Allowed",
      tone:"safe",
      context:"Customer checkout",
    },
    {
      id:"flash",
      label:"10× flash sale",
      kicker:"False-positive test",
      title:proof?.busySale.passed?"Traffic jumps 10×. ThirdSight still allows it.":"Flash-sale proof is not currently available.",
      subtitle:proof?.busySale.passed
        ? `${proof.busySale.allowed}/${proof.busySale.observed} legitimate events allowed · ${proof.busySale.falseAlarms} false alarms.`
        :"The controlled proof record is unavailable.",
      integration:"Commerce integrations",
      response:"ALLOW",
      result:proof?.busySale.passed?"No false alarm":"Awaiting proof",
      tone:"safe",
      context:"Flash-sale checkout",
    },
    {
      id:"drift",
      label:"Scope drift",
      kicker:"Managed prevention",
      title:proof?.scopePrevention.proven?"An integration reaches for data outside its job.":"Scope-drift prevention proof is not currently available.",
      subtitle:proof?.scopePrevention.proven
        ? `${proof.scopePrevention.removedFields.join(", ")||"Unjustified field"} is removed before transmission while legitimate fields continue.`
        :"No persisted pre-send prevention record is available.",
      integration:"CRM integration",
      response:"CONSTRAIN",
      result:proof?.scopePrevention.proven?"PREVENTED":"Awaiting proof",
      tone:"warn",
      context:"Customer sync",
    },
    {
      id:"proportional",
      label:"Hidden abuse",
      kicker:"Looks normal",
      title:proof?.abnormalBehavior.observed?"Volume looks plausible. Purpose correlation does not.":"Abnormal-behaviour proof is not currently available.",
      subtitle:proof?.abnormalBehavior.observed
        ? `ThirdSight catches the mismatch without relying on raw volume. ${proof.abnormalBehavior.persistedFindings} persisted finding${proof.abnormalBehavior.persistedFindings===1?"":"s"}.`
        :"No persisted deterministic abnormal-behaviour finding is available.",
      integration:"Partner API",
      response:"CONSTRAIN",
      result:proof?.abnormalBehavior.observed?"PURPOSE MISMATCH":"Awaiting proof",
      tone:"warn",
      context:"Proportional partner traffic",
    },
    {
      id:"shadow",
      label:"Unknown integration",
      kicker:"Proof stops here",
      title:"ThirdSight sees the request but cannot justify stronger authority.",
      subtitle:shadow
        ? `${shadow.label} is observed, but merchant purpose remains unresolved. Deterministic response stays OBSERVE.`
        :"Unknown browser integration: identity/purpose evidence is incomplete, so enforcement does not escalate.",
      integration:shadow?.label??"shadowpixel.invalid",
      response:"OBSERVE",
      result:"Needs human review",
      tone:"observe",
      context:"Browser-only evidence",
    },
  ],[exposure,proof,shadow]);

  const scenario=scenarios.find(item=>item.id===scenarioId)??scenarios[0]!;

  useEffect(()=>{
    if(!running)return;
    setPhase(0);
    const a=window.setTimeout(()=>setPhase(1),650);
    const b=window.setTimeout(()=>{setPhase(2);setRunning(false)},1450);
    return()=>{window.clearTimeout(a);window.clearTimeout(b)};
  },[running,scenarioId]);

  const run=(id:ScenarioId)=>{
    setScenarioId(id);
    setRunning(false);
    window.requestAnimationFrame(()=>setRunning(true));
  };

  return <div className="hcr-app">
    <header className="hcr-topbar">
      <div className="hcr-brand"><span><ShieldCheck size={17}/></span><strong>ThirdSight</strong></div>
      <div className="hcr-mode"><i/> Commerce Lab · controlled demo</div>
      <span className="hcr-track">Track G</span>
    </header>

    <main className="hcr-main">
      <section className="hcr-intro">
        <div>
          <span>Watching what third-party integrations really do</span>
          <h1>Run the attack. Watch the response.</h1>
        </div>
        <p>ThirdSight separates approved purpose, technical reach, runtime access and business context—then escalates only as far as the evidence supports.</p>
      </section>

      <nav className="hcr-scenarios" aria-label="Demo scenarios">
        {scenarios.map(item=><button
          key={item.id}
          className={item.id===scenarioId?"active":""}
          onClick={()=>run(item.id)}
        >
          <span>{item.kicker}</span>
          <b>{item.label}</b>
          {item.id===scenarioId?<Play size={13}/>:null}
        </button>)}
      </nav>

      <section className={"hcr-stage "+scenario.tone+" phase-"+phase}>
        <div className="hcr-stage-head">
          <div>
            <span className="hcr-eyebrow">{scenario.kicker}</span>
            <h2>{scenario.title}</h2>
            <p>{scenario.subtitle}</p>
          </div>
          <button className="hcr-run" onClick={()=>run(scenario.id)} disabled={running}>
            {running?<RotateCcw size={15}/>:<Play size={15}/>}
            {running?"Running":"Run scenario"}
          </button>
        </div>

        <div className="hcr-flow">
          <FlowNode label="Business event" value={scenario.context} icon={<Activity size={16}/>}/>
          <ArrowConnector active={phase>=0}/>
          <FlowNode label="Integration" value={scenario.integration} icon={<Zap size={16}/>} active={phase>=1}/>
          <ArrowConnector active={phase>=1} alert={scenario.tone==="warn"}/>
          <DecisionNode scenario={scenario} phase={phase}/>
          <ArrowConnector active={phase>=2} alert={scenario.tone==="warn"}/>
          <FlowNode
            label="Receiver"
            value={receiverValue(scenario,proof)}
            icon={scenario.response==="CONSTRAIN"?<ShieldCheck size={16}/>:<Eye size={16}/>}
            active={phase>=2}
          />
        </div>

        <div className="hcr-proof">
          <div className="hcr-proof-left">
            <span>What ThirdSight proved</span>
            <strong>{scenario.result}</strong>
          </div>
          <div className="hcr-proof-grid">
            <ProofFact label="SHOULD" value={shouldValue(scenario)} state={scenario.id==="shadow"?"unknown":"known"}/>
            <ProofFact label="COULD" value={couldValue(scenario)} state={scenario.id==="shadow"?"partial":"known"}/>
            <ProofFact label="DID" value={didValue(scenario,proof)} state="observed"/>
            <ProofFact label="WHY" value={whyValue(scenario)} state={scenario.id==="shadow"?"unknown":"known"}/>
          </div>
        </div>

        {scenario.id==="drift"?<ScopeDiff proof={proof}/>:null}
        {scenario.id==="shadow"?<LearningBoundary/>:null}
      </section>

      <section className="hcr-bottom-proof">
        <ProofBadge
          icon={<Check size={15}/>}
          label="Busy sales day"
          value={proof?.busySale.passed?"0 false alarms":"Awaiting proof"}
          tone={proof?.busySale.passed?"safe":"neutral"}
        />
        <ProofBadge
          icon={<AlertTriangle size={15}/>}
          label="Abnormal behaviour"
          value={proof?.abnormalBehavior.observed?"Caught":"Not observed"}
          tone={proof?.abnormalBehavior.observed?"warn":"neutral"}
        />
        <ProofBadge
          icon={<ShieldCheck size={15}/>}
          label="Pre-send scope control"
          value={proof?.scopePrevention.proven?"PREVENTED":"Awaiting proof"}
          tone={proof?.scopePrevention.proven?"safe":"neutral"}
        />
        <ProofBadge
          icon={<Sparkles size={15}/>}
          label="Authority boundary"
          value="Unknown stays unknown"
          tone="neutral"
        />
      </section>
    </main>
  </div>;
}

function FlowNode({label,value,icon,active=true}:{label:string;value:string;icon:React.ReactNode;active?:boolean}){
  return <div className={"hcr-node "+(active?"active":"")}>
    <span>{icon}</span>
    <div><small>{label}</small><strong>{value}</strong></div>
  </div>;
}

function ArrowConnector({active,alert=false}:{active:boolean;alert?:boolean}){
  return <div className={"hcr-arrow "+(active?"active ":"")+(alert?"alert":"")}><span/></div>;
}

function DecisionNode({scenario,phase}:{scenario:Scenario;phase:Phase}){
  return <div className={"hcr-decision "+scenario.tone+(phase>=2?" resolved":"")}>
    <span>ThirdSight</span>
    <strong>{phase<2?"VERIFYING…":scenario.response}</strong>
    <small>{phase<2?"Comparing purpose · reach · access · context":decisionCopy(scenario)}</small>
  </div>;
}

function ProofFact({label,value,state}:{label:string;value:string;state:"known"|"partial"|"unknown"|"observed"}){
  return <div className={"hcr-proof-fact "+state}><span>{label}</span><strong>{value}</strong></div>;
}

function ScopeDiff({proof}:{proof:ChallengeProof|null}){
  const removed=proof?.scopePrevention.removedFields??[];
  const received=proof?.scopePrevention.receivedFields??[];
  const target=removed[0]??"customer.phone";
  return <div className="hcr-diff">
    <div className="hcr-diff-head"><span>Managed scope diff</span><strong>Approved → attempted → received</strong></div>
    <div className="hcr-diff-row">
      <span>Approved</span>
      <div>{received.map(value=><b key={value}>{value}</b>)}{received.length===0?<b>legitimate fields</b>:null}</div>
      <em>continues</em>
    </div>
    <div className="hcr-diff-row blocked">
      <span>Outside scope</span>
      <div><b>{target}</b></div>
      <em>removed before send</em>
    </div>
    <div className="hcr-diff-result"><ShieldCheck size={15}/><strong>PREVENTED</strong><span>Receiver did not get the forbidden field.</span></div>
  </div>;
}

function LearningBoundary(){
  return <div className="hcr-learning">
    <div><span>Deterministic proof</span><strong>Stops at OBSERVE</strong></div>
    <ChevronRight size={16}/>
    <div><span>Verified Learning</span><strong>Review priority only</strong></div>
    <small>Learning cannot rewrite evidence or gain enforcement authority.</small>
  </div>;
}

function ProofBadge({icon,label,value,tone}:{icon:React.ReactNode;label:string;value:string;tone:"safe"|"warn"|"neutral"}){
  return <div className={"hcr-badge "+tone}><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></div>;
}

function receiverValue(scenario:Scenario,proof:ChallengeProof|null){
  if(scenario.id==="drift"&&proof?.scopePrevention.proven)return "Legitimate fields only";
  if(scenario.id==="shadow")return "Observed only";
  return "Request continues";
}
function shouldValue(scenario:Scenario){
  if(scenario.id==="shadow")return "Unknown";
  if(scenario.id==="flash")return "Same approved job";
  if(scenario.id==="drift")return "Approved scope";
  if(scenario.id==="proportional")return "Expected business purpose";
  return "Approved purpose";
}
function couldValue(scenario:Scenario){
  if(scenario.id==="shadow")return "Partial";
  if(scenario.id==="drift")return "Can reach wider scope";
  return "Known capability";
}
function didValue(scenario:Scenario,proof:ChallengeProof|null){
  if(scenario.id==="drift")return proof?.scopePrevention.proven?"Outside-scope field attempted":"Attempt observed";
  if(scenario.id==="proportional")return proof?.abnormalBehavior.observed?"Purpose correlation failed":"Traffic observed";
  if(scenario.id==="flash")return proof?.busySale.passed?"10× legitimate traffic":"Flash traffic";
  if(scenario.id==="shadow")return "Request observed";
  return "Expected access";
}
function whyValue(scenario:Scenario){
  if(scenario.id==="shadow")return "Unknown";
  if(scenario.id==="flash")return "Flash-sale context";
  if(scenario.id==="drift")return "Customer sync";
  if(scenario.id==="proportional")return "Object mismatch";
  return "Checkout context";
}
function decisionCopy(scenario:Scenario){
  if(scenario.response==="ALLOW")return "Evidence supports normal operation.";
  if(scenario.response==="CONSTRAIN")return scenario.id==="drift"?"Remove only the unjustified field.":"Escalate only the proven mismatch.";
  return "Evidence is incomplete. Do not overreach.";
}
