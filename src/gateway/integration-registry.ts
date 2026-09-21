import type { GatewayIntegration } from "./gateway-types.js";

const integrations:readonly GatewayIntegration[]=[
  {
    id:"paystack",name:"Paystack",environment:"production",upstreamOrigin:"https://api.paystack.co",
    allowedRoutes:[{method:"POST",path:"/transaction/initialize"}],
    allowedContentTypes:["application/json"],auth:{kind:"BEARER",env:"PAYSTACK_SECRET_KEY"},
    failureMode:"CLOSED",unsupportedPayloadMode:"BLOCK",timeoutMs:8_000,maxBodyBytes:256_000,
    compatibilityStatus:"CONTROLLED_RECEIVER",documentationUrl:"https://paystack.com/docs/api/transaction/",
  },
  {
    id:"flutterwave",name:"Flutterwave",environment:"production",upstreamOrigin:"https://api.flutterwave.com",
    allowedRoutes:[{method:"POST",path:"/v3/payments"}],
    allowedContentTypes:["application/json"],auth:{kind:"BEARER",env:"FLUTTERWAVE_SECRET_KEY"},
    failureMode:"CLOSED",unsupportedPayloadMode:"BLOCK",timeoutMs:8_000,maxBodyBytes:256_000,
    compatibilityStatus:"CONTROLLED_RECEIVER",documentationUrl:"https://developer.flutterwave.com/reference/checkout",
  },
  {
    id:"monnify",name:"Monnify",environment:"sandbox",upstreamOrigin:"https://sandbox.monnify.com",
    allowedRoutes:[{method:"POST",path:"/api/v1/merchant/transactions/init-transaction"}],
    allowedContentTypes:["application/json"],auth:{kind:"BEARER",env:"MONNIFY_ACCESS_TOKEN"},
    failureMode:"CLOSED",unsupportedPayloadMode:"BLOCK",timeoutMs:8_000,maxBodyBytes:256_000,
    compatibilityStatus:"CONTROLLED_RECEIVER",documentationUrl:"https://developers.monnify.com/docs/collections/quickstart",
  },
  {
    id:"interswitch",name:"Interswitch Webpay",environment:"sandbox",upstreamOrigin:"https://sandbox.interswitchng.com",
    allowedRoutes:[{method:"POST",path:"/paymentgateway/api/v1/paybill"}],
    allowedContentTypes:["application/json"],auth:{kind:"NONE"},
    failureMode:"CLOSED",unsupportedPayloadMode:"BLOCK",timeoutMs:8_000,maxBodyBytes:256_000,
    compatibilityStatus:"CONTROLLED_RECEIVER",documentationUrl:"https://docs.interswitchgroup.com/docs/quickstart-accept-your-first-payment-in-5-minutes",
  },
  {
    id:"sendbox",name:"Sendbox",environment:"sandbox",upstreamOrigin:"https://sandbox.staging.sendbox.co",
    allowedRoutes:[{method:"POST",path:"/shipping/shipments"}],
    allowedContentTypes:["application/json"],auth:{kind:"HEADER",env:"SENDBOX_ACCESS_TOKEN",header:"authorization"},
    failureMode:"CLOSED",unsupportedPayloadMode:"BLOCK",timeoutMs:10_000,maxBodyBytes:512_000,
    compatibilityStatus:"CONTROLLED_RECEIVER",documentationUrl:"https://docs.sendbox.co/shipping/create-new-shipment",
  },
  {
    id:"kwik",name:"Kwik Delivery",environment:"production",upstreamOrigin:null,upstreamOriginEnv:"THIRDSIGHT_KWIK_UPSTREAM_ORIGIN",
    allowedRoutes:[{method:"POST",path:"/tasks"}],
    allowedContentTypes:["application/json"],auth:{kind:"HEADER",env:"KWIK_API_KEY",header:"authorization"},
    failureMode:"CLOSED",unsupportedPayloadMode:"BLOCK",timeoutMs:10_000,maxBodyBytes:512_000,
    compatibilityStatus:"SCHEMA_COMPATIBLE",documentationUrl:"https://kwik.delivery/home/developer/",
  },
  {
    id:"termii",name:"Termii",environment:"production",upstreamOrigin:"https://api.ng.termii.com",
    allowedRoutes:[{method:"POST",path:"/api/sms/send"}],
    allowedContentTypes:["application/json"],auth:{kind:"BODY_FIELD",env:"TERMII_API_KEY",field:"api_key"},
    failureMode:"ALLOW_AND_AUDIT",unsupportedPayloadMode:"BLOCK",timeoutMs:8_000,maxBodyBytes:128_000,
    compatibilityStatus:"CONTROLLED_RECEIVER",documentationUrl:"https://developer.termii.com/",
  },
  {
    id:"sendchamp",name:"Sendchamp",environment:"sandbox",upstreamOrigin:"https://sandbox-api.sendchamp.com",
    allowedRoutes:[{method:"POST",path:"/api/v1/sms/send"}],
    allowedContentTypes:["application/json"],auth:{kind:"BEARER",env:"SENDCHAMP_ACCESS_KEY"},
    failureMode:"ALLOW_AND_AUDIT",unsupportedPayloadMode:"BLOCK",timeoutMs:8_000,maxBodyBytes:128_000,
    compatibilityStatus:"CONTROLLED_RECEIVER",documentationUrl:"https://sendchamp.readme.io/reference/send-sms-api",
  },
  {
    id:"meta-capi",name:"Meta Conversions API",environment:"production",upstreamOrigin:"https://graph.facebook.com",
    allowedRoutes:[{method:"POST",path:"/v25.0/:pixelId/events"}],
    allowedContentTypes:["application/json"],auth:{kind:"QUERY_PARAM",env:"META_CAPI_ACCESS_TOKEN",param:"access_token"},
    failureMode:"ALLOW_AND_AUDIT",unsupportedPayloadMode:"BLOCK",timeoutMs:8_000,maxBodyBytes:1_000_000,
    compatibilityStatus:"CONTROLLED_RECEIVER",documentationUrl:"https://developers.facebook.com/docs/marketing-api/conversions-api",
  },
  {
    id:"ga4",name:"Google Analytics 4",environment:"production",upstreamOrigin:"https://www.google-analytics.com",
    allowedRoutes:[{method:"POST",path:"/mp/collect",allowedQueryKeys:["measurement_id"]}],
    allowedContentTypes:["application/json"],auth:{kind:"QUERY_PARAM",env:"GA4_API_SECRET",param:"api_secret"},
    failureMode:"ALLOW_AND_AUDIT",unsupportedPayloadMode:"BLOCK",timeoutMs:8_000,maxBodyBytes:256_000,
    compatibilityStatus:"CONTROLLED_RECEIVER",documentationUrl:"https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference",
  },
];

