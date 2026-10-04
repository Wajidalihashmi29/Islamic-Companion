using IslamicCompanion.Application.Services;
using Xunit;

namespace IslamicCompanion.Tests;

public class EmailTemplatesTests
{
    [Fact]
    public void BuildConfirmationLink_ConstructsCorrectUrl()
    {
        var frontendUrl = "http://localhost:5173/";
        var userId = "user-123";
        var token = "token+abc=";

        var result = EmailTemplates.BuildConfirmationLink(frontendUrl, userId, token);

        Assert.Equal("http://localhost:5173/verify-email?userId=user-123&token=token%2Babc%3D", result);
    }

    [Fact]
    public void BuildConfirmationEmail_EncodesUserFullName()
    {
        var fullName = "<script>alert(1)</script>";
        var url = "http://localhost:5173/verify-email?userId=1&token=2";

        var html = EmailTemplates.BuildConfirmationEmail(fullName, url);

        Assert.Contains("&lt;script&gt;alert(1)&lt;/script&gt;", html);
        Assert.DoesNotContain("<script>", html);
        Assert.Contains(System.Net.WebUtility.HtmlEncode(url), html);
        Assert.Contains("width=\"44\" height=\"44\"", html);
    }
}
