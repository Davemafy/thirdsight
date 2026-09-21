import { notFound } from "next/navigation";
import { DeliveryTable } from "@/components/delivery-table";
import { listDeliveries } from "@/lib/store";

export const dynamic="force-dynamic";
const valid=["analytics","advertising","crm","managed-analytics","managed-delivery"] as const;

export default async function Page({params}:{params:Promise<{receiver:string}>}){
  const {receiver}=await params;
  if(!valid.includes(receiver as typeof valid[number])) notFound();
  const deliveries=await listDeliveries(receiver);
  const managedAnalytics=receiver==="managed-analytics";
  const managedDelivery=receiver==="managed-delivery";

  return <main>
    <div className="page-head">
      <div>
        <p>Receiver</p>
        <h1>{label(receiver)}</h1>
        <span>POST /ingest/{receiver.startsWith("managed-")?"managed/"+receiver.replace("managed-",""):receiver} · authenticated ThirdSight requests only</span>
      </div>
      <strong>{deliveries.length} accepted</strong>
    </div>

    <section className="proof">
      <h2>Canonical field proof</h2>
      {managedAnalytics?<><div><span>Expected approved fields</span><code>order.* · product.*</code></div><div><span>Field that must not arrive</span><code className="blocked">customer.phone</code></div></>:null}
      {managedDelivery?<><div><span>Purpose-required field</span><code>customer.phone</code></div><div><span>Why</span><code>order fulfilment</code></div></>:null}
      {!managedAnalytics&&!managedDelivery?<><div><span>Expected approved fields</span><code>order.id · order.value · product.id · product.category</code></div><div><span>Forbidden field</span><code className="blocked">customer.phone</code></div></>:null}
    </section>

    <section className="panel">
      <div className="panel-head"><h2>Accepted deliveries</h2><span>Direct unauthenticated requests are rejected</span></div>
      <DeliveryTable deliveries={deliveries}/>
    </section>
  </main>;
}

function label(value:string){
  return value.split("-").map((part)=>part[0].toUpperCase()+part.slice(1)).join(" ");
}
