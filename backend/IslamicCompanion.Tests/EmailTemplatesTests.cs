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
        Assert.Contains("Islamic Companion", html);
    }

    [Fact]
    public void BuildPasswordResetLink_ConstructsCorrectUrl()
    {
        var frontendUrl = "http://localhost:5173/";
        var userId = "user-456";
        var token = "reset+token=";

        var result = EmailTemplates.BuildPasswordResetLink(frontendUrl, userId, token);

        Assert.Equal("http://localhost:5173/reset-password?userId=user-456&token=reset%2Btoken%3D", result);
    }

    [Fact]
    public void BuildPasswordResetEmail_EncodesUserFullName()
    {
        var fullName = "<script>bad</script>";
        var url = "http://localhost:5173/reset-password?userId=1&token=2";

        var html = EmailTemplates.BuildPasswordResetEmail(fullName, url);

        Assert.Contains("&lt;script&gt;bad&lt;/script&gt;", html);
        Assert.DoesNotContain("<script>", html);
        Assert.Contains(System.Net.WebUtility.HtmlEncode(url), html);
        Assert.Contains("Reset My Password", html);
    }

    [Fact]
    public void BuildPasswordResetOtpEmail_EncodesUserFullNameAndDisplaysOtp()
    {
        var fullName = "<script>user</script>";
        var otp = "482915";

        var html = EmailTemplates.BuildPasswordResetOtpEmail(fullName, otp);

        Assert.Contains("&lt;script&gt;user&lt;/script&gt;", html);
        Assert.DoesNotContain("<script>", html);
        Assert.Contains("482915", html);
        Assert.Contains("Your 6-Digit Reset Code", html);
    }
}
