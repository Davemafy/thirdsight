-- Generic ThirdSight managed HTTP gateway fixtures.
-- Merchant approval is represented by these Purpose Contracts. Vendor documentation
-- does not create or widen merchant authorization.

insert into public.integration_registry(integration_id,display_name,lifecycle_status,owner) values
 ('paystack','Paystack','ACTIVE','Commerce'),
 ('flutterwave','Flutterwave','ACTIVE','Commerce'),
 ('monnify','Monnify','ACTIVE','Commerce'),
 ('interswitch','Interswitch Webpay','ACTIVE','Commerce'),
 ('sendbox','Sendbox','ACTIVE','Fulfilment'),
 ('kwik','Kwik Delivery','ACTIVE','Fulfilment'),
 ('termii','Termii','ACTIVE','Customer Operations'),
 ('sendchamp','Sendchamp','ACTIVE','Customer Operations'),
 ('meta-capi','Meta Conversions API','ACTIVE','Growth'),
 ('ga4','Google Analytics 4','ACTIVE','Analytics'),
 ('cedar-analytics','CEDAR Analytics','ACTIVE','CEDAR Commerce'),
 ('cedar-delivery','CEDAR Delivery','ACTIVE','CEDAR Commerce')
on conflict(integration_id) do update set
 display_name=excluded.display_name,
 lifecycle_status=excluded.lifecycle_status,
 owner=excluded.owner;

