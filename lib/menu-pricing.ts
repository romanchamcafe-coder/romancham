// Menu-engineering price model. Pure + shared by the live calculator and the
// summary table so both always agree.
//
// Every input below is a PERCENTAGE OF THE RECIPE COST (packaging, wastage,
// labor, utility, overhead, marketing) — so the whole model scales with each
// item's food cost. Commission / target profit / GST are percentages too.
//
//   recipe(after wastage) = recipeCost x (1 + wastage%)
//   overheads             = recipeCost x (labor% + utility% + overhead% + marketing%)
//   dine-in cost          = recipe(after wastage) + overheads           (served in-house)
//   packaging             = recipeCost x packaging%
//   takeaway/delivery cost= dine-in cost + packaging
//   pre-tax price         = cost x (1 + targetProfit%)
//   price (incl GST)      = pre-tax x (1 + GST%)
//   delivery              = grossed up so the aggregator commission still
//                           leaves the required amount: price / (1 - commission%)

export type PricingInputs = {
  recipeCost: number; packaging: number; wastage: number; labor: number; utility: number;
  overhead: number; marketing: number; commission: number; targetProfit: number; gst: number;
};

export type PricingResult = {
  recipeAfterWastage: number; overheads: number; dineCost: number; packagingCost: number; otherCost: number;
  dinePrice: number; takeawayPrice: number; deliveryPrice: number;
  dineProfit: number; takeawayProfit: number; deliveryProfit: number;
};

export function computePricing(i: PricingInputs): PricingResult {
  const recipeAfterWastage = i.recipeCost * (1 + i.wastage / 100);
  const overheads = i.recipeCost * (i.labor + i.utility + i.overhead + i.marketing) / 100;
  const dineCost = recipeAfterWastage + overheads;
  const packagingCost = i.recipeCost * i.packaging / 100;
  const otherCost = dineCost + packagingCost;
  const gstM = 1 + i.gst / 100;
  const profitM = 1 + i.targetProfit / 100;
  const comm = Math.min(Math.max(i.commission, 0), 95) / 100;

  const dinePrice = dineCost * profitM * gstM;
  const takeawayPrice = otherCost * profitM * gstM;
  const deliveryPrice = (otherCost * profitM * gstM) / (1 - comm);

  const dineProfit = dinePrice / gstM - dineCost;
  const takeawayProfit = takeawayPrice / gstM - otherCost;
  const deliveryProfit = (deliveryPrice * (1 - comm)) / gstM - otherCost;

  return { recipeAfterWastage, overheads, dineCost, packagingCost, otherCost, dinePrice, takeawayPrice, deliveryPrice, dineProfit, takeawayProfit, deliveryProfit };
}
