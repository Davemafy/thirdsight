import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Minus,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import "./CommerceLab.css";

type Product={
  id:string;
  name:string;
  category:string;
  price:number;
  copy:string;
  image:string;
  alt:string;
  badge?:string;
  colors:string[];
  details:string[];
};

const PRODUCTS:Product[]=[
  {
    id:"auralite-h3",
    name:"Auralite H3",
    category:"Headphones",
    price:189900,
    copy:"Over-ear wireless headphones tuned for long listening sessions.",
    image:"https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1400&q=88",
    alt:"Black over-ear headphones on a neutral background",
    badge:"Bestseller",
    colors:["Midnight","Sand","Silver"],
    details:["40-hour battery","Adaptive noise control","USB-C fast charge","Spatial audio"],
  },
  {
    id:"slate-one",
    name:"Slate One",
    category:"Phones",
    price:749900,
    copy:"A quiet, capable everyday phone with an edge-to-edge OLED display.",
    image:"https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1400&q=88",
    alt:"Modern smartphone photographed on a table",
    badge:"New",
    colors:["Graphite","Cloud","Pine"],
    details:["6.4-inch OLED","256 GB storage","Dual camera system","All-day battery"],
  },
  {
    id:"meridian-watch",
    name:"Meridian Watch",
    category:"Wearables",
    price:329900,
    copy:"Fitness, notifications, and maps in a slim aluminium watch.",
    image:"https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1400&q=88",
    alt:"Minimal wrist watch in a studio setting",
    colors:["Black","Natural","Clay"],
    details:["7-day battery","GPS + heart rate","50 m water resistance","Always-on display"],
  },
  {
    id:"frame-c2",
    name:"Frame C2",
    category:"Cameras",
    price:1149900,
    copy:"A compact mirrorless camera for daily carry and travel.",
    image:"https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1400&q=88",
    alt:"Black mirrorless camera on a wooden surface",
    colors:["Black","Silver"],
    details:["24 MP sensor","4K video","USB-C charging","Interchangeable lens"],
  },
  {
    id:"keyline-75",
    name:"Keyline 75",
    category:"Workspace",
    price:139900,
    copy:"Low-profile mechanical keyboard with a compact 75% layout.",
    image:"https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=1400&q=88",
    alt:"Mechanical keyboard photographed from above",
    colors:["Charcoal","Bone"],
    details:["Hot-swappable switches","Wireless + USB-C","Mac and Windows","Aluminium frame"],
  },
  {
    id:"fieldbook-air",
    name:"Fieldbook Air",
    category:"Computers",
    price:1299900,
    copy:"A lightweight notebook for focused work away from the desk.",
    image:"https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=1400&q=88",
    alt:"Thin laptop open on a desk",
    colors:["Graphite","Silver"],
    details:["14-inch display","16 GB memory","512 GB SSD","Up to 18 hours battery"],
  },
];

function money(value:number){
  return new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",maximumFractionDigits:0}).format(value);
}

