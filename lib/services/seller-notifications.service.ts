import { findUserById } from "@/lib/repositories/users.repo";
import { getMailer } from "@/lib/mailer";
import { renderEmail } from "@/lib/mailer/templates/email-layout";
import { siteConfig } from "@/lib/site-config";
import { formatBDT } from "@/lib/money";
import { logger } from "@/lib/log";
import type { ISeller } from "@/lib/models/seller";
import type { ISellerCommission } from "@/lib/models/seller-commission";
import type { ISellerPayout } from "@/lib/models/seller-payout";

/**
 * Transactional emails to SELLERS (sale made, listing moderated, payout paid).
 * All best-effort: a mail failure is logged and never fails the calling flow.
 * Copy is trilingual keyed on the seller-user's stored locale, mirroring the
 * application/decision emails in seller-application.service.
 */

type SellerLike = Pick<ISeller, "displayName"> & {
  userId: unknown;
};

async function sellerRecipient(
  seller: SellerLike,
): Promise<{ email: string; name: string; locale: "en" | "bn" | "ja" } | null> {
  const user = await findUserById(String(seller.userId)).catch(() => null);
  if (!user?.email) return null;
  return {
    email: user.email,
    name: user.name || seller.displayName,
    locale: (user.locale as "en" | "bn" | "ja") ?? "en",
  };
}

/** "You made a sale" — sent when an order with this seller's items is PAID. */
export async function notifySellerNewPaidOrder(
  seller: SellerLike,
  commission: Pick<
    ISellerCommission,
    | "orderNumber"
    | "itemSubtotalMinor"
    | "commissionAmountMinor"
    | "sellerEarningsMinor"
    | "lines"
  >,
): Promise<void> {
  try {
    const to = await sellerRecipient(seller);
    if (!to) return;
    const brand = siteConfig.brand;
    const gross = formatBDT(commission.itemSubtotalMinor);
    const fee = formatBDT(commission.commissionAmountMinor);
    const net = formatBDT(commission.sellerEarningsMinor);
    const itemLines = (commission.lines ?? []).map(
      (l) => `${l.name} × ${l.qty} — ${formatBDT(l.subtotalMinor)}`,
    );

    const c =
      to.locale === "ja"
        ? {
            subject: `ご注文が入りました — ${commission.orderNumber}`,
            eyebrow: "新しい注文",
            heading: "商品が売れました",
            paragraph: `${to.name} 様、お客様の商品を含む注文 ${commission.orderNumber} の支払いが確認されました。`,
            rows: [
              { label: "注文番号", value: commission.orderNumber },
              { label: "商品売上", value: gross },
              { label: "販売手数料", value: `− ${fee}` },
              { label: "受取額", value: net, strong: true },
            ],
            outro: `詳細は出品者ダッシュボードをご確認ください: ${siteConfig.url}/seller/orders`,
          }
        : to.locale === "bn"
          ? {
              subject: `নতুন অর্ডার — ${commission.orderNumber}`,
              eyebrow: "নতুন অর্ডার",
              heading: "আপনার পণ্য বিক্রি হয়েছে",
              paragraph: `প্রিয় ${to.name}, আপনার পণ্যসহ অর্ডার ${commission.orderNumber}-এর পেমেন্ট নিশ্চিত হয়েছে।`,
              rows: [
                { label: "অর্ডার নম্বর", value: commission.orderNumber },
                { label: "পণ্য বিক্রয়", value: gross },
                { label: "প্ল্যাটফর্ম ফি", value: `− ${fee}` },
                { label: "আপনার আয়", value: net, strong: true },
              ],
              outro: `বিস্তারিত দেখুন সেলার ড্যাশবোর্ডে: ${siteConfig.url}/seller/orders`,
            }
          : {
              subject: `You made a sale — ${commission.orderNumber}`,
              eyebrow: "New order",
              heading: "Your product just sold",
              paragraph: `Hi ${to.name}, payment was confirmed for order ${commission.orderNumber}, which includes your products.`,
              rows: [
                { label: "Order", value: commission.orderNumber },
                { label: "Item sales", value: gross },
                { label: "Platform fee", value: `− ${fee}` },
                { label: "Your earnings", value: net, strong: true },
              ],
              outro: `See the details in your seller dashboard: ${siteConfig.url}/seller/orders`,
            };

    const built = renderEmail({
      accent: "teal",
      preheader: c.paragraph,
      eyebrow: c.eyebrow,
      heading: c.heading,
      paragraphs: [
        c.paragraph,
        ...(itemLines.length ? [itemLines.join(" · ")] : []),
      ],
      details: { rows: c.rows },
      outro: [c.outro],
    });
    await getMailer().send({
      to: to.email,
      subject: `${c.subject} — ${brand}`,
      html: built.html,
      text: built.text,
      attachments: built.attachments,
    });
  } catch (e) {
    logger.warn("seller new-order email failed", e);
  }
}

