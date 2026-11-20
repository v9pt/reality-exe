"use client";

import dynamic from "next/dynamic";
import { AnimatePresence } from "motion/react";
import { useGame } from "@/store/game";
import type { PanelId } from "@/lib/sections";
import { ContactPanel } from "./ContactPanel";
import { LogPanel } from "./LogPanel";
import { ProfilePanel } from "./ProfilePanel";
import { QuestsPanel } from "./QuestsPanel";
import { BackroomPanel, SecretPanel } from "./SecretPanels";
import { SkillsPanel } from "./SkillsPanel";
import { TerminalPanel } from "./TerminalPanel";

// Game code stays out of the first download.
const ArcadePanel = dynamic(() => import("../arcade/ArcadePanel").then((m) => m.ArcadePanel), { ssr: false });

const PANELS: Record<PanelId, React.ComponentType> = {
  profile: ProfilePanel,
  quests: QuestsPanel,
  skills: SkillsPanel,
  log: LogPanel,
  terminal: TerminalPanel,
  contact: ContactPanel,
  secret: SecretPanel,
  backroom: BackroomPanel,
  arcade: ArcadePanel,
};

export function PanelHost() {
  const panel = useGame((s) => s.panel);
  const P = panel ? PANELS[panel] : null;
  return <AnimatePresence mode="wait">{P ? <P key={panel} /> : null}</AnimatePresence>;
}
