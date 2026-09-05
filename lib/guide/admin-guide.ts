import type { Guide } from "./types";

/**
 * The super-admin guide, shown inside the admin on the Maintenance page.
 * Written against a full walk-through of the running app, so the steps match
 * the actual screens. Images live in /public/guide/admin.
 */
export const ADMIN_GUIDE: Guide = {
  title: "Super admin guide",
  lede: "How the admin is laid out, and how to run the day-to-day work across all six divisions.",
  updated: "Last checked against the running app on 5 September 2026.",
  sections: [
    {
      id: "layout",
      title: "Getting around",
      lede: "The admin is split in two, and almost everything can be reached without the sidebar.",
      blocks: [
        {
          kind: "definitions",
          items: [
            {
              term: "Operations and Company",
              def: "The switch in the top bar. Operations is the trading side: storefronts, orders, inventory, sellers, the divisions. Company is the internal side: the document vault, the chat inbox, contact messages, content and careers.",
            },
            {
              term: "Favourites and Recent",
              def: "Hover any sidebar item and press the star to pin it. Favourites and the pages you visited most recently sit at the top of the sidebar and follow your account, not the browser.",
            },
            {
              term: "Ctrl+K",
              def: "Searches records as well as pages. Type an order number, a SKU, a customer name, a seller or a case reference and go straight there.",
            },
            {
              term: "The bell",
              def: "New orders, refund requests, quotations, leads, seller applications and low-stock warnings. Clicking an item takes you to the record and marks it read.",
            },
            {
              term: "Light and dark",
              def: "The sun icon switches theme. The choice is stored per browser and applies only to the admin.",
            },
          ],
        },
        {
          kind: "figure",
          figure: {
            src: "admin-dashboard",
            caption:
              "The dashboard. KPIs across the top, then what needs attention, revenue over the last 30 days and recent activity.",
            wide: true,
          },
        },
        {
          kind: "figure",
          figure: {
            src: "admin-command-palette",
            caption:
              "Ctrl+K anywhere in the admin. It finds records, not just pages.",
            wide: true,
          },
        },
        {
          kind: "callout",
          tone: "note",
          title: "Every list works the same way",
          body: "Search, filter pills, a date range, sortable column headers, a page size and a row menu. Whatever you choose is written into the web address, so a filtered list can be bookmarked or pasted to a colleague and they will see exactly what you see.",
        },
      ],
    },

    {
      id: "orders",
      title: "Orders",
      lede: "Both storefronts feed one list. Payment and fulfilment are tracked separately, because they do not always happen in that order.",
      blocks: [
        {
          kind: "figure",
          figure: {
            src: "admin-orders",
            caption:
              "Every order from Medtrade and Spiber Kart. Filter by status or store, search by reference, export to CSV.",
            wide: true,
          },
        },
        {
          kind: "steps",
          steps: [
            "Open an order to see the customer, the items, the money and a timeline of everything that has happened to it.",
            "Move it along with the buttons on the right: mark it paid, put it into processing, ship it, deliver it, or cancel it.",
            "For cash on delivery and credit orders, use Record payment when the money actually arrives. This records the payment without moving the order's fulfilment status, because a delivered order can still be unpaid.",
            "Print the invoice from the order page when the customer asks for one.",
          ],
        },
        {
          kind: "callout",
          tone: "warning",
          title: "Two note fields, and they are not the same",
          body: "Note to customer appears on the customer's own order timeline. Internal note is only ever visible to admins. Check which box you are typing in before you write anything you would not want the customer to read.",
        },
        {
          kind: "figure",
          figure: {
            src: "admin-order-detail",
            caption:
              "An order in full. The actions available change with its status, and the two note fields are labelled separately.",
            wide: true,
          },
        },
        {
          kind: "definitions",
          items: [
            {
              term: "Cancelling a paid order",
              def: "Reconciles the payment to refunded, so it stops counting as revenue, and returns the stock.",
            },
            {
              term: "A refund request",
              def: "Raised by the customer from their account. It appears as a banner on the order until you settle it by cancelling or refunding.",
            },
          ],
        },
      ],
    },

    {
      id: "quotations",
      title: "Quotations",
      lede: "The Medtrade sales pipeline. This is where price-on-request items are actually priced.",
      blocks: [
        {
          kind: "steps",
          steps: [
            "Open a request to see what was asked for and who asked.",
            "Each line shows the list price and the floor price, so you know how far you can come down before you quote.",
            "Assign it to yourself, add notes as the conversation goes on, and move it through new, quoted, negotiating and then won or lost.",
            "Use the quote panel to set the amount, how long it is valid and an optional PDF, then send it.",
          ],
        },
        {
          kind: "figure",
          figure: {
            src: "admin-quotation-detail",
            caption:
              "Pricing a quotation. The list and floor prices are shown per line so your room to negotiate is explicit.",
            wide: true,
          },
        },
        {
          kind: "callout",
          tone: "note",
          body: "The floor price is set on the product, not here. It never discounts anything by itself; it only tells whoever is quoting how low they may go.",
        },
      ],
    },

    {
      id: "inventory",
      title: "Inventory",
      lede: "One stock list for both storefronts. A row is a stock unit: a simple product, or a single variant of one.",
      blocks: [
        {
          kind: "figure",
          figure: {
            src: "admin-inventory",
            caption:
              "The inventory hub. The four figures across the top are clickable and filter the list beneath them.",
            wide: true,
          },
        },
        {
          kind: "definitions",
          items: [
            {
              term: "Tracked units",
              def: "Everything that carries stock. Every Spiber Kart product is tracked. A Medtrade product becomes tracked once it has a price, because a quotation-only item has no stock to speak of.",
            },
            {
              term: "Low stock",
              def: "At or below the product's own low-stock threshold, but above zero.",
            },
            {
              term: "Out of stock",
              def: "A tracked unit at zero.",
            },
            {
              term: "Stock value",
              def: "Quantity times list price across active tracked units. A guide figure, not an accounting valuation.",
            },
          ],
        },
        {
          kind: "steps",
          steps: [
            "Use Adjust for a change you can express as a movement: a delivery arriving, a breakage, a correction. Choose the type and write a reason.",
            "Use Set to when you have counted the shelf and want the number to be exactly right. The system works out the difference itself, and retries safely if a sale lands while you are typing.",
            "Select several rows and use Receive to enter one quantity per unit in a single pass.",
            "Use Receive CSV for a delivery note. Paste or upload sku, qty and an optional reason. Every line is resolved against the catalogue and shown to you, with unknown SKUs flagged, before anything is applied.",
          ],
        },
        {
          kind: "figure",
          figure: {
            src: "admin-inventory-adjust",
            caption:
              "Changing stock. Adjust by adds or removes; Set to makes the count exact. Both are written to the ledger.",
          },
        },
        {
          kind: "callout",
          tone: "warning",
          title: "Seller stock is theirs, not yours",
          body: "Seller listings show Override instead of Adjust. Changing one requires you to tick a confirmation, and it emails the seller with the before and after figures. Use it to correct a genuine error, not as routine stock keeping.",
        },
        {
          kind: "text",
          body: "Every change, from any source, is written to the stock ledger under Movements: sales, returns, deliveries, corrections, overrides and CSV imports, each with the balance afterwards, the order it belongs to and the admin who did it. The ledger exports to CSV with your filters applied.",
        },
        {
          kind: "figure",
          figure: {
            src: "admin-movements",
            caption:
              "The stock ledger. Nothing changes stock without leaving a row here.",
            wide: true,
          },
        },
        {
          kind: "definitions",
          items: [
            {
              term: "Low-stock alerts",
              def: "Fire once when a unit crosses its threshold or hits zero, not on every movement. They appear in the bell and on the dashboard.",
            },
            {
              term: "The daily digest",
              def: "An email listing everything low or out, lowest first. Send digest on the inventory page sends it immediately; a scheduled job sends it once a day.",
            },
            {
              term: "Tracking a quotation-only product",
              def: "Use the row menu, or the Stock tracking field on the Medtrade product editor, to force tracking on or off for an item that the default rule gets wrong.",
            },
          ],
        },
      ],
    },

    {
      id: "catalogue",
      title: "Products and the catalogue",
      lede: "Medtrade and Spiber Kart have separate product lists because they behave differently.",
      blocks: [
        {
          kind: "definitions",
          items: [
            {
              term: "Price (Medtrade)",
              def: "Optional. Leave it blank and the product is quotation-only, showing Price on request with no cart button. Give it a price and it becomes buyable.",
            },
            {
              term: "Floor price (Medtrade)",
              def: "Optional, and must be at or below the price. When it is lower, the storefront shows a range and the quotation team sees how far they may discount.",
            },
            {
              term: "Compare-at price (Spiber Kart)",
              def: "The previous price. When it is above the current price, the storefront shows it struck through with a percentage saving. Only ever enter a price that was genuinely charged.",
            },
            {
              term: "Variants (Spiber Kart)",
              def: "Define the options, then generate the combinations. Each variant has its own SKU, price and stock.",
            },
            {
              term: "Stock",
              def: "Never edited on the product form. The Stock card there shows the balance and links to Inventory, so every change goes through the ledger.",
            },
          ],
        },
        {
          kind: "callout",
          tone: "warning",
          title: "Set VAT before you price the first Medtrade product",
          body: "Pricing a product is what makes it buyable. If VAT is still at zero when the first priced product goes live, it will sell without charging VAT.",
        },
        {
          kind: "text",
          body: "Product lists support bulk actions: tick rows, or select everything matching the current filter, then set them active, draft or archived, or delete them. Activating skips any Spiber Kart product that has no resolvable price and tells you which ones it skipped, so a bulk action can never publish a priceless product.",
        },
        {
          kind: "text",
          body: "Categories are a tree and are ordered by hand, first to last, which is the order customers see in the navigation. Brands are shared across both storefronts and are ordered the same way. Coupons are scoped to a storefront and can be limited by number of uses or an expiry date.",
        },
      ],
    },

    {
      id: "sellers",
      title: "Sellers",
      lede: "Third-party sellers on Spiber Kart, from application to payout.",
      blocks: [
        {
          kind: "steps",
          steps: [
            "Applications arrive under Sellers, Applications. Open one and read the uploaded trade licence and ID; documents open through a gated link and every view is logged.",
            "Move it to reviewing, then approved or rejected. Approving creates the seller's shop, opens their portal and emails them. Rejecting asks for a reason, which the applicant is shown.",
            "New listings and content changes queue under Sellers, Products. Approving an edit publishes it; rejecting keeps the version customers already see and records why.",
            "Commissions accrue automatically when an order is paid. Group them into a payout, then mark it paid once the money has gone out.",
          ],
        },
        {
          kind: "figure",
          figure: {
            src: "admin-seller-application",
            caption:
              "Reviewing an application. The documents are never public files.",
            wide: true,
          },
        },
        {
          kind: "definitions",
          items: [
            {
              term: "The commission rate",
              def: "Resolved per line in this order: a rate set on the seller, then a rate set on the product's category, then the global default. Whichever applied is recorded on the commission, so any deduction can be explained later.",
            },
            {
              term: "Suspending a seller",
              def: "Immediately removes their listings from the storefront and blocks them from the portal, even if they are already signed in.",
            },
          ],
        },
        {
          kind: "figure",
          figure: {
            src: "admin-seller-settings",
            caption:
              "The commission Spiber Med keeps. Set the default, then override it per category.",
            wide: true,
          },
        },
      ],
    },

    {
      id: "credit",
      title: "Credit accounts",
      lede: "Letting an institution buy now and settle later.",
      blocks: [
        {
          kind: "steps",
          steps: [
            "Applications arrive under Medtrade, Credit Applications. Check the trade licence, which is the one required document.",
            "Approve it and set the payment terms in days. This opens a credit account.",
            "Credit account then appears at Medtrade checkout for that customer, with the terms shown.",
          ],
        },
        {
          kind: "callout",
          tone: "note",
          body: "Eligibility is read at checkout, so approving or suspending an account takes effect on the customer's very next order. They do not need to sign out and back in.",
        },
        {
          kind: "figure",
          figure: {
            src: "admin-credit",
            caption:
              "Credit applications from hospitals, clinics and distributors.",
            wide: true,
          },
        },
      ],
    },

    {
      id: "content",
      title: "Courses, posts and other content",
      lede: "Every content editor works the same way: sections down the page, a sticky save bar, and language tabs on each translatable field.",
      blocks: [
        {
          kind: "callout",
          tone: "note",
          title: "The language tabs",
          body: "Each translatable field has EN, বাংলা and 日本語 tabs. The dot on a tab means that language has content. English is required; the others are optional and fall back to English on the site.",
        },
        {
          kind: "steps",
          steps: [
            "Courses: fill in the details, then build the curriculum. Add modules, then lessons inside them, and drag either to reorder. A lesson is video, text, a quiz or a downloadable resource. Mark a lesson as a free preview to open it to people who have not enrolled.",
            "Blog posts: write the body in the rich-text editor, using the language tabs above it to switch. Set the status to published, or scheduled with a date, and it will appear by itself when that time passes.",
            "Testimonials, gallery albums, events and job postings all follow the same pattern from the Company section.",
          ],
        },
        {
          kind: "figure",
          figure: {
            src: "admin-course-builder",
            caption:
              "The course builder. Modules hold lessons, and both can be dragged into order.",
            wide: true,
          },
        },
        {
          kind: "figure",
          figure: {
            src: "admin-post-editor",
            caption:
              "The post editor. The tabs above the body switch language without losing what you have typed in the others.",
            wide: true,
          },
        },
      ],
    },

    {
      id: "tourism",
      title: "Tourism",
      lede: "Four pipelines and a catalogue.",
      blocks: [
        {
          kind: "list",
          items: [
            "Cases: the medical tourism funnel, from new through to closed. Assign a case manager, keep notes, tick off the arrangement checklist and produce a printable quotation.",
            "Appointments, Travel requests and Partner applications: the other three inboxes, each with its own status flow.",
            "The catalogue covers destinations, hospitals, doctors and treatment packages. Costs are entered in taka with a labelled foreign estimate.",
          ],
        },
        {
          kind: "callout",
          tone: "warning",
          title: "Patient documents",
          body: "Medical reports are encrypted in private storage and are never public files. They open only through a gated link, only for the assigned case manager, an unassigned case, or a super admin. Every view is written to the audit log before the file is served, so if the log cannot be written the file is not served either.",
        },
      ],
    },

    {
      id: "company",
      title: "Company",
      lede: "The internal side of the admin.",
      blocks: [
        {
          kind: "definitions",
          items: [
            {
              term: "Documents",
              def: "The company vault. Files are encrypted at rest with a key held in the environment, only a super admin can open them, and every view is logged. Losing the key means losing the files, so keep it backed up outside the app.",
            },
            {
              term: "Chat inbox",
              def: "Conversations with the website assistant, and any lead it captured. Mark them open, lead or closed.",
            },
            {
              term: "Messages",
              def: "Submissions from the website contact form.",
            },
          ],
        },
        {
          kind: "figure",
          figure: {
            src: "admin-documents",
            caption:
              "The company vault. Restricted to super admins and encrypted at rest.",
            wide: true,
          },
        },
      ],
    },

    {
      id: "settings",
      title: "Settings and housekeeping",
      lede: "The handful of settings that change how money and alerts behave.",
      blocks: [
        {
          kind: "definitions",
          items: [
            {
              term: "VAT rate",
              def: "Added to the goods total at Medtrade checkout. Shipping is not taxed. Set this before pricing the first Medtrade product.",
            },
            {
              term: "AIT rate",
              def: "Printed on invoices for the buyer to deduct at source. It is never added to what the customer pays.",
            },
            {
              term: "Seller commission",
              def: "The platform default, with per-category overrides.",
            },
            {
              term: "The low-stock digest",
              def: "Needs a scheduled daily call to the digest route using the shared secret from the environment. Without it the bell and dashboard still work; only the email is dormant.",
            },
          ],
        },
        {
          kind: "figure",
          figure: {
            src: "admin-settings",
            caption:
              "Commerce settings. Both rates are entered as percentages.",
            wide: true,
          },
        },
        {
          kind: "callout",
          tone: "warning",
          title: "About the tab next to this one",
          body: "Data cleanup permanently deletes records. Everywhere else the app uses recoverable soft-delete; deletes there are not. They are also not cascaded, so removing a product leaves its orders, reviews and stock movements behind. It is meant for clearing test data, not for running the business.",
        },
      ],
    },
  ],
};
