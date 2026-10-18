import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  Clock,
  User,
  Settings2,
  Check,
  Sparkles,
  Volume2,
  RotateCcw,
  LogIn,
  LogOut,
  Sliders,
  Type,
  Bell,
  Moon,
  Cloud,
  RefreshCw,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  MailCheck,
  CircleAlert,
  CircleCheck,
  ShieldCheck,
  X,
} from "lucide-react";
import TopNav from "../components/TopNav";
import GoldenSpiral from "../components/GoldenSpiral";
import AyahMedallion from "../components/AyahMedallion";
import QuranText from "../components/QuranText";
import CustomDropdown, { type DropdownOption } from "../components/CustomDropdown";
import { useAuth } from "../context/AuthContext";
import { changePassword, forgotPassword, parseApiError, resetPassword } from "../api/authApi";
import { normalizeIndoPakText } from "../utils/quranTypography";
import { formatHijriDate } from "../utils/hijriDate";
import {
  loadSettings,
  saveSettings,
  resetSettings,
  syncCloudSettings,
  TRANSLATION_OPTIONS,
  TAFSEER_OPTIONS,
  RECITERS_OPTIONS,
  CALCULATION_METHODS,
  type AppSettings,
} from "../utils/settingsStorage";
import "./SettingsPage.css";

type TabId = "quran" | "prayer" | "account" | "general";

