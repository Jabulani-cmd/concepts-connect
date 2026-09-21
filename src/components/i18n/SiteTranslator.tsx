import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getPhraseDictionary } from "@/lib/i18n/autoDictionary";

const ATTRS = ["placeholder", "title", "aria-label", "alt"];
const ORIG = "__i18nOrig";

/**
 * Translates visible English copy that is not yet wired to translation keys
 * into the selected language (Shona / Ndebele). Original text is kept on each
 * node so switching back to English restores it without a reload.
 */
export default function SiteTranslator() {
  const { i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage || i18n.language || "en").slice(0, 2);

  useEffect(() => {
    const root = document.body;
    const entries = getPhraseDictionary(lang);
    const active = entries.length > 0;

    const translateText = (src: string): string => {
      let out = src;
      for (const [source, target] of entries) {
        if (!out.includes(source)) continue;
        out = out.split(source).join(target);
      }
      return out;
    };

    const shouldSkip = (node: Node): boolean => {
      let el: Node | null = node;
      while (el) {
        if (el.nodeType === 1) {
          const e = el as HTMLElement;
          const tag = e.tagName;
          if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "CODE" || tag === "PRE") return true;
          if (e.getAttribute && e.getAttribute("data-no-translate") === "true") return true;
        }
        el = (el as Node).parentNode;
      }
      return false;
    };

    const processTextNode = (node: Text, on: boolean) => {
      if (shouldSkip(node)) return;
      const anyNode = node as unknown as Record<string, unknown>;
      if (on) {
        const original = (anyNode[ORIG] as string) ?? node.nodeValue ?? "";
        const translated = translateText(original);
        if (translated !== node.nodeValue) {
          if (anyNode[ORIG] == null) anyNode[ORIG] = original;
          node.nodeValue = translated;
        }
      } else if (anyNode[ORIG] != null) {
        node.nodeValue = anyNode[ORIG] as string;
        delete anyNode[ORIG];
      }
    };

    const walk = (target: Node, on: boolean) => {
      const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
      const nodes: Text[] = [];
      let n = walker.nextNode();
      while (n) {
        nodes.push(n as Text);
        n = walker.nextNode();
      }
      for (const t of nodes) processTextNode(t, on);
    };

    const processAttrs = (el: Element, on: boolean) => {
      if (shouldSkip(el)) return;
      for (const attr of ATTRS) {
        const key = `${ORIG}_${attr}`;
        const anyEl = el as unknown as Record<string, unknown>;
        const cur = el.getAttribute(attr);
        if (on) {
          if (cur == null) continue;
          const original = (anyEl[key] as string) ?? cur;
          const translated = translateText(original);
          if (translated !== cur) {
            if (anyEl[key] == null) anyEl[key] = original;
            el.setAttribute(attr, translated);
          }
        } else if (anyEl[key] != null) {
          el.setAttribute(attr, anyEl[key] as string);
          delete anyEl[key];
        }
      }
    };

    const walkAttrs = (target: Element, on: boolean) => {
      processAttrs(target, on);
      const all = target.querySelectorAll("*");
      for (let i = 0; i < all.length; i++) processAttrs(all[i], on);
    };

    walk(root, active);
    walkAttrs(root, active);

    if (!active) return;

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "characterData" && m.target.nodeType === 3) {
          processTextNode(m.target as Text, true);
        } else if (m.type === "childList") {
          m.addedNodes.forEach((n) => {
            if (n.nodeType === 3) processTextNode(n as Text, true);
            else if (n.nodeType === 1) {
              walk(n, true);
              walkAttrs(n as Element, true);
            }
          });
        } else if (m.type === "attributes" && m.target.nodeType === 1) {
          processAttrs(m.target as Element, true);
        }
      }
    });

    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRS,
    });

    return () => observer.disconnect();
  }, [lang]);

  return null;
}
