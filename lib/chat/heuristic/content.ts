/**
 * Trilingual content for the heuristic chat engine — curated business knowledge,
 * reply copy, action-button labels and quick-reply chips, authored inline in
 * en / bn / ja (mirrors how the transactional email services embed trilingual
 * copy). English is the source of truth and the fallback.
 *
 * ⚠ The Bangla + Japanese strings are first-pass translations — flag for a
 * native-speaker review pass before launch (same as the rest of the site's AI
 * BN/JA copy).
 */
import type { Locale } from "@/i18n/routing";
import { CONTACT, OFFICES } from "@/lib/contact";

/** A localized string. English required + used as the fallback. */
export type L = { en: string; bn: string; ja: string };

export function pick(l: L, locale: Locale): string {
  return (locale === "ja" && l.ja) || (locale === "bn" && l.bn) || l.en;
}

/* ── Contact channels ────────────────────────────────────────────────────── */

/** Digits-only WhatsApp number (Spiber Med Limited). */
export const WHATSAPP_NUMBER = "8801346092798";

export function whatsappUrl(text?: string): string {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export const CONTACT_INFO = {
  phone: CONTACT.phone,
  phoneHref: CONTACT.phoneHref,
  email: CONTACT.generalEmail,
  headOffice: OFFICES[0]?.address.en.replace(/\n/g, ", ") ?? "",
} as const;

/* ── Canonical public routes (locale-relative; rendered with the i18n Link) ── */

export const ROUTES = {
  home: "/",
  medtrade: "/medtrade",
  kart: "/kart",
  kartShop: "/kart/shop",
  kartBrands: "/kart/brands",
  requestProduct: "/kart/request-product",
  becomeSeller: "/become-a-seller",
  academy: "/academy",
  digihealth: "/digihealth",
  tourism: "/tourism",
  tourismDoctors: "/tourism/doctors",
  tourismPackages: "/tourism/packages",
  tourismConsult: "/tourism/request-consultation",
  tourismCaseLookup: "/tourism/case-lookup",
  healthCorner: "/health-corner",
  blog: "/blog",
  about: "/about",
  contact: "/contact",
  accountQuotations: "/account/quotations",
  accountCases: "/account/cases",
} as const;

/* ── Action-button labels ────────────────────────────────────────────────── */

export const LABELS: Record<string, L> = {
  browseMedtrade: {
    en: "Browse medical devices",
    bn: "মেডিকেল ডিভাইস দেখুন",
    ja: "医療機器を見る",
  },
  shopKart: {
    en: "Shop Spiber Kart",
    bn: "স্পাইবার কার্টে কেনাকাটা",
    ja: "Spiber Kart で買う",
  },
  exploreAcademy: {
    en: "Explore courses",
    bn: "কোর্স দেখুন",
    ja: "コースを見る",
  },
  exploreDigihealth: {
    en: "Explore software",
    bn: "সফটওয়্যার দেখুন",
    ja: "ソフトウェアを見る",
  },
  exploreTourism: {
    en: "Medical tourism",
    bn: "মেডিকেল ট্যুরিজম",
    ja: "医療ツーリズム",
  },
  readBlog: { en: "Read the blog", bn: "ব্লগ পড়ুন", ja: "ブログを読む" },
  aboutUs: { en: "About us", bn: "আমাদের সম্পর্কে", ja: "会社について" },
  contactUs: { en: "Contact us", bn: "যোগাযোগ করুন", ja: "お問い合わせ" },
  requestQuote: {
    en: "Request a quotation",
    bn: "কোটেশন চান",
    ja: "見積もりを依頼",
  },
  requestProduct: {
    en: "Request a product",
    bn: "পণ্যের অনুরোধ করুন",
    ja: "商品をリクエスト",
  },
  becomeSeller: {
    en: "Become a seller",
    bn: "বিক্রেতা হোন",
    ja: "出品者になる",
  },
  whatsapp: {
    en: "Chat on WhatsApp",
    bn: "হোয়াটসঅ্যাপে চ্যাট",
    ja: "WhatsApp で相談",
  },
  login: { en: "Log in", bn: "লগ ইন", ja: "ログイン" },
  talkToHuman: {
    en: "Talk to our team",
    bn: "আমাদের টিমের সাথে কথা বলুন",
    ja: "担当者に相談",
  },
  leaveDetails: {
    en: "Leave your details",
    bn: "আপনার তথ্য দিন",
    ja: "連絡先を残す",
  },
  viewAll: {
    en: "View all results",
    bn: "সব ফলাফল দেখুন",
    ja: "すべての結果を見る",
  },
  trackOrder: {
    en: "Track my order",
    bn: "অর্ডার ট্র্যাক করুন",
    ja: "注文を追跡",
  },
  caseStatus: {
    en: "Check case status",
    bn: "কেস স্ট্যাটাস দেখুন",
    ja: "ケースの状況を確認",
  },
  bookConsultation: {
    en: "Book a consultation",
    bn: "পরামর্শ বুক করুন",
    ja: "相談を予約",
  },
  addToCart: { en: "Add to cart", bn: "কার্টে যোগ করুন", ja: "カートに追加" },
  viewOrder: { en: "View order", bn: "অর্ডার দেখুন", ja: "注文を見る" },
  viewQuotations: {
    en: "My quotations",
    bn: "আমার কোটেশন",
    ja: "見積もり一覧",
  },
};

/* ── Reply copy ──────────────────────────────────────────────────────────── */

export const SAY: Record<string, L> = {
  greeting: {
    en: "Hi! 👋 I'm the Spiber Med assistant. I can help you explore our medical devices, marketplace, courses, health software and medical-tourism services — search the catalog, check an order, or connect you with our team. What can I help you with?",
    bn: "হ্যালো! 👋 আমি স্পাইবার মেড অ্যাসিস্ট্যান্ট। আমাদের মেডিকেল ডিভাইস, মার্কেটপ্লেস, কোর্স, হেলথ সফটওয়্যার ও মেডিকেল ট্যুরিজম সেবা খুঁজে পেতে সাহায্য করতে পারি — ক্যাটালগ সার্চ, অর্ডার চেক, বা আমাদের টিমের সাথে সংযোগ। কীভাবে সাহায্য করতে পারি?",
    ja: "こんにちは！👋 Spiber Med アシスタントです。医療機器・マーケットプレイス・研修コース・ヘルスソフトウェア・医療ツーリズムのご案内、カタログ検索、注文確認、担当チームへのおつなぎができます。どのようなご用件でしょうか？",
  },
  greetingShort: {
    en: "Hi again! How can I help?",
    bn: "আবার হ্যালো! কীভাবে সাহায্য করতে পারি?",
    ja: "こんにちは！ご用件をどうぞ。",
  },
  fallback: {
    en: "I'm not sure I caught that. I can help with our medical devices, the Spiber Kart marketplace, Academy courses, health software, medical tourism, orders, or getting you to a human. Try one of these:",
    bn: "ঠিক বুঝতে পারিনি। আমি মেডিকেল ডিভাইস, স্পাইবার কার্ট মার্কেটপ্লেস, একাডেমি কোর্স, হেলথ সফটওয়্যার, মেডিকেল ট্যুরিজম, অর্ডার, বা টিমের সাথে সংযোগে সাহায্য করতে পারি। যেকোনো একটি বেছে নিন:",
    ja: "うまく理解できませんでした。医療機器、Spiber Kart マーケットプレイス、Academy コース、ヘルスソフトウェア、医療ツーリズム、注文、担当者へのおつなぎができます。次からお選びください：",
  },
  divisionsOverview: {
    en: "Spiber Med is a healthcare group with five divisions plus a blog:\n\n• Spiber Medtrade — medical devices & hospital equipment (quotation-based)\n• Spiber Kart — an online marketplace you can buy from directly\n• Spiber Academy — medical training & certification courses\n• Spiber Digihealth — digital-health software\n• Spiber Tourism — medical travel & treatment abroad\n• Spiber Health Corner — coming soon\n\nWhich one would you like to explore?",
    bn: "স্পাইবার মেড একটি হেলথকেয়ার গ্রুপ — পাঁচটি বিভাগ ও একটি ব্লগ:\n\n• স্পাইবার মেডট্রেড — মেডিকেল ডিভাইস ও হাসপাতাল সরঞ্জাম (কোটেশন-ভিত্তিক)\n• স্পাইবার কার্ট — অনলাইন মার্কেটপ্লেস, সরাসরি কেনা যায়\n• স্পাইবার একাডেমি — মেডিকেল প্রশিক্ষণ ও সার্টিফিকেশন কোর্স\n• স্পাইবার ডিজিহেলথ — ডিজিটাল হেলথ সফটওয়্যার\n• স্পাইবার ট্যুরিজম — মেডিকেল ভ্রমণ ও বিদেশে চিকিৎসা\n• স্পাইবার হেলথ কর্নার — শীঘ্রই আসছে\n\nকোনটি দেখতে চান?",
    ja: "Spiber Med は5つの部門とブログを持つヘルスケアグループです：\n\n• Spiber Medtrade — 医療機器・病院設備（見積もり制）\n• Spiber Kart — 直接購入できるオンラインマーケット\n• Spiber Academy — 医療研修・認定コース\n• Spiber Digihealth — デジタルヘルス・ソフトウェア\n• Spiber Tourism — 海外での医療・治療\n• Spiber Health Corner — 近日公開\n\nどれをご覧になりますか？",
  },
  medtrade: {
    en: "Spiber Medtrade supplies medical devices and hospital equipment — imaging, patient monitoring, critical care, OR & surgical solutions, lab and more. Prices are quotation-based: browse the catalog and request a quote for the items you need, and our team responds with pricing and availability.",
    bn: "স্পাইবার মেডট্রেড মেডিকেল ডিভাইস ও হাসপাতাল সরঞ্জাম সরবরাহ করে — ইমেজিং, পেশেন্ট মনিটরিং, ক্রিটিক্যাল কেয়ার, OR ও সার্জিক্যাল সমাধান, ল্যাব ইত্যাদি। দাম কোটেশন-ভিত্তিক: ক্যাটালগ দেখুন এবং প্রয়োজনীয় পণ্যের জন্য কোটেশন চান, আমাদের টিম দাম ও সহজলভ্যতা জানাবে।",
    ja: "Spiber Medtrade は医療機器・病院設備を提供します — 画像診断、患者モニタリング、集中治療、手術室・外科ソリューション、検査機器など。価格は見積もり制です。カタログをご覧になり、必要な機器の見積もりをご依頼ください。担当チームが価格と在庫をご案内します。",
  },
  kart: {
    en: "Spiber Kart is our online marketplace — health, wellness and everyday medical products you can add to cart and buy directly, with secure checkout and delivery across Bangladesh. Want me to search it for something specific?",
    bn: "স্পাইবার কার্ট আমাদের অনলাইন মার্কেটপ্লেস — স্বাস্থ্য, ওয়েলনেস ও দৈনন্দিন মেডিকেল পণ্য, কার্টে যোগ করে সরাসরি কেনা যায়, নিরাপদ চেকআউট ও সারা বাংলাদেশে ডেলিভারি সহ। নির্দিষ্ট কিছু খুঁজে দেব?",
    ja: "Spiber Kart はオンラインマーケットプレイスです — 健康・ウェルネス・日常の医療用品をカートに入れて直接購入でき、安全な決済とバングラデシュ全国配送に対応。特定の商品をお探ししましょうか？",
  },
  academy: {
    en: "Spiber Academy offers medical training and certification — video courses with quizzes and completion certificates. Some lessons are free to preview; enrolment is per-course. Want to see what's available?",
    bn: "স্পাইবার একাডেমি মেডিকেল প্রশিক্ষণ ও সার্টিফিকেশন দেয় — কুইজ ও সমাপ্তি সার্টিফিকেট সহ ভিডিও কোর্স। কিছু লেসন ফ্রি প্রিভিউ; এনরোলমেন্ট কোর্সভিত্তিক। কী কী আছে দেখবেন?",
    ja: "Spiber Academy は医療研修・認定を提供します — クイズと修了証つきの動画コース。一部レッスンは無料プレビュー可能で、受講はコース単位です。開講中のコースをご覧になりますか？",
  },
  digihealth: {
    en: "Spiber Digihealth builds digital-health software — clinical and practice tools delivered as licenses, downloadable assets or hosted access. Some products are purchasable online; others are quote / request-access based. Want to browse them?",
    bn: "স্পাইবার ডিজিহেলথ ডিজিটাল হেলথ সফটওয়্যার তৈরি করে — ক্লিনিক্যাল ও প্র্যাকটিস টুল, লাইসেন্স, ডাউনলোডযোগ্য অ্যাসেট বা হোস্টেড অ্যাক্সেস হিসেবে। কিছু পণ্য অনলাইনে কেনা যায়; অন্যগুলো কোটেশন/অ্যাক্সেস অনুরোধভিত্তিক। দেখবেন?",
    ja: "Spiber Digihealth はデジタルヘルス・ソフトウェアを開発します — ライセンス、ダウンロード資産、ホスト型アクセスとして提供する臨床・診療ツール。オンライン購入できる製品もあれば、見積もり／利用申請制のものもあります。ご覧になりますか？",
  },
  tourism: {
    en: "Spiber Tourism arranges medical travel and treatment abroad — connecting you with vetted hospitals and doctors, cost estimates, and end-to-end travel support (flights, visa, hotels, transfers). Share your treatment need and we'll guide the next steps.",
    bn: "স্পাইবার ট্যুরিজম মেডিকেল ভ্রমণ ও বিদেশে চিকিৎসার ব্যবস্থা করে — যাচাইকৃত হাসপাতাল ও ডাক্তার, খরচের ধারণা, এবং সম্পূর্ণ ভ্রমণ সহায়তা (ফ্লাইট, ভিসা, হোটেল, ট্রান্সফার) সহ। আপনার চিকিৎসার প্রয়োজন জানান, আমরা পরবর্তী ধাপ দেখাব।",
    ja: "Spiber Tourism は海外での医療・治療を手配します — 審査済みの病院・医師のご紹介、費用の目安、渡航の総合サポート（航空券・ビザ・ホテル・送迎）。ご希望の治療内容をお知らせいただければ、次のステップをご案内します。",
  },
  healthCorner: {
    en: "Spiber Health Corner is launching soon — a new wellness and health-content experience. Want me to point you to our other divisions in the meantime?",
    bn: "স্পাইবার হেলথ কর্নার শীঘ্রই চালু হচ্ছে — একটি নতুন ওয়েলনেস ও হেলথ-কনটেন্ট অভিজ্ঞতা। এর মধ্যে আমাদের অন্য বিভাগগুলো দেখাব?",
    ja: "Spiber Health Corner は近日公開予定です — 新しいウェルネス・健康コンテンツ体験。その間、他の部門をご案内しましょうか？",
  },
  blog: {
    en: "Our blog covers health education, medical-tourism guides, product know-how and company news. Have a read:",
    bn: "আমাদের ব্লগে আছে স্বাস্থ্য শিক্ষা, মেডিকেল ট্যুরিজম গাইড, পণ্য সম্পর্কিত তথ্য ও কোম্পানির খবর। পড়ুন:",
    ja: "ブログでは健康教育、医療ツーリズムガイド、製品情報、会社ニュースを掲載しています。ぜひご覧ください：",
  },
  aboutCompany: {
    en: "Spiber Med is a Bangladesh-based healthcare group bringing medical devices, an online marketplace, professional training, health software and medical tourism together under one trusted brand. Learn more about who we are:",
    bn: "স্পাইবার মেড বাংলাদেশভিত্তিক একটি হেলথকেয়ার গ্রুপ, যা মেডিকেল ডিভাইস, অনলাইন মার্কেটপ্লেস, পেশাদার প্রশিক্ষণ, হেলথ সফটওয়্যার ও মেডিকেল ট্যুরিজম একটি বিশ্বস্ত ব্র্যান্ডের অধীনে নিয়ে এসেছে। আমাদের সম্পর্কে জানুন:",
    ja: "Spiber Med はバングラデシュを拠点とするヘルスケアグループで、医療機器・オンラインマーケット・専門研修・ヘルスソフトウェア・医療ツーリズムを一つの信頼できるブランドのもとに統合しています。詳しくはこちら：",
  },
  contactIntro: {
    en: "Here's how to reach us:",
    bn: "আমাদের সাথে যোগাযোগের উপায়:",
    ja: "お問い合わせ方法はこちらです：",
  },
  contactOutro: {
    en: "You can also message us on WhatsApp or use the contact form.",
    bn: "আপনি হোয়াটসঅ্যাপে বার্তা দিতে পারেন বা যোগাযোগ ফর্ম ব্যবহার করতে পারেন।",
    ja: "WhatsApp でのメッセージや、お問い合わせフォームもご利用いただけます。",
  },
  hours: {
    en: "Our team is available Saturday–Thursday, 09:00–18:00 (BST). Outside hours, leave your details or message us on WhatsApp and we'll get back to you.",
    bn: "আমাদের টিম শনি–বৃহস্পতি, ০৯:০০–১৮:০০ (BST) পাওয়া যায়। সময়ের বাইরে, আপনার তথ্য দিন বা হোয়াটসঅ্যাপে বার্তা দিন — আমরা যোগাযোগ করব।",
    ja: "対応時間は土〜木曜、09:00〜18:00（BST）です。時間外は連絡先を残すか WhatsApp へメッセージをお送りください。折り返しご連絡します。",
  },
  shipping: {
    en: "Spiber Kart delivers across Bangladesh. Shipping is a flat fee with free delivery over a threshold (shown at checkout); some areas and larger equipment may vary. Medtrade devices are arranged per quotation. Want me to open the shop?",
    bn: "স্পাইবার কার্ট সারা বাংলাদেশে ডেলিভারি দেয়। শিপিং একটি নির্দিষ্ট ফি, একটি সীমার বেশি হলে ফ্রি (চেকআউটে দেখানো হয়); কিছু এলাকা ও বড় সরঞ্জামে ভিন্ন হতে পারে। মেডট্রেড ডিভাইস কোটেশন অনুযায়ী ব্যবস্থা হয়। শপ খুলব?",
    ja: "Spiber Kart はバングラデシュ全国に配送します。送料は一律で、一定額以上は無料（決済時に表示）。一部地域や大型機器は異なる場合があります。Medtrade の機器は見積もりごとに手配します。ショップを開きましょうか？",
  },
  returns: {
    en: "For Spiber Kart orders, eligible items can be returned or exchanged per our return policy — reach our team with your order number and we'll help. Want to check an order or talk to someone?",
    bn: "স্পাইবার কার্ট অর্ডারের ক্ষেত্রে, উপযুক্ত পণ্য আমাদের রিটার্ন নীতি অনুযায়ী ফেরত বা বিনিময় করা যায় — আপনার অর্ডার নম্বর দিয়ে আমাদের টিমকে জানান, আমরা সাহায্য করব। অর্ডার চেক করবেন নাকি কারো সাথে কথা বলবেন?",
    ja: "Spiber Kart のご注文は、返品ポリシーに基づき対象商品の返品・交換が可能です。注文番号を添えて担当チームへご連絡ください。注文を確認しますか、それとも担当者にお繋ぎしますか？",
  },
  payment: {
    en: "We currently accept manual/offline payment — bank transfer or cash on delivery — and an admin confirms the order. All prices are in Bangladeshi Taka (৳). Online gateways are being added.",
    bn: "আমরা বর্তমানে ম্যানুয়াল/অফলাইন পেমেন্ট নিই — ব্যাংক ট্রান্সফার বা ক্যাশ অন ডেলিভারি — এবং একজন অ্যাডমিন অর্ডার নিশ্চিত করেন। সব দাম বাংলাদেশি টাকায় (৳)। অনলাইন গেটওয়ে যুক্ত হচ্ছে।",
    ja: "現在は手動／オフライン決済（銀行振込または代金引換）に対応し、管理者が注文を確認します。価格はすべてバングラデシュ・タカ（৳）です。オンライン決済も順次追加予定です。",
  },
  howToOrder: {
    en: "To order on Spiber Kart: search or browse the shop, add items to your cart, then check out with your delivery address. You can order as a guest or log in. Shall I open the shop or search for something?",
    bn: "স্পাইবার কার্টে অর্ডার করতে: শপ সার্চ বা ব্রাউজ করুন, কার্টে পণ্য যোগ করুন, তারপর ডেলিভারি ঠিকানা দিয়ে চেকআউট করুন। গেস্ট হিসেবে বা লগ ইন করে অর্ডার করা যায়। শপ খুলব নাকি কিছু খুঁজব?",
    ja: "Spiber Kart でのご注文方法：ショップで検索・閲覧し、商品をカートに追加、配送先を入力して決済します。ゲストのままでもログインでも注文可能です。ショップを開くか、商品を検索しましょうか？",
  },
  howToRfq: {
    en: "For Medtrade devices, add the items you need to your quotation list and submit a request — no login required. Our team replies with pricing, availability and a formal quote. Want to browse the device catalog?",
    bn: "মেডট্রেড ডিভাইসের জন্য, প্রয়োজনীয় পণ্য আপনার কোটেশন তালিকায় যোগ করে অনুরোধ জমা দিন — লগ ইন লাগবে না। আমাদের টিম দাম, সহজলভ্যতা ও একটি আনুষ্ঠানিক কোটেশন জানাবে। ডিভাইস ক্যাটালগ দেখবেন?",
    ja: "Medtrade の機器は、必要な機器を見積もりリストに追加してリクエストを送信するだけです（ログイン不要）。担当チームが価格・在庫・正式見積もりをご返信します。機器カタログをご覧になりますか？",
  },
  requestProduct: {
    en: "Can't find something? Tell us what you need and we'll try to source it for you. Submit a product request and our team follows up.",
    bn: "কিছু খুঁজে পাচ্ছেন না? আপনার প্রয়োজন জানান, আমরা সেটি সংগ্রহের চেষ্টা করব। একটি পণ্যের অনুরোধ জমা দিন, আমাদের টিম যোগাযোগ করবে।",
    ja: "お探しの商品が見つかりませんか？ ご希望をお知らせいただければ、当社が調達を試みます。商品リクエストを送信いただければ担当チームが対応します。",
  },
  becomeSeller: {
    en: "You can sell on Spiber Kart. Apply to become a seller and, once approved, get a self-serve portal to list products, manage orders and track payouts.",
    bn: "আপনি স্পাইবার কার্টে বিক্রি করতে পারেন। বিক্রেতা হওয়ার আবেদন করুন এবং অনুমোদনের পর পণ্য তালিকাভুক্ত করা, অর্ডার পরিচালনা ও পেআউট ট্র্যাক করার একটি সেলফ-সার্ভ পোর্টাল পাবেন।",
    ja: "Spiber Kart で販売できます。出品者登録を申請し、承認されるとセルフサービスのポータルで商品の掲載・注文管理・支払い確認ができます。",
  },
  loginPrompt: {
    en: "You can log in or create an account to track orders, manage quotations and enrol in courses. Want me to open the login window?",
    bn: "অর্ডার ট্র্যাক, কোটেশন পরিচালনা ও কোর্সে ভর্তির জন্য লগ ইন করতে বা অ্যাকাউন্ট তৈরি করতে পারেন। লগ ইন উইন্ডো খুলব?",
    ja: "ログインまたはアカウント作成で、注文追跡・見積もり管理・コース受講ができます。ログイン画面を開きましょうか？",
  },
  searchAsk: {
    en: "Sure — what are you looking for? Type a product, course or software name and I'll search the catalog.",
    bn: "অবশ্যই — কী খুঁজছেন? একটি পণ্য, কোর্স বা সফটওয়্যারের নাম লিখুন, আমি ক্যাটালগ সার্চ করব।",
    ja: "承知しました — 何をお探しですか？ 商品・コース・ソフトウェア名を入力いただければカタログを検索します。",
  },
  searchResults: {
    en: "Here's what I found:",
    bn: "যা পেলাম:",
    ja: "検索結果はこちらです：",
  },
  searchNoResults: {
    en: "I couldn't find anything matching that in our catalog. Try different words, or I can connect you with our team to source it.",
    bn: "আমাদের ক্যাটালগে এর সাথে মিলে এমন কিছু পাইনি। ভিন্ন শব্দ চেষ্টা করুন, অথবা আমি আপনাকে টিমের সাথে সংযোগ করতে পারি।",
    ja: "カタログ内に該当する商品が見つかりませんでした。別のキーワードをお試しいただくか、担当チームにおつなぎして調達を試みることもできます。",
  },
  orderAskDetails: {
    en: "I can check that. Please share your order number and the email used on the order (e.g. SPM-… and you@example.com).",
    bn: "আমি দেখতে পারি। অনুগ্রহ করে আপনার অর্ডার নম্বর ও অর্ডারে ব্যবহৃত ইমেইল দিন (যেমন SPM-… এবং you@example.com)।",
    ja: "確認いたします。注文番号と、ご注文時のメールアドレスをお知らせください（例：SPM-… と you@example.com）。",
  },
  orderNeedBoth: {
    en: "I need both an order number and the order email to look it up. Could you share the missing one?",
    bn: "খুঁজে পেতে আমার অর্ডার নম্বর ও অর্ডার ইমেইল দুটোই দরকার। যেটি বাদ পড়েছে সেটি দেবেন?",
    ja: "照会には注文番号とメールアドレスの両方が必要です。不足している方をお知らせいただけますか？",
  },
  orderNotFound: {
    en: "I couldn't find an order matching those details. Double-check the number and email, or I can connect you with our team.",
    bn: "সেই তথ্যের সাথে মিলে এমন কোনো অর্ডার পাইনি। নম্বর ও ইমেইল আবার দেখুন, অথবা আমি টিমের সাথে সংযোগ করতে পারি।",
    ja: "その情報に一致する注文が見つかりませんでした。番号とメールをご確認いただくか、担当チームにおつなぎします。",
  },
  orderFound: {
    en: "Found it — here's your order:",
    bn: "পেয়েছি — আপনার অর্ডার:",
    ja: "見つかりました — ご注文はこちらです：",
  },
  caseAskDetails: {
    en: "I can check your medical-tourism case. Please share your case reference (SPM-CASE-…) and the email on the case.",
    bn: "আমি আপনার মেডিকেল ট্যুরিজম কেস দেখতে পারি। অনুগ্রহ করে আপনার কেস রেফারেন্স (SPM-CASE-…) ও কেসের ইমেইল দিন।",
    ja: "医療ツーリズムのケースを確認できます。ケース番号（SPM-CASE-…）とケースに登録されたメールをお知らせください。",
  },
  caseNotFound: {
    en: "I couldn't find a case matching those details. Please re-check the reference and email, or contact our team.",
    bn: "সেই তথ্যের সাথে মিলে এমন কোনো কেস পাইনি। রেফারেন্স ও ইমেইল আবার দেখুন, অথবা টিমের সাথে যোগাযোগ করুন।",
    ja: "その情報に一致するケースが見つかりませんでした。番号とメールをご確認いただくか、担当チームへお問い合わせください。",
  },
  caseFound: {
    en: "Here's your case status:",
    bn: "আপনার কেস স্ট্যাটাস:",
    ja: "ケースの状況はこちらです：",
  },
  humanHandoff: {
    en: "Happy to connect you with a person. The fastest way is WhatsApp; you can also leave your details and our team will reach out during business hours.",
    bn: "আপনাকে একজন মানুষের সাথে সংযোগ করতে পেরে খুশি। দ্রুততম উপায় হোয়াটসঅ্যাপ; আপনি তথ্য দিলে আমাদের টিম কর্মঘণ্টায় যোগাযোগ করবে।",
    ja: "担当者におつなぎします。最も早いのは WhatsApp です。連絡先を残していただければ、営業時間内に担当チームからご連絡します。",
  },
  leadIntro: {
    en: "Leave your details and we'll follow up. What's the best name, email and (optionally) phone to reach you?",
    bn: "আপনার তথ্য দিন, আমরা যোগাযোগ করব। আপনার নাম, ইমেইল ও (ঐচ্ছিক) ফোন কী?",
    ja: "連絡先を残していただければ折り返します。お名前・メール・（任意で）電話番号をお知らせください。",
  },
  leadThanks: {
    en: "Thank you! Our team has your details and will get back to you shortly. Anything else I can help with?",
    bn: "ধন্যবাদ! আমাদের টিম আপনার তথ্য পেয়েছে এবং শীঘ্রই যোগাযোগ করবে। আর কিছুতে সাহায্য করতে পারি?",
    ja: "ありがとうございます！ 担当チームが連絡先を受け取りました。追ってご連絡します。ほかにご用件はありますか？",
  },
  thanks: {
    en: "You're welcome! Is there anything else I can help you with?",
    bn: "স্বাগতম! আর কিছুতে সাহায্য করতে পারি?",
    ja: "どういたしまして！ ほかにご用件はありますか？",
  },
};

/* ── Quick-reply chips (natural phrases → recognised as clicked === typed) ─── */

export type Chip = { intent: string; label: L };

export const CHIPS: Record<string, Chip> = {
  divisions: {
    intent: "divisions",
    label: {
      en: "What do you offer?",
      bn: "আপনারা কী অফার করেন?",
      ja: "取扱いは？",
    },
  },
  medtrade: {
    intent: "medtrade",
    label: { en: "Medical devices", bn: "মেডিকেল ডিভাইস", ja: "医療機器" },
  },
  shop: {
    intent: "kart",
    label: {
      en: "Shop the marketplace",
      bn: "মার্কেটপ্লেসে কেনাকাটা",
      ja: "マーケットで買う",
    },
  },
  courses: {
    intent: "academy",
    label: { en: "Training courses", bn: "প্রশিক্ষণ কোর্স", ja: "研修コース" },
  },
  tourism: {
    intent: "tourism",
    label: {
      en: "Medical tourism",
      bn: "মেডিকেল ট্যুরিজম",
      ja: "医療ツーリズム",
    },
  },
  trackOrder: {
    intent: "order_lookup",
    label: {
      en: "Track my order",
      bn: "অর্ডার ট্র্যাক করুন",
      ja: "注文を追跡",
    },
  },
  quotation: {
    intent: "quotation",
    label: { en: "Request a quote", bn: "কোটেশন চান", ja: "見積もりを依頼" },
  },
  contact: {
    intent: "contact",
    label: { en: "Contact details", bn: "যোগাযোগের তথ্য", ja: "連絡先" },
  },
  human: {
    intent: "human",
    label: {
      en: "Talk to a human",
      bn: "মানুষের সাথে কথা",
      ja: "担当者に相談",
    },
  },
};

/** Localized suggestion strings for a set of chip ids. */
export function chipLabels(ids: string[], locale: Locale): string[] {
  return ids
    .map((id) => CHIPS[id])
    .filter(Boolean)
    .map((c) => pick(c.label, locale));
}
