import { createBrowserRouter, Navigate } from "react-router"
import { AppLayout } from "@/components/layout/app-layout"

import DashboardPage from "@/pages/dashboard/page"
import ListingBatchesPage from "@/pages/listing-batches/page"
import BatchDetailPage from "@/pages/listing-batches/[id]/page"
import DraftWorkbenchPage from "@/pages/draft-workbench/page"
import ImageManagementPage from "@/pages/image-management/page"
import PrePublishValidationPage from "@/pages/pre-publish-validation/page"
import PublishTasksPage from "@/pages/publish-tasks/page"
import PublishTaskDetailPage from "@/pages/publish-tasks/[id]/page"
import CategoryMappingPage from "@/pages/category-mapping/page"
import AttributeMappingPage from "@/pages/attribute-mapping/page"
import SizeConversionPage from "@/pages/size-conversion/page"
import PackageRulesPage from "@/pages/package-rules/page"
import PriceRulesPage from "@/pages/price-rules/page"
import LowRateListPage from "@/pages/low-rate-list/page"
import SheinMetadataPage from "@/pages/shein-metadata/page"
import MdmProductsPage from "@/pages/mdm-products/page"
import DeepDrawContentPage from "@/pages/deepdraw-content/page"
import ImageLibraryPage from "@/pages/image-library/page"
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
      { path: "draft-workbench", element: <DraftWorkbenchPage /> },
      { path: "draft-workbench/:batchId", element: <DraftWorkbenchPage /> },
      { path: "image-management", element: <ImageManagementPage /> },
      { path: "pre-publish-validation", element: <PrePublishValidationPage /> },
      { path: "pre-publish-validation/:batchId", element: <PrePublishValidationPage /> },
      { path: "publish-tasks", element: <PublishTasksPage /> },
      { path: "publish-tasks/:id", element: <PublishTaskDetailPage /> },
      { path: "category-mapping", element: <CategoryMappingPage /> },
      { path: "attribute-mapping", element: <AttributeMappingPage /> },
      { path: "size-conversion", element: <SizeConversionPage /> },
      { path: "package-rules", element: <PackageRulesPage /> },
      { path: "price-rules", element: <PriceRulesPage /> },
      { path: "low-rate-list", element: <LowRateListPage /> },
      { path: "shein-metadata", element: <SheinMetadataPage /> },
      { path: "mdm-products", element: <MdmProductsPage /> },
      { path: "deepdraw-content", element: <DeepDrawContentPage /> },
      { path: "image-library", element: <ImageLibraryPage /> },
      { path: "shein-accounts", element: <SheinAccountsPage /> },
      { path: "sync-tasks", element: <SyncTasksPage /> },
      { path: "operation-logs", element: <OperationLogsPage /> },
    ],
  },
])
