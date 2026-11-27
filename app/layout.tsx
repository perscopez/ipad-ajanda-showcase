import type { Metadata, Viewport } from "next"
import "./fonts.css"
import "./globals.css"
import { THEME_BOOT } from "@/lib/theme"
import RegisterSW from "@/components/RegisterSW"


export const metadata: Metadata = {
  title: "My Notebooks",
  description: "Notebook / planner for Apple Pencil, with templates and photos",
  appleWebApp: { capable: true, title: "My Notebooks", statusBarStyle: "default" },
}
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false, viewportFit: "cover", themeColor: "#f6e6ef" }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="h-dvh overflow-hidden">{children}
        <RegisterSW />
      </body>
    </html>
  )
}
