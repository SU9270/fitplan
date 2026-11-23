import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { tokens } from '../theme/tokens';

const COLUMNS = 3;

/** Size of the icon or circle that stands in for a missing picture. */
export const TILE_IMAGE_SIZE = 64;

type Props<T> = {
  items: readonly T[];
  /** `width` is one column's width; render nothing wider. */
  renderTile: (item: T, width: number) => ReactNode;
};

/** The food library's three-column grid of tiles; tiles appear once the grid knows its width. */
export function LibraryGrid<T>({ items, renderTile }: Props<T>) {
  const [gridWidth, setGridWidth] = useState(0);
  // Rounded down, so three tiles and two gaps never add up to more than the row.
  const tileWidth = gridWidth > 0 ? Math.floor((gridWidth - GAP * (COLUMNS - 1)) / COLUMNS) : 0;
  return (
    <View style={styles.grid} onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
      {tileWidth > 0 ? items.map((item) => renderTile(item, tileWidth)) : null}
    </View>
  );
}

const GAP = tokens.space.sm;

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
});

/**
 * A tile: a small card holding a white plate with the picture, then the name and one value.
 * Shared by every group of the food library. The plate's corner nests in the tile's.
 */
export const tileStyles = StyleSheet.create({
  tile: {
    gap: tokens.hairline,
    padding: tokens.card.gap,
    paddingBottom: tokens.card.padding,
    borderRadius: tokens.radius.md + tokens.card.gap,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.cardBorder,
    backgroundColor: tokens.color.card,
  },
  tilePressed: {
    opacity: 0.6,
  },
  // The pictures have a white background, so the plate is white too.
  plate: {
    width: '100%',
    aspectRatio: 1,
    // A tile stretched to its row's height must not squeeze the plate (its width follows its height).
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.card.gap,
    overflow: 'hidden',
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.paperTile,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  name: {
    paddingHorizontal: tokens.space.xs,
    color: tokens.color.text,
    fontSize: tokens.fontSize.label,
    fontWeight: tokens.fontWeight.bold,
  },
  value: {
    paddingHorizontal: tokens.space.xs,
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption - 1,
  },
});
