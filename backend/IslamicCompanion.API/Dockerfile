# ---- Build stage ----
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy solution and csproj files first (better Docker layer caching)
COPY IslamicCompanion.slnx .
COPY IslamicCompanion.Domain/*.csproj IslamicCompanion.Domain/
COPY IslamicCompanion.Application/*.csproj IslamicCompanion.Application/
COPY IslamicCompanion.Infrastructure/*.csproj IslamicCompanion.Infrastructure/
COPY IslamicCompanion.API/*.csproj IslamicCompanion.API/
COPY IslamicCompanion.Tests/*.csproj IslamicCompanion.Tests/

RUN dotnet restore IslamicCompanion.slnx

# Copy everything else and publish
COPY . .
WORKDIR /src/IslamicCompanion.API
RUN dotnet publish -c Release -o /app/publish

# ---- Runtime stage ----
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "IslamicCompanion.API.dll"]