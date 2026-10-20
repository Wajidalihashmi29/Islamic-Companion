import { useMemo, useState } from "react";
import { BookHeart, Check, ChevronLeft, ChevronRight, Heart, RotateCcw } from "lucide-react";
import { getStorageKeyForUser } from "../utils/settingsStorage";
import { useAuth } from "../context/AuthContext";

const AZKAR = [
  {
    id: "ayat-kursi", period: "Quran remembrance", count: 1,
    arabic: "اللّٰهُ لَا إِلٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّوْمُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ ۚ لَهُ مَا فِي السَّمٰوٰتِ وَمَا فِي الْأَرْضِ ۗ مَنْ ذَا الَّذِي يَشْفَعُ عِنْدَهُ إِلَّا بِإِذْنِهِ ۚ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ ۖ وَلَا يُحِيطُونَ بِشَيْءٍ مِنْ عِلْمِهِ إِلَّا بِمَا شَاءَ ۚ وَسِعَ كُرْسِيُّهُ السَّمٰوٰتِ وَالْأَرْضَ ۖ وَلَا يَؤُدُهُ حِفْظُهُمَا ۚ وَهُوَ الْعَلِيُّ الْعَظِيمُ",
    en: "Ayat al-Kursi. Open Quran 2:255 in the reader for your selected complete translation.",
    ur: "آیت الکرسی۔ اپنے منتخب مکمل ترجمے کے لیے قرآن ریڈر میں سورۃ البقرہ 2:255 کھولیں۔",
    hi: "आयतुल कुर्सी। अपने चुने हुए पूरे अनुवाद के लिए कुरआन रीडर में सूरह अल-बक़रा 2:255 खोलें।",
    source: "Qur'an 2:255",
  },
  {
    id: "sayyid-istighfar", period: "Morning and evening", count: 1,
    arabic: "اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ لَكَ بِذَنْبِي، فَاغْفِرْ لِي، فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ",
    en: "O Allah, You are my Lord; none has the right to be worshipped except You. You created me and I am Your servant. I seek refuge in You from the evil of what I have done. I acknowledge Your favour and my sin, so forgive me; no one forgives sins except You.",
    ur: "اے اللہ! تو میرا رب ہے، تیرے سوا کوئی معبود نہیں۔ تو نے مجھے پیدا کیا اور میں تیرا بندہ ہوں۔ میں اپنے کیے کے شر سے تیری پناہ مانگتا ہوں، تیری نعمت اور اپنے گناہ کا اقرار کرتا ہوں، پس مجھے بخش دے کیونکہ تیرے سوا گناہ کوئی نہیں بخشتا۔",
    hi: "ऐ अल्लाह! तू मेरा रब है, तेरे सिवा कोई इबादत के लायक़ नहीं। तूने मुझे पैदा किया और मैं तेरा बंदा हूँ। मैं अपने किए की बुराई से तेरी पनाह माँगता हूँ, तेरी नेमत और अपने गुनाह को मानता हूँ; मुझे बख़्श दे।",
    source: "Sahih al-Bukhari 6306",
  },
  {
    id: "bismillah-protection", period: "Morning and evening", count: 3,
    arabic: "بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ",
    en: "In the name of Allah, with whose name nothing on earth or in heaven can cause harm; He is the All-Hearing, All-Knowing.",
    ur: "اللہ کے نام سے، جس کے نام کے ساتھ زمین و آسمان میں کوئی چیز نقصان نہیں پہنچا سکتی، اور وہی خوب سننے والا، خوب جاننے والا ہے۔",
    hi: "अल्लाह के नाम से, जिसके नाम के साथ ज़मीन और आसमान में कोई चीज़ नुकसान नहीं पहुँचा सकती; और वही सब सुनने वाला, सब जानने वाला है।",
    source: "Sunan Abi Dawud 5088",
  },
  {
    id: "raditu-billah", period: "Morning and evening", count: 3,
    arabic: "رَضِيتُ بِاللَّهِ رَبًّا، وَبِالْإِسْلَامِ دِينًا، وَبِمُحَمَّدٍ ﷺ نَبِيًّا",
    en: "I am pleased with Allah as my Lord, Islam as my religion, and Muhammad ﷺ as my Prophet.",
    ur: "میں اللہ کے رب ہونے، اسلام کے دین ہونے اور محمد ﷺ کے نبی ہونے پر راضی ہوں۔",
    hi: "मैं अल्लाह के रब होने, इस्लाम के दीन होने और मुहम्मद ﷺ के नबी होने पर राज़ी हूँ।",
    source: "Sunan Abi Dawud 5072",
  },
  {
    id: "allahumma-afiyah", period: "Morning and evening", count: 1,
    arabic: "اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي الدُّنْيَا وَالْآخِرَةِ",
    en: "O Allah, I ask You for pardon and well-being in this world and the Hereafter.",
    ur: "اے اللہ! میں تجھ سے دنیا اور آخرت میں معافی اور عافیت مانگتا ہوں۔",
    hi: "ऐ अल्लाह! मैं तुझसे दुनिया और आख़िरत में माफ़ी और सलामती माँगता हूँ।",
    source: "Sunan Abi Dawud 5074",
  },
  {
    id: "la-ilaha-illallah", period: "Morning and evening", count: 100,
    arabic: "لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ",
    en: "None has the right to be worshipped except Allah alone, without partner. His is the dominion and praise, and He has power over everything.",
    ur: "اللہ کے سوا کوئی معبود نہیں، وہ اکیلا ہے، اس کا کوئی شریک نہیں۔ بادشاہی اور حمد اسی کے لیے ہے اور وہ ہر چیز پر قادر ہے۔",
    hi: "अल्लाह के सिवा कोई इबादत के लायक़ नहीं, वह अकेला है और उसका कोई साझी नहीं। बादशाही और तारीफ़ उसी के लिए है और वह हर चीज़ पर क़ादिर है।",
    source: "Sahih al-Bukhari 6403",
  },
  {
    id: "surah-ikhlas", period: "Morning and evening", count: 3,
    categories: ["Morning and evening", "Quran remembrance"],
    arabic: "قُلْ هُوَ اللَّهُ أَحَدٌ ۝ اللَّهُ الصَّمَدُ ۝ لَمْ يَلِدْ وَلَمْ يُولَدْ ۝ وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ",
    en: "Say: He is Allah, the One; Allah, the Self-Sufficient. He neither begets nor is born, and none is comparable to Him.",
    ur: "تم فرماؤ: وہ اللہ ہے، وہ ایک ہے۔ اللہ بے نیاز ہے۔ نہ اس کی کوئی اولاد اور نہ وہ کسی سے پیدا ہوا، اور نہ اس کے جوڑ کا کوئی۔",
    hi: "कहो: वह अल्लाह एक है। अल्लाह सब से बेनियाज़ है। न उसकी कोई औलाद है, न वह पैदा हुआ, और कोई उसके बराबर नहीं।",
    source: "Qur'an 112",
  },
  {
    id: "surah-falaq", period: "Morning and evening", count: 3,
    categories: ["Morning and evening", "Quran remembrance"],
    arabic: "قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ ۝ مِنْ شَرِّ مَا خَلَقَ ۝ وَمِنْ شَرِّ غَاسِقٍ إِذَا وَقَبَ ۝ وَمِنْ شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ ۝ وَمِنْ شَرِّ حَاسِدٍ إِذَا حَسَدَ",
    en: "Say: I seek refuge in the Lord of daybreak from the evil of what He created, darkness, those who blow on knots, and the envier when he envies.",
    ur: "تم فرماؤ: میں صبح کے رب کی پناہ لیتا ہوں، اس کی سب مخلوق کے شر سے، اندھیری رات کے شر سے، گرہوں میں پھونکنے والیوں کے شر سے اور حسد کرنے والے کے شر سے۔",
    hi: "कहो: मैं सुबह के रब की पनाह माँगता हूँ उसकी मख़लूक़ के शर से, अँधेरी रात, गाँठों पर फूँकने वालों और हसद करने वाले के शर से।",
    source: "Qur'an 113",
  },
  {
    id: "surah-nas", period: "Morning and evening", count: 3,
    categories: ["Morning and evening", "Quran remembrance"],
    arabic: "قُلْ أَعُوذُ بِرَبِّ النَّاسِ ۝ مَلِكِ النَّاسِ ۝ إِلَهِ النَّاسِ ۝ مِنْ شَرِّ الْوَسْوَاسِ الْخَنَّاسِ ۝ الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ ۝ مِنَ الْجِنَّةِ وَالنَّاسِ",
    en: "Say: I seek refuge in the Lord, King, and God of mankind from the whisperer who withdraws and whispers into hearts, from jinn and mankind.",
    ur: "تم فرماؤ: میں سب لوگوں کے رب، سب لوگوں کے بادشاہ اور سب لوگوں کے معبود کی پناہ لیتا ہوں، اس وسوسہ ڈالنے والے کے شر سے جو پیچھے ہٹ جاتا ہے، خواہ جن ہو یا آدمی۔",
    hi: "कहो: मैं लोगों के रब, बादशाह और माबूद की पनाह माँगता हूँ उस पीछे हटने वाले वसवसा डालने वाले के शर से, चाहे वह जिन्न हो या इंसान।",
    source: "Qur'an 114",
  },
  {
    id: "ayat-karima", period: "Quran remembrance", count: 1,
    arabic: "لَا إِلَهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ",
    en: "There is no deity except You. Glory be to You. Indeed, I have been among the wrongdoers.",
    ur: "تیرے سوا کوئی معبود نہیں، تجھے پاکی ہے، بے شک مجھ سے بے جا ہوا۔",
    hi: "तेरे सिवा कोई माबूद नहीं। तू पाक है। बेशक मैं ही ज़ालिमों में से था।",
    source: "Qur'an 21:87",
  },
  {
    id: "hasbunallah", period: "Quran remembrance", count: 1,
    arabic: "حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ",
    en: "Allah is sufficient for us, and He is the best Disposer of affairs.",
    ur: "ہمیں اللہ کافی ہے اور وہ کیا ہی اچھا کارساز ہے۔",
    hi: "हमारे लिए अल्लाह काफ़ी है और वही सबसे अच्छा कारसाज़ है।",
    source: "Qur'an 3:173",
  },
  {
    id: "rabbana-atina", period: "Quran remembrance", count: 1,
    arabic: "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ",
    en: "Our Lord, grant us good in this world and good in the Hereafter, and protect us from the punishment of the Fire.",
    ur: "اے ہمارے رب! ہمیں دنیا میں بھلائی دے اور آخرت میں بھلائی دے اور ہمیں آگ کے عذاب سے بچا۔",
    hi: "ऐ हमारे रब! हमें दुनिया में भलाई दे, आख़िरत में भलाई दे और हमें आग के अज़ाब से बचा।",
    source: "Qur'an 2:201",
  },
  {
    id: "subhanallahi-wa-bihamdihi", period: "Morning and evening", count: 100,
    arabic: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ",
    en: "Glory and praise be to Allah.",
    ur: "اللہ پاک ہے اور اسی کے لیے حمد ہے۔",
    hi: "अल्लाह पाक है और उसी के लिए सारी तारीफ़ है।",
    source: "Sahih Muslim 2692",
  },
  {
    id: "audhu-bikalimatillah", period: "Morning and evening", count: 3,
    arabic: "أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ",
    en: "I seek refuge in Allah's perfect words from the evil of what He has created.",
    ur: "میں اللہ کے کامل کلمات کے ذریعے اس کی مخلوق کے شر سے پناہ مانگتا ہوں۔",
    hi: "मैं अल्लाह के मुकम्मल कलिमात के ज़रिए उसकी मख़लूक़ के शर से पनाह माँगता हूँ।",
    source: "Sahih Muslim 2708",
  },
  {
    id: "astaghfirullah-after-prayer", period: "After prayer", count: 3,
    arabic: "أَسْتَغْفِرُ اللَّهَ",
    en: "I seek Allah's forgiveness.",
    ur: "میں اللہ سے بخشش مانگتا ہوں۔",
    hi: "मैं अल्लाह से मग़फ़िरत माँगता हूँ।",
    source: "Sahih Muslim 591",
  },
  {
    id: "allahumma-antas-salam", period: "After prayer", count: 1,
    arabic: "اللَّهُمَّ أَنْتَ السَّلَامُ وَمِنْكَ السَّلَامُ، تَبَارَكْتَ يَا ذَا الْجَلَالِ وَالْإِكْرَامِ",
    en: "O Allah, You are Peace and from You comes peace. Blessed are You, Owner of majesty and honour.",
    ur: "اے اللہ! تو ہی سلامتی والا ہے اور سلامتی تجھی سے ہے۔ اے عظمت اور بزرگی والے! تو بڑی برکت والا ہے۔",
    hi: "ऐ अल्लाह! तू ही सलामती वाला है और सलामती तुझी से है। ऐ जलाल और इकराम वाले! तू बहुत बरकत वाला है।",
    source: "Sahih Muslim 591",
  },
  {
    id: "subhanallah", period: "After prayer", count: 33, arabic: "سُبْحَانَ اللّٰهِ",
    en: "Glory be to Allah.", ur: "اللہ پاک ہے۔", hi: "अल्लाह पाक है।", source: "Sahih Muslim 597",
  },
  {
    id: "alhamdulillah", period: "After prayer", count: 33, arabic: "اَلْحَمْدُ لِلّٰهِ",
    en: "All praise is for Allah.", ur: "سب خوبیاں اللہ کے لیے ہیں۔", hi: "सब तारीफ़ें अल्लाह के लिए हैं।", source: "Sahih Muslim 597",
  },
  {
    id: "allahu-akbar", period: "After prayer", count: 34, arabic: "اَللّٰهُ أَكْبَرُ",
    en: "Allah is the Greatest.", ur: "اللہ سب سے بڑا ہے۔", hi: "अल्लाह सबसे बड़ा है।", source: "Sahih Muslim 597",
  },
] as const;

