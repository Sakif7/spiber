"use client";

import { Input } from "@/components/ui/input";
import {
  FormField,
  FormGrid,
  FormSection,
} from "@/components/admin/ui/form-shell";
import { SelectField } from "@/components/admin/ui/select-field";
import { BLOCK_INFO } from "@/lib/pdf/engine/catalogue";
import {
  FIXED_BLOCK_TYPES,
  type Block,
  type BlockOf,
  type BlockType,
  type LineColumn,
  type LineColumnKey,
  type MetaField,
  type TemplateKind,
  type Theme,
  type TotalsRow,
} from "@/lib/schemas/pdf-template";
import { ConditionField, NumberField, PathSelect, SwitchField } from "./fields";
import { ListEditor } from "./list-editor";
import { StampForm, type StampAssetSummary } from "./stamp-form";
import type { PdfPreview } from "./use-pdf-preview";
import { TemplateText } from "./template-text";

/**
 * The inspector: every prop of the selected block as a form.
 *
 * One small component per block type, then the style and visibility fields
 * every flow block shares. Each edit hands back a whole new block, so the
 * editor's state stays a plain immutable document.
 */

type Props<T extends BlockType> = {
  block: BlockOf<T>;
  kind: TemplateKind;
  onProps: (patch: Partial<BlockOf<T>["props"]>) => void;
};

type MetaColumn = BlockOf<"metaColumns">["props"]["columns"][number];
type LetterheadLine = BlockOf<"letterhead">["props"]["lines"][number];
type KeyValueRow = BlockOf<"keyValueTable">["props"]["rows"][number];
type KeyValueItem = BlockOf<"keyValueList">["props"]["items"][number];

const COLUMN_LABELS: Record<LineColumnKey, string> = {
  sn: "S/N",
  description: "Product",
  brandOrigin: "Brand",
  specification: "Specification",
  qty: "Qty",
  unit: "Unit",
  unitPrice: "Unit price",
  vat: "VAT",
  lineTotal: "Line total",
};
const COLUMN_KEYS = Object.keys(COLUMN_LABELS) as LineColumnKey[];

function TitleForm({ block, kind, onProps }: Props<"title">) {
  return (
    <TemplateText
      label="Text"
      kind={kind}
      value={block.props.text}
      onChange={(text) => onProps({ text })}
      required
    />
  );
}

function HeadingForm({ block, kind, onProps }: Props<"heading">) {
  return (
    <>
      <TemplateText
        label="Text"
        kind={kind}
        value={block.props.text}
        onChange={(text) => onProps({ text })}
        required
      />
      <SwitchField
        label="Underline"
        checked={block.props.underline}
        onChange={(underline) => onProps({ underline })}
      />
    </>
  );
}

function ParagraphForm({ block, kind, onProps }: Props<"paragraph">) {
  return (
    <TemplateText
      label="Text"
      kind={kind}
      multiline
      rows={4}
      value={block.props.text}
      onChange={(text) => onProps({ text })}
    />
  );
}

function LabelledTextForm({ block, kind, onProps }: Props<"labelledText">) {
  return (
    <>
      <FormGrid>
        <TemplateText
          label="Label"
          kind={kind}
          value={block.props.label}
          onChange={(label) => onProps({ label })}
        />
        <FormField label="Label style">
          <SelectField
            value={block.props.labelStyle}
            onChange={(v) => onProps({ labelStyle: v as "bold" | "underline" })}
            options={[
              { value: "bold", label: "Bold" },
              { value: "underline", label: "Bold, underlined" },
            ]}
          />
        </FormField>
      </FormGrid>
      <TemplateText
        label="Text"
        kind={kind}
        multiline
        value={block.props.text}
        onChange={(text) => onProps({ text })}
      />
    </>
  );
}

