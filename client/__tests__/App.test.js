import React from 'react';
import { render } from '@testing-library/react';
import App from '../src/App';

test('renders toolbar', () => {
  const { getByText } = render(<App />);
  expect(getByText(/print/i)).toBeInTheDocument();
});
