/* eslint-disable */
// Seed MongoDB with the same testimonials and news posts the design uses
// as fallbacks. Run with: node scripts/seed.mjs

import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "spiber";

if (!uri) {
  console.error("MONGODB_URI not set. Aborting.");
  process.exit(1);
}

const testimonials = [
  {
    order: 1,
    tone: "teal",
    name: "Prof. Dr. Md. Moazzem Hossain",
    role: "Chairman · Aichi Healthcare Group",
    quote:
      "I have had the pleasure of working with SPIBER MED for all our medical equipment needs, and I can confidently say they are one of the best in the industry. Their commitment to quality, reliability, and customer satisfaction is unmatched. In a field where precision and dependability are non-negotiable, they consistently go above and beyond.",
  },
  {
    order: 2,
    tone: "orange",
    name: "Arpit Ahuja",
    role: "Founder & Director · TOP MRI & Medicto",
    quote:
      "A remarkable partner that has earned my confidence in just a few months. Their proactive approach to addressing our needs has been impressive — they understood our requirements from the outset and consistently exceeded expectations.",
  },
  {
    order: 3,
    tone: "slate",
    name: "Dr. Sumaiya Khan",
    role: "Director · Greenlife Specialty Hospital",
    quote:
      "End-to-end delivery on a scale I haven't seen elsewhere in the region. From feasibility study through commissioning and training, the team kept us on schedule and on budget.",
  },
];

const posts = [
  {
    kicker: "INDUSTRY",
    title: "Healthcare industry management — the operator's lens",
    excerpt:
      "A long-form look at how Bangladesh's hospital operators are modernizing — and the structural reforms that need to follow.",
    date: "25 NOV 2025",
    read: "8 min",
    tone: "teal",
    placeholder: "industry feature photo",
  },
  {
    kicker: "WORKFORCE",
    title: "Global employability for healthcare professionals",
    excerpt:
      "How our overseas placement pathways are connecting Bangladeshi clinicians with hospitals in Japan, Germany, and the UK.",
    date: "18 NOV 2025",
    read: "6 min",
    tone: "orange",
    placeholder: "workforce photo",
  },
  {
    kicker: "FIELD NOTES",
    title: "Lessons from the COVID-19 response, five years on",
    excerpt:
      "What worked, what didn't, and what every hospital can carry forward into the next public-health emergency.",
    date: "01 NOV 2025",
    read: "10 min",
    tone: "slate",
    placeholder: "field photo",
  },
];

const client = new MongoClient(uri);
await client.connect();
const db = client.db(dbName);

await db.collection("testimonials").deleteMany({});
await db.collection("testimonials").insertMany(testimonials);
console.log(`Seeded ${testimonials.length} testimonials`);

await db.collection("posts").deleteMany({});
await db.collection("posts").insertMany(posts);
console.log(`Seeded ${posts.length} news posts`);

await client.close();
