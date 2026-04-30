import { Button } from "@/components/ui/button"

export default function Page() {
  return (
    <section className="flex min-h-svh flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest mb-4">
        AI-Powered Training
      </p>
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl max-w-3xl">
        Your Personal Running Coach
      </h1>
      <p className="mt-6 max-w-xl text-lg text-muted-foreground">
        Adaptive training plans that evolve with you. Whether you&apos;re chasing your first 5K or your next marathon PR, get coached by AI that understands your body and your goals.
      </p>
      <div className="mt-8 flex gap-4">
        <Button size="lg">Get Started</Button>
        <Button variant="outline" size="lg">Learn More</Button>
      </div>
    </section>
  )
}
