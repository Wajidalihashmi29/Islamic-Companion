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
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const previousLanguage = normalizeInterfaceLanguage(document.documentElement.lang);
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ur" ? "rtl" : "ltr";

    // React renders English source text, so the normal English path needs no DOM scan.
    if (language === "en" && previousLanguage === "en") return;

    let disposed = false;
    let idleHandle = 0;
    let frameHandle = 0;
    let queueIndex = 0;
    const queue: Node[] = [];
    const queued = new Set<Node>();
    let observer: MutationObserver | null = null;

    const processNode = (node: Node) => {
      queued.delete(node);
      if (node.nodeType === Node.TEXT_NODE) {
        translateTextNode(node as Text, language);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_NODE) return;
      if (node.nodeType === Node.ELEMENT_NODE) translateElement(node as Element, language);
      node.childNodes.forEach(enqueue);
    };

    const runBatch = (deadline?: IdleDeadline) => {
      idleHandle = 0;
      frameHandle = 0;
      let processed = 0;
      while (queueIndex < queue.length && processed < 150 &&
        (!deadline || deadline.timeRemaining() > 1)) {
        processNode(queue[queueIndex++]);
        processed++;
      }
      if (queueIndex >= queue.length) {
        queue.length = 0;
        queueIndex = 0;
      } else if (queueIndex > 500) {
        queue.splice(0, queueIndex);
        queueIndex = 0;
      }
      observer?.takeRecords();
      schedule();
    };

    const schedule = () => {
      if (disposed || queueIndex >= queue.length || idleHandle || frameHandle) return;
      if (idleWindow.requestIdleCallback) {
        idleHandle = idleWindow.requestIdleCallback(runBatch, { timeout: 100 });
      } else {
        frameHandle = window.requestAnimationFrame(() => runBatch());
      }
    };

    function enqueue(node: Node) {
      if (disposed || queued.has(node)) return;
      queued.add(node);
      queue.push(node);
      schedule();
    }

    if (language !== "en") {
      observer = new MutationObserver(mutations => {
        for (const mutation of mutations) {
          if (mutation.type === "characterData" || mutation.type === "attributes") enqueue(mutation.target);
          else mutation.addedNodes.forEach(enqueue);
        }
      });
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: [...TRANSLATED_ATTRIBUTES],
      });
    }
    enqueue(document.body);
    return () => {
      disposed = true;
      observer?.disconnect();
      if (idleHandle) idleWindow.cancelIdleCallback?.(idleHandle);
      if (frameHandle) window.cancelAnimationFrame(frameHandle);
    };
  }, [language]);

  return null;
}
