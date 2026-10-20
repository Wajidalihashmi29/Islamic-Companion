import { Fragment } from "react";
import { getQuranTextRuns } from "../utils/quranTypography";

export default function QuranText({ text, script }: { text: string; script: "indopak" | "uthmani" }) {
  return getQuranTextRuns(text, script).map((run, index) => run.fallback
    ? <span key={index} className="quran-indopak-fallback" lang="ar">{run.text}</span>
    : <Fragment key={index}>{run.text}</Fragment>);
}
