-- PR-C11: track one-time stale-open reminder per implementation request
ALTER TABLE "ImplementationRequest" ADD COLUMN "staleOpenNotifiedAt" TIMESTAMP(3);
