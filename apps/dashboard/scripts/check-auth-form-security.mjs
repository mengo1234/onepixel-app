import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const cases = [
  {
    name: "login",
    component: "src/components/login-form.tsx",
    route: "src/app/api/session/route.ts",
    action: "/api/session",
  },
  {
    name: "registrazione",
    component: "src/components/register-form.tsx",
    route: "src/app/api/register/route.ts",
    action: "/api/register",
  },
];

for (const testCase of cases) {
  const component = readFileSync(testCase.component, "utf8");
  const route = readFileSync(testCase.route, "utf8");
  const formTag = component.match(/<form\b[^>]*>/)?.[0] ?? "";

  assert.match(formTag, /method="post"/, `Il form ${testCase.name} deve usare POST`);
  assert.ok(formTag.includes(`action="${testCase.action}"`), `Il form ${testCase.name} deve inviare a ${testCase.action}`);
  assert.doesNotMatch(formTag, /method="get"/i, `Il form ${testCase.name} non deve mai usare GET`);
  assert.match(route, /request\.formData\(\)/, `La route ${testCase.name} deve supportare il fallback HTML senza JavaScript`);
  assert.match(route, /NextResponse\.redirect/, `La route ${testCase.name} deve completare il fallback con un redirect sicuro`);
}

console.log("Auth forms: POST semantico e fallback senza JavaScript verificati.");
