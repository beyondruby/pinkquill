export default function ProductDetailLoading() {
  return (
    <div className="max-w-3xl mx-auto py-6 px-4 animate-pulse">
      {/* Image placeholder */}
      <div className="aspect-[4/3] bg-gray-200 rounded-xl mb-6" />

      {/* Title + price */}
      <div className="h-6 w-2/3 bg-gray-200 rounded mb-3" />
      <div className="h-5 w-24 bg-gray-200 rounded mb-4" />

      {/* Description lines */}
      <div className="space-y-2">
        <div className="h-3 w-full bg-gray-100 rounded" />
        <div className="h-3 w-full bg-gray-100 rounded" />
        <div className="h-3 w-4/5 bg-gray-100 rounded" />
      </div>
    </div>
  );
}
