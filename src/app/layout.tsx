import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { AuthSessionProvider } from "@/components/session-provider";

export const metadata: Metadata = {
  title: "Dental CRM",
  description: "AI-powered patient relationship management for dental clinics",
};

// Applies the saved theme before paint to avoid a flash.
const themeScript = `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans">
        <AuthSessionProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <Topbar />
              <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-6 sm:px-8">{children}</main>
            </div>
          </div>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
