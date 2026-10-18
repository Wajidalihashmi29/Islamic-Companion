using IslamicCompanion.Application.DTOs;

namespace IslamicCompanion.Application.Interfaces;

public interface IQuranService
{
    Task<QuranDirectory> GetDirectoryAsync(CancellationToken cancellationToken);
    Task<QuranPage> GetPageAsync(int page, string translation, int lines, CancellationToken cancellationToken);
    Task<int> GetVersePageAsync(int surah, int ayah, CancellationToken cancellationToken);
    Task<QuranAudio> GetAudioAsync(int surah, int ayah, string reciter, CancellationToken cancellationToken);
    Task<QuranTafseer> GetTafseerAsync(int surah, int ayah, string tafseer, CancellationToken cancellationToken);
}
