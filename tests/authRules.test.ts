import { expect, test } from "vitest";
import { authMessage, isEmail, passwordProblem, passwordStrength } from "@/lib/authRules";

test("emails", () => {
  expect(isEmail("a@b.co")).toBe(true);
  expect(isEmail(" runner@example.com ")).toBe(true);
  for (const bad of ["", "a", "a@b", "a@b.", "a b@c.de", "@b.co"]) expect(isEmail(bad)).toBe(false);
});

test("passwords need 8+ characters with letters and a number", () => {
  expect(passwordProblem("short1")).toMatch(/8/);
  expect(passwordProblem("onlyletters")).toMatch(/number/);
  expect(passwordProblem("12345678")).toMatch(/letters/);
  expect(passwordProblem("a".repeat(73) + "1")).toMatch(/72/);
  expect(passwordProblem("runner2026")).toBeNull();
});

test("strength grows with variety and length", () => {
  expect(passwordStrength("abc")).toBe(0);
  expect(passwordStrength("abcdef")).toBe(1);
  expect(passwordStrength("runner2026")).toBe(2);
  expect(passwordStrength("Runner2026!xyz")).toBe(3);
});

test("Supabase errors become plain sentences", () => {
  expect(authMessage({ message: "Invalid login credentials" })).toBe("Wrong email or password.");
  expect(authMessage({ code: "email_not_confirmed", message: "Email not confirmed" })).toMatch(/verify/);
  expect(authMessage({ message: "User already registered" })).toMatch(/already exists/);
  expect(authMessage({ message: "Token has expired or is invalid", code: "otp_expired" })).toMatch(/wrong or has expired/);
  expect(authMessage({ message: "Failed to fetch" })).toMatch(/connection/);
  expect(authMessage(null)).toMatch(/wrong/i);
});