/** Listing approved / rejected (covers both new listings and edits-in-review). */
export async function notifySellerProductModeration(
  seller: SellerLike,
  productName: string,
  decision: "approved" | "rejected",
  opts: { reason?: string | null; isUpdate?: boolean } = {},
): Promise<void> {
  try {
    const to = await sellerRecipient(seller);
    if (!to) return;
    const brand = siteConfig.brand;
    const approved = decision === "approved";
    const isUpdate = Boolean(opts.isUpdate);
    const reason = opts.reason?.trim();

    const c =
      to.locale === "ja"
        ? approved
          ? {
              subject: isUpdate
                ? `商品の更新が承認されました — ${productName}`
                : `商品が承認されました — ${productName}`,
              eyebrow: "審査完了",
              heading: isUpdate
                ? "更新が公開されました"
                : "商品が公開されました",
              paragraph: `${to.name} 様、「${productName}」${isUpdate ? "の更新" : ""}が承認され、Spiber Kart に公開されました。`,
              outro: `商品を管理する: ${siteConfig.url}/seller/products`,
            }
          : {
              subject: isUpdate
                ? `商品の更新が承認されませんでした — ${productName}`
                : `商品が承認されませんでした — ${productName}`,
              eyebrow: "審査結果",
              heading: "承認されませんでした",
              paragraph: `${to.name} 様、「${productName}」${isUpdate ? "の更新" : ""}は今回承認されませんでした。${reason ? `理由: ${reason}` : ""}${isUpdate ? " 現在公開中の内容はそのまま販売が継続されます。" : ""}`,
              outro: `内容を修正して再提出できます: ${siteConfig.url}/seller/products`,
            }
        : to.locale === "bn"
          ? approved
            ? {
                subject: isUpdate
                  ? `আপনার পণ্যের আপডেট অনুমোদিত — ${productName}`
                  : `আপনার পণ্য অনুমোদিত — ${productName}`,
                eyebrow: "রিভিউ সম্পন্ন",
                heading: isUpdate ? "আপডেট এখন লাইভ" : "পণ্য এখন লাইভ",
                paragraph: `প্রিয় ${to.name}, "${productName}"${isUpdate ? "-এর আপডেট" : ""} অনুমোদিত হয়ে স্পাইবার কার্টে প্রকাশিত হয়েছে।`,
                outro: `পণ্য ব্যবস্থাপনা: ${siteConfig.url}/seller/products`,
              }
            : {
                subject: isUpdate
                  ? `আপনার পণ্যের আপডেট অনুমোদিত হয়নি — ${productName}`
                  : `আপনার পণ্য অনুমোদিত হয়নি — ${productName}`,
                eyebrow: "রিভিউয়ের ফলাফল",
                heading: "অনুমোদিত হয়নি",
                paragraph: `প্রিয় ${to.name}, "${productName}"${isUpdate ? "-এর আপডেট" : ""} এবার অনুমোদন করা যায়নি।${reason ? ` কারণ: ${reason}` : ""}${isUpdate ? " আপনার বর্তমান লাইভ সংস্করণটি বিক্রির জন্য চালু থাকবে।" : ""}`,
                outro: `সংশোধন করে আবার জমা দিন: ${siteConfig.url}/seller/products`,
              }
          : approved
            ? {
                subject: isUpdate
                  ? `Your product update is live — ${productName}`
                  : `Your product is live — ${productName}`,
                eyebrow: "Review complete",
                heading: isUpdate ? "Update approved" : "Listing approved",
                paragraph: `Hi ${to.name}, ${isUpdate ? `your update to "${productName}"` : `"${productName}"`} was approved and is now live on Spiber Kart.`,
                outro: `Manage your products: ${siteConfig.url}/seller/products`,
              }
            : {
                subject: isUpdate
                  ? `Your product update was not approved — ${productName}`
                  : `Your product was not approved — ${productName}`,
                eyebrow: "Review result",
                heading: "Not approved",
                paragraph: `Hi ${to.name}, ${isUpdate ? `your update to "${productName}"` : `"${productName}"`} was not approved this time.${reason ? ` Reason: ${reason}` : ""}${isUpdate ? " Your current live version stays on sale unchanged." : ""}`,
                outro: `You can revise and resubmit any time: ${siteConfig.url}/seller/products`,
              };

    const built = renderEmail({
      accent: approved ? "teal" : "orange",
      preheader: c.paragraph,
      eyebrow: c.eyebrow,
      heading: c.heading,
      paragraphs: [c.paragraph],
      outro: [c.outro],
    });
    await getMailer().send({
      to: to.email,
      subject: `${c.subject} — ${brand}`,
      html: built.html,
      text: built.text,
      attachments: built.attachments,
    });
  } catch (e) {
    logger.warn("seller moderation email failed", e);
  }
}

