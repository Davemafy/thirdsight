import {
  VENDOR_INTELLIGENCE_PROFILES,
  VENDOR_INTELLIGENCE_REVIEWED_AT,
  VENDOR_INTELLIGENCE_VERSION,
  resolveVendorIntelligence,
} from "../src/vendor-intelligence/vendor-intelligence.js";

interface ApiRequest { method?: string }
interface ApiResponse {
  status(code:number):ApiResponse;
  setHeader(name:string,value:string):void;
  json(body:unknown):void;
  end():void;
}

export default function handler(request:ApiRequest,response:ApiResponse):void{
  response.setHeader("Cache-Control","public, max-age=300, stale-while-revalidate=3600");
  if(request.method==="OPTIONS"){response.status(204).end();return;}
  if(request.method!=="GET"){response.status(405).json({error:"METHOD_NOT_ALLOWED"});return;}

  response.status(200).json({
    schemaVersion:"thirdsight-vendor-intelligence-api.v1",
    registryVersion:VENDOR_INTELLIGENCE_VERSION,
    reviewedAt:VENDOR_INTELLIGENCE_REVIEWED_AT,
    authorityBoundary:resolveVendorIntelligence([]).authorityBoundary,
    profiles:VENDOR_INTELLIGENCE_PROFILES,
  });
}
