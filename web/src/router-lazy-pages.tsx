import { lazy, Suspense, type ReactNode } from "react"
import { LoadingSkeleton } from "@/components/loading-skeleton"

export const ListingBatchesPage = lazy(() => import("@/pages/listing-batches/page"))
export const BatchDetailPage = lazy(() => import("@/pages/listing-batches/[id]/page"))
export const ImageManagementPage = lazy(() => import("@/pages/image-management/page"))
export const SheinProductsPage = lazy(() => import("@/pages/shein-products/page"))
export const SheinPlatformProductsPage = lazy(() => import("@/pages/shein-platform-products/page"))
export const SheinBarcodeSizePage = lazy(() => import("@/pages/shein-operations/barcode-size/page"))
export const SheinPlatformIdentitiesPage = lazy(() => import("@/pages/shein-operations/platform-identities/page"))
export const SheinAuditStatusPage = lazy(() => import("@/pages/shein-operations/audit-status/page"))
export const SheinCompliancePage = lazy(() => import("@/pages/shein-operations/compliance/page"))
export const SheinProcurementPage = lazy(() => import("@/pages/shein-operations/procurement/page"))
export const SheinInventoryPage = lazy(() => import("@/pages/shein-operations/inventory/page"))
export const SheinFinancePage = lazy(() => import("@/pages/shein-operations/finance/page"))
export const PrePublishValidationPage = lazy(() => import("@/pages/pre-publish-validation/page"))
export const PrePublishDraftDetailPage = lazy(() => import("@/pages/pre-publish-validation/[listingId]/page"))
export const PublishTasksPage = lazy(() => import("@/pages/publish-tasks/page"))
export const PublishTaskDetailPage = lazy(() => import("@/pages/publish-tasks/[id]/page"))
export const CategoryMappingPage = lazy(() => import("@/pages/category-mapping/page"))
export const SizeConversionPage = lazy(() => import("@/pages/size-conversion/page"))
export const PackageRulesPage = lazy(() => import("@/pages/package-rules/page"))
export const PriceRulesPage = lazy(() => import("@/pages/price-rules/page"))
export const BrandRulesPage = lazy(() => import("@/pages/brand-rules/page"))
export const SheinMetadataPage = lazy(() => import("@/pages/shein-metadata/page"))
export const ProductArchivesPage = lazy(() => import("@/pages/product-archives/page"))
export const ProductArchiveDetailPage = lazy(() => import("@/pages/product-archives/[spuCode]/page"))
export const ProductArchiveDraftsPage = lazy(() => import("@/pages/product-archive-drafts/page"))
export const ProductArchiveDraftDetailPage = lazy(() => import("@/pages/product-archive-drafts/[draftId]/page"))
export const ListingLaunchPlansPage = lazy(() => import("@/pages/listing-launch-plans/page"))
export const DeepdrawFieldMappingsPage = lazy(() => import("@/pages/deepdraw-field-mappings/page"))
export const ShoeSizeChartsPage = lazy(() => import("@/pages/shoe-size-charts/page"))
export const MdmProductsPage = lazy(() => import("@/pages/mdm-products/page"))
export const MdmProductDetailPage = lazy(() => import("@/pages/mdm-products/[spuCode]/page"))
export const DeepDrawContentPage = lazy(() => import("@/pages/deepdraw-content/page"))
export const DeepdrawContentDetailPage = lazy(() => import("@/pages/deepdraw-content/[spuCode]/page"))
export const DeepdrawMetadataPage = lazy(() => import("@/pages/deepdraw-metadata/page"))
export const ImageLibraryPage = lazy(() => import("@/pages/image-library/page"))
export const ImageLibraryDetailPage = lazy(() => import("@/pages/image-library/[assetId]/page"))
export const PlatformIntegrationsPage = lazy(() => import("@/pages/platform-integrations/page"))
export const UsersPage = lazy(() => import("@/pages/users/page"))
export const SyncTasksPage = lazy(() => import("@/pages/sync-tasks/page"))
export const OperationLogsPage = lazy(() => import("@/pages/operation-logs/page"))

export function RouteSuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={(
        <div className="p-6">
          <LoadingSkeleton rows={8} />
        </div>
      )}
    >
      {children}
    </Suspense>
  )
}
