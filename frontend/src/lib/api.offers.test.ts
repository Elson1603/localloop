import { afterEach, describe, expect, it, vi } from "vitest";
import { updateOfferStatus } from "@/lib/api";

describe("updateOfferStatus", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("sends counter-offer payload when provided", async () => {
    localStorage.setItem("localloop_access_token", "token-123");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          offer_id: "offer-1",
          product_id: "product-1",
          buyer_user_id: "buyer-1",
          offered_price: 4500,
          status: "countered",
          created_at: "2026-04-21T00:00:00+00:00",
          updated_at: "2026-04-21T00:00:00+00:00",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await updateOfferStatus({
      offerId: "offer-1",
      status: "countered",
      counterOfferPrice: 4500,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const request = fetchSpy.mock.calls[0];
    expect(request[0]).toContain("/api/v1/offers/offer-1/status");
    expect(request[1]?.method).toBe("PUT");
    expect(request[1]?.body).toBe(
      JSON.stringify({
        status: "countered",
        counter_offer_price: 4500,
        note: undefined,
      }),
    );
  });
});
