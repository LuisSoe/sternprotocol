export default function Field({ label, htmlFor, required, error, hint, children }) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-2xs font-medium uppercase tracking-widest text-paper-dim"
      >
        {label}
        {required ? <span className="ml-1 text-state-fail">*</span> : null}
      </label>
      {children}
      {error ? (
        <p role="alert" className="mt-1.5 text-xs text-state-fail">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-paper-faint">{hint}</p>
      ) : null}
    </div>
  );
}

export const inputClass = (hasError) =>
  `w-full rounded border bg-ink-950 px-3 py-2.5 text-sm text-paper placeholder:text-paper-faint transition-colors duration-150 focus:outline-none ${
    hasError
      ? "border-state-fail/60 focus:border-state-fail"
      : "border-ink-700 hover:border-ink-600 focus:border-brass-400"
  }`;
