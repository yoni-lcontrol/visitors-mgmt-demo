# Architecture Decisions

## Decision 1: Single Application
We use one ASP.NET Core Web API application with hosted services instead of separate API and worker processes.

Reason:
- simpler deployment
- centralized configuration
- simpler operational support

## Decision 2: .NET 9 / C#
We use C# and .NET 9 for the integration service.

Reason:
- strong fit for ASP.NET Core
- strong hosted service model
- strong SignalR client support
- good fit for Windows Service hosting

## Decision 3: Use Official API Only
We do not write directly to Amadeus databases.

Reason:
- vendor guidance forbids direct DB modification
- API and Push API are the supported integration mechanism

## Decision 4: Periodic Sync + Real-Time Events
We use both real-time push events and periodic synchronization.

Reason:
- real-time events give fast updates
- periodic sync helps recover from missed events or temporary outages