const CATEGORIES = ["All", "Morning and evening", "After prayer", "Quran remembrance"] as const;

export default function DailyAzkar({ language }: { language: string }) {
  const { userIdentifier } = useAuth();
  const profileKey = getStorageKeyForUser(userIdentifier);
  const favoritesKey = `${profileKey}.azkarFavorites`;
  const countsKey = `${profileKey}.azkarCounts`;
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All");
  const [activeIndex, setActiveIndex] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem(countsKey) || "{}"); } catch { return {}; }
  });
  const [favorites, setFavorites] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(favoritesKey) || "[]"); } catch { return []; }
  });
  const items = useMemo(() => {
    const filtered = category === "All" ? [...AZKAR] : AZKAR.filter(item =>
      item.period === category || ("categories" in item && item.categories.some(value => value === category))
    );
    return filtered.sort((a, b) => Number(favorites.includes(b.id)) - Number(favorites.includes(a.id)));
  }, [category, favorites]);
  const active = items[Math.min(activeIndex, items.length - 1)];
  const value = counts[active.id] ?? 0;
  const complete = value >= active.count;
  const translation = language === "ur" ? active.ur : language === "hi" ? active.hi : active.en;

  const updateCount = (nextValue: number) => {
    const next = { ...counts, [active.id]: Math.max(0, Math.min(active.count, nextValue)) };
    setCounts(next);
    localStorage.setItem(countsKey, JSON.stringify(next));
  };
  const toggleFavorite = () => {
    const next = favorites.includes(active.id) ? favorites.filter(id => id !== active.id) : [...favorites, active.id];
    setFavorites(next);
    localStorage.setItem(favoritesKey, JSON.stringify(next));
  };

  const move = (offset: number) => setActiveIndex(index => (index + offset + items.length) % items.length);

  return <section className="faith-panel azkar-experience">
    <div className="faith-intro"><span className="faith-icon"><BookHeart /></span>
      <div><h2>Daily Duas &amp; Azkar</h2></div>
    </div>
    <nav className="azkar-categories" aria-label="Azkar categories">
      {CATEGORIES.map(item => <button key={item} type="button" className={category === item ? "is-active" : ""}
        onClick={() => { setCategory(item); setActiveIndex(0); }}>{item}</button>)}
    </nav>
    <div className="azkar-focus-card">
      <header>
        <div><span>{category === "All" ? active.period : category}</span>
          <small>{activeIndex + 1} of {items.length} · {active.source}</small></div>
        <button type="button" className="azkar-favorite" aria-label="Save this remembrance"
          aria-pressed={favorites.includes(active.id)} onClick={toggleFavorite}>
          <Heart size={21} fill={favorites.includes(active.id) ? "currentColor" : "none"} />
        </button>
      </header>
      <div className="azkar-reading">
        <p className="azkar-arabic" lang="ar" dir="rtl">{active.arabic}</p>
        <div className="azkar-divider" />
        <p className="azkar-translation">{translation}</p>
      </div>
      <div className="azkar-progress-row">
        <button type="button" className="azkar-nav-button" aria-label="Previous remembrance" onClick={() => move(-1)}>
          <ChevronLeft /><span>Previous</span>
        </button>
        <button type="button" className={`azkar-main-counter${complete ? " is-complete" : ""}`}
          onClick={() => { updateCount(value + 1); navigator.vibrate?.(25); }}>
          <span className="azkar-counter-value" data-no-translate data-preserve-font>
            {complete ? <Check /> : value}
          </span>
          <span className="azkar-counter-copy">
            <strong>{complete ? "Completed" : "Tap to count"}</strong>
            <small><b data-no-translate data-preserve-font>{value}</b> <span>of</span>{" "}
              <b data-no-translate data-preserve-font>{active.count}</b></small>
          </span>
        </button>
        <button type="button" className="azkar-nav-button" aria-label="Next remembrance" onClick={() => move(1)}>
          <span>Next</span><ChevronRight />
        </button>
      </div>
      <footer>
        <button type="button" onClick={() => updateCount(0)}><RotateCcw size={17} /> Reset</button>
      </footer>
    </div>
    <div className="azkar-steps" aria-label="Azkar progress">
      <div><span style={{ width: `${(activeIndex + 1) / items.length * 100}%` }} /></div>
      <small><b data-no-translate data-preserve-font>{activeIndex + 1}</b> <span>of</span>{" "}
        <b data-no-translate data-preserve-font>{items.length}</b></small>
    </div>
  </section>;
}
