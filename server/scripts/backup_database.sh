#!/bin/bash
# =============================================================================
# Career Forge — Database Backup Script
# =============================================================================
# Usage:
#   ./backup_database.sh                    # Backup to default directory
#   ./backup_database.sh /path/to/backup    # Backup to a specific directory
#   ./backup_database.sh --restore file.sql # Restore from a backup file
#   ./backup_database.sh --list             # List available backups
#   ./backup_database.sh --cleanup          # Remove backups older than retention period
# =============================================================================

set -eo pipefail

# Default backup directory — overridden by a positional argument that is not a flag
BACKUP_DIR="./backups"
if [[ "${1:-}" != --* ]] && [[ -n "${1:-}" ]]; then
  BACKUP_DIR="$1"
fi
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# Load environment variables safely (handles values with spaces and special chars)
if [ -f .env ]; then
    set -a
    # shellcheck source=.env
    source .env
    set +a
elif [ -f ../.env ]; then
    set -a
    source ../.env
    set +a
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Detect database type from DATABASE_URL
detect_database_type() {
    if [[ "$DATABASE_URL" == postgresql://* ]]; then
        echo "postgresql"
    elif [[ "$DATABASE_URL" == sqlite://* ]]; then
        echo "sqlite"
    else
        echo "unknown"
    fi
}

# Parse PostgreSQL URL
parse_postgres_url() {
    # postgresql://user:password@host:port/database
    local url="${DATABASE_URL#postgresql://}"

    # Extract user:password
    local userpass="${url%%@*}"
    PGUSER="${userpass%%:*}"
    PGPASSWORD="${userpass#*:}"

    # Extract host:port/database
    local hostdb="${url#*@}"
    local hostport="${hostdb%%/*}"
    PGHOST="${hostport%%:*}"
    PGPORT="${hostport#*:}"
    PGDATABASE="${hostdb#*/}"

    # Default port if not specified
    if [ "$PGPORT" = "$PGHOST" ]; then
        PGPORT="5432"
    fi

    export PGUSER PGPASSWORD PGHOST PGPORT PGDATABASE
}

# Backup PostgreSQL
backup_postgresql() {
    local backup_file="$BACKUP_DIR/careerforge_pg_${TIMESTAMP}.sql"
    local backup_file_gz="${backup_file}.gz"

    log_info "Backing up PostgreSQL database..."
    parse_postgres_url

    # Create backup directory
    mkdir -p "$BACKUP_DIR"

    # Run pg_dump
    PGPASSWORD="$PGPASSWORD" pg_dump \
        -h "$PGHOST" \
        -p "$PGPORT" \
        -U "$PGUSER" \
        -d "$PGDATABASE" \
        --format=plain \
        --no-owner \
        --no-privileges \
        > "$backup_file"

    # Compress backup
    gzip "$backup_file"

    log_info "Backup created: $backup_file_gz"
    log_info "Size: $(du -h "$backup_file_gz" | cut -f1)"
}

# Backup SQLite
backup_sqlite() {
    local db_path="${DATABASE_URL#sqlite:///}"
    db_path="${db_path#./}"

    # Handle relative paths
    if [[ ! "$db_path" = /* ]]; then
        db_path="$(dirname "$0")/../$db_path"
    fi

    if [ ! -f "$db_path" ]; then
        log_error "SQLite database not found: $db_path"
        exit 1
    fi

    local backup_file="$BACKUP_DIR/careerforge_sqlite_${TIMESTAMP}.db"
    local backup_file_gz="${backup_file}.gz"

    log_info "Backing up SQLite database..."

    # Create backup directory
    mkdir -p "$BACKUP_DIR"

    # Use SQLite backup command for consistency
    sqlite3 "$db_path" ".backup '$backup_file'"

    # Compress backup
    gzip "$backup_file"

    log_info "Backup created: $backup_file_gz"
    log_info "Size: $(du -h "$backup_file_gz" | cut -f1)"
}

# Restore PostgreSQL
restore_postgresql() {
    local backup_file="$1"

    log_warn "This will REPLACE all data in the database!"
    read -p "Are you sure you want to continue? (yes/no): " confirm

    if [ "$confirm" != "yes" ]; then
        log_info "Restore cancelled."
        exit 0
    fi

    parse_postgres_url

    # Decompress if needed
    if [[ "$backup_file" == *.gz ]]; then
        log_info "Decompressing backup..."
        gunzip -k "$backup_file"
        backup_file="${backup_file%.gz}"
    fi

    log_info "Restoring PostgreSQL database..."

    PGPASSWORD="$PGPASSWORD" psql \
        -h "$PGHOST" \
        -p "$PGPORT" \
        -U "$PGUSER" \
        -d "$PGDATABASE" \
        < "$backup_file"

    log_info "Database restored successfully!"
}

# Restore SQLite
restore_sqlite() {
    local backup_file="$1"
    local db_path="${DATABASE_URL#sqlite:///}"
    db_path="${db_path#./}"

    # Handle relative paths
    if [[ ! "$db_path" = /* ]]; then
        db_path="$(dirname "$0")/../$db_path"
    fi

    log_warn "This will REPLACE all data in the database!"
    read -p "Are you sure you want to continue? (yes/no): " confirm

    if [ "$confirm" != "yes" ]; then
        log_info "Restore cancelled."
        exit 0
    fi

    # Decompress if needed
    if [[ "$backup_file" == *.gz ]]; then
        log_info "Decompressing backup..."
        gunzip -k "$backup_file"
        backup_file="${backup_file%.gz}"
    fi

    log_info "Restoring SQLite database..."

    # Create backup of current database
    if [ -f "$db_path" ]; then
        mv "$db_path" "${db_path}.before_restore"
        log_info "Old database backed up to: ${db_path}.before_restore"
    fi

    # Copy backup to database location
    cp "$backup_file" "$db_path"

    log_info "Database restored successfully!"
}

# Clean old backups
cleanup_old_backups() {
    log_info "Cleaning backups older than $RETENTION_DAYS days..."

        find "$BACKUP_DIR" -name "careerforge_*.gz" -type f -mtime +$RETENTION_DAYS -delete 2>/dev/null || true

    local count=$(ls -1 "$BACKUP_DIR"/careerforge_*.gz 2>/dev/null | wc -l || echo "0")
    log_info "Remaining backups: $count"
}

# List backups
list_backups() {
    log_info "Available backups:"
    echo ""

    if [ -d "$BACKUP_DIR" ]; then
        ls -lh "$BACKUP_DIR"/careerforge_*.gz 2>/dev/null || log_warn "No backups found in $BACKUP_DIR"
    else
        log_warn "Backup directory does not exist: $BACKUP_DIR"
    fi
}

# Main script
main() {
    local db_type=$(detect_database_type)

    case "$1" in
        --restore)
            if [ -z "$2" ]; then
                log_error "Please specify backup file to restore"
                exit 1
            fi

            case "$db_type" in
                postgresql)
                    restore_postgresql "$2"
                    ;;
                sqlite)
                    restore_sqlite "$2"
                    ;;
                *)
                    log_error "Unknown database type: $DATABASE_URL"
                    exit 1
                    ;;
            esac
            ;;
        --list)
            list_backups
            ;;
        --cleanup)
            cleanup_old_backups
            ;;
        --help|-h)
            echo "Career Forge — Database Backup Script"
            echo ""
            echo "Usage:"
            echo "  $0                         Backup database"
            echo "  $0 /path/to/backup         Backup to specific directory"
            echo "  $0 --restore <file>        Restore from backup"
            echo "  $0 --list                  List available backups"
            echo "  $0 --cleanup               Remove backups older than $RETENTION_DAYS days"
            echo ""
            echo "Environment:"
            echo "  DATABASE_URL    Database connection string (from .env)"
            echo "  RETENTION_DAYS  Days to keep backups (default: 7)"
            ;;
        *)
            case "$db_type" in
                postgresql)
                    backup_postgresql
                    cleanup_old_backups
                    ;;
                sqlite)
                    backup_sqlite
                    cleanup_old_backups
                    ;;
                *)
                    log_error "Unknown database type. Check DATABASE_URL in .env"
                    log_error "Current: $DATABASE_URL"
                    exit 1
                    ;;
            esac
            ;;
    esac
}

main "$@"
