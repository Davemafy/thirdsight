import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  CircleHelp,
  Menu,
  MoreHorizontal,
  PlugZap,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { ChallengeProof, ExposureRow } from "./IntegrationExposureMap";
import "./CloudflareWorkbench.css";

type Props={
  exposure:readonly ExposureRow[];
  proof:ChallengeProof|null;
};

type Filter="review"|"all"|"approved"|"restricted";

export function CloudflareWorkbench({exposure,proof}:Props){
  const [query,setQuery]=useState("");
  const [filter,setFilter]=useState<Filter>("review");
  const [selected,setSelected]=useState<ExposureRow|null>(null);
  const [menuOpen,setMenuOpen]=useState(false);

  const rows=useMemo(()=>{
    const needle=query.trim().toLowerCase();
    return exposure
      .filter(row=>{
        if(filter==="review") return row.findings.length>0||!row.integrationId;
        if(filter==="approved") return Boolean(row.integrationId)&&row.findings.length===0;
        if(filter==="restricted") return row.findings.length>0||["CONSTRAIN","ISOLATE","PREVENTED","DETECTED"].includes(row.latestResponse);
        return true;
      })
      .filter(row=>{
        if(!needle)return true;
        return [
          row.label,row.integrationId??"",...row.destinations,...row.approvedFields,
          ...row.attemptedFields,...row.findings,row.latestResponse,
        ].join(" ").toLowerCase().includes(needle);
      });
  },[exposure,filter,query]);

  if(selected){
    return <IntegrationDetail
      row={selected}
      proof={proof}
      onBack={()=>setSelected(null)}
      onMenu={()=>setMenuOpen(true)}
      menuOpen={menuOpen}
      onCloseMenu={()=>setMenuOpen(false)}
    />;
  }

  const reviewCount=exposure.filter(row=>row.findings.length>0||!row.integrationId).length;
  const approvedCount=exposure.filter(row=>Boolean(row.integrationId)&&row.findings.length===0).length;
  const restrictedCount=exposure.filter(row=>row.findings.length>0||["CONSTRAIN","ISOLATE","PREVENTED","DETECTED"].includes(row.latestResponse)).length;

  return <div className="cfw-app">
    <Topbar onMenu={()=>setMenuOpen(true)}/>
    <Drawer open={menuOpen} onClose={()=>setMenuOpen(false)}/>

    <main className="cfw-home">
      <section className="cfw-heading">
        <span className="cfw-live"><i/> Evidence live</span>
        <h1>What needs attention?</h1>
      </section>

      <label className="cfw-search">
        <Search size={20}/>
        <input
          value={query}
          onChange={event=>setQuery(event.target.value)}
          placeholder="Search integrations, fields or destinations"
        />
      </label>

      <div className="cfw-filters" role="tablist" aria-label="Integration filters">
        <FilterButton label="Needs review" count={reviewCount} active={filter==="review"} onClick={()=>setFilter("review")}/>
        <FilterButton label="Approved" count={approvedCount} active={filter==="approved"} onClick={()=>setFilter("approved")}/>
        <FilterButton label="Restricted" count={restrictedCount} active={filter==="restricted"} onClick={()=>setFilter("restricted")}/>
        <FilterButton label="All" count={exposure.length} active={filter==="all"} onClick={()=>setFilter("all")}/>
      </div>

      <section className="cfw-list-section">
        <div className="cfw-section-label">
          <span>{filter==="review"?"Needs review":filter==="approved"?"Approved":filter==="restricted"?"Restricted":"All integrations"}</span>
          <b>{rows.length}</b>
        </div>

        <div className="cfw-list">
          {rows.map(row=><IntegrationListItem key={row.key} row={row} onClick={()=>setSelected(row)}/>)}
          {rows.length===0?<div className="cfw-empty"><Check size={18}/><span>No integrations match this view.</span></div>:null}
        </div>
      </section>

      <button className="cfw-secondary-action">
        <PlugZap size={17}/>
        <div><strong>Connect a platform</strong><span>Add merchant purpose and managed enforcement context</span></div>
        <ChevronRight size={17}/>
      </button>
    </main>
  </div>;
}

function Topbar({onMenu}:{onMenu:()=>void}){
  return <header className="cfw-topbar">
    <button onClick={onMenu} aria-label="Open navigation"><Menu size={21}/></button>
    <div className="cfw-wordmark"><span><ShieldCheck size={16}/></span><strong>ThirdSight</strong></div>
    <div className="cfw-top-actions">
      <button aria-label="Help"><CircleHelp size={19}/></button>
      <button aria-label="More"><MoreHorizontal size={20}/></button>
    </div>
  </header>;
}

