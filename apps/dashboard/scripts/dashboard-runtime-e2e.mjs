import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const dashboardDirectory = resolve(scriptDirectory, "..");
const repositoryDirectory = resolve(dashboardDirectory, "../..");
const controlPlaneDirectory = join(repositoryDirectory, "services/control-plane");
const dashboardPort = Number(process.env.ONEPIXEL_E2E_DASHBOARD_PORT ?? 3210);
const apiPort = Number(process.env.ONEPIXEL_E2E_API_PORT ?? 4210);
const dashboardUrl = `http://127.0.0.1:${dashboardPort}`;
const apiUrl = `http://127.0.0.1:${apiPort}`;
const dataDirectory = await mkdtemp(join(tmpdir(), "onepixel-dashboard-e2e-"));
const children = [];

function start(command, args, options) {
  const output = [];
  const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", (chunk) => output.push(chunk.toString()));
  child.stderr.on("data", (chunk) => output.push(chunk.toString()));
  child.output = output;
  children.push(child);
  return child;
}

async function waitFor(url, child, label) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`${label} terminato prima dell'avvio:\n${child.output.join("")}`);
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status < 500) return;
    } catch {}
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 150));
  }
  throw new Error(`${label} non pronto entro 30 secondi:\n${child.output.join("")}`);
}

function visibleText(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&apos;|&#x27;|&#39;/g, "'")
    .replace(/&quot;|&#x22;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function responseCookies(response) {
  const headers = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie")].filter(Boolean);
  return headers.map((value) => value.split(";", 1)[0]).join("; ");
}

async function loginAs(email, password, expectedRole) {
  const response = await fetch(`${dashboardUrl}/api/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).user.role, expectedRole);
  const cookies = responseCookies(response);
  assert.match(cookies, /onepixel_session=/);
  return cookies;
}

async function expectPages(cookies, paths) {
  for (const path of paths) {
    const response = await fetch(`${dashboardUrl}${path}`, {
      headers: { cookie: `${cookies}; onepixel_dashboard_locale=en` },
      redirect: "manual",
    });
    assert.equal(response.status, 200, `${path} deve rispondere 200`);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html/, `${path} deve restituire HTML`);
  }
}

try {
  await readFile(join(dashboardDirectory, ".next/BUILD_ID"), "utf8");

  const api = start(
    process.execPath,
    [join(controlPlaneDirectory, "node_modules/tsx/dist/cli.mjs"), "src/server.ts"],
    {
      cwd: controlPlaneDirectory,
      env: {
        ...process.env,
        HOST: "127.0.0.1",
        PORT: String(apiPort),
        ONEPIXEL_DATABASE: join(dataDirectory, "database"),
        ONEPIXEL_STORAGE: join(dataDirectory, "storage"),
        ONEPIXEL_QR_SECRET: "onepixel-e2e-secret-at-least-32-characters",
        ONEPIXEL_DEMO_SEED: "true",
        ONEPIXEL_PAYMENT_MODE: "mock",
      },
    },
  );
  await waitFor(`${apiUrl}/health`, api, "control-plane");

  const dashboard = start(
    process.execPath,
    [join(dashboardDirectory, "node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(dashboardPort)],
    {
      cwd: dashboardDirectory,
      env: {
        ...process.env,
        ONEPIXEL_API_URL: apiUrl,
        ONEPIXEL_COOKIE_SECURE: "false",
      },
    },
  );
  await waitFor(`${dashboardUrl}/login`, dashboard, "dashboard");

  const italianLogin = await fetch(`${dashboardUrl}/login`);
  assert.equal(italianLogin.status, 200);
  assert.match(italianLogin.headers.get("content-type") ?? "", /^text\/html/);
  assert.match(await italianLogin.text(), /<html lang="it"/);

  const englishLogin = await fetch(`${dashboardUrl}/login`, { headers: { cookie: "onepixel_dashboard_locale=en" } });
  assert.equal(englishLogin.status, 200);
  const englishLoginHtml = await englishLogin.text();
  const englishLoginText = visibleText(englishLoginHtml);
  assert.match(englishLoginHtml, /<html lang="en"/);
  assert.match(englishLoginText, /Organization sign-in/);
  assert.match(englishLoginText, /Open control room/);
  assert.doesNotMatch(englishLoginText, /Accesso organizzazioni|Accedi alla regia|Non hai un account/);

  const authenticatedCookies = await loginAs("regia@arenanord.it", "Arena!2026", "organization_admin");

  const dashboardPage = await fetch(`${dashboardUrl}/dashboard`, {
    headers: { cookie: `${authenticatedCookies}; onepixel_dashboard_locale=en` },
    redirect: "manual",
  });
  assert.equal(dashboardPage.status, 200);
  const dashboardText = visibleText(await dashboardPage.text());
  assert.match(dashboardText, /Operational overview|Venues and configurations/);
  assert.doesNotMatch(dashboardText, /Panoramica operativa|Strutture e configurazioni/);

  const venueWizard = await fetch(`${dashboardUrl}/venues/new`, {
    headers: { cookie: `${authenticatedCookies}; onepixel_dashboard_locale=en` },
    redirect: "manual",
  });
  assert.equal(venueWizard.status, 200);
  const venueWizardText = visibleText(await venueWizard.text());
  assert.match(venueWizardText, /Build any space from above/);
  assert.match(venueWizardText, /RINGS AND SECTIONS|Number of rings/);
  assert.doesNotMatch(venueWizardText, /ANELLI E SETTORI|Numero anelli/);

  await expectPages(authenticatedCookies, [
    "/checkout",
    "/events",
    "/reports",
    "/settings",
    "/venues",
    "/venues/venue_arena_nord/edit",
    "/events/event_finale_luce/edit",
    "/events/event_finale_luce/live",
    "/events/event_finale_luce/studio",
    "/events/event_finale_luce/upgrade",
  ]);

  const adminCookies = await loginAs("admin@onepixel.local", "OnePixel!2026", "super_admin");
  await expectPages(adminCookies, [
    "/admin/organizations",
    "/admin/users",
    "/admin/payments",
    "/admin/events",
  ]);

  console.log("Dashboard E2E: IT/EN SSR, login pubblico, sessione e 16 pagine protette verificate.");
} finally {
  for (const child of children.reverse()) {
    if (child.exitCode === null) child.kill("SIGTERM");
  }
}
