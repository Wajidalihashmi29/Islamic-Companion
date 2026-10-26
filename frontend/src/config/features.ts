import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Calculator,
  Clock,
  Compass,
  Heart,
  BookHeart,
  CalendarDays,
  LayoutDashboard,
  ScrollText,
  BookOpenText,
} from "lucide-react";
import TasbeehIcon from "../components/icons/TasbeehIcon";

export interface Feature {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  /** Feature is live; otherwise it opens the unavailable-feature guidance. */
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
    available: true,
    primary: true,
   },
  {
    id: "quran-pdf",
    label: "Qur'an PDF",
    shortLabel: "Qur'an PDF",
    description: "Read the Holy Qur'an offline as a PDF with page turning",
    icon: BookOpenText,
    available: true,
    primary: false,
  },
  {
    id: "qibla",
    label: "Qibla Finder",
    shortLabel: "Qibla",
    description: "Direction to the Kaaba from wherever you are",
    icon: Compass,
    available: true,
    primary: true,
  },
  {
    id: "hadith",
    label: "Hadith Collection",
    shortLabel: "Hadith",
    description: "Browse major hadith collections by book and chapter",
    icon: ScrollText,
    available: true,
    primary: true,
  },
  {
    id: "zakat",
    label: "Zakat Calculator",
    shortLabel: "Zakat",
    description: "Work out what you owe this year",
    icon: Calculator,
    available: true,
    primary: false,
  },
  {
    id: "azkar",
    label: "Daily Duas & Azkar",
    shortLabel: "Azkar",
    description: "Morning, evening, and after-prayer remembrance",
    icon: BookHeart,
    available: true,
    primary: false,
  },
  {
    id: "calendar",
    label: "Islamic Calendar",
    shortLabel: "Calendar",
    description: "Hijri dates, Islamic occasions, and Ramadan guidance",
    icon: CalendarDays,
    available: true,
    primary: false,
  },
  {
    id: "tasbeeh",
    label: "Digital Tasbeeh",
    shortLabel: "Tasbeeh",
    description: "A modern counter for daily Dhikr",
    icon: TasbeehIcon,
    available: true,
    primary: false,
  },
  {
    id: "favorites",
    label: "Favorites",
    shortLabel: "Favorites",
    description: "Return to Surahs you've marked in the Quran reader",
    icon: Heart,
    available: true,
    primary: false,
  },
];

export const getFeature = (id: string) => features.find((f) => f.id === id);

export const getFeaturePath = (id: string) => id === "dashboard" ? "/" : `/${id}`;
