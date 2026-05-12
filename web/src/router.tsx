import { createBrowserRouter, Navigate } from "react-router"
import { ProtectedLayout } from "@/components/layout/protected-layout"

import LandingPage from "@/pages/landing/page"
import LoginPage from "@/pages/login/page"
import DashboardPage from "@/pages/dashboard/page"
import ListingBatchesPage from "@/pages/listing-batches/page"
import BatchDetailPage from "@/pages/listing-batches/[id]/page"
import ImageManagementPage from "@/pages/image-management/page"
import SheinProductsPage from "@/pages/shein-products/page"
import SheinPlatformProductsPage from "@/pages/shein-platform-products/page"
import SheinBarcodeSizePage from "@/pages/shein-operations/barcode-size/page"
import SheinPlatformIdentitiesPage from "@/pages/shein-operations/platform-identities/page"
import SheinAuditStatusPage from "@/pages/shein-operations/audit-status/page"
import SheinCompliancePage from "@/pages/shein-operations/compliance/page"
import SheinProcurementPage from "@/pages/shein-operations/procurement/page"
import SheinInventoryPage from "@/pages/shein-operations/inventory/page"
import SheinFinancePage from "@/pages/shein-operations/finance/page"
import PrePublishValidationPage from "@/pages/pre-publish-validation/page"
import PrePublishDraftDetailPage from "@/pages/pre-publish-validation/[listingId]/page"
import PublishTasksPage from "@/pages/publish-tasks/page"
import PublishTaskDetailPage from "@/pages/publish-tasks/[id]/page"
import CategoryMappingPage from "@/pages/category-mapping/page"
import SizeConversionPage from "@/pages/size-conversion/page"
import PackageRulesPage from "@/pages/package-rules/page"
import PriceRulesPage from "@/pages/price-rules/page"
import BrandRulesPage from "@/pages/brand-rules/page"
import SheinMetadataPage from "@/pages/shein-metadata/page"
import ProductArchivesPage from "@/pages/product-archives/page"
import ProductArchiveDetailPage from "@/pages/product-archives/[spuCode]/page"
import MdmProductsPage from "@/pages/mdm-products/page"
import MdmProductDetailPage from "@/pages/mdm-products/[spuCode]/page"
import DeepDrawContentPage from "@/pages/deepdraw-content/page"
import DeepdrawContentDetailPage from "@/pages/deepdraw-content/[spuCode]/page"
import ImageLibraryPage from "@/pages/image-library/page"
import ImageLibraryDetailPage from "@/pages/image-library/[assetId]/page"
import PlatformIntegrationsPage from "@/pages/platform-integrations/page"
import UsersPage from "@/pages/users/page"
import SyncTasksPage from "@/pages/sync-tasks/page"
import OperationLogsPage from "@/pages/operation-logs/page"

export const router = createBrowserRouter([
  { index: true, element: <LandingPage /> },
  { path: "login", element: <LoginPage /> },
  {
    element: <ProtectedLayout />,
    children: [
      { path: "dashboard", element: <DashboardPage /> },
      { path: "listing-batches", element: <ListingBatchesPage /> },
      { path: "listing-batches/:id", element: <BatchDetailPage /> },
      { path: "draft-workbench", element: <Navigate to="/pre-publish-validation" replace /> },
      { path: "draft-workbench/:batchId", element: <Navigate to="/pre-publish-validation" replace /> },
      { path: "image-management", element: <ImageManagementPage /> },
      { path: "shein-products", element: <SheinProductsPage /> },
      { path: "shein-platform-products", element: <SheinPlatformProductsPage view="list" /> },
      { path: "shein-platform-products/sites", element: <SheinPlatformProductsPage view="sites" /> },
      { path: "shein-platform-products/:spuName", element: <SheinPlatformProductsPage view="detail" /> },
      { path: "shein-operations/barcode-size", element: <SheinBarcodeSizePage /> },
      { path: "shein-operations/platform-identities", element: <SheinPlatformIdentitiesPage /> },
      { path: "shein-operations/audit-status", element: <SheinAuditStatusPage /> },
      { path: "shein-operations/compliance", element: <SheinCompliancePage /> },
      { path: "shein-operations/procurement", element: <SheinProcurementPage /> },
      { path: "shein-operations/inventory", element: <SheinInventoryPage /> },
      { path: "shein-operations/finance", element: <SheinFinancePage /> },
      { path: "pre-publish-validation", element: <PrePublishValidationPage /> },
      { path: "pre-publish-validation/:listingId", element: <PrePublishDraftDetailPage /> },
      { path: "publish-tasks", element: <PublishTasksPage /> },
      { path: "publish-tasks/:id", element: <PublishTaskDetailPage /> },
      { path: "category-mapping", element: <CategoryMappingPage /> },
      { path: "attribute-mapping", element: <Navigate to="/pre-publish-validation" replace /> },
      { path: "size-conversion", element: <SizeConversionPage /> },
      { path: "package-rules", element: <PackageRulesPage /> },
      { path: "price-rules", element: <PriceRulesPage /> },
      { path: "brand-rules", element: <BrandRulesPage /> },
      { path: "low-rate-list", element: <Navigate to="/price-rules" replace /> },
      { path: "shein-metadata", element: <SheinMetadataPage /> },
      { path: "product-archives", element: <ProductArchivesPage /> },
      { path: "product-archives/:spuCode", element: <ProductArchiveDetailPage /> },
      { path: "mdm-products", element: <MdmProductsPage /> },
      { path: "mdm-products/:spuCode", element: <MdmProductDetailPage /> },
      { path: "deepdraw-content", element: <DeepDrawContentPage /> },
      { path: "deepdraw-content/:spuCode", element: <DeepdrawContentDetailPage /> },
      { path: "image-library", element: <ImageLibraryPage /> },
      { path: "image-library/:assetId", element: <ImageLibraryDetailPage /> },
      { path: "shein-accounts", element: <Navigate to="/platform-integrations" replace /> },
      { path: "platform-integrations", element: <PlatformIntegrationsPage /> },
      { path: "users", element: <UsersPage /> },
      { path: "sync-tasks", element: <SyncTasksPage /> },
      { path: "operation-logs", element: <OperationLogsPage /> },
    ],
  },
])
