/**
 * Downloads one upload of a free (or pay-what-you-want) itch.io page, as the page's own "No thanks, just take me to
 * the downloads" does: Kenney's and Quaternius's CC0 packs, for instance.
 *
 * `npx tsx scripts/fetch-itch.ts <page url> <part of the upload's file name> <out file>`
 * e.g. `npx tsx scripts/fetch-itch.ts https://quaternius.itch.io/universal-base-characters Standard ubc.zip`
 *
 * The flow, as itch.io's own script runs it: the page's CSRF token buys a download page; that page's token, posted to
 * `/file/<upload id>` (without the download page's key, which the site refuses), answers with the file's CDN URL.
 */
import { writeFile } from 'node:fs/promises';

const [page, wanted, out] = process.argv.slice(2);
if (!page || !wanted || !out) throw new Error('Pass the page URL, part of the upload’s file name, and the file to write.');

const cookies = new Map<string, string>();

/** Fetches with the cookies the site has set so far, keeping any it sets now. */
async function request(url: string, init: RequestInit = {}) {
  const cookie = [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  const response = await fetch(url, { ...init, headers: { cookie, ...init.headers } });
  for (const set of response.headers.getSetCookie()) {
    const [pair = ''] = set.split(';');
    const at = pair.indexOf('=');
    cookies.set(pair.slice(0, at), pair.slice(at + 1));
  }
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response;
}

/** A form post of a page's CSRF token, as the site's script sends it. */
function postToken(html: string, referer?: string): RequestInit {
  const token = html.match(/name="csrf_token" value="([^"]*)"/)?.[1];
  if (!token) throw new Error('No CSRF token on the page.');
  return {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-requested-with': 'XMLHttpRequest', ...(referer && { referer }) },
    body: new URLSearchParams({ csrf_token: token }).toString(),
  };
}

const gameHtml = await (await request(page)).text();
const { url: downloadPage } = (await (await request(`${page}/download_url`, postToken(gameHtml))).json()) as { url: string };
const downloadHtml = await (await request(downloadPage)).text();
const uploads = [...downloadHtml.matchAll(/data-upload_id="(\d+)"[\s\S]*?title="([^"]*)"/g)].map(([, id, name]) => ({ id, name: name! }));
const upload = uploads.find(({ name }) => name.includes(wanted));
if (!upload) throw new Error(`No upload named like “${wanted}”. There are: ${uploads.map(({ name }) => name).join(', ')}`);

const query = new URLSearchParams({ source: 'game_download', after_download_lightbox: '1', as_props: '1' });
const file = (await (await request(`${page}/file/${upload.id}?${query}`, postToken(downloadHtml, downloadPage))).json()) as { url?: string; errors?: string[] };
if (!file.url) throw new Error(`itch.io refused the download: ${file.errors?.join(', ') ?? 'no URL'}`);

await writeFile(out, Buffer.from(await (await fetch(file.url)).arrayBuffer()));
console.log(`Wrote ${upload.name} to ${out}`);
