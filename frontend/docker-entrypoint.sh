#!/bin/sh
# Generate a self-signed TLS cert so camera/microphone APIs work on mobile.
# SERVER_IP must match the IP/hostname phones use to reach this server.
IP="${SERVER_IP:-127.0.0.1}"
mkdir -p /etc/ssl/private /etc/ssl/certs

cat > /tmp/ssl.cnf << CONF
[req]
default_bits       = 2048
prompt             = no
default_md         = sha256
x509_extensions    = v3_req
distinguished_name = dn
[dn]
CN = ${IP}
O  = Thiso Mall Kiosk
[v3_req]
subjectAltName     = IP:${IP},IP:127.0.0.1,DNS:localhost
basicConstraints   = CA:FALSE
keyUsage           = nonRepudiation,digitalSignature,keyEncipherment
CONF

openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout /etc/ssl/private/kiosk.key \
  -out    /etc/ssl/certs/kiosk.crt \
  -config /tmp/ssl.cnf 2>/dev/null

exec nginx -g 'daemon off;'
