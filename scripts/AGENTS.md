# scripts

Offline asset builds, run by hand. Their output is committed, and the game never imports these scripts.

**Rules**
- Each script names, in its header, the sources it reads, where to get them and their licence. Sources too big for the repo stay out of it.
- Rebuild an asset with its script instead of editing the output by hand.

**Testing**: no unit tests. Run the script, then look at the result in the running game (`npm run dev`) and run the Playwright smoke.

`npm run build:characters -- <folder with the unzipped Quaternius packs>`
