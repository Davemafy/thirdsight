import { randomUUID } from "node:crypto";
import { PRODUCTS, COLLECTIONS } from "./catalog-data";
import { calculateCart } from "./money";
import { db, hasDatabase } from "./db";
import type { Cart, CheckoutState, Order, Product, ProductVariant } from "./types";

type Scenario = "normal"|"unauthorized-field"|"flash-sale"|"proportional-abuse"|"shadow-integration"|"stale-crm";
interface MemoryState { carts:Map<string,Cart>; sessionCart:Map<string,string>; checkouts:Map<string,CheckoutState>; orders:Map<string,Order>; idempotency:Map<string,string>; scenario:Scenario }
const g=globalThis as typeof globalThis & {__cedar?:MemoryState};
const memory=()=>g.__cedar??=( {carts:new Map(),sessionCart:new Map(),checkouts:new Map(),orders:new Map(),idempotency:new Map(),scenario:"unauthorized-field"} );
export function __resetMemoryForTests(){delete g.__cedar;}

export interface ProductQuery { category?:string|null; q?:string|null; sort?:string|null; inStock?:boolean; minPrice?:number; maxPrice?:number; page?:number; limit?:number }

export async function listProducts(query:ProductQuery={}) {
  if(!hasDatabase()) return filterProducts(PRODUCTS,query);
  const sql=db(); const term=query.q?.trim(); const category=query.category?.trim();
  const rows=await sql<any[]>`
    select p.*, coalesce(json_agg(distinct jsonb_build_object('id',i.id,'url',i.url,'alt',i.alt,'sortOrder',i.sort_order)) filter(where i.id is not null),'[]') images,
      coalesce(json_agg(distinct jsonb_build_object('id',v.id,'sku',v.sku,'finish',v.finish,'finishHex',v.finish_hex,'configuration',v.configuration,'price',v.price,'compareAtPrice',v.compare_at_price,'inventory',inv.available-inv.reserved,'imageUrls',v.image_urls)) filter(where v.id is not null),'[]') variants
    from cedar_commerce.products p
    left join cedar_commerce.product_images i on i.product_id=p.id
    left join cedar_commerce.product_variants v on v.product_id=p.id and v.active
    left join cedar_commerce.inventory inv on inv.variant_id=v.id
    where p.active and (${category??null}::text is null or p.category=${category??null})
      and (${term??null}::text is null or p.name ilike ${term?`%${term}%`:null} or p.short_description ilike ${term?`%${term}%`:null})
    group by p.id
  `;
  return filterProducts(rows.map(mapProductRow),query);
}

export async function getProduct(slug:string){ return (await listProducts()).items.find(p=>p.slug===slug)??null; }
export async function listCollections(){ return COLLECTIONS; }
export async function getCollection(slug:string){ const collection=COLLECTIONS.find(c=>c.slug===slug); if(!collection)return null; const all=(await listProducts()).items; return {...collection,products:all.filter(p=>collection.productSlugs.includes(p.slug))}; }

function filterProducts(source:Product[],q:ProductQuery){
  let items=[...source]; const term=q.q?.trim().toLowerCase();
  if(term)items=items.filter(p=>`${p.name} ${p.shortDescription} ${p.category}`.toLowerCase().includes(term));
  if(q.category)items=items.filter(p=>p.category===q.category);
  if(q.inStock)items=items.filter(p=>p.variants.some(v=>v.inventory>0));
  if(Number.isFinite(q.minPrice))items=items.filter(p=>Math.min(...p.variants.map(v=>v.price))>=(q.minPrice??0));
  if(Number.isFinite(q.maxPrice))items=items.filter(p=>Math.min(...p.variants.map(v=>v.price))<=(q.maxPrice??Infinity));
  const sort=q.sort??"featured";
  items.sort((a,b)=>sort==="price-asc"?minPrice(a)-minPrice(b):sort==="price-desc"?minPrice(b)-minPrice(a):sort==="rating"?b.rating-a.rating:Number(b.featured)-Number(a.featured));
  const total=items.length,limit=Math.min(24,Math.max(1,q.limit??12)),page=Math.max(1,q.page??1);
  return {items:items.slice((page-1)*limit,page*limit),total,page,pages:Math.max(1,Math.ceil(total/limit))};
}
const minPrice=(p:Product)=>Math.min(...p.variants.map(v=>v.price));

