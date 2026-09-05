#!/bin/bash
set -e

echo "Starting PostgreSQL service..."
service postgresql start

echo "Configuring postgresql.conf and pg_hba.conf..."
PG_CONF=$(find /etc/postgresql -name postgresql.conf | head -n 1)
PG_HBA=$(find /etc/postgresql -name pg_hba.conf | head -n 1)

if [ -f "$PG_CONF" ]; then
    sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/g" "$PG_CONF"
    sed -i "s/listen_addresses = 'localhost'/listen_addresses = '*'/g" "$PG_CONF"
fi

if [ -f "$PG_HBA" ]; then
    if ! grep -q "host    all             all             0.0.0.0/0               trust" "$PG_HBA"; then
        echo "host    all             all             0.0.0.0/0               trust" >> "$PG_HBA"
        echo "host    all             all             ::/0                    trust" >> "$PG_HBA"
    fi
fi

service postgresql restart

echo "Setting up database users and hqml database..."
su - postgres -c "psql" << 'EOF'
ALTER USER postgres WITH PASSWORD 'postgres';
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'user') THEN
        CREATE ROLE "user" LOGIN PASSWORD 'password' SUPERUSER;
    END IF;
END
$$;
SELECT 'CREATE DATABASE hqml' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'hqml')\gexec
GRANT ALL PRIVILEGES ON DATABASE hqml TO "user";
GRANT ALL PRIVILEGES ON DATABASE hqml TO postgres;
EOF

echo "PostgreSQL setup completed successfully!"