function Drawer({open,onClose}:{open:boolean;onClose:()=>void}){
  if(!open)return null;
  return <div className="cfw-drawer-layer">
    <button className="cfw-drawer-backdrop" aria-label="Close navigation" onClick={onClose}/>
    <aside className="cfw-drawer">
      <div className="cfw-drawer-head">
        <div className="cfw-wordmark"><span><ShieldCheck size={16}/></span><strong>ThirdSight</strong></div>
        <button onClick={onClose} aria-label="Close navigation"><X size={20}/></button>
      </div>

      <nav>
        <NavGroup label="Observe" items={["Integrations","Activity"]}/>
        <NavGroup label="Protect" items={["Findings","Enforcement"]}/>
        <NavGroup label="Define" items={["Approved purposes","Connections"]}/>
        <div className="cfw-nav-rule"/>
        <NavGroup items={["Validation","Settings"]}/>
      </nav>
    </aside>
  </div>;
}

function NavGroup({label,items}:{label?:string;items:readonly string[]}){
  return <div className="cfw-nav-group">
    {label?<span>{label}</span>:null}
    {items.map(item=><button key={item}>{item}<ChevronRight size={16}/></button>)}
  </div>;
}

function FilterButton({label,count,active,onClick}:{label:string;count:number;active:boolean;onClick:()=>void}){
  return <button className={active?"active":""} onClick={onClick} role="tab" aria-selected={active}>
    {label}<span>{count}</span>
  </button>;
}

function IntegrationListItem({row,onClick}:{row:ExposureRow;onClick:()=>void}){
  const state=getState(row);
  return <button className="cfw-row" onClick={onClick}>
    <span className={"cfw-row-mark "+state.kind}>{state.icon}</span>
    <div className="cfw-row-copy">
      <strong>{row.label}</strong>
      <span>{state.summary}</span>
      <small>{row.lastSeen?timeAgo(row.lastSeen):"No timestamp"} · {row.observations} observation{row.observations===1?"":"s"}</small>
    </div>
    <div className="cfw-row-state">
      <span className={state.kind}>{state.label}</span>
      <ChevronRight size={17}/>
    </div>
  </button>;
}

function IntegrationDetail({
  row,proof,onBack,onMenu,menuOpen,onCloseMenu,
}:{
  row:ExposureRow;
  proof:ChallengeProof|null;
  onBack:()=>void;
  onMenu:()=>void;
  menuOpen:boolean;
  onCloseMenu:()=>void;
}){
  const state=getState(row);
  const approved=row.approvedFields;
  const observed=row.attemptedFields;
  const unmatched=observed.filter(field=>!approved.includes(field));

  return <div className="cfw-app">
    <header className="cfw-detail-topbar">
      <button onClick={onBack} aria-label="Back to integrations"><ArrowLeft size={21}/></button>
      <strong>Integration</strong>
      <button onClick={onMenu} aria-label="Open navigation"><Menu size={21}/></button>
    </header>
    <Drawer open={menuOpen} onClose={onCloseMenu}/>

    <main className="cfw-detail">
      <section className="cfw-detail-title">
        <div className="cfw-detail-kicker">
          <span className={"cfw-dot "+state.kind}/>
          <span>{state.label}</span>
        </div>
        <h1>{row.label}</h1>
        <p>{row.integrationId?"Registered integration":"Identity unresolved"} · {row.observations} observations</p>
      </section>

      <section className="cfw-callout">
        <strong>{state.headline}</strong>
        <p>{state.detail}</p>
        {state.kind==="review"?<button>Define approved purpose <ArrowRight size={14}/></button>:null}
      </section>

      <section className="cfw-compare">
        <Column title="Expected" source="Vendor documentation" empty="Vendor profile not connected" values={[]}/>
        <Column title="Approved" source="Merchant policy" empty="Not supplied" values={approved}/>
        <Column title="Observed" source="Runtime sensor" empty="No field-level access observed" values={observed}/>
      </section>

      <section className="cfw-diff">
        <div className="cfw-subhead">
          <div><span>Scope diff</span><strong>Approved ↔ observed</strong></div>
          <small>{unmatched.length>0?unmatched.length+" outside approved scope":"No field mismatch proven"}</small>
        </div>

        <div className="cfw-diff-table">
          <div className="cfw-diff-head"><span>Approved</span><span>Observed</span><span/></div>
          {buildDiffRows(approved,observed).map((item,index)=><div className={"cfw-diff-row "+item.state} key={index}>
            <span>{item.approved||"—"}</span>
            <span>{item.observed||"—"}</span>
            <b>{item.state==="match"?"✓":item.state==="outside"?"Outside scope":"?"}</b>
          </div>)}
          {approved.length===0&&observed.length===0?<div className="cfw-diff-empty">No field-level diff is available from current evidence.</div>:null}
        </div>
      </section>

      <section className="cfw-evidence">
        <div className="cfw-subhead"><div><span>Evidence</span><strong>Why ThirdSight says this</strong></div></div>
        <EvidenceRow label="Identity" value={row.integrationId??"Unresolved"} source={row.integrationId?"Merchant / runtime":"Runtime only"}/>
        <EvidenceRow label="Capability" value={row.canReachFields.length?compact(row.canReachFields):row.reachSource==="OBSERVED_LOWER_BOUND"?"Browser-visible lower bound":"Unknown"} source={row.reachSource.replaceAll("_"," ").toLowerCase()}/>
        <EvidenceRow label="Observed destination" value={row.destinations[0]??"Not available"} source="Runtime sensor"/>
        <EvidenceRow label="Response" value={humanize(row.latestResponse)} source={row.findings.length?"Deterministic verifier":"Current evidence"}/>
      </section>

      <section className="cfw-actions">
        <span>Response</span>
        <div>
          <button className="active">Observe</button>
          <button disabled={row.findings.length===0}>Constrain</button>
          <button disabled={row.findings.length===0}>Isolate</button>
        </div>
        <small>Higher authority stays unavailable until deterministic evidence justifies it.</small>
      </section>

      <section className="cfw-validation-note">
        <SlidersHorizontal size={16}/>
        <div>
          <strong>Evidence boundary</strong>
          <span>{proof?.busySale.passed?"Busy-sale false-positive check passed. ":""}Unknown remains unknown; browser discovery does not infer merchant purpose.</span>
        </div>
      </section>
    </main>
  </div>;
}

