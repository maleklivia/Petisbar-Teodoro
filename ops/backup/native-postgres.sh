#!/bin/sh
set -eu

umask 077
backup_dir=/var/backups/petisbar
mkdir -p "$backup_dir"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
temporary="$(mktemp "$backup_dir/.petisbar-$stamp.XXXXXX")"
trap 'rm -f "$temporary"' EXIT HUP INT TERM

pg_dump --format=custom --dbname=petisbar --file="$temporary"
pg_restore --list "$temporary" >/dev/null

destination="$backup_dir/petisbar-$stamp.dump"
mv "$temporary" "$destination"
trap - EXIT HUP INT TERM
find "$backup_dir" -maxdepth 1 -type f -name 'petisbar-*.dump' -mtime +30 -delete
printf 'Backup validado: %s\n' "$destination"
