/**
 * LOCAL DEMO/QA seed for the FULL Spiber Tourism ecosystem — destinations,
 * hospitals, doctors, treatment packages, plus a few pipeline records (cases /
 * appointment / travel / partner) so the admin boards aren't empty. NOT for
 * production. Idempotent (catalog upserts by slug; pipeline rows by ref number).
 *
 *   node scripts/demo-seed-tourism.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { MongoClient } from "mongodb";

if (!process.env.MONGODB_URI) {
  const f = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(f))
    for (const line of fs.readFileSync(f, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined)
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
}
const uri = process.env.MONGODB_URI || "mongodb://localhost:27017";
const dbName = process.env.MONGODB_DB || "spibermed";
const now = new Date();
const M = (major) => Math.round(major * 100); // BDT major → poisha

const c = new MongoClient(uri);
await c.connect();
const db = c.db(dbName);

async function upsert(name, doc) {
  const col = db.collection(name);
  await col.updateOne(
    { slug: doc.slug },
    { $set: { ...doc, updatedAt: now }, $setOnInsert: { createdAt: now } },
    { upsert: true },
  );
  return (await col.findOne({ slug: doc.slug }))._id;
}

/* ---------------------------------------------------------- Destinations */
const DESTINATIONS = [
  {
    slug: "india",
    en: "India",
    bn: "ভারত",
    featured: true,
    treatments: ["Cardiac surgery", "Oncology", "Orthopedics", "Transplant"],
    min: 150000,
    max: 1200000,
    foreign: "USD 1,500–10,000 (excl. airfare)",
  },
  {
    slug: "thailand",
    en: "Thailand",
    bn: "থাইল্যান্ড",
    featured: true,
    treatments: [
      "Cardiac care",
      "Cosmetic surgery",
      "Health check-ups",
      "Orthopedics",
    ],
    min: 250000,
    max: 900000,
    foreign: "USD 2,000–7,500",
  },
  {
    slug: "singapore",
    en: "Singapore",
    bn: "সিঙ্গাপুর",
    featured: true,
    treatments: ["Oncology", "Neurology", "Cardiology", "Fertility"],
    min: 600000,
    max: 2500000,
    foreign: "USD 5,000–20,000",
  },
  {
    slug: "malaysia",
    en: "Malaysia",
    bn: "মালয়েশিয়া",
    featured: true,
    treatments: ["Cardiac care", "IVF", "Orthopedics", "Health screening"],
    min: 200000,
    max: 850000,
    foreign: "USD 1,800–7,000",
  },
  {
    slug: "turkey",
    en: "Turkey",
    bn: "তুরস্ক",
    featured: true,
    treatments: [
      "Hair transplant",
      "Cosmetic surgery",
      "Oncology",
      "Eye surgery",
    ],
    min: 180000,
    max: 950000,
    foreign: "USD 1,500–8,000",
  },
  {
    slug: "uae",
    en: "United Arab Emirates",
    bn: "সংযুক্ত আরব আমিরাত",
    featured: false,
    treatments: ["Orthopedics", "Cardiology", "Cosmetic", "Fertility"],
    min: 500000,
    max: 2200000,
    foreign: "USD 4,000–18,000",
  },
  {
    slug: "south-korea",
    en: "South Korea",
    bn: "দক্ষিণ কোরিয়া",
    featured: false,
    treatments: ["Cosmetic surgery", "Oncology", "Health check-ups"],
    min: 400000,
    max: 1800000,
    foreign: "USD 3,500–15,000",
  },
  {
    slug: "germany",
    en: "Germany",
    bn: "জার্মানি",
    featured: false,
    treatments: ["Oncology", "Orthopedics", "Neurology", "Cardiac surgery"],
    min: 900000,
    max: 4000000,
    foreign: "USD 8,000–35,000",
  },
  {
    slug: "united-kingdom",
    en: "United Kingdom",
    bn: "যুক্তরাজ্য",
    featured: false,
    treatments: ["Oncology", "Cardiology", "Neurology"],
    min: 1200000,
    max: 5000000,
    foreign: "USD 10,000–45,000",
  },
  {
    slug: "china",
    en: "China",
    bn: "চীন",
    featured: false,
    treatments: ["Oncology", "Orthopedics", "Traditional + modern care"],
    min: 300000,
    max: 1500000,
    foreign: "USD 2,500–13,000",
  },
];
// Demo hero photos (placeholders from /public; admin swaps for real country art).
const DEST_IMG = {
  india: "/doctor-and-nurse-holding-xray-corridor.jpeg",
  thailand: "/cherry-blossom-tree-lined-road.jpeg",
  singapore: "/modern-operating-room-equipment.jpeg",
  malaysia: "/surgical-team-portrait-in-operating-room.jpeg",
  turkey: "/surgeon-performing-operation.jpeg",
  uae: "/icu-ventilators-between-hospital-beds.jpeg",
  "south-korea": "/lab-technician-using-analyzer-machine.jpeg",
  germany: "/c-arm-xray-imaging-system.jpeg",
  "united-kingdom": "/doctor-holding-stethoscope-arms-crossed.jpeg",
  china: "/dialysis-machine-medical-equipment.jpeg",
};
const destId = {};
for (const d of DESTINATIONS) {
  destId[d.slug] = await upsert("tourism_destinations", {
    name: { en: d.en, bn: d.bn },
    slug: d.slug,
    heroImage: DEST_IMG[d.slug] ?? null,
    overview: {
      en: `${d.en} offers internationally accredited hospitals and globally trained specialists, with transparent costs and full travel support coordinated by your Spiber case manager.`,
    },
    popularTreatments: d.treatments.map((en) => ({ en })),
    costRange: {
      bdtMinMinor: M(d.min),
      bdtMaxMinor: M(d.max),
      foreignLabel: d.foreign,
    },
    partnerHospitalIds: [],
    featured: d.featured,
    status: "active",
    deletedAt: null,
  });
}

