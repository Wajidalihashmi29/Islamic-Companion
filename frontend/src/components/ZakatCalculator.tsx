import { useCallback, useEffect, useState } from "react";
import { RefreshCw, WalletCards } from "lucide-react";
import { getMetalPrices } from "../api/metalPricesApi";
import { calculateZakat, getHanafiNisabBasis } from "../utils/faithFeatures";
import { getFriendlyErrorMessage } from "../utils/friendlyError";
import { formatCurrency, getPreferredCurrency } from "../utils/regionalFormatting";
import CustomDropdown from "./CustomDropdown";

function NumberField({ label, hint, value, onChange }: {
  label: string;
  hint?: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return <label className="faith-field"><span>{label}</span><input type="number" min="0" step="0.01" inputMode="decimal"
    value={value || ""} placeholder="0.00" onChange={event => onChange(Math.max(0, Number(event.target.value) || 0))} />
    {hint && <small>{hint}</small>}
  </label>;
}

export default function ZakatCalculator() {
  const [currency, setCurrency] = useState(getPreferredCurrency);
  const [lunarYearComplete, setLunarYearComplete] = useState(false);
  const [priceStatus, setPriceStatus] = useState({ loading: true, error: "", updatedAt: "", source: "" });
  const [values, setValues] = useState({
    cash: 0, gold: 0, silver: 0, investments: 0, business: 0, receivables: 0, debts: 0,
    goldGram: 0, silverGram: 0,
  });
  const otherAssets = values.cash + values.investments + values.business + values.receivables;
  const assets = otherAssets + values.gold + values.silver;
  const nisabBasis = getHanafiNisabBasis(values.gold, values.silver, otherAssets);
  const nisab = nisabBasis === "gold" ? values.goldGram * 87.48 : values.silverGram * 612.36;
  const result = calculateZakat(assets, values.debts, nisab, lunarYearComplete);
  const update = (key: keyof typeof values, value: number | string) => setValues(previous => ({ ...previous, [key]: value }));
  const loadPrices = useCallback(async (signal?: AbortSignal) => {
    setPriceStatus(previous => ({ ...previous, loading: true, error: "" }));
    try {
      const prices = await getMetalPrices(currency, signal);
      setValues(previous => ({
        ...previous,
        goldGram: prices.goldPerGram,
        silverGram: prices.silverPerGram,
      }));
      setPriceStatus({
        loading: false,
        error: "",
        updatedAt: prices.updatedAt,
        source: prices.source,
      });
    } catch (requestError) {
      if (signal?.aborted) return;
      setPriceStatus(previous => ({
        ...previous,
        loading: false,
        error: getFriendlyErrorMessage(
          requestError,
          "Live metal prices are unavailable. Enter prices manually or try again shortly.",
        ),
      }));
    }
  }, [currency]);

  useEffect(() => {
    const controller = new AbortController();
    void loadPrices(controller.signal);
    return () => controller.abort();
  }, [loadPrices]);

  useEffect(() => {
    const updateCurrency = () => setCurrency(getPreferredCurrency());
    window.addEventListener("ic:regionUpdated", updateCurrency);
    return () => window.removeEventListener("ic:regionUpdated", updateCurrency);
  }, []);

  return <section className="faith-panel">
    <div className="faith-intro"><span className="faith-icon"><WalletCards /></span>
      <div><h2>Zakat Calculator</h2></div>
    </div>
    <div className="metal-price-panel">
      <div className="faith-field"><span>Currency</span><CustomDropdown value={currency}
        options={["USD", "GBP", "EUR", "INR", "PKR", "BDT", "AED", "SAR", "CAD", "AUD"]
          .map(code => ({ id: code, name: code }))}
        onChange={setCurrency} /></div>
      <div className="metal-price-values">
        <span><small>Gold price per gram</small><strong>{formatCurrency(values.goldGram, currency)}</strong></span>
        <span><small>Silver price per gram</small><strong>{formatCurrency(values.silverGram, currency)}</strong></span>
      </div>
      <button className="faith-secondary metal-refresh" type="button" disabled={priceStatus.loading}
        onClick={() => void loadPrices()}>
        <RefreshCw size={16} className={priceStatus.loading ? "is-spinning" : ""} />
        {priceStatus.loading ? "Fetching live prices..." : "Refresh prices"}
      </button>
      {priceStatus.error && <p className="faith-error" role="alert">{priceStatus.error}</p>}
      {!priceStatus.error && priceStatus.updatedAt && <p className="metal-price-updated">
        Updated {new Date(priceStatus.updatedAt).toLocaleString()} · {priceStatus.source}
      </p>}
    </div>
    <div className="faith-form-grid">
      <NumberField label="Cash and bank balances" hint="Include cash at home, current accounts and savings available to you."
        value={values.cash} onChange={value => update("cash", value)} />
      <NumberField label="Gold value, including jewellery" hint="In Hanafi fiqh, personal-use gold is included. Enter its current gold value."
        value={values.gold} onChange={value => update("gold", value)} />
      <NumberField label="Silver value, including jewellery" hint="In Hanafi fiqh, personal-use silver is included. Enter its current silver value."
        value={values.silver} onChange={value => update("silver", value)} />
      <NumberField label="Zakatable investments and accessible funds" hint="Include only the zakatable or withdrawable value; exclude your home and ordinary personal possessions."
        value={values.investments} onChange={value => update("investments", value)} />
      <NumberField label="Trade inventory at current market value" hint="Include goods bought for resale, not equipment, buildings or other fixed business assets."
        value={values.business} onChange={value => update("business", value)} />
      <NumberField label="Recoverable money owed to you" hint="Include loans and receivables you reasonably expect to collect."
        value={values.receivables} onChange={value => update("receivables", value)} />
      <NumberField label="Deductible debts and bills due" hint="Enter amounts currently due or payable before your next Zakat date; do not deduct an entire long-term loan."
        value={values.debts} onChange={value => update("debts", value)} />
    </div>
    <div className="faith-nisab">
      <div className="faith-field zakat-auto-nisab">
        <span>Nisab standard (automatic)</span>
        <strong>{nisabBasis === "gold" ? "Gold nisab — 87.48 g" : "Silver nisab — 612.36 g"}</strong>
        <small>{nisabBasis === "gold"
          ? "Gold nisab is used because gold is your only zakatable asset."
          : "Silver nisab is used for silver, cash, investments, trade goods, receivables, or mixed zakatable wealth."}</small>
      </div>
      <NumberField label={`${nisabBasis === "gold" ? "Gold" : "Silver"} price per gram`}
        value={nisabBasis === "gold" ? values.goldGram : values.silverGram}
        onChange={value => update(nisabBasis === "gold" ? "goldGram" : "silverGram", value)} />
    </div>
    <label className="zakat-hawl">
      <input type="checkbox" checked={lunarYearComplete}
        onChange={event => setLunarYearComplete(event.target.checked)} />
      <span><strong>My lunar Zakat year is complete</strong>
        <small>I first reached nisab at least one Hijri year ago and still possess nisab on my Zakat date.</small>
      </span>
    </label>
    <div className={`zakat-result ${result.eligible ? "is-due" : ""}`}>
      <span>Net zakatable assets<strong>{formatCurrency(result.netAssets, currency)}</strong></span>
      <span>Nisab threshold<strong>{nisab ? formatCurrency(nisab, currency) : "Enter metal price"}</strong></span>
      <span>Zakat due<strong>{formatCurrency(result.due, currency)}</strong></span>
    </div>
    <p className={`zakat-guidance ${result.eligible ? "is-due" : ""}`}>
      {!nisab ? "Enter a current metal price to calculate nisab."
        : !result.nisabReached ? "Your net zakatable wealth is below the automatically selected nisab, so Zakat is not obligatory from this calculation."
          : !lunarYearComplete ? "You have reached nisab. Zakat becomes due on your Zakat anniversary after one lunar year."
            : "Zakat is due at 2.5% of all net zakatable wealth shown above."}
    </p>
    <p className="faith-note zakat-sources">
      Based on Hanafi guidance from <a href="https://www.dawateislami.co.uk/zakat-calculator/" target="_blank" rel="noreferrer">Dawat-e-Islami</a>.
      For a definitive ruling about your circumstances, seek guidance from a renowned Sunni Mufti.
    </p>
  </section>;
}
