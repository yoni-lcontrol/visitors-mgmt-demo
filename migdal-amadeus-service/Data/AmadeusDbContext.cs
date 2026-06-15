using Amadeus8.Entities;
using Microsoft.EntityFrameworkCore;

namespace Amadeus8.Data;

public class AmadeusDbContext : DbContext
{
    public AmadeusDbContext(DbContextOptions<AmadeusDbContext> options) : base(options)
    {
    }

    public DbSet<ControllerEntity> Controllers => Set<ControllerEntity>();
    public DbSet<DoorEntity> Doors => Set<DoorEntity>();
    public DbSet<DoorIoEntity> DoorIos => Set<DoorIoEntity>();
    public DbSet<ExtensionEntity> Extensions => Set<ExtensionEntity>();
    public DbSet<ExtensionIoEntity> ExtensionIos => Set<ExtensionIoEntity>();
    public DbSet<EventLogEntity> EventLogs => Set<EventLogEntity>();
    public DbSet<SecurityGroupEntity> SecurityGroups => Set<SecurityGroupEntity>();
    public DbSet<AccessGroupEntity> AccessGroups => Set<AccessGroupEntity>();
    public DbSet<AccessLevelEntity> AccessLevels => Set<AccessLevelEntity>();
    public DbSet<CardholderEntity> Cardholders => Set<CardholderEntity>();
    public DbSet<CardEntity> Cards => Set<CardEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        ConfigureController(modelBuilder);
        ConfigureDoor(modelBuilder);
        ConfigureDoorIo(modelBuilder);
        ConfigureExtension(modelBuilder);
        ConfigureExtensionIo(modelBuilder);
        ConfigureEventLog(modelBuilder);
        ConfigureSecurityGroup(modelBuilder);
        ConfigureAccessGroup(modelBuilder);
        ConfigureAccessLevel(modelBuilder);
        ConfigureCardholder(modelBuilder);
        ConfigureCard(modelBuilder);
    }

    private static void ConfigureController(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ControllerEntity>(entity =>
        {
            entity.ToTable("Controllers");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.ExternalId).HasMaxLength(256).IsRequired();
            entity.Property(e => e.ExternalApiKey).HasMaxLength(256);
            entity.Property(e => e.Name).HasMaxLength(512).IsRequired();
            entity.Property(e => e.SiteExternalId).HasMaxLength(256);
            entity.Property(e => e.LastCommunicationStatus).HasMaxLength(128);

            entity.HasIndex(e => e.ExternalId).IsUnique();
            entity.HasIndex(e => e.ExternalApiKey);
        });
    }

    private static void ConfigureDoor(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<DoorEntity>(entity =>
        {
            entity.ToTable("Doors");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.ExternalId).HasMaxLength(256).IsRequired();
            entity.Property(e => e.Name).HasMaxLength(512).IsRequired();
            entity.Property(e => e.ReaderExternalId).HasMaxLength(256);
            entity.Property(e => e.PrimaryOutputExternalId).HasMaxLength(256);
            entity.Property(e => e.DoorContactInputExternalId).HasMaxLength(256);

            entity.HasIndex(e => e.ExternalId).IsUnique();
            entity.HasIndex(e => e.ControllerId);

            entity.HasOne(e => e.Controller)
                .WithMany(c => c.Doors)
                .HasForeignKey(e => e.ControllerId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }

    private static void ConfigureDoorIo(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<DoorIoEntity>(entity =>
        {
            entity.ToTable("DoorIos");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.ExternalId).HasMaxLength(256).IsRequired();
            entity.Property(e => e.IoType).HasMaxLength(128).IsRequired();
            entity.Property(e => e.Direction).HasMaxLength(64).IsRequired();
            entity.Property(e => e.Name).HasMaxLength(512).IsRequired();

            entity.HasIndex(e => e.ExternalId).IsUnique();
            entity.HasIndex(e => e.DoorId);
            entity.HasIndex(e => e.ControllerId);

            entity.HasOne(e => e.Door)
                .WithMany(d => d.DoorIos)
                .HasForeignKey(e => e.DoorId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Controller)
                .WithMany()
                .HasForeignKey(e => e.ControllerId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }

    private static void ConfigureExtension(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ExtensionEntity>(entity =>
        {
            entity.ToTable("Extensions");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.ExternalId).HasMaxLength(256).IsRequired();
            entity.Property(e => e.Name).HasMaxLength(512).IsRequired();
            entity.Property(e => e.ModuleType).HasMaxLength(256);

            entity.HasIndex(e => e.ExternalId).IsUnique();
            entity.HasIndex(e => e.ControllerId);

            entity.HasOne(e => e.Controller)
                .WithMany(c => c.Extensions)
                .HasForeignKey(e => e.ControllerId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }

    private static void ConfigureExtensionIo(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ExtensionIoEntity>(entity =>
        {
            entity.ToTable("ExtensionIos");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.ExternalId).HasMaxLength(256).IsRequired();
            entity.Property(e => e.IoType).HasMaxLength(128).IsRequired();
            entity.Property(e => e.Direction).HasMaxLength(64).IsRequired();
            entity.Property(e => e.Name).HasMaxLength(512).IsRequired();

            entity.HasIndex(e => e.ExternalId).IsUnique();
            entity.HasIndex(e => e.ExtensionId);
            entity.HasIndex(e => e.ControllerId);

            entity.HasOne(e => e.Extension)
                .WithMany(ext => ext.ExtensionIos)
                .HasForeignKey(e => e.ExtensionId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Controller)
                .WithMany()
                .HasForeignKey(e => e.ControllerId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }

    private static void ConfigureEventLog(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<EventLogEntity>(entity =>
        {
            entity.ToTable("EventLogs");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.SourceSystem).HasMaxLength(128).IsRequired();
            entity.Property(e => e.ExternalEventId).HasMaxLength(512);
            entity.Property(e => e.EventType).HasMaxLength(256).IsRequired();
            entity.Property(e => e.EventCategory).HasMaxLength(256);
            entity.Property(e => e.ControllerExternalId).HasMaxLength(256);
            entity.Property(e => e.ObjectExternalId).HasMaxLength(256);
            entity.Property(e => e.ProcessingStatus).HasMaxLength(64).IsRequired();
            entity.Property(e => e.ProcessingError).HasMaxLength(2048);

            entity.HasIndex(e => e.SourceEventUtc);
            entity.HasIndex(e => e.ReceivedUtc);
            entity.HasIndex(e => e.EventType);
            entity.HasIndex(e => e.ControllerExternalId);
            entity.HasIndex(e => e.ExternalEventId);
        });
    }

    private static void ConfigureSecurityGroup(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<SecurityGroupEntity>(entity =>
        {
            entity.ToTable("SecurityGroups");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.AmadeusUid).HasMaxLength(256).IsRequired();
            entity.Property(e => e.ApiKey).HasMaxLength(256);
            entity.Property(e => e.Name).HasMaxLength(512).IsRequired();
            entity.Property(e => e.Description).HasMaxLength(1024);

            entity.HasIndex(e => e.AmadeusUid).IsUnique();
            entity.HasIndex(e => e.ApiKey);
        });
    }

    private static void ConfigureAccessGroup(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AccessGroupEntity>(entity =>
        {
            entity.ToTable("AccessGroups");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.AmadeusUid).HasMaxLength(256).IsRequired();
            entity.Property(e => e.ApiKey).HasMaxLength(256);
            entity.Property(e => e.Name).HasMaxLength(512).IsRequired();
            entity.Property(e => e.Description).HasMaxLength(1024);

            entity.HasIndex(e => e.AmadeusUid).IsUnique();
            entity.HasIndex(e => e.ApiKey);
        });
    }

    private static void ConfigureAccessLevel(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AccessLevelEntity>(entity =>
        {
            entity.ToTable("AccessLevels");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.AmadeusUid).HasMaxLength(256).IsRequired();
            entity.Property(e => e.SourceType).HasMaxLength(64).IsRequired();
            entity.Property(e => e.ApiKey).HasMaxLength(256);
            entity.Property(e => e.Name).HasMaxLength(512).IsRequired();
            entity.Property(e => e.Description).HasMaxLength(1024);
            entity.Property(e => e.ExternalId).HasMaxLength(256);

            entity.HasIndex(e => new { e.SourceType, e.AmadeusUid }).IsUnique();
            entity.HasIndex(e => e.ApiKey);
            entity.HasIndex(e => e.IsActive);
        });
    }

    private static void ConfigureCardholder(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<CardholderEntity>(entity =>
        {
            entity.ToTable("Cardholders");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.AmadeusUid).HasMaxLength(256).IsRequired();
            entity.Property(e => e.CardholderIdNumber).HasMaxLength(256);
            entity.Property(e => e.FirstName).HasMaxLength(512);
            entity.Property(e => e.LastName).HasMaxLength(512);
            entity.Property(e => e.Description).HasMaxLength(1024);
            entity.Property(e => e.CardholderTypeUid).HasMaxLength(256);
            entity.Property(e => e.DepartmentUid).HasMaxLength(256);
            entity.Property(e => e.Status).HasMaxLength(128);
            entity.Property(e => e.SecurityGroupUid).HasMaxLength(256);
            entity.Property(e => e.SecurityGroupApiKey).HasMaxLength(256);
            entity.Property(e => e.AccessGroupUidsRaw).HasMaxLength(4000);
            entity.Property(e => e.AccessGroupApiKeysRaw).HasMaxLength(4000);
            entity.Property(e => e.LicensePlate).HasMaxLength(64);

            entity.HasIndex(e => e.AmadeusUid).IsUnique();
            entity.HasIndex(e => e.CardholderIdNumber);
            entity.HasIndex(e => e.SecurityGroupUid);
            entity.HasIndex(e => e.Status);
        });
    }

    private static void ConfigureCard(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<CardEntity>(entity =>
        {
            entity.ToTable("Cards");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.AmadeusUid).HasMaxLength(256).IsRequired();
            entity.Property(e => e.CardholderUid).HasMaxLength(256);
            entity.Property(e => e.CardholderIdNumber).HasMaxLength(256);
            entity.Property(e => e.CardNumber).HasMaxLength(256);
            entity.Property(e => e.Status).HasMaxLength(128);

            entity.HasIndex(e => e.AmadeusUid).IsUnique();
            entity.HasIndex(e => e.CardholderUid);
            entity.HasIndex(e => e.CardholderIdNumber);
            entity.HasIndex(e => e.CardNumber);
        });
    }
}
