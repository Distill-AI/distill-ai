export function Inbox() {
  return (
    <div className="px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Inbox</h1>
        <button className="h-9 px-4 rounded-button bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors">
          + New request
        </button>
      </div>
    </div>
  );
}
