using IslamicCompanion.Application.DTOs;

namespace IslamicCompanion.Application.Interfaces;

public interface IHadithService
{
    IReadOnlyList<HadithBook> GetBooks();
    Task<HadithSearchResult> BrowseAsync(
        int bookId,
        int page,
        CancellationToken cancellationToken);
    Task<HadithSearchResult> SearchAsync(
        string query,
        string scope,
        int? bookId,
        int page,
        CancellationToken cancellationToken);
}
