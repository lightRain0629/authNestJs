#!/bin/bash

CONTAINER="postgres_db"
DB_NAME="db_auth"
DB_USER="postgres"
BACKUP_DIR="./backups"

backup() {
  mkdir -p "$BACKUP_DIR"
  TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
  FILENAME="${DB_NAME}_${TIMESTAMP}.dump"

  echo "Creating backup..."
  docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" -F c -f "/tmp/$FILENAME"
  docker cp "$CONTAINER:/tmp/$FILENAME" "$BACKUP_DIR/$FILENAME"
  docker exec "$CONTAINER" rm "/tmp/$FILENAME"

  SIZE=$(du -h "$BACKUP_DIR/$FILENAME" | cut -f1)
  echo "Backup created: $BACKUP_DIR/$FILENAME ($SIZE)"
}

restore() {
  if [ -z "$1" ]; then
    echo "Usage: $0 restore <backup-file>"
    exit 1
  fi

  if [ ! -f "$1" ]; then
    echo "Error: file '$1' not found"
    exit 1
  fi

  FILENAME=$(basename "$1")

  echo "Restoring from $1..."
  docker cp "$1" "$CONTAINER:/tmp/$FILENAME"
  docker exec "$CONTAINER" pg_restore -U "$DB_USER" -d "$DB_NAME" --clean --if-exists "/tmp/$FILENAME"
  docker exec "$CONTAINER" rm "/tmp/$FILENAME"

  echo "Restore complete."
}

case "$1" in
  backup)
    backup
    ;;
  restore)
    restore "$2"
    ;;
  *)
    echo "Usage: $0 {backup|restore <file>}"
    exit 1
    ;;
esac