/* ------------------------------------------------------------- Hospitals */
const HOSPITALS = [
  {
    slug: "bumrungrad-international",
    en: "Bumrungrad International",
    dest: "thailand",
    city: "Bangkok",
    accr: ["JCI", "ISO 9001"],
    spec: ["Cardiology", "Oncology", "Orthopedics"],
  },
  {
    slug: "bangkok-hospital",
    en: "Bangkok Hospital",
    dest: "thailand",
    city: "Bangkok",
    accr: ["JCI"],
    spec: ["Neurology", "Cardiac surgery", "Health check-ups"],
  },
  {
    slug: "apollo-hospitals-chennai",
    en: "Apollo Hospitals",
    dest: "india",
    city: "Chennai",
    accr: ["JCI", "NABH"],
    spec: ["Cardiac surgery", "Transplant", "Oncology"],
  },
  {
    slug: "fortis-memorial-gurugram",
    en: "Fortis Memorial Research Institute",
    dest: "india",
    city: "Gurugram",
    accr: ["JCI", "NABH"],
    spec: ["Neurosurgery", "Orthopedics", "Oncology"],
  },
  {
    slug: "mount-elizabeth-singapore",
    en: "Mount Elizabeth Hospital",
    dest: "singapore",
    city: "Singapore",
    accr: ["JCI"],
    spec: ["Oncology", "Cardiology", "Neurology"],
  },
  {
    slug: "gleneagles-kuala-lumpur",
    en: "Gleneagles Hospital",
    dest: "malaysia",
    city: "Kuala Lumpur",
    accr: ["MSQH", "JCI"],
    spec: ["IVF", "Cardiac care", "Orthopedics"],
  },
  {
    slug: "acibadem-istanbul",
    en: "Acibadem Healthcare",
    dest: "turkey",
    city: "Istanbul",
    accr: ["JCI"],
    spec: ["Oncology", "Cosmetic surgery", "Eye surgery"],
  },
  {
    slug: "asan-medical-seoul",
    en: "Asan Medical Center",
    dest: "south-korea",
    city: "Seoul",
    accr: ["JCI"],
    spec: ["Oncology", "Cosmetic surgery", "Cardiology"],
  },
];
const hospId = {};
for (const h of HOSPITALS) {
  hospId[h.slug] = await upsert("tourism_hospitals", {
    name: { en: h.en },
    slug: h.slug,
    country: { en: DESTINATIONS.find((d) => d.slug === h.dest).en },
    city: { en: h.city },
    accreditations: h.accr,
    specialties: h.spec.map((en) => ({ en })),
    profile: {
      en: `${h.en} in ${h.city} is a leading multi-specialty hospital serving international patients, with a dedicated medical-tourism wing.`,
    },
    images: [],
    destinationId: destId[h.dest] ?? null,
    status: "active",
    deletedAt: null,
  });
}
// Link partner hospitals back onto destinations
for (const h of HOSPITALS) {
  await db
    .collection("tourism_destinations")
    .updateOne(
      { _id: destId[h.dest] },
      { $addToSet: { partnerHospitalIds: hospId[h.slug] } },
    );
}

