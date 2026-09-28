import { PinForm } from '@/components/PinForm';
import { requireHousehold } from '@/lib/guards';

export default async function PinPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  await requireHousehold('/pin');
  const { next } = await searchParams;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center p-8">
      <div className="paper taped w-full max-w-md px-8 pb-8 pt-10">
        <div className="text-center">
          <p className="text-[3.4rem] leading-none">🔒</p>
          <h1 className="serif mt-2 text-[2rem] font-bold">Grown-ups only</h1>
          <p className="mt-2 text-[1rem] font-semibold text-ink-soft">
            Enter the PIN to make changes.
          </p>
        </div>
        <div className="mt-6">
          <PinForm next={next} />
        </div>
      </div>
    </main>
  );
}
