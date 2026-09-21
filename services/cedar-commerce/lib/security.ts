import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function newSessionToken() { return randomBytes(32).toString("base64url"); }
export function hashToken(token:string) { return createHash("sha256").update(token).digest("hex"); }
export function hmac(secret:string, timestamp:string, body:string) { return createHmac("sha256",secret).update(`${timestamp}.${body}`).digest("hex"); }
export function safeEqual(a:string,b:string) { const aa=Buffer.from(a); const bb=Buffer.from(b); return aa.length===bb.length && timingSafeEqual(aa,bb); }
