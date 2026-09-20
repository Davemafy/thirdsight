import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  ChevronDown,
  CircleDot,
  Eye,
  Layers3,
  MoreHorizontal,
  PlugZap,
  Search,
  ShieldCheck,
} from "lucide-react";
import type { ChallengeProof, ExposureRow } from "./IntegrationExposureMap";
import "./IntegrationObjectInterface.css";

type Props={
  exposure:readonly ExposureRow[];
  proof:ChallengeProof|null;
};

export function IntegrationObjectInterface({exposure,proof}:Props){
  const [openKey,setOpenKey]=useState<string|null>(exposure[0]?.key??null);
  const [query,setQuery]=useState("");

  const filtered=useMemo(()=>{
    const needle=query.trim().toLowerCase();
    if(!needle)return exposure;
    return exposure.filter(row=>[
      row.label,
      row.integrationId??"",
      ...row.destinations,
      ...row.approvedFields,
      ...row.attemptedFields,
      ...row.findings,
    ].join(" ").toLowerCase().includes(needle));
  },[exposure,query]);

  const registered=exposure.filter(row=>Boolean(row.integrationId));
  const findings=exposure.filter(row=>row.findings.length>0);
  const unresolved=exposure.filter(row=>!row.integrationId);

  return <div className="io-app">
    <header className="io-topbar">
      <div className="io-brand">
        <span className="io-mark"><ShieldCheck size={17}/></span>
        <div>
          <strong>ThirdSight</strong>
          <small>Commerce Lab</small>
        </div>
      </div>
      <div className="io-top-actions">
        <button aria-label="Connect platform"><PlugZap size={16}/></button>
        <button aria-label="More"><MoreHorizontal size={18}/></button>
      </div>
    </header>

    <main className="io-main">
      <section className="io-intro">
        <div className="io-live"><i/> Live browser surface</div>
        <div className="io-intro-line">
          <h1>{exposure.length} external destinations touch this surface.</h1>
          <p>{findings.length===0
            ?"No deterministic policy violation is proven. Resolve identity and purpose before escalating authority."
            :`${findings.length} deterministic finding${findings.length===1?"":"s"} require review.`}</p>
        </div>
        <div className="io-snapshot" aria-label="Current posture">
          <span><b>{registered.length}</b> purpose-aware</span>
          <span><b>{unresolved.length}</b> unresolved</span>
          <span><b>{findings.length}</b> findings</span>
          <span><b>{proof?.scopePrevention.proven?"yes":"—"}</b> pre-send proof</span>
        </div>
      </section>

      <section className="io-surface">
        <div className="io-surface-head">
          <div>
            <span>Access surface</span>
            <strong>Your platform → third parties</strong>
          </div>
          <label className="io-search">
            <Search size={14}/>
            <input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Find integration"/>
          </label>
        </div>

        <div className="io-root">
          <div className="io-root-node">
            <span><Layers3 size={16}/></span>
            <div><strong>Your platform</strong><small>browser boundary</small></div>
          </div>
          <div className="io-root-meta">
            <span>policy context</span>
            <b>{registered.length>0?"partially connected":"not connected"}</b>
          </div>
        </div>

        <div className="io-spine">
          {filtered.length===0?<div className="io-empty">No destinations match this search.</div>:filtered.slice(0,14).map((row,index)=>
            <IntegrationObject
              key={row.key}
              row={row}
              index={index}
              open={openKey===row.key}
              onToggle={()=>setOpenKey(current=>current===row.key?null:row.key)}
            />
          )}
        </div>

        {filtered.length>14?<button className="io-more-row">
          <span>+{filtered.length-14} more observed destinations</span>
          <ArrowUpRight size={15}/>
        </button>:null}
      </section>

      <section className="io-proofline">
        <div><span>Flash-sale check</span><b>{proof?.busySale.passed?"passed":"not proven"}</b></div>
        <div><span>Abnormal behaviour</span><b>{proof?.abnormalBehavior.observed?"observed":"not observed"}</b></div>
        <div><span>Managed prevention</span><b>{proof?.scopePrevention.proven?"proven":"not proven"}</b></div>
      </section>
    </main>

    <nav className="io-bottom-nav" aria-label="Primary navigation">
      <button data-active><Layers3 size={19}/><span>Surface</span></button>
      <button><PlugZap size={19}/><span>Integrations</span></button>
      <button><Activity size={19}/><span>Activity</span></button>
      <button><AlertTriangle size={19}/><span>Incidents</span></button>
    </nav>
  </div>;
}