const commerceLabIntegrations:readonly GatewayIntegration[]=[
  {
    id:"cedar-analytics",name:"CEDAR Analytics",environment:"synthetic-demo",upstreamOrigin:null,upstreamOriginEnv:"PARTNER_MANAGED_ORIGIN",
    allowedRoutes:[{method:"POST",path:"/ingest/managed/analytics"}],
    allowedContentTypes:["application/json"],auth:{kind:"BEARER",env:"PARTNER_MANAGED_TOKEN"},
    failureMode:"CLOSED",unsupportedPayloadMode:"BLOCK",timeoutMs:5_000,maxBodyBytes:128_000,
    compatibilityStatus:"CONTROLLED_RECEIVER",documentationUrl:"internal:cedar-partner-lab",
  },
  {
    id:"cedar-delivery",name:"CEDAR Delivery",environment:"synthetic-demo",upstreamOrigin:null,upstreamOriginEnv:"PARTNER_MANAGED_ORIGIN",
    allowedRoutes:[{method:"POST",path:"/ingest/managed/delivery"}],
    allowedContentTypes:["application/json"],auth:{kind:"BEARER",env:"PARTNER_MANAGED_TOKEN"},
    failureMode:"CLOSED",unsupportedPayloadMode:"BLOCK",timeoutMs:5_000,maxBodyBytes:256_000,
    compatibilityStatus:"CONTROLLED_RECEIVER",documentationUrl:"internal:cedar-partner-lab",
  },
];

const allIntegrations=[...integrations,...commerceLabIntegrations];

export const NIGERIA_ECOMMERCE_INTEGRATIONS=integrations;

export function resolveGatewayIntegration(
  integrationId:string,
  environment:string|undefined,
  env:Record<string,string|undefined>=readRuntimeEnv(),
):GatewayIntegration|null{
  const candidates=allIntegrations.filter((item)=>item.id===integrationId);
  const base=environment
    ?candidates.find((item)=>item.environment===environment)
    :candidates.length===1?candidates[0]:undefined;
  if(!base) return null;
  const upstream=base.upstreamOriginEnv?env[base.upstreamOriginEnv]?.trim()||base.upstreamOrigin:base.upstreamOrigin;
  return {...base,upstreamOrigin:upstream};
}

function readRuntimeEnv():Record<string,string|undefined>{
  const runtime=globalThis as typeof globalThis & {process?:{env?:Record<string,string|undefined>}};
  return runtime.process?.env??{};
}
