import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EliteFlow Nebula',
  description: 'Orchestration monitor',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="wrap">
          <header className="top">
            <h1>EliteFlow Nebula</h1>
            <nav>
              <a href="/">Overview</a>
              <a href="/board">Board</a>
              <a href="/activity">Activity</a>
              <a href="/medium">Medium</a>
              <a href="/questions">Questions</a>
              <a href="/api/auth/logout">Sign out</a>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