function MetaColumnsForm({ block, kind, onProps }: Props<"metaColumns">) {
  const { columns } = block.props;
  return (
    <>
      <FormGrid>
        <NumberField
          label="Gap between columns (pt)"
          value={block.props.gap}
          onChange={(gap) => onProps({ gap: gap ?? 0 })}
          min={0}
          max={60}
        />
        <NumberField
          label="Space under each line (pt)"
          value={block.props.lineGap}
          onChange={(lineGap) => onProps({ lineGap: lineGap ?? 0 })}
          min={0}
          max={12}
          step={0.5}
        />
      </FormGrid>
      <ListEditor<MetaColumn>
        label="Columns"
        items={columns}
        onChange={(cols) => onProps({ columns: cols })}
        max={3}
        addLabel="Add column"
        itemLabel={(i, c) => c.heading || `Column ${i + 1}`}
        newItem={() => ({ align: "left", fields: [] })}
        render={(col, patch) => (
          <>
            <FormGrid>
              <FormField label="Heading" hint="Optional, underlined.">
                <Input
                  value={col.heading ?? ""}
                  onChange={(e) =>
                    patch({ heading: e.target.value || undefined })
                  }
                />
              </FormField>
              <FormField label="Align">
                <SelectField
                  value={col.align}
                  onChange={(v) => patch({ align: v as "left" | "right" })}
                  options={[
                    { value: "left", label: "Left" },
                    { value: "right", label: "Right" },
                  ]}
                />
              </FormField>
            </FormGrid>
            <ListEditor<MetaField>
              label="Lines"
              items={col.fields}
              onChange={(fields) => patch({ fields })}
              max={12}
              addLabel="Add line"
              itemLabel={(i, f) => f.label || `Line ${i + 1}`}
              newItem={() => ({
                label: "Label:",
                value: "",
                hideWhenEmpty: true,
              })}
              render={(f, patchField) => (
                <>
                  <FormGrid>
                    <TemplateText
                      label="Label"
                      kind={kind}
                      value={f.label ?? ""}
                      onChange={(label) =>
                        patchField({ label: label || undefined })
                      }
                      hint="Set in bold. Leave empty for a plain line."
                    />
                    <TemplateText
                      label="Value"
                      kind={kind}
                      value={f.value}
                      onChange={(value) => patchField({ value })}
                    />
                  </FormGrid>
                  <FormGrid cols={3}>
                    <SwitchField
                      label="Hide when empty"
                      checked={f.hideWhenEmpty}
                      onChange={(hideWhenEmpty) =>
                        patchField({ hideWhenEmpty })
                      }
                    />
                    <SwitchField
                      label="Bold"
                      checked={f.bold ?? false}
                      onChange={(bold) =>
                        patchField({ bold: bold || undefined })
                      }
                    />
                    <SwitchField
                      label="Small"
                      checked={f.small ?? false}
                      onChange={(small) =>
                        patchField({ small: small || undefined })
                      }
                    />
                  </FormGrid>
                </>
              )}
            />
          </>
        )}
      />
    </>
  );
}

