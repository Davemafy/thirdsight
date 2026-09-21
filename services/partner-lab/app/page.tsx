import Link from "next/link";
import { DeliveryTable } from "@/components/delivery-table";
import { listDeliveries } from "@/lib/store";

export const dynamic="force-dynamic";

const receivers=["managed-analytics","managed-delivery","analytics","advertising","crm"] as const;

export default async function Page(){
  const deliveries=await listDeliveries();
  const counts=Object.fromEntries(receivers.map((receiver)=>[
    receiver,
    deliveries.filter((delivery)=>delivery.receiver===receiver).length,
  ]));

  return <main>
    <div className="page-head">
      <div>
        <p>Delivery ledger</p>
        <h1>What partners actually received</h1>
        <span>Each record is persisted only after ThirdSight gateway authentication succeeds.</span>
      </div>
      <strong>{deliveries.length} total deliveries</strong>
    </div>

    <section className="receiver-cards">
      {receivers.map((receiver)=><Link href={`/receivers/${receiver}`} key={receiver}>
        <div><i className={receiver}/><h2>{label(receiver)}</h2></div>
        <strong>{counts[receiver]??0}</strong>
        <span>accepted events</span>
      </Link>)}
    </section>

    <section className="panel">
      <div className="panel-head"><h2>Latest deliveries</h2><span>Receiver-side proof</span></div>
      <DeliveryTable deliveries={deliveries.slice(0,15)}/>
    </section>
  </main>;
}

function label(value:string){
  return value.split("-").map((part)=>part[0].toUpperCase()+part.slice(1)).join(" ");
}
