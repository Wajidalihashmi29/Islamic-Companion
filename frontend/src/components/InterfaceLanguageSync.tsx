import { useEffect, useLayoutEffect, useState } from "react";
import { loadSettings } from "../utils/settingsStorage";
import {
  normalizeInterfaceLanguage,
  translateInterfaceText,
  type InterfaceLanguage,
} from "../i18n/interfaceTranslations";

const TRANSLATED_ATTRIBUTES = ["aria-label", "placeholder", "title"] as const;

function shouldSkip(node: Node): boolean {
  const parent = node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement;
  if (!parent || parent.closest("script, style, code, [data-no-translate]")) return true;
  if (parent.closest("[data-interface-language]")) return false;
  return parent.closest("[lang]")?.getAttribute("lang") === "ar";
}

function translateTextNode(node: Text, language: InterfaceLanguage) {
  if (shouldSkip(node)) return;
  const current = node.nodeValue ?? "";
  const trimmed = current.trim();
  if (!trimmed) return;
  const translated = translateInterfaceText(trimmed, language);
  if (translated === trimmed) return;
  const start = current.slice(0, current.indexOf(trimmed));
  const end = current.slice(current.indexOf(trimmed) + trimmed.length);
  node.nodeValue = `${start}${translated}${end}`;
}

function translateElement(element: Element, language: InterfaceLanguage) {
  if (element.hasAttribute("data-interface-language")) {
    element.setAttribute("lang", language);
    element.setAttribute("dir", language === "ur" ? "rtl" : "ltr");
  }
  if (shouldSkip(element)) return;
  for (const attribute of TRANSLATED_ATTRIBUTES) {
    const current = element.getAttribute(attribute);
    if (!current) continue;
    const translated = translateInterfaceText(current, language);
    if (translated !== current) element.setAttribute(attribute, translated);
  }
}

function translateTree(root: Node, language: InterfaceLanguage) {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text, language);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
  if (root.nodeType === Node.ELEMENT_NODE) translateElement(root as Element, language);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    if (current.nodeType === Node.TEXT_NODE) translateTextNode(current as Text, language);
    else translateElement(current as Element, language);
    current = walker.nextNode();
  }
}

export default function InterfaceLanguageSync() {
  const [language, setLanguage] = useState<InterfaceLanguage>(() =>
    normalizeInterfaceLanguage(loadSettings().general.appLanguage)
  );

  useEffect(() => {
    const updateLanguage = (event?: Event) => {
      const settings = (event as CustomEvent<{ settings?: { general?: { appLanguage?: string } } }>)?.detail?.settings;
      setLanguage(normalizeInterfaceLanguage(settings?.general?.appLanguage ?? loadSettings().general.appLanguage));
    };
    window.addEventListener("ic:settingsUpdated", updateLanguage);
    window.addEventListener("storage", updateLanguage);
    return () => {
      window.removeEventListener("ic:settingsUpdated", updateLanguage);
      window.removeEventListener("storage", updateLanguage);
    };
  }, []);

  useLayoutEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ur" ? "rtl" : "ltr";
    translateTree(document.body, language);

    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") translateTextNode(mutation.target as Text, language);
        else if (mutation.type === "attributes") translateElement(mutation.target as Element, language);
        else mutation.addedNodes.forEach(node => translateTree(node, language));
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...TRANSLATED_ATTRIBUTES],
    });
    return () => observer.disconnect();
  }, [language]);

  return null;
}
