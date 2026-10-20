using IslamicCompanion.Domain.Entities;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace IslamicCompanion.Infrastructure.Persistence;

public class AppDbContext : IdentityDbContext<ApplicationUser>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<PrayerLog> PrayerLogs { get; set; }
    public DbSet<Favorite> Favorites { get; set; }
    public DbSet<RefreshToken> RefreshTokens { get; set; }
    public DbSet<PrayerPushSubscription> PrayerPushSubscriptions { get; set; }
    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.Entity<PrayerPushSubscription>(entity =>
        {
            entity.HasIndex(subscription => subscription.Endpoint).IsUnique();
            entity.Property(subscription => subscription.Endpoint).HasMaxLength(2048);
            entity.Property(subscription => subscription.P256dh).HasMaxLength(512);
            entity.Property(subscription => subscription.Auth).HasMaxLength(256);
            entity.Property(subscription => subscription.TimeZoneId).HasMaxLength(128);
            entity.Property(subscription => subscription.PrayerNames).HasMaxLength(64);
            entity.HasOne(subscription => subscription.User)
                .WithMany()
                .HasForeignKey(subscription => subscription.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}