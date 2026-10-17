using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IslamicCompanion.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUserSettingsJson : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "UserSettingsJson",
                table: "AspNetUsers",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "UserSettingsJson",
                table: "AspNetUsers");
        }
    }
}
