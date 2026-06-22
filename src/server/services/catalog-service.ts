export function getStubProducts() {
  return [
    {
      productType: "single_report",
      name: "Single suburb paid report",
      priceCents: 4900,
      currency: "AUD",
      gstInclusive: true
    },
    {
      productType: "ten_credit_pack",
      name: "10 report credits",
      priceCents: 39000,
      currency: "AUD",
      gstInclusive: true
    },
    {
      productType: "subscription_1m",
      name: "Monthly subscription",
      priceCents: 9900,
      currency: "AUD",
      gstInclusive: true,
      reportsLimitPerBillingCycle: 30
    }
  ];
}
