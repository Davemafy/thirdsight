import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, AlertTriangle, Ban, CheckCircle2, ChevronRight, CircleDot, Database, Eye, Gauge, LockKeyhole, Radio, ShieldCheck, ShoppingCart, Truck, UserRoundCheck, Webhook } from 'lucide-react';
import './styles.css';

type IntegrationKey = 'paystack' | 'identity' | 'delivery' | 'messaging' | 'analytics';
type Severity = 'normal' | 'observe' | 'limit' | 'quarantine';
type Scenario = 'normal' | 'sales_spike' | 'scope_drift' | 'record_spike' | 'behavior_change';

type EventRow = {
  id: number;
  time: string;
  integration: IntegrationKey;
  action: string;
  data: string[];
  records: number;
  allowed: boolean;
  severity: Severity;
  reason: string;
};

const integrations: Record<IntegrationKey, {label:string; icon:React.ReactNode; baseline:string[]; limit:number}> = {
  paystack: { label:'Payments', icon:<ShoppingCart size={18}/>, baseline:['order_id','amount','email'], limit:120 },
  identity: { label:'Identity', icon:<UserRoundCheck size={18}/>, baseline:['name','email','kyc_status'], limit:80 },
  delivery: { label:'Delivery', icon:<Truck size={18}/>, baseline:['name','phone','delivery_address','order_id'], limit:150 },
  messaging: { label:'Messaging', icon:<Webhook size={18}/>, baseline:['name','phone','order_status'], limit:180 },
  analytics: { label:'Analytics', icon:<Gauge size={18}/>, baseline:['order_id','product_id','amount','timestamp'], limit:320 }
};

const scenarioCopy: Record<Scenario, {title:string; sub:string}> = {
  normal:{title:'Normal traffic',sub:'Expected access patterns within declared scopes.'},
  sales_spike:{title:'Legitimate sales spike',sub:'Volume rises sharply, but access shape and data types remain expected.'},
  scope_drift:{title:'New data type accessed',sub:'Analytics begins touching phone numbers it never declared.'},
  record_spike:{title:'Excessive record access',sub:'Messaging suddenly pulls far more customer records than its baseline allows.'},
  behavior_change:{title:'Behavior changed',sub:'Delivery starts repeatedly enumerating customer profiles without an order trigger.'}
};

