import { z } from "zod";

export const cartItemSchema = z.object({
  productId: z.string(),
  variantId: z.string().nullable().optional(),
  qty: z.number().int().positive(),
  priceMinorSnapshot: z.number().int().nonnegative(),
});
export type CartItem = z.infer<typeof cartItemSchema>;

export const addToCartSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1).nullable().optional(),
  qty: z.number().int().positive().max(999).default(1),
});

export const updateCartItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1).nullable().optional(),
  qty: z.number().int().min(0).max(999),
});

export const removeCartItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1).nullable().optional(),
});
