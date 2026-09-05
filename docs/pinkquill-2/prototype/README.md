# Connected design proof

Open `index.html` directly, or from the repository root run:

```sh
python3 -m http.server 4317 --bind 127.0.0.1 --directory docs/pinkquill-2/prototype
```

Then visit <http://127.0.0.1:4317/>. No install or build is required for the preview. Fonts, illustrations, audio, icons, CSS, and JavaScript are local. The sample state resets on reload.

## Review route

1. Home: try Gallery, Classic, and Stream; open a work, save/react, play the sound sketch, and open a creator.
2. Communities: visit The Making Room, its About/Members tabs, join/leave, rules, and contribution entry.
3. Studios: compare Lina's mixed-media studio, Eli's text-only studio, and Noor's own studio. Open Lina's commission scope and request form.
4. Orders: inspect Delivery, Messages, Brief & scope, and Activity. Request a revision or confirm approval; reload to restore the submitted delivery.
5. Resize to a phone, open More, notifications, creation choices, and the longer creation form. Switch appearance and populated/empty/loading/error states in the preview ribbon.

## Scope

All people, works, messages, counts, products, orders, and prices are fictional fixtures. No authentication, uploads, publishing, payment, or account mutation is connected. Existing action eligibility was referenced from `components/orders/OrderActionBar.tsx`; local state transitions are illustrative, not an implementation of its server rules.

Post text, draft text/audience, follows, saves, reactions, local comments, community membership, and order messages/decisions work during this browser session. Form file selections are not uploaded or retained across rerenders. Profile editing, reporting, blocking, and commission requests demonstrate presentation/confirmation only. The dance asset is explicitly a video poster; audio playback uses a locally synthesized 12-second fixture. Downloads return the sample artwork. The USD listing fixture does not redefine production charge/settlement currency.

Other destinations show their existing route and later-phase boundary. The full composer controls, all role/state permutations, playback, filters, and other production features remain in the route plan. The Gallery preview default does not change the saved production feed preference. The purple Noir experiment does not replace production Noir's cyan identity or retire any theme.

See [design decisions and QA](../06-design-proof.md) and [asset provenance](assets/README.md).

## Behavior checks

With the repository dependencies installed:

```sh
node --check docs/pinkquill-2/prototype/prototype.js
node docs/pinkquill-2/prototype/verify.mjs
npx eslint docs/pinkquill-2/prototype/prototype.js docs/pinkquill-2/prototype/verify.mjs
```

The 13 JSDOM checks cover local behavior. They stub layout, audio, and native dialog methods; they do not certify browser layout, media playback, or native keyboard behavior.