export async function getOrCreateCart(sessionHash:string):Promise<Cart>{
  if(!hasDatabase()){
    const m=memory(); const existingId=m.sessionCart.get(sessionHash); if(existingId){const found=m.carts.get(existingId);if(found)return recalc(found);}
    const cart:Cart={id:randomUUID(),status:"ACTIVE",promoCode:null,lines:[],subtotal:0,discount:0,delivery:7500,total:7500}; m.carts.set(cart.id,cart);m.sessionCart.set(sessionHash,cart.id);return cart;
  }
  const sql=db(); let [cart]=await sql<any[]>`select * from cedar_commerce.carts where session_token_hash=${sessionHash} and status='ACTIVE' limit 1`;
  if(!cart){
    [cart]=await sql<any[]>`insert into cedar_commerce.carts(session_token_hash) values(${sessionHash}) on conflict(session_token_hash) do nothing returning *`;
    if(!cart)[cart]=await sql<any[]>`select * from cedar_commerce.carts where session_token_hash=${sessionHash} and status='ACTIVE' limit 1`;
  }
  if(!cart)throw domain("CART_SESSION_UNAVAILABLE",409);
  return loadDbCart(cart.id);
}

export async function addCartItem(sessionHash:string,variantId:string,quantity:number){
  const product=findVariant(variantId); if(!product)throw domain("VARIANT_NOT_FOUND",404); if(product.variant.inventory<quantity)throw domain("INSUFFICIENT_STOCK",409);
  const cart=await getOrCreateCart(sessionHash);
  if(!hasDatabase()){
    const line=cart.lines.find(l=>l.variantId===variantId); if(line){if(line.quantity+quantity>product.variant.inventory)throw domain("INSUFFICIENT_STOCK",409);line.quantity+=quantity;}else cart.lines.push({id:randomUUID(),cartId:cart.id,variantId,quantity,product:product.product,variant:product.variant});
    const next=recalc(cart);memory().carts.set(cart.id,next);return next;
  }
  const sql=db(); const existing=cart.lines.find(line=>line.variantId===variantId)?.quantity??0; const [stock]=await sql<any[]>`select available-reserved stock from cedar_commerce.inventory where variant_id=${variantId}`; if(!stock||stock.stock<existing+quantity)throw domain("INSUFFICIENT_STOCK",409);if(existing+quantity>10)throw domain("MAXIMUM_QUANTITY_EXCEEDED",422);
  await sql`insert into cedar_commerce.cart_lines(cart_id,variant_id,quantity) values(${cart.id},${variantId},${quantity}) on conflict(cart_id,variant_id) do update set quantity=cedar_commerce.cart_lines.quantity+excluded.quantity,updated_at=now()`;
  return loadDbCart(cart.id);
}

export async function updateCartItem(sessionHash:string,lineId:string,quantity:number){
  const cart=await getOrCreateCart(sessionHash); const line=cart.lines.find(l=>l.id===lineId); if(!line)throw domain("CART_LINE_NOT_FOUND",404); if(quantity>line.variant.inventory)throw domain("INSUFFICIENT_STOCK",409);
  if(!hasDatabase()){line.quantity=quantity;const next=recalc(cart);memory().carts.set(cart.id,next);return next;}
  await db()`update cedar_commerce.cart_lines set quantity=${quantity},updated_at=now() where id=${lineId} and cart_id=${cart.id}`; return loadDbCart(cart.id);
}
export async function removeCartItem(sessionHash:string,lineId:string){const cart=await getOrCreateCart(sessionHash);if(!hasDatabase()){cart.lines=cart.lines.filter(l=>l.id!==lineId);const next=recalc(cart);memory().carts.set(cart.id,next);return next;}await db()`delete from cedar_commerce.cart_lines where id=${lineId} and cart_id=${cart.id}`;return loadDbCart(cart.id);}

