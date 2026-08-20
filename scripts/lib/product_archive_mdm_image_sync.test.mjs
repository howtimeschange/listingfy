import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const files = {
  migration: path.join(PROJECT_ROOT, "db/migrations/048_product_archive_draft_mdm_main_image.sql"),
  service: path.join(PROJECT_ROOT, "web/server/services/product-archive-draft-mdm-images.ts"),
  route: path.join(PROJECT_ROOT, "web/server/routes/product-archive-drafts.ts"),
};

async function readText(file) {
  try {
    return await readFile(file, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
}

test("MDM main images have a dedicated idempotent draft-image source", async () => {
  const migration = await readText(files.migration);

  assert.match(migration, /mdm_main_image/);
  assert.match(migration, /product_archive_draft_image_source_type_check/);
  assert.match(migration, /unique[\s\S]+draft_id[\s\S]+source_type/i);
  assert.match(migration, /where source_type = 'mdm_main_image'/i);
});

test("every MDM-backed DeepDraw draft creation path synchronizes the SPU main image without blocking draft creation", async () => {
  const route = await readText(files.route);

  assert.match(route, /syncMdmMainImageToProductArchiveDraft/);
  assert.match(route, /source === "mdm_draft"[\s\S]+syncDraftMdmMainImageSafely/);
  assert.match(route, /post\("\/from-spu\/:spuCode"[\s\S]+syncDraftMdmMainImageSafely/);
  assert.match(route, /mdm_main_image_sync_failed/);
});

test("MDM main-image sync downloads a validated local image for multimodal AI and reuses it idempotently", async () => {
  const service = await readText(files.service);

  assert.match(service, /export async function syncMdmMainImageToProductArchiveDraft/);
  assert.match(service, /select[\s\S]+spu\.pic_url[\s\S]+from product_archive_draft draft/i);
  assert.match(service, /source_type = 'mdm_main_image'/i);
  assert.match(service, /detectImageUploadType/);
  assert.match(service, /readImageDimensions/);
  assert.match(service, /local_path/);
  assert.match(service, /source_ref/);
  assert.match(service, /on conflict/i);
});

test("MDM main-image downloads use an allowlist, reject private redirects, and enforce size limits", async () => {
  const service = await readText(files.service);

  assert.match(service, /MDM_BASE_URL/);
  assert.match(service, /product\.resources\.deepdraw\.biz/);
  assert.match(service, /LISTINGIFY_MDM_IMAGE_ALLOWED_HOSTS/);
  assert.match(service, /redirect:\s*"manual"/);
  assert.match(service, /isPrivateOrReservedIp/);
  assert.match(service, /content-length/i);
  assert.match(service, /maxUploadBytes\("image"\)/);
});

test("MDM main-image transport pins every validated DNS result and preserves Host/SNI evidence", async () => {
  const service = await readText(files.service);

  assert.match(service, /assertSafeMdmImageUrl\([\s\S]*return \{[\s\S]*address:/);
  assert.match(service, /lookup:\s*pinnedLookupFor\(resolved\.address, resolved\.family\)/);
  assert.match(service, /pinnedAddress:\s*resolved\.address/);
  assert.match(service, /servername:\s*resolved\.hostname/);
  assert.match(service, /Host:\s*currentUrl\.host/);
  assert.match(service, /requestPinnedNodeImage\(currentUrl, resolved/);
});

test("MDM main-image DB write is fenced and source-checked after the network download", async () => {
  const service = await readText(files.service);

  assert.match(service, /const downloaded = await downloadMdmMainImage\(sourceUrl, options\)/);
  assert.match(service, /db\.transaction\(\(\) => \{[\s\S]*assertProductArchiveDraftMutable\(db, draftId\)[\s\S]*currentSource/);
  assert.match(service, /textValue\(currentSource\.pic_url\) !== sourceUrl/);
  assert.match(service, /MDM 主图来源已变化/);
  assert.doesNotMatch(service, /db\.transaction\(\(\) => assertProductArchiveDraftMutable/);
});

test("MDM main-image final files are unique and cleanup follows the DB commit boundary", async () => {
  const service = await readText(files.service);

  assert.match(service, /mdm-main-\$\{digest\}-\$\{randomUUID\(\)\}/);
  assert.match(service, /catch \(error\) \{[\s\S]*await rm\(localPath, \{ force: true \}\)/);
  assert.match(service, /if \(previousPath && previousPath !== localPath\) await rm\(previousPath/);
  assert.doesNotMatch(service, /if \(existingPath && existingPath !== localPath\) await rm\(existingPath/);
});

const oneByOnePng = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010804000000b51c0c020000000b4944415478da6364f80f00010501012718e3660000000049454e44ae426082",
  "hex",
);

function fakeMdmDb({
  sourceUrl,
  existing = null,
  claimToken = null,
  staleSourceUrl = null,
  failInsert = false,
} = {}) {
  const state = {
    sourceUrl,
    sourceSpuCode: "SPU-TEST",
    existing,
    claimToken,
    staleSourceUrl,
    sourceReads: 0,
  };
  const db = {
    prepare(sql) {
      const normalized = String(sql).replace(/\s+/g, " ").trim().toLowerCase();
      return {
        get() {
          if (normalized.includes("from product_archive_draft draft")) {
            state.sourceReads += 1;
            return {
              draft_id: 1,
              spu_code: state.sourceSpuCode,
              pic_url: state.staleSourceUrl && state.sourceReads >= 2
                ? state.staleSourceUrl
                : state.sourceUrl,
            };
          }
          if (normalized.includes("for update")) {
            return { id: 1, status: "draft", submit_claim_token: state.claimToken };
          }
          if (normalized.includes("from product_archive_draft_image")) return state.existing;
          return undefined;
        },
        run(...params) {
          if (normalized.startsWith("insert into product_archive_draft_image")) {
            if (failInsert) throw new Error("simulated DB failure");
            state.existing = {
              id: 100,
              draft_id: params[0],
              spu_code: params[1],
              source_type: "mdm_main_image",
              source_ref: params[2],
              local_path: params[3],
              file_name: params[4],
              original_file_name: params[5],
              mime_type: params[6],
              file_size: params[7],
              width: params[8],
              height: params[9],
            };
            return { lastInsertRowid: 100 };
          }
          return { changes: 1 };
        },
      };
    },
    transaction(callback) {
      return (...args) => callback(...args);
    },
  };
  return { db, state };
}

async function testImageRoot() {
  return await mkdtemp(path.join(os.tmpdir(), "listingify-mdm-image-test-"));
}

function fakeFetchSequence(sequence, calls) {
  return async (input, init) => {
    calls.push({ input, init });
    const next = sequence.shift();
    if (!next) throw new Error("unexpected fetch call");
    return new Response(next.body ?? null, {
      status: next.status,
      headers: next.headers ?? {},
    });
  };
}

async function loadMdmImageService() {
  return await import("../../web/server/services/product-archive-draft-mdm-images.ts");
}

test("MDM main-image sync pins each redirect hop to the validated address", async () => {
  const { syncMdmMainImageToProductArchiveDraft } = await loadMdmImageService();
  const root = await testImageRoot();
  const calls = [];
  const sourceUrl = "https://images.example.com/source.png";
  const { db, state } = fakeMdmDb({ sourceUrl });
  try {
    const result = await syncMdmMainImageToProductArchiveDraft(db, 1, {
      imageRootDir: root,
      allowedHosts: new Set(["images.example.com", "cdn.example.com"]),
      lookupImpl: async (hostname) => [{
        address: hostname === "images.example.com" ? "93.184.216.34" : "93.184.216.35",
        family: 4,
      }],
      fetchImpl: fakeFetchSequence([
        {
          status: 302,
          headers: { location: "https://cdn.example.com/final.png" },
        },
        {
          status: 200,
          body: oneByOnePng,
          headers: { "content-type": "image/png" },
        },
      ], calls),
    });
    assert.equal(result.status, "created");
    assert.equal(calls.length, 2);
    assert.deepEqual(calls.map(({ init }) => init.pinnedAddress), ["93.184.216.34", "93.184.216.35"]);
    for (const { input, init } of calls) {
      const parsed = new URL(input);
      assert.equal(init.servername, parsed.hostname);
      assert.equal(init.headers.Host, parsed.host);
      let pinned;
      init.lookup(parsed.hostname, {}, (_error, address, family) => {
        pinned = { address, family };
      });
      assert.equal(pinned.address, init.pinnedAddress);
      assert.equal(pinned.family, 4);
    }
    assert.equal(state.existing.source_ref, sourceUrl);
    await stat(state.existing.local_path);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("MDM main-image sync rejects deprecated IPv6 site-local fec0::/10 before transport", async () => {
  const { syncMdmMainImageToProductArchiveDraft } = await loadMdmImageService();
  const sourceUrl = "https://images.example.com/source.png";
  for (const address of ["fec0::1", "feff::1"]) {
    const root = await testImageRoot();
    const { db } = fakeMdmDb({ sourceUrl });
    let transportCalls = 0;
    try {
      await assert.rejects(
        syncMdmMainImageToProductArchiveDraft(db, 1, {
          imageRootDir: root,
          allowedHosts: new Set(["images.example.com"]),
          lookupImpl: async () => [{ address, family: 6 }],
          fetchImpl: async () => {
            transportCalls += 1;
            throw new Error("transport should not be reached");
          },
        }),
        /本机或内网地址/,
      );
      assert.equal(transportCalls, 0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});

test("MDM main-image sync removes only the new file when the active-submit fence or source check rejects it", async () => {
  const { syncMdmMainImageToProductArchiveDraft } = await loadMdmImageService();
  for (const scenario of [
    { name: "claim", claimToken: "claim-1", staleSourceUrl: null, expected: /正在提交|提交权已失效/ },
    { name: "stale", claimToken: null, staleSourceUrl: "https://images.example.com/changed.png", expected: /来源已变化/ },
  ]) {
    const root = await testImageRoot();
    const sourceUrl = "https://images.example.com/source.png";
    const { db } = fakeMdmDb({ sourceUrl, ...scenario });
    try {
      await assert.rejects(
        syncMdmMainImageToProductArchiveDraft(db, 1, {
          imageRootDir: root,
          allowedHosts: new Set(["images.example.com"]),
          lookupImpl: async () => [{ address: "93.184.216.34", family: 4 }],
          fetchImpl: fakeFetchSequence([{
            status: 200,
            body: oneByOnePng,
            headers: { "content-type": "image/png" },
          }], []),
        }),
        scenario.expected,
      );
      const filesInDraftDir = await readdir(path.join(root, "1")).catch(() => []);
      assert.deepEqual(filesInDraftDir, []);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});

test("MDM main-image sync preserves the old referenced file on DB failure and deletes it after commit", async () => {
  const { syncMdmMainImageToProductArchiveDraft } = await loadMdmImageService();
  const sourceUrl = "https://images.example.com/source.png";
  for (const failInsert of [true, false]) {
    const root = await testImageRoot();
    const imageDir = path.join(root, "1");
    const oldPath = path.join(imageDir, "mdm-main-old.png");
    await mkdir(imageDir, { recursive: true });
    await writeFile(oldPath, oneByOnePng);
    const { db, state } = fakeMdmDb({
      sourceUrl,
      existing: {
        id: 99,
        draft_id: 1,
        spu_code: "SPU-TEST",
        source_type: "mdm_main_image",
        source_ref: "https://images.example.com/old.png",
        local_path: oldPath,
        file_name: "mdm-main-old.png",
      },
      failInsert,
    });
    try {
      const call = syncMdmMainImageToProductArchiveDraft(db, 1, {
        imageRootDir: root,
        allowedHosts: new Set(["images.example.com"]),
        lookupImpl: async () => [{ address: "93.184.216.34", family: 4 }],
        fetchImpl: fakeFetchSequence([{
          status: 200,
          body: oneByOnePng,
          headers: { "content-type": "image/png" },
        }], []),
      });
      if (failInsert) {
        await assert.rejects(call, /simulated DB failure/);
        await stat(oldPath);
        assert.equal((await readdir(imageDir)).filter((name) => name !== "mdm-main-old.png").length, 0);
      } else {
        const result = await call;
        assert.equal(result.status, "updated");
        await assert.rejects(stat(oldPath), { code: "ENOENT" });
        assert.notEqual(state.existing.local_path, oldPath);
        await stat(state.existing.local_path);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});
