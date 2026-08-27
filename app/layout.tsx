import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const bricolageGrotesque = localFont({
  src: "../public/font/Bricolage_Grotesque/BricolageGrotesque-VariableFont_opsz,wdth,wght.ttf",
  variable: "--font-bricolage",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Veda AI — AI Evaluation & Grading Platform",
  description: "Next-generation AI grading and handwritten document evaluation platform.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`h-full antialiased ${bricolageGrotesque.variable}`}>
      <body className={`${bricolageGrotesque.className} min-h-full flex flex-col font-sans bg-[#FBFBFA]`}>
        {children}
      </body>
    </html>
  );
}
