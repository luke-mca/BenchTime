import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormError, FormField, SubmitButton } from '../components/FormField.jsx';

describe('FormField', () => {
  it('ties the label to the input', () => {
    render(<FormField id="username" label="Username" />);

    expect(screen.getByLabelText('Username')).toHaveAttribute('id', 'username');
  });

  it('passes extra props through to the input', () => {
    render(<FormField id="password" label="Password" type="password" autoComplete="current-password" />);

    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveAttribute('autocomplete', 'current-password');
  });

  it('shows the hint and links it to the input', () => {
    render(<FormField id="username" label="Username" hint="3–32 characters" />);

    expect(screen.getByText('3–32 characters')).toHaveAttribute('id', 'username-hint');
    expect(screen.getByLabelText('Username')).toHaveAttribute('aria-describedby', 'username-hint');
  });

  it('marks the input invalid and links the error when there is one', () => {
    render(<FormField id="username" label="Username" hint="3–32 characters" errorId="form-error" />);

    const input = screen.getByLabelText('Username');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'username-hint form-error');
  });

  it('leaves the input valid with no hint or error', () => {
    render(<FormField id="username" label="Username" />);

    const input = screen.getByLabelText('Username');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
  });
});

describe('FormError', () => {
  it('renders nothing without a message', () => {
    const { container } = render(<FormError id="form-error" message={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('announces the message as an alert', () => {
    render(<FormError id="form-error" message="That username is already taken." />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('That username is already taken.');
    expect(alert).toHaveAttribute('id', 'form-error');
  });
});

describe('SubmitButton', () => {
  it('shows its label and is enabled when idle', () => {
    render(<SubmitButton busy={false} busyLabel="Saving…">Save</SubmitButton>);

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute('type', 'submit');
  });

  it('shows the busy label and is disabled while busy', () => {
    render(<SubmitButton busy busyLabel="Saving…">Save</SubmitButton>);

    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  });
});
