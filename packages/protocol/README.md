# Protocollo onePixel

Contratti versionati condivisi tra backend, dashboard e client. La timeline è
eseguita sul dispositivo: il WebSocket invia soltanto comandi numerati e
idempotenti. Ogni manifest offline include un checksum SHA-256.