/* --------------------------------------------------------------- Doctors */
const DOCTORS = [
  {
    slug: "dr-anan-suwannakorn",
    name: "Dr. Anan Suwannakorn",
    spec: "Interventional Cardiology",
    hosp: "bumrungrad-international",
    loc: "Bangkok, Thailand",
    online: true,
  },
  {
    slug: "dr-priya-raman",
    name: "Dr. Priya Raman",
    spec: "Orthopedic Surgery",
    hosp: "apollo-hospitals-chennai",
    loc: "Chennai, India",
    online: false,
  },
  {
    slug: "dr-rajesh-menon",
    name: "Dr. Rajesh Menon",
    spec: "Cardiothoracic Surgery",
    hosp: "apollo-hospitals-chennai",
    loc: "Chennai, India",
    online: true,
  },
  {
    slug: "dr-li-wei",
    name: "Dr. Li Wei",
    spec: "Medical Oncology",
    hosp: "mount-elizabeth-singapore",
    loc: "Singapore",
    online: true,
  },
  {
    slug: "dr-aisha-rahman",
    name: "Dr. Aisha Rahman",
    spec: "Reproductive Medicine (IVF)",
    hosp: "gleneagles-kuala-lumpur",
    loc: "Kuala Lumpur, Malaysia",
    online: true,
  },
  {
    slug: "dr-mehmet-yilmaz",
    name: "Dr. Mehmet Yilmaz",
    spec: "Plastic & Reconstructive Surgery",
    hosp: "acibadem-istanbul",
    loc: "Istanbul, Turkey",
    online: false,
  },
  {
    slug: "dr-arun-kapoor",
    name: "Dr. Arun Kapoor",
    spec: "Neurosurgery",
    hosp: "fortis-memorial-gurugram",
    loc: "Gurugram, India",
    online: true,
  },
  {
    slug: "dr-ji-ho-park",
    name: "Dr. Ji-ho Park",
    spec: "Surgical Oncology",
    hosp: "asan-medical-seoul",
    loc: "Seoul, South Korea",
    online: false,
  },
];
for (const d of DOCTORS) {
  await upsert("tourism_doctors", {
    name: d.name,
    slug: d.slug,
    specialty: { en: d.spec },
    hospitalId: hospId[d.hosp] ?? null,
    location: { en: d.loc },
    bio: {
      en: `${d.name} is a senior specialist in ${d.spec.toLowerCase()} with extensive experience treating international patients.`,
    },
    photo: null,
    onlineConsultation: d.online,
    status: "active",
    deletedAt: null,
  });
}