function LineTableForm({ block, kind, onProps }: Props<"lineTable">) {
  const { columns, totals } = block.props;
  const keyOptions = COLUMN_KEYS.map((k) => ({
    value: k,
    label: COLUMN_LABELS[k],
  }));
  return (
    <>
      <FormField
        label="VAT column"
        hint="“Automatic” shows it only when the lines carry different rates."
      >
        <SelectField
          value={block.props.vatColumn}
          onChange={(v) =>
            onProps({ vatColumn: v as "auto" | "always" | "never" })
          }
          options={[
            { value: "auto", label: "Automatic" },
            { value: "always", label: "Always" },
            { value: "never", label: "Never" },
          ]}
        />
      </FormField>
      <ListEditor<LineColumn>
        label="Columns"
        items={columns}
        onChange={(cols) => onProps({ columns: cols })}
        max={9}
        addLabel="Add column"
        itemLabel={(_, c) => COLUMN_LABELS[c.key]}
        newItem={() => ({
          key: "description",
          label: "Column",
          weight: 1,
          align: "center",
          visible: true,
        })}
        render={(c, patch) => (
          <>
            <FormGrid cols={3}>
              <FormField label="Data">
                <SelectField
                  value={c.key}
                  onChange={(v) => patch({ key: v as LineColumnKey })}
                  options={keyOptions}
                />
              </FormField>
              <FormField label="Heading" hint="Use a line break for two lines.">
                <Input
                  value={c.label}
                  onChange={(e) => patch({ label: e.target.value })}
                />
              </FormField>
              <NumberField
                label="Width (weight)"
                value={c.weight}
                onChange={(weight) => patch({ weight: weight ?? 1 })}
                min={0.2}
                max={6}
                step={0.05}
              />
            </FormGrid>
            <FormGrid cols={3}>
              <FormField label="Align">
                <SelectField
                  value={c.align}
                  onChange={(v) =>
                    patch({ align: v as "left" | "center" | "right" })
                  }
                  options={[
                    { value: "left", label: "Left" },
                    { value: "center", label: "Centre" },
                    { value: "right", label: "Right" },
                  ]}
                />
              </FormField>
              <FormField label="When empty" hint="Printed for a blank value.">
                <Input
                  value={c.emptyText ?? ""}
                  onChange={(e) =>
                    patch({ emptyText: e.target.value || undefined })
                  }
                />
              </FormField>
              <SwitchField
                label="Visible"
                checked={c.visible}
                onChange={(visible) => patch({ visible })}
              />
            </FormGrid>
          </>
        )}
      />
      <SwitchField
        label="Totals inside the table"
        checked={Boolean(totals)}
        onChange={(on) =>
          onProps({
            totals: on
              ? {
                  labelColumns: ["qty", "unit", "unitPrice", "vat"],
                  valueColumns: ["lineTotal"],
                  rows: [],
                }
              : undefined,
          })
        }
        hint="A stack of figures under the items, inside the same border."
      />
      {totals && (
        <>
          <FormGrid>
            <FormField
              label="Label spans"
              hint="The columns merged into the label cell."
            >
              <ColumnPicker
                value={totals.labelColumns}
                onChange={(labelColumns) =>
                  onProps({ totals: { ...totals, labelColumns } })
                }
              />
            </FormField>
            <FormField
              label="Figure spans"
              hint="The columns merged into the figure cell."
            >
              <ColumnPicker
                value={totals.valueColumns}
                onChange={(valueColumns) =>
                  onProps({ totals: { ...totals, valueColumns } })
                }
              />
            </FormField>
          </FormGrid>
          <ListEditor<TotalsRow>
            label="Rows"
            items={totals.rows}
            onChange={(rows) => onProps({ totals: { ...totals, rows } })}
            max={12}
            addLabel="Add row"
            itemLabel={(i, r) => r.label || `Row ${i + 1}`}
            newItem={() => ({
              id: Math.random().toString(36).slice(2, 8),
              label: "Total",
              path: "totals.grandTotalMinor",
              hideWhenZero: false,
              emphasis: false,
              valueAlign: "right",
            })}
            render={(r, patch) => (
              <>
                <FormGrid>
                  <TemplateText
                    label="Label"
                    kind={kind}
                    value={r.label}
                    onChange={(label) => patch({ label })}
                  />
                  <PathSelect
                    label="Figure"
                    kind={kind}
                    kinds={["money", "number"]}
                    value={r.path}
                    onChange={(path) => patch({ path })}
                  />
                </FormGrid>
                <FormGrid cols={3}>
                  <FormField label="Prefix" hint="“−” on a discount.">
                    <Input
                      value={r.prefix ?? ""}
                      maxLength={4}
                      onChange={(e) =>
                        patch({ prefix: e.target.value || undefined })
                      }
                    />
                  </FormField>
                  <FormField label="Figure align">
                    <SelectField
                      value={r.valueAlign}
                      onChange={(v) =>
                        patch({ valueAlign: v as "right" | "center" })
                      }
                      options={[
                        { value: "right", label: "Right" },
                        { value: "center", label: "Centre" },
                      ]}
                    />
                  </FormField>
                  <div className="grid gap-2">
                    <SwitchField
                      label="Hide when zero"
                      checked={r.hideWhenZero}
                      onChange={(hideWhenZero) => patch({ hideWhenZero })}
                    />
                    <SwitchField
                      label="Emphasis"
                      checked={r.emphasis}
                      onChange={(emphasis) => patch({ emphasis })}
                    />
                  </div>
                </FormGrid>
              </>
            )}
          />
        </>
      )}
    </>
  );
}

