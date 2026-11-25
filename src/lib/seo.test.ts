import { describe, expect, it } from "vitest";
import { homeDescription, homeJsonLd, homeTitle, jsonLdScript } from "./seo";

describe("search metadata", () => {
  it("keeps the title under 60 characters", () => {
    expect(homeTitle.length).toBeLessThan(60);
  });

  it("keeps the description between 150 and 160 characters", () => {
    expect(homeDescription.length).toBeGreaterThanOrEqual(150);
    expect(homeDescription.length).toBeLessThanOrEqual(160);
  });

  it("describes the page as a profile of a person", () => {
    const types = homeJsonLd()["@graph"].map((n) => n["@type"]);
    expect(types).toEqual(expect.arrayContaining(["WebSite", "ProfilePage", "Person", "ItemList"]));
  });

  it("escapes < so the JSON can't end its script tag", () => {
    const out = jsonLdScript({ text: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("</script>");
    expect(JSON.parse(out)).toEqual({ text: "</script><script>alert(1)</script>" });
  });
});
