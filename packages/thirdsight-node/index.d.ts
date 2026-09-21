export interface ThirdSightBusinessEventContext {
  id:string;
  type:string;
  timestamp?:string;
  customerRefHash?:string;
  orderRefHash?:string;
  paymentRefHash?:string;
  deliveryRefHash?:string;
  campaignRef?:string;
}

export interface ThirdSightRequestRefs {
  customerRefHash?:string;
  orderRefHash?:string;
  paymentRefHash?:string;
  deliveryRefHash?:string;
  campaignRef?:string;
}

export interface ThirdSightContext {
  businessEvent?:ThirdSightBusinessEventContext;
  requestRefs?:ThirdSightRequestRefs;
}

export interface ThirdSightOptions {
  baseUrl:string;
  apiKey:string;
  environment?:string;
  fetch?:typeof fetch;
}

export interface ThirdSightRequestOptions {
  method?:string;
  body?:Record<string,unknown>;
  headers?:HeadersInit;
  context?:ThirdSightContext;
}

export declare class ThirdSight {
  constructor(options:ThirdSightOptions);
  integration(integrationId:string):ThirdSightIntegration;
  request(integrationId:string,path:string,options?:ThirdSightRequestOptions):Promise<Response>;
}

export declare class ThirdSightIntegration {
  readonly id:string;
  fetch(path:string,options?:ThirdSightRequestOptions):Promise<Response>;
  request(path:string,options?:ThirdSightRequestOptions):Promise<Response>;
}