import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleHelp,
  Eye,
  MoreHorizontal,
  PlugZap,
  ShieldCheck,
  X,
} from "lucide-react";
import type { ChallengeProof, ExposureRow } from "./IntegrationExposureMap";
import "./OverviewTierOneLab.css";

type Props={
  exposure:readonly ExposureRow[];
  proof:ChallengeProof|null;
};

export function OverviewTierOneLab({exposure,proof}:Props){
  const [selected,setSelected]=useState<ExposureRow|null>(null);
  const [filter,setFilter]=useState<"all"|"unresolved"|"findings">("all");

  const unresolved=exposure.filter(row=>!row.integrationId);
  const findings=exposure.filter(row=>row.findings.length>0);
  const registered=exposure.filter(row=>Boolean(row.integrationId));

  const rows=useMemo(()=>{
    if(filter==="unresolved") return unresolved;
    if(filter==="findings") return findings;
    return [...findings,...unresolved.filter(row=>row.findings.length===0),...registered.filter(row=>row.findings.length===0)];
  },[filter,findings,unresolved,registered]);

  return <div className="dossier-app">
    <header className="dossier-header">
      <div className="dossier-brand">
        <span><ShieldCheck size={17}/></span>
        <div><strong>ThirdSight</strong><small>Third-party evidence</small></div>
      </div>
      <div className="dossier-header-actions">
        <button aria-label="Connect platform"><PlugZap size={16}/></button>
        <button aria-label="More"><MoreHorizontal size={18}/></button>
      </div>
    </header>

    <main className="dossier-main">
      <section className="dossier-status">
        <div>
          <span className="dossier-live"><i/> Discovery active · Commerce Lab</span>
          <h1>{findings.length>0
            ? `${findings.length} evidence-backed finding${findings.length===1?"":"s"}`
            : "No policy violation is proven."}</h1>
          <p>{exposure.length} third-party destinations observed. {unresolved.length} still need identity or merchant-purpose context.</p>
        </div>
        <button className="dossier-connect">Connect purpose source <ArrowUpRight size={14}/></button>
      </section>

      <section className="dossier-watchlist">
        <div className="dossier-section-head">
          <div>
            <span>WATCHLIST</span>
            <h2>Every third party, ordered by what needs proof.</h2>
          </div>
          <small>{exposure.length} observed</small>
        </div>

        <div className="dossier-filters" role="tablist" aria-label="Watchlist filters">
          <button data-active={filter==="all"?"":undefined} onClick={()=>setFilter("all")}>All <b>{exposure.length}</b></button>
          <button data-active={filter==="unresolved"?"":undefined} onClick={()=>setFilter("unresolved")}>Unresolved <b>{unresolved.length}</b></button>
          <button data-active={filter==="findings"?"":undefined} onClick={()=>setFilter("findings")}>Findings <b>{findings.length}</b></button>
        </div>

        <div className="dossier-list">
          {rows.map(row=><WatchRow key={row.key} row={row} onOpen={()=>setSelected(row)}/>)}
          {rows.length===0?<div className="dossier-empty"><Check size={16}/><span>No item matches this filter.</span></div>:null}
        </div>
      </section>

      <section className="dossier-proof-note">
        <div><ShieldCheck size={16}/><strong>Proof boundary</strong></div>
        <p>Unknown is a product state, not a guess. ThirdSight separates approved purpose, technical reach, observed access and business context before it escalates.</p>
      </section>

      <section className="dossier-lab-proof">
        <div>
          <span>10× sale</span>
          <strong>{proof?.busySale.passed?"Allowed without false alarm":"Awaiting proof"}</strong>
        </div>
        <div>
          <span>Scope control</span>
          <strong>{proof?.scopePrevention.proven?"Prevented before send":"No persisted proof"}</strong>
        </div>
      </section>
    </main>

    <nav className="dossier-nav" aria-label="Primary">
      <button data-active><Eye size={19}/><span>Watchlist</span></button>
      <button><PlugZap size={19}/><span>Integrations</span></button>
      <button><Activity size={19}/><span>Activity</span></button>
      <button><AlertTriangle size={19}/><span>Incidents</span></button>
    </nav>

    {selected?<DossierSheet row={selected} onClose={()=>setSelected(null)}/>:null}
  </div>;
}

function WatchRow({row,onOpen}:{row:ExposureRow;onOpen:()=>void}){
  const finding=row.findings[0]??null;
  const unresolved=!row.integrationId;
  const state=finding?"finding":unresolved?"unresolved":"known";

  return <button className="watch-row" onClick={onOpen}>
    <div className={"watch-marker "+state}>
      {finding?<AlertTriangle size={14}/>:unresolved?<CircleHelp size={14}/>:<Check size={14}/>}
    </div>

    <div className="watch-copy">
      <div className="watch-title">
        <strong>{row.label}</strong>
        <span className={"watch-state "+state}>{finding?humanize(finding):unresolved?"Purpose unresolved":"Purpose-aware"}</span>
      </div>
      <div className="watch-meta">
        <span>{row.observations} observation{row.observations===1?"":"s"}</span>
        <i/>
        <span>{lastSeen(row.lastSeen)}</span>
      </div>
    </div>

    <EvidenceMini row={row}/>
    <ChevronRight size={16}/>
  </button>;
}

