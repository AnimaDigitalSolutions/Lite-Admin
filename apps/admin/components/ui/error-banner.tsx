interface ErrorBannerProps {
  message: string | null;
  onDismiss: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  if (!message) return null;
  return (
    <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      {message}
      <button type="button" onClick={onDismiss} className="ml-4 text-red-500 hover:text-red-700">&#x2715;</button>
    </div>
  );
}