/* -------------------------------------------------------------- Packages */
const PACKAGES = [
  {
    slug: "cardiac-bypass-cabg",
    en: "Comprehensive Cardiac Bypass (CABG)",
    cat: "cardiac",
    min: 600000,
    max: 950000,
    foreign: "USD 5,000–8,000",
    hosps: ["bumrungrad-international", "apollo-hospitals-chennai"],
    inc: [
      "Surgeon & anesthetist fees",
      "5 nights hospital stay",
      "ICU care",
      "Post-op follow-up",
    ],
  },
  {
    slug: "total-knee-replacement",
    en: "Total Knee Replacement",
    cat: "ortho",
    min: 350000,
    max: 550000,
    foreign: "USD 3,000–4,500",
    hosps: ["apollo-hospitals-chennai", "gleneagles-kuala-lumpur"],
    inc: [
      "Implant & surgery",
      "3 nights stay",
      "Physiotherapy",
      "Follow-up review",
    ],
  },
  {
    slug: "brain-tumor-surgery",
    en: "Brain Tumour Surgery",
    cat: "neuro",
    min: 700000,
    max: 1400000,
    foreign: "USD 6,000–12,000",
    hosps: ["fortis-memorial-gurugram", "mount-elizabeth-singapore"],
    inc: [
      "Neurosurgeon fees",
      "Imaging & diagnostics",
      "7 nights stay",
      "Rehabilitation plan",
    ],
  },
  {
    slug: "cancer-care-program",
    en: "Cancer Care Program",
    cat: "oncology",
    min: 500000,
    max: 2500000,
    foreign: "USD 4,000–20,000",
    hosps: ["mount-elizabeth-singapore", "acibadem-istanbul"],
    inc: [
      "Multidisciplinary review",
      "Chemotherapy / radiotherapy",
      "Specialist consultations",
      "Care coordination",
    ],
  },
  {
    slug: "ivf-cycle",
    en: "IVF Treatment Cycle",
    cat: "ivf",
    min: 250000,
    max: 650000,
    foreign: "USD 2,000–5,500",
    hosps: ["gleneagles-kuala-lumpur", "bumrungrad-international"],
    inc: [
      "Fertility assessment",
      "One IVF cycle",
      "Medication",
      "Embryo transfer",
    ],
  },
  {
    slug: "rhinoplasty",
    en: "Rhinoplasty (Cosmetic)",
    cat: "cosmetic",
    min: 180000,
    max: 450000,
    foreign: "USD 1,500–3,800",
    hosps: ["acibadem-istanbul", "asan-medical-seoul"],
    inc: ["Surgeon fee", "Day-care procedure", "2 follow-ups"],
  },
  {
    slug: "executive-health-checkup",
    en: "Executive Health Check-up",
    cat: "health-check",
    min: 40000,
    max: 90000,
    foreign: "USD 350–750",
    hosps: ["bumrungrad-international", "bangkok-hospital"],
    inc: [
      "Full blood panel & imaging",
      "Cardiac screening",
      "Specialist review",
    ],
  },
];
for (const p of PACKAGES) {
  await upsert("tourism_packages", {
    name: { en: p.en },
    slug: p.slug,
    category: p.cat,
    description: {
      en: `An end-to-end ${p.en.toLowerCase()} package coordinated across our accredited partner hospitals, with transparent pricing and full travel support.`,
    },
    hospitalOptionIds: p.hosps.map((s) => hospId[s]).filter(Boolean),
    costRange: {
      bdtMinMinor: M(p.min),
      bdtMaxMinor: M(p.max),
      foreignLabel: p.foreign,
    },
    inclusions: p.inc.map((en) => ({ en })),
    status: "active",
    deletedAt: null,
  });
}