export async function applyPromo(sessionHash:string,code:string){
  const cart=await getOrCreateCart(sessionHash); const upper=code.toUpperCase();
  if(!hasDatabase()){if(upper!=="CEDAR10"||cart.subtotal<100000)throw domain("PROMO_NOT_VALID",422);cart.promoCode=upper;const next=recalc(cart);memory().carts.set(cart.id,next);return next;}
  const [promo]=await db()<any[]>`select * from cedar_commerce.promo_codes where code=${upper} and active and starts_at<=now() and expires_at>now()`;if(!promo||cart.subtotal<promo.minimum_subtotal)throw domain("PROMO_NOT_VALID",422);await db()`update cedar_commerce.carts set promo_code=${upper},updated_at=now() where id=${cart.id}`;return loadDbCart(cart.id);
}

export async function saveContact(sessionHash:string,input:{email:string;phone:string;firstName:string;lastName:string}){const cart=await getOrCreateCart(sessionHash);const checkout=await getCheckout(cart.id);const next={...checkout,...input};if(!hasDatabase()){memory().checkouts.set(cart.id,next);return next;}await db()`insert into cedar_commerce.checkouts(cart_id,email,phone,first_name,last_name) values(${cart.id},${input.email},${input.phone},${input.firstName},${input.lastName}) on conflict(cart_id) do update set email=excluded.email,phone=excluded.phone,first_name=excluded.first_name,last_name=excluded.last_name,updated_at=now()`;return getCheckout(cart.id);}
export async function saveDelivery(sessionHash:string,input:{addressLine1:string;addressLine2:string;city:string;state:string;deliveryMethod:"STANDARD"|"EXPRESS"|"PICKUP"}){const cart=await getOrCreateCart(sessionHash);const checkout=await getCheckout(cart.id);const next={...checkout,...input};if(!hasDatabase()){memory().checkouts.set(cart.id,next);return next;}await db()`insert into cedar_commerce.checkouts(cart_id,address_line1,address_line2,city,state,delivery_method) values(${cart.id},${input.addressLine1},${input.addressLine2},${input.city},${input.state},${input.deliveryMethod}) on conflict(cart_id) do update set address_line1=excluded.address_line1,address_line2=excluded.address_line2,city=excluded.city,state=excluded.state,delivery_method=excluded.delivery_method,updated_at=now()`;return getCheckout(cart.id);}
export async function savePayment(sessionHash:string,paymentMethod:"TEST_VISA_4242"|"PAY_ON_DELIVERY"|"SYNTHETIC_BANK_TRANSFER"){const cart=await getOrCreateCart(sessionHash);const checkout=await getCheckout(cart.id);const next={...checkout,paymentMethod};if(!hasDatabase()){memory().checkouts.set(cart.id,next);return next;}const sql=db();const [row]=await sql<any[]>`insert into cedar_commerce.checkouts(cart_id,payment_method) values(${cart.id},${paymentMethod}) on conflict(cart_id) do update set payment_method=excluded.payment_method,updated_at=now() returning id`;await sql`insert into cedar_commerce.payment_attempts(checkout_id,method,status) values(${row.id},${paymentMethod},'SYNTHETIC_AUTHORIZED')`;return getCheckout(cart.id);}
export async function reviewCheckout(sessionHash:string){const cart=await getOrCreateCart(sessionHash);const checkout=await getCheckout(cart.id);const missing=[!checkout.email&&"contact",!checkout.addressLine1&&"delivery",!checkout.paymentMethod&&"payment"].filter(Boolean);if(missing.length)throw domain(`CHECKOUT_INCOMPLETE:${missing.join(",")}`,422);if(!cart.lines.length)throw domain("CART_EMPTY",422);return {cart,checkout};}

