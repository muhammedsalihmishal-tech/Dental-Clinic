import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-24 text-center">
      <div className="text-5xl">🦷</div>
      <h1 className="mt-4 text-xl font-semibold">Not found</h1>
      <Link href="/" className="btn-ghost mt-6">Back to dashboard</Link>
    </div>
  );
}
