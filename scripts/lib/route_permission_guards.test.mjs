import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import businessRules from "../../web/server/routes/business-rules.ts";
import categoryMapping from "../../web/server/routes/category-mapping.ts";
import deepdrawContent from "../../web/server/routes/deepdraw-content.ts";
import imageLibrary from "../../web/server/routes/image-library.ts";
import mdmProducts from "../../web/server/routes/mdm-products.ts";
import metadata from "../../web/server/routes/metadata.ts";
import productArchives from "../../web/server/routes/product-archives.ts";

const requireFromWeb = createRequire(new URL("../../web/package.json", import.meta.url));
const { Hono } = requireFromWeb("hono");

const USER = {
  id: 9001,
  username: "permission-test",
  display_name: "Permission Test",
  email: null,
  status: "ACTIVE",
  roles: [],
  permissions: [],
};

function appWithUser(router, permissions) {
  const app = new Hono();
  app.use("*", async (c, next) => {
    c.set("user", { ...USER, permissions });
    await next();
  });
  app.route("/", router);
  return app;
}

test("data and rule routers reject authenticated users without their read permission", async () => {
  const cases = [
    [businessRules, "/brand-rules"],
    [categoryMapping, "/rules"],
    [metadata, "/summary"],
    [productArchives, "/summary"],
    [mdmProducts, "/summary"],
    [deepdrawContent, "/summary"],
    [imageLibrary, "/summary"],
  ];

  for (const [router, route] of cases) {
    const response = await appWithUser(router, []).request(route);
    assert.equal(response.status, 403, `${route} must enforce a backend read permission`);
  }
});

test("rule and synchronization mutations require their write permission", async () => {
  const cases = [
    [businessRules, "/brand-rules", ["RULE_READ"]],
    [categoryMapping, "/rules", ["RULE_READ"]],
    [metadata, "/sync-jobs", ["LISTING_READ"]],
    [productArchives, "/sync-jobs", ["DATA_READ"]],
  ];

  for (const [router, route, permissions] of cases) {
    const response = await appWithUser(router, permissions).request(route, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(response.status, 403, `${route} must enforce a backend write permission`);
  }
});
