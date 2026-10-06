import type { Page, Request, Response } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

// Diagnostic metadata only: never persist headers, query, body or DOM text.
export async function gotoWithEvidence(page: Page, route: string, file: string) {
  const started = Date.now();
  type Timing = { startTime: number; domainLookupStart: number; domainLookupEnd: number; connectStart: number; secureConnectionStart: number; connectEnd: number; requestStart: number; responseStart: number; responseEnd: number };
  const entries = new Map<Request, { method: string; path: string; status: number | null; pending: boolean; startedMs: number; respondedMs?: number; endedMs?: number; failed?: boolean; timing?: Timing }>();
  const states: { label: string; elapsedMs: number; readyState: string }[] = [];
  const proof = { startedUTC: new Date(started).toISOString(), stage: 'before-goto', elapsedMs: 0, entries: [] as unknown[], states };
  let active = true;
  let writes = Promise.resolve();
  const persist = () => {
    proof.elapsedMs = Date.now() - started;
    proof.entries = [...entries.values()];
    const snapshot = JSON.stringify(proof, null, 2);
    writes = writes.then(() => writeFile(file, snapshot)).catch(() => undefined);
  };
  const state = async (label: string) => {
    let readyState = 'unavailable';
    try { readyState = await page.evaluate(() => document.readyState); } catch { /* no message/body persisted */ }
    if (!active) return;
    states.push({ label, elapsedMs: Date.now() - started, readyState }); persist();
  };
  const requested = (request: Request) => {
    const url = new URL(request.url());
    if (!['http://localhost:5173', 'http://localhost:4000'].includes(url.origin)) return;
    entries.set(request, { method: request.method(), path: url.pathname, status: null, pending: true, startedMs: Date.now() - started }); persist();
  };
  const responded = (response: Response) => {
    const entry = entries.get(response.request());
    if (entry) { entry.status = response.status(); entry.respondedMs = Date.now() - started; entry.timing = response.request().timing(); persist(); }
  };
  const finished = (request: Request) => {
    const entry = entries.get(request);
    if (entry) { entry.pending = false; entry.endedMs = Date.now() - started; entry.timing = request.timing(); persist(); }
  };
  const failed = (request: Request) => {
    const entry = entries.get(request);
    if (entry) { entry.failed = true; finished(request); }
  };
  const domReady = () => { void state('domcontentloaded'); };
  const loaded = () => { void state('load'); };
  page.on('request', requested); page.on('response', responded);
  page.on('requestfinished', finished); page.on('requestfailed', failed);
  page.on('domcontentloaded', domReady); page.on('load', loaded);
  let sampling = false;
  const timer = setInterval(() => {
    for (const [request, entry] of entries) if (entry.pending) entry.timing = request.timing();
    persist();
    if (!sampling) { sampling = true; void state('pending-goto').finally(() => { sampling = false; }); }
  }, 2000);
  try {
    persist(); await writes; await state('before-goto');
    proof.stage = 'goto-waiting-load'; persist(); await writes;
    // Preserve default load wait, callers' routes, and the existing 45s deadline.
    await page.goto(route);
    proof.stage = 'goto-completed'; await state('after-goto');
  } catch (error) {
    proof.stage = 'goto-failed'; await state('after-failure'); throw error;
  } finally {
    active = false; clearInterval(timer);
    page.off('request', requested); page.off('response', responded);
    page.off('requestfinished', finished); page.off('requestfailed', failed);
    page.off('domcontentloaded', domReady); page.off('load', loaded);
    persist(); await writes; await writeFile(file, JSON.stringify(proof, null, 2));
  }
}
