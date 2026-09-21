import { useMemo, useState } from "react";
import { Clipboard, KeyRound, Play, ShieldCheck } from "lucide-react";
import "./SelfServeOnboarding.css";

type PresetId="cedar-analytics"|"cedar-delivery";

interface ProvisionResult {
  workspace:{merchantId:string;name:string;slug:string};
  integration:{integrationId:PresetId;purposeContract:{purpose:string;fields:readonly string[]}};
  apiKey:{value:string;keyId:string;prefix:string;lastFour:string};
}

interface ManagedResult {
  decision:string;
  evidence:string;
  requestId:string;
  evidenceId:string;
  status:number;
  body:unknown;
  receivedFields:readonly string[];
  customerPhoneReceived:boolean|null;
}

const PRESETS={
  "cedar-analytics":{
    label:"CEDAR Analytics",
    purpose:"Measure product and purchase analytics",
    fields:["order.id","order.value","product.id","product.category","product.price"],
    path:"/ingest/managed/analytics",
    event:"checkout.completed",
    expected:"CONSTRAIN",
  },
  "cedar-delivery":{
    label:"CEDAR Delivery",
    purpose:"Fulfil the confirmed customer order",
    fields:["order.id","customer.phone","delivery.address","delivery.city","delivery.state","items[].sku","items[].quantity"],
    path:"/ingest/managed/delivery",
    event:"order.ready_for_fulfilment",
    expected:"ALLOW",
  },
} as const;

const INSTALL_COMMAND="npm install https://raw.githubusercontent.com/Davemafy/thirdsight/main/packages/thirdsight-node/thirdsight-node-0.1.0.tgz";