function IntegrationObject({
  row,
  index,
  open,
  onToggle,
}:{
  row:ExposureRow;
  index:number;
  open:boolean;
  onToggle:()=>void;
}){
  const finding=row.findings[0]??null;
  const state=finding?"finding":row.integrationId?"known":"unresolved";
  const purpose=row.approvedFields.length>0
    ? joinCompact(row.approvedFields)
    : row.integrationId
      ?"registered · scope not surfaced"
      :"merchant purpose missing";
  const touch=row.attemptedFields.length>0
    ? joinCompact(row.attemptedFields)
    : row.boundaries.length>0
      ? row.boundaries.map(boundary=>boundary.replaceAll("_"," ")).join(" + ")
      :"request metadata observed";
  const response=humanize(row.latestResponse||"OBSERVE");

  return <article className={"io-object "+state+(open?" open":"")}>
    <div className="io-connector" aria-hidden="true">
      <span/>
    </div>

    <button className="io-object-main" onClick={onToggle} aria-expanded={open}>
      <div className="io-object-id">
        <span className={"io-index "+state}>{String(index+1).padStart(2,"0")}</span>
        <div>
          <strong>{row.label}</strong>
          <small>{row.integrationId??"identity unresolved"} · {row.observations} obs.</small>
        </div>
      </div>

      <div className="io-object-grammar">
        <GrammarCell label="Purpose" value={purpose} state={row.approvedFields.length>0||row.integrationId?"known":"unknown"}/>
        <GrammarCell label="Touched" value={touch} state="observed"/>
        <GrammarCell label="Response" value={response} state={state==="finding"?"finding":"neutral"}/>
      </div>

      <span className="io-expand"><ChevronDown size={16}/></span>
    </button>

    {open?<div className="io-object-detail">
      <div className="io-detail-rail">
        <DetailItem
          label="Can reach"
          value={row.canReachFields.length?joinCompact(row.canReachFields):row.reachSource==="OBSERVED_LOWER_BOUND"?"browser-visible lower bound":"not declared"}
        />
        <DetailItem
          label="Actually touched"
          value={row.attemptedFields.length?joinCompact(row.attemptedFields):"browser request metadata"}
        />
        <DetailItem
          label="Approved"
          value={row.approvedFields.length?joinCompact(row.approvedFields):"merchant scope not supplied"}
        />
        <DetailItem
          label="Destination"
          value={row.destinations[0]??"not available"}
        />
      </div>

      <div className="io-detail-footer">
        <span className={"io-state "+state}>
          <CircleDot size={12}/>
          {finding?humanize(finding):row.integrationId?"purpose-aware":"needs identity / purpose"}
        </span>
        <button>Open evidence <ArrowUpRight size={14}/></button>
      </div>
    </div>:null}
  </article>;
}

function GrammarCell({label,value,state}:{label:string;value:string;state:"known"|"unknown"|"observed"|"finding"|"neutral"}){
  return <div className={"io-grammar-cell "+state}>
    <span>{label}</span>
    <b>{value}</b>
  </div>;
}

function DetailItem({label,value}:{label:string;value:string}){
  return <div className="io-detail-item"><span>{label}</span><b>{value}</b></div>;
}

function joinCompact(values:readonly string[]){
  const first=values.slice(0,2).join(", ");
  return values.length>2?`${first} +${values.length-2}`:first;
}

function humanize(value:string){
  return value.split(/[-_]/g).filter(Boolean).map(part=>part.charAt(0).toUpperCase()+part.slice(1).toLowerCase()).join(" ");
}
