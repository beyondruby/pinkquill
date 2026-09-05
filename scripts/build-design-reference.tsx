/** Rebuild the local appearance reference from the real Button and app CSS.
 * No Next route, authentication, backend call, or production fixture import. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";
import Button, { type ButtonVariant } from "../components/ui/Button";
import Sheet from "../components/ui/Sheet";
import ConfirmationModal from "../components/ui/ConfirmationModal";
import { THEMES } from "../lib/theme/registry";

async function build() {
  const root = process.cwd();
  const output = path.join(root, "docs/pinkquill-2/foundations");
  await mkdir(output, { recursive: true });
  const cssPath = path.join(root, "app/globals.css");
  const css = await postcss([tailwindcss({ base: root, optimize: true })]).process(await readFile(cssPath, "utf8"), { from: cssPath });
  await writeFile(path.join(output, "app.css"), css.css);

  const variants: [ButtonVariant, string][] = [
    ["primary", "Save changes"], ["secondary", "Not now"], ["outline", "Request revision"],
    ["outline-gradient", "Publish"], ["ghost", "View studio"], ["danger", "Delete draft"],
  ];
  const markup = renderToStaticMarkup(
    <main className="reference">
      <p className="reference-note">Pinkquill 2.0 · Shared foundations · Local appearance reference</p>
      <h1>Small details. One familiar feeling.</h1>
      <p>These are the application’s real Button component and compiled stylesheet. Controls below are inert examples.</p>
      <label className="theme-select">Appearance <select id="theme-select" defaultValue="default">{Object.values(THEMES).map(theme => <option key={theme.id} value={theme.id}>{theme.label}</option>)}</select></label>
      <section className="reference-panel" aria-labelledby="variants-title">
        <h2 id="variants-title">Actions, with a clear purpose</h2>
        <div className="variant-grid">{variants.map(([variant, label]) => <div key={variant}><p>{variant === "outline-gradient" ? "Composer accent (compatible variant)" : variant}</p><Button type="button" variant={variant}>{label}</Button></div>)}</div>
      </section>
      <section className="reference-panel" aria-labelledby="states-title">
        <h2 id="states-title">Progress and availability</h2>
        <div className="variant-grid"><div><p>Pending</p><Button loading loadingText="Saving…">Save changes</Button></div><div><p>Unavailable</p><Button disabled>Approve delivery</Button></div><div><p>Pending destructive action</p><Button variant="danger" loading loadingText="Deleting…">Delete draft</Button></div></div>
      </section>
      <section className="reference-panel" aria-labelledby="sizes-title">
        <h2 id="sizes-title">Comfortable targets, flexible labels</h2>
        <div className="variant-grid"><div><p>Small · 44px minimum target</p><Button size="sm">Follow</Button></div><div><p>Default</p><Button>Send message</Button></div><div><p>Large</p><Button size="lg">Create something</Button></div></div>
        <div className="narrow-example"><Button fullWidth variant="outline">Request a revision to your original illustration</Button></div>
      </section>
      <section className="reference-panel" aria-labelledby="overlays-title">
        <h2 id="overlays-title">Focused tasks and short decisions</h2>
        <p className="reference-note">The real Sheet and ConfirmationModal, rendered inline. In the app they float over a scrim; on phones the sheet rises from the bottom edge.</p>
        <div className="overlay-grid">
          <div className="overlay-inline">
            <Sheet isOpen onClose={() => {}} title="Request a revision" subtitle="Revision 1 of 2 · 1 left after this. Be specific: what to keep, what to change." footer={<><Button variant="secondary">Not now</Button><Button>Send revision request</Button></>}>
              <label className="reference-field"><span>What should change?</span><textarea rows={3} readOnly value="Could the sky be a little warmer, like the first sketch?" /></label>
            </Sheet>
          </div>
          <div className="overlay-inline">
            <ConfirmationModal isOpen onClose={() => {}} onConfirm={() => {}} title="Erase this from your studio?" description="The post, its admires, and the conversation around it will fade for good." confirmText="Erase it" isDanger />
          </div>
        </div>
        <div className="overlay-inline overlay-inline--menu">
          <div className="pq-menu" role="menu" aria-label="Post actions (static example)">
            <button type="button" role="menuitem" className="pq-menu__item"><span className="pq-menu__text"><span className="pq-menu__label">Share</span></span></button>
            <button type="button" role="menuitem" className="pq-menu__item"><span className="pq-menu__text"><span className="pq-menu__label">Save to collection</span><span className="pq-menu__description">Keep it somewhere you’ll find it</span></span></button>
            <div className="pq-menu__divider" role="separator" />
            <button type="button" role="menuitem" className="pq-menu__item pq-menu__item--warning"><span className="pq-menu__text"><span className="pq-menu__label">Report</span></span></button>
            <button type="button" role="menuitem" className="pq-menu__item pq-menu__item--danger"><span className="pq-menu__text"><span className="pq-menu__label">Erase</span></span></button>
          </div>
        </div>
      </section>
      <p className="reference-note">Theme changes apply only to this local document. No account preference is saved. Tab through enabled controls to inspect focus.</p>
    </main>
  );
  const html = `<!doctype html>
  <html lang="en" data-theme="default"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Pinkquill 2.0 · Shared controls</title><link rel="icon" href="../prototype/assets/icon.svg"><link rel="stylesheet" href="app.css"><link rel="stylesheet" href="reference.css"></head><body>${markup}<script>document.getElementById('theme-select').addEventListener('change', function () { document.documentElement.dataset.theme = this.value; });</script></body></html>`;
  await writeFile(path.join(output, "index.html"), html);
  console.log("Built docs/pinkquill-2/foundations/index.html from Button/Sheet/ConfirmationModal and app/globals.css");
}

build().catch(error => { console.error(error); process.exitCode = 1; });
