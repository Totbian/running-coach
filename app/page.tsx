import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Page() {
  return (
    <section className="relative flex min-h-svh flex-col items-center justify-center px-6 text-center overflow-hidden">
      {/* Background Video */}
      <video
        className="absolute inset-0 w-full h-full object-cover"
        src="/hero-bg.mp4"
        autoPlay
        muted
        loop
        playsInline
      />

      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Hero content */}
      <div className="relative z-10">
        <p className="text-sm font-medium text-white/70 uppercase tracking-widest mb-4">
          AI-Powered Training
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl max-w-3xl text-white">
          Your Personal Running Coach
        </h1>
        <p className="mt-6 max-w-xl text-lg text-white/80 mx-auto">
          Adaptive training plans that evolve with you. Whether you&apos;re chasing
          your first 5K or your next marathon PR, get coached by AI that understands
          your body and your goals.
        </p>
        <div className="mt-8 flex gap-4 justify-center">
          <Link href="/onboarding">
            <Button size="lg">Get Started</Button>
          </Link>
          <Button
            variant="outline"
            size="lg"
            className="border-white text-white hover:bg-white/10"
          >
            Learn More
          </Button>
        </div>
      </div>
    </section>
  );
}
