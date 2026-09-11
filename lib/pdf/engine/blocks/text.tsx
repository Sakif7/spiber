import React from "react";
import { Text, View } from "@react-pdf/renderer";
import { interpolate } from "../resolve";
import { frameProps, frameStyle, type BlockProps } from "./shared";

/** "Commercial Proposal" — centred, bold, underlined. */
export function TitleBlock({ block, styles, ctx, kind }: BlockProps<"title">) {
  return (
    <Text
      style={[styles.title, frameStyle(block, styles)]}
      {...frameProps(block)}
    >
      {interpolate(block.props.text, ctx, kind)}
    </Text>
  );
}

/** A bold run-in heading such as "Product/ Service Details". */
export function HeadingBlock({
  block,
  styles,
  ctx,
  kind,
}: BlockProps<"heading">) {
  return (
    <Text
      style={[
        block.props.underline ? styles.underlineLabel : styles.label,
        frameStyle(block, styles),
      ]}
      {...frameProps(block)}
    >
      {interpolate(block.props.text, ctx, kind)}
    </Text>
  );
}

export function ParagraphBlock({
  block,
  styles,
  ctx,
  kind,
}: BlockProps<"paragraph">) {
  return (
    <Text style={frameStyle(block, styles)} {...frameProps(block)}>
      {interpolate(block.props.text, ctx, kind)}
    </Text>
  );
}

/** "Amount in Words: …" — a bold label running into the text. */
export function LabelledTextBlock({
  block,
  styles,
  ctx,
  kind,
}: BlockProps<"labelledText">) {
  return (
    <Text style={frameStyle(block, styles)} {...frameProps(block)}>
      <Text
        style={
          block.props.labelStyle === "underline"
            ? styles.underlineLabel
            : styles.label
        }
      >
        {interpolate(block.props.label, ctx, kind)}
      </Text>{" "}
      {interpolate(block.props.text, ctx, kind)}
    </Text>
  );
}

export function SpacerBlock({ block }: BlockProps<"spacer">) {
  return <View style={{ height: block.props.height }} />;
}

export function PageBreakBlock() {
  return <View break />;
}
