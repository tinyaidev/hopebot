export default function Footer() {
  return (
    <footer className="bg-[var(--color-blue)] text-white/80 mt-auto">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm">
            Noahide Indiana &mdash; Connecting Noahides across the Hoosier State
          </p>
          <div className="flex gap-6 text-sm">
            <a
              href="https://asknoah.org"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Ask Noah
            </a>
            <a
              href="mailto:hello@noahideindiana.org"
              className="hover:text-white transition-colors"
            >
              Contact
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
