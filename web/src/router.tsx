import { createBrowserRouter, Navigate } from "react-router"
import { AppLayout } from "@/components/layout/app-layout"

import DashboardPage from "@/pages/dashboard/page"
import ListingBatchesPage from "@/pages/listing-batches/page"
import BatchDetailPage from "@/pages/listing-batches/[id]/page"
import ImageManagementPage from "@/pages/image-management/page"
import SheinProductsPage from "@/pages/shein-products/page"
import PrePublishValidationPage from "@/pages/pre-publish-validation/page"
import PrePublishDraftDetailPage from "@/pages/pre-publish-validation/[listingId]/page"
import PublishTasksPage from "@/pages/publish-tasks/page"
import PublishTaskDetailPage from "@/pages/publish-tasks/[id]/page"
import CategoryMappingPage from "@/pages/category-mapping/page"
import AttributeMappingPage from "@/pages/attribute-mapping/page"
import SizeConversionPage from "@/pages/size-conversion/page"
import PackageRulesPage from "@/pages/package-rules/page"
import PriceRulesPage from "@/pages/price-rules/page"
import LowRateListPage from "@/pages/low-rate-list/page"
import SheinMetadataPage from "@/pages/shein-metadata/page"
import ProductArchivesPage from "@/pages/product-archives/page"
import ProductArchiveDetailPage from "@/pages/product-archives/[spuCode]/page"
import MdmProductsPage from "@/pages/mdm-products/page"
import MdmProductDetailPage from "@/pages/mdm-products/[spuCode]/page"
import DeepDrawContentPage from "@/pages/deepdraw-content/page"
import DeepdrawContentDetailPage from "@/pages/deepdraw-content/[spuCode]/page"
import ImageLibraryPage from "@/pages/image-library/page"
import ImageLibraryDetailPage from "@/pages/image-library/[assetId]/page"
import SheinAccountsPage from "@/pages/shein-accounts/page"
import SyncTasksPage from "@/pages/sync-tasks/page"
import OperationLogsPage from "@/pages/operation-logs/page"

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "listing-batches", element: <ListingBatchesPage /> },
      { path: "listing-batches/:id", element: <BatchDetailPage /> },
      { path: "draft-workbench", element: <Navigate to="/pre-publish-validation" replace /> },
      { path: "draft-workbench/:batchId", element: <Navigate to="/pre-publish-validation" replace /> },
      { path: "image-management", element: <ImageManagementPage /> },
      { path: "shein-products", element: <SheinProductsPage /> },
      { path: "pre-publish-validation", element: <PrePublishValidationPage /> },
      { path: "pre-publish-validation/:listingId", element: <PrePublishDraftDetailPage /> },
      { path: "publish-tasks", element: <PublishTasksPage /> },
      { path: "publish-tasks/:id", element: <PublishTaskDetailPage /> },
      { path: "category-mapping", element: <CategoryMappingPage /> },
      { path: "attribute-mapping", element: <AttributeMappingPage /> },
      { path: "size-conversion", element: <SizeConversionPage /> },
      { path: "package-rules", element: <PackageRulesPage /> },
      { path: "price-rules", element: <PriceRulesPage /> },
      { path: "low-rate-list", element: <LowRateListPage /> },
      { path: "shein-metadata", element: <SheinMetadataPage /> },
      { path: "product-archives", element: <ProductArchivesPage /> },
      { path: "product-archives/:spuCode", element: <ProductArchiveDetailPage /> },
      { path: "mdm-products", element: <MdmProductsPage /> },
      { path: "mdm-products/:spuCode", element: <MdmProductDetailPage /> },
      { path: "deepdraw-content", element: <DeepDrawContentPage /> },
      { path: "deepdraw-content/:spuCode", element: <DeepdrawContentDetailPage /> },
      { path: "image-library", element: <ImageLibraryPage /> },
      { path: "image-library/:assetId", element: <ImageLibraryDetailPage /> },
      { path: "shein-accounts", element: <SheinAccountsPage /> },
      { path: "sync-tasks", element: <SyncTasksPage /> },
      { path: "operation-logs", element: <OperationLogsPage /> },
    ],
  },
])