function now(){ return new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'}); }

function makeEvent(id:number, scenario:Scenario): EventRow {
  const keys = Object.keys(integrations) as IntegrationKey[];
  let integration = keys[id % keys.length];
  let action = 'read';
  let data = [...integrations[integration].baseline];
  let records = 20 + ((id * 13) % 70);
  let severity: Severity = 'normal';
  let reason = 'Within declared scope and historical baseline.';
  let allowed = true;

  if (scenario === 'sales_spike') {
    integration = (['paystack','analytics','delivery'] as IntegrationKey[])[id % 3];
    data = [...integrations[integration].baseline];
    records = Math.floor(integrations[integration].limit * 1.6);
    severity = 'observe';
    reason = 'High volume accepted: same data shape, matching campaign-wide sales surge.';
  }
  if (scenario === 'scope_drift') {
    integration = 'analytics';
    data = ['order_id','product_id','amount','timestamp','phone'];
    records = 72;
    severity = 'limit';
    reason = 'New undeclared data type detected: phone.';
  }
  if (scenario === 'record_spike') {
    integration = 'messaging';
    data = [...integrations[integration].baseline];
    records = 640;
    severity = 'quarantine';
    allowed = false;
    reason = 'Record access exceeded dynamic baseline without correlated business event.';
  }
  if (scenario === 'behavior_change') {
    integration = 'delivery';
    action = 'enumerate_profiles';
    data = ['name','phone','delivery_address'];
    records = 210;
    severity = 'limit';
    reason = 'Access sequence changed: profile enumeration not tied to active orders.';
  }

  return { id, time: now(), integration, action, data, records, allowed, severity, reason };
}

const severityMeta: Record<Severity,{label:string; icon:React.ReactNode}> = {
  normal:{label:'Allow',icon:<CheckCircle2 size={15}/>},
  observe:{label:'Observe',icon:<Eye size={15}/>},
  limit:{label:'Limit',icon:<AlertTriangle size={15}/>},
  quarantine:{label:'Quarantine',icon:<Ban size={15}/>}
};

function App(){
  const [scenario,setScenario] = useState<Scenario>('normal');
  const [events,setEvents] = useState<EventRow[]>(()=>Array.from({length:7},(_,i)=>makeEvent(i,'normal')).reverse());
  const [tick,setTick] = useState(8);

  useEffect(()=>{
    const t = setInterval(()=>{
      setEvents(prev => [makeEvent(tick, scenario), ...prev].slice(0,9));
      setTick(v=>v+1);
    }, 1500);
    return ()=>clearInterval(t);
  },[scenario,tick]);

  const current = events[0];
  const riskCount = events.filter(e=>e.severity==='limit'||e.severity==='quarantine').length;
  const touched = useMemo(()=>new Set(current?.data ?? []),[current]);

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brandmark"><ShieldCheck size={20}/></div><div><strong>ThirdSight</strong><span>Track G prototype</span></div></div>
      <div className="side-label">Live system</div>
      <nav>
        <button className="nav-active"><Activity size={17}/>Activity map</button>
        <button><Database size={17}/>Data access</button>
        <button><LockKeyhole size={17}/>Policies</button>
      </nav>
      <div className="side-card">
        <span className="eyebrow">Protection model</span>
        <strong>Graded response</strong>
        <p>Allow → Observe → Limit → Quarantine. No binary kill switch.</p>
      </div>
    </aside>

    <main>
      <header>
        <div><span className="eyebrow">Commerce & Consumer Protection</span><h1>Third-party integration control plane</h1><p>See exactly what each integration touches, detect unexpected behavior in real time, and respond proportionally.</p></div>
        <div className="live"><Radio size={15}/>LIVE</div>
      </header>

      <section className="scenario-bar">
        <div><span className="eyebrow">Demo scenario</span><strong>{scenarioCopy[scenario].title}</strong><small>{scenarioCopy[scenario].sub}</small></div>
        <select value={scenario} onChange={e=>{const s=e.target.value as Scenario; setScenario(s); setEvents([makeEvent(tick,s),...events].slice(0,9));}}>
          <option value="normal">Normal traffic</option>
          <option value="sales_spike">Legitimate sales spike</option>
          <option value="scope_drift">New data type</option>
          <option value="record_spike">Excessive records</option>
          <option value="behavior_change">Behavior change</option>
        </select>
      </section>

      <section className="stats">
        <div className="stat"><span>Integrations watched</span><strong>5</strong><small>payments · identity · delivery · messaging · analytics</small></div>
        <div className="stat"><span>Events / minute</span><strong>{scenario==='sales_spike'?'1,284':'486'}</strong><small>{scenario==='sales_spike'?'+164% correlated with sales':'within current baseline'}</small></div>
        <div className="stat"><span>Active risk signals</span><strong>{riskCount}</strong><small>{riskCount ? 'requires proportional control' : 'no intervention needed'}</small></div>
      </section>

      <section className="grid two">
        <div className="panel map-panel">
          <div className="panel-head"><div><span className="eyebrow">Live access map</span><h2>Who can touch what?</h2></div><div className="pulse-dot"/></div>
          <div className="map">
            <div className="store-node"><div className="store-icon"><Database size={22}/></div><strong>Customer data vault</strong><span>simulated commerce platform</span></div>
            <div className="integration-list">
              {(Object.keys(integrations) as IntegrationKey[]).map(k=>{
                const item=integrations[k]; const active=current?.integration===k;
                return <div className={`integration ${active?'active':''}`} key={k}>
                  <div className="int-icon">{item.icon}</div><div className="int-meta"><strong>{item.label}</strong><span>{item.baseline.length} declared fields</span></div>
                  <ChevronRight size={15}/>
                </div>
              })}
            </div>
            <div className="data-fields">
              {['name','email','phone','delivery_address','order_id','amount','product_id','timestamp','kyc_status'].map(field=><div key={field} className={touched.has(field)?'touched':''}><CircleDot size={12}/>{field}</div>)}
            </div>
          </div>
        </div>

        <div className="panel decision-panel">
          <div className="panel-head"><div><span className="eyebrow">Decision engine</span><h2>Current verdict</h2></div>{current && <span className={`badge ${current.severity}`}>{severityMeta[current.severity].icon}{severityMeta[current.severity].label}</span>}</div>
          {current && <>
            <div className="verdict-card">
              <div className="verdict-row"><span>Integration</span><strong>{integrations[current.integration].label}</strong></div>
              <div className="verdict-row"><span>Operation</span><strong>{current.action}</strong></div>
              <div className="verdict-row"><span>Records touched</span><strong>{current.records}</strong></div>
              <div className="verdict-row"><span>Data types</span><strong>{current.data.length}</strong></div>
            </div>
            <div className="reason"><span className="eyebrow">Why</span><p>{current.reason}</p></div>
            <div className="ladder">
              {(['normal','observe','limit','quarantine'] as Severity[]).map((s,i)=><div key={s} className={current.severity===s?'selected':''}><span>{i+1}</span><strong>{severityMeta[s].label}</strong></div>)}
            </div>
          </>}
        </div>
      </section>

      <section className="panel feed-panel">
        <div className="panel-head"><div><span className="eyebrow">Realtime evidence</span><h2>Integration activity stream</h2></div><span className="muted">simulated · no real personal data</span></div>
        <div className="table">
          <div className="tr th"><span>Time</span><span>Integration</span><span>Action</span><span>Data</span><span>Records</span><span>Response</span></div>
          {events.map(e=><div className="tr" key={`${e.id}-${e.time}`}><span>{e.time}</span><span>{integrations[e.integration].label}</span><span>{e.action}</span><span className="chips">{e.data.slice(0,3).map(d=><i key={d}>{d}</i>)}{e.data.length>3&&<i>+{e.data.length-3}</i>}</span><span>{e.records}</span><span><b className={`badge ${e.severity}`}>{severityMeta[e.severity].icon}{severityMeta[e.severity].label}</b></span></div>)}
        </div>
      </section>
    </main>
  </div>
}

createRoot(document.getElementById('root')!).render(<App/>);
