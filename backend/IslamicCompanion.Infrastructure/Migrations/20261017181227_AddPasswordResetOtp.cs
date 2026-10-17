using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IslamicCompanion.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPasswordResetOtp : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "PasswordResetOtpExpiresAt",
                table: "AspNetUsers",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PasswordResetOtpHash",
                table: "AspNetUsers",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PasswordResetOtpExpiresAt",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "PasswordResetOtpHash",
                table: "AspNetUsers");
        }
    }
}
