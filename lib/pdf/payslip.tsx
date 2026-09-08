import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { LEGAL } from "@/lib/contact";
import { amountInWords } from "@/lib/money-words";
import {
  styles,
  Letterhead,
  FooterBand,
  Watermark,
  SignOffRow,
} from "./letterhead";
import { formatTaka, fmtDate } from "./format";
import type { Signatory } from "./documents";

/**
 * A director's payslip for one month.
 *
 * States the basis openly — the month's revenue and the agreed percentage —
 * because that is the whole calculation, and a payslip that only showed the
 * final figure would be impossible to check.
 */
export type PayslipData = {
  month: string;
  monthLabel: string;
  employee: { name: string; code: string; designation: string };
  revenueMinor: number;
  onlineMinor: number;
  manualMinor: number;
  rateBp: number | null;
  amountMinor: number;
  paidAt?: Date | null;
  reference?: string | null;
  approvedAt?: Date | null;
  signatory: Signatory;
};

export function PayslipDocument({ data }: { data: PayslipData }) {
  const row = (label: string, value: string, strong = false) => (
    <View style={styles.tr}>
      <Text style={[styles.td, { flex: 2 }, styles.label]}>{label}</Text>
      <Text
        style={[
          styles.td,
          { flex: 2, textAlign: "right", borderRightWidth: 0 },
          ...(strong ? [styles.label] : []),
        ]}
      >
        {value}
      </Text>
    </View>
  );

  return (
    <Document title={`Payslip ${data.employee.name} ${data.month}`}>
      <Page size="A4" style={styles.page}>
        <Watermark />
        <Letterhead />

        <Text style={styles.title}>Payslip — {data.monthLabel}</Text>

        <View style={[styles.section, { flexDirection: "row" }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{data.employee.name}</Text>
            <Text>{data.employee.designation}</Text>
            <Text style={styles.small}>
              Employee code: {data.employee.code}
            </Text>
          </View>
          <View style={{ flex: 1, alignItems: "flex-end" }}>
            <Text>Period: {data.monthLabel}</Text>
            {data.approvedAt ? (
              <Text>Approved: {fmtDate(data.approvedAt)}</Text>
            ) : null}
            {data.paidAt ? <Text>Paid: {fmtDate(data.paidAt)}</Text> : null}
            {data.reference ? <Text>Reference: {data.reference}</Text> : null}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={[styles.th, { flex: 2 }]}>Basis</Text>
            <Text style={[styles.th, { flex: 2, borderRightWidth: 0 }]}>
              Amount (BDT)
            </Text>
          </View>
          {row("Revenue from the website", formatTaka(data.onlineMinor))}
          {row("Revenue from sales orders", formatTaka(data.manualMinor))}
          {row(
            "Total revenue for the month",
            formatTaka(data.revenueMinor),
            true,
          )}
          {data.rateBp != null
            ? row("Agreed share", `${data.rateBp / 100}%`)
            : row("Basis", "Fixed monthly")}
          <View style={styles.trLast}>
            <Text style={[styles.td, { flex: 2 }, styles.label]}>
              Payable this month
            </Text>
            <Text
              style={[
                styles.td,
                { flex: 2, textAlign: "right", borderRightWidth: 0 },
                styles.label,
              ]}
            >
              {formatTaka(data.amountMinor)}
            </Text>
          </View>
        </View>

        <Text style={{ marginTop: 12 }}>
          <Text style={styles.label}>Amount in Words:</Text>{" "}
          {amountInWords(data.amountMinor)}
        </Text>

        <Text style={[styles.small, styles.muted, { marginTop: 14 }]}>
          Issued by {LEGAL.name}. Revenue is counted when payment was received,
          and excludes cancelled and refunded orders.
        </Text>

        <SignOffRow left="Approved By" right="Received By" />
        <FooterBand />
      </Page>
    </Document>
  );
}
