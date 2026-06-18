"use client";
import React from "react";

export default function POSLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="fixed inset-0 bg-gray-900 overflow-hidden">
      {children}
    </div>
  );
}
