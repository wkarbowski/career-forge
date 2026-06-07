import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ToolbarDropdown from '../../src/components/ToolbarDropdown';

const groups = [
  {
    label: 'Group A',
    options: [
      { value: 'alpha', label: 'Alpha' },
      { value: 'beta', label: 'Beta' },
      { value: 'gamma', label: 'Gamma' },
    ],
  },
];

describe('ToolbarDropdown', () => {
  it('renders the trigger with the currently selected option label', () => {
    render(
      <ToolbarDropdown value="beta" onChange={() => {}} groups={groups} ariaLabel="Pick one" />,
    );
    // The trigger button shows the selected label in its inner span, but its
    // accessible name is the ariaLabel prop. Check the visible text instead.
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('does not show the option list before the trigger is clicked', () => {
    render(
      <ToolbarDropdown value="alpha" onChange={() => {}} groups={groups} ariaLabel="Pick one" />,
    );
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('opens the dropdown and shows all options when the trigger is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ToolbarDropdown value="alpha" onChange={() => {}} groups={groups} ariaLabel="Pick one" />,
    );

    await user.click(screen.getByRole('button', { name: /pick one/i }));

    const listbox = screen.getByRole('listbox');
    expect(listbox).toBeInTheDocument();
    // Three options should be visible
    expect(screen.getAllByRole('option').length).toBe(3);
  });

  it('marks the current value as selected in the listbox', async () => {
    const user = userEvent.setup();
    render(
      <ToolbarDropdown value="beta" onChange={() => {}} groups={groups} ariaLabel="Pick one" />,
    );

    await user.click(screen.getByRole('button', { name: /pick one/i }));
    // The selected option has aria-selected="true"; query all options and find the selected one
    const options = screen.getAllByRole('option');
    const betaOption = options.find((o) => o.getAttribute('aria-selected') === 'true');
    expect(betaOption).toBeDefined();
    // Verify it contains the Beta label
    expect(betaOption).toHaveTextContent('Beta');
  });

  it('calls onChange with the selected value and closes the dropdown', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ToolbarDropdown value="alpha" onChange={onChange} groups={groups} ariaLabel="Pick one" />,
    );

    await user.click(screen.getByRole('button', { name: /pick one/i }));
    // Click the option by its visible text label
    const options = screen.getAllByRole('option');
    const gammaOption = options.find((o) => o.textContent?.includes('Gamma'))!;
    await user.click(gammaOption);

    expect(onChange).toHaveBeenCalledWith({ target: { value: 'gamma' } });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes the dropdown when Escape is pressed', async () => {
    const user = userEvent.setup();
    render(
      <ToolbarDropdown value="alpha" onChange={() => {}} groups={groups} ariaLabel="Pick one" />,
    );

    await user.click(screen.getByRole('button', { name: /pick one/i }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes the dropdown when clicking outside the component', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <ToolbarDropdown value="alpha" onChange={() => {}} groups={groups} ariaLabel="Pick one" />
        <button>outside</button>
      </div>,
    );

    await user.click(screen.getByRole('button', { name: /pick one/i }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'outside' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('renders the placeholder when no option matches the current value', () => {
    render(
      <ToolbarDropdown
        value="unknown"
        onChange={() => {}}
        groups={groups}
        ariaLabel="Pick one"
        placeholder="Select…"
      />,
    );
    expect(screen.getByText('Select…')).toBeInTheDocument();
  });
});
