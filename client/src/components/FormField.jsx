//A labeled input. The label is tied to the input with htmlFor/id so screen readers
//announce it, and the input points at the form's error message when there is one.
export function FormField({ id, label, hint, errorId, ...inputProps }) {
  const hintId = hint ? `${id}-hint` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        id={id}
        aria-describedby={describedBy}
        aria-invalid={errorId ? true : undefined}
        className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        {...inputProps}
      />
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-gray-500">
          {hint}
        </p>
      )}
    </div>
  );
}

export function FormError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </p>
  );
}

export function SubmitButton({ busy, busyLabel, children }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="w-full rounded bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
    >
      {busy ? busyLabel : children}
    </button>
  );
}