interface SettingsTabConfig {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const SETTINGS_TABS: SettingsTabConfig[] = [
  { id: "quran", label: "Qur'an Preferences", icon: BookOpen },
  { id: "prayer", label: "Prayer Times", icon: Clock },
  { id: "account", label: "Account Profile", icon: User },
  { id: "general", label: "General & Reset", icon: Settings2 },
];

const LANGUAGE_OPTIONS: DropdownOption[] = [
  { id: "en", name: "English (US)", sub: "Default application interface" },
  { id: "ur", name: "اردو — Urdu", sub: "مکمل اردو انٹرفیس (Coming soon)" },
  { id: "hi", name: "हिन्दी — Hindi", sub: "सम्पूर्ण हिन्दी इंटरफेस (Coming soon)" },
];

interface PreviewVerseLine {
  indopak: string;
  uthmani: string;
  ayahNumber?: string;
  translations: Record<string, string>;
}

interface PreviewItem {
  title: string;
  subtitle: string;
  lines: PreviewVerseLine[];
}

export function cleanIndoPakScript(text: string): string {
  return normalizeIndoPakText(text);
}

const PREVIEW_VERSES: Record<"fatiha" | "kursi", PreviewItem> = {
  fatiha: {
    title: "Surah Al-Fatiha (1:1-7)",
    subtitle: "مکمل سورة الفاتحة — سطر بہ سطر ترجمہ (Interlinear Mushaf Layout)",
    lines: [
      {
        indopak: "بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِیْمِ",
        uthmani: "بِسۡمِ ٱللَّهِ ٱلرَّحۡمَـٰنِ ٱلرَّحِیمِ",
        ayahNumber: "۱",
        translations: {
          "kanzul-iman-ur": "اللہ کے نام سے شروع جو بہت مہربان رحمت والا،",
          "irfan-ul-quran-ur": "اللہ کے نام سے شروع جو نہایت مہربان ہمیشہ رحم فرمانے والا ہے،",
          "jalandhari-ur": "شروع اللہ کا نام لے کر جو بڑا مہربان نہایت رحم والا ہے،",
          "kanzul-iman-en": "In the name of Allah, the Most Compassionate, Most Merciful.",
          "glorious-quran-en": "In the name of Allah, Most Gracious, Most Merciful.",
          "clear-quran-en": "In the Name of Allah—the Most Compassionate, Most Merciful.",
          "kanzul-iman-hi": "अल्लाह के नाम से शुरू जो बहुत मेहरबान रहमत वाला,",
          "farooq-khan-hi": "अल्लाह के नाम से, जो अत्यंत दयावान्, असीम दया वाला है,",
        },
      },
      {
        indopak: "اَلْحَمْدُ لِلّٰهِ رَبِّ الْعٰلَمِیْنَ",
        uthmani: "ٱلۡحَمۡدُ لِلَّهِ رَبِّ ٱلۡعَـٰلَمِینَ",
        ayahNumber: "۲",
        translations: {
          "kanzul-iman-ur": "سب خوبیاں اللہ کو جو مالک سارے جہان والوں کا،",
          "irfan-ul-quran-ur": "سب تعریفیں اللہ ہی کے لئے ہیں جو تمام جہانوں کی پرورش فرمانے والا ہے،",
          "jalandhari-ur": "سب طرح کی تعریف خدا ہی کو (سزاوار) ہے جو تمام مخلوقات کا پروردگار ہے،",
          "kanzul-iman-en": "All praise is due to Allah, the Sustainer of all the worlds,",
          "glorious-quran-en": "Praise be to Allah, Lord of the worlds,",
          "clear-quran-en": "All praise is for Allah—Lord of all worlds,",
          "kanzul-iman-hi": "सब खूबियां अल्लाह को जो मालिक सारे जहान वालों का,",
          "farooq-khan-hi": "सब प्रशंसा अल्लाह के लिए है, जो सारे संसार का पालनहार है,",
        },
      },
      {
        indopak: "الرَّحْمٰنِ الرَّحِیْمِ",
        uthmani: "ٱلرَّحۡمَـٰنِ ٱلرَّحِیمِ",
        ayahNumber: "۳",
        translations: {
          "kanzul-iman-ur": "بہت مہربان رحمت والا،",
          "irfan-ul-quran-ur": "نہایت مہربان بہت رحم فرمانے والا ہے،",
          "jalandhari-ur": "بڑا مہربان نہایت رحم والا،",
          "kanzul-iman-en": "The Most Compassionate, the Most Merciful,",
          "glorious-quran-en": "The Beneficent, the Merciful,",
          "clear-quran-en": "the Entirely Merciful, the Especially Merciful,",
          "kanzul-iman-hi": "बहुत मेहरबान रहमत वाला,",
          "farooq-khan-hi": "बड़ा दयावान्, अत्यंत दयाशील है,",
        },
      },
      {
        indopak: "مٰلِكِ یَوْمِ الدِّیْنِ",
        uthmani: "مَـٰلِكِ یَوۡمِ ٱلدِّینِ",
        ayahNumber: "۴",
        translations: {
          "kanzul-iman-ur": "روزِ جزا کا مالک،",
          "irfan-ul-quran-ur": "روزِ جزا کا مالک ہے،",
          "jalandhari-ur": "انصاف کے دن کا حاکم،",
          "kanzul-iman-en": "Master of the Day of Judgment,",
          "glorious-quran-en": "Master of the Day of Judgment,",
          "clear-quran-en": "Master of the Day of Judgment,",
          "kanzul-iman-hi": "रोज़-ए-जज़ा (बदले के दिन) का मालिक,",
          "farooq-khan-hi": "न्याय के दिन का स्वामी है,",
        },
      },
      {
        indopak: "اِیَّاكَ نَعْبُدُ وَ اِیَّاكَ نَسْتَعِیْنُ",
        uthmani: "إِیَّاكَ نَعۡبُدُ وَإِیَّاكَ نَسۡتَعِینُ",
        ayahNumber: "۵",
        translations: {
          "kanzul-iman-ur": "ہم تجھی کو پوجیں اور تجھی سے مدد چاہیں،",
          "irfan-ul-quran-ur": "(اے اللہ!) ہم تیری ہی عبادت کرتے ہیں اور ہم تجھ ہی سے مدد چاہتے ہیں،",
          "jalandhari-ur": "(اے پروردگار!) ہم تیری ہی عبادت کرتے ہیں اور تجھ ہی سے مدد مانگتے ہیں،",
          "kanzul-iman-en": "You alone do we worship, and from You alone do we seek help.",
          "glorious-quran-en": "Thee alone do we worship and Thee alone do we ask for help.",
          "clear-quran-en": "You alone we worship and You alone we ask for help.",
          "kanzul-iman-hi": "हम तुझी को पूजें और तुझी से मदद चाहें,",
          "farooq-khan-hi": "हम तेरी ही इबादत करते हैं और तुझ ही से मदद माँगते हैं,",
        },
      },
      {
        indopak: "اهْدِنَا الصِّرَاطَ الْمُسْتَقِیْمَ",
        uthmani: "ٱهۡدِنَا ٱلصِّرَ ٰ⁠طَ ٱلۡمُسۡتَقِیمَ",
        ayahNumber: "۶",
        translations: {
          "kanzul-iman-ur": "ہم کو سیدھا راستہ چلا،",
          "irfan-ul-quran-ur": "ہمیں سیدھا راستہ دکھا،",
          "jalandhari-ur": "ہم کو سیدھے رستے چلا،",
          "kanzul-iman-en": "Guide us upon the Straight Path,",
          "glorious-quran-en": "Show us the straight path,",
          "clear-quran-en": "Guide us along the Straight Path—",
          "kanzul-iman-hi": "हम को सीधा रास्ता चला,",
          "farooq-khan-hi": "हमें सीधा रास्ता दिखा,",
        },
      },
      {
        indopak: "صِرَاطَ الَّذِیْنَ اَنْعَمْتَ عَلَیْهِمْ غَیْرِ الْمَغْضُوْبِ عَلَیْهِمْ وَ لَا الضَّآلِّیْنَ",
        uthmani: "صِرَ ٰ⁠طَ ٱلَّذِینَ أَنۡعَمۡتَ عَلَیۡهِمۡ غَیۡرِ ٱلۡمَغۡضُوبِ عَلَیۡهِمۡ وَلَا ٱلضَّاۤلِّینَ",
        ayahNumber: "۷",
        translations: {
          "kanzul-iman-ur": "راستہ ان کا جن پر تو نے احسان کیا، نہ ان کا جن پر غضب ہوا اور نہ بہکے ہوؤں کا۔",
          "irfan-ul-quran-ur": "ان لوگوں کا راستہ جن پر تو نے انعام فرمایا، ان لوگوں کا نہیں جن پر غضب کیا گیا ہے اور نہ گمراہوں کا۔",
          "jalandhari-ur": "ان لوگوں کے رستے جن پر تو اپنا فضل و کرم کرتا رہا، نہ ان کے جن پر غصے ہوتا رہا اور نہ گمراہوں کے۔",
          "kanzul-iman-en": "The path of those whom You have favoured, not of those who earned Your anger, nor of those who went astray.",
          "glorious-quran-en": "The path of those whom Thou hast favored; Not the path of those who earn Thine anger nor of those who go astray.",
          "clear-quran-en": "the Path of those You have blessed, not those You are displeased with, or those who are astray.",
          "kanzul-iman-hi": "रास्ता उनका जिन पर तूने एहसान किया, न उनका जिन पर ग़ज़ब हुआ और न बहके हुओं का।",
          "farooq-khan-hi": "उन लोगों का रास्ता, जिन पर तूने कृपा की, न कि उनका जिन पर प्रकोप हुआ और न बहکے हुओं का।",
        },
      },
    ],
  },
  kursi: {
    title: "Ayat al-Kursi (Surah Al-Baqarah 2:255)",
    subtitle: "آية الكرسي — سطر بہ سطر ترجمہ (5 Authentic Mushaf Lines)",
    lines: [
      {
        indopak: "اَللّٰهُ لَاۤ اِلٰهَ اِلَّا هُوَ ۚ اَلْحَیُّ الْقَیُّوْمُ ۚ لَا تَاْخُذُهٗ سِنَةٌ وَّلَا نَوْمٌ ؕ",
        uthmani: "ٱللَّهُ لَآ إِلَـٰهَ إِلَّا هُوَ ٱلۡحَىُّ ٱلۡقَیُّومُۚ لَا تَأۡخُذُهُۥ سِنَةࣱ وَلَا نَوۡمࣱۚ",
        translations: {
          "kanzul-iman-ur": "اللہ ہے جس کے سوا کوئی معبود نہیں، وہ آپ زندہ اور اوروں کا قائم رکھنے والا، اسے نہ اونگھ آئے نہ نیند،",
          "irfan-ul-quran-ur": "اﷲ، اس کے سوا کوئی عبادت کے لائق نہیں، ہمیشہ زندہ رہنے والا ہے (سارے عالم کو اپنی تدبیر سے) قائم رکھنے والا ہے، نہ اس کو اُونگھ آتی ہے اور نہ نیند،",
          "jalandhari-ur": "خدا (وہ معبود برحق ہے کہ) اس کے سوا کوئی عبادت کے لائق نہیں، زندہ ہمیشہ رہنے والا، اسے نہ اونگھ آتی ہے نہ نیند،",
          "kanzul-iman-en": "Allah—there is no deity except Him, the Ever-Living, the Sustainer of all existence. Neither drowsiness overtakes Him nor sleep.",
          "glorious-quran-en": "Allah! There is no god but He—the Living, the Self-subsisting, Eternal. No slumber can seize Him nor sleep.",
          "clear-quran-en": "Allah! There is no god worthy of worship except Him, the Ever-Living, All-Sustaining. Neither drowsiness nor sleep overtakes Him.",
          "kanzul-iman-hi": "अल्लाह है जिसके सिवा कोई मा'बूद नहीं, वह आप ज़िंदा और औरों का क़ायम रखने वाला, उसे न ऊंघ आए न नींद,",
          "farooq-khan-hi": "अल्लाह (वह है कि) उसके सिवा कोई पूज्य नहीं। (वह) जीवित है, हर चीज़ को सँभालने वाला है। न उसे कुछ ऊँघ पकड़ती है और न नींद।",
        },
      },
      {
        indopak: "لَهٗ مَا فِی السَّمٰوٰتِ وَمَا فِی الْاَرْضِ ؕ مَنْ ذَا الَّذِیْ یَشْفَعُ عِنْدَهٗۤ اِلَّا بِاِذْنِهٖ ؕ",
        uthmani: "لَّهُۥ مَا فِی ٱلسَّمَـٰوَ ٰ⁠تِ وَمَا فِی ٱلۡأَرۡضِۗ مَن ذَا ٱلَّذِی یَشۡفَعُ عِندَهُۥۤ إِلَّا بِإِذۡنِهِۦۚ",
        translations: {
          "kanzul-iman-ur": "اسی کا ہے جو کچھ آسمانوں میں ہے اور جو کچھ زمین میں، وہ کون ہے جو اس کے یہاں سفارش کرے بغیر اس کے حکم کے!",
          "irfan-ul-quran-ur": "جو کچھ آسمانوں میں ہے اور جو کچھ زمین میں ہے سب اسی کا ہے، کون ایسا شخص ہے جو اس کے حضور اس کے اِذن کے بغیر سفارش کر سکے!",
          "jalandhari-ur": "جو کچھ آسمانوں میں اور جو کچھ زمین میں ہے سب اسی کا ہے، کون ہے جو اس کی اجازت کے بغیر اس کے پاس سفارش کر سکے!",
          "kanzul-iman-en": "To Him belongs whatever is in the heavens and whatever is on the earth. Who is it that can intercede with Him except by His permission?",
          "glorious-quran-en": "His are all things in the heavens and on earth. Who can intercede in His presence except as He permitteth?",
          "clear-quran-en": "To Him belongs whatever is in the heavens and whatever is on the earth. Who could possibly intercede with Him without His permission?",
          "kanzul-iman-hi": "उसी का है जो कुछ आसमानों में है और जो कुछ ज़मीन में, वह कौन है जो उसके यहाँ सिफ़ारिश करे बे उसके हुक्म के!",
          "farooq-khan-hi": "उसी का है जो कुछ आकाशों में और जो कुछ धरती में है। कौन है, जो उसके पास उसकी अनुमति के बिना सिफ़ारिश करे?",
        },
      },
      {
        indopak: "یَعْلَمُ مَا بَیْنَ اَیْدِیْهِمْ وَمَا خَلْفَهُمْ ۚ وَلَا یُحِیْطُوْنَ بِشَیْءٍ مِّنْ عِلْمِهٖۤ اِلَّا بِمَا شَآءَ ۚ",
        uthmani: "یَعۡلَمُ مَا بَیۡنَ أَیۡدِیهِمۡ وَمَا خَلۡفَهُمۡۖ وَلَا یُحِیطُونَ بِشَیۡءࣲ مِّنۡ عِلۡمِهِۦۤ إِلَّا بِمَا شَآءَۚ",
        translations: {
          "kanzul-iman-ur": "جانتا ہے جو کچھ ان کے آگے ہے اور جو کچھ ان کے پیچھے، اور وہ نہیں پاتے اس کے علم میں سے مگر جتنا وہ چاہے،",
          "irfan-ul-quran-ur": "جو کچھ مخلوقات کے سامنے ہے اور جو کچھ ان کے بعد ہے (وہ) سب جانتا ہے، اور وہ اس کی معلومات میں سے کسی چیز کا بھی احاطہ نہیں کر سکتے مگر جس قدر وہ چاہے،",
          "jalandhari-ur": "جو کچھ لوگوں کے روبرو ہو رہا ہے اور جو کچھ ان کے پیچھے ہوچکا ہے اسے سب معلوم ہے، اور وہ اس کی معلومات میں سے کسی چیز پر دسترس حاصل نہیں کر سکتے ہاں جس قدر وہ چاہے،",
          "kanzul-iman-en": "He knows what is before them and what will be after them, and they encompass not a thing of His knowledge except for what He wills.",
          "glorious-quran-en": "He knoweth what (appeareth to His creatures as) before or after or behind them. Nor shall they compass aught of His knowledge except as He willeth.",
          "clear-quran-en": "He fully knows what is ahead of them and what is behind them, but no one can grasp any of His knowledge—except what He wills to reveal.",
          "kanzul-iman-hi": "जानता है जो कुछ उनके आगे है और जो कुछ उनके पीछे, और वह नहीं पाते उसके इल्म में से मगर जितना वह चाहे,",
          "farooq-khan-hi": "वह जानता है जो कुछ उनके सामने और जो कुछ उनके पीछे है। और वे उसके ज्ञान में से किसी चीज़ को नहीं घेर सकते, परंतु जितना वह चाहे।",
        },
      },
      {
        indopak: "وَسِعَ كُرْسِیُّهُ السَّمٰوٰتِ وَالْاَرْضَ ۚ وَلَا یَـــُٔوْدُهٗ حِفْظُهُمَا ۚ",
        uthmani: "وَسِعَ كُرۡسِیُّهُ ٱلسَّمَـٰوَ ٰ⁠تِ وَٱلۡأَرۡضَۖ وَلَا یَـُٔودُهُۥ حِفۡظُهُمَاۚ",
        translations: {
          "kanzul-iman-ur": "اس کی کرسی میں سمائے ہوئے ہیں آسمان اور زمین، اور اسے بھاری نہیں ان کی نگہبانی،",
          "irfan-ul-quran-ur": "اس کی کرسی تمام آسمانوں اور زمین کو محیط ہے، اور اس پر ان دونوں کی حفاظت ہرگز دشوار نہیں،",
          "jalandhari-ur": "اس کی بادشاہی آسمان اور زمین سب پر حاوی ہے، اور اسے ان کی حفاظت کچھ بھی دشوار نہیں،",
          "kanzul-iman-en": "His seat extends over the heavens and the earth, and their preservation tires Him not.",
          "glorious-quran-en": "His Throne doth extend over the heavens and the earth, and He feeleth no fatigue in guarding and preserving them,",
          "clear-quran-en": "His Seat encompasses the heavens and the earth, and the preservation of both does not tire Him.",
          "kanzul-iman-hi": "उसकी कुर्सी में समाए हुए हैं आसमान और ज़मीन, और उसे भारी नहीं उनकी निगहबानी,",
          "farooq-khan-hi": "उसकी कुर्सी आकाशों और धरती को व्याप्त है और उन दोनों की रक्षा उसे नहीं थकाती।",
        },
      },
      {
        indopak: "وَهُوَ الْعَلِیُّ الْعَظِیْمُ ؕ",
        uthmani: "وَهُوَ ٱلۡعَلِیُّ ٱلۡعَظِیمُ",
        ayahNumber: "۲۵۵",
        translations: {
          "kanzul-iman-ur": "اور وہی ہے بلند بڑائی والا۔",
          "irfan-ul-quran-ur": "وہی سب سے بلند رتبہ بڑی عظمت والا ہے۔",
          "jalandhari-ur": "وہ بڑا عالی رتبہ اور جلیل القدر ہے۔",
          "kanzul-iman-en": "And He is the Most High, the Most Great.",
          "glorious-quran-en": "For He is the Most High, the Supreme (in glory).",
          "clear-quran-en": "For He is the Most High, the Greatest.",
          "kanzul-iman-hi": "और वही है बुलंद बड़ाई वाला।",
          "farooq-khan-hi": "और वही सबसे ऊँचा, सबसे महान है।",
        },
      },
    ],
  },
};

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, userIdentifier, isAuthenticated, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("quran");
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings(userIdentifier));
  const [savedNotice, setSavedNotice] = useState(false);
  const [previewVerseKey, setPreviewVerseKey] = useState<"kursi" | "fatiha">("kursi");
  const [syncingCloud, setSyncingCloud] = useState(false);
  const [cloudSyncedNotice, setCloudSyncedNotice] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // When the authenticated user profile changes (login, logout, or session refresh),
  // automatically load that user's saved preferences
  useEffect(() => {
    setSettings(loadSettings(userIdentifier));
  }, [userIdentifier, isAuthenticated]);

  // Listen to cross-tab, cross-component, and cloud database updates
  useEffect(() => {
    const handleSettingsUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.settings) {
        setSettings(detail.settings);
        if (detail.fromCloud) {
          setCloudSyncedNotice(true);
          setTimeout(() => setCloudSyncedNotice(false), 2500);
        }
      }
    };
    window.addEventListener("ic:settingsUpdated", handleSettingsUpdated);
    return () => {
      window.removeEventListener("ic:settingsUpdated", handleSettingsUpdated);
    };
  }, []);

  const handleManualCloudSync = async () => {
    if (!isAuthenticated) return;
    setSyncingCloud(true);
    const result = await syncCloudSettings(userIdentifier);
    if (result) {
      setSettings(result);
    }
    setSyncingCloud(false);
    setCloudSyncedNotice(true);
    setTimeout(() => setCloudSyncedNotice(false), 2500);
  };

  // Security & Password state for logged-in user
  const [isOtpResetMode, setIsOtpResetMode] = useState(false);
  const [resetOtp, setResetOtp] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState("");
  const [passwordChangeError, setPasswordChangeError] = useState("");
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState("");

  // Real-time password validation metrics
  const newPwHasLength = newPassword.length >= 8;
  const newPwHasDigit = /\d/.test(newPassword);
  const newPwHasUpper = /[A-Z]/.test(newPassword);
  const newPwRulesMet = newPwHasLength && newPwHasDigit && newPwHasUpper;

  const hasConfirmValue = confirmNewPassword.length > 0;
  const passwordsMatch = Boolean(newPassword && hasConfirmValue && newPassword === confirmNewPassword);
  const isOtpValid = resetOtp.trim().length === 6;

  const canSubmitPasswordChange =
    (isOtpResetMode ? isOtpValid : Boolean(currentPassword.trim())) &&
    newPwRulesMet &&
    passwordsMatch &&
    !isChangingPassword;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordChangeSuccess("");
    setPasswordChangeError("");

    if (!canSubmitPasswordChange) {
      if (!isOtpResetMode && !currentPassword) {
        setPasswordChangeError("Please enter your current password.");
      } else if (isOtpResetMode && !isOtpValid) {
        setPasswordChangeError("Please enter the 6-digit verification code sent to your email.");
      } else if (!newPwRulesMet) {
        setPasswordChangeError("New password must be at least 8 characters with 1 digit and 1 uppercase letter.");
      } else if (!passwordsMatch) {
        setPasswordChangeError("New password and confirm new password do not match.");
      }
      return;
    }

    setIsChangingPassword(true);
    try {
      if (isOtpResetMode) {
        if (!user?.email) throw new Error("No user email found.");
        const res = await resetPassword({
          email: user.email,
          otp: resetOtp.trim(),
          newPassword,
        });
        setPasswordChangeSuccess(res.data?.message || "Password successfully reset with verification code!");
        setResetOtp("");
        setNewPassword("");
        setConfirmNewPassword("");
        setIsOtpResetMode(false);
      } else {
        const res = await changePassword({ currentPassword, newPassword });
        setPasswordChangeSuccess(res.data?.message || "Password changed successfully.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmNewPassword("");
      }
      setTimeout(() => setPasswordChangeSuccess(""), 4500);
    } catch (err) {
      setPasswordChangeError(
        parseApiError(
          err,
          isOtpResetMode
            ? "Invalid or expired verification code. Please request a new code."
            : "Unable to change password. Please verify your current password."
        ).message
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSendLoggedInResetEmail = async () => {
    if (!user?.email) return;
    setIsSendingReset(true);
    setResetEmailSent("");
    setPasswordChangeError("");
    try {
      await forgotPassword(user.email);
      setIsOtpResetMode(true);
      setResetEmailSent(`A 6-digit verification code was sent to ${user.email}. Enter it below.`);
      setTimeout(() => setResetEmailSent(""), 6000);
    } catch (err) {
      setPasswordChangeError(
        parseApiError(err, "Failed to send reset code. Please try again.").message
      );
    } finally {
      setIsSendingReset(false);
    }
  };

  const updateSettings = (updater: (prev: AppSettings) => AppSettings) => {
    setSettings((prev) => {
      const next = updater(prev);
      saveSettings(next, userIdentifier);
      return next;
    });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const getLiveHijri = (offset: number) => formatHijriDate(new Date(), offset);

  const selectedLang =
    settings.quran.preferredTranslation.includes("-ur")
      ? "urdu"
      : settings.quran.preferredTranslation.includes("-hi")
      ? "hindi"
      : "english";

  const translationAvailable = TRANSLATION_OPTIONS.some(
    option => option.id === settings.quran.preferredTranslation && !option.disabled);
  const bismillahTranslation = translationAvailable
    ? PREVIEW_VERSES.fatiha.lines[0].translations[settings.quran.preferredTranslation]
    : "Selected translation unavailable. Choose an available edition.";

  const handleResetDefaults = () => {
    const userLabel = isAuthenticated && (user?.name || user?.email)
      ? `for ${user.name || user.email}`
      : "for this browser";
    if (window.confirm(`Reset all settings ${userLabel} to recommended defaults?`)) {
      const defaults = resetSettings(userIdentifier);
      setSettings(defaults);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2500);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="settings-page">
      <TopNav
        activeView="settings"
        onViewChange={(view) => {
          if (view === "dashboard") navigate("/");
          else if (view === "prayer") navigate("/?view=prayer");
          else if (view === "quran") navigate("/quran");
          else navigate(`/?view=${view}`);
        }}
        onLogout={handleLogout}
        onSettingsClick={() => {}}
      />

      <main className="settings-container">
        {/* Hero Banner */}
        <header className="settings-hero">
          <GoldenSpiral className="settings-hero-spiral" showGrid={false} />
          <div className="settings-hero-content">
            <div className="settings-hero-top-row">
              <button
                type="button"
                className="settings-back-btn"
                onClick={() => navigate("/")}
                aria-label="Back to dashboard"
              >
                <ArrowLeft size={18} />
                <span>Back to Dashboard</span>
              </button>
              <div
                className={`settings-autosave-badge ${
                  savedNotice || cloudSyncedNotice || syncingCloud ? "is-pulse" : ""
                } ${isAuthenticated ? "is-user-authenticated" : ""}`}
                role="status"
              >
                <Check size={14} className="autosave-check" />
                <span>
                  {isAuthenticated && (user?.email || user?.name)
                    ? syncingCloud
                      ? "Syncing with Cloud..."
                      : cloudSyncedNotice
                      ? "Cloud Synced Across Devices"
                      : savedNotice
                      ? `Saved to Cloud & Account (${user.email || user.name})`
                      : `Cloud Synced (${user.email || user.name})`
                    : savedNotice
                    ? "Saved to Browser (Guest)"
                    : "Auto-Saved (Guest Profile)"}
                </span>
              </div>
            </div>
            <div className="settings-eyebrow">
              <Sparkles size={14} />
              <span>Preferences & Customization</span>
            </div>
            <h1>Settings & Preferences</h1>
            <p className="settings-hero-subtitle">
              Configure your Qur'an, prayer calculation methods, and in-app experience.
            </p>
          </div>
        </header>

        {/* Tab Selector */}
        <div className="settings-tabs-scroll-container">
          <nav className="settings-tabs" aria-label="Settings categories">
            {SETTINGS_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`settings-tab ${activeTab === tab.id ? "is-active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon size={18} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab 1: Quran Preferences */}
        {activeTab === "quran" && (
          <section className="settings-section">
            {/* Card 1: Page Format & Calligraphy */}
            <div className="settings-card">
              <div className="settings-card-header">
                <div className="settings-card-icon">
                  <BookOpen size={22} />
                </div>
                <div>
                  <h2>Mushaf Page Format & Calligraphy</h2>
                  <p>Configure traditional page layout, script styles, and text sizing for comfortable tilawat.</p>
                </div>
              </div>

              {/* Mushaf Format */}
              <div className="settings-field-group">
                <label className="settings-label">
                  <span>Mushaf Page Layout</span>
                  <small>Standard printed page structure for tilawat and hifz</small>
                </label>
                <div className="selection-card-grid">
                  <button
                    type="button"
                    className={`selection-option-card ${settings.quran.mushafLines === 16 ? "is-selected" : ""}`}
                    onClick={() =>
                      updateSettings((prev) => ({
                        ...prev,
                        quran: { ...prev.quran, mushafLines: 16 },
                      }))
                    }
                  >
                    <div className="selection-card-indicator">
                      <span className="indicator-dot" />
                    </div>
                    <div className="selection-card-body">
                      <div className="selection-card-title">16-Line Standard (Indo-Pak)</div>                  
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`selection-option-card ${settings.quran.mushafLines === 15 ? "is-selected" : ""}`}
                    onClick={() =>
                      updateSettings((prev) => ({
                        ...prev,
                        quran: { ...prev.quran, mushafLines: 15 },
                      }))
                    }
                  >
                    <div className="selection-card-indicator">
                      <span className="indicator-dot" />
                    </div>
                    <div className="selection-card-body">
                      <div className="selection-card-title">15-Line Standard (Madani / Huffaz)</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Arabic Script & Font Styles */}
              <div className="settings-field-group">
                <label className="settings-label">
                  <span>Arabic Calligraphy Script</span>
                  <small>Choose between Indo-Pak or Uthmani Madani Naskh</small>
                </label>
                <div className="selection-card-grid">
                  <button
                    type="button"
                    className={`selection-option-card ${settings.quran.arabicScript === "indopak" ? "is-selected" : ""}`}
                    onClick={() =>
                      updateSettings((prev) => ({
                        ...prev,
                        quran: { ...prev.quran, arabicScript: "indopak" },
                      }))
                    }
                  >
                    <div className="selection-card-indicator">
                      <span className="indicator-dot" />
                    </div>
                    <div className="selection-card-body">
                      <div className="selection-card-preview-box">
                        <div
                          className="selection-script-preview font-indopak"
                          style={{ fontSize: `${settings.quran.arabicFontSize}px` }}
                        >
                          <QuranText text="بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِیْمِ" script="indopak" />
                        </div>
                        <div
                          className={`selection-trans-preview ${selectedLang}`}
                          style={{
                            fontSize: `${settings.quran.translationFontSize}px`,
                          }}
                        >
                          {bismillahTranslation}
                        </div>
                      </div>
                      <div className="selection-card-title">Indo-Pak Calligraphy</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`selection-option-card ${settings.quran.arabicScript === "uthmani" ? "is-selected" : ""}`}
                    onClick={() =>
                      updateSettings((prev) => ({
                        ...prev,
                        quran: { ...prev.quran, arabicScript: "uthmani" },
                      }))
                    }
                  >
                    <div className="selection-card-indicator">
                      <span className="indicator-dot" />
                    </div>
                    <div className="selection-card-body">
                      <div className="selection-card-preview-box">
                        <div
                          className="selection-script-preview font-uthmani"
                          style={{ fontSize: `${settings.quran.arabicFontSize}px` }}
                        >
                          بِسۡمِ ٱللَّهِ ٱلرَّحۡمَـٰنِ ٱلرَّحِیمِ
                        </div>
                        <div
                          className={`selection-trans-preview ${selectedLang}`}
                          style={{
                            fontSize: `${settings.quran.translationFontSize}px`,
                          }}
                        >
                          {bismillahTranslation}
                        </div>
                      </div>
                      <div className="selection-card-title">Uthmani / Madani Naskh Script</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Text Sizing Steppers & Sliders directly in this card */}
              <div className="card-typography-toolbar">
                <div className="typography-stepper-card">
                  <div className="stepper-meta">
                    <div className="stepper-icon-wrap">
                      <Type size={16} />
                    </div>
                    <div className="stepper-meta-text">
                      <span className="stepper-title">Arabic Qur'an Size</span>
                      <span className="stepper-val-pill">{settings.quran.arabicFontSize}px</span>
                    </div>
                  </div>
                  <div className="stepper-controls-row">
                    <button
                      type="button"
                      className="btn-stepper-step"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateSettings((prev) => ({
                          ...prev,
                          quran: {
                            ...prev.quran,
                            arabicFontSize: Math.max(24, prev.quran.arabicFontSize - 2),
                          },
                        }));
                      }}
                      title="Decrease Arabic font size"
                      aria-label="Decrease Arabic font size"
                    >
                      −
                    </button>
                    <input
                      type="range"
                      min="24"
                      max="52"
                      step="2"
                      value={settings.quran.arabicFontSize}
                      onChange={(e) =>
                        updateSettings((prev) => ({
                          ...prev,
                          quran: { ...prev.quran, arabicFontSize: Number(e.target.value) },
                        }))
                      }
                      className="stepper-range-slider"
                      aria-label="Arabic Quran Font Size"
                    />
                    <button
                      type="button"
                      className="btn-stepper-step"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateSettings((prev) => ({
                          ...prev,
                          quran: {
                            ...prev.quran,
                            arabicFontSize: Math.min(52, prev.quran.arabicFontSize + 2),
                          },
                        }));
                      }}
                      title="Increase Arabic font size"
                      aria-label="Increase Arabic font size"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="typography-stepper-card">
                  <div className="stepper-meta">
                    <div className="stepper-icon-wrap">
                      <Sliders size={16} />
                    </div>
                    <div className="stepper-meta-text">
                      <span className="stepper-title">Translation Text Size</span>
                      <span className="stepper-val-pill">{settings.quran.translationFontSize}px</span>
                    </div>
                  </div>
                  <div className="stepper-controls-row">
                    <button
                      type="button"
                      className="btn-stepper-step"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateSettings((prev) => ({
                          ...prev,
                          quran: {
                            ...prev.quran,
                            translationFontSize: Math.max(12, prev.quran.translationFontSize - 2),
                          },
                        }));
                      }}
                      title="Decrease translation font size"
                      aria-label="Decrease translation font size"
                    >
                      −
                    </button>
                    <input
                      type="range"
                      min="12"
                      max="48"
                      step="1"
                      value={settings.quran.translationFontSize}
                      onChange={(e) =>
                        updateSettings((prev) => ({
                          ...prev,
                          quran: { ...prev.quran, translationFontSize: Number(e.target.value) },
                        }))
                      }
                      className="stepper-range-slider"
                      aria-label="Translation Font Size"
                      aria-valuetext={`${settings.quran.translationFontSize}px`}
                    />
                    <button
                      type="button"
                      className="btn-stepper-step"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateSettings((prev) => ({
                          ...prev,
                          quran: {
                            ...prev.quran,
                            translationFontSize: Math.min(48, prev.quran.translationFontSize + 2),
                          },
                        }));
                      }}
                      title="Increase translation font size"
                      aria-label="Increase translation font size"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Translations & Marginal Commentary */}
            <div className="settings-card">
              <div className="settings-card-header">
                <div className="settings-card-icon">
                  <Sparkles size={22} />
                </div>
                <div>
                  <h2>Sunni Scholar Translations & Commentary</h2>
                  <p>Choose authentic Urdu and English translations with marginal exegesis (حاشیہ).</p>
                </div>
              </div>

              {/* Master Translation Switch */}
              <div className="settings-toggle-row">
                <div className="settings-toggle-text">
                  <strong>Show Interlinear Translation</strong>
                  <p>
                    When enabled, the translation appears directly under every line of Arabic text (
                    <span className="urdu-text">سطر بہ سطر ترجمہ</span>).
                  </p>
                </div>
                <label className="settings-switch">
                  <input
                    type="checkbox"
                    checked={settings.quran.showTranslation}
                    onChange={(e) =>
                      updateSettings((prev) => ({
                        ...prev,
                        quran: { ...prev.quran, showTranslation: e.target.checked },
                      }))
                    }
                  />
                  <span className="slider round"></span>
                </label>
              </div>

              {/* Preferred Translation */}
              <div className="settings-field-group">
                <label className="settings-label" htmlFor="preferred-translation-select">
                  <span>
                    Preferred Translation (<span className="urdu-text">ترجمہ</span>)
                  </span>
                </label>
                <CustomDropdown
                  id="preferred-translation-select"
                  value={settings.quran.preferredTranslation}
                  options={TRANSLATION_OPTIONS}
                  onChange={(val) =>
                    updateSettings((prev) => ({
                      ...prev,
                      quran: { ...prev.quran, preferredTranslation: String(val) },
                    }))
                  }
                />
                {!translationAvailable && <p role="alert">This translation is unavailable or no longer offered. Choose Kanzul Iman Urdu/English or Irfan-ul-Quran Urdu; translations are never substituted automatically.</p>}                
              </div>

              {/* Preferred Tafseer */}
              <div className="settings-field-group">
                <label className="settings-label" htmlFor="preferred-tafseer-select">
                  <span>
                    Preferred Tafseer (<span className="urdu-text">حاشیہ</span>)
                  </span>
                </label>
                <CustomDropdown
                  id="preferred-tafseer-select"
                  value={settings.quran.preferredTafseer}
                  options={TAFSEER_OPTIONS}
                  onChange={(val) =>
                    updateSettings((prev) => ({
                      ...prev,
                      quran: { ...prev.quran, preferredTafseer: String(val) },
                    }))
                  }
                />
                <p>Only Khazain-ul-Irfan is planned. It is unavailable pending an authorized, verified dataset.</p>
              </div>

              {/* Reciter */}
              <div className="settings-field-group">
                <label className="settings-label" htmlFor="preferred-reciter-select">
                  <span>
                    Default Reciter (<span className="urdu-text">قاری</span>)
                  </span>
                </label>
                <CustomDropdown
                  id="preferred-reciter-select"
                  value={settings.quran.reciter}
                  options={RECITERS_OPTIONS}
                  onChange={(val) =>
                    updateSettings((prev) => ({
                      ...prev,
                      quran: { ...prev.quran, reciter: String(val) },
                    }))
                  }
                />
              </div>
            </div>

            {/* Card 3: Interactive Live Mushaf Preview */}
            <div className="settings-card settings-preview-card">
              <div className="settings-card-header">
                <div className="settings-card-icon">
                  <Sparkles size={22} />
                </div>
                <div>
                  <h2>Mushaf Page Preview</h2>
                  <p>Showing your selected calligraphy, interlinear translation.</p>
                </div>
              </div>

              <div className="settings-preview-box">
                <div className="preview-header-bar">
                  <div className="preview-badge">
                    <Sparkles size={13} />
                    <span>Live Interlinear Preview</span>
                  </div>
                  <div className="preview-verse-chips">
                    <button
                      type="button"
                      className={`preview-chip ${previewVerseKey === "fatiha" ? "is-active" : ""}`}
                      onClick={() => setPreviewVerseKey("fatiha")}
                    >
                      Surah Al-Fatiha (1:1-7)
                    </button>
                    <button
                      type="button"
                      className={`preview-chip ${previewVerseKey === "kursi" ? "is-active" : ""}`}
                      onClick={() => setPreviewVerseKey("kursi")}
                    >
                      Ayat al-Kursi (2:255)
                    </button>
                  </div>
                </div>

                <div className="mushaf-interlinear-container">
                  <div className="mushaf-page-frame">
                    <div className="mushaf-frame-header">
                      <span className="mushaf-frame-title">{PREVIEW_VERSES[previewVerseKey].title}</span>
                      <span className="mushaf-frame-badge">
                        {settings.quran.mushafLines}-Line Mushaf •{" "}
                        {settings.quran.showTranslation ? (
                          <>
                            <span className="urdu-text">سطر بہ سطر ترجمہ</span> (Under Each Line)
                          </>
                        ) : (
                          <span className="urdu-text">خالص تلاوت</span>
                        )}
                      </span>
                    </div>

                    <div className="mushaf-lines-wrapper">
                      {PREVIEW_VERSES[previewVerseKey].lines.map((lineItem, idx) => {
                        const translationText = translationAvailable
                          ? lineItem.translations[settings.quran.preferredTranslation]
                          : "Selected translation unavailable. Choose an available edition.";

                        return (
                          <div key={idx} className="mushaf-line-row">
                            {/* Arabic Quran Line with Ayah Medallion */}
                            <div
                              className={`mushaf-arabic-line ${
                                settings.quran.arabicScript === "indopak" ? "font-indopak" : "font-uthmani"
                              }`}
                              style={{ fontSize: `${settings.quran.arabicFontSize}px` }}
                            >
                              <span className="mushaf-arabic-content">
                                <QuranText text={settings.quran.arabicScript === "indopak"
                                  ? cleanIndoPakScript(lineItem.indopak)
                                  : lineItem.uthmani} script={settings.quran.arabicScript} />
                                {lineItem.ayahNumber && (
                                  <AyahMedallion
                                    number={lineItem.ayahNumber}
                                    isIndoPak={settings.quran.arabicScript === "indopak"}
                                    size={Math.max(38, Math.round(settings.quran.arabicFontSize * 1.25))}
                                  />
                                )}
                              </span>
                            </div>

                            {/* Interlinear Translation directly under this line */}
                            {settings.quran.showTranslation && (
                              <div
                                className={`mushaf-trans-line ${selectedLang}`}
                                style={{
                                  fontSize: `${settings.quran.translationFontSize}px`,
                                }}
                              >
                                {translationText}
                              </div>
                            )}

                            {/* Ornamental Divider Line AFTER the translation separating from the next Ayat */}
                            {idx < PREVIEW_VERSES[previewVerseKey].lines.length - 1 && (
                              <div className="mushaf-interlinear-divider" aria-hidden="true">
                                <span className="mushaf-divider-symbol">۞</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Tab 2: Prayer Times Preferences */}
        {activeTab === "prayer" && (
          <section className="settings-section">
            <div className="settings-card">
              <div className="settings-card-header">
                <div className="settings-card-icon">
                  <Clock size={22} />
                </div>
                <div>
                  <h2>Prayer Times & Schedule</h2>
                  <p>Fine-tune jurisprudence methods, time conventions, and alert notifications.</p>
                </div>
              </div>

              {/* Asr Juristic Method */}
              <div className="settings-field-group">
                <label className="settings-label">
                  <span>Asr Juristic Method</span>
                  <small>Determines shadow length ratio for Asr commencement</small>
                </label>
                <div className="selection-card-grid">
                  <button
                    type="button"
                    className={`selection-option-card ${settings.prayer.asrSchool === "hanafi" ? "is-selected" : ""}`}
                    onClick={() =>
                      updateSettings((prev) => ({
                        ...prev,
                        prayer: { ...prev.prayer, asrSchool: "hanafi" },
                      }))
                    }
                  >
                    <div className="selection-card-indicator">
                      <span className="indicator-dot" />
                    </div>
                    <div className="selection-card-body">
                      <div className="selection-card-title">Hanafi (Standard in South Asia)</div>
                      <div className="selection-card-desc">Asr begins when an object's shadow is twice its height (2x)</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`selection-option-card ${settings.prayer.asrSchool === "shafi" ? "is-selected" : ""}`}
                    onClick={() =>
                      updateSettings((prev) => ({
                        ...prev,
                        prayer: { ...prev.prayer, asrSchool: "shafi" },
                      }))
                    }
                  >
                    <div className="selection-card-indicator">
                      <span className="indicator-dot" />
                    </div>
                    <div className="selection-card-body">
                      <div className="selection-card-title">Shafi'i, Maliki, Hanbali</div>
                      <div className="selection-card-desc">Asr begins when an object's shadow equals its height (1x)</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Time Format */}
              <div className="settings-field-group">
                <label className="settings-label">
                  <span>Time Display Format</span>
                  <small>Select preferred digital clock convention</small>
                </label>
                <div className="settings-button-group">
                  <button
                    type="button"
                    className={`btn-choice ${settings.prayer.timeFormat === "12h" ? "is-active" : ""}`}
                    onClick={() =>
                      updateSettings((prev) => ({
                        ...prev,
                        prayer: { ...prev.prayer, timeFormat: "12h" },
                      }))
                    }
                  >
                    12-Hour Clock (e.g. 5:45 PM)
                  </button>
                  <button
                    type="button"
                    className={`btn-choice ${settings.prayer.timeFormat === "24h" ? "is-active" : ""}`}
                    onClick={() =>
                      updateSettings((prev) => ({
                        ...prev,
                        prayer: { ...prev.prayer, timeFormat: "24h" },
                      }))
                    }
                  >
                    24-Hour Clock (e.g. 17:45)
                  </button>
                </div>
              </div>

              {/* Calculation Method */}
              <div className="settings-field-group">
                <label className="settings-label" htmlFor="calculation-method-select">
                  <span>Calculation Authority</span>
                  <small>Standard organization parameters used for Fajr & Isha twilight angles</small>
                </label>
                <CustomDropdown
                  id="calculation-method-select"
                  value={settings.prayer.calculationMethod}
                  options={CALCULATION_METHODS}
                  onChange={(val) =>
                    updateSettings((prev) => ({
                      ...prev,
                      prayer: { ...prev.prayer, calculationMethod: Number(val) },
                    }))
                  }
                />
              </div>

              {/* Alerts & Notifications */}
              <div className="settings-toggle-row">
                <div className="settings-toggle-text">
                  <div className="toggle-title-with-icon">
                    <Bell size={16} />
                    <strong>Prayer Time Notifications</strong>
                  </div>
                  <p>Receive notifications on your device when a prayer time arrives.</p>
                </div>
                <label className="settings-switch">
                  <input
                    type="checkbox"
                    checked={settings.prayer.notificationsEnabled}
                    onChange={(e) =>
                      updateSettings((prev) => ({
                        ...prev,
                        prayer: { ...prev.prayer, notificationsEnabled: e.target.checked },
                      }))
                    }
                  />
                  <span className="slider round"></span>
                </label>
              </div>

              <div className="settings-toggle-row">
                <div className="settings-toggle-text">
                  <div className="toggle-title-with-icon">
                    <Volume2 size={16} />
                    <strong>Adhan / Alert Chime</strong>
                  </div>
                  <p>Play a gentle alert chime at prayer entrance time.</p>
                </div>
                <label className="settings-switch">
                  <input
                    type="checkbox"
                    checked={settings.prayer.soundEnabled}
                    onChange={(e) =>
                      updateSettings((prev) => ({
                        ...prev,
                        prayer: { ...prev.prayer, soundEnabled: e.target.checked },
                      }))
                    }
                  />
                  <span className="slider round"></span>
                </label>
              </div>
            </div>
          </section>
        )}

        {/* Tab 3: Account Profile */}
        {activeTab === "account" && (
          <section className="settings-section">
            <div className="settings-card">
              <div className="settings-card-header">
                <div className="settings-card-icon">
                  <User size={22} />
                </div>
                <div>
                  <h2>Account Profile & Cloud Sync</h2>
                  <p>Manage your account identity, personal details, and synchronized data.</p>
                </div>
              </div>

              {isAuthenticated && user ? (
                <div className="settings-account-authenticated">
                  <div className="account-user-card">
                    <div className="account-avatar">
                      {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                    </div>
                    <div className="account-info">
                      <h3>{user.name || "Valued Member"}</h3>
                      <p>{user.email || "Registered Account"}</p>
                      <span className="account-badge">
                        <Check size={13} />
                        <span>Saved Preferences Bound to Account</span>
                      </span>
                    </div>
                  </div>

                  <div className="account-cloud-status-card">
                    <div className="cloud-status-left">
                      <div className="cloud-status-icon">
                        <Cloud size={20} />
                      </div>
                      <div>
                        <h4>Cloud Sync Active Across All Devices</h4>
                        <p>
                          Your settings are securely saved in the cloud database. When you sign in from your mobile phone, laptop, or another browser, all your preferences are restored automatically.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-sync-cloud"
                      onClick={handleManualCloudSync}
                      disabled={syncingCloud}
                      title="Sync current preferences with cloud database"
                    >
                      <RefreshCw size={15} className={syncingCloud ? "is-spinning" : ""} />
                      <span>{syncingCloud ? "Syncing..." : "Sync Cloud Now"}</span>
                    </button>
                  </div>                  

                  {/* Account Security & Password Card */}
                  <div className="account-security-card">
                    <div className="security-card-header">
                      <div className="security-card-icon">
                        <ShieldCheck size={18} />
                      </div>
                      <div>
                        <h3>Account Security & Password</h3>
                        <p>Change your account password or request a reset email link.</p>
                      </div>
                    </div>

                    {passwordChangeSuccess && (
                      <div className="alert-security-success" role="status">
                        <CircleCheck size={16} /> <span>{passwordChangeSuccess}</span>
                      </div>
                    )}

                    {passwordChangeError && (
                      <div className="alert-security-error" role="alert">
                        <CircleAlert size={16} /> <span>{passwordChangeError}</span>
                      </div>
                    )}

                    {resetEmailSent && (
                      <div className="alert-security-success" role="status">
                        <MailCheck size={16} /> <span>{resetEmailSent}</span>
                      </div>
                    )}

                    <form className="change-password-form" onSubmit={handleChangePassword}>
                      <div className="password-fields-grid">
                        {isOtpResetMode ? (
                          <div className="password-field-group">
                            <div className="password-label-row">
                              <label>6-Digit Verification Code</label>
                              {isOtpValid && (
                                <span className="password-badge-success">
                                  <Check size={11} /> 6 Digits
                                </span>
                              )}
                            </div>
                            <div className={`password-input-wrapper ${isOtpValid ? "is-match" : ""}`}>
                              <input
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                pattern="[0-9]*"
                                maxLength={6}
                                value={resetOtp}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                                  setResetOtp(val);
                                  if (passwordChangeError) setPasswordChangeError("");
                                }}
                                placeholder="123456"
                                style={{ letterSpacing: "0.22em", fontFamily: "monospace", fontWeight: 700 }}
                                required
                                disabled={isChangingPassword}
                              />
                              {isOtpValid && (
                                <span className="password-inline-status is-match" title="Code complete">
                                  <Check size={14} />
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="password-field-group">
                            <label>Current Password</label>
                            <div className="password-input-wrapper">
                              <input
                                type={showCurrentPassword ? "text" : "password"}
                                value={currentPassword}
                                onChange={(e) => {
                                  setCurrentPassword(e.target.value);
                                  if (passwordChangeError) setPasswordChangeError("");
                                }}
                                placeholder="Current password"
                                autoComplete="current-password"
                                required
                                disabled={isChangingPassword}
                              />
                              <button
                                type="button"
                                className="btn-pw-eye"
                                onClick={() => setShowCurrentPassword((v) => !v)}
                                tabIndex={-1}
                                aria-label="Toggle password visibility"
                              >
                                {showCurrentPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="password-field-group">
                          <div className="password-label-row">
                            <label>New Password</label>
                            {newPassword.length > 0 && newPwRulesMet && (
                              <span className="password-badge-success">
                                <Check size={11} /> Valid
                              </span>
                            )}
                          </div>
                          <div
                            className={`password-input-wrapper ${
                              newPassword.length > 0
                                ? newPwRulesMet
                                  ? "is-match"
                                  : ""
                                : ""
                            }`}
                          >
                            <input
                              type={showNewPassword ? "text" : "password"}
                              value={newPassword}
                              onChange={(e) => {
                                setNewPassword(e.target.value);
                                if (passwordChangeError) setPasswordChangeError("");
                              }}
                              placeholder="New password (8+ chars)"
                              autoComplete="new-password"
                              required
                              disabled={isChangingPassword}
                            />
                            {newPassword.length > 0 && newPwRulesMet && (
                              <span className="password-inline-status is-match" title="Requirements met">
                                <Check size={14} />
                              </span>
                            )}
                            <button
                              type="button"
                              className="btn-pw-eye"
                              onClick={() => setShowNewPassword((v) => !v)}
                              tabIndex={-1}
                              aria-label="Toggle password visibility"
                            >
                              {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                          </div>

                          {/* Real-time requirements checklist */}
                          {newPassword.length > 0 && (
                            <div className="realtime-rules-list" role="status" aria-label="Password requirements">
                              <span className={`realtime-rule-pill ${newPwHasLength ? "met" : ""}`}>
                                {newPwHasLength ? <Check size={11} /> : <span className="rule-bullet">•</span>} 8+ chars
                              </span>
                              <span className={`realtime-rule-pill ${newPwHasDigit ? "met" : ""}`}>
                                {newPwHasDigit ? <Check size={11} /> : <span className="rule-bullet">•</span>} 1 number
                              </span>
                              <span className={`realtime-rule-pill ${newPwHasUpper ? "met" : ""}`}>
                                {newPwHasUpper ? <Check size={11} /> : <span className="rule-bullet">•</span>} 1 uppercase
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="password-field-group">
                          <div className="password-label-row">
                            <label>Confirm New Password</label>
                            {hasConfirmValue && (
                              <span className={`password-badge-${passwordsMatch ? "success" : "warning"}`}>
                                {passwordsMatch ? <Check size={11} /> : <X size={11} />}
                                {passwordsMatch ? "Matches" : "Mismatch"}
                              </span>
                            )}
                          </div>
                          <div
                            className={`password-input-wrapper ${
                              hasConfirmValue
                                ? passwordsMatch
                                  ? "is-match"
                                  : "is-mismatch"
                                : ""
                            }`}
                          >
                            <input
                              type={showConfirmNewPassword ? "text" : "password"}
                              value={confirmNewPassword}
                              onChange={(e) => {
                                setConfirmNewPassword(e.target.value);
                                if (passwordChangeError) setPasswordChangeError("");
                              }}
                              placeholder="Confirm new password"
                              autoComplete="new-password"
                              required
                              disabled={isChangingPassword}
                            />
                            {hasConfirmValue && (
                              <span
                                className={`password-inline-status ${passwordsMatch ? "is-match" : "is-mismatch"}`}
                                title={passwordsMatch ? "Passwords match" : "Passwords do not match"}
                              >
                                {passwordsMatch ? <Check size={14} /> : <X size={14} />}
                              </span>
                            )}
                            <button
                              type="button"
                              className="btn-pw-eye"
                              onClick={() => setShowConfirmNewPassword((v) => !v)}
                              tabIndex={-1}
                              aria-label="Toggle password visibility"
                            >
                              {showConfirmNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                          </div>

                          {/* Real-time match feedback */}
                          {hasConfirmValue && (
                            <div
                              className={`password-feedback-inline ${passwordsMatch ? "is-match" : "is-mismatch"}`}
                              role="status"
                            >
                              {passwordsMatch ? (
                                <>
                                  <Check size={12} />
                                  <span>Passwords match</span>
                                </>
                              ) : (
                                <>
                                  <X size={12} />
                                  <span>Passwords do not match yet</span>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="security-form-actions">
                        <button
                          type="submit"
                          className="btn-change-password"
                          disabled={!canSubmitPasswordChange}
                        >
                          <KeyRound size={15} />
                          <span>
                            {isChangingPassword
                              ? isOtpResetMode
                                ? "Resetting Password..."
                                : "Updating Password..."
                              : isOtpResetMode
                              ? "Reset Password with Code"
                              : "Update Password"}
                          </span>
                        </button>

                        {isOtpResetMode ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <button
                              type="button"
                              className="btn-forgot-password-inline"
                              onClick={handleSendLoggedInResetEmail}
                              disabled={isSendingReset}
                            >
                              <Mail size={14} />
                              <span>{isSendingReset ? "Sending..." : "Resend Code"}</span>
                            </button>
                            <button
                              type="button"
                              className="btn-forgot-password-inline"
                              onClick={() => {
                                setIsOtpResetMode(false);
                                setResetOtp("");
                                setPasswordChangeError("");
                              }}
                            >
                              <span>Use Current Password instead</span>
                            </button>
                          </div>
                        ) : (
                          user?.email && (
                            <button
                              type="button"
                              className="btn-forgot-password-inline"
                              onClick={handleSendLoggedInResetEmail}
                              disabled={isSendingReset}
                            >
                              <Mail size={14} />
                              <span>
                                {isSendingReset
                                  ? "Sending code..."
                                  : `Forgot password? Send code to ${user.email}`}
                              </span>
                            </button>
                          )
                        )}
                      </div>
                    </form>
                  </div>

                  <div className="account-actions">
                    <button
                      type="button"
                      className="btn-reset"
                      onClick={handleResetDefaults}
                    >
                      <RotateCcw size={16} />
                      <span>Reset Account Preferences</span>
                    </button>
                    <button
                      type="button"
                      className="btn-danger-outline"
                      onClick={handleLogout}
                    >
                      <LogOut size={16} />
                      <span>Log Out of Account</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="settings-guest-card">
                  <div className="guest-badge">
                    <Sparkles size={14} />
                    <span>Guest Mode</span>
                  </div>
                  <h3>You are currently browsing as a Guest</h3>
                  <p>
                    All your settings, preferred scholar translations, and bookmarks are safely saved on this browser.
                    Sign in or create a free account to sync them seamlessly across your phone, tablet, and computer.
                  </p>
                  <button
                    type="button"
                    className="btn-primary-gold"
                    onClick={() => navigate("/login")}
                  >
                    <LogIn size={16} />
                    <span>Sign In or Create Account</span>
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Tab 4: General & Reset */}
        {activeTab === "general" && (
          <section className="settings-section">
            <div className="settings-card">
              <div className="settings-card-header">
                <div className="settings-card-icon">
                  <Settings2 size={22} />
                </div>
                <div>
                  <h2>General & System Preferences</h2>
                  <p>Adjust calendar parameters, language, or restore recommended defaults.</p>
                </div>
              </div>

              {/* Hijri adjustment */}
              <div className="settings-field-group">
                <label className="settings-label">
                  <span>Hijri Calendar Date Offset</span>
                  <small>Adjust Hijri date by ±2 days to match your regional moon sighting authority</small>
                </label>
                <div className="settings-button-group">
                  {[-2, -1, 0, 1, 2].map((offset) => (
                    <button
                      key={offset}
                      type="button"
                      className={`btn-choice ${
                        settings.general.hijriAdjustment === offset ? "is-active" : ""
                      }`}
                      onClick={() =>
                        updateSettings((prev) => ({
                          ...prev,
                          general: { ...prev.general, hijriAdjustment: offset },
                        }))
                      }
                    >
                      {offset === 0 ? "Standard (0)" : offset > 0 ? `+${offset} Day` : `${offset} Day`}
                    </button>
                  ))}
                </div>
                <div className="hijri-live-badge">
                  <Moon size={15} />
                  <span>Calculated Hijri Date: <strong>{getLiveHijri(settings.general.hijriAdjustment)}</strong></span>
                </div>
              </div>

              {/* Language */}
              <div className="settings-field-group">
                <label className="settings-label" htmlFor="app-language-select">
                  <span>Application Interface Language</span>
                  <small>Interface labels and headings</small>
                </label>
                <CustomDropdown
                  id="app-language-select"
                  value={settings.general.appLanguage}
                  options={LANGUAGE_OPTIONS}
                  onChange={(val) =>
                    updateSettings((prev) => ({
                      ...prev,
                      general: { ...prev.general, appLanguage: String(val) },
                    }))
                  }
                />
              </div>

              <hr className="settings-divider" />

              {/* Reset to defaults */}
              <div className="settings-reset-block">
                <div>
                  <strong>
                    {isAuthenticated && (user?.name || user?.email)
                      ? "Reset Account Preferences"
                      : "Reset to Defaults"}
                  </strong>
                  <p>
                    {isAuthenticated && (user?.name || user?.email)
                      ? `Reverts saved settings for ${user.name || user.email} to recommended defaults (Kanzul Iman translation, 16-line Indo-Pak Mushaf, Khazain-ul-Irfan, and Hanafi prayer timing).`
                      : "Reverts all settings on this browser to default preferences (Kanzul Iman translation, 16-line Indo-Pak Mushaf, Khazain-ul-Irfan, and Hanafi prayer timing)."}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-reset"
                  onClick={handleResetDefaults}
                >
                  <RotateCcw size={16} />
                  <span>Restore Defaults</span>
                </button>
              </div>
            </div>
          </section>
        )}

      </main>
    </div>
  );
}
