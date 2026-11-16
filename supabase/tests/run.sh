#!/bin/sh
# Provar migreringarna och kanalernas regler i en tom Postgres. Anslutningen
# tas från PGHOST, PGPORT, PGUSER och PGPASSWORD. Databasen test_engine skapas
# på nytt varje gång.
set -eu
cd "$(dirname "$0")/.."
psql -q -v ON_ERROR_STOP=1 -d postgres -c 'drop database if exists test_engine' -c 'create database test_engine'
set -- tests/supabase-stubs.sql migrations/*.sql tests/channels.test.sql
for file in "$@"; do
  psql -q -v ON_ERROR_STOP=1 -d test_engine -o /dev/null -f "$file"
done
