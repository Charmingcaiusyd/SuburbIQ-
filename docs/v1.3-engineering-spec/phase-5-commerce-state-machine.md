# Phase 5 Commerce, Credit, Subscription and Payment State Machine

Implemented in this phase:

- `POST /api/checkout/create-session` now creates database-backed `orders` and `payments`.
- Checkout validates active product, optional coupon, selected area and report availability.
- `single_report` checkout requires a confirmed selectable suburb/postcode relationship.
- Blocked reports return `REPORT_BLOCKED`.
- Low confidence records require warning acknowledgement.
- GST-inclusive amount is calculated as one eleventh of the final price.
- `POST /api/coupons/validate` validates active coupons and returns discount/final amount.
- Stripe/PayPal webhook routes use a mock provider boundary and update payment/order states.
- Payment confirmation creates invoice/receipt records.
- Confirmed `ten_credit_pack` orders grant 10 available report credits.
- Confirmed subscription orders create active subscription quota with 30 reports per billing cycle.
- Zero-dollar/100% discount checkout auto-confirms payment and grants entitlement.
- Internal entitlement helpers now support credit hold/capture/release and subscription quota capture/restore for Phase 6 report jobs.

Deferred:

- Real Stripe SDK checkout sessions and signature verification.
- Real PayPal event verification.
- Public report job route integration for credit/subscription hold/capture/release.
- Refund payment-provider integration and admin refund actions.

Mock webhook payload:

```json
{
  "payment_id": "uuid",
  "event_type": "payment_confirmed"
}
```

Supported mock `event_type` values:

- `payment_confirmed`
- `payment_failed`
- `webhook_retrying`
- `manual_review_required`
- `refunded`
- `partially_refunded`

Local smoke flow after seed:

```bash
curl -X POST http://localhost:3000/api/coupons/validate \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d "{\"code\":\"DEVFREE\",\"amount_cents\":4900}"

curl -X POST http://localhost:3000/api/checkout/create-session \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d "{\"product_type\":\"ten_credit_pack\",\"provider\":\"stripe\"}"
```