function Column({title,source,values,empty}:{title:string;source:string;values:readonly string[];empty:string}){
  return <div className="cfw-column">
    <span>{title}</span>
    <strong>{values.length?compact(values):empty}</strong>
    <small>{source}</small>
  </div>;
}

function EvidenceRow({label,value,source}:{label:string;value:string;source:string}){
  return <div className="cfw-evidence-row">
    <span>{label}</span>
    <div><strong>{value}</strong><small>{source}</small></div>
    <ChevronRight size={16}/>
  </div>;
}

function buildDiffRows(approved:readonly string[],observed:readonly string[]){
  const values=[...new Set([...approved,...observed])];
  return values.map(value=>{
    const a=approved.includes(value);
    const o=observed.includes(value);
    return {
      approved:a?value:"",
      observed:o?value:"",
      state:a&&o?"match":o&&!a?"outside":"missing",
    };
  });
}

function getState(row:ExposureRow){
  if(row.findings.length>0){
    return {
      kind:"finding",
      icon:<AlertTriangle size={15}/>,
      label:"Finding",
      summary:humanize(row.findings[0]??"Deterministic finding"),
      headline:"Observed behaviour conflicts with available policy evidence.",
      detail:"ThirdSight has deterministic evidence attached to this integration. Open the evidence before changing enforcement.",
    };
  }
  if(!row.integrationId){
    return {
      kind:"review",
      icon:<PlugZap size={15}/>,
      label:"Needs review",
      summary:"Identity or merchant-approved purpose is missing",
      headline:"ThirdSight can see the integration, but cannot prove what it was approved to do.",
      detail:"Add merchant purpose before treating normal-looking access as a policy violation.",
    };
  }
  return {
    kind:"ok",
    icon:<Check size={15}/>,
    label:"Approved",
    summary:"No deterministic mismatch is currently proven",
    headline:"No deterministic policy violation is proven.",
    detail:"Observed behaviour remains within the evidence currently available to ThirdSight.",
  };
}

function compact(values:readonly string[]){
  const first=values.slice(0,3).join(", ");
  return values.length>3?first+" +"+(values.length-3):first;
}

function humanize(value:string){
  return value.split(/[-_]/g).filter(Boolean).map(part=>part.charAt(0).toUpperCase()+part.slice(1).toLowerCase()).join(" ");
}

function timeAgo(value:string){
  const time=new Date(value).getTime();
  if(!Number.isFinite(time))return "Recently";
  const seconds=Math.max(0,Math.floor((Date.now()-time)/1000));
  if(seconds<60)return seconds+"s ago";
  if(seconds<3600)return Math.floor(seconds/60)+"m ago";
  if(seconds<86400)return Math.floor(seconds/3600)+"h ago";
  return Math.floor(seconds/86400)+"d ago";
}
