import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { tokens } from '../theme/tokens';

const COLUMNS = 3;

/** Side of a tile's picture (or of the circle that stands in for one). */
export const TILE_IMAGE_SIZE = 64;

type Props<T> = {
  items: readonly T[];
  /** `width` is one column's width; render nothing wider. */
  renderTile: (item: T, width: number) => ReactNode;
};

/** The food library's three-column grid of tiles; tiles appear once the grid knows its width. */
export function LibraryGrid<T>({ items, renderTile }: Props<T>) {
  const [gridWidth, setGridWidth] = useState(0);
  const tileWidth = gridWidth > 0 ? (gridWidth - tokens.card.gap * (COLUMNS - 1)) / COLUMNS : 0;
  return (
    <View style={styles.grid} onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
      {tileWidth > 0 ? items.map((item) => renderTile(item, tileWidth)) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.card.gap,
  },
});

/** A tile: picture, name, one value. Shared by every group of the food library. */
export const tileStyles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    gap: tokens.space.xs,
    paddingHorizontal: tokens.space.xs,
    paddingVertical: tokens.space.md,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.surface,
  },
  tilePressed: {
    opacity: 0.6,
  },
  image: {
    width: TILE_IMAGE_SIZE,
    height: TILE_IMAGE_SIZE,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.label,
    fontWeight: tokens.fontWeight.medium,
    textAlign: 'center',
  },
  value: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption,
  },
});
