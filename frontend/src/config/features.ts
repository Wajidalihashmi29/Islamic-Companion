import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Calculator,
  CalendarCheck,
  Clock,
  Compass,
  Heart,
  LayoutDashboard,
  MapPin,
  ScrollText,
} from "lucide-react";

export interface Feature {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  /** Feature is live; otherwise it opens the "coming soon" dialog. */
  available: boolean;
  /** Shown directly in the desktop nav bar (others live under "More"). */
  primary: boolean;
}

export const dashboardItem = {
  id: "dashboard",
  label: "Dashboard",
  shortLabel: "Home",
  icon: LayoutDashboard,
};

export const features: Feature[] = [
  {
    id: "prayer",
    label: "Prayer Times",
    shortLabel: "Prayer",
    description: "Today's five prayers, based on your location",
    icon: Clock,
    available: true,
    primary: true,
  },
  {
    id: "quran",
    label: "Qur'an Reader",
    shortLabel: "Qur'an",
    description: "Read with translation and audio recitation",
    icon: BookOpen,
    available: false,
    primary: true,
  },
  {
    id: "qibla",
    label: "Qibla Finder",
    shortLabel: "Qibla",
    description: "Direction to the Kaaba from wherever you are",
    icon: Compass,
    available: false,
    primary: true,
  },
  {
    id: "hadith",
    label: "Hadith Collection",
    shortLabel: "Hadith",
    description: "Browse authentic hadith by book and chapter",
    icon: ScrollText,
    available: false,
    primary: true,
  },
  {
    id: "zakat",
    label: "Zakat Calculator",
    shortLabel: "Zakat",
    description: "Work out what you owe this year",
    icon: Calculator,
    available: false,
    primary: false,
  },
  {
    id: "fasting",
    label: "Fasting Tracker",
    shortLabel: "Fasting",
    description: "Log your fasts and keep your streak",
    icon: CalendarCheck,
    available: false,
    primary: false,
  },
  {
    id: "mosque",
    label: "Mosque Finder",
    shortLabel: "Mosques",
    description: "Nearby mosques and prayer halls",
    icon: MapPin,
    available: false,
    primary: false,
  },
  {
    id: "favorites",
    label: "Favorites",
    shortLabel: "Favorites",
    description: "Verses, duas, and hadith you've saved",
    icon: Heart,
    available: false,
    primary: false,
  },
];

export const getFeature = (id: string) => features.find((f) => f.id === id);
