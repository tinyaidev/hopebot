interface Event {
  title: string;
  date: string;
  time?: string;
  location: string;
  description: string;
  link?: string;
}

export default function EventCard({ event }: { event: Event }) {
  const formattedDate = new Date(event.date + "T00:00:00").toLocaleDateString(
    "en-US",
    {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  );

  return (
    <div className="bg-white rounded-lg border border-[var(--color-gold-light)] p-6 hover:shadow-md transition-shadow">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
        <h3 className="text-lg font-semibold text-[var(--color-blue)]">
          {event.title}
        </h3>
        <span className="text-sm text-[var(--color-gold)] font-medium whitespace-nowrap">
          {formattedDate}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--color-text-muted)] mb-3">
        {event.time && <span>{event.time}</span>}
        <span>{event.location}</span>
      </div>
      <p className="text-[var(--color-text)] leading-relaxed">
        {event.description}
      </p>
      {event.link && (
        <a
          href={event.link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-4 text-sm font-medium text-[var(--color-blue)] hover:text-[var(--color-blue-light)] transition-colors"
        >
          Learn more &rarr;
        </a>
      )}
    </div>
  );
}
