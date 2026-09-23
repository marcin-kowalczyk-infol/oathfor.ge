import { render, screen } from '@testing-library/react-native';
import App from './App';

test('renders the scaffold heading', async () => {
  await render(<App />);
  expect(screen.getByRole('header', { name: 'Oathforge' })).toBeOnTheScreen();
});
