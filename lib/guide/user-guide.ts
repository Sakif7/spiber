import type { Guide } from "./types";

/**
 * The customer-facing user guide, published at /guide and linked from the
 * footer beside the policies. Every screen described here was walked end to
 * end before the guide was written, so the steps match what the site actually
 * does rather than what it was meant to do.
 */
export const USER_GUIDE: Guide = {
  title: "Using Spiber Med",
  lede: "How to find equipment, ask for a price, place an order, book treatment abroad and manage your account.",
  updated: "Last checked against the live site on 5 September 2026.",
  sections: [
    {
      id: "overview",
      title: "What is where",
      lede: "Spiber Med is one company with several parts. Knowing which part you need saves the most time.",
      blocks: [
        {
          kind: "definitions",
          items: [
            {
              term: "Spiber Medtrade",
              def: "Medical equipment and consumables for hospitals, clinics and labs. Most items are priced on request, so you ask for a quotation rather than buying straight away.",
            },
            {
              term: "Spiber Kart",
              def: "The everyday shop: health devices, wellness products, technology and home goods. Everything here has a price and can be bought immediately.",
            },
            {
              term: "Spiber MedAcademy",
              def: "Training courses for clinical and technical staff, taken online at your own pace.",
            },
            {
              term: "Spiber Digihealth",
              def: "Software for clinics and hospitals, either ready to buy or built to order.",
            },
            {
              term: "Spiber Tourism",
              def: "Treatment abroad: finding a hospital or specialist, getting a cost estimate, and arranging the travel around it.",
            },
            {
              term: "Health Corner",
              def: "Health information and guidance. This section is still being built.",
            },
          ],
        },
        {
          kind: "figure",
          figure: {
            src: "home",
            caption:
              "The home page. The search box in the hero looks across every division at once, and the menus in the header lead to each one.",
            wide: true,
          },
        },
        {
          kind: "text",
          body: "The site is available in English, Bangla and Japanese. Use the flag control in the header to switch. Product names and descriptions appear in your chosen language where a translation exists, and fall back to English where it does not.",
        },
      ],
    },

    {
      id: "finding",
      title: "Finding a product",
      lede: "There are three ways in, and they suit different situations.",
      blocks: [
        {
          kind: "list",
          items: [
            "Search from the home page when you know roughly what you want. Results are grouped by division as you type, so you can see at a glance whether something is equipment, a course or software.",
            "Use the header menus when you would rather browse. Products and Solutions covers Medtrade and Digihealth, and Services covers Tourism and Health Corner.",
            "Use the filters on a catalogue page when you are narrowing down. Every filter you choose is added to the web address, so you can bookmark a filtered view or send it to a colleague and they will see exactly the same list.",
          ],
        },
        {
          kind: "figure",
          figure: {
            src: "medtrade-filters",
            caption:
              "Filtering the Medtrade catalogue. The list updates as you choose, without reloading the page.",
            wide: true,
          },
        },
      ],
    },

    {
      id: "medtrade-prices",
      title: "How Medtrade prices work",
      lede: "Medical equipment is not priced like everyday goods. You will see one of three things, and each means something different.",
      blocks: [
        {
          kind: "definitions",
          items: [
            {
              term: "Price on request",
              def: "No price is published. These items are quoted per order, because the cost depends on configuration, quantity and delivery. There is no Add to cart button; you add the item to a quote list instead.",
            },
            {
              term: "A single price",
              def: "A fixed price you can buy at straight away.",
            },
            {
              term: "A price range, for example ৳420 to ৳500",
              def: "The item has a published price and a negotiable floor. The higher figure is the list price you pay at checkout. The lower figure is as far as Spiber Med will discuss coming down for the right order. To have that conversation, use Negotiate price rather than buying.",
            },
          ],
        },
        {
          kind: "figure",
          figure: {
            src: "medtrade-price-range",
            caption:
              "A negotiable price. Buying now bills the higher figure. Negotiate price opens a quotation instead, where the lower figure is the floor.",
            wide: true,
          },
        },
        {
          kind: "callout",
          tone: "note",
          title: "Buying never applies the lower price automatically",
          body: "Checkout always charges the list price. The floor only applies to a price agreed through a quotation, so a discount is always something a person has confirmed.",
        },
      ],
    },

    {
      id: "quotation",
      title: "Asking for a quotation",
      lede: "A quotation is the normal way to buy equipment. You can request one without an account.",
      blocks: [
        {
          kind: "steps",
          steps: [
            "On any Medtrade product, choose Add to quote, or Negotiate price if the item already has a price.",
            "Keep browsing and add anything else you need. One request can mix priced and quotation-only items.",
            "Open the quote list and set the quantity for each line.",
            "Fill in your details. Name, email and district are required; an organisation, phone number and timeline help the team quote accurately.",
            "Submit the request. You will be given a reference beginning SPM-RFQ, and a copy is emailed to you.",
          ],
        },
        {
          kind: "figure",
          figure: {
            src: "medtrade-quote-list",
            caption:
              "The quote list. Collect what you need, set quantities, then send one request for all of it.",
            wide: true,
          },
        },
        {
          kind: "text",
          body: "The team replies with a price, how long it is valid for, and any attached document. If you were signed in when you asked, the quotation and its price appear under Quotations in your account. If you asked as a guest, keep the reference from the confirmation email.",
        },
      ],
    },

    {
      id: "buying-medtrade",
      title: "Buying from Medtrade",
      lede: "Items that carry a price can be bought directly. Tax works differently here than on Spiber Kart.",
      blocks: [
        {
          kind: "steps",
          steps: [
            "Add the item to the cart and open the cart to check quantities. Medtrade and Spiber Kart keep separate carts, so equipment and everyday goods never mix in one order.",
            "Go to checkout and fill in the delivery address.",
            "Choose how to pay. Cash on delivery is available to everyone. Paying on account terms is available once you have an approved credit account.",
            "Place the order. You will get a reference beginning SPM, a confirmation on screen and an email.",
          ],
        },
        {
          kind: "figure",
          figure: {
            src: "medtrade-checkout",
            caption:
              "Medtrade checkout. VAT is added as its own line on the goods total, and shipping is shown separately.",
            wide: true,
          },
        },
        {
          kind: "definitions",
          items: [
            {
              term: "VAT",
              def: "Charged by Spiber Med and added to your total. It is calculated on the goods only, not on the shipping fee.",
            },
            {
              term: "AIT (advance income tax)",
              def: "Shown on the invoice for your records. It is not added to what you pay. Where the law requires it, you deduct it at source when you settle the invoice.",
            },
          ],
        },
        {
          kind: "figure",
          figure: {
            src: "medtrade-invoice",
            caption:
              "Every order has a printable invoice with the itemised goods, the VAT line, the payment terms and the AIT note. Use your browser's print dialog to save it as a PDF.",
            wide: true,
          },
        },
      ],
    },

    {
      id: "credit",
      title: "Buying on account terms",
      lede: "Registered institutions can order now and settle the invoice later.",
      blocks: [
        {
          kind: "steps",
          steps: [
            "Open Credit facility from the Medtrade menu and apply. You will need your trade licence and your organisation's details.",
            "Spiber Med verifies the documents, usually within a few working days.",
            "Once approved, Credit account appears as a payment choice at Medtrade checkout, with your agreed terms shown beside it.",
          ],
        },
        {
          kind: "figure",
          figure: {
            src: "medtrade-credit",
            caption:
              "The credit facility page. Open to registered hospitals, clinics, diagnostic centres and distributors.",
            wide: true,
          },
        },
        {
          kind: "callout",
          tone: "note",
          body: "Until an account is approved, cash on delivery is the payment option at Medtrade checkout. The link to apply sits directly under the payment choices.",
        },
      ],
    },

    {
      id: "kart",
      title: "Shopping on Spiber Kart",
      lede: "Everything on Kart has a price and can be bought immediately.",
      blocks: [
        {
          kind: "figure",
          figure: {
            src: "kart-home",
            caption:
              "Spiber Kart. The bar under the header is the shop menu: best sellers, new arrivals, the offer zone, brands and more.",
            wide: true,
          },
        },
        {
          kind: "list",
          items: [
            "The shop page filters by category, brand, price, rating, availability and whether something is on sale. Filters apply without reloading, and you can switch between a grid and a list.",
            "A price with an older figure struck through beside it is a genuine reduction, and the badge shows the saving as a percentage.",
            "Some products have options such as size or colour. Each combination has its own price and its own stock, so choose the option before adding to the cart.",
            "Every product says who sells it. House stock is sold by Spiber Kart; anything else names the seller and links to their shopfront.",
          ],
        },
        {
          kind: "figure",
          figure: {
            src: "kart-product",
            caption:
              "A discounted product. The struck-through figure is the previous price and the badge shows the saving.",
            wide: true,
          },
        },
        {
          kind: "steps",
          steps: [
            "Add what you want to the cart and open the cart to adjust quantities.",
            "At checkout, fill in the delivery address and apply a discount code if you have one.",
            "Place the order. The reference and the full details appear under Orders in your account.",
          ],
        },
        {
          kind: "callout",
          tone: "note",
          title: "Cannot find something?",
          body: "Use Request a product from the shop menu. Describe what you need and the sourcing team will look for it and come back to you.",
        },
      ],
    },

    {
      id: "returns",
      title: "Changing or returning an order",
      lede: "What you can do yourself depends on how far the order has progressed.",
      blocks: [
        {
          kind: "definitions",
          items: [
            {
              term: "Not yet paid",
              def: "You can cancel the order yourself from the order page in your account. Stock goes straight back.",
            },
            {
              term: "Paid, or already delivered",
              def: "Ask for a refund from the same page. The request goes to the team, who settle it and confirm. Delivered orders can be returned within the window set out in the returns policy.",
            },
          ],
        },
        {
          kind: "figure",
          figure: {
            src: "account-order-detail",
            caption:
              "An order in your account. The action offered here changes with the order's status.",
            wide: true,
          },
        },
        {
          kind: "text",
          body: "The full returns and refund policy is linked from checkout, from every order and from the footer.",
        },
      ],
    },

    {
      id: "academy",
      title: "Taking a course",
      lede: "Courses are taken online, at your own pace.",
      blocks: [
        {
          kind: "steps",
          steps: [
            "Browse the catalogue and open a course to see what it covers and how long it takes.",
            "Sign in, then enrol. Free courses open immediately. Paid courses are confirmed once payment is arranged, and the lessons unlock then.",
            "Work through the lessons. Your progress is saved as you go, so you can stop and come back.",
            "Finish every lesson to receive a certificate, which you can view and print from your account.",
          ],
        },
        {
          kind: "figure",
          figure: {
            src: "academy-course-detail",
            caption:
              "A course page: what it covers, the price, and the button to enrol.",
            wide: true,
          },
        },
      ],
    },

    {
      id: "digihealth",
      title: "Software for your clinic",
      lede: "Ready-made software, or something built for you.",
      blocks: [
        {
          kind: "list",
          items: [
            "Products with a price can be bought outright. You need an account, because access is tied to it.",
            "Products marked for quote are not sold directly. Ask for access and the team will come back with pricing.",
            "After buying, downloads and any licence key appear under Software in your account.",
            "For something that does not exist yet, use the custom solutions page to describe what you need.",
          ],
        },
        {
          kind: "figure",
          figure: {
            src: "digihealth-product",
            caption:
              "A software product page. How it is delivered is stated up front: a download, a licence key, or activation on an external system.",
            wide: true,
          },
        },
      ],
    },

    {
      id: "tourism",
      title: "Arranging treatment abroad",
      lede: "From finding a hospital to landing back home, handled as one case.",
      blocks: [
        {
          kind: "steps",
          steps: [
            "Browse destinations, hospitals, specialists or treatment packages. Package pages quote a cost in taka with the foreign estimate labelled beside it.",
            "Choose Get treatment cost or Request a consultation. If you came from a package or hospital page, the form remembers it.",
            "Fill in the patient details and describe the condition.",
            "If you want to attach a medical report, tick the consent box first. The file picker stays locked until you do, so nothing medical is ever sent by accident.",
            "Submit. You will get a reference beginning SPM-CASE.",
          ],
        },
        {
          kind: "figure",
          figure: {
            src: "tourism-consultation-form",
            caption:
              "The consultation request. Consent comes before any medical report can be attached, and the wording says exactly who will be able to read it.",
            wide: true,
          },
        },
        {
          kind: "callout",
          tone: "note",
          title: "Who can see your reports",
          body: "Uploaded reports are stored privately and are readable only by the case manager assigned to you and authorised staff. Every time a report is opened it is logged. Reports are never shown in a public link, and the case tracker only ever tells you how many documents are attached, never their names.",
        },
        {
          kind: "text",
          body: "Track a case at any time from Case lookup using the reference and the email you used. You will see the current status and the travel checklist. If you were signed in when you submitted, the case is also listed under Cases in your account. Flights, hotels, visa help and airport transfers are requested from the travel pages; each is arranged by a person rather than booked instantly.",
        },
        {
          kind: "figure",
          figure: {
            src: "tourism-case-lookup",
            caption:
              "Tracking a case. The reference alone is not enough: the email must match, or the lookup is refused.",
            wide: true,
          },
        },
      ],
    },

    {
      id: "account",
      title: "Your account",
      lede: "One account covers every division.",
      blocks: [
        {
          kind: "list",
          items: [
            "Orders: everything you have bought from either storefront, with the invoice and the actions available at each stage.",
            "Quotations: requests you have made and the prices that came back.",
            "Cases: medical tourism cases and their progress.",
            "Courses: what you are enrolled on and your certificates.",
            "Software: downloads and licence keys.",
            "Wishlist: products you have saved for later.",
            "Profile: your name, phone number and default delivery address, which pre-fills checkout. You can also change your password here.",
          ],
        },
        {
          kind: "figure",
          figure: {
            src: "account-orders",
            caption: "Your orders across both storefronts, newest first.",
            wide: true,
          },
        },
        {
          kind: "callout",
          tone: "note",
          body: "Changing your password signs you out on every other device but keeps you signed in here.",
        },
      ],
    },

    {
      id: "selling",
      title: "Selling on Spiber Kart",
      lede: "Spiber Kart takes third-party sellers. Applications are checked before anything goes live.",
      blocks: [
        {
          kind: "steps",
          steps: [
            "Sign in, then open Become a seller. The application is tied to your account.",
            "Give your business details and upload your documents. A trade licence is required; a national ID is asked for as well.",
            "Accept the seller terms and submit. You will get a reference beginning SPM-SEL.",
            "Spiber Med reviews the documents and emails you the decision.",
            "Once approved, your seller portal opens. List products, watch orders that include your items, and see what you have earned after the platform fee.",
          ],
        },
        {
          kind: "figure",
          figure: {
            src: "seller-dashboard",
            caption:
              "The seller portal: earnings, orders and how your listings are doing.",
            wide: true,
          },
        },
        {
          kind: "callout",
          tone: "note",
          title: "How listing changes are reviewed",
          body: "Price and stock changes take effect immediately. Changes to a listing's name, description, images or category go to Spiber Med for review, and the version customers already see stays up until the change is approved. So editing a live listing never takes it off sale.",
        },
      ],
    },

    {
      id: "help",
      title: "Getting help",
      lede: "Three ways to reach a person, and one that answers straight away.",
      blocks: [
        {
          kind: "list",
          items: [
            "The chat assistant, bottom right on every page. It answers questions about products, orders and services in English, Bangla and Japanese, can look up an order or a case from its reference, and will hand you to a person when you ask.",
            "The contact form, for anything that needs a written reply. Choose the enquiry type so it reaches the right team.",
            "Phone and email, in the bar at the top of every page.",
          ],
        },
        {
          kind: "figure",
          figure: {
            src: "chat-assistant",
            caption:
              "The chat assistant. Ask in whichever language you prefer.",
          },
        },
        {
          kind: "text",
          body: "When you get in touch about something specific, quote its reference. Orders begin SPM, quotations SPM-RFQ, medical cases SPM-CASE and seller applications SPM-SEL. It is the fastest way for anyone to find your record.",
        },
      ],
    },
  ],
};
