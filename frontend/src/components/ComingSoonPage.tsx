import comingSoonImage from "../assets/coming-soon.png";
import AppShell from "./layout/AppShell";

export default function ComingSoonPage() {
  return (
    <AppShell>
      <section className="flex min-h-[calc(100vh-8rem)] items-center justify-center py-4 sm:py-8">
        <div className="w-full max-w-5xl overflow-hidden rounded-[2rem] border border-red-950/20 bg-red-950 shadow-[0_28px_70px_-24px_rgba(69,10,10,0.65)]">
          <img
            src={comingSoonImage}
            alt="Coming soon"
            className="block h-auto w-full object-cover"
          />
        </div>
      </section>
    </AppShell>
  );
}
