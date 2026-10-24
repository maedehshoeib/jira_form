"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/context/AuthContext";

import { listCards } from "../api";
import type { PortalCardSummary } from "../types";
import CardGrid from "./CardGrid";

/** Admin-managed cards shown on the homepage below the built-in destinations. */
export default function HomeCustomCards() {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.is_admin);
  const [cards, setCards] = useState<PortalCardSummary[] | null>(null);

  useEffect(() => {
    let active = true;
    listCards(null)
      .then((data) => active && setCards(data))
      .catch(() => active && setCards([]));
    return () => {
      active = false;
    };
  }, []);

  if (cards === null) return null;
  if (cards.length === 0 && !isAdmin) return null;

  return (
    <section aria-label="کارت‌های سفارشی">
      <CardGrid cards={cards} isAdmin={isAdmin} parentId={null} />
    </section>
  );
}
