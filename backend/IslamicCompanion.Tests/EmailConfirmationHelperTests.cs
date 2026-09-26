using IslamicCompanion.Application.Services;

namespace IslamicCompanion.Tests;

public class EmailConfirmationHelperTests
{
    [Fact]
    public void BuildConfirmationLink_EncodesUserIdAndToken()
    {
        var link = EmailConfirmationHelper.BuildConfirmationLink(
            "http://localhost:5173/",
            "user/1",
            "abc+def");

        Assert.Equal(
            "http://localhost:5173/verify-email?userId=user%2F1&token=abc%2Bdef",
            link);
    }

    [Fact]
    public void BuildConfirmationEmail_IncludesNameAndLink()
    {
        var html = EmailConfirmationHelper.BuildConfirmationEmail(
            "Amina",
            "http://localhost:5173/verify-email?userId=1&token=xyz");

        Assert.Contains("Peace be upon you, Amina", html);
        Assert.Contains("http://localhost:5173/verify-email?userId=1&token=xyz", html);
        Assert.Contains("Verify email", html);
    }
}