export async function createOrder(sessionHash:string,idempotencyKey:string):Promise<Order>{
  const m=memory(); if(!hasDatabase()){const existing=m.idempotency.get(idempotencyKey);if(existing)return m.orders.get(existing)!;const {cart,checkout}=await reviewCheckout(sessionHash);assertStock(cart);const order=buildOrder(cart,checkout);m.orders.set(order.id,order);m.idempotency.set(idempotencyKey,order.id);cart.status="CONVERTED";return order;}
  const sql=db(); const [existing]=await sql<any[]>`select id from cedar_commerce.orders where idempotency_key=${idempotencyKey}`;if(existing)return getOrder(existing.id) as Promise<Order>;
  const {cart,checkout}=await reviewCheckout(sessionHash);return sql.begin(async tx=>{
    for(const line of cart.lines){const [stock]=await tx<any[]>`select available,reserved from cedar_commerce.inventory where variant_id=${line.variantId} for update`;if(!stock||stock.available-stock.reserved<line.quantity)throw domain("INSUFFICIENT_STOCK",409);}
    const order=buildOrder(cart,checkout);const [customer]=await tx<any[]>`insert into cedar_commerce.customers(email,first_name,last_name,phone) values(${order.email},${checkout.firstName!},${checkout.lastName!},${order.phone}) on conflict(email) do update set first_name=excluded.first_name,last_name=excluded.last_name,phone=excluded.phone returning id`;
    await tx`insert into cedar_commerce.orders(id,order_number,cart_id,customer_id,status,payment_status,email,phone,delivery_address,delivery_method,payment_method,subtotal,discount,delivery,total,idempotency_key,estimated_delivery,created_at) values(${order.id},${order.orderNumber},${cart.id},${customer.id},${order.status},${order.paymentStatus},${order.email},${order.phone},${sql.json(order.deliveryAddress)},${order.deliveryMethod},${order.paymentMethod},${order.subtotal},${order.discount},${order.delivery},${order.total},${idempotencyKey},${order.estimatedDelivery},${order.createdAt})`;
    for(const line of cart.lines){await tx`insert into cedar_commerce.order_lines(order_id,variant_id,product_name,variant_label,sku,quantity,unit_price,image_url) values(${order.id},${line.variantId},${line.product.name},${`${line.variant.finish} · ${line.variant.configuration}`},${line.variant.sku},${line.quantity},${line.variant.price},${line.variant.imageUrls[0]})`;await tx`update cedar_commerce.inventory set reserved=reserved+${line.quantity},updated_at=now() where variant_id=${line.variantId}`;}
    await tx`insert into cedar_commerce.fulfilments(order_id,status,estimated_delivery) values(${order.id},'PENDING',${order.estimatedDelivery})`;await tx`update cedar_commerce.carts set status='CONVERTED',updated_at=now() where id=${cart.id}`;return order;
  });
}

export async function getOrder(id:string):Promise<Order|null>{if(!hasDatabase())return memory().orders.get(id)??[...memory().orders.values()].find(o=>o.orderNumber===id)??null;const [o]=await db()<any[]>`select * from cedar_commerce.orders where id::text=${id} or order_number=${id} limit 1`;if(!o)return null;const lines=await db()<any[]>`select id,product_name "productName",variant_label "variantLabel",sku,quantity,unit_price "unitPrice",image_url "imageUrl" from cedar_commerce.order_lines where order_id=${o.id}`;return mapOrder(o,lines);}
export async function listAccountOrders(){if(!hasDatabase())return [...memory().orders.values()];const rows=await db()<any[]>`select id from cedar_commerce.orders order by created_at desc limit 20`;return Promise.all(rows.map(r=>getOrder(r.id))) as Promise<Order[]>;}
export async function getScenario():Promise<Scenario>{if(!hasDatabase())return memory().scenario;const [row]=await db()<any[]>`select scenario from cedar_commerce.operator_state where merchant_id='cedar-commerce'`;return row?.scenario??"unauthorized-field";}
export async function setScenario(scenario:Scenario){if(!hasDatabase()){memory().scenario=scenario;return scenario;}await db()`insert into cedar_commerce.operator_state(merchant_id,scenario) values('cedar-commerce',${scenario}) on conflict(merchant_id) do update set scenario=excluded.scenario,updated_at=now()`;return scenario;}