export function CommerceLab(){
  const [query,setQuery]=useState("");
  const [category,setCategory]=useState("All");
  const [selected,setSelected]=useState<Product|null>(null);
  const [cartOpen,setCartOpen]=useState(false);
  const [checkout,setCheckout]=useState(false);
  const [cart,setCart]=useState<Record<string,number>>({});

  const categories=["All",...Array.from(new Set(PRODUCTS.map(product=>product.category)))];
  const visible=useMemo(()=>PRODUCTS.filter(product=>{
    const matchCategory=category==="All"||product.category===category;
    const q=query.trim().toLowerCase();
    const matchQuery=!q||[product.name,product.category,product.copy].join(" ").toLowerCase().includes(q);
    return matchCategory&&matchQuery;
  }),[query,category]);

  const cartItems=PRODUCTS.flatMap(product=>{
    const quantity=cart[product.id]??0;
    return quantity>0?[{product,quantity}]:[];
  });
  const cartCount=cartItems.reduce((sum,item)=>sum+item.quantity,0);
  const subtotal=cartItems.reduce((sum,item)=>sum+item.product.price*item.quantity,0);

  const add=(product:Product)=>{
    setCart(current=>({...current,[product.id]:(current[product.id]??0)+1}));
    setCartOpen(true);
  };
  const adjust=(product:Product,delta:number)=>{
    setCart(current=>{
      const next=Math.max(0,(current[product.id]??0)+delta);
      return {...current,[product.id]:next};
    });
  };

  return <div className="cl-store">
    <div className="cl-announcement">Complimentary delivery in Abuja on orders over ₦150,000 <span>Shop now</span></div>

    <header className="cl-header">
      <a className="cl-wordmark" href="/commerce-lab">CEDAR</a>
      <nav className="cl-main-nav" aria-label="Store navigation">
        <a href="#new">New in</a><a href="#shop">Shop</a><a href="#workspace">Workspace</a><a href="#journal">Journal</a>
      </nav>
      <div className="cl-header-actions">
        <button aria-label="Search" onClick={()=>document.getElementById("cedar-search")?.focus()}><Search size={18}/></button>
        <button className="cl-bag-button" aria-label="Open bag" onClick={()=>setCartOpen(true)}><ShoppingBag size={18}/><span>{cartCount}</span></button>
      </div>
    </header>

    <main>
      <section className="cl-hero" id="new">
        <img src={PRODUCTS[0].image} alt={PRODUCTS[0].alt}/>
        <div className="cl-hero-overlay"/>
        <div className="cl-hero-copy">
          <span>New listening</span>
          <h1>Sound, with<br/>room to think.</h1>
          <p>Auralite H3 pairs all-day comfort with adaptive noise control and a restrained, everyday design.</p>
          <button onClick={()=>setSelected(PRODUCTS[0])}>Discover Auralite H3 <ArrowRight size={16}/></button>
        </div>
      </section>

      <section className="cl-editorial-strip">
        <div><span>01</span><p>Technology chosen for everyday use, not specification sheets.</p></div>
        <div><span>02</span><p>Free returns within 14 days on unused products.</p></div>
        <div><span>03</span><p>Support from real people, seven days a week.</p></div>
      </section>

      <section className="cl-catalogue" id="shop">
        <div className="cl-catalogue-head">
          <div><span>Shop the edit</span><h2>Useful things,<br/>considered well.</h2></div>
          <p>Phones, audio, cameras and workspace tools selected for how they fit into real routines.</p>
        </div>

        <div className="cl-toolbar">
          <label className="cl-search"><Search size={16}/><input id="cedar-search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search products"/></label>
          <div className="cl-category-scroll">{categories.map(item=><button key={item} className={category===item?"active":""} onClick={()=>setCategory(item)}>{item}</button>)}</div>
          <button className="cl-filter"><SlidersHorizontal size={15}/> Filter</button>
        </div>

        <div className="cl-product-grid">
          {visible.map(product=><article className="cl-product-card" key={product.id}>
            <button className="cl-product-image" onClick={()=>setSelected(product)} aria-label={"View "+product.name}>
              {product.badge?<span>{product.badge}</span>:null}
              <img loading="lazy" src={product.image} alt={product.alt}/>
            </button>
            <div className="cl-product-copy">
              <div><span>{product.category}</span><h3>{product.name}</h3></div>
              <strong>{money(product.price)}</strong>
            </div>
            <p>{product.copy}</p>
            <button className="cl-quick-add" onClick={()=>add(product)}>Add to bag <Plus size={14}/></button>
          </article>)}
        </div>
      </section>

      <section className="cl-story" id="workspace">
        <div className="cl-story-copy"><span>Work, quietly</span><h2>Make the desk<br/>feel less like work.</h2><p>A focused edit of tools for writing, building and thinking — without the usual gamer-desk noise.</p><button onClick={()=>setCategory("Workspace")}>Shop workspace <ArrowRight size={15}/></button></div>
        <img src={PRODUCTS[4].image} alt={PRODUCTS[4].alt}/>
      </section>

      <section className="cl-newsletter" id="journal">
        <span>CEDAR NOTES</span><h2>New products, considered slowly.</h2><p>Occasional notes on useful technology, new arrivals and things worth keeping.</p>
        <form onSubmit={event=>event.preventDefault()}><input type="email" placeholder="Email address" aria-label="Email address"/><button>Join <ArrowRight size={14}/></button></form>
      </section>
    </main>

    <footer className="cl-footer">
      <div><a className="cl-wordmark" href="/commerce-lab">CEDAR</a><p>Everyday technology, selected with care.</p></div>
      <div><strong>Shop</strong><a href="#shop">Audio</a><a href="#shop">Phones</a><a href="#shop">Workspace</a></div>
      <div><strong>Help</strong><a href="#journal">Delivery</a><a href="#journal">Returns</a><a href="#journal">Contact</a></div>
      <div><strong>Commerce Lab</strong><span>Synthetic demonstration environment. No real customer data.</span><a href="/commerce-lab/control">Operator access</a></div>
    </footer>

    {selected?<ProductSheet product={selected} onClose={()=>setSelected(null)} onAdd={()=>add(selected)}/>:null}
    {cartOpen?<CartDrawer items={cartItems} subtotal={subtotal} onClose={()=>setCartOpen(false)} onAdjust={adjust} onCheckout={()=>{setCheckout(true);setCartOpen(false)}}/>:null}
    {checkout?<Checkout items={cartItems} subtotal={subtotal} onClose={()=>setCheckout(false)}/>:null}
  </div>;
}

