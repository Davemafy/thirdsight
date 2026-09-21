import { z } from "zod";

export const cartItemSchema = z.object({ variantId: z.string().min(3).max(120), quantity: z.number().int().min(1).max(10) });
export const promoSchema = z.object({ code: z.string().trim().min(2).max(30).transform(v=>v.toUpperCase()) });
export const contactSchema = z.object({ email: z.email(), phone: z.string().regex(/^\+234\d{10}$/,"Use a synthetic Nigerian number such as +2348000000000"), firstName:z.string().trim().min(2).max(60), lastName:z.string().trim().min(2).max(60) });
export const deliverySchema = z.object({ addressLine1:z.string().trim().min(5).max(160), addressLine2:z.string().trim().max(160).optional().default(""), city:z.string().trim().min(2).max(80), state:z.string().trim().min(2).max(80), deliveryMethod:z.enum(["STANDARD","EXPRESS","PICKUP"]) });
export const paymentSchema = z.object({ paymentMethod:z.enum(["TEST_VISA_4242","PAY_ON_DELIVERY","SYNTHETIC_BANK_TRANSFER"]) });
export const orderSchema = z.object({ idempotencyKey:z.string().min(16).max(120) });
export const scenarioSchema = z.object({ scenario:z.enum(["normal","unauthorized-field","flash-sale","proportional-abuse","shadow-integration","stale-crm"]) });

export function validationError(error: z.ZodError) {
  return { error:"VALIDATION_ERROR", fields:Object.fromEntries(error.issues.map(issue=>[issue.path.join("."),issue.message])) };
}
