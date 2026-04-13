# Deployment - Windows Service

## Goal
Run the application continuously on Windows Server and restart it automatically on failure.

## Publish
Example:
```bash
dotnet publish -c Release -o C:\Services\AmadeusIntegration
```

## Hosting Model
- ASP.NET Core Web API executable
- Windows Service hosting enabled in the app host

## Service Creation
Document the final production commands and service account here.

Typical considerations:
- service name
- executable path
- recovery options
- log path
- environment variables
- service account permissions

## Recovery
Configure the Windows Service to restart automatically on failure.