function ProductSheet({product,onClose,onAdd}:{product:Product;onClose:()=>void;onAdd:()=>void}){
  const [color,setColor]=useState(product.colors[0]);
  return <div className="cl-layer" role="dialog" aria-modal="true">
    <button className="cl-layer-backdrop" aria-label="Close product" onClick={onClose}/>
    <div className="cl-product-sheet">
      <button className="cl-close" onClick={onClose}><X size={20}/></button>
      <div className="cl-detail-image"><img src={product.image} alt={product.alt}/></div>
      <div className="cl-detail-copy">
        <span>{product.category}</span>
        <h2>{product.name}</h2>
        <strong>{money(product.price)}</strong>
        <p>{product.copy}</p>
        <div className="cl-option"><small>Finish — {color}</small><div>{product.colors.map(item=><button key={item} className={color===item?"active":""} onClick={()=>setColor(item)}>{item}</button>)}</div></div>
        <button className="cl-add-primary" onClick={onAdd}>Add to bag <ShoppingBag size={16}/></button>
        <ul>{product.details.map(item=><li key={item}><Check size={14}/>{item}</li>)}</ul>
      </div>
    </div>
  </div>;
}

function CartDrawer({
  items,subtotal,onClose,onAdjust,onCheckout,
}:{items:{product:Product;quantity:number}[];subtotal:number;onClose:()=>void;onAdjust:(product:Product,delta:number)=>void;onCheckout:()=>void}){
  return <div className="cl-layer" role="dialog" aria-modal="true">
    <button className="cl-layer-backdrop" aria-label="Close bag" onClick={onClose}/>
    <aside className="cl-cart">
      <div className="cl-cart-head"><div><span>Your bag</span><small>{items.reduce((sum,item)=>sum+item.quantity,0)} items</small></div><button onClick={onClose}><X size={19}/></button></div>
      <div className="cl-cart-items">
        {items.length===0?<div className="cl-empty-bag"><ShoppingBag size={28}/><h3>Your bag is empty.</h3><p>Start with something useful.</p></div>:items.map(({product,quantity})=><div className="cl-cart-item" key={product.id}>
          <img src={product.image} alt=""/>
          <div><strong>{product.name}</strong><span>{product.category}</span><b>{money(product.price)}</b><div className="cl-quantity"><button onClick={()=>onAdjust(product,-1)}><Minus size={13}/></button><span>{quantity}</span><button onClick={()=>onAdjust(product,1)}><Plus size={13}/></button></div></div>
        </div>)}
      </div>
      {items.length>0?<div className="cl-cart-foot"><div><span>Subtotal</span><strong>{money(subtotal)}</strong></div><small>Delivery calculated at checkout.</small><button onClick={onCheckout}>Checkout <ArrowRight size={15}/></button></div>:null}
    </aside>
  </div>;
}

