export const metadata = {
  title: 'botstore',
  description: 'Blob storage server for LLM identities.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 14px;
            line-height: 1.7;
            max-width: 80ch;
            margin: 2rem auto;
            padding: 0 1.5rem;
            color: #e8e8e8;
            background: #0a0a0a;
          }
          h1 { font-size: 1.6rem; margin-bottom: 0.25rem; color: #fff; }
          h2 { font-size: 1.1rem; margin: 2rem 0 0.5rem; color: #aaa; text-transform: uppercase; letter-spacing: 0.1em; }
          h3 { font-size: 1rem; margin: 1.5rem 0 0.25rem; color: #fa0; }
          p { margin: 0.5rem 0; color: #ccc; }
          pre {
            background: #111;
            border: 1px solid #222;
            padding: 1rem;
            overflow-x: auto;
            margin: 0.5rem 0 1rem;
            font-size: 12px;
            line-height: 1.5;
          }
          code { color: #aef; }
          .badge { display: inline-block; padding: 0 0.4rem; border-radius: 2px; font-size: 11px; font-weight: bold; margin-right: 0.5rem; }
          .badge-get { background: #1a4; color: #fff; }
          .badge-put { background: #44a; color: #fff; }
          .badge-delete { background: #a44; color: #fff; }
          details summary { cursor: pointer; color: #666; font-size: 12px; margin-bottom: 0.25rem; }
          footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #1a1a1a; color: #555; font-size: 12px; }
          a { color: #7df; }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
