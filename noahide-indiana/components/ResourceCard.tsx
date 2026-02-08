interface Resource {
  name: string;
  category: "rabbi" | "teaching" | "community";
  description: string;
  link: string;
}

const categoryLabels: Record<Resource["category"], string> = {
  rabbi: "Rabbi",
  teaching: "Teaching",
  community: "Community",
};

const categoryColors: Record<Resource["category"], string> = {
  rabbi: "bg-[var(--color-blue)] text-white",
  teaching: "bg-[var(--color-gold)] text-white",
  community: "bg-[var(--color-blue-light)] text-white",
};

export default function ResourceCard({ resource }: { resource: Resource }) {
  return (
    <a
      href={resource.link}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-white rounded-lg border border-[var(--color-gold-light)] p-6 hover:shadow-md transition-shadow group"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-lg font-semibold text-[var(--color-blue)] group-hover:text-[var(--color-blue-light)] transition-colors">
          {resource.name}
        </h3>
        <span
          className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${categoryColors[resource.category]}`}
        >
          {categoryLabels[resource.category]}
        </span>
      </div>
      <p className="text-[var(--color-text)] leading-relaxed">
        {resource.description}
      </p>
      <span className="inline-block mt-4 text-sm font-medium text-[var(--color-blue)] group-hover:text-[var(--color-blue-light)] transition-colors">
        Visit &rarr;
      </span>
    </a>
  );
}