function EvidenceMini({row}:{row:ExposureRow}){
  const should=row.approvedFields.length>0?"known":"unknown";
  const could=row.canReachFields.length>0||row.reachSource==="OBSERVED_LOWER_BOUND"?"partial":"unknown";
  const did=row.attemptedFields.length>0||row.receivedFields.length>0||row.boundaries.length>0?"known":"unknown";
  const why="unknown";
  return <div className="evidence-mini" aria-label="Evidence completeness">
    <span data-state={should}>S</span>
    <span data-state={could}>C</span>
    <span data-state={did}>D</span>
    <span data-state={why}>W</span>
  </div>;
}

function DossierSheet({row,onClose}:{row:ExposureRow;onClose:()=>void}){
  const finding=row.findings[0]??null;
  const shouldText=row.approvedFields.length
    ? `Approved data: ${row.approvedFields.join(", ")}`
    : "Merchant-approved purpose was not supplied.";
  const couldText=row.canReachFields.length
    ? `Technical reach includes ${row.canReachFields.join(", ")}.`
    : row.reachSource==="OBSERVED_LOWER_BOUND"
      ? "Browser evidence proves only a lower bound of technical reach."
      : "Technical reach is not declared.";
  const didText=row.attemptedFields.length
    ? `Observed attempt: ${row.attemptedFields.join(", ")}.`
    : row.receivedFields.length
      ? `Receiver observed: ${row.receivedFields.join(", ")}.`
      : row.boundaries.length
        ? `Observed at ${row.boundaries.join(", ")} boundary.`
        : "No field-level access is present in this representative record.";
  const whyText="Business justification is not attached to this third-party observation.";

  return <div className="dossier-layer">
    <button className="dossier-backdrop" aria-label="Close dossier" onClick={onClose}/>
    <aside className="dossier-sheet" aria-label={`${row.label} evidence dossier`}>
      <div className="sheet-handle"/>
      <div className="sheet-head">
        <div>
          <span className="sheet-kicker">THIRD-PARTY DOSSIER</span>
          <h2>{row.label}</h2>
          <p>{row.integrationId??"Identity unresolved"} · {row.observations} observation{row.observations===1?"":"s"}</p>
        </div>
        <button onClick={onClose} aria-label="Close"><X size={18}/></button>
      </div>

      <div className="sheet-verdict">
        <span>{finding?"Needs deterministic review":row.integrationId?"Purpose-aware integration":"Purpose not yet established"}</span>
        <strong>{row.latestResponse||"OBSERVE"}</strong>
      </div>

      <div className="evidence-spine">
        <EvidenceStep code="SHOULD" label="Approved purpose" state={row.approvedFields.length?"known":"unknown"} text={shouldText}/>
        <EvidenceStep code="COULD" label="Technical reach" state={row.canReachFields.length?"known":row.reachSource==="OBSERVED_LOWER_BOUND"?"partial":"unknown"} text={couldText}/>
        <EvidenceStep code="DID" label="Observed access" state={row.attemptedFields.length||row.receivedFields.length||row.boundaries.length?"known":"unknown"} text={didText}/>
        <EvidenceStep code="WHY" label="Business context" state="unknown" text={whyText}/>
      </div>

      <div className="sheet-gap">
        <span>Evidence gap</span>
        <p>{finding
          ? `ThirdSight found ${humanize(finding)} from deterministic evidence.`
          : !row.integrationId
            ? "Runtime activity exists, but identity and merchant-approved purpose are missing. ThirdSight keeps this unresolved instead of inventing intent."
            : "The integration is recognized, but business context remains separate from runtime evidence."}</p>
      </div>

      <button className="sheet-action">Open full evidence <ArrowUpRight size={14}/></button>
    </aside>
  </div>;
}

function EvidenceStep({code,label,state,text}:{code:string;label:string;state:"known"|"partial"|"unknown";text:string}){
  return <div className="evidence-step">
    <div className="evidence-step-rail">
      <span data-state={state}/>
      <i/>
    </div>
    <div className="evidence-step-copy">
      <div><b>{code}</b><span>{label}</span><em data-state={state}>{state}</em></div>
      <p>{text}</p>
    </div>
  </div>;
}

function humanize(value:string){
  return value.split(/[-_]/g).filter(Boolean).map(part=>part.charAt(0).toUpperCase()+part.slice(1).toLowerCase()).join(" ");
}

function lastSeen(value:string){
  if(!value)return "no timestamp";
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return "recently";
  return date.toLocaleString(undefined,{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});
}
