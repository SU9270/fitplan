import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

export interface Ring {
  /** 0..1 (see `progress` in diary/display). */
  progress: number;
  color: string;
  /** Lighter tint of `color` drawn under the progress. */
  track: string;
}

type Props = {
  /** Outermost first. */
  rings: readonly Ring[];
  /** Spoken summary, e.g. "已吃 1240 / 2056 千卡，蛋白质 …". */
  accessibilityLabel: string;
  size?: number;
};

const DEFAULT_SIZE = 200;
/** Ring width and the space between rings, as shares of the size (14 and 5 at 200). */
const STROKE_SHARE = 0.07;
const GAP_SHARE = 0.025;

/** BoardUI / Apple Watch–style concentric progress rings, starting at 12 o'clock. */
export function ActivityRings({ rings, accessibilityLabel, size = DEFAULT_SIZE }: Props) {
  const center = size / 2;
  const stroke = size * STROKE_SHARE;
  const gap = size * GAP_SHARE;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={styles.container}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {rings.map((ring, index) => {
          const radius = center - stroke / 2 - index * (stroke + gap);
          const circumference = 2 * Math.PI * radius;
          const progress = Math.min(1, Math.max(0, ring.progress));
          return (
            <G key={ring.color}>
              <Circle cx={center} cy={center} r={radius} stroke={ring.track} strokeWidth={stroke} fill="none" />
              {progress > 0 ? (
                <Circle
                  cx={center}
                  cy={center}
                  r={radius}
                  stroke={ring.color}
                  strokeWidth={stroke}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${circumference * progress} ${circumference}`}
                  rotation={-90}
                  originX={center}
                  originY={center}
                />
              ) : null}
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
});
