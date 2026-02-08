import type { Metadata } from "next";
import EventCard from "@/components/EventCard";
import events from "@/content/events.json";

export const metadata: Metadata = {
  title: "Events",
  description:
    "Upcoming Noahide events in Indiana — gatherings, study groups, and community celebrations.",
};

export default function EventsPage() {
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <section className="py-16 sm:py-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-[var(--color-blue)] mb-4 text-center">
          Events
        </h1>
        <p className="text-lg text-[var(--color-text-muted)] mb-10 text-center max-w-2xl mx-auto">
          Find upcoming Noahide gatherings, study groups, and community events
          across Indiana.
        </p>

        {sortedEvents.length > 0 ? (
          <div className="grid gap-6">
            {sortedEvents.map((event) => (
              <EventCard key={event.title + event.date} event={event} />
            ))}
          </div>
        ) : (
          <p className="text-center text-[var(--color-text-muted)]">
            No upcoming events at this time. Check back soon!
          </p>
        )}
      </div>
    </section>
  );
}