export function SelfServeOnboarding(){
  const [workspaceName,setWorkspaceName]=useState("Recording Merchant");
  const [workspaceSlug,setWorkspaceSlug]=useState("recording-merchant");
  const [presetId,setPresetId]=useState<PresetId>("cedar-analytics");
  const [approved,setApproved]=useState(false);
  const [operatorKey,setOperatorKey]=useState("");
  const [provisioned,setProvisioned]=useState<ProvisionResult|null>(null);
  const [managed,setManaged]=useState<ManagedResult|null>(null);
  const [busy,setBusy]=useState<"provision"|"test"|null>(null);
  const [error,setError]=useState("");

  const preset=PRESETS[presetId];
  const canProvision=approved&&workspaceName.trim().length>=2&&workspaceSlug.trim().length>=3&&operatorKey.trim().length>=16&&!busy;
  const maskedKey=provisioned?`${provisioned.apiKey.prefix}••••••••${provisioned.apiKey.lastFour}`:"";
  const receipt=useMemo(()=>managed?.body&&typeof managed.body==="object"?managed.body as Record<string,unknown>:null,[managed]);

  async function provision(){
    setBusy("provision"); setError(""); setManaged(null);
    try{
      const response=await fetch("/api/control-plane",{
        method:"POST",
        headers:{"content-type":"application/json",authorization:`Bearer ${operatorKey.trim()}`},
        body:JSON.stringify({workspaceName:workspaceName.trim(),workspaceSlug:workspaceSlug.trim(),presetId}),
      });
      const body=await response.json().catch(()=>null) as ProvisionResult|{message?:string;error?:string}|null;
      if(!response.ok||!body||!("apiKey" in body)) throw new Error((body&&"message" in body&&body.message)||"Provisioning failed.");
      setProvisioned(body);
      setOperatorKey("");
    }catch(caught){setError(caught instanceof Error?caught.message:"Provisioning failed.");}
    finally{setBusy(null);}
  }

  async function runManagedTest(){
    if(!provisioned) return;
    setBusy("test"); setError(""); setManaged(null);
    try{
      const payload=presetId==="cedar-analytics"
        ?{order:{id:"order-demo-2048",value:54000},product:{id:"chair-01",category:"furniture",price:54000},customer:{phone:"+2348000000000"}}
        :{order:{id:"order-demo-2048"},customer:{phone:"+2348000000000"},delivery:{address:"12 Demo Street",city:"Abuja",state:"FCT"},items:[{sku:"chair-01",quantity:1}]};
      const context={businessEvent:{id:`self-serve-${presetId}-${Date.now()}`,type:preset.event}};
      const url=new URL("/api/managed-gateway",window.location.origin);
      url.searchParams.set("integration",presetId);
      url.searchParams.set("environment","synthetic-demo");
      url.searchParams.set("path",preset.path);
      const response=await fetch(url,{
        method:"POST",
        headers:{
          "content-type":"application/json",
          authorization:`Bearer ${provisioned.apiKey.value}`,
          "x-thirdsight-context":JSON.stringify(context),
        },
        body:JSON.stringify(payload),
        redirect:"manual",
      });
      const text=await response.text();
      let body:unknown=text;
      try{body=text?JSON.parse(text):null}catch{/* keep bounded upstream text */}
      const objectBody=body&&typeof body==="object"&&!Array.isArray(body)?body as Record<string,unknown>:null;
      const receivedFields=Array.isArray(objectBody?.receivedFields)?objectBody.receivedFields.filter((value):value is string=>typeof value==="string"):[];
      const customerPhoneReceived=receivedFields.length>0?receivedFields.includes("customer.phone"):null;
      const requestId=response.headers.get("x-thirdsight-request-id")??"not returned";
      const evidenceId=response.headers.get("x-thirdsight-evidence-id")??"not returned";
      setManaged({
        decision:response.headers.get("x-thirdsight-decision")??"UNKNOWN",
        evidence:response.headers.get("x-thirdsight-evidence")??"unknown",
        requestId,
        evidenceId,
        status:response.status,
        body,
        receivedFields,
        customerPhoneReceived,
      });
    }catch(caught){setError(caught instanceof Error?caught.message:"Managed request failed.");}
    finally{setBusy(null);}
  }

  async function copy(value:string){
    try{await navigator.clipboard.writeText(value);}catch{setError("Clipboard access was unavailable. Select and copy the value manually.");}
  }

  return <section className="ts-selfserve" aria-label="Merchant self-service onboarding">
    <div className="ts-selfserve-head">
      <div><span className="ts-kicker">Recording-ready self-service</span><h3>Create a merchant workspace and route one real request.</h3><p>Fixed presets keep policy and upstream routing server-owned. The operator secret is used only for setup; the generated merchant key is returned once.</p></div>
      <span className="ts-preview-badge">Preview control plane</span>
    </div>

    <div className="ts-selfserve-grid">
      <div className="ts-selfserve-form">
        <label>Workspace name<input value={workspaceName} onChange={event=>setWorkspaceName(event.target.value)} autoComplete="off"/></label>
        <label>Workspace slug<input value={workspaceSlug} onChange={event=>setWorkspaceSlug(event.target.value.toLowerCase())} autoComplete="off"/></label>
        <label>Integration preset<select value={presetId} onChange={event=>{setPresetId(event.target.value as PresetId);setApproved(false);setProvisioned(null);setManaged(null);}}><option value="cedar-analytics">CEDAR Analytics</option><option value="cedar-delivery">CEDAR Delivery</option></select></label>
        <label>Operator key<input type="password" value={operatorKey} onChange={event=>setOperatorKey(event.target.value)} autoComplete="new-password" placeholder="Shared setup secret"/></label>

        <div className="ts-purpose-contract">
          <div><ShieldCheck size={16}/><strong>{preset.label} Purpose Contract</strong></div>
          <p>{preset.purpose}</p>
          <div className="ts-purpose-fields">{preset.fields.map(field=><span key={field}>{field}</span>)}</div>
          <label className="ts-contract-approval"><input type="checkbox" checked={approved} onChange={event=>setApproved(event.target.checked)}/><span>I approve this fixed preset for this workspace.</span></label>
        </div>

        <button className="ts-primary-action" disabled={!canProvision} onClick={provision}><KeyRound size={15}/>{busy==="provision"?"Creating workspace…":"Create workspace & install preset"}</button>
      </div>

      <div className="ts-selfserve-result">
        {!provisioned?<div className="ts-result-empty"><KeyRound size={19}/><strong>No merchant key yet</strong><span>Provisioning creates the workspace, installs the selected preset and returns one raw key once.</span></div>:<>
          <div className="ts-result-line"><span>Workspace</span><b>{provisioned.workspace.name}</b></div>
          <div className="ts-result-line"><span>Installed</span><b>{preset.label}</b></div>
          <div className="ts-key-box"><span>Merchant API key · shown once</span><code>{provisioned.apiKey.value}</code><button onClick={()=>copy(provisioned.apiKey.value)}><Clipboard size={14}/>Copy key</button><small>{maskedKey}</small></div>
          <button className="ts-run-action" disabled={Boolean(busy)} onClick={runManagedTest}><Play size={15}/>{busy==="test"?"Sending through ThirdSight…":`Run ${preset.label} managed test`}</button>
        </>}

        {managed?<div className="ts-managed-proof">
          <div className="ts-proof-top"><span className={`ts-proof-decision ${managed.decision.toLowerCase()}`}>{managed.decision}</span><b>{managed.status} · expected {preset.expected}</b></div>
          <div className="ts-result-line"><span>Evidence</span><b>{managed.evidence}</b></div>
          <div className="ts-result-line"><span>Evidence ID</span><code>{managed.evidenceId}</code></div>
          <div className="ts-result-line"><span>Request ID</span><code>{managed.requestId}</code></div>
          <div className="ts-received-fields"><span>Partner Lab received</span><div>{managed.receivedFields.length?managed.receivedFields.map(field=><code key={field} className={field==="customer.phone"?"phone":""}>{field}</code>):<em>No receipt fields returned.</em>}</div></div>
          <div className="ts-result-line"><span>customer.phone at receiver</span><b>{managed.customerPhoneReceived===null?"Not reported":managed.customerPhoneReceived?"YES":"NO"}</b></div>
          <details><summary>Upstream response</summary><pre>{JSON.stringify(receipt??managed.body,null,2)}</pre></details>
        </div>:null}
        {error?<div className="ts-selfserve-error">{error}</div>:null}
      </div>
    </div>

    <div className="ts-sdk-preview">
      <div><span className="ts-kicker">Node client · preview distribution</span><strong>Install the packed package from this repository.</strong><p>This is not an npm-registry release.</p></div>
      <div className="ts-install-command"><code>{INSTALL_COMMAND}</code><button onClick={()=>copy(INSTALL_COMMAND)}><Clipboard size={14}/>Copy</button></div>
      <pre>{`import { ThirdSight } from "@thirdsight/node";\n\nconst thirdsight = new ThirdSight({\n  baseUrl: "https://thirdsight-one.vercel.app",\n  apiKey: process.env.THIRDSIGHT_API_KEY,\n  environment: "synthetic-demo"\n});\n\nawait thirdsight.integration("${presetId}").fetch("${preset.path}", {\n  method: "POST", body: payload, context\n});`}</pre>
    </div>
  </section>;
}