/* ------------------------------------------- Pipeline records (admin demo) */
async function upsertByField(col, field, value, doc) {
  await db
    .collection(col)
    .updateOne(
      { [field]: value },
      {
        $set: { ...doc, [field]: value, updatedAt: now },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
}
const emptyChecklist = {
  appointment: { done: false },
  visa: { done: false },
  airTicket: { done: false },
  accommodation: { done: false },
  airportTransfer: { done: false },
};
await upsertByField("tourism_medical_cases", "caseNumber", "SPM-CASE-DEMO01", {
  patient: {
    name: "Kamrul Hasan",
    country: "Bangladesh",
    email: "kamrul.demo@example.com",
    phone: "+8801711112233",
  },
  userId: null,
  diagnosis: "Coronary artery disease, advised bypass.",
  requestedService: "Cardiac bypass surgery",
  documents: [],
  hospitalId: hospId["apollo-hospitals-chennai"],
  doctorId: null,
  packageId: null,
  status: "reviewing",
  quotation: null,
  assignedTo: null,
  arrangementChecklist: emptyChecklist,
  activity: [],
  consentAcceptedAt: now,
  deletedAt: null,
});
await upsertByField("tourism_medical_cases", "caseNumber", "SPM-CASE-DEMO02", {
  patient: {
    name: "Nasrin Akter",
    country: "Bangladesh",
    email: "nasrin.demo@example.com",
    phone: "+8801822223344",
  },
  userId: null,
  diagnosis: "Seeking IVF treatment abroad.",
  requestedService: "IVF cycle",
  documents: [],
  hospitalId: hospId["gleneagles-kuala-lumpur"],
  doctorId: null,
  packageId: null,
  status: "new",
  quotation: null,
  assignedTo: null,
  arrangementChecklist: emptyChecklist,
  activity: [],
  consentAcceptedAt: now,
  deletedAt: null,
});
await upsertByField(
  "tourism_appointments",
  "appointmentNumber",
  "SPM-APT-DEMO01",
  {
    patient: {
      name: "Tanvir Ahmed",
      email: "tanvir.demo@example.com",
      phone: "+8801933334455",
    },
    userId: null,
    doctorId: null,
    type: "teleconsultation",
    preferredTimes: ["Tue 10:00", "Wed 15:00"],
    notes: "Second opinion on MRI.",
    status: "pending",
    meetingLink: null,
    scheduledFor: null,
    assignedTo: null,
    activity: [],
    deletedAt: null,
  },
);
await upsertByField(
  "tourism_travel_requests",
  "travelRequestNumber",
  "SPM-TRV-DEMO01",
  {
    type: "air",
    details: {
      from: "DAC",
      to: "BKK",
      departDate: "2026-07-10",
      passengers: 2,
    },
    linkedCaseId: null,
    contact: {
      name: "Kamrul Hasan",
      email: "kamrul.demo@example.com",
      phone: "+8801711112233",
    },
    provider: "manual",
    status: "new",
    quote: null,
    assignedTo: null,
    activity: [],
    deletedAt: null,
  },
);
await upsertByField(
  "tourism_partner_applications",
  "partnerApplicationNumber",
  "SPM-PTR-DEMO01",
  {
    type: "hospital",
    orgInfo: {
      name: "Square Hospitals Ltd.",
      country: "Bangladesh",
      description: "Tertiary-care hospital interested in referral partnership.",
    },
    contact: {
      name: "Partnerships Desk",
      email: "partners.demo@example.com",
      phone: "+8801555667788",
    },
    documents: [],
    status: "new",
    assignedTo: null,
    activity: [],
    deletedAt: null,
  },
);

/* --------------------------------------------- Tourism testimonials (DB) */
const TOURISM_TESTIMONIALS = [
  {
    name: "Md. Rakib Hossain",
    role: "Cardiac surgery · India",
    quote:
      "Spiber Tourism made my treatment in India seamless. From hospital selection to visa and travel, everything was perfectly arranged.",
    imageSrc: "/nurse-holding-patient-hand-reassurance.jpeg",
    order: 0,
  },
  {
    name: "Shahana Akter",
    role: "Orthopedic treatment · Singapore",
    quote:
      "The team supported me at every step in Singapore. Excellent coordination, quick responses and great post-treatment follow-up.",
    imageSrc: "/nurse-comforting-elderly-woman-home-care.jpeg",
    order: 1,
  },
  {
    name: "Abu Sayeed",
    role: "Oncology treatment · Turkey",
    quote:
      "I highly recommend Spiber Tourism for international treatment. Their care and professionalism are truly exceptional.",
    imageSrc: "/smiling-medical-team-portrait.jpeg",
    order: 2,
  },
];
for (const t of TOURISM_TESTIMONIALS) {
  await db.collection("testimonials").updateOne(
    { name: t.name, category: "tourism" },
    {
      $set: {
        quote: t.quote,
        role: t.role,
        tone: "orange",
        imageSrc: t.imageSrc,
        category: "tourism",
        order: t.order,
        published: true,
        deletedAt: null,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
}

const counts = {
  destinations: await db
    .collection("tourism_destinations")
    .countDocuments({ deletedAt: null }),
  testimonials: await db
    .collection("testimonials")
    .countDocuments({ category: "tourism", deletedAt: null }),
  hospitals: await db
    .collection("tourism_hospitals")
    .countDocuments({ deletedAt: null }),
  doctors: await db
    .collection("tourism_doctors")
    .countDocuments({ deletedAt: null }),
  packages: await db
    .collection("tourism_packages")
    .countDocuments({ deletedAt: null }),
  cases: await db
    .collection("tourism_medical_cases")
    .countDocuments({ deletedAt: null }),
  appointments: await db
    .collection("tourism_appointments")
    .countDocuments({ deletedAt: null }),
  travel: await db
    .collection("tourism_travel_requests")
    .countDocuments({ deletedAt: null }),
  partners: await db
    .collection("tourism_partner_applications")
    .countDocuments({ deletedAt: null }),
};
console.log("Seeded full tourism ecosystem:", counts);
await c.close();
