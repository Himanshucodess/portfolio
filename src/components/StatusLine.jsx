export default function StatusLine({ status }) {
  return (
    <p className="status-line" aria-live="polite">
      {status}
    </p>
  );
}
