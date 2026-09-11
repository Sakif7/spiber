/* eslint-disable jsx-a11y/alt-text -- @react-pdf <Image>, not an HTML image */
import React from "react";
import { Image, View } from "@react-pdf/renderer";
import type { BlockOf, Theme } from "@/lib/schemas/pdf-template";
import type { StampAsset } from "../../types";

/**
 * A seal, signature or name stamp.
 *
 * Two ways to place it. Anchored to the **page**: coordinates from the
 * sheet's top-left, printed on the chosen pages — an absolutely positioned
 * child of a react-pdf Page is measured from the padded content box, so the
 * theme's margins are taken back off; `fixed` makes the renderer ask on every
 * page and `render` answers for the pages the stamp belongs on. Anchored to a
 * **block**: an absolutely positioned child of that block's wrapper, so the
 * offsets are from the block's top-left and the stamp goes wherever
 * pagination sends the block. Height follows the image's own aspect ratio.
 */

function stampSize(block: BlockOf<"stamp">, asset: StampAsset) {
  const width = block.props.width;
  return { width, height: (width * asset.height) / asset.width };
}

export function PageStamp({
  block,
  theme,
  asset,
}: {
  block: BlockOf<"stamp">;
  theme: Theme;
  asset?: StampAsset;
}) {
  if (!asset) return null;
  const { x, y, opacity, pages } = block.props;
  const { width, height } = stampSize(block, asset);
  const style = {
    position: "absolute" as const,
    left: x - theme.page.padX,
    top: y - theme.page.padTop,
    width,
    height,
  };
  const wanted = (pageNumber: number, totalPages: number) =>
    pages === "all" ||
    (pages === "first" && pageNumber === 1) ||
    (pages === "last" && pageNumber === totalPages);

  return (
    <View
      fixed
      style={style}
      // The typings omit totalPages on View, but the layout engine passes it
      // to every render prop (a totals round runs whenever one exists).
      render={(p: { pageNumber: number; totalPages?: number }) =>
        wanted(p.pageNumber, p.totalPages ?? 0) ? (
          <Image
            src={{ data: asset.data, format: "png" }}
            style={{ width, height, opacity }}
          />
        ) : null
      }
    />
  );
}

export function AnchoredStamp({
  block,
  asset,
}: {
  block: BlockOf<"stamp">;
  asset?: StampAsset;
}) {
  if (!asset) return null;
  const { x, y, opacity } = block.props;
  const { width, height } = stampSize(block, asset);
  return (
    <View style={{ position: "absolute", left: x, top: y, width, height }}>
      <Image
        src={{ data: asset.data, format: "png" }}
        style={{ width, height, opacity }}
      />
    </View>
  );
}
