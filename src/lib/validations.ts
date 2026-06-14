import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const personSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().max(100).optional().default(""),
  middleNames: z.string().trim().max(200).optional(),
  nickname: z.string().trim().max(100).optional(),
  gender: z.enum(["MALE", "FEMALE", "UNKNOWN"]).default("UNKNOWN"),
  birthDate: z.string().trim().max(100).optional(),
  birthPlace: z.string().trim().max(200).optional(),
  deathDate: z.string().trim().max(100).optional(),
  deathPlace: z.string().trim().max(200).optional(),
  occupation: z.string().trim().max(200).optional(),
  biography: z.string().trim().max(5000).optional(),
  notes: z.string().trim().max(5000).optional(),
});

export const quickRelativeSchema = z.object({
  kind: z.enum(["parent", "child", "sibling", "partner"]),
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().max(100).optional().default(""),
  gender: z.enum(["MALE", "FEMALE", "UNKNOWN"]).default("UNKNOWN"),
  birthDate: z.string().trim().max(100).optional(),
  deathDate: z.string().trim().max(100).optional(),
});

export const treeSchema = z.object({
  name: z.string().trim().min(1, "Tree name is required").max(120),
  description: z.string().trim().max(500).optional(),
});

export type PersonInput = z.infer<typeof personSchema>;
export type QuickRelativeInput = z.infer<typeof quickRelativeSchema>;