/** Payout marked paid — the money is on its way to the seller's bank. */
export async function notifySellerPayoutPaid(
  seller: SellerLike,
  payout: Pick<ISellerPayout, "payoutNumber" | "totalEarningsMinor">,
): Promise<void> {
  try {
    const to = await sellerRecipient(seller);
    if (!to) return;
    const brand = siteConfig.brand;
    const amount = formatBDT(payout.totalEarningsMinor);

    const c =
      to.locale === "ja"
        ? {
            subject: `お支払いが完了しました — ${payout.payoutNumber}`,
            eyebrow: "出金完了",
            heading: "売上金をお支払いしました",
            paragraph: `${to.name} 様、${amount} の出金(${payout.payoutNumber})を処理しました。登録の銀行口座をご確認ください。`,
            outro: `出金履歴: ${siteConfig.url}/seller/payouts`,
          }
        : to.locale === "bn"
          ? {
              subject: `আপনার পেআউট সম্পন্ন — ${payout.payoutNumber}`,
              eyebrow: "পেআউট সম্পন্ন",
              heading: "আপনার আয় পাঠানো হয়েছে",
              paragraph: `প্রিয় ${to.name}, ${amount} পরিমাণের পেআউট (${payout.payoutNumber}) সম্পন্ন হয়েছে। আপনার ব্যাংক অ্যাকাউন্ট চেক করুন।`,
              outro: `পেআউট ইতিহাস: ${siteConfig.url}/seller/payouts`,
            }
          : {
              subject: `Your payout is on its way — ${payout.payoutNumber}`,
              eyebrow: "Payout completed",
              heading: "Earnings paid out",
              paragraph: `Hi ${to.name}, we processed your payout ${payout.payoutNumber} of ${amount}. It is on its way to your registered bank account.`,
              outro: `Payout history: ${siteConfig.url}/seller/payouts`,
            };

    const built = renderEmail({
      accent: "teal",
      preheader: c.paragraph,
      eyebrow: c.eyebrow,
      heading: c.heading,
      paragraphs: [c.paragraph],
      outro: [c.outro],
    });
    await getMailer().send({
      to: to.email,
      subject: `${c.subject} — ${brand}`,
      html: built.html,
      text: built.text,
      attachments: built.attachments,
    });
  } catch (e) {
    logger.warn("seller payout email failed", e);
  }
}
