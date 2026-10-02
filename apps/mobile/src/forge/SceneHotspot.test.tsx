import { render, screen } from '@testing-library/react-native';
import { Animated, StyleSheet } from 'react-native';
import { SceneHotspot } from './SceneHotspot';
import { tokens } from '../ui/tokens';

const hidden = { includeHiddenElements: true };
const flat = (style: unknown) => StyleSheet.flatten(style as never) as Record<string, unknown>;

// MVP-22-B2 (G12), native check: the cream pill with dark text looked like a system badge on the hearth glow.
test('a heard place shows a game plate: dark bronze fill, gold text and border, readable on the glow', async () => {
  await render(<SceneHotspot label="Palenisko, wysłuchane" onPress={jest.fn()} anchor={{ left: 100, top: 100 }} allowed={false} glow={new Animated.Value(0)}
    heard={{ testID: 'heard-hearth', label: 'Wysłuchane' }} />);
  const mark = screen.getByText('✓ Wysłuchane', hidden);
  const plate = screen.getByTestId('heard-hearth-plate', hidden);
  expect(flat(plate.props.style)).toMatchObject({ backgroundColor: tokens.warm.raised, borderColor: tokens.warm.role });
  expect(flat(plate.props.style).shadowOpacity).toBeGreaterThanOrEqual(0.6);
  expect(flat(mark.props.style)).toMatchObject({ color: tokens.warm.bright, fontFamily: tokens.font.display });
  expect(screen.getByTestId('heard-hearth', hidden)).toBeTruthy();
});
