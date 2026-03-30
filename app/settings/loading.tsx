export default function SettingsLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-4">
      <div className="animate-spin h-8 w-8 border-2 border-purple-primary border-t-transparent rounded-full mb-4" />
      <p className="font-body text-muted text-sm">Loading settings...</p>
    </div>
  );
}
