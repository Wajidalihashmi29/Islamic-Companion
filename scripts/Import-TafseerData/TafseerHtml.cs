using System.Text;
using System.Text.RegularExpressions;
using HtmlAgilityPack;

internal static class TafseerHtml
{
    public static string ReadText(string html, string sourceUrl)
    {
        var document = new HtmlDocument();
        document.LoadHtml(html);
        var canonical = document.DocumentNode.SelectSingleNode("//link[@rel='canonical']")?.GetAttributeValue("href", "");
        if (!string.Equals(canonical?.TrimEnd('/'), sourceUrl.TrimEnd('/'), StringComparison.Ordinal))
            throw new InvalidOperationException("The Tafseer provider returned a different Ayah.");
        var area = document.DocumentNode.SelectSingleNode(
            "//div[contains(concat(' ', normalize-space(@class), ' '), ' tasfirAreaDiv ')]");
        var heading = area?.SelectSingleNode("./p");
        var title = Regex.Replace(HtmlEntity.DeEntitize(heading?.InnerText ?? ""), @"[\s\p{M}\u200E\u200F]", "");
        if (!title.Contains("صراطالجنان", StringComparison.Ordinal))
            throw new InvalidOperationException("The provider did not identify this Tafseer as Sirat-ul-Jinan.");
        var content = area?.SelectSingleNode(
            "./div[contains(concat(' ', normalize-space(@class), ' '), ' tafseer-font-size ')]")
            ?? throw new InvalidOperationException("Sirat-ul-Jinan text was not found for this Ayah.");
        var text = new StringBuilder();
        AppendText(content, text);
        var result = Regex.Replace(text.ToString(), @"[^\S\n]*\n[^\S\n]*", "\n");
        result = Regex.Replace(result, @"\n{3,}", "\n\n").Trim();
        if (string.IsNullOrWhiteSpace(result))
            throw new InvalidOperationException("The Tafseer provider returned empty text for this Ayah.");
        return result;
    }

    private static void AppendText(HtmlNode node, StringBuilder text)
    {
        if (node.NodeType == HtmlNodeType.Text)
        {
            text.Append(Regex.Replace(HtmlEntity.DeEntitize(((HtmlTextNode)node).Text), @"\s+", " "));
            return;
        }
        if (node.NodeType != HtmlNodeType.Element ||
            node.Name is "script" or "style" or "iframe" or "object" or "noscript" or "form" or "button" or "svg")
            return;
        if (node.Name == "br") { text.Append('\n'); return; }
        var block = node.Name is "p" or "div" or "h1" or "h2" or "h3" or "h4" or "h5" or "h6"
            or "li" or "tr" or "blockquote";
        if (block) text.Append("\n\n");
        foreach (var child in node.ChildNodes) AppendText(child, text);
        if (block) text.Append("\n\n");
    }
}
