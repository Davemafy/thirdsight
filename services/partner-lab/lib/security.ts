import{createHmac,timingSafeEqual}from"node:crypto";
export function sign(secret:string,timestamp:string,requestId:string,body:string){return createHmac("sha256",secret).update(`${timestamp}.${requestId}.${body}`).digest("hex")}
export function equal(a:string,b:string){const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&timingSafeEqual(aa,bb)}
