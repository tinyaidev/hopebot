import Link from "next/link";
import EventCard from "@/components/EventCard";
import events from "@/content/events.json";

export default function Home() {
  const upcomingEvents = events
    .filter((e) => new Date(e.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 3);

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-[var(--color-blue)] to-[var(--color-blue-light)] text-white py-20 sm:py-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold mb-6 leading-tight">
            Welcome to the Noahide
            <br />
            Community in Indiana
          </h1>
          <p className="text-lg sm:text-xl text-white/85 max-w-2xl mx-auto mb-8">
            Discover events, connect with teaching rabbis, and join a warm
            community of people living by the Seven Universal Laws.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/events"
              className="bg-[var(--color-gold)] hover:bg-[var(--color-gold-light)] hover:text-[var(--color-text)] text-white font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              Upcoming Events
            </Link>
            <Link
              href="/resources"
              className="border-2 border-white/40 hover:border-white hover:bg-white/10 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              Find Resources
            </Link>
          </div>
        </div>
      </section>

      {/* What is Noahide? */}
      <section className="py-16 sm:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-[var(--color-blue)] mb-6 text-center">
            What is a Noahide?
          </h2>
          <div className="space-y-4 text-[var(--color-text)] leading-relaxed text-lg">
            <p>
              A Noahide (or &ldquo;Ben Noah&rdquo; &mdash; child of Noah) is a
              non-Jewish person who follows the Seven Universal Laws given by God
              to all humanity through Noah after the Great Flood. These timeless
              principles form the moral foundation for a just and compassionate
              society.
            </p>
            <p>
              The Seven Noahide Laws encompass belief in one God, respect for
              life, justice, and ethical living. Millions of people around the
              world are discovering this ancient path &mdash; and right here in
              Indiana, a growing community is coming together to learn, celebrate,
              and support one another.
            </p>
          </div>
        </div>
      </section>

      {/* Upcoming Events Preview */}
      {upcomingEvents.length > 0 && (
        <section className="py-16 sm:py-20 bg-white/60">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-[var(--color-blue)] mb-8 text-center">
              Upcoming Events
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {upcomingEvents.map((event) => (
                <EventCard key={event.title + event.date} event={event} />
              ))}
            </div>
            <div className="text-center mt-10">
              <Link
                href="/events"
                className="text-[var(--color-blue)] hover:text-[var(--color-blue-light)] font-semibold transition-colors"
              >
                View all events &rarr;
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-16 sm:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-[var(--color-blue)] mb-4">
            Join the Community
          </h2>
          <p className="text-lg text-[var(--color-text-muted)] mb-8">
            Whether you&apos;re just learning about the Noahide path or have been
            walking it for years, there&apos;s a place for you here in Indiana.
          </p>
          <Link
            href="/resources"
            className="inline-block bg-[var(--color-blue)] hover:bg-[var(--color-blue-light)] text-white font-semibold px-8 py-3 rounded-lg transition-colors"
          >
            Explore Resources
          </Link>
        </div>
      </section>
    </>
  );
}