insert into public.purpose_contracts(
 contract_id,version,integration_id,environment,payload,valid_from,expires_at
) values
(
 'paystack-checkout','1','paystack','production',
 '{"contractId":"paystack-checkout","integrationId":"paystack","version":"1","purpose":"Initialize payment for an active checkout","resources":["payments"],"fields":["email","amount","currency","reference"],"operations":["send"],"validTriggers":["checkout.started"],"environment":"production","validFrom":"2026-09-01T00:00:00.000Z","reviewAt":"2027-01-01T00:00:00.000Z","expiresAt":null,"owner":"Commerce","approvedBy":"Merchant Security","changeReason":"Managed gateway compatibility contract"}'::jsonb,
 '2026-09-01T00:00:00Z',null
),
(
 'flutterwave-checkout','1','flutterwave','production',
 '{"contractId":"flutterwave-checkout","integrationId":"flutterwave","version":"1","purpose":"Initialize payment for an active checkout","resources":["payments"],"fields":["tx_ref","amount","currency","redirect_url","customer.email","customer.name","customer.phonenumber"],"operations":["send"],"validTriggers":["checkout.started"],"environment":"production","validFrom":"2026-09-01T00:00:00.000Z","reviewAt":"2027-01-01T00:00:00.000Z","expiresAt":null,"owner":"Commerce","approvedBy":"Merchant Security","changeReason":"Managed gateway compatibility contract"}'::jsonb,
 '2026-09-01T00:00:00Z',null
),
(
 'monnify-checkout','1','monnify','sandbox',
 '{"contractId":"monnify-checkout","integrationId":"monnify","version":"1","purpose":"Initialize merchant payment","resources":["payments"],"fields":["amount","customerEmail","paymentReference","paymentDescription","currencyCode","contractCode","redirectUrl"],"operations":["send"],"validTriggers":["checkout.started"],"environment":"sandbox","validFrom":"2026-09-01T00:00:00.000Z","reviewAt":"2027-01-01T00:00:00.000Z","expiresAt":null,"owner":"Commerce","approvedBy":"Merchant Security","changeReason":"Managed gateway compatibility contract"}'::jsonb,
 '2026-09-01T00:00:00Z',null
),
(
 'interswitch-checkout','1','interswitch','sandbox',
 '{"contractId":"interswitch-checkout","integrationId":"interswitch","version":"1","purpose":"Create a payment request","resources":["payments"],"fields":["merchantCode","payableCode","amount","redirectUrl","customerId","currencyCode","customerEmail"],"operations":["send"],"validTriggers":["checkout.started"],"environment":"sandbox","validFrom":"2026-09-01T00:00:00.000Z","reviewAt":"2027-01-01T00:00:00.000Z","expiresAt":null,"owner":"Commerce","approvedBy":"Merchant Security","changeReason":"Managed gateway compatibility contract"}'::jsonb,
 '2026-09-01T00:00:00Z',null
),
(
 'sendbox-fulfilment','1','sendbox','sandbox',
 '{"contractId":"sendbox-fulfilment","integrationId":"sendbox","version":"1","purpose":"Create and fulfil a customer shipment","resources":["shipments"],"fields":["origin.first_name","origin.street","origin.state","origin.city","origin.country","origin.phone","destination.first_name","destination.last_name","destination.street","destination.state","destination.city","destination.country","destination.phone","weight","region","service_type","package_type","total_value","currency","channel_code","items[].name","items[].quantity","items[].value"],"operations":["send"],"validTriggers":["order.ready_for_fulfilment"],"environment":"sandbox","validFrom":"2026-09-01T00:00:00.000Z","reviewAt":"2027-01-01T00:00:00.000Z","expiresAt":null,"owner":"Fulfilment","approvedBy":"Merchant Security","changeReason":"Managed gateway compatibility contract"}'::jsonb,
 '2026-09-01T00:00:00Z',null
),
(
 'kwik-fulfilment','1','kwik','production',
 '{"contractId":"kwik-fulfilment","integrationId":"kwik","version":"1","purpose":"Create a last-mile delivery task","resources":["deliveries"],"fields":["pickup.name","pickup.phone","delivery.name","delivery.phone","delivery.address","package.description","package.value"],"operations":["send"],"validTriggers":["order.ready_for_fulfilment"],"environment":"production","validFrom":"2026-09-01T00:00:00.000Z","reviewAt":"2027-01-01T00:00:00.000Z","expiresAt":null,"owner":"Fulfilment","approvedBy":"Merchant Security","changeReason":"Managed gateway compatibility contract"}'::jsonb,
 '2026-09-01T00:00:00Z',null
),
(
 'termii-order-status','1','termii','production',
 '{"contractId":"termii-order-status","integrationId":"termii","version":"1","purpose":"Send an order-status notification","resources":["messages"],"fields":["to","from","sms","type","channel"],"operations":["send"],"validTriggers":["order.status_changed"],"environment":"production","validFrom":"2026-09-01T00:00:00.000Z","reviewAt":"2027-01-01T00:00:00.000Z","expiresAt":null,"owner":"Customer Operations","approvedBy":"Merchant Security","changeReason":"Managed gateway compatibility contract"}'::jsonb,
 '2026-09-01T00:00:00Z',null
),
(
 'sendchamp-order-status','1','sendchamp','sandbox',
 '{"contractId":"sendchamp-order-status","integrationId":"sendchamp","version":"1","purpose":"Send an order-status notification","resources":["messages"],"fields":["to[]","message","sender_name","route"],"operations":["send"],"validTriggers":["order.status_changed"],"environment":"sandbox","validFrom":"2026-09-01T00:00:00.000Z","reviewAt":"2027-01-01T00:00:00.000Z","expiresAt":null,"owner":"Customer Operations","approvedBy":"Merchant Security","changeReason":"Managed gateway compatibility contract"}'::jsonb,
 '2026-09-01T00:00:00Z',null
),
(
 'meta-purchase-attribution','1','meta-capi','production',
 '{"contractId":"meta-purchase-attribution","integrationId":"meta-capi","version":"1","purpose":"Measure approved purchase conversions","resources":["conversions"],"fields":["data[].event_name","data[].event_time","data[].event_id","data[].action_source","data[].user_data.external_id[]","data[].custom_data.currency","data[].custom_data.value","data[].custom_data.order_id","data[].custom_data.content_ids[]"],"operations":["send"],"validTriggers":["order.completed"],"environment":"production","validFrom":"2026-09-01T00:00:00.000Z","reviewAt":"2027-01-01T00:00:00.000Z","expiresAt":null,"owner":"Growth","approvedBy":"Merchant Security","changeReason":"Managed gateway compatibility contract"}'::jsonb,
 '2026-09-01T00:00:00Z',null
),
(
 'ga4-commerce-analytics','1','ga4','production',
 '{"contractId":"ga4-commerce-analytics","integrationId":"ga4","version":"1","purpose":"Measure product and purchase analytics","resources":["analytics.events"],"fields":["client_id","events[].name","events[].params.currency","events[].params.value","events[].params.items[].item_id","events[].params.items[].item_name","events[].params.items[].price","events[].params.items[].quantity"],"operations":["send"],"validTriggers":["product.viewed"],"environment":"production","validFrom":"2026-09-01T00:00:00.000Z","reviewAt":"2027-01-01T00:00:00.000Z","expiresAt":null,"owner":"Analytics","approvedBy":"Merchant Security","changeReason":"Managed gateway compatibility contract"}'::jsonb,
 '2026-09-01T00:00:00Z',null
),
(
 'cedar-analytics-scope','1','cedar-analytics','synthetic-demo',
 '{"contractId":"cedar-analytics-scope","integrationId":"cedar-analytics","version":"1","purpose":"Measure product and purchase analytics","resources":["orders","products"],"fields":["order.id","order.value","product.id","product.category","product.price"],"operations":["send"],"validTriggers":["checkout.completed"],"environment":"synthetic-demo","validFrom":"2026-09-01T00:00:00.000Z","reviewAt":"2027-01-01T00:00:00.000Z","expiresAt":null,"owner":"CEDAR Commerce","approvedBy":"CEDAR Merchant Policy","changeReason":"Analytics may receive commerce measurements but not customer phone"}'::jsonb,
 '2026-09-01T00:00:00Z',null
),
(
 'cedar-delivery-scope','1','cedar-delivery','synthetic-demo',
 '{"contractId":"cedar-delivery-scope","integrationId":"cedar-delivery","version":"1","purpose":"Fulfil the confirmed customer order","resources":["orders","deliveries"],"fields":["order.id","customer.phone","delivery.address","delivery.city","delivery.state","items[].sku","items[].quantity"],"operations":["send"],"validTriggers":["order.ready_for_fulfilment"],"environment":"synthetic-demo","validFrom":"2026-09-01T00:00:00.000Z","reviewAt":"2027-01-01T00:00:00.000Z","expiresAt":null,"owner":"CEDAR Commerce","approvedBy":"CEDAR Merchant Policy","changeReason":"Delivery requires customer contact information"}'::jsonb,
 '2026-09-01T00:00:00Z',null
)
on conflict(contract_id,version) do update set
 integration_id=excluded.integration_id,
 environment=excluded.environment,
 payload=excluded.payload,
 valid_from=excluded.valid_from,
 expires_at=excluded.expires_at;
