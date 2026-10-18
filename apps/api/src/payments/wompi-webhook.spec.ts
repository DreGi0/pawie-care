import { hasValidWompiSignature, parseWompiWebhook, wompiSignature } from './wompi-webhook.js';

describe('Wompi webhooks', () => {
  const body = Buffer.from('{"IdTransaccion":"tx-1","Monto":18.7}');
  // HMAC-SHA256 of that body with "api-secret", in hex.
  const signature = '8966cffd8a6e479961707b0954f8e905c86e129c12dd4418044a256c885956c5';

  describe('signature', () => {
    it('is the HMAC-SHA256 of the body as it arrived, keyed with the API Secret', () => {
      expect(wompiSignature(body, 'api-secret')).toBe(signature);
      expect(hasValidWompiSignature(body, signature, 'api-secret')).toBe(true);
      expect(hasValidWompiSignature(body, signature.toUpperCase(), 'api-secret')).toBe(true);
    });

    it('fails for another secret, a changed body, or a missing or malformed header', () => {
      expect(hasValidWompiSignature(body, signature, 'other-secret')).toBe(false);
      // The same JSON with a space is other bytes, so the body must not be re-serialized.
      const spaced = Buffer.from('{"IdTransaccion": "tx-1","Monto":18.7}');
      expect(hasValidWompiSignature(spaced, signature, 'api-secret')).toBe(false);
      expect(hasValidWompiSignature(body, undefined, 'api-secret')).toBe(false);
      expect(hasValidWompiSignature(body, 'not-hex', 'api-secret')).toBe(false);
      expect(hasValidWompiSignature(body, signature.slice(0, 10), 'api-secret')).toBe(false);
    });
  });

  describe('parseWompiWebhook', () => {
    const webhook = {
      IdCuenta: '980b36e6-0000-0000-0000-000000000000',
      FechaTransaccion: '2026-10-18T15:27:03.3403497-06:00',
      Monto: 18.7,
      ModuloUtilizado: 'EnlacePago',
      FormaPagoUtilizada: 'PagoNormal',
      IdTransaccion: '2bedafea-0000-0000-0000-000000000000',
      ResultadoTransaccion: 'ExitosaAprobada',
      EsProductiva: false,
      EnlacePago: {
        Id: 1384854,
        IdentificadorEnlaceComercio: '019a0000-0000-7000-8000-000000000001',
        NombreProducto: 'Reserva Pawie',
      },
    };

    it('reads the transaction, the payment it pays and the link', () => {
      expect(parseWompiWebhook(webhook)).toEqual({
        transactionId: '2bedafea-0000-0000-0000-000000000000',
        reference: '019a0000-0000-7000-8000-000000000001',
        linkId: '1384854',
        paidAt: new Date('2026-10-18T21:27:03.340Z'),
      });
    });

    it('also takes the fields in camelCase', () => {
      expect(
        parseWompiWebhook({
          idTransaccion: 'tx-1',
          enlacePago: { id: '7', identificadorEnlaceComercio: 'payment-1' },
        }),
      ).toEqual({ transactionId: 'tx-1', reference: 'payment-1', linkId: '7', paidAt: null });
    });

    it('is null without the transaction or the payment', () => {
      expect(parseWompiWebhook({ ...webhook, IdTransaccion: '' })).toBeNull();
      expect(parseWompiWebhook({ ...webhook, EnlacePago: undefined })).toBeNull();
      expect(parseWompiWebhook(null)).toBeNull();
      expect(parseWompiWebhook('IdTransaccion')).toBeNull();
    });
  });
});