function Checkout({items,subtotal,onClose}:{items:{product:Product;quantity:number}[];subtotal:number;onClose:()=>void}){
  const [complete,setComplete]=useState(false);
  if(complete)return <div className="cl-checkout-page"><div className="cl-order-complete"><span><Check size={22}/></span><small>ORDER CED-2048</small><h1>You're all set.</h1><p>This is a synthetic order. No payment was processed and no customer information was stored.</p><button onClick={onClose}>Return to store</button></div></div>;
  return <div className="cl-checkout-page">
    <header><button onClick={onClose}><ArrowLeft size={18}/></button><a className="cl-wordmark" href="/commerce-lab">CEDAR</a><span>Secure checkout</span></header>
    <div className="cl-checkout-grid">
      <section>
        <span className="cl-checkout-step">1 · CONTACT</span>
        <h1>Where should we send it?</h1>
        <div className="cl-form-grid"><label>Full name<input defaultValue="Ada Example"/></label><label>Email<input defaultValue="ada@example.test"/></label><label>Phone<input defaultValue="+234 800 000 0000"/></label><label>City<input defaultValue="Abuja"/></label><label className="wide">Delivery address<input defaultValue="12 Demo Street, Central District"/></label></div>
        <span className="cl-checkout-step second">2 · PAYMENT</span>
        <div className="cl-payment-option"><div><span/> Card</div><small>•••• 4242 · synthetic sandbox</small></div>
        <button className="cl-pay" onClick={()=>setComplete(true)}>Place synthetic order · {money(subtotal)}</button>
      </section>
      <aside>
        <strong>Order summary</strong>
        {items.map(({product,quantity})=><div className="cl-checkout-item" key={product.id}><img src={product.image} alt=""/><div><span>{product.name}</span><small>Qty {quantity}</small></div><b>{money(product.price*quantity)}</b></div>)}
        <div className="cl-summary-line"><span>Subtotal</span><b>{money(subtotal)}</b></div><div className="cl-summary-line"><span>Delivery</span><b>Complimentary</b></div><div className="cl-summary-line total"><span>Total</span><b>{money(subtotal)}</b></div>
      </aside>
    </div>
  </div>;
}

type Scenario="normal"|"scope-violation"|"flash-sale"|"proportional"|"shadow"|"stale-crm";

export function CommerceLabControl(){
  const [scenario,setScenario]=useState<Scenario>("normal");
  const [running,setRunning]=useState(false);
  const [result,setResult]=useState<string>("Normal storefront behaviour is active.");

  const run=async()=>{
    setRunning(true);
    try{
      if(scenario==="scope-violation"){
        const response=await fetch("/api/stage5-proof",{cache:"no-store"});
        const body=await response.json();
        if(!response.ok)throw new Error(body?.message??"Scenario failed");
        setResult("Scope violation persisted: customer.phone was removed before send; the passive comparison was detected after transmission.");
      }else{
        sessionStorage.setItem("commerce-lab-scenario",scenario);
        const label={
          normal:"Normal commerce mode selected.",
          "flash-sale":"Flash-sale storefront mode selected. Use the signed Stage 7 runner for fresh detector evidence.",
          proportional:"Proportional-abuse storefront mode selected. Use the signed Stage 7 runner for fresh detector evidence.",
          shadow:"Shadow integration storefront mode selected. Use the signed Stage 7 runner for fresh detector evidence.",
          "stale-crm":"Legacy CRM storefront mode selected. Use the signed Stage 7 runner for fresh detector evidence.",
          "scope-violation":"",
        }[scenario];
        setResult(label);
      }
    }catch(error){
      setResult(error instanceof Error?error.message:"Scenario failed");
    }finally{setRunning(false)}
  };

  return <div className="cl-control">
    <header><div><span>COMMERCE LAB</span><h1>Operator control</h1><p>Fixed synthetic scenarios only. Customer-facing storefront remains clean.</p></div><div><a href="/commerce-lab">Open storefront</a><a href="/">Open ThirdSight</a></div></header>
    <div className="cl-control-grid">
      <section>
        <span className="cl-control-label">Scenario</span>
        <div className="cl-scenarios">
          {([
            ["normal","Normal commerce","Legitimate browsing and checkout"],
            ["scope-violation","Unauthorized field","customer.phone added to analytics"],
            ["flash-sale","Flash sale","10× legitimate traffic"],
            ["proportional","Proportional abuse","Object mismatch hidden in sale"],
            ["shadow","Shadow integration","Opaque unmanaged browser destination"],
            ["stale-crm","Legacy CRM","Retired credential bypass"],
          ] as const).map(([id,title,copy])=><button key={id} className={scenario===id?"active":""} onClick={()=>setScenario(id)}>
            <span>{title}</span><small>{copy}</small>{scenario===id?<Check size={15}/>:null}
          </button>)}
        </div>
        <button className="cl-run" onClick={run} disabled={running}>{running?"Running…":"Apply scenario"} <ArrowRight size={15}/></button>
      </section>
      <aside>
        <span className="cl-control-label">Status</span>
        <div className="cl-control-status"><Sparkles size={18}/><strong>{result}</strong></div>
        <div className="cl-control-note"><ShieldCheck size={17}/><p><b>Authority stays server-side.</b> The storefront cannot send arbitrary payloads or call signed Stage 7 endpoints. The browser only selects from these fixed synthetic modes.</p></div>
        <a className="cl-control-link" href="/">Inspect evidence in ThirdSight <ChevronRight size={15}/></a>
      </aside>
    </div>
  </div>;
}
