using IslamicCompanion.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IslamicCompanion.Infrastructure.Migrations
{
    /// <summary>
    /// Data-only migration: email verification is now required to sign in.
    /// Accounts created before this feature existed were never sent a link,
    /// so mark them as verified to avoid locking existing users out.
    /// No schema change — the model snapshot is unchanged.
    /// </summary>
    [DbContext(typeof(AppDbContext))]
    [Migration("20261004000000_ConfirmExistingUsers")]
    public partial class ConfirmExistingUsers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("UPDATE \"AspNetUsers\" SET \"EmailConfirmed\" = TRUE WHERE \"EmailConfirmed\" = FALSE;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Irreversible by design: we can't know which users were confirmed by this migration.
        }
    }
}
