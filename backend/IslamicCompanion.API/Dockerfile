# ==========================
# Build Stage
# ==========================
FROM mcr.microsoft.com/dotnet/sdk:10.0-preview AS build

WORKDIR /src

# Copy only project files first
COPY IslamicCompanion.Domain/*.csproj IslamicCompanion.Domain/
COPY IslamicCompanion.Application/*.csproj IslamicCompanion.Application/
COPY IslamicCompanion.Infrastructure/*.csproj IslamicCompanion.Infrastructure/
COPY IslamicCompanion.API/*.csproj IslamicCompanion.API/

# Restore dependencies
RUN dotnet restore "IslamicCompanion.API/IslamicCompanion.API.csproj"

# Copy the remaining source
COPY . .

# Publish
RUN dotnet publish "IslamicCompanion.API/IslamicCompanion.API.csproj" \
    -c Release \
    -o /app/publish \
    --no-restore

# ==========================
# Runtime Stage
# ==========================
FROM mcr.microsoft.com/dotnet/aspnet:10.0-preview

WORKDIR /app

COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:8080

EXPOSE 8080

ENTRYPOINT ["dotnet", "IslamicCompanion.API.dll"]