async function getCheckout(cartId:string):Promise<CheckoutState>{if(!hasDatabase())return memory().checkouts.get(cartId)??{id:randomUUID(),cartId,email:null,phone:null,firstName:null,lastName:null,addressLine1:null,addressLine2:null,city:null,state:null,deliveryMethod:null,paymentMethod:null};const [r]=await db()<any[]>`select * from cedar_commerce.checkouts where cart_id=${cartId}`;return r?{id:r.id,cartId:r.cart_id,email:r.email,phone:r.phone,firstName:r.first_name,lastName:r.last_name,addressLine1:r.address_line1,addressLine2:r.address_line2,city:r.city,state:r.state,deliveryMethod:r.delivery_method,paymentMethod:r.payment_method}:{id:randomUUID(),cartId,email:null,phone:null,firstName:null,lastName:null,addressLine1:null,addressLine2:null,city:null,state:null,deliveryMethod:null,paymentMethod:null};}
async function loadDbCart(cartId:string):Promise<Cart>{const sql=db();const [c]=await sql<any[]>`select * from cedar_commerce.carts where id=${cartId}`;const rows=await sql<any[]>`select cl.id,cl.quantity,v.id variant_id from cedar_commerce.cart_lines cl join cedar_commerce.product_variants v on v.id=cl.variant_id where cl.cart_id=${cartId}`;const all=(await listProducts()).items;const lines=rows.map(r=>{const f=findVariantIn(all,r.variant_id)!;return{id:r.id,cartId,variantId:r.variant_id,quantity:r.quantity,product:f.product,variant:f.variant};});return recalc({id:c.id,status:c.status,promoCode:c.promo_code,lines,subtotal:0,discount:0,delivery:0,total:0});}
function recalc(cart:Cart){const promoPercent=cart.promoCode==="CEDAR10"?10:0;const totals=calculateCart({lines:cart.lines.map(l=>({price:l.variant.price,quantity:l.quantity})),promoPercent});return{...cart,...totals};}
function findVariant(id:string){return findVariantIn(PRODUCTS,id);}
function findVariantIn(products:Product[],id:string){for(const product of products){const variant=product.variants.find(v=>v.id===id);if(variant)return{product,variant};}return null;}
function assertStock(cart:Cart){for(const line of cart.lines)if(line.quantity>line.variant.inventory)throw domain("INSUFFICIENT_STOCK",409);}
function buildOrder(cart:Cart,c:CheckoutState):Order{const id=randomUUID();const now=new Date();return{id,orderNumber:`CDR-${now.getUTCFullYear()}-${id.slice(0,6).toUpperCase()}`,status:"CONFIRMED",paymentStatus:c.paymentMethod==="PAY_ON_DELIVERY"?"PENDING":"SYNTHETIC_AUTHORIZED",email:c.email!,phone:c.phone!,deliveryAddress:{firstName:c.firstName!,lastName:c.lastName!,line1:c.addressLine1!,line2:c.addressLine2??"",city:c.city!,state:c.state!,country:"Nigeria"},deliveryMethod:c.deliveryMethod!,paymentMethod:c.paymentMethod!,subtotal:cart.subtotal,discount:cart.discount,delivery:cart.delivery,total:cart.total,createdAt:now.toISOString(),estimatedDelivery:new Date(now.getTime()+3*86400000).toISOString(),lines:cart.lines.map(l=>({id:randomUUID(),productName:l.product.name,variantLabel:`${l.variant.finish} · ${l.variant.configuration}`,sku:l.variant.sku,quantity:l.quantity,unitPrice:l.variant.price,imageUrl:l.variant.imageUrls[0]}))};}
function mapProductRow(r:any):Product{return{id:r.id,slug:r.slug,name:r.name,category:r.category,shortDescription:r.short_description,description:r.description,rating:Number(r.rating),reviewCount:r.review_count,specifications:r.specifications,deliveryEstimate:r.delivery_estimate,warranty:r.warranty,featured:r.featured,newArrival:r.new_arrival,relatedSlugs:r.related_slugs,images:r.images,variants:r.variants};}
function mapOrder(o:any,lines:any[]):Order{return{id:o.id,orderNumber:o.order_number,status:o.status,paymentStatus:o.payment_status,email:o.email,phone:o.phone,deliveryAddress:o.delivery_address,deliveryMethod:o.delivery_method,paymentMethod:o.payment_method,subtotal:o.subtotal,discount:o.discount,delivery:o.delivery,total:o.total,createdAt:o.created_at,estimatedDelivery:o.estimated_delivery,lines,evidenceId:o.evidence_id??null};}
export function domain(code:string,status:number){return Object.assign(new Error(code),{code,status});}
