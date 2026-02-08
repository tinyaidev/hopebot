import type { Metadata } from "next";
import ResourceCard from "@/components/ResourceCard";
import resources from "@/content/resources.json";

export const metadata: Metadata = {
  title: "Resources",
  description:
    "Noahide resources in Indiana — rabbis, online teachings, and community connections.",
};

type Category = "rabbi" | "teaching" | "community";

const categoryOrder: Category[] = ["rabbi", "teaching", "community"];

const categoryHeadings: Record<Category, string> = {
  rabbi: "Rabbis & Congregations",
  teaching: "Online Teaching",
  community: "Communities & Organizations",
};

export default function ResourcesPage() {
  const grouped = categoryOrder
    .map((cat) => ({
      category: cat,
      heading: categoryHeadings[cat],
      items: resources.filter(
        (r) => r.category === cat
      ) as (typeof resources)[number][],
    }))
    .filter((g) => g.items.length > 0);

  return (
    <section className="py-16 sm:py-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-[var(--color-blue)] mb-4 text-center">
          Resources
        </h1>
        <p className="text-lg text-[var(--color-text-muted)] mb-12 text-center max-w-2xl mx-auto">
          Connect with rabbis, explore teachings, and find Noahide communities
          in Indiana and beyond.
        </p>

        {grouped.map((group) => (
          <div key={group.category} className="mb-12 last:mb-0">
            <h2 className="text-2xl font-semibold text-[var(--color-blue)] mb-6">
              {group.heading}
            </h2>
            <div className="grid gap-6 sm:grid-cols-2">
              {group.items.map((resource) => (
                <ResourceCard
                  key={resource.name}
                  resource={resource as { name: string; category: Category; description: string; link: string }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