/** Tick the table columns a totals cell should span. */
function ColumnPicker({
  value,
  onChange,
}: {
  value: LineColumnKey[];
  onChange: (v: LineColumnKey[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5 py-1">
      {COLUMN_KEYS.map((k) => (
        <label key={k} className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={value.includes(k)}
            onChange={(e) =>
              onChange(
                e.target.checked ? [...value, k] : value.filter((x) => x !== k),
              )
            }
          />
          {COLUMN_LABELS[k]}
        </label>
      ))}
    </div>
  );
}

function BulletsForm({ block, kind, onProps }: Props<"bullets">) {
  return (
    <>
      <FormGrid>
        <TemplateText
          label="Heading"
          kind={kind}
          value={block.props.heading ?? ""}
          onChange={(heading) => onProps({ heading: heading || undefined })}
          hint="Optional."
        />
        <NumberField
          label="Space under heading (pt)"
          value={block.props.headingGap}
          onChange={(headingGap) => onProps({ headingGap: headingGap ?? 0 })}
          min={0}
          max={20}
        />
      </FormGrid>
      <ListEditor
        label="Items"
        items={block.props.items.map((text) => ({ text }))}
        onChange={(items) => onProps({ items: items.map((i) => i.text) })}
        max={20}
        addLabel="Add item"
        newItem={() => ({ text: "" })}
        render={(item, patch) => (
          <TemplateText
            kind={kind}
            multiline
            rows={2}
            value={item.text}
            onChange={(text) => patch({ text })}
          />
        )}
      />
    </>
  );
}

function KeyValueListForm({ block, kind, onProps }: Props<"keyValueList">) {
  return (
    <>
      <FormGrid>
        <TemplateText
          label="Heading"
          kind={kind}
          value={block.props.heading ?? ""}
          onChange={(heading) => onProps({ heading: heading || undefined })}
          hint="Optional."
        />
        <NumberField
          label="Space under heading (pt)"
          value={block.props.headingGap}
          onChange={(headingGap) => onProps({ headingGap: headingGap ?? 0 })}
          min={0}
          max={20}
        />
      </FormGrid>
      <ListEditor<KeyValueItem>
        label="Lines"
        items={block.props.items}
        onChange={(items) => onProps({ items })}
        max={20}
        addLabel="Add line"
        itemLabel={(i, it) => it.label || `Line ${i + 1}`}
        newItem={() => ({ label: "Label:", value: "", hideWhenEmpty: false })}
        render={(it, patch) => (
          <>
            <FormGrid>
              <TemplateText
                label="Label"
                kind={kind}
                value={it.label}
                onChange={(label) => patch({ label })}
              />
              <TemplateText
                label="Value"
                kind={kind}
                value={it.value}
                onChange={(value) => patch({ value })}
              />
            </FormGrid>
            <SwitchField
              label="Hide when empty"
              checked={it.hideWhenEmpty}
              onChange={(hideWhenEmpty) => patch({ hideWhenEmpty })}
            />
          </>
        )}
      />
    </>
  );
}

function KeyValueTableForm({ block, kind, onProps }: Props<"keyValueTable">) {
  const { header, rows } = block.props;
  return (
    <>
      <SwitchField
        label="Header row"
        checked={Boolean(header)}
        onChange={(on) =>
          onProps({
            header: on ? { label: "Item", value: "Amount (BDT)" } : undefined,
          })
        }
      />
      {header && (
        <FormGrid cols={3}>
          <FormField label="Left heading">
            <Input
              value={header.label}
              onChange={(e) =>
                onProps({ header: { ...header, label: e.target.value } })
              }
            />
          </FormField>
          <FormField label="Right heading">
            <Input
              value={header.value}
              onChange={(e) =>
                onProps({ header: { ...header, value: e.target.value } })
              }
            />
          </FormField>
          <FormField label="Rule under header">
            <SelectField
              value={block.props.headerRule}
              onChange={(v) =>
                onProps({ headerRule: v as "full" | "hairline" })
              }
              options={[
                { value: "hairline", label: "Hairline" },
                { value: "full", label: "Full rule" },
              ]}
            />
          </FormField>
        </FormGrid>
      )}
      <ListEditor<KeyValueRow>
        label="Rows"
        items={rows}
        onChange={(next) => onProps({ rows: next })}
        max={20}
        addLabel="Add row"
        itemLabel={(i, r) => r.label || `Row ${i + 1}`}
        newItem={() => ({ label: "Label", value: "", strong: false })}
        render={(r, patch) => (
          <>
            <FormGrid>
              <TemplateText
                label="Label"
                kind={kind}
                value={r.label}
                onChange={(label) => patch({ label })}
              />
              <TemplateText
                label="Value"
                kind={kind}
                value={r.value}
                onChange={(value) => patch({ value })}
              />
            </FormGrid>
            <SwitchField
              label="Bold figure"
              checked={r.strong}
              onChange={(strong) => patch({ strong })}
            />
            <ConditionField
              kind={kind}
              value={r.showIf}
              onChange={(showIf) => patch({ showIf })}
            />
          </>
        )}
      />
    </>
  );
}

function SignOffForm({ block, kind, onProps }: Props<"signOff">) {
  return (
    <>
      <FormGrid>
        <TemplateText
          label="Left line"
          kind={kind}
          value={block.props.left}
          onChange={(left) => onProps({ left })}
          required
        />
        <TemplateText
          label="Right line"
          kind={kind}
          value={block.props.right ?? ""}
          onChange={(right) => onProps({ right: right || undefined })}
          hint="Leave empty for one line only."
        />
      </FormGrid>
      <SwitchField
        label="Print the signatory under the left line"
        checked={block.props.includeSignatory}
        onChange={(includeSignatory) => onProps({ includeSignatory })}
        hint="Name, title and company. Who signs is set in Sales settings, not here."
      />
    </>
  );
}

function SpacerForm({ block, onProps }: Props<"spacer">) {
  return (
    <NumberField
      label="Height (pt)"
      value={block.props.height}
      onChange={(height) => onProps({ height: height ?? 1 })}
      min={1}
      max={200}
    />
  );
}

function LetterheadForm({ block, kind, onProps }: Props<"letterhead">) {
  return (
    <>
      <SwitchField
        label="Show the logo"
        checked={block.props.showLogo}
        onChange={(showLogo) => onProps({ showLogo })}
        hint="Without it the company name prints in its place."
      />
      <ListEditor<LetterheadLine>
        label="Contact column"
        items={block.props.lines}
        onChange={(lines) => onProps({ lines })}
        max={8}
        addLabel="Add line"
        itemLabel={(i, l) => l.label || `Line ${i + 1}`}
        newItem={() => ({ icon: "phone", text: "" })}
        render={(l, patch) => (
          <>
            <FormGrid>
              <FormField label="Icon">
                <SelectField
                  value={l.icon}
                  onChange={(v) => patch({ icon: v as typeof l.icon })}
                  options={[
                    { value: "phone", label: "Phone" },
                    { value: "mail", label: "Mail" },
                    { value: "web", label: "Web" },
                    { value: "place", label: "Place" },
                  ]}
                />
              </FormField>
              <FormField
                label="Bold label"
                hint="Optional, e.g. “Head Office:”"
              >
                <Input
                  value={l.label ?? ""}
                  onChange={(e) =>
                    patch({ label: e.target.value || undefined })
                  }
                />
              </FormField>
            </FormGrid>
            <TemplateText
              label="Text"
              kind={kind}
              value={l.text}
              onChange={(text) => patch({ text })}
            />
          </>
        )}
      />
    </>
  );
}

function WatermarkForm({ block, onProps }: Props<"watermark">) {
  return (
    <FormGrid cols={3}>
      <NumberField
        label="Opacity"
        value={block.props.opacity}
        onChange={(opacity) => onProps({ opacity: opacity ?? 0 })}
        min={0}
        max={0.5}
        step={0.01}
      />
      <NumberField
        label="Width (pt)"
        value={block.props.width}
        onChange={(width) => onProps({ width: width ?? 60 })}
        min={60}
        max={400}
      />
      <NumberField
        label="Bleed past the edge (pt)"
        value={block.props.bleed}
        onChange={(bleed) => onProps({ bleed: bleed ?? 0 })}
        min={0}
        max={100}
      />
    </FormGrid>
  );
}

function FooterBandForm({ block, kind, onProps }: Props<"footerBand">) {
  return (
    <FormGrid>
      <TemplateText
        label="Text"
        kind={kind}
        value={block.props.text}
        onChange={(text) => onProps({ text })}
      />
      <NumberField
        label="Letter spacing (pt)"
        value={block.props.letterSpacing}
        onChange={(letterSpacing) =>
          onProps({ letterSpacing: letterSpacing ?? 0 })
        }
        min={0}
        max={10}
        step={0.5}
      />
    </FormGrid>
  );
}

/** What the stamp form needs beyond its own block. */
export type StampContext = {
  blocks: Block[];
  theme: Theme;
  assets: StampAssetSummary[];
  /** The live render, so the pad can show the real page under the stamp. */
  preview: PdfPreview;
  onAssetUploaded: (asset: StampAssetSummary) => void;
};

function PropsForm({
  block,
  kind,
  onChange,
  stamp,
}: {
  block: Block;
  kind: TemplateKind;
  onChange: (b: Block) => void;
  stamp: StampContext;
}) {
  // One patch helper per branch keeps the discriminated union narrow.
  const patch =
    <T extends BlockType>(b: BlockOf<T>) =>
    (p: Partial<BlockOf<T>["props"]>) =>
      onChange({ ...b, props: { ...b.props, ...p } } as Block);
  switch (block.type) {
    case "title":
      return <TitleForm block={block} kind={kind} onProps={patch(block)} />;
    case "heading":
      return <HeadingForm block={block} kind={kind} onProps={patch(block)} />;
    case "paragraph":
      return <ParagraphForm block={block} kind={kind} onProps={patch(block)} />;
    case "labelledText":
      return (
        <LabelledTextForm block={block} kind={kind} onProps={patch(block)} />
      );
    case "metaColumns":
      return (
        <MetaColumnsForm block={block} kind={kind} onProps={patch(block)} />
      );
    case "lineTable":
      return <LineTableForm block={block} kind={kind} onProps={patch(block)} />;
    case "bullets":
      return <BulletsForm block={block} kind={kind} onProps={patch(block)} />;
    case "keyValueList":
      return (
        <KeyValueListForm block={block} kind={kind} onProps={patch(block)} />
      );
    case "keyValueTable":
      return (
        <KeyValueTableForm block={block} kind={kind} onProps={patch(block)} />
      );
    case "signOff":
      return <SignOffForm block={block} kind={kind} onProps={patch(block)} />;
    case "spacer":
      return <SpacerForm block={block} kind={kind} onProps={patch(block)} />;
    case "letterhead":
      return (
        <LetterheadForm block={block} kind={kind} onProps={patch(block)} />
      );
    case "watermark":
      return <WatermarkForm block={block} kind={kind} onProps={patch(block)} />;
    case "footerBand":
      return (
        <FooterBandForm block={block} kind={kind} onProps={patch(block)} />
      );
    case "pageBreak":
      return (
        <p className="text-muted-foreground text-sm">
          Everything after this starts on a new page.
        </p>
      );
    case "stamp":
      return (
        <StampForm
          block={block}
          blocks={stamp.blocks}
          theme={stamp.theme}
          assets={stamp.assets}
          preview={stamp.preview}
          onProps={patch(block)}
          onAssetUploaded={stamp.onAssetUploaded}
        />
      );
  }
}

const TEXT_BLOCKS: ReadonlySet<BlockType> = new Set<BlockType>([
  "title",
  "heading",
  "paragraph",
  "labelledText",
]);

export function BlockForm({
  block,
  kind,
  onChange,
  stamp,
}: {
  block: Block;
  kind: TemplateKind;
  onChange: (b: Block) => void;
  stamp: StampContext;
}) {
  const info = BLOCK_INFO[block.type];
  const fixed = FIXED_BLOCK_TYPES.has(block.type);
  const overlay = block.type === "stamp";
  const style = block.style ?? {};
  const setStyle = (patch: Partial<NonNullable<Block["style"]>>) => {
    const next = { ...style, ...patch };
    // Drop keys set back to nothing, so an untouched block stays untouched.
    for (const k of Object.keys(next) as (keyof typeof next)[]) {
      if (next[k] === undefined || next[k] === false) delete next[k];
    }
    onChange({ ...block, style: Object.keys(next).length ? next : undefined });
  };

  return (
    <div className="grid gap-4">
      <FormSection title={info.label} description={info.description}>
        <PropsForm
          block={block}
          kind={kind}
          onChange={onChange}
          stamp={stamp}
        />
      </FormSection>

      {!fixed && !overlay && block.type !== "pageBreak" && (
        <FormSection
          title="Spacing & text"
          description="Points. Leave empty to inherit."
        >
          <FormGrid cols={3}>
            <NumberField
              label="Space above"
              value={style.marginTop}
              onChange={(marginTop) => setStyle({ marginTop })}
              min={0}
              max={120}
              optional
            />
            <NumberField
              label="Space below"
              value={style.marginBottom}
              onChange={(marginBottom) => setStyle({ marginBottom })}
              min={0}
              max={120}
              optional
            />
            {TEXT_BLOCKS.has(block.type) && (
              <NumberField
                label="Font size"
                value={style.fontSize}
                onChange={(fontSize) => setStyle({ fontSize })}
                min={6}
                max={24}
                step={0.5}
                optional
              />
            )}
          </FormGrid>
          {TEXT_BLOCKS.has(block.type) && (
            <FormGrid>
              <FormField label="Align">
                <SelectField
                  value={style.align ?? ""}
                  onChange={(v) =>
                    setStyle({
                      align: (v || undefined) as typeof style.align,
                    })
                  }
                  options={[
                    { value: "left", label: "Left" },
                    { value: "center", label: "Centre" },
                    { value: "right", label: "Right" },
                    { value: "justify", label: "Justified" },
                  ]}
                  emptyLabel="Inherit"
                />
              </FormField>
              <SwitchField
                label="Muted colour"
                checked={style.muted ?? false}
                onChange={(muted) => setStyle({ muted: muted || undefined })}
              />
            </FormGrid>
          )}
        </FormSection>
      )}

      {!fixed && (
        <FormSection title="Visibility & page breaks">
          <ConditionField
            kind={kind}
            value={block.showIf}
            onChange={(showIf) => onChange({ ...block, showIf })}
          />
          {block.type !== "pageBreak" && !overlay && (
            <FormGrid>
              <SwitchField
                label="Keep on one page"
                checked={block.keepTogether ?? false}
                onChange={(v) =>
                  onChange({ ...block, keepTogether: v || undefined })
                }
                hint="Never split this block across pages."
              />
              <NumberField
                label="Space needed ahead (pt)"
                value={block.minPresenceAhead}
                onChange={(minPresenceAhead) =>
                  onChange({ ...block, minPresenceAhead })
                }
                min={0}
                max={400}
                optional
                hint="Moves to the next page unless this much room is left."
              />
            </FormGrid>
          )}
        </FormSection>
      )}
    </div>
  );
}
